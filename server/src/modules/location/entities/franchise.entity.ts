import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FranchiseType {
  FRANCHISE = 'franchise',
  DEALER = 'dealer',
  DISTRIBUTOR = 'distributor',
  AGENT = 'agent',
}

export enum FranchiseStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export enum TerritoryType {
  GEOGRAPHIC = 'geographic',
  MARKET = 'market',
  PRODUCT = 'product',
  CUSTOMER = 'customer',
}

export enum AssignmentType {
  FRANCHISE = 'franchise',
  REPRESENTATIVE = 'representative',
  MANAGER = 'manager',
}

export class Franchise {
  @ApiProperty({ description: 'Franchise ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Franchise name' })
  name!: string;

  @ApiProperty({ description: 'Franchise code' })
  code!: string;

  @ApiPropertyOptional({ description: 'Franchise description' })
  description?: string;

  @ApiProperty({ enum: FranchiseType, description: 'Franchise type' })
  type!: FranchiseType;

  @ApiProperty({ enum: FranchiseStatus, description: 'Franchise status' })
  status!: FranchiseStatus;

  @ApiPropertyOptional({ description: 'Franchise owner user ID' })
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Franchise operator user ID' })
  operatorId?: string;

  @ApiPropertyOptional({ description: 'Business name' })
  businessName?: string;

  @ApiPropertyOptional({ description: 'Business registration number' })
  businessRegistrationNumber?: string;

  @ApiPropertyOptional({ description: 'Tax ID' })
  taxId?: string;

  @ApiProperty({ description: 'Contact information' })
  contactInfo!: Record<string, any>;

  @ApiProperty({ description: 'Royalty rate (decimal)', default: 0 })
  royaltyRate!: number;

  @ApiProperty({ description: 'Marketing fee rate (decimal)', default: 0 })
  marketingFeeRate!: number;

  @ApiProperty({ description: 'Initial franchise fee', default: 0 })
  initialFranchiseFee!: number;

  @ApiPropertyOptional({ description: 'Contract start date' })
  contractStartDate?: Date;

  @ApiPropertyOptional({ description: 'Contract end date' })
  contractEndDate?: Date;

  @ApiProperty({ description: 'Contract terms' })
  contractTerms!: Record<string, any>;

  @ApiProperty({ description: 'Performance metrics' })
  performanceMetrics!: Record<string, any>;

  @ApiProperty({ description: 'Franchise settings' })
  settings!: Record<string, any>;

  @ApiProperty({ description: 'Feature flags' })
  featureFlags!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Primary territory ID' })
  primaryTerritoryId?: string;

  @ApiPropertyOptional({ description: 'Parent franchise ID' })
  parentFranchiseId?: string;

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

  // Virtual properties for relations
  @ApiPropertyOptional({ description: 'Franchise owner' })
  owner?: any; // User entity

  @ApiPropertyOptional({ description: 'Franchise operator' })
  operator?: any; // User entity

  @ApiPropertyOptional({ description: 'Primary territory' })
  primaryTerritory?: Territory;

  @ApiPropertyOptional({ description: 'Parent franchise' })
  parentFranchise?: Franchise;

  @ApiPropertyOptional({ description: 'Child franchises' })
  childFranchises?: Franchise[];

  @ApiPropertyOptional({ description: 'Franchise locations' })
  locations?: FranchiseLocation[];

  @ApiPropertyOptional({ description: 'Franchise permissions' })
  permissions?: FranchisePermission[];

  @ApiPropertyOptional({ description: 'Franchise metrics' })
  metrics?: FranchiseMetric[];
}

export class Territory {
  @ApiProperty({ description: 'Territory ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Territory name' })
  name!: string;

  @ApiProperty({ description: 'Territory code' })
  code!: string;

  @ApiPropertyOptional({ description: 'Territory description' })
  description?: string;

  @ApiProperty({ enum: TerritoryType, description: 'Territory type' })
  type!: TerritoryType;

  @ApiProperty({ description: 'Geographic boundaries (GeoJSON)' })
  boundaries!: Record<string, any>;

  @ApiProperty({ description: 'Market criteria' })
  marketCriteria!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Parent territory ID' })
  parentTerritoryId?: string;

  @ApiPropertyOptional({ description: 'Assigned franchise ID' })
  assignedFranchiseId?: string;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  assignedUserId?: string;

  @ApiProperty({ description: 'Territory metrics' })
  metrics!: Record<string, any>;

  @ApiProperty({ description: 'Territory settings' })
  settings!: Record<string, any>;

  @ApiProperty({ description: 'Active status' })
  isActive!: boolean;

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

  // Virtual properties for relations
  @ApiPropertyOptional({ description: 'Assigned franchise' })
  assignedFranchise?: Franchise;

  @ApiPropertyOptional({ description: 'Assigned user' })
  assignedUser?: any; // User entity

  @ApiPropertyOptional({ description: 'Parent territory' })
  parentTerritory?: Territory;

  @ApiPropertyOptional({ description: 'Child territories' })
  childTerritories?: Territory[];

  @ApiPropertyOptional({ description: 'Territory assignments' })
  assignments?: TerritoryAssignment[];
}

export class FranchiseLocation {
  @ApiProperty({ description: 'Franchise location ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Franchise ID' })
  franchiseId!: string;

  @ApiProperty({ description: 'Location ID' })
  locationId!: string;

  @ApiProperty({ description: 'Role in franchise' })
  role!: string;

  @ApiProperty({ description: 'Effective date' })
  effectiveDate!: Date;

  @ApiPropertyOptional({ description: 'Expiration date' })
  expirationDate?: Date;

  @ApiProperty({ description: 'Settings' })
  settings!: Record<string, any>;

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

  // Virtual properties for relations
  @ApiPropertyOptional({ description: 'Franchise' })
  franchise?: Franchise;

  @ApiPropertyOptional({ description: 'Location' })
  location?: any; // Location entity
}

export class FranchisePermission {
  @ApiProperty({ description: 'Permission ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Franchise ID' })
  franchiseId!: string;

  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Permissions array' })
  permissions!: string[];

  @ApiProperty({ description: 'Role' })
  role!: string;

  @ApiProperty({ description: 'Effective date' })
  effectiveDate!: Date;

  @ApiPropertyOptional({ description: 'Expiration date' })
  expirationDate?: Date;

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

  // Virtual properties for relations
  @ApiPropertyOptional({ description: 'Franchise' })
  franchise?: Franchise;

  @ApiPropertyOptional({ description: 'User' })
  user?: any; // User entity
}

export class FranchiseMetric {
  @ApiProperty({ description: 'Metric ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Franchise ID' })
  franchiseId!: string;

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

  @ApiProperty({ description: 'Created by user ID' })
  createdBy?: string;

  @ApiProperty({ description: 'Updated by user ID' })
  updatedBy?: string;

  @ApiPropertyOptional({ description: 'Deletion date' })
  deletedAt?: Date;

  @ApiProperty({ description: 'Version number' })
  version!: number;

  // Virtual properties for relations
  @ApiPropertyOptional({ description: 'Franchise' })
  franchise?: Franchise;
}

export class TerritoryAssignment {
  @ApiProperty({ description: 'Assignment ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Territory ID' })
  territoryId!: string;

  @ApiPropertyOptional({ description: 'Franchise ID' })
  franchiseId?: string;

  @ApiPropertyOptional({ description: 'User ID' })
  userId?: string;

  @ApiProperty({ enum: AssignmentType, description: 'Assignment type' })
  assignmentType!: AssignmentType;

  @ApiProperty({ description: 'Effective date' })
  effectiveDate!: Date;

  @ApiPropertyOptional({ description: 'Expiration date' })
  expirationDate?: Date;

  @ApiPropertyOptional({ description: 'Assignment reason' })
  reason?: string;

  @ApiProperty({ description: 'Additional metadata' })
  metadata!: Record<string, any>;

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

  // Virtual properties for relations
  @ApiPropertyOptional({ description: 'Territory' })
  territory?: Territory;

  @ApiPropertyOptional({ description: 'Franchise' })
  franchise?: Franchise;

  @ApiPropertyOptional({ description: 'User' })
  user?: any; // User entity
}