import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PubSub } from 'graphql-subscriptions';
import { QuoteService } from '../services/quote.service';
import { B2BOrderService } from '../services/b2b-order.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

/**
 * Event handler for quote lifecycle events
 * 
 * Handles:
 * - Quote creation and updates
 * - Quote approval workflows
 * - Quote expiration notifications
 * - Quote to order conversions
 * - Customer notifications
 */
@Injectable()
export class QuoteEventHandler {
  private readonly logger = new Logger(QuoteEventHandler.name);

  constructor(
    private readonly quoteService: QuoteService,
    private readonly b2bOrderService: B2BOrderService,
    private readonly cacheService: IntelligentCacheService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  /**
   * Handle quote created event
   */
  @OnEvent('quote.created')
  async handleQuoteCreated(payload: any) {
    try {
      this.logger.log(`Handling quote created event for quote ${payload.quote.id}`);

      const { tenantId, quote, createdBy } = payload;

      // Send quote to customer
      await this.sendQuoteToCustomer(tenantId, quote);

      // Schedule expiration reminder
      await this.scheduleExpirationReminder(tenantId, quote.id, quote.expiresAt);

      // Invalidate related caches
      await this.invalidateQuoteCaches(tenantId, quote.customerId);

      // Publish real-time update
      await this.pubSub.publish('QUOTE_CREATED', {
        quoteCreated: {
          tenantId,
          quote,
          createdBy,
          createdAt: new Date(),
        },
      });

      this.logger.log(`Successfully handled quote created event for quote ${quote.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle quote created event:`, error);
    }
  }

  /**
   * Handle quote updated event
   */
  @OnEvent('quote.updated')
  async handleQuoteUpdated(payload: any) {
    try {
      this.logger.log(`Handling quote updated event for quote ${payload.quote.id}`);

      const { tenantId, quote, updatedBy, changes } = payload;

      // Send update notification to customer if significant changes
      if (this.hasSignificantChanges(changes)) {
        await this.sendQuoteUpdateToCustomer(tenantId, quote, changes);
      }

      // Invalidate caches
      await this.invalidateQuoteCaches(tenantId, quote.customerId);

      // Publish real-time update
      await this.pubSub.publish('QUOTE_UPDATED', {
        quoteUpdated: {
          tenantId,
          quote,
          updatedBy,
          changes,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Successfully handled quote updated event for quote ${quote.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle quote updated event:`, error);
    }
  }

  /**
   * Handle quote approved event
   */
  @OnEvent('quote.approved')
  async handleQuoteApproved(payload: any) {
    try {
      this.logger.log(`Handling quote approved event for quote ${payload.quote.id}`);

      const { tenantId, quote, approvedBy } = payload;

      // Send approval notification to customer
      await this.sendQuoteApprovalToCustomer(tenantId, quote);

      // Update quote status
      await this.quoteService.updateQuote(
        tenantId,
        quote.id,
        { status: 'approved', approvedBy, approvedAt: new Date() },
        approvedBy
      );

      // Invalidate caches
      await this.invalidateQuoteCaches(tenantId, quote.customerId);

      // Publish real-time update
      await this.pubSub.publish('QUOTE_APPROVED', {
        quoteApproved: {
          tenantId,
          quote,
          approvedBy,
          approvedAt: new Date(),
        },
      });

      this.logger.log(`Successfully handled quote approved event for quote ${quote.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle quote approved event:`, error);
    }
  }

  /**
   * Handle quote converted to order event
   */
  @OnEvent('quote.converted')
  async handleQuoteConverted(payload: any) {
    try {
      this.logger.log(`Handling quote converted event for quote ${payload.quote.id}`);

      const { tenantId, quote, order, convertedBy } = payload;

      // Update quote status
      await this.quoteService.updateQuote(
        tenantId,
        quote.id,
        { status: 'converted', convertedToOrderId: order.id, convertedAt: new Date() },
        convertedBy
      );

      // Send conversion confirmation to customer
      await this.sendConversionConfirmation(tenantId, quote, order);

      // Invalidate caches
      await this.invalidateQuoteCaches(tenantId, quote.customerId);

      // Publish real-time update
      await this.pubSub.publish('QUOTE_CONVERTED', {
        quoteConverted: {
          tenantId,
          quote,
          order,
          convertedBy,
          convertedAt: new Date(),
        },
      });

      this.logger.log(`Successfully handled quote converted event for quote ${quote.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle quote converted event:`, error);
    }
  }

  /**
   * Handle quote expired event
   */
  @OnEvent('quote.expired')
  async handleQuoteExpired(payload: any) {
    try {
      this.logger.log(`Handling quote expired event for quote ${payload.quote.id}`);

      const { tenantId, quote } = payload;

      // Update quote status
      await this.quoteService.updateQuote(
        tenantId,
        quote.id,
        { status: 'expired' },
        'system'
      );

      // Send expiration notification
      await this.sendExpirationNotification(tenantId, quote);

      // Invalidate caches
      await this.invalidateQuoteCaches(tenantId, quote.customerId);

      // Publish real-time update
      await this.pubSub.publish('QUOTE_EXPIRED', {
        quoteExpired: {
          tenantId,
          quote,
          expiredAt: new Date(),
        },
      });

      this.logger.log(`Successfully handled quote expired event for quote ${quote.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle quote expired event:`, error);
    }
  }

  /**
   * Invalidate quote-related caches
   */
  private async invalidateQuoteCaches(tenantId: string, customerId: string) {
    const cacheKeys = [
      `quotes:${tenantId}:*`,
      `customer-quotes:${tenantId}:${customerId}:*`,
      `quote-analytics:${tenantId}:*`,
    ];

    await Promise.all(
      cacheKeys.map(pattern => this.cacheService.invalidatePattern(pattern))
    );
  }

  /**
   * Send quote to customer
   */
  private async sendQuoteToCustomer(tenantId: string, quote: any) {
    this.logger.debug(`Sending quote ${quote.id} to customer`);
    // TODO: Integrate with notification service
  }

  /**
   * Send quote update to customer
   */
  private async sendQuoteUpdateToCustomer(tenantId: string, quote: any, changes: any) {
    this.logger.debug(`Sending quote update for ${quote.id} to customer`);
    // TODO: Integrate with notification service
  }

  /**
   * Send quote approval to customer
   */
  private async sendQuoteApprovalToCustomer(tenantId: string, quote: any) {
    this.logger.debug(`Sending quote approval for ${quote.id} to customer`);
    // TODO: Integrate with notification service
  }

  /**
   * Send conversion confirmation
   */
  private async sendConversionConfirmation(tenantId: string, quote: any, order: any) {
    this.logger.debug(`Sending conversion confirmation for quote ${quote.id} to order ${order.id}`);
    // TODO: Integrate with notification service
  }

  /**
   * Send expiration notification
   */
  private async sendExpirationNotification(tenantId: string, quote: any) {
    this.logger.debug(`Sending expiration notification for quote ${quote.id}`);
    // TODO: Integrate with notification service
  }

  /**
   * Schedule expiration reminder
   */
  private async scheduleExpirationReminder(tenantId: string, quoteId: string, expiresAt: Date) {
    this.logger.debug(`Scheduling expiration reminder for quote ${quoteId}`);
    // TODO: Integrate with job scheduler
  }

  /**
   * Check if changes are significant enough to notify customer
   */
  private hasSignificantChanges(changes: any): boolean {
    const significantFields = ['totalAmount', 'items', 'expiresAt', 'terms'];
    return significantFields.some(field => changes.hasOwnProperty(field));
  }
}