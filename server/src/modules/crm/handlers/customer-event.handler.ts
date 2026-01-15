import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CustomerService } from '../services/customer.service';

@Injectable()
export class CustomerEventHandler {
  private readonly logger = new Logger(CustomerEventHandler.name);

  constructor(private readonly customerService: CustomerService) {}

  @OnEvent('transaction.completed')
  async handleTransactionCompleted(payload: {
    tenantId: string;
    transaction: {
      id: string;
      customerId?: string;
      total: number;
      createdAt: Date;
    };
    userId: string;
  }) {
    try {
      if (!payload.transaction.customerId) {
        return; // No customer associated with transaction
      }

      this.logger.log(`Updating customer purchase stats for transaction ${payload.transaction.id}`);

      // Update customer purchase statistics
      await this.customerService.updatePurchaseStats(
        payload.tenantId,
        payload.transaction.customerId,
        payload.transaction.total,
        payload.transaction.createdAt,
      );

      this.logger.log(`Updated customer ${payload.transaction.customerId} purchase stats`);
    } catch (error) {
      this.logger.error(`Failed to handle transaction completed event:`, error);
    }
  }

  @OnEvent('loyalty.points.earned')
  async handleLoyaltyPointsEarned(payload: {
    tenantId: string;
    customerId: string;
    points: number;
    transactionId: string;
    reason: string;
  }) {
    try {
      this.logger.log(`Adding ${payload.points} loyalty points to customer ${payload.customerId}`);

      await this.customerService.updateLoyaltyPoints(
        payload.tenantId,
        payload.customerId,
        payload.points,
        payload.reason,
      );

      this.logger.log(`Added ${payload.points} loyalty points to customer ${payload.customerId}`);
    } catch (error) {
      this.logger.error(`Failed to handle loyalty points earned event:`, error);
    }
  }

  @OnEvent('loyalty.points.redeemed')
  async handleLoyaltyPointsRedeemed(payload: {
    tenantId: string;
    customerId: string;
    points: number;
    transactionId: string;
    reason: string;
  }) {
    try {
      this.logger.log(`Redeeming ${payload.points} loyalty points from customer ${payload.customerId}`);

      await this.customerService.updateLoyaltyPoints(
        payload.tenantId,
        payload.customerId,
        -payload.points, // Negative for redemption
        payload.reason,
      );

      this.logger.log(`Redeemed ${payload.points} loyalty points from customer ${payload.customerId}`);
    } catch (error) {
      this.logger.error(`Failed to handle loyalty points redeemed event:`, error);
    }
  }

  @OnEvent('loyalty.points.reversed')
  async handleLoyaltyPointsReversed(payload: {
    tenantId: string;
    customerId: string;
    points: number;
    transactionId: string;
    reason: string;
  }) {
    try {
      this.logger.log(`Reversing ${payload.points} loyalty points from customer ${payload.customerId}`);

      await this.customerService.updateLoyaltyPoints(
        payload.tenantId,
        payload.customerId,
        -payload.points, // Negative for reversal
        payload.reason,
      );

      this.logger.log(`Reversed ${payload.points} loyalty points from customer ${payload.customerId}`);
    } catch (error) {
      this.logger.error(`Failed to handle loyalty points reversed event:`, error);
    }
  }

  @OnEvent('loyalty.points.adjusted')
  async handleLoyaltyPointsAdjusted(payload: {
    tenantId: string;
    customerId: string;
    points: number;
    transactionId: string;
    reason: string;
  }) {
    try {
      this.logger.log(`Adjusting ${payload.points} loyalty points for customer ${payload.customerId}`);

      await this.customerService.updateLoyaltyPoints(
        payload.tenantId,
        payload.customerId,
        payload.points,
        payload.reason,
      );

      this.logger.log(`Adjusted ${payload.points} loyalty points for customer ${payload.customerId}`);
    } catch (error) {
      this.logger.error(`Failed to handle loyalty points adjusted event:`, error);
    }
  }

  @OnEvent('customer.created')
  async handleCustomerCreated(payload: {
    tenantId: string;
    customerId: string;
    customer: any;
    userId: string;
  }) {
    try {
      this.logger.log(`Customer ${payload.customerId} created for tenant ${payload.tenantId}`);

      // Here you could add logic for:
      // - Sending welcome emails
      // - Creating default customer segments
      // - Setting up initial preferences
      // - Triggering onboarding workflows

      // For now, just log the event
      this.logger.log(`Customer creation event processed for ${payload.customerId}`);
    } catch (error) {
      this.logger.error(`Failed to handle customer created event:`, error);
    }
  }

  @OnEvent('customer.updated')
  async handleCustomerUpdated(payload: {
    tenantId: string;
    customerId: string;
    customer: any;
    previousData: any;
    userId: string;
  }) {
    try {
      this.logger.log(`Customer ${payload.customerId} updated for tenant ${payload.tenantId}`);

      // Here you could add logic for:
      // - Detecting significant changes (tier upgrades, contact info changes)
      // - Updating customer segments
      // - Triggering marketing campaigns
      // - Syncing with external systems

      // For now, just log the event
      this.logger.log(`Customer update event processed for ${payload.customerId}`);
    } catch (error) {
      this.logger.error(`Failed to handle customer updated event:`, error);
    }
  }

  @OnEvent('customer.deleted')
  async handleCustomerDeleted(payload: {
    tenantId: string;
    customerId: string;
    customer: any;
    userId: string;
  }) {
    try {
      this.logger.log(`Customer ${payload.customerId} deleted for tenant ${payload.tenantId}`);

      // Here you could add logic for:
      // - Cleaning up related data
      // - Removing from segments
      // - Canceling scheduled communications
      // - Archiving customer data

      // For now, just log the event
      this.logger.log(`Customer deletion event processed for ${payload.customerId}`);
    } catch (error) {
      this.logger.error(`Failed to handle customer deleted event:`, error);
    }
  }
}