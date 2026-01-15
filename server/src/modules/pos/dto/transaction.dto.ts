import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsEnum, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Utility types for handling optional properties with exactOptionalPropertyTypes
export type OptionalUndefined<T> = T | undefined;
export type StrictOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Helper function to create objects without undefined properties
export function createWithoutUndefined<T extends Record<string, any>>(obj: T): T {
  const result = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as any)[key] = value;
    }
  }
  return result;
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE_MONEY = 'mobile_money',
  DIGITAL_WALLET = 'digital_wallet',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  STORE_CREDIT = 'store_credit',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  VOIDED = 'voided',
}

export class CreateTransactionItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  productId!: string;

  @ApiProperty({ description: 'Product SKU' })
  @IsString()
  productSku!: string;

  @ApiProperty({ description: 'Product name' })
  @IsString()
  productName!: string;

  @ApiProperty({ description: 'Quantity', minimum: 0.001 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiProperty({ description: 'Unit price', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ description: 'Discount amount', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Product variant information' })
  @IsOptional()
  variantInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateTransactionDto {
  @ApiPropertyOptional({ description: 'Customer ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ description: 'Location ID' })
  @IsString()
  locationId!: string;

  @ApiProperty({ description: 'Transaction items', type: [CreateTransactionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionItemDto)
  items!: CreateTransactionItemDto[];

  @ApiProperty({ description: 'Payment method', enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ description: 'Tax amount', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ description: 'Discount amount', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Tip amount', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tipAmount?: number;

  @ApiPropertyOptional({ description: 'Transaction notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Payment reference' })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional({ description: 'Is offline transaction' })
  @IsOptional()
  @IsBoolean()
  isOfflineTransaction?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}
export class UpdateTransactionDto {
  @ApiPropertyOptional({ description: 'Transaction status', enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ description: 'Transaction notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class VoidTransactionDto {
  @ApiProperty({ description: 'Reason for voiding the transaction' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RefundTransactionDto {
  @ApiProperty({ description: 'Refund amount', minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: 'Reason for refund' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TransactionResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  id!: string;

  @ApiProperty({ description: 'Transaction number' })
  transactionNumber!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiPropertyOptional({ description: 'Customer ID' })
  customerId?: string;

  @ApiProperty({ description: 'Location ID' })
  locationId!: string;

  @ApiProperty({ description: 'Subtotal' })
  subtotal!: number;

  @ApiProperty({ description: 'Tax amount' })
  taxAmount!: number;

  @ApiProperty({ description: 'Discount amount' })
  discountAmount!: number;

  @ApiProperty({ description: 'Tip amount' })
  tipAmount!: number;

  @ApiProperty({ description: 'Total amount' })
  total!: number;

  @ApiProperty({ description: 'Transaction status', enum: TransactionStatus })
  status!: TransactionStatus;

  @ApiProperty({ description: 'Item count' })
  itemCount!: number;

  @ApiProperty({ description: 'Payment method', enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ description: 'Transaction notes' })
  notes?: string;

  @ApiProperty({ description: 'Created at' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Transaction items' })
  items!: TransactionItemResponseDto[];
}

export class TransactionItemResponseDto {
  @ApiProperty({ description: 'Item ID' })
  id!: string;

  @ApiProperty({ description: 'Product ID' })
  productId!: string;

  @ApiProperty({ description: 'Product SKU' })
  productSku!: string;

  @ApiProperty({ description: 'Product name' })
  productName!: string;

  @ApiProperty({ description: 'Quantity' })
  quantity!: number;

  @ApiProperty({ description: 'Unit price' })
  unitPrice!: number;

  @ApiProperty({ description: 'Line total' })
  lineTotal!: number;

  @ApiProperty({ description: 'Discount amount' })
  discountAmount!: number;

  @ApiProperty({ description: 'Tax amount' })
  taxAmount!: number;

  @ApiPropertyOptional({ description: 'Variant information' })
  variantInfo?: Record<string, any>;
}

// Payment-related DTOs and interfaces
export interface PaymentRequest {
  paymentMethod: PaymentMethod;
  amount: number;
  paymentReference?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  providerTransactionId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

// Email and SMS receipt options
export interface EmailReceiptOptions {
  to: string;
  template?: string;
  includeItemDetails?: boolean;
  includeTaxBreakdown?: boolean;
}

export interface SmsReceiptOptions {
  to: string;
  template?: string;
  includeTotal: boolean;
  includeItems?: boolean;
}

export interface ReceiptResult {
  success: boolean;
  receiptId: string;
  deliveryMethod: 'email' | 'sms' | 'print';
  error?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PrintResult {
  success: boolean;
  printJobId?: string;
  error?: string;
}

// Reconciliation types
export interface ReconciliationReport {
  reconciliationId: string;
  tenantId: string;
  locationId?: string;
  startDate: Date;
  endDate: Date;
  totalTransactions: number;
  totalAmount: number;
  paymentMethodBreakdown: Record<string, { count: number; amount: number }>;
  discrepancies: ReconciliationDiscrepancy[];
  summary: {
    expectedAmount: number;
    actualAmount: number;
    variance: number;
    variancePercentage: number;
  };
  generatedAt: Date;
}

export interface ReconciliationDiscrepancy {
  type: 'missing_transaction' | 'amount_mismatch' | 'duplicate_transaction';
  transactionId?: string;
  expectedAmount?: number;
  actualAmount?: number;
  description: string;
}