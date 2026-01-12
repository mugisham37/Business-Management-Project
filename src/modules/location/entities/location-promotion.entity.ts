import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PromotionType {
  PERCENTAGE_DISCOUNT = 'percentage_discount',
  FIXED_AMOUNT_DISCOUNT = 'fixed_amount_discount',
  BUY_X_GET_Y = 'buy_x_get_y',
  BUNDLE_DISCOUNT = 'bundle_discount',
  FREE_SHIPPING = 'free_shipping',
  LOYALTY_POINTS_MULTIPLIER = 'loyalty_points_multiplier',
}

export enum PromotionStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum PromotionTargetType {
  ALL_PRODUCTS = 'all_products',
  SPECIFIC_PRODUCTS = 'specific_products',
  PRODUCT_CATEGORIES = 'product_categories',
  CUSTOMER_SEGMENTS = 'customer_segments',
}

export interface PromotionCondition {
  type: string;
  operator: string;
  value: any;
  parameters?: Record<string, any>;
}

export interface PromotionAction {
  type: string;
  value: any;
  parameters?: Record<string, any>;
}

export class LocationPromotion {
  @ApiProperty({ description: 'Unique identifier for the promotion' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Location ID' })
  locationId!: string;

  @ApiProperty({ description: 'Promotion name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Promotion description' })
  description?: string;

  @ApiProperty({ enum: PromotionType, description: 'Type of promotion' })
  promotionType!: PromotionType;

  @ApiProperty({ enum: PromotionTargetType, description: 'What the promotion targets' })
  targetType!: PromotionTargetType;

  @ApiPropertyOptional({ description: 'Target product IDs (if targeting specific products)' })
  targetProductIds?: string[];

  @ApiPropertyOptional({ description: 'Target category IDs (if targeting categories)' })
  targetCategoryIds?: string[];

  @ApiPropertyOptional({ description: 'Target customer segment IDs (if targeting segments)' })
  targetCustomerSegments?: string[];

  @ApiProperty({ description: 'Promotion start date' })
  startDate!: Date;

  @ApiProperty({ description: 'Promotion end date' })
  endDate!: Date;

  @ApiPropertyOptional({ description: 'Discount percentage (for percentage discounts)' })
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Discount amount (for fixed amount discounts)' })
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Minimum purchase amount to qualify' })
  minPurchaseAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum discount amount (for percentage discounts)' })
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum number of uses per customer' })
  maxUsesPerCustomer?: number;

  @ApiPropertyOptional({ description: 'Total maximum uses for the promotion' })
  maxTotalUses?: number;

  @ApiProperty({ description: 'Current number of uses' })
  currentUses!: number;

  @ApiProperty({ description: 'Priority for promotion application (higher number = higher priority)' })
  priority!: number;

  @ApiProperty({ description: 'Whether promotion can be combined with other promotions' })
  isCombinable!: boolean;

  @ApiPropertyOptional({ description: 'Promotion conditions' })
  conditions?: PromotionCondition[];

  @ApiPropertyOptional({ description: 'Promotion actions' })
  actions?: PromotionAction[];

  @ApiPropertyOptional({ description: 'Promotion code (if applicable)' })
  promotionCode?: string;

  @ApiProperty({ description: 'Whether promotion is active' })
  isActive!: boolean;

  @ApiProperty({ enum: PromotionStatus, description: 'Promotion status' })
  status!: PromotionStatus;

  @ApiProperty({ description: 'User who created the promotion' })
  createdBy!: string;

  @ApiPropertyOptional({ description: 'User who last updated the promotion' })
  updatedBy?: string;

  @ApiProperty({ description: 'Promotion creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  constructor(partial: Partial<LocationPromotion>) {
    Object.assign(this, partial);
  }

  /**
   * Check if the promotion is currently valid based on date range
   */
  isValidForDate(date: Date = new Date()): boolean {
    if (date < this.startDate || date > this.endDate) {
      return false;
    }
    return true;
  }

  /**
   * Check if the promotion has reached its usage limits
   */
  hasReachedUsageLimit(): boolean {
    if (this.maxTotalUses && this.currentUses >= this.maxTotalUses) {
      return true;
    }
    return false;
  }

  /**
   * Check if a customer has reached their usage limit for this promotion
   */
  hasCustomerReachedLimit(customerUsageCount: number): boolean {
    if (this.maxUsesPerCustomer && customerUsageCount >= this.maxUsesPerCustomer) {
      return true;
    }
    return false;
  }

  /**
   * Check if the promotion applies to a specific product
   */
  appliesToProduct(productId: string, categoryId?: string): boolean {
    switch (this.targetType) {
      case PromotionTargetType.ALL_PRODUCTS:
        return true;
      
      case PromotionTargetType.SPECIFIC_PRODUCTS:
        return this.targetProductIds?.includes(productId) || false;
      
      case PromotionTargetType.PRODUCT_CATEGORIES:
        return categoryId ? (this.targetCategoryIds?.includes(categoryId) || false) : false;
      
      default:
        return false;
    }
  }

  /**
   * Calculate discount for a cart item
   */
  calculateDiscount(itemPrice: number, quantity: number, totalCartValue?: number): number {
    if (!this.isValidForDate() || this.hasReachedUsageLimit()) {
      return 0;
    }

    // Check minimum purchase amount
    if (this.minPurchaseAmount && totalCartValue && totalCartValue < this.minPurchaseAmount) {
      return 0;
    }

    const itemTotal = itemPrice * quantity;
    let discount = 0;

    switch (this.promotionType) {
      case PromotionType.PERCENTAGE_DISCOUNT:
        discount = itemTotal * (this.discountPercentage || 0) / 100;
        if (this.maxDiscountAmount) {
          discount = Math.min(discount, this.maxDiscountAmount);
        }
        break;
      
      case PromotionType.FIXED_AMOUNT_DISCOUNT:
        discount = Math.min(this.discountAmount || 0, itemTotal);
        break;
      
      case PromotionType.BUY_X_GET_Y:
        // Implementation would depend on specific buy X get Y logic
        // This is a simplified version
        discount = 0; // Would need more complex logic
        break;
      
      default:
        discount = 0;
    }

    return Math.max(0, discount);
  }

  /**
   * Get the current status based on dates and usage
   */
  getCurrentStatus(): PromotionStatus {
    const now = new Date();
    
    if (this.status === PromotionStatus.CANCELLED) {
      return PromotionStatus.CANCELLED;
    }
    
    if (now > this.endDate || this.hasReachedUsageLimit()) {
      return PromotionStatus.EXPIRED;
    }
    
    if (now < this.startDate) {
      return PromotionStatus.DRAFT;
    }
    
    return this.isActive ? PromotionStatus.ACTIVE : PromotionStatus.PAUSED;
  }
}