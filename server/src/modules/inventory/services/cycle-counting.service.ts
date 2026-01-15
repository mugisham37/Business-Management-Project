import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CycleCountingRepository } from '../repositories/cycle-counting.repository';
import { InventoryService } from './inventory.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

// Domain events
export class StockCountSessionCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly sessionId: string,
    public readonly sessionNumber: string,
    public readonly locationId: string,
    public readonly assignedTo: string[],
  ) {}
}

export class StockCountCompletedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly sessionId: string,
    public readonly sessionNumber: string,
    public readonly locationId: string,
    public readonly totalVariances: number,
    public readonly totalAdjustmentValue: number,
  ) {}
}

export class StockVarianceDetectedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly sessionId: string,
    public readonly productId: string,
    public readonly variantId: string | null,
    public readonly expectedQuantity: number,
    public readonly countedQuantity: number,
    public readonly variance: number,
  ) {}
}

export interface CreateStockCountSessionDto {
  sessionNumber: string;
  name: string;
  description?: string;
  locationId: string;
  categoryIds?: string[];
  productIds?: string[];
  scheduledDate?: Date;
  assignedTo?: string[];
  notes?: string;
}

export interface StockCountSessionQueryDto {
  locationId?: string;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  scheduledDateFrom?: Date;
  scheduledDateTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CountItemDto {
  productId: string;
  variantId?: string;
  countedQuantity: number;
  batchNumber?: string;
  binLocation?: string;
  notes?: string;
}

export interface StockCountItemQueryDto {
  sessionId: string;
  status?: 'pending' | 'counted' | 'adjusted' | 'skipped';
  productId?: string;
  countedBy?: string;
  hasVariance?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class CycleCountingService {
  constructor(
    private readonly cycleCountRepository: CycleCountingRepository,
    private readonly inventoryService: InventoryService,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createStockCountSession(tenantId: string, data: CreateStockCountSessionDto, userId: string): Promise<any> {
    // Validate session number uniqueness
    const existingSession = await this.cycleCountRepository.findBySessionNumber(tenantId, data.sessionNumber);
    if (existingSession) {
      throw new BadRequestException(`Stock count session with number '${data.sessionNumber}' already exists`);
    }

    // Create the session
    const session = await this.cycleCountRepository.createSession(tenantId, data, userId);

    // Generate count items based on scope
    await this.generateCountItems(tenantId, session.id, data, userId);

    // Emit domain event
    this.eventEmitter.emit('stock.count.session.created', new StockCountSessionCreatedEvent(
      tenantId,
      session.id,
      data.sessionNumber,
      data.locationId,
      data.assignedTo || [],
    ));

    // Invalidate cache
    await this.invalidateStockCountCache(tenantId, data.locationId);

    return session;
  }

  async findSessionById(tenantId: string, sessionId: string): Promise<any> {
    const cacheKey = `stock-count:${tenantId}:session:${sessionId}`;
    let session = await this.cacheService.get<any>(cacheKey);

    if (!session) {
      session = await this.cycleCountRepository.findSessionById(tenantId, sessionId);
      if (!session) {
        throw new NotFoundException('Stock count session not found');
      }

      await this.cacheService.set(cacheKey, session, { ttl: 300 }); // 5 minutes
    }

    return session;
  }

  async findSessions(tenantId: string, query: StockCountSessionQueryDto): Promise<{
    sessions: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `stock-count:${tenantId}:sessions:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{
      sessions: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);

    if (!result) {
      result = await this.cycleCountRepository.findSessions(tenantId, query);
      await this.cacheService.set(cacheKey, result, { ttl: 180 }); // 3 minutes
    }

    return result;
  }

  async startStockCountSession(tenantId: string, sessionId: string, userId: string): Promise<any> {
    const session = await this.findSessionById(tenantId, sessionId);

    if (session.status !== 'planned') {
      throw new BadRequestException('Only planned sessions can be started');
    }

    const updatedSession = await this.cycleCountRepository.updateSessionStatus(
      tenantId,
      sessionId,
      'in_progress',
      { startedAt: new Date() },
      userId,
    );

    // Invalidate cache
    await this.invalidateStockCountCache(tenantId, session.locationId);

    return updatedSession;
  }

  async completeStockCountSession(tenantId: string, sessionId: string, userId: string): Promise<any> {
    const session = await this.findSessionById(tenantId, sessionId);

    if (session.status !== 'in_progress') {
      throw new BadRequestException('Only in-progress sessions can be completed');
    }

    // Check if all items have been counted
    const pendingItems = await this.cycleCountRepository.findCountItems(tenantId, {
      sessionId,
      status: 'pending',
    });

    if (pendingItems.items.length > 0) {
      throw new BadRequestException('Cannot complete session with pending count items');
    }

    // Calculate session summary
    const summary = await this.calculateSessionSummary(tenantId, sessionId);

    const updatedSession = await this.cycleCountRepository.updateSessionStatus(
      tenantId,
      sessionId,
      'completed',
      {
        completedAt: new Date(),
        totalItemsCounted: summary.totalItemsCounted,
        totalVariances: summary.totalVariances,
        totalAdjustmentValue: summary.totalAdjustmentValue,
      },
      userId,
    );

    // Emit domain event
    this.eventEmitter.emit('stock.count.completed', new StockCountCompletedEvent(
      tenantId,
      sessionId,
      session.sessionNumber,
      session.locationId,
      summary.totalVariances,
      summary.totalAdjustmentValue,
    ));

    // Invalidate cache
    await this.invalidateStockCountCache(tenantId, session.locationId);

    return updatedSession;
  }

  async countItem(
    tenantId: string,
    sessionId: string,
    itemId: string,
    data: CountItemDto,
    userId: string,
  ): Promise<any> {
    const session = await this.findSessionById(tenantId, sessionId);

    if (session.status !== 'in_progress') {
      throw new BadRequestException('Can only count items in active sessions');
    }

    const item = await this.cycleCountRepository.findCountItemById(tenantId, itemId);
    if (!item || item.sessionId !== sessionId) {
      throw new NotFoundException('Count item not found');
    }

    // Calculate variance
    const variance = data.countedQuantity - item.expectedQuantity;

    // Update count item
    const updateData: any = {
      countedQuantity: data.countedQuantity,
      variance,
      countedBy: userId,
      countedAt: new Date(),
      status: 'counted',
    };

    // Only include optional fields if they are defined
    if (data.batchNumber !== undefined) {
      updateData.batchNumber = data.batchNumber;
    }
    if (data.binLocation !== undefined) {
      updateData.binLocation = data.binLocation;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const updatedItem = await this.cycleCountRepository.updateCountItem(
      tenantId,
      itemId,
      updateData,
      userId,
    );

    // Emit variance event if significant
    if (Math.abs(variance) > 0) {
      this.eventEmitter.emit('stock.variance.detected', new StockVarianceDetectedEvent(
        tenantId,
        sessionId,
        item.productId,
        item.variantId,
        item.expectedQuantity,
        data.countedQuantity,
        variance,
      ));
    }

    // Invalidate cache
    await this.invalidateStockCountCache(tenantId, session.locationId);

    return updatedItem;
  }

  async adjustInventoryFromCount(
    tenantId: string,
    sessionId: string,
    itemId: string,
    userId: string,
  ): Promise<any> {
    const item = await this.cycleCountRepository.findCountItemById(tenantId, itemId);
    if (!item) {
      throw new NotFoundException('Count item not found');
    }

    if (item.status !== 'counted' || (item.variance === null || item.variance === 0)) {
      throw new BadRequestException('Item must be counted with variance to adjust');
    }

    // Perform inventory adjustment
    await this.inventoryService.updateInventoryLevel(
      tenantId,
      item.productId,
      item.variantId || null, // Convert undefined to null
      item.sessionLocationId || '', // Provide default value
      item.countedQuantity || 0, // Provide default value
      'cycle_count',
      userId,
      `Cycle count adjustment - Session: ${item.sessionNumber}`,
    );

    // Update count item status
    const updatedItem = await this.cycleCountRepository.updateCountItem(
      tenantId,
      itemId,
      {
        status: 'adjusted',
        adjustmentId: `cycle-count-${sessionId}-${itemId}`,
      },
      userId,
    );

    return updatedItem;
  }

  async findCountItems(tenantId: string, query: StockCountItemQueryDto): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `stock-count:${tenantId}:items:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{
      items: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);

    if (!result) {
      result = await this.cycleCountRepository.findCountItems(tenantId, query);
      await this.cacheService.set(cacheKey, result, { ttl: 180 }); // 3 minutes
    }

    return result;
  }

  async getSessionSummary(tenantId: string, sessionId: string): Promise<any> {
    const cacheKey = `stock-count:${tenantId}:summary:${sessionId}`;
    let summary = await this.cacheService.get<any>(cacheKey);

    if (!summary) {
      summary = await this.calculateSessionSummary(tenantId, sessionId);
      await this.cacheService.set(cacheKey, summary, { ttl: 300 }); // 5 minutes
    }

    return summary;
  }

  async getVarianceReport(tenantId: string, sessionId: string): Promise<any[]> {
    const cacheKey = `stock-count:${tenantId}:variances:${sessionId}`;
    let variances = await this.cacheService.get<any[]>(cacheKey);

    if (!variances) {
      variances = await this.cycleCountRepository.findVariances(tenantId, sessionId);
      await this.cacheService.set(cacheKey, variances, { ttl: 300 }); // 5 minutes
    }

    return variances;
  }

  private async generateCountItems(
    tenantId: string,
    sessionId: string,
    sessionData: CreateStockCountSessionDto,
    userId: string,
  ): Promise<void> {
    // Get inventory levels based on session scope
    const inventoryQuery: any = {
      locationId: sessionData.locationId,
      page: 1,
      limit: 1000, // Process in batches if needed
    };

    if (sessionData.productIds && sessionData.productIds.length > 0) {
      // Specific products
      for (const productId of sessionData.productIds) {
        const inventoryLevels = await this.inventoryService.getInventoryLevels(tenantId, {
          ...inventoryQuery,
          productId,
        });

        for (const level of inventoryLevels.inventoryLevels) {
          const createItemData: any = {
            sessionId,
            productId: level.productId,
            variantId: level.variantId,
            expectedQuantity: level.currentLevel,
            binLocation: level.binLocation,
          };

          // Only include batchNumber if it has a value
          // (omit it entirely if undefined to satisfy exactOptionalPropertyTypes)

          await this.cycleCountRepository.createCountItem(tenantId, createItemData, userId);
        }
      }
    } else {
      // All products or by category
      const inventoryLevels = await this.inventoryService.getInventoryLevels(tenantId, inventoryQuery);

      for (const level of inventoryLevels.inventoryLevels) {
        // Filter by category if specified
        if (sessionData.categoryIds && sessionData.categoryIds.length > 0) {
          if (!sessionData.categoryIds.includes(level.product?.categoryId)) {
            continue;
          }
        }

        const createItemData2: any = {
          sessionId,
          productId: level.productId,
          variantId: level.variantId,
          expectedQuantity: level.currentLevel,
          binLocation: level.binLocation,
        };

        // Only include batchNumber if it has a value
        // (omit it entirely if undefined to satisfy exactOptionalPropertyTypes)

        await this.cycleCountRepository.createCountItem(tenantId, createItemData2, userId);
      }
    }
  }

  private async calculateSessionSummary(tenantId: string, sessionId: string): Promise<any> {
    const items = await this.cycleCountRepository.findCountItems(tenantId, {
      sessionId,
      page: 1,
      limit: 10000, // Get all items
    });

    let totalItemsCounted = 0;
    let totalVariances = 0;
    let totalAdjustmentValue = 0;

    for (const item of items.items) {
      if (item.status === 'counted' || item.status === 'adjusted') {
        totalItemsCounted++;
        
        if (item.variance !== null && item.variance !== 0) {
          totalVariances++;
          // Calculate adjustment value (variance * average cost)
          totalAdjustmentValue += item.variance * (item.product?.averageCost || 0);
        }
      }
    }

    return {
      totalItemsCounted,
      totalVariances,
      totalAdjustmentValue,
      totalItems: items.total,
      completionPercentage: items.total > 0 ? (totalItemsCounted / items.total) * 100 : 0,
    };
  }

  private async invalidateStockCountCache(tenantId: string, locationId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`stock-count:${tenantId}:*`);
    await this.cacheService.invalidatePattern(`inventory:${tenantId}:*`);
  }
}