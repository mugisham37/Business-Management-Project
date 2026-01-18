import { Resolver, Query, Mutation, Args, Context, Subscription } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { MutationResponse } from '../../../common/graphql/mutation-response.types';
import { IntelligentCacheService } from '../intelligent-cache.service';
import { AdvancedCacheService } from '../advanced-cache.service';
import { APIPerformanceService } from '../api-performance.service';
import { HorizontalScalingService } from '../horizontal-scaling.service';
import { RedisService } from '../redis.service';
import { CacheInterceptor } from '../interceptors/cache.interceptor';
import { 
  CacheAccessGuard, 
  LoadBalancingGuard, 
  DistributedCacheGuard,
  CacheRateLimitGuard,
  CacheHealthGuard,
} from '../guards/cache.guard';
import {
  Cache,
  CacheInvalidate,
  CacheWarm,
  DistributedCache,
  PerformanceMonitor,
  LoadBalance,
  SessionRequired,
  FullCache,
  CacheKey,
  CacheTags,
  PerformanceMetrics,
  NodeInfo,
  SessionInfo,
  CacheContext,
} from '../decorators/cache.decorators';
import {
  CacheOperationInput,
  CacheWarmingConfigInput,
  UpdateCacheWarmingConfigInput,
  CacheInvalidationInput,
  LoadBalancingConfigInput,
  AutoScalingConfigInput,
  SessionManagementInput,
  DistributedCacheConfigInput,
  CacheQueryFiltersInput,
  PerformanceOptimizationInput,
  BulkCacheOperationInput,
} from '../inputs/cache.input';
import {
  CacheEntry,
  CacheStats,
  AdvancedCacheMetrics,
  CacheWarmingConfig,
  APIPerformanceMetrics,
  APIEndpointMetrics,
  HorizontalScalingMetrics,
  CacheHealthStatus,
  RedisConnectionInfo,
  CacheOptimizationResult,
  SessionInfo as SessionInfoType,
  CacheEntryConnection,
  CacheWarmingConfigConnection,
  SessionInfoConnection,
  CacheStrategy,
  CachePriority,
} from '../types/cache.types';

/**
 * Cache resolver for GraphQL operations
 * Provides comprehensive cache management functionality
 */
@Resolver()
@UseGuards(GraphQLJwtAuthGuard, CacheAccessGuard, CacheHealthGuard, CacheRateLimitGuard)
@UseInterceptors(CacheInterceptor)
export class CacheResolver extends BaseResolver {
  private readonly pubSub = new PubSub();

  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly intelligentCache: IntelligentCacheService,
    private readonly advancedCache: AdvancedCacheService,
    private readonly performanceService: APIPerformanceService,
    private readonly horizontalScalingService: HorizontalScalingService,
    private readonly redisService: RedisService,
  ) {
    super(dataLoaderService);
  }

  // ==================== CACHE OPERATIONS ====================

  /**
   * Get cache entry by key
   */
  @Query(() => String, { 
    nullable: true,
    description: 'Get cached value by key' 
  })
  @Cache({
    key: 'cache:get:{key}',
    ttl: 60,
    strategy: CacheStrategy.INTELLIGENT,
    priority: CachePriority.HIGH,
  })
  @PerformanceMonitor({ trackResponseTime: true, trackCacheHits: true })
  async getCacheValue(
    @Args('key') key: string,
    @Args('strategy', { type: () => CacheStrategy, nullable: true }) strategy?: CacheStrategy,
    @CacheContext() cacheCtx?: any,
  ): Promise<string | null> {
    try {
      const options = {
        tenantId: cacheCtx?.tenantId,
        useL1Cache: strategy !== CacheStrategy.L2_ONLY,
        useL2Cache: strategy !== CacheStrategy.L1_ONLY,
        useDistributed: strategy === CacheStrategy.DISTRIBUTED,
      };

      const result = await this.intelligentCache.get<any>(key, options);
      return result ? JSON.stringify(result) : null;
    } catch (error) {
      this.handleError(error, 'Failed to get cache value');
      return null;
    }
  }

  /**
   * Set cache entry
   */
  @Mutation(() => MutationResponse, {
    description: 'Set cache value with options'
  })
  @CacheInvalidate({ patterns: ['cache:stats:*', 'cache:metrics:*'] })
  @PerformanceMonitor({ trackResponseTime: true })
  async setCacheValue(
    @Args('input') input: CacheOperationInput,
    @CacheContext() cacheCtx?: any,
  ): Promise<MutationResponse> {
    try {
      const options = {
        tenantId: cacheCtx?.tenantId,
        ttl: input.ttl || 300,
        useL1Cache: input.useL1Cache ?? true,
        useL2Cache: input.useL2Cache ?? true,
      };

      const value = input.value ? JSON.parse(input.value) : null;
      await this.intelligentCache.set(input.key, value, options);

      // Publish cache update event
      await this.pubSub.publish('cacheUpdated', {
        cacheUpdated: {
          key: input.key,
          action: 'SET',
          tenantId: cacheCtx?.tenantId,
          timestamp: new Date(),
        },
      });

      return this.createMutationResponse(true, 'Cache value set successfully');
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to set cache value', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  /**
   * Delete cache entry
   */
  @Mutation(() => MutationResponse, {
    description: 'Delete cache entry by key'
  })
  @CacheInvalidate({ patterns: ['cache:stats:*', 'cache:metrics:*'] })
  async deleteCacheValue(
    @Args('key') key: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<MutationResponse> {
    try {
      await this.intelligentCache.del(key, { tenantId: cacheCtx?.tenantId });

      // Publish cache delete event
      await this.pubSub.publish('cacheUpdated', {
        cacheUpdated: {
          key,
          action: 'DELETE',
          tenantId: cacheCtx?.tenantId,
          timestamp: new Date(),
        },
      });

      return this.createMutationResponse(true, 'Cache value deleted successfully');
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to delete cache value', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  /**
   * Bulk cache operations
   */
  @Mutation(() => MutationResponse, {
    description: 'Execute multiple cache operations in bulk'
  })
  @CacheInvalidate({ patterns: ['cache:stats:*', 'cache:metrics:*'] })
  async bulkCacheOperations(
    @Args('input') input: BulkCacheOperationInput,
    @CacheContext() cacheCtx?: any,
  ): Promise<MutationResponse> {
    try {
      const results: Array<{ success: boolean; error?: string }> = [];

      for (const operation of input.operations) {
        try {
          const options = {
            tenantId: cacheCtx?.tenantId,
            ttl: operation.ttl || 300,
            useL1Cache: operation.useL1Cache ?? true,
            useL2Cache: operation.useL2Cache ?? true,
          };

          if (operation.value) {
            // Set operation
            const value = JSON.parse(operation.value);
            await this.intelligentCache.set(operation.key, value, options);
          } else {
            // Delete operation
            await this.intelligentCache.del(operation.key, options);
          }

          results.push({ success: true });
        } catch (error) {
          results.push({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });

          if (!input.continueOnError) {
            break;
          }
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      return this.createMutationResponse(
        failureCount === 0,
        `Bulk operation completed: ${successCount} successful, ${failureCount} failed`,
        failureCount > 0 ? [{ message: `${failureCount} operations failed` }] : undefined
      );
    } catch (error) {
      return this.createMutationResponse(false, 'Bulk cache operation failed', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  // ==================== CACHE INVALIDATION ====================

  /**
   * Invalidate cache entries
   */
  @Mutation(() => MutationResponse, {
    description: 'Invalidate cache entries by key, pattern, or tags'
  })
  @CacheInvalidate({ patterns: ['cache:stats:*', 'cache:metrics:*'] })
  async invalidateCache(
    @Args('input') input: CacheInvalidationInput,
    @CacheContext() cacheCtx?: any,
  ): Promise<MutationResponse> {
    try {
      const tenantId = cacheCtx?.tenantId;

      if (input.all) {
        await this.intelligentCache.invalidatePattern('*', { tenantId });
      } else if (input.key) {
        await this.intelligentCache.del(input.key, { tenantId });
      } else if (input.pattern) {
        await this.intelligentCache.invalidatePattern(input.pattern, { tenantId });
      } else if (input.tags && input.tags.length > 0) {
        for (const tag of input.tags) {
          await this.intelligentCache.invalidatePattern(`*:tag:${tag}:*`, { tenantId });
        }
      }

      // Publish cache invalidation event
      await this.pubSub.publish('cacheInvalidated', {
        cacheInvalidated: {
          input,
          tenantId,
          timestamp: new Date(),
        },
      });

      return this.createMutationResponse(true, 'Cache invalidation completed successfully');
    } catch (error) {
      return this.createMutationResponse(false, 'Cache invalidation failed', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  // ==================== CACHE WARMING ====================

  /**
   * Configure cache warming
   */
  @Mutation(() => MutationResponse, {
    description: 'Configure cache warming for a key'
  })
  @CacheWarm({ priority: CachePriority.HIGH })
  async configureCacheWarming(
    @Args('input') input: CacheWarmingConfigInput,
    @CacheContext() cacheCtx?: any,
  ): Promise<MutationResponse> {
    try {
      // This would integrate with a warming configuration service
      // For now, we'll use the advanced cache service
      const config = {
        key: input.key,
        dataLoader: async () => ({}), // Placeholder loader
        ttl: input.ttl,
        priority: input.priority,
        schedule: input.schedule,
        dependencies: input.dependencies,
      };

      this.advancedCache.configureCacheWarming(config);

      return this.createMutationResponse(true, 'Cache warming configured successfully');
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to configure cache warming', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  /**
   * Remove cache warming configuration
   */
  @Mutation(() => MutationResponse, {
    description: 'Remove cache warming configuration'
  })
  async removeCacheWarming(
    @Args('key') key: string,
  ): Promise<MutationResponse> {
    try {
      this.advancedCache.removeCacheWarming(key);
      return this.createMutationResponse(true, 'Cache warming configuration removed');
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to remove cache warming', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  // ==================== CACHE STATISTICS ====================

  /**
   * Get cache statistics
   */
  @Query(() => CacheStats, {
    description: 'Get cache statistics and metrics'
  })
  @Cache({
    key: 'cache:stats:{tenantId}',
    ttl: 60,
    strategy: CacheStrategy.L1_ONLY,
    priority: CachePriority.HIGH,
  })
  async getCacheStats(
    @CacheContext() cacheCtx?: any,
  ): Promise<CacheStats> {
    try {
      const stats = this.intelligentCache.getStats();
      return {
        l1Hits: stats.l1Hits,
        l1Misses: stats.l1Misses,
        l2Hits: stats.l2Hits,
        l2Misses: stats.l2Misses,
        totalRequests: stats.totalRequests,
        hitRate: stats.hitRate,
        l1Size: stats.l1Size,
        l1MaxSize: stats.l1MaxSize,
        l1MemoryUsage: stats.l1MemoryUsage,
      };
    } catch (error) {
      this.handleError(error, 'Failed to get cache statistics');
      throw error;
    }
  }

  /**
   * Get advanced cache metrics
   */
  @Query(() => AdvancedCacheMetrics, {
    description: 'Get advanced cache metrics and performance data'
  })
  @Cache({
    key: 'cache:advanced-metrics:{tenantId}',
    ttl: 120,
    strategy: CacheStrategy.INTELLIGENT,
  })
  async getAdvancedCacheMetrics(): Promise<AdvancedCacheMetrics> {
    try {
      const metrics = this.advancedCache.getCacheMetrics();
      return {
        hitRate: metrics.hitRate,
        missRate: metrics.missRate,
        evictionRate: metrics.evictionRate,
        averageResponseTime: metrics.averageResponseTime,
        memoryUsage: metrics.memoryUsage,
        keyCount: metrics.keyCount,
        hotKeys: metrics.hotKeys,
        warmingConfigs: metrics.warmingConfigs,
        distributedCacheEnabled: metrics.distributedCacheEnabled,
      };
    } catch (error) {
      this.handleError(error, 'Failed to get advanced cache metrics');
      throw error;
    }
  }

  // ==================== PERFORMANCE METRICS ====================

  /**
   * Get API performance metrics
   */
  @Query(() => APIPerformanceMetrics, {
    description: 'Get API performance metrics'
  })
  @Cache({
    key: 'api:performance-metrics:{tenantId}',
    ttl: 180,
    strategy: CacheStrategy.MULTI_LEVEL,
  })
  @PerformanceMonitor({ trackResponseTime: true })
  async getAPIPerformanceMetrics(): Promise<APIPerformanceMetrics> {
    try {
      const metrics = this.performanceService.getPerformanceMetrics();
      return {
        averageResponseTime: metrics.overall.averageResponseTime,
        requestsPerSecond: metrics.overall.requestsPerSecond,
        cacheHitRate: metrics.overall.cacheHitRate,
        compressionRatio: metrics.overall.compressionRatio,
        cdnHitRate: metrics.overall.cdnHitRate,
        errorRate: metrics.overall.errorRate,
      };
    } catch (error) {
      this.handleError(error, 'Failed to get API performance metrics');
      throw error;
    }
  }

  /**
   * Get endpoint-specific metrics
   */
  @Query(() => [APIEndpointMetrics], {
    description: 'Get performance metrics for specific endpoints'
  })
  @Cache({
    key: 'api:endpoint-metrics:{tenantId}',
    ttl: 300,
    strategy: CacheStrategy.INTELLIGENT,
  })
  async getEndpointMetrics(): Promise<APIEndpointMetrics[]> {
    try {
      const metrics = this.performanceService.getPerformanceMetrics();
      return metrics.endpoints.map(endpoint => ({
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        averageResponseTime: endpoint.averageResponseTime,
        requestCount: endpoint.requestCount,
        errorCount: endpoint.errorCount,
        cacheHitRate: endpoint.cacheHitRate,
        lastAccessed: endpoint.lastAccessed,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to get endpoint metrics');
      throw error;
    }
  }

  // ==================== HORIZONTAL SCALING ====================

  /**
   * Get horizontal scaling metrics
   */
  @Query(() => HorizontalScalingMetrics, {
    description: 'Get horizontal scaling and load balancing metrics'
  })
  @Cache({
    key: 'scaling:metrics:{tenantId}',
    ttl: 60,
    strategy: CacheStrategy.L1_ONLY,
  })
  @LoadBalance({ strategy: 'round-robin', healthCheck: true })
  async getHorizontalScalingMetrics(): Promise<HorizontalScalingMetrics> {
    try {
      const clusterHealth = this.horizontalScalingService.getClusterHealth();
      return {
        totalNodes: clusterHealth.totalNodes,
        healthyNodes: clusterHealth.healthyNodes,
        unhealthyNodes: clusterHealth.unhealthyNodes,
        averageMetrics: {
          nodeId: 'aggregate',
          cpuUsage: clusterHealth.averageMetrics.cpuUsage,
          memoryUsage: clusterHealth.averageMetrics.memoryUsage,
          activeConnections: 0,
          requestsPerSecond: 0,
          responseTime: clusterHealth.averageMetrics.responseTime,
          isHealthy: true,
          lastHeartbeat: new Date(),
        },
        loadBalancing: {
          strategy: clusterHealth.loadBalancing.strategy,
          healthCheckInterval: clusterHealth.loadBalancing.healthCheckInterval,
          failoverTimeout: clusterHealth.loadBalancing.failoverTimeout,
          maxRetries: clusterHealth.loadBalancing.maxRetries,
        },
        autoScaling: {
          minInstances: clusterHealth.autoScaling.minInstances,
          maxInstances: clusterHealth.autoScaling.maxInstances,
          targetCpuUtilization: clusterHealth.autoScaling.targetCpuUtilization,
          targetMemoryUtilization: clusterHealth.autoScaling.targetMemoryUtilization,
          scaleUpCooldown: clusterHealth.autoScaling.scaleUpCooldown,
          scaleDownCooldown: clusterHealth.autoScaling.scaleDownCooldown,
          metricsWindow: clusterHealth.autoScaling.metricsWindow,
        },
      };
    } catch (error) {
      this.handleError(error, 'Failed to get horizontal scaling metrics');
      throw error;
    }
  }

  // ==================== HEALTH AND STATUS ====================

  /**
   * Get cache health status
   */
  @Query(() => CacheHealthStatus, {
    description: 'Get cache system health status'
  })
  async getCacheHealthStatus(): Promise<CacheHealthStatus> {
    try {
      const health = await this.intelligentCache.isHealthy();
      return {
        l1Cache: health.l1Cache,
        l2Cache: health.l2Cache,
        redis: health.redis,
        overall: health.overall,
        timestamp: new Date(),
      };
    } catch (error) {
      this.handleError(error, 'Failed to get cache health status');
      throw error;
    }
  }

  /**
   * Get Redis connection info
   */
  @Query(() => RedisConnectionInfo, {
    description: 'Get Redis connection information'
  })
  async getRedisConnectionInfo(): Promise<RedisConnectionInfo> {
    try {
      const info = await this.redisService.getInfo();
      return {
        isHealthy: info.isHealthy,
        mainConnection: info.connections.main,
        subscriberConnection: info.connections.subscriber,
        publisherConnection: info.connections.publisher,
        memoryInfo: JSON.stringify(info.memory),
      };
    } catch (error) {
      this.handleError(error, 'Failed to get Redis connection info');
      throw error;
    }
  }

  // ==================== OPTIMIZATION ====================

  /**
   * Optimize cache performance
   */
  @Mutation(() => CacheOptimizationResult, {
    description: 'Optimize cache performance and clean up'
  })
  @CacheInvalidate({ patterns: ['cache:stats:*', 'cache:metrics:*'] })
  async optimizeCachePerformance(): Promise<CacheOptimizationResult> {
    try {
      const result = await this.advancedCache.optimizeCachePerformance();
      return {
        evictedKeys: result.evictedKeys,
        warmedKeys: result.warmedKeys,
        optimizedHotKeys: result.optimizedHotKeys,
        timestamp: new Date(),
      };
    } catch (error) {
      this.handleError(error, 'Failed to optimize cache performance');
      throw error;
    }
  }

  /**
   * Optimize API performance settings
   */
  @Mutation(() => MutationResponse, {
    description: 'Optimize API performance settings'
  })
  async optimizeAPIPerformance(
    @Args('input', { nullable: true }) input?: PerformanceOptimizationInput,
  ): Promise<MutationResponse> {
    try {
      const result = await this.performanceService.optimizeSettings();
      
      return this.createMutationResponse(
        true,
        `API optimization completed: compression=${result.compressionOptimized}, cache=${result.cacheOptimized}, endpoints=${result.endpointsOptimized}`
      );
    } catch (error) {
      return this.createMutationResponse(false, 'API optimization failed', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Create session
   */
  @Mutation(() => MutationResponse, {
    description: 'Create a new session'
  })
  @SessionRequired({ strategy: 'distributed', replication: true })
  async createSession(
    @Args('input') input: SessionManagementInput,
    @CacheContext() cacheCtx?: any,
  ): Promise<MutationResponse> {
    try {
      const sessionData = input.data ? JSON.parse(input.data) : {};
      await this.horizontalScalingService.createSession(input.sessionId, {
        ...sessionData,
        userId: cacheCtx?.userId,
        tenantId: cacheCtx?.tenantId,
        createdAt: new Date(),
      });

      return this.createMutationResponse(true, 'Session created successfully');
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to create session', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  /**
   * Get session
   */
  @Query(() => String, {
    nullable: true,
    description: 'Get session data'
  })
  @Cache({
    key: 'session:{sessionId}',
    ttl: 300,
    strategy: CacheStrategy.DISTRIBUTED,
  })
  async getSession(
    @Args('sessionId') sessionId: string,
  ): Promise<string | null> {
    try {
      const sessionData = await this.horizontalScalingService.getSession(sessionId);
      return sessionData ? JSON.stringify(sessionData) : null;
    } catch (error) {
      this.handleError(error, 'Failed to get session');
      return null;
    }
  }

  // ==================== SUBSCRIPTIONS ====================

  /**
   * Subscribe to cache updates
   */
  @Subscription(() => String, {
    description: 'Subscribe to cache update events'
  })
  async cacheUpdated(
    @Args('tenantId', { nullable: true }) tenantId?: string,
  ) {
    return this.pubSub.asyncIterator('cacheUpdated');
  }

  /**
   * Subscribe to cache invalidation events
   */
  @Subscription(() => String, {
    description: 'Subscribe to cache invalidation events'
  })
  async cacheInvalidated(
    @Args('tenantId', { nullable: true }) tenantId?: string,
  ) {
    return this.pubSub.asyncIterator('cacheInvalidated');
  }

  /**
   * Subscribe to performance alerts
   */
  @Subscription(() => String, {
    description: 'Subscribe to performance alert events'
  })
  async performanceAlert(
    @Args('threshold', { type: () => Number, nullable: true }) threshold?: number,
  ) {
    return this.pubSub.asyncIterator('performanceAlert');
  }

  /**
   * Subscribe to scaling events
   */
  @Subscription(() => String, {
    description: 'Subscribe to horizontal scaling events'
  })
  async scalingEvent() {
    return this.pubSub.asyncIterator('scalingEvent');
  }
}