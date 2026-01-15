import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { SupplierService } from '../services/supplier.service';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { 
  SupplierType, 
  SupplierConnection,
  CreateSupplierInput,
  UpdateSupplierInput,
  RateSupplierInput,
  SupplierFilterInput,
} from '../types/supplier.types';
import { PurchaseOrderType } from '../types/purchase-order.types';

@Resolver(() => SupplierType)
@UseGuards(JwtAuthGuard)
export class SupplierResolver extends BaseResolver {
  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly supplierService: SupplierService,
    private readonly purchaseOrderService: PurchaseOrderService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => SupplierType, { name: 'supplier' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSupplier(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.getSupplier(tenantId, id);
  }

  @Query(() => SupplierConnection, { name: 'suppliers' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSuppliers(
    @Args('first', { type: () => Number, nullable: true }) first: number,
    @Args('after', { type: () => String, nullable: true }) after: string,
    @Args('filter', { type: () => SupplierFilterInput, nullable: true }) filter: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const { limit, cursor, isForward } = this.parsePaginationArgs({ first, after });
    
    const query = {
      page: 1,
      limit,
      ...filter,
    };

    const result = await this.supplierService.getSuppliers(tenantId, query);
    
    return {
      edges: this.createEdges(result.suppliers, supplier => supplier.id),
      pageInfo: this.createPageInfo(
        result.page < result.totalPages,
        result.page > 1,
        result.suppliers[0]?.id,
        result.suppliers[result.suppliers.length - 1]?.id,
      ),
      totalCount: result.total,
    };
  }

  @Mutation(() => SupplierType, { name: 'createSupplier' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:create')
  async createSupplier(
    @Args('input') input: CreateSupplierInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.createSupplier(tenantId, input, user.id);
  }

  @Mutation(() => SupplierType, { name: 'updateSupplier' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:update')
  async updateSupplier(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSupplierInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.updateSupplier(tenantId, id, input, user.id);
  }

  @Mutation(() => Boolean, { name: 'deleteSupplier' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:delete')
  async deleteSupplier(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.supplierService.deleteSupplier(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => SupplierType, { name: 'rateSupplier' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:update')
  async rateSupplier(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: RateSupplierInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.updateSupplier(tenantId, id, {
      overallRating: input.overallRating,
      qualityRating: input.qualityRating,
      deliveryRating: input.deliveryRating,
      serviceRating: input.serviceRating,
    } as any, user.id);
  }

  @ResolveField(() => [PurchaseOrderType], { name: 'purchaseOrders', nullable: true })
  async purchaseOrders(
    @Parent() supplier: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const result = await this.purchaseOrderService.getPurchaseOrders(tenantId, {
      supplierId: supplier.id,
      page: 1,
      limit: 100,
    });
    return result.purchaseOrders || [];
  }

  @ResolveField(() => [String], { name: 'products', nullable: true })
  async products(
    @Parent() supplier: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string[]> {
    // This would typically load products from a product service
    // For now, return empty array as product relationship may vary
    return [];
  }

  @ResolveField(() => [String], { name: 'contacts', nullable: true })
  async contacts(
    @Parent() supplier: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.supplierService.getSupplierContacts(tenantId, supplier.id);
  }
}
