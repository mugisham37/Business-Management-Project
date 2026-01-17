// Shared types and utilities for POS module
import { PaymentMethodEnum, TransactionStatusEnum } from './pos.types';

// Transaction DTOs
export interface UpdateTransactionDto {
  status?: TransactionStatusEnum;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface VoidTransactionDto {
  reason: string;
  notes?: string;
}

export interface RefundTransactionDto {
  amount: number;
  reason: string;
  notes?: string;
}

export interface TransactionResponseDto {
  id: string;
  transactionNumber: string;
  tenantId: string;
  customerId?: string;
  locationId: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
  status: TransactionStatusEnum;
  itemCount: number;
  paymentMethod: PaymentMethodEnum;
  notes?: string;
  paymentReference?: string;
  isOfflineTransaction: boolean;
  offlineTimestamp?: Date;
  syncedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  items: TransactionItemResponseDto[];
}

export interface TransactionItemResponseDto {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountAmount: number;
  taxAmount: number;
  variantInfo?: Record<string, any>;
}

// Payment types
export interface PaymentRequest {
  paymentMethod: PaymentMethodEnum;
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

export interface PaymentProviderResult {
  success: boolean;
  providerTransactionId?: string;
  providerResponse?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
}

// Utility function to create objects without undefined properties
export function createWithoutUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value;
    }
  }
  
  return result;
}

// Transaction status enum for internal use
export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  VOIDED = 'voided',
}

// Payment method enum for internal use
export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE_MONEY = 'mobile_money',
  DIGITAL_WALLET = 'digital_wallet',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  STORE_CREDIT = 'store_credit',
}

// Offline sync types
export interface CreateTransactionDto {
  customerId?: string;
  locationId: string;
  items: CreateTransactionItemDto[];
  paymentMethod: PaymentMethodEnum;
  taxAmount?: number;
  discountAmount?: number;
  tipAmount?: number;
  notes?: string;
  paymentReference?: string;
  isOfflineTransaction?: boolean;
  metadata?: Record<string, any>;
}

export interface CreateTransactionItemDto {
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  variantInfo?: Record<string, any>;
  metadata?: Record<string, any>;
}