import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CacheStrategy, CachePriority } from '../types/cache.types';

// Metadata keys for cache decorators
export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';
export const CACHE_STRATEGY_METADATA = 'cache:strategy';
export const CACHE_PRIORITY_METADATA = 'cache:priority';
export const CACHE_TAGS_METADATA = 'cache:tags';
export const CACHE_INVALIDATE_METADATA = 'cache:invalidate';
export const CACHE_WARM_METADATA = 'cache:warm';
export const CACHE_DISTRIBUTED_METADATA = 'cache:distributed';
export const CACHE_COMPRESSION_METADATA = 'cache:compression';
export const PERFORMANCE_MONITOR_METADATA = 'performance:monitor';
export const LOAD_BALANCE_METADATA = 'load:balance';
export const SESSION_REQUIRED_METADATA = 'session:required';

/**
 * Cache decorator for GraphQL resolvers
 * Automatically caches resolver results based on configuration
 */
export const Cache = (options: {
  key?: string;
  ttl?: number;
  strategy?: CacheStrategy;
  priority?: CachePriority;
  tags?: string[];
  useL1?: boolean;
  useL2?: boolean;
  useDistributed?: boolean;
  warmOnMiss?: boolean;
}) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY_METADATA, options.key || `${target.constructor.name}:${propertyKey}`)(target, propertyKey, descriptor);
    SetMetadata(CACHE_TTL_METADATA, options.ttl || 300)(target, propertyKey, descriptor);
    SetMetadata(CACHE_STRATEGY_METADATA, options.strategy || CacheStrategy.INTELLIGENT)(target, propertyKey, descriptor);
    SetMetadata(CACHE_PRIORITY_METADATA, options.priority || CachePriority.MEDIUM)(target, propertyKey, descriptor);
    SetMetadata(CACHE_TAGS_METADATA, options.tags || [])(target, propertyKey, descriptor);
    
    // Store additional options
    SetMetadata('cache:useL1', options.useL1 ?? true)(target, propertyKey, descriptor);
    SetMetadata('cache:useL2', options.useL2 ?? true)(target, propertyKey, descriptor);
    SetMetadata('cache:useDistributed', options.useDistributed ?? false)(target, propertyKey, descriptor);
    SetMetadata('cache:warmOnMiss', options.warmOnMiss ?? true)(target, propertyKey, descriptor);
    
    return descriptor;
  };
};

/**
 * Cache invalidation decorator
 * Automatically invalidates cache entries when mutation is executed
 */
export const CacheInvalidate = (options: {
  keys?: string[];
  patterns?: string[];
  tags?: string[];
  all?: boolean;
}) => {
  return SetMetadata(CACHE_INVALIDATE_METADATA, options);
};

/**
 * Cache warming decorator
 * Marks resolver for cache warming
 */
export const CacheWarm = (options: {
  priority?: CachePriority;
  schedule?: string;
  dependencies?: string[];
}) => {
  return SetMetadata(CACHE_WARM_METADATA, options);
};

/**
 * Distributed cache decorator
 * Enables distributed caching for resolver
 */
export const DistributedCache = (options: {
  replicationFactor?: number;
  consistencyLevel?: 'eventual' | 'strong';
  partitionStrategy?: 'hash' | 'range';
}) => {
  return SetMetadata(CACHE_DISTRIBUTED_METADATA, options);
};

/**
 * Compression decorator
 * Enables response compression for resolver
 */
export const Compression = (options: {
  enabled?: boolean;
  threshold?: number;
  level?: number;
  algorithms?: string[];
}) => {
  return SetMetadata(CACHE_COMPRESSION_METADATA, options);
};

/**
 * Performance monitoring decorator
 * Enables performance monitoring for resolver
 */
export const PerformanceMonitor = (options: {
  trackResponseTime?: boolean;
  trackCacheHits?: boolean;
  trackErrors?: boolean;
  alertThreshold?: number;
}) => {
  return SetMetadata(PERFORMANCE_MONITOR_METADATA, options);
};

/**
 * Load balancing decorator
 * Enables load balancing for resolver
 */
export const LoadBalance = (options: {
  strategy?: string;
  weights?: Record<string, number>;
  healthCheck?: boolean;
}) => {
  return SetMetadata(LOAD_BALANCE_METADATA, options);
};

/**
 * Session required decorator
 * Requires valid session for resolver access
 */
export const SessionRequired = (options: {
  strategy?: string;
  ttl?: number;
  replication?: boolean;
}) => {
  return SetMetadata(SESSION_REQUIRED_METADATA, options);
};

/**
 * Cache key parameter decorator
 * Extracts cache key from GraphQL context
 */
export const CacheKey = createParamDecorator(
  (keyTemplate: string, ctx: ExecutionContext) => {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const args = gqlCtx.getArgs();
    const context = gqlCtx.getContext();
    const info = gqlCtx.getInfo();
    
    // Build cache key from template and context
    let cacheKey = keyTemplate;
    
    // Replace placeholders with actual values
    cacheKey = cacheKey.replace(/\{tenantId\}/g, context.req?.user?.tenantId || 'global');
    cacheKey = cacheKey.replace(/\{userId\}/g, context.req?.user?.id || 'anonymous');
    cacheKey = cacheKey.replace(/\{resolver\}/g, info.fieldName);
    cacheKey = cacheKey.replace(/\{parent\}/g, info.parentType.name);
    
    // Replace argument placeholders
    Object.keys(args).forEach(argKey => {
      const placeholder = new RegExp(`\\{${argKey}\\}`, 'g');
      cacheKey = cacheKey.replace(placeholder, String(args[argKey]));
    });
    
    return cacheKey;
  },
);

/**
 * Cache tags parameter decorator
 * Extracts cache tags from GraphQL context
 */
export const CacheTags = createParamDecorator(
  (tagTemplate: string[], ctx: ExecutionContext) => {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const args = gqlCtx.getArgs();
    const context = gqlCtx.getContext();
    
    const tags = tagTemplate.map(template => {
      let tag = template;
      tag = tag.replace(/\{tenantId\}/g, context.req?.user?.tenantId || 'global');
      tag = tag.replace(/\{userId\}/g, context.req?.user?.id || 'anonymous');
      
      // Replace argument placeholders
      Object.keys(args).forEach(argKey => {
        const placeholder = new RegExp(`\\{${argKey}\\}`, 'g');
        tag = tag.replace(placeholder, String(args[argKey]));
      });
      
      return tag;
    });
    
    return tags;
  },
);

/**
 * Performance metrics parameter decorator
 * Extracts performance metrics from context
 */
export const PerformanceMetrics = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const context = gqlCtx.getContext();
    
    return {
      startTime: Date.now(),
      requestId: context.req?.id || 'unknown',
      userAgent: context.req?.headers['user-agent'],
      ipAddress: context.req?.ip,
      tenantId: context.req?.user?.tenantId,
      userId: context.req?.user?.id,
    };
  },
);

/**
 * Node info parameter decorator
 * Extracts current node information
 */
export const NodeInfo = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const hostname = require('os').hostname();
    const pid = process.pid;
    
    return {
      nodeId: `${hostname}-${pid}`,
      hostname,
      pid,
      timestamp: new Date(),
    };
  },
);

/**
 * Session info parameter decorator
 * Extracts session information from context
 */
export const SessionInfo = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const context = gqlCtx.getContext();
    
    return {
      sessionId: context.req?.sessionID,
      userId: context.req?.user?.id,
      tenantId: context.req?.user?.tenantId,
      isAuthenticated: !!context.req?.user,
      lastActivity: new Date(),
    };
  },
);

/**
 * Cache context parameter decorator
 * Provides complete cache context information
 */
export const CacheContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const args = gqlCtx.getArgs();
    const context = gqlCtx.getContext();
    const info = gqlCtx.getInfo();
    
    return {
      tenantId: context.req?.user?.tenantId,
      userId: context.req?.user?.id,
      sessionId: context.req?.sessionID,
      resolver: info.fieldName,
      parentType: info.parentType.name,
      args,
      requestId: context.req?.id,
      timestamp: new Date(),
    };
  },
);

/**
 * Distributed context parameter decorator
 * Provides distributed system context
 */
export const DistributedContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const hostname = require('os').hostname();
    const pid = process.pid;
    
    return {
      nodeId: `${hostname}-${pid}`,
      hostname,
      pid,
      region: process.env.AWS_REGION || 'local',
      zone: process.env.AVAILABILITY_ZONE || 'local',
      cluster: process.env.CLUSTER_NAME || 'default',
      timestamp: new Date(),
    };
  },
);

/**
 * Composite decorator for full cache functionality
 * Combines multiple cache-related decorators
 */
export const FullCache = (options: {
  key?: string;
  ttl?: number;
  strategy?: CacheStrategy;
  priority?: CachePriority;
  tags?: string[];
  useL1?: boolean;
  useL2?: boolean;
  useDistributed?: boolean;
  warmOnMiss?: boolean;
  compression?: boolean;
  monitoring?: boolean;
  loadBalance?: boolean;
  sessionRequired?: boolean;
}) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // Apply cache decorator
    Cache({
      key: options.key,
      ttl: options.ttl,
      strategy: options.strategy,
      priority: options.priority,
      tags: options.tags,
      useL1: options.useL1,
      useL2: options.useL2,
      useDistributed: options.useDistributed,
      warmOnMiss: options.warmOnMiss,
    })(target, propertyKey, descriptor);
    
    // Apply compression if enabled
    if (options.compression) {
      Compression({ enabled: true })(target, propertyKey, descriptor);
    }
    
    // Apply performance monitoring if enabled
    if (options.monitoring) {
      PerformanceMonitor({ 
        trackResponseTime: true,
        trackCacheHits: true,
        trackErrors: true,
      })(target, propertyKey, descriptor);
    }
    
    // Apply load balancing if enabled
    if (options.loadBalance) {
      LoadBalance({ 
        strategy: 'round-robin',
        healthCheck: true,
      })(target, propertyKey, descriptor);
    }
    
    // Apply session requirement if enabled
    if (options.sessionRequired) {
      SessionRequired({ 
        strategy: 'distributed',
        replication: true,
      })(target, propertyKey, descriptor);
    }
    
    return descriptor;
  };
};