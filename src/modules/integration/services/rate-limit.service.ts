import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  currentCount: number;
}

interface RateLimitConfig {
  windowSizeMs: number;
  maxRequests: number;
  keyGenerator?: (identifier: string, type: string) => string;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Check rate limit for a given identifier
   */
  async checkRateLimit(
    identifier: string,
    type: string,
    limit: number,
    windowSeconds: number = 3600,
  ): Promise<RateLimitResult> {
    const windowMs = windowSeconds * 1000;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = new Date(windowStart + windowMs);

    const key = this.generateKey(identifier, type, windowStart);

    try {
      // Get current count from cache
      let currentCount = await this.cacheService.get<number>(key) || 0;

      // Check if limit exceeded
      if (currentCount >= limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetAt,
          currentCount,
        };
      }

      // Increment counter
      currentCount++;
      await this.cacheService.set(key, currentCount, windowSeconds);

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - currentCount),
        resetAt,
        currentCount,
      };

    } catch (error) {
      this.logger.error(`Rate limit check failed for ${identifier}:`, error);
      
      // On error, allow the request but log the issue
      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        resetAt,
        currentCount: 1,
      };
    }
  }

  /**
   * Check multiple rate limits (e.g., per-key, per-tenant, global)
   */
  async checkMultipleRateLimits(
    checks: Array<{
      identifier: string;
      type: string;
      limit: number;
      windowSeconds?: number;
    }>,
  ): Promise<RateLimitResult[]> {
    const results = await Promise.all(
      checks.map(check =>
        this.checkRateLimit(
          check.identifier,
          check.type,
          check.limit,
          check.windowSeconds,
        )
      )
    );

    return results;
  }

  /**
   * Get usage statistics for an identifier
   */
  async getUsageStats(
    identifier: string,
    type: string,
    windowSeconds: number = 3600,
  ): Promise<{
    currentCount: number;
    resetAt: Date;
    windowStart: Date;
  }> {
    const windowMs = windowSeconds * 1000;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = new Date(windowStart + windowMs);

    const key = this.generateKey(identifier, type, windowStart);
    const currentCount = await this.cacheService.get<number>(key) || 0;

    return {
      currentCount,
      resetAt,
      windowStart: new Date(windowStart),
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  async resetRateLimit(
    identifier: string,
    type: string,
    windowSeconds: number = 3600,
  ): Promise<void> {
    const windowMs = windowSeconds * 1000;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;

    const key = this.generateKey(identifier, type, windowStart);
    await this.cacheService.del(key);

    this.logger.log(`Rate limit reset for ${type}:${identifier}`);
  }

  /**
   * Sliding window rate limiter (more accurate but more complex)
   */
  async checkSlidingWindowRateLimit(
    identifier: string,
    type: string,
    limit: number,
    windowSeconds: number = 3600,
  ): Promise<RateLimitResult> {
    const windowMs = windowSeconds * 1000;
    const now = Date.now();
    const windowStart = now - windowMs;

    const key = `sliding:${type}:${identifier}`;

    try {
      // Get request timestamps from the sliding window
      const requests = await this.cacheService.get<number[]>(key) || [];
      
      // Remove requests outside the current window
      const validRequests = requests.filter(timestamp => timestamp > windowStart);

      // Check if limit exceeded
      if (validRequests.length >= limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetAt: new Date(validRequests[0] + windowMs),
          currentCount: validRequests.length,
        };
      }

      // Add current request timestamp
      validRequests.push(now);

      // Store updated timestamps
      await this.cacheService.set(key, validRequests, windowSeconds);

      // Calculate when the oldest request will expire
      const oldestRequest = validRequests[0];
      const resetAt = new Date(oldestRequest + windowMs);

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - validRequests.length),
        resetAt,
        currentCount: validRequests.length,
      };

    } catch (error) {
      this.logger.error(`Sliding window rate limit check failed for ${identifier}:`, error);
      
      // On error, allow the request
      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        resetAt: new Date(now + windowMs),
        currentCount: 1,
      };
    }
  }

  /**
   * Token bucket rate limiter (allows bursts)
   */
  async checkTokenBucketRateLimit(
    identifier: string,
    type: string,
    capacity: number,
    refillRate: number, // tokens per second
    tokensRequested: number = 1,
  ): Promise<RateLimitResult & { tokensAvailable: number }> {
    const key = `bucket:${type}:${identifier}`;
    const now = Date.now();

    try {
      // Get current bucket state
      const bucketData = await this.cacheService.get<{
        tokens: number;
        lastRefill: number;
      }>(key) || {
        tokens: capacity,
        lastRefill: now,
      };

      // Calculate tokens to add based on time elapsed
      const timeElapsed = (now - bucketData.lastRefill) / 1000; // seconds
      const tokensToAdd = Math.floor(timeElapsed * refillRate);
      const newTokens = Math.min(capacity, bucketData.tokens + tokensToAdd);

      // Check if enough tokens available
      if (newTokens < tokensRequested) {
        // Update bucket state without consuming tokens
        await this.cacheService.set(key, {
          tokens: newTokens,
          lastRefill: now,
        }, 3600); // 1 hour TTL

        return {
          allowed: false,
          limit: capacity,
          remaining: newTokens,
          resetAt: new Date(now + ((tokensRequested - newTokens) / refillRate) * 1000),
          currentCount: capacity - newTokens,
          tokensAvailable: newTokens,
        };
      }

      // Consume tokens
      const remainingTokens = newTokens - tokensRequested;

      // Update bucket state
      await this.cacheService.set(key, {
        tokens: remainingTokens,
        lastRefill: now,
      }, 3600);

      return {
        allowed: true,
        limit: capacity,
        remaining: remainingTokens,
        resetAt: new Date(now + ((capacity - remainingTokens) / refillRate) * 1000),
        currentCount: capacity - remainingTokens,
        tokensAvailable: remainingTokens,
      };

    } catch (error) {
      this.logger.error(`Token bucket rate limit check failed for ${identifier}:`, error);
      
      return {
        allowed: true,
        limit: capacity,
        remaining: capacity - 1,
        resetAt: new Date(now + 1000),
        currentCount: 1,
        tokensAvailable: capacity - 1,
      };
    }
  }

  /**
   * Distributed rate limiter using Redis Lua script for atomicity
   */
  async checkDistributedRateLimit(
    identifier: string,
    type: string,
    limit: number,
    windowSeconds: number = 3600,
  ): Promise<RateLimitResult> {
    // This would use a Redis Lua script for atomic operations
    // For now, fall back to the basic implementation
    return this.checkRateLimit(identifier, type, limit, windowSeconds);
  }

  /**
   * Get rate limit statistics for monitoring
   */
  async getRateLimitStats(
    type: string,
    timeRange: 'hour' | 'day' | 'week' = 'hour',
  ): Promise<{
    totalRequests: number;
    blockedRequests: number;
    topIdentifiers: Array<{ identifier: string; requests: number }>;
  }> {
    // This would aggregate statistics from cache/database
    // Implementation depends on monitoring requirements
    return {
      totalRequests: 0,
      blockedRequests: 0,
      topIdentifiers: [],
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  async cleanupExpiredEntries(): Promise<void> {
    // This would clean up expired entries from cache
    // Implementation depends on cache backend
    this.logger.log('Cleaning up expired rate limit entries');
  }

  /**
   * Generate cache key for rate limiting
   */
  private generateKey(identifier: string, type: string, windowStart: number): string {
    return `rate_limit:${type}:${identifier}:${windowStart}`;
  }

  /**
   * Apply rate limiting with custom configuration
   */
  async applyRateLimit(
    identifier: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const key = config.keyGenerator 
      ? config.keyGenerator(identifier, 'custom')
      : this.generateKey(identifier, 'custom', Date.now());

    const windowSeconds = Math.floor(config.windowSizeMs / 1000);
    
    return this.checkRateLimit(identifier, 'custom', config.maxRequests, windowSeconds);
  }
}