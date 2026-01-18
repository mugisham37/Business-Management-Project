import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RedisService } from '../redis.service';
import { HorizontalScalingService } from '../horizontal-scaling.service';
import { CustomLoggerService } from '../../logger/logger.service';
import {
  SESSION_REQUIRED_METADATA,
  LOAD_BALANCE_METADATA,
  CACHE_DISTRIBUTED_METADATA,
} from '../decorators/cache.decorators';

/**
 * Cache access guard
 * Validates cache access permissions and session requirements
 */
@Injectable()
export class CacheAccessGuard implements CanActivate {
  private readonly logger = new Logger(CacheAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('CacheAccessGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();
    const handler = context.getHandler();
    const user = ctx.req?.user;

    // Check if session is required
    const sessionConfig = this.reflector.get<any>(SESSION_REQUIRED_METADATA, handler);
    if (sessionConfig) {
      const hasValidSession = await this.validateSession(ctx.req?.sessionID, user?.id);
      if (!hasValidSession) {
        this.customLogger.warn('Invalid or missing session', {
          sessionId: ctx.req?.sessionID,
          userId: user?.id,
        });
        throw new ForbiddenException('Valid session required');
      }
    }

    // Check cache access permissions
    const hasPermission = await this.checkCachePermissions(user);
    if (!hasPermission) {
      this.customLogger.warn('Insufficient cache permissions', {
        userId: user?.id,
        tenantId: user?.tenantId,
      });
      throw new ForbiddenException('Insufficient cache permissions');
    }

    return true;
  }

  private async validateSession(sessionId?: string, userId?: string): Promise<boolean> {
    if (!sessionId || !userId) {
      return false;
    }

    try {
      const sessionData = await this.redisService.get(`session:${sessionId}`);
      if (!sessionData) {
        return false;
      }

      const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
      return session.userId === userId && new Date(session.expiresAt) > new Date();
    } catch (error) {
      this.customLogger.error('Session validation failed', error instanceof Error ? error.stack : undefined, {
        sessionId,
        userId,
      });
      return false;
    }
  }

  private async checkCachePermissions(user?: any): Promise<boolean> {
    if (!user) {
      return false; // Anonymous users cannot access cache operations
    }

    // Check if user has cache management permissions
    const requiredPermissions = ['cache:read', 'cache:write', 'cache:manage'];
    const userPermissions = user.permissions || [];

    // Admin users have all permissions
    if (user.role === 'admin' || user.role === 'super_admin') {
      return true;
    }

    // Check if user has at least read permission
    return requiredPermissions.some(permission => 
      userPermissions.includes(permission) || userPermissions.includes('cache:*')
    );
  }
}

/**
 * Load balancing guard
 * Ensures proper load balancing for cache operations
 */
@Injectable()
export class LoadBalancingGuard implements CanActivate {
  private readonly logger = new Logger(LoadBalancingGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly horizontalScalingService: HorizontalScalingService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('LoadBalancingGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const loadBalanceConfig = this.reflector.get<any>(LOAD_BALANCE_METADATA, handler);

    if (!loadBalanceConfig) {
      return true; // No load balancing required
    }

    try {
      // Get next available node for load balancing
      const targetNode = await this.horizontalScalingService.getNextNode();
      
      if (!targetNode) {
        this.customLogger.error('No available nodes for load balancing');
        throw new ForbiddenException('Service temporarily unavailable');
      }

      // Store target node in context for use by interceptors
      const gqlContext = GqlExecutionContext.create(context);
      const ctx = gqlContext.getContext();
      ctx.targetNode = targetNode;

      this.customLogger.debug('Load balancing node selected', {
        targetNode,
        strategy: loadBalanceConfig.strategy,
      });

      return true;
    } catch (error) {
      this.customLogger.error('Load balancing failed', error instanceof Error ? error.stack : undefined);
      throw new ForbiddenException('Load balancing failed');
    }
  }
}

/**
 * Distributed cache guard
 * Validates distributed cache access and configuration
 */
@Injectable()
export class DistributedCacheGuard implements CanActivate {
  private readonly logger = new Logger(DistributedCacheGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('DistributedCacheGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const distributedConfig = this.reflector.get<any>(CACHE_DISTRIBUTED_METADATA, handler);

    if (!distributedConfig) {
      return true; // No distributed cache required
    }

    try {
      // Check if distributed cache is available
      const isHealthy = await this.redisService.isHealthy();
      if (!isHealthy) {
        this.customLogger.error('Distributed cache is not available');
        throw new ForbiddenException('Distributed cache unavailable');
      }

      // Validate distributed cache configuration
      const isConfigValid = await this.validateDistributedConfig(distributedConfig);
      if (!isConfigValid) {
        this.customLogger.error('Invalid distributed cache configuration', { distributedConfig });
        throw new ForbiddenException('Invalid distributed cache configuration');
      }

      return true;
    } catch (error) {
      this.customLogger.error('Distributed cache validation failed', error instanceof Error ? error.stack : undefined);
      throw new ForbiddenException('Distributed cache validation failed');
    }
  }

  private async validateDistributedConfig(config: any): Promise<boolean> {
    // Validate replication factor
    if (config.replicationFactor && (config.replicationFactor < 1 || config.replicationFactor > 5)) {
      return false;
    }

    // Validate consistency level
    if (config.consistencyLevel && !['eventual', 'strong'].includes(config.consistencyLevel)) {
      return false;
    }

    // Validate partition strategy
    if (config.partitionStrategy && !['hash', 'range'].includes(config.partitionStrategy)) {
      return false;
    }

    return true;
  }
}

/**
 * Cache rate limiting guard
 * Prevents cache abuse by rate limiting operations
 */
@Injectable()
export class CacheRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(CacheRateLimitGuard.name);
  private readonly rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('CacheRateLimitGuard');
    
    // Clean up rate limit map every minute
    setInterval(() => {
      this.cleanupRateLimitMap();
    }, 60000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();
    const user = ctx.req?.user;
    const ipAddress = ctx.req?.ip;

    // Create rate limit key based on user or IP
    const rateLimitKey = user?.id || ipAddress || 'anonymous';
    
    // Check rate limit
    const isAllowed = this.checkRateLimit(rateLimitKey);
    
    if (!isAllowed) {
      this.customLogger.warn('Cache rate limit exceeded', {
        key: rateLimitKey,
        userId: user?.id,
        ipAddress,
      });
      throw new ForbiddenException('Rate limit exceeded for cache operations');
    }

    return true;
  }

  private checkRateLimit(key: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxRequests = 1000; // Max 1000 cache operations per minute

    const current = this.rateLimitMap.get(key);
    
    if (!current || now > current.resetTime) {
      // New window or expired window
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (current.count >= maxRequests) {
      return false; // Rate limit exceeded
    }

    // Increment count
    current.count++;
    return true;
  }

  private cleanupRateLimitMap(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, data] of this.rateLimitMap.entries()) {
      if (now > data.resetTime) {
        this.rateLimitMap.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.customLogger.debug('Rate limit map cleaned', {
        cleanedEntries: cleanedCount,
        remainingEntries: this.rateLimitMap.size,
      });
    }
  }
}

/**
 * Cache health guard
 * Ensures cache system is healthy before allowing operations
 */
@Injectable()
export class CacheHealthGuard implements CanActivate {
  private readonly logger = new Logger(CacheHealthGuard.name);
  private lastHealthCheck = 0;
  private isHealthy = true;
  private readonly healthCheckInterval = 30000; // 30 seconds

  constructor(
    private readonly redisService: RedisService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('CacheHealthGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const now = Date.now();
    
    // Check health periodically
    if (now - this.lastHealthCheck > this.healthCheckInterval) {
      await this.performHealthCheck();
      this.lastHealthCheck = now;
    }

    if (!this.isHealthy) {
      this.customLogger.error('Cache system is unhealthy');
      throw new ForbiddenException('Cache system is currently unavailable');
    }

    return true;
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const redisHealth = await this.redisService.isHealthy();
      this.isHealthy = redisHealth;

      this.customLogger.debug('Cache health check completed', {
        isHealthy: this.isHealthy,
        redisHealth,
      });
    } catch (error) {
      this.isHealthy = false;
      this.customLogger.error('Cache health check failed', error instanceof Error ? error.stack : undefined);
    }
  }
}