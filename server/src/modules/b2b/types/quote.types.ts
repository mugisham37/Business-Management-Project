import { ObjectType, Field, ID, Float, Int, InputType, registerEnumType } from '@nestjs/graphql';
import { AddressInput, AddressType, PaymentTerms } from './b2b-order.types';

/**
 * Quote Status Enum
 */
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

registerEnumType(QuoteStatus, {
  name: 'QuoteStatus',
  description: 'Status of a B2B quote',
});

/**
 * Customer Response Enum
 */
export enum CustomerResponse {
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  NEGOTIATING = 'negotiating',
}

registerEnumType(CustomerResponse, {
  name: 'CustomerResponse',
  description: 'Customer response to a quote',
});

/**
 * Quote Item Input Type
 */
@InputType()
export class QuoteItemInput {
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
 * Quote Item Output Type
 */
@ObjectType()
export class QuoteItemType {
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
 * Create Quote Input Type
 */
@InputType()
export class CreateQuoteInput {
  @Field(() => ID)
  customerId!: string;

  @Field({ nullable: true })
  quoteDate?: Date;

  @Field(() => Int, { nullable: true, defaultValue: 30 })
  validityDays?: number;

  @Field(() => PaymentTerms)
  paymentTerms!: PaymentTerms;

  @Field({ nullable: true })
  deliveryTerms?: string;

  @Field({ nullable: true })
  termsAndConditions?: string;

  @Field(() => [QuoteItemInput])
  items!: QuoteItemInput[];

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
 * Update Quote Input Type
 */
@InputType()
export class UpdateQuoteInput {
  @Field(() => QuoteStatus, { nullable: true })
  status?: QuoteStatus;

  @Field({ nullable: true })
  expirationDate?: Date;

  @Field({ nullable: true })
  deliveryTerms?: string;

  @Field({ nullable: true })
  termsAndConditions?: string;

  @Field(() => Float, { nullable: true })
  discountAmount?: number;

  @Field(() => CustomerResponse, { nullable: true })
  customerResponse?: CustomerResponse;

  @Field({ nullable: true })
  customerNotes?: string;

  @Field({ nullable: true })
  specialInstructions?: string;

  @Field({ nullable: true })
  internalNotes?: string;

  @Field({ nullable: true })
  metadata?: string; // JSON string
}

/**
 * Quote Query Input Type
 */
@InputType()
export class QuoteQueryInput {
  @Field({ nullable: true })
  search?: string;

  @Field(() => [QuoteStatus], { nullable: true })
  status?: QuoteStatus[];

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

  @Field(() => Int, { nullable: true })
  expiringWithinDays?: number;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;

  @Field({ nullable: true, defaultValue: 'quoteDate' })
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'desc' })
  sortOrder?: string;
}

/**
 * Approve Quote Input Type
 */
@InputType()
export class ApproveQuoteInput {
  @Field()
  approvalNotes!: string;
}

/**
 * Reject Quote Input Type
 */
@InputType()
export class RejectQuoteInput {
  @Field()
  rejectionReason!: string;
}

/**
 * Send Quote Input Type
 */
@InputType()
export class SendQuoteInput {
  @Field(() => [String])
  recipients!: string[];

  @Field({ nullable: true })
  subject?: string;

  @Field({ nullable: true })
  message?: string;

  @Field({ nullable: true, defaultValue: true })
  includePdf?: boolean;
}

/**
 * Quote Output Type
 */
@ObjectType()
export class QuoteType {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  quoteNumber!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => QuoteStatus)
  status!: QuoteStatus;

  @Field()
  quoteDate!: Date;

  @Field()
  expirationDate!: Date;

  @Field(() => Int)
  validityDays!: number;

  @Field(() => PaymentTerms)
  paymentTerms!: PaymentTerms;

  @Field({ nullable: true })
  deliveryTerms?: string;

  @Field({ nullable: true })
  termsAndConditions?: string;

  @Field(() => [QuoteItemType])
  items!: QuoteItemType[];

  @Field(() => Float)
  subtotal!: number;

  @Field(() => Float)
  taxAmount!: number;

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

  @Field(() => CustomerResponse, { nullable: true })
  customerResponse?: CustomerResponse;

  @Field({ nullable: true })
  customerNotes?: string;

  @Field({ nullable: true })
  sentAt?: Date;

  @Field({ nullable: true })
  acceptedAt?: Date;

  @Field({ nullable: true })
  rejectedAt?: Date;

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
  convertedOrder?: any; // Will be resolved via DataLoader if converted

  @Field(() => Boolean)
  isExpired!: boolean; // Computed field

  @Field(() => Int)
  daysUntilExpiration!: number; // Computed field
}

/**
 * Quotes List Response Type
 */
@ObjectType()
export class QuotesResponse {
  @Field(() => [QuoteType])
  quotes!: QuoteType[];

  @Field(() => Int)
  total!: number;
}

/**
 * Quote Approval Response Type
 */
@ObjectType()
export class QuoteApprovalResponse {
  @Field(() => QuoteType)
  quote!: QuoteType;

  @Field()
  message!: string;
}

/**
 * Quote Send Response Type
 */
@ObjectType()
export class QuoteSendResponse {
  @Field(() => QuoteType)
  quote!: QuoteType;

  @Field()
  message!: string;

  @Field(() => [String])
  sentTo!: string[];
}

/**
 * Quote Conversion Response Type
 */
@ObjectType()
export class QuoteConversionResponse {
  @Field(() => QuoteType)
  quote!: QuoteType;

  @Field()
  order!: any; // B2BOrderType - will import from b2b-order.types

  @Field()
  message!: string;
}