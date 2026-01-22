import { useCallback, useEffect, useRef } from 'react';
import { useUnifiedCache } from '@/lib/cache';
import { DocumentNode } from '@apollo/client';

interface CacheWarmingConfig {
  key: string;
  query?: DocumentNode;
  variables?: any;
  loader?: () => Promise<any>;
  priority?: 'high' | 'medium' | 'low';
  tenantId?: string;
  dependencies?: string[];
  schedule?: {
    immediate?: boolean;
    interval?: number; // milliseconds
    onMount?: boolean;
    onTenantChange?: boolean;
  };
}

interface CacheWarmingOptions {
  enabled?: boolean;
  batchSize?: number;
  delayBetweenBatches?: number;
}

/**
 * Hook for managing cache warming strategies
 */
export function useCacheWarming(
  configs: CacheWarmingConfig[],
  options: CacheWarmingOptions = {}
) {
  const { warmCache, getMetrics } = useUnifiedCache();
  const {
    enabled = true,
    batchSize = 5,
    delayBetweenBatches = 1000,
  } = options;

  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isWarmingRef = useRef(false);

  /**
   * Execute cache warming for a single config
   */
  const warmSingleCache = useCallback(async (config: CacheWarmingConfig) => {
    if (!enabled) return;

    try {
      let loader: () => Promise<any>;

      if (config.loader) {
        loader = config.loader;
      } else if (config.query) {
        // Create loader from GraphQL query
        loader = async () => {
          const { apolloClient } = await import('@/lib/apollo/client');
          const result = await apolloClient.query({
            query: config.query!,
            variables: config.variables,
            fetchPolicy: 'network-only',
            errorPolicy: 'ignore',
          });
          return result.data;
        };
      } else {
        console.warn(`Cache warming config for key "${config.key}" has no loader or query`);
        return;
      }

      await warmCache([{
        key: config.key,
        loader,
        priority: config.priority,
        tenantId: config.tenantId,
      }]);

      console.log(`Cache warmed for key: ${config.key}`);
    } catch (error) {
      console.error(`Cache warming failed for key "${config.key}":`, error);
    }
  }, [enabled, warmCache]);

  /**
   * Execute cache warming for multiple configs in batches
   */
  const warmCacheBatch = useCallback(async (configsToWarm: CacheWarmingConfig[]) => {
    if (!enabled || isWarmingRef.current) return;

    isWarmingRef.current = true;

    try {
      // Process configs in batches to avoid overwhelming the system
      for (let i = 0; i < configsToWarm.length; i += batchSize) {
        const batch = configsToWarm.slice(i, i + batchSize);
        
        // Process batch in parallel
        await Promise.allSettled(
          batch.map(config => warmSingleCache(config))
        );

        // Delay between batches (except for the last batch)
        if (i + batchSize < configsToWarm.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      console.log(`Cache warming completed for ${configsToWarm.length} configs`);
    } finally {
      isWarmingRef.current = false;
    }
  }, [enabled, batchSize, delayBetweenBatches, warmSingleCache]);

  /**
   * Warm cache immediately
   */
  const warmNow = useCallback(async (keys?: string[]) => {
    const configsToWarm = keys 
      ? configs.filter(config => keys.includes(config.key))
      : configs;

    await warmCacheBatch(configsToWarm);
  }, [configs, warmCacheBatch]);

  /**
   * Warm high priority caches
   */
  const warmHighPriority = useCallback(async () => {
    const highPriorityConfigs = configs.filter(config => config.priority === 'high');
    await warmCacheBatch(highPriorityConfigs);
  }, [configs, warmCacheBatch]);

  /**
   * Warm tenant-specific caches
   */
  const warmTenantCaches = useCallback(async (tenantId: string) => {
    const tenantConfigs = configs.filter(config => config.tenantId === tenantId);
    await warmCacheBatch(tenantConfigs);
  }, [configs, warmCacheBatch]);

  /**
   * Setup scheduled warming
   */
  const setupScheduledWarming = useCallback(() => {
    // Clear existing intervals
    intervalsRef.current.forEach(interval => clearInterval(interval));
    intervalsRef.current.clear();

    configs.forEach(config => {
      const schedule = config.schedule;
      if (!schedule || !enabled) return;

      // Immediate warming
      if (schedule.immediate) {
        warmSingleCache(config);
      }

      // Interval-based warming
      if (schedule.interval && schedule.interval > 0) {
        const interval = setInterval(() => {
          warmSingleCache(config);
        }, schedule.interval);
        
        intervalsRef.current.set(config.key, interval);
      }
    });
  }, [configs, enabled, warmSingleCache]);

  /**
   * Handle dependency-based warming
   */
  const warmDependencies = useCallback(async (changedKey: string) => {
    const dependentConfigs = configs.filter(config => 
      config.dependencies?.includes(changedKey)
    );

    if (dependentConfigs.length > 0) {
      console.log(`Warming ${dependentConfigs.length} dependent caches for key: ${changedKey}`);
      await warmCacheBatch(dependentConfigs);
    }
  }, [configs, warmCacheBatch]);

  /**
   * Get warming status
   */
  const getWarmingStatus = useCallback(() => {
    return {
      isWarming: isWarmingRef.current,
      scheduledConfigs: configs.filter(config => config.schedule?.interval).length,
      highPriorityConfigs: configs.filter(config => config.priority === 'high').length,
      totalConfigs: configs.length,
      activeIntervals: intervalsRef.current.size,
    };
  }, [configs]);

  // Setup warming on mount and config changes
  useEffect(() => {
    if (!enabled) return;

    // Warm caches that should be warmed on mount
    const onMountConfigs = configs.filter(config => config.schedule?.onMount);
    if (onMountConfigs.length > 0) {
      warmCacheBatch(onMountConfigs);
    }

    // Setup scheduled warming
    setupScheduledWarming();

    return () => {
      // Cleanup intervals
      intervalsRef.current.forEach(interval => clearInterval(interval));
      intervalsRef.current.clear();
    };
  }, [configs, enabled, warmCacheBatch, setupScheduledWarming]);

  return {
    warmNow,
    warmHighPriority,
    warmTenantCaches,
    warmDependencies,
    getWarmingStatus,
    isWarming: isWarmingRef.current,
  };
}

/**
 * Hook for warming critical business data
 */
export function useCriticalDataWarming(tenantId?: string) {
  const criticalConfigs: CacheWarmingConfig[] = [
    {
      key: 'currentUser',
      priority: 'high',
      tenantId,
      schedule: {
        onMount: true,
        interval: 5 * 60 * 1000, // 5 minutes
      },
      loader: async () => {
        const { apolloClient } = await import('@/lib/apollo/client');
        const { GET_CURRENT_USER } = await import('@/graphql/queries/user.graphql');
        const result = await apolloClient.query({
          query: GET_CURRENT_USER,
          fetchPolicy: 'network-only',
        });
        return result.data;
      },
    },
    {
      key: 'tenantSettings',
      priority: 'high',
      tenantId,
      schedule: {
        onMount: true,
        onTenantChange: true,
      },
      dependencies: ['currentUser'],
      loader: async () => {
        if (!tenantId) return null;
        // Load tenant settings
        return { tenantId, settings: {} }; // Placeholder
      },
    },
    {
      key: 'userPermissions',
      priority: 'high',
      tenantId,
      schedule: {
        onMount: true,
      },
      dependencies: ['currentUser', 'tenantSettings'],
      loader: async () => {
        // Load user permissions
        return { permissions: [] }; // Placeholder
      },
    },
  ];

  return useCacheWarming(criticalConfigs, {
    enabled: true,
    batchSize: 3,
    delayBetweenBatches: 500,
  });
}

/**
 * Hook for warming business module data
 */
export function useBusinessModuleWarming(
  modules: string[],
  tenantId?: string,
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
  const moduleConfigs: CacheWarmingConfig[] = modules.map(module => ({
    key: `${module}Stats`,
    priority,
    tenantId,
    schedule: {
      onMount: priority === 'high',
      interval: priority === 'high' ? 2 * 60 * 1000 : 10 * 60 * 1000, // 2min for high, 10min for others
    },
    loader: async () => {
      // Load module statistics
      return { module, stats: {} }; // Placeholder
    },
  }));

  return useCacheWarming(moduleConfigs, {
    enabled: true,
    batchSize: 2,
    delayBetweenBatches: 1000,
  });
}