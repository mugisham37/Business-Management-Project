import { ObjectType, Field, ID, Float, InputType, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity, Edge, Connection } from '../../../common/graphql/base.types';
import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsEnum, 
  IsUUID,
  IsArray,
  ValidateNested,
  IsDate,
  Min,
  Length,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

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

registerEnumType(PurchaseOrderStatus, { name: 'PurchaseOrderStatus' });

// Object Types
@ObjectType('PurchaseOrder')
export class PurchaseOrderType extends BaseEntity {
  @Field()
  @ApiProperty({ description: 'Purchase order number' })
  poNumber!: string;

  @Field(() => ID)
  @ApiProperty({ description: 'Supplier ID' })
  supplierId!: string;

  @Field(() => PurchaseOrderStatus)
  @ApiProperty({ description: 'Purchase order status', enum: PurchaseOrderStatus })
  status!: PurchaseOrderStatus;

  @Field()
  @ApiProperty({ description: 'Order date' })
  orderDate!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Expected delivery date', required: false })
  expectedDeliveryDate?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Requested delivery date', required: false })
  requestedDeliveryDate?: Date;

  @Field(() => Float)
  @ApiProperty({ description: 'Subtotal amount' })
  subtotal!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Tax amount' })
  taxAmount!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Shipping amount' })
  shippingAmount!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Total amount' })
  totalAmount!: number;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Currency code', required: false })
  currency?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Payment terms', required: false })
  paymentTerms?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Shipping method', required: false })
  shippingMethod?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Delivery terms', required: false })
  deliveryTerms?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Notes', required: false })
  notes?: string;
}

@ObjectType('PurchaseOrderItem')
export class PurchaseOrderItemType {
  @Field(() => ID)
  @ApiProperty({ description: 'Item ID' })
  id!: string;

  @Field(() => ID)
  @ApiProperty({ description: 'Purchase order ID' })
  purchaseOrderId!: string;

  @Field(() => ID, { nullable: true })
  @ApiProperty({ description: 'Product ID', required: false })
  productId?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'SKU', required: false })
  sku?: string;

  @Field()
  @ApiProperty({ description: 'Item description' })
  itemDescription!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Quantity ordered' })
  quantityOrdered!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Unit price' })
  unitPrice!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Line total' })
  lineTotal!: number;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Quantity received', required: false })
  quantityReceived?: number;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Unit of measure', required: false })
  uom?: string;
}

// Input Types
@InputType()
export class PurchaseOrderItemInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sku?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  itemDescription!: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0.01)
  quantityOrdered!: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  uom?: string;
}

@InputType()
export class CreatePurchaseOrderInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedDeliveryDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  requestedDeliveryDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  deliveryTerms?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => [PurchaseOrderItemInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemInput)
  items!: PurchaseOrderItemInput[];
}

@InputType()
export class UpdatePurchaseOrderInput {
  @Field(() => PurchaseOrderStatus, { nullable: true })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedDeliveryDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  requestedDeliveryDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

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

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  orderDateFrom?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  orderDateTo?: Date;
}

// Connection Types
@ObjectType()
export class PurchaseOrderEdge extends Edge<PurchaseOrderType> {
  @Field(() => PurchaseOrderType)
  node!: PurchaseOrderType;
}

@ObjectType()
export class PurchaseOrderConnection extends Connection<PurchaseOrderType> {
  @Field(() => [PurchaseOrderEdge])
  edges!: PurchaseOrderEdge[];
}
