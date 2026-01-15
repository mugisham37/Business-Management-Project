import { Injectable, Logger } from '@nestjs/common';
import { IntelligentCacheService } from './intelligent-cache.service';
import { RedisService } from './redis.service';
import { CustomLoggerService, LogContext } from '../logger/logger.service';

interface CacheWarmingConfig {
  key: string;
  dataLoader: () => Promise<any>;
  ttl: number;
  priority: 'high' | 'medium' | 'low';
  schedule?: string; // Cron expression
  dependencies?: string[]; // Other cache keys this depends on
}

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  keyCount: number;
  hotKeys: Array<{ key: string; hits: number; lastAccess: Date }>;
}

interface DistributedCacheConfig {
  nodes: string[];
  replicationFactor: number;
  consistencyLevel: 'eventual' | 'strong';
  partitionStrategy: 'hash' | 'range';
}

@Injectable()
export class AdvancedCacheService {
  private readonly logger = new Logger(AdvancedCacheService.name);
  
  // Cache warming configurations
  private warmingConfigs = new Map<string, CacheWarmingConfig>();
  
  // Cache metrics tracking
  private metrics: CacheMetrics = {
    hitRate: 0,
    missRate: 0,
    evictionRate: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    keyCount: 0,
    hotKeys: [],
  };

  // Hot key tracking
  private keyAccessStats = new Map<string, { hits: number; lastAccess: Date }>();
  
  // Cache warming intervals
  private warmingIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly intelligentCache: IntelligentCacheService,
    private readonly redisService: RedisService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('AdvancedCacheService');
    this.startMetricsCollection();
    this.startCacheWarming();
  }

  /**
   * Get data with advanced caching strategies
   */
  async get<T>(
    key: string,
    options: {
      tenantId?: string;
      fallbackLoader?: () => Promise<T>;
      ttl?: number;
      useDistributed?: boolean;
      warmOnMiss?: boolean;
    } = {}
  ): Promise<T | null> {
    const { tenantId, fallbackLoader, ttl = 300, useDistributed = false, warmOnMiss = true } = options;
    const startTime = Date.now();

    try {
      // Track key access
      this.trackKeyAccess(key);

      // Try intelligent cache first
      let result = await this.intelligentCache.get<T>(key, { tenantId });
      
      if (result !== null) {
        this.updateMetrics('hit', Date.now() - startTime);
        return result;
      }

      // Try distributed cache if enabled
      if (useDistributed) {
        result = await this.getFromDistributedCache<T>(key, tenantId);
        if (result !== null) {
          // Populate local cache
          await this.intelligentCache.set(key, result, { tenantId, ttl });
          this.updateMetrics('hit', Date.now() - startTime);
          return result;
        }
      }

      // Cache miss - use fallback loader if provided
      if (fallbackLoader) {
        result = await fallbackLoader();
        
        if (result !== null) {
          // Store in cache
          const setOptions: {
            tenantId?: string;
            ttl: number;
            useDistributed: boolean;
          } = { ttl, useDistributed };
          if (tenantId) {
            setOptions.tenantId = tenantId;
          }
          await this.set(key, result, setOptions);
          
          // Schedule cache warming if enabled
          if (warmOnMiss) {
            this.scheduleWarmingForKey(key, fallbackLoader, ttl);
          }
        }
        
        this.updateMetrics('miss', Date.now() - startTime);
        return result;
      }

      this.updateMetrics('miss', Date.now() - startTime);
      return null;
    } catch (error) {
      this.customLogger.error('Advanced cache GET failed', error instanceof Error ? error.stack : undefined, {
        key,
        tenantId,
      });
      this.updateMetrics('miss', Date.now() - startTime);
      return null;
    }
  }

  /**
   * Set data with advanced caching strategies
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      tenantId?: string;
      ttl?: number;
      useDistributed?: boolean;
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): Promise<void> {
    const { tenantId, ttl = 300, useDistributed = false, priority = 'medium' } = options;

    try {
      // Set in intelligent cache
      await this.intelligentCache.set(key, value, { tenantId, ttl });

      // Set in distributed cache if enabled
      if (useDistributed) {
        await this.setInDistributedCache(key, value, tenantId, ttl);
      }

      // Track hot keys for optimization
      if (priority === 'high') {
        this.markAsHotKey(key);
      }

      this.customLogger.debug('Advanced cache SET successful', {
        key,
        tenantId,
        ttl,
        useDistributed,
        priority,
      });
    } catch (error) {
      this.customLogger.error('Advanced cache SET failed', error instanceof Error ? error.stack : undefined, {
        key,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Configure cache warming for a key
   */
  configureCacheWarming(config: CacheWarmingConfig): void {
    this.warmingConfigs.set(config.key, config);
    
    // Schedule immediate warming for high priority items
    if (config.priority === 'high') {
      this.warmCacheKey(config.key);
    }

    this.customLogger.log('Cache warming configured', {
      key: config.key,
      priority: config.priority,
      ttl: config.ttl,
    });
  }

  /**
   * Remove cache warming configuration
   */
  removeCacheWarming(key: string): void {
    this.warmingConfigs.delete(key);
    
    const interval = this.warmingIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.warmingIntervals.delete(key);
    }

    this.customLogger.log('Cache warming removed', { key });
  }

  /**
   * Get cache metrics and performance data
   */
  getCacheMetrics(): CacheMetrics & {
    intelligentCacheStats: any;
    warmingConfigs: number;
    distributedCacheEnabled: boolean;
  } {
    const intelligentStats = this.intelligentCache.getStats();
    
    return {
      ...this.metrics,
      intelligentCacheStats: intelligentStats,
      warmingConfigs: this.warmingConfigs.size,
      distributedCacheEnabled: this.isDistributedCacheEnabled(),
    };
  }

  /**
   * Optimize cache performance
   */
  async optimizeCachePerformance(): Promise<{
    evictedKeys: number;
    warmedKeys: number;
    optimizedHotKeys: number;
  }> {
    let evictedKeys = 0;
    let warmedKeys = 0;
    let optimizedHotKeys = 0;

    try {
      // Evict cold keys (not accessed in last hour)
      const cutoffTime = Date.now() - (60 * 60 * 1000);
      for (const [key, stats] of this.keyAccessStats.entries()) {
        if (stats.lastAccess.getTime() < cutoffTime && stats.hits < 5) {
          await this.intelligentCache.del(key);
          this.keyAccessStats.delete(key);
          evictedKeys++;
        }
      }

      // Warm high-priority cache keys
      for (const [key, config] of this.warmingConfigs.entries()) {
        if (config.priority === 'high') {
          await this.warmCacheKey(key);
          warmedKeys++;
        }
      }

      // Optimize hot keys with longer TTL
      for (const [key, stats] of this.keyAccessStats.entries()) {
        if (stats.hits > 100) {
          const config = this.warmingConfigs.get(key);
          if (config) {
            await this.intelligentCache.set(key, await config.dataLoader(), {
              ttl: config.ttl * 2, // Double TTL for hot keys
            });
            optimizedHotKeys++;
          }
        }
      }

      this.customLogger.log('Cache performance optimization completed', {
        evictedKeys,
        warmedKeys,
        optimizedHotKeys,
      });

      return { evictedKeys, warmedKeys, optimizedHotKeys };
    } catch (error) {
      this.customLogger.error('Cache optimization failed', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Enable distributed caching across multiple nodes
   */
  async enableDistributedCache(config: DistributedCacheConfig): Promise<void> {
    try {
      // Initialize distributed cache connections
      for (const node of config.nodes) {
        // This would connect to Redis Cluster or other distributed cache
        // For now, we'll use the existing Redis service
        this.customLogger.log('Distributed cache node initialized', { node });
      }

      this.customLogger.log('Distributed cache enabled', {
        nodeCount: config.nodes.length,
        replicationFactor: config.replicationFactor,
        consistencyLevel: config.consistencyLevel,
      });
    } catch (error) {
      this.customLogger.error('Failed to enable distributed cache', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  // Private helper methods

  private async getFromDistributedCache<T>(key: string, tenantId?: string): Promise<T | null> {
    // Implementation would depend on distributed cache technology
    // For now, delegate to Redis service
    try {
      return await this.redisService.get(this.buildDistributedKey(key, tenantId));
    } catch {
      return null;
    }
  }

  private async setInDistributedCache<T>(
    key: string,
    value: T,
    tenantId?: string,
    ttl: number = 300
  ): Promise<void> {
    try {
      await this.redisService.set(this.buildDistributedKey(key, tenantId), value, ttl);
    } catch (error) {
      this.customLogger.error('Distributed cache SET failed', error instanceof Error ? error.stack : undefined);
    }
  }

  private buildDistributedKey(key: string, tenantId?: string): string {
    return tenantId ? `dist:tenant:${tenantId}:${key}` : `dist:global:${key}`;
  }

  private trackKeyAccess(key: string): void {
    const stats = this.keyAccessStats.get(key) || { hits: 0, lastAccess: new Date() };
    stats.hits++;
    stats.lastAccess = new Date();
    this.keyAccessStats.set(key, stats);

    // Update hot keys list
    this.updateHotKeys();
  }

  private updateHotKeys(): void {
    const sortedKeys = Array.from(this.keyAccessStats.entries())
      .sort(([, a], [, b]) => b.hits - a.hits)
      .slice(0, 10);

    this.metrics.hotKeys = sortedKeys.map(([key, stats]) => ({
      key,
      hits: stats.hits,
      lastAccess: stats.lastAccess,
    }));
  }

  private markAsHotKey(key: string): void {
    const stats = this.keyAccessStats.get(key) || { hits: 0, lastAccess: new Date() };
    stats.hits += 10; // Boost hit count for high priority keys
    this.keyAccessStats.set(key, stats);
  }

  private updateMetrics(type: 'hit' | 'miss', responseTime: number): void {
    if (type === 'hit') {
      this.metrics.hitRate = (this.metrics.hitRate * 0.9) + (1 * 0.1); // Exponential moving average
    } else {
      this.metrics.missRate = (this.metrics.missRate * 0.9) + (1 * 0.1);
    }

    this.metrics.averageResponseTime = (this.metrics.averageResponseTime * 0.9) + (responseTime * 0.1);
  }

  private async warmCacheKey(key: string): Promise<void> {
    const config = this.warmingConfigs.get(key);
    if (!config) return;

    try {
      const data = await config.dataLoader();
      await this.intelligentCache.set(key, data, { ttl: config.ttl });
      
      this.customLogger.debug('Cache key warmed', { key });
    } catch (error) {
      this.customLogger.error('Cache warming failed', error instanceof Error ? error.stack : undefined, { key });
    }
  }

  private scheduleWarmingForKey(key: string, dataLoader: () => Promise<any>, ttl: number): void {
    // Schedule warming before TTL expires
    const warmingInterval = (ttl * 1000) * 0.8; // Warm at 80% of TTL
    
    const interval = setInterval(async () => {
      await this.warmCacheKey(key);
    }, warmingInterval);

    this.warmingIntervals.set(key, interval);
  }

  private isDistributedCacheEnabled(): boolean {
    // Check if distributed cache is configured and available
    return false; // Placeholder
  }

  private startMetricsCollection(): void {
    // Collect metrics every minute
    setInterval(() => {
      this.updateMetrics('hit', 0); // Update moving averages
      
      // Log metrics every 5 minutes
      if (Date.now() % (5 * 60 * 1000) < 60000) {
        this.customLogger.log('Advanced cache metrics', this.getCacheMetrics() as unknown as LogContext);
      }
    }, 60000);
  }

  private startCacheWarming(): void {
    // Start cache warming for configured keys
    for (const [key, config] of this.warmingConfigs.entries()) {
      if (config.schedule) {
        // Parse cron schedule and set up warming
        // For now, just warm high priority items immediately
        if (config.priority === 'high') {
          this.warmCacheKey(key);
        }
      }
    }
  }
}