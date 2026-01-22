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
  @IsString()
  @Length(1, 255)
  street!: string;

  @IsString()
  @Length(1, 100)
  city!: string;

  @IsString()
  @Length(1, 100)
  state!: string;

  @IsString()
  @Length(1, 100)
  country!: string;

  @IsString()
  @Length(1, 20)
  postalCode!: string;

  @IsOptional()
  @IsObject()
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Operating hours DTO
export class OperatingHoursDto {
  @IsOptional()
  @IsObject()
  monday?: { open: string; close: string; closed?: boolean };

  @IsOptional()
  @IsObject()
  tuesday?: { open: string; close: string; closed?: boolean };

  @IsOptional()
  @IsObject()
  wednesday?: { open: string; close: string; closed?: boolean };

  @IsOptional()
  @IsObject()
  thursday?: { open: string; close: string; closed?: boolean };

  @IsOptional()
  @IsObject()
  friday?: { open: string; close: string; closed?: boolean };

  @IsOptional()
  @IsObject()
  saturday?: { open: string; close: string; closed?: boolean };

  @IsOptional()
  @IsObject()
  sunday?: { open: string; close: string; closed?: boolean };
}

// Create location DTO
export class CreateLocationDto {
  @IsString()
  @Length(1, 255)
  name!: string;

  @IsString()
  @Length(1, 50)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Code must contain only uppercase letters, numbers, underscores, and hyphens' })
  code!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsEnum(LocationType)
  type!: LocationType;

  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus = LocationStatus.ACTIVE;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsUUID()
  parentLocationId?: string;

  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string = 'USD';

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operatingHours?: OperatingHoursDto;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  squareFootage?: number;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsObject()
  taxSettings?: Record<string, any>;

  @IsOptional()
  @IsObject()
  inventorySettings?: Record<string, any>;

  @IsOptional()
  @IsObject()
  posSettings?: Record<string, any>;

  @IsOptional()
  @IsObject()
  capacity?: Record<string, any>;
}

// Update location DTO
export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsUUID()
  parentLocationId?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operatingHours?: OperatingHoursDto;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  squareFootage?: number;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsObject()
  taxSettings?: Record<string, any>;

  @IsOptional()
  @IsObject()
  inventorySettings?: Record<string, any>;

  @IsOptional()
  @IsObject()
  posSettings?: Record<string, any>;

  @IsOptional()
  @IsObject()
  capacity?: Record<string, any>;

  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, any>;
}

// Location query DTO
export class LocationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsOptional()
  @IsUUID()
  parentLocationId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeChildren?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'name';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// Location permission DTO
export class LocationPermissionDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  locationId!: string;

  @IsEnum(['manager', 'employee', 'viewer'])
  role!: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

// Location metrics DTO
export class LocationMetricsDto {
  @IsString()
  metricType!: string;

  @IsString()
  metricName!: string;

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'])
  period!: string;

  @Type(() => Date)
  periodStart!: Date;

  @Type(() => Date)
  periodEnd!: Date;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Location response DTO
export class LocationResponseDto {
  id!: string;
  tenantId!: string;
  name!: string;
  code!: string;
  description?: string;
  type!: LocationType;
  status!: LocationStatus;
  address!: AddressDto;
  phone?: string;
  email?: string;
  website?: string;
  parentLocationId?: string;
  timezone!: string;
  currency!: string;
  operatingHours?: OperatingHoursDto;
  managerId?: string;
  latitude?: number;
  longitude?: number;
  squareFootage?: number;
  settings!: Record<string, any>;
  metrics!: Record<string, any>;
  taxSettings!: Record<string, any>;
  inventorySettings!: Record<string, any>;
  posSettings!: Record<string, any>;
  featureFlags!: Record<string, any>;
  capacity!: Record<string, any>;
  createdAt!: Date;
  updatedAt!: Date;
  isActive!: boolean;
}