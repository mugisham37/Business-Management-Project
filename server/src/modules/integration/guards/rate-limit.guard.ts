import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Logger } from '@nestjs/common';

/**
 * Rate limiting guard for integration endpoints
 * Prevents abuse by limiting requests per time window
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly requestLog = new Map<string, number[]>();
  private readonly maxRequests = 100; // Max requests
  private readonly windowMs = 60000; // Time window in milliseconds (1 minute)

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientId = request.ip || request.headers['x-forwarded-for'] || 'unknown';

    // Get or create request log for this client
    const timestamps = this.requestLog.get(clientId) || [];
    const now = Date.now();

    // Remove timestamps outside the current window
    const recentRequests = timestamps.filter(timestamp => now - timestamp < this.windowMs);

    // Check if limit exceeded
    if (recentRequests.length >= this.maxRequests) {
      const oldestTimestamp = recentRequests[0];
      const retryAfter = oldestTimestamp 
        ? Math.ceil((this.windowMs - (now - oldestTimestamp)) / 1000)
        : 60;
        
      this.logger.warn(
        `Rate limit exceeded for client ${clientId}: ${recentRequests.length}/${this.maxRequests} requests`
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Add current request timestamp
    recentRequests.push(now);
    this.requestLog.set(clientId, recentRequests);

    return true;
  }
}
