/**
 * Cache Module - Frontend Business Module
 * 
 * This module provides UI components and hooks for managing
 * the advanced caching system in the frontend application.
 */

// Components
export { CacheMetricsDisplay } from './components/CacheMetricsDisplay';
export { OfflineStatusIndicator } from './components/OfflineStatusIndicator';

// Hooks
export { useCacheWarming, useCriticalDataWarming, useBusinessModuleWarming } from './hooks/useCacheWarming';

// Re-export core cache functionality
export * from '@/lib/cache';

/**
 * Cache Module Configuration
 */
export const CACHE_MODULE_CONFIG = {
  name: 'cache',
  displayName: 'Cache Management',
  description: 'Advanced caching system with multi-tier storage, intelligent invalidation, and offline capabilities',
  version: '1.0.0',
  features: [
    'Multi-tier caching (Memory, IndexedDB, Network)',
    'Intelligent cache invalidation',
    'Offline operation queuing',
    'Cache warming strategies',
    'Performance metrics',
    'Tenant-specific cache isolation',
  ],
  dependencies: [
    '@apollo/client',
    'react',
  ],
  permissions: [
    'cache:read',
    'cache:write',
    'cache:admin',
  ],
};

/**
 * Default cache warming configurations for common business scenarios
 */
export const DEFAULT_CACHE_WARMING_CONFIGS = {
  // Authentication and user data
  auth: [
    {
      key: 'currentUser',
      priority: 'high' as const,
      schedule: { onMount: true, interval: 5 * 60 * 1000 },
    },
    {
      key: 'userPermissions',
      priority: 'high' as const,
      schedule: { onMount: true },
      dependencies: ['currentUser'],
    },
  ],

  // Tenant and business configuration
  tenant: [
    {
      key: 'tenantSettings',
      priority: 'high' as const,
      schedule: { onMount: true, onTenantChange: true },
    },
    {
      key: 'featureFlags',
      priority: 'medium' as const,
      schedule: { onMount: true, interval: 10 * 60 * 1000 },
    },
  ],

  // Business modules (commonly accessed)
  business: [
    {
      key: 'inventoryStats',
      priority: 'medium' as const,
      schedule: { interval: 5 * 60 * 1000 },
    },
    {
      key: 'warehouseStats',
      priority: 'medium' as const,
      schedule: { interval: 5 * 60 * 1000 },
    },
    {
      key: 'posStats',
      priority: 'medium' as const,
      schedule: { interval: 2 * 60 * 1000 },
    },
    {
      key: 'financialSummary',
      priority: 'high' as const,
      schedule: { interval: 10 * 60 * 1000 },
    },
  ],

  // System and health data
  system: [
    {
      key: 'systemHealth',
      priority: 'low' as const,
      schedule: { interval: 30 * 60 * 1000 },
    },
    {
      key: 'integrationStatus',
      priority: 'medium' as const,
      schedule: { interval: 15 * 60 * 1000 },
    },
  ],
};

/**
 * Cache performance thresholds for monitoring
 */
export const CACHE_PERFORMANCE_THRESHOLDS = {
  hitRate: {
    excellent: 90, // > 90% hit rate
    good: 75,      // 75-90% hit rate
    poor: 50,      // 50-75% hit rate
    // < 50% is critical
  },
  responseTime: {
    excellent: 50,  // < 50ms
    good: 100,      // 50-100ms
    poor: 200,      // 100-200ms
    // > 200ms is critical
  },
  memoryUsage: {
    low: 1024 * 1024,      // < 1MB
    medium: 5 * 1024 * 1024, // 1-5MB
    high: 10 * 1024 * 1024,  // 5-10MB
    // > 10MB is critical
  },
  offlineQueue: {
    normal: 10,    // < 10 operations
    warning: 50,   // 10-50 operations
    critical: 100, // > 100 operations
  },
};

/**
 * Utility function to get cache performance status
 */
export function getCachePerformanceStatus(metrics: any) {
  const calculateHitRate = (hits: number, misses: number) => {
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  };

  const l1HitRate = calculateHitRate(metrics.l1Hits, metrics.l1Misses);
  const l2HitRate = calculateHitRate(metrics.l2Hits, metrics.l2Misses);
  const overallHitRate = calculateHitRate(
    metrics.l1Hits + metrics.l2Hits,
    metrics.l1Misses + metrics.l2Misses
  );

  const getThresholdStatus = (value: number, thresholds: any) => {
    if (value >= thresholds.excellent) return 'excellent';
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.poor) return 'poor';
    return 'critical';
  };

  return {
    overall: getThresholdStatus(overallHitRate, CACHE_PERFORMANCE_THRESHOLDS.hitRate),
    hitRate: {
      l1: getThresholdStatus(l1HitRate, CACHE_PERFORMANCE_THRESHOLDS.hitRate),
      l2: getThresholdStatus(l2HitRate, CACHE_PERFORMANCE_THRESHOLDS.hitRate),
      overall: getThresholdStatus(overallHitRate, CACHE_PERFORMANCE_THRESHOLDS.hitRate),
    },
    responseTime: getThresholdStatus(
      metrics.averageResponseTime,
      CACHE_PERFORMANCE_THRESHOLDS.responseTime
    ),
    memoryUsage: getThresholdStatus(
      metrics.memoryUsage,
      CACHE_PERFORMANCE_THRESHOLDS.memoryUsage
    ),
    offlineQueue: getThresholdStatus(
      metrics.queuedOperations || 0,
      CACHE_PERFORMANCE_THRESHOLDS.offlineQueue
    ),
  };
}