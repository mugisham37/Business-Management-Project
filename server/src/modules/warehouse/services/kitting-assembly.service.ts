import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';

// Kitting and Assembly DTOs and interfaces
export interface KitDefinition {
  kitId: string;
  kitSku: string;
  kitName: string;
  description?: string;
  kitType: 'simple' | 'complex' | 'configurable';
  isActive: boolean;
  components: KitComponent[];
  assemblyInstructions?: string;
  assemblyTime?: number; // in minutes
  skillLevel: 'basic' | 'intermediate' | 'advanced';
  qualityChecks?: QualityCheck[];
  packaging?: PackagingInfo;
  costCalculation: 'sum_of_parts' | 'fixed_price' | 'markup_percentage';
  markup?: number;
  fixedPrice?: number;
}

export interface KitComponent {
  componentId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitOfMeasure: string;
  isOptional: boolean;
  isSubstitutable: boolean;
  substitutes?: string[]; // Product IDs that can substitute
  position?: number; // Assembly order
  notes?: string;
}

export interface AssemblyWorkOrder {
  workOrderId: string;
  workOrderNumber: string;
  kitId: string;
  kitSku: string;
  quantityToAssemble: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledDate?: Date;
  startedDate?: Date;
  completedDate?: Date;
  assignedTo?: string; // User ID
  warehouseId: string;
  workStationId?: string;
  components: AssemblyComponent[];
  qualityResults?: QualityResult[];
  actualAssemblyTime?: number;
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

export interface AssemblyComponent {
  componentId: string;
  productId: string;
  sku: string;
  requiredQuantity: number;
  allocatedQuantity: number;
  consumedQuantity: number;
  lotNumbers?: string[];
  binLocations?: string[];
  status: 'pending' | 'allocated' | 'consumed' | 'shortage';
  shortageQuantity?: number;
  substitutedWith?: string; // Product ID if substituted
}

export interface QualityCheck {
  checkId: string;
  checkName: string;
  checkType: 'visual' | 'measurement' | 'functional' | 'safety';
  description: string;
  isRequired: boolean;
  acceptanceCriteria: string;
  tools?: string[];
}

export interface QualityResult {
  checkId: string;
  checkName: string;
  result: 'pass' | 'fail' | 'na';
  notes?: string;
  measuredValue?: number;
  checkedBy: string;
  checkedAt: Date;
}

export interface PackagingInfo {
  packageType: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  weight?: number;
  materials?: string[];
  instructions?: string;
}

export interface CreateKitDto {
  tenantId: string;
  kitSku: string;
  kitName: string;
  description?: string;
  kitType: 'simple' | 'complex' | 'configurable';
  components: Array<{
    productId: string;
    quantity: number;
    unitOfMeasure: string;
    isOptional?: boolean;
    isSubstitutable?: boolean;
    substitutes?: string[];
    position?: number;
    notes?: string;
  }>;
  assemblyInstructions?: string;
  assemblyTime?: number;
  skillLevel?: 'basic' | 'intermediate' | 'advanced';
  qualityChecks?: Array<{
    checkName: string;
    checkType: 'visual' | 'measurement' | 'functional' | 'safety';
    description: string;
    isRequired: boolean;
    acceptanceCriteria: string;
    tools?: string[];
  }>;
  packaging?: PackagingInfo;
  costCalculation: 'sum_of_parts' | 'fixed_price' | 'markup_percentage';
  markup?: number;
  fixedPrice?: number;
  userId: string;
}

export interface CreateAssemblyWorkOrderDto {
  tenantId: string;
  kitId: string;
  quantityToAssemble: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledDate?: Date;
  assignedTo?: string;
  warehouseId: string;
  workStationId?: string;
  notes?: string;
  userId: string;
}

export interface UpdateAssemblyWorkOrderDto {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledDate?: Date;
  assignedTo?: string;
  workStationId?: string;
  notes?: string;
  userId: string;
}

// Domain Events
export class KitCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly kitId: string,
    public readonly kitSku: string,
    public readonly kitName: string,
    public readonly componentCount: number,
    public readonly userId: string,
  ) {}
}

export class AssemblyWorkOrderCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly workOrderId: string,
    public readonly kitId: string,
    public readonly quantityToAssemble: number,
    public readonly warehouseId: string,
    public readonly userId: string,
  ) {}
}

export class AssemblyCompletedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly workOrderId: string,
    public readonly kitId: string,
    public readonly quantityCompleted: number,
    public readonly actualAssemblyTime: number,
    public readonly completedBy: string,
  ) {}
}

export class ComponentShortageEvent {
  constructor(
    public readonly tenantId: string,
    public readonly workOrderId: string,
    public readonly componentId: string,
    public readonly productId: string,
    public readonly shortageQuantity: number,
  ) {}
}

@Injectable()
export class KittingAssemblyService {
  private readonly logger = new Logger(KittingAssemblyService.name);

  constructor(
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createKit(tenantId: string, data: CreateKitDto): Promise<KitDefinition> {
    // Validate kit SKU uniqueness
    const existingKit = await this.getKitBySku(tenantId, data.kitSku);
    if (existingKit) {
      throw new ConflictException(`Kit SKU ${data.kitSku} already exists`);
    }

    // Validate components exist (this would check against product database)
    for (const component of data.components) {
      // In real implementation, validate product exists
      if (!component.productId) {
        throw new BadRequestException(`Invalid product ID for component`);
      }
    }

    const kitId = this.generateKitId();
    
    // Build kit components
    const components: KitComponent[] = data.components.map((comp, index) => ({
      componentId: this.generateComponentId(),
      productId: comp.productId,
      sku: '', // This would be fetched from product service
      name: '', // This would be fetched from product service
      quantity: comp.quantity,
      unitOfMeasure: comp.unitOfMeasure,
      isOptional: comp.isOptional || false,
      isSubstitutable: comp.isSubstitutable || false,
      substitutes: comp.substitutes || [],
      position: comp.position || index + 1,
      ...(comp.notes && { notes: comp.notes }),
    }));

    // Build quality checks
    const qualityChecks: QualityCheck[] = (data.qualityChecks || []).map(check => ({
      checkId: this.generateCheckId(),
      checkName: check.checkName,
      checkType: check.checkType,
      description: check.description,
      isRequired: check.isRequired,
      acceptanceCriteria: check.acceptanceCriteria,
      tools: check.tools || [],
    }));

    const kit: KitDefinition = {
      kitId,
      kitSku: data.kitSku,
      kitName: data.kitName,
      ...(data.description && { description: data.description }),
      kitType: data.kitType,
      isActive: true,
      components,
      ...(data.assemblyInstructions && { assemblyInstructions: data.assemblyInstructions }),
      ...(data.assemblyTime !== undefined && { assemblyTime: data.assemblyTime }),
      skillLevel: data.skillLevel || 'basic',
      qualityChecks,
      ...(data.packaging && { packaging: data.packaging }),
      ...(data.costCalculation && { costCalculation: data.costCalculation }),
      ...(data.markup !== undefined && { markup: data.markup }),
      ...(data.fixedPrice !== undefined && { fixedPrice: data.fixedPrice }),
    };

    // Store kit definition
    await this.storeKitDefinition(tenantId, kit);

    // Emit domain event
    this.eventEmitter.emit('kit.created', new KitCreatedEvent(
      tenantId,
      kitId,
      data.kitSku,
      data.kitName,
      components.length,
      data.userId,
    ));

    // Invalidate cache
    await this.invalidateKitCache(tenantId);

    return kit;
  }

  async updateKit(tenantId: string, kitId: string, data: Partial<CreateKitDto>): Promise<KitDefinition> {
    const kit = await this.getKit(tenantId, kitId);
    if (!kit) {
      throw new NotFoundException(`Kit ${kitId} not found`);
    }

    // Update kit definition
    const { qualityChecks: dataQualityChecks, components: dataComponents, ...restData } = data;
    
    const updatedComponents = dataComponents ? dataComponents.map((comp, index) => ({
      componentId: this.generateComponentId(),
      productId: comp.productId,
      sku: '', // This would be fetched from product service
      name: '', // This would be fetched from product service
      quantity: comp.quantity,
      unitOfMeasure: comp.unitOfMeasure,
      isOptional: comp.isOptional || false,
      isSubstitutable: comp.isSubstitutable || false,
      substitutes: comp.substitutes || [],
      position: comp.position || index + 1,
      ...(comp.notes && { notes: comp.notes }),
    })) : kit.components;

    const updatedQualityChecks: QualityCheck[] = dataQualityChecks !== undefined 
      ? dataQualityChecks.map(check => ({
          checkId: this.generateCheckId(),
          checkName: check.checkName,
          checkType: check.checkType,
          description: check.description,
          isRequired: check.isRequired,
          acceptanceCriteria: check.acceptanceCriteria,
          tools: check.tools || [],
        })) 
      : (kit.qualityChecks || []);
    
    const updatedKit: KitDefinition = {
      ...kit,
      ...Object.fromEntries(Object.entries(restData).filter(([_, v]) => v !== undefined)),
      components: updatedComponents,
      qualityChecks: updatedQualityChecks,
    };

    // Store updated kit
    await this.storeKitDefinition(tenantId, updatedKit);

    // Invalidate cache
    await this.invalidateKitCache(tenantId, kitId);

    return updatedKit;
  }

  async getKit(tenantId: string, kitId: string): Promise<KitDefinition | null> {
    const cacheKey = `kit:${tenantId}:${kitId}`;
    
    let kit = await this.cacheService.get<KitDefinition>(cacheKey);
    if (kit) {
      return kit;
    }

    // This would query the database for the kit
    // For now, returning null as placeholder
    kit = null;

    if (kit) {
      await this.cacheService.set(cacheKey, kit, { ttl: 3600, tenantId }); // 1 hour
    }

    return kit;
  }

  async getKitBySku(tenantId: string, kitSku: string): Promise<KitDefinition | null> {
    const cacheKey = `kit:${tenantId}:sku:${kitSku}`;
    
    let kit = await this.cacheService.get<KitDefinition>(cacheKey);
    if (kit) {
      return kit;
    }

    // This would query the database for the kit by SKU
    // For now, returning null as placeholder
    kit = null;

    if (kit) {
      await this.cacheService.set(cacheKey, kit, { ttl: 3600, tenantId }); // 1 hour
    }

    return kit;
  }

  async getKits(tenantId: string, options: {
    kitType?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    kits: KitDefinition[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `kits:${tenantId}:${JSON.stringify(options)}`;
    
    let result = await this.cacheService.get<{ kits: KitDefinition[]; total: number; page: number; limit: number; totalPages: number; }>(cacheKey);
    if (result) {
      return result;
    }

    // This would query the database for kits
    // For now, returning empty result as placeholder
    result = {
      kits: [],
      total: 0,
      page: options.page || 1,
      limit: options.limit || 20,
      totalPages: 0,
    };

    await this.cacheService.set(cacheKey, result, { ttl: 1800, tenantId }); // 30 minutes

    return result;
  }

  async createAssemblyWorkOrder(tenantId: string, data: CreateAssemblyWorkOrderDto): Promise<AssemblyWorkOrder> {
    // Get kit definition
    const kit = await this.getKit(tenantId, data.kitId);
    if (!kit) {
      throw new NotFoundException(`Kit ${data.kitId} not found`);
    }

    if (!kit.isActive) {
      throw new BadRequestException(`Kit ${kit.kitSku} is not active`);
    }

    const workOrderId = this.generateWorkOrderId();
    const workOrderNumber = this.generateWorkOrderNumber();

    // Check component availability
    const components: AssemblyComponent[] = [];
    for (const kitComponent of kit.components) {
      const requiredQuantity = kitComponent.quantity * data.quantityToAssemble;
      
      // This would check actual inventory availability
      const availableQuantity = await this.checkComponentAvailability(
        tenantId,
        kitComponent.productId,
        data.warehouseId,
        requiredQuantity,
      );

      const component: AssemblyComponent = {
        componentId: kitComponent.componentId,
        productId: kitComponent.productId,
        sku: kitComponent.sku,
        requiredQuantity,
        allocatedQuantity: Math.min(availableQuantity, requiredQuantity),
        consumedQuantity: 0,
        status: availableQuantity >= requiredQuantity ? 'pending' : 'shortage',
        shortageQuantity: Math.max(0, requiredQuantity - availableQuantity),
      };

      components.push(component);
    }

    const workOrder: AssemblyWorkOrder = {
      workOrderId,
      workOrderNumber,
      kitId: data.kitId,
      kitSku: kit.kitSku,
      quantityToAssemble: data.quantityToAssemble,
      status: 'pending',
      priority: data.priority || 'normal',
      ...(data.scheduledDate && { scheduledDate: data.scheduledDate }),
      ...(data.assignedTo && { assignedTo: data.assignedTo }),
      warehouseId: data.warehouseId,
      ...(data.workStationId && { workStationId: data.workStationId }),
      components,
      ...(data.notes && { notes: data.notes }),
      createdBy: data.userId,
      createdAt: new Date(),
    };

    // Store work order
    await this.storeAssemblyWorkOrder(tenantId, workOrder);

    // Emit domain event
    this.eventEmitter.emit('assembly.work-order.created', new AssemblyWorkOrderCreatedEvent(
      tenantId,
      workOrderId,
      data.kitId,
      data.quantityToAssemble,
      data.warehouseId,
      data.userId,
    ));

    // Check for component shortages
    const shortageComponents = components.filter(c => c.status === 'shortage');
    for (const component of shortageComponents) {
      this.eventEmitter.emit('assembly.component.shortage', new ComponentShortageEvent(
        tenantId,
        workOrderId,
        component.componentId,
        component.productId,
        component.shortageQuantity!,
      ));
    }

    // Queue component allocation if no shortages
    if (shortageComponents.length === 0) {
      await this.queueService.add('allocate-assembly-components', {
        tenantId,
        workOrderId,
      });
    }

    return workOrder;
  }

  async updateAssemblyWorkOrder(tenantId: string, workOrderId: string, data: UpdateAssemblyWorkOrderDto): Promise<AssemblyWorkOrder> {
    const workOrder = await this.getAssemblyWorkOrder(tenantId, workOrderId);
    if (!workOrder) {
      throw new NotFoundException(`Work order ${workOrderId} not found`);
    }

    // Update work order
    const updatedWorkOrder: AssemblyWorkOrder = {
      ...workOrder,
      ...data,
    };

    // Handle status changes
    if (data.status && data.status !== workOrder.status) {
      switch (data.status) {
        case 'in_progress':
          updatedWorkOrder.startedDate = new Date();
          break;
        case 'completed':
          updatedWorkOrder.completedDate = new Date();
          if (updatedWorkOrder.startedDate) {
            updatedWorkOrder.actualAssemblyTime = Math.round(
              (updatedWorkOrder.completedDate.getTime() - updatedWorkOrder.startedDate.getTime()) / (1000 * 60)
            );
          }
          break;
        case 'cancelled':
          // Release allocated components
          await this.releaseAllocatedComponents(tenantId, workOrderId);
          break;
      }
    }

    // Store updated work order
    await this.storeAssemblyWorkOrder(tenantId, updatedWorkOrder);

    // Emit completion event if completed
    if (data.status === 'completed') {
      this.eventEmitter.emit('assembly.completed', new AssemblyCompletedEvent(
        tenantId,
        workOrderId,
        workOrder.kitId,
        workOrder.quantityToAssemble,
        updatedWorkOrder.actualAssemblyTime || 0,
        data.userId,
      ));

      // Queue finished goods processing
      await this.queueService.add('process-finished-goods', {
        tenantId,
        workOrderId,
        kitId: workOrder.kitId,
        quantityCompleted: workOrder.quantityToAssemble,
      });
    }

    return updatedWorkOrder;
  }

  async getAssemblyWorkOrder(tenantId: string, workOrderId: string): Promise<AssemblyWorkOrder | null> {
    const cacheKey = `assembly-work-order:${tenantId}:${workOrderId}`;
    
    let workOrder = await this.cacheService.get<AssemblyWorkOrder>(cacheKey);
    if (workOrder) {
      return workOrder;
    }

    // This would query the database for the work order
    // For now, returning null as placeholder
    workOrder = null;

    if (workOrder) {
      await this.cacheService.set(cacheKey, workOrder, { ttl: 3600, tenantId }); // 1 hour
    }

    return workOrder;
  }

  async getAssemblyWorkOrders(tenantId: string, options: {
    warehouseId?: string;
    status?: string;
    assignedTo?: string;
    kitId?: string;
    priority?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    workOrders: AssemblyWorkOrder[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `assembly-work-orders:${tenantId}:${JSON.stringify(options)}`;
    
    let result = await this.cacheService.get<{ workOrders: AssemblyWorkOrder[]; total: number; page: number; limit: number; totalPages: number; }>(cacheKey);
    if (result) {
      return result;
    }

    // This would query the database for work orders
    // For now, returning empty result as placeholder
    result = {
      workOrders: [],
      total: 0,
      page: options.page || 1,
      limit: options.limit || 20,
      totalPages: 0,
    };

    await this.cacheService.set(cacheKey, result, { ttl: 1800 }); // 30 minutes

    return result;
  }

  async allocateComponents(tenantId: string, workOrderId: string): Promise<{
    success: boolean;
    allocatedComponents: string[];
    shortageComponents: string[];
  }> {
    const workOrder = await this.getAssemblyWorkOrder(tenantId, workOrderId);
    if (!workOrder) {
      throw new NotFoundException(`Work order ${workOrderId} not found`);
    }

    const allocatedComponents = [];
    const shortageComponents = [];

    for (const component of workOrder.components) {
      if (component.status === 'pending') {
        // This would perform actual inventory allocation
        const allocated = await this.allocateComponentInventory(
          tenantId,
          component.productId,
          workOrder.warehouseId,
          component.requiredQuantity,
        );

        if (allocated.success) {
          component.allocatedQuantity = component.requiredQuantity;
          component.status = 'allocated';
          if (allocated.lotNumbers) component.lotNumbers = allocated.lotNumbers;
          if (allocated.binLocations) component.binLocations = allocated.binLocations;
          allocatedComponents.push(component.componentId);
        } else {
          component.status = 'shortage';
          component.shortageQuantity = component.requiredQuantity - allocated.allocatedQuantity;
          shortageComponents.push(component.componentId);
        }
      }
    }

    // Update work order with allocation results
    await this.storeAssemblyWorkOrder(tenantId, workOrder);

    return {
      success: shortageComponents.length === 0,
      allocatedComponents,
      shortageComponents,
    };
  }

  async consumeComponents(tenantId: string, workOrderId: string, consumptionData: Array<{
    componentId: string;
    quantityConsumed: number;
    lotNumbers?: string[];
    notes?: string;
  }>): Promise<void> {
    const workOrder = await this.getAssemblyWorkOrder(tenantId, workOrderId);
    if (!workOrder) {
      throw new NotFoundException(`Work order ${workOrderId} not found`);
    }

    for (const consumption of consumptionData) {
      const component = workOrder.components.find(c => c.componentId === consumption.componentId);
      if (!component) {
        throw new NotFoundException(`Component ${consumption.componentId} not found in work order`);
      }

      if (consumption.quantityConsumed > component.allocatedQuantity) {
        throw new BadRequestException(`Cannot consume more than allocated quantity for component ${consumption.componentId}`);
      }

      // Update component consumption
      component.consumedQuantity += consumption.quantityConsumed;
      component.status = component.consumedQuantity >= component.requiredQuantity ? 'consumed' : 'allocated';

      // This would update actual inventory levels
      await this.consumeComponentInventory(
        tenantId,
        component.productId,
        workOrder.warehouseId,
        consumption.quantityConsumed,
        consumption.lotNumbers,
      );
    }

    // Update work order
    await this.storeAssemblyWorkOrder(tenantId, workOrder);
  }

  async recordQualityResults(tenantId: string, workOrderId: string, qualityResults: QualityResult[]): Promise<void> {
    const workOrder = await this.getAssemblyWorkOrder(tenantId, workOrderId);
    if (!workOrder) {
      throw new NotFoundException(`Work order ${workOrderId} not found`);
    }

    // Update quality results
    workOrder.qualityResults = qualityResults;

    // Check if all required quality checks passed
    const kit = await this.getKit(tenantId, workOrder.kitId);
    if (kit?.qualityChecks) {
      const requiredChecks = kit.qualityChecks.filter(check => check.isRequired);
      const passedRequiredChecks = qualityResults.filter(result => 
        requiredChecks.some(check => check.checkId === result.checkId) && result.result === 'pass'
      );

      if (passedRequiredChecks.length < requiredChecks.length) {
        // Quality check failed, put work order on hold
        workOrder.status = 'on_hold';
        workOrder.notes = (workOrder.notes || '') + '\nQuality check failed - requires review';
      }
    }

    // Store updated work order
    await this.storeAssemblyWorkOrder(tenantId, workOrder);
  }

  async getKitCostAnalysis(tenantId: string, kitId: string): Promise<{
    kit: KitDefinition;
    componentCosts: Array<{
      componentId: string;
      productId: string;
      sku: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
    }>;
    totalComponentCost: number;
    laborCost: number;
    overheadCost: number;
    totalKitCost: number;
    suggestedSellingPrice: number;
    profitMargin: number;
  }> {
    const kit = await this.getKit(tenantId, kitId);
    if (!kit) {
      throw new NotFoundException(`Kit ${kitId} not found`);
    }

    // This would fetch actual component costs from product/inventory service
    const componentCosts = kit.components.map(component => ({
      componentId: component.componentId,
      productId: component.productId,
      sku: component.sku,
      quantity: component.quantity,
      unitCost: 10.00, // Mock cost - would be fetched from product service
      totalCost: component.quantity * 10.00,
    }));

    const totalComponentCost = componentCosts.reduce((sum, comp) => sum + comp.totalCost, 0);
    const laborCost = (kit.assemblyTime || 0) * 0.5; // $0.50 per minute - would be configurable
    const overheadCost = totalComponentCost * 0.1; // 10% overhead - would be configurable
    const totalKitCost = totalComponentCost + laborCost + overheadCost;

    let suggestedSellingPrice = totalKitCost;
    let profitMargin = 0;

    switch (kit.costCalculation) {
      case 'fixed_price':
        suggestedSellingPrice = kit.fixedPrice || totalKitCost;
        break;
      case 'markup_percentage':
        suggestedSellingPrice = totalKitCost * (1 + (kit.markup || 0) / 100);
        break;
      case 'sum_of_parts':
      default:
        suggestedSellingPrice = totalKitCost * 1.2; // 20% default markup
        break;
    }

    profitMargin = ((suggestedSellingPrice - totalKitCost) / suggestedSellingPrice) * 100;

    return {
      kit,
      componentCosts,
      totalComponentCost,
      laborCost,
      overheadCost,
      totalKitCost,
      suggestedSellingPrice,
      profitMargin,
    };
  }

  async getAssemblyMetrics(tenantId: string, warehouseId: string, dateRange: {
    from: Date;
    to: Date;
  }): Promise<{
    totalWorkOrders: number;
    completedWorkOrders: number;
    averageAssemblyTime: number;
    onTimeCompletionRate: number;
    qualityPassRate: number;
    componentShortageRate: number;
    topKitsByVolume: Array<{
      kitId: string;
      kitSku: string;
      kitName: string;
      quantityAssembled: number;
      averageTime: number;
    }>;
    productivityByWorker: Array<{
      workerId: string;
      workerName: string;
      workOrdersCompleted: number;
      averageTime: number;
      qualityScore: number;
    }>;
  }> {
    const cacheKey = `assembly-metrics:${tenantId}:${warehouseId}:${dateRange.from.getTime()}-${dateRange.to.getTime()}`;
    
    let metrics = await this.cacheService.get<any>(cacheKey);
    if (metrics) {
      return metrics;
    }

    // This would calculate metrics from database
    // For now, returning mock data structure
    metrics = {
      totalWorkOrders: 0,
      completedWorkOrders: 0,
      averageAssemblyTime: 0,
      onTimeCompletionRate: 0,
      qualityPassRate: 0,
      componentShortageRate: 0,
      topKitsByVolume: [],
      productivityByWorker: [],
    };

    await this.cacheService.set(cacheKey, metrics, { ttl: 3600 }); // 1 hour

    return metrics;
  }

  // Private helper methods
  private async checkComponentAvailability(tenantId: string, productId: string, warehouseId: string, requiredQuantity: number): Promise<number> {
    // This would check actual inventory availability
    // For now, returning mock availability
    return Math.floor(Math.random() * requiredQuantity * 2);
  }

  private async allocateComponentInventory(tenantId: string, productId: string, warehouseId: string, quantity: number): Promise<{
    success: boolean;
    allocatedQuantity: number;
    lotNumbers?: string[];
    binLocations?: string[];
  }> {
    // This would perform actual inventory allocation
    // For now, returning mock allocation
    return {
      success: true,
      allocatedQuantity: quantity,
      lotNumbers: [`LOT-${Date.now()}`],
      binLocations: [`BIN-${Math.random().toString(36).substring(2, 8)}`],
    };
  }

  private async consumeComponentInventory(tenantId: string, productId: string, warehouseId: string, quantity: number, lotNumbers?: string[]): Promise<void> {
    // This would update actual inventory levels
    // For now, just logging the consumption
    this.logger.log(`Consumed ${quantity} units of product ${productId} from warehouse ${warehouseId}`);
  }

  private async releaseAllocatedComponents(tenantId: string, workOrderId: string): Promise<void> {
    // This would release allocated inventory back to available stock
    // For now, just logging the release
    this.logger.log(`Released allocated components for work order ${workOrderId}`);
  }

  private async storeKitDefinition(tenantId: string, kit: KitDefinition): Promise<void> {
    const cacheKey = `kit:${tenantId}:${kit.kitId}`;
    await this.cacheService.set(cacheKey, kit, { ttl: 3600 }); // 1 hour
    
    const skuCacheKey = `kit:${tenantId}:sku:${kit.kitSku}`;
    await this.cacheService.set(skuCacheKey, kit, { ttl: 3600 }); // 1 hour
    
    // This would also store in database
  }

  private async storeAssemblyWorkOrder(tenantId: string, workOrder: AssemblyWorkOrder): Promise<void> {
    const cacheKey = `assembly-work-order:${tenantId}:${workOrder.workOrderId}`;
    await this.cacheService.set(cacheKey, workOrder, { ttl: 3600 }); // 1 hour
    
    // This would also store in database
  }

  private generateKitId(): string {
    return `KIT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
  }

  private generateComponentId(): string {
    return `COMP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
  }

  private generateCheckId(): string {
    return `CHK-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
  }

  private generateWorkOrderId(): string {
    return `WO-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
  }

  private generateWorkOrderNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `WO${dateStr}${sequence}`;
  }

  private async invalidateKitCache(tenantId: string, kitId?: string): Promise<void> {
    if (kitId) {
      await this.cacheService.invalidatePattern(`kit:${tenantId}:${kitId}*`);
    }
    await this.cacheService.invalidatePattern(`kits:${tenantId}:*`);
  }

  // Background job processors
  async processFinishedGoods(data: { tenantId: string; workOrderId: string; kitId: string; quantityCompleted: number }): Promise<void> {
    this.logger.log(`Processing finished goods for work order: ${data.workOrderId}`);
    
    // This would:
    // 1. Create finished goods inventory entries
    // 2. Update kit inventory levels
    // 3. Generate production reports
    // 4. Update cost accounting
  }

  async processComponentAllocation(data: { tenantId: string; workOrderId: string }): Promise<void> {
    this.logger.log(`Processing component allocation for work order: ${data.workOrderId}`);
    
    const result = await this.allocateComponents(data.tenantId, data.workOrderId);
    
    if (!result.success) {
      // Send shortage notifications
      this.logger.warn(`Component shortages detected for work order: ${data.workOrderId}`);
    }
  }
}