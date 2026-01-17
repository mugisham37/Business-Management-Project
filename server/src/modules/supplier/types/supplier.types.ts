import { ObjectType, Field, Float, InputType, registerEnumType } from '@nestjs/graphql';
import { BaseEntity, Edge, Connection } from '../../../common/graphql/base.types';
import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsBoolean, 
  IsEnum, 
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

export enum SupplierTypeEnum {
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
registerEnumType(SupplierTypeEnum, { name: 'SupplierType' });
registerEnumType(PaymentTerms, { name: 'PaymentTerms' });

// Object Types
@ObjectType('Supplier')
export class SupplierType extends BaseEntity {
  @Field()
  supplierCode!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  legalName?: string;

  @Field(() => SupplierTypeEnum)
  type!: SupplierTypeEnum;

  @Field(() => SupplierStatus)
  status!: SupplierStatus;

  @Field({ nullable: true })
  taxId?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  website?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  state?: string;

  @Field({ nullable: true })
  postalCode?: string;

  @Field({ nullable: true })
  country?: string;

  @Field(() => PaymentTerms, { nullable: true })
  paymentTerms?: PaymentTerms;

  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  leadTimeDays?: number;

  @Field({ nullable: true })
  minimumOrderAmount?: number;

  @Field({ nullable: true })
  isPreferred?: boolean;

  @Field(() => Float, { nullable: true })
  overallRating?: number;

  @Field(() => Float, { nullable: true })
  qualityRating?: number;

  @Field(() => Float, { nullable: true })
  deliveryRating?: number;

  @Field(() => Float, { nullable: true })
  serviceRating?: number;

  @Field({ nullable: true })
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

  @Field(() => SupplierTypeEnum)
  @IsEnum(SupplierTypeEnum)
  type!: SupplierTypeEnum;

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

  @Field(() => SupplierTypeEnum, { nullable: true })
  @IsOptional()
  @IsEnum(SupplierTypeEnum)
  type?: SupplierTypeEnum;

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

  @Field(() => SupplierTypeEnum, { nullable: true })
  @IsOptional()
  @IsEnum(SupplierTypeEnum)
  type?: SupplierTypeEnum;

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
