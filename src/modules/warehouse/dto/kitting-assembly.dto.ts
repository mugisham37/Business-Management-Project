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
export enum KitType {
  SIMPLE = 'simple',
  COMPLEX = 'complex',
  CONFIGURABLE = 'configurable',
}

export enum SkillLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum CostCalculation {
  SUM_OF_PARTS = 'sum_of_parts',
  FIXED_PRICE = 'fixed_price',
  MARKUP_PERCENTAGE = 'markup_percentage',
}

export enum WorkOrderStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export enum WorkOrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ComponentStatus {
  PENDING = 'pending',
  ALLOCATED = 'allocated',
  CONSUMED = 'consumed',
  SHORTAGE = 'shortage',
}

export enum QualityCheckType {
  VISUAL = 'visual',
  MEASUREMENT = 'measurement',
  FUNCTIONAL = 'functional',
  SAFETY = 'safety',
}

export enum QualityResult {
  PASS = 'pass',
  FAIL = 'fail',
  NA = 'na',
}

// Kit component DTO
export class KitComponentDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Quantity required' })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Unit of measure' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  unitOfMeasure: string;

  @ApiPropertyOptional({ description: 'Is component optional' })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @ApiPropertyOptional({ description: 'Is component substitutable' })
  @IsOptional()
  @IsBoolean()
  isSubstitutable?: boolean;

  @ApiPropertyOptional({ description: 'Substitute product IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  substitutes?: string[];

  @ApiPropertyOptional({ description: 'Assembly position/order' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  position?: number;

  @ApiPropertyOptional({ description: 'Component notes' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

// Quality check DTO
export class QualityCheckDto {
  @ApiProperty({ description: 'Check name' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  checkName: string;

  @ApiProperty({ description: 'Check type', enum: QualityCheckType })
  @IsEnum(QualityCheckType)
  checkType: QualityCheckType;

  @ApiProperty({ description: 'Check description' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  description: string;

  @ApiProperty({ description: 'Is check required' })
  @IsBoolean()
  isRequired: boolean;

  @ApiProperty({ description: 'Acceptance criteria' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  acceptanceCriteria: string;

  @ApiPropertyOptional({ description: 'Required tools' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools?: string[];
}

// Packaging info DTO
export class PackagingInfoDto {
  @ApiProperty({ description: 'Package type' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  packageType: string;

  @ApiPropertyOptional({ description: 'Package dimensions' })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };

  @ApiPropertyOptional({ description: 'Package weight' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  weight?: number;

  @ApiPropertyOptional({ description: 'Packaging materials' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];

  @ApiPropertyOptional({ description: 'Packaging instructions' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  instructions?: string;
}

// Create kit DTO
export class CreateKitDto {
  @ApiProperty({ description: 'Kit SKU' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  kitSku: string;

  @ApiProperty({ description: 'Kit name' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  kitName: string;

  @ApiPropertyOptional({ description: 'Kit description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiProperty({ description: 'Kit type', enum: KitType })
  @IsEnum(KitType)
  kitType: KitType;

  @ApiProperty({ description: 'Kit components' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KitComponentDto)
  components: KitComponentDto[];

  @ApiPropertyOptional({ description: 'Assembly instructions' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  assemblyInstructions?: string;

  @ApiPropertyOptional({ description: 'Assembly time in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440) // Max 24 hours
  assemblyTime?: number;

  @ApiPropertyOptional({ description: 'Required skill level', enum: SkillLevel })
  @IsOptional()
  @IsEnum(SkillLevel)
  skillLevel?: SkillLevel;

  @ApiPropertyOptional({ description: 'Quality checks' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QualityCheckDto)
  qualityChecks?: QualityCheckDto[];

  @ApiPropertyOptional({ description: 'Packaging information' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PackagingInfoDto)
  packaging?: PackagingInfoDto;

  @ApiProperty({ description: 'Cost calculation method', enum: CostCalculation })
  @IsEnum(CostCalculation)
  costCalculation: CostCalculation;

  @ApiPropertyOptional({ description: 'Markup percentage (for markup calculation)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  markup?: number;

  @ApiPropertyOptional({ description: 'Fixed price (for fixed price calculation)' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  fixedPrice?: number;
}

// Update kit DTO
export class UpdateKitDto {
  @ApiPropertyOptional({ description: 'Kit name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  kitName?: string;

  @ApiPropertyOptional({ description: 'Kit description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Kit type', enum: KitType })
  @IsOptional()
  @IsEnum(KitType)
  kitType?: KitType;

  @ApiPropertyOptional({ description: 'Is kit active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Kit components' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KitComponentDto)
  components?: KitComponentDto[];

  @ApiPropertyOptional({ description: 'Assembly instructions' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  assemblyInstructions?: string;

  @ApiPropertyOptional({ description: 'Assembly time in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  assemblyTime?: number;

  @ApiPropertyOptional({ description: 'Required skill level', enum: SkillLevel })
  @IsOptional()
  @IsEnum(SkillLevel)
  skillLevel?: SkillLevel;

  @ApiPropertyOptional({ description: 'Quality checks' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QualityCheckDto)
  qualityChecks?: QualityCheckDto[];

  @ApiPropertyOptional({ description: 'Packaging information' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PackagingInfoDto)
  packaging?: PackagingInfoDto;

  @ApiPropertyOptional({ description: 'Cost calculation method', enum: CostCalculation })
  @IsOptional()
  @IsEnum(CostCalculation)
  costCalculation?: CostCalculation;

  @ApiPropertyOptional({ description: 'Markup percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  markup?: number;

  @ApiPropertyOptional({ description: 'Fixed price' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  fixedPrice?: number;
}

// Kit definition response DTO
export class KitDefinitionDto {
  @ApiProperty({ description: 'Kit ID' })
  kitId: string;

  @ApiProperty({ description: 'Kit SKU' })
  kitSku: string;

  @ApiProperty({ description: 'Kit name' })
  kitName: string;

  @ApiPropertyOptional({ description: 'Kit description' })
  description?: string;

  @ApiProperty({ description: 'Kit type', enum: KitType })
  kitType: KitType;

  @ApiProperty({ description: 'Is kit active' })
  isActive: boolean;

  @ApiProperty({ description: 'Kit components' })
  components: Array<{
    componentId: string;
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitOfMeasure: string;
    isOptional: boolean;
    isSubstitutable: boolean;
    substitutes?: string[];
    position?: number;
    notes?: string;
  }>;

  @ApiPropertyOptional({ description: 'Assembly instructions' })
  assemblyInstructions?: string;

  @ApiPropertyOptional({ description: 'Assembly time in minutes' })
  assemblyTime?: number;

  @ApiProperty({ description: 'Required skill level', enum: SkillLevel })
  skillLevel: SkillLevel;

  @ApiPropertyOptional({ description: 'Quality checks' })
  qualityChecks?: Array<{
    checkId: string;
    checkName: string;
    checkType: QualityCheckType;
    description: string;
    isRequired: boolean;
    acceptanceCriteria: string;
    tools?: string[];
  }>;

  @ApiPropertyOptional({ description: 'Packaging information' })
  packaging?: PackagingInfoDto;

  @ApiProperty({ description: 'Cost calculation method', enum: CostCalculation })
  costCalculation: CostCalculation;

  @ApiPropertyOptional({ description: 'Markup percentage' })
  markup?: number;

  @ApiPropertyOptional({ description: 'Fixed price' })
  fixedPrice?: number;
}

// Create assembly work order DTO
export class CreateAssemblyWorkOrderDto {
  @ApiProperty({ description: 'Kit ID' })
  @IsUUID()
  @IsNotEmpty()
  kitId: string;

  @ApiProperty({ description: 'Quantity to assemble' })
  @IsNumber()
  @IsPositive()
  quantityToAssemble: number;

  @ApiPropertyOptional({ description: 'Work order priority', enum: WorkOrderPriority })
  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;

  @ApiPropertyOptional({ description: 'Scheduled date' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: Date;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @ApiPropertyOptional({ description: 'Work station ID' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  workStationId?: string;

  @ApiPropertyOptional({ description: 'Work order notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// Update assembly work order DTO
export class UpdateAssemblyWorkOrderDto {
  @ApiPropertyOptional({ description: 'Work order status', enum: WorkOrderStatus })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;

  @ApiPropertyOptional({ description: 'Work order priority', enum: WorkOrderPriority })
  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;

  @ApiPropertyOptional({ description: 'Scheduled date' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: Date;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Work station ID' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  workStationId?: string;

  @ApiPropertyOptional({ description: 'Work order notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// Assembly work order response DTO
export class AssemblyWorkOrderDto {
  @ApiProperty({ description: 'Work order ID' })
  workOrderId: string;

  @ApiProperty({ description: 'Work order number' })
  workOrderNumber: string;

  @ApiProperty({ description: 'Kit ID' })
  kitId: string;

  @ApiProperty({ description: 'Kit SKU' })
  kitSku: string;

  @ApiProperty({ description: 'Quantity to assemble' })
  quantityToAssemble: number;

  @ApiProperty({ description: 'Work order status', enum: WorkOrderStatus })
  status: WorkOrderStatus;

  @ApiProperty({ description: 'Work order priority', enum: WorkOrderPriority })
  priority: WorkOrderPriority;

  @ApiPropertyOptional({ description: 'Scheduled date' })
  scheduledDate?: Date;

  @ApiPropertyOptional({ description: 'Started date' })
  startedDate?: Date;

  @ApiPropertyOptional({ description: 'Completed date' })
  completedDate?: Date;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  assignedTo?: string;

  @ApiProperty({ description: 'Warehouse ID' })
  warehouseId: string;

  @ApiPropertyOptional({ description: 'Work station ID' })
  workStationId?: string;

  @ApiProperty({ description: 'Assembly components' })
  components: Array<{
    componentId: string;
    productId: string;
    sku: string;
    requiredQuantity: number;
    allocatedQuantity: number;
    consumedQuantity: number;
    lotNumbers?: string[];
    binLocations?: string[];
    status: ComponentStatus;
    shortageQuantity?: number;
    substitutedWith?: string;
  }>;

  @ApiPropertyOptional({ description: 'Quality results' })
  qualityResults?: Array<{
    checkId: string;
    checkName: string;
    result: QualityResult;
    notes?: string;
    measuredValue?: number;
    checkedBy: string;
    checkedAt: Date;
  }>;

  @ApiPropertyOptional({ description: 'Actual assembly time in minutes' })
  actualAssemblyTime?: number;

  @ApiPropertyOptional({ description: 'Work order notes' })
  notes?: string;

  @ApiProperty({ description: 'Created by user ID' })
  createdBy: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
}

// Component consumption DTO
export class ComponentConsumptionDto {
  @ApiProperty({ description: 'Component ID' })
  @IsString()
  @IsNotEmpty()
  componentId: string;

  @ApiProperty({ description: 'Quantity consumed' })
  @IsNumber()
  @IsPositive()
  quantityConsumed: number;

  @ApiPropertyOptional({ description: 'Lot numbers used' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lotNumbers?: string[];

  @ApiPropertyOptional({ description: 'Consumption notes' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

// Quality result DTO
export class QualityResultDto {
  @ApiProperty({ description: 'Quality check ID' })
  @IsString()
  @IsNotEmpty()
  checkId: string;

  @ApiProperty({ description: 'Quality check name' })
  @IsString()
  @IsNotEmpty()
  checkName: string;

  @ApiProperty({ description: 'Quality result', enum: QualityResult })
  @IsEnum(QualityResult)
  result: QualityResult;

  @ApiPropertyOptional({ description: 'Result notes' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiPropertyOptional({ description: 'Measured value' })
  @IsOptional()
  @IsNumber()
  measuredValue?: number;

  @ApiProperty({ description: 'Checked by user ID' })
  @IsUUID()
  @IsNotEmpty()
  checkedBy: string;

  @ApiProperty({ description: 'Checked timestamp' })
  @IsDateString()
  checkedAt: Date;
}

// Kit cost analysis DTO
export class KitCostAnalysisDto {
  @ApiProperty({ description: 'Kit definition' })
  kit: KitDefinitionDto;

  @ApiProperty({ description: 'Component costs' })
  componentCosts: Array<{
    componentId: string;
    productId: string;
    sku: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;

  @ApiProperty({ description: 'Total component cost' })
  totalComponentCost: number;

  @ApiProperty({ description: 'Labor cost' })
  laborCost: number;

  @ApiProperty({ description: 'Overhead cost' })
  overheadCost: number;

  @ApiProperty({ description: 'Total kit cost' })
  totalKitCost: number;

  @ApiProperty({ description: 'Suggested selling price' })
  suggestedSellingPrice: number;

  @ApiProperty({ description: 'Profit margin percentage' })
  profitMargin: number;
}

// Assembly metrics DTO
export class AssemblyMetricsDto {
  @ApiProperty({ description: 'Total work orders' })
  totalWorkOrders: number;

  @ApiProperty({ description: 'Completed work orders' })
  completedWorkOrders: number;

  @ApiProperty({ description: 'Average assembly time in minutes' })
  averageAssemblyTime: number;

  @ApiProperty({ description: 'On-time completion rate percentage' })
  onTimeCompletionRate: number;

  @ApiProperty({ description: 'Quality pass rate percentage' })
  qualityPassRate: number;

  @ApiProperty({ description: 'Component shortage rate percentage' })
  componentShortageRate: number;

  @ApiProperty({ description: 'Top kits by volume' })
  topKitsByVolume: Array<{
    kitId: string;
    kitSku: string;
    kitName: string;
    quantityAssembled: number;
    averageTime: number;
  }>;

  @ApiProperty({ description: 'Productivity by worker' })
  productivityByWorker: Array<{
    workerId: string;
    workerName: string;
    workOrdersCompleted: number;
    averageTime: number;
    qualityScore: number;
  }>;
}

// Kit query DTO
export class KitQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by kit type', enum: KitType })
  @IsOptional()
  @IsEnum(KitType)
  kitType?: KitType;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by skill level', enum: SkillLevel })
  @IsOptional()
  @IsEnum(SkillLevel)
  skillLevel?: SkillLevel;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'kitName';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// Work order query DTO
export class WorkOrderQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by status', enum: WorkOrderStatus })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;

  @ApiPropertyOptional({ description: 'Filter by priority', enum: WorkOrderPriority })
  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;

  @ApiPropertyOptional({ description: 'Filter by assigned user' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Filter by kit ID' })
  @IsOptional()
  @IsUUID()
  kitId?: string;

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
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// Bulk operations DTOs
export class BulkCreateKitsDto {
  @ApiProperty({ description: 'Array of kits to create' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateKitDto)
  kits: CreateKitDto[];
}

export class BulkCreateWorkOrdersDto {
  @ApiProperty({ description: 'Array of work orders to create' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssemblyWorkOrderDto)
  workOrders: CreateAssemblyWorkOrderDto[];
}

// Component substitution DTO
export class ComponentSubstitutionDto {
  @ApiProperty({ description: 'Component ID to substitute' })
  @IsString()
  @IsNotEmpty()
  componentId: string;

  @ApiProperty({ description: 'Substitute product ID' })
  @IsUUID()
  @IsNotEmpty()
  substituteProductId: string;

  @ApiProperty({ description: 'Substitution reason' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  reason: string;

  @ApiPropertyOptional({ description: 'Substitution notes' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

// Kit cloning DTO
export class CloneKitDto {
  @ApiProperty({ description: 'New kit SKU' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  newKitSku: string;

  @ApiProperty({ description: 'New kit name' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  newKitName: string;

  @ApiPropertyOptional({ description: 'New kit description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;
}

// Work station DTO
export class WorkStationDto {
  @ApiProperty({ description: 'Work station ID' })
  workStationId: string;

  @ApiProperty({ description: 'Work station name' })
  name: string;

  @ApiProperty({ description: 'Warehouse ID' })
  warehouseId: string;

  @ApiProperty({ description: 'Station capabilities' })
  capabilities: string[];

  @ApiProperty({ description: 'Is station active' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Current work order ID' })
  currentWorkOrder?: string;

  @ApiPropertyOptional({ description: 'Station location' })
  location?: string;

  @ApiPropertyOptional({ description: 'Equipment list' })
  equipment?: string[];

  @ApiPropertyOptional({ description: 'Maximum concurrent work orders' })
  maxConcurrentOrders?: number;
}