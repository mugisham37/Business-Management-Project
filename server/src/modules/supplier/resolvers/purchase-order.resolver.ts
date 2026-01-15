import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent, Subscription } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { SupplierService } from '../services/supplier.service';
import { 
  PurchaseOrderType, 
  PurchaseOrderConnection,
  PurchaseOrderItemType,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderFilterInput,
} from '../types/purchase-order.types';
import { SupplierType } from '../types/supplier.types';

@Resolver(() => PurchaseOrderType)
@UseGuards(JwtAuthGuard)
export class PurchaseOrderResolver extends BaseResolver {
  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly supplierService: SupplierService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
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

  @Query(() => PurchaseOrderConnection, { name: 'purchaseOrders' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:read')
  async getPurchaseOrders(
    @Args('first', { type: () => Number, nullable: true }) first: number,
    @Args('after', { type: () => String, nullable: true }) after: string,
    @Args('filter', { type: () => PurchaseOrderFilterInput, nullable: true }) filter: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const { limit, cursor, isForward } = this.parsePaginationArgs({ first, after });
    
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
    this.pubSub.publish('PURCHASE_ORDER_CREATED', {
      purchaseOrderCreated: {
        ...purchaseOrder,
        tenantId,
      },
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
    return this.purchaseOrderService.updatePurchaseOrder(tenantId, id, input, user.id);
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

  @Mutation(() => PurchaseOrderType, { name: 'approvePurchaseOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:approve')
  async approvePurchaseOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const purchaseOrder = await this.purchaseOrderService.submitForApproval(
      tenantId,
      id,
      user.id,
    );

    // Publish subscription event
    this.pubSub.publish('PURCHASE_ORDER_APPROVED', {
      purchaseOrderApproved: {
        ...purchaseOrder,
        tenantId,
      },
    });

    return purchaseOrder;
  }

  @Mutation(() => PurchaseOrderType, { name: 'receivePurchaseOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('purchase-order:receive')
  async receivePurchaseOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('receiptData') receiptData: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    // Create receipt
    await this.purchaseOrderService.createReceipt(tenantId, {
      purchaseOrderId: id,
      ...receiptData,
    }, user.id);

    // Get updated purchase order
    const purchaseOrder = await this.purchaseOrderService.getPurchaseOrder(tenantId, id);

    // Publish subscription event
    this.pubSub.publish('PURCHASE_ORDER_RECEIVED', {
      purchaseOrderReceived: {
        ...purchaseOrder,
        tenantId,
      },
    });

    return purchaseOrder;
  }

  @ResolveField(() => SupplierType, { name: 'supplier' })
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

  @ResolveField(() => [String], { name: 'receipts', nullable: true })
  async receipts(
    @Parent() purchaseOrder: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    // This would typically load receipts from the purchase order
    // For now, return empty array
    return [];
  }

  @Subscription(() => PurchaseOrderType, {
    name: 'purchaseOrderCreated',
    filter: (payload, variables, context) => {
      return payload.purchaseOrderCreated.tenantId === context.req.user.tenantId;
    },
  })
  purchaseOrderCreated(@CurrentTenant() tenantId: string) {
    return this.pubSub.asyncIterator('PURCHASE_ORDER_CREATED');
  }

  @Subscription(() => PurchaseOrderType, {
    name: 'purchaseOrderApproved',
    filter: (payload, variables, context) => {
      return payload.purchaseOrderApproved.tenantId === context.req.user.tenantId;
    },
  })
  purchaseOrderApproved(@CurrentTenant() tenantId: string) {
    return this.pubSub.asyncIterator('PURCHASE_ORDER_APPROVED');
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
    return this.pubSub.asyncIterator('PURCHASE_ORDER_RECEIVED');
  }
}
