import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsArray, IsDateString, Length, Min, Max, IsUUID, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { InputType, Field, Float } from '@nestjs/graphql';

export enum B2BOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
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
export class B2BOrderItemDto {
  @Field()
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Quantity ordered' })
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
export class CreateB2BOrderDto {
  @Field()
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  customerId!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Quote ID if converting from quote' })
  @IsOptional()
  @IsUUID()
  quoteId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Order date' })
  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Requested delivery date' })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @Field()
  @ApiProperty({ description: 'Payment terms', enum: PaymentTerms })
  @IsEnum(PaymentTerms)
  paymentTerms!: PaymentTerms;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Shipping method' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingMethod?: string;

  @Field()
  @ApiProperty({ description: 'Shipping address' })
  shippingAddress!: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  @Field()
  @ApiProperty({ description: 'Billing address' })
  billingAddress!: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  @Field(() => [B2BOrderItemDto])
  @ApiProperty({ description: 'Order items', type: [B2BOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => B2BOrderItemDto)
  items!: B2BOrderItemDto[];

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
  @ApiPropertyOptional({ description: 'Order metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType()
export class UpdateB2BOrderDto {
  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Order status', enum: B2BOrderStatus })
  @IsOptional()
  @IsEnum(B2BOrderStatus)
  status?: B2BOrderStatus;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Requested delivery date' })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Confirmed delivery date' })
  @IsOptional()
  @IsDateString()
  confirmedDeliveryDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Shipping method' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingMethod?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Tracking number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  trackingNumber?: string;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

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
  @ApiPropertyOptional({ description: 'Order metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class B2BOrderQueryDto {
  @ApiPropertyOptional({ description: 'Search term for order number or customer' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Order status filter', enum: B2BOrderStatus })
  @IsOptional()
  status?: B2BOrderStatus | B2BOrderStatus[];

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

  @ApiPropertyOptional({ description: 'Minimum order amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum order amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'Requires approval filter' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  requiresApproval?: boolean;

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

  @ApiPropertyOptional({ description: 'Sort field', default: 'orderDate' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'orderDate';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ApproveOrderDto {
  @ApiProperty({ description: 'Approval notes' })
  @IsString()
  @Length(1, 1000)
  approvalNotes!: string;
}

export class RejectOrderDto {
  @ApiProperty({ description: 'Rejection reason' })
  @IsString()
  @Length(1, 1000)
  rejectionReason!: string;
}