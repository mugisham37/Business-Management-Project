import { pgTable, uuid, varchar, text, decimal, integer, boolean, timestamp, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { baseSchema } from './base.schema';
import { customers } from './customer.schema';
import { users } from './user.schema';
import { products } from './product.schema';

// Enums for B2B operations
export const orderStatusEnum = pgEnum('b2b_order_status', [
  'draft',
  'pending_approval',
  'approved',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'on_hold'
]);

export const quoteStatusEnum = pgEnum('quote_status', [
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted'
]);

export const contractStatusEnum = pgEnum('contract_status', [
  'draft',
  'pending_approval',
  'active',
  'expired',
  'terminated',
  'renewed'
]);

export const territoryTypeEnum = pgEnum('territory_type', [
  'geographic',
  'industry',
  'account_size',
  'product_line',
  'custom'
]);

// B2B Orders table
export const b2bOrders: any = pgTable('b2b_orders', {
  ...baseSchema,
  
  // Order identification
  orderNumber: varchar('order_number', { length: 100 }).notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  quoteId: uuid('quote_id').references(() => quotes.id),
  
  // Order details
  status: orderStatusEnum('status').default('draft').notNull(),
  orderDate: timestamp('order_date', { withTimezone: true }).defaultNow().notNull(),
  requestedDeliveryDate: timestamp('requested_delivery_date', { withTimezone: true }),
  confirmedDeliveryDate: timestamp('confirmed_delivery_date', { withTimezone: true }),
  
  // Financial information
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  shippingAmount: decimal('shipping_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  
  // Payment terms
  paymentTerms: varchar('payment_terms', { length: 50 }).notNull(),
  paymentDueDate: timestamp('payment_due_date', { withTimezone: true }),
  
  // Shipping information
  shippingMethod: varchar('shipping_method', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  shippingAddress: jsonb('shipping_address').notNull(),
  billingAddress: jsonb('billing_address').notNull(),
  
  // Approval workflow
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvalNotes: text('approval_notes'),
  
  // Sales information
  salesRepId: uuid('sales_rep_id').references(() => users.id),
  accountManagerId: uuid('account_manager_id').references(() => users.id),
  
  // Special instructions
  specialInstructions: text('special_instructions'),
  internalNotes: text('internal_notes'),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  orderNumberIdx: index('b2b_orders_order_number_idx').on(table.orderNumber),
  customerIdIdx: index('b2b_orders_customer_id_idx').on(table.customerId),
  statusIdx: index('b2b_orders_status_idx').on(table.status),
  orderDateIdx: index('b2b_orders_order_date_idx').on(table.orderDate),
  salesRepIdIdx: index('b2b_orders_sales_rep_id_idx').on(table.salesRepId),
  tenantIdIdx: index('b2b_orders_tenant_id_idx').on(table.tenantId),
}));

// B2B Order Items table
export const b2bOrderItems = pgTable('b2b_order_items', {
  ...baseSchema,
  
  orderId: uuid('order_id').notNull().references(() => b2bOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  
  // Item details
  sku: varchar('sku', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Pricing and quantity
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  listPrice: decimal('list_price', { precision: 10, scale: 2 }).notNull(),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0').notNull(),
  lineTotal: decimal('line_total', { precision: 12, scale: 2 }).notNull(),
  
  // Fulfillment
  quantityShipped: decimal('quantity_shipped', { precision: 12, scale: 3 }).default('0').notNull(),
  quantityBackordered: decimal('quantity_backordered', { precision: 12, scale: 3 }).default('0').notNull(),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  orderIdIdx: index('b2b_order_items_order_id_idx').on(table.orderId),
  productIdIdx: index('b2b_order_items_product_id_idx').on(table.productId),
  skuIdx: index('b2b_order_items_sku_idx').on(table.sku),
  tenantIdIdx: index('b2b_order_items_tenant_id_idx').on(table.tenantId),
}));

// Quotes table
export const quotes: any = pgTable('quotes', {
  ...baseSchema,
  
  // Quote identification
  quoteNumber: varchar('quote_number', { length: 100 }).notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  
  // Quote details
  status: quoteStatusEnum('status').default('draft').notNull(),
  quoteDate: timestamp('quote_date', { withTimezone: true }).defaultNow().notNull(),
  expirationDate: timestamp('expiration_date', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  
  // Financial information
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  shippingAmount: decimal('shipping_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  
  // Terms and conditions
  paymentTerms: varchar('payment_terms', { length: 50 }).notNull(),
  deliveryTerms: varchar('delivery_terms', { length: 100 }),
  termsAndConditions: text('terms_and_conditions'),
  
  // Approval workflow
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvalNotes: text('approval_notes'),
  
  // Sales information
  salesRepId: uuid('sales_rep_id').references(() => users.id),
  accountManagerId: uuid('account_manager_id').references(() => users.id),
  
  // Customer response
  customerResponse: varchar('customer_response', { length: 50 }), // 'accepted', 'rejected', 'negotiating'
  customerResponseDate: timestamp('customer_response_date', { withTimezone: true }),
  customerNotes: text('customer_notes'),
  
  // Conversion tracking
  convertedToOrderId: uuid('converted_to_order_id').references(() => b2bOrders.id),
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  
  // Special instructions
  specialInstructions: text('special_instructions'),
  internalNotes: text('internal_notes'),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  quoteNumberIdx: index('quotes_quote_number_idx').on(table.quoteNumber),
  customerIdIdx: index('quotes_customer_id_idx').on(table.customerId),
  statusIdx: index('quotes_status_idx').on(table.status),
  quoteDateIdx: index('quotes_quote_date_idx').on(table.quoteDate),
  expirationDateIdx: index('quotes_expiration_date_idx').on(table.expirationDate),
  salesRepIdIdx: index('quotes_sales_rep_id_idx').on(table.salesRepId),
  tenantIdIdx: index('quotes_tenant_id_idx').on(table.tenantId),
}));

// Quote Items table
export const quoteItems = pgTable('quote_items', {
  ...baseSchema,
  
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  
  // Item details
  sku: varchar('sku', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Pricing and quantity
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  listPrice: decimal('list_price', { precision: 10, scale: 2 }).notNull(),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0').notNull(),
  lineTotal: decimal('line_total', { precision: 12, scale: 2 }).notNull(),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  quoteIdIdx: index('quote_items_quote_id_idx').on(table.quoteId),
  productIdIdx: index('quote_items_product_id_idx').on(table.productId),
  skuIdx: index('quote_items_sku_idx').on(table.sku),
  tenantIdIdx: index('quote_items_tenant_id_idx').on(table.tenantId),
}));

// Contracts table
export const contracts = pgTable('contracts', {
  ...baseSchema,
  
  // Contract identification
  contractNumber: varchar('contract_number', { length: 100 }).notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  
  // Contract details
  status: contractStatusEnum('status').default('draft').notNull(),
  contractType: varchar('contract_type', { length: 50 }).notNull(), // 'pricing', 'volume', 'exclusive', 'service'
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  
  // Contract period
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  autoRenewal: boolean('auto_renewal').default(false).notNull(),
  renewalTermMonths: integer('renewal_term_months'),
  renewalNoticeDays: integer('renewal_notice_days').default(30).notNull(),
  
  // Financial terms
  contractValue: decimal('contract_value', { precision: 15, scale: 2 }),
  minimumCommitment: decimal('minimum_commitment', { precision: 15, scale: 2 }),
  paymentTerms: varchar('payment_terms', { length: 50 }).notNull(),
  
  // Pricing terms
  pricingModel: varchar('pricing_model', { length: 50 }).notNull(), // 'fixed', 'tiered', 'volume', 'cost_plus'
  pricingTerms: jsonb('pricing_terms').default({}),
  
  // Performance metrics
  performanceMetrics: jsonb('performance_metrics').default({}),
  complianceRequirements: jsonb('compliance_requirements').default({}),
  
  // Approval and signatures
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  signedBy: uuid('signed_by').references(() => users.id),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  customerSignedAt: timestamp('customer_signed_at', { withTimezone: true }),
  
  // Sales information
  salesRepId: uuid('sales_rep_id').references(() => users.id),
  accountManagerId: uuid('account_manager_id').references(() => users.id),
  
  // Terms and conditions
  termsAndConditions: text('terms_and_conditions'),
  specialTerms: text('special_terms'),
  
  // Renewal tracking
  renewalDate: timestamp('renewal_date', { withTimezone: true }),
  renewalNotificationSent: boolean('renewal_notification_sent').default(false).notNull(),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  contractNumberIdx: index('contracts_contract_number_idx').on(table.contractNumber),
  customerIdIdx: index('contracts_customer_id_idx').on(table.customerId),
  statusIdx: index('contracts_status_idx').on(table.status),
  startDateIdx: index('contracts_start_date_idx').on(table.startDate),
  endDateIdx: index('contracts_end_date_idx').on(table.endDate),
  renewalDateIdx: index('contracts_renewal_date_idx').on(table.renewalDate),
  salesRepIdIdx: index('contracts_sales_rep_id_idx').on(table.salesRepId),
  tenantIdIdx: index('contracts_tenant_id_idx').on(table.tenantId),
}));

// Sales Territories table
export const salesTerritories = pgTable('sales_territories', {
  ...baseSchema,
  
  // Territory identification
  territoryCode: varchar('territory_code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Territory configuration
  territoryType: territoryTypeEnum('territory_type').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  
  // Geographic boundaries (for geographic territories)
  geographicBounds: jsonb('geographic_bounds').default({}), // countries, states, zip codes, etc.
  
  // Industry/segment criteria (for industry territories)
  industryCriteria: jsonb('industry_criteria').default([]),
  
  // Account size criteria (for account size territories)
  accountSizeCriteria: jsonb('account_size_criteria').default({}),
  
  // Product line criteria (for product line territories)
  productLineCriteria: jsonb('product_line_criteria').default([]),
  
  // Custom criteria (for custom territories)
  customCriteria: jsonb('custom_criteria').default({}),
  
  // Sales team assignments
  primarySalesRepId: uuid('primary_sales_rep_id').references(() => users.id),
  secondarySalesRepIds: jsonb('secondary_sales_rep_ids').default([]),
  managerId: uuid('manager_id').references(() => users.id),
  
  // Performance targets
  annualRevenueTarget: decimal('annual_revenue_target', { precision: 15, scale: 2 }),
  quarterlyRevenueTarget: decimal('quarterly_revenue_target', { precision: 15, scale: 2 }),
  customerAcquisitionTarget: integer('customer_acquisition_target'),
  
  // Commission structure
  commissionStructure: jsonb('commission_structure').default({}),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  territoryCodeIdx: index('sales_territories_territory_code_idx').on(table.territoryCode),
  territoryTypeIdx: index('sales_territories_territory_type_idx').on(table.territoryType),
  primarySalesRepIdIdx: index('sales_territories_primary_sales_rep_id_idx').on(table.primarySalesRepId),
  managerIdIdx: index('sales_territories_manager_id_idx').on(table.managerId),
  isActiveIdx: index('sales_territories_is_active_idx').on(table.isActive),
  tenantIdIdx: index('sales_territories_tenant_id_idx').on(table.tenantId),
}));

// Territory Customer Assignments table
export const territoryCustomerAssignments = pgTable('territory_customer_assignments', {
  ...baseSchema,
  
  territoryId: uuid('territory_id').notNull().references(() => salesTerritories.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
  // Assignment details
  assignedDate: timestamp('assigned_date', { withTimezone: true }).defaultNow().notNull(),
  assignedBy: uuid('assigned_by').references(() => users.id),
  isActive: boolean('is_active').default(true).notNull(),
  
  // Assignment reason
  assignmentReason: varchar('assignment_reason', { length: 100 }), // 'geographic', 'industry', 'account_size', 'manual'
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  territoryIdIdx: index('territory_customer_assignments_territory_id_idx').on(table.territoryId),
  customerIdIdx: index('territory_customer_assignments_customer_id_idx').on(table.customerId),
  assignedDateIdx: index('territory_customer_assignments_assigned_date_idx').on(table.assignedDate),
  isActiveIdx: index('territory_customer_assignments_is_active_idx').on(table.isActive),
  tenantIdIdx: index('territory_customer_assignments_tenant_id_idx').on(table.tenantId),
  // Unique constraint to prevent duplicate assignments
  uniqueAssignment: index('territory_customer_assignments_unique').on(table.territoryId, table.customerId, table.tenantId),
}));