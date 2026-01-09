import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InventoryPolicyType {
  REORDER_POINT = 'reorder_point',
  SAFETY_STOCK = 'safety_stock',
  MAX_STOCK_LEVEL = 'max_stock_level',
  ABC_CLASSIFICATION = 'abc_classification',
  SEASONAL_ADJUSTMENT = 'seasonal_adjustment',
  DEMAND_FORECASTING = 'demand_forecasting',
}

export enum InventoryPolicyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum StockReplenishmentMethod {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  DEMAND_BASED = 'demand_based',
}

export enum ABCClassification {
  A = 'A', // High value, low quantity
  B = 'B', // Medium value, medium quantity
  C = 'C', // Low value, high quantity
}

export interface InventoryPolicyRule {
  type: string;
  condition: string;
  action: string;
  parameters: Record<string, any>;
  priority?: number;
}

export class LocationInventoryPolicy {
  @ApiProperty({ description: 'Unique identifier for the inventory policy' })
  id: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

  @ApiProperty({ description: 'Location ID' })
  locationId: string;

  @ApiProperty({ description: 'Policy name' })
  name: string;

  @ApiPropertyOptional({ description: 'Policy description' })
  description?: string;

  @ApiProperty({ enum: InventoryPolicyType, description: 'Type of inventory policy' })
  policyType: InventoryPolicyType;

  @ApiPropertyOptional({ description: 'Product ID this policy applies to (if product-specific)' })
  productId?: string;

  @ApiPropertyOptional({ description: 'Product category ID this policy applies to (if category-specific)' })
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Minimum stock level (reorder point)' })
  minStockLevel?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  maxStockLevel?: number;

  @ApiPropertyOptional({ description: 'Safety stock quantity' })
  safetyStock?: number;

  @ApiPropertyOptional({ description: 'Reorder quantity' })
  reorderQuantity?: number;

  @ApiPropertyOptional({ description: 'Lead time in days' })
  leadTimeDays?: number;

  @ApiProperty({ enum: StockReplenishmentMethod, description: 'How stock should be replenished' })
  replenishmentMethod: StockReplenishmentMethod;

  @ApiPropertyOptional({ enum: ABCClassification, description: 'ABC classification for the item' })
  abcClassification?: ABCClassification;

  @ApiProperty({ description: 'Seasonal demand multiplier (1.0 = normal, >1.0 = higher demand)' })
  seasonalMultiplier: number;

  @ApiProperty({ description: 'Demand forecast period in days' })
  forecastPeriodDays: number;

  @ApiProperty({ description: 'Whether to automatically create purchase orders' })
  autoCreatePurchaseOrders: boolean;

  @ApiPropertyOptional({ description: 'Preferred supplier ID for automatic orders' })
  preferredSupplierId?: string;

  @ApiPropertyOptional({ description: 'Policy rules' })
  rules?: InventoryPolicyRule[];

  @ApiProperty({ description: 'Policy priority (higher number = higher priority)' })
  priority: number;

  @ApiPropertyOptional({ description: 'Additional policy parameters' })
  parameters?: Record<string, any>;

  @ApiProperty({ description: 'Whether policy is active' })
  isActive: boolean;

  @ApiProperty({ enum: InventoryPolicyStatus, description: 'Policy status' })
  status: InventoryPolicyStatus;

  @ApiProperty({ description: 'User who created the policy' })
  createdBy: string;

  @ApiPropertyOptional({ description: 'User who last updated the policy' })
  updatedBy?: string;

  @ApiProperty({ description: 'Policy creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  constructor(partial: Partial<LocationInventoryPolicy>) {
    Object.assign(this, partial);
  }

  /**
   * Check if current stock level requires reordering
   */
  shouldReorder(currentStock: number, averageDailyDemand: number = 0): boolean {
    if (!this.isActive || this.status !== InventoryPolicyStatus.ACTIVE) {
      return false;
    }

    // Basic reorder point calculation
    if (this.minStockLevel && currentStock <= this.minStockLevel) {
      return true;
    }

    // Advanced calculation with lead time and demand
    if (this.leadTimeDays && averageDailyDemand > 0) {
      const leadTimeDemand = averageDailyDemand * this.leadTimeDays;
      const safetyStockLevel = this.safetyStock || 0;
      const reorderPoint = leadTimeDemand + safetyStockLevel;
      
      if (currentStock <= reorderPoint) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate recommended reorder quantity
   */
  calculateReorderQuantity(currentStock: number, averageDailyDemand: number = 0): number {
    if (this.reorderQuantity) {
      return this.reorderQuantity;
    }

    // Economic Order Quantity (EOQ) simplified calculation
    if (averageDailyDemand > 0 && this.forecastPeriodDays) {
      const forecastDemand = averageDailyDemand * this.forecastPeriodDays * this.seasonalMultiplier;
      const targetStock = this.maxStockLevel || (forecastDemand + (this.safetyStock || 0));
      return Math.max(0, targetStock - currentStock);
    }

    // Fallback to a simple calculation
    const safetyStockLevel = this.safetyStock || 0;
    const minOrderQuantity = this.minStockLevel || safetyStockLevel;
    return Math.max(minOrderQuantity, safetyStockLevel * 2);
  }

  /**
   * Check if stock level is above maximum
   */
  isOverstocked(currentStock: number): boolean {
    return this.maxStockLevel ? currentStock > this.maxStockLevel : false;
  }

  /**
   * Get stock status based on current levels
   */
  getStockStatus(currentStock: number, averageDailyDemand: number = 0): {
    status: 'critical' | 'low' | 'normal' | 'high' | 'overstocked';
    recommendation: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  } {
    const safetyStockLevel = this.safetyStock || 0;
    const minLevel = this.minStockLevel || safetyStockLevel;
    const maxLevel = this.maxStockLevel;

    if (currentStock <= 0) {
      return {
        status: 'critical',
        recommendation: 'Immediate restock required - out of stock',
        urgency: 'critical'
      };
    }

    if (currentStock <= safetyStockLevel) {
      return {
        status: 'critical',
        recommendation: 'Below safety stock level - urgent reorder needed',
        urgency: 'critical'
      };
    }

    if (this.shouldReorder(currentStock, averageDailyDemand)) {
      return {
        status: 'low',
        recommendation: 'Reorder recommended',
        urgency: 'high'
      };
    }

    if (maxLevel && currentStock > maxLevel) {
      return {
        status: 'overstocked',
        recommendation: 'Consider reducing stock levels or increasing sales',
        urgency: 'medium'
      };
    }

    if (maxLevel && currentStock > maxLevel * 0.8) {
      return {
        status: 'high',
        recommendation: 'Stock levels are high - monitor for overstock',
        urgency: 'low'
      };
    }

    return {
      status: 'normal',
      recommendation: 'Stock levels are within normal range',
      urgency: 'low'
    };
  }

  /**
   * Apply seasonal adjustment to demand forecast
   */
  applySeasonalAdjustment(baseDemand: number): number {
    return baseDemand * this.seasonalMultiplier;
  }

  /**
   * Check if policy applies to a specific product
   */
  appliesToProduct(productId: string, categoryId?: string): boolean {
    // If policy has specific product ID, check exact match
    if (this.productId) {
      return this.productId === productId;
    }

    // If policy has category ID, check category match
    if (this.categoryId && categoryId) {
      return this.categoryId === categoryId;
    }

    // If no specific product or category, policy applies to all
    return !this.productId && !this.categoryId;
  }

  /**
   * Get policy effectiveness score based on historical performance
   */
  calculateEffectivenessScore(
    stockoutEvents: number,
    overstockEvents: number,
    totalDays: number
  ): number {
    if (totalDays === 0) return 0;

    const stockoutRate = stockoutEvents / totalDays;
    const overstockRate = overstockEvents / totalDays;
    
    // Lower rates are better, so invert the calculation
    const stockoutScore = Math.max(0, 1 - stockoutRate * 10); // Penalize stockouts heavily
    const overstockScore = Math.max(0, 1 - overstockRate * 5); // Penalize overstocks moderately
    
    return (stockoutScore * 0.7 + overstockScore * 0.3) * 100; // Weight stockouts more heavily
  }
}