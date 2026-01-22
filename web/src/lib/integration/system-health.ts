/**
 * System Health Monitoring
 * Provides comprehensive health checks for all integrated systems
 */

import { apolloClient } from '@/lib/apollo';
import { getUnifiedCacheManager } from '@/lib/cache';
import gql from 'graphql-tag';

export interface SystemHealthStatus {
  system: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  lastChecked: Date;
  responseTime?: number;
  details?: Record<string, unknown>;
}

export interface OverallHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  systems: SystemHealthStatus[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
  lastChecked: Date;
}

class SystemHealthMonitor {
  private healthChecks: Map<string, () => Promise<SystemHealthStatus>> = new Map();
  private lastHealthCheck: OverallHealthStatus | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.registerHealthChecks();
  }

  private registerHealthChecks() {
    // GraphQL Client Health Check
    this.healthChecks.set('graphql', async () => {
      const startTime = Date.now();
      try {
        const result = await apolloClient.query({
          query: gql`query HealthCheck { __typename }`,
          fetchPolicy: 'network-only',
          errorPolicy: 'none',
        });
        
        const responseTime = Date.now() - startTime;
        
        return {
          system: 'GraphQL Client',
          status: result.data ? 'healthy' : 'degraded',
          message: result.data ? 'GraphQL client is responding' : 'GraphQL client returned no data',
          lastChecked: new Date(),
          responseTime,
          details: {
            networkStatus: result.networkStatus,
            loading: result.loading,
          },
        };
      } catch (error) {
        return {
          system: 'GraphQL Client',
          status: 'unhealthy',
          message: `GraphQL client error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date(),
          responseTime: Date.now() - startTime,
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Cache System Health Check
    this.healthChecks.set('cache', async () => {
      const startTime = Date.now();
      try {
        const cacheManager = getUnifiedCacheManager();
        const metrics = cacheManager.getMetrics();
        const responseTime = Date.now() - startTime;
        
        // Calculate overall hit rate
        const totalHits = metrics.multiTier.l1Hits + metrics.multiTier.l2Hits + metrics.multiTier.l3Hits;
        const totalMisses = metrics.multiTier.l1Misses + metrics.multiTier.l2Misses + metrics.multiTier.l3Misses;
        const hitRate = totalHits / (totalHits + totalMisses) || 0;
        
        return {
          system: 'Caching Layer',
          status: hitRate > 0.3 ? 'healthy' : 'degraded',
          message: `Cache hit rate: ${(hitRate * 100).toFixed(1)}%`,
          lastChecked: new Date(),
          responseTime,
          details: {
            hitRate: hitRate,
            totalHits: totalHits,
            totalMisses: totalMisses,
            memoryUsage: metrics.multiTier.memoryUsage,
          },
        };
      } catch (error) {
        return {
          system: 'Caching Layer',
          status: 'unhealthy',
          message: `Cache system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date(),
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Performance Monitoring Health Check
    this.healthChecks.set('performance', async () => {
      try {
        const performanceEntries = performance.getEntriesByType('navigation');
        const navigationEntry = performanceEntries[0] as PerformanceNavigationTiming;
        
        const loadTime = navigationEntry ? navigationEntry.loadEventEnd - navigationEntry.fetchStart : 0;
        
        return {
          system: 'Performance Monitoring',
          status: loadTime < 3000 ? 'healthy' : loadTime < 5000 ? 'degraded' : 'unhealthy',
          message: `Page load time: ${loadTime.toFixed(0)}ms`,
          lastChecked: new Date(),
          details: {
            loadTime,
            domContentLoaded: navigationEntry?.domContentLoadedEventEnd - navigationEntry?.fetchStart || 0,
            firstContentfulPaint: 0, // Would need to implement FCP measurement
          },
        };
      } catch (error) {
        return {
          system: 'Performance Monitoring',
          status: 'degraded',
          message: 'Performance metrics unavailable',
          lastChecked: new Date(),
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });
  }

  /**
   * Run all health checks and return overall system health
   */
  async checkSystemHealth(): Promise<OverallHealthStatus> {
    const systems: SystemHealthStatus[] = [];
    
    // Run all health checks in parallel
    const healthCheckPromises = Array.from(this.healthChecks.entries()).map(
      async ([key, check]) => {
        try {
          return await check();
        } catch (error) {
          return {
            system: key,
            status: 'unhealthy' as const,
            message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            lastChecked: new Date(),
            details: { error: error instanceof Error ? error.message : 'Unknown error' },
          };
        }
      }
    );

    const results = await Promise.all(healthCheckPromises);
    systems.push(...results);

    // Calculate summary
    const summary = {
      healthy: systems.filter(s => s.status === 'healthy').length,
      degraded: systems.filter(s => s.status === 'degraded').length,
      unhealthy: systems.filter(s => s.status === 'unhealthy').length,
      total: systems.length,
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const healthStatus: OverallHealthStatus = {
      status: overallStatus,
      systems,
      summary,
      lastChecked: new Date(),
    };

    this.lastHealthCheck = healthStatus;
    return healthStatus;
  }

  /**
   * Get the last health check result without running a new check
   */
  getLastHealthCheck(): OverallHealthStatus | null {
    return this.lastHealthCheck;
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(intervalMs: number = 30000) {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkSystemHealth();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, intervalMs);

    // Run initial health check
    this.checkSystemHealth().catch(console.error);
  }

  /**
   * Stop continuous health monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Export singleton instance
export const systemHealthMonitor = new SystemHealthMonitor();

// Export types and utilities
export { SystemHealthMonitor };