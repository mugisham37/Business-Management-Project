import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { IntelligentCacheService } from '../intelligent-cache.service';
import { AdvancedCacheService } from '../advanced-cache.service';
import { APIPerformanceService } from '../api-performance.service';
import { CustomLoggerService } from '../../logger/logger.service';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
  CACHE_STRATEGY_METADATA,
  CACHE_PRIORITY_METADATA,
  CACHE_TAGS_METADATA,
  CACHE_INVALIDATE_METADATA,
  PERFORMANCE_MONITOR_METADATA,
  CACHE_COMPRESSION_METADATA,
} from '../decorators/cache.decorators';
import { CacheStrategy, CachePriority } from '../types/cache.types';

/**
 * Cache interceptor for GraphQL resolvers
 * Handles caching, performance monitoring, and optimization
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly intelligentCache: IntelligentCacheService,
    private readonly advancedCache: AdvancedCacheService,
    private readonly performanceService: APIPerformanceService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('CacheInterceptor');
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const args = gqlContext.getArgs();
    const ctx = gqlContext.getContext();
    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;

    // Get cache metadata
    const cacheKey = this.reflector.get<string>(CACHE_KEY_METADATA, handler);
    const cacheTtl = this.reflector.get<number>(CACHE_TTL_METADATA, handler);
    const cacheStrategy = this.reflector.get<CacheStrategy>(CACHE_STRATEGY_METADATA, handler);
    const cachePriority = this.reflector.get<CachePriority>(CACHE_PRIORITY_METADATA, handler);
    const cacheTags = this.reflector.get<string[]>(CACHE_TAGS_METADATA, handler);
    const invalidateConfig = this.reflector.get<any>(CACHE_INVALIDATE_METADATA, handler);
    const performanceConfig = this.reflector.get<any>(PERFORMANCE_MONITOR_METADATA, handler);
    const compressionConfig = this.reflector.get<any>(CACHE_COMPRESSION_METADATA, handler);

    // Get additional cache options
    const useL1 = this.reflector.get<boolean>('cache:useL1', handler) ?? true;
    const useL2 = this.reflector.get<boolean>('cache:useL2', handler) ?? true;
    const useDistributed = this.reflector.get<boolean>('cache:useDistributed', handler) ?? false;
    const warmOnMiss = this.reflector.get<boolean>('cache:warmOnMiss', handler) ?? true;

    const startTime = Date.now();
    const tenantId = ctx.req?.user?.tenantId;
    const userId = ctx.req?.user?.id;

    // Build cache key if caching is enabled
    let finalCacheKey: string | null = null;
    if (cacheKey) {
      finalCacheKey = this.buildCacheKey(cacheKey, args, tenantId, userId, className, methodName);
    }

    // Handle cache invalidation for mutations
    if (invalidateConfig && this.isMutation(info)) {
      await this.handleCacheInvalidation(invalidateConfig, tenantId);
    }

    // Try to get from cache for queries
    if (finalCacheKey && this.isQuery(info)) {
      try {
        const cachedResult = await this.getCachedResult(
          finalCacheKey,
          cacheStrategy,
          tenantId,
          useL1,
          useL2,
          useDistributed,
        );

        if (cachedResult !== null) {
          const responseTime = Date.now() - startTime;
          
          // Log cache hit
          this.customLogger.debug('Cache hit', {
            key: finalCacheKey,
            strategy: cacheStrategy,
            responseTime,
            tenantId,
            userId,
          });

          // Track performance metrics
          if (performanceConfig) {
            await this.trackPerformanceMetrics(
              ctx.req,
              responseTime,
              true, // cache hit
              false, // no error
            );
          }

          return of(cachedResult);
        }
      } catch (error) {
        this.customLogger.error('Cache retrieval failed', error instanceof Error ? error.stack : undefined, {
          key: finalCacheKey,
          tenantId,
        });
      }
    }

    // Execute the resolver
    return next.handle().pipe(
      tap(async (result) => {
        const responseTime = Date.now() - startTime;

        // Cache the result for queries
        if (finalCacheKey && this.isQuery(info) && result !== null && result !== undefined) {
          try {
            await this.setCachedResult(
              finalCacheKey,
              result,
              cacheTtl || 300,
              cacheStrategy,
              cachePriority,
              cacheTags,
              tenantId,
              useL1,
              useL2,
              useDistributed,
              warmOnMiss,
            );

            this.customLogger.debug('Result cached', {
              key: finalCacheKey,
              ttl: cacheTtl,
              strategy: cacheStrategy,
              priority: cachePriority,
              tenantId,
            });
          } catch (error) {
            this.customLogger.error('Cache storage failed', error instanceof Error ? error.stack : undefined, {
              key: finalCacheKey,
              tenantId,
            });
          }
        }

        // Apply compression if enabled
        if (compressionConfig?.enabled && ctx.res) {
          try {
            const optimizedResult = await this.performanceService.optimizeResponse(
              ctx.req,
              ctx.res,
              result,
              {
                compress: true,
                cacheable: !!finalCacheKey,
                ttl: cacheTtl,
                tenantId,
              },
            );
            
            // Update result with optimized version if different
            if (optimizedResult !== result) {
              return optimizedResult;
            }
          } catch (error) {
            this.customLogger.error('Response optimization failed', error instanceof Error ? error.stack : undefined);
          }
        }

        // Track performance metrics
        if (performanceConfig) {
          await this.trackPerformanceMetrics(
            ctx.req,
            responseTime,
            false, // cache miss
            false, // no error
          );
        }

        this.customLogger.debug('Resolver executed', {
          resolver: `${className}.${methodName}`,
          responseTime,
          cached: !!finalCacheKey,
          tenantId,
        });
      }),
      catchError(async (error) => {
        const responseTime = Date.now() - startTime;

        // Track error metrics
        if (performanceConfig) {
          await this.trackPerformanceMetrics(
            ctx.req,
            responseTime,
            false, // cache miss
            true, // error occurred
          );
        }

        this.customLogger.error('Resolver error', error instanceof Error ? error.stack : undefined, {
          resolver: `${className}.${methodName}`,
          responseTime,
          tenantId,
        });

        throw error;
      }),
    );
  }

  private buildCacheKey(
    template: string,
    args: any,
    tenantId?: string,
    userId?: string,
    className?: string,
    methodName?: string,
  ): string {
    let key = template;

    // Replace placeholders
    key = key.replace(/\{tenantId\}/g, tenantId || 'global');
    key = key.replace(/\{userId\}/g, userId || 'anonymous');
    key = key.replace(/\{className\}/g, className || 'unknown');
    key = key.replace(/\{methodName\}/g, methodName || 'unknown');

    // Replace argument placeholders
    if (args) {
      Object.keys(args).forEach(argKey => {
        const placeholder = new RegExp(`\\{${argKey}\\}`, 'g');
        const value = typeof args[argKey] === 'object' 
          ? JSON.stringify(args[argKey]) 
          : String(args[argKey]);
        key = key.replace(placeholder, value);
      });
    }

    return key;
  }

  private async getCachedResult(
    key: string,
    strategy?: CacheStrategy,
    tenantId?: string,
    useL1?: boolean,
    useL2?: boolean,
    useDistributed?: boolean,
  ): Promise<any> {
    switch (strategy) {
      case CacheStrategy.L1_ONLY:
        return this.intelligentCache.get(key, { tenantId, useL1Cache: true, useL2Cache: false });
      
      case CacheStrategy.L2_ONLY:
        return this.intelligentCache.get(key, { tenantId, useL1Cache: false, useL2Cache: true });
      
      case CacheStrategy.DISTRIBUTED:
        return this.advancedCache.get(key, { tenantId, useDistributed: true });
      
      case CacheStrategy.INTELLIGENT:
      case CacheStrategy.MULTI_LEVEL:
      default:
        return this.advancedCache.get(key, {
          tenantId,
          useDistributed,
        });
    }
  }

  private async setCachedResult(
    key: string,
    result: any,
    ttl: number,
    strategy?: CacheStrategy,
    priority?: CachePriority,
    tags?: string[],
    tenantId?: string,
    useL1?: boolean,
    useL2?: boolean,
    useDistributed?: boolean,
    warmOnMiss?: boolean,
  ): Promise<void> {
    const options = {
      tenantId,
      ttl,
      priority,
      useDistributed,
      warmOnMiss,
    };

    switch (strategy) {
      case CacheStrategy.L1_ONLY:
        await this.intelligentCache.set(key, result, { 
          ...options, 
          useL1Cache: true, 
          useL2Cache: false 
        });
        break;
      
      case CacheStrategy.L2_ONLY:
        await this.intelligentCache.set(key, result, { 
          ...options, 
          useL1Cache: false, 
          useL2Cache: true 
        });
        break;
      
      case CacheStrategy.DISTRIBUTED:
        await this.advancedCache.set(key, result, { 
          ...options, 
          useDistributed: true 
        });
        break;
      
      case CacheStrategy.INTELLIGENT:
      case CacheStrategy.MULTI_LEVEL:
      default:
        await this.advancedCache.set(key, result, options);
        break;
    }
  }

  private async handleCacheInvalidation(
    config: any,
    tenantId?: string,
  ): Promise<void> {
    try {
      if (config.all) {
        // Invalidate all cache entries
        await this.intelligentCache.invalidatePattern('*', { tenantId });
        return;
      }

      if (config.keys && config.keys.length > 0) {
        // Invalidate specific keys
        for (const key of config.keys) {
          await this.intelligentCache.del(key, { tenantId });
        }
      }

      if (config.patterns && config.patterns.length > 0) {
        // Invalidate by patterns
        for (const pattern of config.patterns) {
          await this.intelligentCache.invalidatePattern(pattern, { tenantId });
        }
      }

      if (config.tags && config.tags.length > 0) {
        // Invalidate by tags
        for (const tag of config.tags) {
          await this.intelligentCache.invalidatePattern(`*:tag:${tag}:*`, { tenantId });
        }
      }

      this.customLogger.debug('Cache invalidation completed', {
        config,
        tenantId,
      });
    } catch (error) {
      this.customLogger.error('Cache invalidation failed', error instanceof Error ? error.stack : undefined, {
        config,
        tenantId,
      });
    }
  }

  private async trackPerformanceMetrics(
    request: any,
    responseTime: number,
    isCacheHit: boolean,
    isError: boolean,
  ): Promise<void> {
    try {
      const endpoint = `${request.method || 'POST'} ${request.route?.path || request.url || '/graphql'}`;
      
      // This would integrate with the performance service
      // For now, just log the metrics
      this.customLogger.debug('Performance metrics', {
        endpoint,
        responseTime,
        isCacheHit,
        isError,
        timestamp: new Date(),
      });
    } catch (error) {
      this.customLogger.error('Performance tracking failed', error instanceof Error ? error.stack : undefined);
    }
  }

  private isQuery(info: any): boolean {
    return info.operation?.operation === 'query';
  }

  private isMutation(info: any): boolean {
    return info.operation?.operation === 'mutation';
  }
}