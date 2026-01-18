import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { MutationResponse } from '../../../common/graphql/mutation-response.types';
import { APIPerformanceService } from '../api-performance.service';
import { CacheInterceptor } from '../interceptors/cache.interceptor';
import { CacheAccessGuard, CacheHealthGuard } from '../guards/cache.guard';
import {
  Cache,
  CacheInvalidate,
  PerformanceMonitor,
  Compression,
  FullCache,
  CacheContext,
  PerformanceMetrics,
} from '../decorators/cache.decorators';
import {
  PerformanceOptimizationInput,
} from '../inputs/cache.input';
import {
  APIPerformanceMetrics,
  APIEndpointMetrics,
  CacheStrategy,
  CachePriority,
} from '../types/cache.types';

/**
 * Performance resolver for API performance monitoring and optimization
 * Handles response optimization, compression, and performance analytics
 */
@Resolver()
@UseGuards(GraphQLJwtAuthGuard, CacheAccessGuard, CacheHealthGuard)
@UseInterceptors(CacheInterceptor)
export class PerformanceResolver extends BaseResolver {
  private readonly pubSub = new PubSub();

  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly performanceService: APIPerformanceService,
  ) {
    super(dataLoaderService);
  }

  // ==================== PERFORMANCE METRICS ====================

  /**
   * Get real-time API performance metrics
   */
  @Query(() => APIPerformanceMetrics, {
    description: 'Get real-time API performance metrics and statistics'
  })
  @FullCache({
    key: 'performance:realtime-metrics:{tenantId}',
    ttl: 30, // Short TTL for real-time data
    strategy: CacheStrategy.L1_ONLY,
    priority: CachePriority.CRITICAL,
    compression: false, // Skip compression for real-time data
    monitoring: true,
  })
  async getRealTimePerformanceMetrics(
    @CacheContext() cacheCtx?: any,
    @PerformanceMetrics() perfMetrics?: any,
  ): Promise<APIPerformanceMetrics> {
    try {
      const metrics = this.performanceService.getPerformanceMetrics();
      
      // Publish real-time metrics for subscriptions
      await this.pubSub.publish('performanceMetricsUpdated', {
        performanceMetricsUpdated: {
          metrics: metrics.overall,
          tenantId: cacheCtx?.tenantId,
          timestamp: new Date(),
        },
      });

      return {
        averageResponseTime: metrics.overall.averageResponseTime,
        requestsPerSecond: metrics.overall.requestsPerSecond,
        cacheHitRate: metrics.overall.cacheHitRate,
        compressionRatio: metrics.overall.compressionRatio,
        cdnHitRate: metrics.overall.cdnHitRate,
        errorRate: metrics.overall.errorRate,
      };
    } catch (error) {
      this.handleError(error, 'Failed to get real-time performance metrics');
      throw error;
    }
  }

  /**
   * Get detailed endpoint performance metrics
   */
  @Query(() => [APIEndpointMetrics], {
    description: 'Get detailed performance metrics for all API endpoints'
  })
  @Cache({
    key: 'performance:endpoint-metrics:{tenantId}:{limit}',
    ttl: 180,
    strategy: CacheStrategy.INTELLIGENT,
    priority: CachePriority.HIGH,
  })
  @PerformanceMonitor({ 
    trackResponseTime: true, 
    trackCacheHits: true,
    trackErrors: true,
  })
  async getDetailedEndpointMetrics(
    @Args('limit', { nullable: true }) limit?: number,
    @Args('sortBy', { nullable: true }) sortBy?: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<APIEndpointMetrics[]> {
    try {
      const metrics = this.performanceService.getPerformanceMetrics();
      let endpoints = metrics.endpoints;

      // Apply sorting
      if (sortBy) {
        switch (sortBy) {
          case 'responseTime':
            endpoints = endpoints.sort((a, b) => b.averageResponseTime - a.averageResponseTime);
            break;
          case 'requestCount':
            endpoints = endpoints.sort((a, b) => b.requestCount - a.requestCount);
            break;
          case 'errorRate':
            endpoints = endpoints.sort((a, b) => b.errorCount - a.errorCount);
            break;
          case 'cacheHitRate':
            endpoints = endpoints.sort((a, b) => b.cacheHitRate - a.cacheHitRate);
            break;
          default:
            // Default sort by request count
            endpoints = endpoints.sort((a, b) => b.requestCount - a.requestCount);
        }
      }

      // Apply limit
      if (limit && limit > 0) {
        endpoints = endpoints.slice(0, limit);
      }

      return endpoints.map(endpoint => ({
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        averageResponseTime: endpoint.averageResponseTime,
        requestCount: endpoint.requestCount,
        errorCount: endpoint.errorCount,
        cacheHitRate: endpoint.cacheHitRate,
        lastAccessed: endpoint.lastAccessed,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to get detailed endpoint metrics');
      throw error;
    }
  }

  /**
   * Get performance health status
   */
  @Query(() => String, {
    description: 'Get overall performance health status and issues'
  })
  @Cache({
    key: 'performance:health-status:{tenantId}',
    ttl: 60,
    strategy: CacheStrategy.L1_ONLY,
    priority: CachePriority.HIGH,
  })
  async getPerformanceHealthStatus(): Promise<string> {
    try {
      const healthStatus = this.performanceService.getHealthStatus();
      return JSON.stringify({
        isHealthy: healthStatus.isHealthy,
        metrics: healthStatus.metrics,
        issues: healthStatus.issues,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error, 'Failed to get performance health status');
      throw error;
    }
  }

  // ==================== PERFORMANCE OPTIMIZATION ====================

  /**
   * Optimize API performance settings
   */
  @Mutation(() => MutationResponse, {
    description: 'Optimize API performance settings automatically'
  })
  @CacheInvalidate({ patterns: ['performance:*', 'cache:stats:*'] })
  @PerformanceMonitor({ 
    trackResponseTime: true,
    alertThreshold: 2000, // Alert if optimization takes more than 2 seconds
  })
  async optimizeAPIPerformanceSettings(
    @Args('input', { nullable: true }) input?: PerformanceOptimizationInput,
    @CacheContext() cacheCtx?: any,
    @PerformanceMetrics() perfMetrics?: any,
  ): Promise<MutationResponse> {
    try {
      const startTime = perfMetrics?.startTime || Date.now();
      const result = await this.performanceService.optimizeSettings();

      const optimizationTime = Date.now() - startTime;

      // Publish optimization completed event
      await this.pubSub.publish('performanceOptimizationCompleted', {
        performanceOptimizationCompleted: {
          compressionOptimized: result.compressionOptimized,
          cacheOptimized: result.cacheOptimized,
          endpointsOptimized: result.endpointsOptimized,
          optimizationTime,
          tenantId: cacheCtx?.tenantId,
          timestamp: new Date(),
        },
      });

      return this.createMutationResponse(
        true,
        `Performance optimization completed in ${optimizationTime}ms: ` +
        `compression=${result.compressionOptimized}, ` +
        `cache=${result.cacheOptimized}, ` +
        `endpoints=${result.endpointsOptimized}`
      );
    } catch (error) {
      return this.createMutationResponse(false, 'Performance optimization failed', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  /**
   * Clear response cache
   */
  @Mutation(() => MutationResponse, {
    description: 'Clear response cache with optional pattern matching'
  })
  @CacheInvalidate({ patterns: ['performance:*', 'response:*'] })
  async clearResponseCache(
    @Args('pattern', { nullable: true }) pattern?: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<MutationResponse> {
    try {
      await this.performanceService.clearResponseCache(pattern);

      // Publish cache cleared event
      await this.pubSub.publish('responseCacheCleared', {
        responseCacheCleared: {
          pattern: pattern || 'all',
          tenantId: cacheCtx?.tenantId,
          timestamp: new Date(),
        },
      });

      return this.createMutationResponse(
        true,
        pattern 
          ? `Response cache cleared for pattern: ${pattern}`
          : 'All response cache cleared'
      );
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to clear response cache', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  // ==================== COMPRESSION MANAGEMENT ====================

  /**
   * Get compression statistics
   */
  @Query(() => String, {
    description: 'Get compression statistics and configuration'
  })
  @Cache({
    key: 'performance:compression-stats:{tenantId}',
    ttl: 300,
    strategy: CacheStrategy.MULTI_LEVEL,
  })
  @Compression({ enabled: true, threshold: 1024, level: 6 })
  async getCompressionStatistics(): Promise<string> {
    try {
      const metrics = this.performanceService.getPerformanceMetrics();
      
      const compressionStats = {
        enabled: metrics.compression.enabled,
        averageRatio: metrics.compression.averageRatio,
        threshold: metrics.compression.threshold,
        algorithms: ['gzip', 'deflate', 'br'],
        totalBytesSaved: 0, // Would be calculated from actual metrics
        requestsCompressed: 0, // Would be calculated from actual metrics
      };

      return JSON.stringify(compressionStats);
    } catch (error) {
      this.handleError(error, 'Failed to get compression statistics');
      throw error;
    }
  }

  // ==================== CACHE PERFORMANCE ====================

  /**
   * Get cache performance metrics
   */
  @Query(() => String, {
    description: 'Get cache-specific performance metrics'
  })
  @Cache({
    key: 'performance:cache-performance:{tenantId}',
    ttl: 120,
    strategy: CacheStrategy.INTELLIGENT,
    priority: CachePriority.HIGH,
  })
  async getCachePerformanceMetrics(): Promise<string> {
    try {
      const metrics = this.performanceService.getPerformanceMetrics();
      
      const cachePerformance = {
        memorySize: metrics.cache.memorySize,
        memoryItems: metrics.cache.memoryItems,
        maxSize: metrics.cache.maxSize,
        hitRate: metrics.cache.hitRate,
        utilizationPercentage: (metrics.cache.memorySize / metrics.cache.maxSize) * 100,
        efficiency: metrics.cache.hitRate > 80 ? 'excellent' : 
                   metrics.cache.hitRate > 60 ? 'good' : 
                   metrics.cache.hitRate > 40 ? 'fair' : 'poor',
      };

      return JSON.stringify(cachePerformance);
    } catch (error) {
      this.handleError(error, 'Failed to get cache performance metrics');
      throw error;
    }
  }

  // ==================== PERFORMANCE ALERTS ====================

  /**
   * Configure performance alerts
   */
  @Mutation(() => MutationResponse, {
    description: 'Configure performance monitoring alerts'
  })
  async configurePerformanceAlerts(
    @Args('responseTimeThreshold', { nullable: true }) responseTimeThreshold?: number,
    @Args('errorRateThreshold', { nullable: true }) errorRateThreshold?: number,
    @Args('cacheHitRateThreshold', { nullable: true }) cacheHitRateThreshold?: number,
    @CacheContext() cacheCtx?: any,
  ): Promise<MutationResponse> {
    try {
      const alertConfig = {
        responseTimeThreshold: responseTimeThreshold || 1000,
        errorRateThreshold: errorRateThreshold || 5,
        cacheHitRateThreshold: cacheHitRateThreshold || 70,
        tenantId: cacheCtx?.tenantId,
        configuredAt: new Date(),
      };

      // This would typically be stored in a configuration service
      // For now, we'll just publish the configuration
      await this.pubSub.publish('performanceAlertsConfigured', {
        performanceAlertsConfigured: alertConfig,
      });

      return this.createMutationResponse(true, 'Performance alerts configured successfully');
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to configure performance alerts', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  // ==================== PERFORMANCE ANALYSIS ====================

  /**
   * Analyze performance trends
   */
  @Query(() => String, {
    description: 'Analyze performance trends over time'
  })
  @Cache({
    key: 'performance:trends-analysis:{tenantId}:{timeRange}',
    ttl: 600, // 10 minutes for trend analysis
    strategy: CacheStrategy.INTELLIGENT,
  })
  async analyzePerformanceTrends(
    @Args('timeRange', { nullable: true }) timeRange?: string,
    @Args('granularity', { nullable: true }) granularity?: string,
  ): Promise<string> {
    try {
      // This would typically analyze historical performance data
      // For now, return mock trend analysis
      const trendAnalysis = {
        timeRange: timeRange || '24h',
        granularity: granularity || '1h',
        trends: {
          responseTime: {
            trend: 'improving',
            change: -15.5, // percentage change
            average: 245, // ms
          },
          throughput: {
            trend: 'stable',
            change: 2.3,
            average: 1250, // requests/min
          },
          errorRate: {
            trend: 'improving',
            change: -45.2,
            average: 0.8, // percentage
          },
          cacheHitRate: {
            trend: 'improving',
            change: 12.7,
            average: 78.5, // percentage
          },
        },
        recommendations: [
          'Cache hit rate is improving but could be optimized further',
          'Response time trend is positive, continue current optimizations',
          'Error rate reduction is excellent, maintain current practices',
        ],
        generatedAt: new Date(),
      };

      return JSON.stringify(trendAnalysis);
    } catch (error) {
      this.handleError(error, 'Failed to analyze performance trends');
      throw error;
    }
  }

  // ==================== SUBSCRIPTIONS ====================

  /**
   * Subscribe to real-time performance metrics
   */
  @Subscription(() => String, {
    description: 'Subscribe to real-time performance metrics updates'
  })
  async performanceMetricsUpdated(
    @Args('tenantId', { nullable: true }) tenantId?: string,
  ) {
    return this.pubSub.asyncIterator('performanceMetricsUpdated');
  }

  /**
   * Subscribe to performance optimization events
   */
  @Subscription(() => String, {
    description: 'Subscribe to performance optimization completion events'
  })
  async performanceOptimizationCompleted() {
    return this.pubSub.asyncIterator('performanceOptimizationCompleted');
  }

  /**
   * Subscribe to response cache events
   */
  @Subscription(() => String, {
    description: 'Subscribe to response cache clear events'
  })
  async responseCacheCleared() {
    return this.pubSub.asyncIterator('responseCacheCleared');
  }

  /**
   * Subscribe to performance alerts
   */
  @Subscription(() => String, {
    description: 'Subscribe to performance alert events'
  })
  async performanceAlert(
    @Args('threshold', { nullable: true }) threshold?: number,
  ) {
    return this.pubSub.asyncIterator('performanceAlert');
  }

  /**
   * Subscribe to performance alert configuration
   */
  @Subscription(() => String, {
    description: 'Subscribe to performance alert configuration events'
  })
  async performanceAlertsConfigured() {
    return this.pubSub.asyncIterator('performanceAlertsConfigured');
  }
}