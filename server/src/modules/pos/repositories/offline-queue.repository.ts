import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { OfflineTransactionQueue } from '../entities/transaction.entity';

@Injectable()
export class OfflineQueueRepository {
  private readonly logger = new Logger(OfflineQueueRepository.name);

  constructor(private readonly drizzle: DrizzleService) {}

  async create(
    tenantId: string,
    queueData: {
      queueId: string;
      deviceId: string;
      transactionData: Record<string, any>;
      operationType: string;
      priority?: number;
    },
    userId: string,
  ): Promise<OfflineTransactionQueue> {
    this.logger.log(`Creating offline queue item ${queueData.queueId} for device ${queueData.deviceId}`);

    // Get next sequence number
    const sequenceNumber = await this.getNextSequenceNumber(tenantId, queueData.deviceId);

    const queueItem: OfflineTransactionQueue = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      queueId: queueData.queueId,
      deviceId: queueData.deviceId,
      transactionData: queueData.transactionData,
      operationType: queueData.operationType,
      isSynced: false,
      syncAttempts: 0,
      syncErrors: [],
      priority: queueData.priority || 5,
      sequenceNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
      version: 1,
      isActive: true,
    };

    // In a real implementation, this would use Drizzle ORM to insert into database
    await this.simulateDbOperation('insert', 'offline_transaction_queue', queueItem);

    this.logger.log(`Created offline queue item ${queueItem.id}`);
    return queueItem;
  }

  async findPendingSync(
    tenantId: string,
    limit: number = 50,
    deviceId?: string,
  ): Promise<OfflineTransactionQueue[]> {
    this.logger.debug(`Finding pending sync operations for tenant ${tenantId}${deviceId ? `, device ${deviceId}` : ''}`);

    const queueItems = await this.simulateDbOperation('findMany', 'offline_transaction_queue', {
      tenantId,
      deviceId,
      isSynced: false,
      limit,
    }) as OfflineTransactionQueue[];

    return queueItems.sort((a, b) => {
      // Sort by priority (lower number = higher priority), then by sequence
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.sequenceNumber - b.sequenceNumber;
    });
  }

  async markAsSynced(
    tenantId: string,
    queueId: string,
    userId: string,
  ): Promise<OfflineTransactionQueue | null> {
    this.logger.log(`Marking queue item ${queueId} as synced`);

    const queueItem = await this.findByQueueId(tenantId, queueId);
    if (!queueItem) {
      return null;
    }

    const updatedItem: OfflineTransactionQueue = {
      ...queueItem,
      isSynced: true,
      syncedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: userId,
      version: queueItem.version + 1,
    };

    await this.simulateDbOperation('update', 'offline_transaction_queue', updatedItem);

    this.logger.log(`Marked queue item ${queueId} as synced`);
    return updatedItem;
  }

  async incrementSyncAttempts(
    tenantId: string,
    queueId: string,
    error: any,
    userId: string,
  ): Promise<OfflineTransactionQueue | null> {
    this.logger.log(`Incrementing sync attempts for queue item ${queueId}`);

    const queueItem = await this.findByQueueId(tenantId, queueId);
    if (!queueItem) {
      return null;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const updatedErrors = [...queueItem.syncErrors, {
      attempt: queueItem.syncAttempts + 1,
      error: errorMessage,
      timestamp: new Date(),
    }];

    const updatedItem: OfflineTransactionQueue = {
      ...queueItem,
      syncAttempts: queueItem.syncAttempts + 1,
      lastSyncAttempt: new Date(),
      syncErrors: updatedErrors,
      updatedAt: new Date(),
      updatedBy: userId,
      version: queueItem.version + 1,
    };

    await this.simulateDbOperation('update', 'offline_transaction_queue', updatedItem);

    this.logger.log(`Incremented sync attempts for queue item ${queueId} to ${updatedItem.syncAttempts}`);
    return updatedItem;
  }

  async findByQueueId(tenantId: string, queueId: string): Promise<OfflineTransactionQueue | null> {
    this.logger.debug(`Finding queue item ${queueId} for tenant ${tenantId}`);

    const queueItem = await this.simulateDbOperation('findOne', 'offline_transaction_queue', {
      tenantId,
      queueId,
    });

    return queueItem as OfflineTransactionQueue | null;
  }

  async findByDeviceId(
    tenantId: string,
    deviceId: string,
    options: {
      limit?: number;
      offset?: number;
      includesSynced?: boolean;
    } = {},
  ): Promise<{ queueItems: OfflineTransactionQueue[]; total: number }> {
    this.logger.debug(`Finding queue items for device ${deviceId}`);

    const queueItems = await this.simulateDbOperation('findMany', 'offline_transaction_queue', {
      tenantId,
      deviceId,
      ...options,
    }) as OfflineTransactionQueue[];

    const total = queueItems.length;

    return {
      queueItems: queueItems.slice(0, options.limit || 50),
      total,
    };
  }

  async getQueueStats(
    tenantId: string,
    deviceId?: string,
  ): Promise<{
    totalOperations: number;
    pendingOperations: number;
    syncedOperations: number;
    failedOperations: number;
    averageSyncAttempts: number;
  }> {
    this.logger.debug(`Getting queue stats for tenant ${tenantId}${deviceId ? `, device ${deviceId}` : ''}`);

    const queueItems = await this.simulateDbOperation('findMany', 'offline_transaction_queue', {
      tenantId,
      deviceId,
    }) as OfflineTransactionQueue[];

    const stats = {
      totalOperations: queueItems.length,
      pendingOperations: queueItems.filter(item => !item.isSynced).length,
      syncedOperations: queueItems.filter(item => item.isSynced).length,
      failedOperations: queueItems.filter(item => item.syncAttempts > 0 && !item.isSynced).length,
      averageSyncAttempts: 0,
    };

    if (queueItems.length > 0) {
      const totalAttempts = queueItems.reduce((sum, item) => sum + item.syncAttempts, 0);
      stats.averageSyncAttempts = totalAttempts / queueItems.length;
    }

    return stats;
  }

  async cleanupSyncedItems(
    tenantId: string,
    olderThanDays: number = 7,
  ): Promise<number> {
    this.logger.log(`Cleaning up synced items older than ${olderThanDays} days for tenant ${tenantId}`);

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    // In a real implementation, this would delete old synced items
    const deletedCount = await this.simulateDbOperation('deleteMany', 'offline_transaction_queue', {
      tenantId,
      isSynced: true,
      syncedAt: { lt: cutoffDate },
    });

    this.logger.log(`Cleaned up ${deletedCount} synced queue items`);
    return deletedCount as number;
  }

  async delete(tenantId: string, queueId: string, userId: string): Promise<boolean> {
    this.logger.log(`Deleting queue item ${queueId}`);

    const queueItem = await this.findByQueueId(tenantId, queueId);
    if (!queueItem) {
      return false;
    }

    // Soft delete
    const updatedItem: OfflineTransactionQueue = {
      ...queueItem,
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: userId,
      version: queueItem.version + 1,
      isActive: false,
    };

    await this.simulateDbOperation('update', 'offline_transaction_queue', updatedItem);

    this.logger.log(`Deleted queue item ${queueId}`);
    return true;
  }

  private async getNextSequenceNumber(tenantId: string, deviceId: string): Promise<number> {
    // In a real implementation, this would get the next sequence number for the device
    // For now, simulate with timestamp-based sequence
    const existingItems = await this.simulateDbOperation('findMany', 'offline_transaction_queue', {
      tenantId,
      deviceId,
    }) as OfflineTransactionQueue[];

    return existingItems.length + 1;
  }

  private async simulateDbOperation(
    operation: string,
    table: string,
    data: any,
  ): Promise<any> {
    // Simulate database operation delay
    await new Promise(resolve => setTimeout(resolve, 5));

    switch (operation) {
      case 'insert':
        this.logger.debug(`Simulated INSERT into ${table}`);
        return data;

      case 'update':
        this.logger.debug(`Simulated UPDATE ${table} SET`, data);
        return data;

      case 'findOne':
        this.logger.debug(`Simulated SELECT from ${table} WHERE`, data);
        if (table === 'offline_transaction_queue') {
          return this.createMockQueueItem(data.tenantId, data.queueId);
        }
        return null;

      case 'findMany':
        this.logger.debug(`Simulated SELECT from ${table} WHERE`, data);
        if (table === 'offline_transaction_queue') {
          return this.createMockQueueItems(data.tenantId, data.deviceId, data.limit || 10);
        }
        return [];

      case 'deleteMany':
        this.logger.debug(`Simulated DELETE from ${table} WHERE`, data);
        // Return count of deleted items
        return Math.floor(Math.random() * 10);

      default:
        this.logger.warn(`Unknown database operation: ${operation}`);
        return null;
    }
  }

  private createMockQueueItem(tenantId: string, queueId: string): OfflineTransactionQueue {
    return {
      id: `queue_${Date.now()}`,
      tenantId,
      queueId,
      deviceId: 'device_123',
      transactionData: {
        operation: {
          type: 'create_transaction',
          data: { amount: 25.99 },
          timestamp: new Date(),
        },
      },
      operationType: 'create_transaction',
      isSynced: false,
      syncAttempts: 0,
      syncErrors: [],
      priority: 5,
      sequenceNumber: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isActive: true,
    };
  }

  private createMockQueueItems(tenantId: string, deviceId?: string, count: number = 5): OfflineTransactionQueue[] {
    const queueItems: OfflineTransactionQueue[] = [];
    
    for (let i = 0; i < count; i++) {
      const isSynced = Math.random() > 0.7; // 30% chance of being synced
      
      queueItems.push({
        id: `queue_mock_${i}`,
        tenantId,
        queueId: `queue_${Date.now()}_${i}`,
        deviceId: deviceId || `device_${Math.floor(Math.random() * 3) + 1}`,
        transactionData: {
          operation: {
            type: ['create_transaction', 'update_transaction', 'void_transaction'][Math.floor(Math.random() * 3)],
            data: { amount: Math.round(Math.random() * 100 * 100) / 100 },
            timestamp: new Date(Date.now() - i * 60000),
          },
        },
        operationType: ['create_transaction', 'update_transaction', 'void_transaction'][Math.floor(Math.random() * 3)],
        isSynced,
        syncAttempts: isSynced ? 1 : Math.floor(Math.random() * 3),
        lastSyncAttempt: isSynced ? new Date(Date.now() - i * 30000) : undefined,
        syncedAt: isSynced ? new Date(Date.now() - i * 30000) : undefined,
        syncErrors: [],
        priority: Math.floor(Math.random() * 10) + 1,
        sequenceNumber: i + 1,
        createdAt: new Date(Date.now() - i * 60000),
        updatedAt: new Date(Date.now() - i * 60000),
        version: 1,
        isActive: true,
      });
    }

    return queueItems;
  }
}