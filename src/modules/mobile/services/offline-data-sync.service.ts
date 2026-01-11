import { Injectable, Logger } from '@nestjs/common';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';

export interface OfflineDataItem {
  id: string;
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
  maxRetries: number;
  conflictResolution: 'client-wins' | 'server-wins' | 'merge' | 'manual';
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  conflicts: number;
  totalTime: number;
  errors: string[];
}

export interface OfflineSyncOptions {
  batchSize: number;
  maxRetries: number;
  conflictResolution: 'client-wins' | 'server-wins' | 'merge' | 'manual';
  prioritizeByType: boolean;
  intelligentScheduling: boolean;
}

@Injectable()
export class OfflineDataSyncService {
  private readonly logger = new Logger(OfflineDataSyncService.name);
  private readonly syncQueue = new Map<string, OfflineDataItem[]>();
  private readonly syncInProgress = new Set<string>();

  constructor(
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Queue data for offline synchronization
   */
  async queueForSync(
    tenantId: string,
    userId: string,
    entityType: string,
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    data: any,
    priority: 'high' | 'medium' | 'low' = 'medium',
  ): Promise<void> {
    const queueKey = `${tenantId}:${userId}`;
    
    const offlineItem: OfflineDataItem = {
      id: `${entityType}_${entityId}_${Date.now()}`,
      tenantId,
      userId,
      entityType,
      entityId,
      operation,
      data,
      timestamp: new Date(),
      priority,
      retryCount: 0,
      maxRetries: 3,
      conflictResolution: 'merge',
    };

    // Add to in-memory queue
    if (!this.syncQueue.has(queueKey)) {
      this.syncQueue.set(queueKey, []);
    }
    this.syncQueue.get(queueKey)!.push(offlineItem);

    // Persist to cache for durability
    await this.persistOfflineQueue(queueKey);

    this.logger.debug(
      `Queued ${operation} operation for ${entityType}:${entityId} (priority: ${priority})`,
    );

    // Trigger sync if online
    if (await this.isOnline()) {
      this.triggerSync(tenantId, userId);
    }
  }

  /**
   * Synchronize offline data when connection is restored
   */
  async synchronizeOfflineData(
    tenantId: string,
    userId: string,
    options: Partial<OfflineSyncOptions> = {},
  ): Promise<SyncResult> {
    const queueKey = `${tenantId}:${userId}`;
    const startTime = Date.now();

    // Prevent concurrent sync for same user
    if (this.syncInProgress.has(queueKey)) {
      this.logger.warn(`Sync already in progress for ${queueKey}`);
      return {
        success: false,
        syncedItems: 0,
        failedItems: 0,
        conflicts: 0,
        totalTime: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.syncInProgress.add(queueKey);

    try {
      const syncOptions: OfflineSyncOptions = {
        batchSize: 10,
        maxRetries: 3,
        conflictResolution: 'merge',
        prioritizeByType: true,
        intelligentScheduling: true,
        ...options,
      };

      // Load offline queue
      await this.loadOfflineQueue(queueKey);
      const offlineItems = this.syncQueue.get(queueKey) || [];

      if (offlineItems.length === 0) {
        this.logger.debug(`No offline data to sync for ${queueKey}`);
        return {
          success: true,
          syncedItems: 0,
          failedItems: 0,
          conflicts: 0,
          totalTime: Date.now() - startTime,
          errors: [],
        };
      }

      this.logger.log(`Starting sync of ${offlineItems.length} items for ${queueKey}`);

      // Sort items by priority and timestamp
      const sortedItems = this.sortItemsForSync(offlineItems, syncOptions);

      let syncedItems = 0;
      let failedItems = 0;
      let conflicts = 0;
      const errors: string[] = [];

      // Process items in batches
      for (let i = 0; i < sortedItems.length; i += syncOptions.batchSize) {
        const batch = sortedItems.slice(i, i + syncOptions.batchSize);
        
        const batchResults = await Promise.allSettled(
          batch.map(item => this.syncSingleItem(item, syncOptions)),
        );

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const item = batch[j];

          if (result.status === 'fulfilled') {
            if (result.value.success) {
              syncedItems++;
              // Remove from queue
              this.removeFromQueue(queueKey, item.id);
            } else if (result.value.conflict) {
              conflicts++;
              errors.push(`Conflict in ${item.entityType}:${item.entityId}`);
            } else {
              failedItems++;
              errors.push(`Failed to sync ${item.entityType}:${item.entityId}: ${result.value.error}`);
              
              // Retry logic
              item.retryCount++;
              if (item.retryCount >= item.maxRetries) {
                this.removeFromQueue(queueKey, item.id);
                this.logger.error(`Max retries reached for ${item.entityType}:${item.entityId}`);
              }
            }
          } else {
            failedItems++;
            errors.push(`Sync error for ${item.entityType}:${item.entityId}: ${result.reason}`);
          }
        }

        // Small delay between batches to prevent overwhelming the server
        if (i + syncOptions.batchSize < sortedItems.length) {
          await this.delay(100);
        }
      }

      // Persist updated queue
      await this.persistOfflineQueue(queueKey);

      const totalTime = Date.now() - startTime;
      const success = failedItems === 0 && conflicts === 0;

      this.logger.log(
        `Sync completed for ${queueKey}: ${syncedItems} synced, ${failedItems} failed, ` +
        `${conflicts} conflicts in ${totalTime}ms`,
      );

      return {
        success,
        syncedItems,
        failedItems,
        conflicts,
        totalTime,
        errors,
      };
    } catch (error) {
      this.logger.error(`Sync failed for ${queueKey}: ${error.message}`, error.stack);
      return {
        success: false,
        syncedItems: 0,
        failedItems: 0,
        conflicts: 0,
        totalTime: Date.now() - startTime,
        errors: [error.message],
      };
    } finally {
      this.syncInProgress.delete(queueKey);
    }
  }

  /**
   * Get offline sync status
   */
  async getSyncStatus(tenantId: string, userId: string): Promise<{
    queuedItems: number;
    syncInProgress: boolean;
    lastSyncTime: Date | null;
    estimatedSyncTime: number;
  }> {
    const queueKey = `${tenantId}:${userId}`;
    await this.loadOfflineQueue(queueKey);
    
    const queuedItems = this.syncQueue.get(queueKey)?.length || 0;
    const syncInProgress = this.syncInProgress.has(queueKey);
    
    // Get last sync time from cache
    const lastSyncTime = await this.cacheService.get<Date>(`sync:last:${queueKey}`);
    
    // Estimate sync time based on queue size (rough estimate: 100ms per item)
    const estimatedSyncTime = queuedItems * 100;

    return {
      queuedItems,
      syncInProgress,
      lastSyncTime,
      estimatedSyncTime,
    };
  }

  /**
   * Clear offline queue (use with caution)
   */
  async clearOfflineQueue(tenantId: string, userId: string): Promise<void> {
    const queueKey = `${tenantId}:${userId}`;
    this.syncQueue.delete(queueKey);
    await this.cacheService.invalidatePattern(`offline:queue:${queueKey}*`);
    this.logger.warn(`Cleared offline queue for ${queueKey}`);
  }

  /**
   * Sync a single item
   */
  private async syncSingleItem(
    item: OfflineDataItem,
    options: OfflineSyncOptions,
  ): Promise<{ success: boolean; conflict?: boolean; error?: string }> {
    try {
      // Simulate API call to sync item
      // In real implementation, this would call the appropriate service
      const syncResult = await this.performSyncOperation(item);
      
      if (syncResult.conflict) {
        // Handle conflict based on resolution strategy
        const resolved = await this.resolveConflict(item, syncResult.serverData, options.conflictResolution);
        return { success: resolved, conflict: !resolved };
      }

      return { success: syncResult.success, error: syncResult.error };
    } catch (error) {
      this.logger.error(`Failed to sync item ${item.id}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform the actual sync operation (mock implementation)
   */
  private async performSyncOperation(item: OfflineDataItem): Promise<{
    success: boolean;
    conflict?: boolean;
    serverData?: any;
    error?: string;
  }> {
    // Simulate network delay
    await this.delay(50 + Math.random() * 100);

    // Simulate different outcomes
    const random = Math.random();
    
    if (random < 0.1) {
      // 10% chance of conflict
      return {
        success: false,
        conflict: true,
        serverData: { ...item.data, serverModified: true },
      };
    } else if (random < 0.05) {
      // 5% chance of error
      return {
        success: false,
        error: 'Server error during sync',
      };
    } else {
      // 85% chance of success
      return { success: true };
    }
  }

  /**
   * Resolve data conflicts
   */
  private async resolveConflict(
    item: OfflineDataItem,
    serverData: any,
    strategy: 'client-wins' | 'server-wins' | 'merge' | 'manual',
  ): Promise<boolean> {
    switch (strategy) {
      case 'client-wins':
        // Client data takes precedence
        return true;
      
      case 'server-wins':
        // Server data takes precedence, update local data
        item.data = serverData;
        return true;
      
      case 'merge':
        // Attempt to merge data
        item.data = { ...serverData, ...item.data };
        return true;
      
      case 'manual':
        // Requires manual resolution - queue for user review
        await this.queueForManualResolution(item, serverData);
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Queue item for manual conflict resolution
   */
  private async queueForManualResolution(item: OfflineDataItem, serverData: any): Promise<void> {
    const conflictKey = `conflict:${item.tenantId}:${item.userId}:${item.id}`;
    
    await this.cacheService.set(conflictKey, {
      item,
      serverData,
      timestamp: new Date(),
    }, 86400); // 24 hours

    this.logger.warn(`Queued conflict for manual resolution: ${conflictKey}`);
  }

  /**
   * Sort items for optimal sync order
   */
  private sortItemsForSync(items: OfflineDataItem[], options: OfflineSyncOptions): OfflineDataItem[] {
    return items.sort((a, b) => {
      // Priority first
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      // Then by entity type if prioritizeByType is enabled
      if (options.prioritizeByType) {
        const typeOrder = { transaction: 1, customer: 2, product: 3, other: 4 };
        const aTypeOrder = typeOrder[a.entityType] || typeOrder.other;
        const bTypeOrder = typeOrder[b.entityType] || typeOrder.other;
        
        if (aTypeOrder !== bTypeOrder) {
          return aTypeOrder - bTypeOrder;
        }
      }

      // Finally by timestamp (oldest first)
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }

  /**
   * Persist offline queue to cache
   */
  private async persistOfflineQueue(queueKey: string): Promise<void> {
    const items = this.syncQueue.get(queueKey) || [];
    await this.cacheService.set(`offline:queue:${queueKey}`, items, 86400); // 24 hours
  }

  /**
   * Load offline queue from cache
   */
  private async loadOfflineQueue(queueKey: string): Promise<void> {
    if (!this.syncQueue.has(queueKey)) {
      const cachedItems = await this.cacheService.get<OfflineDataItem[]>(`offline:queue:${queueKey}`);
      this.syncQueue.set(queueKey, cachedItems || []);
    }
  }

  /**
   * Remove item from queue
   */
  private removeFromQueue(queueKey: string, itemId: string): void {
    const items = this.syncQueue.get(queueKey) || [];
    const filteredItems = items.filter(item => item.id !== itemId);
    this.syncQueue.set(queueKey, filteredItems);
  }

  /**
   * Trigger sync in background
   */
  private triggerSync(tenantId: string, userId: string): void {
    // Use queue service to trigger sync in background
    this.queueService.add('offline-sync', {
      tenantId,
      userId,
      timestamp: Date.now(),
    }, {
      delay: 1000, // 1 second delay
      attempts: 3,
    });
  }

  /**
   * Check if device is online
   */
  private async isOnline(): Promise<boolean> {
    // In a real implementation, this would check network connectivity
    // For now, we'll assume online
    return true;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}