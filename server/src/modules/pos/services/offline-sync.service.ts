import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OfflineQueueRepository } from '../repositories/offline-queue.repository';
import { TransactionService } from './transaction.service';
import { OfflineStorageService } from './offline-storage.service';
import { CreateTransactionDto } from '../dto/transaction.dto';
import { OfflineTransactionQueue } from '../entities/transaction.entity';

export interface OfflineOperation {
  id: string;
  type: 'create_transaction' | 'update_transaction' | 'void_transaction' | 'refund_transaction';
  data: any;
  timestamp: Date;
  deviceId: string;
  priority: number;
}

export interface SyncResult {
  success: boolean;
  processedOperations: number;
  failedOperations: number;
  errors: Array<{
    operationId: string;
    error: string;
  }>;
}

export interface ConflictResolution {
  strategy: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  resolvedData?: any;
}

@Injectable()
export class OfflineSyncService {
  private readonly logger = new Logger(OfflineSyncService.name);
  private readonly MAX_SYNC_ATTEMPTS = 3;
  private readonly SYNC_BATCH_SIZE = 50;

  constructor(
    private readonly offlineQueueRepository: OfflineQueueRepository,
    private readonly transactionService: TransactionService,
    private readonly offlineStorageService: OfflineStorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async queueOfflineOperation(
    tenantId: string,
    operation: OfflineOperation,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Queuing offline operation: ${operation.type} for device ${operation.deviceId}`);

    const queueId = `${operation.deviceId}_${operation.id}_${Date.now()}`;

    await this.offlineQueueRepository.create(
      tenantId,
      {
        queueId,
        deviceId: operation.deviceId,
        transactionData: {
          operation,
          originalTimestamp: operation.timestamp,
        },
        operationType: operation.type,
        priority: operation.priority,
      },
      userId
    );

    // Emit event for real-time sync if online
    this.eventEmitter.emit('offline.operation.queued', {
      tenantId,
      operation,
      queueId,
    });
  }

  async syncPendingOperations(
    tenantId: string,
    deviceId?: string,
    userId?: string,
  ): Promise<SyncResult> {
    this.logger.log(`Starting sync for tenant ${tenantId}${deviceId ? `, device ${deviceId}` : ''}`);

    const pendingOperations = await this.offlineQueueRepository.findPendingSync(
      tenantId,
      this.SYNC_BATCH_SIZE
    );

    // Filter by device if specified
    const operationsToSync = deviceId 
      ? pendingOperations.filter(op => op.deviceId === deviceId)
      : pendingOperations;

    const result: SyncResult = {
      success: true,
      processedOperations: 0,
      failedOperations: 0,
      errors: [],
    };

    // Sort operations by priority and sequence
    const sortedOperations = this.prioritizeOperations(operationsToSync);

    for (const queueItem of sortedOperations) {
      try {
        await this.processOfflineOperation(tenantId, queueItem, userId || 'system');
        
        await this.offlineQueueRepository.markAsSynced(
          tenantId,
          queueItem.queueId,
          userId || 'system'
        );

        result.processedOperations++;
        
        this.logger.log(`Successfully synced operation ${queueItem.queueId}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        this.logger.error(`Failed to sync operation ${queueItem.queueId}: ${errorMessage}`);

        await this.offlineQueueRepository.incrementSyncAttempts(
          tenantId,
          queueItem.queueId,
          error,
          userId || 'system'
        );

        result.failedOperations++;
        result.errors.push({
          operationId: queueItem.queueId,
          error: errorMessage,
        });

        // Mark as failed if max attempts reached
        if (queueItem.syncAttempts >= this.MAX_SYNC_ATTEMPTS) {
          this.logger.error(`Operation ${queueItem.queueId} exceeded max sync attempts`);
          
          this.eventEmitter.emit('offline.sync.failed', {
            tenantId,
            operation: queueItem,
            error: errorMessage,
          });
        }
      }
    }

    // Update overall success status
    result.success = result.failedOperations === 0;

    this.logger.log(`Sync completed: ${result.processedOperations} processed, ${result.failedOperations} failed`);

    // Emit sync completed event
    this.eventEmitter.emit('offline.sync.completed', {
      tenantId,
      deviceId,
      result,
    });

    return result;
  }

  async detectConflicts(
    tenantId: string,
    operation: OfflineOperation,
  ): Promise<Array<{
    type: string;
    description: string;
    serverData: any;
    clientData: any;
  }>> {
    const conflicts: Array<{
      type: string;
      description: string;
      serverData: any;
      clientData: any;
    }> = [];

    if (operation.type === 'create_transaction') {
      // Check for duplicate transaction numbers
      const existingTransaction = await this.checkForDuplicateTransaction(
        tenantId,
        operation.data
      );

      if (existingTransaction) {
        conflicts.push({
          type: 'duplicate_transaction',
          description: 'Transaction with same number already exists',
          serverData: existingTransaction,
          clientData: operation.data,
        });
      }
    }

    if (operation.type === 'update_transaction' || operation.type === 'void_transaction') {
      // Check if transaction was modified on server after offline operation
      const serverTransaction = await this.getServerTransactionState(
        tenantId,
        operation.data.transactionId
      );

      if (serverTransaction && serverTransaction.updatedAt > operation.timestamp) {
        conflicts.push({
          type: 'concurrent_modification',
          description: 'Transaction was modified on server after offline operation',
          serverData: serverTransaction,
          clientData: operation.data,
        });
      }
    }

    return conflicts;
  }

  async resolveConflicts(
    tenantId: string,
    operation: OfflineOperation,
    conflicts: any[],
    resolution: ConflictResolution,
  ): Promise<any> {
    this.logger.log(`Resolving ${conflicts.length} conflicts for operation ${operation.id}`);

    switch (resolution.strategy) {
      case 'server_wins':
        // Use server data, discard client changes
        return await this.getServerTransactionState(tenantId, operation.data.transactionId);

      case 'client_wins':
        // Use client data, overwrite server
        return operation.data;

      case 'merge':
        // Attempt to merge changes intelligently
        return await this.mergeTransactionData(
          tenantId,
          operation,
          conflicts[0]?.serverData,
          operation.data
        );

      case 'manual':
        // Use provided resolution data
        return resolution.resolvedData;

      default:
        throw new Error(`Unknown conflict resolution strategy: ${resolution.strategy}`);
    }
  }

  private async processOfflineOperation(
    tenantId: string,
    queueItem: OfflineTransactionQueue,
    userId: string,
  ): Promise<void> {
    const operation: OfflineOperation = queueItem.transactionData.operation;

    // Detect conflicts
    const conflicts = await this.detectConflicts(tenantId, operation);

    if (conflicts.length > 0) {
      // For now, use server_wins strategy for automatic resolution
      // In a real implementation, this might prompt for user resolution
      const resolvedData = await this.resolveConflicts(
        tenantId,
        operation,
        conflicts,
        { strategy: 'server_wins' }
      );

      operation.data = resolvedData;
    }

    // Process the operation based on type
    switch (operation.type) {
      case 'create_transaction':
        await this.syncCreateTransaction(tenantId, operation.data, userId);
        break;

      case 'update_transaction':
        await this.syncUpdateTransaction(tenantId, operation.data, userId);
        break;

      case 'void_transaction':
        await this.syncVoidTransaction(tenantId, operation.data, userId);
        break;

      case 'refund_transaction':
        await this.syncRefundTransaction(tenantId, operation.data, userId);
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private async syncCreateTransaction(
    tenantId: string,
    transactionData: CreateTransactionDto,
    userId: string,
  ): Promise<void> {
    // Check if transaction already exists (by transaction number or offline ID)
    const existing = await this.checkForDuplicateTransaction(tenantId, transactionData);
    
    if (existing) {
      this.logger.log(`Transaction already exists, skipping creation`);
      return;
    }

    // Create the transaction
    await this.transactionService.createTransaction(tenantId, transactionData, userId);
  }

  private async syncUpdateTransaction(
    tenantId: string,
    updateData: any,
    userId: string,
  ): Promise<void> {
    await this.transactionService.updateTransaction(
      tenantId,
      updateData.transactionId,
      updateData.updates,
      userId
    );
  }

  private async syncVoidTransaction(
    tenantId: string,
    voidData: any,
    userId: string,
  ): Promise<void> {
    await this.transactionService.voidTransaction(
      tenantId,
      voidData.transactionId,
      voidData.voidInfo,
      userId
    );
  }

  private async syncRefundTransaction(
    tenantId: string,
    refundData: any,
    userId: string,
  ): Promise<void> {
    await this.transactionService.refundTransaction(
      tenantId,
      refundData.transactionId,
      refundData.refundInfo,
      userId
    );
  }

  private prioritizeOperations(operations: OfflineTransactionQueue[]): OfflineTransactionQueue[] {
    return operations.sort((a, b) => {
      // First by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // Then by sequence number (chronological order)
      return a.sequenceNumber - b.sequenceNumber;
    });
  }

  private async checkForDuplicateTransaction(
    tenantId: string,
    transactionData: any,
  ): Promise<any> {
    // In a real implementation, this would check for existing transactions
    // by transaction number, offline ID, or other unique identifiers
    return null;
  }

  private async getServerTransactionState(
    tenantId: string,
    transactionId: string,
  ): Promise<any> {
    try {
      return await this.transactionService.findById(tenantId, transactionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error checking transaction existence: ${errorMessage}`);
      return null;
    }
  }

  private async mergeTransactionData(
    tenantId: string,
    operation: OfflineOperation,
    serverData: any,
    clientData: any,
  ): Promise<any> {
    // Implement intelligent merging logic
    // For now, prefer server data for critical fields, client data for others
    
    return {
      ...serverData,
      notes: clientData.notes || serverData.notes,
      metadata: {
        ...serverData.metadata,
        ...clientData.metadata,
        mergedAt: new Date(),
        conflictResolution: 'auto_merge',
      },
    };
  }

  async cacheEssentialData(
    tenantId: string,
    dataTypes: Array<'products' | 'customers' | 'locations' | 'settings'>,
    locationId?: string,
  ): Promise<{
    cached: Record<string, number>;
    totalItems: number;
    cacheExpiry: Date;
  }> {
    this.logger.log(`Caching essential data for tenant ${tenantId}: ${dataTypes.join(', ')}`);

    const cached: Record<string, number> = {};
    let totalItems = 0;

    for (const dataType of dataTypes) {
      let count = 0;

      switch (dataType) {
        case 'products':
          count = await this.cacheProducts(tenantId, locationId);
          break;
        case 'customers':
          count = await this.cacheCustomers(tenantId);
          break;
        case 'locations':
          count = await this.cacheLocations(tenantId);
          break;
        case 'settings':
          count = await this.cacheSettings(tenantId);
          break;
      }

      cached[dataType] = count;
      totalItems += count;
    }

    const cacheExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    this.logger.log(`Cached ${totalItems} items for offline use`);

    return {
      cached,
      totalItems,
      cacheExpiry,
    };
  }

  async getCachedData<T>(
    tenantId: string,
    category: string,
    itemId?: string,
  ): Promise<T | T[] | null> {
    if (itemId) {
      return this.offlineStorageService.getItem<T>(tenantId, category, itemId);
    } else {
      return this.offlineStorageService.getItemsByCategory<T>(tenantId, category);
    }
  }

  async clearOfflineCache(
    tenantId: string,
    categories?: string[],
  ): Promise<number> {
    if (categories) {
      let totalCleared = 0;
      for (const category of categories) {
        const cleared = await this.offlineStorageService.clearCategory(tenantId, category);
        totalCleared += cleared;
      }
      return totalCleared;
    } else {
      return this.offlineStorageService.clearTenant(tenantId);
    }
  }

  async getOfflineStats(tenantId: string) {
    const [storageStats, syncMetadata] = await Promise.all([
      this.offlineStorageService.getStorageStats(tenantId),
      this.offlineStorageService.getSyncMetadata(tenantId),
    ]);

    return {
      storage: storageStats,
      sync: syncMetadata,
      healthStatus: 'healthy',
    };
  }

  private async cacheProducts(tenantId: string, locationId?: string): Promise<number> {
    // In a real implementation, this would fetch products from the database
    // and store them in offline storage
    const mockProducts = Array.from({ length: 150 }, (_, i) => ({
      id: `product_${i}`,
      sku: `SKU${i.toString().padStart(3, '0')}`,
      name: `Product ${i}`,
      price: Math.round(Math.random() * 100 * 100) / 100,
      category: `Category ${Math.floor(i / 10)}`,
    }));

    for (const product of mockProducts) {
      await this.offlineStorageService.storeItem(
        tenantId,
        'products',
        product.id,
        product,
        { ttl: 24, priority: 'high' }
      );
    }

    return mockProducts.length;
  }

  private async cacheCustomers(tenantId: string): Promise<number> {
    // In a real implementation, this would fetch customers from the database
    const mockCustomers = Array.from({ length: 75 }, (_, i) => ({
      id: `customer_${i}`,
      firstName: `Customer${i}`,
      lastName: 'Lastname',
      email: `customer${i}@example.com`,
      phone: `+1234567${i.toString().padStart(3, '0')}`,
    }));

    for (const customer of mockCustomers) {
      await this.offlineStorageService.storeItem(
        tenantId,
        'customers',
        customer.id,
        customer,
        { ttl: 12, priority: 'medium' }
      );
    }

    return mockCustomers.length;
  }

  private async cacheLocations(tenantId: string): Promise<number> {
    // In a real implementation, this would fetch locations from the database
    const mockLocations = [
      { id: 'loc_1', name: 'Main Store', address: '123 Main St' },
      { id: 'loc_2', name: 'Branch Store', address: '456 Branch Ave' },
      { id: 'loc_3', name: 'Online Store', address: 'Virtual' },
    ];

    for (const location of mockLocations) {
      await this.offlineStorageService.storeItem(
        tenantId,
        'locations',
        location.id,
        location,
        { ttl: 48, priority: 'high' }
      );
    }

    return mockLocations.length;
  }

  private async cacheSettings(tenantId: string): Promise<number> {
    // In a real implementation, this would fetch tenant settings
    const settings = {
      currency: 'USD',
      taxRate: 0.08,
      timezone: 'America/New_York',
      businessHours: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        // ... other days
      },
    };

    await this.offlineStorageService.storeItem(
      tenantId,
      'settings',
      'business_config',
      settings,
      { ttl: 72, priority: 'high' }
    );

    return 1;
  }
}