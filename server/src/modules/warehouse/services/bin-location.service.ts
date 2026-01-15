import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BinLocationRepository } from '../repositories/bin-location.repository';
import { WarehouseZoneRepository } from '../repositories/warehouse-zone.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { 
  CreateBinLocationDto, 
  UpdateBinLocationDto, 
  BinLocationQueryDto,
  BulkCreateBinLocationsDto,
  BinLocationStatus 
} from '../dto/warehouse.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

// Domain events
export class BinLocationCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly zoneId: string,
    public readonly binLocationId: string,
    public readonly binCode: string,
    public readonly userId: string,
  ) {}
}

export class BinLocationAssignedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly binLocationId: string,
    public readonly productId: string,
    public readonly variantId: string | null,
    public readonly dedicated: boolean,
    public readonly userId: string,
  ) {}
}

export class BinLocationOccupancyChangedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly binLocationId: string,
    public readonly warehouseId: string,
    public readonly previousOccupancy: number,
    public readonly newOccupancy: number,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class BinLocationService {
  constructor(
    private readonly binLocationRepository: BinLocationRepository,
    private readonly zoneRepository: WarehouseZoneRepository,
    private readonly warehouseRepository: WarehouseRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createBinLocation(tenantId: string, data: CreateBinLocationDto, userId: string): Promise<any> {
    // Verify zone and warehouse exist
    await this.zoneRepository.findById(tenantId, data.zoneId);
    await this.warehouseRepository.findById(tenantId, data.warehouseId);

    const binLocation = await this.binLocationRepository.create(tenantId, data, userId);

    // Update zone bin location count
    await this.zoneRepository.updateBinLocationCount(tenantId, data.zoneId, userId);

    // Update warehouse bin location count
    await this.warehouseRepository.updateBinLocationCounts(tenantId, data.warehouseId, userId);

    // Emit domain event
    this.eventEmitter.emit('bin.location.created', new BinLocationCreatedEvent(
      tenantId,
      data.warehouseId,
      data.zoneId,
      binLocation.id,
      binLocation.binCode,
      userId,
    ));

    // Invalidate cache
    await this.invalidateBinLocationCache(tenantId, data.warehouseId, data.zoneId);

    return binLocation;
  }

  async bulkCreateBinLocations(tenantId: string, data: BulkCreateBinLocationsDto, userId: string): Promise<any[]> {
    // Verify zone and warehouse exist
    await this.zoneRepository.findById(tenantId, data.zoneId);
    await this.warehouseRepository.findById(tenantId, data.warehouseId);

    const binLocations = await this.binLocationRepository.bulkCreate(tenantId, data, userId);

    // Update zone bin location count
    await this.zoneRepository.updateBinLocationCount(tenantId, data.zoneId, userId);

    // Update warehouse bin location count
    await this.warehouseRepository.updateBinLocationCounts(tenantId, data.warehouseId, userId);

    // Invalidate cache
    await this.invalidateBinLocationCache(tenantId, data.warehouseId, data.zoneId);

    return binLocations;
  }

  async getBinLocation(tenantId: string, id: string): Promise<any> {
    const cacheKey = `bin:${tenantId}:${id}`;
    let binLocation = await this.cacheService.get(cacheKey);

    if (!binLocation) {
      binLocation = await this.binLocationRepository.findById(tenantId, id);
      await this.cacheService.set(cacheKey, binLocation, { ttl: 300, tenantId }); // 5 minutes
    }

    return binLocation;
  }

  async getBinLocationByCode(tenantId: string, warehouseId: string, binCode: string): Promise<any> {
    const cacheKey = `bin:${tenantId}:${warehouseId}:code:${binCode}`;
    let binLocation = await this.cacheService.get(cacheKey);

    if (!binLocation) {
      binLocation = await this.binLocationRepository.findByCode(tenantId, warehouseId, binCode);
      await this.cacheService.set(cacheKey, binLocation, { ttl: 300, tenantId }); // 5 minutes
    }

    return binLocation;
  }

  async getBinLocations(tenantId: string, query: BinLocationQueryDto): Promise<{
    binLocations: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `bins:${tenantId}:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{
      binLocations: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);

    if (!result) {
      result = await this.binLocationRepository.findMany(tenantId, query);
      await this.cacheService.set(cacheKey, result, { ttl: 180, tenantId }); // 3 minutes
    }

    return result;
  }

  async getBinLocationsByZone(tenantId: string, zoneId: string): Promise<any[]> {
    const cacheKey = `bins:${tenantId}:zone:${zoneId}`;
    let binLocations = await this.cacheService.get<any[]>(cacheKey);

    if (!binLocations) {
      binLocations = await this.binLocationRepository.findByZone(tenantId, zoneId);
      await this.cacheService.set(cacheKey, binLocations, { ttl: 300, tenantId }); // 5 minutes
    }

    return binLocations;
  }

  async getBinLocationsByWarehouse(tenantId: string, warehouseId: string): Promise<any[]> {
    const cacheKey = `bins:${tenantId}:warehouse:${warehouseId}`;
    let binLocations = await this.cacheService.get<any[]>(cacheKey);

    if (!binLocations) {
      binLocations = await this.binLocationRepository.findByWarehouse(tenantId, warehouseId);
      await this.cacheService.set(cacheKey, binLocations, { ttl: 300, tenantId }); // 5 minutes
    }

    return binLocations;
  }

  async getAvailableBinLocations(tenantId: string, warehouseId: string, zoneId?: string): Promise<any[]> {
    const cacheKey = `bins:${tenantId}:warehouse:${warehouseId}:available:${zoneId || 'all'}`;
    let binLocations = await this.cacheService.get<any[]>(cacheKey);

    if (!binLocations) {
      binLocations = await this.binLocationRepository.findAvailable(tenantId, warehouseId, zoneId);
      await this.cacheService.set(cacheKey, binLocations, { ttl: 180, tenantId }); // 3 minutes
    }

    return binLocations;
  }

  async getBinLocationsByProduct(tenantId: string, productId: string, variantId?: string): Promise<any[]> {
    const cacheKey = `bins:${tenantId}:product:${productId}:${variantId || 'null'}`;
    let binLocations = await this.cacheService.get<any[]>(cacheKey);

    if (!binLocations) {
      binLocations = await this.binLocationRepository.findByProduct(tenantId, productId, variantId);
      await this.cacheService.set(cacheKey, binLocations, { ttl: 300, tenantId }); // 5 minutes
    }

    return binLocations;
  }

  async updateBinLocation(tenantId: string, id: string, data: UpdateBinLocationDto, userId: string): Promise<any> {
    const binLocation = await this.getBinLocation(tenantId, id);
    const updatedBinLocation = await this.binLocationRepository.update(tenantId, id, data, userId);

    // Check if occupancy changed significantly
    if (data.occupancyPercentage !== undefined && 
        Math.abs(data.occupancyPercentage - parseFloat(binLocation.occupancyPercentage || '0')) > 5) {
      this.eventEmitter.emit('bin.location.occupancy.changed', new BinLocationOccupancyChangedEvent(
        tenantId,
        id,
        binLocation.warehouseId,
        parseFloat(binLocation.occupancyPercentage || '0'),
        data.occupancyPercentage,
        userId,
      ));
    }

    // Invalidate cache
    await this.invalidateBinLocationCache(tenantId, binLocation.warehouseId, binLocation.zoneId, id);

    return updatedBinLocation;
  }

  async updateBinLocationStatus(tenantId: string, id: string, status: BinLocationStatus, userId: string): Promise<any> {
    const binLocation = await this.getBinLocation(tenantId, id);
    const updatedBinLocation = await this.binLocationRepository.updateStatus(tenantId, id, status, userId);

    // Update zone and warehouse counts if status affects occupancy
    if (['occupied', 'available'].includes(status)) {
      await this.zoneRepository.updateBinLocationCount(tenantId, binLocation.zoneId, userId);
      await this.warehouseRepository.updateBinLocationCounts(tenantId, binLocation.warehouseId, userId);
    }

    // Invalidate cache
    await this.invalidateBinLocationCache(tenantId, binLocation.warehouseId, binLocation.zoneId, id);

    return updatedBinLocation;
  }

  async assignProductToBinLocation(
    tenantId: string, 
    id: string, 
    productId: string, 
    variantId: string | null, 
    dedicated: boolean,
    userId: string
  ): Promise<any> {
    const binLocation = await this.getBinLocation(tenantId, id);

    // Check if bin location is available
    if (binLocation.status !== BinLocationStatus.AVAILABLE) {
      throw new ConflictException('Bin location is not available for assignment');
    }

    // Check if it's a dedicated bin and already has a different product
    if (binLocation.dedicatedProduct && binLocation.assignedProductId && 
        binLocation.assignedProductId !== productId) {
      throw new ConflictException('Dedicated bin location is already assigned to a different product');
    }

    const updatedBinLocation = await this.binLocationRepository.assignProduct(
      tenantId, 
      id, 
      productId, 
      variantId, 
      dedicated, 
      userId
    );

    // Update zone and warehouse counts
    await this.zoneRepository.updateBinLocationCount(tenantId, binLocation.zoneId, userId);
    await this.warehouseRepository.updateBinLocationCounts(tenantId, binLocation.warehouseId, userId);

    // Emit domain event
    this.eventEmitter.emit('bin.location.assigned', new BinLocationAssignedEvent(
      tenantId,
      id,
      productId,
      variantId,
      dedicated,
      userId,
    ));

    // Invalidate cache
    await this.invalidateBinLocationCache(tenantId, binLocation.warehouseId, binLocation.zoneId, id);

    return updatedBinLocation;
  }

  async unassignProductFromBinLocation(tenantId: string, id: string, userId: string): Promise<any> {
    const binLocation = await this.getBinLocation(tenantId, id);

    const updatedBinLocation = await this.binLocationRepository.unassignProduct(tenantId, id, userId);

    // Update zone and warehouse counts
    await this.zoneRepository.updateBinLocationCount(tenantId, binLocation.zoneId, userId);
    await this.warehouseRepository.updateBinLocationCounts(tenantId, binLocation.warehouseId, userId);

    // Invalidate cache
    await this.invalidateBinLocationCache(tenantId, binLocation.warehouseId, binLocation.zoneId, id);

    return updatedBinLocation;
  }

  async updateBinLocationOccupancy(
    tenantId: string, 
    id: string, 
    occupancyPercentage: number, 
    currentWeight: number,
    userId: string
  ): Promise<any> {
    if (occupancyPercentage < 0 || occupancyPercentage > 100) {
      throw new BadRequestException('Occupancy percentage must be between 0 and 100');
    }

    const binLocation = await this.getBinLocation(tenantId, id);

    // Check weight constraint
    const maxWeight = parseFloat(binLocation.maxWeight || '0');
    if (maxWeight > 0 && currentWeight > maxWeight) {
      throw new BadRequestException('Current weight exceeds maximum weight capacity');
    }

    const updatedBinLocation = await this.binLocationRepository.updateOccupancy(
      tenantId, 
      id, 
      occupancyPercentage, 
      currentWeight, 
      userId
    );

    // Emit domain event
    this.eventEmitter.emit('bin.location.occupancy.changed', new BinLocationOccupancyChangedEvent(
      tenantId,
      id,
      binLocation.warehouseId,
      parseFloat(binLocation.occupancyPercentage || '0'),
      occupancyPercentage,
      userId,
    ));

    // Update zone and warehouse counts if status changed
    if (binLocation.status !== updatedBinLocation.status) {
      await this.zoneRepository.updateBinLocationCount(tenantId, binLocation.zoneId, userId);
      await this.warehouseRepository.updateBinLocationCounts(tenantId, binLocation.warehouseId, userId);
    }

    // Invalidate cache
    await this.invalidateBinLocationCache(tenantId, binLocation.warehouseId, binLocation.zoneId, id);

    return updatedBinLocation;
  }

  async deleteBinLocation(tenantId: string, id: string, userId: string): Promise<void> {
    const binLocation = await this.getBinLocation(tenantId, id);
    
    await this.binLocationRepository.delete(tenantId, id, userId);

    // Update zone and warehouse counts
    await this.zoneRepository.updateBinLocationCount(tenantId, binLocation.zoneId, userId);
    await this.warehouseRepository.updateBinLocationCounts(tenantId, binLocation.warehouseId, userId);

    // Invalidate cache
    await this.invalidateBinLocationCache(tenantId, binLocation.warehouseId, binLocation.zoneId, id);
  }

  async findOptimalBinLocation(
    tenantId: string,
    warehouseId: string,
    productId: string,
    variantId: string | null,
    requiredVolume?: number,
    requiredWeight?: number,
    zoneType?: string
  ): Promise<any | null> {
    const cacheKey = `bin:${tenantId}:optimal:${warehouseId}:${productId}:${variantId || 'null'}:${requiredVolume || 0}:${requiredWeight || 0}:${zoneType || 'any'}`;
    let optimalBin = await this.cacheService.get(cacheKey);

    if (!optimalBin) {
      optimalBin = await this.binLocationRepository.findOptimalBinLocation(
        tenantId,
        warehouseId,
        productId,
        variantId,
        requiredVolume,
        requiredWeight,
        zoneType
      );
      
      if (optimalBin) {
        await this.cacheService.set(cacheKey, optimalBin, { ttl: 60, tenantId }); // 1 minute (short cache for availability)
      }
    }

    return optimalBin;
  }

  async getPickingRoute(tenantId: string, warehouseId: string, binLocationIds: string[]): Promise<any[]> {
    if (binLocationIds.length === 0) {
      return [];
    }

    const cacheKey = `picking:${tenantId}:route:${warehouseId}:${binLocationIds.sort().join(',')}`;
    let route = await this.cacheService.get<any[]>(cacheKey);

    if (!route) {
      route = await this.binLocationRepository.getPickingRoute(tenantId, warehouseId, binLocationIds);
      await this.cacheService.set(cacheKey, route, { ttl: 300, tenantId }); // 5 minutes
    }

    return route;
  }

  async getBinLocationMetrics(tenantId: string, warehouseId: string, zoneId?: string): Promise<any> {
    const cacheKey = `bins:${tenantId}:metrics:${warehouseId}:${zoneId || 'all'}`;
    let metrics = await this.cacheService.get(cacheKey);

    if (!metrics) {
      metrics = await this.binLocationRepository.getBinLocationMetrics(tenantId, warehouseId, zoneId);
      await this.cacheService.set(cacheKey, metrics, { ttl: 180, tenantId }); // 3 minutes
    }

    return metrics;
  }

  async optimizeBinLocationLayout(tenantId: string, warehouseId: string, zoneId?: string): Promise<any> {
    const binLocations = zoneId 
      ? await this.getBinLocationsByZone(tenantId, zoneId)
      : await this.getBinLocationsByWarehouse(tenantId, warehouseId);
    
    const metrics = await this.getBinLocationMetrics(tenantId, warehouseId, zoneId);

    // Analyze current layout and generate optimization recommendations
    const optimizationResults = {
      warehouseId,
      zoneId,
      optimizationDate: new Date(),
      currentMetrics: metrics,
      recommendations: [] as Array<{
        type: string;
        priority: string;
        description: string;
        binLocationIds?: any[];
        action?: string;
      }>,
      estimatedImprovements: {
        pickingEfficiency: 0,
        spaceUtilization: 0,
        accessibilityImprovement: 0,
      },
    };

    // Check for picking sequence optimization
    const unsequencedBins = binLocations.filter(bin => !bin.pickingSequence);
    if (unsequencedBins.length > 0) {
      optimizationResults.recommendations.push({
        type: 'picking_sequence',
        priority: 'high',
        description: `${unsequencedBins.length} bin locations need picking sequence assignment`,
        binLocationIds: unsequencedBins.map(bin => bin.id),
      });
    }

    // Check for space utilization issues
    const occupiedBins = binLocations.filter(bin => bin.status === 'occupied');
    const utilizationRate = binLocations.length > 0 ? (occupiedBins.length / binLocations.length) * 100 : 0;

    if (utilizationRate > 95) {
      optimizationResults.recommendations.push({
        type: 'capacity_warning',
        priority: 'high',
        description: 'Bin location utilization is critically high',
        action: 'Consider expanding capacity or implementing overflow strategies',
      });
    }

    // Check for product assignment optimization
    const unassignedBins = binLocations.filter(bin => 
      bin.status === 'available' && !bin.assignedProductId
    );
    
    if (unassignedBins.length > binLocations.length * 0.3) {
      optimizationResults.recommendations.push({
        type: 'product_assignment',
        priority: 'medium',
        description: 'High number of unassigned bin locations',
        action: 'Consider pre-assigning popular products to optimize picking',
      });
    }

    return optimizationResults;
  }

  async generateBinLocationReport(tenantId: string, warehouseId: string, zoneId?: string): Promise<any> {
    const binLocations = zoneId 
      ? await this.getBinLocationsByZone(tenantId, zoneId)
      : await this.getBinLocationsByWarehouse(tenantId, warehouseId);
    
    const metrics = await this.getBinLocationMetrics(tenantId, warehouseId, zoneId);
    const optimization = await this.optimizeBinLocationLayout(tenantId, warehouseId, zoneId);

    const report = {
      warehouseId,
      zoneId,
      generatedAt: new Date(),
      summary: {
        totalBinLocations: binLocations.length,
        occupiedBinLocations: binLocations.filter(bin => bin.status === 'occupied').length,
        availableBinLocations: binLocations.filter(bin => bin.status === 'available').length,
        averageOccupancy: metrics.overall.avgOccupancy || 0,
      },
      statusBreakdown: metrics.byStatus,
      productAssignments: {
        assignedBins: binLocations.filter(bin => bin.assignedProductId).length,
        dedicatedBins: binLocations.filter(bin => bin.dedicatedProduct).length,
        unassignedBins: binLocations.filter(bin => !bin.assignedProductId).length,
      },
      capacityAnalysis: {
        totalVolume: metrics.overall.totalVolume || 0,
        totalWeightCapacity: metrics.overall.totalWeight || 0,
        utilizationRate: (binLocations.filter(bin => bin.status === 'occupied').length / binLocations.length) * 100,
      },
      optimization,
      recommendations: optimization.recommendations,
    };

    return report;
  }

  private async invalidateBinLocationCache(
    tenantId: string, 
    warehouseId: string, 
    zoneId: string, 
    binLocationId?: string
  ): Promise<void> {
    if (binLocationId) {
      await this.cacheService.invalidatePattern(`bin:${tenantId}:${binLocationId}:*`);
    }
    await this.cacheService.invalidatePattern(`bins:${tenantId}:zone:${zoneId}:*`);
    await this.cacheService.invalidatePattern(`bins:${tenantId}:warehouse:${warehouseId}:*`);
    await this.cacheService.invalidatePattern(`bins:${tenantId}:*`);
    await this.cacheService.invalidatePattern(`bin:${tenantId}:optimal:*`);
    await this.cacheService.invalidatePattern(`picking:${tenantId}:route:*`);
  }
}