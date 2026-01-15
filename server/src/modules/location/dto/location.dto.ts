import { 
  IsString, 
  IsOptional, 
  IsEmail, 
  IsUrl, 
  IsUUID, 
  IsObject, 
  IsNumber, 
  IsArray, 
  IsEnum, 
  IsBoolean,
  ValidateNested,
  Min,
  Max,
  Length,
  Matches
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum LocationType {
  STORE = 'store',
  WAREHOUSE = 'warehouse',
  OFFICE = 'office',
  FRANCHISE = 'franchise',
  DISTRIBUTION_CENTER = 'distribution_center',
  MANUFACTURING = 'manufacturing',
}

export enum LocationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CLOSED = 'closed',
  UNDER_CONSTRUCTION = 'under_construction',
  MAINTENANCE = 'maintenance',
}

// Address DTO
export class AddressDto {
  @ApiProperty({ description: 'Street address' })
  @IsString()
  @Length(1, 255)
  street!: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @Length(1, 100)
  city!: string;

  @ApiProperty({ description: 'State or province' })
  @IsString()
  @Length(1, 100)
  state!: string;

  @ApiProperty({ description: 'Country' })
  @IsString()
  @Length(1, 100)
  country!: string;

  @ApiProperty({ description: 'Postal code' })
  @IsString()
  @Length(1, 20)
  postalCode!: string;

  @ApiPropertyOptional({ description: 'Geographic coordinates' })
  @IsOptional()
  @IsObject()
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Operating hours DTO
export class OperatingHoursDto {
  @ApiPropertyOptional({ description: 'Monday hours' })
  @IsOptional()
  @IsObject()
  monday?: { open: string; close: string; closed?: boolean };

  @ApiPropertyOptional({ description: 'Tuesday hours' })
  @IsOptional()
  @IsObject()
  tuesday?: { open: string; close: string; closed?: boolean };

  @ApiPropertyOptional({ description: 'Wednesday hours' })
  @IsOptional()
  @IsObject()
  wednesday?: { open: string; close: string; closed?: boolean };

  @ApiPropertyOptional({ description: 'Thursday hours' })
  @IsOptional()
  @IsObject()
  thursday?: { open: string; close: string; closed?: boolean };

  @ApiPropertyOptional({ description: 'Friday hours' })
  @IsOptional()
  @IsObject()
  friday?: { open: string; close: string; closed?: boolean };

  @ApiPropertyOptional({ description: 'Saturday hours' })
  @IsOptional()
  @IsObject()
  saturday?: { open: string; close: string; closed?: boolean };

  @ApiPropertyOptional({ description: 'Sunday hours' })
  @IsOptional()
  @IsObject()
  sunday?: { open: string; close: string; closed?: boolean };
}

// Create location DTO
export class CreateLocationDto {
  @ApiProperty({ description: 'Location name' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ description: 'Location code (unique within tenant)' })
  @IsString()
  @Length(1, 50)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Code must contain only uppercase letters, numbers, underscores, and hyphens' })
  code!: string;

  @ApiPropertyOptional({ description: 'Location description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiProperty({ enum: LocationType, description: 'Location type' })
  @IsEnum(LocationType)
  type!: LocationType;

  @ApiProperty({ enum: LocationStatus, description: 'Location status', default: LocationStatus.ACTIVE })
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus = LocationStatus.ACTIVE;

  @ApiProperty({ type: AddressDto, description: 'Location address' })
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'Parent location ID for hierarchy' })
  @IsOptional()
  @IsUUID()
  parentLocationId?: string;

  @ApiProperty({ description: 'Timezone', default: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  @ApiProperty({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string = 'USD';

  @ApiPropertyOptional({ type: OperatingHoursDto, description: 'Operating hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operatingHours?: OperatingHoursDto;

  @ApiPropertyOptional({ description: 'Manager user ID' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Square footage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  squareFootage?: number;

  @ApiPropertyOptional({ description: 'Location settings' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tax settings' })
  @IsOptional()
  @IsObject()
  taxSettings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Inventory settings' })
  @IsOptional()
  @IsObject()
  inventorySettings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'POS settings' })
  @IsOptional()
  @IsObject()
  posSettings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Capacity information' })
  @IsOptional()
  @IsObject()
  capacity?: Record<string, any>;
}

// Update location DTO
export class UpdateLocationDto {
  @ApiPropertyOptional({ description: 'Location name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ description: 'Location description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ enum: LocationType, description: 'Location type' })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @ApiPropertyOptional({ enum: LocationStatus, description: 'Location status' })
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;

  @ApiPropertyOptional({ type: AddressDto, description: 'Location address' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'Parent location ID for hierarchy' })
  @IsOptional()
  @IsUUID()
  parentLocationId?: string;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ type: OperatingHoursDto, description: 'Operating hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operatingHours?: OperatingHoursDto;

  @ApiPropertyOptional({ description: 'Manager user ID' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Square footage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  squareFootage?: number;

  @ApiPropertyOptional({ description: 'Location settings' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tax settings' })
  @IsOptional()
  @IsObject()
  taxSettings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Inventory settings' })
  @IsOptional()
  @IsObject()
  inventorySettings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'POS settings' })
  @IsOptional()
  @IsObject()
  posSettings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Capacity information' })
  @IsOptional()
  @IsObject()
  capacity?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Feature flags' })
  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, any>;
}

// Location query DTO
export class LocationQueryDto {
  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: LocationType, description: 'Filter by location type' })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @ApiPropertyOptional({ enum: LocationStatus, description: 'Filter by location status' })
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;

  @ApiPropertyOptional({ description: 'Filter by manager ID' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ description: 'Filter by parent location ID' })
  @IsOptional()
  @IsUUID()
  parentLocationId?: string;

  @ApiPropertyOptional({ description: 'Include child locations in hierarchy' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeChildren?: boolean;

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

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// Location permission DTO
export class LocationPermissionDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Location ID' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ description: 'Permission role', enum: ['manager', 'employee', 'viewer'] })
  @IsEnum(['manager', 'employee', 'viewer'])
  role!: string;

  @ApiProperty({ description: 'Specific permissions array' })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

// Location metrics DTO
export class LocationMetricsDto {
  @ApiProperty({ description: 'Metric type' })
  @IsString()
  metricType!: string;

  @ApiProperty({ description: 'Metric name' })
  @IsString()
  metricName!: string;

  @ApiProperty({ description: 'Metric value' })
  @IsNumber()
  value!: number;

  @ApiPropertyOptional({ description: 'Unit of measurement' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ description: 'Period type', enum: ['daily', 'weekly', 'monthly', 'yearly'] })
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'])
  period!: string;

  @ApiProperty({ description: 'Period start date' })
  @Type(() => Date)
  periodStart!: Date;

  @ApiProperty({ description: 'Period end date' })
  @Type(() => Date)
  periodEnd!: Date;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Location response DTO
export class LocationResponseDto {
  @ApiProperty({ description: 'Location ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Location name' })
  name!: string;

  @ApiProperty({ description: 'Location code' })
  code!: string;

  @ApiPropertyOptional({ description: 'Location description' })
  description?: string;

  @ApiProperty({ enum: LocationType, description: 'Location type' })
  type!: LocationType;

  @ApiProperty({ enum: LocationStatus, description: 'Location status' })
  status!: LocationStatus;

  @ApiProperty({ type: AddressDto, description: 'Location address' })
  address!: AddressDto;

  @ApiPropertyOptional({ description: 'Phone number' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  email?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  website?: string;

  @ApiPropertyOptional({ description: 'Parent location ID' })
  parentLocationId?: string;

  @ApiProperty({ description: 'Timezone' })
  timezone!: string;

  @ApiProperty({ description: 'Currency code' })
  currency!: string;

  @ApiPropertyOptional({ type: OperatingHoursDto, description: 'Operating hours' })
  operatingHours?: OperatingHoursDto;

  @ApiPropertyOptional({ description: 'Manager user ID' })
  managerId?: string;

  @ApiPropertyOptional({ description: 'Latitude coordinate' })
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude coordinate' })
  longitude?: number;

  @ApiPropertyOptional({ description: 'Square footage' })
  squareFootage?: number;

  @ApiProperty({ description: 'Location settings' })
  settings!: Record<string, any>;

  @ApiProperty({ description: 'Performance metrics' })
  metrics!: Record<string, any>;

  @ApiProperty({ description: 'Tax settings' })
  taxSettings!: Record<string, any>;

  @ApiProperty({ description: 'Inventory settings' })
  inventorySettings!: Record<string, any>;

  @ApiProperty({ description: 'POS settings' })
  posSettings!: Record<string, any>;

  @ApiProperty({ description: 'Feature flags' })
  featureFlags!: Record<string, any>;

  @ApiProperty({ description: 'Capacity information' })
  capacity!: Record<string, any>;

  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Active status' })
  isActive!: boolean;
}