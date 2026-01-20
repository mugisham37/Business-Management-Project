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
import { KittingAssemblyService } from '../services/kitting-assembly.service';
import { WarehouseService } from '../services/warehouse.service';
import { BinLocationService } from '../services/bin-location.service';

// Types and Inputs
import {
  KitDefinitionType,
  KitDefinitionConnection,
  AssemblyWorkOrderType,
  AssemblyWorkOrderConnection,
  AssemblyMetricsType,
  CreateKitDefinitionInput,
  CreateAssemblyWorkOrderInput,
  UpdateAssemblyWorkOrderInput,
  RecordQualityCheckInput,
  AllocateComponentInput,
  KitDefinitionFilterInput,
  AssemblyWorkOrderFilterInput,
} from '../types/kitting-assembly.types';
import { WarehouseType } from '../types/warehouse.types';
import { BinLocationType } from '../types/bin-location.types';
import { Employee as EmployeeType } from '../../employee/types/employee.types';

// Decorators and Guards
import {
  RequireAssemblyPermission,
  AuditAssemblyOperation,
  MonitorAssemblyPerformance,
  CacheAssemblyData,
  EnableAssemblyUpdates,
} from '../decorators/warehouse.decorators';
import { WarehouseAccessGuard } from '../guards/warehouse-access.guard';
import { WarehouseAuditInterceptor } from '../interceptors/warehouse-audit.interceptor';
import { WarehousePerformanceInterceptor } from '../interceptors/warehouse-performance.interceptor';

@Resolver(() => KitDefinitionType)
@UseGuards(JwtAuthGuard, WarehouseAccessGuard)
@UseInterceptors(WarehouseAuditInterceptor, WarehousePerformanceInterceptor)
export class KittingAssemblyResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly kittingAssemblyService: KittingAssemblyService,
    private readonly warehouseService: WarehouseService,
    private readonly binLocationService: BinLocationService,
    @Inject('PUB_SUB') private readonly pubSub: any,
  ) {
    super(dataLoaderService);
  }

  // Kit Definition Queries
  @Query(() => KitDefinitionType, { name: 'kitDefinition' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(300)
  @MonitorAssemblyPerformance()
  async getKitDefinition(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<KitDefinitionType> {
    return this.kittingAssemblyService.getKitDefinition(tenantId, id);
  }

  @Query(() => KitDefinitionConnection, { name: 'kitDefinitions' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(180)
  @MonitorAssemblyPerformance()
  async getKitDefinitions(
    @Args() paginationArgs: PaginationArgs,
    @Args('filter', { type: () => KitDefinitionFilterInput, nullable: true }) filter?: KitDefinitionFilterInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<KitDefinitionConnection> {
    return this.kittingAssemblyService.getKitDefinitions(tenantId || '', paginationArgs, filter) as any;
  }

  @Query(() => KitDefinitionType, { name: 'kitDefinitionBySku' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(300)
  async getKitDefinitionBySku(
    @Args('kitSku') kitSku: string,
    @CurrentTenant() tenantId: string,
  ): Promise<KitDefinitionType> {
    return this.kittingAssemblyService.getKitDefinitionBySku(tenantId, kitSku);
  }

  @Query(() => [KitDefinitionType], { name: 'activeKitDefinitions' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(300)
  async getActiveKitDefinitions(
    @CurrentTenant() tenantId: string,
  ): Promise<KitDefinitionType[]> {
    return this.kittingAssemblyService.getActiveKitDefinitions(tenantId);
  }

  // Assembly Work Order Queries
  @Query(() => AssemblyWorkOrderType, { name: 'assemblyWorkOrder', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(60)
  @MonitorAssemblyPerformance()
  async getAssemblyWorkOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<AssemblyWorkOrderType | null> {
    const workOrder = await this.kittingAssemblyService.getAssemblyWorkOrder(tenantId, id);
    return workOrder as AssemblyWorkOrderType | null;
  }

  @Query(() => AssemblyWorkOrderConnection, { name: 'assemblyWorkOrders' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(30)
  @MonitorAssemblyPerformance()
  async getAssemblyWorkOrders(
    @Args() paginationArgs: PaginationArgs,
    @Args('filter', { type: () => AssemblyWorkOrderFilterInput, nullable: true }) filter?: AssemblyWorkOrderFilterInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<AssemblyWorkOrderConnection> {
    return this.kittingAssemblyService.getAssemblyWorkOrdersFromResolver(tenantId || '', paginationArgs, filter);
  }

  @Query(() => AssemblyWorkOrderType, { name: 'assemblyWorkOrderByNumber' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(60)
  async getAssemblyWorkOrderByNumber(
    @Args('workOrderNumber') workOrderNumber: string,
    @CurrentTenant() tenantId: string,
  ): Promise<AssemblyWorkOrderType> {
    return this.kittingAssemblyService.getAssemblyWorkOrderByNumber(tenantId, workOrderNumber);
  }

  @Query(() => [AssemblyWorkOrderType], { name: 'assemblyWorkOrdersByKit' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(120)
  async getAssemblyWorkOrdersByKit(
    @Args('kitId', { type: () => ID }) kitId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<AssemblyWorkOrderType[]> {
    return this.kittingAssemblyService.getAssemblyWorkOrdersByKit(tenantId, kitId);
  }

  @Query(() => [AssemblyWorkOrderType], { name: 'assemblyWorkOrdersByWarehouse' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(120)
  async getAssemblyWorkOrdersByWarehouse(
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<AssemblyWorkOrderType[]> {
    return this.kittingAssemblyService.getAssemblyWorkOrdersByWarehouse(tenantId, warehouseId);
  }

  @Query(() => [AssemblyWorkOrderType], { name: 'assemblyWorkOrdersByAssembler' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(60)
  async getAssemblyWorkOrdersByAssembler(
    @Args('assemblerId', { type: () => ID }) assemblerId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<AssemblyWorkOrderType[]> {
    return this.kittingAssemblyService.getAssemblyWorkOrdersByAssembler(tenantId, assemblerId);
  }

  @Query(() => [AssemblyWorkOrderType], { name: 'pendingAssemblyWorkOrders' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('assemble')
  @CacheAssemblyData(30)
  async getPendingAssemblyWorkOrders(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<AssemblyWorkOrderType[]> {
    return this.kittingAssemblyService.getPendingAssemblyWorkOrders(tenantId || '', warehouseId);
  }

  @Query(() => [AssemblyWorkOrderType], { name: 'overdueAssemblyWorkOrders' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  @RequireAssemblyPermission('manage')
  @CacheAssemblyData(30)
  async getOverdueAssemblyWorkOrders(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<AssemblyWorkOrderType[]> {
    return this.kittingAssemblyService.getOverdueAssemblyWorkOrders(tenantId || '', warehouseId);
  }

  @Query(() => AssemblyMetricsType, { name: 'assemblyMetrics' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:metrics')
  @RequireAssemblyPermission('manage')
  @CacheAssemblyData(300)
  async getAssemblyMetrics(
    @Args('kitId', { type: () => ID }) kitId: string,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
    @CurrentTenant() tenantId?: string,
  ): Promise<AssemblyMetricsType> {
    return this.kittingAssemblyService.getAssemblyMetricsFromResolver(tenantId || '', kitId, startDate, endDate);
  }

  // Kit Definition Mutations
  @Mutation(() => KitDefinitionType, { name: 'createKitDefinition' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:create')
  @RequireAssemblyPermission('manage')
  @AuditAssemblyOperation('create_kit_definition')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async createKitDefinition(
    @Args('input') input: CreateKitDefinitionInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<KitDefinitionType> {
    return this.kittingAssemblyService.createKitDefinition(tenantId, input, user.id);
  }

  @Mutation(() => KitDefinitionType, { name: 'updateKitDefinition' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:update')
  @RequireAssemblyPermission('manage')
  @AuditAssemblyOperation('update_kit_definition')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async updateKitDefinition(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CreateKitDefinitionInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<KitDefinitionType> {
    return this.kittingAssemblyService.updateKitDefinition(tenantId, id, input, user.id);
  }

  @Mutation(() => Boolean, { name: 'deleteKitDefinition' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:delete')
  @RequireAssemblyPermission('admin')
  @AuditAssemblyOperation('delete_kit_definition')
  @MonitorAssemblyPerformance()
  async deleteKitDefinition(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.kittingAssemblyService.deleteKitDefinition(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => KitDefinitionType, { name: 'activateKitDefinition' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:activate')
  @RequireAssemblyPermission('manage')
  @AuditAssemblyOperation('activate_kit_definition')
  @EnableAssemblyUpdates()
  async activateKitDefinition(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<KitDefinitionType> {
    return this.kittingAssemblyService.activateKitDefinition(tenantId, id, user.id);
  }

  @Mutation(() => KitDefinitionType, { name: 'deactivateKitDefinition' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:deactivate')
  @RequireAssemblyPermission('manage')
  @AuditAssemblyOperation('deactivate_kit_definition')
  @EnableAssemblyUpdates()
  async deactivateKitDefinition(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<KitDefinitionType> {
    return this.kittingAssemblyService.deactivateKitDefinition(tenantId, id, user.id);
  }

  // Assembly Work Order Mutations
  @Mutation(() => AssemblyWorkOrderType, { name: 'createAssemblyWorkOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:create')
  @RequireAssemblyPermission('assemble')
  @AuditAssemblyOperation('create_work_order')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async createAssemblyWorkOrder(
    @Args('input') input: CreateAssemblyWorkOrderInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<AssemblyWorkOrderType> {
    return this.kittingAssemblyService.createAssemblyWorkOrderFromResolver(tenantId, input, user.id) as any;
  }

  @Mutation(() => AssemblyWorkOrderType, { name: 'updateAssemblyWorkOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:update')
  @RequireAssemblyPermission('manage')
  @AuditAssemblyOperation('update_work_order')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async updateAssemblyWorkOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAssemblyWorkOrderInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<AssemblyWorkOrderType> {
    return this.kittingAssemblyService.updateAssemblyWorkOrderFromResolver(tenantId, id, input, user.id) as any;
  }

  @Mutation(() => Boolean, { name: 'deleteAssemblyWorkOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:delete')
  @RequireAssemblyPermission('admin')
  @AuditAssemblyOperation('delete_work_order')
  @MonitorAssemblyPerformance()
  async deleteAssemblyWorkOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.kittingAssemblyService.deleteAssemblyWorkOrder(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => AssemblyWorkOrderType, { name: 'startAssemblyWorkOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:start')
  @RequireAssemblyPermission('assemble')
  @AuditAssemblyOperation('start_work_order')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async startAssemblyWorkOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<AssemblyWorkOrderType> {
    return this.kittingAssemblyService.startAssemblyWorkOrder(tenantId, id, user.id);
  }

  @Mutation(() => AssemblyWorkOrderType, { name: 'completeAssemblyWorkOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:complete')
  @RequireAssemblyPermission('assemble')
  @AuditAssemblyOperation('complete_work_order')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async completeAssemblyWorkOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<AssemblyWorkOrderType> {
    return this.kittingAssemblyService.completeAssemblyWorkOrder(tenantId, id, user.id);
  }

  @Mutation(() => AssemblyWorkOrderType, { name: 'cancelAssemblyWorkOrder', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:cancel')
  @RequireAssemblyPermission('manage')
  @AuditAssemblyOperation('cancel_work_order')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async cancelAssemblyWorkOrder(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { nullable: true }) reason?: string,
    @CurrentTenant() tenantId?: string,
    @CurrentUser() user?: any,
  ): Promise<AssemblyWorkOrderType | null> {
    return this.kittingAssemblyService.cancelAssemblyWorkOrder(tenantId || '', id, user?.id, reason) as any;
  }

  @Mutation(() => AssemblyWorkOrderType, { name: 'allocateComponents' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:allocate')
  @RequireAssemblyPermission('assemble')
  @AuditAssemblyOperation('allocate_components')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async allocateComponents(
    @Args('workOrderId', { type: () => ID }) workOrderId: string,
    @Args('components', { type: () => [AllocateComponentInput] }) components: AllocateComponentInput[],
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<AssemblyWorkOrderType> {
    return this.kittingAssemblyService.allocateComponentsFromResolver(tenantId, workOrderId, components, user.id);
  }

  @Mutation(() => AssemblyWorkOrderType, { name: 'consumeComponents' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:consume')
  @RequireAssemblyPermission('assemble')
  @AuditAssemblyOperation('consume_components')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async consumeComponents(
    @Args('workOrderId', { type: () => ID }) workOrderId: string,
    @Args('components', { type: () => [AllocateComponentInput] }) components: AllocateComponentInput[],
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<AssemblyWorkOrderType> {
    const result = await this.kittingAssemblyService.consumeComponentsFromResolver(tenantId, workOrderId, components, user.id);
    return (result || {}) as any as AssemblyWorkOrderType;
  }

  @Mutation(() => AssemblyWorkOrderType, { name: 'recordQualityCheck' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:quality')
  @RequireAssemblyPermission('assemble')
  @AuditAssemblyOperation('record_quality_check')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async recordQualityCheck(
    @Args('workOrderId', { type: () => ID }) workOrderId: string,
    @Args('qualityCheck') qualityCheck: RecordQualityCheckInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<AssemblyWorkOrderType> {
    return this.kittingAssemblyService.recordQualityCheck(tenantId, workOrderId, qualityCheck, user.id);
  }

  @Mutation(() => AssemblyWorkOrderType, { name: 'assignAssembler' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:assign')
  @RequireAssemblyPermission('manage')
  @AuditAssemblyOperation('assign_assembler')
  @EnableAssemblyUpdates()
  async assignAssembler(
    @Args('workOrderId', { type: () => ID }) workOrderId: string,
    @Args('assemblerId', { type: () => ID }) assemblerId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<AssemblyWorkOrderType> {
    return this.kittingAssemblyService.assignAssembler(tenantId, workOrderId, assemblerId, user.id);
  }

  @Mutation(() => Boolean, { name: 'disassembleKit' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:disassemble')
  @RequireAssemblyPermission('manage')
  @AuditAssemblyOperation('disassemble_kit')
  @MonitorAssemblyPerformance()
  @EnableAssemblyUpdates()
  async disassembleKit(
    @Args('kitId', { type: () => ID }) kitId: string,
    @Args('quantity', { type: () => Number }) quantity: number,
    @Args('reason') reason: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.kittingAssemblyService.disassembleKit(tenantId, kitId, quantity, reason, user.id);
    return true;
  }

  // Field Resolvers for Kit Definition
  @ResolveField(() => AssemblyMetricsType, { name: 'metrics' })
  async resolveKitMetrics(
    @Parent() kit: KitDefinitionType,
    @CurrentTenant() tenantId: string,
  ): Promise<AssemblyMetricsType> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.kittingAssemblyService.getAssemblyMetrics(tenantId, kit.id, {
      from: thirtyDaysAgo,
      to: now,
    });
  }

  @ResolveField(() => [AssemblyWorkOrderType], { name: 'workOrders' })
  async resolveKitWorkOrders(
    @Parent() kit: KitDefinitionType,
    @Args() paginationArgs: PaginationArgs,
    @CurrentTenant() tenantId: string,
  ): Promise<AssemblyWorkOrderType[]> {
    return this.kittingAssemblyService.getAssemblyWorkOrdersByKit(tenantId, kit.id, paginationArgs);
  }

  @ResolveField(() => Number, { name: 'totalCost' })
  resolveTotalCost(@Parent() kit: KitDefinitionType): number {
    if (kit.costCalculation === 'fixed_price' && kit.fixedPrice) {
      return kit.fixedPrice;
    }
    
    // Calculate sum of parts cost (would need product pricing service)
    let totalCost = 0;
    if (kit.components) {
      // This would typically fetch product costs and calculate
      totalCost = kit.components.reduce((sum, component) => {
        // Placeholder calculation - would need actual product costs
        return sum + (component.quantity * 10); // Assuming $10 per component
      }, 0);
    }
    
    if (kit.costCalculation === 'markup_percentage' && kit.markup) {
      totalCost = totalCost * (1 + kit.markup / 100);
    }
    
    return totalCost;
  }

  // Field Resolvers for Assembly Work Order
  @ResolveField(() => KitDefinitionType, { name: 'kit' })
  async resolveWorkOrderKit(
    @Parent() workOrder: AssemblyWorkOrderType,
    @CurrentTenant() tenantId: string,
  ): Promise<KitDefinitionType> {
    return this.dataLoaderService.getLoader(
      'kitDefinitions',
      (kitIds: readonly string[]) => this.kittingAssemblyService.getKitDefinitionsByIds(tenantId, Array.from(kitIds)),
    ).load(workOrder.kitId);
  }

  @ResolveField(() => WarehouseType, { name: 'warehouse' })
  async resolveWorkOrderWarehouse(
    @Parent() workOrder: AssemblyWorkOrderType,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseType> {
    return this.dataLoaderService.getLoader(
      'warehouses',
      (warehouseIds: readonly string[]) => this.warehouseService.getWarehousesByIds(Array.from(warehouseIds) as string[], tenantId),
    ).load(workOrder.warehouseId);
  }

  @ResolveField(() => EmployeeType, { name: 'assembler', nullable: true })
  async resolveAssembler(
    @Parent() workOrder: AssemblyWorkOrderType,
    @CurrentTenant() tenantId: string,
  ): Promise<EmployeeType | null> {
    if (!workOrder.assignedTo) return null;
    
    return this.dataLoaderService.getLoader(
      'employees',
      (employeeIds: readonly string[]) => this.getEmployeesByIds(tenantId, Array.from(employeeIds)),
    ).load(workOrder.assignedTo);
  }

  @ResolveField(() => Number, { name: 'completionPercentage' })
  resolveCompletionPercentage(@Parent() workOrder: AssemblyWorkOrderType): number {
    if (!workOrder.components || workOrder.components.length === 0) return 0;
    
    const completedComponents = workOrder.components.filter(c => c.status === 'consumed').length;
    return (completedComponents / workOrder.components.length) * 100;
  }

  @ResolveField(() => Boolean, { name: 'hasComponentShortage' })
  resolveHasComponentShortage(@Parent() workOrder: AssemblyWorkOrderType): boolean {
    if (!workOrder.components) return false;
    return workOrder.components.some(c => c.status === 'shortage');
  }

  @ResolveField(() => Boolean, { name: 'isOverdue' })
  resolveIsOverdue(@Parent() workOrder: AssemblyWorkOrderType): boolean {
    if (!workOrder.scheduledDate) return false;
    return new Date() > workOrder.scheduledDate && workOrder.status !== 'completed';
  }

  @ResolveField(() => Number, { name: 'estimatedCost' })
  async resolveEstimatedCost(
    @Parent() workOrder: AssemblyWorkOrderType,
    @CurrentTenant() tenantId: string,
  ): Promise<number> {
    const kit = await this.kittingAssemblyService.getKitDefinition(tenantId, workOrder.kitId);
    
    if (kit.costCalculation === 'fixed_price' && kit.fixedPrice) {
      return kit.fixedPrice * workOrder.quantityToAssemble;
    }
    
    // Calculate based on components (placeholder calculation)
    let unitCost = 0;
    if (kit.components) {
      unitCost = kit.components.reduce((sum: number, component: any) => {
        return sum + (component.quantity * 10); // Placeholder cost
      }, 0);
    }
    
    if (kit.costCalculation === 'markup_percentage' && kit.markup) {
      unitCost = unitCost * (1 + kit.markup / 100);
    }
    
    return unitCost * workOrder.quantityToAssemble;
  }

  // Subscriptions
  @Subscription(() => KitDefinitionType, { name: 'kitDefinitionUpdated' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  kitDefinitionUpdated(
    @Args('kitId', { type: () => ID }) kitId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`kit.definition.updated.${tenantId}.${kitId}`);
  }

  @Subscription(() => AssemblyWorkOrderType, { name: 'assemblyWorkOrderUpdated' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  assemblyWorkOrderUpdated(
    @Args('workOrderId', { type: () => ID }) workOrderId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator(`assembly.work_order.updated.${tenantId}.${workOrderId}`);
  }

  @Subscription(() => AssemblyWorkOrderType, { name: 'assemblyWorkOrderStatusChanged' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  assemblyWorkOrderStatusChanged(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = warehouseId 
      ? `assembly.work_order.status.changed.${tenantId}.${warehouseId}.*`
      : `assembly.work_order.status.changed.${tenantId}.*`;
    return this.pubSub.asyncIterator(pattern);
  }

  @Subscription(() => AssemblyWorkOrderType, { name: 'assemblyWorkOrderCompleted' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  assemblyWorkOrderCompleted(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = warehouseId 
      ? `assembly.work_order.completed.${tenantId}.${warehouseId}.*`
      : `assembly.work_order.completed.${tenantId}.*`;
    return this.pubSub.asyncIterator(pattern);
  }

  @Subscription(() => AssemblyWorkOrderType, { name: 'componentShortageDetected' })
  @UseGuards(PermissionsGuard)
  @Permissions('assembly:read')
  componentShortageDetected(
    @Args('warehouseId', { type: () => ID, nullable: true }) warehouseId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = warehouseId 
      ? `assembly.component.shortage.${tenantId}.${warehouseId}.*`
      : `assembly.component.shortage.${tenantId}.*`;
    return this.pubSub.asyncIterator(pattern);
  }

  // Helper methods
  private async getEmployeesByIds(tenantId: string, employeeIds: string[]): Promise<EmployeeType[]> {
    // This would typically call an employee service
    // For now, return empty array or implement based on your employee module
    return [];
  }
}