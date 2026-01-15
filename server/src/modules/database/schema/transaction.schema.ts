import { pgTable, varchar, decimal, integer, jsonb, index, pgEnum, boolean, timestamp } from 'drizzle-orm/pg-core';
import { baseSchema } from './base.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';

// Enums for transaction-related fields
export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
  'voided'
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'card',
  'mobile_money',
  'digital_wallet',
  'bank_transfer',
  'check',
  'store_credit'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'authorized',
  'captured',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded'
]);

// Main transactions table
export const transactions = pgTable('transactions', {
  ...baseSchema,
  // Transaction identification
  transactionNumber: varchar('transaction_number', { length: 50 }).notNull().unique(),
  
  // Customer and location information
  customerId: varchar('customer_id', { length: 255 }),
  locationId: varchar('location_id', { length: 255 }).notNull(),
  
  // Financial information
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  tipAmount: decimal('tip_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  
  // Transaction metadata
  status: transactionStatusEnum('status').default('pending').notNull(),
  itemCount: integer('item_count').default(0).notNull(),
  notes: varchar('notes', { length: 1000 }),
  
  // Payment information
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('pending').notNull(),
  paymentReference: varchar('payment_reference', { length: 255 }),
  
  // Offline support
  isOfflineTransaction: boolean('is_offline_transaction').default(false).notNull(),
  offlineTimestamp: timestamp('offline_timestamp', { withTimezone: true }),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  
  // Additional data
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  tenantIdIdx: index('idx_transactions_tenant_id').on(table.tenantId),
  customerIdIdx: index('idx_transactions_customer_id').on(table.customerId),
  locationIdIdx: index('idx_transactions_location_id').on(table.locationId),
  statusIdx: index('idx_transactions_status').on(table.status),
  createdAtIdx: index('idx_transactions_created_at').on(table.createdAt),
  transactionNumberIdx: index('idx_transactions_number').on(table.transactionNumber),
}));

// Transaction items table
export const transactionItems = pgTable('transaction_items', {
  ...baseSchema,
  transactionId: varchar('transaction_id', { length: 255 }).notNull(),
  
  // Product information
  productId: varchar('product_id', { length: 255 }).notNull(),
  productSku: varchar('product_sku', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  
  // Quantity and pricing
  quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal('line_total', { precision: 12, scale: 2 }).notNull(),
  
  // Discounts and taxes
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  
  // Product variant information
  variantInfo: jsonb('variant_info').default({}),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  transactionIdIdx: index('idx_transaction_items_transaction_id').on(table.transactionId),
  productIdIdx: index('idx_transaction_items_product_id').on(table.productId),
  tenantIdIdx: index('idx_transaction_items_tenant_id').on(table.tenantId),
}));

// Payment records table
export const paymentRecords = pgTable('payment_records', {
  ...baseSchema,
  transactionId: varchar('transaction_id', { length: 255 }).notNull(),
  
  // Payment details
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  status: paymentStatusEnum('status').default('pending').notNull(),
  
  // Provider information
  paymentProvider: varchar('payment_provider', { length: 100 }),
  providerTransactionId: varchar('provider_transaction_id', { length: 255 }),
  providerResponse: jsonb('provider_response').default({}),
  
  // Processing information
  processedAt: timestamp('processed_at', { withTimezone: true }),
  failureReason: varchar('failure_reason', { length: 500 }),
  
  // Refund information
  refundedAmount: decimal('refunded_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  transactionIdIdx: index('idx_payment_records_transaction_id').on(table.transactionId),
  statusIdx: index('idx_payment_records_status').on(table.status),
  providerTransactionIdIdx: index('idx_payment_records_provider_transaction_id').on(table.providerTransactionId),
  tenantIdIdx: index('idx_payment_records_tenant_id').on(table.tenantId),
}));

// Offline transaction queue table
export const offlineTransactionQueue = pgTable('offline_transaction_queue', {
  ...baseSchema,
  
  // Queue information
  queueId: varchar('queue_id', { length: 255 }).notNull().unique(),
  deviceId: varchar('device_id', { length: 255 }).notNull(),
  
  // Transaction data
  transactionData: jsonb('transaction_data').notNull(),
  operationType: varchar('operation_type', { length: 50 }).notNull(), // 'create', 'update', 'void', 'refund'
  
  // Sync status
  isSynced: boolean('is_synced').default(false).notNull(),
  syncAttempts: integer('sync_attempts').default(0).notNull(),
  lastSyncAttempt: timestamp('last_sync_attempt', { withTimezone: true }),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  
  // Error handling
  syncErrors: jsonb('sync_errors').default([]),
  
  // Priority and ordering
  priority: integer('priority').default(1).notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
}, (table) => ({
  tenantIdIdx: index('idx_offline_queue_tenant_id').on(table.tenantId),
  deviceIdIdx: index('idx_offline_queue_device_id').on(table.deviceId),
  isSyncedIdx: index('idx_offline_queue_is_synced').on(table.isSynced),
  priorityIdx: index('idx_offline_queue_priority').on(table.priority),
  sequenceIdx: index('idx_offline_queue_sequence').on(table.sequenceNumber),
}));