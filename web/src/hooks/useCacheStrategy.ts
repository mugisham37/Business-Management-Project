import { useApolloClient, FetchPolicy, WatchQueryFetchPolicy, DocumentNode } from '@apollo/client';
import { useCallback, useEffect } from 'react';
import { cacheInvalidation } from '@/lib/apollo/cache-utils';
import { getUnifiedCacheManager } from '@/lib/cache';

export type CacheStrategy = 
  | 'cache-first'
  | 'cache-and-network'
  | 'network-only'
  | 'cache-only'
  | 'no-cache'
  | 'standby';

interface CacheStrategyOptions {
  defaultStrategy?: CacheStrategy;
  enableOfflineMode?: boolean;
  cacheTimeout?: number;
}

/**
 * Hook for managing cache strategies and policies
 * Enhanced with multi-tier caching and intelligent invalidation
 */
export function useCacheStrategy(options: CacheStrategyOptions = {}) {
  const client = useApolloClient();
  const unifiedCache = getUnifiedCacheManager();
  const {
    defaultStrategy = 'cache-first',
    enableOfflineMode = false,
    cacheTimeout = 300000, // 5 minutes
  } = options;

  // Determine optimal fetch policy based on network status and data freshness
  const getOptimalFetchPolicy = useCallback((
    lastFetch?: Date,
    isOffline?: boolean
  ): WatchQueryFetchPolicy => {
    if (isOffline && enableOfflineMode) {
      return 'cache-only';
    }

    if (lastFetch) {
      const timeSinceLastFetch = Date.now() - lastFetch.getTime();
      if (timeSinceLastFetch < cacheTimeout) {
        return 'cache-first';
      }
    }

    return defaultStrategy as WatchQueryFetchPolicy;
  }, [defaultStrategy, enableOfflineMode, cacheTimeout]);

  // Cache warming for critical data with multi-tier support
  const warmCache = useCallback(async (queries: Array<{
    query: DocumentNode;
    variables?: Record<string, unknown>;
    priority?: 'high' | 'medium' | 'low';
    tenantId?: string;
  }>) => {
    const warmingConfigs = queries
      .filter((q): q is typeof q & { tenantId: string } => !!q.tenantId)
      .map(({ query, variables, priority = 'medium', tenantId }) => {
        const definition = query.definitions[0] as unknown as { name?: { value?: string } };
        return {
          key: `query_${definition?.name?.value || 'unknown'}_${JSON.stringify(variables || {})}`,
          loader: async () => {
            const result = await client.query({
              query,
              variables: variables || {},
              fetchPolicy: 'network-only',
              errorPolicy: 'ignore',
            });
            return result.data;
          },
          priority,
          tenantId,
        };
      });

    try {
      if (warmingConfigs.length > 0) {
        await unifiedCache.warmCache(warmingConfigs);
        console.log('Multi-tier cache warming completed');
      }
    } catch (error) {
      console.warn('Multi-tier cache warming failed:', error);
    }
  }, [client, unifiedCache]);

  // Intelligent cache invalidation based on mutation impact
  const invalidateRelatedData = useCallback(async (
    mutationType: string,
    affectedEntityTypes: string[],
    tenantId?: string
  ) => {
    try {
      // Use intelligent invalidation engine
      await unifiedCache.invalidateFromMutation(mutationType, {}, tenantId);
      
      // Fallback to manual invalidation for additional types
      const fieldsToInvalidate = affectedEntityTypes.map(type => type.toLowerCase());
      if (fieldsToInvalidate.length > 0) {
        cacheInvalidation.invalidateFields(fieldsToInvalidate);
      }
    } catch (error) {
      console.error('Intelligent cache invalidation failed:', error);
      
      // Fallback to basic invalidation
      const invalidationMap: Record<string, string[]> = {
        'createUser': ['users', 'userStats'],
        'updateUser': ['users', 'currentUser'],
        'deleteUser': ['users', 'userStats'],
        'createTenant': ['tenants', 'tenantStats'],
        'updateTenant': ['tenants', 'currentTenant'],
        'deleteTenant': ['tenants', 'tenantStats'],
      };

      const fieldsToInvalidate = invalidationMap[mutationType] || affectedEntityTypes;
      
      if (fieldsToInvalidate.length > 0) {
        cacheInvalidation.invalidateFields(fieldsToInvalidate);
      }
    }
  }, [unifiedCache]);

  // Cache size monitoring and cleanup with multi-tier awareness
  const monitorCacheSize = useCallback(() => {
    // Get Apollo Cache size
    const cacheData = client.cache.extract();
    const apolloCacheSize = JSON.stringify(cacheData).length;
    const maxCacheSize = 10 * 1024 * 1024; // 10MB

    // Get multi-tier cache metrics
    const multiTierMetrics = unifiedCache.getMetrics();
    const totalMemoryUsage = multiTierMetrics.multiTier.memoryUsage + apolloCacheSize;

    if (totalMemoryUsage > maxCacheSize) {
      console.warn(`Total cache size (${(totalMemoryUsage / 1024 / 1024).toFixed(2)}MB) exceeds limit`);
      
      // Perform selective Apollo Cache cleanup
      const oldestEntries = Object.keys(cacheData)
        .filter(key => key.startsWith('ROOT_QUERY'))
        .slice(0, Math.floor(Object.keys(cacheData).length * 0.3));

      oldestEntries.forEach(key => {
        client.cache.evict({ id: key });
      });
      
      client.cache.gc();
    }

    return {
      apolloCache: apolloCacheSize,
      multiTierCache: multiTierMetrics.multiTier.memoryUsage,
      total: totalMemoryUsage,
      metrics: multiTierMetrics,
    };
  }, [client, unifiedCache]);

  // Periodic cache cleanup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const interval = setInterval(() => {
      monitorCacheSize();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [monitorCacheSize]);

  // Network status aware caching
  const getNetworkAwareFetchPolicy = useCallback((
    isOnline: boolean = navigator?.onLine ?? true
  ): FetchPolicy => {
    if (!isOnline && enableOfflineMode) {
      return 'cache-only';
    }

    if (!isOnline) {
      return 'cache-first';
    }

    return defaultStrategy as FetchPolicy;
  }, [defaultStrategy, enableOfflineMode]);

  // Cache preloading for anticipated user actions with multi-tier support
  const preloadData = useCallback(async (
    preloadQueries: Array<{
      query: DocumentNode;
      variables?: Record<string, unknown>;
      priority?: 'high' | 'medium' | 'low';
      tenantId?: string;
    }>
  ) => {
    // Sort by priority
    const sortedQueries = preloadQueries.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'];
    });

    // Execute high priority queries immediately
    const highPriorityQueries = sortedQueries.filter(q => q.priority === 'high');
    if (highPriorityQueries.length > 0) {
      await warmCache(highPriorityQueries);
    }

    // Execute medium and low priority queries with delay
    const otherQueries = sortedQueries.filter(q => q.priority !== 'high');
    if (otherQueries.length > 0) {
      setTimeout(() => {
        warmCache(otherQueries);
      }, 1000);
    }
  }, [warmCache]);

  return {
    getOptimalFetchPolicy,
    getNetworkAwareFetchPolicy,
    warmCache,
    preloadData,
    invalidateRelatedData,
    monitorCacheSize,
    
    // Cache utilities with multi-tier support
    clearCache: () => {
      client.cache.reset();
      // Note: Multi-tier cache clearing would need tenant context
    },
    clearTenantCache: async (tenantId: string) => {
      await unifiedCache.clearTenant(tenantId);
      cacheInvalidation.clearTenantCache();
    },
    evictEntity: (id: string) => {
      client.cache.evict({ id });
      client.cache.gc();
    },
    
    // Multi-tier cache access
    getUnifiedCache: () => unifiedCache,
    
    // Cache inspection (development)
    inspectCache: () => {
      if (process.env.NODE_ENV === 'development') {
        const apolloCache = client.cache.extract();
        const cacheMetrics = monitorCacheSize();
        
        console.log('Apollo Cache contents:', apolloCache);
        console.log('Cache metrics:', cacheMetrics);
        console.log('Multi-tier cache metrics:', cacheMetrics.metrics);
      }
    },
  };
}