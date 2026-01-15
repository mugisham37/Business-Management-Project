import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BatchTrackingRepository } from '../repositories/batch-tracking.repository';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

// Domain events
export class BatchCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly batchId: string,
    public readonly productId: string,
    public readonly variantId: string | null,
    public readonly locationId: string,
    public readonly batchNumber: string,
    public readonly quantity: number,
    public readonly expiryDate?: Date,
  ) {}
}

export class BatchExpiredEvent {
  constructor(
    public readonly tenantId: string,
    public readonly batchId: string,
    public readonly productId: string,
    public readonly batchNumber: string,
    public readonly locationId: string,
    public readonly quantity: number,
    public readonly expiryDate: Date,
  ) {}
}

export class BatchRecallEvent {
  constructor(
    public readonly tenantId: string,
    public readonly batchId: string,
    public readonly productId: string,
    public readonly batchNumber: string,
    public readonly reason: string,
    public readonly affectedLocations: string[],
  ) {}
}

export interface CreateBatchDto {
  productId: string;
  variantId?: string;
  locationId: string;
  batchNumber: string;
  lotNumber?: string;
  serialNumbers?: string[];
  originalQuantity: number;
  unitCost: number;
  receivedDate: Date;
  manufactureDate?: Date;
  expiryDate?: Date;
  supplierId?: string;
  supplierBatchNumber?: string;
  qualityStatus?: 'approved' | 'rejected' | 'quarantine' | 'testing';
  qualityNotes?: string;
  binLocation?: string;
  attributes?: Record<string, any>;
}

export interface BatchQueryDto {
  productId?: string;
  locationId?: string;
  batchNumber?: string;
  status?: 'active' | 'consumed' | 'expired' | 'recalled';
  qualityStatus?: 'approved' | 'rejected' | 'quarantine' | 'testing';
  expiringBefore?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class BatchTrackingService {
  constructor(
    private readonly batchRepository: BatchTrackingRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createBatch(tenantId: string, data: CreateBatchDto, userId: string): Promise<any> {
    // Validate batch number uniqueness within location
    const existingBatch = await this.batchRepository.findByBatchNumber(
      tenantId,
      data.batchNumber,
      data.locationId,
    );

    if (existingBatch) {
      throw new BadRequestException(`Batch with number '${data.batchNumber}' already exists at this location`);
    }

    // Validate expiry date is in the future
    if (data.expiryDate && data.expiryDate <= new Date()) {
      throw new BadRequestException('Expiry date must be in the future');
    }

    const batch = await this.batchRepository.create(tenantId, data, userId);

    // Emit domain event
    this.eventEmitter.emit('batch.created', new BatchCreatedEvent(
      tenantId,
      batch.id,
      data.productId,
      data.variantId || null,
      data.locationId,
      data.batchNumber,
      data.originalQuantity,
      data.expiryDate,
    ));

    // Invalidate cache
    await this.invalidateBatchCache(tenantId, data.productId, data.locationId);

    return batch;
  }

  async findById(tenantId: string, id: string): Promise<any> {
    const cacheKey = `batch:${tenantId}:${id}`;
    let batch = await this.cacheService.get<any>(cacheKey);

    if (!batch) {
      batch = await this.batchRepository.findById(tenantId, id);
      if (!batch) {
        throw new NotFoundException('Batch not found');
      }

      await this.cacheService.set(cacheKey, batch, { ttl: 300 }); // 5 minutes
    }

    return batch;
  }

  async findByBatchNumber(tenantId: string, batchNumber: string, locationId: string): Promise<any> {
    const cacheKey = `batch:${tenantId}:${batchNumber}:${locationId}`;
    let batch = await this.cacheService.get<any>(cacheKey);

    if (!batch) {
      batch = await this.batchRepository.findByBatchNumber(tenantId, batchNumber, locationId);
      if (!batch) {
        throw new NotFoundException('Batch not found');
      }

      await this.cacheService.set(cacheKey, batch, { ttl: 300 }); // 5 minutes
    }

    return batch;
  }

  async findBatches(tenantId: string, query: BatchQueryDto): Promise<{
    batches: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `batches:${tenantId}:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{
      batches: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);

    if (!result) {
      result = await this.batchRepository.findMany(tenantId, query);
      await this.cacheService.set(cacheKey, result, { ttl: 180 }); // 3 minutes
    }

    return result;
  }

  async consumeBatch(
    tenantId: string,
    batchId: string,
    quantity: number,
    reason: string,
    userId: string,
  ): Promise<any> {
    const batch = await this.findById(tenantId, batchId);

    if (batch.currentQuantity < quantity) {
      throw new BadRequestException('Insufficient quantity in batch');
    }

    if (batch.status !== 'active') {
      throw new BadRequestException('Cannot consume from inactive batch');
    }

    const updatedBatch = await this.batchRepository.consumeQuantity(
      tenantId,
      batchId,
      quantity,
      reason,
      userId,
    );

    // Invalidate cache
    await this.invalidateBatchCache(tenantId, batch.productId, batch.locationId);

    return updatedBatch;
  }

  async getExpiringBatches(tenantId: string, daysAhead: number = 30, locationId?: string): Promise<any[]> {
    const cacheKey = `batches:${tenantId}:expiring:${daysAhead}:${locationId || 'all'}`;
    let expiringBatches = await this.cacheService.get<any[]>(cacheKey);

    if (!expiringBatches) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + daysAhead);

      expiringBatches = await this.batchRepository.findExpiringBatches(tenantId, expiryDate, locationId);
      await this.cacheService.set(cacheKey, expiringBatches, { ttl: 300 }); // 5 minutes
    }

    return expiringBatches;
  }

  async processExpiredBatches(tenantId: string): Promise<void> {
    const expiredBatches = await this.batchRepository.findExpiredBatches(tenantId);

    for (const batch of expiredBatches) {
      // Mark batch as expired
      await this.batchRepository.updateStatus(tenantId, batch.id, 'expired', 'system');

      // Emit domain event
      this.eventEmitter.emit('batch.expired', new BatchExpiredEvent(
        tenantId,
        batch.id,
        batch.productId,
        batch.batchNumber,
        batch.locationId,
        batch.currentQuantity,
        batch.expiryDate!, // We know it exists since we found expired batches
      ));
    }

    // Invalidate cache
    await this.cacheService.invalidatePattern(`batches:${tenantId}:*`);
  }

  async recallBatch(
    tenantId: string,
    batchNumber: string,
    reason: string,
    userId: string,
  ): Promise<any[]> {
    // Find all batches with this batch number across all locations
    const batches = await this.batchRepository.findByBatchNumberAllLocations(tenantId, batchNumber);

    if (batches.length === 0) {
      throw new NotFoundException('No batches found with this batch number');
    }

    const affectedLocations: string[] = [];
    const recalledBatches: any[] = [];

    for (const batch of batches) {
      if (batch.status === 'active') {
        // Mark batch as recalled
        const updatedBatch = await this.batchRepository.updateStatus(
          tenantId,
          batch.id,
          'recalled',
          userId,
        );

        recalledBatches.push(updatedBatch);
        affectedLocations.push(batch.locationId);
      }
    }

    // Emit domain event
    if (recalledBatches.length > 0) {
      this.eventEmitter.emit('batch.recall', new BatchRecallEvent(
        tenantId,
        recalledBatches[0].id,
        recalledBatches[0].productId,
        batchNumber,
        reason,
        affectedLocations,
      ));
    }

    // Invalidate cache
    await this.cacheService.invalidatePattern(`batches:${tenantId}:*`);

    return recalledBatches;
  }

  async getFIFOBatches(tenantId: string, productId: string, variantId: string | null, locationId: string): Promise<any[]> {
    const cacheKey = `batches:${tenantId}:fifo:${productId}:${variantId || 'null'}:${locationId}`;
    let fifoBatches = await this.cacheService.get<any[]>(cacheKey);

    if (!fifoBatches) {
      fifoBatches = await this.batchRepository.findFIFOBatches(tenantId, productId, variantId, locationId);
      await this.cacheService.set(cacheKey, fifoBatches, { ttl: 180 }); // 3 minutes
    }

    return fifoBatches;
  }

  async getLIFOBatches(tenantId: string, productId: string, variantId: string | null, locationId: string): Promise<any[]> {
    const cacheKey = `batches:${tenantId}:lifo:${productId}:${variantId || 'null'}:${locationId}`;
    let lifoBatches = await this.cacheService.get<any[]>(cacheKey);

    if (!lifoBatches) {
      lifoBatches = await this.batchRepository.findLIFOBatches(tenantId, productId, variantId, locationId);
      await this.cacheService.set(cacheKey, lifoBatches, { ttl: 180 }); // 3 minutes
    }

    return lifoBatches;
  }

  async getFEFOBatches(tenantId: string, productId: string, variantId: string | null, locationId: string): Promise<any[]> {
    const cacheKey = `batches:${tenantId}:fefo:${productId}:${variantId || 'null'}:${locationId}`;
    let fefoBatches = await this.cacheService.get<any[]>(cacheKey);

    if (!fefoBatches) {
      fefoBatches = await this.batchRepository.findFEFOBatches(tenantId, productId, variantId, locationId);
      await this.cacheService.set(cacheKey, fefoBatches, { ttl: 180 }); // 3 minutes
    }

    return fefoBatches;
  }

  async updateQualityStatus(
    tenantId: string,
    batchId: string,
    qualityStatus: 'approved' | 'rejected' | 'quarantine' | 'testing',
    qualityNotes: string,
    userId: string,
  ): Promise<any> {
    const updatedBatch = await this.batchRepository.updateQualityStatus(
      tenantId,
      batchId,
      qualityStatus,
      qualityNotes,
      userId,
    );

    // Invalidate cache
    const batch = await this.findById(tenantId, batchId);
    await this.invalidateBatchCache(tenantId, batch.productId, batch.locationId);

    return updatedBatch;
  }

  async getBatchHistory(tenantId: string, batchId: string): Promise<any[]> {
    const cacheKey = `batch:${tenantId}:${batchId}:history`;
    let history = await this.cacheService.get<any[]>(cacheKey);

    if (!history) {
      history = await this.batchRepository.getBatchHistory(tenantId, batchId);
      await this.cacheService.set(cacheKey, history, { ttl: 300 }); // 5 minutes
    }

    return history;
  }

  private async invalidateBatchCache(tenantId: string, productId: string, locationId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`batches:${tenantId}:*`);
    await this.cacheService.invalidatePattern(`batch:${tenantId}:*`);
  }
}