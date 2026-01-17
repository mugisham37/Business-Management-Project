import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PubSub } from 'graphql-subscriptions';
import { B2BPricingService } from '../services/b2b-pricing.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

/**
 * Event handler for pricing-related events
 * 
 * Handles:
 * - Pricing rule updates
 * - Customer tier changes
 * - Volume discount calculations
 * - Price list updates
 * - Promotional pricing
 */
@Injectable()
export class PricingEventHandler {
  private readonly logger = new Logger(PricingEventHandler.name);

  constructor(
    private readonly pricingService: B2BPricingService,
    private readonly cacheService: IntelligentCacheService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  /**
   * Handle pricing rule created event
   */
  @OnEvent('pricing.rule-created')
  async handlePricingRuleCreated(payload: any) {
    try {
      this.logger.log(`Handling pricing rule created event for rule ${payload.rule.id}`);

      const { tenantId, rule, createdBy } = payload;

      // Recalculate affected customer prices
      await this.recalculateAffectedPrices(tenantId, rule);

      // Invalidate pricing caches
      await this.invalidatePricingCaches(tenantId, rule.applicableCustomers);

      // Send notifications to affected customers
      await this.notifyAffectedCustomers(tenantId, rule, 'created');

      // Publish real-time update
      await this.pubSub.publish('PRICING_RULE_CREATED', {
        pricingRuleCreated: {
          tenantId,
          rule,
          createdBy,
          createdAt: new Date(),
        },
      });

      this.logger.log(`Successfully handled pricing rule created event for rule ${rule.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle pricing rule created event:`, error);
    }
  }

  /**
   * Handle pricing rule updated event
   */
  @OnEvent('pricing.rule-updated')
  async handlePricingRuleUpdated(payload: any) {
    try {
      this.logger.log(`Handling pricing rule updated event for rule ${payload.rule.id}`);

      const { tenantId, rule, updatedBy, changes } = payload;

      // Recalculate affected customer prices
      await this.recalculateAffectedPrices(tenantId, rule);

      // Invalidate pricing caches
      await this.invalidatePricingCaches(tenantId, rule.applicableCustomers);

      // Send notifications if significant changes
      if (this.hasSignificantPricingChanges(changes)) {
        await this.notifyAffectedCustomers(tenantId, rule, 'updated');
      }

      // Publish real-time update
      await this.pubSub.publish('PRICING_RULE_UPDATED', {
        pricingRuleUpdated: {
          tenantId,
          rule,
          updatedBy,
          changes,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Successfully handled pricing rule updated event for rule ${rule.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle pricing rule updated event:`, error);
    }
  }

  /**
   * Handle customer tier changed event
   */
  @OnEvent('pricing.customer-tier-changed')
  async handleCustomerTierChanged(payload: any) {
    try {
      this.logger.log(`Handling customer tier changed event for customer ${payload.customerId}`);

      const { tenantId, customerId, oldTier, newTier, changedBy } = payload;

      // Recalculate customer prices based on new tier
      await this.recalculateCustomerPrices(tenantId, customerId, newTier);

      // Update active quotes and orders
      await this.updateActiveQuotesAndOrders(tenantId, customerId);

      // Invalidate customer-specific caches
      await this.invalidateCustomerPricingCaches(tenantId, customerId);

      // Send tier change notification to customer
      await this.sendTierChangeNotification(tenantId, customerId, oldTier, newTier);

      // Publish real-time update
      await this.pubSub.publish('CUSTOMER_TIER_CHANGED', {
        customerTierChanged: {
          tenantId,
          customerId,
          oldTier,
          newTier,
          changedBy,
          changedAt: new Date(),
        },
      });

      this.logger.log(`Successfully handled customer tier changed event for customer ${customerId}`);
    } catch (error) {
      this.logger.error(`Failed to handle customer tier changed event:`, error);
    }
  }

  /**
   * Handle volume discount threshold reached event
   */
  @OnEvent('pricing.volume-threshold-reached')
  async handleVolumeThresholdReached(payload: any) {
    try {
      this.logger.log(`Handling volume threshold reached event for customer ${payload.customerId}`);

      const { tenantId, customerId, threshold, currentVolume } = payload;

      // Apply volume discount to pending orders
      await this.applyVolumeDiscountToPendingOrders(tenantId, customerId, threshold);

      // Send volume discount notification
      await this.sendVolumeDiscountNotification(tenantId, customerId, threshold, currentVolume);

      // Publish real-time update
      await this.pubSub.publish('VOLUME_THRESHOLD_REACHED', {
        volumeThresholdReached: {
          tenantId,
          customerId,
          threshold,
          currentVolume,
          reachedAt: new Date(),
        },
      });

      this.logger.log(`Successfully handled volume threshold reached event for customer ${customerId}`);
    } catch (error) {
      this.logger.error(`Failed to handle volume threshold reached event:`, error);
    }
  }

  /**
   * Handle promotional pricing activated event
   */
  @OnEvent('pricing.promotion-activated')
  async handlePromotionActivated(payload: any) {
    try {
      this.logger.log(`Handling promotion activated event for promotion ${payload.promotion.id}`);

      const { tenantId, promotion, activatedBy } = payload;

      // Apply promotion to eligible customers
      await this.applyPromotionToEligibleCustomers(tenantId, promotion);

      // Invalidate pricing caches
      await this.invalidatePromotionCaches(tenantId, promotion);

      // Send promotion notifications
      await this.sendPromotionNotifications(tenantId, promotion);

      // Publish real-time update
      await this.pubSub.publish('PROMOTION_ACTIVATED', {
        promotionActivated: {
          tenantId,
          promotion,
          activatedBy,
          activatedAt: new Date(),
        },
      });

      this.logger.log(`Successfully handled promotion activated event for promotion ${promotion.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle promotion activated event:`, error);
    }
  }

  /**
   * Recalculate prices for customers affected by pricing rule
   */
  private async recalculateAffectedPrices(tenantId: string, rule: any) {
    this.logger.debug(`Recalculating prices affected by rule ${rule.id}`);
    
    if (rule.applicableCustomers && rule.applicableCustomers.length > 0) {
      await Promise.all(
        rule.applicableCustomers.map((customerId: string) =>
          this.pricingService.recalculateCustomerPrices(tenantId, customerId)
        )
      );
    } else {
      // Rule applies to all customers
      await this.pricingService.recalculateAllCustomerPrices(tenantId);
    }
  }

  /**
   * Recalculate prices for specific customer
   */
  private async recalculateCustomerPrices(tenantId: string, customerId: string, tier: string) {
    this.logger.debug(`Recalculating prices for customer ${customerId} with tier ${tier}`);
    await this.pricingService.recalculateCustomerPrices(tenantId, customerId);
  }

  /**
   * Update active quotes and orders with new pricing
   */
  private async updateActiveQuotesAndOrders(tenantId: string, customerId: string) {
    this.logger.debug(`Updating active quotes and orders for customer ${customerId}`);
    // TODO: Integrate with quote and order services
  }

  /**
   * Apply volume discount to pending orders
   */
  private async applyVolumeDiscountToPendingOrders(tenantId: string, customerId: string, threshold: any) {
    this.logger.debug(`Applying volume discount to pending orders for customer ${customerId}`);
    // TODO: Integrate with order service
  }

  /**
   * Apply promotion to eligible customers
   */
  private async applyPromotionToEligibleCustomers(tenantId: string, promotion: any) {
    this.logger.debug(`Applying promotion ${promotion.id} to eligible customers`);
    // TODO: Implement promotion application logic
  }

  /**
   * Invalidate pricing-related caches
   */
  private async invalidatePricingCaches(tenantId: string, customerIds?: string[]) {
    const patterns = [`pricing:${tenantId}:*`];
    
    if (customerIds) {
      customerIds.forEach(customerId => {
        patterns.push(`customer-pricing:${tenantId}:${customerId}:*`);
      });
    }

    await Promise.all(
      patterns.map(pattern => this.cacheService.invalidatePattern(pattern))
    );
  }

  /**
   * Invalidate customer-specific pricing caches
   */
  private async invalidateCustomerPricingCaches(tenantId: string, customerId: string) {
    const patterns = [
      `customer-pricing:${tenantId}:${customerId}:*`,
      `customer-tier:${tenantId}:${customerId}:*`,
      `volume-discounts:${tenantId}:${customerId}:*`,
    ];

    await Promise.all(
      patterns.map(pattern => this.cacheService.invalidatePattern(pattern))
    );
  }

  /**
   * Invalidate promotion-related caches
   */
  private async invalidatePromotionCaches(tenantId: string, promotion: any) {
    const patterns = [
      `promotions:${tenantId}:*`,
      `active-promotions:${tenantId}:*`,
    ];

    if (promotion.applicableCustomers) {
      promotion.applicableCustomers.forEach((customerId: string) => {
        patterns.push(`customer-promotions:${tenantId}:${customerId}:*`);
      });
    }

    await Promise.all(
      patterns.map(pattern => this.cacheService.invalidatePattern(pattern))
    );
  }

  /**
   * Send notifications to affected customers
   */
  private async notifyAffectedCustomers(tenantId: string, rule: any, action: string) {
    this.logger.debug(`Sending pricing notifications for rule ${rule.id} action ${action}`);
    // TODO: Integrate with notification service
  }

  /**
   * Send tier change notification
   */
  private async sendTierChangeNotification(tenantId: string, customerId: string, oldTier: string, newTier: string) {
    this.logger.debug(`Sending tier change notification for customer ${customerId}`);
    // TODO: Integrate with notification service
  }

  /**
   * Send volume discount notification
   */
  private async sendVolumeDiscountNotification(tenantId: string, customerId: string, threshold: any, currentVolume: number) {
    this.logger.debug(`Sending volume discount notification for customer ${customerId}`);
    // TODO: Integrate with notification service
  }

  /**
   * Send promotion notifications
   */
  private async sendPromotionNotifications(tenantId: string, promotion: any) {
    this.logger.debug(`Sending promotion notifications for promotion ${promotion.id}`);
    // TODO: Integrate with notification service
  }

  /**
   * Check if pricing changes are significant
   */
  private hasSignificantPricingChanges(changes: any): boolean {
    const significantFields = ['discountPercentage', 'minimumQuantity', 'validFrom', 'validTo'];
    return significantFields.some(field => changes.hasOwnProperty(field));
  }
}