import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Rate limiting middleware for REST API endpoints
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly requests = new Map<string, { count: number; resetTime: number }>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(private readonly configService: ConfigService) {
    this.windowMs = this.configService.get<number>('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000); // 15 minutes
    this.maxRequests = this.configService.get<number>('RATE_LIMIT_MAX_REQUESTS', 100);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const key = this.getKey(req);
    const now = Date.now();
    
    // Clean up expired entries
    this.cleanup(now);

    // Get or create request tracking
    let requestData = this.requests.get(key);
    
    if (!requestData || now > requestData.resetTime) {
      requestData = {
        count: 0,
        resetTime: now + this.windowMs,
      };
      this.requests.set(key, requestData);
    }

    requestData.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', this.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - requestData.count));
    res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime).toISOString());

    // Check if rate limit exceeded
    if (requestData.count > this.maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString(),
        retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
      });
      return;
    }

    next();
  }

  protected getKey(req: Request): string {
    // Use IP address and user ID (if authenticated) for rate limiting
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    return `${ip}:${userId}`;
  }

  private cleanup(now: number): void {
    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}