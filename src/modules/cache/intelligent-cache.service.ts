import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RedisService } from './redis.service';
import { CustomLoggerService, LogContext } from '../logger/logger.service';

interface CacheOptions {
  ttl?: number;
  tenantId?: string | undefined;
  useL1Cache?: boolean;
  useL2Cache?: boolean;
  warmCache?: boolean;
}

interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  totalRequests: number;
  hitRate: number;
}

@Injectable()
export class IntelligentCacheService {
  private readonly logger = new Logger(IntelligentCacheService.name);
  
  // L1 Cache: In-memory cache for ultra-fast access
  private readonly l1Cache = new Map<string, { data: any; expiry: number; accessCount: number }>();
  private readonly l1MaxSize = 1000;
  private readonly l1DefaultTtl = 60000; // 1 minute

  // Cache statistics
  private stats: CacheStats = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    totalRequests: 0,
    hitRate: 0,
  };

  constructor(
    @Inject(CACHE_MANAGER) private readonly l2Cache: Cache,
    private readonly redisService: RedisService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('IntelligentCacheService');
    
    // Start cache maintenance tasks
    this.startCacheMaintenance();
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const { tenantId, useL1Cache = true, useL2Cache = true } = options;
    const fullKey = this.buildCacheKey(key, tenantId);
    
    this.stats.totalRequests++;

    try {
      // L1 Cache check (in-memory)
      if (useL1Cache) {
        const l1Result = this.getFromL1Cache<T>(fullKey);
        if (l1Result !== null) {
          this.stats.l1Hits++;
          this.updateHitRate();
          
          this.customLogger.debug('L1 cache hit', {
            key: fullKey,
            tenantId,
          });
          
          return l1Result;
        }
        this.stats.l1Misses++;
      }

      // L2 Cache check (Redis)
      if (useL2Cache) {
        const l2Result = await this.l2Cache.get<T>(fullKey);
        if (l2Result !== null && l2Result !== undefined) {
          this.stats.l2Hits++;
          this.updateHitRate();
          
          // Populate L1 cache for next access
          if (useL1Cache) {
            this.setInL1Cache(fullKey, l2Result, this.l1DefaultTtl);
          }
          
          this.customLogger.debug('L2 cache hit', {
            key: fullKey,
            tenantId,
          });
          
          return l2Result;
        }
        this.stats.l2Misses++;
      }

      this.updateHitRate();
      return null;
    } catch (error) {
      this.customLogger.error('Cache GET failed', error instanceof Error ? error.stack : undefined, {
        key: fullKey,
        tenantId,
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const { 
      ttl = 300, 
      tenantId, 
      useL1Cache = true, 
      useL2Cache = true 
    } = options;
    const fullKey = this.buildCacheKey(key, tenantId);

    try {
      // Set in L2 cache (Redis)
      if (useL2Cache) {
        await this.l2Cache.set(fullKey, value, ttl * 1000); // Convert to milliseconds
      }

      // Set in L1 cache (in-memory)
      if (useL1Cache) {
        const l1Ttl = Math.min(ttl * 1000, this.l1DefaultTtl);
        this.setInL1Cache(fullKey, value, l1Ttl);
      }

      this.customLogger.debug('Cache SET successful', {
        key: fullKey,
        ttl,
        tenantId,
        useL1Cache,
        useL2Cache,
      });
    } catch (error) {
      this.customLogger.error('Cache SET failed', error instanceof Error ? error.stack : undefined, {
        key: fullKey,
        ttl,
        tenantId,
      });
      throw error;
    }
  }

  async del(key: string, options: CacheOptions = {}): Promise<void> {
    const { tenantId } = options;
    const fullKey = this.buildCacheKey(key, tenantId);

    try {
      // Remove from L1 cache
      this.l1Cache.delete(fullKey);

      // Remove from L2 cache
      await this.l2Cache.del(fullKey);

      this.customLogger.debug('Cache DEL successful', {
        key: fullKey,
        tenantId,
      });
    } catch (error) {
      this.customLogger.error('Cache DEL failed', error instanceof Error ? error.stack : undefined, {
        key: fullKey,
        tenantId,
      });
      throw error;
    }
  }

  async invalidatePattern(pattern: string, options: CacheOptions = {}): Promise<void> {
    const { tenantId } = options;
    
    try {
      // Invalidate L1 cache
      const l1Pattern = this.buildCacheKey(pattern, tenantId);
      for (const key of this.l1Cache.keys()) {
        if (key.includes(l1Pattern.replace('*', ''))) {
          this.l1Cache.delete(key);
        }
      }

      // Invalidate L2 cache using Redis pattern matching
      await this.redisService.invalidatePattern(pattern, tenantId);

      this.customLogger.debug('Cache pattern invalidation successful', {
        pattern,
        tenantId,
      });
    } catch (error) {
      this.customLogger.error('Cache pattern invalidation failed', error instanceof Error ? error.stack : undefined, {
        pattern,
        tenantId,
      });
      throw error;
    }
  }

  async warmCache<T>(
    key: string, 
    dataLoader: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl = 300, tenantId } = options;
    
    try {
      // Check if data already exists in cache
      const cachedData = await this.get<T>(key, options);
      if (cachedData !== null) {
        return cachedData;
      }

      // Load data and cache it
      const data = await dataLoader();
      await this.set(key, data, { ...options, ttl });

      this.customLogger.debug('Cache warming successful', {
        key,
        tenantId,
      });

      return data;
    } catch (error) {
      this.customLogger.error('Cache warming failed', error instanceof Error ? error.stack : undefined, {
        key,
        tenantId,
      });
      throw error;
    }
  }

  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    
    for (const key of keys) {
      const result = await this.get<T>(key, options);
      results.push(result);
    }
    
    return results;
  }

  async mset<T>(entries: Array<{ key: string; value: T }>, options: CacheOptions = {}): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, options);
    }
  }

  // Cache statistics and monitoring
  getStats(): CacheStats & {
    l1Size: number;
    l1MaxSize: number;
    l1MemoryUsage: string;
  } {
    return {
      ...this.stats,
      l1Size: this.l1Cache.size,
      l1MaxSize: this.l1MaxSize,
      l1MemoryUsage: this.calculateL1MemoryUsage(),
    };
  }

  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      totalRequests: 0,
      hitRate: 0,
    };
  }

  // Cache health check
  async isHealthy(): Promise<{
    l1Cache: boolean;
    l2Cache: boolean;
    redis: boolean;
    overall: boolean;
  }> {
    const l1Cache = this.l1Cache.size >= 0; // L1 is always healthy if accessible
    
    let l2Cache = false;
    try {
      await this.l2Cache.set('health-check', 'test', 1000);
      const result = await this.l2Cache.get('health-check');
      l2Cache = result === 'test';
      await this.l2Cache.del('health-check');
    } catch {
      l2Cache = false;
    }

    const redis = await this.redisService.isHealthy();
    const overall = l1Cache && l2Cache && redis;

    return { l1Cache, l2Cache, redis, overall };
  }

  private getFromL1Cache<T>(key: string): T | null {
    const entry = this.l1Cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.l1Cache.delete(key);
      return null;
    }

    // Update access count for LRU eviction
    entry.accessCount++;
    return entry.data;
  }

  private setInL1Cache<T>(key: string, value: T, ttl: number): void {
    // Evict least recently used items if cache is full
    if (this.l1Cache.size >= this.l1MaxSize) {
      this.evictLRU();
    }

    this.l1Cache.set(key, {
      data: value,
      expiry: Date.now() + ttl,
      accessCount: 1,
    });
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruAccessCount = Infinity;

    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.accessCount < lruAccessCount) {
        lruAccessCount = entry.accessCount;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.l1Cache.delete(lruKey);
    }
  }

  private buildCacheKey(key: string, tenantId?: string): string {
    if (tenantId) {
      return `tenant:${tenantId}:${key}`;
    }
    return `global:${key}`;
  }

  private updateHitRate(): void {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? (totalHits / this.stats.totalRequests) * 100 
      : 0;
  }

  private calculateL1MemoryUsage(): string {
    let totalSize = 0;
    
    for (const entry of this.l1Cache.values()) {
      // Rough estimation of memory usage
      totalSize += JSON.stringify(entry.data).length * 2; // UTF-16 encoding
    }
    
    if (totalSize < 1024) {
      return `${totalSize} B`;
    } else if (totalSize < 1024 * 1024) {
      return `${(totalSize / 1024).toFixed(2)} KB`;
    } else {
      return `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
    }
  }

  private startCacheMaintenance(): void {
    // Clean expired L1 cache entries every minute
    setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;
      
      for (const [key, entry] of this.l1Cache.entries()) {
        if (now > entry.expiry) {
          this.l1Cache.delete(key);
          expiredCount++;
        }
      }
      
      if (expiredCount > 0) {
        this.customLogger.debug('L1 cache maintenance completed', {
          expiredEntries: expiredCount,
          remainingEntries: this.l1Cache.size,
        });
      }
    }, 60000); // Every minute

    // Log cache statistics every 5 minutes
    setInterval(() => {
      const stats = this.getStats();
      this.customLogger.log('Cache statistics', stats as unknown as LogContext);
    }, 300000); // Every 5 minutes
  }
}