import { ObjectType, Field, ID, Float, InputType, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity, Edge, Connection } from '../../../common/graphql/base.types';
import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsBoolean, 
  IsEnum, 
  IsUUID,
  IsEmail,
  IsUrl,
  Min,
  Max,
  Length,
  IsNotEmpty,
} from 'class-validator';

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
registerEnumType(PaymentTerms, { name: 'PaymentTerms' });

// Object Types
@ObjectType('Supplier')
export class SupplierType extends BaseEntity {
  @Field()
  @ApiProperty({ description: 'Supplier code' })
  supplierCode!: string;

  @Field()
  @ApiProperty({ description: 'Supplier name' })
  name!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Legal name', required: false })
  legalName?: string;

  @Field(() => SupplierType)
  @ApiProperty({ description: 'Supplier type', enum: SupplierType })
  type!: SupplierType;

  @Field(() => SupplierStatus)
  @ApiProperty({ description: 'Supplier status', enum: SupplierStatus })
  status!: SupplierStatus;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Tax ID', required: false })
  taxId?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Email', required: false })
  email?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Phone', required: false })
  phone?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Website', required: false })
  website?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Address', required: false })
  address?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'City', required: false })
  city?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'State/Province', required: false })
  state?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Postal code', required: false })
  postalCode?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Country', required: false })
  country?: string;

  @Field(() => PaymentTerms, { nullable: true })
  @ApiProperty({ description: 'Payment terms', enum: PaymentTerms, required: false })
  paymentTerms?: PaymentTerms;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Currency code', required: false })
  currency?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Lead time in days', required: false })
  leadTimeDays?: number;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Minimum order amount', required: false })
  minimumOrderAmount?: number;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Is preferred supplier', required: false })
  isPreferred?: boolean;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Overall rating', required: false })
  overallRating?: number;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Quality rating', required: false })
  qualityRating?: number;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Delivery rating', required: false })
  deliveryRating?: number;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Service rating', required: false })
  serviceRating?: number;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Notes', required: false })
  notes?: string;
}

// Input Types
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
  type!: SupplierType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxId?: string;

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
  @IsUrl()
  website?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  address?: string;

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

  @Field(() => PaymentTerms, { nullable: true })
  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  leadTimeDays?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
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
  type?: SupplierType;

  @Field(() => SupplierStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

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
  @IsUrl()
  website?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  address?: string;

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

  @Field(() => PaymentTerms, { nullable: true })
  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  leadTimeDays?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class RateSupplierInput {
  @Field(() => Float)
  @IsNumber()
  @Min(0)
  @Max(100)
  overallRating!: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityRating?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  deliveryRating?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceRating?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

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
  type?: SupplierType;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;
}

// Connection Types
@ObjectType()
export class SupplierEdge extends Edge<SupplierType> {
  @Field(() => SupplierType)
  node!: SupplierType;
}

@ObjectType()
export class SupplierConnection extends Connection<SupplierType> {
  @Field(() => [SupplierEdge])
  edges!: SupplierEdge[];
}
