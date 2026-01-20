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
import { PickingWaveService } from '../services/picking-wave.service';
import { PickListService } from '../services/pick-list.service';
import { WarehouseService } from '../services/warehouse.service';

// Types and Inputs
import {
  PickingWaveType,
  PickingWaveConnection,
  WaveStatisticsType,
  WaveRecommendationType,
  CreatePickingWaveInput,
  UpdatePickingWaveInput,
  PickingWaveFilterInput,
  WavePlanningInput,
  AssignPickersInput,
} from '../types/picking-wave.types';
import { PickListType, PickListConnection } from '../types/pick-list.types';
import { WarehouseType } from '../types/warehouse.types';
import { Employee as EmployeeType } from '../../employee/types/employee.types';

// Decorators and Guards
import {
  RequirePickingPermission,
  AuditPickingOperation,
  MonitorPickingPerformance,
  CachePickingData,
  EnablePickingUpdates,
} from '../decorators/warehouse.decorators';
import { WarehouseAccessGuard } from '../guards/warehouse-access.guard';
import { WarehouseAuditInterceptor } from '../interceptors/warehouse-audit.interceptor';
import { WarehousePerformanceInterceptor } from '../interceptors/warehouse-performance.interceptor';

@Resolver(() => PickingWaveType)
@UseGuards(JwtAuthGuard, WarehouseAccessGuard)
@UseInterceptors(WarehouseAuditInterceptor, WarehousePerformanceInterceptor)
export class PickingWaveResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly pickingWaveService: PickingWaveService,
    private readonly pickListService: PickListService,
    private readonly warehouseService: WarehouseService,
    @Inject('PUB_SUB') private readonly pubSub: any,
  ) {
    super(dataLoaderService);
  }

  // Queries
  @Query(() => PickingWaveType, { name: 'pickingWave' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:read')
  @RequirePickingPermission('pick')
  @CachePickingData(60)
  @MonitorPickingPerformance()
  async getPickingWave(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<PickingWaveType> {
    return this.pickingWaveService.getWave(tenantId, id);
  }

  @Query(() => PickingWaveConnection, { name: 'pickingWaves' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:read')
  @RequirePickingPermission('pick')
  @CachePickingData(30)
  @MonitorPickingPerformance()
  async getPickingWaves(
    @Args() paginationArgs: PaginationArgs,
    @Args('filter', { type: () => PickingWaveFilterInput, nullable: true }) filter?: PickingWaveFilterInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<PickingWaveConnection> {
    const query = { ...paginationArgs, ...filter } as any;
    const result = await this.pickingWaveService.getWaves(tenantId || '', query);
    return {
      edges: (result.waves || []).map((wave: any, idx: number) => ({ 
        cursor: Buffer.from(`wave-${idx}`).toString('base64'),
        node: wave 
      })),
      pageInfo: {
        hasNextPage: result.page < result.totalPages,
        hasPreviousPage: result.page > 1,
      },
      totalCount: result.total,
    };
  }

  @Query(() => [PickingWaveType], { name: 'pickingWavesByWarehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:read')
  @RequirePickingPermission('pick')
  @CachePickingData(60)
  async getPickingWavesByWarehouse(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<PickingWaveType[]> {
    return this.pickingWaveService.getWavesByWarehouse(tenantId, warehouseId);
  }

  @Query(() => [PickingWaveType], { name: 'pickingWavesByPicker' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:read')
  @RequirePickingPermission('pick')
  @CachePickingData(30)
  async getPickingWavesByPicker(
    @Args('pickerId', { type: () => ID }) pickerId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<PickingWaveType[]> {
    return this.pickingWaveService.getWavesByPicker(tenantId, pickerId);
  }

  @Query(() => WaveStatisticsType, { name: 'pickingWaveStatistics' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:read')
  @RequirePickingPermission('pick')
  @CachePickingData(60)
  async getPickingWaveStatistics(
    @Args('waveId', { type: () => ID }) waveId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WaveStatisticsType> {
    return this.pickingWaveService.getWaveStatistics(tenantId, waveId);
  }

  @Query(() => [WaveRecommendationType], { name: 'pickingWaveRecommendations' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:read')
  @RequirePickingPermission('manage')
  @CachePickingData(120)
  async getPickingWaveRecommendations(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WaveRecommendationType[]> {
    // Return recommendations based on warehouse statistics and wave patterns
    const stats = await this.pickingWaveService.getWaveStatistics(tenantId, warehouseId);
    // Generate recommendations based on stats
    return [];
  }

  @Query(() => [PickingWaveType], { name: 'overduePickingWaves' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:read')
  @RequirePickingPermission('manage')
  @CachePickingData(30)
  async getOverduePickingWaves(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<PickingWaveType[]> {
    return this.pickingWaveService.getOverdueWaves(tenantId || '', warehouseId);
  }

  // Mutations
  @Mutation(() => PickingWaveType, { name: 'createPickingWave' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:create')
  @RequirePickingPermission('manage')
  @AuditPickingOperation('create_wave')
  @MonitorPickingPerformance()
  @EnablePickingUpdates()
  async createPickingWave(
    @Args('input') input: CreatePickingWaveInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<PickingWaveType> {
    return this.pickingWaveService.createWave(tenantId, input as any, user.id);
  }

  @Mutation(() => PickingWaveType, { name: 'updatePickingWave' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:update')
  @RequirePickingPermission('manage')
  @AuditPickingOperation('update_wave')
  @MonitorPickingPerformance()
  @EnablePickingUpdates()
  async updatePickingWave(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePickingWaveInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<PickingWaveType> {
    const result = await this.pickingWaveService.updateWave(tenantId, id, input as any, user.id);
    return result as PickingWaveType;
  }

  @Mutation(() => Boolean, { name: 'deletePickingWave' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:delete')
  @RequirePickingPermission('admin')
  @AuditPickingOperation('delete_wave')
  @MonitorPickingPerformance()
  async deletePickingWave(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.pickingWaveService.deleteWave(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => PickingWaveType, { name: 'releasePickingWave' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:release')
  @RequirePickingPermission('manage')
  @AuditPickingOperation('release_wave')
  @MonitorPickingPerformance()
  @EnablePickingUpdates()
  async releasePickingWave(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<PickingWaveType> {
    return this.pickingWaveService.updateWaveStatus(tenantId, id, 'RELEASED' as any, user.id);
  }

  @Mutation(() => PickingWaveType, { name: 'startPickingWave' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:start')
  @RequirePickingPermission('pick')
  @AuditPickingOperation('start_wave')
  @MonitorPickingPerformance()
  @EnablePickingUpdates()
  async startPickingWave(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<PickingWaveType> {
    return this.pickingWaveService.updateWaveStatus(tenantId, id, 'IN_PROGRESS' as any, user.id);
  }

  @Mutation(() => PickingWaveType, { name: 'completePickingWave' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:complete')
  @RequirePickingPermission('pick')
  @AuditPickingOperation('complete_wave')
  @MonitorPickingPerformance()
  @EnablePickingUpdates()
  async completePickingWave(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<PickingWaveType> {
    return this.pickingWaveService.updateWaveStatus(tenantId, id, 'COMPLETED' as any, user.id);
  }

  @Mutation(() => PickingWaveType, { name: 'cancelPickingWave' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:cancel')
  @RequirePickingPermission('manage')
  @AuditPickingOperation('cancel_wave')
  @MonitorPickingPerformance()
  @EnablePickingUpdates()
  async cancelPickingWave(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { nullable: true }) reason?: string,
    @CurrentTenant() tenantId?: string,
    @CurrentUser() user?: any,
  ): Promise<PickingWaveType> {
    return this.pickingWaveService.updateWaveStatus(tenantId || '', id, 'CANCELLED' as any, user?.id || 'system');
  }

  @Mutation(() => PickingWaveType, { name: 'assignPickersToWave' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:assign')
  @RequirePickingPermission('manage')
  @AuditPickingOperation('assign_pickers')
  @MonitorPickingPerformance()
  @EnablePickingUpdates()
  async assignPickersToWave(
    @Args('waveId', { type: () => ID }) waveId: string,
    @Args('input') input: AssignPickersInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<PickingWaveType> {
    return this.pickingWaveService.assignPickers(tenantId, waveId, input.pickerIds || [], user.id);
  }

  @Mutation(() => [PickingWaveType], { name: 'planPickingWaves' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:plan')
  @RequirePickingPermission('manage')
  @AuditPickingOperation('plan_waves')
  @MonitorPickingPerformance()
  async planPickingWaves(
    @Args('input') input: WavePlanningInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<PickingWaveType[]> {
    const wave = await this.pickingWaveService.planWave(tenantId, input as any);
    return wave ? [wave] : [];
  }

  @Mutation(() => PickingWaveType, { name: 'optimizePickingWave' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:optimize')
  @RequirePickingPermission('manage')
  @AuditPickingOperation('optimize_wave')
  @MonitorPickingPerformance()
  async optimizePickingWave(
    @Args('waveId', { type: () => ID }) waveId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<PickingWaveType> {
    const result = await this.pickingWaveService.optimizeWaveSequence(tenantId, '', [waveId], user.id);
    return result;
  }

  // Field Resolvers
  @ResolveField(() => WarehouseType, { name: 'warehouse' })
  async resolveWarehouse(
    @Parent() wave: PickingWaveType,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseType> {
    return this.dataLoaderService.getLoader(
      'warehouses',
      (warehouseIds: readonly string[]) => this.warehouseService.getWarehousesByIds(Array.from(warehouseIds) as string[], tenantId),
    ).load(wave.warehouseId);
  }

  @ResolveField(() => [PickListType], { name: 'pickLists' })
  async resolvePickLists(
    @Parent() wave: PickingWaveType,
    @CurrentTenant() tenantId: string,
  ): Promise<PickListType[]> {
    return this.pickListService.getPickListsByWave(tenantId, wave.id);
  }

  @ResolveField(() => [EmployeeType], { name: 'assignedPickers' })
  async resolveAssignedPickers(
    @Parent() wave: PickingWaveType,
    @CurrentTenant() tenantId: string,
  ): Promise<EmployeeType[]> {
    if (!wave.assignedPickers || wave.assignedPickers.length === 0) return [];
    
    const employees = await this.dataLoaderService.getLoader(
      'employees',
      (employeeIds: readonly string[]) => this.getEmployeesByIds(tenantId, Array.from(employeeIds)),
    ).loadMany(wave.assignedPickers);
    
    return (employees || []).filter(e => !(e instanceof Error)) as EmployeeType[];
  }

  @ResolveField(() => WaveStatisticsType, { name: 'statistics' })
  async resolveStatistics(
    @Parent() wave: PickingWaveType,
    @CurrentTenant() tenantId: string,
  ): Promise<WaveStatisticsType> {
    return this.pickingWaveService.getWaveStatistics(tenantId, wave.id);
  }

  @ResolveField(() => [WaveRecommendationType], { name: 'recommendations' })
  async resolveRecommendations(
    @Parent() wave: PickingWaveType,
    @CurrentTenant() tenantId: string,
  ): Promise<WaveRecommendationType[]> {
    // Return recommendations from wave object or generate recommendations
    return (wave as any).recommendations || [];
  }

  // Subscriptions
  @Subscription(() => PickingWaveType, { name: 'pickingWaveUpdated' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:read')
  pickingWaveUpdated(
    @Args('waveId', { type: () => ID }) waveId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`picking.wave.updated.${tenantId}.${waveId}`);
  }

  @Subscription(() => WaveStatisticsType, { name: 'pickingWaveStatisticsUpdated' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:read')
  pickingWaveStatisticsUpdated(
    @Args('waveId', { type: () => ID }) waveId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`picking.wave.statistics.updated.${tenantId}.${waveId}`);
  }

  @Subscription(() => PickingWaveType, { name: 'pickingWaveStatusChanged' })
  @UseGuards(PermissionsGuard)
  @Permissions('picking:read')
  pickingWaveStatusChanged(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = warehouseId 
      ? `picking.wave.status.changed.${tenantId}.${warehouseId}.*`
      : `picking.wave.status.changed.${tenantId}.*`;
    return this.pubSub.asyncIterator(pattern);
  }

  // Helper methods
  private async getEmployeesByIds(tenantId: string, employeeIds: string[]): Promise<EmployeeType[]> {
    // This would typically call an employee service
    // For now, return empty array or implement based on your employee module
    return [];
  }
}