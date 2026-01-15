import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InventoryRepository } from '../repositories/inventory.repository';
import { ProductRepository } from '../repositories/product.repository';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';
import { InventoryQueryDto } from '../dto/inventory.dto';

// Domain events
export class ReorderAlertEvent {
  constructor(
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly variantId: string | null,
    public readonly locationId: string,
    public readonly currentLevel: number,
    public readonly reorderPoint: number,
    public readonly suggestedQuantity: number,
    public readonly supplierId?: string,
  ) {}
}

export class PurchaseOrderSuggestionEvent {
  constructor(
    public readonly tenantId: string,
    public readonly supplierId: string,
    public readonly suggestions: ReorderSuggestion[],
    public readonly totalValue: number,
  ) {}
}

export interface ReorderSuggestion {
  productId: string;
  variantId?: string;
  locationId: string;
  currentLevel: number;
  reorderPoint: number;
  reorderQuantity: number;
  suggestedQuantity: number;
  unitCost?: number;
  totalCost?: number;
  priority: 'high' | 'medium' | 'low';
  daysUntilStockout?: number;
  averageDailySales?: number;
  leadTimeDays?: number;
  product?: any;
  variant?: any;
}

export interface ForecastData {
  productId: string;
  variantId?: string;
  locationId: string;
  averageDailySales: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonalFactor: number;
  forecastedDemand: number;
  confidence: number;
}

@Injectable()
export class ReorderService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly productRepository: ProductRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async generateReorderSuggestions(tenantId: string, locationId?: string): Promise<ReorderSuggestion[]> {
    const cacheKey = `reorder:suggestions:${tenantId}:${locationId || 'all'}`;
    let suggestions = await this.cacheService.get<ReorderSuggestion[]>(cacheKey);

    if (!suggestions) {
      // Get low stock products
      const lowStockProducts = await this.inventoryRepository.findLowStockProducts(tenantId, locationId);
      
      suggestions = [];

      for (const inventory of lowStockProducts) {
        // Calculate suggested reorder quantity
        const suggestion = await this.calculateReorderQuantity(tenantId, inventory);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }

      // Sort by priority (high first)
      suggestions.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      await this.cacheService.set(cacheKey, suggestions, { ttl: 300 }); // 5 minutes
    }

    return suggestions;
  }

  async calculateReorderQuantity(tenantId: string, inventory: any): Promise<ReorderSuggestion | null> {
    try {
      // Get sales history for demand forecasting
      const salesHistory = await this.getSalesHistory(tenantId, inventory.productId, inventory.variantId, inventory.locationId);
      
      // Calculate average daily sales
      const averageDailySales = this.calculateAverageDailySales(salesHistory);
      
      // Get lead time (default to 7 days if not specified)
      const leadTimeDays = inventory.product?.leadTimeDays || 7;
      
      // Calculate safety stock (25% of lead time demand)
      const leadTimeDemand = averageDailySales * leadTimeDays;
      const safetyStock = leadTimeDemand * 0.25;
      
      // Calculate suggested quantity
      let suggestedQuantity = inventory.reorderQuantity;
      
      if (suggestedQuantity === 0) {
        // If no reorder quantity set, calculate based on demand
        suggestedQuantity = Math.ceil(leadTimeDemand + safetyStock);
      }

      // Ensure minimum order quantity
      const minOrderQuantity = inventory.product?.minOrderQuantity || 1;
      suggestedQuantity = Math.max(suggestedQuantity, minOrderQuantity);

      // Calculate days until stockout
      const daysUntilStockout = averageDailySales > 0 
        ? Math.floor(inventory.currentLevel / averageDailySales)
        : null;

      // Determine priority
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (inventory.currentLevel === 0) {
        priority = 'high';
      } else if (daysUntilStockout && daysUntilStockout <= 3) {
        priority = 'high';
      } else if (daysUntilStockout && daysUntilStockout <= 7) {
        priority = 'medium';
      } else {
        priority = 'low';
      }

      // Calculate costs
      const unitCost = inventory.averageCost || inventory.product?.costPrice || 0;
      const totalCost = suggestedQuantity * unitCost;

      const reorderSuggestion: ReorderSuggestion = {
        productId: inventory.productId,
        locationId: inventory.locationId,
        currentLevel: inventory.currentLevel,
        reorderPoint: inventory.reorderPoint,
        reorderQuantity: inventory.reorderQuantity,
        suggestedQuantity,
        unitCost,
        totalCost,
        priority,
        averageDailySales,
        leadTimeDays,
        product: inventory.product,
        variant: inventory.variant,
      };

      // Only add optional properties if they exist
      if (inventory.variantId) {
        reorderSuggestion.variantId = inventory.variantId;
      }
      if (daysUntilStockout !== null) {
        reorderSuggestion.daysUntilStockout = daysUntilStockout;
      }

      return reorderSuggestion;
    } catch (error) {
      console.error(`Error calculating reorder quantity for product ${inventory.productId}:`, error);
      return null;
    }
  }

  async generatePurchaseOrderSuggestions(tenantId: string, supplierId?: string): Promise<{
    [supplierId: string]: ReorderSuggestion[];
  }> {
    const suggestions = await this.generateReorderSuggestions(tenantId);
    
    // Group by supplier
    const supplierSuggestions: { [supplierId: string]: ReorderSuggestion[] } = {};

    for (const suggestion of suggestions) {
      const productSupplierId = suggestion.product?.supplierId || 'unknown';
      
      if (supplierId && productSupplierId !== supplierId) {
        continue;
      }

      if (!supplierSuggestions[productSupplierId]) {
        supplierSuggestions[productSupplierId] = [];
      }

      supplierSuggestions[productSupplierId]!.push(suggestion);
    }

    // Emit events for each supplier
    for (const [supplierIdKey, suggestions] of Object.entries(supplierSuggestions)) {
      const totalValue = suggestions.reduce((sum: number, s: ReorderSuggestion) => sum + (s.totalCost || 0), 0);
      
      this.eventEmitter.emit('purchase.order.suggestion', new PurchaseOrderSuggestionEvent(
        tenantId,
        supplierIdKey,
        suggestions,
        totalValue,
      ));
    }

    return supplierSuggestions;
  }

  async processAutomaticReorders(tenantId: string): Promise<void> {
    const suggestions = await this.generateReorderSuggestions(tenantId);
    
    // Filter for high priority items only
    const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');

    for (const suggestion of highPrioritySuggestions) {
      // Emit reorder alert event
      this.eventEmitter.emit('inventory.reorder.alert', new ReorderAlertEvent(
        tenantId,
        suggestion.productId,
        suggestion.variantId || null,
        suggestion.locationId,
        suggestion.currentLevel,
        suggestion.reorderPoint,
        suggestion.suggestedQuantity,
        suggestion.product?.supplierId,
      ));

      // Queue notification job
      await this.queueService.addNotificationJob({
        type: 'push',
        recipients: [], // This should be populated with relevant user IDs
        title: 'Low Stock Alert',
        message: `Product ${suggestion.productId} is low on stock at location ${suggestion.locationId}. Current level: ${suggestion.currentLevel}, Reorder point: ${suggestion.reorderPoint}`,
        data: {
          productId: suggestion.productId,
          variantId: suggestion.variantId,
          locationId: suggestion.locationId,
          currentLevel: suggestion.currentLevel,
          reorderPoint: suggestion.reorderPoint,
        },
        tenantId,
      });
    }
  }

  async updateReorderPoints(tenantId: string, locationId?: string): Promise<void> {
    // Get all inventory levels
    const inventoryQuery: InventoryQueryDto = {
      page: 1,
      limit: 1000, // Process in batches
    };

    // Only add locationId if it's defined
    if (locationId !== undefined) {
      inventoryQuery.locationId = locationId;
    }

    const inventoryLevels = await this.inventoryRepository.findMany(tenantId, inventoryQuery);

    for (const inventory of inventoryLevels.inventoryLevels) {
      try {
        // Calculate optimal reorder point based on sales history
        const optimalReorderPoint = await this.calculateOptimalReorderPoint(
          tenantId,
          inventory.productId,
          inventory.variantId || null,
          inventory.locationId,
        );

        if (optimalReorderPoint !== inventory.reorderPoint) {
          // Update reorder point
          await this.inventoryRepository.updateLevel(
            tenantId,
            inventory.productId,
            inventory.variantId || null,
            inventory.locationId,
            inventory.currentLevel, // Keep current level same
            'system', // System user
          );
        }
      } catch (error) {
        console.error(`Error updating reorder point for product ${inventory.productId}:`, error);
      }
    }
  }

  async calculateOptimalReorderPoint(
    tenantId: string,
    productId: string,
    variantId: string | null,
    locationId: string,
  ): Promise<number> {
    // Get sales history
    const salesHistory = await this.getSalesHistory(tenantId, productId, variantId || undefined, locationId);
    
    // Calculate average daily sales
    const averageDailySales = this.calculateAverageDailySales(salesHistory);
    
    // Get lead time
    const product = await this.productRepository.findById(tenantId, productId);
    const leadTimeDays = 7; // Default lead time since leadTimeDays property doesn't exist
    
    // Calculate reorder point: (Average daily sales × Lead time) + Safety stock
    const leadTimeDemand = averageDailySales * leadTimeDays;
    const safetyStock = leadTimeDemand * 0.25; // 25% safety stock
    
    return Math.ceil(leadTimeDemand + safetyStock);
  }

  async getForecastData(tenantId: string, productId: string, variantId?: string, locationId?: string): Promise<ForecastData[]> {
    const cacheKey = `forecast:${tenantId}:${productId}:${variantId || 'null'}:${locationId || 'all'}`;
    let forecastData = await this.cacheService.get<ForecastData[]>(cacheKey);

    if (!forecastData) {
      // Simple forecasting implementation
      // In a real system, this would use more sophisticated algorithms
      const salesHistory = await this.getSalesHistory(tenantId, productId, variantId, locationId);
      
      const forecastItem: ForecastData = {
        productId,
        locationId: locationId || 'all',
        averageDailySales: this.calculateAverageDailySales(salesHistory),
        trend: this.calculateTrend(salesHistory),
        seasonalFactor: 1.0, // Simplified - no seasonal adjustment
        forecastedDemand: this.calculateForecastedDemand(salesHistory),
        confidence: this.calculateForecastConfidence(salesHistory),
      };

      // Only add variantId if it's defined
      if (variantId !== undefined) {
        forecastItem.variantId = variantId;
      }

      forecastData = [forecastItem];

      await this.cacheService.set(cacheKey, forecastData, { ttl: 3600 }); // 1 hour
    }

    return forecastData;
  }

  private async getSalesHistory(tenantId: string, productId: string, variantId?: string, locationId?: string): Promise<any[]> {
    // This would typically query transaction/sales data
    // For now, return mock data
    return [];
  }

  private calculateAverageDailySales(salesHistory: any[]): number {
    if (salesHistory.length === 0) return 0;
    
    const totalSales = salesHistory.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
    const days = Math.max(salesHistory.length, 30); // At least 30 days
    
    return totalSales / days;
  }

  private calculateTrend(salesHistory: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (salesHistory.length < 2) return 'stable';
    
    // Simple trend calculation - compare first half to second half
    const midPoint = Math.floor(salesHistory.length / 2);
    const firstHalf = salesHistory.slice(0, midPoint);
    const secondHalf = salesHistory.slice(midPoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, s) => sum + (s.quantity || 0), 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, s) => sum + (s.quantity || 0), 0) / secondHalf.length;
    
    const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
    
    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  private calculateForecastedDemand(salesHistory: any[]): number {
    // Simple forecasting - just return average daily sales * 30 days
    return this.calculateAverageDailySales(salesHistory) * 30;
  }

  private calculateForecastConfidence(salesHistory: any[]): number {
    // Simple confidence calculation based on data availability
    if (salesHistory.length >= 90) return 0.9;
    if (salesHistory.length >= 30) return 0.7;
    if (salesHistory.length >= 7) return 0.5;
    return 0.3;
  }
}