import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsArray, IsDateString, Length, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InputType, Field, Float } from '@nestjs/graphql';

export enum PortalOrderStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@InputType()
export class CustomerPortalLoginDto {
  @Field()
  @ApiProperty({ description: 'Customer email address' })
  @IsString()
  email!: string;

  @Field()
  @ApiProperty({ description: 'Customer password' })
  @IsString()
  @Length(6, 100)
  password!: string;
}

@InputType()
export class CustomerPortalRegistrationDto {
  @Field()
  @ApiProperty({ description: 'Company name' })
  @IsString()
  @Length(1, 255)
  companyName!: string;

  @Field()
  @ApiProperty({ description: 'Primary contact first name' })
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @Field()
  @ApiProperty({ description: 'Primary contact last name' })
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @Field()
  @ApiProperty({ description: 'Email address' })
  @IsString()
  email!: string;

  @Field()
  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @Length(1, 50)
  phone!: string;

  @Field()
  @ApiProperty({ description: 'Password' })
  @IsString()
  @Length(6, 100)
  password!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Tax ID or EIN' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxId?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Industry' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  industry?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Billing address line 1' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  billingAddressLine1?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Billing city' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  billingCity?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Billing state' })
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
}

@InputType()
export class PortalOrderItemDto {
  @Field()
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Quantity to order' })
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Special instructions for this item' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  specialInstructions?: string;
}

@InputType()
export class CreatePortalOrderDto {
  @Field(() => [PortalOrderItemDto])
  @ApiProperty({ description: 'Order items', type: [PortalOrderItemDto] })
  @IsArray()
  @Type(() => PortalOrderItemDto)
  items!: PortalOrderItemDto[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Requested delivery date' })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Shipping method preference' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingMethod?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Purchase order number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  purchaseOrderNumber?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Shipping address (if different from default)' })
  @IsOptional()
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Special instructions for the order' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  specialInstructions?: string;
}

export class PortalOrderQueryDto {
  @ApiPropertyOptional({ description: 'Order status filter', enum: PortalOrderStatus })
  @IsOptional()
  @IsEnum(PortalOrderStatus)
  status?: PortalOrderStatus;

  @ApiPropertyOptional({ description: 'Order date from' })
  @IsOptional()
  @IsDateString()
  orderDateFrom?: string;

  @ApiPropertyOptional({ description: 'Order date to' })
  @IsOptional()
  @IsDateString()
  orderDateTo?: string;

  @ApiPropertyOptional({ description: 'Search term for order number or product' })
  @IsOptional()
  @IsString()
  search?: string;

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

export class ProductCatalogQueryDto {
  @ApiPropertyOptional({ description: 'Search term for product name or SKU' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Product category filter' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Minimum price filter' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price filter' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Only show products in stock' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  inStockOnly?: boolean;

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

  @ApiPropertyOptional({ description: 'Sort field', default: 'name' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'name';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}

@InputType()
export class UpdateAccountInfoDto {
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
  firstName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Primary contact last name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  phone?: string;

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
  @ApiPropertyOptional({ description: 'Billing state' })
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
  @ApiPropertyOptional({ description: 'Shipping state' })
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
}

@InputType()
export class ChangePasswordDto {
  @Field()
  @ApiProperty({ description: 'Current password' })
  @IsString()
  currentPassword!: string;

  @Field()
  @ApiProperty({ description: 'New password' })
  @IsString()
  @Length(6, 100)
  newPassword!: string;

  @Field()
  @ApiProperty({ description: 'Confirm new password' })
  @IsString()
  @Length(6, 100)
  confirmPassword!: string;
}

export class InvoiceQueryDto {
  @ApiPropertyOptional({ description: 'Invoice status filter' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Invoice date from' })
  @IsOptional()
  @IsDateString()
  invoiceDateFrom?: string;

  @ApiPropertyOptional({ description: 'Invoice date to' })
  @IsOptional()
  @IsDateString()
  invoiceDateTo?: string;

  @ApiPropertyOptional({ description: 'Due date from' })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Due date to' })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @ApiPropertyOptional({ description: 'Search term for invoice number' })
  @IsOptional()
  @IsString()
  search?: string;

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

  @ApiPropertyOptional({ description: 'Sort field', default: 'invoiceDate' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'invoiceDate';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}