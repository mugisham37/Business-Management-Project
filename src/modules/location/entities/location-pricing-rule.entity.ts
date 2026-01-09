import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PricingRuleType {
  MARKUP = 'markup',
  MARKDOWN = 'markdown',
  FIXED_PRICE = 'fixed_price',
  PERCENTAGE_DISCOUNT = 'percentage_discount',
  BULK_DISCOUNT = 'bulk_discount',
}

export enum PricingRuleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SCHEDULED = 'scheduled',
  EXPIRED = 'expired',
}

export interface PricingRuleCondition {
  type: string;
  operator: string;
  value: any;
  parameters?: Record<string, any>;
}

export class LocationPricingRule {
  @ApiProperty({ description: 'Unique identifier for the pricing rule' })
  id: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

  @ApiProperty({ description: 'Location ID' })
  locationId: string;

  @ApiProperty({ description: 'Rule name' })
  name: string;

  @ApiPropertyOptional({ description: 'Rule description' })
  description?: string;

  @ApiProperty({ enum: PricingRuleType, description: 'Type of pricing rule' })
  ruleType: PricingRuleType;

  @ApiPropertyOptional({ description: 'Product ID this rule applies to' })
  productId?: string;

  @ApiPropertyOptional({ description: 'Product category ID this rule applies to' })
  categoryId?: string;

  @ApiProperty({ description: 'Rule value (percentage, amount, or fixed price)' })
  value: number;

  @ApiPropertyOptional({ description: 'Minimum quantity for rule to apply' })
  minQuantity?: number;

  @ApiPropertyOptional({ description: 'Maximum quantity for rule to apply' })
  maxQuantity?: number;

  @ApiPropertyOptional({ description: 'Rule start date' })
  startDate?: Date;

  @ApiPropertyOptional({ description: 'Rule end date' })
  endDate?: Date;

  @ApiProperty({ description: 'Priority for rule application (higher number = higher priority)' })
  priority: number;

  @ApiPropertyOptional({ description: 'Additional conditions for rule application' })
  conditions?: PricingRuleCondition[];

  @ApiProperty({ description: 'Whether rule is active' })
  isActive: boolean;

  @ApiProperty({ enum: PricingRuleStatus, description: 'Rule status' })
  status: PricingRuleStatus;

  @ApiProperty({ description: 'User who created the rule' })
  createdBy: string;

  @ApiPropertyOptional({ description: 'User who last updated the rule' })
  updatedBy?: string;

  @ApiProperty({ description: 'Rule creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  constructor(partial: Partial<LocationPricingRule>) {
    Object.assign(this, partial);
  }

  /**
   * Check if the rule is currently valid based on date range
   */
  isValidForDate(date: Date = new Date()): boolean {
    if (this.startDate && date < this.startDate) {
      return false;
    }
    if (this.endDate && date > this.endDate) {
      return false;
    }
    return true;
  }

  /**
   * Check if the rule applies to a specific quantity
   */
  isValidForQuantity(quantity: number): boolean {
    if (this.minQuantity && quantity < this.minQuantity) {
      return false;
    }
    if (this.maxQuantity && quantity > this.maxQuantity) {
      return false;
    }
    return true;
  }

  /**
   * Calculate the price based on this rule
   */
  calculatePrice(basePrice: number, quantity: number): number {
    if (!this.isValidForQuantity(quantity) || !this.isValidForDate()) {
      return basePrice;
    }

    switch (this.ruleType) {
      case PricingRuleType.MARKUP:
        return basePrice * (1 + this.value / 100);
      
      case PricingRuleType.MARKDOWN:
        return basePrice * (1 - this.value / 100);
      
      case PricingRuleType.FIXED_PRICE:
        return this.value;
      
      case PricingRuleType.PERCENTAGE_DISCOUNT:
        return basePrice * (1 - this.value / 100);
      
      case PricingRuleType.BULK_DISCOUNT:
        // For bulk discount, apply discount based on quantity tiers
        return basePrice * (1 - this.value / 100);
      
      default:
        return basePrice;
    }
  }

  /**
   * Get the discount amount for this rule
   */
  getDiscountAmount(basePrice: number, quantity: number): number {
    const finalPrice = this.calculatePrice(basePrice, quantity);
    return Math.max(0, basePrice - finalPrice);
  }
}