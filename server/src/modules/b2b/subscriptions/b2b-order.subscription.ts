import { Resolver, Subscription, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { B2BOrderType } from '../types/b2b-order.types';

/**
 * GraphQL subscription resolver for B2B order real-time updates
 * 
 * Provides real-time notifications for:
 * - Order status changes
 * - Order approvals and rejections
 * - Order shipping updates
 * - Order cancellations
 * - Customer-specific order updates
 * 
 * All subscriptions are filtered by tenant for multi-tenant isolation
 */
@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class B2BOrderSubscriptionResolver {
  private readonly logger = new Logger(B2BOrderSubscriptionResolver.name);

  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  /**
   * Subscription: Order status changed
   * Emitted when any order status changes
   */
  @Subscription(() => B2BOrderType, {
    name: 'orderStatusChanged',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.orderStatusChanged.tenantId === context.req.user.tenantId;
      const matchesOrder = !variables.orderId || payload.orderStatusChanged.id === variables.orderId;
      const matchesCustomer = !variables.customerId || payload.orderStatusChanged.customerId === variables.customerId;
      return matchesTenant && matchesOrder && matchesCustomer;
    },
  })
  orderStatusChanged(
    @Args('orderId', { type: () => ID, nullable: true }) orderId?: string,
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: orderStatusChanged for tenant ${tenantId}, order ${orderId || 'all'}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator([
      'B2B_ORDER_CREATED',
      'B2B_ORDER_UPDATED', 
      'B2B_ORDER_APPROVED',
      'B2B_ORDER_REJECTED',
      'B2B_ORDER_SHIPPED',
      'B2B_ORDER_CANCELLED'
    ]);
  }

  /**
   * Subscription: Order requires approval
   * Emitted when an order is submitted and requires approval
   */
  @Subscription(() => B2BOrderType, {
    name: 'orderRequiresApproval',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.orderRequiresApproval.tenantId === context.req.user.tenantId;
      const userCanApprove = context.req.user.permissions?.includes('b2b_order:approve');
      return matchesTenant && userCanApprove;
    },
  })
  orderRequiresApproval(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: orderRequiresApproval for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('ORDER_REQUIRES_APPROVAL');
  }

  /**
   * Subscription: Order shipped
   * Emitted when an order is shipped with tracking information
   */
  @Subscription(() => B2BOrderType, {
    name: 'orderShipped',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.orderShipped.tenantId === context.req.user.tenantId;
      const matchesCustomer = !variables.customerId || payload.orderShipped.customerId === variables.customerId;
      return matchesTenant && matchesCustomer;
    },
  })
  orderShipped(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: orderShipped for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator('B2B_ORDER_SHIPPED');
  }

  /**
   * Subscription: Order overdue
   * Emitted when an order becomes overdue for payment
   */
  @Subscription(() => B2BOrderType, {
    name: 'orderOverdue',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.orderOverdue.tenantId === context.req.user.tenantId;
      const userCanViewFinancials = context.req.user.permissions?.includes('financial:read');
      return matchesTenant && userCanViewFinancials;
    },
  })
  orderOverdue(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: orderOverdue for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('ORDER_OVERDUE');
  }
}