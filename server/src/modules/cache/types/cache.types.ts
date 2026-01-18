import { ObjectType, Field, ID, Int, Float, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity, Connection, Edge } from '../../../common/graphql/base.types';

// Enums for GraphQL
export enum CacheStrategy {
  L1_ONLY = 'L1_ONLY',
  L2_ONLY = 'L2_ONLY',
  MULTI_LEVEL = 'MULTI_LEVEL',
  DISTRIBUTED = 'DISTRIBUTED',
  INTELLIGENT = 'INTELLIGENT',
}

export enum CachePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'ROUND_ROBIN',
  LEAST_CONNECTIONS = 'LEAST_CONNECTIONS',
  WEIGHTED = 'WEIGHTED',
  IP_HASH = 'IP_HASH',
}

export enum SessionStrategy {
  STICKY = 'STICKY',
  DISTRIBUTED = 'DISTRIBUTED',
  DATABASE = 'DATABASE',
}

registerEnumType(CacheStrategy, {
  name: 'CacheStrategy',
  description: 'Cache strategy types',
});

registerEnumType(CachePriority, {
  name: 'CachePriority',
  description: 'Cache priority levels',
});

registerEnumType(LoadBalancingStrategy, {
  name: 'LoadBalancingStrategy',
  description: 'Load balancing strategies',
});

registerEnumType(SessionStrategy, {
  name: 'SessionStrategy',
  description: 'Session management strategies',
});

/**
 * Cache entry type for GraphQL
 */
@ObjectType()
export class CacheEntry extends BaseEntity {
  @Field()
  @ApiProperty({ description: 'Cache key' })
  key!: string;

  @Field()
  @ApiProperty({ description: 'Cached data as JSON string' })
  value!: string;

  @Field(() => Int)
  @ApiProperty({ description: 'Time to live in seconds' })
  ttl!: number;

  @Field()
  @ApiProperty({ description: 'Expiration timestamp' })
  expiresAt!: Date;

  @Field(() => CacheStrategy)
  @ApiProperty({ description: 'Cache strategy used', enum: CacheStrategy })
  strategy!: CacheStrategy;

  @Field(() => CachePriority)
  @ApiProperty({ description: 'Cache priority', enum: CachePriority })
  priority!: CachePriority;

  @Field(() => Int)
  @ApiProperty({ description: 'Number of times accessed' })
  accessCount!: number;

  @Field()
  @ApiProperty({ description: 'Last access timestamp' })
  lastAccessedAt!: Date;

  @Field(() => Int)
  @ApiProperty({ description: 'Size in bytes' })
  size!: number;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Cache tags for grouping', required: false })
  tags?: string;
}

/**
 * Cache statistics type
 */
@ObjectType()
export class CacheStats {
  @Field(() => Int)
  @ApiProperty({ description: 'L1 cache hits' })
  l1Hits!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'L1 cache misses' })
  l1Misses!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'L2 cache hits' })
  l2Hits!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'L2 cache misses' })
  l2Misses!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Total requests' })
  totalRequests!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Hit rate percentage' })
  hitRate!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'L1 cache size' })
  l1Size!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'L1 cache max size' })
  l1MaxSize!: number;

  @Field()
  @ApiProperty({ description: 'L1 memory usage' })
  l1MemoryUsage!: string;
}

/**
 * Advanced cache metrics type
 */
@ObjectType()
export class AdvancedCacheMetrics {
  @Field(() => Float)
  @ApiProperty({ description: 'Hit rate percentage' })
  hitRate!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Miss rate percentage' })
  missRate!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Eviction rate percentage' })
  evictionRate!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Average response time in ms' })
  averageResponseTime!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Memory usage in bytes' })
  memoryUsage!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Total key count' })
  keyCount!: number;

  @Field(() => [HotKey])
  @ApiProperty({ description: 'Hot keys list', type: [HotKey] })
  hotKeys!: HotKey[];

  @Field(() => Int)
  @ApiProperty({ description: 'Number of warming configurations' })
  warmingConfigs!: number;

  @Field()
  @ApiProperty({ description: 'Whether distributed cache is enabled' })
  distributedCacheEnabled!: boolean;
}

/**
 * Hot key type
 */
@ObjectType()
export class HotKey {
  @Field()
  @ApiProperty({ description: 'Cache key' })
  key!: string;

  @Field(() => Int)
  @ApiProperty({ description: 'Number of hits' })
  hits!: number;

  @Field()
  @ApiProperty({ description: 'Last access timestamp' })
  lastAccess!: Date;
}

/**
 * Cache warming configuration type
 */
@ObjectType()
export class CacheWarmingConfig extends BaseEntity {
  @Field()
  @ApiProperty({ description: 'Cache key to warm' })
  key!: string;

  @Field(() => Int)
  @ApiProperty({ description: 'Time to live in seconds' })
  ttl!: number;

  @Field(() => CachePriority)
  @ApiProperty({ description: 'Warming priority', enum: CachePriority })
  priority!: CachePriority;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Cron schedule expression', required: false })
  schedule?: string;

  @Field(() => [String], { nullable: true })
  @ApiProperty({ description: 'Dependency keys', type: [String], required: false })
  dependencies?: string[];

  @Field()
  @ApiProperty({ description: 'Whether warming is active' })
  isActive!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Last warming timestamp', required: false })
  lastWarmedAt?: Date;

  @Field(() => Int)
  @ApiProperty({ description: 'Warming success count' })
  successCount!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Warming failure count' })
  failureCount!: number;
}

/**
 * API performance metrics type
 */
@ObjectType()
export class APIPerformanceMetrics {
  @Field(() => Float)
  @ApiProperty({ description: 'Average response time in ms' })
  averageResponseTime!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Requests per second' })
  requestsPerSecond!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Cache hit rate percentage' })
  cacheHitRate!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Compression ratio' })
  compressionRatio!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'CDN hit rate percentage' })
  cdnHitRate!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Error rate percentage' })
  errorRate!: number;
}

/**
 * API endpoint metrics type
 */
@ObjectType()
export class APIEndpointMetrics {
  @Field()
  @ApiProperty({ description: 'Endpoint path' })
  endpoint!: string;

  @Field()
  @ApiProperty({ description: 'HTTP method' })
  method!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Average response time in ms' })
  averageResponseTime!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Total request count' })
  requestCount!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Error count' })
  errorCount!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Cache hit rate percentage' })
  cacheHitRate!: number;

  @Field()
  @ApiProperty({ description: 'Last accessed timestamp' })
  lastAccessed!: Date;
}

/**
 * Horizontal scaling metrics type
 */
@ObjectType()
export class HorizontalScalingMetrics {
  @Field(() => Int)
  @ApiProperty({ description: 'Total number of nodes' })
  totalNodes!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Number of healthy nodes' })
  healthyNodes!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Number of unhealthy nodes' })
  unhealthyNodes!: number;

  @Field(() => NodeMetrics)
  @ApiProperty({ description: 'Average node metrics', type: NodeMetrics })
  averageMetrics!: NodeMetrics;

  @Field(() => LoadBalancingConfig)
  @ApiProperty({ description: 'Load balancing configuration', type: LoadBalancingConfig })
  loadBalancing!: LoadBalancingConfig;

  @Field(() => AutoScalingConfig)
  @ApiProperty({ description: 'Auto-scaling configuration', type: AutoScalingConfig })
  autoScaling!: AutoScalingConfig;
}

/**
 * Node metrics type
 */
@ObjectType()
export class NodeMetrics {
  @Field()
  @ApiProperty({ description: 'Node identifier' })
  nodeId!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'CPU usage percentage' })
  cpuUsage!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Memory usage percentage' })
  memoryUsage!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Active connections count' })
  activeConnections!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Requests per second' })
  requestsPerSecond!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Average response time in ms' })
  responseTime!: number;

  @Field()
  @ApiProperty({ description: 'Whether node is healthy' })
  isHealthy!: boolean;

  @Field()
  @ApiProperty({ description: 'Last heartbeat timestamp' })
  lastHeartbeat!: Date;
}

/**
 * Load balancing configuration type
 */
@ObjectType()
export class LoadBalancingConfig {
  @Field(() => LoadBalancingStrategy)
  @ApiProperty({ description: 'Load balancing strategy', enum: LoadBalancingStrategy })
  strategy!: LoadBalancingStrategy;

  @Field(() => Int)
  @ApiProperty({ description: 'Health check interval in ms' })
  healthCheckInterval!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Failover timeout in ms' })
  failoverTimeout!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Maximum retry attempts' })
  maxRetries!: number;
}

/**
 * Auto-scaling configuration type
 */
@ObjectType()
export class AutoScalingConfig {
  @Field(() => Int)
  @ApiProperty({ description: 'Minimum instances' })
  minInstances!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Maximum instances' })
  maxInstances!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Target CPU utilization percentage' })
  targetCpuUtilization!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Target memory utilization percentage' })
  targetMemoryUtilization!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Scale up cooldown in ms' })
  scaleUpCooldown!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Scale down cooldown in ms' })
  scaleDownCooldown!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Metrics window in ms' })
  metricsWindow!: number;
}

/**
 * Cache health status type
 */
@ObjectType()
export class CacheHealthStatus {
  @Field()
  @ApiProperty({ description: 'Whether L1 cache is healthy' })
  l1Cache!: boolean;

  @Field()
  @ApiProperty({ description: 'Whether L2 cache is healthy' })
  l2Cache!: boolean;

  @Field()
  @ApiProperty({ description: 'Whether Redis is healthy' })
  redis!: boolean;

  @Field()
  @ApiProperty({ description: 'Overall health status' })
  overall!: boolean;

  @Field()
  @ApiProperty({ description: 'Health check timestamp' })
  timestamp!: Date;
}

/**
 * Redis connection info type
 */
@ObjectType()
export class RedisConnectionInfo {
  @Field()
  @ApiProperty({ description: 'Whether Redis is healthy' })
  isHealthy!: boolean;

  @Field()
  @ApiProperty({ description: 'Main connection status' })
  mainConnection!: string;

  @Field()
  @ApiProperty({ description: 'Subscriber connection status' })
  subscriberConnection!: string;

  @Field()
  @ApiProperty({ description: 'Publisher connection status' })
  publisherConnection!: string;

  @Field()
  @ApiProperty({ description: 'Memory usage information' })
  memoryInfo!: string;
}

/**
 * Cache optimization result type
 */
@ObjectType()
export class CacheOptimizationResult {
  @Field(() => Int)
  @ApiProperty({ description: 'Number of evicted keys' })
  evictedKeys!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Number of warmed keys' })
  warmedKeys!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Number of optimized hot keys' })
  optimizedHotKeys!: number;

  @Field()
  @ApiProperty({ description: 'Optimization timestamp' })
  timestamp!: Date;
}

/**
 * Session info type
 */
@ObjectType()
export class SessionInfo extends BaseEntity {
  @Field()
  @ApiProperty({ description: 'Session ID' })
  sessionId!: string;

  @Field()
  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @Field()
  @ApiProperty({ description: 'Session data as JSON string' })
  data!: string;

  @Field()
  @ApiProperty({ description: 'Session expiration timestamp' })
  expiresAt!: Date;

  @Field(() => SessionStrategy)
  @ApiProperty({ description: 'Session strategy', enum: SessionStrategy })
  strategy!: SessionStrategy;

  @Field()
  @ApiProperty({ description: 'Whether session is replicated' })
  isReplicated!: boolean;

  @Field()
  @ApiProperty({ description: 'Last activity timestamp' })
  lastActivity!: Date;
}

// Connection types for pagination
@ObjectType()
export class CacheEntryEdge extends Edge<CacheEntry> {
  @Field(() => CacheEntry)
  node!: CacheEntry;
}

@ObjectType()
export class CacheEntryConnection extends Connection<CacheEntry> {
  @Field(() => [CacheEntryEdge])
  edges!: CacheEntryEdge[];
}

@ObjectType()
export class CacheWarmingConfigEdge extends Edge<CacheWarmingConfig> {
  @Field(() => CacheWarmingConfig)
  node!: CacheWarmingConfig;
}

@ObjectType()
export class CacheWarmingConfigConnection extends Connection<CacheWarmingConfig> {
  @Field(() => [CacheWarmingConfigEdge])
  edges!: CacheWarmingConfigEdge[];
}

@ObjectType()
export class SessionInfoEdge extends Edge<SessionInfo> {
  @Field(() => SessionInfo)
  node!: SessionInfo;
}

@ObjectType()
export class SessionInfoConnection extends Connection<SessionInfo> {
  @Field(() => [SessionInfoEdge])
  edges!: SessionInfoEdge[];
}