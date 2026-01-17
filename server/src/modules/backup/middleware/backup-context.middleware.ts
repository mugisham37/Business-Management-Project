import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to enhance backup requests with additional context
 */
@Injectable()
export class BackupContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Add backup-specific context to the request
    (req as any).backupContext = {
      requestId: req.headers['x-request-id'] || this.generateRequestId(),
      timestamp: new Date(),
      userAgent: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      origin: req.headers.origin || 'unknown',
      referer: req.headers.referer || 'unknown',
    };

    // Add backup operation tracking
    (req as any).backupTracking = {
      operationStart: Date.now(),
      memoryStart: process.memoryUsage(),
    };

    // Set response headers for backup operations
    res.setHeader('X-Backup-Request-ID', (req as any).backupContext.requestId);
    res.setHeader('X-Backup-Timestamp', (req as any).backupContext.timestamp.toISOString());

    next();
  }

  private generateRequestId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Middleware for backup operation rate limiting
 */
@Injectable()
export class BackupRateLimitMiddleware implements NestMiddleware {
  private static requestCounts = new Map<string, {
    count: number;
    resetTime: number;
    operations: string[];
  }>();

  use(req: Request, res: Response, next: NextFunction) {
    const clientId = this.getClientId(req);
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 100; // Max requests per window

    const current = BackupRateLimitMiddleware.requestCounts.get(clientId);

    if (!current || now > current.resetTime) {
      // Reset or initialize counter
      BackupRateLimitMiddleware.requestCounts.set(clientId, {
        count: 1,
        resetTime: now + windowMs,
        operations: [req.path],
      });
    } else if (current.count >= maxRequests) {
      // Rate limit exceeded
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${maxRequests} per minute`,
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
      });
      return;
    } else {
      // Increment counter
      current.count++;
      current.operations.push(req.path);
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - (current?.count || 1)).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil((current?.resetTime || now + windowMs) / 1000).toString());

    next();
  }

  private getClientId(req: Request): string {
    // Use user ID if authenticated, otherwise use IP
    const user = (req as any).user;
    return user?.id || req.ip || 'anonymous';
  }
}

/**
 * Middleware for backup security headers
 */
@Injectable()
export class BackupSecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Add security headers for backup operations
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Add backup-specific security headers
    res.setHeader('X-Backup-Security-Version', '1.0');
    res.setHeader('X-Backup-Encryption-Required', 'true');
    
    // Remove sensitive headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  }
}

/**
 * Middleware for backup request validation
 */
@Injectable()
export class BackupValidationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Validate backup-specific request patterns
    if (req.path.includes('/backup') || req.path.includes('/restore')) {
      // Check for required headers
      if (!req.headers['content-type']?.includes('application/json') && req.method !== 'GET') {
        res.status(400).json({
          error: 'Invalid content type',
          message: 'Backup operations require application/json content type',
        });
        return;
      }

      // Validate request size for backup operations
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      const maxSize = 10 * 1024 * 1024; // 10MB max request size
      
      if (contentLength > maxSize) {
        res.status(413).json({
          error: 'Request too large',
          message: `Request size exceeds maximum allowed size of ${maxSize} bytes`,
        });
        return;
      }

      // Add validation context
      (req as any).backupValidation = {
        contentLength,
        maxSize,
        validated: true,
        validatedAt: new Date(),
      };
    }

    next();
  }
}

/**
 * Middleware for backup audit logging
 */
@Injectable()
export class BackupAuditMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const originalSend = res.send;

    // Override response send to capture response data
    res.send = function(data: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log audit information
      const auditLog = {
        requestId: (req as any).backupContext?.requestId || 'unknown',
        method: req.method,
        path: req.path,
        query: req.query,
        user: (req as any).user?.id || 'anonymous',
        tenantId: (req as any).user?.tenantId || 'unknown',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        statusCode: res.statusCode,
        duration,
        timestamp: new Date().toISOString(),
        responseSize: Buffer.byteLength(data || ''),
      };

      // In a real implementation, you'd send this to an audit service
      console.log('[BACKUP_AUDIT]', JSON.stringify(auditLog));

      return originalSend.call(this, data);
    };

    next();
  }
}

/**
 * Middleware for backup performance monitoring
 */
@Injectable()
export class BackupPerformanceMiddleware implements NestMiddleware {
  private static performanceMetrics = new Map<string, {
    totalRequests: number;
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    errorCount: number;
    lastUpdated: Date;
  }>();

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    const endpoint = `${req.method} ${req.path}`;

    const originalSend = res.send;
    res.send = function(data: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const endMemory = process.memoryUsage();

      // Update performance metrics
      const current = BackupPerformanceMiddleware.performanceMetrics.get(endpoint) || {
        totalRequests: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        errorCount: 0,
        lastUpdated: new Date(),
      };

      current.totalRequests++;
      current.totalDuration += duration;
      current.averageDuration = current.totalDuration / current.totalRequests;
      current.minDuration = Math.min(current.minDuration, duration);
      current.maxDuration = Math.max(current.maxDuration, duration);
      current.lastUpdated = new Date();

      if (res.statusCode >= 400) {
        current.errorCount++;
      }

      BackupPerformanceMiddleware.performanceMetrics.set(endpoint, current);

      // Log performance data
      const performanceData = {
        endpoint,
        duration,
        statusCode: res.statusCode,
        memoryDelta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        },
        metrics: current,
        timestamp: new Date().toISOString(),
      };

      console.log('[BACKUP_PERFORMANCE]', JSON.stringify(performanceData));

      return originalSend.call(this, data);
    };

    next();
  }

  /**
   * Get performance metrics for all endpoints
   */
  static getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [endpoint, metrics] of BackupPerformanceMiddleware.performanceMetrics.entries()) {
      result[endpoint] = {
        ...metrics,
        errorRate: metrics.errorCount / metrics.totalRequests,
      };
    }
    
    return result;
  }

  /**
   * Reset performance metrics
   */
  static resetMetrics(): void {
    BackupPerformanceMiddleware.performanceMetrics.clear();
  }
}