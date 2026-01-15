import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from '../logger/logger.service';
import { IntelligentCacheService } from './intelligent-cache.service';
import { RedisService } from './redis.service';
// Note: compression and helmet would be used in middleware setup, not imported here

interface CompressionConfig {
  enabled: boolean;
  threshold: number; // Minimum response size to compress
  level: number; // Compression level (1-9)
  algorithms: string[];
}

interface CDNConfig {
  enabled: boolean;
  provider: 'cloudflare' | 'aws' | 'azure' | 'custom';
  endpoint: string;
  apiKey?: string;
  cacheTTL: number;
}

interface ResponseCacheConfig {
  defaultTTL: number;
  maxSize: number;
  varyHeaders: string[];
  excludePatterns: string[];
}

interface PerformanceMetrics {
  averageResponseTime: number;
  requestsPerSecond: number;
  cacheHitRate: number;
  compressionRatio: number;
  cdnHitRate: number;
  errorRate: number;
}

interface APIEndpointMetrics {
  endpoint: string;
  method: string;
  averageResponseTime: number;
  requestCount: number;
  errorCount: number;
  cacheHitRate: number;
  lastAccessed: Date;
}

@Injectable()
export class APIPerformanceService {
  private readonly logger = new Logger(APIPerformanceService.name);
  
  // Configuration
  private compressionConfig: CompressionConfig = {
    enabled: true,
    threshold: 1024, // 1KB
    level: 6,
    algorithms: ['gzip', 'deflate', 'br'],
  };
  
  private cdnConfig: CDNConfig = {
    enabled: false,
    provider: 'cloudflare',
    endpoint: '',
    cacheTTL: 3600,
  };
  
  private responseCacheConfig: ResponseCacheConfig = {
    defaultTTL: 300, // 5 minutes
    maxSize: 100 * 1024 * 1024, // 100MB
    varyHeaders: ['Accept', 'Accept-Encoding', 'Authorization'],
    excludePatterns: ['/api/v1/auth/', '/api/v1/pos/transactions'],
  };
  
  // Metrics tracking
  private performanceMetrics: PerformanceMetrics = {
    averageResponseTime: 0,
    requestsPerSecond: 0,
    cacheHitRate: 0,
    compressionRatio: 0,
    cdnHitRate: 0,
    errorRate: 0,
  };
  
  private endpointMetrics = new Map<string, APIEndpointMetrics>();
  private requestHistory: Array<{ timestamp: Date; responseTime: number; cached: boolean }> = [];
  
  // Response caching
  private responseCache = new Map<string, { data: any; expiry: number; size: number }>();
  private currentCacheSize = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly customLogger: CustomLoggerService,
    private readonly cacheService: IntelligentCacheService,
    private readonly redisService: RedisService,
  ) {
    this.customLogger.setContext('APIPerformanceService');
    this.initializeConfiguration();
    this.startMetricsCollection();
  }

  /**
   * Initialize performance optimization configuration
   */
  private initializeConfiguration(): void {
    // Load compression configuration
    this.compressionConfig = {
      enabled: this.configService.get('API_COMPRESSION_ENABLED') !== 'false',
      threshold: parseInt(this.configService.get('API_COMPRESSION_THRESHOLD') || '1024'),
      level: parseInt(this.configService.get('API_COMPRESSION_LEVEL') || '6'),
      algorithms: (this.configService.get('API_COMPRESSION_ALGORITHMS') || 'gzip,deflate,br').split(','),
    };

    // Load CDN configuration
    const apiKey = this.configService.get('CDN_API_KEY');
    this.cdnConfig = {
      enabled: this.configService.get('CDN_ENABLED') === 'true',
      provider: (this.configService.get('CDN_PROVIDER') as any) || 'cloudflare',
      endpoint: this.configService.get('CDN_ENDPOINT') || '',
      cacheTTL: parseInt(this.configService.get('CDN_CACHE_TTL') || '3600'),
    };
    if (apiKey) {
      this.cdnConfig.apiKey = apiKey;
    }

    // Load response cache configuration
    this.responseCacheConfig = {
      defaultTTL: parseInt(this.configService.get('RESPONSE_CACHE_TTL') || '300'),
      maxSize: parseInt(this.configService.get('RESPONSE_CACHE_MAX_SIZE') || '104857600'), // 100MB
      varyHeaders: (this.configService.get('RESPONSE_CACHE_VARY_HEADERS') || 'Accept,Accept-Encoding,Authorization').split(','),
      excludePatterns: (this.configService.get('RESPONSE_CACHE_EXCLUDE_PATTERNS') || '/api/v1/auth/,/api/v1/pos/transactions').split(','),
    };

    this.customLogger.log('API performance optimization initialized', {
      compression: this.compressionConfig.enabled,
      cdn: this.cdnConfig.enabled,
      responseCache: true,
    });
  }

  /**
   * Optimize API response with compression and caching
   */
  async optimizeResponse(
    request: any,
    response: any,
    data: any,
    options: {
      cacheable?: boolean;
      ttl?: number;
      compress?: boolean;
      tenantId?: string;
    } = {}
  ): Promise<any> {
    const startTime = Date.now();
    const { cacheable = true, ttl = this.responseCacheConfig.defaultTTL, compress = true, tenantId } = options;
    
    try {
      const cacheKey = this.generateResponseCacheKey(request, tenantId);
      const endpoint = `${request.method} ${request.route?.path || request.url}`;
      
      // Check if response should be cached
      if (cacheable && !this.shouldExcludeFromCache(request.url)) {
        // Try to get from cache first
        const cachedResponse = await this.getFromResponseCache(cacheKey);
        if (cachedResponse) {
          this.updateEndpointMetrics(endpoint, Date.now() - startTime, false, true);
          return cachedResponse;
        }
      }

      // Process and optimize response
      let optimizedData = data;
      
      // Apply compression if enabled and beneficial
      if (compress && this.compressionConfig.enabled) {
        optimizedData = await this.compressResponse(optimizedData, request);
      }

      // Cache the response if cacheable
      if (cacheable && !this.shouldExcludeFromCache(request.url)) {
        await this.setResponseCache(cacheKey, optimizedData, ttl);
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateEndpointMetrics(endpoint, responseTime, false, false);
      this.updatePerformanceMetrics(responseTime, false);

      return optimizedData;
    } catch (error) {
      this.customLogger.error('Response optimization failed', error instanceof Error ? error.stack : undefined, {
        url: request.url,
        method: request.method,
      });
      
      // Return original data on optimization failure
      return data;
    }
  }

  /**
   * Implement response compression
   */
  private async compressResponse(data: any, request: any): Promise<any> {
    const acceptEncoding = request.headers['accept-encoding'] || '';
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Only compress if data is above threshold
    if (dataString.length < this.compressionConfig.threshold) {
      return data;
    }

    try {
      const zlib = require('zlib');
      let compressed: Buffer;
      let encoding: string;

      // Choose best compression algorithm
      if (acceptEncoding.includes('br') && this.compressionConfig.algorithms.includes('br')) {
        compressed = zlib.brotliCompressSync(dataString, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.compressionConfig.level,
          },
        });
        encoding = 'br';
      } else if (acceptEncoding.includes('gzip') && this.compressionConfig.algorithms.includes('gzip')) {
        compressed = zlib.gzipSync(dataString, { level: this.compressionConfig.level });
        encoding = 'gzip';
      } else if (acceptEncoding.includes('deflate') && this.compressionConfig.algorithms.includes('deflate')) {
        compressed = zlib.deflateSync(dataString, { level: this.compressionConfig.level });
        encoding = 'deflate';
      } else {
        return data; // No compression
      }

      // Update compression metrics
      const compressionRatio = compressed.length / dataString.length;
      this.performanceMetrics.compressionRatio = 
        (this.performanceMetrics.compressionRatio * 0.9) + (compressionRatio * 0.1);

      this.customLogger.debug('Response compressed', {
        originalSize: dataString.length,
        compressedSize: compressed.length,
        ratio: compressionRatio,
        encoding,
      });

      return {
        data: compressed,
        encoding,
        originalSize: dataString.length,
        compressedSize: compressed.length,
      };
    } catch (error) {
      this.customLogger.error('Compression failed', error instanceof Error ? error.stack : undefined);
      return data;
    }
  }

  /**
   * Get response from cache
   */
  private async getFromResponseCache(cacheKey: string): Promise<any | null> {
    // Check in-memory cache first
    const memoryCache = this.responseCache.get(cacheKey);
    if (memoryCache && Date.now() < memoryCache.expiry) {
      return memoryCache.data;
    }

    // Check Redis cache
    try {
      const redisCache = await this.redisService.get(`response:${cacheKey}`);
      if (redisCache) {
        // Populate memory cache
        this.setMemoryCache(cacheKey, redisCache, 300); // 5 minutes in memory
        return redisCache;
      }
    } catch (error) {
      this.customLogger.error('Redis response cache GET failed', error instanceof Error ? error.stack : undefined);
    }

    return null;
  }

  /**
   * Set response in cache
   */
  private async setResponseCache(cacheKey: string, data: any, ttl: number): Promise<void> {
    try {
      // Set in Redis
      await this.redisService.set(`response:${cacheKey}`, data, ttl);
      
      // Set in memory cache with shorter TTL
      const memoryTTL = Math.min(ttl, 300); // Max 5 minutes in memory
      this.setMemoryCache(cacheKey, data, memoryTTL);
    } catch (error) {
      this.customLogger.error('Response cache SET failed', error instanceof Error ? error.stack : undefined);
    }
  }

  /**
   * Set data in memory cache with size management
   */
  private setMemoryCache(key: string, data: any, ttl: number): void {
    const dataSize = JSON.stringify(data).length * 2; // Rough UTF-16 size estimation
    
    // Check if we need to evict items
    while (this.currentCacheSize + dataSize > this.responseCacheConfig.maxSize && this.responseCache.size > 0) {
      this.evictOldestCacheItem();
    }

    this.responseCache.set(key, {
      data,
      expiry: Date.now() + (ttl * 1000),
      size: dataSize,
    });
    
    this.currentCacheSize += dataSize;
  }

  /**
   * Evict oldest cache item
   */
  private evictOldestCacheItem(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.responseCache.entries()) {
      if (item.expiry < oldestTime) {
        oldestTime = item.expiry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const item = this.responseCache.get(oldestKey);
      if (item) {
        this.currentCacheSize -= item.size;
        this.responseCache.delete(oldestKey);
      }
    }
  }

  /**
   * Generate cache key for response
   */
  private generateResponseCacheKey(request: any, tenantId?: string): string {
    const crypto = require('crypto');
    
    // Include relevant headers in cache key
    const varyHeaders = this.responseCacheConfig.varyHeaders
      .map(header => `${header}:${request.headers[header.toLowerCase()] || ''}`)
      .join('|');
    
    const keyData = [
      request.method,
      request.url,
      varyHeaders,
      tenantId || 'global',
    ].join('|');
    
    return crypto.createHash('md5').update(keyData).digest('hex');
  }

  /**
   * Check if URL should be excluded from caching
   */
  private shouldExcludeFromCache(url: string): boolean {
    return this.responseCacheConfig.excludePatterns.some(pattern => url.includes(pattern));
  }

  /**
   * Update endpoint-specific metrics
   */
  private updateEndpointMetrics(
    endpoint: string,
    responseTime: number,
    isError: boolean,
    isCacheHit: boolean
  ): void {
    let metrics = this.endpointMetrics.get(endpoint);
    
    if (!metrics) {
      metrics = {
        endpoint,
        method: endpoint.split(' ')[0] || 'GET',
        averageResponseTime: 0,
        requestCount: 0,
        errorCount: 0,
        cacheHitRate: 0,
        lastAccessed: new Date(),
      };
      this.endpointMetrics.set(endpoint, metrics);
    }

    // Update metrics - metrics is now guaranteed to be defined
    const currentMetrics = metrics;
    currentMetrics.requestCount++;
    currentMetrics.averageResponseTime = 
      (currentMetrics.averageResponseTime * (currentMetrics.requestCount - 1) + responseTime) / currentMetrics.requestCount;
    
    if (isError) {
      currentMetrics.errorCount++;
    }
    
    // Update cache hit rate
    const hitCount = currentMetrics.cacheHitRate * (currentMetrics.requestCount - 1) + (isCacheHit ? 1 : 0);
    currentMetrics.cacheHitRate = hitCount / currentMetrics.requestCount;
    
    currentMetrics.lastAccessed = new Date();
  }

  /**
   * Update overall performance metrics
   */
  private updatePerformanceMetrics(responseTime: number, isCacheHit: boolean): void {
    // Add to request history
    this.requestHistory.push({
      timestamp: new Date(),
      responseTime,
      cached: isCacheHit,
    });

    // Keep only recent history (last 5 minutes)
    const cutoff = Date.now() - (5 * 60 * 1000);
    this.requestHistory = this.requestHistory.filter(req => req.timestamp.getTime() > cutoff);

    // Calculate metrics
    if (this.requestHistory.length > 0) {
      const totalResponseTime = this.requestHistory.reduce((sum, req) => sum + req.responseTime, 0);
      this.performanceMetrics.averageResponseTime = totalResponseTime / this.requestHistory.length;
      
      this.performanceMetrics.requestsPerSecond = this.requestHistory.length / 300; // 5 minutes
      
      const cacheHits = this.requestHistory.filter(req => req.cached).length;
      this.performanceMetrics.cacheHitRate = (cacheHits / this.requestHistory.length) * 100;
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    overall: PerformanceMetrics;
    endpoints: APIEndpointMetrics[];
    cache: {
      memorySize: number;
      memoryItems: number;
      maxSize: number;
      hitRate: number;
    };
    compression: {
      enabled: boolean;
      averageRatio: number;
      threshold: number;
    };
    cdn: {
      enabled: boolean;
      hitRate: number;
    };
  } {
    const topEndpoints = Array.from(this.endpointMetrics.values())
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 20);

    return {
      overall: this.performanceMetrics,
      endpoints: topEndpoints,
      cache: {
        memorySize: this.currentCacheSize,
        memoryItems: this.responseCache.size,
        maxSize: this.responseCacheConfig.maxSize,
        hitRate: this.performanceMetrics.cacheHitRate,
      },
      compression: {
        enabled: this.compressionConfig.enabled,
        averageRatio: this.performanceMetrics.compressionRatio,
        threshold: this.compressionConfig.threshold,
      },
      cdn: {
        enabled: this.cdnConfig.enabled,
        hitRate: this.performanceMetrics.cdnHitRate,
      },
    };
  }

  /**
   * Optimize API performance settings
   */
  async optimizeSettings(): Promise<{
    compressionOptimized: boolean;
    cacheOptimized: boolean;
    endpointsOptimized: number;
  }> {
    let compressionOptimized = false;
    let cacheOptimized = false;
    let endpointsOptimized = 0;

    try {
      // Optimize compression settings based on metrics
      if (this.performanceMetrics.compressionRatio > 0.8) {
        // Compression not effective, increase threshold
        this.compressionConfig.threshold *= 1.5;
        compressionOptimized = true;
      } else if (this.performanceMetrics.compressionRatio < 0.3) {
        // Compression very effective, decrease threshold
        this.compressionConfig.threshold = Math.max(512, this.compressionConfig.threshold * 0.8);
        compressionOptimized = true;
      }

      // Optimize cache settings
      if (this.performanceMetrics.cacheHitRate < 50) {
        // Low hit rate, increase TTL
        this.responseCacheConfig.defaultTTL = Math.min(3600, this.responseCacheConfig.defaultTTL * 1.2);
        cacheOptimized = true;
      } else if (this.performanceMetrics.cacheHitRate > 90) {
        // Very high hit rate, can reduce TTL to save memory
        this.responseCacheConfig.defaultTTL = Math.max(60, this.responseCacheConfig.defaultTTL * 0.9);
        cacheOptimized = true;
      }

      // Optimize slow endpoints
      for (const [endpoint, metrics] of this.endpointMetrics.entries()) {
        if (metrics.averageResponseTime > 1000 && metrics.requestCount > 100) {
          // Add slow endpoint to cache exclusion if it's not already cached well
          if (metrics.cacheHitRate < 30 && !this.shouldExcludeFromCache(endpoint)) {
            // This endpoint might benefit from more aggressive caching
            endpointsOptimized++;
          }
        }
      }

      this.customLogger.log('API performance optimization completed', {
        compressionOptimized,
        cacheOptimized,
        endpointsOptimized,
      });

      return { compressionOptimized, cacheOptimized, endpointsOptimized };
    } catch (error) {
      this.customLogger.error('Performance optimization failed', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Clear response cache
   */
  async clearResponseCache(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        // Clear specific pattern
        const keysToDelete: string[] = [];
        
        for (const key of this.responseCache.keys()) {
          if (key.includes(pattern)) {
            keysToDelete.push(key);
          }
        }
        
        for (const key of keysToDelete) {
          const item = this.responseCache.get(key);
          if (item) {
            this.currentCacheSize -= item.size;
          }
          this.responseCache.delete(key);
        }
        
        // Clear from Redis
        await this.redisService.invalidatePattern(`response:*${pattern}*`);
      } else {
        // Clear all
        this.responseCache.clear();
        this.currentCacheSize = 0;
        
        // Clear from Redis
        await this.redisService.invalidatePattern('response:*');
      }

      this.customLogger.log('Response cache cleared', { pattern });
    } catch (error) {
      this.customLogger.error('Cache clear failed', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get API health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    metrics: PerformanceMetrics;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check for performance issues
    if (this.performanceMetrics.averageResponseTime > 1000) {
      issues.push('High average response time');
    }
    
    if (this.performanceMetrics.errorRate > 5) {
      issues.push('High error rate');
    }
    
    if (this.performanceMetrics.cacheHitRate < 30) {
      issues.push('Low cache hit rate');
    }
    
    if (this.currentCacheSize > this.responseCacheConfig.maxSize * 0.9) {
      issues.push('Cache memory usage high');
    }

    return {
      isHealthy: issues.length === 0,
      metrics: this.performanceMetrics,
      issues,
    };
  }

  private startMetricsCollection(): void {
    // Clean expired cache items every minute
    setInterval(() => {
      this.cleanExpiredCacheItems();
    }, 60000);

    // Log performance metrics every 5 minutes
    setInterval(() => {
      const metrics = this.getPerformanceMetrics();
      this.customLogger.log('API performance metrics', metrics);
    }, 300000);

    // Optimize settings every 15 minutes
    setInterval(async () => {
      try {
        await this.optimizeSettings();
      } catch (error) {
        this.customLogger.error('Automatic optimization failed', error instanceof Error ? error.stack : undefined);
      }
    }, 900000);
  }

  private cleanExpiredCacheItems(): void {
    const now = Date.now();
    let cleanedCount = 0;
    let freedMemory = 0;

    for (const [key, item] of this.responseCache.entries()) {
      if (now > item.expiry) {
        this.currentCacheSize -= item.size;
        freedMemory += item.size;
        this.responseCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.customLogger.debug('Cache cleanup completed', {
        cleanedItems: cleanedCount,
        freedMemory,
        remainingItems: this.responseCache.size,
      });
    }
  }
}