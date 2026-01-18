import { InputType, Field, Int, Float } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsEnum, IsBoolean, IsArray, IsDateString } from 'class-validator';
import { CacheStrategy, CachePriority, LoadBalancingStrategy, SessionStrategy } from '../types/cache.types';

/**
 * Cache operation input
 */
@InputType()
export class CacheOperationInput {
  @Field()
  @ApiProperty({ description: 'Cache key' })
  @IsString()
  key!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Cache value as JSON string', required: false })
  @IsOptional()
  @IsString()
  value?: string;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Time to live in seconds', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400) // Max 24 hours
  ttl?: number;

  @Field(() => CacheStrategy, { nullable: true })
  @ApiProperty({ description: 'Cache strategy', enum: CacheStrategy, required: false })
  @IsOptional()
  @IsEnum(CacheStrategy)
  strategy?: CacheStrategy;

  @Field(() => CachePriority, { nullable: true })
  @ApiProperty({ description: 'Cache priority', enum: CachePriority, required: false })
  @IsOptional()
  @IsEnum(CachePriority)
  priority?: CachePriority;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Use L1 cache', required: false })
  @IsOptional()
  @IsBoolean()
  useL1Cache?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Use L2 cache', required: false })
  @IsOptional()
  @IsBoolean()
  useL2Cache?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Use distributed cache', required: false })
  @IsOptional()
  @IsBoolean()
  useDistributed?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Warm cache on miss', required: false })
  @IsOptional()
  @IsBoolean()
  warmOnMiss?: boolean;

  @Field(() => [String], { nullable: true })
  @ApiProperty({ description: 'Cache tags for grouping', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

/**
 * Cache warming configuration input
 */
@InputType()
export class CacheWarmingConfigInput {
  @Field()
  @ApiProperty({ description: 'Cache key to warm' })
  @IsString()
  key!: string;

  @Field(() => Int)
  @ApiProperty({ description: 'Time to live in seconds' })
  @IsInt()
  @Min(60) // Minimum 1 minute
  @Max(86400) // Maximum 24 hours
  ttl!: number;

  @Field(() => CachePriority)
  @ApiProperty({ description: 'Warming priority', enum: CachePriority })
  @IsEnum(CachePriority)
  priority!: CachePriority;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Cron schedule expression', required: false })
  @IsOptional()
  @IsString()
  schedule?: string;

  @Field(() => [String], { nullable: true })
  @ApiProperty({ description: 'Dependency keys', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @Field({ nullable: true })
  @ApiProperty({ description: 'Whether warming is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Cache warming configuration update input
 */
@InputType()
export class UpdateCacheWarmingConfigInput {
  @Field({ nullable: true })
  @ApiProperty({ description: 'Time to live in seconds', required: false })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400)
  ttl?: number;

  @Field(() => CachePriority, { nullable: true })
  @ApiProperty({ description: 'Warming priority', enum: CachePriority, required: false })
  @IsOptional()
  @IsEnum(CachePriority)
  priority?: CachePriority;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Cron schedule expression', required: false })
  @IsOptional()
  @IsString()
  schedule?: string;

  @Field(() => [String], { nullable: true })
  @ApiProperty({ description: 'Dependency keys', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @Field({ nullable: true })
  @ApiProperty({ description: 'Whether warming is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Cache invalidation input
 */
@InputType()
export class CacheInvalidationInput {
  @Field({ nullable: true })
  @ApiProperty({ description: 'Specific cache key to invalidate', required: false })
  @IsOptional()
  @IsString()
  key?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Pattern to match keys for invalidation', required: false })
  @IsOptional()
  @IsString()
  pattern?: string;

  @Field(() => [String], { nullable: true })
  @ApiProperty({ description: 'Cache tags to invalidate', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field({ nullable: true })
  @ApiProperty({ description: 'Invalidate all cache entries', required: false })
  @IsOptional()
  @IsBoolean()
  all?: boolean;
}

/**
 * Load balancing configuration input
 */
@InputType()
export class LoadBalancingConfigInput {
  @Field(() => LoadBalancingStrategy)
  @ApiProperty({ description: 'Load balancing strategy', enum: LoadBalancingStrategy })
  @IsEnum(LoadBalancingStrategy)
  strategy!: LoadBalancingStrategy;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Health check interval in ms', required: false })
  @IsOptional()
  @IsInt()
  @Min(5000) // Minimum 5 seconds
  @Max(300000) // Maximum 5 minutes
  healthCheckInterval?: number;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Failover timeout in ms', required: false })
  @IsOptional()
  @IsInt()
  @Min(1000) // Minimum 1 second
  @Max(30000) // Maximum 30 seconds
  failoverTimeout?: number;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Maximum retry attempts', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxRetries?: number;
}

/**
 * Auto-scaling configuration input
 */
@InputType()
export class AutoScalingConfigInput {
  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Minimum instances', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  minInstances?: number;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Maximum instances', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxInstances?: number;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Target CPU utilization percentage', required: false })
  @IsOptional()
  @Min(10)
  @Max(95)
  targetCpuUtilization?: number;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Target memory utilization percentage', required: false })
  @IsOptional()
  @Min(10)
  @Max(95)
  targetMemoryUtilization?: number;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Scale up cooldown in ms', required: false })
  @IsOptional()
  @IsInt()
  @Min(60000) // Minimum 1 minute
  @Max(3600000) // Maximum 1 hour
  scaleUpCooldown?: number;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Scale down cooldown in ms', required: false })
  @IsOptional()
  @IsInt()
  @Min(60000) // Minimum 1 minute
  @Max(7200000) // Maximum 2 hours
  scaleDownCooldown?: number;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Metrics window in ms', required: false })
  @IsOptional()
  @IsInt()
  @Min(60000) // Minimum 1 minute
  @Max(1800000) // Maximum 30 minutes
  metricsWindow?: number;
}

/**
 * Session management input
 */
@InputType()
export class SessionManagementInput {
  @Field()
  @ApiProperty({ description: 'Session ID' })
  @IsString()
  sessionId!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Session data as JSON string', required: false })
  @IsOptional()
  @IsString()
  data?: string;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Session TTL in seconds', required: false })
  @IsOptional()
  @IsInt()
  @Min(300) // Minimum 5 minutes
  @Max(86400) // Maximum 24 hours
  ttl?: number;

  @Field(() => SessionStrategy, { nullable: true })
  @ApiProperty({ description: 'Session strategy', enum: SessionStrategy, required: false })
  @IsOptional()
  @IsEnum(SessionStrategy)
  strategy?: SessionStrategy;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Enable session replication', required: false })
  @IsOptional()
  @IsBoolean()
  replication?: boolean;
}

/**
 * Distributed cache configuration input
 */
@InputType()
export class DistributedCacheConfigInput {
  @Field(() => [String])
  @ApiProperty({ description: 'Cache node URLs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  nodes!: string[];

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Replication factor', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  replicationFactor?: number;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Consistency level (eventual or strong)', required: false })
  @IsOptional()
  @IsString()
  consistencyLevel?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Partition strategy (hash or range)', required: false })
  @IsOptional()
  @IsString()
  partitionStrategy?: string;
}

/**
 * Cache query filters input
 */
@InputType()
export class CacheQueryFiltersInput {
  @Field({ nullable: true })
  @ApiProperty({ description: 'Filter by key pattern', required: false })
  @IsOptional()
  @IsString()
  keyPattern?: string;

  @Field(() => CacheStrategy, { nullable: true })
  @ApiProperty({ description: 'Filter by cache strategy', enum: CacheStrategy, required: false })
  @IsOptional()
  @IsEnum(CacheStrategy)
  strategy?: CacheStrategy;

  @Field(() => CachePriority, { nullable: true })
  @ApiProperty({ description: 'Filter by cache priority', enum: CachePriority, required: false })
  @IsOptional()
  @IsEnum(CachePriority)
  priority?: CachePriority;

  @Field(() => [String], { nullable: true })
  @ApiProperty({ description: 'Filter by cache tags', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field({ nullable: true })
  @ApiProperty({ description: 'Filter by expiration date (from)', required: false })
  @IsOptional()
  @IsDateString()
  expiresAfter?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Filter by expiration date (to)', required: false })
  @IsOptional()
  @IsDateString()
  expiresBefore?: string;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Minimum access count', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAccessCount?: number;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Maximum access count', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAccessCount?: number;
}

/**
 * Performance optimization input
 */
@InputType()
export class PerformanceOptimizationInput {
  @Field({ nullable: true })
  @ApiProperty({ description: 'Enable compression optimization', required: false })
  @IsOptional()
  @IsBoolean()
  optimizeCompression?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Enable cache optimization', required: false })
  @IsOptional()
  @IsBoolean()
  optimizeCache?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Enable endpoint optimization', required: false })
  @IsOptional()
  @IsBoolean()
  optimizeEndpoints?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Target response time in ms', required: false })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(10000)
  targetResponseTime?: number;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Target hit rate percentage', required: false })
  @IsOptional()
  @Min(0)
  @Max(100)
  targetHitRate?: number;
}

/**
 * Bulk cache operations input
 */
@InputType()
export class BulkCacheOperationInput {
  @Field(() => [CacheOperationInput])
  @ApiProperty({ description: 'List of cache operations', type: [CacheOperationInput] })
  @IsArray()
  operations!: CacheOperationInput[];

  @Field({ nullable: true })
  @ApiProperty({ description: 'Execute operations in transaction', required: false })
  @IsOptional()
  @IsBoolean()
  transactional?: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Continue on error', required: false })
  @IsOptional()
  @IsBoolean()
  continueOnError?: boolean;
}