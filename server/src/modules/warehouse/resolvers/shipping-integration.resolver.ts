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
import { ShippingIntegrationService } from '../services/shipping-integration.service';
import { WarehouseService } from '../services/warehouse.service';
import { PickListService } from '../services/pick-list.service';

// Types and Inputs
import {
  ShipmentType,
  ShipmentConnection,
  ShippingRateType,
  ShippingLabelType,
  TrackingEventType,
  TrackingEventConnection,
  ShippingMetricsType,
  CreateShipmentInput,
  GetShippingRatesInput,
  CreateShippingLabelInput,
  ShipmentFilterInput,
} from '../types/shipping-integration.types';
import { WarehouseType } from '../types/warehouse.types';
import { PickListType } from '../types/pick-list.types';

// Decorators and Guards
import {
  RequireShippingPermission,
  AuditShippingOperation,
  MonitorShippingPerformance,
  CacheShippingData,
  EnableShippingUpdates,
} from '../decorators/warehouse.decorators';
import { WarehouseAccessGuard } from '../guards/warehouse-access.guard';
import { WarehouseAuditInterceptor } from '../interceptors/warehouse-audit.interceptor';
import { WarehousePerformanceInterceptor } from '../interceptors/warehouse-performance.interceptor';

@Resolver(() => ShipmentType)
@UseGuards(JwtAuthGuard, WarehouseAccessGuard)
@UseInterceptors(WarehouseAuditInterceptor, WarehousePerformanceInterceptor)
export class ShippingIntegrationResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly shippingService: ShippingIntegrationService,
    private readonly warehouseService: WarehouseService,
    private readonly pickListService: PickListService,
    @Inject('PUB_SUB') private readonly pubSub: any,
  ) {
    super(dataLoaderService);
  }

  // Queries
  @Query(() => ShipmentType, { name: 'shipment' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  @RequireShippingPermission('ship')
  @CacheShippingData(120)
  @MonitorShippingPerformance()
  async getShipment(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ShipmentType> {
    return this.shippingService.getShipment(tenantId, id);
  }

  @Query(() => ShipmentConnection, { name: 'shipments' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  @RequireShippingPermission('ship')
  @CacheShippingData(60)
  @MonitorShippingPerformance()
  async getShipments(
    @Args() paginationArgs: PaginationArgs,
    @Args('filter', { type: () => ShipmentFilterInput, nullable: true }) filter?: ShipmentFilterInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<ShipmentConnection> {
    const shipments = await this.shippingService.getShipments(tenantId || '', { ...paginationArgs, ...filter });
    return {
      edges: (shipments || []).map((shipment: any, idx: number) => ({ 
        cursor: Buffer.from(`shipment-${idx}`).toString('base64'),
        node: shipment 
      })),
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
      },
      totalCount: shipments?.length || 0,
    } as ShipmentConnection;
  }

  @Query(() => ShipmentType, { name: 'shipmentByTrackingNumber' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  @RequireShippingPermission('ship')
  @CacheShippingData(120)
  async getShipmentByTrackingNumber(
    @Args('trackingNumber') trackingNumber: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ShipmentType> {
    return this.shippingService.getShipmentByTrackingNumber(tenantId, trackingNumber);
  }

  @Query(() => [ShipmentType], { name: 'shipmentsByWarehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  @RequireShippingPermission('ship')
  @CacheShippingData(120)
  async getShipmentsByWarehouse(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ShipmentType[]> {
    const result = await this.shippingService.getShipmentsByWarehouse(tenantId, warehouseId);
    return (result.shipments || []) as any as ShipmentType[];
  }

  @Query(() => [ShippingRateType], { name: 'shippingRates' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:rates')
  @RequireShippingPermission('ship')
  @CacheShippingData(300)
  @MonitorShippingPerformance()
  async getShippingRates(
    @Args('input') input: GetShippingRatesInput,
    @CurrentTenant() tenantId: string,
  ): Promise<ShippingRateType[]> {
    const rates = await this.shippingService.getShippingRates(tenantId, input as any);
    return (rates || []).map((rate: any) => ({
      ...rate,
      carrierId: rate.carrier?.id || rate.carrierId,
    } as ShippingRateType));
  }

  @Query(() => ShippingLabelType, { name: 'shippingLabel' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  @RequireShippingPermission('ship')
  @CacheShippingData(3600)
  async getShippingLabel(
    @Args('shipmentId', { type: () => ID }) shipmentId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ShippingLabelType> {
    const result = await this.shippingService.getShippingLabelByShipment(tenantId, shipmentId);
    return result as ShippingLabelType;
  }

  @Query(() => [TrackingEventType], { name: 'trackingEvents' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:track')
  @RequireShippingPermission('ship')
  @CacheShippingData(60)
  async getTrackingEvents(
    @Args('trackingNumber') trackingNumber: string,
    @CurrentTenant() tenantId: string,
  ): Promise<TrackingEventType[]> {
    return this.shippingService.getTrackingEvents(tenantId, trackingNumber);
  }

  @Query(() => ShippingMetricsType, { name: 'shippingMetrics' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:metrics')
  @RequireShippingPermission('manage')
  @CacheShippingData(300)
  async getShippingMetrics(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
    @CurrentTenant() tenantId?: string,
  ): Promise<ShippingMetricsType> {
    const now = new Date();
    const from = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = endDate || now;
    const result = await this.shippingService.getShippingMetrics(tenantId || '', warehouseId, { from, to });
    return (result || {}) as any as ShippingMetricsType;
  }

  @Query(() => [ShipmentType], { name: 'pendingShipments' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  @RequireShippingPermission('ship')
  @CacheShippingData(30)
  async getPendingShipments(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<ShipmentType[]> {
    return this.shippingService.getPendingShipments(tenantId || '') as Promise<ShipmentType[]>;
  }

  @Query(() => [ShipmentType], { name: 'inTransitShipments' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  @RequireShippingPermission('ship')
  @CacheShippingData(60)
  async getInTransitShipments(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<ShipmentType[]> {
    return this.shippingService.getInTransitShipments(tenantId || '') as Promise<ShipmentType[]>;
  }

  @Query(() => [ShipmentType], { name: 'deliveredShipments' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  @RequireShippingPermission('ship')
  @CacheShippingData(300)
  async getDeliveredShipments(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @Args('days', { type: () => Number, defaultValue: 7 }) days?: number,
    @CurrentTenant() tenantId?: string,
  ): Promise<ShipmentType[]> {
    const shipments = await this.shippingService.getDeliveredShipments(tenantId || '');
    return (shipments || []) as ShipmentType[];
  }

  @Query(() => [ShipmentType], { name: 'exceptionShipments' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  @RequireShippingPermission('ship')
  @CacheShippingData(30)
  async getExceptionShipments(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<ShipmentType[]> {
    const shipments = await this.shippingService.getExceptionShipments(tenantId || '');
    return (shipments || []) as ShipmentType[];
  }

  // Mutations
  @Mutation(() => ShipmentType, { name: 'createShipment' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:create')
  @RequireShippingPermission('ship')
  @AuditShippingOperation('create_shipment')
  @MonitorShippingPerformance()
  @EnableShippingUpdates()
  async createShipment(
    @Args('input') input: CreateShipmentInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<ShipmentType> {
    const result = await this.shippingService.createShipment(tenantId, input as any);
    return (result || {}) as any as ShipmentType;
  }

  @Mutation(() => ShippingLabelType, { name: 'createShippingLabel' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:label')
  @RequireShippingPermission('ship')
  @AuditShippingOperation('create_label')
  @MonitorShippingPerformance()
  @EnableShippingUpdates()
  async createShippingLabel(
    @Args('input') input: CreateShippingLabelInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<ShippingLabelType> {
    const result = await this.shippingService.createShippingLabel(tenantId, input as any);
    return (result || {}) as any as ShippingLabelType;
  }

  @Mutation(() => Boolean, { name: 'cancelShipment' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:cancel')
  @RequireShippingPermission('manage')
  @AuditShippingOperation('cancel_shipment')
  @MonitorShippingPerformance()
  @EnableShippingUpdates()
  async cancelShipment(
    @Args('shipmentId', { type: () => ID }) shipmentId: string,
    @Args('reason', { nullable: true }) reason?: string,
    @CurrentTenant() tenantId?: string,
    @CurrentUser() user?: any,
  ): Promise<boolean> {
    return await this.shippingService.cancelShipment(tenantId || '', shipmentId, user?.id);
  }

  @Mutation(() => ShipmentType, { name: 'updateShipmentStatus' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:update')
  @RequireShippingPermission('manage')
  @AuditShippingOperation('update_status')
  @MonitorShippingPerformance()
  @EnableShippingUpdates()
  async updateShipmentStatus(
    @Args('shipmentId', { type: () => ID }) shipmentId: string,
    @Args('status') status: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<ShipmentType> {
    await this.shippingService.updateShipmentStatus(tenantId, shipmentId, status, user.id);
    const result = await this.shippingService.getShipment(tenantId, shipmentId);
    return result as ShipmentType;
  }

  @Mutation(() => Boolean, { name: 'trackShipment' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:track')
  @RequireShippingPermission('ship')
  @AuditShippingOperation('track_shipment')
  @MonitorShippingPerformance()
  async trackShipment(
    @Args('trackingNumber') trackingNumber: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    const result = await this.shippingService.trackShipment(tenantId, trackingNumber);
    return result.isDelivered || false;
  }

  @Mutation(() => Boolean, { name: 'updateAllTrackingInfo' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:track')
  @RequireShippingPermission('manage')
  @AuditShippingOperation('update_all_tracking')
  @MonitorShippingPerformance()
  async updateAllTrackingInfo(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
    @CurrentUser() user?: any,
  ): Promise<boolean> {
    // Call internal tracking update method if available
    return true;
  }

  @Mutation(() => ShipmentType, { name: 'confirmDelivery' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:confirm')
  @RequireShippingPermission('ship')
  @AuditShippingOperation('confirm_delivery')
  @MonitorShippingPerformance()
  @EnableShippingUpdates()
  async confirmDelivery(
    @Args('shipmentId', { type: () => ID }) shipmentId: string,
    @Args('deliveryDate', { nullable: true }) deliveryDate?: Date,
    @Args('signature', { nullable: true }) signature?: string,
    @CurrentTenant() tenantId?: string,
    @CurrentUser() user?: any,
  ): Promise<ShipmentType> {
    const result = await this.shippingService.confirmDelivery(tenantId || '', shipmentId);
    return result as ShipmentType;
  }

  @Mutation(() => ShippingLabelType, { name: 'generateReturnLabel' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:return')
  @RequireShippingPermission('ship')
  @AuditShippingOperation('generate_return_label')
  @MonitorShippingPerformance()
  async generateReturnLabel(
    @Args('shipmentId', { type: () => ID }) shipmentId: string,
    @Args('reason', { nullable: true }) reason?: string,
    @CurrentTenant() tenantId?: string,
    @CurrentUser() user?: any,
  ): Promise<ShippingLabelType> {
    const result = await this.shippingService.generateReturnLabel(tenantId || '', shipmentId);
    return result as ShippingLabelType;
  }

  @Mutation(() => Boolean, { name: 'validateAddress' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:validate')
  @RequireShippingPermission('ship')
  @AuditShippingOperation('validate_address')
  async validateAddress(
    @Args('address') address: any,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    return this.shippingService.validateAddress(tenantId, address as any);
  }

  @Mutation(() => Boolean, { name: 'schedulePickup' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:pickup')
  @RequireShippingPermission('manage')
  @AuditShippingOperation('schedule_pickup')
  @MonitorShippingPerformance()
  async schedulePickup(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @Args('pickupDate') pickupDate: Date,
    @Args('shipmentIds', { type: () => [ID] }) shipmentIds: string[],
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.shippingService.schedulePickup(tenantId, warehouseId, { pickupDate, shipmentIds } as any);
    return true;
  }

  // Field Resolvers
  @ResolveField(() => WarehouseType, { name: 'warehouse' })
  async resolveWarehouse(
    @Parent() shipment: ShipmentType,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseType> {
    return this.dataLoaderService.getLoader(
      'warehouses',
      (warehouseIds: readonly string[]) => this.warehouseService.getWarehousesByIds(Array.from(warehouseIds) as string[], tenantId),
    ).load(shipment.warehouseId);
  }

  @ResolveField(() => PickListType, { name: 'pickList', nullable: true })
  async resolvePickList(
    @Parent() shipment: ShipmentType,
    @CurrentTenant() tenantId: string,
  ): Promise<PickListType | null> {
    if (!shipment.pickListId) return null;
    
    return this.dataLoaderService.getLoader(
      'pickLists',
      async (pickListIds: readonly string[]) => {
        const result = await this.pickListService.getPickLists(tenantId, { search: '' } as any);
        const pickListsMap = new Map((result.pickLists || []).map(pl => [pl.id, pl]));
        return Array.from(pickListIds).map(id => pickListsMap.get(id) || null);
      },
    ).load(shipment.pickListId);
  }

  @ResolveField(() => [TrackingEventType], { name: 'trackingEvents' })
  async resolveTrackingEvents(
    @Parent() shipment: ShipmentType,
    @CurrentTenant() tenantId: string,
  ): Promise<TrackingEventType[]> {
    if (!shipment.trackingNumber) return [];
    return this.shippingService.getTrackingEvents(tenantId, shipment.trackingNumber);
  }

  @ResolveField(() => TrackingEventType, { name: 'latestTrackingEvent', nullable: true })
  async resolveLatestTrackingEvent(
    @Parent() shipment: ShipmentType,
    @CurrentTenant() tenantId: string,
  ): Promise<TrackingEventType | null> {
    if (!shipment.trackingNumber) return null;
    const events = await this.shippingService.getTrackingEvents(tenantId, shipment.trackingNumber);
    return events.length > 0 ? events[0] : null;
  }

  @ResolveField(() => ShippingLabelType, { name: 'shippingLabel', nullable: true })
  async resolveShippingLabel(
    @Parent() shipment: ShipmentType,
    @CurrentTenant() tenantId: string,
  ): Promise<ShippingLabelType | null> {
    return this.shippingService.getShippingLabelByShipment(tenantId, shipment.id);
  }

  @ResolveField(() => Boolean, { name: 'isDelivered' })
  resolveIsDelivered(@Parent() shipment: ShipmentType): boolean {
    return shipment.status === 'delivered';
  }

  @ResolveField(() => Boolean, { name: 'isInTransit' })
  resolveIsInTransit(@Parent() shipment: ShipmentType): boolean {
    return shipment.status === 'in_transit';
  }

  @ResolveField(() => Boolean, { name: 'hasException' })
  resolveHasException(@Parent() shipment: ShipmentType): boolean {
    return shipment.status === 'exception';
  }

  @ResolveField(() => Number, { name: 'transitDays', nullable: true })
  resolveTransitDays(@Parent() shipment: ShipmentType): number | null {
    if (!shipment.shippedDate || !shipment.actualDeliveryDate) return null;
    const diffTime = shipment.actualDeliveryDate.getTime() - shipment.shippedDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  @ResolveField(() => Boolean, { name: 'isOnTime' })
  resolveIsOnTime(@Parent() shipment: ShipmentType): boolean {
    if (!shipment.estimatedDeliveryDate || !shipment.actualDeliveryDate) return true;
    return shipment.actualDeliveryDate <= shipment.estimatedDeliveryDate;
  }

  // Subscriptions
  @Subscription(() => ShipmentType, { name: 'shipmentUpdated' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  shipmentUpdated(
    @Args('shipmentId', { type: () => ID }) shipmentId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`shipment.updated.${tenantId}.${shipmentId}`);
  }

  @Subscription(() => TrackingEventType, { name: 'trackingEventAdded' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  trackingEventAdded(
    @Args('trackingNumber') trackingNumber: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`tracking.event.added.${tenantId}.${trackingNumber}`);
  }

  @Subscription(() => ShipmentType, { name: 'shipmentDelivered' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  shipmentDelivered(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = warehouseId 
      ? `shipment.delivered.${tenantId}.${warehouseId}.*`
      : `shipment.delivered.${tenantId}.*`;
    return this.pubSub.asyncIterator(pattern);
  }

  @Subscription(() => ShipmentType, { name: 'shipmentException' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  shipmentException(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = warehouseId 
      ? `shipment.exception.${tenantId}.${warehouseId}.*`
      : `shipment.exception.${tenantId}.*`;
    return this.pubSub.asyncIterator(pattern);
  }

  @Subscription(() => ShippingLabelType, { name: 'shippingLabelCreated' })
  @UseGuards(PermissionsGuard)
  @Permissions('shipping:read')
  shippingLabelCreated(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = warehouseId 
      ? `shipping.label.created.${tenantId}.${warehouseId}.*`
      : `shipping.label.created.${tenantId}.*`;
    return this.pubSub.asyncIterator(pattern);
  }
}