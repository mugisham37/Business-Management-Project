import { Resolver, Subscription, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

/**
 * GraphQL subscription resolver for quote real-time updates
 * 
 * Provides real-time notifications for:
 * - Quote creation and updates
 * - Quote approvals and rejections
 * - Quote conversions to orders
 * - Quote expirations
 * - Customer-specific quote updates
 */
@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class QuoteSubscriptionResolver {
  private readonly logger = new Logger(QuoteSubscriptionResolver.name);

  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  /**
   * Subscription: Quote status changed
   * Emitted when any quote status changes
   */
  @Subscription(() => Object, {
    name: 'quoteStatusChanged',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.quoteStatusChanged.tenantId === context.req.user.tenantId;
      const matchesQuote = !variables.quoteId || payload.quoteStatusChanged.id === variables.quoteId;
      const matchesCustomer = !variables.customerId || payload.quoteStatusChanged.customerId === variables.customerId;
      return matchesTenant && matchesQuote && matchesCustomer;
    },
  })
  quoteStatusChanged(
    @Args('quoteId', { type: () => ID, nullable: true }) quoteId?: string,
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: quoteStatusChanged for tenant ${tenantId}, quote ${quoteId || 'all'}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator([
      'QUOTE_CREATED',
      'QUOTE_UPDATED',
      'QUOTE_APPROVED',
      'QUOTE_REJECTED',
      'QUOTE_CONVERTED',
      'QUOTE_EXPIRED'
    ]);
  }

  /**
   * Subscription: Quote requires approval
   * Emitted when a quote is submitted and requires approval
   */
  @Subscription(() => Object, {
    name: 'quoteRequiresApproval',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.quoteRequiresApproval.tenantId === context.req.user.tenantId;
      const userCanApprove = context.req.user.permissions?.includes('quote:approve');
      return matchesTenant && userCanApprove;
    },
  })
  quoteRequiresApproval(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: quoteRequiresApproval for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('QUOTE_REQUIRES_APPROVAL');
  }

  /**
   * Subscription: Quote converted to order
   * Emitted when a quote is successfully converted to an order
   */
  @Subscription(() => Object, {
    name: 'quoteConverted',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.quoteConverted.tenantId === context.req.user.tenantId;
      const matchesCustomer = !variables.customerId || payload.quoteConverted.quote.customerId === variables.customerId;
      return matchesTenant && matchesCustomer;
    },
  })
  quoteConverted(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: quoteConverted for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator('QUOTE_CONVERTED');
  }

  /**
   * Subscription: Quote expiring soon
   * Emitted when a quote is approaching expiration
   */
  @Subscription(() => Object, {
    name: 'quoteExpiringSoon',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.quoteExpiringSoon.tenantId === context.req.user.tenantId;
      const matchesCustomer = !variables.customerId || payload.quoteExpiringSoon.customerId === variables.customerId;
      return matchesTenant && matchesCustomer;
    },
  })
  quoteExpiringSoon(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: quoteExpiringSoon for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator('QUOTE_EXPIRING_SOON');
  }
}