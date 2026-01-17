import { ObjectType, Field, ID, Float, Int, InputType, registerEnumType } from '@nestjs/graphql';
import { AddressInput, AddressType } from './b2b-order.types';

/**
 * Portal Order Status Enum
 */
export enum PortalOrderStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

registerEnumType(PortalOrderStatus, {
  name: 'PortalOrderStatus',
  description: 'Status of a portal order',
});

/**
 * Customer Portal Login Input Type
 */
@InputType()
export class CustomerPortalLoginInput {
  @Field()
  email!: string;

  @Field()
  password!: string;
}

/**
 * Customer Portal Registration Input Type
 */
@InputType()
export class CustomerPortalRegistrationInput {
  @Field()
  companyName!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field()
  phone!: string;

  @Field()
  password!: string;

  @Field({ nullable: true })
  taxId?: string;

  @Field({ nullable: true })
  industry?: string;

  @Field({ nullable: true })
  billingAddressLine1?: string;

  @Field({ nullable: true })
  billingCity?: string;

  @Field({ nullable: true })
  billingState?: string;

  @Field({ nullable: true })
  billingPostalCode?: string;

  @Field({ nullable: true })
  billingCountry?: string;
}

/**
 * Portal Order Item Input Type
 */
@InputType()
export class PortalOrderItemInput {
  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  quantity!: number;

  @Field({ nullable: true })
  specialInstructions?: string;
}

/**
 * Create Portal Order Input Type
 */
@InputType()
export class CreatePortalOrderInput {
  @Field(() => [PortalOrderItemInput])
  items!: PortalOrderItemInput[];

  @Field({ nullable: true })
  requestedDeliveryDate?: Date;

  @Field({ nullable: true })
  shippingMethod?: string;

  @Field({ nullable: true })
  purchaseOrderNumber?: string;

  @Field(() => AddressInput, { nullable: true })
  shippingAddress?: AddressInput;

  @Field({ nullable: true })
  specialInstructions?: string;
}

/**
 * Portal Order Query Input Type
 */
@InputType()
export class PortalOrderQueryInput {
  @Field(() => PortalOrderStatus, { nullable: true })
  status?: PortalOrderStatus;

  @Field({ nullable: true })
  orderDateFrom?: Date;

  @Field({ nullable: true })
  orderDateTo?: Date;

  @Field({ nullable: true })
  search?: string;

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
 * Product Catalog Query Input Type
 */
@InputType()
export class ProductCatalogQueryInput {
  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  category?: string;

  @Field(() => Float, { nullable: true })
  minPrice?: number;

  @Field(() => Float, { nullable: true })
  maxPrice?: number;

  @Field({ nullable: true })
  inStockOnly?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;

  @Field({ nullable: true, defaultValue: 'name' })
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'asc' })
  sortOrder?: string;
}

/**
 * Update Account Info Input Type
 */
@InputType()
export class UpdateAccountInfoInput {
  @Field({ nullable: true })
  companyName?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  billingAddressLine1?: string;

  @Field({ nullable: true })
  billingAddressLine2?: string;

  @Field({ nullable: true })
  billingCity?: string;

  @Field({ nullable: true })
  billingState?: string;

  @Field({ nullable: true })
  billingPostalCode?: string;

  @Field({ nullable: true })
  billingCountry?: string;

  @Field({ nullable: true })
  shippingAddressLine1?: string;

  @Field({ nullable: true })
  shippingAddressLine2?: string;

  @Field({ nullable: true })
  shippingCity?: string;

  @Field({ nullable: true })
  shippingState?: string;

  @Field({ nullable: true })
  shippingPostalCode?: string;

  @Field({ nullable: true })
  shippingCountry?: string;
}

/**
 * Change Password Input Type
 */
@InputType()
export class ChangePasswordInput {
  @Field()
  currentPassword!: string;

  @Field()
  newPassword!: string;

  @Field()
  confirmPassword!: string;
}

/**
 * Invoice Query Input Type
 */
@InputType()
export class InvoiceQueryInput {
  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  invoiceDateFrom?: Date;

  @Field({ nullable: true })
  invoiceDateTo?: Date;

  @Field({ nullable: true })
  dueDateFrom?: Date;

  @Field({ nullable: true })
  dueDateTo?: Date;

  @Field({ nullable: true })
  search?: string;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;

  @Field({ nullable: true, defaultValue: 'invoiceDate' })
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'desc' })
  sortOrder?: string;
}

/**
 * Portal customer GraphQL type
 * Represents a customer in the B2B portal
 */
@ObjectType()
export class PortalCustomerType {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  companyName!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field()
  phone!: string;

  @Field(() => Float)
  creditLimit!: number;

  @Field(() => Float)
  availableCredit!: number;

  @Field()
  paymentTerms!: string;

  @Field()
  pricingTier!: string;

  // Field resolvers
  @Field({ nullable: true })
  accountManager?: any;

  @Field({ nullable: true })
  salesRep?: any;

  @Field(() => Float)
  creditUtilization!: number;

  @Field(() => [ContractGraphQLType], { nullable: true })
  activeContracts?: any[];
}

/**
 * Portal product GraphQL type
 * Represents a product in the customer portal catalog
 */
@ObjectType()
export class PortalProductType {
  @Field(() => ID)
  id!: string;

  @Field()
  sku!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  category!: string;

  @Field(() => Float)
  basePrice!: number;

  @Field(() => Float)
  customerPrice!: number;

  @Field(() => Float)
  discountPercentage!: number;

  @Field(() => Int)
  availableQuantity!: number;

  @Field(() => Int)
  minimumOrderQuantity!: number;
}

/**
 * Portal order GraphQL type
 * Represents an order placed through the customer portal
 */
@ObjectType()
export class PortalOrderType {
  @Field(() => ID)
  id!: string;

  @Field()
  orderNumber!: string;

  @Field(() => PortalOrderStatus)
  status!: PortalOrderStatus;

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
  totalAmount!: number;

  @Field({ nullable: true })
  trackingNumber?: string;

  @Field(() => [PortalOrderItemType])
  items!: PortalOrderItemType[];
}

/**
 * Portal order item GraphQL type
 */
@ObjectType()
export class PortalOrderItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field()
  sku!: string;

  @Field()
  productName!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Float)
  lineTotal!: number;

  @Field(() => Int)
  quantityShipped!: number;
}

/**
 * Portal dashboard response type
 */
@ObjectType()
export class PortalDashboardType {
  @Field(() => PortalCustomerType)
  customer!: PortalCustomerType;

  @Field(() => [PortalOrderType])
  recentOrders!: PortalOrderType[];

  @Field()
  summary!: string; // JSON string
}

/**
 * Portal orders list response type
 */
@ObjectType()
export class PortalOrdersResponse {
  @Field(() => [PortalOrderType])
  orders!: PortalOrderType[];

  @Field(() => Int)
  total!: number;
}

/**
 * Portal product catalog response type
 */
@ObjectType()
export class PortalProductCatalogResponse {
  @Field(() => [PortalProductType])
  products!: PortalProductType[];

  @Field(() => Int)
  total!: number;
}

/**
 * Portal authentication response type
 */
@ObjectType()
export class PortalAuthResponse {
  @Field(() => PortalCustomerType)
  customer!: PortalCustomerType;

  @Field()
  accessToken!: string;
}

/**
 * Portal Registration Response Type
 */
@ObjectType()
export class PortalRegistrationResponse {
  @Field(() => PortalCustomerType)
  customer!: PortalCustomerType;

  @Field()
  message!: string;
}

/**
 * Account Update Response Type
 */
@ObjectType()
export class AccountUpdateResponse {
  @Field(() => PortalCustomerType)
  customer!: PortalCustomerType;

  @Field()
  message!: string;
}

/**
 * Password Change Response Type
 */
@ObjectType()
export class PasswordChangeResponse {
  @Field()
  success!: boolean;

  @Field()
  message!: string;
}

// Import ContractGraphQLType for use in portal types
import { ContractGraphQLType } from './contract.types';
