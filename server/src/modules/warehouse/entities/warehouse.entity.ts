import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsUUID, IsObject, IsArray, Min, Max } from 'class-validator';

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

export class Warehouse {
  @ApiProperty({ description: 'Unique identifier' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ description: 'Location ID reference' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ description: 'Warehouse code' })
  @IsString()
  warehouseCode!: string;

  @ApiProperty({ description: 'Warehouse name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Warehouse description' })
  @IsOptional()
  @IsString()
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

  @ApiPropertyOptional({ description: 'Total bin locations' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalBinLocations?: number;

  @ApiPropertyOptional({ description: 'Occupied bin locations' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  occupiedBinLocations?: number;

  @ApiPropertyOptional({ description: 'Maximum capacity in units' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCapacityUnits?: number;

  @ApiPropertyOptional({ description: 'Current capacity in units' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentCapacityUnits?: number;

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

  @ApiPropertyOptional({ description: 'WMS integration enabled' })
  @IsOptional()
  @IsBoolean()
  wmsIntegration?: boolean;

  @ApiPropertyOptional({ description: 'Barcode system enabled' })
  @IsOptional()
  @IsBoolean()
  barcodeSystem?: boolean;

  @ApiPropertyOptional({ description: 'RFID enabled' })
  @IsOptional()
  @IsBoolean()
  rfidEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Automated sorting enabled' })
  @IsOptional()
  @IsBoolean()
  automatedSorting?: boolean;

  @ApiPropertyOptional({ description: 'Picking accuracy percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pickingAccuracy?: number;

  @ApiPropertyOptional({ description: 'Average pick time in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  averagePickTime?: number;

  @ApiPropertyOptional({ description: 'Throughput per hour' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  throughputPerHour?: number;

  @ApiPropertyOptional({ description: 'Warehouse manager ID' })
  @IsOptional()
  @IsUUID()
  warehouseManagerId?: string;

  @ApiProperty({ description: 'Warehouse status', enum: WarehouseStatus })
  @IsEnum(WarehouseStatus)
  status!: WarehouseStatus;

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Integration settings' })
  @IsOptional()
  @IsObject()
  integrationSettings?: Record<string, any>;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Deleted at timestamp' })
  @IsOptional()
  deletedAt?: Date;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  @ApiProperty({ description: 'Version number' })
  @IsNumber()
  version!: number;
}

export class WarehouseZone {
  @ApiProperty({ description: 'Unique identifier' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ description: 'Zone code' })
  @IsString()
  zoneCode!: string;

  @ApiProperty({ description: 'Zone name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Zone description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Zone type' })
  @IsString()
  zoneType!: string;

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

  @ApiPropertyOptional({ description: 'Current bin locations' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentBinLocations?: number;

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

  @ApiProperty({ description: 'Zone status' })
  @IsString()
  status!: string;

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;
}

export class BinLocation {
  @ApiProperty({ description: 'Unique identifier' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ description: 'Zone ID' })
  @IsUUID()
  zoneId!: string;

  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ description: 'Bin code' })
  @IsString()
  binCode!: string;

  @ApiProperty({ description: 'Display name' })
  @IsString()
  displayName!: string;

  @ApiPropertyOptional({ description: 'Aisle' })
  @IsOptional()
  @IsString()
  aisle?: string;

  @ApiPropertyOptional({ description: 'Bay' })
  @IsOptional()
  @IsString()
  bay?: string;

  @ApiPropertyOptional({ description: 'Level' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: 'Position' })
  @IsOptional()
  @IsString()
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

  @ApiPropertyOptional({ description: 'Volume' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  volume?: number;

  @ApiPropertyOptional({ description: 'Maximum weight' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxWeight?: number;

  @ApiProperty({ description: 'Bin status' })
  @IsString()
  status!: string;

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
  allowedProductTypes?: string[];

  @ApiPropertyOptional({ description: 'Restricted product types' })
  @IsOptional()
  @IsArray()
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

  @ApiPropertyOptional({ description: 'Last activity timestamp' })
  @IsOptional()
  lastActivityAt?: Date;

  @ApiPropertyOptional({ description: 'Last pick timestamp' })
  @IsOptional()
  lastPickAt?: Date;

  @ApiPropertyOptional({ description: 'Last replenish timestamp' })
  @IsOptional()
  lastReplenishAt?: Date;

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;
}