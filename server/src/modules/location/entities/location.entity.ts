import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationType, LocationStatus, AddressDto, OperatingHoursDto } from '../dto/location.dto';

export class Location {
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

  @ApiProperty({ description: 'Created by user ID' })
  createdBy?: string;

  @ApiProperty({ description: 'Updated by user ID' })
  updatedBy?: string;

  @ApiPropertyOptional({ description: 'Deletion date' })
  deletedAt?: Date;

  @ApiProperty({ description: 'Version number' })
  version!: number;

  @ApiProperty({ description: 'Active status' })
  isActive!: boolean;

  // Virtual properties for hierarchy
  @ApiPropertyOptional({ description: 'Parent location' })
  parentLocation?: Location;

  @ApiPropertyOptional({ description: 'Child locations' })
  childLocations?: Location[];

  @ApiPropertyOptional({ description: 'Location manager' })
  manager?: any; // User entity

  @ApiPropertyOptional({ description: 'Location permissions' })
  permissions?: LocationPermission[];

  @ApiPropertyOptional({ description: 'Location metrics' })
  locationMetrics?: LocationMetric[];
}

export class LocationPermission {
  @ApiProperty({ description: 'Permission ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Location ID' })
  locationId!: string;

  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Permission role' })
  role!: string;

  @ApiProperty({ description: 'Specific permissions' })
  permissions!: string[];

  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Active status' })
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional({ description: 'Location' })
  location?: Location;

  @ApiPropertyOptional({ description: 'User' })
  user?: any; // User entity
}

export class LocationMetric {
  @ApiProperty({ description: 'Metric ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Location ID' })
  locationId!: string;

  @ApiProperty({ description: 'Metric type' })
  metricType!: string;

  @ApiProperty({ description: 'Metric name' })
  metricName!: string;

  @ApiProperty({ description: 'Metric value' })
  value!: number;

  @ApiPropertyOptional({ description: 'Unit of measurement' })
  unit?: string;

  @ApiProperty({ description: 'Period type' })
  period!: string;

  @ApiProperty({ description: 'Period start date' })
  periodStart!: Date;

  @ApiProperty({ description: 'Period end date' })
  periodEnd!: Date;

  @ApiProperty({ description: 'Additional metadata' })
  metadata!: Record<string, any>;

  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Active status' })
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional({ description: 'Location' })
  location?: Location;
}

export class LocationHierarchy {
  @ApiProperty({ description: 'Hierarchy ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Ancestor location ID' })
  ancestorId!: string;

  @ApiProperty({ description: 'Descendant location ID' })
  descendantId!: string;

  @ApiProperty({ description: 'Hierarchy depth' })
  depth!: number;

  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Active status' })
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional({ description: 'Ancestor location' })
  ancestor?: Location;

  @ApiPropertyOptional({ description: 'Descendant location' })
  descendant?: Location;
}