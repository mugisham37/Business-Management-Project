import { pgTable, varchar, decimal, integer, jsonb, index, unique, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { baseSchema } from './base.schema';
import { products, productVariants } from './product.schema';

// Inventory movement type enumeration
export const inventoryMovementTypeEnum = pgEnum('inventory_movement_type', [
  'sale',
  'purchase',
  'adjustment',
  'transfer_in',
  'transfer_out',
  'return',
  'damage',
  'theft',
  'expired',
  'recount',
  'production',
  'consumption',
]);

// Inventory adjustment reason enumeration
export const inventoryAdjustmentReasonEnum = pgEnum('inventory_adjustment_reason', [
  'manual_count',
  'cycle_count',
  'damaged_goods',
  'expired_goods',
  'theft_loss',
  'supplier_error',
  'system_error',
  'return_to_vendor',
  'promotional_use',
  'internal_use',
  'other',
]);

// Inventory valuation method enumeration
export const inventoryValuationMethodEnum = pgEnum('inventory_valuation_method', [
  'fifo',     // First In, First Out
  'lifo',     // Last In, First Out
  'average',  // Weighted Average
  'specific', // Specific Identification
]);

// Main inventory levels table - tracks current stock at each location
export const inventoryLevels = pgTable('inventory_levels', {
  ...baseSchema,
  
  // Product and location identification
  productId: varchar('product_id', { length: 255 }).notNull(),
  variantId: varchar('variant_id', { length: 255 }), // null for simple products
  locationId: varchar('location_id', { length: 255 }).notNull(),
  
  // Stock quantities
  currentLevel: decimal('current_level', { precision: 12, scale: 3 }).default('0').notNull(),
  availableLevel: decimal('available_level', { precision: 12, scale: 3 }).default('0').notNull(), // current - reserved
  reservedLevel: decimal('reserved_level', { precision: 12, scale: 3 }).default('0').notNull(),
  
  // Reorder settings (can override product defaults)
  minStockLevel: decimal('min_stock_level', { precision: 12, scale: 3 }).default('0'),
  maxStockLevel: decimal('max_stock_level', { precision: 12, scale: 3 }),
  reorderPoint: decimal('reorder_point', { precision: 12, scale: 3 }).default('0'),
  reorderQuantity: decimal('reorder_quantity', { precision: 12, scale: 3 }).default('0'),
  
  // Valuation
  valuationMethod: inventoryValuationMethodEnum('valuation_method').default('fifo').notNull(),
  averageCost: decimal('average_cost', { precision: 12, scale: 4 }).default('0'),
  totalValue: decimal('total_value', { precision: 15, scale: 2 }).default('0'),
  
  // Bin/location within warehouse
  binLocation: varchar('bin_location', { length: 100 }),
  zone: varchar('zone', { length: 50 }),
  
  // Last movement tracking
  lastMovementAt: timestamp('last_movement_at', { withTimezone: true }),
  lastCountAt: timestamp('last_count_at', { withTimezone: true }),
  
  // Alerts and notifications
  lowStockAlertSent: boolean('low_stock_alert_sent').default(false),
  lastAlertSentAt: timestamp('last_alert_sent_at', { withTimezone: true }),
  
  // Custom attributes
  attributes: jsonb('attributes').default({}),
}, (table) => ({
  // Unique constraint on tenant_id + product_id + variant_id + location_id
  tenantProductLocationIdx: unique('inventory_levels_tenant_product_location_unique').on(
    table.tenantId, 
    table.productId, 
    table.variantId, 
    table.locationId
  ),
  
  // Performance indexes
  tenantIdIdx: index('inventory_levels_tenant_id_idx').on(table.tenantId),
  productIdIdx: index('inventory_levels_product_id_idx').on(table.productId),
  locationIdIdx: index('inventory_levels_location_id_idx').on(table.locationId),
  currentLevelIdx: index('inventory_levels_current_level_idx').on(table.currentLevel),
  reorderPointIdx: index('inventory_levels_reorder_point_idx').on(table.reorderPoint),
  binLocationIdx: index('inventory_levels_bin_location_idx').on(table.binLocation),
  lastMovementIdx: index('inventory_levels_last_movement_idx').on(table.lastMovementAt),
}));

// Inventory movements table - tracks all stock changes
export const inventoryMovements = pgTable('inventory_movements', {
  ...baseSchema,
  
  // Reference information
  productId: varchar('product_id', { length: 255 }).notNull(),
  variantId: varchar('variant_id', { length: 255 }),
  locationId: varchar('location_id', { length: 255 }).notNull(),
  
  // Movement details
  movementType: inventoryMovementTypeEnum('movement_type').notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(), // positive for in, negative for out
  unitCost: decimal('unit_cost', { precision: 12, scale: 4 }),
  totalCost: decimal('total_cost', { precision: 15, scale: 2 }),
  
  // Before and after levels
  previousLevel: decimal('previous_level', { precision: 12, scale: 3 }).notNull(),
  newLevel: decimal('new_level', { precision: 12, scale: 3 }).notNull(),
  
  // Reference documents
  referenceType: varchar('reference_type', { length: 50 }), // transaction, purchase_order, adjustment, transfer
  referenceId: varchar('reference_id', { length: 255 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  
  // Batch/lot tracking
  batchNumber: varchar('batch_number', { length: 100 }),
  lotNumber: varchar('lot_number', { length: 100 }),
  expiryDate: timestamp('expiry_date', { withTimezone: true }),
  
  // Reason and notes
  reason: inventoryAdjustmentReasonEnum('reason'),
  notes: varchar('notes', { length: 1000 }),
  
  // Approval workflow
  requiresApproval: boolean('requires_approval').default(false),
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  // Bin/location tracking
  fromBinLocation: varchar('from_bin_location', { length: 100 }),
  toBinLocation: varchar('to_bin_location', { length: 100 }),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  // Performance indexes
  tenantIdIdx: index('inventory_movements_tenant_id_idx').on(table.tenantId),
  productIdIdx: index('inventory_movements_product_id_idx').on(table.productId),
  locationIdIdx: index('inventory_movements_location_id_idx').on(table.locationId),
  movementTypeIdx: index('inventory_movements_movement_type_idx').on(table.movementType),
  referenceIdx: index('inventory_movements_reference_idx').on(table.referenceType, table.referenceId),
  batchNumberIdx: index('inventory_movements_batch_number_idx').on(table.batchNumber),
  expiryDateIdx: index('inventory_movements_expiry_date_idx').on(table.expiryDate),
  createdAtIdx: index('inventory_movements_created_at_idx').on(table.createdAt),
}));

// Inventory batches/lots table for detailed tracking
export const inventoryBatches = pgTable('inventory_batches', {
  ...baseSchema,
  
  // Product and location
  productId: varchar('product_id', { length: 255 }).notNull(),
  variantId: varchar('variant_id', { length: 255 }),
  locationId: varchar('location_id', { length: 255 }).notNull(),
  
  // Batch identification
  batchNumber: varchar('batch_number', { length: 100 }).notNull(),
  lotNumber: varchar('lot_number', { length: 100 }),
  serialNumbers: jsonb('serial_numbers').default([]),
  
  // Quantities
  originalQuantity: decimal('original_quantity', { precision: 12, scale: 3 }).notNull(),
  currentQuantity: decimal('current_quantity', { precision: 12, scale: 3 }).notNull(),
  reservedQuantity: decimal('reserved_quantity', { precision: 12, scale: 3 }).default('0'),
  
  // Cost tracking
  unitCost: decimal('unit_cost', { precision: 12, scale: 4 }).notNull(),
  totalCost: decimal('total_cost', { precision: 15, scale: 2 }).notNull(),
  
  // Dates
  receivedDate: timestamp('received_date', { withTimezone: true }).notNull(),
  manufactureDate: timestamp('manufacture_date', { withTimezone: true }),
  expiryDate: timestamp('expiry_date', { withTimezone: true }),
  
  // Supplier information
  supplierId: varchar('supplier_id', { length: 255 }),
  supplierBatchNumber: varchar('supplier_batch_number', { length: 100 }),
  
  // Quality control
  qualityStatus: varchar('quality_status', { length: 50 }).default('approved'), // approved, rejected, quarantine, testing
  qualityNotes: varchar('quality_notes', { length: 1000 }),
  
  // Status
  status: varchar('status', { length: 50 }).default('active'), // active, consumed, expired, recalled
  
  // Bin location
  binLocation: varchar('bin_location', { length: 100 }),
  
  // Additional attributes
  attributes: jsonb('attributes').default({}),
}, (table) => ({
  // Unique constraint on tenant_id + batch_number + location_id
  tenantBatchLocationIdx: unique('inventory_batches_tenant_batch_location_unique').on(
    table.tenantId, 
    table.batchNumber, 
    table.locationId
  ),
  
  // Performance indexes
  tenantIdIdx: index('inventory_batches_tenant_id_idx').on(table.tenantId),
  productIdIdx: index('inventory_batches_product_id_idx').on(table.productId),
  locationIdIdx: index('inventory_batches_location_id_idx').on(table.locationId),
  batchNumberIdx: index('inventory_batches_batch_number_idx').on(table.batchNumber),
  expiryDateIdx: index('inventory_batches_expiry_date_idx').on(table.expiryDate),
  statusIdx: index('inventory_batches_status_idx').on(table.status),
  qualityStatusIdx: index('inventory_batches_quality_status_idx').on(table.qualityStatus),
}));

// Inventory reservations table for pending orders
export const inventoryReservations = pgTable('inventory_reservations', {
  ...baseSchema,
  
  // Product and location
  productId: varchar('product_id', { length: 255 }).notNull(),
  variantId: varchar('variant_id', { length: 255 }),
  locationId: varchar('location_id', { length: 255 }).notNull(),
  
  // Reservation details
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(),
  reservedFor: varchar('reserved_for', { length: 50 }).notNull(), // order, quote, transfer, etc.
  referenceId: varchar('reference_id', { length: 255 }).notNull(),
  
  // Batch/lot specific reservation
  batchNumber: varchar('batch_number', { length: 100 }),
  
  // Timing
  reservedUntil: timestamp('reserved_until', { withTimezone: true }),
  
  // Status
  status: varchar('status', { length: 50 }).default('active'), // active, fulfilled, expired, cancelled
  
  // Notes
  notes: varchar('notes', { length: 500 }),
}, (table) => ({
  // Performance indexes
  tenantIdIdx: index('inventory_reservations_tenant_id_idx').on(table.tenantId),
  productIdIdx: index('inventory_reservations_product_id_idx').on(table.productId),
  locationIdIdx: index('inventory_reservations_location_id_idx').on(table.locationId),
  referenceIdx: index('inventory_reservations_reference_idx').on(table.reservedFor, table.referenceId),
  statusIdx: index('inventory_reservations_status_idx').on(table.status),
  reservedUntilIdx: index('inventory_reservations_reserved_until_idx').on(table.reservedUntil),
}));

// Stock count sessions table for cycle counting
export const stockCountSessions = pgTable('stock_count_sessions', {
  ...baseSchema,
  
  // Session information
  sessionNumber: varchar('session_number', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1000 }),
  
  // Scope
  locationId: varchar('location_id', { length: 255 }).notNull(),
  categoryIds: jsonb('category_ids').default([]), // empty array means all categories
  productIds: jsonb('product_ids').default([]), // empty array means all products
  
  // Status and timing
  status: varchar('status', { length: 50 }).default('planned'), // planned, in_progress, completed, cancelled
  scheduledDate: timestamp('scheduled_date', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  // Assigned counters
  assignedTo: jsonb('assigned_to').default([]), // array of user IDs
  
  // Results summary
  totalItemsCounted: integer('total_items_counted').default(0),
  totalVariances: integer('total_variances').default(0),
  totalAdjustmentValue: decimal('total_adjustment_value', { precision: 15, scale: 2 }).default('0'),
  
  // Notes and comments
  notes: varchar('notes', { length: 1000 }),
}, (table) => ({
  // Unique constraint on tenant_id + session_number
  tenantSessionNumberIdx: unique('stock_count_sessions_tenant_session_number_unique').on(
    table.tenantId, 
    table.sessionNumber
  ),
  
  // Performance indexes
  tenantIdIdx: index('stock_count_sessions_tenant_id_idx').on(table.tenantId),
  locationIdIdx: index('stock_count_sessions_location_id_idx').on(table.locationId),
  statusIdx: index('stock_count_sessions_status_idx').on(table.status),
  scheduledDateIdx: index('stock_count_sessions_scheduled_date_idx').on(table.scheduledDate),
}));

// Stock count items table for individual count records
export const stockCountItems = pgTable('stock_count_items', {
  ...baseSchema,
  
  // Session reference
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  
  // Product information
  productId: varchar('product_id', { length: 255 }).notNull(),
  variantId: varchar('variant_id', { length: 255 }),
  
  // Count information
  expectedQuantity: decimal('expected_quantity', { precision: 12, scale: 3 }).notNull(),
  countedQuantity: decimal('counted_quantity', { precision: 12, scale: 3 }),
  variance: decimal('variance', { precision: 12, scale: 3 }),
  
  // Batch/lot information
  batchNumber: varchar('batch_number', { length: 100 }),
  binLocation: varchar('bin_location', { length: 100 }),
  
  // Count details
  countedBy: varchar('counted_by', { length: 255 }),
  countedAt: timestamp('counted_at', { withTimezone: true }),
  
  // Status and notes
  status: varchar('status', { length: 50 }).default('pending'), // pending, counted, adjusted, skipped
  notes: varchar('notes', { length: 500 }),
  
  // Adjustment tracking
  adjustmentId: varchar('adjustment_id', { length: 255 }), // reference to inventory movement
}, (table) => ({
  // Performance indexes
  tenantIdIdx: index('stock_count_items_tenant_id_idx').on(table.tenantId),
  sessionIdIdx: index('stock_count_items_session_id_idx').on(table.sessionId),
  productIdIdx: index('stock_count_items_product_id_idx').on(table.productId),
  statusIdx: index('stock_count_items_status_idx').on(table.status),
  countedByIdx: index('stock_count_items_counted_by_idx').on(table.countedBy),
}));