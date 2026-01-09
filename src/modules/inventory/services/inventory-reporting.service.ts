import { Injectable } from '@nestjs/common';
import { InventoryRepository } from '../repositories/inventory.repository';
import { InventoryMovementRepository } from '../repositories/inventory-movement.repository';
import { BatchTrackingRepository } from '../repositories/batch-tracking.repository';
import { InventoryValuationService } from './inventory-valuation.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface InventoryReport {
  reportType: string;
  generatedAt: Date;
  parameters: any;
  data: any;
  summary: any;
}

export interface StockLevelReport {
  products: StockLevelItem[];
  summary: {
    totalProducts: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    overstockItems: number;
  };
}

export interface StockLevelItem {
  productId: string;
  productName: string;
  sku: string;
  variantId?: string;
  variantName?: string;
  locationId: string;
  locationName?: string;
  currentLevel: number;
  availableLevel: number;
  reservedLevel: number;
  reorderPoint: number;
  maxStockLevel?: number;
  unitCost: number;
  totalValue: number;
  status: 'normal' | 'low_stock' | 'out_of_stock' | 'overstock';
  lastMovementAt?: Date;
  daysWithoutMovement?: number;
}

export interface MovementReport {
  movements: MovementItem[];
  summary: {
    totalMovements: number;
    totalInbound: number;
    totalOutbound: number;
    netMovement: number;
    valueChange: number;
  };
}

export interface MovementItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  variantId?: string;
  locationId: string;
  movementType: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  previousLevel: number;
  newLevel: number;
  referenceType?: string;
  referenceId?: string;
  batchNumber?: string;
  reason?: string;
  notes?: string;
  createdAt: Date;
  createdBy?: string;
}

export interface AgingReport {
  items: AgingItem[];
  summary: {
    totalItems: number;
    totalValue: number;
    averageAge: number;
    itemsByAgeGroup: { [key: string]: number };
    valueByAgeGroup: { [key: string]: number };
  };
}

export interface AgingItem {
  productId: string;
  productName: string;
  sku: string;
  variantId?: string;
  locationId: string;
  batchNumber?: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  receivedDate: Date;
  ageInDays: number;
  ageGroup: string;
  expiryDate?: Date;
  daysUntilExpiry?: number;
}

export interface TurnoverReport {
  products: TurnoverItem[];
  summary: {
    averageTurnover: number;
    fastMovingItems: number;
    slowMovingItems: number;
    deadStockItems: number;
  };
}

export interface TurnoverItem {
  productId: string;
  productName: string;
  sku: string;
  variantId?: string;
  locationId: string;
  averageInventory: number;
  costOfGoodsSold: number;
  turnoverRatio: number;
  turnoverCategory: 'fast' | 'medium' | 'slow' | 'dead';
  daysOfSupply: number;
  lastSaleDate?: Date;
  daysSinceLastSale?: number;
}

export interface ReportQueryDto {
  locationId?: string;
  productId?: string;
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  includeInactive?: boolean;
  groupBy?: 'product' | 'location' | 'category' | 'batch';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class InventoryReportingService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly movementRepository: InventoryMovementRepository,
    private readonly batchRepository: BatchTrackingRepository,
    private readonly valuationService: InventoryValuationService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  async generateStockLevelReport(tenantId: string, query: ReportQueryDto = {}): Promise<InventoryReport> {
    const cacheKey = `inventory:${tenantId}:report:stock-level:${JSON.stringify(query)}`;
    let report = await this.cacheService.get<InventoryReport>(cacheKey);

    if (!report) {
      // Get inventory levels
      const inventoryQuery: any = {
        page: 1,
        limit: 10000,
      };

      if (query.locationId) {
        inventoryQuery.locationId = query.locationId;
      }

      if (query.productId) {
        inventoryQuery.productId = query.productId;
      }

      const inventoryLevels = await this.inventoryRepository.findMany(tenantId, inventoryQuery);
      
      const products: StockLevelItem[] = [];
      let totalValue = 0;
      let lowStockItems = 0;
      let outOfStockItems = 0;
      let overstockItems = 0;

      for (const level of inventoryLevels.inventoryLevels) {
        const totalItemValue = level.currentLevel * level.averageCost;
        totalValue += totalItemValue;

        let status: 'normal' | 'low_stock' | 'out_of_stock' | 'overstock' = 'normal';
        
        if (level.currentLevel === 0) {
          status = 'out_of_stock';
          outOfStockItems++;
        } else if (level.currentLevel <= level.reorderPoint) {
          status = 'low_stock';
          lowStockItems++;
        } else if (level.maxStockLevel && level.currentLevel > level.maxStockLevel) {
          status = 'overstock';
          overstockItems++;
        }

        const daysWithoutMovement = level.lastMovementAt ? 
          Math.floor((new Date().getTime() - level.lastMovementAt.getTime()) / (1000 * 60 * 60 * 24)) : 
          undefined;

        products.push({
          productId: level.productId,
          productName: level.product?.name || 'Unknown',
          sku: level.product?.sku || '',
          variantId: level.variantId,
          variantName: level.variant?.name,
          locationId: level.locationId,
          currentLevel: level.currentLevel,
          availableLevel: level.availableLevel,
          reservedLevel: level.reservedLevel,
          reorderPoint: level.reorderPoint,
          maxStockLevel: level.maxStockLevel,
          unitCost: level.averageCost,
          totalValue: totalItemValue,
          status,
          lastMovementAt: level.lastMovementAt,
          daysWithoutMovement,
        });
      }

      const data: StockLevelReport = {
        products,
        summary: {
          totalProducts: products.length,
          totalValue,
          lowStockItems,
          outOfStockItems,
          overstockItems,
        },
      };

      report = {
        reportType: 'stock_level',
        generatedAt: new Date(),
        parameters: query,
        data,
        summary: data.summary,
      };

      await this.cacheService.set(cacheKey, report, 300); // 5 minutes
    }

    return report;
  }

  async generateMovementReport(tenantId: string, query: ReportQueryDto = {}): Promise<InventoryReport> {
    const cacheKey = `inventory:${tenantId}:report:movement:${JSON.stringify(query)}`;
    let report = await this.cacheService.get<InventoryReport>(cacheKey);

    if (!report) {
      // Get movements based on query
      const movements = await this.movementRepository.findMany(tenantId, {
        productId: query.productId,
        locationId: query.locationId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        page: 1,
        limit: 10000,
      });

      const movementItems: MovementItem[] = [];
      let totalInbound = 0;
      let totalOutbound = 0;
      let valueChange = 0;

      for (const movement of movements) {
        if (movement.quantity > 0) {
          totalInbound += movement.quantity;
        } else {
          totalOutbound += Math.abs(movement.quantity);
        }

        if (movement.totalCost) {
          valueChange += movement.totalCost;
        }

        movementItems.push({
          id: movement.id,
          productId: movement.productId,
          productName: movement.product?.name || 'Unknown',
          sku: movement.product?.sku || '',
          variantId: movement.variantId,
          locationId: movement.locationId,
          movementType: movement.movementType,
          quantity: movement.quantity,
          unitCost: movement.unitCost,
          totalCost: movement.totalCost,
          previousLevel: movement.previousLevel,
          newLevel: movement.newLevel,
          referenceType: movement.referenceType,
          referenceId: movement.referenceId,
          batchNumber: movement.batchNumber,
          reason: movement.reason,
          notes: movement.notes,
          createdAt: movement.createdAt,
          createdBy: movement.createdBy,
        });
      }

      const data: MovementReport = {
        movements: movementItems,
        summary: {
          totalMovements: movementItems.length,
          totalInbound,
          totalOutbound,
          netMovement: totalInbound - totalOutbound,
          valueChange,
        },
      };

      report = {
        reportType: 'movement',
        generatedAt: new Date(),
        parameters: query,
        data,
        summary: data.summary,
      };

      await this.cacheService.set(cacheKey, report, 300); // 5 minutes
    }

    return report;
  }

  async generateAgingReport(tenantId: string, query: ReportQueryDto = {}): Promise<InventoryReport> {
    const cacheKey = `inventory:${tenantId}:report:aging:${JSON.stringify(query)}`;
    let report = await this.cacheService.get<InventoryReport>(cacheKey);

    if (!report) {
      // Get batches for aging analysis
      const batchQuery: any = {
        page: 1,
        limit: 10000,
      };

      if (query.locationId) {
        batchQuery.locationId = query.locationId;
      }

      if (query.productId) {
        batchQuery.productId = query.productId;
      }

      const batches = await this.batchRepository.findMany(tenantId, batchQuery);
      
      const items: AgingItem[] = [];
      let totalValue = 0;
      let totalAgeInDays = 0;
      const ageGroups = {
        '0-30 days': 0,
        '31-60 days': 0,
        '61-90 days': 0,
        '91-180 days': 0,
        '180+ days': 0,
      };
      const valueByAgeGroup = { ...ageGroups };

      const currentDate = new Date();

      for (const batch of batches.batches) {
        if (batch.currentQuantity <= 0) continue;

        const ageInDays = Math.floor(
          (currentDate.getTime() - batch.receivedDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const totalItemValue = batch.currentQuantity * batch.unitCost;
        totalValue += totalItemValue;
        totalAgeInDays += ageInDays;

        let ageGroup: string;
        if (ageInDays <= 30) {
          ageGroup = '0-30 days';
        } else if (ageInDays <= 60) {
          ageGroup = '31-60 days';
        } else if (ageInDays <= 90) {
          ageGroup = '61-90 days';
        } else if (ageInDays <= 180) {
          ageGroup = '91-180 days';
        } else {
          ageGroup = '180+ days';
        }

        ageGroups[ageGroup]++;
        valueByAgeGroup[ageGroup] += totalItemValue;

        const daysUntilExpiry = batch.expiryDate ? 
          Math.floor((batch.expiryDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) : 
          undefined;

        items.push({
          productId: batch.productId,
          productName: batch.product?.name || 'Unknown',
          sku: batch.product?.sku || '',
          variantId: batch.variantId,
          locationId: batch.locationId,
          batchNumber: batch.batchNumber,
          quantity: batch.currentQuantity,
          unitCost: batch.unitCost,
          totalValue: totalItemValue,
          receivedDate: batch.receivedDate,
          ageInDays,
          ageGroup,
          expiryDate: batch.expiryDate,
          daysUntilExpiry,
        });
      }

      const averageAge = items.length > 0 ? totalAgeInDays / items.length : 0;

      const data: AgingReport = {
        items,
        summary: {
          totalItems: items.length,
          totalValue,
          averageAge,
          itemsByAgeGroup: ageGroups,
          valueByAgeGroup,
        },
      };

      report = {
        reportType: 'aging',
        generatedAt: new Date(),
        parameters: query,
        data,
        summary: data.summary,
      };

      await this.cacheService.set(cacheKey, report, 300); // 5 minutes
    }

    return report;
  }

  async generateTurnoverReport(tenantId: string, query: ReportQueryDto = {}): Promise<InventoryReport> {
    const cacheKey = `inventory:${tenantId}:report:turnover:${JSON.stringify(query)}`;
    let report = await this.cacheService.get<InventoryReport>(cacheKey);

    if (!report) {
      // Calculate turnover for each product/location combination
      const inventoryQuery: any = {
        page: 1,
        limit: 10000,
      };

      if (query.locationId) {
        inventoryQuery.locationId = query.locationId;
      }

      if (query.productId) {
        inventoryQuery.productId = query.productId;
      }

      const inventoryLevels = await this.inventoryRepository.findMany(tenantId, inventoryQuery);
      
      const products: TurnoverItem[] = [];
      let totalTurnover = 0;
      let fastMovingItems = 0;
      let slowMovingItems = 0;
      let deadStockItems = 0;

      for (const level of inventoryLevels.inventoryLevels) {
        // Calculate turnover metrics
        const turnoverData = await this.calculateTurnoverMetrics(
          tenantId,
          level.productId,
          level.variantId,
          level.locationId,
          query.dateFrom,
          query.dateTo,
        );

        let turnoverCategory: 'fast' | 'medium' | 'slow' | 'dead';
        
        if (turnoverData.turnoverRatio >= 12) {
          turnoverCategory = 'fast';
          fastMovingItems++;
        } else if (turnoverData.turnoverRatio >= 4) {
          turnoverCategory = 'medium';
        } else if (turnoverData.turnoverRatio >= 1) {
          turnoverCategory = 'slow';
          slowMovingItems++;
        } else {
          turnoverCategory = 'dead';
          deadStockItems++;
        }

        totalTurnover += turnoverData.turnoverRatio;

        products.push({
          productId: level.productId,
          productName: level.product?.name || 'Unknown',
          sku: level.product?.sku || '',
          variantId: level.variantId,
          locationId: level.locationId,
          averageInventory: turnoverData.averageInventory,
          costOfGoodsSold: turnoverData.costOfGoodsSold,
          turnoverRatio: turnoverData.turnoverRatio,
          turnoverCategory,
          daysOfSupply: turnoverData.daysOfSupply,
          lastSaleDate: turnoverData.lastSaleDate,
          daysSinceLastSale: turnoverData.daysSinceLastSale,
        });
      }

      const averageTurnover = products.length > 0 ? totalTurnover / products.length : 0;

      const data: TurnoverReport = {
        products,
        summary: {
          averageTurnover,
          fastMovingItems,
          slowMovingItems,
          deadStockItems,
        },
      };

      report = {
        reportType: 'turnover',
        generatedAt: new Date(),
        parameters: query,
        data,
        summary: data.summary,
      };

      await this.cacheService.set(cacheKey, report, 300); // 5 minutes
    }

    return report;
  }

  async generateValuationReport(tenantId: string, query: ReportQueryDto = {}): Promise<InventoryReport> {
    const valuationSummary = await this.valuationService.getValuationSummary(tenantId, {
      locationId: query.locationId,
      productId: query.productId,
      asOfDate: query.dateTo,
    });

    const report: InventoryReport = {
      reportType: 'valuation',
      generatedAt: new Date(),
      parameters: query,
      data: valuationSummary,
      summary: {
        totalValue: valuationSummary.totalInventoryValue,
        totalQuantity: valuationSummary.totalQuantity,
        averageCost: valuationSummary.averageCost,
        locationCount: valuationSummary.valuationsByLocation.length,
        productCount: valuationSummary.valuationsByProduct.length,
      },
    };

    return report;
  }

  private async calculateTurnoverMetrics(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{
    averageInventory: number;
    costOfGoodsSold: number;
    turnoverRatio: number;
    daysOfSupply: number;
    lastSaleDate?: Date;
    daysSinceLastSale?: number;
  }> {
    // Get sales movements (outbound) for the period
    const movements = await this.movementRepository.findByProduct(tenantId, productId, locationId);
    
    let costOfGoodsSold = 0;
    let lastSaleDate: Date | undefined;
    let totalInventoryDays = 0;
    let inventoryReadings = 0;

    const periodStart = dateFrom || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Default to 1 year
    const periodEnd = dateTo || new Date();

    for (const movement of movements) {
      if (movement.createdAt < periodStart || movement.createdAt > periodEnd) {
        continue;
      }

      // Track sales (negative movements)
      if (movement.quantity < 0 && movement.movementType === 'sale') {
        const saleCost = Math.abs(movement.quantity) * (movement.unitCost || 0);
        costOfGoodsSold += saleCost;
        
        if (!lastSaleDate || movement.createdAt > lastSaleDate) {
          lastSaleDate = movement.createdAt;
        }
      }

      // Track inventory levels for average calculation
      totalInventoryDays += movement.newLevel;
      inventoryReadings++;
    }

    const averageInventory = inventoryReadings > 0 ? totalInventoryDays / inventoryReadings : 0;
    const turnoverRatio = averageInventory > 0 ? costOfGoodsSold / averageInventory : 0;
    const daysOfSupply = turnoverRatio > 0 ? 365 / turnoverRatio : 0;

    const daysSinceLastSale = lastSaleDate ? 
      Math.floor((new Date().getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24)) : 
      undefined;

    return {
      averageInventory,
      costOfGoodsSold,
      turnoverRatio,
      daysOfSupply,
      lastSaleDate,
      daysSinceLastSale,
    };
  }
}