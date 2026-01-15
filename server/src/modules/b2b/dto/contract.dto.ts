import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsDateString, Length, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InputType, Field, Float, Int } from '@nestjs/graphql';

export enum ContractType {
  PRICING = 'pricing',
  VOLUME = 'volume',
  EXCLUSIVE = 'exclusive',
  SERVICE = 'service',
}

export enum ContractStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
  RENEWED = 'renewed',
}

export enum PricingModel {
  FIXED = 'fixed',
  TIERED = 'tiered',
  VOLUME = 'volume',
  COST_PLUS = 'cost_plus',
}

@InputType()
export class CreateContractDto {
  @Field()
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  customerId!: string;

  @Field()
  @ApiProperty({ description: 'Contract type', enum: ContractType })
  @IsEnum(ContractType)
  contractType!: ContractType;

  @Field()
  @ApiProperty({ description: 'Contract title' })
  @IsString()
  @Length(1, 255)
  title!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Contract description' })
  @IsOptional()
  @IsString()
  description?: string;

  @Field()
  @ApiProperty({ description: 'Contract start date' })
  @IsDateString()
  startDate!: string;

  @Field()
  @ApiProperty({ description: 'Contract end date' })
  @IsDateString()
  endDate!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Enable auto renewal' })
  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Renewal term in months' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  renewalTermMonths?: number;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Renewal notice days' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  renewalNoticeDays?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Total contract value' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  contractValue?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Minimum commitment amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumCommitment?: number;

  @Field()
  @ApiProperty({ description: 'Payment terms' })
  @IsString()
  @Length(1, 50)
  paymentTerms!: string;

  @Field()
  @ApiProperty({ description: 'Pricing model', enum: PricingModel })
  @IsEnum(PricingModel)
  pricingModel!: PricingModel;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Pricing terms configuration' })
  @IsOptional()
  pricingTerms?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Performance metrics' })
  @IsOptional()
  performanceMetrics?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Compliance requirements' })
  @IsOptional()
  complianceRequirements?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Sales representative ID' })
  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Account manager ID' })
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Terms and conditions' })
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Special terms' })
  @IsOptional()
  @IsString()
  specialTerms?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType()
export class UpdateContractDto {
  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Contract title' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Contract description' })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Contract end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Enable auto renewal' })
  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Renewal term in months' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  renewalTermMonths?: number;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Renewal notice days' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  renewalNoticeDays?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Total contract value' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  contractValue?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Minimum commitment amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumCommitment?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  paymentTerms?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Pricing model', enum: PricingModel })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Pricing terms configuration' })
  @IsOptional()
  pricingTerms?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Performance metrics' })
  @IsOptional()
  performanceMetrics?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Compliance requirements' })
  @IsOptional()
  complianceRequirements?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Sales representative ID' })
  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Account manager ID' })
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Terms and conditions' })
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Special terms' })
  @IsOptional()
  @IsString()
  specialTerms?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ContractQueryDto {
  @ApiPropertyOptional({ description: 'Search term for contract title or number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Contract status filter', enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ description: 'Contract type filter', enum: ContractType })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional({ description: 'Customer ID filter' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Sales representative ID filter' })
  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @ApiPropertyOptional({ description: 'Account manager ID filter' })
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @ApiPropertyOptional({ description: 'Contracts expiring within days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  expiringWithinDays?: number;

  @ApiPropertyOptional({ description: 'Contracts requiring renewal notice' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  requiresRenewalNotice?: boolean;

  @ApiPropertyOptional({ description: 'Start date filter (from)' })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({ description: 'Start date filter (to)' })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @ApiPropertyOptional({ description: 'End date filter (from)' })
  @IsOptional()
  @IsDateString()
  endDateFrom?: string;

  @ApiPropertyOptional({ description: 'End date filter (to)' })
  @IsOptional()
  @IsDateString()
  endDateTo?: string;

  @ApiPropertyOptional({ description: 'Minimum contract value' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minContractValue?: number;

  @ApiPropertyOptional({ description: 'Maximum contract value' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxContractValue?: number;

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

  @ApiPropertyOptional({ description: 'Sort field', default: 'contractNumber' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'contractNumber';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}

export class ApproveContractDto {
  @ApiProperty({ description: 'Approval notes' })
  @IsString()
  @Length(1, 1000)
  approvalNotes!: string;
}

export class SignContractDto {
  @ApiPropertyOptional({ description: 'Customer signature date' })
  @IsOptional()
  @IsDateString()
  customerSignedAt?: string;
}

export class RenewContractDto {
  @ApiProperty({ description: 'New end date for renewed contract' })
  @IsDateString()
  newEndDate!: string;

  @ApiPropertyOptional({ description: 'Updated contract value' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  contractValue?: number;

  @ApiPropertyOptional({ description: 'Updated pricing terms' })
  @IsOptional()
  pricingTerms?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Renewal notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  renewalNotes?: string;
}