import { Resolver, Subscription, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

/**
 * GraphQL subscription resolver for pricing real-time updates
 * 
 * Provides real-time notifications for:
 * - Pricing rule changes
 * - Customer tier updates
 * - Volume discount achievements
 * - Promotional pricing activations
 * - Price list updates
 */
@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class PricingSubscriptionResolver {
  private readonly logger = new Logger(PricingSubscriptionResolver.name);

  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  /**
   * Subscription: Pricing rule updated
   * Emitted when pricing rules are created or updated
   */
  @Subscription(() => Object, {
    name: 'pricingRuleUpdated',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.pricingRuleUpdated.tenantId === context.req.user.tenantId;
      const userCanViewPricing = context.req.user.permissions?.includes('pricing:read');
      
      // Filter by customer if specified and rule applies to them
      if (variables.customerId && payload.pricingRuleUpdated.rule.applicableCustomers) {
        const appliesToCustomer = payload.pricingRuleUpdated.rule.applicableCustomers.includes(variables.customerId);
        return matchesTenant && userCanViewPricing && appliesToCustomer;
      }
      
      return matchesTenant && userCanViewPricing;
    },
  })
  pricingRuleUpdated(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: pricingRuleUpdated for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator([
      'PRICING_RULE_CREATED',
      'PRICING_RULE_UPDATED',
      'PRICING_RULE_DELETED'
    ]);
  }

  /**
   * Subscription: Customer tier changed
   * Emitted when a customer's pricing tier is updated
   */
  @Subscription(() => Object, {
    name: 'customerTierChanged',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.customerTierChanged.tenantId === context.req.user.tenantId;
      const matchesCustomer = !variables.customerId || payload.customerTierChanged.customerId === variables.customerId;
      
      // Customer can see their own tier changes, or users with pricing permissions can see all
      const isOwnCustomer = context.req.user.customerId === payload.customerTierChanged.customerId;
      const canViewAllPricing = context.req.user.permissions?.includes('pricing:read');
      
      return matchesTenant && matchesCustomer && (isOwnCustomer || canViewAllPricing);
    },
  })
  customerTierChanged(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: customerTierChanged for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator('CUSTOMER_TIER_CHANGED');
  }

  /**
   * Subscription: Volume threshold reached
   * Emitted when a customer reaches a volume discount threshold
   */
  @Subscription(() => Object, {
    name: 'volumeThresholdReached',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.volumeThresholdReached.tenantId === context.req.user.tenantId;
      const matchesCustomer = !variables.customerId || payload.volumeThresholdReached.customerId === variables.customerId;
      
      // Customer can see their own achievements, or users with pricing permissions can see all
      const isOwnCustomer = context.req.user.customerId === payload.volumeThresholdReached.customerId;
      const canViewAllPricing = context.req.user.permissions?.includes('pricing:read');
      
      return matchesTenant && matchesCustomer && (isOwnCustomer || canViewAllPricing);
    },
  })
  volumeThresholdReached(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: volumeThresholdReached for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator('VOLUME_THRESHOLD_REACHED');
  }

  /**
   * Subscription: Promotion activated
   * Emitted when a promotional pricing is activated
   */
  @Subscription(() => Object, {
    name: 'promotionActivated',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.promotionActivated.tenantId === context.req.user.tenantId;
      
      // Filter by customer if specified and promotion applies to them
      if (variables.customerId && payload.promotionActivated.promotion.applicableCustomers) {
        const appliesToCustomer = payload.promotionActivated.promotion.applicableCustomers.includes(variables.customerId);
        return matchesTenant && appliesToCustomer;
      }
      
      // If no customer filter, show to users who can view promotions
      const canViewPromotions = context.req.user.permissions?.includes('promotion:read') || 
                               context.req.user.customerId; // Customers can see promotions
      
      return matchesTenant && canViewPromotions;
    },
  })
  promotionActivated(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: promotionActivated for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator('PROMOTION_ACTIVATED');
  }

  /**
   * Subscription: Price list updated
   * Emitted when product price lists are updated
   */
  @Subscription(() => Object, {
    name: 'priceListUpdated',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.priceListUpdated.tenantId === context.req.user.tenantId;
      const userCanViewPricing = context.req.user.permissions?.includes('pricing:read') ||
                                context.req.user.customerId; // Customers can see price updates
      
      return matchesTenant && userCanViewPricing;
    },
  })
  priceListUpdated(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: priceListUpdated for tenant ${tenantId}`);
    return this.pubSub.asyncIterator([
      'PRICE_LIST_UPDATED',
      'PRODUCT_PRICE_CHANGED'
    ]);
  }

  /**
   * Subscription: Customer pricing updated
   * Emitted when customer-specific pricing is recalculated
   */
  @Subscription(() => Object, {
    name: 'customerPricingUpdated',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.customerPricingUpdated.tenantId === context.req.user.tenantId;
      const matchesCustomer = !variables.customerId || payload.customerPricingUpdated.customerId === variables.customerId;
      
      // Customer can see their own pricing updates, or users with pricing permissions can see all
      const isOwnCustomer = context.req.user.customerId === payload.customerPricingUpdated.customerId;
      const canViewAllPricing = context.req.user.permissions?.includes('pricing:read');
      
      return matchesTenant && matchesCustomer && (isOwnCustomer || canViewAllPricing);
    },
  })
  customerPricingUpdated(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: customerPricingUpdated for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator('CUSTOMER_PRICING_UPDATED');
  }
}