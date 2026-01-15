import { pgTable, varchar, text, decimal, jsonb, index, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseSchema } from './base.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';
import { suppliers } from './supplier.schema';
import { products } from './product.schema';
import { pgEnum } from 'drizzle-orm/pg-core';

// Purchase Order related enums
export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', [
  'draft',
  'pending_approval',
  'approved',
  'sent_to_supplier',
  'acknowledged',
  'partially_received',
  'fully_received',
  'cancelled',
  'closed',
]);

export const purchaseOrderPriorityEnum = pgEnum('purchase_order_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

export const receiptStatusEnum = pgEnum('receipt_status', [
  'pending',
  'partial',
  'complete',
  'over_received',
]);

export const invoiceMatchStatusEnum = pgEnum('invoice_match_status', [
  'pending',
  'matched',
  'variance',
  'disputed',
]);

export const purchaseOrderPaymentStatusEnum = pgEnum('purchase_order_payment_status', [
  'pending',
  'scheduled',
  'paid',
  'overdue',
  'disputed',
]);

// Purchase Orders table
export const purchaseOrders = pgTable('purchase_orders', {
  ...baseSchema,
  // Basic Information
  poNumber: varchar('po_number', { length: 50 }).notNull(),
  supplierId: varchar('supplier_id', { length: 36 }).notNull(),
  
  // Status and Priority
  status: purchaseOrderStatusEnum('status').default('draft').notNull(),
  priority: purchaseOrderPriorityEnum('priority').default('normal').notNull(),
  
  // Dates
  orderDate: timestamp('order_date', { withTimezone: true }).defaultNow().notNull(),
  requestedDeliveryDate: timestamp('requested_delivery_date', { withTimezone: true }),
  expectedDeliveryDate: timestamp('expected_delivery_date', { withTimezone: true }),
  actualDeliveryDate: timestamp('actual_delivery_date', { withTimezone: true }),
  
  // Financial Information
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0').notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  shippingAmount: decimal('shipping_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  
  // Delivery Information
  deliveryAddress: jsonb('delivery_address').default({}),
  billingAddress: jsonb('billing_address').default({}),
  shippingMethod: varchar('shipping_method', { length: 100 }),
  
  // Terms and Conditions
  paymentTerms: varchar('payment_terms', { length: 100 }),
  deliveryTerms: varchar('delivery_terms', { length: 100 }),
  
  // Additional Information
  description: text('description'),
  internalNotes: text('internal_notes'),
  supplierNotes: text('supplier_notes'),
  
  // Approval Information
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  approvalThreshold: decimal('approval_threshold', { precision: 15, scale: 2 }),
  
  // Tracking
  trackingNumber: varchar('tracking_number', { length: 100 }),
  
  // Custom Fields
  customFields: jsonb('custom_fields').default({}),
  tags: jsonb('tags').default([]),
  
  // Workflow
  workflowStage: varchar('workflow_stage', { length: 50 }),
  
}, (table) => ({
  // Indexes for performance
  tenantPoNumberIdx: index('idx_purchase_orders_tenant_po_number').on(table.tenantId, table.poNumber),
  tenantSupplierIdx: index('idx_purchase_orders_tenant_supplier').on(table.tenantId, table.supplierId),
  tenantStatusIdx: index('idx_purchase_orders_tenant_status').on(table.tenantId, table.status),
  tenantOrderDateIdx: index('idx_purchase_orders_tenant_order_date').on(table.tenantId, table.orderDate),
  tenantDeliveryDateIdx: index('idx_purchase_orders_tenant_delivery_date').on(table.tenantId, table.requestedDeliveryDate),
}));

// Purchase Order Items table
export const purchaseOrderItems = pgTable('purchase_order_items', {
  ...baseSchema,
  purchaseOrderId: varchar('purchase_order_id', { length: 36 }).notNull(),
  productId: varchar('product_id', { length: 36 }),
  
  // Item Information
  itemDescription: varchar('item_description', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  
  // Quantities
  quantityOrdered: decimal('quantity_ordered', { precision: 15, scale: 3 }).notNull(),
  quantityReceived: decimal('quantity_received', { precision: 15, scale: 3 }).default('0').notNull(),
  quantityInvoiced: decimal('quantity_invoiced', { precision: 15, scale: 3 }).default('0').notNull(),
  
  // Pricing
  unitPrice: decimal('unit_price', { precision: 15, scale: 4 }).notNull(),
  totalPrice: decimal('total_price', { precision: 15, scale: 2 }).notNull(),
  
  // Specifications
  specifications: jsonb('specifications').default({}),
  
  // Delivery
  requestedDeliveryDate: timestamp('requested_delivery_date', { withTimezone: true }),
  
  // Status
  receiptStatus: receiptStatusEnum('receipt_status').default('pending').notNull(),
  
  // Additional Information
  notes: text('notes'),
  customFields: jsonb('custom_fields').default({}),
  
}, (table) => ({
  tenantPoIdx: index('idx_purchase_order_items_tenant_po').on(table.tenantId, table.purchaseOrderId),
  tenantProductIdx: index('idx_purchase_order_items_tenant_product').on(table.tenantId, table.productId),
  tenantSkuIdx: index('idx_purchase_order_items_tenant_sku').on(table.tenantId, table.sku),
}));

// Purchase Order Approvals table
export const purchaseOrderApprovals = pgTable('purchase_order_approvals', {
  ...baseSchema,
  purchaseOrderId: varchar('purchase_order_id', { length: 36 }).notNull(),
  
  // Approval Information
  approverId: varchar('approver_id', { length: 36 }).notNull(),
  approvalLevel: integer('approval_level').notNull(),
  status: approvalStatusEnum('status').default('pending').notNull(),
  
  // Dates
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  
  // Comments
  comments: text('comments'),
  
  // Approval Rules
  approvalRule: varchar('approval_rule', { length: 100 }),
  
}, (table) => ({
  tenantPoIdx: index('idx_purchase_order_approvals_tenant_po').on(table.tenantId, table.purchaseOrderId),
  tenantApproverIdx: index('idx_purchase_order_approvals_tenant_approver').on(table.tenantId, table.approverId),
  tenantStatusIdx: index('idx_purchase_order_approvals_tenant_status').on(table.tenantId, table.status),
}));

// Purchase Order Receipts table
export const purchaseOrderReceipts = pgTable('purchase_order_receipts', {
  ...baseSchema,
  purchaseOrderId: varchar('purchase_order_id', { length: 36 }).notNull(),
  
  // Receipt Information
  receiptNumber: varchar('receipt_number', { length: 50 }).notNull(),
  receiptDate: timestamp('receipt_date', { withTimezone: true }).defaultNow().notNull(),
  receivedBy: varchar('received_by', { length: 36 }).notNull(),
  
  // Delivery Information
  deliveryNote: varchar('delivery_note', { length: 100 }),
  carrierName: varchar('carrier_name', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  
  // Quality Information
  qualityCheck: boolean('quality_check').default(false),
  qualityNotes: text('quality_notes'),
  
  // Additional Information
  notes: text('notes'),
  attachments: jsonb('attachments').default([]),
  
}, (table) => ({
  tenantPoIdx: index('idx_purchase_order_receipts_tenant_po').on(table.tenantId, table.purchaseOrderId),
  tenantReceiptNumberIdx: index('idx_purchase_order_receipts_tenant_receipt_number').on(table.tenantId, table.receiptNumber),
  tenantReceiptDateIdx: index('idx_purchase_order_receipts_tenant_receipt_date').on(table.tenantId, table.receiptDate),
}));

// Purchase Order Receipt Items table
export const purchaseOrderReceiptItems = pgTable('purchase_order_receipt_items', {
  ...baseSchema,
  receiptId: varchar('receipt_id', { length: 36 }).notNull(),
  purchaseOrderItemId: varchar('purchase_order_item_id', { length: 36 }).notNull(),
  
  // Quantities
  quantityReceived: decimal('quantity_received', { precision: 15, scale: 3 }).notNull(),
  quantityAccepted: decimal('quantity_accepted', { precision: 15, scale: 3 }).notNull(),
  quantityRejected: decimal('quantity_rejected', { precision: 15, scale: 3 }).default('0').notNull(),
  
  // Quality Information
  conditionNotes: text('condition_notes'),
  rejectionReason: text('rejection_reason'),
  
  // Location Information
  locationId: varchar('location_id', { length: 36 }),
  binLocation: varchar('bin_location', { length: 50 }),
  
}, (table) => ({
  tenantReceiptIdx: index('idx_purchase_order_receipt_items_tenant_receipt').on(table.tenantId, table.receiptId),
  tenantPoItemIdx: index('idx_purchase_order_receipt_items_tenant_po_item').on(table.tenantId, table.purchaseOrderItemId),
}));

// Purchase Order Invoices table (for three-way matching)
export const purchaseOrderInvoices = pgTable('purchase_order_invoices', {
  ...baseSchema,
  purchaseOrderId: varchar('purchase_order_id', { length: 36 }).notNull(),
  
  // Invoice Information
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  invoiceDate: timestamp('invoice_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  
  // Financial Information
  invoiceAmount: decimal('invoice_amount', { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  
  // Matching Information
  matchStatus: invoiceMatchStatusEnum('match_status').default('pending').notNull(),
  matchedAmount: decimal('matched_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  varianceAmount: decimal('variance_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  
  // Payment Information
  paymentStatus: purchaseOrderPaymentStatusEnum('payment_status').default('pending').notNull(),
  paymentDate: timestamp('payment_date', { withTimezone: true }),
  paymentAmount: decimal('payment_amount', { precision: 15, scale: 2 }),
  
  // Additional Information
  description: text('description'),
  notes: text('notes'),
  attachments: jsonb('attachments').default([]),
  
}, (table) => ({
  tenantPoIdx: index('idx_purchase_order_invoices_tenant_po').on(table.tenantId, table.purchaseOrderId),
  tenantInvoiceNumberIdx: index('idx_purchase_order_invoices_tenant_invoice_number').on(table.tenantId, table.invoiceNumber),
  tenantInvoiceDateIdx: index('idx_purchase_order_invoices_tenant_invoice_date').on(table.tenantId, table.invoiceDate),
  tenantMatchStatusIdx: index('idx_purchase_order_invoices_tenant_match_status').on(table.tenantId, table.matchStatus),
  tenantPaymentStatusIdx: index('idx_purchase_order_invoices_tenant_payment_status').on(table.tenantId, table.paymentStatus),
}));

// Purchase Order Invoice Items table
export const purchaseOrderInvoiceItems = pgTable('purchase_order_invoice_items', {
  ...baseSchema,
  invoiceId: varchar('invoice_id', { length: 36 }).notNull(),
  purchaseOrderItemId: varchar('purchase_order_item_id', { length: 36 }),
  
  // Item Information
  description: varchar('description', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  
  // Quantities and Pricing
  quantity: decimal('quantity', { precision: 15, scale: 3 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 4 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  
  // Matching Information
  matchedQuantity: decimal('matched_quantity', { precision: 15, scale: 3 }).default('0').notNull(),
  varianceQuantity: decimal('variance_quantity', { precision: 15, scale: 3 }).default('0').notNull(),
  varianceAmount: decimal('variance_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  
}, (table) => ({
  tenantInvoiceIdx: index('idx_purchase_order_invoice_items_tenant_invoice').on(table.tenantId, table.invoiceId),
  tenantPoItemIdx: index('idx_purchase_order_invoice_items_tenant_po_item').on(table.tenantId, table.purchaseOrderItemId),
}));

// Define relationships
export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [purchaseOrders.tenantId],
    references: [tenants.id],
  }),
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  createdByUser: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [purchaseOrders.updatedBy],
    references: [users.id],
  }),
  items: many(purchaseOrderItems),
  approvals: many(purchaseOrderApprovals),
  receipts: many(purchaseOrderReceipts),
  invoices: many(purchaseOrderInvoices),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [purchaseOrderItems.productId],
    references: [products.id],
  }),
  tenant: one(tenants, {
    fields: [purchaseOrderItems.tenantId],
    references: [tenants.id],
  }),
  receiptItems: many(purchaseOrderReceiptItems),
  invoiceItems: many(purchaseOrderInvoiceItems),
}));

export const purchaseOrderApprovalsRelations = relations(purchaseOrderApprovals, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderApprovals.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  approver: one(users, {
    fields: [purchaseOrderApprovals.approverId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [purchaseOrderApprovals.tenantId],
    references: [tenants.id],
  }),
}));

export const purchaseOrderReceiptsRelations = relations(purchaseOrderReceipts, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderReceipts.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  receivedByUser: one(users, {
    fields: [purchaseOrderReceipts.receivedBy],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [purchaseOrderReceipts.tenantId],
    references: [tenants.id],
  }),
  items: many(purchaseOrderReceiptItems),
}));

export const purchaseOrderReceiptItemsRelations = relations(purchaseOrderReceiptItems, ({ one }) => ({
  receipt: one(purchaseOrderReceipts, {
    fields: [purchaseOrderReceiptItems.receiptId],
    references: [purchaseOrderReceipts.id],
  }),
  purchaseOrderItem: one(purchaseOrderItems, {
    fields: [purchaseOrderReceiptItems.purchaseOrderItemId],
    references: [purchaseOrderItems.id],
  }),
  tenant: one(tenants, {
    fields: [purchaseOrderReceiptItems.tenantId],
    references: [tenants.id],
  }),
}));

export const purchaseOrderInvoicesRelations = relations(purchaseOrderInvoices, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderInvoices.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  tenant: one(tenants, {
    fields: [purchaseOrderInvoices.tenantId],
    references: [tenants.id],
  }),
  items: many(purchaseOrderInvoiceItems),
}));

export const purchaseOrderInvoiceItemsRelations = relations(purchaseOrderInvoiceItems, ({ one }) => ({
  invoice: one(purchaseOrderInvoices, {
    fields: [purchaseOrderInvoiceItems.invoiceId],
    references: [purchaseOrderInvoices.id],
  }),
  purchaseOrderItem: one(purchaseOrderItems, {
    fields: [purchaseOrderInvoiceItems.purchaseOrderItemId],
    references: [purchaseOrderItems.id],
  }),
  tenant: one(tenants, {
    fields: [purchaseOrderInvoiceItems.tenantId],
    references: [tenants.id],
  }),
}));