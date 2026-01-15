import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsArray, IsDateString, Length, Min, Max, IsUUID, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InputType, Field, Float, Int } from '@nestjs/graphql';

export enum QuoteStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CONVERTED = 'converted',
}

export enum PaymentTerms {
  NET_15 = 'net_15',
  NET_30 = 'net_30',
  NET_45 = 'net_45',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  COD = 'cod',
  PREPAID = 'prepaid',
}

@InputType()
export class QuoteItemDto {
  @Field()
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Quantity quoted' })
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Item description override' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Item metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType()
export class CreateQuoteDto {
  @Field()
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  customerId!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Quote date' })
  @IsOptional()
  @IsDateString()
  quoteDate?: string;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Quote validity in days', default: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  validityDays?: number = 30;

  @Field()
  @ApiProperty({ description: 'Payment terms', enum: PaymentTerms })
  @IsEnum(PaymentTerms)
  paymentTerms!: PaymentTerms;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Delivery terms' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  deliveryTerms?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Terms and conditions' })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  termsAndConditions?: string;

  @Field(() => [QuoteItemDto])
  @ApiProperty({ description: 'Quote items', type: [QuoteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

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
  @ApiPropertyOptional({ description: 'Special instructions' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  specialInstructions?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  internalNotes?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Quote metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType()
export class UpdateQuoteDto {
  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Quote status', enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Quote expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Delivery terms' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  deliveryTerms?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Terms and conditions' })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  termsAndConditions?: string;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Customer response' })
  @IsOptional()
  @IsEnum(['accepted', 'rejected', 'negotiating'])
  customerResponse?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Customer notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  customerNotes?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Special instructions' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  specialInstructions?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  internalNotes?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Quote metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class QuoteQueryDto {
  @ApiPropertyOptional({ description: 'Search term for quote number or customer' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Quote status filter', enum: QuoteStatus })
  @IsOptional()
  status?: QuoteStatus | QuoteStatus[];

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

  @ApiPropertyOptional({ description: 'Start date filter' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Minimum quote amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum quote amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'Quotes expiring within days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  expiringWithinDays?: number;

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

  @ApiPropertyOptional({ description: 'Sort field', default: 'quoteDate' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'quoteDate';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ApproveQuoteDto {
  @ApiProperty({ description: 'Approval notes' })
  @IsString()
  @Length(1, 1000)
  approvalNotes!: string;
}

export class RejectQuoteDto {
  @ApiProperty({ description: 'Rejection reason' })
  @IsString()
  @Length(1, 1000)
  rejectionReason!: string;
}

export class SendQuoteDto {
  @ApiProperty({ description: 'Recipient email addresses', type: [String] })
  @IsArray()
  @IsString({ each: true })
  recipients!: string[];

  @ApiPropertyOptional({ description: 'Email subject override' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  subject?: string;

  @ApiPropertyOptional({ description: 'Email message' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  message?: string;

  @ApiPropertyOptional({ description: 'Include PDF attachment' })
  @IsOptional()
  @IsBoolean()
  includePdf?: boolean = true;
}