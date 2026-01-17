import { InputType, Field, ID, Float, registerEnumType } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEmail,
  IsUrl,
  IsUUID,
  IsDateString,
  Length,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { GraphQLJSON } from 'graphql-scalars';

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

export enum PaymentTerms {
  NET_30 = 'net_30',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  COD = 'cod',
  PREPAID = 'prepaid',
  CUSTOM = 'custom',
}

registerEnumType(SupplierStatus, { name: 'SupplierStatus' });
registerEnumType(SupplierType, { name: 'SupplierType' });
registerEnumType(SupplierRating, { name: 'SupplierRating' });
registerEnumType(CommunicationType, { name: 'CommunicationType' });
registerEnumType(CommunicationDirection, { name: 'CommunicationDirection' });
registerEnumType(PaymentTerms, { name: 'PaymentTerms' });

// Supplier Inputs
@InputType()
export class CreateSupplierInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  supplierCode!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  legalName?: string;

  @Field(() => SupplierType)
  @IsEnum(SupplierType)
  supplierType!: SupplierType;

  @Field(() => SupplierStatus, { nullable: true, defaultValue: SupplierStatus.ACTIVE })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  // Contact Information
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactTitle?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  primaryContactPhone?: string;

  // Address Information
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine1?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine2?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  state?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  postalCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;

  // Business Information
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  businessRegistrationNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  website?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  // Financial Information
  @Field(() => PaymentTerms, { nullable: true })
  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @Field({ nullable: true, defaultValue: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  // Additional Information
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  customFields?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => CommunicationType, { nullable: true })
  @IsOptional()
  @IsEnum(CommunicationType)
  preferredCommunicationMethod?: CommunicationType;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isPreferredSupplier?: boolean;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  leadTimeDays?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;
}

@InputType()
export class UpdateSupplierInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  legalName?: string;

  @Field(() => SupplierType, { nullable: true })
  @IsOptional()
  @IsEnum(SupplierType)
  supplierType?: SupplierType;

  @Field(() => SupplierStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  primaryContactName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  primaryContactTitle?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  primaryContactPhone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  city?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  state?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  country?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  taxId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  businessRegistrationNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  website?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => PaymentTerms, { nullable: true })
  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  customFields?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => CommunicationType, { nullable: true })
  @IsOptional()
  @IsEnum(CommunicationType)
  preferredCommunicationMethod?: CommunicationType;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPreferredSupplier?: boolean;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  leadTimeDays?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;
}

// Supplier Contact Inputs
@InputType()
export class CreateSupplierContactInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  firstName!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  lastName!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  department?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  mobile?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  fax?: string;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @Field(() => CommunicationType, { nullable: true })
  @IsOptional()
  @IsEnum(CommunicationType)
  preferredContactMethod?: CommunicationType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  customFields?: Record<string, any>;
}

@InputType()
export class UpdateSupplierContactInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  department?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  mobile?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  fax?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @Field(() => CommunicationType, { nullable: true })
  @IsOptional()
  @IsEnum(CommunicationType)
  preferredContactMethod?: CommunicationType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  customFields?: Record<string, any>;
}

// Communication Inputs
@InputType()
export class CreateSupplierCommunicationInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @Field(() => CommunicationType)
  @IsEnum(CommunicationType)
  type!: CommunicationType;

  @Field(() => CommunicationDirection)
  @IsEnum(CommunicationDirection)
  direction!: CommunicationDirection;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  subject?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  content?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  fromName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  toName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  toEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  communicationDate?: string;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @Field(() => [GraphQLJSON], { nullable: true })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  customFields?: Record<string, any>;
}

@InputType()
export class UpdateSupplierCommunicationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  subject?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  content?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

// Evaluation Inputs
@InputType()
export class CreateSupplierEvaluationInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @Field()
  @IsDateString()
  evaluationPeriodStart!: string;

  @Field()
  @IsDateString()
  evaluationPeriodEnd!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  evaluationDate?: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  @Max(100)
  overallScore!: number;

  @Field(() => SupplierRating)
  @IsEnum(SupplierRating)
  overallRating!: SupplierRating;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  deliveryScore?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pricingScore?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceScore?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  reliabilityScore?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  complianceScore?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  onTimeDeliveryRate?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityDefectRate?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  responseTime?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  strengths?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  weaknesses?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  recommendations?: string;

  @Field(() => [GraphQLJSON], { nullable: true })
  @IsOptional()
  @IsArray()
  actionItems?: any[];

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  customScores?: Record<string, number>;

  @Field(() => [GraphQLJSON], { nullable: true })
  @IsOptional()
  @IsArray()
  attachments?: any[];
}

@InputType()
export class UpdateSupplierEvaluationInput {
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  overallScore?: number;

  @Field(() => SupplierRating, { nullable: true })
  @IsOptional()
  @IsEnum(SupplierRating)
  overallRating?: SupplierRating;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  qualityScore?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryScore?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  pricingScore?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  serviceScore?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  strengths?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  weaknesses?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  recommendations?: string;
}

// Filter Inputs
@InputType()
export class SupplierFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => SupplierStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @Field(() => SupplierType, { nullable: true })
  @IsOptional()
  @IsEnum(SupplierType)
  supplierType?: SupplierType;

  @Field(() => SupplierRating, { nullable: true })
  @IsOptional()
  @IsEnum(SupplierRating)
  rating?: SupplierRating;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  preferredOnly?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sortOrder?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

@InputType()
export class DateRangeInput {
  @Field()
  @IsDateString()
  startDate!: string;

  @Field()
  @IsDateString()
  endDate!: string;
}


