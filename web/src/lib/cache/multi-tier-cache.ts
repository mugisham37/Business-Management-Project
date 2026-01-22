import { InMemoryCache } from '@apollo/client';
import { apolloClient } from '@/lib/apollo/client';

/**
 * Multi-tier caching system that respects backend Redis patterns
 * Implements L1 (memory), L2 (IndexedDB), and L3 (network) caching tiers
 */

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tenantId?: string;
  priority: 'high' | 'medium' | 'low';
  accessCount: number;
  lastAccess: number;
}

export interface CacheTierConfig {
  maxSize: number;
  defaultTtl: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface CacheMetrics {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l3Hits: number;
  l3Misses: number;
  totalRequests: number;
  averageResponseTime: number;
  memoryUsage: number;
  evictionCount: number;
}

/**
 * L1 Cache - In-Memory Cache (fastest)
 */
class L1Cache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(config: CacheTierConfig) {
    this.maxSize = config.maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.metrics.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    this.metrics.hits++;
    return entry.data as T;
  }

  set<T>(key: string, data: T, options: {
    ttl?: number;
    tenantId?: string;
    priority?: 'high' | 'medium' | 'low';
  } = {}): void {
    const {
      ttl = 300000, // 5 minutes default
      tenantId,
      priority = 'medium'
    } = options;

    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      tenantId,
      priority,
      accessCount: 1,
      lastAccess: Date.now(),
    };

    this.cache.set(key, entry);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clearTenant(tenantId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tenantId === tenantId) {
        this.cache.delete(key);
      }
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestAccess = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess && entry.priority !== 'high') {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  private estimateMemoryUsage(): number {
    let size = 0;
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // UTF-16 characters
      size += JSON.stringify(entry.data).length * 2;
      size += 200; // Overhead for entry metadata
    }
    return size;
  }
}

/**
 * L2 Cache - IndexedDB Cache (persistent)
 */
class L2Cache {
  private dbName = 'GraphQLCache';
  private storeName = 'cacheEntries';
  private db: IDBDatabase | null = null;
  private metrics = {
    hits: 0,
    misses: 0,
    errors: 0,
  };

  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        this.metrics.errors++;
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('tenantId', 'tenantId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.createTransaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        
        if (!result) {
          this.metrics.misses++;
          resolve(null);
          return;
        }

        // Check TTL
        if (Date.now() > result.timestamp + result.ttl) {
          this.delete(key); // Async cleanup
          this.metrics.misses++;
          resolve(null);
          return;
        }

        this.metrics.hits++;
        resolve(result.data as T);
      };

      request.onerror = () => {
        this.metrics.errors++;
        resolve(null);
      };
    });
  }

  async set<T>(key: string, data: T, options: {
    ttl?: number;
    tenantId?: string;
    priority?: 'high' | 'medium' | 'low';
  } = {}): Promise<void> {
    if (!this.db) return;

    const {
      ttl = 3600000, // 1 hour default for L2
      tenantId,
      priority = 'medium'
    } = options;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.createTransaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const entry = {
        key,
        data,
        timestamp: Date.now(),
        ttl,
        tenantId,
        priority,
      };

      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        this.metrics.errors++;
        reject(new Error('Failed to store in IndexedDB'));
      };
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.createTransaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Ignore errors for cleanup
    });
  }

  async clearTenant(tenantId: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.createTransaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('tenantId');
      const request = index.openCursor(IDBKeyRange.only(tenantId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => resolve(); // Ignore errors
    });
  }

  async cleanup(): Promise<void> {
    if (!this.db) return;

    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

    return new Promise((resolve) => {
      const transaction = this.db!.createTransaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => resolve();
    });
  }

  getMetrics() {
    return this.metrics;
  }
}

/**
 * Multi-Tier Cache Manager
 */
export class MultiTierCache {
  private l1Cache: L1Cache;
  private l2Cache: L2Cache;
  private metrics: CacheMetrics = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    l3Hits: 0,
    l3Misses: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    evictionCount: 0,
  };

  private warmingQueue = new Set<string>();
  private criticalKeys = new Set<string>();

  constructor(config: {
    l1Config: CacheTierConfig;
    l2Config: CacheTierConfig;
  }) {
    this.l1Cache = new L1Cache(config.l1Config);
    this.l2Cache = new L2Cache();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.l2Cache.initialize();
      
      // Start periodic cleanup
      setInterval(() => {
        this.l2Cache.cleanup();
      }, 60 * 60 * 1000); // Every hour

      console.log('Multi-tier cache initialized successfully');
    } catch (error) {
      console.error('Failed to initialize multi-tier cache:', error);
    }
  }

  async get<T>(key: string, options: {
    tenantId?: string;
    fallbackLoader?: () => Promise<T>;
    priority?: 'high' | 'medium' | 'low';
  } = {}): Promise<T | null> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Try L1 cache first
      let result = this.l1Cache.get<T>(key);
      if (result !== null) {
        this.metrics.l1Hits++;
        this.updateResponseTime(Date.now() - startTime);
        return result;
      }
      this.metrics.l1Misses++;

      // Try L2 cache
      result = await this.l2Cache.get<T>(key);
      if (result !== null) {
        this.metrics.l2Hits++;
        
        // Promote to L1 cache
        this.l1Cache.set(key, result, {
          tenantId: options.tenantId,
          priority: options.priority,
        });
        
        this.updateResponseTime(Date.now() - startTime);
        return result;
      }
      this.metrics.l2Misses++;

      // Try network (L3) with fallback loader
      if (options.fallbackLoader) {
        result = await options.fallbackLoader();
        if (result !== null) {
          this.metrics.l3Hits++;
          
          // Store in both caches
          await this.set(key, result, {
            tenantId: options.tenantId,
            priority: options.priority,
          });
          
          this.updateResponseTime(Date.now() - startTime);
          return result;
        }
      }

      this.metrics.l3Misses++;
      this.updateResponseTime(Date.now() - startTime);
      return null;
    } catch (error) {
      console.error('Multi-tier cache get error:', error);
      this.updateResponseTime(Date.now() - startTime);
      return null;
    }
  }

  async set<T>(key: string, data: T, options: {
    tenantId?: string;
    priority?: 'high' | 'medium' | 'low';
    l1Ttl?: number;
    l2Ttl?: number;
  } = {}): Promise<void> {
    const { priority = 'medium' } = options;

    try {
      // Store in L1 cache
      this.l1Cache.set(key, data, {
        ttl: options.l1Ttl,
        tenantId: options.tenantId,
        priority,
      });

      // Store in L2 cache for persistence
      await this.l2Cache.set(key, data, {
        ttl: options.l2Ttl,
        tenantId: options.tenantId,
        priority,
      });

      // Mark as critical if high priority
      if (priority === 'high') {
        this.criticalKeys.add(key);
      }
    } catch (error) {
      console.error('Multi-tier cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    await this.l2Cache.delete(key);
    this.criticalKeys.delete(key);
  }

  async clearTenant(tenantId: string): Promise<void> {
    this.l1Cache.clearTenant(tenantId);
    await this.l2Cache.clearTenant(tenantId);
  }

  async warmCache(keys: Array<{
    key: string;
    loader: () => Promise<any>;
    priority?: 'high' | 'medium' | 'low';
    tenantId?: string;
  }>): Promise<void> {
    const warmingPromises = keys.map(async ({ key, loader, priority, tenantId }) => {
      if (this.warmingQueue.has(key)) return;
      
      this.warmingQueue.add(key);
      
      try {
        const data = await loader();
        await this.set(key, data, { priority, tenantId });
      } catch (error) {
        console.error(`Cache warming failed for key ${key}:`, error);
      } finally {
        this.warmingQueue.delete(key);
      }
    });

    await Promise.allSettled(warmingPromises);
  }

  getMetrics(): CacheMetrics & {
    l1Stats: any;
    l2Stats: any;
    criticalKeysCount: number;
    warmingQueueSize: number;
  } {
    const l1Stats = this.l1Cache.getMetrics();
    const l2Stats = this.l2Cache.getMetrics();

    return {
      ...this.metrics,
      memoryUsage: l1Stats.memoryUsage,
      evictionCount: l1Stats.evictions,
      l1Stats,
      l2Stats,
      criticalKeysCount: this.criticalKeys.size,
      warmingQueueSize: this.warmingQueue.size,
    };
  }

  private updateResponseTime(responseTime: number): void {
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * 0.9) + (responseTime * 0.1);
  }
}

// Singleton instance
let multiTierCacheInstance: MultiTierCache | null = null;

export function getMultiTierCache(): MultiTierCache {
  if (!multiTierCacheInstance) {
    multiTierCacheInstance = new MultiTierCache({
      l1Config: {
        maxSize: 1000,
        defaultTtl: 300000, // 5 minutes
        compressionEnabled: false,
        encryptionEnabled: false,
      },
      l2Config: {
        maxSize: 10000,
        defaultTtl: 3600000, // 1 hour
        compressionEnabled: true,
        encryptionEnabled: false,
      },
    });
  }
  
  return multiTierCacheInstance;
}