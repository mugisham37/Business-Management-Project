import { ObjectType, Field, ID, Float, Int, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/graphql/base.types';

// Enums
export enum POSSessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  SUSPENDED = 'suspended',
}

export enum PaymentMethodEnum {
  CASH = 'cash',
  CARD = 'card',
  MOBILE_MONEY = 'mobile_money',
  DIGITAL_WALLET = 'digital_wallet',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  STORE_CREDIT = 'store_credit',
}

export enum TransactionStatusEnum {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  VOIDED = 'voided',
}

registerEnumType(POSSessionStatus, { name: 'POSSessionStatus' });
registerEnumType(PaymentMethodEnum, { name: 'PaymentMethod' });
registerEnumType(TransactionStatusEnum, { name: 'TransactionStatus' });

// POS Session Type
@ObjectType({ description: 'POS session representing a cashier shift' })
export class POSSession extends BaseEntity {
  @Field(() => ID)
  @ApiProperty({ description: 'Session ID' })
  override id!: string;

  @Field()
  @ApiProperty({ description: 'Session number' })
  sessionNumber!: string;

  @Field(() => ID)
  @ApiProperty({ description: 'Employee ID' })
  employeeId!: string;

  @Field(() => ID)
  @ApiProperty({ description: 'Location ID' })
  locationId!: string;

  @Field(() => POSSessionStatus)
  @ApiProperty({ enum: POSSessionStatus, description: 'Session status' })
  status!: POSSessionStatus;

  @Field(() => Float)
  @ApiProperty({ description: 'Opening cash amount' })
  openingCash!: number;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Closing cash amount', required: false })
  closingCash?: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Expected cash amount' })
  expectedCash!: number;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Cash variance', required: false })
  cashVariance?: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Total transactions in session' })
  transactionCount!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Total sales amount' })
  totalSales!: number;

  @Field()
  @ApiProperty({ description: 'Session opened at' })
  openedAt!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Session closed at', required: false })
  closedAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Session notes', required: false })
  notes?: string;
}

// POS Configuration Type
@ObjectType({ description: 'POS configuration settings' })
export class POSConfiguration {
  @Field(() => ID)
  @ApiProperty({ description: 'Configuration ID' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @Field(() => ID, { nullable: true })
  @ApiProperty({ description: 'Location ID', required: false })
  locationId?: string;

  @Field()
  @ApiProperty({ description: 'Currency code' })
  currency!: string;

  @Field(() => Float)
  @ApiProperty({ description: 'Default tax rate' })
  taxRate!: number;

  @Field()
  @ApiProperty({ description: 'Enable offline mode' })
  offlineMode!: boolean;

  @Field()
  @ApiProperty({ description: 'Auto-print receipts' })
  autoPrintReceipts!: boolean;

  @Field(() => [String])
  @ApiProperty({ description: 'Enabled payment methods', type: [String] })
  enabledPaymentMethods!: string[];

  @Field()
  @ApiProperty({ description: 'Require customer for transactions' })
  requireCustomer!: boolean;

  @Field()
  @ApiProperty({ description: 'Allow discounts' })
  allowDiscounts!: boolean;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Maximum discount percentage', required: false })
  maxDiscountPercent?: number;

  @Field()
  @ApiProperty({ description: 'Enable tips' })
  enableTips!: boolean;

  @Field()
  @ApiProperty({ description: 'Configuration created at' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Configuration updated at' })
  updatedAt!: Date;
}
