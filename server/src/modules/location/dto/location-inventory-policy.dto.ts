import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

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

export class InventoryPolicyRuleDto {
  @ApiProperty({ description: 'Rule type' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Rule condition' })
  @IsString()
  condition!: string;

  @ApiProperty({ description: 'Rule action' })
  @IsString()
  action!: string;

  @ApiProperty({ description: 'Rule parameters' })
  parameters!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Rule priority' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;
}

export class CreateLocationInventoryPolicyDto {
  @ApiProperty({ description: 'Policy name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Policy description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: InventoryPolicyType, description: 'Type of inventory policy' })
  @IsEnum(InventoryPolicyType)
  policyType!: InventoryPolicyType;

  @ApiPropertyOptional({ description: 'Product ID this policy applies to (if product-specific)' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Product category ID this policy applies to (if category-specific)' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Minimum stock level (reorder point)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockLevel?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStockLevel?: number;

  @ApiPropertyOptional({ description: 'Safety stock quantity' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  safetyStock?: number;

  @ApiPropertyOptional({ description: 'Reorder quantity' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  reorderQuantity?: number;

  @ApiPropertyOptional({ description: 'Lead time in days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  leadTimeDays?: number;

  @ApiPropertyOptional({ enum: StockReplenishmentMethod, description: 'How stock should be replenished' })
  @IsOptional()
  @IsEnum(StockReplenishmentMethod)
  replenishmentMethod?: StockReplenishmentMethod;

  @ApiPropertyOptional({ enum: ABCClassification, description: 'ABC classification for the item' })
  @IsOptional()
  @IsEnum(ABCClassification)
  abcClassification?: ABCClassification;

  @ApiPropertyOptional({ description: 'Seasonal demand multiplier (1.0 = normal, >1.0 = higher demand)' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10.0)
  seasonalMultiplier?: number;

  @ApiPropertyOptional({ description: 'Demand forecast period in days' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  forecastPeriodDays?: number;

  @ApiPropertyOptional({ description: 'Whether to automatically create purchase orders' })
  @IsOptional()
  @IsBoolean()
  autoCreatePurchaseOrders?: boolean;

  @ApiPropertyOptional({ description: 'Preferred supplier ID for automatic orders' })
  @IsOptional()
  @IsString()
  preferredSupplierId?: string;

  @ApiPropertyOptional({ description: 'Policy rules' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryPolicyRuleDto)
  rules?: InventoryPolicyRuleDto[];

  @ApiPropertyOptional({ description: 'Policy priority (higher number = higher priority)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether policy is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Additional policy parameters' })
  @IsOptional()
  parameters?: Record<string, any>;
}

export class UpdateLocationInventoryPolicyDto {
  @ApiPropertyOptional({ description: 'Policy name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Policy description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: InventoryPolicyType, description: 'Type of inventory policy' })
  @IsOptional()
  @IsEnum(InventoryPolicyType)
  policyType?: InventoryPolicyType;

  @ApiPropertyOptional({ description: 'Minimum stock level (reorder point)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockLevel?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStockLevel?: number;

  @ApiPropertyOptional({ description: 'Safety stock quantity' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  safetyStock?: number;

  @ApiPropertyOptional({ description: 'Reorder quantity' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  reorderQuantity?: number;

  @ApiPropertyOptional({ description: 'Lead time in days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  leadTimeDays?: number;

  @ApiPropertyOptional({ enum: StockReplenishmentMethod, description: 'How stock should be replenished' })
  @IsOptional()
  @IsEnum(StockReplenishmentMethod)
  replenishmentMethod?: StockReplenishmentMethod;

  @ApiPropertyOptional({ enum: ABCClassification, description: 'ABC classification for the item' })
  @IsOptional()
  @IsEnum(ABCClassification)
  abcClassification?: ABCClassification;

  @ApiPropertyOptional({ description: 'Seasonal demand multiplier (1.0 = normal, >1.0 = higher demand)' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10.0)
  seasonalMultiplier?: number;

  @ApiPropertyOptional({ description: 'Demand forecast period in days' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  forecastPeriodDays?: number;

  @ApiPropertyOptional({ description: 'Whether to automatically create purchase orders' })
  @IsOptional()
  @IsBoolean()
  autoCreatePurchaseOrders?: boolean;

  @ApiPropertyOptional({ description: 'Preferred supplier ID for automatic orders' })
  @IsOptional()
  @IsString()
  preferredSupplierId?: string;

  @ApiPropertyOptional({ description: 'Policy rules' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryPolicyRuleDto)
  rules?: InventoryPolicyRuleDto[];

  @ApiPropertyOptional({ description: 'Policy priority (higher number = higher priority)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether policy is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: InventoryPolicyStatus, description: 'Policy status' })
  @IsOptional()
  @IsEnum(InventoryPolicyStatus)
  status?: InventoryPolicyStatus;

  @ApiPropertyOptional({ description: 'Additional policy parameters' })
  @IsOptional()
  parameters?: Record<string, any>;
}

export class LocationInventoryPolicyQueryDto {
  @ApiPropertyOptional({ enum: InventoryPolicyType, description: 'Policy type to filter by' })
  @IsOptional()
  @IsEnum(InventoryPolicyType)
  policyType?: InventoryPolicyType;

  @ApiPropertyOptional({ enum: InventoryPolicyStatus, description: 'Policy status to filter by' })
  @IsOptional()
  @IsEnum(InventoryPolicyStatus)
  status?: InventoryPolicyStatus;

  @ApiPropertyOptional({ description: 'Product ID to filter by' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Category ID to filter by' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Whether to include only active policies' })
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

export class InventoryRecommendationDto {
  @ApiProperty({ description: 'Product ID' })
  productId!: string;

  @ApiProperty({ description: 'Current stock level' })
  currentStock!: number;

  @ApiProperty({ description: 'Recommended action' })
  recommendedAction!: 'reorder' | 'reduce_stock' | 'maintain' | 'increase_safety_stock';

  @ApiProperty({ description: 'Recommended quantity' })
  recommendedQuantity!: number;

  @ApiProperty({ description: 'Reason for recommendation' })
  reason!: string;

  @ApiProperty({ description: 'Priority level' })
  priority!: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({ description: 'Expected stock out date (if applicable)' })
  expectedStockOutDate?: Date;

  @ApiProperty({ description: 'Applied policies' })
  appliedPolicies!: Array<{
    policyId: string;
    policyName: string;
    policyType: InventoryPolicyType;
  }>;
}

export class BulkInventoryPolicyUpdateDto {
  @ApiProperty({ description: 'Product IDs to update' })
  @IsArray()
  @IsString({ each: true })
  productIds!: string[];

  @ApiProperty({ description: 'Policy updates to apply' })
  @ValidateNested()
  
  @Type(() => UpdateLocationInventoryPolicyDto)
  updates!: UpdateLocationInventoryPolicyDto;

  @ApiPropertyOptional({ description: 'Whether to create new policies if they don\'t exist' })
  @IsOptional()
  @IsBoolean()
  createIfNotExists?: boolean;
}