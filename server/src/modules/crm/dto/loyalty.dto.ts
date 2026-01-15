import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsArray, IsDateString, Length, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { InputType, Field, Float, Int } from '@nestjs/graphql';

export enum LoyaltyTransactionType {
  EARNED = 'earned',
  REDEEMED = 'redeemed',
  EXPIRED = 'expired',
  ADJUSTED = 'adjusted',
}

export enum RewardType {
  DISCOUNT_PERCENTAGE = 'discount_percentage',
  DISCOUNT_FIXED = 'discount_fixed',
  FREE_PRODUCT = 'free_product',
  FREE_SHIPPING = 'free_shipping',
  STORE_CREDIT = 'store_credit',
  CUSTOM = 'custom',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@InputType()
export class CreateLoyaltyTransactionDto {
  @Field()
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  customerId!: string;

  @Field()
  @ApiProperty({ description: 'Transaction type', enum: LoyaltyTransactionType })
  @IsEnum(LoyaltyTransactionType)
  type!: LoyaltyTransactionType;

  @Field(() => Int)
  @ApiProperty({ description: 'Points amount (positive for earned, negative for redeemed)' })
  @IsNumber()
  points!: number;

  @Field()
  @ApiProperty({ description: 'Transaction description' })
  @IsString()
  @Length(1, 500)
  description!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Related POS transaction ID' })
  @IsOptional()
  @IsUUID()
  relatedTransactionId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Points expiration date' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Campaign ID' })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Promotion ID' })
  @IsOptional()
  @IsUUID()
  promotionId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object', additionalProperties: true })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType()
export class CreateRewardDto {
  @Field()
  @ApiProperty({ description: 'Reward name' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Reward description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @Field()
  @ApiProperty({ description: 'Reward type', enum: RewardType })
  @IsEnum(RewardType)
  type!: RewardType;

  @Field(() => Int)
  @ApiProperty({ description: 'Points required to redeem' })
  @IsNumber()
  @Min(1)
  pointsRequired!: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Reward value (amount or percentage)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Product ID for free product rewards' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Minimum order value required' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderValue?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Maximum discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscountAmount?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Reward start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Reward end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Usage limit per customer' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimitPerCustomer?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Total usage limit' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalUsageLimit?: number;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Required loyalty tiers', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredTiers?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Terms and conditions' })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  termsAndConditions?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object', additionalProperties: true })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType()
export class UpdateRewardDto {
  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Reward name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Reward description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Points required to redeem' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pointsRequired?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Reward value (amount or percentage)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Product ID for free product rewards' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Minimum order value required' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderValue?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Maximum discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscountAmount?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Reward start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Reward end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Usage limit per customer' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimitPerCustomer?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Total usage limit' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalUsageLimit?: number;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Required loyalty tiers', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredTiers?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Terms and conditions' })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  termsAndConditions?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Is reward active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object', additionalProperties: true })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType()
export class CreateCampaignDto {
  @Field()
  @ApiProperty({ description: 'Campaign name' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Campaign description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @Field()
  @ApiProperty({ description: 'Campaign start date' })
  @IsDateString()
  startDate!: string;

  @Field()
  @ApiProperty({ description: 'Campaign end date' })
  @IsDateString()
  endDate!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Points multiplier (e.g., 2.0 for double points)' })
  @IsNumber()
  @Min(0.1)
  @Max(10)
  pointsMultiplier!: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Minimum purchase amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumPurchaseAmount?: number;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Target customer segments', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  targetSegments?: string[];

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Target loyalty tiers', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetTiers?: string[];

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Applicable product categories', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableCategories?: string[];

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Applicable product IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  applicableProducts?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Maximum points per customer' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxPointsPerCustomer?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Total points budget' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalPointsBudget?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Campaign terms and conditions' })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  termsAndConditions?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object', additionalProperties: true })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class LoyaltyQueryDto {
  @ApiPropertyOptional({ description: 'Customer ID filter' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Transaction type filter', enum: LoyaltyTransactionType })
  @IsOptional()
  @IsEnum(LoyaltyTransactionType)
  type?: LoyaltyTransactionType;

  @ApiPropertyOptional({ description: 'Campaign ID filter' })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Start date filter' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

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

export class RewardQueryDto {
  @ApiPropertyOptional({ description: 'Reward type filter', enum: RewardType })
  @IsOptional()
  @IsEnum(RewardType)
  type?: RewardType;

  @ApiPropertyOptional({ description: 'Active rewards only' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: 'Available rewards only (not expired)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  availableOnly?: boolean;

  @ApiPropertyOptional({ description: 'Maximum points required' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPointsRequired?: number;

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

  @ApiPropertyOptional({ description: 'Sort field', default: 'pointsRequired' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'pointsRequired';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}