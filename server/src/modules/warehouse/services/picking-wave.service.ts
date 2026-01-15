import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PickingWaveRepository } from '../repositories/picking-wave.repository';
import { PickListRepository } from '../repositories/pick-list.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { 
  CreatePickingWaveDto, 
  UpdatePickingWaveDto, 
  PickingWaveQueryDto,
  WavePlanningDto,
  WaveStatus,
  WaveType 
} from '../dto/picking.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';

// Domain events
export class PickingWaveCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly waveId: string,
    public readonly waveNumber: string,
    public readonly userId: string,
  ) {}
}

export class PickingWaveStatusChangedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly waveId: string,
    public readonly previousStatus: WaveStatus,
    public readonly newStatus: WaveStatus,
    public readonly userId: string,
  ) {}
}

export class PickingWaveCompletedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly waveId: string,
    public readonly warehouseId: string,
    public readonly totalOrders: number,
    public readonly totalItems: number,
    public readonly pickingAccuracy: number,
    public readonly actualPickTime: number,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class PickingWaveService {
  constructor(
    private readonly waveRepository: PickingWaveRepository,
    private readonly pickListRepository: PickListRepository,
    private readonly warehouseRepository: WarehouseRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createWave(tenantId: string, data: CreatePickingWaveDto, userId: string): Promise<any> {
    // Verify warehouse exists
    await this.warehouseRepository.findById(tenantId, data.warehouseId);

    // Generate wave number if not provided
    if (!data.waveNumber) {
      data.waveNumber = await this.waveRepository.generateWaveNumber(tenantId, data.warehouseId);
    }

    const wave = await this.waveRepository.create(tenantId, data, userId);

    // Emit domain event
    this.eventEmitter.emit('picking.wave.created', new PickingWaveCreatedEvent(
      tenantId,
      data.warehouseId,
      wave.id,
      wave.waveNumber,
      userId,
    ));

    // Queue wave planning if orders are provided
    if (data.orderIds && data.orderIds.length > 0) {
      await this.queueService.addSyncJob({
        syncType: 'inventory',
        tenantId,
        userId,
      }, {
        priority: 5,
        delay: 0,
      });
    }

    // Invalidate cache
    await this.invalidateWaveCache(tenantId, data.warehouseId);

    return wave;
  }

  async getWave(tenantId: string, id: string): Promise<any> {
    const cacheKey = `wave:${tenantId}:${id}`;
    let wave = await this.cacheService.get(cacheKey);

    if (!wave) {
      wave = await this.waveRepository.findById(tenantId, id);
      await this.cacheService.set(cacheKey, wave, { ttl: 300 }); // 5 minutes
    }

    return wave;
  }

  async getWaveByNumber(tenantId: string, waveNumber: string): Promise<any> {
    const cacheKey = `wave:${tenantId}:number:${waveNumber}`;
    let wave = await this.cacheService.get(cacheKey);

    if (!wave) {
      wave = await this.waveRepository.findByNumber(tenantId, waveNumber);
      await this.cacheService.set(cacheKey, wave, { ttl: 300 }); // 5 minutes
    }

    return wave;
  }

  async getWaves(tenantId: string, query: PickingWaveQueryDto): Promise<{
    waves: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `waves:${tenantId}:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{
      waves: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);

    if (!result) {
      result = await this.waveRepository.findMany(tenantId, query);
      await this.cacheService.set(cacheKey, result, { ttl: 180 }); // 3 minutes
    }

    return result;
  }

  async getWavesByWarehouse(tenantId: string, warehouseId: string): Promise<any[]> {
    const cacheKey = `waves:${tenantId}:warehouse:${warehouseId}`;
    let waves = await this.cacheService.get<any[]>(cacheKey);

    if (!waves) {
      waves = await this.waveRepository.findByWarehouse(tenantId, warehouseId);
      await this.cacheService.set(cacheKey, waves, { ttl: 300 }); // 5 minutes
    }

    return waves;
  }

  async getActiveWaves(tenantId: string, warehouseId?: string): Promise<any[]> {
    const cacheKey = `waves:${tenantId}:active:${warehouseId || 'all'}`;
    let waves = await this.cacheService.get<any[]>(cacheKey);

    if (!waves) {
      waves = await this.waveRepository.findActiveWaves(tenantId, warehouseId);
      await this.cacheService.set(cacheKey, waves, { ttl: 180 }); // 3 minutes
    }

    return waves;
  }

  async getWavesByPicker(tenantId: string, pickerId: string): Promise<any[]> {
    const cacheKey = `waves:${tenantId}:picker:${pickerId}`;
    let waves = await this.cacheService.get<any[]>(cacheKey);

    if (!waves) {
      waves = await this.waveRepository.findByPicker(tenantId, pickerId);
      await this.cacheService.set(cacheKey, waves, { ttl: 300 }); // 5 minutes
    }

    return waves;
  }

  async updateWave(tenantId: string, id: string, data: UpdatePickingWaveDto, userId: string): Promise<any> {
    const currentWave = await this.getWave(tenantId, id);
    const updatedWave = await this.waveRepository.update(tenantId, id, data, userId);

    // Check if status changed
    if (data.status && data.status !== currentWave.status) {
      this.eventEmitter.emit('picking.wave.status.changed', new PickingWaveStatusChangedEvent(
        tenantId,
        id,
        currentWave.status,
        data.status,
        userId,
      ));

      // Handle status-specific logic
      if (data.status === WaveStatus.COMPLETED) {
        await this.handleWaveCompletion(tenantId, id, userId);
      }
    }

    // Invalidate cache
    await this.invalidateWaveCache(tenantId, currentWave.warehouseId, id);

    return updatedWave;
  }

  async updateWaveStatus(tenantId: string, id: string, status: WaveStatus, userId: string): Promise<any> {
    const currentWave = await this.getWave(tenantId, id);
    
    // Validate status transition
    this.validateStatusTransition(currentWave.status, status);

    const updatedWave = await this.waveRepository.updateStatus(tenantId, id, status, userId);

    // Emit domain event
    this.eventEmitter.emit('picking.wave.status.changed', new PickingWaveStatusChangedEvent(
      tenantId,
      id,
      currentWave.status,
      status,
      userId,
    ));

    // Handle status-specific logic
    if (status === WaveStatus.RELEASED) {
      await this.handleWaveRelease(tenantId, id, userId);
    } else if (status === WaveStatus.COMPLETED) {
      await this.handleWaveCompletion(tenantId, id, userId);
    }

    // Invalidate cache
    await this.invalidateWaveCache(tenantId, currentWave.warehouseId, id);

    return updatedWave;
  }

  async assignPickers(tenantId: string, id: string, pickerIds: string[], userId: string): Promise<any> {
    const wave = await this.getWave(tenantId, id);
    const updatedWave = await this.waveRepository.assignPickers(tenantId, id, pickerIds, userId);

    // Invalidate cache
    await this.invalidateWaveCache(tenantId, wave.warehouseId, id);

    return updatedWave;
  }

  async deleteWave(tenantId: string, id: string, userId: string): Promise<void> {
    const wave = await this.getWave(tenantId, id);
    
    await this.waveRepository.delete(tenantId, id, userId);

    // Invalidate cache
    await this.invalidateWaveCache(tenantId, wave.warehouseId, id);
  }

  async planWave(tenantId: string, data: WavePlanningDto): Promise<any> {
    // Verify warehouse exists
    await this.warehouseRepository.findById(tenantId, data.warehouseId);

    // This is a simplified wave planning algorithm
    // In a real system, this would use sophisticated algorithms considering:
    // - Order priorities and deadlines
    // - Product locations and picking sequences
    // - Picker capabilities and availability
    // - Equipment requirements
    // - Zone constraints and capacity

    const planningResult = {
      warehouseId: data.warehouseId,
      totalOrders: data.orderIds.length,
      recommendedWaves: [] as any[],
      estimatedPickTime: 0,
      estimatedDistance: 0,
      recommendations: [] as any[],
    };

    // Group orders by priority
    const priorityOrders = data.priorityOrders || [];
    const regularOrders = data.orderIds.filter(id => !priorityOrders.includes(id));

    // Create waves based on constraints
    const maxOrdersPerWave = data.maxOrdersPerWave || 20;
    const availablePickers = data.availablePickers || [];

    let waveNumber = 1;
    const allOrders = [...priorityOrders, ...regularOrders];

    for (let i = 0; i < allOrders.length; i += maxOrdersPerWave) {
      const waveOrders = allOrders.slice(i, i + maxOrdersPerWave);
      const isPriority = waveOrders.some(orderId => priorityOrders.includes(orderId));

      const wave = {
        waveNumber: `PLAN-${waveNumber.toString().padStart(3, '0')}`,
        name: `Planned Wave ${waveNumber}${isPriority ? ' (Priority)' : ''}`,
        orderIds: waveOrders,
        waveType: isPriority ? WaveType.PRIORITY : WaveType.STANDARD,
        priority: isPriority ? 1 : 2,
        estimatedOrders: waveOrders.length,
        estimatedPickTime: waveOrders.length * 5, // 5 minutes per order estimate
        assignedPickers: availablePickers.slice(0, Math.min(2, availablePickers.length)),
      };

      planningResult.recommendedWaves.push(wave);
      planningResult.estimatedPickTime += wave.estimatedPickTime;
      waveNumber++;
    }

    // Generate recommendations
    if (planningResult.recommendedWaves.length > 5) {
      planningResult.recommendations.push({
        type: 'wave_consolidation',
        priority: 'medium',
        description: 'Consider consolidating waves to reduce setup time',
      });
    }

    if (availablePickers.length < planningResult.recommendedWaves.length) {
      planningResult.recommendations.push({
        type: 'picker_shortage',
        priority: 'high',
        description: 'Insufficient pickers for optimal wave execution',
      });
    }

    return planningResult;
  }

  async optimizeWaveSequence(tenantId: string, warehouseId: string, waveIds: string[], userId: string): Promise<any> {
    const waves = await Promise.all(
      waveIds.map(id => this.getWave(tenantId, id))
    );

    // Simple optimization based on priority and estimated time
    const optimizedSequence = waves
      .sort((a, b) => {
        // Priority first
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Then by estimated pick time (shorter first)
        return parseFloat(a.estimatedPickTime || '0') - parseFloat(b.estimatedPickTime || '0');
      })
      .map((wave, index) => ({
        waveId: wave.id,
        waveNumber: wave.waveNumber,
        sequenceOrder: index + 1,
        estimatedStartTime: this.calculateEstimatedStartTime(waves, index),
        estimatedEndTime: this.calculateEstimatedEndTime(waves, index),
      }));

    return {
      warehouseId,
      optimizedSequence,
      totalEstimatedTime: optimizedSequence.reduce((total, wave) => 
        total + (parseFloat(waves.find(w => w.id === wave.waveId)?.estimatedPickTime || '0')), 0
      ),
      recommendations: this.generateSequenceRecommendations(waves),
    };
  }

  async getWaveStatistics(tenantId: string, warehouseId?: string, dateFrom?: Date, dateTo?: Date): Promise<any> {
    const cacheKey = `wave:${tenantId}:stats:${warehouseId || 'all'}:${dateFrom?.toISOString() || 'all'}:${dateTo?.toISOString() || 'all'}`;
    let stats = await this.cacheService.get(cacheKey);

    if (!stats) {
      stats = await this.waveRepository.getWaveStatistics(tenantId, warehouseId, dateFrom, dateTo);
      await this.cacheService.set(cacheKey, stats, { ttl: 300 }); // 5 minutes
    }

    return stats;
  }

  async getOverdueWaves(tenantId: string, warehouseId?: string): Promise<any[]> {
    const cacheKey = `waves:${tenantId}:overdue:${warehouseId || 'all'}`;
    let overdueWaves = await this.cacheService.get<any[]>(cacheKey);

    if (!overdueWaves) {
      overdueWaves = await this.waveRepository.findOverdueWaves(tenantId, warehouseId);
      await this.cacheService.set(cacheKey, overdueWaves, { ttl: 60 }); // 1 minute (short cache for urgency)
    }

    return overdueWaves;
  }

  private validateStatusTransition(currentStatus: WaveStatus, newStatus: WaveStatus): void {
    const validTransitions: Record<WaveStatus, WaveStatus[]> = {
      [WaveStatus.PLANNED]: [WaveStatus.RELEASED, WaveStatus.CANCELLED],
      [WaveStatus.RELEASED]: [WaveStatus.IN_PROGRESS, WaveStatus.CANCELLED],
      [WaveStatus.IN_PROGRESS]: [WaveStatus.COMPLETED, WaveStatus.CANCELLED],
      [WaveStatus.COMPLETED]: [], // No transitions from completed
      [WaveStatus.CANCELLED]: [], // No transitions from cancelled
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private async handleWaveRelease(tenantId: string, waveId: string, userId: string): Promise<void> {
    // Queue pick list generation
    await this.queueService.addSyncJob({
      syncType: 'inventory',
      tenantId,
      userId,
    }, {
      priority: 5,
      delay: 0,
    });

    // Queue route optimization
    await this.queueService.addSyncJob({
      syncType: 'inventory',
      tenantId,
      userId,
    }, {
      priority: 5,
      delay: 1000, // 1 second delay
    });
  }

  private async handleWaveCompletion(tenantId: string, waveId: string, userId: string): Promise<void> {
    const wave = await this.getWave(tenantId, waveId);
    const pickLists = await this.pickListRepository.findByWave(tenantId, waveId);

    // Calculate final metrics
    const totalItems = pickLists.reduce((sum, pl) => sum + (pl.totalItems || 0), 0);
    const totalPickTime = pickLists.reduce((sum, pl) => sum + parseFloat(pl.actualTime || '0'), 0);
    const avgAccuracy = pickLists.length > 0 
      ? pickLists.reduce((sum, pl) => sum + parseFloat(pl.pickingAccuracy || '0'), 0) / pickLists.length 
      : 0;

    // Update wave performance metrics
    await this.waveRepository.updatePerformanceMetrics(
      tenantId,
      waveId,
      parseFloat(wave.estimatedPickTime || '0'),
      totalPickTime,
      avgAccuracy,
      userId
    );

    // Emit completion event
    this.eventEmitter.emit('picking.wave.completed', new PickingWaveCompletedEvent(
      tenantId,
      waveId,
      wave.warehouseId,
      wave.totalOrders,
      totalItems,
      avgAccuracy,
      totalPickTime,
      userId,
    ));

    // Queue post-completion tasks
    await this.queueService.addSyncJob({
      syncType: 'inventory',
      tenantId,
      userId,
    }, {
      priority: 3,
      delay: 0,
    });
  }

  private calculateEstimatedStartTime(waves: any[], index: number): Date {
    const baseTime = new Date();
    let cumulativeTime = 0;

    for (let i = 0; i < index; i++) {
      cumulativeTime += parseFloat(waves[i].estimatedPickTime || '0');
    }

    return new Date(baseTime.getTime() + cumulativeTime * 60000); // Convert minutes to milliseconds
  }

  private calculateEstimatedEndTime(waves: any[], index: number): Date {
    const startTime = this.calculateEstimatedStartTime(waves, index);
    const duration = parseFloat(waves[index].estimatedPickTime || '0');
    return new Date(startTime.getTime() + duration * 60000);
  }

  private generateSequenceRecommendations(waves: any[]): any[] {
    const recommendations = [];

    // Check for priority waves mixed with regular waves
    const priorityWaves = waves.filter(w => w.waveType === WaveType.PRIORITY);
    const regularWaves = waves.filter(w => w.waveType === WaveType.STANDARD);

    if (priorityWaves.length > 0 && regularWaves.length > 0) {
      recommendations.push({
        type: 'priority_sequencing',
        priority: 'high',
        description: 'Process priority waves first to meet deadlines',
      });
    }

    // Check for long waves that might block others
    const longWaves = waves.filter(w => parseFloat(w.estimatedPickTime || '0') > 120); // 2 hours
    if (longWaves.length > 0) {
      recommendations.push({
        type: 'wave_splitting',
        priority: 'medium',
        description: 'Consider splitting long waves to improve throughput',
      });
    }

    return recommendations;
  }

  private async invalidateWaveCache(tenantId: string, warehouseId: string, waveId?: string): Promise<void> {
    if (waveId) {
      await this.cacheService.invalidatePattern(`wave:${tenantId}:${waveId}:*`);
    }
    await this.cacheService.invalidatePattern(`waves:${tenantId}:warehouse:${warehouseId}:*`);
    await this.cacheService.invalidatePattern(`waves:${tenantId}:*`);
    await this.cacheService.invalidatePattern(`wave:${tenantId}:stats:*`);
  }
}