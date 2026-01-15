import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { SimpleRedisService } from '../../cache/simple-redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: SimpleRedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const redisInfo = await this.redisService.getInfo();
      
      const result = this.getStatus(key, redisInfo.isHealthy, {
        redis: 'redis',
        status: redisInfo.isHealthy ? 'up' : 'down',
        connections: redisInfo.connections,
        memory: redisInfo.memory,
      });

      if (redisInfo.isHealthy) {
        return result;
      }
      
      throw new HealthCheckError('Redis health check failed', result);
    } catch (error) {
      throw new HealthCheckError('Redis health check failed', this.getStatus(key, false, {
        redis: 'redis',
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }
}