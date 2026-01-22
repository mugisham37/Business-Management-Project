import { getMultiTierCache } from './multi-tier-cache';
import { getCacheInvalidationEngine } from './intelligent-invalidation';

/**
 * Offline caching system that provides cache-first strategies,
 * data synchronization on reconnection, and offline status indicators
 */

export interface OfflineQueueItem {
  id: string;
  type: 'mutation' | 'query';
  operation: unknown;
  variables: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  tenantId?: string;
}

export interface OfflineMetrics {
  isOnline: boolean;
  lastOnlineTime: Date | null;
  queuedOperations: number;
  syncedOperations: number;
  failedOperations: number;
  totalOfflineTime: number;
  syncInProgress: boolean;
}

export interface SyncResult {
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ operation: OfflineQueueItem; error: Error }>;
}

/**
 * Network Status Monitor
 */
class NetworkStatusMonitor {
  private isOnline: boolean = navigator?.onLine ?? true;
  private listeners = new Set<(isOnline: boolean) => void>();
  private lastOnlineTime: Date | null = null;
  private offlineStartTime: Date | null = null;

  constructor() {
    this.setupEventListeners();
    this.lastOnlineTime = this.isOnline ? new Date() : null;
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.setOnlineStatus(true);
    });

    window.addEventListener('offline', () => {
      this.setOnlineStatus(false);
    });

    // Additional connectivity checks
    this.startConnectivityPolling();
  }

  private setOnlineStatus(online: boolean): void {
    const wasOnline = this.isOnline;
    this.isOnline = online;

    if (online && !wasOnline) {
      this.lastOnlineTime = new Date();
      this.offlineStartTime = null;
      console.log('Network connection restored');
    } else if (!online && wasOnline) {
      this.offlineStartTime = new Date();
      console.log('Network connection lost');
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(online);
      } catch (error) {
        console.error('Network status listener error:', error);
      }
    });
  }

  private startConnectivityPolling(): void {
    // Poll connectivity every 30 seconds when offline
    setInterval(async () => {
      if (!this.isOnline) {
        const isActuallyOnline = await this.checkConnectivity();
        if (isActuallyOnline !== this.isOnline) {
          this.setOnlineStatus(isActuallyOnline);
        }
      }
    }, 30000);
  }

  private async checkConnectivity(): Promise<boolean> {
    try {
      // Try to fetch a small resource to verify connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getStatus(): boolean {
    return this.isOnline;
  }

  getLastOnlineTime(): Date | null {
    return this.lastOnlineTime;
  }

  getTotalOfflineTime(): number {
    if (!this.offlineStartTime) return 0;
    return Date.now() - this.offlineStartTime.getTime();
  }

  addListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/**
 * Offline Operation Queue
 */
class OfflineOperationQueue {
  private queue: OfflineQueueItem[] = [];
  private storageKey = 'offline_operation_queue';

  constructor() {
    this.loadFromStorage();
  }

  add(operation: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): void {
    const item: OfflineQueueItem = {
      ...operation,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(item);
    this.saveToStorage();

    console.log('Operation queued for offline sync:', item.type, item.id);
  }

  getAll(): OfflineQueueItem[] {
    return [...this.queue];
  }

  remove(id: string): void {
    this.queue = this.queue.filter(item => item.id !== id);
    this.saveToStorage();
  }

  incrementRetry(id: string): void {
    const item = this.queue.find(item => item.id === id);
    if (item) {
      item.retryCount++;
      this.saveToStorage();
    }
  }

  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }

  size(): number {
    return this.queue.length;
  }

  private generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline queue from storage:', error);
      this.queue = [];
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue to storage:', error);
    }
  }
}

/**
 * Offline Cache Manager
 */
export class OfflineCacheManager {
  private networkMonitor: NetworkStatusMonitor;
  private operationQueue: OfflineOperationQueue;
  private multiTierCache = getMultiTierCache();
  private invalidationEngine = getCacheInvalidationEngine();
  
  private metrics: OfflineMetrics = {
    isOnline: true,
    lastOnlineTime: null,
    queuedOperations: 0,
    syncedOperations: 0,
    failedOperations: 0,
    totalOfflineTime: 0,
    syncInProgress: false,
  };

  private syncListeners = new Set<(result: SyncResult) => void>();

  constructor() {
    this.networkMonitor = new NetworkStatusMonitor();
    this.operationQueue = new OfflineOperationQueue();
    
    this.setupNetworkListener();
    this.updateMetrics();
  }

  /**
   * Get data with offline-first strategy
   */
  async get<T>(key: string, options: {
    tenantId?: string;
    networkFallback?: () => Promise<T>;
    cacheFirst?: boolean;
  } = {}): Promise<T | null> {
    const { tenantId, networkFallback, cacheFirst = true } = options;

    try {
      // Always try cache first in offline mode or when cacheFirst is true
      if (!this.networkMonitor.getStatus() || cacheFirst) {
        const getOptions: { tenantId?: string } = {};
        if (tenantId !== undefined) getOptions.tenantId = tenantId;
        const cachedData = await this.multiTierCache.get<T>(key, getOptions);
        
        if (cachedData !== null) {
          return cachedData;
        }

        // If offline and no cache, return null
        if (!this.networkMonitor.getStatus()) {
          console.log(`Offline: No cached data available for key: ${key}`);
          return null;
        }
      }

      // Try network if online and fallback is provided
      if (this.networkMonitor.getStatus() && networkFallback) {
        try {
          const networkData = await networkFallback();
          
          if (networkData !== null) {
            // Cache the network data
            const setOptions: { priority: 'medium'; tenantId?: string } = {
              priority: 'medium',
            };
            if (tenantId !== undefined) setOptions.tenantId = tenantId;
            await this.multiTierCache.set(key, networkData, setOptions);
          }
          
          return networkData;
        } catch (error) {
          console.error('Network fallback failed:', error);
          
          // Try cache as fallback
          const fallbackOptions: { tenantId?: string } = {};
          if (tenantId !== undefined) fallbackOptions.tenantId = tenantId;
          return await this.multiTierCache.get<T>(key, fallbackOptions);
        }
      }

      return null;
    } catch (error) {
      console.error('Offline cache get error:', error);
      return null;
    }
  }

  /**
   * Queue mutation for offline sync
   */
  queueMutation(mutation: unknown, variables: unknown, options: {
    tenantId?: string;
    maxRetries?: number;
  } = {}): void {
    const { tenantId, maxRetries = 3 } = options;

    const queueItem: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'> = {
      type: 'mutation',
      operation: mutation,
      variables,
      maxRetries,
    };
    if (tenantId !== undefined) queueItem.tenantId = tenantId;
    
    this.operationQueue.add(queueItem);

    this.metrics.queuedOperations++;
    
    // Try immediate sync if online
    if (this.networkMonitor.getStatus()) {
      this.syncOperations();
    }
  }

  /**
   * Sync queued operations when back online
   */
  async syncOperations(): Promise<SyncResult> {
    if (this.metrics.syncInProgress) {
      console.log('Sync already in progress');
      return { successful: 0, failed: 0, skipped: 0, errors: [] };
    }

    if (!this.networkMonitor.getStatus()) {
      console.log('Cannot sync: offline');
      return { successful: 0, failed: 0, skipped: 0, errors: [] };
    }

    this.metrics.syncInProgress = true;
    const operations = this.operationQueue.getAll();
    
    if (operations.length === 0) {
      this.metrics.syncInProgress = false;
      return { successful: 0, failed: 0, skipped: 0, errors: [] };
    }

    console.log(`Starting sync of ${operations.length} queued operations`);

    const result: SyncResult = {
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    // Process operations in order
    for (const operation of operations) {
      try {
        if (operation.retryCount >= operation.maxRetries) {
          result.skipped++;
          this.operationQueue.remove(operation.id);
          continue;
        }

        await this.executeOperation(operation);
        
        result.successful++;
        this.metrics.syncedOperations++;
        this.operationQueue.remove(operation.id);
        
        console.log(`Synced operation: ${operation.type} ${operation.id}`);
      } catch (error) {
        console.error(`Failed to sync operation ${operation.id}:`, error);
        
        this.operationQueue.incrementRetry(operation.id);
        result.failed++;
        this.metrics.failedOperations++;
        result.errors.push({ operation, error: error as Error });
      }
    }

    this.metrics.syncInProgress = false;
    
    console.log('Sync completed:', result);
    
    // Notify listeners
    this.syncListeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    });

    return result;
  }

  /**
   * Enable offline mode (for testing or manual control)
   */
  setOfflineMode(offline: boolean): void {
    // This would override the network status for testing
    console.log(`Offline mode ${offline ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get offline metrics
   */
  getMetrics(): OfflineMetrics {
    return {
      ...this.metrics,
      isOnline: this.networkMonitor.getStatus(),
      lastOnlineTime: this.networkMonitor.getLastOnlineTime(),
      queuedOperations: this.operationQueue.size(),
      totalOfflineTime: this.networkMonitor.getTotalOfflineTime(),
    };
  }

  /**
   * Add sync listener
   */
  addSyncListener(listener: (result: SyncResult) => void): () => void {
    this.syncListeners.add(listener);
    
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  /**
   * Clear all offline data
   */
  clearOfflineData(): void {
    this.operationQueue.clear();
    this.metrics.queuedOperations = 0;
    this.metrics.syncedOperations = 0;
    this.metrics.failedOperations = 0;
  }

  // Private helper methods

  private setupNetworkListener(): void {
    this.networkMonitor.addListener((isOnline) => {
      this.metrics.isOnline = isOnline;
      
      if (isOnline) {
        console.log('Back online - starting sync');
        this.syncOperations();
      }
    });
  }

  private async executeOperation(operation: OfflineQueueItem): Promise<unknown> {
    if (operation.type === 'mutation') {
      // Execute the mutation using Apollo Client
      const { apolloClient } = await import('@/lib/apollo/client');
      
      const result = await apolloClient.mutate({
        mutation: operation.operation as Parameters<typeof apolloClient.mutate>[0]['mutation'],
        variables: operation.variables as Record<string, unknown>,
        errorPolicy: 'none', // Throw on any error
      });

      // Invalidate related cache entries
      const mutationType = this.extractMutationType(operation.operation);
      if (mutationType) {
        await this.invalidationEngine.invalidateFromMutation(
          mutationType,
          operation.variables,
          operation.tenantId
        );
      }

      return result;
    }
    
    throw new Error(`Unsupported operation type: ${operation.type}`);
  }

  private extractMutationType(mutation: unknown): string | null {
    try {
      // Extract mutation name from GraphQL document
      const mutationDoc = mutation as { definitions?: Array<{ kind?: string; operation?: string; selectionSet?: { selections?: Array<{ kind?: string; name?: { value?: string } }> } }> };
      const definition = mutationDoc.definitions?.[0];
      if (definition?.kind === 'OperationDefinition' && definition.operation === 'mutation') {
        const selection = definition.selectionSet?.selections?.[0];
        if (selection?.kind === 'Field') {
          return selection.name?.value || null;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private updateMetrics(): void {
    // Update metrics periodically
    setInterval(() => {
      this.metrics.isOnline = this.networkMonitor.getStatus();
      this.metrics.lastOnlineTime = this.networkMonitor.getLastOnlineTime();
      this.metrics.queuedOperations = this.operationQueue.size();
      this.metrics.totalOfflineTime = this.networkMonitor.getTotalOfflineTime();
    }, 1000);
  }
}

// Singleton instance
let offlineCacheManagerInstance: OfflineCacheManager | null = null;

export function getOfflineCacheManager(): OfflineCacheManager {
  if (!offlineCacheManagerInstance) {
    offlineCacheManagerInstance = new OfflineCacheManager();
  }
  
  return offlineCacheManagerInstance;
}

// React hook for offline functionality
export function useOfflineCache() {
  const manager = getOfflineCacheManager();

  return {
    get: manager.get.bind(manager),
    queueMutation: manager.queueMutation.bind(manager),
    syncOperations: manager.syncOperations.bind(manager),
    getMetrics: manager.getMetrics.bind(manager),
    addSyncListener: manager.addSyncListener.bind(manager),
    clearOfflineData: manager.clearOfflineData.bind(manager),
  };
}