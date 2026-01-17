import { Resolver, Query, Mutation, Args, Context, ID, ResolveField, Parent, Subscription } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { B2BOrderService } from '../services/b2b-order.service';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { 
  CreateB2BOrderInput, 
  UpdateB2BOrderInput, 
  B2BOrderQueryInput,
  ApproveOrderInput,
  RejectOrderInput,
  ShipOrderInput,
  B2BOrderType,
  B2BOrdersResponse,
  OrderApprovalResponse,
  OrderShippingResponse,
  OrderAnalyticsType,
  B2BOrderItemType
} from '../types/b2b-order.types';

/**
 * GraphQL resolver for B2B order management
 * 
 * Provides comprehensive operations for:
 * - Order CRUD operations with full lifecycle management
 * - Order approval workflows with multi-step processes
 * - Order shipping and fulfillment tracking
 * - Real-time order status updates via subscriptions
 * - Advanced order analytics and reporting
 * - Order item management and inventory integration
 * 
 * @requires JwtAuthGuard - Authentication required for all operations
 * @requires TenantGuard - Tenant isolation enforced
 * @requires FeatureGuard - Feature access control
 * @requires PermissionsGuard - Permission-based access control
 */
@Resolver(() => B2BOrderType)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('b2b-operations')
export class B2BOrderResolver extends BaseResolver {
  private readonly logger = new Logger(B2BOrderResolver.name);

  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly b2bOrderService: B2BOrderService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  /**
   * Query: Get paginated list of B2B orders with advanced filtering
   * @permission b2b_order:read
   */
  @Query(() => B2BOrdersResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:read')
  async getB2BOrders(
    @Args('query') query: B2BOrderQueryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<B2BOrdersResponse> {
    try {
      this.logger.debug(`Fetching B2B orders for tenant ${tenantId} with query:`, query);
      const result = await this.b2bOrderService.findB2BOrders(tenantId, query);

      return {
        orders: result.orders,
        total: result.total,
        page: query.page,
        limit: query.limit,
        hasNextPage: (query.page * query.limit) < result.total,
        hasPreviousPage: query.page > 1,
      };
    } catch (error) {
      this.logger.error(`Failed to get B2B orders:`, error);
      throw error;
    }
  }

  /**
   * Query: Get a single B2B order by ID with full details
   * @permission b2b_order:read
   */
  @Query(() => B2BOrderType)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:read')
  async getB2BOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<B2BOrderType> {
    try {
      this.logger.debug(`Fetching B2B order ${id} for tenant ${tenantId}`);
      return await this.b2bOrderService.findB2BOrderById(tenantId, id);
    } catch (error) {
      this.logger.error(`Failed to get B2B order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Query: Get B2B order by order number
   * @permission b2b_order:read
   */
  @Query(() => B2BOrderType)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:read')
  async getB2BOrderByNumber(
    @Args('orderNumber') orderNumber: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<B2BOrderType> {
    try {
      this.logger.debug(`Fetching B2B order by number ${orderNumber} for tenant ${tenantId}`);
      return await this.b2bOrderService.findB2BOrderByNumber(tenantId, orderNumber);
    } catch (error) {
      this.logger.error(`Failed to get B2B order by number ${orderNumber}:`, error);
      throw error;
    }
  }

  /**
   * Query: Get orders requiring approval
   * @permission b2b_order:read
   */
  @Query(() => B2BOrdersResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:read')
  async getOrdersRequiringApproval(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<B2BOrdersResponse> {
    try {
      this.logger.debug(`Fetching orders requiring approval for tenant ${tenantId}`);
      const result = await this.b2bOrderService.getOrdersRequiringApproval(tenantId, page, limit);

      return {
        orders: result.orders,
        total: result.total,
        page,
        limit,
        hasNextPage: (page * limit) < result.total,
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      this.logger.error(`Failed to get orders requiring approval:`, error);
      throw error;
    }
  }

  /**
   * Query: Get order analytics and metrics
   * @permission b2b_order:read
   */
  @Query(() => OrderAnalyticsType)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:read')
  async getOrderAnalytics(
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @Args('salesRepId', { type: () => ID, nullable: true }) salesRepId?: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<OrderAnalyticsType> {
    try {
      this.logger.debug(`Fetching order analytics for tenant ${tenantId}`);
      return await this.b2bOrderService.getOrderAnalytics(
        tenantId,
        startDate,
        endDate,
        customerId,
        salesRepId,
      );
    } catch (error) {
      this.logger.error(`Failed to get order analytics:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Create a new B2B order with automatic pricing calculation
   * @permission b2b_order:create
   */
  @Mutation(() => B2BOrderType)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:create')
  async createB2BOrder(
    @Args('input') input: CreateB2BOrderInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<B2BOrderType> {
    try {
      this.logger.log(`Creating B2B order for tenant ${tenantId} by user ${user.id}`);
      
      const order = await this.b2bOrderService.createB2BOrder(
        tenantId,
        input,
        user.id,
      );

      // Publish order created event
      await this.pubSub.publish('B2B_ORDER_CREATED', {
        b2bOrderCreated: {
          tenantId,
          order,
          createdBy: user.id,
        },
      });

      this.logger.log(`Created B2B order ${order.orderNumber} (${order.id})`);
      return order;
    } catch (error) {
      this.logger.error(`Failed to create B2B order:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Update an existing B2B order
   * @permission b2b_order:update
   */
  @Mutation(() => B2BOrderType)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:update')
  async updateB2BOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateB2BOrderInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<B2BOrderType> {
    try {
      this.logger.log(`Updating B2B order ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const order = await this.b2bOrderService.updateB2BOrder(
        tenantId,
        id,
        input,
        user.id,
      );

      // Publish order updated event
      await this.pubSub.publish('B2B_ORDER_UPDATED', {
        b2bOrderUpdated: {
          tenantId,
          order,
          updatedBy: user.id,
        },
      });

      this.logger.log(`Updated B2B order ${id}`);
      return order;
    } catch (error) {
      this.logger.error(`Failed to update B2B order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Approve a B2B order
   * @permission b2b_order:approve
   */
  @Mutation(() => OrderApprovalResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:approve')
  async approveB2BOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ApproveOrderInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<OrderApprovalResponse> {
    try {
      this.logger.log(`Approving B2B order ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const order = await this.b2bOrderService.approveOrder(
        tenantId,
        id,
        input.approvalNotes,
        user.id,
      );

      // Publish order approved event
      await this.pubSub.publish('B2B_ORDER_APPROVED', {
        b2bOrderApproved: {
          tenantId,
          order,
          approvedBy: user.id,
          approvedAt: new Date(),
        },
      });

      this.logger.log(`Approved B2B order ${id}`);
      return {
        order,
        message: 'Order approved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to approve B2B order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Reject a B2B order
   * @permission b2b_order:approve
   */
  @Mutation(() => OrderApprovalResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:approve')
  async rejectB2BOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: RejectOrderInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<OrderApprovalResponse> {
    try {
      this.logger.log(`Rejecting B2B order ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const order = await this.b2bOrderService.rejectOrder(
        tenantId,
        id,
        input.rejectionReason,
        user.id,
      );

      // Publish order rejected event
      await this.pubSub.publish('B2B_ORDER_REJECTED', {
        b2bOrderRejected: {
          tenantId,
          order,
          rejectedBy: user.id,
          rejectedAt: new Date(),
          rejectionReason: input.rejectionReason,
        },
      });

      this.logger.log(`Rejected B2B order ${id}`);
      return {
        order,
        message: 'Order rejected successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to reject B2B order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Ship a B2B order
   * @permission b2b_order:ship
   */
  @Mutation(() => OrderShippingResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:ship')
  async shipB2BOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ShipOrderInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<OrderShippingResponse> {
    try {
      this.logger.log(`Shipping B2B order ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const order = await this.b2bOrderService.shipOrder(
        tenantId,
        id,
        input,
        user.id,
      );

      // Publish order shipped event
      await this.pubSub.publish('B2B_ORDER_SHIPPED', {
        b2bOrderShipped: {
          tenantId,
          order,
          shippedBy: user.id,
          shippedAt: new Date(),
          trackingNumber: input.trackingNumber,
        },
      });

      this.logger.log(`Shipped B2B order ${id} with tracking ${input.trackingNumber}`);
      return {
        order,
        message: 'Order shipped successfully',
        trackingNumber: input.trackingNumber,
        estimatedDeliveryDate: input.estimatedDeliveryDate,
      };
    } catch (error) {
      this.logger.error(`Failed to ship B2B order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Cancel a B2B order
   * @permission b2b_order:cancel
   */
  @Mutation(() => B2BOrderType)
  @UseGuards(PermissionsGuard)
  @Permissions('b2b_order:cancel')
  async cancelB2BOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('cancellationReason') cancellationReason: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<B2BOrderType> {
    try {
      this.logger.log(`Cancelling B2B order ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const order = await this.b2bOrderService.cancelOrder(
        tenantId,
        id,
        cancellationReason,
        user.id,
      );

      // Publish order cancelled event
      await this.pubSub.publish('B2B_ORDER_CANCELLED', {
        b2bOrderCancelled: {
          tenantId,
          order,
          cancelledBy: user.id,
          cancelledAt: new Date(),
          cancellationReason,
        },
      });

      this.logger.log(`Cancelled B2B order ${id}`);
      return order;
    } catch (error) {
      this.logger.error(`Failed to cancel B2B order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load customer for order
   * Uses DataLoader for batch loading to prevent N+1 queries
   */
  @ResolveField('customer')
  async getCustomer(
    @Parent() order: B2BOrderType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      return await this.dataLoaderService.getCustomerLoader(tenantId).load(order.customerId);
    } catch (error) {
      this.logger.error(`Failed to load customer for order ${order.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load sales representative for order
   */
  @ResolveField('salesRep')
  async getSalesRep(
    @Parent() order: B2BOrderType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!order.salesRepId) {
        return null;
      }
      return await this.dataLoaderService.getUserLoader(tenantId).load(order.salesRepId);
    } catch (error) {
      this.logger.error(`Failed to load sales rep for order ${order.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load account manager for order
   */
  @ResolveField('accountManager')
  async getAccountManager(
    @Parent() order: B2BOrderType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!order.accountManagerId) {
        return null;
      }
      return await this.dataLoaderService.getUserLoader(tenantId).load(order.accountManagerId);
    } catch (error) {
      this.logger.error(`Failed to load account manager for order ${order.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load approver for order
   */
  @ResolveField('approver')
  async getApprover(
    @Parent() order: B2BOrderType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!order.approvedBy) {
        return null;
      }
      return await this.dataLoaderService.getUserLoader(tenantId).load(order.approvedBy);
    } catch (error) {
      this.logger.error(`Failed to load approver for order ${order.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load related quote for order
   */
  @ResolveField('quote')
  async getQuote(
    @Parent() order: B2BOrderType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!order.quoteId) {
        return null;
      }
      return await this.dataLoaderService.getQuoteLoader(tenantId).load(order.quoteId);
    } catch (error) {
      this.logger.error(`Failed to load quote for order ${order.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Check if order can be approved
   */
  @ResolveField('canBeApproved')
  async getCanBeApproved(
    @Parent() order: B2BOrderType,
  ): Promise<boolean> {
    return order.status === 'pending_approval' && order.requiresApproval;
  }

  /**
   * Field Resolver: Check if order can be rejected
   */
  @ResolveField('canBeRejected')
  async getCanBeRejected(
    @Parent() order: B2BOrderType,
  ): Promise<boolean> {
    return order.status === 'pending_approval' && order.requiresApproval;
  }

  /**
   * Field Resolver: Check if order can be cancelled
   */
  @ResolveField('canBeCancelled')
  async getCanBeCancelled(
    @Parent() order: B2BOrderType,
  ): Promise<boolean> {
    return ['draft', 'pending_approval', 'approved', 'processing'].includes(order.status);
  }

  /**
   * Field Resolver: Check if order can be shipped
   */
  @ResolveField('canBeShipped')
  async getCanBeShipped(
    @Parent() order: B2BOrderType,
  ): Promise<boolean> {
    return order.status === 'approved' || order.status === 'processing';
  }

  /**
   * Field Resolver: Check if order is overdue
   */
  @ResolveField('isOverdue')
  async getIsOverdue(
    @Parent() order: B2BOrderType,
  ): Promise<boolean> {
    if (!order.paymentDueDate) {
      return false;
    }
    return new Date() > new Date(order.paymentDueDate);
  }

  /**
   * Field Resolver: Calculate days until due
   */
  @ResolveField('daysUntilDue')
  async getDaysUntilDue(
    @Parent() order: B2BOrderType,
  ): Promise<number> {
    if (!order.paymentDueDate) {
      return -1;
    }
    
    const now = new Date();
    const dueDate = new Date(order.paymentDueDate);
    const diffTime = dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Field Resolver: Calculate total savings
   */
  @ResolveField('totalSavings')
  async getTotalSavings(
    @Parent() order: B2BOrderType,
  ): Promise<number> {
    return order.items.reduce((total, item) => total + item.discountAmount * item.quantity, 0);
  }

  /**
   * Field Resolver: Calculate fulfillment percentage
   */
  @ResolveField('fulfillmentPercentage')
  async getFulfillmentPercentage(
    @Parent() order: B2BOrderType,
  ): Promise<number> {
    const totalQuantity = order.items.reduce((total, item) => total + item.quantity, 0);
    const shippedQuantity = order.items.reduce((total, item) => total + item.quantityShipped, 0);
    
    if (totalQuantity === 0) {
      return 0;
    }
    
    return (shippedQuantity / totalQuantity) * 100;
  }

  /**
   * Field Resolver: Get available actions for order
   */
  @ResolveField('availableActions')
  async getAvailableActions(
    @Parent() order: B2BOrderType,
  ): Promise<string[]> {
    const actions: string[] = [];
    
    if (order.status === 'pending_approval' && order.requiresApproval) {
      actions.push('approve', 'reject');
    }
    
    if (['draft', 'pending_approval', 'approved', 'processing'].includes(order.status)) {
      actions.push('cancel');
    }
    
    if (order.status === 'approved' || order.status === 'processing') {
      actions.push('ship');
    }
    
    if (['draft', 'pending_approval'].includes(order.status)) {
      actions.push('edit');
    }
    
    return actions;
  }

  /**
   * Field Resolver: Load product for order item
   */
  @ResolveField('product', { of: () => B2BOrderItemType })
  async getProduct(
    @Parent() item: B2BOrderItemType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      return await this.dataLoaderService.getProductLoader(tenantId).load(item.productId);
    } catch (error) {
      this.logger.error(`Failed to load product for order item ${item.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Check if order item is backordered
   */
  @ResolveField('isBackordered', { of: () => B2BOrderItemType })
  async getIsBackordered(
    @Parent() item: B2BOrderItemType,
  ): Promise<boolean> {
    return item.quantityBackordered > 0;
  }

  /**
   * Field Resolver: Calculate total savings for order item
   */
  @ResolveField('totalSavings', { of: () => B2BOrderItemType })
  async getTotalSavings(
    @Parent() item: B2BOrderItemType,
  ): Promise<number> {
    return item.discountAmount * item.quantity;
  }

  /**
   * Subscription: B2B order created
   * Filters events by tenant for multi-tenant isolation
   */
  @Subscription('b2bOrderCreated', {
    filter: (payload, variables, context) => {
      return payload.b2bOrderCreated.tenantId === context.req.user.tenantId;
    },
  })
  b2bOrderCreated(@CurrentTenant() tenantId: string) {
    this.logger.debug(`Subscription: b2bOrderCreated for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('B2B_ORDER_CREATED');
  }

  /**
   * Subscription: B2B order status changed
   * Filters events by tenant and optionally by order ID
   */
  @Subscription('b2bOrderStatusChanged', {
    filter: (payload, variables, context) => {
      const matchesTenant = payload.b2bOrderStatusChanged.tenantId === context.req.user.tenantId;
      const matchesOrder = !variables.orderId || payload.b2bOrderStatusChanged.order.id === variables.orderId;
      return matchesTenant && matchesOrder;
    },
  })
  b2bOrderStatusChanged(
    @Args('orderId', { type: () => ID, nullable: true }) orderId: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.debug(`Subscription: b2bOrderStatusChanged for tenant ${tenantId}, order ${orderId || 'all'}`);
    return this.pubSub.asyncIterator(['B2B_ORDER_UPDATED', 'B2B_ORDER_APPROVED', 'B2B_ORDER_REJECTED', 'B2B_ORDER_SHIPPED', 'B2B_ORDER_CANCELLED']);
  }

  /**
   * Subscription: B2B order approved
   * Filters events by tenant for multi-tenant isolation
   */
  @Subscription('b2bOrderApproved', {
    filter: (payload, variables, context) => {
      return payload.b2bOrderApproved.tenantId === context.req.user.tenantId;
    },
  })
  b2bOrderApproved(@CurrentTenant() tenantId: string) {
    this.logger.debug(`Subscription: b2bOrderApproved for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('B2B_ORDER_APPROVED');
  }

  /**
   * Subscription: B2B order shipped
   * Filters events by tenant for multi-tenant isolation
   */
  @Subscription('b2bOrderShipped', {
    filter: (payload, variables, context) => {
      return payload.b2bOrderShipped.tenantId === context.req.user.tenantId;
    },
  })
  b2bOrderShipped(@CurrentTenant() tenantId: string) {
    this.logger.debug(`Subscription: b2bOrderShipped for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('B2B_ORDER_SHIPPED');
  }
}