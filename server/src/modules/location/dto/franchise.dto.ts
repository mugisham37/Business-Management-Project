import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsDateString, IsNumber, IsObject, IsArray, IsBoolean, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { FranchiseType, FranchiseStatus, TerritoryType, AssignmentType } from '../entities/franchise.entity';

// Franchise DTOs
export class CreateFranchiseDto {
  @ApiProperty({ description: 'Franchise name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Franchise code' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ description: 'Franchise description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: FranchiseType, description: 'Franchise type' })
  @IsEnum(FranchiseType)
  type!: FranchiseType;

  @ApiPropertyOptional({ description: 'Franchise owner user ID' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Franchise operator user ID' })
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @ApiPropertyOptional({ description: 'Business name' })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ description: 'Business registration number' })
  @IsOptional()
  @IsString()
  businessRegistrationNumber?: string;

  @ApiPropertyOptional({ description: 'Tax ID' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ description: 'Contact information' })
  @IsOptional()
  @IsObject()
  contactInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Royalty rate (0-1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  royaltyRate?: number;

  @ApiPropertyOptional({ description: 'Marketing fee rate (0-1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  marketingFeeRate?: number;

  @ApiPropertyOptional({ description: 'Initial franchise fee' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialFranchiseFee?: number;

  @ApiPropertyOptional({ description: 'Contract start date' })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @ApiPropertyOptional({ description: 'Contract end date' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({ description: 'Contract terms' })
  @IsOptional()
  @IsObject()
  contractTerms?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Franchise settings' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Primary territory ID' })
  @IsOptional()
  @IsUUID()
  primaryTerritoryId?: string;

  @ApiPropertyOptional({ description: 'Parent franchise ID' })
  @IsOptional()
  @IsUUID()
  parentFranchiseId?: string;
}

export class UpdateFranchiseDto extends PartialType(CreateFranchiseDto) {
  @ApiPropertyOptional({ enum: FranchiseStatus, description: 'Franchise status' })
  @IsOptional()
  @IsEnum(FranchiseStatus)
  status?: FranchiseStatus;

  @ApiPropertyOptional({ description: 'Performance metrics' })
  @IsOptional()
  @IsObject()
  performanceMetrics?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Feature flags' })
  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, any>;
}

export class FranchiseQueryDto {
  @ApiPropertyOptional({ description: 'Filter by franchise type' })
  @IsOptional()
  @IsEnum(FranchiseType)
  type?: FranchiseType;

  @ApiPropertyOptional({ description: 'Filter by franchise status' })
  @IsOptional()
  @IsEnum(FranchiseStatus)
  status?: FranchiseStatus;

  @ApiPropertyOptional({ description: 'Filter by owner ID' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Filter by territory ID' })
  @IsOptional()
  @IsUUID()
  territoryId?: string;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'name' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'name';

  @ApiPropertyOptional({ description: 'Sort order', default: 'asc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// Territory DTOs
export class CreateTerritoryDto {
  @ApiProperty({ description: 'Territory name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Territory code' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ description: 'Territory description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TerritoryType, description: 'Territory type' })
  @IsEnum(TerritoryType)
  type!: TerritoryType;

  @ApiPropertyOptional({ description: 'Geographic boundaries (GeoJSON)' })
  @IsOptional()
  @IsObject()
  boundaries?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Market criteria' })
  @IsOptional()
  @IsObject()
  marketCriteria?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Parent territory ID' })
  @IsOptional()
  @IsUUID()
  parentTerritoryId?: string;

  @ApiPropertyOptional({ description: 'Assigned franchise ID' })
  @IsOptional()
  @IsUUID()
  assignedFranchiseId?: string;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional({ description: 'Territory settings' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class UpdateTerritoryDto extends PartialType(CreateTerritoryDto) {
  @ApiPropertyOptional({ description: 'Territory metrics' })
  @IsOptional()
  @IsObject()
  metrics?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TerritoryQueryDto {
  @ApiPropertyOptional({ description: 'Filter by territory type' })
  @IsOptional()
  @IsEnum(TerritoryType)
  type?: TerritoryType;

  @ApiPropertyOptional({ description: 'Filter by assigned franchise ID' })
  @IsOptional()
  @IsUUID()
  franchiseId?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'name' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'name';

  @ApiPropertyOptional({ description: 'Sort order', default: 'asc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// Franchise Location DTOs
export class CreateFranchiseLocationDto {
  @ApiProperty({ description: 'Franchise ID' })
  @IsUUID()
  franchiseId!: string;

  @ApiProperty({ description: 'Location ID' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ description: 'Role in franchise', default: 'primary' })
  @IsOptional()
  @IsString()
  role?: string = 'primary';

  @ApiProperty({ description: 'Effective date' })
  @IsDateString()
  effectiveDate!: string;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Settings' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class UpdateFranchiseLocationDto extends PartialType(CreateFranchiseLocationDto) {}

// Franchise Permission DTOs
export class CreateFranchisePermissionDto {
  @ApiProperty({ description: 'Franchise ID' })
  @IsUUID()
  franchiseId!: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Permissions array' })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];

  @ApiPropertyOptional({ description: 'Role', default: 'operator' })
  @IsOptional()
  @IsString()
  role?: string = 'operator';

  @ApiProperty({ description: 'Effective date' })
  @IsDateString()
  effectiveDate!: string;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}

export class UpdateFranchisePermissionDto extends PartialType(CreateFranchisePermissionDto) {}

// Territory Assignment DTOs
export class CreateTerritoryAssignmentDto {
  @ApiProperty({ description: 'Territory ID' })
  @IsUUID()
  territoryId!: string;

  @ApiPropertyOptional({ description: 'Franchise ID' })
  @IsOptional()
  @IsUUID()
  franchiseId?: string;

  @ApiPropertyOptional({ description: 'User ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ enum: AssignmentType, description: 'Assignment type' })
  @IsEnum(AssignmentType)
  assignmentType!: AssignmentType;

  @ApiProperty({ description: 'Effective date' })
  @IsDateString()
  effectiveDate!: string;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Assignment reason' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateTerritoryAssignmentDto extends PartialType(CreateTerritoryAssignmentDto) {}

// Franchise Performance DTOs
export class FranchisePerformanceDto {
  @ApiProperty({ description: 'Franchise ID' })
  franchiseId!: string;

  @ApiProperty({ description: 'Performance period' })
  period!: string;

  @ApiProperty({ description: 'Sales metrics' })
  salesMetrics!: {
    totalSales: number;
    salesGrowth: number;
    averageTransactionValue: number;
    transactionCount: number;
  };

  @ApiProperty({ description: 'Financial metrics' })
  financialMetrics!: {
    revenue: number;
    royaltyPaid: number;
    marketingFeePaid: number;
    profitMargin: number;
  };

  @ApiProperty({ description: 'Operational metrics' })
  operationalMetrics!: {
    customerSatisfaction: number;
    employeeCount: number;
    inventoryTurnover: number;
    complianceScore: number;
  };

  @ApiProperty({ description: 'Territory metrics' })
  territoryMetrics!: {
    marketShare: number;
    territoryPenetration: number;
    competitorAnalysis: Record<string, any>;
  };
}

// Dealer Portal DTOs
export class DealerPortalAccessDto {
  @ApiProperty({ description: 'Franchise ID' })
  @IsUUID()
  franchiseId!: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Access level' })
  @IsString()
  accessLevel!: string; // 'full', 'limited', 'readonly'

  @ApiProperty({ description: 'Allowed modules' })
  @IsArray()
  @IsString({ each: true })
  allowedModules!: string[];

  @ApiPropertyOptional({ description: 'Custom permissions' })
  @IsOptional()
  @IsObject()
  customPermissions?: Record<string, any>;
}

export class DealerDashboardDto {
  @ApiProperty({ description: 'Franchise information' })
  franchise!: {
    id: string;
    name: string;
    type: FranchiseType;
    status: FranchiseStatus;
    territory: string;
  };

  @ApiProperty({ description: 'Performance summary' })
  performance!: {
    currentPeriod: FranchisePerformanceDto;
    previousPeriod: FranchisePerformanceDto;
    trends: Record<string, any>;
  };

  @ApiPropertyOptional({ description: 'Territory information' })
  territory?: {
    id: string;
    name: string;
    type: TerritoryType;
    boundaries: Record<string, any>;
    competitors: any[];
  };

  @ApiProperty({ description: 'Available actions' })
  availableActions!: string[];

  @ApiProperty({ description: 'Notifications' })
  notifications!: any[];

  @ApiProperty({ description: 'Quick links' })
  quickLinks!: any[];
}