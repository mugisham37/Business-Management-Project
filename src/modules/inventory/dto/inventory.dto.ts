import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsBoolean, 
  IsObject, 
  IsUUID,
  IsEnum,
  IsDateString,
  Min,
  Max,
  Length,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// Enums
export enum InventoryMovementType {
  SALE = 'sale',
  PURCHASE = 'purchase',
  ADJUSTMENT = 'adjustment',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  RETURN = 'return',
  DAMAGE = 'damage',
  THEFT = 'theft',
  EXPIRED = 'expired',
  RECOUNT = 'recount',
  PRODUCTION = 'production',
  CONSUMPTION = 'consumption',
}

export enum InventoryAdjustmentReason {
  MANUAL_COUNT = 'manual_count',
  CYCLE_COUNT = 'cycle_count',
  DAMAGED_GOODS = 'damaged_goods',
  EXPIRED_GOODS = 'expired_goods',
  THEFT_LOSS = 'theft_loss',
  SUPPLIER_ERROR = 'supplier_error',
  SYSTEM_ERROR = 'system_error',
  RETURN_TO_VENDOR = 'return_to_vendor',
  PROMOTIONAL_USE = 'promotional_use',
  INTERNAL_USE = 'internal_use',
  OTHER = 'other',
}

export enum InventoryValuationMethod {
  FIFO = 'fifo',
  LIFO = 'lifo',
  AVERAGE = 'average',
  SPECIFIC = 'specific',
}

// DTOs
export class CreateInventoryLevelDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Product variant ID' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ description: 'Location ID' })
  @IsUUID()
  locationId: string;

  @ApiPropertyOptional({ description: 'Current stock level' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentLevel?: number;

  @ApiPropertyOptional({ description: 'Minimum stock level' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockLevel?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStockLevel?: number;

  @ApiPropertyOptional({ description: 'Reorder point' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional({ description: 'Reorder quantity' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderQuantity?: number;

  @ApiPropertyOptional({ description: 'Valuation method', enum: InventoryValuationMethod })
  @IsOptional()
  @IsEnum(InventoryValuationMethod)
  valuationMethod?: InventoryValuationMethod;

  @ApiPropertyOptional({ description: 'Average cost per unit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  averageCost?: number;

  @ApiPropertyOptional({ description: 'Bin location within warehouse' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  binLocation?: string;

  @ApiPropertyOptional({ description: 'Zone within warehouse' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  zone?: string;

  @ApiPropertyOptional({ description: 'Custom attributes' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}

export class UpdateInventoryLevelDto extends PartialType(CreateInventoryLevelDto) {}

export class InventoryAdjustmentDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Product variant ID' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ description: 'Location ID' })
  @IsUUID()
  locationId: string;

  @ApiProperty({ description: 'Adjustment amount (positive or negative)' })
  @IsNumber()
  adjustment: number;

  @ApiProperty({ description: 'Reason for adjustment', enum: InventoryAdjustmentReason })
  @IsEnum(InventoryAdjustmentReason)
  reason: InventoryAdjustmentReason;

  @ApiPropertyOptional({ description: 'Notes about the adjustment' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Unit cost for valuation' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Batch number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  batchNumber?: string;

  @ApiPropertyOptional({ description: 'Lot number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lotNumber?: string;

  @ApiPropertyOptional({ description: 'Expiry date for batch tracking' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class InventoryTransferDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Product variant ID' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ description: 'Source location ID' })
  @IsUUID()
  fromLocationId: string;

  @ApiProperty({ description: 'Destination location ID' })
  @IsUUID()
  toLocationId: string;

  @ApiProperty({ description: 'Quantity to transfer' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({ description: 'Transfer notes' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiPropertyOptional({ description: 'Expected delivery date' })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;
}

export class InventoryReservationDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Product variant ID' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ description: 'Location ID' })
  @IsUUID()
  locationId: string;

  @ApiProperty({ description: 'Quantity to reserve' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ description: 'What the inventory is reserved for' })
  @IsString()
  @Length(1, 50)
  reservedFor: string;

  @ApiProperty({ description: 'Reference ID (order, quote, etc.)' })
  @IsString()
  @Length(1, 255)
  referenceId: string;

  @ApiPropertyOptional({ description: 'Reservation expiry date' })
  @IsOptional()
  @IsDateString()
  reservedUntil?: string;

  @ApiPropertyOptional({ description: 'Reservation notes' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class InventoryQueryDto {
  @ApiPropertyOptional({ description: 'Filter by product ID' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by location ID' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Filter by zone' })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ description: 'Show only low stock items' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  lowStock?: boolean;

  @ApiPropertyOptional({ description: 'Show only out of stock items' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  outOfStock?: boolean;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Page number (1-based)' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class InventoryLevelResponseDto {
  @ApiProperty({ description: 'Inventory level ID' })
  id: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiPropertyOptional({ description: 'Product variant ID' })
  variantId?: string;

  @ApiProperty({ description: 'Location ID' })
  locationId: string;

  @ApiProperty({ description: 'Current stock level' })
  currentLevel: number;

  @ApiProperty({ description: 'Available stock level (current - reserved)' })
  availableLevel: number;

  @ApiProperty({ description: 'Reserved stock level' })
  reservedLevel: number;

  @ApiProperty({ description: 'Minimum stock level' })
  minStockLevel: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  maxStockLevel?: number;

  @ApiProperty({ description: 'Reorder point' })
  reorderPoint: number;

  @ApiProperty({ description: 'Reorder quantity' })
  reorderQuantity: number;

  @ApiProperty({ description: 'Valuation method', enum: InventoryValuationMethod })
  valuationMethod: InventoryValuationMethod;

  @ApiProperty({ description: 'Average cost per unit' })
  averageCost: number;

  @ApiProperty({ description: 'Total inventory value' })
  totalValue: number;

  @ApiPropertyOptional({ description: 'Bin location' })
  binLocation?: string;

  @ApiPropertyOptional({ description: 'Zone' })
  zone?: string;

  @ApiPropertyOptional({ description: 'Last movement timestamp' })
  lastMovementAt?: Date;

  @ApiPropertyOptional({ description: 'Last count timestamp' })
  lastCountAt?: Date;

  @ApiProperty({ description: 'Low stock alert sent flag' })
  lowStockAlertSent: boolean;

  @ApiPropertyOptional({ description: 'Last alert sent timestamp' })
  lastAlertSentAt?: Date;

  @ApiPropertyOptional({ description: 'Custom attributes' })
  attributes?: Record<string, any>;

  @ApiProperty({ description: 'Is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  updatedBy?: string;

  @ApiProperty({ description: 'Version number' })
  version: number;

  @ApiPropertyOptional({ description: 'Product information' })
  product?: any;

  @ApiPropertyOptional({ description: 'Variant information' })
  variant?: any;
}

export class InventoryMovementResponseDto {
  @ApiProperty({ description: 'Movement ID' })
  id: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiPropertyOptional({ description: 'Product variant ID' })
  variantId?: string;

  @ApiProperty({ description: 'Location ID' })
  locationId: string;

  @ApiProperty({ description: 'Movement type', enum: InventoryMovementType })
  movementType: InventoryMovementType;

  @ApiProperty({ description: 'Quantity moved (positive for in, negative for out)' })
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit cost' })
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Total cost' })
  totalCost?: number;

  @ApiProperty({ description: 'Stock level before movement' })
  previousLevel: number;

  @ApiProperty({ description: 'Stock level after movement' })
  newLevel: number;

  @ApiPropertyOptional({ description: 'Reference document type' })
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Reference document ID' })
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Reference document number' })
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Batch number' })
  batchNumber?: string;

  @ApiPropertyOptional({ description: 'Lot number' })
  lotNumber?: string;

  @ApiPropertyOptional({ description: 'Expiry date' })
  expiryDate?: Date;

  @ApiPropertyOptional({ description: 'Adjustment reason', enum: InventoryAdjustmentReason })
  reason?: InventoryAdjustmentReason;

  @ApiPropertyOptional({ description: 'Movement notes' })
  notes?: string;

  @ApiProperty({ description: 'Requires approval flag' })
  requiresApproval: boolean;

  @ApiPropertyOptional({ description: 'Approved by user ID' })
  approvedBy?: string;

  @ApiPropertyOptional({ description: 'Approval timestamp' })
  approvedAt?: Date;

  @ApiPropertyOptional({ description: 'Source bin location' })
  fromBinLocation?: string;

  @ApiPropertyOptional({ description: 'Destination bin location' })
  toBinLocation?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  updatedBy?: string;

  @ApiProperty({ description: 'Version number' })
  version: number;

  @ApiPropertyOptional({ description: 'Product information' })
  product?: any;

  @ApiPropertyOptional({ description: 'Variant information' })
  variant?: any;
}