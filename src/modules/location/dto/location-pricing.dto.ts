import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsBoolean, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

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

export class PricingRuleConditionDto {
  @ApiProperty({ description: 'Condition type (e.g., quantity, customer_type, time_range)' })
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

export class CreateLocationPricingRuleDto {
  @ApiProperty({ description: 'Rule name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Rule description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PricingRuleType, description: 'Type of pricing rule' })
  @IsEnum(PricingRuleType)
  ruleType: PricingRuleType;

  @ApiProperty({ description: 'Product ID this rule applies to' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ description: 'Product category ID this rule applies to' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: 'Rule value (percentage, amount, or fixed price)' })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ description: 'Minimum quantity for rule to apply' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minQuantity?: number;

  @ApiPropertyOptional({ description: 'Maximum quantity for rule to apply' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxQuantity?: number;

  @ApiPropertyOptional({ description: 'Rule start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Rule end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Priority for rule application (higher number = higher priority)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ description: 'Additional conditions for rule application' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingRuleConditionDto)
  conditions?: PricingRuleConditionDto[];

  @ApiPropertyOptional({ description: 'Whether rule is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLocationPricingRuleDto {
  @ApiPropertyOptional({ description: 'Rule name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Rule description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PricingRuleType, description: 'Type of pricing rule' })
  @IsOptional()
  @IsEnum(PricingRuleType)
  ruleType?: PricingRuleType;

  @ApiPropertyOptional({ description: 'Rule value (percentage, amount, or fixed price)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ description: 'Minimum quantity for rule to apply' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minQuantity?: number;

  @ApiPropertyOptional({ description: 'Maximum quantity for rule to apply' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxQuantity?: number;

  @ApiPropertyOptional({ description: 'Rule start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Rule end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Priority for rule application (higher number = higher priority)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ description: 'Additional conditions for rule application' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingRuleConditionDto)
  conditions?: PricingRuleConditionDto[];

  @ApiPropertyOptional({ description: 'Whether rule is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: PricingRuleStatus, description: 'Rule status' })
  @IsOptional()
  @IsEnum(PricingRuleStatus)
  status?: PricingRuleStatus;
}

export class LocationPricingQueryDto {
  @ApiPropertyOptional({ description: 'Product ID to filter by' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Category ID to filter by' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: PricingRuleType, description: 'Rule type to filter by' })
  @IsOptional()
  @IsEnum(PricingRuleType)
  ruleType?: PricingRuleType;

  @ApiPropertyOptional({ enum: PricingRuleStatus, description: 'Rule status to filter by' })
  @IsOptional()
  @IsEnum(PricingRuleStatus)
  status?: PricingRuleStatus;

  @ApiPropertyOptional({ description: 'Whether to include only active rules' })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;

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

export class CalculatePriceDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: 'Customer ID for customer-specific pricing' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Additional context for pricing calculation' })
  @IsOptional()
  context?: Record<string, any>;
}

export class PriceCalculationResultDto {
  @ApiProperty({ description: 'Original base price' })
  basePrice: number;

  @ApiProperty({ description: 'Final calculated price' })
  finalPrice: number;

  @ApiProperty({ description: 'Total discount amount' })
  discountAmount: number;

  @ApiProperty({ description: 'Discount percentage' })
  discountPercentage: number;

  @ApiProperty({ description: 'Applied pricing rules' })
  appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    ruleType: PricingRuleType;
    value: number;
    discountAmount: number;
  }>;

  @ApiProperty({ description: 'Calculation breakdown' })
  breakdown: Array<{
    step: string;
    description: string;
    amount: number;
    runningTotal: number;
  }>;
}