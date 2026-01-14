import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
  IsDateString,
  IsUUID,
  Length,
  Min,
  Max,
  ValidateNested,
  IsDecimal,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum SupplierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING_APPROVAL = 'pending_approval',
  SUSPENDED = 'suspended',
  BLACKLISTED = 'blacklisted',
}

export enum SupplierType {
  MANUFACTURER = 'manufacturer',
  DISTRIBUTOR = 'distributor',
  WHOLESALER = 'wholesaler',
  SERVICE_PROVIDER = 'service_provider',
  CONTRACTOR = 'contractor',
  CONSULTANT = 'consultant',
}

export enum SupplierRating {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  AVERAGE = 'average',
  POOR = 'poor',
  UNRATED = 'unrated',
}

export enum CommunicationType {
  EMAIL = 'email',
  PHONE = 'phone',
  MEETING = 'meeting',
  VIDEO_CALL = 'video_call',
  CHAT = 'chat',
  LETTER = 'letter',
  FAX = 'fax',
}

export enum CommunicationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

// Base supplier DTO
export class CreateSupplierDto {
  @ApiProperty({ description: 'Unique supplier code' })
  @IsString()
  @Length(1, 50)
  supplierCode!: string;

  @ApiProperty({ description: 'Supplier name' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiPropertyOptional({ description: 'Legal name of the supplier' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  legalName?: string;

  @ApiProperty({ enum: SupplierType, description: 'Type of supplier' })
  @IsEnum(SupplierType)
  supplierType!: SupplierType;

  @ApiPropertyOptional({ enum: SupplierStatus, description: 'Supplier status' })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  // Contact Information
  @ApiPropertyOptional({ description: 'Primary contact name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactName?: string;

  @ApiPropertyOptional({ description: 'Primary contact title' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactTitle?: string;

  @ApiPropertyOptional({ description: 'Primary contact email' })
  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @ApiPropertyOptional({ description: 'Primary contact phone' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  primaryContactPhone?: string;

  // Address Information
  @ApiPropertyOptional({ description: 'Address line 1' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine1?: string;

  @ApiPropertyOptional({ description: 'Address line 2' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @ApiPropertyOptional({ description: 'State or province' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  state?: string;

  @ApiPropertyOptional({ description: 'Postal code' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;

  // Business Information
  @ApiPropertyOptional({ description: 'Tax identification number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxId?: string;

  @ApiPropertyOptional({ description: 'Business registration number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  businessRegistrationNumber?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  website?: string;

  @ApiPropertyOptional({ description: 'Supplier description' })
  @IsOptional()
  @IsString()
  description?: string;

  // Financial Information
  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Credit limit' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  @Transform(({ value }) => parseFloat(value))
  creditLimit?: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  // Additional Information
  @ApiPropertyOptional({ description: 'Certifications', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Custom fields', type: Object })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: CommunicationType, description: 'Preferred communication method' })
  @IsOptional()
  @IsEnum(CommunicationType)
  preferredCommunicationMethod?: CommunicationType;

  @ApiPropertyOptional({ description: 'Is preferred supplier' })
  @IsOptional()
  @IsBoolean()
  isPreferredSupplier?: boolean;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional({ description: 'Supplier name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ description: 'Legal name of the supplier' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  legalName?: string;

  @ApiPropertyOptional({ enum: SupplierType, description: 'Type of supplier' })
  @IsOptional()
  @IsEnum(SupplierType)
  supplierType?: SupplierType;

  @ApiPropertyOptional({ enum: SupplierStatus, description: 'Supplier status' })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  // Contact Information
  @ApiPropertyOptional({ description: 'Primary contact name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactName?: string;

  @ApiPropertyOptional({ description: 'Primary contact title' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactTitle?: string;

  @ApiPropertyOptional({ description: 'Primary contact email' })
  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @ApiPropertyOptional({ description: 'Primary contact phone' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  primaryContactPhone?: string;

  // Address Information
  @ApiPropertyOptional({ description: 'Address line 1' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine1?: string;

  @ApiPropertyOptional({ description: 'Address line 2' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @ApiPropertyOptional({ description: 'State or province' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  state?: string;

  @ApiPropertyOptional({ description: 'Postal code' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;

  // Business Information
  @ApiPropertyOptional({ description: 'Tax identification number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxId?: string;

  @ApiPropertyOptional({ description: 'Business registration number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  businessRegistrationNumber?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  website?: string;

  @ApiPropertyOptional({ description: 'Supplier description' })
  @IsOptional()
  @IsString()
  description?: string;

  // Financial Information
  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Credit limit' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  @Transform(({ value }) => parseFloat(value))
  creditLimit?: number;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  // Additional Information
  @ApiPropertyOptional({ description: 'Certifications', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Custom fields', type: Object })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: CommunicationType, description: 'Preferred communication method' })
  @IsOptional()
  @IsEnum(CommunicationType)
  preferredCommunicationMethod?: CommunicationType;

  @ApiPropertyOptional({ description: 'Is preferred supplier' })
  @IsOptional()
  @IsBoolean()
  isPreferredSupplier?: boolean;
}

// Supplier Contact DTOs
export class CreateSupplierContactDto {
  @ApiProperty({ description: 'First name' })
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ description: 'Last name' })
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiPropertyOptional({ description: 'Job title' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  title?: string;

  @ApiPropertyOptional({ description: 'Department' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  department?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Mobile number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  mobile?: string;

  @ApiPropertyOptional({ description: 'Fax number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  fax?: string;

  @ApiPropertyOptional({ description: 'Is primary contact' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ enum: CommunicationType, description: 'Preferred contact method' })
  @IsOptional()
  @IsEnum(CommunicationType)
  preferredContactMethod?: CommunicationType;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Custom fields', type: Object })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

export class UpdateSupplierContactDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Job title' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  title?: string;

  @ApiPropertyOptional({ description: 'Department' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  department?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Mobile number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  mobile?: string;

  @ApiPropertyOptional({ description: 'Fax number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  fax?: string;

  @ApiPropertyOptional({ description: 'Is primary contact' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ enum: CommunicationType, description: 'Preferred contact method' })
  @IsOptional()
  @IsEnum(CommunicationType)
  preferredContactMethod?: CommunicationType;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Custom fields', type: Object })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

// Communication DTOs
export class CreateSupplierCommunicationDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional({ description: 'Contact ID' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiProperty({ enum: CommunicationType, description: 'Communication type' })
  @IsEnum(CommunicationType)
  type!: CommunicationType;

  @ApiProperty({ enum: CommunicationDirection, description: 'Communication direction' })
  @IsEnum(CommunicationDirection)
  direction!: CommunicationDirection;

  @ApiPropertyOptional({ description: 'Subject' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  subject?: string;

  @ApiPropertyOptional({ description: 'Content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'From name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  fromName?: string;

  @ApiPropertyOptional({ description: 'From email' })
  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @ApiPropertyOptional({ description: 'To name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  toName?: string;

  @ApiPropertyOptional({ description: 'To email' })
  @IsOptional()
  @IsEmail()
  toEmail?: string;

  @ApiPropertyOptional({ description: 'Communication date' })
  @IsOptional()
  @IsDateString()
  communicationDate?: string;

  @ApiPropertyOptional({ description: 'Follow up required' })
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional({ description: 'Follow up date' })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional({ description: 'Attachments', type: [Object] })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Custom fields', type: Object })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

// Evaluation DTOs
export class CreateSupplierEvaluationDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsUUID()
  supplierId!: string;

  @ApiProperty({ description: 'Evaluation period start date' })
  @IsDateString()
  evaluationPeriodStart!: string;

  @ApiProperty({ description: 'Evaluation period end date' })
  @IsDateString()
  evaluationPeriodEnd!: string;

  @ApiPropertyOptional({ description: 'Evaluation date' })
  @IsOptional()
  @IsDateString()
  evaluationDate?: string;

  @ApiProperty({ description: 'Overall score (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  overallScore!: number;

  @ApiProperty({ enum: SupplierRating, description: 'Overall rating' })
  @IsEnum(SupplierRating)
  overallRating!: SupplierRating;

  @ApiPropertyOptional({ description: 'Quality score (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;

  @ApiPropertyOptional({ description: 'Delivery score (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  deliveryScore?: number;

  @ApiPropertyOptional({ description: 'Pricing score (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pricingScore?: number;

  @ApiPropertyOptional({ description: 'Service score (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceScore?: number;

  @ApiPropertyOptional({ description: 'Reliability score (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  reliabilityScore?: number;

  @ApiPropertyOptional({ description: 'Compliance score (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  complianceScore?: number;

  @ApiPropertyOptional({ description: 'On-time delivery rate (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  onTimeDeliveryRate?: number;

  @ApiPropertyOptional({ description: 'Quality defect rate (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityDefectRate?: number;

  @ApiPropertyOptional({ description: 'Response time in hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  responseTime?: number;

  @ApiPropertyOptional({ description: 'Strengths' })
  @IsOptional()
  @IsString()
  strengths?: string;

  @ApiPropertyOptional({ description: 'Weaknesses' })
  @IsOptional()
  @IsString()
  weaknesses?: string;

  @ApiPropertyOptional({ description: 'Recommendations' })
  @IsOptional()
  @IsString()
  recommendations?: string;

  @ApiPropertyOptional({ description: 'Action items', type: [Object] })
  @IsOptional()
  @IsArray()
  actionItems?: any[];

  @ApiPropertyOptional({ description: 'Custom scores', type: Object })
  @IsOptional()
  @IsObject()
  customScores?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Attachments', type: [Object] })
  @IsOptional()
  @IsArray()
  attachments?: any[];
}

// Query DTOs
export class SupplierQueryDto {
  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SupplierStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @ApiPropertyOptional({ enum: SupplierType, description: 'Filter by type' })
  @IsOptional()
  @IsEnum(SupplierType)
  supplierType?: SupplierType;

  @ApiPropertyOptional({ enum: SupplierRating, description: 'Filter by rating' })
  @IsOptional()
  @IsEnum(SupplierRating)
  rating?: SupplierRating;

  @ApiPropertyOptional({ description: 'Filter by preferred suppliers only' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  preferredOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter by tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

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
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// Response DTOs
export class SupplierResponseDto {
  @ApiProperty({ description: 'Supplier ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Supplier code' })
  supplierCode!: string;

  @ApiProperty({ description: 'Supplier name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Legal name' })
  legalName?: string;

  @ApiProperty({ enum: SupplierType, description: 'Supplier type' })
  supplierType!: SupplierType;

  @ApiProperty({ enum: SupplierStatus, description: 'Supplier status' })
  status!: SupplierStatus;

  @ApiPropertyOptional({ description: 'Primary contact name' })
  primaryContactName?: string;

  @ApiPropertyOptional({ description: 'Primary contact email' })
  primaryContactEmail?: string;

  @ApiPropertyOptional({ description: 'Primary contact phone' })
  primaryContactPhone?: string;

  @ApiPropertyOptional({ enum: SupplierRating, description: 'Overall rating' })
  overallRating?: SupplierRating;

  @ApiPropertyOptional({ description: 'Quality rating' })
  qualityRating?: number;

  @ApiPropertyOptional({ description: 'Delivery rating' })
  deliveryRating?: number;

  @ApiPropertyOptional({ description: 'Service rating' })
  serviceRating?: number;

  @ApiPropertyOptional({ description: 'Is preferred supplier' })
  isPreferredSupplier?: boolean;

  @ApiProperty({ description: 'Created at' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  updatedBy?: string;

  @ApiProperty({ description: 'Is active' })
  isActive!: boolean;
}