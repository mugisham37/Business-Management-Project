import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray, IsDateString, Length, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { InputType, Field, Float, Int } from '@nestjs/graphql';

export enum CustomerType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

export enum CustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
  PROSPECT = 'prospect',
}

export enum LoyaltyTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
}

@InputType()
export class CreateCustomerDto {
  @Field()
  @ApiProperty({ description: 'Customer type', enum: CustomerType })
  @IsEnum(CustomerType)
  type!: CustomerType;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  companyName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  phone?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Alternate phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  alternatePhone?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  website?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Address line 1' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine1?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Address line 2' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine2?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'State/Province' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  state?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Postal code' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  postalCode?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Tax ID' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxId?: string;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Credit limit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Payment terms in days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  paymentTerms?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Discount percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Marketing opt-in status' })
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Email opt-in status' })
  @IsOptional()
  @IsBoolean()
  emailOptIn?: boolean;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'SMS opt-in status' })
  @IsOptional()
  @IsBoolean()
  smsOptIn?: boolean;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Customer tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Customer notes' })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  notes?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Anniversary date' })
  @IsOptional()
  @IsDateString()
  anniversary?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Referring customer ID' })
  @IsOptional()
  @IsUUID()
  referredBy?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Custom fields', type: 'object', additionalProperties: true })
  @IsOptional()
  customFields?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Customer preferences', type: 'object', additionalProperties: true })
  @IsOptional()
  preferences?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Social media profiles', type: 'object', additionalProperties: true })
  @IsOptional()
  socialProfiles?: Record<string, any>;
}

@InputType()
export class UpdateCustomerDto {
  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Customer type', enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Customer status', enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  displayName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  companyName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  phone?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Alternate phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  alternatePhone?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  website?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Address line 1' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine1?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Address line 2' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine2?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'State/Province' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  state?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Postal code' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  postalCode?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Tax ID' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxId?: string;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Credit limit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Payment terms in days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  paymentTerms?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Discount percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Loyalty tier', enum: LoyaltyTier })
  @IsOptional()
  @IsEnum(LoyaltyTier)
  loyaltyTier?: LoyaltyTier;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Marketing opt-in status' })
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Email opt-in status' })
  @IsOptional()
  @IsBoolean()
  emailOptIn?: boolean;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'SMS opt-in status' })
  @IsOptional()
  @IsBoolean()
  smsOptIn?: boolean;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Customer tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Customer notes' })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  notes?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Referral code' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  referralCode?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Anniversary date' })
  @IsOptional()
  @IsDateString()
  anniversary?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Custom fields', type: 'object', additionalProperties: true })
  @IsOptional()
  customFields?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Customer preferences', type: 'object', additionalProperties: true })
  @IsOptional()
  preferences?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Social media profiles', type: 'object', additionalProperties: true })
  @IsOptional()
  socialProfiles?: Record<string, any>;
}

export class CustomerQueryDto {
  @ApiPropertyOptional({ description: 'Search term for name, email, or phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Customer type filter', enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({ description: 'Customer status filter', enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ description: 'Loyalty tier filter', enum: LoyaltyTier })
  @IsOptional()
  @IsEnum(LoyaltyTier)
  loyaltyTier?: LoyaltyTier;

  @ApiPropertyOptional({ description: 'Filter by tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'City filter' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State filter' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Country filter' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Minimum total spent' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minTotalSpent?: number;

  @ApiPropertyOptional({ description: 'Maximum total spent' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxTotalSpent?: number;

  @ApiPropertyOptional({ description: 'Minimum churn risk' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  minChurnRisk?: number;

  @ApiPropertyOptional({ description: 'Maximum churn risk' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  maxChurnRisk?: number;

  @ApiPropertyOptional({ description: 'Created after date' })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiPropertyOptional({ description: 'Created before date' })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiPropertyOptional({ description: 'Last purchase after date' })
  @IsOptional()
  @IsDateString()
  lastPurchaseAfter?: string;

  @ApiPropertyOptional({ description: 'Last purchase before date' })
  @IsOptional()
  @IsDateString()
  lastPurchaseBefore?: string;

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

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}