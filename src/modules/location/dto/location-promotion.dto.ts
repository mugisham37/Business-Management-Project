import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsBoolean, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

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

export class PromotionConditionDto {
  @ApiProperty({ description: 'Condition type (e.g., min_purchase, customer_type, day_of_week)' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Condition operator (e.g., >=, <=, ==, in)' })
  @IsString()
  operator: string;

  @ApiProperty({ description: 'Condition value' })
  value: any;

  @ApiPropertyOptional({ description: 'Additional condition parameters' })
  @IsOptional()
  parameters?: Record<string, any>;
}

export class PromotionActionDto {
  @ApiProperty({ description: 'Action type (e.g., discount, free_item, points_multiplier)' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Action value' })
  value: any;

  @ApiPropertyOptional({ description: 'Action parameters' })
  @IsOptional()
  parameters?: Record<string, any>;
}

export class CreateLocationPromotionDto {
  @ApiProperty({ description: 'Promotion name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Promotion description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PromotionType, description: 'Type of promotion' })
  @IsEnum(PromotionType)
  promotionType: PromotionType;

  @ApiProperty({ enum: PromotionTargetType, description: 'What the promotion targets' })
  @IsEnum(PromotionTargetType)
  targetType: PromotionTargetType;

  @ApiPropertyOptional({ description: 'Target product IDs (if targeting specific products)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetProductIds?: string[];

  @ApiPropertyOptional({ description: 'Target category IDs (if targeting categories)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCategoryIds?: string[];

  @ApiPropertyOptional({ description: 'Target customer segment IDs (if targeting segments)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCustomerSegments?: string[];

  @ApiProperty({ description: 'Promotion start date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Promotion end date' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Discount percentage (for percentage discounts)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Discount amount (for fixed amount discounts)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Minimum purchase amount to qualify' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPurchaseAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum discount amount (for percentage discounts)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum number of uses per customer' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerCustomer?: number;

  @ApiPropertyOptional({ description: 'Total maximum uses for the promotion' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTotalUses?: number;

  @ApiPropertyOptional({ description: 'Priority for promotion application (higher number = higher priority)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether promotion can be combined with other promotions' })
  @IsOptional()
  @IsBoolean()
  isCombinable?: boolean;

  @ApiPropertyOptional({ description: 'Promotion conditions' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionConditionDto)
  conditions?: PromotionConditionDto[];

  @ApiPropertyOptional({ description: 'Promotion actions' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionActionDto)
  actions?: PromotionActionDto[];

  @ApiPropertyOptional({ description: 'Promotion code (if applicable)' })
  @IsOptional()
  @IsString()
  promotionCode?: string;

  @ApiPropertyOptional({ description: 'Whether promotion is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLocationPromotionDto {
  @ApiPropertyOptional({ description: 'Promotion name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Promotion description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PromotionType, description: 'Type of promotion' })
  @IsOptional()
  @IsEnum(PromotionType)
  promotionType?: PromotionType;

  @ApiPropertyOptional({ enum: PromotionTargetType, description: 'What the promotion targets' })
  @IsOptional()
  @IsEnum(PromotionTargetType)
  targetType?: PromotionTargetType;

  @ApiPropertyOptional({ description: 'Target product IDs (if targeting specific products)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetProductIds?: string[];

  @ApiPropertyOptional({ description: 'Target category IDs (if targeting categories)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCategoryIds?: string[];

  @ApiPropertyOptional({ description: 'Target customer segment IDs (if targeting segments)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCustomerSegments?: string[];

  @ApiPropertyOptional({ description: 'Promotion start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Promotion end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Discount percentage (for percentage discounts)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Discount amount (for fixed amount discounts)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Minimum purchase amount to qualify' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPurchaseAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum discount amount (for percentage discounts)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum number of uses per customer' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerCustomer?: number;

  @ApiPropertyOptional({ description: 'Total maximum uses for the promotion' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTotalUses?: number;

  @ApiPropertyOptional({ description: 'Priority for promotion application (higher number = higher priority)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether promotion can be combined with other promotions' })
  @IsOptional()
  @IsBoolean()
  isCombinable?: boolean;

  @ApiPropertyOptional({ description: 'Promotion conditions' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionConditionDto)
  conditions?: PromotionConditionDto[];

  @ApiPropertyOptional({ description: 'Promotion actions' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionActionDto)
  actions?: PromotionActionDto[];

  @ApiPropertyOptional({ description: 'Promotion code (if applicable)' })
  @IsOptional()
  @IsString()
  promotionCode?: string;

  @ApiPropertyOptional({ description: 'Whether promotion is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: PromotionStatus, description: 'Promotion status' })
  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;
}

export class LocationPromotionQueryDto {
  @ApiPropertyOptional({ enum: PromotionType, description: 'Promotion type to filter by' })
  @IsOptional()
  @IsEnum(PromotionType)
  promotionType?: PromotionType;

  @ApiPropertyOptional({ enum: PromotionStatus, description: 'Promotion status to filter by' })
  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;

  @ApiPropertyOptional({ description: 'Whether to include only active promotions' })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: 'Product ID to find applicable promotions' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Customer ID to find applicable promotions' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ApplyPromotionDto {
  @ApiProperty({ description: 'Promotion ID or code' })
  @IsString()
  promotionIdOrCode: string;

  @ApiProperty({ description: 'Cart items' })
  @IsArray()
  cartItems: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;

  @ApiPropertyOptional({ description: 'Customer ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Additional context for promotion application' })
  @IsOptional()
  context?: Record<string, any>;
}

export class PromotionApplicationResultDto {
  @ApiProperty({ description: 'Whether promotion was successfully applied' })
  applied: boolean;

  @ApiProperty({ description: 'Promotion details' })
  promotion: {
    id: string;
    name: string;
    type: PromotionType;
  };

  @ApiProperty({ description: 'Original total amount' })
  originalAmount: number;

  @ApiProperty({ description: 'Final amount after promotion' })
  finalAmount: number;

  @ApiProperty({ description: 'Total discount amount' })
  discountAmount: number;

  @ApiProperty({ description: 'Discount percentage' })
  discountPercentage: number;

  @ApiProperty({ description: 'Application details' })
  details: Array<{
    itemId: string;
    originalPrice: number;
    discountedPrice: number;
    discountAmount: number;
  }>;

  @ApiPropertyOptional({ description: 'Error message if promotion could not be applied' })
  @IsOptional()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Reason why promotion was not applied' })
  @IsOptional()
  reason?: string;
}