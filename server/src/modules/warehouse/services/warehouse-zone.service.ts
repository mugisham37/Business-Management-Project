import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WarehouseZoneRepository } from '../repositories/warehouse-zone.repository';
import { BinLocationRepository } from '../repositories/bin-location.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { 
  CreateWarehouseZoneDto, 
  UpdateWarehouseZoneDto 
} from '../dto/warehouse.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

// Domain events
export class WarehouseZoneCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly zoneId: string,
    public readonly zoneCode: string,
    public readonly zoneType: string,
    public readonly userId: string,
  ) {}
}

export class WarehouseZoneCapacityChangedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly zoneId: string,
    public readonly warehouseId: string,
    public readonly previousCapacity: number,
    public readonly newCapacity: number,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class WarehouseZoneService {
  constructor(
    private readonly zoneRepository: WarehouseZoneRepository,
    private readonly binLocationRepository: BinLocationRepository,
    private readonly warehouseRepository: WarehouseRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createZone(tenantId: string, data: CreateWarehouseZoneDto, userId: string): Promise<any> {
    // Verify warehouse exists
    await this.warehouseRepository.findById(tenantId, data.warehouseId);

    const zone = await this.zoneRepository.create(tenantId, data, userId);

    // Emit domain event
    this.eventEmitter.emit('warehouse.zone.created', new WarehouseZoneCreatedEvent(
      tenantId,
      data.warehouseId,
      zone.id,
      zone.zoneCode,
      zone.zoneType,
      userId,
    ));

    // Invalidate cache
    await this.invalidateZoneCache(tenantId, data.warehouseId);

    return zone;
  }

  async getZone(tenantId: string, id: string): Promise<any> {
    const cacheKey = `zone:${tenantId}:${id}`;
    let zone = await this.cacheService.get(cacheKey);

    if (!zone) {
      zone = await this.zoneRepository.findById(tenantId, id);
      await this.cacheService.set(cacheKey, zone, { ttl: 300 }); // 5 minutes
    }

    return zone;
  }

  async getZoneByCode(tenantId: string, warehouseId: string, zoneCode: string): Promise<any> {
    const cacheKey = `zone:${tenantId}:${warehouseId}:code:${zoneCode}`;
    let zone = await this.cacheService.get(cacheKey);

    if (!zone) {
      zone = await this.zoneRepository.findByCode(tenantId, warehouseId, zoneCode);
      await this.cacheService.set(cacheKey, zone, { ttl: 300 }); // 5 minutes
    }

    return zone;
  }

  async getZonesByWarehouse(tenantId: string, warehouseId: string): Promise<any[]> {
    const cacheKey = `zones:${tenantId}:warehouse:${warehouseId}`;
    let zones = await this.cacheService.get<any[]>(cacheKey);

    if (!zones) {
      zones = await this.zoneRepository.findByWarehouse(tenantId, warehouseId);
      await this.cacheService.set(cacheKey, zones, { ttl: 300 }); // 5 minutes
    }

    return zones;
  }

  async getZonesByType(tenantId: string, warehouseId: string, zoneType: string): Promise<any[]> {
    const cacheKey = `zones:${tenantId}:warehouse:${warehouseId}:type:${zoneType}`;
    let zones = await this.cacheService.get<any[]>(cacheKey);

    if (!zones) {
      zones = await this.zoneRepository.findByType(tenantId, warehouseId, zoneType);
      await this.cacheService.set(cacheKey, zones, { ttl: 300 }); // 5 minutes
    }

    return zones;
  }

  async updateZone(tenantId: string, id: string, data: UpdateWarehouseZoneDto, userId: string): Promise<any> {
    const zone = await this.getZone(tenantId, id);
    const updatedZone = await this.zoneRepository.update(tenantId, id, data, userId);

    // Invalidate cache
    await this.invalidateZoneCache(tenantId, zone.warehouseId, id);

    return updatedZone;
  }

  async deleteZone(tenantId: string, id: string, userId: string): Promise<void> {
    const zone = await this.getZone(tenantId, id);
    
    await this.zoneRepository.delete(tenantId, id, userId);

    // Invalidate cache
    await this.invalidateZoneCache(tenantId, zone.warehouseId, id);
  }

  async getZoneCapacity(tenantId: string, zoneId: string): Promise<{
    maxBinLocations: number;
    currentBinLocations: number;
    availableBinLocations: number;
    utilizationPercentage: number;
  }> {
    const cacheKey = `zone:${tenantId}:${zoneId}:capacity`;
    let capacity = await this.cacheService.get<{ maxBinLocations: number; currentBinLocations: number; availableBinLocations: number; utilizationPercentage: number; }>(cacheKey);

    if (!capacity) {
      capacity = await this.zoneRepository.getZoneCapacity(tenantId, zoneId);
      await this.cacheService.set(cacheKey, capacity, { ttl: 120 }); // 2 minutes
    }

    return capacity;
  }

  async updateZoneBinLocationCount(tenantId: string, zoneId: string, userId: string): Promise<void> {
    const zone = await this.getZone(tenantId, zoneId);
    const previousCapacity = await this.getZoneCapacity(tenantId, zoneId);

    await this.zoneRepository.updateBinLocationCount(tenantId, zoneId, userId);

    const newCapacity = await this.zoneRepository.getZoneCapacity(tenantId, zoneId);

    // Emit domain event if capacity changed
    if (newCapacity.currentBinLocations !== previousCapacity.currentBinLocations) {
      this.eventEmitter.emit('warehouse.zone.capacity.changed', new WarehouseZoneCapacityChangedEvent(
        tenantId,
        zoneId,
        zone.warehouseId,
        previousCapacity.currentBinLocations,
        newCapacity.currentBinLocations,
        userId,
      ));
    }

    // Invalidate cache
    await this.invalidateZoneCache(tenantId, zone.warehouseId, zoneId);
  }

  async getAvailableZones(tenantId: string, warehouseId: string, zoneType?: string): Promise<any[]> {
    const cacheKey = `zones:${tenantId}:warehouse:${warehouseId}:available:${zoneType || 'all'}`;
    let zones = await this.cacheService.get<any[]>(cacheKey);

    if (!zones) {
      zones = await this.zoneRepository.findAvailableZones(tenantId, warehouseId, zoneType);
      await this.cacheService.set(cacheKey, zones, { ttl: 300 }); // 5 minutes
    }

    return zones;
  }

  async getZoneMetrics(tenantId: string, zoneId: string): Promise<any> {
    const cacheKey = `zone:${tenantId}:${zoneId}:metrics`;
    let metrics = await this.cacheService.get(cacheKey);

    if (!metrics) {
      metrics = await this.zoneRepository.getZoneMetrics(tenantId, zoneId);
      await this.cacheService.set(cacheKey, metrics, { ttl: 180 }); // 3 minutes
    }

    return metrics;
  }

  async optimizeZoneLayout(tenantId: string, zoneId: string, userId: string): Promise<any> {
    const zone = await this.getZone(tenantId, zoneId);
    const binLocations = await this.binLocationRepository.findByZone(tenantId, zoneId);
    const metrics = await this.getZoneMetrics(tenantId, zoneId);

    // Analyze current zone efficiency
    const optimizationResults = {
      zoneId,
      zoneCode: zone.zoneCode,
      zoneName: zone.name,
      zoneType: zone.zoneType,
      optimizationDate: new Date(),
      currentMetrics: metrics,
      recommendations: [] as Array<{ type: string; priority: string; description: string; action?: string; }>,
      estimatedImprovements: {
        spaceUtilization: 0,
        pickingEfficiency: 0,
        accessibilityImprovement: 0,
      },
    };

    // Generate recommendations based on zone type and current state
    if (zone.zoneType === 'picking') {
      // Optimize picking sequence
      const unsequencedBins = binLocations.filter(bin => !bin.pickingSequence);
      if (unsequencedBins.length > 0) {
        optimizationResults.recommendations.push({
          type: 'picking_sequence',
          priority: 'high',
          description: `${unsequencedBins.length} bin locations need picking sequence assignment`,
          action: 'Assign optimal picking sequences based on location and product velocity',
        });
      }

      // Check for picking route optimization
      if (binLocations.length > 10) {
        optimizationResults.recommendations.push({
          type: 'route_optimization',
          priority: 'medium',
          description: 'Optimize picking routes to minimize travel time',
          action: 'Reorganize bin locations based on picking frequency and proximity',
        });
      }
    }

    if (zone.zoneType === 'storage') {
      // Check space utilization
      const occupiedBins = binLocations.filter(bin => bin.status === 'occupied').length;
      const utilizationRate = binLocations.length > 0 ? (occupiedBins / binLocations.length) * 100 : 0;

      if (utilizationRate > 90) {
        optimizationResults.recommendations.push({
          type: 'capacity_expansion',
          priority: 'high',
          description: 'Storage zone is near capacity',
          action: 'Consider expanding zone or implementing vertical storage solutions',
        });
      } else if (utilizationRate < 50) {
        optimizationResults.recommendations.push({
          type: 'space_consolidation',
          priority: 'medium',
          description: 'Low space utilization in storage zone',
          action: 'Consider consolidating storage or repurposing excess space',
        });
      }
    }

    // Check for product compatibility issues
    const mixedProductBins = binLocations.filter(bin => 
      bin.assignedProductId && !bin.dedicatedProduct && zone.allowMixedProducts
    );
    
    if (mixedProductBins.length > 0 && !zone.allowMixedProducts) {
      optimizationResults.recommendations.push({
        type: 'product_segregation',
        priority: 'medium',
        description: 'Mixed products detected in zone that doesn\'t allow mixing',
        action: 'Segregate products or update zone configuration',
      });
    }

    return optimizationResults;
  }

  async findZonesByCoordinates(
    tenantId: string, 
    warehouseId: string, 
    x: number, 
    y: number, 
    radius: number = 10
  ): Promise<any[]> {
    const cacheKey = `zones:${tenantId}:warehouse:${warehouseId}:coords:${x}:${y}:${radius}`;
    let zones = await this.cacheService.get<any[]>(cacheKey);

    if (!zones) {
      zones = await this.zoneRepository.findZonesByCoordinates(tenantId, warehouseId, x, y, radius);
      await this.cacheService.set(cacheKey, zones, { ttl: 300 }); // 5 minutes
    }

    return zones;
  }

  async generateZoneReport(tenantId: string, zoneId: string): Promise<any> {
    const zone = await this.getZone(tenantId, zoneId);
    const metrics = await this.getZoneMetrics(tenantId, zoneId);
    const binLocations = await this.binLocationRepository.findByZone(tenantId, zoneId);
    const optimization = await this.optimizeZoneLayout(tenantId, zoneId, 'system');

    const report = {
      zone,
      generatedAt: new Date(),
      summary: {
        totalBinLocations: binLocations.length,
        occupiedBinLocations: binLocations.filter(bin => bin.status === 'occupied').length,
        availableBinLocations: binLocations.filter(bin => bin.status === 'available').length,
        utilizationPercentage: metrics.capacity.utilizationPercentage,
      },
      binLocationBreakdown: binLocations.reduce((acc, bin) => {
        acc[bin.status] = (acc[bin.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      productAssignments: {
        dedicatedBins: binLocations.filter(bin => bin.dedicatedProduct).length,
        sharedBins: binLocations.filter(bin => bin.assignedProductId && !bin.dedicatedProduct).length,
        unassignedBins: binLocations.filter(bin => !bin.assignedProductId).length,
      },
      optimization,
      recommendations: optimization.recommendations,
    };

    return report;
  }

  private async invalidateZoneCache(tenantId: string, warehouseId: string, zoneId?: string): Promise<void> {
    if (zoneId) {
      await this.cacheService.invalidatePattern(`zone:${tenantId}:${zoneId}:*`);
    }
    await this.cacheService.invalidatePattern(`zones:${tenantId}:warehouse:${warehouseId}:*`);
    await this.cacheService.invalidatePattern(`zone:${tenantId}:*`);
  }
}