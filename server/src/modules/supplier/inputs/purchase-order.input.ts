import { InputType, Field, ID, Float, registerEnumType } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsUUID,
  IsDateString,
  IsBoolean,
  Length,
  Min,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GraphQLJSON } from 'graphql-scalars';

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

registerEnumType(PurchaseOrderStatus, { name: 'PurchaseOrderStatus' });
registerEnumType(PurchaseOrderPriority, { name: 'PurchaseOrderPriority' });
registerEnumType(ApprovalStatus, { name: 'ApprovalStatus' });
registerEnumType(ReceiptStatus, { name: 'ReceiptStatus' });
registerEnumType(InvoiceMatchStatus, { name: 'InvoiceMatchStatus' });
registerEnumType(PaymentStatus, { name: 'PaymentStatus' });

// Address Input
@InputType()
export class AddressInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine1?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine2?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  state?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  postalCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;
}

// Purchase Order Item Inputs
@InputType()
export class CreatePurchaseOrderItemInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  itemDescription!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0.001)
  quantityOrdered!: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  uom?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  specifications?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  customFields?: Record<string, any>;
}

@InputType()
export class UpdatePurchaseOrderItemInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  itemDescription?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sku?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantityOrdered?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  uom?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  specifications?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

// Purchase Order Inputs
@InputType()
export class CreatePurchaseOrderInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @Field(() => PurchaseOrderPriority, { nullable: true, defaultValue: PurchaseOrderPriority.NORMAL })
  @IsOptional()
  @IsEnum(PurchaseOrderPriority)
  priority?: PurchaseOrderPriority;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @Field(() => AddressInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInput)
  deliveryAddress?: AddressInput;

  @Field(() => AddressInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInput)
  billingAddress?: AddressInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingMethod?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  paymentTerms?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  deliveryTerms?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  supplierNotes?: string;

  @Field({ nullable: true, defaultValue: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  customFields?: Record<string, any>;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field(() => [CreatePurchaseOrderItemInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemInput)
  items!: CreatePurchaseOrderItemInput[];
}

@InputType()
export class UpdatePurchaseOrderInput {
  @Field(() => PurchaseOrderStatus, { nullable: true })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @Field(() => PurchaseOrderPriority, { nullable: true })
  @IsOptional()
  @IsEnum(PurchaseOrderPriority)
  priority?: PurchaseOrderPriority;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  actualDeliveryDate?: string;

  @Field(() => AddressInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInput)
  deliveryAddress?: AddressInput;

  @Field(() => AddressInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInput)
  billingAddress?: AddressInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  deliveryTerms?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  supplierNotes?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  customFields?: Record<string, any>;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

// Approval Inputs
@InputType()
export class CreateApprovalInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  approverId!: string;

  @Field(() => Float)
  @IsNumber()
  @Min(1)
  approvalLevel!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  approvalRule?: string;
}

@InputType()
export class ApprovalResponseInput {
  @Field(() => ApprovalStatus)
  @IsEnum(ApprovalStatus)
  status!: ApprovalStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  comments?: string;
}

// Receipt Inputs
@InputType()
export class CreateReceiptItemInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderItemId!: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  quantityReceived!: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  quantityAccepted!: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityRejected?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  conditionNotes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  binLocation?: string;
}

@InputType()
export class CreateReceiptInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  deliveryNote?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  carrierName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  trackingNumber?: string;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  qualityCheck?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  qualityNotes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => [GraphQLJSON], { nullable: true })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @Field(() => [CreateReceiptItemInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptItemInput)
  items!: CreateReceiptItemInput[];
}

// Invoice Inputs
@InputType()
export class CreateInvoiceItemInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  purchaseOrderItemId?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  description!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

@InputType()
export class CreateInvoiceInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  invoiceNumber!: string;

  @Field()
  @IsDateString()
  invoiceDate!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  invoiceAmount!: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => [GraphQLJSON], { nullable: true })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @Field(() => [CreateInvoiceItemInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemInput)
  items!: CreateInvoiceItemInput[];
}

// Filter Inputs
@InputType()
export class PurchaseOrderFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => PurchaseOrderStatus, { nullable: true })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Field(() => PurchaseOrderPriority, { nullable: true })
  @IsOptional()
  @IsEnum(PurchaseOrderPriority)
  priority?: PurchaseOrderPriority;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  orderDateFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  orderDateTo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  deliveryDateFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  deliveryDateTo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sortOrder?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

