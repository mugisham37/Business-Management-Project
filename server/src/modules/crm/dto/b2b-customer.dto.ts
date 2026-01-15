import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsArray, IsDateString, Length, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { InputType, Field, Float, Int } from '@nestjs/graphql';

export enum PaymentTermsType {
  NET_15 = 'net_15',
  NET_30 = 'net_30',
  NET_45 = 'net_45',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  COD = 'cod',
  PREPAID = 'prepaid',
  CUSTOM = 'custom',
}

export enum CreditStatus {
  APPROVED = 'approved',
  PENDING = 'pending',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
  UNDER_REVIEW = 'under_review',
}

export enum PricingTier {
  STANDARD = 'standard',
  PREFERRED = 'preferred',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom',
}

@InputType()
export class CreateB2BCustomerDto {
  @Field()
  @ApiProperty({ description: 'Company name' })
  @IsString()
  @Length(1, 255)
  companyName!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Primary contact first name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactFirstName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Primary contact last name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactLastName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Primary contact title' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactTitle?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Company email address' })
  @IsOptional()
  @IsString()
  email?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Company phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  phone?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Company website' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  website?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Tax ID or EIN' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'DUNS number' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  dunsNumber?: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Credit limit amount' })
  @IsNumber()
  @Min(0)
  creditLimit!: number;

  @Field()
  @ApiProperty({ description: 'Payment terms', enum: PaymentTermsType })
  @IsEnum(PaymentTermsType)
  paymentTerms!: PaymentTermsType;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Custom payment terms in days (for CUSTOM type)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  customPaymentTermsDays?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Early payment discount percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  earlyPaymentDiscountPercentage?: number;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Early payment discount days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  earlyPaymentDiscountDays?: number;

  @Field()
  @ApiProperty({ description: 'Pricing tier', enum: PricingTier })
  @IsEnum(PricingTier)
  pricingTier!: PricingTier;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Volume discount percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  volumeDiscountPercentage?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Minimum order amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Assigned sales representative ID' })
  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Account manager ID' })
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Industry classification' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  industry?: string;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Number of employees' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  employeeCount?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Annual revenue' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRevenue?: number;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Preferred product categories', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredCategories?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Billing address line 1' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  billingAddressLine1?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Billing address line 2' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  billingAddressLine2?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Billing city' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  billingCity?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Billing state/province' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  billingState?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Billing postal code' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  billingPostalCode?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Billing country' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  billingCountry?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Shipping address line 1' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  shippingAddressLine1?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Shipping address line 2' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  shippingAddressLine2?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Shipping city' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingCity?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Shipping state/province' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingState?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Shipping postal code' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  shippingPostalCode?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Shipping country' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingCountry?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Special instructions' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  specialInstructions?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Contract start date' })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Contract end date' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object', additionalProperties: true })
  @IsOptional()
  b2bMetadata?: Record<string, any>;
}

@InputType()
export class UpdateB2BCustomerDto {
  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  companyName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Primary contact first name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactFirstName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Primary contact last name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactLastName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Primary contact title' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  primaryContactTitle?: string;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Credit limit amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Payment terms', enum: PaymentTermsType })
  @IsOptional()
  @IsEnum(PaymentTermsType)
  paymentTerms?: PaymentTermsType;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Custom payment terms in days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  customPaymentTermsDays?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Early payment discount percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  earlyPaymentDiscountPercentage?: number;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Early payment discount days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  earlyPaymentDiscountDays?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Pricing tier', enum: PricingTier })
  @IsOptional()
  @IsEnum(PricingTier)
  pricingTier?: PricingTier;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Volume discount percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  volumeDiscountPercentage?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Minimum order amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Credit status', enum: CreditStatus })
  @IsOptional()
  @IsEnum(CreditStatus)
  creditStatus?: CreditStatus;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Assigned sales representative ID' })
  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Account manager ID' })
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Industry classification' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  industry?: string;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Number of employees' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  employeeCount?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Annual revenue' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRevenue?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Contract start date' })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Contract end date' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Additional B2B metadata', type: 'object', additionalProperties: true })
  @IsOptional()
  b2bMetadata?: Record<string, any>;
}

export class B2BCustomerQueryDto {
  @ApiPropertyOptional({ description: 'Search term for company name or contact' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Credit status filter', enum: CreditStatus })
  @IsOptional()
  @IsEnum(CreditStatus)
  creditStatus?: CreditStatus;

  @ApiPropertyOptional({ description: 'Pricing tier filter', enum: PricingTier })
  @IsOptional()
  @IsEnum(PricingTier)
  pricingTier?: PricingTier;

  @ApiPropertyOptional({ description: 'Payment terms filter', enum: PaymentTermsType })
  @IsOptional()
  @IsEnum(PaymentTermsType)
  paymentTerms?: PaymentTermsType;

  @ApiPropertyOptional({ description: 'Sales representative ID filter' })
  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @ApiPropertyOptional({ description: 'Account manager ID filter' })
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @ApiPropertyOptional({ description: 'Industry filter' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Minimum credit limit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minCreditLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum credit limit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxCreditLimit?: number;

  @ApiPropertyOptional({ description: 'Minimum annual revenue' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAnnualRevenue?: number;

  @ApiPropertyOptional({ description: 'Maximum annual revenue' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAnnualRevenue?: number;

  @ApiPropertyOptional({ description: 'Contract expiring within days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  contractExpiringWithinDays?: number;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'companyName' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'companyName';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}