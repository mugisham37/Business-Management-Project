import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsBoolean, 
  IsEnum, 
  IsUUID, 
  IsArray, 
  IsObject,
  Min, 
  Max,
  ValidateNested,
  IsNotEmpty,
  Length
} from 'class-validator';
import { Type } from 'class-transformer';

// Enums
export enum WarehouseStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  CLOSED = 'closed',
}

export enum LayoutType {
  GRID = 'grid',
  FLOW = 'flow',
  HYBRID = 'hybrid',
}

export enum SecurityLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  HIGH = 'high',
  MAXIMUM = 'maximum',
}

export enum WarehouseZoneType {
  RECEIVING = 'receiving',
  STORAGE = 'storage',
  PICKING = 'picking',
  PACKING = 'packing',
  SHIPPING = 'shipping',
  RETURNS = 'returns',
  QUARANTINE = 'quarantine',
  STAGING = 'staging',
  CROSS_DOCK = 'cross_dock',
  OFFICE = 'office',
  MAINTENANCE = 'maintenance',
}

export enum BinLocationStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  DAMAGED = 'damaged',
  MAINTENANCE = 'maintenance',
  BLOCKED = 'blocked',
}

// Base DTOs
export class CreateWarehouseDto {
  @ApiProperty({ description: 'Location ID reference' })
  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @ApiProperty({ description: 'Warehouse code' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  warehouseCode!: string;

  @ApiProperty({ description: 'Warehouse name' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name!: string;

  @ApiPropertyOptional({ description: 'Warehouse description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Total square footage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalSquareFootage?: number;

  @ApiPropertyOptional({ description: 'Storage square footage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  storageSquareFootage?: number;

  @ApiPropertyOptional({ description: 'Ceiling height in feet' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ceilingHeight?: number;

  @ApiPropertyOptional({ description: 'Layout type', enum: LayoutType })
  @IsOptional()
  @IsEnum(LayoutType)
  layoutType?: LayoutType;

  @ApiPropertyOptional({ description: 'Aisle configuration' })
  @IsOptional()
  @IsObject()
  aisleConfiguration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Operating hours' })
  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  timezone?: string;

  @ApiPropertyOptional({ description: 'Temperature controlled' })
  @IsOptional()
  @IsBoolean()
  temperatureControlled?: boolean;

  @ApiPropertyOptional({ description: 'Temperature range' })
  @IsOptional()
  @IsObject()
  temperatureRange?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Humidity controlled' })
  @IsOptional()
  @IsBoolean()
  humidityControlled?: boolean;

  @ApiPropertyOptional({ description: 'Humidity range' })
  @IsOptional()
  @IsObject()
  humidityRange?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Security level', enum: SecurityLevel })
  @IsOptional()
  @IsEnum(SecurityLevel)
  securityLevel?: SecurityLevel;

  @ApiPropertyOptional({ description: 'Access control required' })
  @IsOptional()
  @IsBoolean()
  accessControlRequired?: boolean;

  @ApiPropertyOptional({ description: 'Warehouse manager ID' })
  @IsOptional()
  @IsUUID()
  warehouseManagerId?: string;

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Integration settings' })
  @IsOptional()
  @IsObject()
  integrationSettings?: Record<string, any>;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional({ description: 'Warehouse name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ description: 'Warehouse description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Total square footage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalSquareFootage?: number;

  @ApiPropertyOptional({ description: 'Storage square footage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  storageSquareFootage?: number;

  @ApiPropertyOptional({ description: 'Ceiling height in feet' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ceilingHeight?: number;

  @ApiPropertyOptional({ description: 'Layout type', enum: LayoutType })
  @IsOptional()
  @IsEnum(LayoutType)
  layoutType?: LayoutType;

  @ApiPropertyOptional({ description: 'Aisle configuration' })
  @IsOptional()
  @IsObject()
  aisleConfiguration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Operating hours' })
  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  timezone?: string;

  @ApiPropertyOptional({ description: 'Temperature controlled' })
  @IsOptional()
  @IsBoolean()
  temperatureControlled?: boolean;

  @ApiPropertyOptional({ description: 'Temperature range' })
  @IsOptional()
  @IsObject()
  temperatureRange?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Humidity controlled' })
  @IsOptional()
  @IsBoolean()
  humidityControlled?: boolean;

  @ApiPropertyOptional({ description: 'Humidity range' })
  @IsOptional()
  @IsObject()
  humidityRange?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Security level', enum: SecurityLevel })
  @IsOptional()
  @IsEnum(SecurityLevel)
  securityLevel?: SecurityLevel;

  @ApiPropertyOptional({ description: 'Access control required' })
  @IsOptional()
  @IsBoolean()
  accessControlRequired?: boolean;

  @ApiPropertyOptional({ description: 'Warehouse manager ID' })
  @IsOptional()
  @IsUUID()
  warehouseManagerId?: string;

  @ApiPropertyOptional({ description: 'Warehouse status', enum: WarehouseStatus })
  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Integration settings' })
  @IsOptional()
  @IsObject()
  integrationSettings?: Record<string, any>;
}

export class CreateWarehouseZoneDto {
  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({ description: 'Zone code' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  zoneCode!: string;

  @ApiProperty({ description: 'Zone name' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name!: string;

  @ApiPropertyOptional({ description: 'Zone description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiProperty({ description: 'Zone type', enum: WarehouseZoneType })
  @IsEnum(WarehouseZoneType)
  zoneType!: WarehouseZoneType;

  @ApiPropertyOptional({ description: 'Priority level' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ description: 'Zone coordinates' })
  @IsOptional()
  @IsObject()
  coordinates?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Square footage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  squareFootage?: number;

  @ApiPropertyOptional({ description: 'Maximum bin locations' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBinLocations?: number;

  @ApiPropertyOptional({ description: 'Temperature controlled' })
  @IsOptional()
  @IsBoolean()
  temperatureControlled?: boolean;

  @ApiPropertyOptional({ description: 'Temperature range' })
  @IsOptional()
  @IsObject()
  temperatureRange?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Humidity controlled' })
  @IsOptional()
  @IsBoolean()
  humidityControlled?: boolean;

  @ApiPropertyOptional({ description: 'Access level' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  accessLevel?: string;

  @ApiPropertyOptional({ description: 'Requires authorization' })
  @IsOptional()
  @IsBoolean()
  requiresAuthorization?: boolean;

  @ApiPropertyOptional({ description: 'Allow mixed products' })
  @IsOptional()
  @IsBoolean()
  allowMixedProducts?: boolean;

  @ApiPropertyOptional({ description: 'Allow mixed batches' })
  @IsOptional()
  @IsBoolean()
  allowMixedBatches?: boolean;

  @ApiPropertyOptional({ description: 'FIFO enforced' })
  @IsOptional()
  @IsBoolean()
  fifoEnforced?: boolean;

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;
}

export class UpdateWarehouseZoneDto {
  @ApiPropertyOptional({ description: 'Zone name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ description: 'Zone description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Priority level' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ description: 'Zone coordinates' })
  @IsOptional()
  @IsObject()
  coordinates?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Square footage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  squareFootage?: number;

  @ApiPropertyOptional({ description: 'Maximum bin locations' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBinLocations?: number;

  @ApiPropertyOptional({ description: 'Temperature controlled' })
  @IsOptional()
  @IsBoolean()
  temperatureControlled?: boolean;

  @ApiPropertyOptional({ description: 'Temperature range' })
  @IsOptional()
  @IsObject()
  temperatureRange?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Humidity controlled' })
  @IsOptional()
  @IsBoolean()
  humidityControlled?: boolean;

  @ApiPropertyOptional({ description: 'Access level' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  accessLevel?: string;

  @ApiPropertyOptional({ description: 'Requires authorization' })
  @IsOptional()
  @IsBoolean()
  requiresAuthorization?: boolean;

  @ApiPropertyOptional({ description: 'Allow mixed products' })
  @IsOptional()
  @IsBoolean()
  allowMixedProducts?: boolean;

  @ApiPropertyOptional({ description: 'Allow mixed batches' })
  @IsOptional()
  @IsBoolean()
  allowMixedBatches?: boolean;

  @ApiPropertyOptional({ description: 'FIFO enforced' })
  @IsOptional()
  @IsBoolean()
  fifoEnforced?: boolean;

  @ApiPropertyOptional({ description: 'Zone status' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  status?: string;

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;
}

export class CreateBinLocationDto {
  @ApiProperty({ description: 'Zone ID' })
  @IsUUID()
  @IsNotEmpty()
  zoneId!: string;

  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({ description: 'Bin code' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  binCode!: string;

  @ApiProperty({ description: 'Display name' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  displayName!: string;

  @ApiPropertyOptional({ description: 'Aisle' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  aisle?: string;

  @ApiPropertyOptional({ description: 'Bay' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  bay?: string;

  @ApiPropertyOptional({ description: 'Level' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  level?: string;

  @ApiPropertyOptional({ description: 'Position' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  position?: string;

  @ApiPropertyOptional({ description: 'X coordinate' })
  @IsOptional()
  @IsNumber()
  xCoordinate?: number;

  @ApiPropertyOptional({ description: 'Y coordinate' })
  @IsOptional()
  @IsNumber()
  yCoordinate?: number;

  @ApiPropertyOptional({ description: 'Z coordinate' })
  @IsOptional()
  @IsNumber()
  zCoordinate?: number;

  @ApiPropertyOptional({ description: 'Length' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @ApiPropertyOptional({ description: 'Width' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @ApiPropertyOptional({ description: 'Height' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  @ApiPropertyOptional({ description: 'Maximum weight' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxWeight?: number;

  @ApiPropertyOptional({ description: 'Allowed product types' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedProductTypes?: string[];

  @ApiPropertyOptional({ description: 'Restricted product types' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restrictedProductTypes?: string[];

  @ApiPropertyOptional({ description: 'Temperature controlled' })
  @IsOptional()
  @IsBoolean()
  temperatureControlled?: boolean;

  @ApiPropertyOptional({ description: 'Temperature range' })
  @IsOptional()
  @IsObject()
  temperatureRange?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Hazmat approved' })
  @IsOptional()
  @IsBoolean()
  hazmatApproved?: boolean;

  @ApiPropertyOptional({ description: 'Picking sequence' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pickingSequence?: number;

  @ApiPropertyOptional({ description: 'Access equipment required' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessEquipment?: string[];

  @ApiPropertyOptional({ description: 'Assigned product ID' })
  @IsOptional()
  @IsUUID()
  assignedProductId?: string;

  @ApiPropertyOptional({ description: 'Assigned variant ID' })
  @IsOptional()
  @IsUUID()
  assignedVariantId?: string;

  @ApiPropertyOptional({ description: 'Dedicated product bin' })
  @IsOptional()
  @IsBoolean()
  dedicatedProduct?: boolean;

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class UpdateBinLocationDto {
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Aisle' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  aisle?: string;

  @ApiPropertyOptional({ description: 'Bay' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  bay?: string;

  @ApiPropertyOptional({ description: 'Level' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  level?: string;

  @ApiPropertyOptional({ description: 'Position' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  position?: string;

  @ApiPropertyOptional({ description: 'X coordinate' })
  @IsOptional()
  @IsNumber()
  xCoordinate?: number;

  @ApiPropertyOptional({ description: 'Y coordinate' })
  @IsOptional()
  @IsNumber()
  yCoordinate?: number;

  @ApiPropertyOptional({ description: 'Z coordinate' })
  @IsOptional()
  @IsNumber()
  zCoordinate?: number;

  @ApiPropertyOptional({ description: 'Length' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @ApiPropertyOptional({ description: 'Width' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @ApiPropertyOptional({ description: 'Height' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  @ApiPropertyOptional({ description: 'Maximum weight' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxWeight?: number;

  @ApiPropertyOptional({ description: 'Bin status', enum: BinLocationStatus })
  @IsOptional()
  @IsEnum(BinLocationStatus)
  status?: BinLocationStatus;

  @ApiPropertyOptional({ description: 'Occupancy percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  occupancyPercentage?: number;

  @ApiPropertyOptional({ description: 'Current weight' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentWeight?: number;

  @ApiPropertyOptional({ description: 'Allowed product types' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedProductTypes?: string[];

  @ApiPropertyOptional({ description: 'Restricted product types' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restrictedProductTypes?: string[];

  @ApiPropertyOptional({ description: 'Temperature controlled' })
  @IsOptional()
  @IsBoolean()
  temperatureControlled?: boolean;

  @ApiPropertyOptional({ description: 'Temperature range' })
  @IsOptional()
  @IsObject()
  temperatureRange?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Hazmat approved' })
  @IsOptional()
  @IsBoolean()
  hazmatApproved?: boolean;

  @ApiPropertyOptional({ description: 'Picking sequence' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pickingSequence?: number;

  @ApiPropertyOptional({ description: 'Access equipment required' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessEquipment?: string[];

  @ApiPropertyOptional({ description: 'Assigned product ID' })
  @IsOptional()
  @IsUUID()
  assignedProductId?: string;

  @ApiPropertyOptional({ description: 'Assigned variant ID' })
  @IsOptional()
  @IsUUID()
  assignedVariantId?: string;

  @ApiPropertyOptional({ description: 'Dedicated product bin' })
  @IsOptional()
  @IsBoolean()
  dedicatedProduct?: boolean;

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// Query DTOs
export class WarehouseQueryDto {
  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: WarehouseStatus })
  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;

  @ApiPropertyOptional({ description: 'Filter by location ID' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Filter by manager ID' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'name';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

export class BinLocationQueryDto {
  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by warehouse ID' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Filter by zone ID' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: BinLocationStatus })
  @IsOptional()
  @IsEnum(BinLocationStatus)
  status?: BinLocationStatus;

  @ApiPropertyOptional({ description: 'Filter by aisle' })
  @IsOptional()
  @IsString()
  aisle?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned product ID' })
  @IsOptional()
  @IsUUID()
  assignedProductId?: string;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'binCode';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// Capacity tracking DTOs
export class WarehouseCapacityDto {
  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ description: 'Total capacity units' })
  @IsNumber()
  @Min(0)
  totalCapacity!: number;

  @ApiProperty({ description: 'Used capacity units' })
  @IsNumber()
  @Min(0)
  usedCapacity!: number;

  @ApiProperty({ description: 'Available capacity units' })
  @IsNumber()
  @Min(0)
  availableCapacity!: number;

  @ApiProperty({ description: 'Capacity utilization percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  utilizationPercentage!: number;

  @ApiProperty({ description: 'Total bin locations' })
  @IsNumber()
  @Min(0)
  totalBinLocations!: number;

  @ApiProperty({ description: 'Occupied bin locations' })
  @IsNumber()
  @Min(0)
  occupiedBinLocations!: number;

  @ApiProperty({ description: 'Available bin locations' })
  @IsNumber()
  @Min(0)
  availableBinLocations!: number;
}

export class BulkCreateBinLocationsDto {
  @ApiProperty({ description: 'Zone ID' })
  @IsUUID()
  @IsNotEmpty()
  zoneId!: string;

  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({ description: 'Aisle prefix' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 5)
  aislePrefix!: string;

  @ApiProperty({ description: 'Number of aisles' })
  @IsNumber()
  @Min(1)
  @Max(50)
  aisleCount!: number;

  @ApiProperty({ description: 'Number of bays per aisle' })
  @IsNumber()
  @Min(1)
  @Max(100)
  bayCount!: number;

  @ApiProperty({ description: 'Number of levels per bay' })
  @IsNumber()
  @Min(1)
  @Max(20)
  levelCount!: number;

  @ApiPropertyOptional({ description: 'Bin dimensions' })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    maxWeight?: number;
  };

  @ApiPropertyOptional({ description: 'Default configuration' })
  @IsOptional()
  @IsObject()
  defaultConfiguration?: Record<string, any>;
}