import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent, Subscription } from '@nestjs/graphql';
import { UseGuards, UseInterceptors, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { PaginationArgs } from '../../../common/graphql/base.types';

// Services
import { WarehouseService } from '../services/warehouse.service';
import { WarehouseZoneService } from '../services/warehouse-zone.service';
import { BinLocationService } from '../services/bin-location.service';

// Types and Inputs
import { 
  WarehouseType, 
  WarehouseConnection,
  WarehouseCapacityType,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseFilterInput,
} from '../types/warehouse.types';
import { WarehouseZoneType, WarehouseZoneConnection } from '../types/warehouse-zone.types';
import { BinLocationType, BinLocationConnection } from '../types/bin-location.types';
import { Employee as EmployeeType } from '../../employee/types/employee.types';

// Decorators and Guards
import { 
  RequireWarehousePermission,
  AuditWarehouseOperation,
  MonitorWarehousePerformance,
  CacheWarehouseData,
} from '../decorators/warehouse.decorators';
import { WarehouseAccessGuard } from '../guards/warehouse-access.guard';
import { WarehouseAuditInterceptor } from '../interceptors/warehouse-audit.interceptor';
import { WarehousePerformanceInterceptor } from '../interceptors/warehouse-performance.interceptor';

// Additional inputs
import { 
  InitializeWarehouseInput,
  UpdateWarehouseCapacityInput,
  WarehouseConfigurationInput,
  UpdateWarehouseOperatingHoursInput,
  WarehouseLayoutOptimizationInput,
  WarehousePerformanceMetricsInput,
} from '../inputs/warehouse.input';

@Resolver(() => WarehouseType)
@UseGuards(JwtAuthGuard, WarehouseAccessGuard)
@UseInterceptors(WarehouseAuditInterceptor, WarehousePerformanceInterceptor)
export class WarehouseResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly warehouseService: WarehouseService,
    private readonly zoneService: WarehouseZoneService,
    private readonly binLocationService: BinLocationService,
    @Inject('PUB_SUB') private readonly pubSub: any,
  ) {
    super(dataLoaderService);
  }

  // Queries
  @Query(() => WarehouseType, { name: 'warehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:read')
  @RequireWarehousePermission('read')
  @CacheWarehouseData(300)
  @MonitorWarehousePerformance()
  async getWarehouse(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseType> {
    return this.warehouseService.getWarehouse(tenantId, id);
  }

  @Query(() => WarehouseConnection, { name: 'warehouses' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:read')
  @RequireWarehousePermission('read')
  @CacheWarehouseData(180)
  @MonitorWarehousePerformance()
  async getWarehouses(
    @Args() paginationArgs: PaginationArgs,
    @Args('filter', { type: () => WarehouseFilterInput, nullable: true }) filter?: WarehouseFilterInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<WarehouseConnection> {
    const result = await this.warehouseService.getWarehouses(tenantId || '', { ...paginationArgs, ...filter } as any);
    return {
      edges: (result.warehouses || []).map((warehouse: any, idx: number) => ({
        cursor: Buffer.from(`warehouse-${idx}`).toString('base64'),
        node: warehouse,
      })),
      pageInfo: {
        hasNextPage: result.page < result.totalPages,
        hasPreviousPage: result.page > 1,
      },
      totalCount: result.total,
    } as WarehouseConnection;
  }

  @Query(() => WarehouseCapacityType, { name: 'warehouseCapacity' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:read')
  @RequireWarehousePermission('read')
  @CacheWarehouseData(60)
  async getWarehouseCapacity(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseCapacityType> {
    const result = await this.warehouseService.getWarehouseCapacity(tenantId, warehouseId);
    return (result || {}) as WarehouseCapacityType;
  }

  @Query(() => [WarehouseType], { name: 'warehousesByLocation' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:read')
  @RequireWarehousePermission('read')
  @CacheWarehouseData(300)
  async getWarehousesByLocation(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseType[]> {
    return this.warehouseService.getWarehousesByLocation(tenantId, locationId);
  }

  // Mutations
  @Mutation(() => WarehouseType, { name: 'createWarehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:create')
  @RequireWarehousePermission('create')
  @AuditWarehouseOperation('create')
  @MonitorWarehousePerformance()
  async createWarehouse(
    @Args('input') input: CreateWarehouseInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<WarehouseType> {
    const result = await this.warehouseService.createWarehouse(tenantId, input as any, user.id);
    return result as WarehouseType;
  }

  @Mutation(() => WarehouseType, { name: 'updateWarehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:update')
  @RequireWarehousePermission('update')
  @AuditWarehouseOperation('update')
  @MonitorWarehousePerformance()
  async updateWarehouse(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateWarehouseInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<WarehouseType> {
    const result = await this.warehouseService.updateWarehouse(tenantId, id, input as any, user.id);
    return result as WarehouseType;
  }

  @Mutation(() => Boolean, { name: 'deleteWarehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:delete')
  @RequireWarehousePermission('delete')
  @AuditWarehouseOperation('delete')
  @MonitorWarehousePerformance()
  async deleteWarehouse(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.warehouseService.deleteWarehouse(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => WarehouseType, { name: 'initializeWarehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:manage')
  @RequireWarehousePermission('manage')
  @AuditWarehouseOperation('initialize')
  @MonitorWarehousePerformance()
  async initializeWarehouse(
    @Args('input') input: InitializeWarehouseInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<WarehouseType> {
    await this.warehouseService.initializeWarehouse(tenantId, input as any, user.id);
    const warehouse = await this.warehouseService.getWarehouse(tenantId, (input as any).id);
    return (warehouse || {}) as any as WarehouseType;
  }

  @Mutation(() => WarehouseCapacityType, { name: 'updateWarehouseCapacity' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:update')
  @RequireWarehousePermission('update')
  @AuditWarehouseOperation('update_capacity')
  @MonitorWarehousePerformance()
  async updateWarehouseCapacity(
    @Args('input') input: UpdateWarehouseCapacityInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<WarehouseCapacityType> {
    await this.warehouseService.updateWarehouseCapacity(tenantId, (input as any).warehouseId, (input as any).maxCapacity, (input as any).reserved, user.id);
    const capacity = await this.warehouseService.getWarehouseCapacity(tenantId, (input as any).warehouseId);
    return (capacity || {}) as any as WarehouseCapacityType;
  }

  @Mutation(() => WarehouseType, { name: 'updateWarehouseConfiguration' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:configure')
  @RequireWarehousePermission('configure')
  @AuditWarehouseOperation('update_configuration')
  @MonitorWarehousePerformance()
  async updateWarehouseConfiguration(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @Args('input') input: WarehouseConfigurationInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<WarehouseType> {
    await this.warehouseService.updateWarehouseConfiguration(tenantId, warehouseId, { ...input } as any);
    const warehouse = await this.warehouseService.getWarehouse(tenantId, warehouseId);
    return (warehouse || {}) as any as WarehouseType;
  }

  @Mutation(() => WarehouseType, { name: 'updateWarehouseOperatingHours' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:configure')
  @RequireWarehousePermission('configure')
  @AuditWarehouseOperation('update_operating_hours')
  async updateWarehouseOperatingHours(
    @Args('input') input: UpdateWarehouseOperatingHoursInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<WarehouseType> {
    const result = await this.warehouseService.updateWarehouseOperatingHours(tenantId, input as any, user.id);
    return result as WarehouseType;
  }

  @Mutation(() => WarehouseType, { name: 'optimizeWarehouseLayout' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:optimize')
  @RequireWarehousePermission('optimize')
  @AuditWarehouseOperation('optimize_layout')
  @MonitorWarehousePerformance()
  async optimizeWarehouseLayout(
    @Args('input') input: WarehouseLayoutOptimizationInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<WarehouseType> {
    const result = await this.warehouseService.optimizeWarehouseLayout(tenantId, input as any, user.id);
    return result as WarehouseType;
  }

  @Mutation(() => Boolean, { name: 'updateWarehousePerformanceMetrics' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:metrics')
  @RequireWarehousePermission('metrics')
  @AuditWarehouseOperation('update_metrics')
  async updateWarehousePerformanceMetrics(
    @Args('input') input: WarehousePerformanceMetricsInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.warehouseService.updateWarehousePerformanceMetrics(tenantId, input as any, user.id);
    return true;
  }

  // Field Resolvers
  @ResolveField(() => [WarehouseZoneType], { name: 'zones' })
  async resolveZones(
    @Parent() warehouse: WarehouseType,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseZoneType[]> {
    return this.dataLoaderService.getLoader(
      'warehouseZones',
      async (warehouseIds: readonly string[]) => {
        const firstId = Array.from(warehouseIds)[0];
        if (!firstId) return [];
        return this.zoneService.getZonesByWarehouse(tenantId, firstId);
      },
    ).load(warehouse.id);
  }

  @ResolveField(() => [BinLocationType], { name: 'binLocations' })
  async resolveBinLocations(
    @Parent() warehouse: WarehouseType,
    @Args() paginationArgs: PaginationArgs,
    @CurrentTenant() tenantId: string,
  ): Promise<BinLocationType[]> {
    const result = await this.binLocationService.getBinLocationsByWarehouse(tenantId, warehouse.id);
    return (result || []) as BinLocationType[];
  }

  @ResolveField(() => EmployeeType, { name: 'manager', nullable: true })
  async resolveManager(
    @Parent() warehouse: WarehouseType,
    @CurrentTenant() tenantId: string,
  ): Promise<EmployeeType | null> {
    if (!warehouse.warehouseManagerId) return null;
    
    return this.dataLoaderService.getLoader(
      'employees',
      (employeeIds: readonly string[]) => this.getEmployeesByIds(tenantId, Array.from(employeeIds)),
    ).load(warehouse.warehouseManagerId);
  }

  @ResolveField(() => WarehouseCapacityType, { name: 'capacity' })
  async resolveCapacity(
    @Parent() warehouse: WarehouseType,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseCapacityType> {
    const capacity = await this.warehouseService.getWarehouseCapacity(tenantId, warehouse.id);
    return (capacity || {}) as any as WarehouseCapacityType;
  }

  // Subscriptions
  @Subscription(() => WarehouseType, { name: 'warehouseUpdated' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:read')
  warehouseUpdated(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`warehouse.updated.${tenantId}.${warehouseId}`);
  }

  @Subscription(() => WarehouseCapacityType, { name: 'warehouseCapacityUpdated' })
  @UseGuards(PermissionsGuard)
  @Permissions('warehouse:read')
  warehouseCapacityUpdated(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`warehouse.capacity.updated.${tenantId}.${warehouseId}`);
  }

  // Helper methods
  private async getEmployeesByIds(tenantId: string, employeeIds: string[]): Promise<EmployeeType[]> {
    // This would typically call an employee service
    // For now, return empty array or implement based on your employee module
    return [];
  }
}
