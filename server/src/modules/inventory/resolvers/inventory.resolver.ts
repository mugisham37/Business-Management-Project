import { Resolver, Query, Mutation, Args, ResolveField, Parent, Subscription, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { InventoryService } from '../services/inventory.service';
import { ProductService } from '../services/product.service';
import { InventoryLevel, InventoryMovement, InventoryAdjustmentReason } from '../types/inventory.types';
import { 
  AdjustInventoryInput, 
  TransferInventoryInput, 
  InventoryFilterInput,
  CreateInventoryLevelInput,
  UpdateInventoryLevelInput,
  ReserveInventoryInput
} from '../inputs/inventory.input';
import { OffsetPaginationArgs } from '../../../common/graphql/pagination.args';

@Resolver(() => InventoryLevel)
@UseGuards(JwtAuthGuard)
export class InventoryResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly inventoryService: InventoryService,
    private readonly productService: ProductService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  @Query(() => InventoryLevel, { description: 'Get inventory level for a product at a location' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:read')
  async getInventory(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('variantId', { type: () => ID, nullable: true }) variantId?: string | null,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<InventoryLevel> {
    return this.inventoryService.getInventoryLevel(tenantId || '', productId, variantId ?? null, locationId);
  }

  @Query(() => [InventoryLevel], { description: 'Get inventory levels with optional filtering' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:read')
  async getInventoryLevels(
    @Args('filter', { type: () => InventoryFilterInput, nullable: true }) filter?: InventoryFilterInput,
    @Args('pagination', { type: () => OffsetPaginationArgs, nullable: true }) pagination?: OffsetPaginationArgs,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<InventoryLevel[]> {
    const query = {
      ...filter,
      offset: pagination?.offset || 0,
      limit: pagination?.limit || 20,
    };

    const result = await this.inventoryService.getInventoryLevels(tenantId || '', query);
    return result.inventoryLevels;
  }

  @Query(() => [InventoryMovement], { description: 'Get inventory movement history' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:read')
  async getInventoryHistory(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<InventoryMovement[]> {
    return this.inventoryService.getInventoryMovements(tenantId || '', productId, locationId || undefined);
  }

  @Mutation(() => InventoryLevel, { description: 'Create inventory level' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:create')
  async createInventoryLevel(
    @Args('input') input: CreateInventoryLevelInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<InventoryLevel> {
    return this.inventoryService.createInventoryLevel(tenantId || '', input, user?.id || '');
  }

  @Mutation(() => InventoryLevel, { description: 'Update inventory level' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:update')
  async updateInventoryLevel(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateInventoryLevelInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<InventoryLevel> {
    return this.inventoryService.updateInventoryLevelById(tenantId || '', id, input, user?.id || '');
  }

  @Mutation(() => Boolean, { description: 'Reserve inventory' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:update')
  async reserveInventory(
    @Args('input') input: ReserveInventoryInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<boolean> {
    await this.inventoryService.reserveInventory(
      tenantId || '',
      input.productId,
      input.variantId ?? null,
      input.locationId,
      input.quantity,
      input.reservedFor,
      input.referenceId,
      user?.id || '',
    );
    return true;
  }

  @Mutation(() => Boolean, { description: 'Release inventory reservation' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:update')
  async releaseReservation(
    @Args('reservationId', { type: () => ID }) reservationId: string,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<boolean> {
    await this.inventoryService.releaseReservation(tenantId || '', reservationId, user?.id || '');
    return true;
  }

  @Mutation(() => InventoryLevel, { description: 'Adjust inventory level' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:update')
  async adjustInventory(
    @Args('input') input: AdjustInventoryInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<InventoryLevel> {
    // Build input object conditionally to satisfy exactOptionalPropertyTypes
    const adjustInput: {
      productId: string;
      variantId?: string;
      locationId: string;
      adjustment: number;
      reason: InventoryAdjustmentReason;
      notes?: string;
    } = {
      productId: input.productId,
      locationId: input.locationId,
      adjustment: input.adjustment,
      reason: input.reason,
    };
    
    if (input.variantId) adjustInput.variantId = input.variantId;
    if (input.notes) adjustInput.notes = input.notes;

    const result = await this.inventoryService.adjustInventory(
      tenantId || '',
      adjustInput,
      user?.id || '',
    );

    // Publish subscription event
    await this.pubSub.publish('INVENTORY_CHANGED', {
      inventoryChanged: {
        ...result,
        tenantId: tenantId || '',
      },
    });

    return result;
  }

  @Mutation(() => Boolean, { description: 'Transfer inventory between locations' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:update')
  async transferInventory(
    @Args('input') input: TransferInventoryInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<boolean> {
    // Build transfer input object conditionally to satisfy exactOptionalPropertyTypes
    const transferInput: {
      productId: string;
      variantId?: string;
      toLocationId: string;
      fromLocationId: string;
      quantity: number;
      notes?: string;
    } = {
      productId: input.productId,
      toLocationId: input.toLocationId,
      fromLocationId: input.fromLocationId,
      quantity: input.quantity,
    };
    
    if (input.variantId) transferInput.variantId = input.variantId;
    if (input.notes) transferInput.notes = input.notes;

    await this.inventoryService.transferInventory(
      tenantId || '',
      transferInput,
      user?.id || '',
    );

    // Publish subscription events for both locations
    await this.pubSub.publish('INVENTORY_CHANGED', {
      inventoryChanged: {
        productId: input.productId,
        variantId: input.variantId,
        locationId: input.fromLocationId,
        tenantId: tenantId || '',
      },
    });

    await this.pubSub.publish('INVENTORY_CHANGED', {
      inventoryChanged: {
        productId: input.productId,
        variantId: input.variantId,
        locationId: input.toLocationId,
        tenantId: tenantId || '',
      },
    });

    return true;
  }

  @ResolveField(() => Object, { nullable: true, description: 'Product information' })
  async product(
    @Parent() inventory: InventoryLevel,
    @CurrentTenant() tenantId?: string,
  ): Promise<any> {
    const loader = this.getDataLoader(
      'product_by_id',
      this.productService.batchLoadByIds.bind(this.productService),
    );
    return loader.load(inventory.productId);
  }

  @ResolveField(() => Object, { nullable: true, description: 'Location information' })
  async location(
    @Parent() inventory: InventoryLevel,
    @CurrentTenant() tenantId?: string,
  ): Promise<any> {
    // Location service would be injected and used here
    // For now, return a placeholder
    return { id: inventory.locationId, name: 'Location' };
  }

  @Subscription(() => InventoryLevel, {
    description: 'Subscribe to inventory changes',
    filter: (payload, variables, context) => {
      // Filter by tenant
      if (payload.inventoryChanged.tenantId !== context.req.user.tenantId) {
        return false;
      }

      // Filter by product if specified
      if (variables.productId && payload.inventoryChanged.productId !== variables.productId) {
        return false;
      }

      // Filter by location if specified
      if (variables.locationId && payload.inventoryChanged.locationId !== variables.locationId) {
        return false;
      }

      return true;
    },
  })
  inventoryChanged(
    @Args('productId', { type: () => ID, nullable: true }) productId?: string,
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    return (this.pubSub as any).asyncIterator('INVENTORY_CHANGED');
  }

  @Subscription(() => InventoryLevel, {
    description: 'Subscribe to low stock alerts',
    filter: (payload, variables, context) => {
      // Filter by tenant
      if (payload.lowStockAlert.tenantId !== context.req.user.tenantId) {
        return false;
      }

      // Filter by location if specified
      if (variables.locationId && payload.lowStockAlert.locationId !== variables.locationId) {
        return false;
      }

      return true;
    },
  })
  lowStockAlert(
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    return (this.pubSub as any).asyncIterator('LOW_STOCK_ALERT');
  }

  @Subscription(() => InventoryMovement, {
    description: 'Subscribe to inventory movements',
    filter: (payload, variables, context) => {
      // Filter by tenant
      if (payload.inventoryMovement.tenantId !== context.req.user.tenantId) {
        return false;
      }

      // Filter by product if specified
      if (variables.productId && payload.inventoryMovement.productId !== variables.productId) {
        return false;
      }

      // Filter by location if specified
      if (variables.locationId && payload.inventoryMovement.locationId !== variables.locationId) {
        return false;
      }

      return true;
    },
  })
  inventoryMovement(
    @Args('productId', { type: () => ID, nullable: true }) productId?: string,
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    return (this.pubSub as any).asyncIterator('INVENTORY_MOVEMENT');
  }
}
