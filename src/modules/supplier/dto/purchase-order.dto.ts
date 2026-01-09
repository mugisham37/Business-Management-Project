import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsObject,
  IsDateString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
  IsDecimal,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT_TO_SUPPLIER = 'sent_to_supplier',
  ACKNOWLEDGED = 'acknowledged',
  PARTIALLY_RECEIVED = 'partially_received',
  FULLY_RECEIVED = 'fully_received',
  CANCELLED = 'cancelled',
  CLOSED = 'closed',
}

export enum PurchaseOrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum ReceiptStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  COMPLETE = 'complete',
  OVER_RECEIVED = 'over_received',
}

export enum InvoiceMatchStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  VARIANCE = 'variance',
  DISPUTED = 'disputed',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  PAID = 'paid',
  OVERDUE = 'overdue',
  DISPUTED = 'disputed',
}

// Purchase Order Item DTO
export class CreatePurchaseOrderItemDto {
  @ApiPropertyOptional({ description: 'Product ID' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ description: 'Item description' })
  @IsString()
  @Length(1, 255)
  itemDescription: string;

  @ApiPropertyOptional({ description: 'SKU' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @ApiProperty({ description: 'Quantity ordered' })
  @IsNumber()
  @Min(0.001)
  quantityOrdered: number;

  @ApiProperty({ description: 'Unit price' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Specifications', type: Object })
  @IsOptional()
  @IsObject()
  specifications?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Requested delivery date' })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Custom fields', type: Object })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

export class UpdatePurchaseOrderItemDto {
  @ApiPropertyOptional({ description: 'Item description' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  itemDescription?: string;

  @ApiPropertyOptional({ description: 'SKU' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @ApiPropertyOptional({ description: 'Quantity ordered' })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantityOrdered?: number;

  @ApiPropertyOptional({ description: 'Unit price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Specifications', type: Object })
  @IsOptional()
  @IsObject()
  specifications?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Requested delivery date' })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Custom fields', type: Object })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

// Address DTO
export class AddressDto {
  @ApiPropertyOptional({ description: 'Address line 1' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine1?: string;

  @ApiPropertyOptional({ description: 'Address line 2' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @ApiPropertyOptional({ description: 'State or province' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  state?: string;

  @ApiPropertyOptional({ description: 'Postal code' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;
}

// Purchase Order DTO
export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({ enum: PurchaseOrderPriority, description: 'Priority' })
  @IsOptional()
  @IsEnum(PurchaseOrderPriority)
  priority?: PurchaseOrderPriority;

  @ApiPropertyOptional({ description: 'Requested delivery date' })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @ApiPropertyOptional({ description: 'Expected delivery date' })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({ description: 'Delivery address', type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  deliveryAddress?: AddressDto;

  @ApiPropertyOptional({ description: 'Billing address', type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @ApiPropertyOptional({ description: 'Shipping method' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingMethod?: string;

  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Delivery terms' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  deliveryTerms?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional({ description: 'Supplier notes' })
  @IsOptional()
  @IsString()
  supplierNotes?: string;

  @ApiPropertyOptional({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Tax amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ description: 'Shipping amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Custom fields', type: Object })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Purchase order items', type: [CreatePurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional({ enum: PurchaseOrderStatus, description: 'Status' })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({ enum: PurchaseOrderPriority, description: 'Priority' })
  @IsOptional()
  @IsEnum(PurchaseOrderPriority)
  priority?: PurchaseOrderPriority;

  @ApiPropertyOptional({ description: 'Requested delivery date' })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @ApiPropertyOptional({ description: 'Expected delivery date' })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({ description: 'Actual delivery date' })
  @IsOptional()
  @IsDateString()
  actualDeliveryDate?: string;

  @ApiPropertyOptional({ description: 'Delivery address', type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  deliveryAddress?: AddressDto;

  @ApiPropertyOptional({ description: 'Billing address', type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @ApiPropertyOptional({ description: 'Shipping method' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingMethod?: string;

  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Delivery terms' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  deliveryTerms?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional({ description: 'Supplier notes' })
  @IsOptional()
  @IsString()
  supplierNotes?: string;

  @ApiPropertyOptional({ description: 'Tax amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ description: 'Shipping amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Tracking number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Custom fields', type: Object })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

// Approval DTO
export class CreateApprovalDto {
  @ApiProperty({ description: 'Purchase order ID' })
  @IsUUID()
  purchaseOrderId: string;

  @ApiProperty({ description: 'Approver ID' })
  @IsUUID()
  approverId: string;

  @ApiProperty({ description: 'Approval level' })
  @IsNumber()
  @Min(1)
  approvalLevel: number;

  @ApiPropertyOptional({ description: 'Approval rule' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  approvalRule?: string;
}

export class ApprovalResponseDto {
  @ApiProperty({ enum: ApprovalStatus, description: 'Approval status' })
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @ApiPropertyOptional({ description: 'Comments' })
  @IsOptional()
  @IsString()
  comments?: string;
}

// Receipt DTO
export class CreateReceiptItemDto {
  @ApiProperty({ description: 'Purchase order item ID' })
  @IsUUID()
  purchaseOrderItemId: string;

  @ApiProperty({ description: 'Quantity received' })
  @IsNumber()
  @Min(0)
  quantityReceived: number;

  @ApiProperty({ description: 'Quantity accepted' })
  @IsNumber()
  @Min(0)
  quantityAccepted: number;

  @ApiPropertyOptional({ description: 'Quantity rejected' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityRejected?: number;

  @ApiPropertyOptional({ description: 'Condition notes' })
  @IsOptional()
  @IsString()
  conditionNotes?: string;

  @ApiPropertyOptional({ description: 'Rejection reason' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Location ID' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Bin location' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  binLocation?: string;
}

export class CreateReceiptDto {
  @ApiProperty({ description: 'Purchase order ID' })
  @IsUUID()
  purchaseOrderId: string;

  @ApiPropertyOptional({ description: 'Receipt date' })
  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @ApiPropertyOptional({ description: 'Delivery note' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  deliveryNote?: string;

  @ApiPropertyOptional({ description: 'Carrier name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  carrierName?: string;

  @ApiPropertyOptional({ description: 'Tracking number' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Quality check performed' })
  @IsOptional()
  @IsBoolean()
  qualityCheck?: boolean;

  @ApiPropertyOptional({ description: 'Quality notes' })
  @IsOptional()
  @IsString()
  qualityNotes?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Attachments', type: [Object] })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @ApiProperty({ description: 'Receipt items', type: [CreateReceiptItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptItemDto)
  items: CreateReceiptItemDto[];
}

// Invoice DTO
export class CreateInvoiceItemDto {
  @ApiPropertyOptional({ description: 'Purchase order item ID' })
  @IsOptional()
  @IsUUID()
  purchaseOrderItemId?: string;

  @ApiProperty({ description: 'Description' })
  @IsString()
  @Length(1, 255)
  description: string;

  @ApiPropertyOptional({ description: 'SKU' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ description: 'Unit price' })
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Purchase order ID' })
  @IsUUID()
  purchaseOrderId: string;

  @ApiProperty({ description: 'Invoice number' })
  @IsString()
  @Length(1, 50)
  invoiceNumber: string;

  @ApiProperty({ description: 'Invoice date' })
  @IsDateString()
  invoiceDate: string;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ description: 'Invoice amount' })
  @IsNumber()
  @Min(0)
  invoiceAmount: number;

  @ApiPropertyOptional({ description: 'Tax amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Attachments', type: [Object] })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @ApiProperty({ description: 'Invoice items', type: [CreateInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}

// Query DTOs
export class PurchaseOrderQueryDto {
  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PurchaseOrderStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: PurchaseOrderPriority, description: 'Filter by priority' })
  @IsOptional()
  @IsEnum(PurchaseOrderPriority)
  priority?: PurchaseOrderPriority;

  @ApiPropertyOptional({ description: 'Filter by order date from' })
  @IsOptional()
  @IsDateString()
  orderDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by order date to' })
  @IsOptional()
  @IsDateString()
  orderDateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by delivery date from' })
  @IsOptional()
  @IsDateString()
  deliveryDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by delivery date to' })
  @IsOptional()
  @IsDateString()
  deliveryDateTo?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'orderDate' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'orderDate';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// Response DTOs
export class PurchaseOrderResponseDto {
  @ApiProperty({ description: 'Purchase order ID' })
  id: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

  @ApiProperty({ description: 'PO number' })
  poNumber: string;

  @ApiProperty({ description: 'Supplier ID' })
  supplierId: string;

  @ApiProperty({ enum: PurchaseOrderStatus, description: 'Status' })
  status: PurchaseOrderStatus;

  @ApiProperty({ enum: PurchaseOrderPriority, description: 'Priority' })
  priority: PurchaseOrderPriority;

  @ApiProperty({ description: 'Order date' })
  orderDate: Date;

  @ApiPropertyOptional({ description: 'Requested delivery date' })
  requestedDeliveryDate?: Date;

  @ApiPropertyOptional({ description: 'Expected delivery date' })
  expectedDeliveryDate?: Date;

  @ApiPropertyOptional({ description: 'Actual delivery date' })
  actualDeliveryDate?: Date;

  @ApiProperty({ description: 'Subtotal' })
  subtotal: number;

  @ApiProperty({ description: 'Tax amount' })
  taxAmount: number;

  @ApiProperty({ description: 'Shipping amount' })
  shippingAmount: number;

  @ApiProperty({ description: 'Discount amount' })
  discountAmount: number;

  @ApiProperty({ description: 'Total amount' })
  totalAmount: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  updatedBy?: string;

  @ApiProperty({ description: 'Is active' })
  isActive: boolean;
}