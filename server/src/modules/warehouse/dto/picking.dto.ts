import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsBoolean, 
  IsEnum, 
  IsUUID, 
  IsArray, 
  Min, 
  Max,
  ValidateNested,
  IsNotEmpty,
  Length,
  IsPositive,
  IsDateString
} from 'class-validator';
import { Type } from 'class-transformer';

// Enums
export enum WaveType {
  STANDARD = 'standard',
  PRIORITY = 'priority',
  BATCH = 'batch',
  ZONE = 'zone',
}

export enum WaveStatus {
  PLANNED = 'planned',
  RELEASED = 'released',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PickListStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PickItemStatus {
  PENDING = 'pending',
  PICKED = 'picked',
  SHORT_PICKED = 'short_picked',
  SKIPPED = 'skipped',
}

// Wave DTOs
export class CreatePickingWaveDto {
  @ApiProperty({ description: 'Wave number' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  waveNumber!: string;

  @ApiProperty({ description: 'Wave name' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name!: string;

  @ApiPropertyOptional({ description: 'Wave description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiPropertyOptional({ description: 'Zone IDs included in wave' })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  zoneIds?: string[];

  @ApiPropertyOptional({ description: 'Wave type', enum: WaveType })
  @IsOptional()
  @IsEnum(WaveType)
  waveType?: WaveType;

  @ApiPropertyOptional({ description: 'Priority level' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ description: 'Planned start time' })
  @IsOptional()
  @IsDateString()
  plannedStartTime?: string;

  @ApiPropertyOptional({ description: 'Planned end time' })
  @IsOptional()
  @IsDateString()
  plannedEndTime?: string;

  @ApiPropertyOptional({ description: 'Assigned picker IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  assignedPickers?: string[];

  @ApiPropertyOptional({ description: 'Order IDs to include in wave' })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  orderIds?: string[];

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class UpdatePickingWaveDto {
  @ApiPropertyOptional({ description: 'Wave name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ description: 'Wave description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Zone IDs included in wave' })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  zoneIds?: string[];

  @ApiPropertyOptional({ description: 'Priority level' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ description: 'Planned start time' })
  @IsOptional()
  @IsDateString()
  plannedStartTime?: string;

  @ApiPropertyOptional({ description: 'Planned end time' })
  @IsOptional()
  @IsDateString()
  plannedEndTime?: string;

  @ApiPropertyOptional({ description: 'Assigned picker IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  assignedPickers?: string[];

  @ApiPropertyOptional({ description: 'Wave status', enum: WaveStatus })
  @IsOptional()
  @IsEnum(WaveStatus)
  status?: WaveStatus;

  @ApiPropertyOptional({ description: 'Configuration settings' })
  @IsOptional()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// Pick List DTOs
export class CreatePickListDto {
  @ApiProperty({ description: 'Pick list number' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  pickListNumber!: string;

  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiPropertyOptional({ description: 'Wave ID' })
  @IsOptional()
  @IsUUID()
  waveId?: string;

  @ApiPropertyOptional({ description: 'Assigned picker ID' })
  @IsOptional()
  @IsUUID()
  assignedPickerId?: string;

  @ApiProperty({ description: 'Order IDs in this pick list' })
  @IsArray()
  @IsUUID(4, { each: true })
  orderIds!: string[];

  @ApiPropertyOptional({ description: 'Pick list items' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePickListItemDto)
  items?: CreatePickListItemDto[];

  @ApiPropertyOptional({ description: 'Equipment used' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipmentUsed?: string[];

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class UpdatePickListDto {
  @ApiPropertyOptional({ description: 'Assigned picker ID' })
  @IsOptional()
  @IsUUID()
  assignedPickerId?: string;

  @ApiPropertyOptional({ description: 'Pick list status', enum: PickListStatus })
  @IsOptional()
  @IsEnum(PickListStatus)
  status?: PickListStatus;

  @ApiPropertyOptional({ description: 'Actual distance traveled' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualDistance?: number;

  @ApiPropertyOptional({ description: 'Actual time taken (minutes)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualTime?: number;

  @ApiPropertyOptional({ description: 'Picking accuracy percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pickingAccuracy?: number;

  @ApiPropertyOptional({ description: 'Equipment used' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipmentUsed?: string[];

  @ApiPropertyOptional({ description: 'Issues encountered' })
  @IsOptional()
  @IsArray()
  issues?: Record<string, any>[];

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// Pick List Item DTOs
export class CreatePickListItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({ description: 'Product variant ID' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ description: 'Bin location ID' })
  @IsUUID()
  @IsNotEmpty()
  binLocationId!: string;

  @ApiProperty({ description: 'Requested quantity' })
  @IsNumber()
  @IsPositive()
  requestedQuantity!: number;

  @ApiProperty({ description: 'Picking sequence' })
  @IsNumber()
  @Min(1)
  pickingSequence!: number;

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

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Order line ID reference' })
  @IsOptional()
  @IsUUID()
  orderLineId?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class UpdatePickListItemDto {
  @ApiPropertyOptional({ description: 'Picked quantity' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pickedQuantity?: number;

  @ApiPropertyOptional({ description: 'Item status', enum: PickItemStatus })
  @IsOptional()
  @IsEnum(PickItemStatus)
  status?: PickItemStatus;

  @ApiPropertyOptional({ description: 'Quality check passed' })
  @IsOptional()
  @IsBoolean()
  qualityCheck?: boolean;

  @ApiPropertyOptional({ description: 'Quality notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  qualityNotes?: string;

  @ApiPropertyOptional({ description: 'Short pick reason' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  shortPickReason?: string;

  @ApiPropertyOptional({ description: 'Issues encountered' })
  @IsOptional()
  @IsArray()
  issues?: Record<string, any>[];

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// Query DTOs
export class PickingWaveQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by status', enum: WaveStatus })
  @IsOptional()
  @IsEnum(WaveStatus)
  status?: WaveStatus;

  @ApiPropertyOptional({ description: 'Filter by wave type', enum: WaveType })
  @IsOptional()
  @IsEnum(WaveType)
  waveType?: WaveType;

  @ApiPropertyOptional({ description: 'Filter by assigned picker ID' })
  @IsOptional()
  @IsUUID()
  assignedPickerId?: string;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'plannedStartTime';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

export class PickListQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by wave ID' })
  @IsOptional()
  @IsUUID()
  waveId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: PickListStatus })
  @IsOptional()
  @IsEnum(PickListStatus)
  status?: PickListStatus;

  @ApiPropertyOptional({ description: 'Filter by assigned picker ID' })
  @IsOptional()
  @IsUUID()
  assignedPickerId?: string;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'assignedAt';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// Route optimization DTOs
export class OptimizePickingRouteDto {
  @ApiProperty({ description: 'Bin location IDs to visit' })
  @IsArray()
  @IsUUID(4, { each: true })
  binLocationIds!: string[];

  @ApiPropertyOptional({ description: 'Starting location coordinates' })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  startLocation?: {
    x: number;
    y: number;
    z?: number;
  };

  @ApiPropertyOptional({ description: 'Ending location coordinates' })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  endLocation?: {
    x: number;
    y: number;
    z?: number;
  };

  @ApiPropertyOptional({ description: 'Optimization strategy' })
  @IsOptional()
  @IsString()
  strategy?: 'shortest_distance' | 'fastest_time' | 'zone_based' | 'serpentine';

  @ApiPropertyOptional({ description: 'Equipment constraints' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipmentConstraints?: string[];
}

// Wave planning DTOs
export class WavePlanningDto {
  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({ description: 'Order IDs to include in planning' })
  @IsArray()
  @IsUUID(4, { each: true })
  orderIds!: string[];

  @ApiPropertyOptional({ description: 'Maximum orders per wave' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxOrdersPerWave?: number;

  @ApiPropertyOptional({ description: 'Maximum items per pick list' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxItemsPerPickList?: number;

  @ApiPropertyOptional({ description: 'Zone grouping strategy' })
  @IsOptional()
  @IsString()
  zoneGrouping?: 'single_zone' | 'adjacent_zones' | 'all_zones';

  @ApiPropertyOptional({ description: 'Priority orders' })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  priorityOrders?: string[];

  @ApiPropertyOptional({ description: 'Available picker IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  availablePickers?: string[];

  @ApiPropertyOptional({ description: 'Planning constraints' })
  @IsOptional()
  constraints?: {
    maxWaveTime?: number; // minutes
    maxPickListDistance?: number; // meters
    requireSameZone?: boolean;
    allowPartialPicks?: boolean;
  };
}

// Performance tracking DTOs
export class PickingPerformanceDto {
  @ApiProperty({ description: 'Picker ID' })
  @IsUUID()
  pickerId!: string;

  @ApiProperty({ description: 'Total picks completed' })
  @IsNumber()
  @Min(0)
  totalPicks!: number;

  @ApiProperty({ description: 'Total items picked' })
  @IsNumber()
  @Min(0)
  totalItems!: number;

  @ApiProperty({ description: 'Average pick time (seconds)' })
  @IsNumber()
  @Min(0)
  averagePickTime!: number;

  @ApiProperty({ description: 'Picking accuracy percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  accuracy!: number;

  @ApiProperty({ description: 'Total distance traveled (meters)' })
  @IsNumber()
  @Min(0)
  totalDistance!: number;

  @ApiProperty({ description: 'Items per hour' })
  @IsNumber()
  @Min(0)
  itemsPerHour!: number;

  @ApiPropertyOptional({ description: 'Performance period start' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'Performance period end' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}

// Batch picking DTOs
export class BatchPickingDto {
  @ApiProperty({ description: 'Pick list IDs to batch' })
  @IsArray()
  @IsUUID(4, { each: true })
  pickListIds!: string[];

  @ApiProperty({ description: 'Batch picker ID' })
  @IsUUID()
  @IsNotEmpty()
  batchPickerId!: string;

  @ApiPropertyOptional({ description: 'Batch strategy' })
  @IsOptional()
  @IsString()
  strategy?: 'zone_based' | 'product_based' | 'customer_based';

  @ApiPropertyOptional({ description: 'Maximum batch size' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxBatchSize?: number;
}