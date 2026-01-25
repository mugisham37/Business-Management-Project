/**
 * Offline Sync Hook - Offline Operations Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useTenant } from '@/hooks/useTenant';
import { useUnifiedCache } from '@/lib/cache';
import {
  GET_OFFLINE_QUEUE,
  GET_OFFLINE_STATUS,
  GET_SYNC_CONFLICTS,
  GET_STORAGE_STATS,
} from '@/graphql/queries/pos-queries';
import {
  SYNC_OFFLINE_TRANSACTIONS,
  RESOLVE_CONFLICT,
  CLEAR_OFFLINE_CACHE,
  CACHE_ESSENTIAL_DATA,
  QUEUE_OFFLINE_OPERATION,
} from '@/graphql/mutations/pos-mutations';
import {
  OFFLINE_STATUS_CHANGED,
  SYNC_COMPLETED,
  CACHE_UPDATED,
} from '@/graphql/subscriptions/pos-subscriptions';
import type {
  OfflineQueueItem,
  SyncConflict,
} from '@/types/pos';

interface UseOfflineSyncOptions {
  deviceId?: string;
  autoSync?: boolean;
  syncInterval?: number;
  enableSubscriptions?: boolean;
}

interface UseOfflineSyncResult {
  // State
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  queuedOperations: OfflineQueueItem[];
  pendingConflicts: SyncConflict[];
  storageStats: {
    totalSize: number;
    usedSize: number;
    availableSize: number;
    itemCount: number;
    categories: Array<{
      category: string;
      size: number;
      itemCount: number;
    }>;
  } | null;
  error: Error | null;

  // Sync Operations
  syncOfflineTransactions: () => Promise<{
    success: boolean;
    processed: number;
    failed: number;
    conflicts: number;
    results: Array<{
      localId: string;
      serverId?: string;
      status: string;
      error?: string;
    }>;
  }>;
  
  // Conflict Resolution
  resolveConflict: (conflictId: string, resolution: 'server_wins' | 'client_wins' | 'merge', data?: Record<string, unknown>) => Promise<void>;
  
  // Cache Management
  clearOfflineCache: (categories?: string[]) => Promise<{
    clearedItems: number;
  }>;
  cacheEssentialData: (categories: string[]) => Promise<{
    cachedItems: number;
  }>;
  
  // Queue Management
  queueOfflineOperation: (operation: string, data: Record<string, unknown>, options?: {
    maxRetries?: number;
    priority?: 'high' | 'medium' | 'low';
  }) => Promise<string>;
  
  // Data Fetching
  refreshOfflineStatus: () => Promise<void>;
  refreshQueue: () => Promise<void>;
  refreshConflicts: () => Promise<void>;
  refreshStorageStats: () => Promise<void>;
  
  // Utilities
  getQueuedOperationsByType: (operationType: string) => OfflineQueueItem[];
  getConflictsByType: (conflictType: string) => SyncConflict[];
  hasUnresolvedConflicts: boolean;
  canSync: boolean;
}

export function useOfflineSync(options: UseOfflineSyncOptions = {}): UseOfflineSyncResult {
  const { 
    deviceId = 'default-device',
    autoSync = true,
    syncInterval = 30000, // 30 seconds
    enableSubscriptions = true 
  } = options;
  
  const { tenant: currentTenant } = useTenant();
  const cache = useUnifiedCache();
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [queuedOperations, setQueuedOperations] = useState<OfflineQueueItem[]>([]);
  const [pendingConflicts, setPendingConflicts] = useState<SyncConflict[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Queries
  const {
    loading: offlineStatusLoading,
    refetch: refetchOfflineStatus,
  } = useQuery(GET_OFFLINE_STATUS, {
    variables: { deviceId },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data.offlineStatus) {
        setIsOnline(data.offlineStatus.isOnline);
        setLastSyncAt(data.offlineStatus.lastSyncAt ? new Date(data.offlineStatus.lastSyncAt) : null);
        setIsSyncing(data.offlineStatus.syncInProgress);
      }
    },
    onError: (error) => setError(error),
  });

  const {
    loading: queueLoading,
    refetch: refetchQueue,
  } = useQuery(GET_OFFLINE_QUEUE, {
    variables: { deviceId },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data.offlineQueue) {
        setQueuedOperations(data.offlineQueue);
      }
    },
    onError: (error) => setError(error),
  });

  const {
    loading: conflictsLoading,
    refetch: refetchConflicts,
  } = useQuery(GET_SYNC_CONFLICTS, {
    variables: { deviceId },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data.syncConflicts) {
        setPendingConflicts(data.syncConflicts);
      }
    },
    onError: (error) => setError(error),
  });

  const {
    data: storageStatsData,
    loading: storageStatsLoading,
    refetch: refetchStorageStats,
  } = useQuery(GET_STORAGE_STATS, {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onError: (error) => setError(error),
  });

  // Mutations
  const [syncOfflineTransactionsMutation] = useMutation(SYNC_OFFLINE_TRANSACTIONS, {
    onCompleted: (data) => {
      if (data.syncOfflineTransactions.success) {
        setLastSyncAt(new Date());
        refetchQueue();
        refetchConflicts();
        cache.invalidateFromMutation('syncOfflineTransactions', {}, currentTenant?.id);
      }
    },
    onError: (error) => setError(error),
  });

  const [resolveConflictMutation] = useMutation(RESOLVE_CONFLICT, {
    onCompleted: () => {
      refetchConflicts();
      cache.invalidateFromMutation('resolveConflict', {}, currentTenant?.id);
    },
    onError: (error) => setError(error),
  });

  const [clearOfflineCacheMutation] = useMutation(CLEAR_OFFLINE_CACHE, {
    onCompleted: () => {
      refetchStorageStats();
      cache.invalidateFromMutation('clearOfflineCache', {}, currentTenant?.id);
    },
    onError: (error) => setError(error),
  });

  const [cacheEssentialDataMutation] = useMutation(CACHE_ESSENTIAL_DATA, {
    onCompleted: () => {
      refetchStorageStats();
      cache.invalidateFromMutation('cacheEssentialData', {}, currentTenant?.id);
    },
    onError: (error) => setError(error),
  });

  const [queueOfflineOperationMutation] = useMutation(QUEUE_OFFLINE_OPERATION, {
    onCompleted: () => {
      refetchQueue();
    },
    onError: (error) => setError(error),
  });

  // Subscriptions
  useSubscription(OFFLINE_STATUS_CHANGED, {
    variables: { deviceId },
    skip: !enableSubscriptions,
    onData: ({ data }) => {
      if (data.data?.offlineStatusChanged) {
        const status = data.data.offlineStatusChanged;
        setIsOnline(status.isOnline);
        setLastSyncAt(status.lastSyncAt ? new Date(status.lastSyncAt) : null);
        setIsSyncing(status.syncInProgress);
      }
    },
  });

  useSubscription(SYNC_COMPLETED, {
    variables: { deviceId },
    skip: !enableSubscriptions,
    onData: ({ data }) => {
      if (data.data?.syncCompleted) {
        const result = data.data.syncCompleted;
        setLastSyncAt(new Date(result.completedAt));
        setIsSyncing(false);
        refetchQueue();
        refetchConflicts();
      }
    },
  });

  useSubscription(CACHE_UPDATED, {
    variables: { category: '' }, // Will listen to all categories
    skip: !enableSubscriptions,
    onData: ({ data }) => {
      if (data.data?.cacheUpdated) {
        refetchStorageStats();
      }
    },
  });

  // Handlers - Declared before Effects to avoid TDZ issues
  const syncOfflineTransactions = useCallback(async () => {
    if (!isOnline || isSyncing) return { success: false, processed: 0, failed: 0, conflicts: 0, results: [] };

    try {
      setError(null);
      setIsSyncing(true);
      
      const result = await syncOfflineTransactionsMutation({
        variables: {
          input: {
            deviceId,
            operations: queuedOperations.map(op => ({
              id: op.id,
              operation: op.operation,
              data: op.data,
            })),
          },
        },
      });

      return result.data?.syncOfflineTransactions || {
        success: false,
        processed: 0,
        failed: 0,
        conflicts: 0,
        results: [],
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, syncOfflineTransactionsMutation, deviceId, queuedOperations]);

  const resolveConflict = useCallback(async (conflictId: string, resolution: 'server_wins' | 'client_wins' | 'merge', data?: Record<string, unknown>) => {
    try {
      setError(null);
      
      const result = await resolveConflictMutation({
        variables: {
          input: {
            conflictId,
            resolution,
            resolvedData: data,
          },
        },
      });

      if (!result.data?.resolveConflict.success) {
        throw new Error(result.data?.resolveConflict.message || 'Failed to resolve conflict');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [resolveConflictMutation]);

  const clearOfflineCache = useCallback(async (categories?: string[]) => {
    try {
      setError(null);
      
      const result = await clearOfflineCacheMutation({
        variables: {
          input: {
            deviceId,
            categories,
          },
        },
      });

      if (result.data?.clearOfflineCache.success) {
        return {
          clearedItems: result.data.clearOfflineCache.clearedItems,
        };
      } else {
        throw new Error(result.data?.clearOfflineCache.message || 'Failed to clear cache');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [clearOfflineCacheMutation, deviceId]);

  const cacheEssentialData = useCallback(async (categories: string[]) => {
    try {
      setError(null);
      
      const result = await cacheEssentialDataMutation({
        variables: {
          input: {
            deviceId,
            categories,
          },
        },
      });

      if (result.data?.cacheEssentialData.success) {
        return {
          cachedItems: result.data.cacheEssentialData.cachedItems,
        };
      } else {
        throw new Error(result.data?.cacheEssentialData.message || 'Failed to cache data');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [cacheEssentialDataMutation, deviceId]);

  const queueOfflineOperation = useCallback(async (operation: string, data: Record<string, unknown>, options?: {
    maxRetries?: number;
    priority?: 'high' | 'medium' | 'low';
  }) => {
    try {
      setError(null);
      
      const result = await queueOfflineOperationMutation({
        variables: {
          input: {
            deviceId,
            operation,
            data,
            maxRetries: options?.maxRetries || 3,
            priority: options?.priority || 'medium',
          },
        },
      });

      if (result.data?.queueOfflineOperation.success) {
        return result.data.queueOfflineOperation.queueId;
      } else {
        throw new Error(result.data?.queueOfflineOperation.message || 'Failed to queue operation');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [queueOfflineOperationMutation, deviceId]);

  // Effects
  useEffect(() => {
    // Listen to online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      if (autoSync) {
        syncOfflineTransactions();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoSync, syncOfflineTransactions]);

  useEffect(() => {
    // Auto-sync interval
    if (autoSync && isOnline && syncInterval > 0) {
      const interval = setInterval(() => {
        if (queuedOperations.length > 0 && !isSyncing) {
          void syncOfflineTransactions();
        }
      }, syncInterval);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoSync, isOnline, syncInterval, queuedOperations.length, isSyncing, syncOfflineTransactions]);

  // Data refresh functions
  const refreshOfflineStatus = useCallback(async () => {
    try {
      setError(null);
      await refetchOfflineStatus();
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchOfflineStatus]);

  const refreshQueue = useCallback(async () => {
    try {
      setError(null);
      await refetchQueue();
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchQueue]);

  const refreshConflicts = useCallback(async () => {
    try {
      setError(null);
      await refetchConflicts();
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchConflicts]);

  const refreshStorageStats = useCallback(async () => {
    try {
      setError(null);
      await refetchStorageStats();
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchStorageStats]);

  // Utility functions
  const getQueuedOperationsByType = useCallback((operationType: string) => {
    return queuedOperations.filter(op => op.operation === operationType);
  }, [queuedOperations]);

  const getConflictsByType = useCallback((conflictType: string) => {
    return pendingConflicts.filter(conflict => conflict.conflictType === conflictType);
  }, [pendingConflicts]);

  // Computed values
  const storageStats = storageStatsData?.storageStats || null;
  const hasUnresolvedConflicts = pendingConflicts.length > 0;
  const canSync = isOnline && !isSyncing && queuedOperations.length > 0;
  const isLoading = offlineStatusLoading || queueLoading || conflictsLoading || storageStatsLoading;

  return {
    // State
    isOnline,
    isSyncing: isSyncing || isLoading,
    lastSyncAt,
    queuedOperations,
    pendingConflicts,
    storageStats,
    error,

    // Sync Operations
    syncOfflineTransactions,
    
    // Conflict Resolution
    resolveConflict,
    
    // Cache Management
    clearOfflineCache,
    cacheEssentialData,
    
    // Queue Management
    queueOfflineOperation,
    
    // Data Fetching
    refreshOfflineStatus,
    refreshQueue,
    refreshConflicts,
    refreshStorageStats,
    
    // Utilities
    getQueuedOperationsByType,
    getConflictsByType,
    hasUnresolvedConflicts,
    canSync,
  };
}