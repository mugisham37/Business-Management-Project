import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReceiptService } from '../services/receipt.service';
import { OfflineSyncService } from '../services/offline-sync.service';
import { CacheService } from '../../cache/cache.service';
import { TransactionWithItems } from '../entities/transaction.entity';

export interface TransactionCreatedEvent {
  tenantId: string;
  transaction: TransactionWithItems;
  userId: string;
}

export interface TransactionUpdatedEvent {
  tenantId: string;
  transactionId: string;
  updates: any;
  userId: string;
}

export interface TransactionVoidedEvent {
  tenantId: string;
  transaction: any;
  voidData: any;
  userId: string;
}

export interface TransactionRefundedEvent {
  tenantId: string;
  transaction: any;
  refundData: any;
  refundAmount: number;
  userId: string;
}

export interface TransactionFailedEvent {
  tenantId: string;
  transactionData: any;
  userId: string;
  error: string;
}

export interface POSTransactionCompletedEvent {
  tenantId: string;
  transaction: TransactionWithItems;
  paymentResult: any;
  processingTime: number;
  userId: string;
}

export interface POSTransactionFailedEvent {
  tenantId: string;
  transactionData: any;
  error: string;
  processingTime: number;
  userId: string;
}

@Injectable()
export class TransactionEventHandler {
  private readonly logger = new Logger(TransactionEventHandler.name);

  constructor(
    private readonly receiptService: ReceiptService,
    private readonly offlineSyncService: OfflineSyncService,
    private readonly cacheService: CacheService,
  ) {}

  @OnEvent('transaction.created')
  async handleTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    this.logger.log(`Handling transaction created event for transaction ${event.transaction.id}`);

    try {
      // Update transaction cache
      await this.updateTransactionCache(event.tenantId, event.transaction);

      // Update location statistics
      await this.updateLocationStats(event.tenantId, event.transaction.locationId, 'created');

      // Log transaction creation for audit
      this.logger.log(`Transaction ${event.transaction.id} created successfully for tenant ${event.tenantId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling transaction created event: ${errorMessage}`);
    }
  }

  @OnEvent('transaction.updated')
  async handleTransactionUpdated(event: TransactionUpdatedEvent): Promise<void> {
    this.logger.log(`Handling transaction updated event for transaction ${event.transactionId}`);

    try {
      // Invalidate transaction cache
      await this.invalidateTransactionCache(event.tenantId, event.transactionId);

      // Log transaction update for audit
      this.logger.log(`Transaction ${event.transactionId} updated for tenant ${event.tenantId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling transaction updated event: ${errorMessage}`);
    }
  }

  @OnEvent('transaction.voided')
  async handleTransactionVoided(event: TransactionVoidedEvent): Promise<void> {
    this.logger.log(`Handling transaction voided event for transaction ${event.transaction.id}`);

    try {
      // Update location statistics
      await this.updateLocationStats(event.tenantId, event.transaction.locationId, 'voided');

      // Invalidate related caches
      await this.invalidateTransactionCache(event.tenantId, event.transaction.id);

      // Log void for audit
      this.logger.log(`Transaction ${event.transaction.id} voided: ${event.voidData.reason}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling transaction voided event: ${errorMessage}`);
    }
  }

  @OnEvent('transaction.refunded')
  async handleTransactionRefunded(event: TransactionRefundedEvent): Promise<void> {
    this.logger.log(`Handling transaction refunded event for transaction ${event.transaction.id}`);

    try {
      // Update location statistics
      await this.updateLocationStats(event.tenantId, event.transaction.locationId, 'refunded', event.refundAmount);

      // Invalidate related caches
      await this.invalidateTransactionCache(event.tenantId, event.transaction.id);

      // Log refund for audit
      this.logger.log(`Transaction ${event.transaction.id} refunded: $${event.refundAmount} - ${event.refundData.reason}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling transaction refunded event: ${errorMessage}`);
    }
  }

  @OnEvent('transaction.failed')
  async handleTransactionFailed(event: TransactionFailedEvent): Promise<void> {
    this.logger.log(`Handling transaction failed event for tenant ${event.tenantId}`);

    try {
      // Update failure statistics
      await this.updateFailureStats(event.tenantId, event.error);

      // Log failure for monitoring
      this.logger.error(`Transaction failed for tenant ${event.tenantId}: ${event.error}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling transaction failed event: ${errorMessage}`);
    }
  }

  @OnEvent('pos.transaction.completed')
  async handlePOSTransactionCompleted(event: POSTransactionCompletedEvent): Promise<void> {
    this.logger.log(`Handling POS transaction completed event for transaction ${event.transaction.id}`);

    try {
      // Auto-generate receipt if configured
      await this.handleAutoReceipt(event.tenantId, event.transaction);

      // Update performance metrics
      await this.updatePerformanceMetrics(event.tenantId, event.processingTime);

      // Update daily sales cache
      await this.updateDailySalesCache(event.tenantId, event.transaction);

      this.logger.log(`POS transaction ${event.transaction.id} completed in ${event.processingTime}ms`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling POS transaction completed event: ${errorMessage}`);
    }
  }

  @OnEvent('pos.transaction.failed')
  async handlePOSTransactionFailed(event: POSTransactionFailedEvent): Promise<void> {
    this.logger.log(`Handling POS transaction failed event for tenant ${event.tenantId}`);

    try {
      // Update failure metrics
      await this.updateFailureStats(event.tenantId, event.error);

      // Log detailed failure information
      this.logger.error(`POS transaction failed for tenant ${event.tenantId} after ${event.processingTime}ms: ${event.error}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling POS transaction failed event: ${errorMessage}`);
    }
  }

  @OnEvent('pos.transaction.voided')
  async handlePOSTransactionVoided(event: any): Promise<void> {
    this.logger.log(`Handling POS transaction voided event for transaction ${event.transactionId}`);

    try {
      // Update void statistics
      await this.updateVoidStats(event.tenantId, event.reason);

      this.logger.log(`POS transaction ${event.transactionId} voided: ${event.reason}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling POS transaction voided event: ${errorMessage}`);
    }
  }

  @OnEvent('pos.transaction.refunded')
  async handlePOSTransactionRefunded(event: any): Promise<void> {
    this.logger.log(`Handling POS transaction refunded event for transaction ${event.transactionId}`);

    try {
      // Update refund statistics
      await this.updateRefundStats(event.tenantId, event.amount, event.reason);

      this.logger.log(`POS transaction ${event.transactionId} refunded: $${event.amount} - ${event.reason}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling POS transaction refunded event: ${errorMessage}`);
    }
  }

  @OnEvent('offline.operation.queued')
  async handleOfflineOperationQueued(event: any): Promise<void> {
    this.logger.log(`Handling offline operation queued event: ${event.operation.type}`);

    try {
      // Update offline queue statistics
      await this.updateOfflineStats(event.tenantId, 'queued');

      this.logger.log(`Offline operation ${event.queueId} queued for sync`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling offline operation queued event: ${errorMessage}`);
    }
  }

  @OnEvent('offline.sync.completed')
  async handleOfflineSyncCompleted(event: any): Promise<void> {
    this.logger.log(`Handling offline sync completed event for tenant ${event.tenantId}`);

    try {
      // Update sync statistics
      await this.updateSyncStats(event.tenantId, event.result);

      this.logger.log(`Offline sync completed: ${event.result.processedOperations} processed, ${event.result.failedOperations} failed`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling offline sync completed event: ${errorMessage}`);
    }
  }

  @OnEvent('offline.sync.failed')
  async handleOfflineSyncFailed(event: any): Promise<void> {
    this.logger.log(`Handling offline sync failed event for operation ${event.operation.queueId}`);

    try {
      // Update failure statistics
      await this.updateOfflineStats(event.tenantId, 'failed');

      this.logger.error(`Offline sync failed for operation ${event.operation.queueId}: ${event.error}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling offline sync failed event: ${errorMessage}`);
    }
  }

  private async updateTransactionCache(tenantId: string, transaction: TransactionWithItems): Promise<void> {
    const cacheKey = `transaction:${tenantId}:${transaction.id}`;
    await this.cacheService.set(cacheKey, transaction, { ttl: 3600 }); // Cache for 1 hour
  }

  private async invalidateTransactionCache(tenantId: string, transactionId: string): Promise<void> {
    const cacheKey = `transaction:${tenantId}:${transactionId}`;
    await this.cacheService.del(cacheKey);
  }

  private async updateLocationStats(
    tenantId: string,
    locationId: string,
    action: 'created' | 'voided' | 'refunded',
    amount?: number,
  ): Promise<void> {
    const statsKey = `location_stats:${tenantId}:${locationId}:${new Date().toISOString().split('T')[0]}`;
    
    try {
      const currentStats = await this.cacheService.get<any>(statsKey) || {
        date: new Date().toISOString().split('T')[0],
        transactionCount: 0,
        voidCount: 0,
        refundCount: 0,
        refundAmount: 0,
      };

      switch (action) {
        case 'created':
          currentStats.transactionCount++;
          break;
        case 'voided':
          currentStats.voidCount++;
          break;
        case 'refunded':
          currentStats.refundCount++;
          if (amount) {
            currentStats.refundAmount += amount;
          }
          break;
      }

      await this.cacheService.set(statsKey, currentStats, { ttl: 86400 }); // Cache for 24 hours
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error updating location stats: ${errorMessage}`);
    }
  }

  private async updateFailureStats(tenantId: string, error: string): Promise<void> {
    const statsKey = `failure_stats:${tenantId}:${new Date().toISOString().split('T')[0]}`;
    
    try {
      const currentStats = await this.cacheService.get<any>(statsKey) || {
        date: new Date().toISOString().split('T')[0],
        totalFailures: 0,
        errorTypes: {},
      };

      currentStats.totalFailures++;
      
      // Categorize error types
      const errorType = this.categorizeError(error);
      currentStats.errorTypes[errorType] = (currentStats.errorTypes[errorType] || 0) + 1;

      await this.cacheService.set(statsKey, currentStats, { ttl: 86400 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error updating failure stats: ${errorMessage}`);;
    }
  }

  private async updatePerformanceMetrics(tenantId: string, processingTime: number): Promise<void> {
    const metricsKey = `performance_metrics:${tenantId}:${new Date().toISOString().split('T')[0]}`;
    
    try {
      const currentMetrics = await this.cacheService.get<any>(metricsKey) || {
        date: new Date().toISOString().split('T')[0],
        totalTransactions: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        minProcessingTime: Infinity,
        maxProcessingTime: 0,
      };

      currentMetrics.totalTransactions++;
      currentMetrics.totalProcessingTime += processingTime;
      currentMetrics.averageProcessingTime = currentMetrics.totalProcessingTime / currentMetrics.totalTransactions;
      currentMetrics.minProcessingTime = Math.min(currentMetrics.minProcessingTime, processingTime);
      currentMetrics.maxProcessingTime = Math.max(currentMetrics.maxProcessingTime, processingTime);

      await this.cacheService.set(metricsKey, currentMetrics, { ttl: 86400 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error updating performance metrics: ${errorMessage}`);;
    }
  }

  private async updateDailySalesCache(tenantId: string, transaction: TransactionWithItems): Promise<void> {
    const salesKey = `daily_sales:${tenantId}:${transaction.locationId}:${new Date().toISOString().split('T')[0]}`;
    
    try {
      const currentSales = await this.cacheService.get<any>(salesKey) || {
        date: new Date().toISOString().split('T')[0],
        locationId: transaction.locationId,
        totalSales: 0,
        transactionCount: 0,
        averageTransactionValue: 0,
      };

      currentSales.totalSales += transaction.total;
      currentSales.transactionCount++;
      currentSales.averageTransactionValue = currentSales.totalSales / currentSales.transactionCount;

      await this.cacheService.set(salesKey, currentSales, { ttl: 86400 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error updating daily sales cache: ${errorMessage}`);;
    }
  }

  private async updateVoidStats(tenantId: string, reason: string): Promise<void> {
    const statsKey = `void_stats:${tenantId}:${new Date().toISOString().split('T')[0]}`;
    
    try {
      const currentStats = await this.cacheService.get<any>(statsKey) || {
        date: new Date().toISOString().split('T')[0],
        totalVoids: 0,
        voidReasons: {},
      };

      currentStats.totalVoids++;
      currentStats.voidReasons[reason] = (currentStats.voidReasons[reason] || 0) + 1;

      await this.cacheService.set(statsKey, currentStats, { ttl: 86400 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error updating void stats: ${errorMessage}`);;
    }
  }

  private async updateRefundStats(tenantId: string, amount: number, reason: string): Promise<void> {
    const statsKey = `refund_stats:${tenantId}:${new Date().toISOString().split('T')[0]}`;
    
    try {
      const currentStats = await this.cacheService.get<any>(statsKey) || {
        date: new Date().toISOString().split('T')[0],
        totalRefunds: 0,
        totalRefundAmount: 0,
        refundReasons: {},
      };

      currentStats.totalRefunds++;
      currentStats.totalRefundAmount += amount;
      currentStats.refundReasons[reason] = (currentStats.refundReasons[reason] || 0) + 1;

      await this.cacheService.set(statsKey, currentStats, { ttl: 86400 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error updating refund stats: ${errorMessage}`);;
    }
  }

  private async updateOfflineStats(tenantId: string, action: 'queued' | 'failed'): Promise<void> {
    const statsKey = `offline_stats:${tenantId}:${new Date().toISOString().split('T')[0]}`;
    
    try {
      const currentStats = await this.cacheService.get<any>(statsKey) || {
        date: new Date().toISOString().split('T')[0],
        queuedOperations: 0,
        failedOperations: 0,
      };

      if (action === 'queued') {
        currentStats.queuedOperations++;
      } else if (action === 'failed') {
        currentStats.failedOperations++;
      }

      await this.cacheService.set(statsKey, currentStats, { ttl: 86400 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error updating offline stats: ${errorMessage}`);;
    }
  }

  private async updateSyncStats(tenantId: string, result: any): Promise<void> {
    const statsKey = `sync_stats:${tenantId}:${new Date().toISOString().split('T')[0]}`;
    
    try {
      const currentStats = await this.cacheService.get<any>(statsKey) || {
        date: new Date().toISOString().split('T')[0],
        syncAttempts: 0,
        successfulSyncs: 0,
        processedOperations: 0,
        failedOperations: 0,
      };

      currentStats.syncAttempts++;
      if (result.success) {
        currentStats.successfulSyncs++;
      }
      currentStats.processedOperations += result.processedOperations;
      currentStats.failedOperations += result.failedOperations;

      await this.cacheService.set(statsKey, currentStats, { ttl: 86400 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error updating sync stats: ${errorMessage}`);
    }
  }

  private async handleAutoReceipt(tenantId: string, transaction: TransactionWithItems): Promise<void> {
    try {
      // Check if auto-receipt is enabled for this tenant/location
      const configKey = `pos_config:${tenantId}:${transaction.locationId}`;
      const config = await this.cacheService.get<any>(configKey);
      
      if (config?.autoPrintReceipts) {
        // Auto-print receipt
        await this.receiptService.printReceipt(tenantId, transaction);
        this.logger.log(`Auto-printed receipt for transaction ${transaction.id}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling auto-receipt: ${errorMessage}`);
    }
  }

  private categorizeError(error: string): string {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('payment') || errorLower.includes('card') || errorLower.includes('declined')) {
      return 'payment_error';
    } else if (errorLower.includes('network') || errorLower.includes('connection') || errorLower.includes('timeout')) {
      return 'network_error';
    } else if (errorLower.includes('validation') || errorLower.includes('invalid')) {
      return 'validation_error';
    } else if (errorLower.includes('inventory') || errorLower.includes('stock')) {
      return 'inventory_error';
    } else {
      return 'unknown_error';
    }
  }
}