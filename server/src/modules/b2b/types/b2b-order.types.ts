import { ObjectType, Field, ID, Float, Int, InputType, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * B2B Order Status Enum
 */
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

registerEnumType(B2BOrderStatus, {
  name: 'B2BOrderStatus',
  description: 'Status of a B2B order',
});

/**
 * Payment Terms Enum
 */
export enum PaymentTerms {
  NET_15 = 'net_15',
  NET_30 = 'net_30',
  NET_45 = 'net_45',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  COD = 'cod',
  PREPAID = 'prepaid',
}

registerEnumType(PaymentTerms, {
  name: 'PaymentTerms',
  description: 'Payment terms for B2B orders',
});

/**
 * Shipping Method Enum
 */
export enum ShippingMethod {
  STANDARD = 'standard',
  EXPRESS = 'express',
  OVERNIGHT = 'overnight',
  PICKUP = 'pickup',
  FREIGHT = 'freight',
}

registerEnumType(ShippingMethod, {
  name: 'ShippingMethod',
  description: 'Available shipping methods',
});

/**
 * Order Priority Enum
 */
export enum OrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

registerEnumType(OrderPriority, {
  name: 'OrderPriority',
  description: 'Order priority levels',
});

/**
 * Address Input Type
 */
@InputType()
export class AddressInput {
  @Field()
  line1!: string;

  @Field({ nullable: true })
  line2?: string;

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field()
  postalCode!: string;

  @Field()
  country!: string;

  @Field({ nullable: true })
  company?: string;

  @Field({ nullable: true })
  contactName?: string;

  @Field({ nullable: true })
  phone?: string;
}

/**
 * Address Output Type
 */
@ObjectType()
export class AddressType {
  @Field()
  line1!: string;

  @Field({ nullable: true })
  line2?: string;

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field()
  postalCode!: string;

  @Field()
  country!: string;

  @Field({ nullable: true })
  company?: string;

  @Field({ nullable: true })
  contactName?: string;

  @Field({ nullable: true })
  phone?: string;
}

/**
 * B2B Order Item Input Type
 */
@InputType()
export class B2BOrderItemInput {
  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  quantity!: number;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  unitPrice?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

/**
 * B2B Order Item Output Type
 */
@ObjectType()
export class B2BOrderItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => ID)
  productId!: string;

  @Field()
  sku!: string;

  @Field()
  productName!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Float)
  listPrice!: number;

  @Field(() => Float)
  discountPercentage!: number;

  @Field(() => Float)
  discountAmount!: number;

  @Field(() => Float)
  lineTotal!: number;

  @Field(() => Float)
  quantityShipped!: number;

  @Field(() => Float)
  quantityBackordered!: number;

  @Field(() => GraphQLJSON)
  metadata!: Record<string, any>;

  // Resolved fields
  @Field({ nullable: true })
  product?: any;

  @Field(() => Float)
  availableQuantity?: number;

  @Field(() => Boolean)
  isBackordered?: boolean;

  @Field(() => Float)
  totalSavings?: number;
}

/**
 * Create B2B Order Input Type
 */
@InputType()
export class CreateB2BOrderInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => ID, { nullable: true })
  quoteId?: string;

  @Field(() => [B2BOrderItemInput])
  items!: B2BOrderItemInput[];

  @Field(() => AddressInput)
  shippingAddress!: AddressInput;

  @Field(() => AddressInput)
  billingAddress!: AddressInput;

  @Field(() => PaymentTerms)
  paymentTerms!: PaymentTerms;

  @Field(() => ShippingMethod, { nullable: true })
  shippingMethod?: ShippingMethod;

  @Field(() => OrderPriority, { defaultValue: OrderPriority.NORMAL })
  priority!: OrderPriority;

  @Field({ nullable: true })
  requestedDeliveryDate?: Date;

  @Field({ nullable: true })
  specialInstructions?: string;

  @Field({ nullable: true })
  internalNotes?: string;

  @Field(() => Float, { nullable: true })
  discountAmount?: number;

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

/**
 * Update B2B Order Input Type
 */
@InputType()
export class UpdateB2BOrderInput {
  @Field(() => B2BOrderStatus, { nullable: true })
  status?: B2BOrderStatus;

  @Field(() => [B2BOrderItemInput], { nullable: true })
  items?: B2BOrderItemInput[];

  @Field(() => AddressInput, { nullable: true })
  shippingAddress?: AddressInput;

  @Field(() => AddressInput, { nullable: true })
  billingAddress?: AddressInput;

  @Field(() => PaymentTerms, { nullable: true })
  paymentTerms?: PaymentTerms;

  @Field(() => ShippingMethod, { nullable: true })
  shippingMethod?: ShippingMethod;

  @Field(() => OrderPriority, { nullable: true })
  priority?: OrderPriority;

  @Field({ nullable: true })
  requestedDeliveryDate?: Date;

  @Field({ nullable: true })
  confirmedDeliveryDate?: Date;

  @Field({ nullable: true })
  specialInstructions?: string;

  @Field({ nullable: true })
  internalNotes?: string;

  @Field(() => Float, { nullable: true })
  discountAmount?: number;

  @Field({ nullable: true })
  trackingNumber?: string;

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

/**
 * B2B Order Query Input Type
 */
@InputType()
export class B2BOrderQueryInput {
  @Field(() => ID, { nullable: true })
  customerId?: string;

  @Field(() => B2BOrderStatus, { nullable: true })
  status?: B2BOrderStatus;

  @Field(() => [B2BOrderStatus], { nullable: true })
  statuses?: B2BOrderStatus[];

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field({ nullable: true })
  orderDateFrom?: Date;

  @Field({ nullable: true })
  orderDateTo?: Date;

  @Field({ nullable: true })
  deliveryDateFrom?: Date;

  @Field({ nullable: true })
  deliveryDateTo?: Date;

  @Field(() => Float, { nullable: true })
  minAmount?: number;

  @Field(() => Float, { nullable: true })
  maxAmount?: number;

  @Field(() => OrderPriority, { nullable: true })
  priority?: OrderPriority;

  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  sortBy?: string;

  @Field({ nullable: true })
  sortOrder?: string;

  @Field(() => Int, { defaultValue: 1 })
  page!: number;

  @Field(() => Int, { defaultValue: 20 })
  limit!: number;
}

/**
 * Approve Order Input Type
 */
@InputType()
export class ApproveOrderInput {
  @Field({ nullable: true })
  approvalNotes?: string;

  @Field({ nullable: true })
  confirmedDeliveryDate?: Date;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

/**
 * Reject Order Input Type
 */
@InputType()
export class RejectOrderInput {
  @Field()
  rejectionReason!: string;

  @Field({ nullable: true })
  alternativeOptions?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

/**
 * Ship Order Input Type
 */
@InputType()
export class ShipOrderInput {
  @Field()
  trackingNumber!: string;

  @Field(() => ShippingMethod)
  shippingMethod!: ShippingMethod;

  @Field({ nullable: true })
  shippedDate?: Date;

  @Field({ nullable: true })
  estimatedDeliveryDate?: Date;

  @Field({ nullable: true })
  shippingNotes?: string;

  @Field(() => [ShipOrderItemInput], { nullable: true })
  items?: ShipOrderItemInput[];
}

/**
 * Ship Order Item Input Type
 */
@InputType()
export class ShipOrderItemInput {
  @Field(() => ID)
  orderItemId!: string;

  @Field(() => Float)
  quantityShipped!: number;

  @Field({ nullable: true })
  serialNumbers?: string;
}

/**
 * B2B Order Output Type
 */
@ObjectType()
export class B2BOrderType {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  orderNumber!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => ID, { nullable: true })
  quoteId?: string;

  @Field(() => B2BOrderStatus)
  status!: B2BOrderStatus;

  @Field()
  orderDate!: Date;

  @Field({ nullable: true })
  requestedDeliveryDate?: Date;

  @Field({ nullable: true })
  confirmedDeliveryDate?: Date;

  @Field(() => Float)
  subtotal!: number;

  @Field(() => Float)
  taxAmount!: number;

  @Field(() => Float)
  shippingAmount!: number;

  @Field(() => Float)
  discountAmount!: number;

  @Field(() => Float)
  totalAmount!: number;

  @Field(() => PaymentTerms)
  paymentTerms!: PaymentTerms;

  @Field({ nullable: true })
  paymentDueDate?: Date;

  @Field(() => ShippingMethod, { nullable: true })
  shippingMethod?: ShippingMethod;

  @Field({ nullable: true })
  trackingNumber?: string;

  @Field(() => AddressType)
  shippingAddress!: AddressType;

  @Field(() => AddressType)
  billingAddress!: AddressType;

  @Field(() => Boolean)
  requiresApproval!: boolean;

  @Field(() => ID, { nullable: true })
  approvedBy?: string;

  @Field({ nullable: true })
  approvedAt?: Date;

  @Field({ nullable: true })
  approvalNotes?: string;

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field({ nullable: true })
  specialInstructions?: string;

  @Field({ nullable: true })
  internalNotes?: string;

  @Field(() => OrderPriority)
  priority!: OrderPriority;

  @Field(() => [B2BOrderItemType])
  items!: B2BOrderItemType[];

  @Field(() => GraphQLJSON)
  metadata!: Record<string, any>;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  // Resolved fields
  @Field({ nullable: true })
  customer?: any;

  @Field({ nullable: true })
  salesRep?: any;

  @Field({ nullable: true })
  accountManager?: any;

  @Field({ nullable: true })
  approver?: any;

  @Field({ nullable: true })
  quote?: any;

  @Field(() => Boolean)
  canBeApproved?: boolean;

  @Field(() => Boolean)
  canBeRejected?: boolean;

  @Field(() => Boolean)
  canBeCancelled?: boolean;

  @Field(() => Boolean)
  canBeShipped?: boolean;

  @Field(() => Boolean)
  isOverdue?: boolean;

  @Field(() => Int)
  daysUntilDue?: number;

  @Field(() => Float)
  totalSavings?: number;

  @Field(() => Float)
  fulfillmentPercentage?: number;

  @Field(() => [String])
  availableActions?: string[];
}

/**
 * B2B Orders Response Type
 */
@ObjectType()
export class B2BOrdersResponse {
  @Field(() => [B2BOrderType])
  orders!: B2BOrderType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int, { nullable: true })
  page?: number;

  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field(() => Boolean, { nullable: true })
  hasNextPage?: boolean;

  @Field(() => Boolean, { nullable: true })
  hasPreviousPage?: boolean;
}

/**
 * Order Approval Response Type
 */
@ObjectType()
export class OrderApprovalResponse {
  @Field(() => B2BOrderType)
  order!: B2BOrderType;

  @Field()
  message!: string;

  @Field({ nullable: true })
  workflowId?: string;
}

/**
 * Order Shipping Response Type
 */
@ObjectType()
export class OrderShippingResponse {
  @Field(() => B2BOrderType)
  order!: B2BOrderType;

  @Field()
  message!: string;

  @Field()
  trackingNumber!: string;

  @Field({ nullable: true })
  estimatedDeliveryDate?: Date;
}

/**
 * Order Analytics Type
 */
@ObjectType()
export class OrderAnalyticsType {
  @Field(() => Int)
  totalOrders!: number;

  @Field(() => Float)
  totalRevenue!: number;

  @Field(() => Float)
  averageOrderValue!: number;

  @Field(() => Int)
  pendingApprovalCount!: number;

  @Field(() => Int)
  processingCount!: number;

  @Field(() => Int)
  shippedCount!: number;

  @Field(() => Int)
  completedCount!: number;

  @Field(() => Float)
  fulfillmentRate!: number;

  @Field(() => Float)
  onTimeDeliveryRate!: number;

  @Field(() => GraphQLJSON)
  statusBreakdown!: Record<string, number>;

  @Field(() => GraphQLJSON)
  monthlyTrends!: Record<string, any>;
}

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field()
  postalCode!: string;

  @Field()
  country!: string;
}

/**
 * Address Output Type
 */
@ObjectType()
export class AddressType {
  @Field()
  line1!: string;

  @Field({ nullable: true })
  line2?: string;

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field()
  postalCode!: string;

  @Field()
  country!: string;
}

/**
 * B2B Order Item Input Type
 */
@InputType()
export class B2BOrderItemInput {
  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  quantity!: number;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  metadata?: string; // JSON string
}

/**
 * B2B Order Item Output Type
 */
@ObjectType()
export class B2BOrderItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Float)
  lineTotal!: number;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  metadata?: string; // JSON string

  // Field resolvers
  @Field({ nullable: true })
  product?: any; // Will be resolved via DataLoader
}

/**
 * Create B2B Order Input Type
 */
@InputType()
export class CreateB2BOrderInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => ID, { nullable: true })
  quoteId?: string;

  @Field({ nullable: true })
  orderDate?: Date;

  @Field({ nullable: true })
  requestedDeliveryDate?: Date;

  @Field(() => PaymentTerms)
  paymentTerms!: PaymentTerms;

  @Field({ nullable: true })
  shippingMethod?: string;

  @Field(() => AddressInput)
  shippingAddress!: AddressInput;

  @Field(() => AddressInput)
  billingAddress!: AddressInput;

  @Field(() => [B2BOrderItemInput])
  items!: B2BOrderItemInput[];

  @Field(() => Float, { nullable: true })
  discountAmount?: number;

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field({ nullable: true })
  specialInstructions?: string;

  @Field({ nullable: true })
  internalNotes?: string;

  @Field({ nullable: true })
  metadata?: string; // JSON string
}

/**
 * Update B2B Order Input Type
 */
@InputType()
export class UpdateB2BOrderInput {
  @Field(() => B2BOrderStatus, { nullable: true })
  status?: B2BOrderStatus;

  @Field({ nullable: true })
  requestedDeliveryDate?: Date;

  @Field({ nullable: true })
  confirmedDeliveryDate?: Date;

  @Field({ nullable: true })
  shippingMethod?: string;

  @Field({ nullable: true })
  trackingNumber?: string;

  @Field(() => Float, { nullable: true })
  discountAmount?: number;

  @Field({ nullable: true })
  specialInstructions?: string;

  @Field({ nullable: true })
  internalNotes?: string;

  @Field({ nullable: true })
  metadata?: string; // JSON string
}

/**
 * B2B Order Query Input Type
 */
@InputType()
export class B2BOrderQueryInput {
  @Field({ nullable: true })
  search?: string;

  @Field(() => [B2BOrderStatus], { nullable: true })
  status?: B2BOrderStatus[];

  @Field(() => ID, { nullable: true })
  customerId?: string;

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field(() => Float, { nullable: true })
  minAmount?: number;

  @Field(() => Float, { nullable: true })
  maxAmount?: number;

  @Field({ nullable: true })
  requiresApproval?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;

  @Field({ nullable: true, defaultValue: 'orderDate' })
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'desc' })
  sortOrder?: string;
}

/**
 * Approve Order Input Type
 */
@InputType()
export class ApproveOrderInput {
  @Field()
  approvalNotes!: string;
}

/**
 * Reject Order Input Type
 */
@InputType()
export class RejectOrderInput {
  @Field()
  rejectionReason!: string;
}

/**
 * B2B Order Output Type
 */
@ObjectType()
export class B2BOrderType {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  orderNumber!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => B2BOrderStatus)
  status!: B2BOrderStatus;

  @Field({ nullable: true })
  orderDate?: Date;

  @Field({ nullable: true })
  requestedDeliveryDate?: Date;

  @Field({ nullable: true })
  confirmedDeliveryDate?: Date;

  @Field(() => PaymentTerms)
  paymentTerms!: PaymentTerms;

  @Field({ nullable: true })
  shippingMethod?: string;

  @Field({ nullable: true })
  trackingNumber?: string;

  @Field(() => AddressType)
  shippingAddress!: AddressType;

  @Field(() => AddressType)
  billingAddress!: AddressType;

  @Field(() => [B2BOrderItemType])
  items!: B2BOrderItemType[];

  @Field(() => Float)
  subtotal!: number;

  @Field(() => Float)
  taxAmount!: number;

  @Field(() => Float)
  shippingAmount!: number;

  @Field(() => Float, { nullable: true })
  discountAmount?: number;

  @Field(() => Float)
  totalAmount!: number;

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field({ nullable: true })
  specialInstructions?: string;

  @Field({ nullable: true })
  internalNotes?: string;

  @Field({ nullable: true })
  approvalNotes?: string;

  @Field({ nullable: true })
  rejectionReason?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  metadata?: string; // JSON string

  // Field resolvers
  @Field({ nullable: true })
  customer?: any; // Will be resolved via DataLoader

  @Field({ nullable: true })
  salesRep?: any; // Will be resolved via DataLoader

  @Field({ nullable: true })
  accountManager?: any; // Will be resolved via DataLoader

  @Field({ nullable: true })
  quote?: any; // Will be resolved via DataLoader if converted from quote
}

/**
 * B2B Orders List Response Type
 */
@ObjectType()
export class B2BOrdersResponse {
  @Field(() => [B2BOrderType])
  orders!: B2BOrderType[];

  @Field(() => Int)
  total!: number;
}

/**
 * Order Approval Response Type
 */
@ObjectType()
export class OrderApprovalResponse {
  @Field(() => B2BOrderType)
  order!: B2BOrderType;

  @Field()
  message!: string;
}