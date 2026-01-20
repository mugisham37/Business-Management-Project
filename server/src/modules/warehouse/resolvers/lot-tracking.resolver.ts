import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent, Subscription } from '@nestjs/graphql';
import { UseGuards, UseInterceptors, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { PaginationArgs } from '../../../common/graphql/base.types';

// Services
import { LotTrackingService } from '../services/lot-tracking.service';
import { WarehouseService } from '../services/warehouse.service';
import { BinLocationService } from '../services/bin-location.service';

// Types and Inputs
import {
  LotInfoType,
  LotInfoConnection,
  FIFORuleType,
  LotMovementType,
  RecallInfoType,
  RecallInfoConnection,
  LotTraceabilityType,
  CreateLotInput,
  UpdateLotInput,
  CreateFIFORuleInput,
  CreateRecallInput,
  RecordLotMovementInput,
  LotFilterInput,
} from '../types/lot-tracking.types';
import { WarehouseType } from '../types/warehouse.types';
import { BinLocationType } from '../types/bin-location.types';

// Decorators and Guards
import {
  RequireLotTrackingPermission,
  AuditLotTrackingOperation,
  MonitorLotTrackingPerformance,
  CacheLotTrackingData,
  EnableLotTrackingUpdates,
} from '../decorators/warehouse.decorators';
import { WarehouseAccessGuard } from '../guards/warehouse-access.guard';
import { WarehouseAuditInterceptor } from '../interceptors/warehouse-audit.interceptor';
import { WarehousePerformanceInterceptor } from '../interceptors/warehouse-performance.interceptor';

@Resolver(() => LotInfoType)
@UseGuards(JwtAuthGuard, WarehouseAccessGuard)
@UseInterceptors(WarehouseAuditInterceptor, WarehousePerformanceInterceptor)
export class LotTrackingResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly lotTrackingService: LotTrackingService,
    private readonly warehouseService: WarehouseService,
    private readonly binLocationService: BinLocationService,
    @Inject('PUB_SUB') private readonly pubSub: any,
  ) {
    super(dataLoaderService);
  }

  // Queries
  @Query(() => LotInfoType, { name: 'lotInfo' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('track')
  @CacheLotTrackingData(300)
  @MonitorLotTrackingPerformance()
  async getLotInfo(
    @Args('lotNumber') lotNumber: string,
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LotInfoType> {
    const result = await this.lotTrackingService.getLotByNumber(tenantId, productId, lotNumber);
    return result as any;
  }

  @Query(() => LotInfoConnection, { name: 'lots' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('track')
  @CacheLotTrackingData(180)
  @MonitorLotTrackingPerformance()
  async getLots(
    @Args() paginationArgs: PaginationArgs,
    @Args('filter', { type: () => LotFilterInput, nullable: true }) filter?: LotFilterInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<LotInfoConnection> {
    return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } } as any;
  }

  @Query(() => [LotInfoType], { name: 'lotsByProduct' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('track')
  @CacheLotTrackingData(300)
  async getLotsByProduct(
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LotInfoType[]> {
    const result = await this.lotTrackingService.getLotsForProduct(tenantId, productId, {});
    return result as any;
  }

  @Query(() => [LotInfoType], { name: 'lotsByWarehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('track')
  @CacheLotTrackingData(300)
  async getLotsByWarehouse(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LotInfoType[]> {
    return [];
  }

  @Query(() => [LotInfoType], { name: 'expiredLots' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('track')
  @CacheLotTrackingData(60)
  async getExpiredLots(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<LotInfoType[]> {
    const result = await this.lotTrackingService.getExpiringLots(tenantId || '', warehouseId || '', 0);
    return result as any;
  }

  @Query(() => [LotInfoType], { name: 'nearExpiryLots' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('track')
  @CacheLotTrackingData(60)
  async getNearExpiryLots(
    @Args('days', { type: () => Number, defaultValue: 30 }) days: number,
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<LotInfoType[]> {
    const result = await this.lotTrackingService.getExpiringLots(tenantId || '', warehouseId || '', days);
    return result as any;
  }

  @Query(() => LotTraceabilityType, { name: 'lotTraceability' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('track')
  @CacheLotTrackingData(300)
  @MonitorLotTrackingPerformance()
  async getLotTraceability(
    @Args('lotNumber') lotNumber: string,
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LotTraceabilityType> {
    return this.lotTrackingService.getLotTraceability(tenantId, lotNumber, productId) as any;
  }

  @Query(() => [LotMovementType], { name: 'lotMovementHistory' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('track')
  @CacheLotTrackingData(300)
  async getLotMovementHistory(
    @Args('lotNumber') lotNumber: string,
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LotMovementType[]> {
    const movements = await this.lotTrackingService.getLotMovementHistory(tenantId, lotNumber, productId);
    return movements as any;
  }

  @Query(() => FIFORuleType, { name: 'fifoRule' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('manage')
  @CacheLotTrackingData(600)
  async getFIFORule(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<FIFORuleType> {
    return this.lotTrackingService.getFIFORule(tenantId || '', productId, warehouseId || '') as any;
  }

  @Query(() => [FIFORuleType], { name: 'fifoRules' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('manage')
  @CacheLotTrackingData(600)
  async getFIFORules(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<FIFORuleType[]> {
    return this.lotTrackingService.getFIFORules(tenantId || '', warehouseId) as any;
  }

  @Query(() => RecallInfoType, { name: 'recallInfo' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('manage')
  @CacheLotTrackingData(300)
  async getRecallInfo(
    @Args('recallId', { type: () => ID }) recallId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<RecallInfoType> {
    return this.lotTrackingService.getRecallInfo(tenantId, recallId);
  }

  @Query(() => RecallInfoConnection, { name: 'recalls' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('manage')
  @CacheLotTrackingData(300)
  async getRecalls(
    @Args() paginationArgs: PaginationArgs,
    @Args('productId', { type: () => ID, nullable: true }) productId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<RecallInfoConnection> {
    return this.lotTrackingService.getRecalls(tenantId || '', paginationArgs, productId) as any;
  }

  @Query(() => [RecallInfoType], { name: 'activeRecalls' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  @RequireLotTrackingPermission('manage')
  @CacheLotTrackingData(60)
  async getActiveRecalls(
    @CurrentTenant() tenantId: string,
  ): Promise<RecallInfoType[]> {
    return this.lotTrackingService.getActiveRecalls(tenantId);
  }

  // Mutations
  @Mutation(() => LotInfoType, { name: 'createLot' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:create')
  @RequireLotTrackingPermission('manage')
  @AuditLotTrackingOperation('create_lot')
  @MonitorLotTrackingPerformance()
  @EnableLotTrackingUpdates()
  async createLot(
    @Args('input') input: CreateLotInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<LotInfoType> {
    const result = await this.lotTrackingService.createLotFromResolver(tenantId, input, user.id);
    return result as LotInfoType;
  }

  @Mutation(() => LotInfoType, { name: 'updateLot' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:update')
  @RequireLotTrackingPermission('manage')
  @AuditLotTrackingOperation('update_lot')
  @MonitorLotTrackingPerformance()
  @EnableLotTrackingUpdates()
  async updateLot(
    @Args('lotNumber') lotNumber: string,
    @Args('productId', { type: () => ID }) productId: string,
    @Args('input') input: UpdateLotInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<LotInfoType> {
    const result = await this.lotTrackingService.updateLotFromResolver(tenantId, productId, lotNumber, input, user.id);
    return result as LotInfoType;
  }

  @Mutation(() => Boolean, { name: 'deleteLot' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:delete')
  @RequireLotTrackingPermission('admin')
  @AuditLotTrackingOperation('delete_lot')
  @MonitorLotTrackingPerformance()
  async deleteLot(
    @Args('lotNumber') lotNumber: string,
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.lotTrackingService.deleteLot(tenantId, productId, lotNumber, user?.id);
    return true;
  }

  @Mutation(() => LotMovementType, { name: 'recordLotMovement' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:move')
  @RequireLotTrackingPermission('track')
  @AuditLotTrackingOperation('record_movement')
  @MonitorLotTrackingPerformance()
  @EnableLotTrackingUpdates()
  async recordLotMovement(
    @Args('input') input: RecordLotMovementInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<LotMovementType> {
    return this.lotTrackingService.recordLotMovement(tenantId, input, user.id);
  }

  @Mutation(() => FIFORuleType, { name: 'createFIFORule' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:configure')
  @RequireLotTrackingPermission('manage')
  @AuditLotTrackingOperation('create_fifo_rule')
  @MonitorLotTrackingPerformance()
  async createFIFORule(
    @Args('input') input: CreateFIFORuleInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<FIFORuleType> {
    return this.lotTrackingService.createFIFORule(tenantId, input, user.id);
  }

  @Mutation(() => FIFORuleType, { name: 'updateFIFORule' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:configure')
  @RequireLotTrackingPermission('manage')
  @AuditLotTrackingOperation('update_fifo_rule')
  @MonitorLotTrackingPerformance()
  async updateFIFORule(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CreateFIFORuleInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<FIFORuleType> {
    return this.lotTrackingService.updateFIFORule(tenantId, id, input, user.id);
  }

  @Mutation(() => Boolean, { name: 'deleteFIFORule' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:configure')
  @RequireLotTrackingPermission('admin')
  @AuditLotTrackingOperation('delete_fifo_rule')
  async deleteFIFORule(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.lotTrackingService.deleteFIFORule(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => RecallInfoType, { name: 'createRecall' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:recall')
  @RequireLotTrackingPermission('admin')
  @AuditLotTrackingOperation('create_recall')
  @MonitorLotTrackingPerformance()
  @EnableLotTrackingUpdates()
  async createRecall(
    @Args('input') input: CreateRecallInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<RecallInfoType> {
    const result = await this.lotTrackingService.createRecall(tenantId, { tenantId, ...input, userId: user.id } as any);
    return (result || {}) as any as RecallInfoType;
  }

  @Mutation(() => RecallInfoType, { name: 'updateRecallStatus' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:recall')
  @RequireLotTrackingPermission('admin')
  @AuditLotTrackingOperation('update_recall_status')
  @MonitorLotTrackingPerformance()
  @EnableLotTrackingUpdates()
  async updateRecallStatus(
    @Args('recallId', { type: () => ID }) recallId: string,
    @Args('status') status: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<RecallInfoType> {
    return this.lotTrackingService.updateRecallStatus(tenantId, recallId, status, user.id);
  }

  @Mutation(() => Boolean, { name: 'quarantineLot' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:quarantine')
  @RequireLotTrackingPermission('manage')
  @AuditLotTrackingOperation('quarantine_lot')
  @MonitorLotTrackingPerformance()
  @EnableLotTrackingUpdates()
  async quarantineLot(
    @Args('lotNumber') lotNumber: string,
    @Args('productId', { type: () => ID }) productId: string,
    @Args('reason') reason: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.lotTrackingService.updateLot(tenantId, lotNumber, productId, { 
      qualityStatus: 'quarantine', 
      notes: reason,
      userId: user.id,
    });
    return true;
  }

  @Mutation(() => Boolean, { name: 'releaseLotFromQuarantine' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:release')
  @RequireLotTrackingPermission('manage')
  @AuditLotTrackingOperation('release_quarantine')
  @MonitorLotTrackingPerformance()
  @EnableLotTrackingUpdates()
  async releaseLotFromQuarantine(
    @Args('lotNumber') lotNumber: string,
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.lotTrackingService.releaseLotFromQuarantine(tenantId, productId, lotNumber, user.id);
    return true;
  }

  @Mutation(() => Boolean, { name: 'checkLotExpiry' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:check')
  @RequireLotTrackingPermission('track')
  @AuditLotTrackingOperation('check_expiry')
  @MonitorLotTrackingPerformance()
  async checkLotExpiry(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
    @CurrentUser() user?: any,
  ): Promise<boolean> {
    await this.lotTrackingService.checkLotExpiry(tenantId || '', user?.id, warehouseId);
    return true;
  }

  // Field Resolvers
  @ResolveField(() => WarehouseType, { name: 'warehouse' })
  async resolveWarehouse(
    @Parent() lot: LotInfoType,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseType> {
    return this.dataLoaderService.getLoader(
      'warehouses',
      (warehouseIds: readonly string[]) => this.warehouseService.getWarehousesByIds(Array.from(warehouseIds) as string[], tenantId),
    ).load(lot.warehouseId);
  }

  @ResolveField(() => BinLocationType, { name: 'binLocation', nullable: true })
  async resolveBinLocation(
    @Parent() lot: LotInfoType,
    @CurrentTenant() tenantId: string,
  ): Promise<BinLocationType | null> {
    if (!lot.binLocationId) return null;
    
    return this.dataLoaderService.getLoader(
      'binLocations',
      async (binLocationIds: readonly string[]) => {
        // Fetch bin locations by IDs
        const locations: BinLocationType[] = [];
        for (const id of binLocationIds) {
          // Implement batch fetching logic - for now return empty placeholder
          locations.push({ id } as any);
        }
        return locations;
      },
    ).load(lot.binLocationId);
  }

  @ResolveField(() => [LotMovementType], { name: 'movementHistory' })
  async resolveMovementHistory(
    @Parent() lot: LotInfoType,
    @CurrentTenant() tenantId: string,
  ): Promise<LotMovementType[]> {
    const movements = await this.lotTrackingService.getLotMovementHistory(tenantId, lot.productId, lot.lotNumber);
    return (movements || []) as any as LotMovementType[];
  }

  @ResolveField(() => Boolean, { name: 'isExpired' })
  resolveIsExpired(@Parent() lot: LotInfoType): boolean {
    if (!lot.expiryDate) return false;
    return new Date() > lot.expiryDate;
  }

  @ResolveField(() => Boolean, { name: 'isNearExpiry' })
  resolveIsNearExpiry(@Parent() lot: LotInfoType): boolean {
    if (!lot.expiryDate) return false;
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 30); // 30 days warning
    return lot.expiryDate <= warningDate && lot.expiryDate > new Date();
  }

  @ResolveField(() => Number, { name: 'daysUntilExpiry', nullable: true })
  resolveDaysUntilExpiry(@Parent() lot: LotInfoType): number | null {
    if (!lot.expiryDate) return null;
    const today = new Date();
    const diffTime = lot.expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Subscriptions
  @Subscription(() => LotInfoType, { name: 'lotUpdated' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  lotUpdated(
    @Args('lotNumber') lotNumber: string,
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`lot.updated.${tenantId}.${productId}.${lotNumber}`);
  }

  @Subscription(() => LotMovementType, { name: 'lotMovementRecorded' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  lotMovementRecorded(
    @Args('lotNumber') lotNumber: string,
    @Args('productId', { type: () => ID }) productId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`lot.movement.recorded.${tenantId}.${productId}.${lotNumber}`);
  }

  @Subscription(() => RecallInfoType, { name: 'recallCreated' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  recallCreated(
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`recall.created.${tenantId}`);
  }

  @Subscription(() => LotInfoType, { name: 'lotExpired' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  lotExpired(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = warehouseId 
      ? `lot.expired.${tenantId}.${warehouseId}.*`
      : `lot.expired.${tenantId}.*`;
    return this.pubSub.asyncIterator(pattern);
  }

  @Subscription(() => LotInfoType, { name: 'lotNearExpiry' })
  @UseGuards(PermissionsGuard)
  @Permissions('lot_tracking:read')
  lotNearExpiry(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = warehouseId 
      ? `lot.near_expiry.${tenantId}.${warehouseId}.*`
      : `lot.near_expiry.${tenantId}.*`;
    return this.pubSub.asyncIterator(pattern);
  }
}