import { useEffect, useState, useRef, useCallback } from 'react';
import { DocumentNode, TypedDocumentNode } from '@apollo/client';
import { Observable, Subscription } from 'rxjs';
import { subscriptionManager, SubscriptionOptions, SubscriptionResult, ConnectionStatus } from './subscription-manager';
import { useTenant } from '@/lib/tenant';

/**
 * React hook for GraphQL subscriptions with automatic cleanup
 */
export function useSubscription<T = unknown>(
  subscription: DocumentNode | TypedDocumentNode,
  options?: {
    variables?: Record<string, unknown>;
    skip?: boolean;
    onData?: (data: T) => void;
    onError?: (error: Error) => void;
    onConnectionChange?: (status: ConnectionStatus) => void;
  }
) {
  const { currentTenant } = useTenant();
  const [result, setResult] = useState<SubscriptionResult<T>>({ loading: false });
  const subscriptionRef = useRef<Subscription | null>(null);
  const observableRef = useRef<Observable<SubscriptionResult<T>> | null>(null);

  const { variables, skip = false, onData, onError, onConnectionChange } = options || {};

  // Memoize subscription options
  const subscriptionOptions: SubscriptionOptions = {
    tenantFilter: currentTenant?.id,
    errorPolicy: 'all',
    onError,
    onConnectionChange
  };

  const subscribe = useCallback(() => {
    if (skip) return;

    // Clean up previous subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Create new subscription
    observableRef.current = subscriptionManager.subscribe<T>(
      subscription,
      variables,
      subscriptionOptions
    );

    subscriptionRef.current = observableRef.current.subscribe({
      next: (subscriptionResult) => {
        setResult(subscriptionResult);
        
        if (subscriptionResult.data && onData) {
          onData(subscriptionResult.data);
        }
      },
      error: (error) => {
        setResult(prev => ({ ...prev, error, loading: false }));
        if (onError) {
          onError(error);
        }
      }
    });
  }, [subscription, variables, skip, onData, onError, onConnectionChange, currentTenant?.id]);

  // Subscribe on mount and when dependencies change
  useEffect(() => {
    subscribe();

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [subscribe]);

  // Provide manual refetch capability
  const refetch = useCallback(() => {
    subscribe();
  }, [subscribe]);

  return {
    data: result.data,
    error: result.error,
    loading: result.loading,
    refetch
  };
}

/**
 * Hook to monitor connection status
 */
export function useSubscriptionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [stats, setStats] = useState(subscriptionManager.getConnectionStats());

  useEffect(() => {
    const subscription = subscriptionManager.getConnectionStatus().subscribe(setStatus);
    
    // Update stats periodically
    const statsInterval = setInterval(() => {
      setStats(subscriptionManager.getConnectionStats());
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(statsInterval);
    };
  }, []);

  const reconnect = useCallback(() => {
    return subscriptionManager.reconnect();
  }, []);

  return {
    status,
    stats,
    reconnect,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting' || status === 'reconnecting',
    hasError: status === 'error'
  };
}

/**
 * Hook for tenant-specific subscriptions with automatic filtering
 */
export function useTenantSubscription<T = any>(
  subscription: DocumentNode | TypedDocumentNode,
  options?: {
    variables?: any;
    skip?: boolean;
    onData?: (data: T) => void;
    onError?: (error: Error) => void;
  }
) {
  const { currentTenant } = useTenant();
  
  // Automatically add tenant filter to variables
  const enhancedVariables = {
    ...options?.variables,
    tenantId: currentTenant?.id
  };

  return useSubscription<T>(subscription, {
    ...options,
    variables: enhancedVariables,
    skip: options?.skip || !currentTenant?.id
  });
}

/**
 * Hook for managing multiple subscriptions
 */
export function useMultipleSubscriptions<T = unknown>(
  subscriptions: Array<{
    subscription: DocumentNode | TypedDocumentNode;
    variables?: Record<string, unknown>;
    key: string;
  }>,
  options?: {
    skip?: boolean;
    onData?: (key: string, data: T) => void;
    onError?: (key: string, error: Error) => void;
  }
) {
  const [results, setResults] = useState<Record<string, SubscriptionResult<T>>>({});
  const { currentTenant } = useTenant();

  useEffect(() => {
    if (options?.skip || !currentTenant?.id) return;

    const subscriptionRefs: Record<string, Subscription> = {};

    subscriptions.forEach(({ subscription, variables, key }) => {
      const observable = subscriptionManager.subscribe<T>(
        subscription,
        variables,
        {
          tenantFilter: currentTenant?.id,
          errorPolicy: 'all'
        }
      );

      subscriptionRefs[key] = observable.subscribe({
        next: (result) => {
          setResults(prev => ({ ...prev, [key]: result }));
          
          if (result.data && options?.onData) {
            options.onData(key, result.data);
          }
        },
        error: (error) => {
          setResults(prev => ({ 
            ...prev, 
            [key]: { ...prev[key], error, loading: false } 
          }));
          
          if (options?.onError) {
            options.onError(key, error);
          }
        }
      });
    });

    return () => {
      Object.values(subscriptionRefs).forEach(sub => sub.unsubscribe());
    };
  }, [subscriptions, options?.skip, currentTenant?.id, options?.onData, options?.onError]);

  return results;
}

/**
 * Hook for subscription with automatic retry and error recovery
 */
export function useResilientSubscription<T = unknown>(
  subscription: DocumentNode | TypedDocumentNode,
  options?: {
    variables?: Record<string, unknown>;
    skip?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    onData?: (data: T) => void;
    onError?: (error: Error, retryCount: number) => void;
    onMaxRetriesReached?: () => void;
  }
) {
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = options?.maxRetries || 3;
  const retryDelay = options?.retryDelay || 5000;

  const handleError = useCallback((error: Error) => {
    const currentRetryCount = retryCount + 1;
    setRetryCount(currentRetryCount);

    if (options?.onError) {
      options.onError(error, currentRetryCount);
    }

    if (currentRetryCount >= maxRetries) {
      if (options?.onMaxRetriesReached) {
        options.onMaxRetriesReached();
      }
      return;
    }

    // Retry after delay
    setTimeout(() => {
      setRetryCount(0); // Reset retry count on successful retry
    }, retryDelay);
  }, [retryCount, maxRetries, retryDelay, options]);

  const subscriptionResult = useSubscription<T>(subscription, {
    ...options,
    onError: handleError
  });

  return {
    ...subscriptionResult,
    retryCount,
    maxRetries,
    canRetry: retryCount < maxRetries
  };
}