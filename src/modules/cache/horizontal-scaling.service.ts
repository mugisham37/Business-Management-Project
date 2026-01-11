import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from '../logger/logger.service';
import { RedisService } from './redis.service';
import { OptimizedDatabaseService } from '../database/optimized-database.service';

interface LoadBalancingConfig {
  strategy: 'round-robin' | 'least-connections' | 'weighted' | 'ip-hash';
  healthCheckInterval: number;
  failoverTimeout: number;
  maxRetries: number;
}

interface AutoScalingConfig {
  minInstances: number;
  maxInstances: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  metricsWindow: number;
}

interface NodeMetrics {
  nodeId: string;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestsPerSecond: number;
  responseTime: number;
  isHealthy: boolean;
  lastHeartbeat: Date;
}

interface SessionConfig {
  strategy: 'sticky' | 'distributed' | 'database';
  ttl: number;
  replication: boolean;
}

@Injectable()
export class HorizontalScalingService {
  private readonly logger = new Logger(HorizontalScalingService.name);
  
  // Node management
  private nodes = new Map<string, NodeMetrics>();
  private currentNodeIndex = 0;
  private nodeId: string;
  
  // Load balancing
  private loadBalancingConfig: LoadBalancingConfig = {
    strategy: 'round-robin',
    healthCheckInterval: 30000,
    failoverTimeout: 5000,
    maxRetries: 3,
  };
  
  // Auto-scaling
  private autoScalingConfig: AutoScalingConfig = {
    minInstances: 2,
    maxInstances: 10,
    targetCpuUtilization: 70,
    targetMemoryUtilization: 80,
    scaleUpCooldown: 300000, // 5 minutes
    scaleDownCooldown: 600000, // 10 minutes
    metricsWindow: 300000, // 5 minutes
  };
  
  // Session management
  private sessionConfig: SessionConfig = {
    strategy: 'distributed',
    ttl: 3600000, // 1 hour
    replication: true,
  };
  
  // Metrics tracking
  private metricsHistory: Array<{ timestamp: Date; metrics: NodeMetrics }> = [];
  private lastScaleAction: Date | null = null;
  private scaleActionType: 'up' | 'down' | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly customLogger: CustomLoggerService,
    private readonly redisService: RedisService,
    private readonly databaseService: OptimizedDatabaseService,
  ) {
    this.customLogger.setContext('HorizontalScalingService');
    this.nodeId = this.generateNodeId();
    
    this.initializeScaling();
    this.startHealthChecks();
    this.startMetricsCollection();
    this.startAutoScaling();
  }

  /**
   * Initialize horizontal scaling configuration
   */
  private initializeScaling(): void {
    // Load configuration from environment
    this.loadBalancingConfig = {
      strategy: (this.configService.get('LOAD_BALANCING_STRATEGY') as any) || 'round-robin',
      healthCheckInterval: parseInt(this.configService.get('HEALTH_CHECK_INTERVAL') || '30000'),
      failoverTimeout: parseInt(this.configService.get('FAILOVER_TIMEOUT') || '5000'),
      maxRetries: parseInt(this.configService.get('MAX_RETRIES') || '3'),
    };

    this.autoScalingConfig = {
      minInstances: parseInt(this.configService.get('MIN_INSTANCES') || '2'),
      maxInstances: parseInt(this.configService.get('MAX_INSTANCES') || '10'),
      targetCpuUtilization: parseInt(this.configService.get('TARGET_CPU_UTILIZATION') || '70'),
      targetMemoryUtilization: parseInt(this.configService.get('TARGET_MEMORY_UTILIZATION') || '80'),
      scaleUpCooldown: parseInt(this.configService.get('SCALE_UP_COOLDOWN') || '300000'),
      scaleDownCooldown: parseInt(this.configService.get('SCALE_DOWN_COOLDOWN') || '600000'),
      metricsWindow: parseInt(this.configService.get('METRICS_WINDOW') || '300000'),
    };

    // Register this node
    this.registerNode();

    this.customLogger.log('Horizontal scaling initialized', {
      nodeId: this.nodeId,
      loadBalancingStrategy: this.loadBalancingConfig.strategy,
      autoScalingEnabled: true,
    });
  }

  /**
   * Register this node in the cluster
   */
  private async registerNode(): Promise<void> {
    const nodeMetrics: NodeMetrics = {
      nodeId: this.nodeId,
      cpuUsage: 0,
      memoryUsage: 0,
      activeConnections: 0,
      requestsPerSecond: 0,
      responseTime: 0,
      isHealthy: true,
      lastHeartbeat: new Date(),
    };

    this.nodes.set(this.nodeId, nodeMetrics);

    // Register in Redis for cluster coordination
    await this.redisService.set(`cluster:node:${this.nodeId}`, nodeMetrics, 60);

    this.customLogger.log('Node registered in cluster', { nodeId: this.nodeId });
  }

  /**
   * Get the next available node for load balancing
   */
  async getNextNode(): Promise<string | null> {
    const healthyNodes = Array.from(this.nodes.values()).filter(node => node.isHealthy);
    
    if (healthyNodes.length === 0) {
      this.customLogger.error('No healthy nodes available');
      return null;
    }

    switch (this.loadBalancingConfig.strategy) {
      case 'round-robin':
        return this.getRoundRobinNode(healthyNodes);
      
      case 'least-connections':
        return this.getLeastConnectionsNode(healthyNodes);
      
      case 'weighted':
        return this.getWeightedNode(healthyNodes);
      
      case 'ip-hash':
        return this.getIpHashNode(healthyNodes);
      
      default:
        return this.getRoundRobinNode(healthyNodes);
    }
  }

  /**
   * Handle request routing with load balancing
   */
  async routeRequest(request: any): Promise<string | null> {
    const targetNode = await this.getNextNode();
    
    if (!targetNode) {
      throw new Error('No available nodes for request routing');
    }

    // Update node metrics
    const node = this.nodes.get(targetNode);
    if (node) {
      node.activeConnections++;
      node.requestsPerSecond++;
    }

    return targetNode;
  }

  /**
   * Implement distributed session management
   */
  async createSession(sessionId: string, sessionData: any): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    
    switch (this.sessionConfig.strategy) {
      case 'distributed':
        await this.redisService.set(sessionKey, sessionData, this.sessionConfig.ttl / 1000);
        
        if (this.sessionConfig.replication) {
          // Replicate to multiple Redis nodes
          await this.replicateSession(sessionKey, sessionData);
        }
        break;
      
      case 'database':
        // Store session in database
        await this.storeSessionInDatabase(sessionId, sessionData);
        break;
      
      case 'sticky':
        // Store locally (not recommended for horizontal scaling)
        // This would be handled by the load balancer
        break;
    }

    this.customLogger.debug('Session created', { sessionId, strategy: this.sessionConfig.strategy });
  }

  /**
   * Retrieve distributed session
   */
  async getSession(sessionId: string): Promise<any | null> {
    const sessionKey = `session:${sessionId}`;
    
    switch (this.sessionConfig.strategy) {
      case 'distributed':
        return await this.redisService.get(sessionKey);
      
      case 'database':
        return await this.getSessionFromDatabase(sessionId);
      
      case 'sticky':
        // Would be handled locally
        return null;
      
      default:
        return null;
    }
  }

  /**
   * Auto-scaling decision engine
   */
  private async evaluateAutoScaling(): Promise<void> {
    const currentTime = new Date();
    const cooldownPeriod = this.scaleActionType === 'up' 
      ? this.autoScalingConfig.scaleUpCooldown 
      : this.autoScalingConfig.scaleDownCooldown;

    // Check cooldown period
    if (this.lastScaleAction && 
        (currentTime.getTime() - this.lastScaleAction.getTime()) < cooldownPeriod) {
      return;
    }

    const metrics = this.getAggregatedMetrics();
    const currentInstances = this.nodes.size;

    // Scale up conditions
    if (
      (metrics.avgCpuUsage > this.autoScalingConfig.targetCpuUtilization ||
       metrics.avgMemoryUsage > this.autoScalingConfig.targetMemoryUtilization) &&
      currentInstances < this.autoScalingConfig.maxInstances
    ) {
      await this.scaleUp();
      return;
    }

    // Scale down conditions
    if (
      metrics.avgCpuUsage < (this.autoScalingConfig.targetCpuUtilization * 0.5) &&
      metrics.avgMemoryUsage < (this.autoScalingConfig.targetMemoryUtilization * 0.5) &&
      currentInstances > this.autoScalingConfig.minInstances
    ) {
      await this.scaleDown();
      return;
    }
  }

  /**
   * Scale up the cluster
   */
  private async scaleUp(): Promise<void> {
    try {
      // In a real implementation, this would trigger container orchestration
      // For now, we'll simulate by updating configuration
      
      this.customLogger.log('Scaling up cluster', {
        currentInstances: this.nodes.size,
        targetInstances: this.nodes.size + 1,
      });

      // Trigger scaling via orchestration platform (Kubernetes, Docker Swarm, etc.)
      await this.triggerScaling('up', 1);

      this.lastScaleAction = new Date();
      this.scaleActionType = 'up';
    } catch (error) {
      this.customLogger.error('Scale up failed', error instanceof Error ? error.stack : undefined);
    }
  }

  /**
   * Scale down the cluster
   */
  private async scaleDown(): Promise<void> {
    try {
      this.customLogger.log('Scaling down cluster', {
        currentInstances: this.nodes.size,
        targetInstances: this.nodes.size - 1,
      });

      // Gracefully drain connections from node to be removed
      const nodeToRemove = this.selectNodeForRemoval();
      if (nodeToRemove) {
        await this.drainNode(nodeToRemove);
      }

      // Trigger scaling via orchestration platform
      await this.triggerScaling('down', 1);

      this.lastScaleAction = new Date();
      this.scaleActionType = 'down';
    } catch (error) {
      this.customLogger.error('Scale down failed', error instanceof Error ? error.stack : undefined);
    }
  }

  /**
   * Get cluster health status
   */
  getClusterHealth(): {
    totalNodes: number;
    healthyNodes: number;
    unhealthyNodes: number;
    averageMetrics: {
      cpuUsage: number;
      memoryUsage: number;
      responseTime: number;
    };
    loadBalancing: LoadBalancingConfig;
    autoScaling: AutoScalingConfig;
  } {
    const healthyNodes = Array.from(this.nodes.values()).filter(node => node.isHealthy);
    const unhealthyNodes = this.nodes.size - healthyNodes.length;
    const metrics = this.getAggregatedMetrics();

    return {
      totalNodes: this.nodes.size,
      healthyNodes: healthyNodes.length,
      unhealthyNodes,
      averageMetrics: {
        cpuUsage: metrics.avgCpuUsage,
        memoryUsage: metrics.avgMemoryUsage,
        responseTime: metrics.avgResponseTime,
      },
      loadBalancing: this.loadBalancingConfig,
      autoScaling: this.autoScalingConfig,
    };
  }

  // Private helper methods

  private generateNodeId(): string {
    const hostname = require('os').hostname();
    const pid = process.pid;
    const timestamp = Date.now();
    return `${hostname}-${pid}-${timestamp}`;
  }

  private getRoundRobinNode(nodes: NodeMetrics[]): string {
    if (nodes.length === 0) {
      throw new Error('No nodes available');
    }
    const node = nodes[this.currentNodeIndex % nodes.length];
    this.currentNodeIndex++;
    if (!node) {
      throw new Error('Invalid node selection');
    }
    return node.nodeId;
  }

  private getLeastConnectionsNode(nodes: NodeMetrics[]): string {
    return nodes.reduce((min, node) => 
      node.activeConnections < min.activeConnections ? node : min
    ).nodeId;
  }

  private getWeightedNode(nodes: NodeMetrics[]): string {
    // Simple weighted selection based on inverse of CPU usage
    if (nodes.length === 0) {
      throw new Error('No nodes available');
    }
    const weights = nodes.map(node => 100 - node.cpuUsage);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (let i = 0; i < nodes.length; i++) {
      currentWeight += weights[i] || 0;
      if (random <= currentWeight) {
        const selectedNode = nodes[i];
        if (selectedNode) {
          return selectedNode.nodeId;
        }
      }
    }
    
    // Fallback to first node
    const firstNode = nodes[0];
    if (!firstNode) {
      throw new Error('No valid nodes available');
    }
    return firstNode.nodeId;
  }

  private getIpHashNode(nodes: NodeMetrics[]): string {
    // Simple hash-based selection (would use client IP in real implementation)
    if (nodes.length === 0) {
      throw new Error('No nodes available');
    }
    const hash = Math.abs(this.nodeId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0));
    
    const selectedNode = nodes[hash % nodes.length];
    if (!selectedNode) {
      throw new Error('Invalid node selection');
    }
    return selectedNode.nodeId;
  }

  private async replicateSession(sessionKey: string, sessionData: any): Promise<void> {
    // Replicate to multiple Redis instances
    const replicationKeys = [`${sessionKey}:replica1`, `${sessionKey}:replica2`];
    
    for (const key of replicationKeys) {
      try {
        await this.redisService.set(key, sessionData, this.sessionConfig.ttl / 1000);
      } catch (error) {
        this.customLogger.error('Session replication failed', error instanceof Error ? error.stack : undefined, { key });
      }
    }
  }

  private async storeSessionInDatabase(sessionId: string, sessionData: any): Promise<void> {
    // Store session in database for persistence across restarts
    try {
      await this.databaseService.executeOptimizedQuery(
        'INSERT INTO sessions (id, data, expires_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, expires_at = $3',
        [sessionId, JSON.stringify(sessionData), new Date(Date.now() + this.sessionConfig.ttl)]
      );
    } catch (error) {
      this.customLogger.error('Database session storage failed', error instanceof Error ? error.stack : undefined, { sessionId });
    }
  }

  private async getSessionFromDatabase(sessionId: string): Promise<any | null> {
    try {
      const result = await this.databaseService.executeOptimizedQuery<{ data: string }>(
        'SELECT data FROM sessions WHERE id = $1 AND expires_at > NOW()',
        [sessionId]
      );
      
      if (result.length > 0 && result[0]) {
        return JSON.parse(result[0].data);
      }
      return null;
    } catch (error) {
      this.customLogger.error('Database session retrieval failed', error instanceof Error ? error.stack : undefined, { sessionId });
      return null;
    }
  }

  private getAggregatedMetrics(): {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    avgResponseTime: number;
    totalConnections: number;
  } {
    const nodes = Array.from(this.nodes.values()).filter(node => node.isHealthy);
    
    if (nodes.length === 0) {
      return { avgCpuUsage: 0, avgMemoryUsage: 0, avgResponseTime: 0, totalConnections: 0 };
    }

    const totals = nodes.reduce(
      (acc, node) => ({
        cpu: acc.cpu + node.cpuUsage,
        memory: acc.memory + node.memoryUsage,
        responseTime: acc.responseTime + node.responseTime,
        connections: acc.connections + node.activeConnections,
      }),
      { cpu: 0, memory: 0, responseTime: 0, connections: 0 }
    );

    return {
      avgCpuUsage: totals.cpu / nodes.length,
      avgMemoryUsage: totals.memory / nodes.length,
      avgResponseTime: totals.responseTime / nodes.length,
      totalConnections: totals.connections,
    };
  }

  private async triggerScaling(direction: 'up' | 'down', count: number): Promise<void> {
    // This would integrate with container orchestration platforms
    // For now, we'll just log the action
    this.customLogger.log('Scaling action triggered', {
      direction,
      count,
      platform: 'kubernetes', // or docker-swarm, ecs, etc.
    });

    // In a real implementation, this would call:
    // - Kubernetes API to update replica count
    // - Docker Swarm API to scale services
    // - AWS ECS to update service desired count
    // - etc.
  }

  private selectNodeForRemoval(): string | null {
    const nodes = Array.from(this.nodes.values()).filter(node => node.isHealthy);
    
    if (nodes.length <= this.autoScalingConfig.minInstances) {
      return null;
    }

    // Select node with lowest load
    return nodes.reduce((min, node) => 
      (node.cpuUsage + node.memoryUsage) < (min.cpuUsage + min.memoryUsage) ? node : min
    ).nodeId;
  }

  private async drainNode(nodeId: string): Promise<void> {
    this.customLogger.log('Draining node connections', { nodeId });
    
    // Mark node as unhealthy to stop receiving new requests
    const node = this.nodes.get(nodeId);
    if (node) {
      node.isHealthy = false;
    }

    // Wait for existing connections to complete
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    while (attempts < maxAttempts) {
      const currentNode = this.nodes.get(nodeId);
      if (!currentNode || currentNode.activeConnections === 0) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    this.customLogger.log('Node drained', { nodeId, attempts });
  }

  private startHealthChecks(): void {
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.loadBalancingConfig.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [nodeId, node] of this.nodes.entries()) {
      try {
        // Perform health check (ping, HTTP check, etc.)
        const isHealthy = await this.checkNodeHealth(nodeId);
        node.isHealthy = isHealthy;
        node.lastHeartbeat = new Date();
        
        // Update in Redis
        await this.redisService.set(`cluster:node:${nodeId}`, node, 60);
      } catch (error) {
        node.isHealthy = false;
        this.customLogger.error('Health check failed', error instanceof Error ? error.stack : undefined, { nodeId });
      }
    }
  }

  private async checkNodeHealth(nodeId: string): Promise<boolean> {
    // Implement actual health check logic
    // For now, return true if node exists
    return this.nodes.has(nodeId);
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectNodeMetrics();
    }, 10000); // Every 10 seconds
  }

  private collectNodeMetrics(): void {
    const currentMetrics = this.getCurrentNodeMetrics();
    const node = this.nodes.get(this.nodeId);
    
    if (node) {
      Object.assign(node, currentMetrics);
      
      // Store metrics history
      this.metricsHistory.push({
        timestamp: new Date(),
        metrics: { ...node },
      });
      
      // Keep only recent metrics
      const cutoff = Date.now() - this.autoScalingConfig.metricsWindow;
      this.metricsHistory = this.metricsHistory.filter(
        entry => entry.timestamp.getTime() > cutoff
      );
    }
  }

  private getCurrentNodeMetrics(): Partial<NodeMetrics> {
    // Get actual system metrics
    const usage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    return {
      cpuUsage: (usage.user + usage.system) / 1000000, // Convert to percentage
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      responseTime: 0, // Would be calculated from request metrics
      lastHeartbeat: new Date(),
    };
  }

  private startAutoScaling(): void {
    setInterval(async () => {
      await this.evaluateAutoScaling();
    }, 60000); // Every minute
  }
}