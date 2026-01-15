import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { WarehouseZoneRepository } from '../repositories/warehouse-zone.repository';
import { BinLocationRepository } from '../repositories/bin-location.repository';
import { 
  CreateWarehouseDto, 
  UpdateWarehouseDto, 
  WarehouseQueryDto,
  WarehouseCapacityDto,
  WarehouseZoneType
} from '../dto/warehouse.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';

// Domain events
export class WarehouseCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly warehouseCode: string,
    public readonly locationId: string,
    public readonly userId: string,
  ) {}
}

export class WarehouseCapacityChangedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly previousCapacity: number,
    public readonly newCapacity: number,
    public readonly changeReason: string,
    public readonly userId: string,
  ) {}
}

export class WarehouseStatusChangedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly previousStatus: string,
    public readonly newStatus: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class WarehouseService {
  constructor(
    private readonly warehouseRepository: WarehouseRepository,
    private readonly zoneRepository: WarehouseZoneRepository,
    private readonly binLocationRepository: BinLocationRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createWarehouse(tenantId: string, data: CreateWarehouseDto, userId: string): Promise<any> {
    const warehouse = await this.warehouseRepository.create(tenantId, data, userId);

    // Emit domain event
    this.eventEmitter.emit('warehouse.created', new WarehouseCreatedEvent(
      tenantId,
      warehouse.id,
      warehouse.warehouseCode,
      warehouse.locationId,
      userId,
    ));

    // Queue initialization tasks
    await this.queueService.add('initialize-warehouse', {
      tenantId,
      warehouseId: warehouse.id,
      userId,
    });

    // Invalidate cache
    await this.invalidateWarehouseCache(tenantId);

    return warehouse;
  }

  async getWarehouse(tenantId: string, id: string): Promise<any> {
    const cacheKey = `warehouse:${tenantId}:${id}`;
    let warehouse = await this.cacheService.get(cacheKey);

    if (!warehouse) {
      warehouse = await this.warehouseRepository.findById(tenantId, id);
      await this.cacheService.set(cacheKey, warehouse, { ttl: 300 }); // 5 minutes
    }

    return warehouse;
  }

  async getWarehouseByCode(tenantId: string, warehouseCode: string): Promise<any> {
    const cacheKey = `warehouse:${tenantId}:code:${warehouseCode}`;
    let warehouse = await this.cacheService.get(cacheKey);

    if (!warehouse) {
      warehouse = await this.warehouseRepository.findByCode(tenantId, warehouseCode);
      await this.cacheService.set(cacheKey, warehouse, { ttl: 300 }); // 5 minutes
    }

    return warehouse;
  }

  async getWarehouses(tenantId: string, query: WarehouseQueryDto): Promise<{
    warehouses: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `warehouses:${tenantId}:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{ warehouses: any[]; total: number; page: number; limit: number; totalPages: number; }>(cacheKey);

    if (!result) {
      result = await this.warehouseRepository.findMany(tenantId, query);
      await this.cacheService.set(cacheKey, result, { ttl: 180 }); // 3 minutes
    }

    return result;
  }

  async updateWarehouse(tenantId: string, id: string, data: UpdateWarehouseDto, userId: string): Promise<any> {
    const currentWarehouse = await this.getWarehouse(tenantId, id);
    const updatedWarehouse = await this.warehouseRepository.update(tenantId, id, data, userId);

    // Check if status changed
    if (data.status && data.status !== currentWarehouse.status) {
      this.eventEmitter.emit('warehouse.status.changed', new WarehouseStatusChangedEvent(
        tenantId,
        id,
        currentWarehouse.status,
        data.status,
        userId,
      ));
    }

    // Invalidate cache
    await this.invalidateWarehouseCache(tenantId, id);

    return updatedWarehouse;
  }

  async deleteWarehouse(tenantId: string, id: string, userId: string): Promise<void> {
    // Check if warehouse has zones
    const zones = await this.zoneRepository.findByWarehouse(tenantId, id);
    if (zones.length > 0) {
      throw new ConflictException('Cannot delete warehouse with existing zones');
    }

    await this.warehouseRepository.delete(tenantId, id, userId);

    // Invalidate cache
    await this.invalidateWarehouseCache(tenantId, id);
  }

  async getWarehouseCapacity(tenantId: string, warehouseId: string): Promise<WarehouseCapacityDto> {
    const cacheKey = `warehouse:${tenantId}:${warehouseId}:capacity`;
    let capacity = await this.cacheService.get<WarehouseCapacityDto>(cacheKey);

    if (!capacity) {
      capacity = await this.warehouseRepository.getCapacity(tenantId, warehouseId);
      await this.cacheService.set(cacheKey, capacity, { ttl: 120 }); // 2 minutes
    }

    return capacity;
  }

  async updateWarehouseCapacity(
    tenantId: string, 
    warehouseId: string, 
    capacityChange: number, 
    reason: string,
    userId: string
  ): Promise<void> {
    const currentCapacity = await this.getWarehouseCapacity(tenantId, warehouseId);
    const previousCapacity = currentCapacity.usedCapacity;

    await this.warehouseRepository.updateCapacity(tenantId, warehouseId, capacityChange, userId);

    // Emit domain event
    this.eventEmitter.emit('warehouse.capacity.changed', new WarehouseCapacityChangedEvent(
      tenantId,
      warehouseId,
      previousCapacity,
      previousCapacity + capacityChange,
      reason,
      userId,
    ));

    // Invalidate cache
    await this.invalidateWarehouseCache(tenantId, warehouseId);
  }

  async getWarehousesByLocation(tenantId: string, locationId: string): Promise<any> {
    const cacheKey = `warehouse:${tenantId}:location:${locationId}`;
    let warehouse = await this.cacheService.get(cacheKey);

    if (!warehouse) {
      warehouse = await this.warehouseRepository.findByLocationId(tenantId, locationId);
      if (warehouse) {
        await this.cacheService.set(cacheKey, warehouse, { ttl: 300 }); // 5 minutes
      }
    }

    return warehouse;
  }

  async getActiveWarehouses(tenantId: string): Promise<any[]> {
    const cacheKey = `warehouses:${tenantId}:active`;
    let warehouses = await this.cacheService.get<any[]>(cacheKey);

    if (!warehouses) {
      warehouses = await this.warehouseRepository.findActiveWarehouses(tenantId);
      await this.cacheService.set(cacheKey, warehouses, { ttl: 300 }); // 5 minutes
    }

    return warehouses;
  }

  async getWarehouseMetrics(tenantId: string, warehouseId: string): Promise<any> {
    const cacheKey = `warehouse:${tenantId}:${warehouseId}:metrics`;
    let metrics = await this.cacheService.get(cacheKey);

    if (!metrics) {
      metrics = await this.warehouseRepository.getWarehouseMetrics(tenantId, warehouseId);
      await this.cacheService.set(cacheKey, metrics, { ttl: 180 }); // 3 minutes
    }

    return metrics;
  }

  async initializeWarehouse(tenantId: string, warehouseId: string, userId: string): Promise<void> {
    const warehouse = await this.getWarehouse(tenantId, warehouseId);

    // Create default zones based on warehouse type
    const defaultZones = [
      {
        zoneCode: 'REC-01',
        name: 'Receiving Zone',
        zoneType: WarehouseZoneType.RECEIVING,
        priority: 1,
        description: 'Primary receiving area for incoming goods',
      },
      {
        zoneCode: 'STO-01',
        name: 'Storage Zone',
        zoneType: WarehouseZoneType.STORAGE,
        priority: 2,
        description: 'Main storage area for inventory',
      },
      {
        zoneCode: 'PIC-01',
        name: 'Picking Zone',
        zoneType: WarehouseZoneType.PICKING,
        priority: 3,
        description: 'Primary picking area for order fulfillment',
      },
      {
        zoneCode: 'PAC-01',
        name: 'Packing Zone',
        zoneType: WarehouseZoneType.PACKING,
        priority: 4,
        description: 'Order packing and preparation area',
      },
      {
        zoneCode: 'SHP-01',
        name: 'Shipping Zone',
        zoneType: WarehouseZoneType.SHIPPING,
        priority: 5,
        description: 'Outbound shipping area',
      },
    ];

    for (const zoneData of defaultZones) {
      try {
        await this.zoneRepository.create(tenantId, {
          ...zoneData,
          warehouseId: warehouse.id,
        }, userId);
      } catch (error: unknown) {
        // Zone might already exist, continue with next zone
        console.warn(`Failed to create zone ${zoneData.zoneCode}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Update warehouse bin location counts
    await this.warehouseRepository.updateBinLocationCounts(tenantId, warehouseId, userId);

    // Invalidate cache
    await this.invalidateWarehouseCache(tenantId, warehouseId);
  }

  async optimizeWarehouseLayout(tenantId: string, warehouseId: string, userId: string): Promise<any> {
    const warehouse = await this.getWarehouse(tenantId, warehouseId);
    const zones = await this.zoneRepository.findByWarehouse(tenantId, warehouseId);
    const binLocations = await this.binLocationRepository.findByWarehouse(tenantId, warehouseId);

    // This is a simplified optimization algorithm
    // In a real system, this would use sophisticated algorithms considering:
    // - Product velocity and ABC analysis
    // - Picking frequency and patterns
    // - Product compatibility and storage requirements
    // - Seasonal variations
    // - Equipment constraints

    const optimizationResults = {
      warehouseId,
      optimizationDate: new Date(),
      recommendations: [] as Array<{ type: string; priority: string; description: string; estimatedImpact?: string; }>,
      estimatedImprovements: {
        pickingTimeReduction: 0,
        spaceUtilizationImprovement: 0,
        laborEfficiencyGain: 0,
      },
    };

    // Analyze current layout efficiency
    const currentMetrics = await this.getWarehouseMetrics(tenantId, warehouseId);
    
    // Generate recommendations based on current state
    if (currentMetrics.capacity.utilizationPercentage > 90) {
      optimizationResults.recommendations.push({
        type: 'capacity_expansion',
        priority: 'high',
        description: 'Warehouse capacity is near maximum. Consider expanding or optimizing storage density.',
        estimatedImpact: 'High',
      });
    }

    if (currentMetrics.capacity.utilizationPercentage < 50) {
      optimizationResults.recommendations.push({
        type: 'space_consolidation',
        priority: 'medium',
        description: 'Low space utilization detected. Consider consolidating zones or repurposing areas.',
        estimatedImpact: 'Medium',
      });
    }

    // Check for picking sequence optimization opportunities
    const pickingZones = zones.filter(zone => zone.zoneType === 'picking');
    if (pickingZones.length > 0) {
      optimizationResults.recommendations.push({
        type: 'picking_optimization',
        priority: 'medium',
        description: 'Optimize bin location picking sequences to reduce travel time.',
        estimatedImpact: 'Medium',
      });
    }

    return optimizationResults;
  }

  async generateWarehouseReport(tenantId: string, warehouseId: string): Promise<any> {
    const warehouse = await this.getWarehouse(tenantId, warehouseId);
    const metrics = await this.getWarehouseMetrics(tenantId, warehouseId);
    const zones = await this.zoneRepository.findByWarehouse(tenantId, warehouseId);
    
    const report = {
      warehouse,
      generatedAt: new Date(),
      summary: {
        totalZones: zones.length,
        activeZones: zones.filter(z => z.status === 'active').length,
        totalBinLocations: metrics.capacity.totalBinLocations,
        occupiedBinLocations: metrics.capacity.occupiedBinLocations,
        capacityUtilization: metrics.capacity.utilizationPercentage,
      },
      zones: zones.map(zone => ({
        id: zone.id,
        code: zone.zoneCode,
        name: zone.name,
        type: zone.zoneType,
        status: zone.status,
        binLocations: zone.currentBinLocations,
        maxBinLocations: zone.maxBinLocations,
      })),
      performance: {
        pickingAccuracy: warehouse.pickingAccuracy || 0,
        averagePickTime: warehouse.averagePickTime || 0,
        throughputPerHour: warehouse.throughputPerHour || 0,
      },
      recommendations: await this.optimizeWarehouseLayout(tenantId, warehouseId, 'system'),
    };

    return report;
  }

  private async invalidateWarehouseCache(tenantId: string, warehouseId?: string): Promise<void> {
    if (warehouseId) {
      await this.cacheService.invalidatePattern(`warehouse:${tenantId}:${warehouseId}:*`);
    }
    await this.cacheService.invalidatePattern(`warehouse:${tenantId}:*`);
    await this.cacheService.invalidatePattern(`warehouses:${tenantId}:*`);
  }
}