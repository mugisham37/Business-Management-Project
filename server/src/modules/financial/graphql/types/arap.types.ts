import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { DecimalScalar } from '../scalars';
import { ChartOfAccount } from './chart-of-accounts.types';
import { InvoiceType, PaymentType, ARAPStatus, PaymentMethod, ReportType } from '../enums';

@ObjectType()
export class ARAPInvoice {
  @Field(() => ID)
  id!: string;

  @Field()
  invoiceNumber!: string;

  @Field(() => InvoiceType)
  invoiceType!: InvoiceType;

  @Field(() => ID)
  customerId?: string;

  @Field(() => ID)
  supplierId?: string;

  @Field()
  invoiceDate!: Date;

  @Field()
  dueDate!: Date;

  @Field(() => DecimalScalar)
  subtotal!: string;

  @Field(() => DecimalScalar)
  taxAmount!: string;

  @Field(() => DecimalScalar)
  totalAmount!: string;

  @Field(() => DecimalScalar)
  paidAmount!: string;

  @Field(() => DecimalScalar)
  balanceAmount!: string;

  @Field(() => ARAPStatus)
  status!: ARAPStatus;

  @Field(() => [ARAPInvoiceLine])
  lines!: ARAPInvoiceLine[];

  @Field(() => [ARAPPayment])
  payments!: ARAPPayment[];

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  reference?: string;

  @Field({ nullable: true })
  terms?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => ID)
  createdBy!: string;

  @Field(() => ID, { nullable: true })
  updatedBy?: string;

  @Field(() => ID)
  tenantId!: string;
}

@ObjectType()
export class ARAPInvoiceLine {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  invoiceId!: string;

  @Field(() => ARAPInvoice)
  invoice!: ARAPInvoice;

  @Field(() => Int)
  lineNumber!: number;

  @Field()
  description!: string;

  @Field(() => DecimalScalar)
  quantity!: string;

  @Field(() => DecimalScalar)
  unitPrice!: string;

  @Field(() => DecimalScalar)
  lineAmount!: string;

  @Field(() => ID, { nullable: true })
  accountId?: string;

  @Field(() => ChartOfAccount, { nullable: true })
  account?: ChartOfAccount;

  @Field({ nullable: true })
  taxCode?: string;

  @Field(() => DecimalScalar, { nullable: true })
  taxAmount?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => ID)
  tenantId!: string;
}

@ObjectType()
export class ARAPPayment {
  @Field(() => ID)
  id!: string;

  @Field()
  paymentNumber!: string;

  @Field(() => PaymentType)
  paymentType!: PaymentType;

  @Field(() => ID, { nullable: true })
  invoiceId?: string;

  @Field(() => ARAPInvoice, { nullable: true })
  invoice?: ARAPInvoice;

  @Field(() => ID, { nullable: true })
  customerId?: string;

  @Field(() => ID, { nullable: true })
  supplierId?: string;

  @Field()
  paymentDate!: Date;

  @Field(() => DecimalScalar)
  paymentAmount!: string;

  @Field(() => PaymentMethod)
  paymentMethod!: PaymentMethod;

  @Field({ nullable: true })
  reference?: string;

  @Field({ nullable: true })
  checkNumber?: string;

  @Field({ nullable: true })
  bankAccount?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => ARAPStatus)
  status!: ARAPStatus;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => ID)
  createdBy!: string;

  @Field(() => ID, { nullable: true })
  updatedBy?: string;

  @Field(() => ID)
  tenantId!: string;
}

@ObjectType()
export class AgingReport {
  @Field(() => ReportType)
  reportType!: ReportType;

  @Field()
  asOfDate!: Date;

  @Field(() => [AgingBucket])
  agingBuckets!: AgingBucket[];

  @Field(() => DecimalScalar)
  totalAmount!: string;

  @Field(() => Int)
  totalInvoices!: number;

  @Field()
  generatedAt!: Date;

  @Field(() => ID)
  tenantId!: string;
}

@ObjectType()
export class AgingBucket {
  @Field()
  bucketName!: string; // 'Current', '1-30 Days', '31-60 Days', etc.

  @Field(() => Int)
  daysFrom!: number;

  @Field(() => Int, { nullable: true })
  daysTo?: number;

  @Field(() => DecimalScalar)
  amount!: string;

  @Field(() => Int)
  invoiceCount!: number;

  @Field(() => [AgingInvoice])
  invoices!: AgingInvoice[];
}

@ObjectType()
export class AgingInvoice {
  @Field(() => ID)
  invoiceId!: string;

  @Field()
  invoiceNumber!: string;

  @Field()
  customerName?: string;

  @Field()
  supplierName?: string;

  @Field()
  invoiceDate!: Date;

  @Field()
  dueDate!: Date;

  @Field(() => Int)
  daysOverdue!: number;

  @Field(() => DecimalScalar)
  totalAmount!: string;

  @Field(() => DecimalScalar)
  balanceAmount!: string;
}