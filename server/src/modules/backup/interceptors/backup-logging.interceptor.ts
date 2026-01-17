import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

/**
 * Interceptor for comprehensive backup operation logging
 */
@Injectable()
export class BackupLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(BackupLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const info = ctx.getInfo();
    const args = ctx.getArgs();
    
    const operationName = info.fieldName;
    const operationType = info.operation.operation;
    const user = request.user;
    const tenantId = user?.tenantId;
    const userId = user?.id;
    const requestId = request.headers['x-request-id'] || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';
    const ipAddress = request.ip || request.connection?.remoteAddress || 'unknown';
    
    const startTime = Date.now();
    
    // Log operation start
    this.logger.log(`[${requestId}] ${operationType.toUpperCase()} ${operationName} started`, {
      tenantId,
      userId,
      ipAddress,
      userAgent,
      args: this.sanitizeArgs(args),
    });

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;
        
        // Log successful operation
        this.logger.log(`[${requestId}] ${operationType.toUpperCase()} ${operationName} completed in ${duration}ms`, {
          tenantId,
          userId,
          duration,
          resultType: typeof result,
          success: true,
        });
        
        // Log specific backup operation details
        if (operationName === 'createBackup' && result?.backupId) {
          this.logger.log(`[${requestId}] Backup created with ID: ${result.backupId}`, {
            tenantId,
            backupId: result.backupId,
          });
        }
        
        if (operationName === 'restoreBackup' && result?.restoreJobId) {
          this.logger.log(`[${requestId}] Restore initiated with job ID: ${result.restoreJobId}`, {
            tenantId,
            restoreJobId: result.restoreJobId,
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Log failed operation
        this.logger.error(`[${requestId}] ${operationType.toUpperCase()} ${operationName} failed after ${duration}ms`, {
          tenantId,
          userId,
          duration,
          error: error.message,
          stack: error.stack,
          success: false,
        });
        
        return throwError(() => error);
      }),
    );
  }

  private sanitizeArgs(args: any): any {
    // Remove sensitive information from logs
    const sanitized = { ...args };
    
    // Remove password-like fields
    if (sanitized.input) {
      const input = { ...sanitized.input };
      delete input.password;
      delete input.secret;
      delete input.token;
      sanitized.input = input;
    }
    
    return sanitized;
  }
}

/**
 * Interceptor for backup operation metrics collection
 */
@Injectable()
export class BackupMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(BackupMetricsInterceptor.name);
  private static metrics = new Map<string, {
    count: number;
    totalDuration: number;
    errors: number;
    lastExecution: Date;
  }>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = GqlExecutionContext.create(context);
    const info = ctx.getInfo();
    const request = ctx.getContext().req;
    
    const operationName = info.fieldName;
    const tenantId = request.user?.tenantId || 'unknown';
    const metricKey = `${tenantId}:${operationName}`;
    
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;
        const endMemory = process.memoryUsage();
        
        // Update metrics
        const current = BackupMetricsInterceptor.metrics.get(metricKey) || {
          count: 0,
          totalDuration: 0,
          errors: 0,
          lastExecution: new Date(),
        };
        
        current.count++;
        current.totalDuration += duration;
        current.lastExecution = new Date();
        
        BackupMetricsInterceptor.metrics.set(metricKey, current);
        
        // Log performance metrics
        this.logger.debug(`[METRICS] ${operationName} performance`, {
          tenantId,
          operation: operationName,
          duration,
          memoryDelta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          },
          averageDuration: current.totalDuration / current.count,
          totalExecutions: current.count,
          errorRate: current.errors / current.count,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Update error metrics
        const current = BackupMetricsInterceptor.metrics.get(metricKey) || {
          count: 0,
          totalDuration: 0,
          errors: 0,
          lastExecution: new Date(),
        };
        
        current.count++;
        current.errors++;
        current.totalDuration += duration;
        current.lastExecution = new Date();
        
        BackupMetricsInterceptor.metrics.set(metricKey, current);
        
        return throwError(() => error);
      }),
    );
  }

  /**
   * Get metrics for all operations
   */
  static getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, metrics] of BackupMetricsInterceptor.metrics.entries()) {
      result[key] = {
        ...metrics,
        averageDuration: metrics.totalDuration / metrics.count,
        errorRate: metrics.errors / metrics.count,
      };
    }
    
    return result;
  }

  /**
   * Reset metrics
   */
  static resetMetrics(): void {
    BackupMetricsInterceptor.metrics.clear();
  }
}

/**
 * Interceptor for backup operation caching
 */
@Injectable()
export class BackupCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(BackupCacheInterceptor.name);
  private static cache = new Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
  }>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = GqlExecutionContext.create(context);
    const info = ctx.getInfo();
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    const operationName = info.fieldName;
    const tenantId = request.user?.tenantId || 'unknown';
    
    // Only cache read operations
    if (info.operation.operation !== 'query') {
      return next.handle();
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(tenantId, operationName, args);
    const cached = BackupCacheInterceptor.cache.get(cacheKey);
    
    // Check if cached data is still valid
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.logger.debug(`[CACHE] Cache hit for ${operationName}`, {
        tenantId,
        cacheKey,
        age: Date.now() - cached.timestamp,
      });
      
      return new Observable(subscriber => {
        subscriber.next(cached.data);
        subscriber.complete();
      });
    }

    return next.handle().pipe(
      tap((result) => {
        // Cache the result with appropriate TTL
        const ttl = this.getTTL(operationName);
        
        BackupCacheInterceptor.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          ttl,
        });
        
        this.logger.debug(`[CACHE] Cached result for ${operationName}`, {
          tenantId,
          cacheKey,
          ttl,
        });
      }),
    );
  }

  private generateCacheKey(tenantId: string, operation: string, args: any): string {
    // Create a deterministic cache key
    const argsString = JSON.stringify(args, Object.keys(args).sort());
    const hash = require('crypto').createHash('md5').update(argsString).digest('hex');
    return `${tenantId}:${operation}:${hash}`;
  }

  private getTTL(operation: string): number {
    // Different TTLs for different operations
    const ttlMap: Record<string, number> = {
      backupStatistics: 5 * 60 * 1000, // 5 minutes
      backups: 2 * 60 * 1000, // 2 minutes
      scheduledBackups: 10 * 60 * 1000, // 10 minutes
      recoveryPoints: 15 * 60 * 1000, // 15 minutes
      backupStorageUsage: 30 * 60 * 1000, // 30 minutes
      backupAnalytics: 15 * 60 * 1000, // 15 minutes
    };
    
    return ttlMap[operation] || 5 * 60 * 1000; // Default 5 minutes
  }

  /**
   * Clear cache for a tenant
   */
  static clearTenantCache(tenantId: string): void {
    for (const [key] of BackupCacheInterceptor.cache.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        BackupCacheInterceptor.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  static clearCache(): void {
    BackupCacheInterceptor.cache.clear();
  }
}