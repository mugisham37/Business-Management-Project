import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class TransactionEventHandler {
  private readonly logger = new Logger(TransactionEventHandler.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent('transaction.created')
  async handleTransactionCreated(payload: {
    tenantId: string;
    transaction: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Transaction created: ${payload.transaction.transactionNumber} for tenant ${payload.tenantId}`);

    try {
      // Update inventory levels
      await this.updateInventoryLevels(payload);

      // Update business metrics
      await this.updateBusinessMetrics(payload);

      // Send real-time notifications
      await this.sendRealtimeNotifications(payload);

      // Update customer loyalty points (if customer is associated)
      if (payload.transaction.customerId) {
        await this.updateCustomerLoyalty(payload);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling transaction created event: ${errorMessage}`);
    }
  }

  @OnEvent('transaction.completed')
  async handleTransactionCompleted(payload: {
    tenantId: string;
    transaction: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Transaction completed: ${payload.transaction.transactionNumber}`);

    try {
      // Finalize inventory updates
      await this.finalizeInventoryUpdates(payload);

      // Update sales analytics
      await this.updateSalesAnalytics(payload);

      // Trigger automatic receipt generation if configured
      await this.triggerAutoReceipt(payload);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling transaction completed event: ${errorMessage}`);
    }
  }

  @OnEvent('transaction.voided')
  async handleTransactionVoided(payload: {
    tenantId: string;
    transaction: any;
    voidData: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Transaction voided: ${payload.transaction.transactionNumber}`);

    try {
      // Reverse inventory changes
      await this.reverseInventoryChanges(payload);

      // Update business metrics
      await this.updateMetricsForVoid(payload);

      // Send void notifications
      await this.sendVoidNotifications(payload);

      // Reverse customer loyalty points
      if (payload.transaction.customerId) {
        await this.reverseLoyaltyPoints(payload);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling transaction voided event: ${errorMessage}`);
    }
  }

  @OnEvent('transaction.refunded')
  async handleTransactionRefunded(payload: {
    tenantId: string;
    transaction: any;
    refundData: any;
    refundAmount: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Transaction refunded: ${payload.transaction.transactionNumber}, amount: $${payload.refundAmount}`);

    try {
      // Handle partial inventory returns if applicable
      await this.handleRefundInventory(payload);

      // Update business metrics
      await this.updateMetricsForRefund(payload);

      // Send refund notifications
      await this.sendRefundNotifications(payload);

      // Adjust customer loyalty points
      if (payload.transaction.customerId) {
        await this.adjustLoyaltyForRefund(payload);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling transaction refunded event: ${errorMessage}`);
    }
  }

  @OnEvent('pos.transaction.completed')
  async handlePOSTransactionCompleted(payload: {
    tenantId: string;
    transaction: any;
    paymentResult: any;
    processingTime: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`POS transaction completed in ${payload.processingTime}ms`);

    try {
      // Log performance metrics
      await this.logPerformanceMetrics(payload);

      // Update real-time dashboards
      await this.updateRealtimeDashboards(payload);

      // Trigger post-transaction workflows
      await this.triggerPostTransactionWorkflows(payload);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling POS transaction completed event: ${errorMessage}`);
    }
  }

  @OnEvent('pos.transaction.failed')
  async handlePOSTransactionFailed(payload: {
    tenantId: string;
    transactionData: any;
    error: string;
    processingTime: number;
    userId: string;
  }): Promise<void> {
    this.logger.error(`POS transaction failed in ${payload.processingTime}ms: ${payload.error}`);

    try {
      // Log failure metrics
      await this.logFailureMetrics(payload);

      // Send failure notifications
      await this.sendFailureNotifications(payload);

      // Trigger failure recovery workflows
      await this.triggerFailureRecovery(payload);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling POS transaction failed event: ${errorMessage}`);
    }
  }

  // Private helper methods for inventory integration
  private async updateInventoryLevels(payload: {
    tenantId: string;
    transaction: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Updating inventory levels for transaction ${payload.transaction.id}`);

    // Emit inventory update events for each transaction item
    for (const item of payload.transaction.items) {
      this.eventEmitter.emit('inventory.stock.reduced', {
        tenantId: payload.tenantId,
        productId: item.productId,
        locationId: payload.transaction.locationId,
        quantity: item.quantity,
        reason: 'sale',
        transactionId: payload.transaction.id,
        userId: payload.userId,
      });
    }
  }

  private async finalizeInventoryUpdates(payload: {
    tenantId: string;
    transaction: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Finalizing inventory updates for transaction ${payload.transaction.id}`);

    // Emit inventory finalization events
    this.eventEmitter.emit('inventory.transaction.finalized', {
      tenantId: payload.tenantId,
      transactionId: payload.transaction.id,
      locationId: payload.transaction.locationId,
      items: payload.transaction.items,
      userId: payload.userId,
    });
  }

  private async reverseInventoryChanges(payload: {
    tenantId: string;
    transaction: any;
    voidData: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Reversing inventory changes for voided transaction ${payload.transaction.id}`);

    // Emit inventory restoration events for each transaction item
    for (const item of payload.transaction.items) {
      this.eventEmitter.emit('inventory.stock.restored', {
        tenantId: payload.tenantId,
        productId: item.productId,
        locationId: payload.transaction.locationId,
        quantity: item.quantity,
        reason: 'void',
        transactionId: payload.transaction.id,
        voidReason: payload.voidData.reason,
        userId: payload.userId,
      });
    }
  }

  private async handleRefundInventory(payload: {
    tenantId: string;
    transaction: any;
    refundData: any;
    refundAmount: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Handling inventory for refunded transaction ${payload.transaction.id}`);

    // For partial refunds, we might need to restore some inventory
    // This depends on business rules - for now, we'll emit an event for the inventory service to handle
    this.eventEmitter.emit('inventory.refund.processed', {
      tenantId: payload.tenantId,
      transactionId: payload.transaction.id,
      locationId: payload.transaction.locationId,
      refundAmount: payload.refundAmount,
      totalAmount: payload.transaction.total,
      items: payload.transaction.items,
      refundReason: payload.refundData.reason,
      userId: payload.userId,
    });
  }

  // Business metrics methods
  private async updateBusinessMetrics(payload: {
    tenantId: string;
    transaction: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Updating business metrics for transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('metrics.transaction.created', {
      tenantId: payload.tenantId,
      transactionId: payload.transaction.id,
      locationId: payload.transaction.locationId,
      amount: payload.transaction.total,
      itemCount: payload.transaction.itemCount,
      paymentMethod: payload.transaction.paymentMethod,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async updateSalesAnalytics(payload: {
    tenantId: string;
    transaction: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Updating sales analytics for transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('analytics.sale.completed', {
      tenantId: payload.tenantId,
      transactionId: payload.transaction.id,
      locationId: payload.transaction.locationId,
      customerId: payload.transaction.customerId,
      amount: payload.transaction.total,
      items: payload.transaction.items,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async updateMetricsForVoid(payload: {
    tenantId: string;
    transaction: any;
    voidData: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Updating metrics for voided transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('metrics.transaction.voided', {
      tenantId: payload.tenantId,
      transactionId: payload.transaction.id,
      locationId: payload.transaction.locationId,
      amount: payload.transaction.total,
      voidReason: payload.voidData.reason,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async updateMetricsForRefund(payload: {
    tenantId: string;
    transaction: any;
    refundData: any;
    refundAmount: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Updating metrics for refunded transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('metrics.transaction.refunded', {
      tenantId: payload.tenantId,
      transactionId: payload.transaction.id,
      locationId: payload.transaction.locationId,
      originalAmount: payload.transaction.total,
      refundAmount: payload.refundAmount,
      refundReason: payload.refundData.reason,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  // Real-time notification methods
  private async sendRealtimeNotifications(payload: {
    tenantId: string;
    transaction: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Sending real-time notifications for transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('realtime.transaction.created', {
      tenantId: payload.tenantId,
      locationId: payload.transaction.locationId,
      transaction: {
        id: payload.transaction.id,
        transactionNumber: payload.transaction.transactionNumber,
        total: payload.transaction.total,
        itemCount: payload.transaction.itemCount,
        paymentMethod: payload.transaction.paymentMethod,
        timestamp: new Date(),
      },
      userId: payload.userId,
    });
  }

  private async sendVoidNotifications(payload: {
    tenantId: string;
    transaction: any;
    voidData: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Sending void notifications for transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('realtime.transaction.voided', {
      tenantId: payload.tenantId,
      locationId: payload.transaction.locationId,
      transactionId: payload.transaction.id,
      transactionNumber: payload.transaction.transactionNumber,
      amount: payload.transaction.total,
      voidReason: payload.voidData.reason,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async sendRefundNotifications(payload: {
    tenantId: string;
    transaction: any;
    refundData: any;
    refundAmount: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Sending refund notifications for transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('realtime.transaction.refunded', {
      tenantId: payload.tenantId,
      locationId: payload.transaction.locationId,
      transactionId: payload.transaction.id,
      transactionNumber: payload.transaction.transactionNumber,
      originalAmount: payload.transaction.total,
      refundAmount: payload.refundAmount,
      refundReason: payload.refundData.reason,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async sendFailureNotifications(payload: {
    tenantId: string;
    transactionData: any;
    error: string;
    processingTime: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Sending failure notifications for failed transaction`);

    this.eventEmitter.emit('realtime.transaction.failed', {
      tenantId: payload.tenantId,
      locationId: payload.transactionData.locationId,
      error: payload.error,
      processingTime: payload.processingTime,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  // Customer loyalty methods
  private async updateCustomerLoyalty(payload: {
    tenantId: string;
    transaction: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Updating customer loyalty for transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('loyalty.points.earned', {
      tenantId: payload.tenantId,
      customerId: payload.transaction.customerId,
      transactionId: payload.transaction.id,
      amount: payload.transaction.total,
      pointsEarned: Math.floor(payload.transaction.total), // 1 point per dollar
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async reverseLoyaltyPoints(payload: {
    tenantId: string;
    transaction: any;
    voidData: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Reversing loyalty points for voided transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('loyalty.points.reversed', {
      tenantId: payload.tenantId,
      customerId: payload.transaction.customerId,
      transactionId: payload.transaction.id,
      amount: payload.transaction.total,
      pointsReversed: Math.floor(payload.transaction.total),
      voidReason: payload.voidData.reason,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async adjustLoyaltyForRefund(payload: {
    tenantId: string;
    transaction: any;
    refundData: any;
    refundAmount: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Adjusting loyalty points for refunded transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('loyalty.points.adjusted', {
      tenantId: payload.tenantId,
      customerId: payload.transaction.customerId,
      transactionId: payload.transaction.id,
      originalAmount: payload.transaction.total,
      refundAmount: payload.refundAmount,
      pointsAdjusted: Math.floor(payload.refundAmount),
      refundReason: payload.refundData.reason,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  // Receipt and workflow methods
  private async triggerAutoReceipt(payload: {
    tenantId: string;
    transaction: any;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Triggering auto receipt for transaction ${payload.transaction.id}`);

    // Check if auto-receipt is enabled for this tenant/location
    this.eventEmitter.emit('receipt.auto.trigger', {
      tenantId: payload.tenantId,
      transactionId: payload.transaction.id,
      locationId: payload.transaction.locationId,
      customerId: payload.transaction.customerId,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async logPerformanceMetrics(payload: {
    tenantId: string;
    transaction: any;
    paymentResult: any;
    processingTime: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Logging performance metrics for transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('metrics.performance.logged', {
      tenantId: payload.tenantId,
      transactionId: payload.transaction.id,
      locationId: payload.transaction.locationId,
      processingTime: payload.processingTime,
      paymentMethod: payload.transaction.paymentMethod,
      paymentProvider: payload.paymentResult.paymentProvider,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async logFailureMetrics(payload: {
    tenantId: string;
    transactionData: any;
    error: string;
    processingTime: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Logging failure metrics for failed transaction`);

    this.eventEmitter.emit('metrics.failure.logged', {
      tenantId: payload.tenantId,
      locationId: payload.transactionData.locationId,
      error: payload.error,
      processingTime: payload.processingTime,
      paymentMethod: payload.transactionData.paymentMethod,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async updateRealtimeDashboards(payload: {
    tenantId: string;
    transaction: any;
    paymentResult: any;
    processingTime: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Updating real-time dashboards for transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('dashboard.realtime.update', {
      tenantId: payload.tenantId,
      locationId: payload.transaction.locationId,
      transactionData: {
        id: payload.transaction.id,
        total: payload.transaction.total,
        itemCount: payload.transaction.itemCount,
        paymentMethod: payload.transaction.paymentMethod,
        processingTime: payload.processingTime,
      },
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async triggerPostTransactionWorkflows(payload: {
    tenantId: string;
    transaction: any;
    paymentResult: any;
    processingTime: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Triggering post-transaction workflows for transaction ${payload.transaction.id}`);

    this.eventEmitter.emit('workflow.post.transaction', {
      tenantId: payload.tenantId,
      transactionId: payload.transaction.id,
      locationId: payload.transaction.locationId,
      customerId: payload.transaction.customerId,
      amount: payload.transaction.total,
      paymentMethod: payload.transaction.paymentMethod,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }

  private async triggerFailureRecovery(payload: {
    tenantId: string;
    transactionData: any;
    error: string;
    processingTime: number;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Triggering failure recovery workflows`);

    this.eventEmitter.emit('workflow.failure.recovery', {
      tenantId: payload.tenantId,
      locationId: payload.transactionData.locationId,
      error: payload.error,
      transactionData: payload.transactionData,
      timestamp: new Date(),
      userId: payload.userId,
    });
  }
}