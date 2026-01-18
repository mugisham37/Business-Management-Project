import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { MutationResponse } from '../../../common/graphql/mutation-response.types';
import { HorizontalScalingService } from '../horizontal-scaling.service';
import { CacheInterceptor } from '../interceptors/cache.interceptor';
import { CacheAccessGuard, LoadBalancingGuard, CacheHealthGuard } from '../guards/cache.guard';
import {
  Cache,
  CacheInvalidate,
  LoadBalance,
  SessionRequired,
  PerformanceMonitor,
  FullCache,
  CacheContext,
  NodeInfo,
  SessionInfo,
  DistributedContext,
} from '../decorators/cache.decorators';
import {
  LoadBalancingConfigInput,
  AutoScalingConfigInput,
  SessionManagementInput,
} from '../inputs/cache.input';
import {
  HorizontalScalingMetrics,
  NodeMetrics,
  LoadBalancingConfig,
  AutoScalingConfig,
  SessionInfo as SessionInfoType,
  CacheStrategy,
  CachePriority,
  LoadBalancingStrategy,
  SessionStrategy,
} from '../types/cache.types';

/**
 * Scaling resolver for horizontal scaling and load balancing operations
 * Handles node management, session management, and auto-scaling
 */
@Resolver()
@UseGuards(GraphQLJwtAuthGuard, CacheAccessGuard, LoadBalancingGuard, CacheHealthGuard)
@UseInterceptors(CacheInterceptor)
export class ScalingResolver extends BaseResolver {
  private readonly pubSub = new PubSub();

  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly horizontalScalingService: HorizontalScalingService,
  ) {
    super(dataLoaderService);
  }

  // ==================== CLUSTER MANAGEMENT ====================

  /**
   * Get cluster health and metrics
   */
  @Query(() => HorizontalScalingMetrics, {
    description: 'Get comprehensive cluster health and scaling metrics'
  })
  @FullCache({
    key: 'scaling:cluster-health:{tenantId}',
    ttl: 30, // Short TTL for real-time cluster data
    strategy: CacheStrategy.L1_ONLY,
    priority: CachePriority.CRITICAL,
    loadBalance: true,
    monitoring: true,
  })
  async getClusterHealth(
    @CacheContext() cacheCtx?: any,
    @NodeInfo() nodeInfo?: any,
  ): Promise<HorizontalScalingMetrics> {
    try {
      const clusterHealth = this.horizontalScalingService.getClusterHealth();

      // Publish cluster health update
      await this.pubSub.publish('clusterHealthUpdated', {
        clusterHealthUpdated: {
          totalNodes: clusterHealth.totalNodes,
          healthyNodes: clusterHealth.healthyNodes,
          unhealthyNodes: clusterHealth.unhealthyNodes,
          nodeId: nodeInfo?.nodeId,
          tenantId: cacheCtx?.tenantId,
          timestamp: new Date(),
        },
      });

      return {
        totalNodes: clusterHealth.totalNodes,
        healthyNodes: clusterHealth.healthyNodes,
        unhealthyNodes: clusterHealth.unhealthyNodes,
        averageMetrics: {
          nodeId: 'cluster-average',
          cpuUsage: clusterHealth.averageMetrics.cpuUsage,
          memoryUsage: clusterHealth.averageMetrics.memoryUsage,
          activeConnections: 0,
          requestsPerSecond: 0,
          responseTime: clusterHealth.averageMetrics.responseTime,
          isHealthy: clusterHealth.healthyNodes > 0,
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
      this.handleError(error, 'Failed to get cluster health');
      throw error;
    }
  }

  /**
   * Get next available node for load balancing
   */
  @Query(() => String, {
    nullable: true,
    description: 'Get next available node for load balancing'
  })
  @LoadBalance({ 
    strategy: 'round-robin',
    healthCheck: true,
  })
  @PerformanceMonitor({ trackResponseTime: true })
  async getNextAvailableNode(
    @Args('strategy', { type: () => LoadBalancingStrategy, nullable: true }) strategy?: LoadBalancingStrategy,
    @NodeInfo() nodeInfo?: any,
  ): Promise<string | null> {
    try {
      const nextNode = await this.horizontalScalingService.getNextNode();
      
      if (nextNode) {
        // Publish node selection event
        await this.pubSub.publish('nodeSelected', {
          nodeSelected: {
            selectedNode: nextNode,
            currentNode: nodeInfo?.nodeId,
            strategy: strategy || LoadBalancingStrategy.ROUND_ROBIN,
            timestamp: new Date(),
          },
        });
      }

      return nextNode;
    } catch (error) {
      this.handleError(error, 'Failed to get next available node');
      return null;
    }
  }

  // ==================== LOAD BALANCING CONFIGURATION ====================

  /**
   * Configure load balancing settings
   */
  @Mutation(() => MutationResponse, {
    description: 'Configure load balancing strategy and settings'
  })
  @CacheInvalidate({ patterns: ['scaling:*', 'cluster:*'] })
  @LoadBalance({ strategy: 'weighted', healthCheck: true })
  async configureLoadBalancing(
    @Args('input') input: LoadBalancingConfigInput,
    @CacheContext() cacheCtx?: any,
    @NodeInfo() nodeInfo?: any,
  ): Promise<MutationResponse> {
    try {
      // This would typically update load balancing configuration
      // For now, we'll simulate the configuration update
      
      const config = {
        strategy: input.strategy,
        healthCheckInterval: input.healthCheckInterval || 30000,
        failoverTimeout: input.failoverTimeout || 5000,
        maxRetries: input.maxRetries || 3,
        configuredBy: nodeInfo?.nodeId,
        tenantId: cacheCtx?.tenantId,
        configuredAt: new Date(),
      };

      // Publish load balancing configuration event
      await this.pubSub.publish('loadBalancingConfigured', {
        loadBalancingConfigured: config,
      });

      return this.createMutationResponse(
        true,
        `Load balancing configured with strategy: ${input.strategy}`
      );
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to configure load balancing', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  // ==================== AUTO-SCALING CONFIGURATION ====================

  /**
   * Configure auto-scaling settings
   */
  @Mutation(() => MutationResponse, {
    description: 'Configure auto-scaling parameters and thresholds'
  })
  @CacheInvalidate({ patterns: ['scaling:*', 'autoscaling:*'] })
  @PerformanceMonitor({ 
    trackResponseTime: true,
    alertThreshold: 1000,
  })
  async configureAutoScaling(
    @Args('input') input: AutoScalingConfigInput,
    @CacheContext() cacheCtx?: any,
    @NodeInfo() nodeInfo?: any,
  ): Promise<MutationResponse> {
    try {
      const config = {
        minInstances: input.minInstances || 2,
        maxInstances: input.maxInstances || 10,
        targetCpuUtilization: input.targetCpuUtilization || 70,
        targetMemoryUtilization: input.targetMemoryUtilization || 80,
        scaleUpCooldown: input.scaleUpCooldown || 300000,
        scaleDownCooldown: input.scaleDownCooldown || 600000,
        metricsWindow: input.metricsWindow || 300000,
        configuredBy: nodeInfo?.nodeId,
        tenantId: cacheCtx?.tenantId,
        configuredAt: new Date(),
      };

      // Publish auto-scaling configuration event
      await this.pubSub.publish('autoScalingConfigured', {
        autoScalingConfigured: config,
      });

      return this.createMutationResponse(
        true,
        `Auto-scaling configured: ${config.minInstances}-${config.maxInstances} instances, ` +
        `CPU: ${config.targetCpuUtilization}%, Memory: ${config.targetMemoryUtilization}%`
      );
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to configure auto-scaling', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Create distributed session
   */
  @Mutation(() => MutationResponse, {
    description: 'Create a new distributed session'
  })
  @SessionRequired({ 
    strategy: 'distributed',
    ttl: 3600,
    replication: true,
  })
  @PerformanceMonitor({ trackResponseTime: true })
  async createDistributedSession(
    @Args('input') input: SessionManagementInput,
    @CacheContext() cacheCtx?: any,
    @SessionInfo() sessionInfo?: any,
    @DistributedContext() distCtx?: any,
  ): Promise<MutationResponse> {
    try {
      const sessionData = {
        ...JSON.parse(input.data || '{}'),
        userId: cacheCtx?.userId,
        tenantId: cacheCtx?.tenantId,
        nodeId: distCtx?.nodeId,
        strategy: input.strategy || SessionStrategy.DISTRIBUTED,
        replication: input.replication ?? true,
        createdAt: new Date(),
      };

      await this.horizontalScalingService.createSession(input.sessionId, sessionData);

      // Publish session created event
      await this.pubSub.publish('sessionCreated', {
        sessionCreated: {
          sessionId: input.sessionId,
          strategy: input.strategy,
          replication: input.replication,
          nodeId: distCtx?.nodeId,
          tenantId: cacheCtx?.tenantId,
          timestamp: new Date(),
        },
      });

      return this.createMutationResponse(true, 'Distributed session created successfully');
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to create distributed session', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  /**
   * Get distributed session
   */
  @Query(() => String, {
    nullable: true,
    description: 'Get distributed session data'
  })
  @Cache({
    key: 'session:distributed:{sessionId}',
    ttl: 300,
    strategy: CacheStrategy.DISTRIBUTED,
    priority: CachePriority.HIGH,
  })
  @SessionRequired({ strategy: 'distributed' })
  async getDistributedSession(
    @Args('sessionId') sessionId: string,
    @DistributedContext() distCtx?: any,
  ): Promise<string | null> {
    try {
      const sessionData = await this.horizontalScalingService.getSession(sessionId);
      
      if (sessionData) {
        // Add node information to session data
        const enrichedData = {
          ...sessionData,
          retrievedFrom: distCtx?.nodeId,
          retrievedAt: new Date(),
        };
        
        return JSON.stringify(enrichedData);
      }
      
      return null;
    } catch (error) {
      this.handleError(error, 'Failed to get distributed session');
      return null;
    }
  }

  // ==================== NODE MANAGEMENT ====================

  /**
   * Get current node information
   */
  @Query(() => NodeMetrics, {
    description: 'Get current node metrics and information'
  })
  @Cache({
    key: 'node:current-metrics:{nodeId}',
    ttl: 30,
    strategy: CacheStrategy.L1_ONLY,
    priority: CachePriority.HIGH,
  })
  async getCurrentNodeMetrics(
    @NodeInfo() nodeInfo?: any,
    @DistributedContext() distCtx?: any,
  ): Promise<NodeMetrics> {
    try {
      // Get current system metrics
      const usage = process.cpuUsage();
      const memUsage = process.memoryUsage();
      
      const metrics: NodeMetrics = {
        nodeId: nodeInfo?.nodeId || distCtx?.nodeId || 'unknown',
        cpuUsage: (usage.user + usage.system) / 1000000, // Convert to percentage approximation
        memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        activeConnections: 0, // Would be tracked by connection manager
        requestsPerSecond: 0, // Would be calculated from request metrics
        responseTime: 0, // Would be calculated from response metrics
        isHealthy: true,
        lastHeartbeat: new Date(),
      };

      return metrics;
    } catch (error) {
      this.handleError(error, 'Failed to get current node metrics');
      throw error;
    }
  }

  /**
   * Route request to optimal node
   */
  @Mutation(() => String, {
    nullable: true,
    description: 'Route request to optimal node based on load balancing'
  })
  @LoadBalance({ 
    strategy: 'least-connections',
    weights: { 'node-1': 1.0, 'node-2': 1.5, 'node-3': 0.8 },
    healthCheck: true,
  })
  @PerformanceMonitor({ trackResponseTime: true })
  async routeRequestToOptimalNode(
    @Args('requestData') requestData: string,
    @Args('strategy', { type: () => LoadBalancingStrategy, nullable: true }) strategy?: LoadBalancingStrategy,
    @NodeInfo() nodeInfo?: any,
    @CacheContext() cacheCtx?: any,
  ): Promise<string | null> {
    try {
      // Simulate request routing
      const mockRequest = { 
        data: requestData,
        timestamp: new Date(),
        sourceNode: nodeInfo?.nodeId,
      };

      const targetNode = await this.horizontalScalingService.routeRequest(mockRequest);

      if (targetNode) {
        // Publish request routed event
        await this.pubSub.publish('requestRouted', {
          requestRouted: {
            sourceNode: nodeInfo?.nodeId,
            targetNode,
            strategy: strategy || LoadBalancingStrategy.ROUND_ROBIN,
            tenantId: cacheCtx?.tenantId,
            timestamp: new Date(),
          },
        });
      }

      return targetNode;
    } catch (error) {
      this.handleError(error, 'Failed to route request to optimal node');
      return null;
    }
  }

  // ==================== SCALING OPERATIONS ====================

  /**
   * Trigger manual scaling
   */
  @Mutation(() => MutationResponse, {
    description: 'Manually trigger cluster scaling up or down'
  })
  @CacheInvalidate({ patterns: ['scaling:*', 'cluster:*'] })
  @PerformanceMonitor({ 
    trackResponseTime: true,
    alertThreshold: 5000, // Scaling operations can take time
  })
  async triggerManualScaling(
    @Args('direction') direction: string,
    @Args('count', { nullable: true }) count?: number,
    @Args('reason', { nullable: true }) reason?: string,
    @CacheContext() cacheCtx?: any,
    @NodeInfo() nodeInfo?: any,
  ): Promise<MutationResponse> {
    try {
      const scaleCount = count || 1;
      const scaleDirection = direction.toLowerCase() as 'up' | 'down';

      if (!['up', 'down'].includes(scaleDirection)) {
        return this.createMutationResponse(false, 'Invalid scaling direction. Use "up" or "down"');
      }

      // Simulate manual scaling trigger
      const scalingOperation = {
        direction: scaleDirection,
        count: scaleCount,
        reason: reason || 'Manual scaling request',
        triggeredBy: nodeInfo?.nodeId,
        tenantId: cacheCtx?.tenantId,
        triggeredAt: new Date(),
      };

      // Publish manual scaling event
      await this.pubSub.publish('manualScalingTriggered', {
        manualScalingTriggered: scalingOperation,
      });

      return this.createMutationResponse(
        true,
        `Manual scaling ${scaleDirection} triggered for ${scaleCount} instance(s)`
      );
    } catch (error) {
      return this.createMutationResponse(false, 'Failed to trigger manual scaling', [
        { message: error instanceof Error ? error.message : 'Unknown error' }
      ]);
    }
  }

  // ==================== SUBSCRIPTIONS ====================

  /**
   * Subscribe to cluster health updates
   */
  @Subscription(() => String, {
    description: 'Subscribe to real-time cluster health updates'
  })
  async clusterHealthUpdated(
    @Args('tenantId', { nullable: true }) tenantId?: string,
  ) {
    return this.pubSub.asyncIterator('clusterHealthUpdated');
  }

  /**
   * Subscribe to node selection events
   */
  @Subscription(() => String, {
    description: 'Subscribe to load balancing node selection events'
  })
  async nodeSelected() {
    return this.pubSub.asyncIterator('nodeSelected');
  }

  /**
   * Subscribe to load balancing configuration events
   */
  @Subscription(() => String, {
    description: 'Subscribe to load balancing configuration changes'
  })
  async loadBalancingConfigured() {
    return this.pubSub.asyncIterator('loadBalancingConfigured');
  }

  /**
   * Subscribe to auto-scaling configuration events
   */
  @Subscription(() => String, {
    description: 'Subscribe to auto-scaling configuration changes'
  })
  async autoScalingConfigured() {
    return this.pubSub.asyncIterator('autoScalingConfigured');
  }

  /**
   * Subscribe to session events
   */
  @Subscription(() => String, {
    description: 'Subscribe to distributed session creation events'
  })
  async sessionCreated() {
    return this.pubSub.asyncIterator('sessionCreated');
  }

  /**
   * Subscribe to request routing events
   */
  @Subscription(() => String, {
    description: 'Subscribe to request routing events'
  })
  async requestRouted() {
    return this.pubSub.asyncIterator('requestRouted');
  }

  /**
   * Subscribe to manual scaling events
   */
  @Subscription(() => String, {
    description: 'Subscribe to manual scaling trigger events'
  })
  async manualScalingTriggered() {
    return this.pubSub.asyncIterator('manualScalingTriggered');
  }

  /**
   * Subscribe to scaling events (auto and manual)
   */
  @Subscription(() => String, {
    description: 'Subscribe to all scaling events'
  })
  async scalingEvent() {
    return this.pubSub.asyncIterator(['manualScalingTriggered', 'autoScalingConfigured']);
  }
}