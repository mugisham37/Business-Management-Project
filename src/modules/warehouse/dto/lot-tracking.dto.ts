import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsBoolean, 
  IsEnum, 
  IsUUID, 
  IsObject, 
  IsArray, 
  Min, 
  Max,
  ValidateNested,
  IsNotEmpty,
  Length,
  IsPositive,
  IsDateString
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Enums
export enum QualityStatus {
  APPROVED = 'approved',
  PENDING = 'pending',
  REJECTED = 'rejected',
  QUARANTINE = 'quarantine',
}

export enum RotationType {
  FIFO = 'FIFO',
  FEFO = 'FEFO',
  LIFO = 'LIFO',
  MANUAL = 'MANUAL',
}

export enum MovementType {
  RECEIVE = 'receive',
  PICK = 'pick',
  ADJUST = 'adjust',
  TRANSFER = 'transfer',
  EXPIRE = 'expire',
  RECALL = 'recall',
}

export enum RecallType {
  VOLUNTARY = 'voluntary',
  MANDATORY = 'mandatory',
  PRECAUTIONARY = 'precautionary',
}

export enum RecallSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RecallStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Create lot DTO
export class CreateLotDto {
  @ApiProperty({ description: 'Lot number' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  lotNumber: string;

  @ApiPropertyOptional({ description: 'Batch number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  batchNumber?: string;

  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @ApiPropertyOptional({ description: 'Bin location ID' })
  @IsOptional()
  @IsUUID()
  binLocationId?: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Unit of measure' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  unitOfMeasure: string;

  @ApiPropertyOptional({ description: 'Manufacture date' })
  @IsOptional()
  @IsDateString()
  manufactureDate?: Date;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsDateString()
  expiryDate?: Date;

  @ApiProperty({ description: 'Received date' })
  @IsDateString()
  receivedDate: Date;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Supplier lot number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  supplierLotNumber?: string;

  @ApiPropertyOptional({ description: 'Quality status', enum: QualityStatus })
  @IsOptional()
  @IsEnum(QualityStatus)
  qualityStatus?: QualityStatus;

  @ApiPropertyOptional({ description: 'Certification number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  certificationNumber?: string;

  @ApiPropertyOptional({ description: 'Test results' })
  @IsOptional()
  @IsObject()
  testResults?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// Update lot DTO
export class UpdateLotDto {
  @ApiPropertyOptional({ description: 'Quantity' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Bin location ID' })
  @IsOptional()
  @IsUUID()
  binLocationId?: string;

  @ApiPropertyOptional({ description: 'Quality status', enum: QualityStatus })
  @IsOptional()
  @IsEnum(QualityStatus)
  qualityStatus?: QualityStatus;

  @ApiPropertyOptional({ description: 'Test results' })
  @IsOptional()
  @IsObject()
  testResults?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// Lot info response DTO
export class LotInfoDto {
  @ApiProperty({ description: 'Lot number' })
  lotNumber: string;

  @ApiPropertyOptional({ description: 'Batch number' })
  batchNumber?: string;

  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Warehouse ID' })
  warehouseId: string;

  @ApiPropertyOptional({ description: 'Bin location ID' })
  binLocationId?: string;

  @ApiProperty({ description: 'Quantity' })
  quantity: number;

  @ApiProperty({ description: 'Unit of measure' })
  unitOfMeasure: string;

  @ApiPropertyOptional({ description: 'Manufacture date' })
  manufactureDate?: Date;

  @ApiPropertyOptional({ description: 'Expiry date' })
  expiryDate?: Date;

  @ApiProperty({ description: 'Received date' })
  receivedDate: Date;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Supplier lot number' })
  supplierLotNumber?: string;

  @ApiProperty({ description: 'Quality status', enum: QualityStatus })
  qualityStatus: QualityStatus;

  @ApiPropertyOptional({ description: 'Certification number' })
  certificationNumber?: string;

  @ApiPropertyOptional({ description: 'Test results' })
  testResults?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string;
}

// Lot movement DTO
export class LotMovementDto {
  @ApiProperty({ description: 'Movement ID' })
  id: string;

  @ApiProperty({ description: 'Lot number' })
  lotNumber: string;

  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Movement type', enum: MovementType })
  movementType: MovementType;

  @ApiPropertyOptional({ description: 'From location' })
  fromLocation?: string;

  @ApiPropertyOptional({ description: 'To location' })
  toLocation?: string;

  @ApiProperty({ description: 'Quantity' })
  quantity: number;

  @ApiProperty({ description: 'Unit of measure' })
  unitOfMeasure: string;

  @ApiProperty({ description: 'Movement date' })
  movementDate: Date;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiPropertyOptional({ description: 'Order ID' })
  orderId?: string;

  @ApiPropertyOptional({ description: 'Pick list ID' })
  pickListId?: string;

  @ApiPropertyOptional({ description: 'Reason' })
  reason?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string;
}

// FIFO rule DTO
export class FIFORuleDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({ description: 'Warehouse ID' })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Zone ID' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiProperty({ description: 'Rotation type', enum: RotationType })
  @IsEnum(RotationType)
  rotationType: RotationType;

  @ApiProperty({ description: 'Enforce strict rotation' })
  @IsBoolean()
  enforceStrict: boolean;

  @ApiProperty({ description: 'Allow mixed lots in same pick' })
  @IsBoolean()
  allowMixedLots: boolean;

  @ApiProperty({ description: 'Expiry warning days' })
  @IsNumber()
  @Min(1)
  @Max(365)
  expiryWarningDays: number;

  @ApiProperty({ description: 'Auto quarantine expired lots' })
  @IsBoolean()
  autoQuarantineExpired: boolean;

  @ApiProperty({ description: 'Require lot tracking' })
  @IsBoolean()
  requireLotTracking: boolean;
}

// Create recall DTO
export class CreateRecallDto {
  @ApiProperty({ description: 'Recall number' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  recallNumber: string;

  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Lot numbers to recall' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  lotNumbers: string[];

  @ApiProperty({ description: 'Recall type', enum: RecallType })
  @IsEnum(RecallType)
  recallType: RecallType;

  @ApiProperty({ description: 'Recall severity', enum: RecallSeverity })
  @IsEnum(RecallSeverity)
  severity: RecallSeverity;

  @ApiProperty({ description: 'Recall reason' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  reason: string;

  @ApiProperty({ description: 'Recall description' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000)
  description: string;

  @ApiProperty({ description: 'Effective date' })
  @IsDateString()
  effectiveDate: Date;

  @ApiProperty({ description: 'Customer notification required' })
  @IsBoolean()
  customerNotificationRequired: boolean;

  @ApiProperty({ description: 'Regulatory reporting required' })
  @IsBoolean()
  regulatoryReportingRequired: boolean;

  @ApiProperty({ description: 'Recall instructions' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  instructions: string;
}

// Recall info response DTO
export class RecallInfoDto {
  @ApiProperty({ description: 'Recall ID' })
  recallId: string;

  @ApiProperty({ description: 'Recall number' })
  recallNumber: string;

  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Lot numbers' })
  lotNumbers: string[];

  @ApiProperty({ description: 'Recall type', enum: RecallType })
  recallType: RecallType;

  @ApiProperty({ description: 'Severity', enum: RecallSeverity })
  severity: RecallSeverity;

  @ApiProperty({ description: 'Reason' })
  reason: string;

  @ApiProperty({ description: 'Description' })
  description: string;

  @ApiProperty({ description: 'Initiated by' })
  initiatedBy: string;

  @ApiProperty({ description: 'Initiated date' })
  initiatedDate: Date;

  @ApiProperty({ description: 'Effective date' })
  effectiveDate: Date;

  @ApiProperty({ description: 'Status', enum: RecallStatus })
  status: RecallStatus;

  @ApiProperty({ description: 'Affected quantity' })
  affectedQuantity: number;

  @ApiProperty({ description: 'Recovered quantity' })
  recoveredQuantity: number;

  @ApiProperty({ description: 'Customer notification required' })
  customerNotificationRequired: boolean;

  @ApiProperty({ description: 'Regulatory reporting required' })
  regulatoryReportingRequired: boolean;

  @ApiProperty({ description: 'Instructions' })
  instructions: string;
}

// Lot picking request DTO
export class LotPickingRequestDto {
  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({ description: 'Requested quantity' })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({ description: 'Order ID' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Pick list ID' })
  @IsOptional()
  @IsUUID()
  pickListId?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

// Optimal picking response DTO
export class OptimalPickingResponseDto {
  @ApiProperty({ description: 'Lots to pick from' })
  lots: Array<{
    lotNumber: string;
    quantity: number;
    expiryDate?: Date;
    binLocationId?: string;
  }>;

  @ApiProperty({ description: 'Total available quantity' })
  totalAvailable: number;

  @ApiProperty({ description: 'Can fulfill request' })
  canFulfill: boolean;
}

// Lot picking result DTO
export class LotPickingResultDto {
  @ApiProperty({ description: 'Picked lots' })
  pickedLots: Array<{
    lotNumber: string;
    quantity: number;
    binLocationId?: string;
  }>;

  @ApiProperty({ description: 'Total picked quantity' })
  totalPicked: number;

  @ApiProperty({ description: 'Shortfall quantity' })
  shortfall: number;
}

// Expiring lot DTO
export class ExpiringLotDto {
  @ApiProperty({ description: 'Lot information' })
  lot: LotInfoDto;

  @ApiProperty({ description: 'Days until expiry' })
  daysUntilExpiry: number;

  @ApiProperty({ description: 'Recommended action' })
  recommendedAction: 'sell_first' | 'discount' | 'quarantine' | 'dispose';
}

// Lot traceability DTO
export class LotTraceabilityDto {
  @ApiProperty({ description: 'Lot information' })
  lot: LotInfoDto;

  @ApiProperty({ description: 'Movement history' })
  movements: LotMovementDto[];

  @ApiProperty({ description: 'Current location' })
  currentLocation: string;

  @ApiProperty({ description: 'Total received quantity' })
  totalReceived: number;

  @ApiProperty({ description: 'Total picked quantity' })
  totalPicked: number;

  @ApiProperty({ description: 'Current quantity' })
  currentQuantity: number;

  @ApiProperty({ description: 'Associated recalls' })
  recalls: RecallInfoDto[];

  @ApiProperty({ description: 'Quality history' })
  qualityHistory: Array<{
    date: Date;
    status: string;
    testResults?: Record<string, any>;
    notes?: string;
    userId: string;
  }>;
}

// Quality test DTO
export class QualityTestDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Lot number' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  lotNumber: string;

  @ApiProperty({ description: 'Test results' })
  @IsObject()
  testResults: Record<string, any>;

  @ApiProperty({ description: 'Quality status', enum: QualityStatus })
  @IsEnum(QualityStatus)
  qualityStatus: QualityStatus;

  @ApiProperty({ description: 'Test date' })
  @IsDateString()
  testDate: Date;

  @ApiProperty({ description: 'Tester ID' })
  @IsUUID()
  @IsNotEmpty()
  testerId: string;

  @ApiPropertyOptional({ description: 'Certification number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  certificationNumber?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// Bulk lot update DTO
export class BulkLotUpdateDto {
  @ApiProperty({ description: 'Lot updates' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  updates: Array<{
    productId: string;
    lotNumber: string;
    quantity?: number;
    binLocationId?: string;
    qualityStatus?: QualityStatus;
    notes?: string;
  }>;
}

// Lot query DTO
export class LotQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by quality status', enum: QualityStatus })
  @IsOptional()
  @IsEnum(QualityStatus)
  qualityStatus?: QualityStatus;

  @ApiPropertyOptional({ description: 'Include expired lots' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeExpired?: boolean;

  @ApiPropertyOptional({ description: 'Filter by expiry date from' })
  @IsOptional()
  @IsDateString()
  expiryDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by expiry date to' })
  @IsOptional()
  @IsDateString()
  expiryDateTo?: string;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: 'expiryDate' | 'receivedDate' | 'quantity' | 'lotNumber';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// Recall query DTO
export class RecallQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by product ID' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: RecallStatus })
  @IsOptional()
  @IsEnum(RecallStatus)
  status?: RecallStatus;

  @ApiPropertyOptional({ description: 'Filter by severity', enum: RecallSeverity })
  @IsOptional()
  @IsEnum(RecallSeverity)
  severity?: RecallSeverity;

  @ApiPropertyOptional({ description: 'Filter by recall type', enum: RecallType })
  @IsOptional()
  @IsEnum(RecallType)
  recallType?: RecallType;

  @ApiPropertyOptional({ description: 'Filter from date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter to date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'initiatedDate';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// Lot analytics DTO
export class LotAnalyticsDto {
  @ApiProperty({ description: 'Total lots' })
  totalLots: number;

  @ApiProperty({ description: 'Active lots' })
  activeLots: number;

  @ApiProperty({ description: 'Expired lots' })
  expiredLots: number;

  @ApiProperty({ description: 'Quarantined lots' })
  quarantinedLots: number;

  @ApiProperty({ description: 'Lots expiring in 30 days' })
  expiringSoon: number;

  @ApiProperty({ description: 'Average lot age in days' })
  averageLotAge: number;

  @ApiProperty({ description: 'Lot turnover rate' })
  turnoverRate: number;

  @ApiProperty({ description: 'Quality status breakdown' })
  qualityStatusBreakdown: Record<string, number>;

  @ApiProperty({ description: 'Expiry trend by month' })
  expiryTrend: Array<{
    month: string;
    expiredLots: number;
    expiredQuantity: number;
  }>;

  @ApiProperty({ description: 'Top products by lot count' })
  topProductsByLotCount: Array<{
    productId: string;
    productName: string;
    lotCount: number;
    totalQuantity: number;
  }>;
}