import { Injectable } from '@nestjs/common';
import { InventoryRepository } from '../repositories/inventory.repository';
import { BatchTrackingRepository } from '../repositories/batch-tracking.repository';
import { InventoryMovementRepository } from '../repositories/inventory-movement.repository';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface ValuationResult {
  productId: string;
  variantId?: string;
  locationId: string;
  currentQuantity: number;
  valuationMethod: 'fifo' | 'lifo' | 'average' | 'specific';
  unitCost: number;
  totalValue: number;
  batches?: BatchValuation[];
}

export interface BatchValuation {
  batchId: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  receivedDate: Date;
  expiryDate?: Date;
}

export interface ValuationSummary {
  totalInventoryValue: number;
  totalQuantity: number;
  averageCost: number;
  valuationsByLocation: LocationValuation[];
  valuationsByProduct: ProductValuation[];
}

export interface LocationValuation {
  locationId: string;
  totalValue: number;
  totalQuantity: number;
  averageCost: number;
  productCount: number;
}

export interface ProductValuation {
  productId: string;
  productName: string;
  totalValue: number;
  totalQuantity: number;
  averageCost: number;
  locationCount: number;
}

export interface ValuationQueryDto {
  locationId?: string;
  productId?: string;
  categoryId?: string;
  valuationMethod?: 'fifo' | 'lifo' | 'average' | 'specific';
  asOfDate?: Date;
  includeZeroQuantity?: boolean;
}

@Injectable()
export class InventoryValuationService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly batchRepository: BatchTrackingRepository,
    private readonly movementRepository: InventoryMovementRepository,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  async calculateInventoryValuation(tenantId: string, query: ValuationQueryDto = {}): Promise<ValuationResult[]> {
    const cacheKey = `inventory:${tenantId}:valuation:${JSON.stringify(query)}`;
    let valuations = await this.cacheService.get<ValuationResult[]>(cacheKey);

    if (!valuations) {
      // Get inventory levels based on query
      const inventoryQuery: any = {
        page: 1,
        limit: 10000, // Get all items
      };

      if (query.locationId) {
        inventoryQuery.locationId = query.locationId;
      }

      if (query.productId) {
        inventoryQuery.productId = query.productId;
      }

      if (!query.includeZeroQuantity) {
        inventoryQuery.outOfStock = false;
      }

      const inventoryLevels = await this.inventoryRepository.findMany(tenantId, inventoryQuery);
      
      valuations = [];

      for (const level of inventoryLevels.inventoryLevels) {
        if (level.currentLevel === 0 && !query.includeZeroQuantity) {
          continue;
        }

        const valuation = await this.calculateProductValuation(
          tenantId,
          level.productId,
          level.variantId || null, // Convert undefined to null
          level.locationId,
          query.valuationMethod || level.valuationMethod as any,
          query.asOfDate,
        );

        if (valuation) {
          valuations.push(valuation);
        }
      }

      await this.cacheService.set(cacheKey, valuations, { ttl: 300 }); // 5 minutes
    }

    return valuations;
  }

  async calculateProductValuation(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    valuationMethod: 'fifo' | 'lifo' | 'average' | 'specific',
    asOfDate?: Date,
  ): Promise<ValuationResult | null> {
    const inventoryLevel = await this.inventoryRepository.findByProductAndLocation(
      tenantId,
      productId,
      variantId,
      locationId,
    );

    if (!inventoryLevel || inventoryLevel.currentLevel === 0) {
      return null;
    }

    let unitCost = 0;
    let totalValue = 0;
    let batches: BatchValuation[] = [];

    switch (valuationMethod) {
      case 'fifo':
        ({ unitCost, totalValue, batches } = await this.calculateFIFOValuation(
          tenantId,
          productId,
          variantId,
          locationId,
          inventoryLevel.currentLevel,
          asOfDate,
        ));
        break;

      case 'lifo':
        ({ unitCost, totalValue, batches } = await this.calculateLIFOValuation(
          tenantId,
          productId,
          variantId,
          locationId,
          inventoryLevel.currentLevel,
          asOfDate,
        ));
        break;

      case 'average':
        ({ unitCost, totalValue } = await this.calculateAverageValuation(
          tenantId,
          productId,
          variantId,
          locationId,
          inventoryLevel.currentLevel,
          asOfDate,
        ));
        break;

      case 'specific':
        ({ unitCost, totalValue, batches } = await this.calculateSpecificValuation(
          tenantId,
          productId,
          variantId,
          locationId,
          inventoryLevel.currentLevel,
          asOfDate,
        ));
        break;

      default:
        // Fallback to average cost from inventory level
        unitCost = inventoryLevel.averageCost;
        totalValue = inventoryLevel.currentLevel * unitCost;
        break;
    }

    const result: ValuationResult = {
      productId,
      locationId,
      currentQuantity: inventoryLevel.currentLevel,
      valuationMethod,
      unitCost,
      totalValue,
    };

    // Only add optional properties if they exist
    if (variantId) {
      result.variantId = variantId;
    }
    if (batches.length > 0) {
      result.batches = batches;
    }

    return result;
  }

  async getValuationSummary(tenantId: string, query: ValuationQueryDto = {}): Promise<ValuationSummary> {
    const cacheKey = `inventory:${tenantId}:valuation-summary:${JSON.stringify(query)}`;
    let summary = await this.cacheService.get<ValuationSummary>(cacheKey);

    if (!summary) {
      const valuations = await this.calculateInventoryValuation(tenantId, query);

      let totalInventoryValue = 0;
      let totalQuantity = 0;
      const locationMap = new Map<string, LocationValuation>();
      const productMap = new Map<string, ProductValuation>();

      for (const valuation of valuations) {
        totalInventoryValue += valuation.totalValue;
        totalQuantity += valuation.currentQuantity;

        // Location summary
        const locationKey = valuation.locationId;
        if (!locationMap.has(locationKey)) {
          locationMap.set(locationKey, {
            locationId: valuation.locationId,
            totalValue: 0,
            totalQuantity: 0,
            averageCost: 0,
            productCount: 0,
          });
        }

        const locationVal = locationMap.get(locationKey)!;
        locationVal.totalValue += valuation.totalValue;
        locationVal.totalQuantity += valuation.currentQuantity;
        locationVal.productCount++;

        // Product summary
        const productKey = valuation.productId;
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            productId: valuation.productId,
            productName: '', // Will be filled from inventory level
            totalValue: 0,
            totalQuantity: 0,
            averageCost: 0,
            locationCount: 0,
          });
        }

        const productVal = productMap.get(productKey)!;
        productVal.totalValue += valuation.totalValue;
        productVal.totalQuantity += valuation.currentQuantity;
        productVal.locationCount++;
      }

      // Calculate average costs
      for (const locationVal of locationMap.values()) {
        locationVal.averageCost = locationVal.totalQuantity > 0 ? 
          locationVal.totalValue / locationVal.totalQuantity : 0;
      }

      for (const productVal of productMap.values()) {
        productVal.averageCost = productVal.totalQuantity > 0 ? 
          productVal.totalValue / productVal.totalQuantity : 0;
      }

      const averageCost = totalQuantity > 0 ? totalInventoryValue / totalQuantity : 0;

      summary = {
        totalInventoryValue,
        totalQuantity,
        averageCost,
        valuationsByLocation: Array.from(locationMap.values()),
        valuationsByProduct: Array.from(productMap.values()),
      };

      await this.cacheService.set(cacheKey, summary, { ttl: 300 }); // 5 minutes
    }

    return summary;
  }

  async updateInventoryValuation(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
  ): Promise<void> {
    const inventoryLevel = await this.inventoryRepository.findByProductAndLocation(
      tenantId,
      productId,
      variantId,
      locationId,
    );

    if (!inventoryLevel) {
      return;
    }

    // Calculate new valuation based on current method
    const valuation = await this.calculateProductValuation(
      tenantId,
      productId,
      variantId,
      locationId,
      inventoryLevel.valuationMethod as any,
    );

    if (valuation) {
      // Update inventory level with new valuation
      await this.inventoryRepository.updateLevel(
        tenantId,
        productId,
        variantId,
        locationId,
        inventoryLevel.currentLevel,
        'system',
      );

      // Update average cost and total value
      // This would require adding methods to inventory repository
    }

    // Invalidate cache
    await this.cacheService.invalidatePattern(`inventory:${tenantId}:valuation*`);
  }

  private async calculateFIFOValuation(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    currentQuantity: number,
    asOfDate?: Date,
  ): Promise<{ unitCost: number; totalValue: number; batches: BatchValuation[] }> {
    const batches = await this.batchRepository.findFIFOBatches(tenantId, productId, variantId, locationId);
    
    let remainingQuantity = currentQuantity;
    let totalValue = 0;
    const valuationBatches: BatchValuation[] = [];

    for (const batch of batches) {
      if (remainingQuantity <= 0) break;

      // Filter by date if specified
      if (asOfDate && batch.receivedDate > asOfDate) {
        continue;
      }

      const quantityToUse = Math.min(remainingQuantity, batch.currentQuantity);
      const batchValue = quantityToUse * batch.unitCost;

      totalValue += batchValue;
      remainingQuantity -= quantityToUse;

      const batchValuation: BatchValuation = {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: quantityToUse,
        unitCost: batch.unitCost,
        totalValue: batchValue,
        receivedDate: batch.receivedDate,
      };

      // Only add expiryDate if it exists
      if (batch.expiryDate) {
        batchValuation.expiryDate = batch.expiryDate;
      }

      valuationBatches.push(batchValuation);
    }

    const unitCost = currentQuantity > 0 ? totalValue / currentQuantity : 0;

    return { unitCost, totalValue, batches: valuationBatches };
  }

  private async calculateLIFOValuation(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    currentQuantity: number,
    asOfDate?: Date,
  ): Promise<{ unitCost: number; totalValue: number; batches: BatchValuation[] }> {
    const batches = await this.batchRepository.findLIFOBatches(tenantId, productId, variantId, locationId);
    
    let remainingQuantity = currentQuantity;
    let totalValue = 0;
    const valuationBatches: BatchValuation[] = [];

    for (const batch of batches) {
      if (remainingQuantity <= 0) break;

      // Filter by date if specified
      if (asOfDate && batch.receivedDate > asOfDate) {
        continue;
      }

      const quantityToUse = Math.min(remainingQuantity, batch.currentQuantity);
      const batchValue = quantityToUse * batch.unitCost;

      totalValue += batchValue;
      remainingQuantity -= quantityToUse;

      const batchValuation: BatchValuation = {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: quantityToUse,
        unitCost: batch.unitCost,
        totalValue: batchValue,
        receivedDate: batch.receivedDate,
      };

      // Only add expiryDate if it exists
      if (batch.expiryDate) {
        batchValuation.expiryDate = batch.expiryDate;
      }

      valuationBatches.push(batchValuation);
    }

    const unitCost = currentQuantity > 0 ? totalValue / currentQuantity : 0;

    return { unitCost, totalValue, batches: valuationBatches };
  }

  private async calculateAverageValuation(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    currentQuantity: number,
    asOfDate?: Date,
  ): Promise<{ unitCost: number; totalValue: number }> {
    // Get all movements for this product/location
    const movements = await this.movementRepository.findByProduct(tenantId, productId, locationId);
    
    let totalCost = 0;
    let totalQuantityReceived = 0;

    for (const movement of movements) {
      // Filter by date if specified
      if (asOfDate && movement.createdAt > asOfDate) {
        continue;
      }

      // Only consider inbound movements with cost
      if (movement.quantity > 0 && movement.unitCost && movement.unitCost > 0) {
        totalCost += movement.quantity * movement.unitCost;
        totalQuantityReceived += movement.quantity;
      }
    }

    const unitCost = totalQuantityReceived > 0 ? totalCost / totalQuantityReceived : 0;
    const totalValue = currentQuantity * unitCost;

    return { unitCost, totalValue };
  }

  private async calculateSpecificValuation(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    currentQuantity: number,
    asOfDate?: Date,
  ): Promise<{ unitCost: number; totalValue: number; batches: BatchValuation[] }> {
    // For specific identification, use actual batch costs
    const batches = await this.batchRepository.findFIFOBatches(tenantId, productId, variantId, locationId);
    
    let totalValue = 0;
    const valuationBatches: BatchValuation[] = [];

    for (const batch of batches) {
      // Filter by date if specified
      if (asOfDate && batch.receivedDate > asOfDate) {
        continue;
      }

      const batchValue = batch.currentQuantity * batch.unitCost;
      totalValue += batchValue;

      const batchValuation: BatchValuation = {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: batch.currentQuantity,
        unitCost: batch.unitCost,
        totalValue: batchValue,
        receivedDate: batch.receivedDate,
      };

      // Only add expiryDate if it exists
      if (batch.expiryDate) {
        batchValuation.expiryDate = batch.expiryDate;
      }

      valuationBatches.push(batchValuation);
    }

    const unitCost = currentQuantity > 0 ? totalValue / currentQuantity : 0;

    return { unitCost, totalValue, batches: valuationBatches };
  }
}