/**
 * Advanced Caching System - Main Export
 * 
 * This module provides a comprehensive caching solution that includes:
 * - Multi-tier caching (L1: Memory, L2: IndexedDB, L3: Network)
 * - Intelligent cache invalidation based on GraphQL mutations
 * - Offline capabilities with automatic synchronization
 * - Tenant-specific cache isolation
 * - Cache warming and performance optimization
 */

// Core caching components
export { MultiTierCache, getMultiTierCache } from './multi-tier-cache';
export type { CacheEntry, CacheTierConfig, CacheMetrics } from './multi-tier-cache';

// Intelligent invalidation
export { CacheInvalidationEngine, getCacheInvalidationEngine, useIntelligentInvalidation } from './intelligent-invalidation';
export type { InvalidationRule, InvalidationMetrics } from './intelligent-invalidation';

// Offline capabilities
export { OfflineCacheManager, getOfflineCacheManager, useOfflineCache } from './offline-cache';
export type { OfflineQueueItem, OfflineMetrics, SyncResult } from './offline-cache';

// Enhanced cache utilities (extending existing)
export { default as cacheUtils } from '@/lib/apollo/cache-utils';
export { useCacheStrategy } from '@/hooks/useCacheStrategy';

// Import the functions for internal use in UnifiedCacheManager
import { getMultiTierCache } from './multi-tier-cache';
import { getCacheInvalidationEngine } from './intelligent-invalidation';
import { getOfflineCacheManager } from './offline-cache';

/**
 * Unified Cache Manager
 * Provides a single interface to all caching capabilities
 */
export class UnifiedCacheManager {
  private multiTierCache = getMultiTierCache();
  private invalidationEngine = getCacheInvalidationEngine();
  private offlineManager = getOfflineCacheManager();

  /**
   * Get data with full caching strategy
   */
  async get<T>(key: string, options: {
    tenantId?: string;
    fallbackLoader?: () => Promise<T>;
    priority?: 'high' | 'medium' | 'low';
    offlineFirst?: boolean;
  } = {}): Promise<T | null> {
    const { offlineFirst = false, ...otherOptions } = options;

    if (offlineFirst) {
      return this.offlineManager.get(key, {
        tenantId: options.tenantId,
        networkFallback: options.fallbackLoader,
        cacheFirst: true,
      });
    }

    return this.multiTierCache.get(key, otherOptions);
  }

  /**
   * Set data in cache
   */
  async set<T>(key: string, data: T, options: {
    tenantId?: string;
    priority?: 'high' | 'medium' | 'low';
    l1Ttl?: number;
    l2Ttl?: number;
  } = {}): Promise<void> {
    return this.multiTierCache.set(key, data, options);
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    return this.multiTierCache.delete(key);
  }

  /**
   * Invalidate cache based on mutation
   */
  async invalidateFromMutation(
    mutationType: string,
    variables: unknown,
    tenantId?: string
  ): Promise<void> {
    return this.invalidationEngine.invalidateFromMutation(mutationType, variables, tenantId);
  }

  /**
   * Queue mutation for offline sync
   */
  queueMutation(mutation: unknown, variables: unknown, options: {
    tenantId?: string;
    maxRetries?: number;
  } = {}): void {
    return this.offlineManager.queueMutation(mutation, variables, options);
  }

  /**
   * Warm cache with critical data
   */
  async warmCache(keys: Array<{
    key: string;
    loader: () => Promise<unknown>;
    priority?: 'high' | 'medium' | 'low';
    tenantId?: string;
  }>): Promise<void> {
    return this.multiTierCache.warmCache(keys);
  }

  /**
   * Clear tenant-specific cache
   */
  async clearTenant(tenantId: string): Promise<void> {
    await this.multiTierCache.clearTenant(tenantId);
    // Note: Offline manager doesn't need tenant clearing as it's handled per operation
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics() {
    return {
      multiTier: this.multiTierCache.getMetrics(),
      invalidation: this.invalidationEngine.getMetrics(),
      offline: this.offlineManager.getMetrics(),
    };
  }

  /**
   * Sync offline operations
   */
  async syncOfflineOperations() {
    return this.offlineManager.syncOperations();
  }
}

// Singleton instance
let unifiedCacheManagerInstance: UnifiedCacheManager | null = null;

export function getUnifiedCacheManager(): UnifiedCacheManager {
  if (!unifiedCacheManagerInstance) {
    unifiedCacheManagerInstance = new UnifiedCacheManager();
  }
  
  return unifiedCacheManagerInstance;
}

/**
 * React hook for unified cache management
 */
export function useUnifiedCache() {
  const manager = getUnifiedCacheManager();

  return {
    get: manager.get.bind(manager),
    set: manager.set.bind(manager),
    delete: manager.delete.bind(manager),
    invalidateFromMutation: manager.invalidateFromMutation.bind(manager),
    queueMutation: manager.queueMutation.bind(manager),
    warmCache: manager.warmCache.bind(manager),
    clearTenant: manager.clearTenant.bind(manager),
    getMetrics: manager.getMetrics.bind(manager),
    syncOfflineOperations: manager.syncOfflineOperations.bind(manager),
  };
}