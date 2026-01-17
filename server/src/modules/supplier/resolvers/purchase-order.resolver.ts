import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent, Subscription, Int } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { PubSubService } from '../../../common/graphql/pubsub.service';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { SupplierService } from '../services/supplier.service';
import { 
  PurchaseOrderType, 
  PurchaseOrderConnection,
  PurchaseOrderItemType,
} from '../types/purchase-order.types';
import { 
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderFilterInput,
  CreateApprovalInput,
  ApprovalResponseInput,
  CreateReceiptInput,
  CreateInvoiceInput,
} from '../inputs/purchase-order.input';
import { Supplier } from '../entities/supplier.entity';
import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
class PurchaseOrderStats {
  @Field(() => Int)
  totalOrders!: number;

  @Field(() => Int)
  draftOrders!: number;

  @Field(() => Int)
  pendingApproval!: number;

  @Field(() => Int)
  approvedOrders!: number;

  @Field(() => Float)
  totalValue!: number;

  @Field(() => Float)
  averageOrderValue!: number;
}

@ObjectType()
class SupplierPurchaseStats {
  @Field(() => Int)
  totalOrders!: number;

  @Field(() => Float)
  totalSpend!: number;

  @Field(() => Float)
  averageOrderValue!: number;

  @Field(() => Int)
  onTimeDeliveries!: number;

  @Field(() => Int)
  lateDeliveries!: number;

  @Field(() => Float)
  onTimeDeliveryRate!: number;
}

@Resolver(() => PurchaseOrderType)
@UseGuards(GraphQLJwtAuthGuard)
export class PurchaseOrderResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly supplierService: SupplierService,
    private readonly pubSubService: PubSubService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => PurchaseOrderType, { name: 'purchaseOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:read')
  async getPurchaseOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.purchaseOrderService.getPurchaseOrder(tenantId, id);
  }

  @Query(() => PurchaseOrderType, { name: 'purchaseOrderByNumber' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:read')
  async getPurchaseOrderByNumber(
    @Args('poNumber') poNumber: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.purchaseOrderService.getPurchaseOrderByPoNumber(tenantId, poNumber);
  }

  @Query(() => PurchaseOrderConnection, { name: 'purchaseOrders' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:read')
  async getPurchaseOrders(
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first: number,
    @Args('after', { type: () => String, nullable: true }) after: string,
    @Args('filter', { type: () => PurchaseOrderFilterInput, nullable: true }) filter: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const { limit } = this.parsePaginationArgs({ first, after });
    
    const query = {
      page: 1,
      limit,
      ...filter,
    };

    const result = await this.purchaseOrderService.getPurchaseOrders(tenantId, query);
    
    return {
      edges: this.createEdges(result.purchaseOrders, po => po.id),
      pageInfo: this.createPageInfo(
        result.page < result.totalPages,
        result.page > 1,
        result.purchaseOrders[0]?.id,
        result.purchaseOrders[result.purchaseOrders.length - 1]?.id,
      ),
      totalCount: result.total,
    };
  }

  @Query(() => PurchaseOrderStats, { name: 'purchaseOrderStats' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:read')
  async getPurchaseOrderStats(
    @Args('startDate', { type: () => String, nullable: true }) startDate: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.purchaseOrderService.getPurchaseOrderStats(tenantId, start, end);
  }

  @Query(() => SupplierPurchaseStats, { name: 'supplierPurchaseStats' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:read')
  async getSupplierPurchaseStats(
    @Args('supplierId', { type: () => ID }) supplierId: string,
    @Args('startDate', { type: () => String, nullable: true }) startDate: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.purchaseOrderService.getSupplierPurchaseStats(tenantId, supplierId, start, end);
  }

  @Mutation(() => PurchaseOrderType, { name: 'createPurchaseOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:create')
  async createPurchaseOrder(
    @Args('input') input: CreatePurchaseOrderInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const purchaseOrder = await this.purchaseOrderService.createPurchaseOrder(
      tenantId,
      input,
      user.id,
    );

    // Publish subscription event
    await this.pubSubService.publish('PURCHASE_ORDER_CREATED', {
      tenantId,
      purchaseOrderCreated: purchaseOrder,
    });

    return purchaseOrder;
  }

  @Mutation(() => PurchaseOrderType, { name: 'updatePurchaseOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:update')
  async updatePurchaseOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePurchaseOrderInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const originalPO = await this.purchaseOrderService.getPurchaseOrder(tenantId, id);
    const updatedPO = await this.purchaseOrderService.updatePurchaseOrder(tenantId, id, input, user.id);

    // Publish status change subscription if status changed
    if (input.status && input.status !== originalPO.status) {
      await this.pubSubService.publish('PURCHASE_ORDER_STATUS_CHANGED', {
        tenantId,
        purchaseOrderStatusChanged: updatedPO,
        previousStatus: originalPO.status,
        newStatus: input.status,
      });
    }

    return updatedPO;
  }

  @Mutation(() => Boolean, { name: 'deletePurchaseOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:delete')
  async deletePurchaseOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.purchaseOrderService.deletePurchaseOrder(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => PurchaseOrderType, { name: 'submitPurchaseOrderForApproval' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:submit')
  async submitForApproval(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.purchaseOrderService.submitForApproval(tenantId, id, user.id);
  }

  @Mutation(() => Boolean, { name: 'respondToApproval' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:approve')
  async respondToApproval(
    @Args('approvalId', { type: () => ID }) approvalId: string,
    @Args('response') response: ApprovalResponseInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.purchaseOrderService.respondToApproval(tenantId, approvalId, response, user.id);
    return true;
  }

  @Mutation(() => Boolean, { name: 'createPurchaseOrderReceipt' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:receive')
  async createReceipt(
    @Args('input') input: CreateReceiptInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.purchaseOrderService.createReceipt(tenantId, input, user.id);

    // Publish subscription event
    const purchaseOrder = await this.purchaseOrderService.getPurchaseOrder(tenantId, input.purchaseOrderId);
    await this.pubSubService.publish('PURCHASE_ORDER_RECEIVED', {
      tenantId,
      purchaseOrderReceived: purchaseOrder,
    });

    return true;
  }

  @Mutation(() => Boolean, { name: 'createPurchaseOrderInvoice' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:invoice')
  async createInvoice(
    @Args('input') input: CreateInvoiceInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.purchaseOrderService.createInvoice(tenantId, input, user.id);
    return true;
  }

  @ResolveField(() => Supplier, { name: 'supplier' })
  async supplier(
    @Parent() purchaseOrder: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const loader = this.getDataLoader(
      'supplier_by_id',
      async (supplierIds: readonly string[]) => {
        const suppliers = await Promise.all(
          supplierIds.map(id => 
            this.supplierService.getSupplier(tenantId, id).catch(() => null)
          )
        );
        return suppliers.map(s => s || new Error('Supplier not found'));
      },
    );
    return loader.load(purchaseOrder.supplierId);
  }

  @ResolveField(() => [PurchaseOrderItemType], { name: 'lineItems', nullable: true })
  async lineItems(
    @Parent() purchaseOrder: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const result = await this.purchaseOrderService.getPurchaseOrderWithRelations(
      tenantId,
      purchaseOrder.id,
    );
    return result.items || [];
  }

  @Subscription(() => PurchaseOrderType, {
    name: 'purchaseOrderCreated',
    filter: (payload, variables, context) => {
      return payload.purchaseOrderCreated.tenantId === context.req.user.tenantId;
    },
  })
  purchaseOrderCreated(@CurrentTenant() tenantId: string) {
    return this.pubSubService.asyncIterator('PURCHASE_ORDER_CREATED', tenantId);
  }

  @Subscription(() => PurchaseOrderType, {
    name: 'purchaseOrderStatusChanged',
    filter: (payload, variables, context) => {
      return payload.purchaseOrderStatusChanged.tenantId === context.req.user.tenantId;
    },
  })
  purchaseOrderStatusChanged(@CurrentTenant() tenantId: string) {
    return this.pubSubService.asyncIterator('PURCHASE_ORDER_STATUS_CHANGED', tenantId);
  }

  @Subscription(() => PurchaseOrderType, {
    name: 'purchaseOrderReceived',
    filter: (payload, variables, context) => {
      return (
        payload.purchaseOrderReceived.tenantId === context.req.user.tenantId &&
        (!variables.supplierId || payload.purchaseOrderReceived.supplierId === variables.supplierId)
      );
    },
  })
  purchaseOrderReceived(
    @Args('supplierId', { type: () => ID, nullable: true }) supplierId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSubService.asyncIterator('PURCHASE_ORDER_RECEIVED', tenantId);
  }

  @Subscription(() => PurchaseOrderType, {
    name: 'purchaseOrderApproved',
    filter: (payload, variables, context) => {
      return payload.purchaseOrderApproved.tenantId === context.req.user.tenantId;
    },
  })
  purchaseOrderApproved(@CurrentTenant() tenantId: string) {
    return this.pubSubService.asyncIterator('PURCHASE_ORDER_APPROVED', tenantId);
  }

  @Subscription(() => PurchaseOrderType, {
    name: 'purchaseOrderSent',
    filter: (payload, variables, context) => {
      return payload.purchaseOrderSent.tenantId === context.req.user.tenantId;
    },
  })
  purchaseOrderSent(@CurrentTenant() tenantId: string) {
    return this.pubSubService.asyncIterator('PURCHASE_ORDER_SENT', tenantId);
  }

  @Subscription(() => PurchaseOrderType, {
    name: 'purchaseOrderInvoiced',
    filter: (payload, variables, context) => {
      return payload.purchaseOrderInvoiced.tenantId === context.req.user.tenantId;
    },
  })
  purchaseOrderInvoiced(@CurrentTenant() tenantId: string) {
    return this.pubSubService.asyncIterator('PURCHASE_ORDER_INVOICED', tenantId);
  }
}
