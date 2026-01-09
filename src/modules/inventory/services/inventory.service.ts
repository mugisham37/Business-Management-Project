import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InventoryRepository } from '../repositories/inventory.repository';
import { InventoryMovementRepository } from '../repositories/inventory-movement.repository';
import { 
  CreateInventoryLevelDto, 
  UpdateInventoryLevelDto, 
  InventoryAdjustmentDto,
  InventoryTransferDto,
  InventoryQueryDto 
} from '../dto/inventory.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';

// Domain events
export class InventoryLevelChangedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly variantId: string | null,
    public readonly locationId: string,
    public readonly previousLevel: number,
    public readonly newLevel: number,
    public readonly changeReason: string,
    public readonly userId: string,
  ) {}
}

export class LowStockAlertEvent {
  constructor(
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly variantId: string | null,
    public readonly locationId: string,
    public readonly currentLevel: number,
    public readonly reorderPoint: number,
  ) {}
}

export class InventoryTransferEvent {
  constructor(
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly variantId: string | null,
    public readonly fromLocationId: string,
    public readonly toLocationId: string,
    public readonly quantity: number,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly movementRepository: InventoryMovementRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createInventoryLevel(tenantId: string, data: CreateInventoryLevelDto, userId: string): Promise<any> {
    // Check if inventory level already exists
    const existing = await this.inventoryRepository.findByProductAndLocation(
      tenantId,
      data.productId,
      data.variantId,
      data.locationId,
    );

    if (existing) {
      throw new BadRequestException('Inventory level already exists for this product and location');
    }

    const inventoryLevel = await this.inventoryRepository.create(tenantId, data, userId);

    // Create initial movement record if starting with stock
    if (data.currentLevel && data.currentLevel > 0) {
      await this.movementRepository.create(tenantId, {
        productId: data.productId,
        variantId: data.variantId,
        locationId: data.locationId,
        movementType: 'adjustment',
        quantity: data.currentLevel,
        previousLevel: 0,
        newLevel: data.currentLevel,
        reason: 'initial_stock',
        notes: 'Initial inventory setup',
      }, userId);
    }

    // Invalidate cache
    await this.invalidateInventoryCache(tenantId, data.productId, data.locationId);

    return inventoryLevel;
  }

  async getInventoryLevel(tenantId: string, productId: string, variantId: string | null, locationId: string): Promise<any> {
    const cacheKey = `inventory:${tenantId}:${productId}:${variantId || 'null'}:${locationId}`;
    let inventoryLevel = await this.cacheService.get(cacheKey);

    if (!inventoryLevel) {
      inventoryLevel = await this.inventoryRepository.findByProductAndLocation(
        tenantId,
        productId,
        variantId,
        locationId,
      );

      if (!inventoryLevel) {
        throw new NotFoundException('Inventory level not found');
      }

      await this.cacheService.set(cacheKey, inventoryLevel, 300); // 5 minutes
    }

    return inventoryLevel;
  }

  async getInventoryLevels(tenantId: string, query: InventoryQueryDto): Promise<{
    inventoryLevels: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `inventory:${tenantId}:levels:${JSON.stringify(query)}`;
    let result = await this.cacheService.get(cacheKey);

    if (!result) {
      result = await this.inventoryRepository.findMany(tenantId, query);
      await this.cacheService.set(cacheKey, result, 180); // 3 minutes
    }

    return result;
  }

  async updateInventoryLevel(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    newLevel: number,
    reason: string,
    userId: string,
    notes?: string,
  ): Promise<any> {
    if (newLevel < 0) {
      throw new BadRequestException('Inventory level cannot be negative');
    }

    const currentInventory = await this.getInventoryLevel(tenantId, productId, variantId, locationId);
    const previousLevel = currentInventory.currentLevel;

    // Update inventory level
    const updatedInventory = await this.inventoryRepository.updateLevel(
      tenantId,
      productId,
      variantId,
      locationId,
      newLevel,
      userId,
    );

    // Create movement record
    await this.movementRepository.create(tenantId, {
      productId,
      variantId,
      locationId,
      movementType: 'adjustment',
      quantity: newLevel - previousLevel,
      previousLevel,
      newLevel,
      reason: reason as any,
      notes,
    }, userId);

    // Emit domain event
    this.eventEmitter.emit('inventory.level.changed', new InventoryLevelChangedEvent(
      tenantId,
      productId,
      variantId,
      locationId,
      previousLevel,
      newLevel,
      reason,
      userId,
    ));

    // Check for low stock alert
    if (newLevel <= updatedInventory.reorderPoint && newLevel > 0) {
      this.eventEmitter.emit('inventory.low.stock', new LowStockAlertEvent(
        tenantId,
        productId,
        variantId,
        locationId,
        newLevel,
        updatedInventory.reorderPoint,
      ));
    }

    // Invalidate cache
    await this.invalidateInventoryCache(tenantId, productId, locationId);

    return updatedInventory;
  }

  async adjustInventory(tenantId: string, data: InventoryAdjustmentDto, userId: string): Promise<any> {
    const currentInventory = await this.getInventoryLevel(
      tenantId,
      data.productId,
      data.variantId,
      data.locationId,
    );

    const newLevel = currentInventory.currentLevel + data.adjustment;

    if (newLevel < 0) {
      throw new BadRequestException('Adjustment would result in negative inventory');
    }

    return this.updateInventoryLevel(
      tenantId,
      data.productId,
      data.variantId,
      data.locationId,
      newLevel,
      data.reason,
      userId,
      data.notes,
    );
  }

  async transferInventory(tenantId: string, data: InventoryTransferDto, userId: string): Promise<void> {
    if (data.fromLocationId === data.toLocationId) {
      throw new BadRequestException('Cannot transfer to the same location');
    }

    if (data.quantity <= 0) {
      throw new BadRequestException('Transfer quantity must be positive');
    }

    // Check source inventory
    const sourceInventory = await this.getInventoryLevel(
      tenantId,
      data.productId,
      data.variantId,
      data.fromLocationId,
    );

    if (sourceInventory.availableLevel < data.quantity) {
      throw new BadRequestException('Insufficient inventory for transfer');
    }

    // Get or create destination inventory
    let destinationInventory;
    try {
      destinationInventory = await this.getInventoryLevel(
        tenantId,
        data.productId,
        data.variantId,
        data.toLocationId,
      );
    } catch (error) {
      // Create destination inventory level if it doesn't exist
      destinationInventory = await this.inventoryRepository.create(tenantId, {
        productId: data.productId,
        variantId: data.variantId,
        locationId: data.toLocationId,
        currentLevel: 0,
        minStockLevel: 0,
        reorderPoint: 0,
        reorderQuantity: 0,
      }, userId);
    }

    // Perform transfer in transaction
    await this.inventoryRepository.performTransfer(
      tenantId,
      data.productId,
      data.variantId,
      data.fromLocationId,
      data.toLocationId,
      data.quantity,
      userId,
      data.notes,
    );

    // Emit domain event
    this.eventEmitter.emit('inventory.transfer', new InventoryTransferEvent(
      tenantId,
      data.productId,
      data.variantId,
      data.fromLocationId,
      data.toLocationId,
      data.quantity,
      userId,
    ));

    // Invalidate cache for both locations
    await this.invalidateInventoryCache(tenantId, data.productId, data.fromLocationId);
    await this.invalidateInventoryCache(tenantId, data.productId, data.toLocationId);
  }

  async reserveInventory(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    quantity: number,
    reservedFor: string,
    referenceId: string,
    userId: string,
  ): Promise<any> {
    const inventory = await this.getInventoryLevel(tenantId, productId, variantId, locationId);

    if (inventory.availableLevel < quantity) {
      throw new BadRequestException('Insufficient available inventory for reservation');
    }

    const reservation = await this.inventoryRepository.createReservation(
      tenantId,
      productId,
      variantId,
      locationId,
      quantity,
      reservedFor,
      referenceId,
      userId,
    );

    // Update available level
    await this.inventoryRepository.updateReservedLevel(
      tenantId,
      productId,
      variantId,
      locationId,
      inventory.reservedLevel + quantity,
    );

    // Invalidate cache
    await this.invalidateInventoryCache(tenantId, productId, locationId);

    return reservation;
  }

  async releaseReservation(tenantId: string, reservationId: string, userId: string): Promise<void> {
    const reservation = await this.inventoryRepository.findReservation(tenantId, reservationId);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    // Update reservation status
    await this.inventoryRepository.updateReservationStatus(tenantId, reservationId, 'cancelled', userId);

    // Update available level
    const inventory = await this.getInventoryLevel(
      tenantId,
      reservation.productId,
      reservation.variantId,
      reservation.locationId,
    );

    await this.inventoryRepository.updateReservedLevel(
      tenantId,
      reservation.productId,
      reservation.variantId,
      reservation.locationId,
      inventory.reservedLevel - reservation.quantity,
    );

    // Invalidate cache
    await this.invalidateInventoryCache(tenantId, reservation.productId, reservation.locationId);
  }

  async getLowStockProducts(tenantId: string, locationId?: string): Promise<any[]> {
    const cacheKey = `inventory:${tenantId}:low-stock:${locationId || 'all'}`;
    let lowStockProducts = await this.cacheService.get(cacheKey);

    if (!lowStockProducts) {
      lowStockProducts = await this.inventoryRepository.findLowStockProducts(tenantId, locationId);
      await this.cacheService.set(cacheKey, lowStockProducts, 300); // 5 minutes
    }

    return lowStockProducts;
  }

  async getInventoryMovements(tenantId: string, productId: string, locationId?: string): Promise<any[]> {
    const cacheKey = `inventory:${tenantId}:movements:${productId}:${locationId || 'all'}`;
    let movements = await this.cacheService.get(cacheKey);

    if (!movements) {
      movements = await this.movementRepository.findByProduct(tenantId, productId, locationId);
      await this.cacheService.set(cacheKey, movements, 180); // 3 minutes
    }

    return movements;
  }

  async processLowStockAlerts(tenantId: string): Promise<void> {
    const lowStockProducts = await this.getLowStockProducts(tenantId);

    for (const product of lowStockProducts) {
      // Queue notification job
      await this.queueService.add('send-low-stock-alert', {
        tenantId,
        productId: product.productId,
        variantId: product.variantId,
        locationId: product.locationId,
        currentLevel: product.currentLevel,
        reorderPoint: product.reorderPoint,
      });
    }
  }

  private async invalidateInventoryCache(tenantId: string, productId: string, locationId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`inventory:${tenantId}:${productId}:*`);
    await this.cacheService.invalidatePattern(`inventory:${tenantId}:levels:*`);
    await this.cacheService.invalidatePattern(`inventory:${tenantId}:low-stock:*`);
    await this.cacheService.invalidatePattern(`inventory:${tenantId}:movements:*`);
  }
}