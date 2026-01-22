/**
 * System Health Monitoring
 * Provides comprehensive health checks for all integrated systems
 */

import { apolloClient } from '@/lib/apollo';
import { authManager } from '@/lib/auth';
import { tenantContextManager } from '@/lib/tenant';
import { subscriptionManager } from '@/lib/subscriptions';
import { cacheService } from '@/lib/cache';

export interface SystemHealthStatus {
  system: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  lastChecked: Date;
  responseTime?: number;
  details?: Record<string, any>;
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
          query: require('graphql-tag')`query HealthCheck { __typename }`,
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

    // Authentication System Health Check
    this.healthChecks.set('auth', async () => {
      try {
        const authState = authManager.getAuthState();
        const isTokenValid = authState.tokens ? await authManager.validateToken(authState.tokens.accessToken) : false;
        
        return {
          system: 'Authentication',
          status: authState.isAuthenticated && isTokenValid ? 'healthy' : 'degraded',
          message: authState.isAuthenticated 
            ? (isTokenValid ? 'Authentication system is healthy' : 'Token validation failed')
            : 'User not authenticated',
          lastChecked: new Date(),
          details: {
            isAuthenticated: authState.isAuthenticated,
            hasValidToken: isTokenValid,
            userPermissions: authState.permissions?.length || 0,
          },
        };
      } catch (error) {
        return {
          system: 'Authentication',
          status: 'unhealthy',
          message: `Authentication system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date(),
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Tenant System Health Check
    this.healthChecks.set('tenant', async () => {
      try {
        const tenantContext = tenantContextManager.getCurrentContext();
        
        return {
          system: 'Multi-Tenant',
          status: tenantContext.currentTenant ? 'healthy' : 'degraded',
          message: tenantContext.currentTenant 
            ? `Active tenant: ${tenantContext.currentTenant.name}`
            : 'No active tenant selected',
          lastChecked: new Date(),
          details: {
            currentTenant: tenantContext.currentTenant?.name,
            businessTier: tenantContext.businessTier,
            availableTenants: tenantContext.availableTenants.length,
            activeFeatures: tenantContext.features.filter(f => f.enabled).length,
          },
        };
      } catch (error) {
        return {
          system: 'Multi-Tenant',
          status: 'unhealthy',
          message: `Tenant system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date(),
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Subscription System Health Check
    this.healthChecks.set('subscriptions', async () => {
      try {
        const connectionStatus = subscriptionManager.getConnectionStatus();
        
        return {
          system: 'Real-time Subscriptions',
          status: connectionStatus.connected ? 'healthy' : 'unhealthy',
          message: connectionStatus.connected 
            ? 'WebSocket connection is active'
            : `WebSocket disconnected: ${connectionStatus.error || 'Unknown reason'}`,
          lastChecked: new Date(),
          details: {
            connected: connectionStatus.connected,
            reconnectAttempts: connectionStatus.reconnectAttempts,
            lastError: connectionStatus.error,
            activeSubscriptions: connectionStatus.activeSubscriptions,
          },
        };
      } catch (error) {
        return {
          system: 'Real-time Subscriptions',
          status: 'unhealthy',
          message: `Subscription system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date(),
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Cache System Health Check
    this.healthChecks.set('cache', async () => {
      try {
        const cacheStats = await cacheService.getStats();
        const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0;
        
        return {
          system: 'Caching Layer',
          status: hitRate > 0.5 ? 'healthy' : 'degraded',
          message: `Cache hit rate: ${(hitRate * 100).toFixed(1)}%`,
          lastChecked: new Date(),
          details: {
            hitRate: hitRate,
            totalHits: cacheStats.hits,
            totalMisses: cacheStats.misses,
            cacheSize: cacheStats.size,
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