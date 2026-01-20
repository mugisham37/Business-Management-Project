import { Injectable } from '@nestjs/common';
import { SimpleRedisService } from './simple-redis.service';

export interface CacheOptions {
  ttl?: number;
}

@Injectable()
export class CacheService {
  constructor(private readonly redisService: SimpleRedisService) {}

  async get<T>(key: string): Promise<T | null> {
    return this.redisService.get<T>(key);
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl;
    return this.redisService.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    return this.redisService.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.redisService.exists(key);
  }

  async getKeysByPattern(pattern: string): Promise<string[]> {
    return this.redisService.getKeysByPattern(pattern);
  }

  async getClient() {
    return this.redisService.getClient();
  }
}
