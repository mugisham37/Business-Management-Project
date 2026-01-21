import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { BaseEntity, Edge, Connection, PageInfo } from '../../../common/graphql/base.types';
import { PaymentMethodEnum, TransactionStatusEnum } from './pos.types';

// Transaction Item Type
@ObjectType({ description: 'Transaction line item' })
export class TransactionItem {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field()
  productSku!: string;

  @Field()
  productName!: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Float)
  lineTotal!: number;

  @Field(() => Float)
  discountAmount!: number;

  @Field(() => Float)
  taxAmount!: number;

  @Field({ nullable: true })
  variantInfo?: Record<string, any>;

  @Field({ nullable: true })
  metadata?: Record<string, any>;
}

// Payment Record Type
@ObjectType({ description: 'Payment record for a transaction' })
export class PaymentRecord {
  @Field(() => ID)
  id!: string;

  @Field(() => PaymentMethodEnum)
  paymentMethod!: PaymentMethodEnum;

  @Field(() => Float)
  amount!: number;

  @Field()
  status!: string;

  @Field({ nullable: true })
  paymentProvider?: string;

  @Field({ nullable: true })
  providerTransactionId?: string;

  @Field({ nullable: true })
  processedAt?: Date;

  @Field(() => Float)
  refundedAmount!: number;

  @Field({ nullable: true })
  refundedAt?: Date;

  @Field({ nullable: true })
  failureReason?: string;

  @Field({ nullable: true })
  metadata?: Record<string, any>;
}

// Transaction Type
@ObjectType({ description: 'POS transaction' })
export class Transaction extends BaseEntity {
  @Field(() => ID)
  declare id: string;

  @Field()
  transactionNumber!: string;

  @Field(() => ID, { nullable: true })
  customerId?: string;

  @Field(() => ID)
  locationId!: string;

  @Field(() => Float)
  subtotal!: number;

  @Field(() => Float)
  taxAmount!: number;

  @Field(() => Float)
  discountAmount!: number;

  @Field(() => Float)
  tipAmount!: number;

  @Field(() => Float)
  total!: number;

  @Field(() => TransactionStatusEnum)
  status!: TransactionStatusEnum;

  @Field(() => Int)
  itemCount!: number;

  @Field(() => PaymentMethodEnum)
  paymentMethod!: PaymentMethodEnum;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  paymentReference?: string;

  @Field()
  isOfflineTransaction!: boolean;

  @Field({ nullable: true })
  offlineTimestamp?: Date;

  @Field({ nullable: true })
  syncedAt?: Date;

  @Field({ nullable: true })
  metadata?: Record<string, any>;

  @Field(() => [TransactionItem])
  items!: TransactionItem[];

  @Field(() => [PaymentRecord])
  payments!: PaymentRecord[];
}

// Payment Result Type
@ObjectType({ description: 'Payment processing result' })
export class PaymentResult {
  @Field()
  success!: boolean;

  @Field()
  paymentId!: string;

  @Field({ nullable: true })
  providerTransactionId?: string;

  @Field({ nullable: true })
  error?: string;

  @Field({ nullable: true })
  metadata?: Record<string, any>;
}

// Receipt Result Types
@ObjectType({ description: 'Receipt delivery result' })
export class ReceiptResult {
  @Field()
  success!: boolean;

  @Field()
  receiptId!: string;

  @Field()
  deliveryMethod!: string;

  @Field({ nullable: true })
  error?: string | undefined;
}

@ObjectType({ description: 'Email delivery result' })
export class EmailResult {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  messageId?: string;

  @Field({ nullable: true })
  error?: string;
}

@ObjectType({ description: 'SMS delivery result' })
export class SmsResult {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  messageId?: string;

  @Field({ nullable: true })
  error?: string;
}

@ObjectType({ description: 'Print result' })
export class PrintResult {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  printJobId?: string;

  @Field({ nullable: true })
  error?: string;
}

// Reconciliation Types
@ObjectType({ description: 'Payment method breakdown' })
export class PaymentMethodBreakdown {
  @Field(() => Int)
  count!: number;

  @Field(() => Float)
  amount!: number;
}

@ObjectType({ description: 'Payment method summary for reconciliation' })
export class PaymentMethodSummary {
  @Field()
  paymentMethod!: string;

  @Field(() => Int)
  transactionCount!: number;

  @Field(() => Float)
  totalAmount!: number;

  @Field(() => Float)
  averageAmount!: number;

  @Field(() => Int)
  refundCount!: number;

  @Field(() => Float)
  refundAmount!: number;
}

@ObjectType({ description: 'Reconciliation summary' })
export class ReconciliationSummary {
  @Field(() => Float)
  expectedAmount!: number;

  @Field(() => Float)
  actualAmount!: number;

  @Field(() => Float)
  variance!: number;

  @Field(() => Float)
  variancePercentage!: number;
}

@ObjectType({ description: 'Reconciliation discrepancy' })
export class ReconciliationDiscrepancy {
  @Field()
  type!: string;

  @Field({ nullable: true })
  transactionId?: string;

  @Field(() => Float, { nullable: true })
  expectedAmount?: number;

  @Field(() => Float, { nullable: true })
  actualAmount?: number;

  @Field()
  description!: string;
}

@ObjectType({ description: 'Reconciliation report' })
export class ReconciliationReport {
  @Field()
  reconciliationId!: string;

  @Field()
  tenantId!: string;

  @Field({ nullable: true })
  locationId?: string;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field(() => Int)
  totalTransactions!: number;

  @Field(() => Float)
  totalAmount!: number;

  @Field({ nullable: true })
  paymentMethodBreakdown?: Record<string, PaymentMethodBreakdown>;

  @Field(() => [ReconciliationDiscrepancy])
  discrepancies!: ReconciliationDiscrepancy[];

  @Field(() => ReconciliationSummary)
  summary!: ReconciliationSummary;

  @Field()
  generatedAt!: Date;
}

// Transaction Edge
@ObjectType()
export class TransactionEdge extends Edge<Transaction> {
  @Field(() => Transaction)
  node!: Transaction;
}

// Transaction Connection
@ObjectType()
export class TransactionConnection extends Connection<Transaction> {
  @Field(() => [TransactionEdge])
  edges!: TransactionEdge[];

  @Field(() => PageInfo)
  declare pageInfo: PageInfo;
}
