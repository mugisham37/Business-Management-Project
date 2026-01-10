import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RateLimitService } from '../services/rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get rate limit configuration from metadata or use defaults
    const rateLimit = this.reflector.get<number>('rateLimit', context.getHandler()) || 1000;
    const windowSeconds = this.reflector.get<number>('rateLimitWindow', context.getHandler()) || 3600;

    // Determine identifier (API key, user ID, or IP)
    let identifier = request.ip;
    let identifierType = 'ip';

    if (request.apiKey) {
      identifier = request.apiKey.id;
      identifierType = 'api_key';
    } else if (request.user) {
      identifier = request.user.id;
      identifierType = 'user';
    }

    // Check rate limit
    const result = await this.rateLimitService.checkRateLimit(
      identifier,
      identifierType,
      rateLimit,
      windowSeconds,
    );

    // Add rate limit headers
    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          error: 'Too Many Requests',
          retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}