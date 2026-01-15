import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PickListRepository } from '../repositories/pick-list.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { BinLocationRepository } from '../repositories/bin-location.repository';
import { 
  CreatePickListDto, 
  UpdatePickListDto, 
  PickListQueryDto,
  CreatePickListItemDto,
  UpdatePickListItemDto,
  OptimizePickingRouteDto,
  PickListStatus 
} from '../dto/picking.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

// Domain events
export class PickListCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly pickListId: string,
    public readonly pickListNumber: string,
    public readonly warehouseId: string,
    public readonly waveId: string | null,
    public readonly userId: string,
  ) {}
}

export class PickListStatusChangedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly pickListId: string,
    public readonly previousStatus: PickListStatus,
    public readonly newStatus: PickListStatus,
    public readonly userId: string,
  ) {}
}

export class PickListCompletedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly pickListId: string,
    public readonly warehouseId: string,
    public readonly totalItems: number,
    public readonly pickedItems: number,
    public readonly pickingAccuracy: number,
    public readonly actualTime: number,
    public readonly userId: string,
  ) {}
}

export class PickListItemPickedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly pickListId: string,
    public readonly itemId: string,
    public readonly productId: string,
    public readonly requestedQuantity: number,
    public readonly pickedQuantity: number,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class PickListService {
  constructor(
    private readonly pickListRepository: PickListRepository,
    private readonly warehouseRepository: WarehouseRepository,
    private readonly binLocationRepository: BinLocationRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createPickList(tenantId: string, data: CreatePickListDto, userId: string): Promise<any> {
    // Verify warehouse exists
    await this.warehouseRepository.findById(tenantId, data.warehouseId);

    // Generate pick list number if not provided
    if (!data.pickListNumber) {
      data.pickListNumber = await this.pickListRepository.generatePickListNumber(tenantId, data.warehouseId);
    }

    const pickList = await this.pickListRepository.create(tenantId, data, userId);

    // Emit domain event
    this.eventEmitter.emit('picking.pickList.created', new PickListCreatedEvent(
      tenantId,
      pickList.id,
      pickList.pickListNumber,
      data.warehouseId,
      data.waveId || null,
      userId,
    ));

    // Invalidate cache
    await this.invalidatePickListCache(tenantId, data.warehouseId);

    return pickList;
  }

  async getPickList(tenantId: string, id: string): Promise<any> {
    const cacheKey = `pickList:${tenantId}:${id}`;
    let pickList = await this.cacheService.get(cacheKey);

    if (!pickList) {
      pickList = await this.pickListRepository.findById(tenantId, id);
      await this.cacheService.set(cacheKey, pickList, { ttl: 300 }); // 5 minutes
    }

    return pickList;
  }

  async getPickListByNumber(tenantId: string, pickListNumber: string): Promise<any> {
    const cacheKey = `pickList:${tenantId}:number:${pickListNumber}`;
    let pickList = await this.cacheService.get(cacheKey);

    if (!pickList) {
      pickList = await this.pickListRepository.findByNumber(tenantId, pickListNumber);
      await this.cacheService.set(cacheKey, pickList, { ttl: 300 }); // 5 minutes
    }

    return pickList;
  }

  async getPickLists(tenantId: string, query: PickListQueryDto): Promise<{
    pickLists: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `pickLists:${tenantId}:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{
      pickLists: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);

    if (!result) {
      result = await this.pickListRepository.findMany(tenantId, query);
      await this.cacheService.set(cacheKey, result, { ttl: 180 }); // 3 minutes
    }

    return result;
  }

  async getPickListsByWave(tenantId: string, waveId: string): Promise<any[]> {
    const cacheKey = `pickLists:${tenantId}:wave:${waveId}`;
    let pickLists = await this.cacheService.get<any[]>(cacheKey);

    if (!pickLists) {
      pickLists = await this.pickListRepository.findByWave(tenantId, waveId);
      await this.cacheService.set(cacheKey, pickLists, { ttl: 300 }); // 5 minutes
    }

    return pickLists;
  }

  async getPickListsByPicker(tenantId: string, pickerId: string, status?: PickListStatus): Promise<any[]> {
    const cacheKey = `pickLists:${tenantId}:picker:${pickerId}:${status || 'all'}`;
    let pickLists = await this.cacheService.get<any[]>(cacheKey);

    if (!pickLists) {
      pickLists = await this.pickListRepository.findByPicker(tenantId, pickerId, status);
      await this.cacheService.set(cacheKey, pickLists, { ttl: 300 }); // 5 minutes
    }

    return pickLists;
  }

  async getPickListsByWarehouse(tenantId: string, warehouseId: string, status?: PickListStatus): Promise<any[]> {
    const cacheKey = `pickLists:${tenantId}:warehouse:${warehouseId}:${status || 'all'}`;
    let pickLists = await this.cacheService.get<any[]>(cacheKey);

    if (!pickLists) {
      pickLists = await this.pickListRepository.findByWarehouse(tenantId, warehouseId, status);
      await this.cacheService.set(cacheKey, pickLists, { ttl: 300 }); // 5 minutes
    }

    return pickLists;
  }

  async getPickListItems(tenantId: string, pickListId: string): Promise<any[]> {
    const cacheKey = `pickListItems:${tenantId}:${pickListId}`;
    let items = await this.cacheService.get<any[]>(cacheKey);

    if (!items) {
      items = await this.pickListRepository.findItems(tenantId, pickListId);
      await this.cacheService.set(cacheKey, items, { ttl: 300 }); // 5 minutes
    }

    return items;
  }

  async updatePickList(tenantId: string, id: string, data: UpdatePickListDto, userId: string): Promise<any> {
    const currentPickList = await this.getPickList(tenantId, id);
    const updatedPickList = await this.pickListRepository.update(tenantId, id, data, userId);

    // Check if status changed
    if (data.status && data.status !== currentPickList.status) {
      this.eventEmitter.emit('picking.pickList.status.changed', new PickListStatusChangedEvent(
        tenantId,
        id,
        currentPickList.status,
        data.status,
        userId,
      ));

      // Handle status-specific logic
      if (data.status === PickListStatus.COMPLETED) {
        await this.handlePickListCompletion(tenantId, id, userId);
      }
    }

    // Invalidate cache
    await this.invalidatePickListCache(tenantId, currentPickList.warehouseId, id);

    return updatedPickList;
  }

  async updatePickListStatus(tenantId: string, id: string, status: PickListStatus, userId: string): Promise<any> {
    const currentPickList = await this.getPickList(tenantId, id);
    
    // Validate status transition
    this.validateStatusTransition(currentPickList.status, status);

    const updatedPickList = await this.pickListRepository.updateStatus(tenantId, id, status, userId);

    // Emit domain event
    this.eventEmitter.emit('picking.pickList.status.changed', new PickListStatusChangedEvent(
      tenantId,
      id,
      currentPickList.status,
      status,
      userId,
    ));

    // Handle status-specific logic
    if (status === PickListStatus.COMPLETED) {
      await this.handlePickListCompletion(tenantId, id, userId);
    }

    // Invalidate cache
    await this.invalidatePickListCache(tenantId, currentPickList.warehouseId, id);

    return updatedPickList;
  }

  async assignPicker(tenantId: string, id: string, pickerId: string, userId: string): Promise<any> {
    const pickList = await this.getPickList(tenantId, id);
    const updatedPickList = await this.pickListRepository.assignPicker(tenantId, id, pickerId, userId);

    // Invalidate cache
    await this.invalidatePickListCache(tenantId, pickList.warehouseId, id);

    return updatedPickList;
  }

  async addItems(tenantId: string, pickListId: string, items: CreatePickListItemDto[], userId: string): Promise<any[]> {
    const pickList = await this.getPickList(tenantId, pickListId);
    const createdItems = await this.pickListRepository.createItems(tenantId, pickListId, items, userId);

    // Invalidate cache
    await this.invalidatePickListCache(tenantId, pickList.warehouseId, pickListId);

    return createdItems;
  }

  async updateItem(tenantId: string, itemId: string, data: UpdatePickListItemDto, userId: string): Promise<any> {
    const currentItem = await this.pickListRepository.findItemById(tenantId, itemId);
    const updatedItem = await this.pickListRepository.updateItem(tenantId, itemId, data, userId);

    // Emit item picked event if status changed to picked
    if (data.status === 'picked' && currentItem.status !== 'picked') {
      this.eventEmitter.emit('picking.pickListItem.picked', new PickListItemPickedEvent(
        tenantId,
        currentItem.pickListId,
        itemId,
        currentItem.productId,
        parseFloat(currentItem.requestedQuantity),
        parseFloat(updatedItem.pickedQuantity || '0'),
        userId,
      ));
    }

    // Get pick list to invalidate cache
    const pickList = await this.getPickList(tenantId, currentItem.pickListId);
    await this.invalidatePickListCache(tenantId, pickList.warehouseId, currentItem.pickListId);

    return updatedItem;
  }

  async optimizePickingRoute(tenantId: string, pickListId: string, data: OptimizePickingRouteDto, userId: string): Promise<any> {
    const pickList = await this.getPickList(tenantId, pickListId);
    const items = await this.getPickListItems(tenantId, pickListId);

    // Get bin location details for route optimization
    const binLocationIds = data.binLocationIds.length > 0 ? data.binLocationIds : items.map(item => item.binLocationId);
    const binLocations = await Promise.all(
      binLocationIds.map(id => this.binLocationRepository.findById(tenantId, id))
    );

    // Simple route optimization algorithm
    const optimizedRoute = this.calculateOptimizedRoute(binLocations, data);

    // Update pick list with optimized route
    await this.pickListRepository.updatePickingRoute(
      tenantId,
      pickListId,
      optimizedRoute.route,
      optimizedRoute.totalDistance,
      optimizedRoute.estimatedTime,
      userId
    );

    // Invalidate cache
    await this.invalidatePickListCache(tenantId, pickList.warehouseId, pickListId);

    return {
      pickListId,
      route: optimizedRoute.route,
      totalDistance: optimizedRoute.totalDistance,
      estimatedTime: optimizedRoute.estimatedTime,
      strategy: data.strategy || 'shortest_distance',
      optimizationSummary: {
        totalStops: optimizedRoute.route.length,
        estimatedSavings: optimizedRoute.estimatedSavings,
      },
    };
  }

  async deletePickList(tenantId: string, id: string, userId: string): Promise<void> {
    const pickList = await this.getPickList(tenantId, id);
    
    await this.pickListRepository.delete(tenantId, id, userId);

    // Invalidate cache
    await this.invalidatePickListCache(tenantId, pickList.warehouseId, id);
  }

  async getPickListStatistics(tenantId: string, warehouseId?: string, pickerId?: string, dateFrom?: Date, dateTo?: Date): Promise<any> {
    const cacheKey = `pickListStats:${tenantId}:${warehouseId || 'all'}:${pickerId || 'all'}:${dateFrom?.toISOString() || 'all'}:${dateTo?.toISOString() || 'all'}`;
    let stats = await this.cacheService.get(cacheKey);

    if (!stats) {
      stats = await this.pickListRepository.getPickListStatistics(tenantId, warehouseId, pickerId, dateFrom, dateTo);
      await this.cacheService.set(cacheKey, stats, { ttl: 300 }); // 5 minutes
    }

    return stats;
  }

  private validateStatusTransition(currentStatus: PickListStatus, newStatus: PickListStatus): void {
    const validTransitions: Record<PickListStatus, PickListStatus[]> = {
      [PickListStatus.PENDING]: [PickListStatus.ASSIGNED, PickListStatus.CANCELLED],
      [PickListStatus.ASSIGNED]: [PickListStatus.IN_PROGRESS, PickListStatus.CANCELLED],
      [PickListStatus.IN_PROGRESS]: [PickListStatus.COMPLETED, PickListStatus.CANCELLED],
      [PickListStatus.COMPLETED]: [], // No transitions from completed
      [PickListStatus.CANCELLED]: [], // No transitions from cancelled
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private async handlePickListCompletion(tenantId: string, pickListId: string, userId: string): Promise<void> {
    const pickList = await this.getPickList(tenantId, pickListId);
    const items = await this.getPickListItems(tenantId, pickListId);

    // Calculate final metrics
    const totalItems = items.length;
    const pickedItems = items.filter(item => item.status === 'picked').length;
    const accuracy = totalItems > 0 ? (pickedItems / totalItems) * 100 : 0;
    const actualTime = parseFloat(pickList.actualTime || '0');

    // Emit completion event
    this.eventEmitter.emit('picking.pickList.completed', new PickListCompletedEvent(
      tenantId,
      pickListId,
      pickList.warehouseId,
      totalItems,
      pickedItems,
      accuracy,
      actualTime,
      userId,
    ));
  }

  private calculateOptimizedRoute(binLocations: any[], options: OptimizePickingRouteDto): {
    route: any[];
    totalDistance: number;
    estimatedTime: number;
    estimatedSavings: number;
  } {
    const strategy = options.strategy || 'shortest_distance';
    let optimizedLocations: any[] = [];

    switch (strategy) {
      case 'zone_based':
        // Group by zone and optimize within zones
        optimizedLocations = this.optimizeByZone(binLocations);
        break;
      case 'serpentine':
        // Serpentine (snake) pattern through aisles
        optimizedLocations = this.optimizeSerpentine(binLocations);
        break;
      case 'fastest_time':
        // Optimize for fastest picking time
        optimizedLocations = this.optimizeByTime(binLocations);
        break;
      case 'shortest_distance':
      default:
        // Simple nearest neighbor algorithm
        optimizedLocations = this.optimizeByDistance(binLocations, options.startLocation);
        break;
    }

    // Calculate total distance and time
    const totalDistance = this.calculateTotalDistance(optimizedLocations);
    const estimatedTime = this.calculateEstimatedTime(optimizedLocations, totalDistance);
    const estimatedSavings = this.calculateSavings(binLocations, optimizedLocations);

    return {
      route: optimizedLocations.map((location, index) => ({
        sequence: index + 1,
        binLocationId: location.id,
        binCode: location.binCode,
        coordinates: {
          x: parseFloat(location.xCoordinate || '0'),
          y: parseFloat(location.yCoordinate || '0'),
          z: parseFloat(location.zCoordinate || '0'),
        },
        estimatedTime: 2, // 2 minutes per stop estimate
      })),
      totalDistance,
      estimatedTime,
      estimatedSavings,
    };
  }

  private optimizeByDistance(locations: any[], startLocation?: { x: number; y: number; z?: number }): any[] {
    if (locations.length <= 1) return locations;

    const optimized: any[] = [];
    const remaining = [...locations];
    
    // Start from specified location or first location
    let current = startLocation ? 
      this.findNearestLocation(remaining, startLocation) : 
      remaining.shift()!;
    
    optimized.push(current);
    remaining.splice(remaining.indexOf(current), 1);

    // Nearest neighbor algorithm
    while (remaining.length > 0) {
      const currentCoords = {
        x: parseFloat(current.xCoordinate || '0'),
        y: parseFloat(current.yCoordinate || '0'),
        z: parseFloat(current.zCoordinate || '0'),
      };
      
      const nearest = this.findNearestLocation(remaining, currentCoords);
      optimized.push(nearest);
      remaining.splice(remaining.indexOf(nearest), 1);
      current = nearest;
    }

    return optimized;
  }

  private optimizeByZone(locations: any[]): any[] {
    // Group by zone and sort within each zone
    const zoneGroups = locations.reduce((groups, location) => {
      const zoneId = location.zoneId;
      if (!groups[zoneId]) groups[zoneId] = [];
      groups[zoneId].push(location);
      return groups;
    }, {} as Record<string, any[]>);

    // Optimize within each zone and combine
    const optimized: any[] = [];
    (Object.values(zoneGroups) as any[][]).forEach((zoneLocations) => {
      const zoneOptimized = this.optimizeByDistance(zoneLocations);
      optimized.push(...zoneOptimized);
    });

    return optimized;
  }

  private optimizeSerpentine(locations: any[]): any[] {
    // Sort by aisle, then by bay in alternating directions
    const aisleGroups = locations.reduce((groups, location) => {
      const aisle = location.aisle || 'A';
      if (!groups[aisle]) groups[aisle] = [];
      groups[aisle].push(location);
      return groups;
    }, {} as Record<string, any[]>);

    const optimized: any[] = [];
    let reverse = false;

    Object.keys(aisleGroups).sort().forEach(aisle => {
      const aisleLocations = aisleGroups[aisle].sort((a: any, b: any) => {
        const bayA = parseInt(a.bay || '0');
        const bayB = parseInt(b.bay || '0');
        return reverse ? bayB - bayA : bayA - bayB;
      });
      
      optimized.push(...aisleLocations);
      reverse = !reverse; // Alternate direction for next aisle
    });

    return optimized;
  }

  private optimizeByTime(locations: any[]): any[] {
    // Sort by estimated pick time (could be based on product type, quantity, etc.)
    return locations.sort((a, b) => {
      // Simple heuristic: smaller items first
      const timeA = this.estimatePickTime(a);
      const timeB = this.estimatePickTime(b);
      return timeA - timeB;
    });
  }

  private findNearestLocation(locations: any[], coords: { x: number; y: number; z?: number }): any {
    let nearest = locations[0];
    let minDistance = this.calculateDistance(coords, {
      x: parseFloat(nearest.xCoordinate || '0'),
      y: parseFloat(nearest.yCoordinate || '0'),
      z: parseFloat(nearest.zCoordinate || '0'),
    });

    for (let i = 1; i < locations.length; i++) {
      const location = locations[i];
      const distance = this.calculateDistance(coords, {
        x: parseFloat(location.xCoordinate || '0'),
        y: parseFloat(location.yCoordinate || '0'),
        z: parseFloat(location.zCoordinate || '0'),
      });

      if (distance < minDistance) {
        minDistance = distance;
        nearest = location;
      }
    }

    return nearest;
  }

  private calculateDistance(point1: { x: number; y: number; z?: number }, point2: { x: number; y: number; z?: number }): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const dz = (point2.z || 0) - (point1.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculateTotalDistance(locations: any[]): number {
    if (locations.length <= 1) return 0;

    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      totalDistance += this.calculateDistance(
        {
          x: parseFloat(prev.xCoordinate || '0'),
          y: parseFloat(prev.yCoordinate || '0'),
          z: parseFloat(prev.zCoordinate || '0'),
        },
        {
          x: parseFloat(curr.xCoordinate || '0'),
          y: parseFloat(curr.yCoordinate || '0'),
          z: parseFloat(curr.zCoordinate || '0'),
        }
      );
    }

    return Math.round(totalDistance * 100) / 100; // Round to 2 decimal places
  }

  private calculateEstimatedTime(locations: any[], totalDistance: number): number {
    // Estimate: 1 meter per second walking + 2 minutes per pick
    const walkingTime = totalDistance / 1.0; // seconds
    const pickingTime = locations.length * 120; // 2 minutes per location in seconds
    return Math.round((walkingTime + pickingTime) / 60); // Convert to minutes
  }

  private estimatePickTime(location: any): number {
    // Simple heuristic for pick time estimation
    // In a real system, this would consider product characteristics, quantity, etc.
    return 2; // 2 minutes base time
  }

  private calculateSavings(original: any[], optimized: any[]): number {
    const originalDistance = this.calculateTotalDistance(original);
    const optimizedDistance = this.calculateTotalDistance(optimized);
    return Math.max(0, originalDistance - optimizedDistance);
  }

  private async invalidatePickListCache(tenantId: string, warehouseId: string, pickListId?: string): Promise<void> {
    if (pickListId) {
      await this.cacheService.invalidatePattern(`pickList:${tenantId}:${pickListId}:*`);
      await this.cacheService.invalidatePattern(`pickListItems:${tenantId}:${pickListId}:*`);
    }
    await this.cacheService.invalidatePattern(`pickLists:${tenantId}:warehouse:${warehouseId}:*`);
    await this.cacheService.invalidatePattern(`pickLists:${tenantId}:*`);
    await this.cacheService.invalidatePattern(`pickListStats:${tenantId}:*`);
  }
}