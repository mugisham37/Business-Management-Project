import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { WarehouseZoneService } from '../services/warehouse-zone.service';
import { WarehouseService } from '../services/warehouse.service';
import { BinLocationService } from '../services/bin-location.service';
import { WarehouseZoneType } from '../types/warehouse-zone.types';
import { WarehouseType } from '../types/warehouse.types';
import { BinLocationType } from '../types/bin-location.types';

@Resolver(() => WarehouseZoneType)
@UseGuards(JwtAuthGuard)
export class WarehouseZoneResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly zoneService: WarehouseZoneService,
    private readonly warehouseService: WarehouseService,
    private readonly binLocationService: BinLocationService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => WarehouseZoneType, { name: 'warehouseZone' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:read')
  async getWarehouseZone(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.zoneService.getZone(tenantId, id);
  }

  @Query(() => [WarehouseZoneType], { name: 'warehouseZones' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:read')
  async getWarehouseZones(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.zoneService.getZonesByWarehouse(tenantId, warehouseId);
  }

  @Mutation(() => WarehouseZoneType, { name: 'createWarehouseZone' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:create')
  async createWarehouseZone(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @Args('name') name: string,
    @Args('zoneType') zoneType: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.zoneService.createZone(tenantId, {
      warehouseId,
      name,
      zoneType: zoneType as any,
    } as any, user.id);
  }

  @Mutation(() => WarehouseZoneType, { name: 'updateWarehouseZone' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:update')
  async updateWarehouseZone(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name: string,
    @Args('zoneType', { nullable: true }) zoneType: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.zoneService.updateZone(tenantId, id, {
      name,
      zoneType: zoneType as any,
    } as any, user.id);
  }

  @Mutation(() => Boolean, { name: 'deleteWarehouseZone' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:delete')
  async deleteWarehouseZone(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.zoneService.deleteZone(tenantId, id, user.id);
    return true;
  }

  @ResolveField(() => WarehouseType, { name: 'warehouse' })
  async warehouse(
    @Parent() zone: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const loader = this.dataLoaderService.getLoader(
      'warehouse_by_id',
      (warehouseIds: readonly string[]) =>
        Promise.all(Array.from(warehouseIds).map(id => this.warehouseService.getWarehouse(tenantId, id)))
    );
    return loader.load(zone.warehouseId);
  }

  @ResolveField(() => [BinLocationType], { name: 'bins' })
  async bins(
    @Parent() zone: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    // Get bin locations for this zone directly
    const bins = await this.binLocationService.getBinLocationsByZone(tenantId, zone.id);
    return bins as unknown[] || [];
  }
}
