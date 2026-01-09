import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { LocationSyncService, SyncEvent } from './location-sync.service';

export interface OfflineOperation {
  id: string;
  tenantId: string;
  locationId: string;
  operationType: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  data: any;
  timestamp: Date;
  userId: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface OfflineQueue {
  tenantId: string;
  locationId: string;
  operations: OfflineOperation[];
  lastSyncAttempt: Date | null;
  isOnline: boolean;
}

@Injectable()
export class LocationOfflineService {
  private readonly logger = new Logger(LocationOfflineService.name);
  private readonly offlineQueuePrefix = 'offline-queue';
  private readonly connectionStatusPrefix = 'connection-status';
  private readonly syncIntervalMs = 30000; // 30 seconds
  private syncIntervals = new Map<string, NodeJS.Timeout>();
  
  // In-memory storage
  private offlineQueues = new Map<string, OfflineOperation[]>();
  private connectionStatuses = new Map<string, { isOnline: boolean; lastUpdate: Date; locationId: string; tenantId: string }>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly locationSyncService: LocationSyncService,
  ) {
    this.startPeriodicSync();
  }

  /**
   * Queue an operation for offline processing
   */
  async queueOfflineOperation(operation: Omit<OfflineOperation, 'id' | 'retryCount' | 'status'>): Promise<string> {
    try {
      const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const offlineOperation: OfflineOperation = {
        ...operation,
        id: operationId,
        retryCount: 0,
        status: 'pending',
      };

      const queueKey = `${this.offlineQueuePrefix}:${operation.tenantId}:${operation.locationId}`;
      let queue = this.offlineQueues.get(queueKey) || [];
      queue.unshift(offlineOperation);
      
      // Keep only last 1000 operations
      if (queue.length > 1000) {
        queue = queue.slice(0, 1000);
      }
      
      this.offlineQueues.set(queueKey, queue);
      
      this.logger.debug(`Queued offline operation: ${operationId} for location: ${operation.locationId}`);
      
      // Try immediate sync if online
      await this.attemptSync(operation.tenantId, operation.locationId);
      
      return operationId;
    } catch (error: any) {
      this.logger.error(`Failed to queue offline operation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark a location as online/offline
   */
  async updateConnectionStatus(tenantId: string, locationId: string, isOnline: boolean): Promise<void> {
    try {
      const statusKey = `${this.connectionStatusPrefix}:${tenantId}:${locationId}`;
      const statusData = {
        isOnline,
        lastUpdate: new Date(),
        locationId,
        tenantId,
      };
      
      this.connectionStatuses.set(statusKey, statusData);
      
      if (isOnline) {
        // Attempt to sync queued operations
        await this.attemptSync(tenantId, locationId);
      }
      
      this.logger.debug(`Updated connection status for location ${locationId}: ${isOnline ? 'online' : 'offline'}`);
    } catch (error: any) {
      this.logger.error(`Failed to update connection status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if a location is currently online
   */
  async isLocationOnline(tenantId: string, locationId: string): Promise<boolean> {
    try {
      const statusKey = `${this.connectionStatusPrefix}:${tenantId}:${locationId}`;
      const statusData = this.connectionStatuses.get(statusKey);
      
      if (!statusData) {
        return false; // Assume offline if no status data
      }
      
      // Check if status is stale (older than 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (statusData.lastUpdate < fiveMinutesAgo) {
        return false;
      }
      
      return statusData.isOnline;
    } catch (error: any) {
      this.logger.error(`Failed to check location online status: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Get offline queue for a location
   */
  async getOfflineQueue(tenantId: string, locationId: string): Promise<OfflineOperation[]> {
    try {
      const queueKey = `${this.offlineQueuePrefix}:${tenantId}:${locationId}`;
      return this.offlineQueues.get(queueKey) || [];
    } catch (error: any) {
      this.logger.error(`Failed to get offline queue: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get offline queue status for a location
   */
  async getOfflineQueueStatus(tenantId: string, locationId: string): Promise<{
    totalOperations: number;
    pendingOperations: number;
    failedOperations: number;
    lastSyncAttempt: Date | null;
    isOnline: boolean;
  }> {
    try {
      const operations = await this.getOfflineQueue(tenantId, locationId);
      const isOnline = await this.isLocationOnline(tenantId, locationId);
      
      const pendingOperations = operations.filter(op => op.status === 'pending').length;
      const failedOperations = operations.filter(op => op.status === 'failed').length;
      
      // Get last sync attempt from operations
      const lastSyncAttempt = operations.length > 0 
        ? operations.reduce((latest, op) => {
            return op.timestamp > latest ? op.timestamp : latest;
          }, new Date(0))
        : null;
      
      return {
        totalOperations: operations.length,
        pendingOperations,
        failedOperations,
        lastSyncAttempt,
        isOnline,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get offline queue status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Attempt to sync queued operations for a location
   */
  async attemptSync(tenantId: string, locationId: string): Promise<number> {
    try {
      const isOnline = await this.isLocationOnline(tenantId, locationId);
      if (!isOnline) {
        this.logger.debug(`Location ${locationId} is offline, skipping sync`);
        return 0;
      }

      const operations = await this.getOfflineQueue(tenantId, locationId);
      const pendingOperations = operations.filter(op => 
        op.status === 'pending' || (op.status === 'failed' && op.retryCount < op.maxRetries)
      );

      if (pendingOperations.length === 0) {
        return 0;
      }

      let syncedCount = 0;
      const queueKey = `${this.offlineQueuePrefix}:${tenantId}:${locationId}`;

      for (const operation of pendingOperations) {
        try {
          // Update operation status to syncing
          operation.status = 'syncing';
          await this.updateOperationInQueue(queueKey, operation);

          // Convert to sync event and broadcast
          const syncEvent: SyncEvent = {
            id: `sync-${operation.id}`,
            tenantId: operation.tenantId,
            locationId: operation.locationId,
            eventType: operation.operationType,
            entityType: operation.entityType,
            entityId: operation.entityId,
            data: operation.data,
            timestamp: operation.timestamp,
            userId: operation.userId,
            version: 1,
          };

          await this.locationSyncService.broadcastSyncEvent(syncEvent);

          // Mark as synced and remove from queue
          await this.removeOperationFromQueue(queueKey, operation.id);
          syncedCount++;

          this.logger.debug(`Synced offline operation: ${operation.id}`);
        } catch (error: any) {
          // Mark as failed and increment retry count
          operation.status = 'failed';
          operation.retryCount++;
          await this.updateOperationInQueue(queueKey, operation);

          this.logger.warn(`Failed to sync operation ${operation.id}: ${error.message}`);
        }
      }

      if (syncedCount > 0) {
        this.logger.log(`Synced ${syncedCount} offline operations for location: ${locationId}`);
      }

      return syncedCount;
    } catch (error: any) {
      this.logger.error(`Failed to attempt sync: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update an operation in the queue
   */
  private async updateOperationInQueue(queueKey: string, operation: OfflineOperation): Promise<void> {
    try {
      let queue = this.offlineQueues.get(queueKey) || [];
      queue = queue.map(op => op.id === operation.id ? operation : op);
      this.offlineQueues.set(queueKey, queue);
    } catch (error: any) {
      this.logger.error(`Failed to update operation in queue: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Remove an operation from the queue
   */
  private async removeOperationFromQueue(queueKey: string, operationId: string): Promise<void> {
    try {
      let queue = this.offlineQueues.get(queueKey) || [];
      queue = queue.filter(op => op.id !== operationId);
      this.offlineQueues.set(queueKey, queue);
    } catch (error: any) {
      this.logger.error(`Failed to remove operation from queue: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Start periodic sync for all locations
   */
  private startPeriodicSync(): void {
    setInterval(async () => {
      try {
        await this.syncAllLocations();
      } catch (error: any) {
        this.logger.error(`Periodic sync failed: ${error.message}`, error.stack);
      }
    }, this.syncIntervalMs);

    this.logger.log('Started periodic sync for offline operations');
  }

  /**
   * Sync all locations with pending operations
   */
  private async syncAllLocations(): Promise<void> {
    try {
      const queuePattern = `${this.offlineQueuePrefix}:`;
      
      for (const [queueKey] of this.offlineQueues) {
        if (queueKey.startsWith(queuePattern)) {
          const parts = queueKey.split(':');
          const tenantId = parts[1];
          const locationId = parts[2];
          if (tenantId && locationId) {
            await this.attemptSync(tenantId, locationId);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to sync all locations: ${error.message}`, error.stack);
    }
  }

  /**
   * Clear offline queue for a location
   */
  async clearOfflineQueue(tenantId: string, locationId: string): Promise<void> {
    try {
      const queueKey = `${this.offlineQueuePrefix}:${tenantId}:${locationId}`;
      this.offlineQueues.delete(queueKey);
      
      this.logger.log(`Cleared offline queue for location: ${locationId}`);
    } catch (error: any) {
      this.logger.error(`Failed to clear offline queue: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Retry failed operations for a location
   */
  async retryFailedOperations(tenantId: string, locationId: string): Promise<number> {
    try {
      const operations = await this.getOfflineQueue(tenantId, locationId);
      const failedOperations = operations.filter(op => op.status === 'failed');
      
      const queueKey = `${this.offlineQueuePrefix}:${tenantId}:${locationId}`;
      
      // Reset failed operations to pending
      for (const operation of failedOperations) {
        operation.status = 'pending';
        operation.retryCount = 0;
        await this.updateOperationInQueue(queueKey, operation);
      }
      
      // Attempt sync
      return await this.attemptSync(tenantId, locationId);
    } catch (error: any) {
      this.logger.error(`Failed to retry failed operations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Event handlers for automatic offline queuing
   */
  @OnEvent('inventory.updated')
  async handleInventoryUpdated(event: any): Promise<void> {
    const isOnline = await this.isLocationOnline(event.tenantId, event.locationId);
    if (!isOnline) {
      await this.queueOfflineOperation({
        tenantId: event.tenantId,
        locationId: event.locationId,
        operationType: 'update',
        entityType: 'inventory',
        entityId: event.inventoryId,
        data: event.inventory,
        timestamp: new Date(),
        userId: event.userId,
        maxRetries: 3,
      });
    }
  }

  @OnEvent('transaction.created')
  async handleTransactionCreated(event: any): Promise<void> {
    const isOnline = await this.isLocationOnline(event.tenantId, event.locationId);
    if (!isOnline) {
      await this.queueOfflineOperation({
        tenantId: event.tenantId,
        locationId: event.locationId,
        operationType: 'create',
        entityType: 'transaction',
        entityId: event.transactionId,
        data: event.transaction,
        timestamp: new Date(),
        userId: event.userId,
        maxRetries: 5, // Higher retry count for transactions
      });
    }
  }

  @OnEvent('customer.updated')
  async handleCustomerUpdated(event: any): Promise<void> {
    const isOnline = await this.isLocationOnline(event.tenantId, event.locationId);
    if (!isOnline) {
      await this.queueOfflineOperation({
        tenantId: event.tenantId,
        locationId: event.locationId,
        operationType: 'update',
        entityType: 'customer',
        entityId: event.customerId,
        data: event.customer,
        timestamp: new Date(),
        userId: event.userId,
        maxRetries: 3,
      });
    }
  }
}