import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';

export interface StorageOptions {
  ttl?: number; // Time to live in hours
  priority?: 'low' | 'medium' | 'high';
  compress?: boolean;
}

export interface StorageStats {
  totalItems: number;
  totalSize: number; // in bytes
  categories: Record<string, { count: number; size: number }>;
  lastUpdated: Date;
}

export interface SyncMetadata {
  lastFullSync?: Date;
  lastIncrementalSync?: Date;
  syncVersion: number;
  pendingOperations: number;
  failedOperations: number;
}

@Injectable()
export class OfflineStorageService {
  private readonly logger = new Logger(OfflineStorageService.name);
  private readonly CACHE_PREFIX = 'offline_storage';
  private readonly METADATA_KEY = 'sync_metadata';

  constructor(private readonly cacheService: CacheService) {}

  async storeItem<T>(
    tenantId: string,
    category: string,
    itemId: string,
    data: T,
    options: StorageOptions = {},
  ): Promise<void> {
    const key = this.buildKey(tenantId, category, itemId);
    const ttl = options.ttl ? options.ttl * 3600 : 24 * 3600; // Default 24 hours

    const storageItem = {
      data,
      metadata: {
        category,
        itemId,
        priority: options.priority || 'medium',
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + ttl * 1000),
        size: this.calculateSize(data),
      },
    };

    await this.cacheService.set(key, storageItem, { ttl });
    await this.updateStorageStats(tenantId, category, 1, storageItem.metadata.size);

    this.logger.debug(`Stored item ${itemId} in category ${category} for tenant ${tenantId}`);
  }

  async getItem<T>(
    tenantId: string,
    category: string,
    itemId: string,
  ): Promise<T | null> {
    const key = this.buildKey(tenantId, category, itemId);
    const storageItem = await this.cacheService.get<any>(key);

    if (!storageItem) {
      return null;
    }

    // Check if item has expired
    if (new Date() > new Date(storageItem.metadata.expiresAt)) {
      await this.removeItem(tenantId, category, itemId);
      return null;
    }

    return storageItem.data;
  }

  async getItemsByCategory<T>(
    tenantId: string,
    category: string,
    limit?: number,
  ): Promise<T[]> {
    const pattern = this.buildKey(tenantId, category, '*');
    const keys = await this.cacheService.getKeysByPattern(pattern);

    const items: T[] = [];
    let count = 0;

    for (const key of keys) {
      if (limit && count >= limit) break;

      const storageItem = await this.cacheService.get<any>(key);
      if (storageItem && new Date() <= new Date(storageItem.metadata.expiresAt)) {
        items.push(storageItem.data);
        count++;
      }
    }

    return items;
  }

  async removeItem(
    tenantId: string,
    category: string,
    itemId: string,
  ): Promise<boolean> {
    const key = this.buildKey(tenantId, category, itemId);
    const storageItem = await this.cacheService.get<any>(key);

    if (storageItem) {
      await this.cacheService.del(key);
      await this.updateStorageStats(tenantId, category, -1, -storageItem.metadata.size);
      return true;
    }

    return false;
  }

  async clearCategory(tenantId: string, category: string): Promise<number> {
    const pattern = this.buildKey(tenantId, category, '*');
    const keys = await this.cacheService.getKeysByPattern(pattern);

    let clearedCount = 0;
    let totalSize = 0;

    for (const key of keys) {
      const storageItem = await this.cacheService.get<any>(key);
      if (storageItem) {
        totalSize += storageItem.metadata.size;
        clearedCount++;
      }
      await this.cacheService.del(key);
    }

    await this.updateStorageStats(tenantId, category, -clearedCount, -totalSize);

    this.logger.log(`Cleared ${clearedCount} items from category ${category} for tenant ${tenantId}`);
    return clearedCount;
  }

  async clearTenant(tenantId: string): Promise<number> {
    const pattern = this.buildKey(tenantId, '*', '*');
    const keys = await this.cacheService.getKeysByPattern(pattern);

    let clearedCount = 0;

    for (const key of keys) {
      await this.cacheService.del(key);
      clearedCount++;
    }

    // Clear storage stats
    const statsKey = this.buildKey(tenantId, 'stats', 'storage');
    await this.cacheService.del(statsKey);

    this.logger.log(`Cleared ${clearedCount} items for tenant ${tenantId}`);
    return clearedCount;
  }

  async getStorageStats(tenantId: string): Promise<StorageStats> {
    const statsKey = this.buildKey(tenantId, 'stats', 'storage');
    const stats = await this.cacheService.get<StorageStats>(statsKey);

    if (stats) {
      return stats;
    }

    // Calculate stats if not cached
    return this.calculateStorageStats(tenantId);
  }

  async getSyncMetadata(tenantId: string): Promise<SyncMetadata> {
    const metadataKey = this.buildKey(tenantId, 'metadata', this.METADATA_KEY);
    const metadata = await this.cacheService.get<SyncMetadata>(metadataKey);

    return metadata || {
      syncVersion: 1,
      pendingOperations: 0,
      failedOperations: 0,
    };
  }

  async updateSyncMetadata(
    tenantId: string,
    updates: Partial<SyncMetadata>,
  ): Promise<void> {
    const current = await this.getSyncMetadata(tenantId);
    const updated = { ...current, ...updates };

    const metadataKey = this.buildKey(tenantId, 'metadata', this.METADATA_KEY);
    await this.cacheService.set(metadataKey, updated, { ttl: 7 * 24 * 3600 }); // 7 days TTL
  }

  async compactStorage(tenantId: string): Promise<{
    removedItems: number;
    freedSpace: number;
  }> {
    const pattern = this.buildKey(tenantId, '*', '*');
    const keys = await this.cacheService.getKeysByPattern(pattern);

    let removedItems = 0;
    let freedSpace = 0;

    for (const key of keys) {
      const storageItem = await this.cacheService.get<any>(key);
      
      if (storageItem) {
        // Remove expired items
        if (new Date() > new Date(storageItem.metadata.expiresAt)) {
          freedSpace += storageItem.metadata.size;
          removedItems++;
          await this.cacheService.del(key);
        }
      }
    }

    this.logger.log(`Compacted storage for tenant ${tenantId}: removed ${removedItems} items, freed ${freedSpace} bytes`);

    return { removedItems, freedSpace };
  }

  private buildKey(tenantId: string, category: string, itemId: string): string {
    return `${this.CACHE_PREFIX}:${tenantId}:${category}:${itemId}`;
  }

  private calculateSize(data: any): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(data).length * 2; // UTF-16 encoding approximation
  }

  private async updateStorageStats(
    tenantId: string,
    category: string,
    itemDelta: number,
    sizeDelta: number,
  ): Promise<void> {
    const statsKey = this.buildKey(tenantId, 'stats', 'storage');
    const currentStats = await this.cacheService.get<StorageStats>(statsKey) || {
      totalItems: 0,
      totalSize: 0,
      categories: {},
      lastUpdated: new Date(),
    };

    // Update totals
    currentStats.totalItems += itemDelta;
    currentStats.totalSize += sizeDelta;
    currentStats.lastUpdated = new Date();

    // Update category stats
    if (!currentStats.categories[category]) {
      currentStats.categories[category] = { count: 0, size: 0 };
    }

    currentStats.categories[category].count += itemDelta;
    currentStats.categories[category].size += sizeDelta;

    // Remove category if count reaches 0
    if (currentStats.categories[category].count <= 0) {
      delete currentStats.categories[category];
    }

    await this.cacheService.set(statsKey, currentStats, { ttl: 24 * 3600 }); // 24 hours TTL
  }

  private async calculateStorageStats(tenantId: string): Promise<StorageStats> {
    const pattern = this.buildKey(tenantId, '*', '*');
    const keys = await this.cacheService.getKeysByPattern(pattern);

    const stats: StorageStats = {
      totalItems: 0,
      totalSize: 0,
      categories: {},
      lastUpdated: new Date(),
    };

    for (const key of keys) {
      const storageItem = await this.cacheService.get<any>(key);
      
      if (storageItem && storageItem.metadata) {
        const category = storageItem.metadata.category;
        
        stats.totalItems++;
        stats.totalSize += storageItem.metadata.size;

        if (!stats.categories[category]) {
          stats.categories[category] = { count: 0, size: 0 };
        }

        stats.categories[category].count++;
        stats.categories[category].size += storageItem.metadata.size;
      }
    }

    // Cache the calculated stats
    const statsKey = this.buildKey(tenantId, 'stats', 'storage');
    await this.cacheService.set(statsKey, stats, { ttl: 24 * 3600 });

    return stats;
  }
}