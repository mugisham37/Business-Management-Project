import { Resolver, Query, Mutation, Args, Subscription, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/require-permission.decorator';
import { PerpetualInventoryService } from '../services/perpetual-inventory.service';
import { PerpetualInventoryLevelData, InventoryValue } from '../types/perpetual-inventory.types';
import { ReconcileInventoryInput } from '../inputs/perpetual-inventory.input';

@Resolver()
@UseGuards(JwtAuthGuard)
export class PerpetualInventoryResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly perpetualInventoryService: PerpetualInventoryService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  @Query(() => PerpetualInventoryLevelData, { description: 'Get current inventory level for product at location' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async currentInventory(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('variantId', { type: () => ID, nullable: true }) variantId?: string,
    @Args('locationId', { type: () => ID }) locationId?: string,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<PerpetualInventoryLevelData> {
    return this.perpetualInventoryService.getCurrentInventory(
      tenantId || '',
      productId,
      variantId || undefined,
      locationId || '',
    );
  }

  @Query(() => InventoryValue, { description: 'Get inventory value for location' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async inventoryValue(
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @Args('valuationMethod', { type: () => String, defaultValue: 'average' }) valuationMethod?: 'fifo' | 'lifo' | 'average',
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<InventoryValue> {
    // Note: The service's getInventoryValue accepts (tenantId, locationId, startDate, endDate)
    // The valuationMethod parameter is not used by the current service implementation
    return this.perpetualInventoryService.getInventoryValue(
      tenantId || '',
      locationId || undefined,
    );
  }

  @Mutation(() => Boolean, { description: 'Reconcile inventory levels with physical count' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:update')
  async reconcileInventory(
    @Args('input') input: ReconcileInventoryInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<boolean> {
    // The service expects (tenantId, input, userId) where input contains all the fields
    await this.perpetualInventoryService.reconcileInventory(
      tenantId || '',
      {
        productId: input.productId,
        variantId: input.variantId || undefined,
        locationId: input.locationId,
        physicalCount: input.physicalCount,
        reason: input.reason,
      },
      user?.id || '',
    );

    // Publish real-time update via subscription
    await this.pubSub.publish('INVENTORY_RECONCILED', {
      inventoryReconciled: {
        productId: input.productId,
        variantId: input.variantId,
        locationId: input.locationId,
        physicalCount: input.physicalCount,
        tenantId: tenantId || '',
      },
    });

    return true;
  }

  @Subscription(() => PerpetualInventoryLevelData, {
    description: 'Subscribe to real-time inventory updates',
    filter: (payload, variables, context) => {
      // Filter by tenant
      if (payload.inventoryReconciled.tenantId !== context.req.user.tenantId) {
        return false;
      }

      // Filter by product if specified
      if (variables.productId && payload.inventoryReconciled.productId !== variables.productId) {
        return false;
      }

      // Filter by location if specified
      if (variables.locationId && payload.inventoryReconciled.locationId !== variables.locationId) {
        return false;
      }

      return true;
    },
  })
  inventoryReconciled(
    @Args('productId', { type: () => ID, nullable: true }) productId?: string,
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    return (this.pubSub as any).asyncIterator('INVENTORY_RECONCILED');
  }
}
