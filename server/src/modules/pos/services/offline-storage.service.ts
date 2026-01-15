import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OfflineStorageItem {
  key: string;
  data: any;
  timestamp: Date;
  expiresAt?: Date;
  version: number;
  checksum: string;
}

export interface StorageStats {
  totalItems: number;
  totalSize: number;
  categories: Record<string, { count: number; size: number }>;
  lastUpdated: Date;
}

export interface SyncMetadata {
  lastSyncAt: Date;
  syncVersion: number;
  pendingChanges: number;
  conflictCount: number;
}

@Injectable()
export class OfflineStorageService {
  private readonly logger = new Logger(OfflineStorageService.name);
  private readonly maxStorageSize: number;
  private readonly defaultTTL: number;
  private storage: Map<string, OfflineStorageItem> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.maxStorageSize = this.configService.get<number>('OFFLINE_MAX_STORAGE_MB') || 50; // 50MB default
    this.defaultTTL = this.configService.get<number>('OFFLINE_DEFAULT_TTL_HOURS') || 24; // 24 hours default
  }

  async storeItem(
    tenantId: string,
    category: string,
    itemId: string,
    data: any,
    options: {
      ttl?: number; // Time to live in hours
      version?: number;
      priority?: 'high' | 'medium' | 'low';
    } = {},
  ): Promise<void> {
    const key = this.generateKey(tenantId, category, itemId);
    const ttlHours = options.ttl || this.defaultTTL;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    
    const item: OfflineStorageItem = {
      key,
      data,
      timestamp: new Date(),
      expiresAt,
      version: options.version || 1,
      checksum: this.calculateChecksum(data),
    };

    // Check storage limits before storing
    await this.enforceStorageLimits();
    
    this.storage.set(key, item);
    
    this.logger.debug(`Stored offline item: ${key} (expires: ${expiresAt.toISOString()})`);
  }

  async getItem<T>(
    tenantId: string,
    category: string,
    itemId: string,
  ): Promise<T | null> {
    const key = this.generateKey(tenantId, category, itemId);
    const item = this.storage.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if item has expired
    if (item.expiresAt && item.expiresAt < new Date()) {
      this.storage.delete(key);
      this.logger.debug(`Removed expired offline item: ${key}`);
      return null;
    }
    
    // Verify data integrity
    const currentChecksum = this.calculateChecksum(item.data);
    if (currentChecksum !== item.checksum) {
      this.logger.warn(`Data corruption detected for offline item: ${key}`);
      this.storage.delete(key);
      return null;
    }
    
    return item.data as T;
  }

  async getItemsByCategory<T>(
    tenantId: string,
    category: string,
    options: {
      limit?: number;
      offset?: number;
      includeExpired?: boolean;
    } = {},
  ): Promise<T[]> {
    const prefix = this.generateKey(tenantId, category, '');
    const items: T[] = [];
    
    let count = 0;
    const offset = options.offset || 0;
    const limit = options.limit || 1000;
    
    for (const [key, item] of this.storage.entries()) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      
      // Skip expired items unless explicitly requested
      if (!options.includeExpired && item.expiresAt && item.expiresAt < new Date()) {
        continue;
      }
      
      if (count >= offset && items.length < limit) {
        items.push(item.data as T);
      }
      
      count++;
    }
    
    return items;
  }

  async removeItem(
    tenantId: string,
    category: string,
    itemId: string,
  ): Promise<boolean> {
    const key = this.generateKey(tenantId, category, itemId);
    const deleted = this.storage.delete(key);
    
    if (deleted) {
      this.logger.debug(`Removed offline item: ${key}`);
    }
    
    return deleted;
  }

  async clearCategory(
    tenantId: string,
    category: string,
  ): Promise<number> {
    const prefix = this.generateKey(tenantId, category, '');
    let removedCount = 0;
    
    for (const key of this.storage.keys()) {
      if (key.startsWith(prefix)) {
        this.storage.delete(key);
        removedCount++;
      }
    }
    
    this.logger.log(`Cleared ${removedCount} items from category: ${category}`);
    return removedCount;
  }

  async clearTenant(tenantId: string): Promise<number> {
    const prefix = `${tenantId}:`;
    let removedCount = 0;
    
    for (const key of this.storage.keys()) {
      if (key.startsWith(prefix)) {
        this.storage.delete(key);
        removedCount++;
      }
    }
    
    this.logger.log(`Cleared ${removedCount} items for tenant: ${tenantId}`);
    return removedCount;
  }

  async getStorageStats(tenantId: string): Promise<StorageStats> {
    const prefix = `${tenantId}:`;
    const categories: Record<string, { count: number; size: number }> = {};
    let totalItems = 0;
    let totalSize = 0;
    let lastUpdated = new Date(0);
    
    for (const [key, item] of this.storage.entries()) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      
      const category = this.extractCategory(key);
      const itemSize = this.calculateItemSize(item);
      
      if (!categories[category]) {
        categories[category] = { count: 0, size: 0 };
      }
      
      const categoryData = categories[category];
      if (categoryData) {
        categoryData.count++;
        categoryData.size += itemSize;
      }
      totalItems++;
      totalSize += itemSize;
      
      if (item.timestamp > lastUpdated) {
        lastUpdated = item.timestamp;
      }
    }
    
    return {
      totalItems,
      totalSize,
      categories,
      lastUpdated,
    };
  }

  async getSyncMetadata(tenantId: string): Promise<SyncMetadata> {
    // In a real implementation, this would track sync metadata
    return {
      lastSyncAt: new Date(),
      syncVersion: 1,
      pendingChanges: 0,
      conflictCount: 0,
    };
  }

  async cleanupExpiredItems(tenantId?: string): Promise<number> {
    const now = new Date();
    let removedCount = 0;
    
    for (const [key, item] of this.storage.entries()) {
      if (tenantId && !key.startsWith(`${tenantId}:`)) {
        continue;
      }
      
      if (item.expiresAt && item.expiresAt < now) {
        this.storage.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.logger.log(`Cleaned up ${removedCount} expired items`);
    }
    
    return removedCount;
  }

  async compactStorage(tenantId?: string): Promise<{
    itemsRemoved: number;
    spaceFreed: number;
  }> {
    const beforeSize = this.storage.size;
    
    // Remove expired items
    const expiredRemoved = await this.cleanupExpiredItems(tenantId);
    
    // Remove duplicate or corrupted items
    let corruptedRemoved = 0;
    const keysToRemove: string[] = [];
    
    for (const [key, item] of this.storage.entries()) {
      if (tenantId && !key.startsWith(`${tenantId}:`)) {
        continue;
      }
      
      const currentChecksum = this.calculateChecksum(item.data);
      if (currentChecksum !== item.checksum) {
        keysToRemove.push(key);
        corruptedRemoved++;
      }
    }
    
    keysToRemove.forEach(key => this.storage.delete(key));
    
    const afterSize = this.storage.size;
    const totalRemoved = expiredRemoved + corruptedRemoved;
    
    this.logger.log(`Storage compaction completed: ${totalRemoved} items removed`);
    
    return {
      itemsRemoved: totalRemoved,
      spaceFreed: beforeSize - afterSize,
    };
  }

  private generateKey(tenantId: string, category: string, itemId: string): string {
    return `${tenantId}:${category}:${itemId}`;
  }

  private extractCategory(key: string): string {
    const parts = key.split(':');
    return parts.length >= 2 ? parts[1] || 'unknown' : 'unknown';
  }

  private calculateChecksum(data: any): string {
    // Simple checksum calculation (in production, use a proper hash function)
    const jsonString = JSON.stringify(data);
    let hash = 0;
    
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  private calculateItemSize(item: OfflineStorageItem): number {
    // Estimate size in bytes
    const jsonString = JSON.stringify(item);
    return new Blob([jsonString]).size;
  }

  private async enforceStorageLimits(): Promise<void> {
    const maxSizeBytes = this.maxStorageSize * 1024 * 1024; // Convert MB to bytes
    let currentSize = 0;
    
    // Calculate current storage size
    for (const item of this.storage.values()) {
      currentSize += this.calculateItemSize(item);
    }
    
    // If over limit, remove oldest items
    if (currentSize > maxSizeBytes) {
      const items = Array.from(this.storage.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      let removedSize = 0;
      let removedCount = 0;
      
      for (const [key, item] of items) {
        if (currentSize - removedSize <= maxSizeBytes * 0.8) { // Keep 20% buffer
          break;
        }
        
        removedSize += this.calculateItemSize(item);
        this.storage.delete(key);
        removedCount++;
      }
      
      if (removedCount > 0) {
        this.logger.warn(`Storage limit exceeded. Removed ${removedCount} oldest items (${removedSize} bytes)`);
      }
    }
  }
}