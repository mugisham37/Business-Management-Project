import { Observable, BehaviorSubject, fromEvent, merge, timer, EMPTY } from 'rxjs';
import { 
  map, 
  filter, 
  switchMap, 
  retry, 
  retryWhen, 
  delay, 
  tap, 
  catchError,
  distinctUntilChanged,
  share,
  takeUntil
} from 'rxjs/operators';
import { DocumentNode, TypedDocumentNode } from '@apollo/client';
import { Client, createClient, ClientOptions } from 'graphql-ws';
import { config } from '@/lib/config/env';

export type ConnectionStatus = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'reconnecting' 
  | 'error';

export interface SubscriptionOptions {
  tenantFilter?: string;
  errorPolicy?: 'none' | 'ignore' | 'all';
  fetchPolicy?: 'cache-first' | 'network-only' | 'cache-and-network';
  onError?: (error: Error) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
}

export interface SubscriptionResult<T = unknown> {
  data?: T;
  error?: Error;
  loading: boolean;
}

interface ActiveSubscription {
  id: string;
  subscription: DocumentNode | TypedDocumentNode;
  variables?: Record<string, unknown>;
  options?: SubscriptionOptions;
  observable: Observable<unknown>;
  unsubscribe: () => void;
}

interface ConnectionPool {
  client: Client;
  subscriptions: Map<string, ActiveSubscription>;
  status: ConnectionStatus;
  reconnectAttempts: number;
  lastError?: Error;
}

/**
 * Advanced subscription manager with connection pooling, automatic reconnection,
 * and tenant-aware filtering
 */
export class SubscriptionManager {
  private connectionPools = new Map<string, ConnectionPool>();
  private connectionStatus$ = new BehaviorSubject<ConnectionStatus>('disconnected');
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private maxReconnectAttempts = 10;
  private defaultPoolKey = 'default';

  constructor() {
    // Initialize default connection pool
    this.initializeConnectionPool(this.defaultPoolKey);
  }

  /**
   * Subscribe to a GraphQL subscription with automatic connection management
   */
  subscribe<T = unknown>(
    subscription: DocumentNode | TypedDocumentNode,
    variables?: Record<string, unknown>,
    options?: SubscriptionOptions
  ): Observable<SubscriptionResult<T>> {
    const subscriptionId = this.generateSubscriptionId(subscription, variables);
    const poolKey = options?.tenantFilter || this.defaultPoolKey;
    
    // Ensure connection pool exists for this tenant
    if (!this.connectionPools.has(poolKey)) {
      this.initializeConnectionPool(poolKey, options?.tenantFilter);
    }

    const pool = this.connectionPools.get(poolKey)!;
    
    // Check if subscription already exists
    if (pool.subscriptions.has(subscriptionId)) {
      return pool.subscriptions.get(subscriptionId)!.observable;
    }

    // Create new subscription observable
    const observable = this.createSubscriptionObservable<T>(
      pool,
      subscription,
      variables,
      options
    );

    // Store active subscription
    const activeSubscription: ActiveSubscription = {
      id: subscriptionId,
      subscription,
      variables,
      options,
      observable,
      unsubscribe: () => this.unsubscribe(subscriptionId, poolKey)
    };

    pool.subscriptions.set(subscriptionId, activeSubscription);

    return observable;
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(subscriptionId: string, poolKey: string = this.defaultPoolKey): void {
    const pool = this.connectionPools.get(poolKey);
    if (pool && pool.subscriptions.has(subscriptionId)) {
      pool.subscriptions.delete(subscriptionId);
      
      // If no more subscriptions, consider closing the connection
      if (pool.subscriptions.size === 0) {
        this.scheduleConnectionCleanup(poolKey);
      }
    }
  }

  /**
   * Force reconnection for all connection pools
   */
  async reconnect(): Promise<void> {
    const reconnectPromises = Array.from(this.connectionPools.entries()).map(
      ([poolKey, pool]) => this.reconnectPool(poolKey)
    );
    
    await Promise.all(reconnectPromises);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): Observable<ConnectionStatus> {
    return this.connectionStatus$.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const stats = {
      totalPools: this.connectionPools.size,
      totalSubscriptions: 0,
      poolStats: new Map<string, { subscriptions: number; status: ConnectionStatus }>()
    };

    this.connectionPools.forEach((pool, poolKey) => {
      stats.totalSubscriptions += pool.subscriptions.size;
      stats.poolStats.set(poolKey, {
        subscriptions: pool.subscriptions.size,
        status: pool.status
      });
    });

    return stats;
  }

  /**
   * Cleanup all connections and subscriptions
   */
  cleanup(): void {
    this.connectionPools.forEach((pool, poolKey) => {
      pool.client.dispose();
      pool.subscriptions.clear();
    });
    this.connectionPools.clear();
    this.connectionStatus$.complete();
  }

  private initializeConnectionPool(poolKey: string, tenantId?: string): void {
    const clientOptions: ClientOptions = {
      url: config.graphql.wsUri,
      connectionParams: async () => {
        let token = null;
        
        try {
          const { authManager } = await import('@/lib/auth');
          token = await authManager.getAccessToken();
        } catch (error) {
          console.warn('Failed to get auth token for WebSocket:', error);
          token = localStorage.getItem('accessToken');
        }
        
        return {
          authorization: token ? `Bearer ${token}` : '',
          'x-tenant-id': tenantId || localStorage.getItem('currentTenantId') || '',
        };
      },
      retryAttempts: 0, // We handle reconnection manually
      shouldRetry: () => false,
      on: {
        connecting: () => this.updateConnectionStatus('connecting'),
        connected: () => {
          this.updateConnectionStatus('connected');
          this.resetReconnectDelay();
        },
        closed: () => {
          this.updateConnectionStatus('disconnected');
          this.handleConnectionClosed(poolKey);
        },
        error: (error) => {
          console.error(`WebSocket error in pool ${poolKey}:`, error);
          this.updateConnectionStatus('error');
          this.handleConnectionError(poolKey, error);
        }
      }
    };

    const client = createClient(clientOptions);
    
    const pool: ConnectionPool = {
      client,
      subscriptions: new Map(),
      status: 'disconnected',
      reconnectAttempts: 0
    };

    this.connectionPools.set(poolKey, pool);
  }

  private createSubscriptionObservable<T>(
    pool: ConnectionPool,
    subscription: DocumentNode | TypedDocumentNode,
    variables?: Record<string, unknown>,
    options?: SubscriptionOptions
  ): Observable<SubscriptionResult<T>> {
    return new Observable<SubscriptionResult<T>>(subscriber => {
      // Start with loading state
      subscriber.next({ loading: true });

      const unsubscribe = pool.client.subscribe(
        {
          query: subscription,
          variables
        },
        {
          next: (data) => {
            subscriber.next({
              data: data.data as T,
              loading: false
            });
          },
          error: (error) => {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            
            if (options?.onError) {
              options.onError(errorObj);
            }
            
            if (options?.errorPolicy === 'ignore') {
              return;
            }
            
            subscriber.next({
              error: errorObj,
              loading: false
            });
            
            if (options?.errorPolicy !== 'all') {
              subscriber.error(errorObj);
            }
          },
          complete: () => {
            subscriber.complete();
          }
        }
      );

      // Return cleanup function
      return () => {
        unsubscribe();
      };
    }).pipe(
      // Add retry logic with exponential backoff
      retryWhen(errors =>
        errors.pipe(
          tap(error => console.warn('Subscription error, retrying...', error)),
          delay(this.calculateRetryDelay()),
          tap(() => this.incrementReconnectDelay())
        )
      ),
      // Share the observable among multiple subscribers
      share()
    );
  }

  private generateSubscriptionId(
    subscription: DocumentNode | TypedDocumentNode,
    variables?: any
  ): string {
    const operationName = subscription.definitions[0]?.kind === 'OperationDefinition' 
      ? subscription.definitions[0].name?.value || 'anonymous'
      : 'anonymous';
    
    const variablesHash = variables ? JSON.stringify(variables) : '';
    return `${operationName}_${btoa(variablesHash).slice(0, 8)}`;
  }

  private async reconnectPool(poolKey: string): Promise<void> {
    const pool = this.connectionPools.get(poolKey);
    if (!pool) return;

    if (pool.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for pool ${poolKey}`);
      return;
    }

    pool.reconnectAttempts++;
    this.updateConnectionStatus('reconnecting');

    try {
      // Dispose old client
      pool.client.dispose();
      
      // Create new client with same configuration
      const tenantId = poolKey !== this.defaultPoolKey ? poolKey : undefined;
      this.initializeConnectionPool(poolKey, tenantId);
      
      // Resubscribe to all active subscriptions
      const subscriptions = Array.from(pool.subscriptions.values());
      pool.subscriptions.clear();
      
      for (const sub of subscriptions) {
        this.subscribe(sub.subscription, sub.variables, sub.options);
      }
      
    } catch (error) {
      console.error(`Failed to reconnect pool ${poolKey}:`, error);
      pool.lastError = error instanceof Error ? error : new Error(String(error));
      
      // Schedule next reconnection attempt
      setTimeout(() => this.reconnectPool(poolKey), this.calculateRetryDelay());
    }
  }

  private handleConnectionClosed(poolKey: string): void {
    const pool = this.connectionPools.get(poolKey);
    if (!pool) return;

    pool.status = 'disconnected';
    
    // Only attempt reconnection if there are active subscriptions
    if (pool.subscriptions.size > 0) {
      setTimeout(() => this.reconnectPool(poolKey), this.calculateRetryDelay());
    }
  }

  private handleConnectionError(poolKey: string, error: unknown): void {
    const pool = this.connectionPools.get(poolKey);
    if (!pool) return;

    pool.status = 'error';
    pool.lastError = error instanceof Error ? error : new Error(String(error));
    
    // Attempt reconnection after delay
    setTimeout(() => this.reconnectPool(poolKey), this.calculateRetryDelay());
  }

  private calculateRetryDelay(): number {
    return Math.min(this.reconnectDelay, this.maxReconnectDelay);
  }

  private incrementReconnectDelay(): void {
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private resetReconnectDelay(): void {
    this.reconnectDelay = 1000;
  }

  private updateConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus$.next(status);
  }

  private scheduleConnectionCleanup(poolKey: string): void {
    // Clean up unused connections after 30 seconds of inactivity
    setTimeout(() => {
      const pool = this.connectionPools.get(poolKey);
      if (pool && pool.subscriptions.size === 0 && poolKey !== this.defaultPoolKey) {
        pool.client.dispose();
        this.connectionPools.delete(poolKey);
      }
    }, 30000);
  }
}

// Singleton instance
export const subscriptionManager = new SubscriptionManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    subscriptionManager.cleanup();
  });
}