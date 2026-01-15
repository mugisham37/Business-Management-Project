import { pgTable, varchar, text, decimal, jsonb, index, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseSchema } from './base.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';
import { pgEnum } from 'drizzle-orm/pg-core';

// Supplier-related enums
export const supplierStatusEnum = pgEnum('supplier_status', [
  'active',
  'inactive',
  'pending_approval',
  'suspended',
  'blacklisted',
]);

export const supplierTypeEnum = pgEnum('supplier_type', [
  'manufacturer',
  'distributor',
  'wholesaler',
  'service_provider',
  'contractor',
  'consultant',
]);

export const supplierRatingEnum = pgEnum('supplier_rating', [
  'excellent',
  'good',
  'average',
  'poor',
  'unrated',
]);

export const communicationTypeEnum = pgEnum('communication_type', [
  'email',
  'phone',
  'meeting',
  'video_call',
  'chat',
  'letter',
  'fax',
]);

export const communicationDirectionEnum = pgEnum('communication_direction', [
  'inbound',
  'outbound',
]);

export const evaluationCriteriaEnum = pgEnum('evaluation_criteria', [
  'quality',
  'delivery_time',
  'pricing',
  'customer_service',
  'reliability',
  'compliance',
  'innovation',
  'sustainability',
]);

// Suppliers table
export const suppliers = pgTable('suppliers', {
  ...baseSchema,
  // Basic Information
  supplierCode: varchar('supplier_code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  legalName: varchar('legal_name', { length: 255 }),
  supplierType: supplierTypeEnum('supplier_type').notNull(),
  status: supplierStatusEnum('status').default('pending_approval').notNull(),
  
  // Contact Information
  primaryContactName: varchar('primary_contact_name', { length: 100 }),
  primaryContactTitle: varchar('primary_contact_title', { length: 100 }),
  primaryContactEmail: varchar('primary_contact_email', { length: 255 }),
  primaryContactPhone: varchar('primary_contact_phone', { length: 50 }),
  
  // Address Information
  addressLine1: varchar('address_line1', { length: 255 }),
  addressLine2: varchar('address_line2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 100 }),
  
  // Business Information
  taxId: varchar('tax_id', { length: 50 }),
  businessRegistrationNumber: varchar('business_registration_number', { length: 100 }),
  website: varchar('website', { length: 255 }),
  description: text('description'),
  
  // Financial Information
  paymentTerms: varchar('payment_terms', { length: 100 }),
  creditLimit: decimal('credit_limit', { precision: 15, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('USD'),
  
  // Performance Metrics
  overallRating: supplierRatingEnum('overall_rating').default('unrated'),
  qualityRating: decimal('quality_rating', { precision: 3, scale: 2 }),
  deliveryRating: decimal('delivery_rating', { precision: 3, scale: 2 }),
  serviceRating: decimal('service_rating', { precision: 3, scale: 2 }),
  
  // Compliance and Certifications
  certifications: jsonb('certifications').default([]),
  complianceDocuments: jsonb('compliance_documents').default([]),
  
  // Additional Information
  tags: jsonb('tags').default([]),
  customFields: jsonb('custom_fields').default({}),
  notes: text('notes'),
  
  // Preferences
  preferredCommunicationMethod: communicationTypeEnum('preferred_communication_method').default('email'),
  isPreferredSupplier: boolean('is_preferred_supplier').default(false),
  
  // Audit fields
  lastEvaluationDate: timestamp('last_evaluation_date', { withTimezone: true }),
  nextEvaluationDate: timestamp('next_evaluation_date', { withTimezone: true }),
}, (table) => ({
  // Indexes for performance
  tenantSupplierCodeIdx: index('idx_suppliers_tenant_code').on(table.tenantId, table.supplierCode),
  tenantNameIdx: index('idx_suppliers_tenant_name').on(table.tenantId, table.name),
  tenantStatusIdx: index('idx_suppliers_tenant_status').on(table.tenantId, table.status),
  tenantTypeIdx: index('idx_suppliers_tenant_type').on(table.tenantId, table.supplierType),
  tenantRatingIdx: index('idx_suppliers_tenant_rating').on(table.tenantId, table.overallRating),
}));

// Supplier contacts table for multiple contacts per supplier
export const supplierContacts = pgTable('supplier_contacts', {
  ...baseSchema,
  supplierId: varchar('supplier_id', { length: 36 }).notNull(),
  
  // Contact Information
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  title: varchar('title', { length: 100 }),
  department: varchar('department', { length: 100 }),
  
  // Contact Details
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  mobile: varchar('mobile', { length: 50 }),
  fax: varchar('fax', { length: 50 }),
  
  // Preferences
  isPrimary: boolean('is_primary').default(false),
  preferredContactMethod: communicationTypeEnum('preferred_contact_method').default('email'),
  
  // Additional Information
  notes: text('notes'),
  customFields: jsonb('custom_fields').default({}),
}, (table) => ({
  tenantSupplierIdx: index('idx_supplier_contacts_tenant_supplier').on(table.tenantId, table.supplierId),
  tenantPrimaryIdx: index('idx_supplier_contacts_tenant_primary').on(table.tenantId, table.isPrimary),
}));

// Supplier communication history
export const supplierCommunications = pgTable('supplier_communications', {
  ...baseSchema,
  supplierId: varchar('supplier_id', { length: 36 }).notNull(),
  contactId: varchar('contact_id', { length: 36 }), // Optional - can be null for general communications
  
  // Communication Details
  type: communicationTypeEnum('type').notNull(),
  direction: communicationDirectionEnum('direction').notNull(),
  subject: varchar('subject', { length: 255 }),
  content: text('content'),
  
  // Participants
  fromName: varchar('from_name', { length: 255 }),
  fromEmail: varchar('from_email', { length: 255 }),
  toName: varchar('to_name', { length: 255 }),
  toEmail: varchar('to_email', { length: 255 }),
  
  // Metadata
  communicationDate: timestamp('communication_date', { withTimezone: true }).defaultNow().notNull(),
  followUpRequired: boolean('follow_up_required').default(false),
  followUpDate: timestamp('follow_up_date', { withTimezone: true }),
  
  // Attachments and References
  attachments: jsonb('attachments').default([]),
  relatedDocuments: jsonb('related_documents').default([]),
  
  // Additional Information
  tags: jsonb('tags').default([]),
  customFields: jsonb('custom_fields').default({}),
}, (table) => ({
  tenantSupplierIdx: index('idx_supplier_communications_tenant_supplier').on(table.tenantId, table.supplierId),
  tenantDateIdx: index('idx_supplier_communications_tenant_date').on(table.tenantId, table.communicationDate),
  tenantTypeIdx: index('idx_supplier_communications_tenant_type').on(table.tenantId, table.type),
  tenantFollowUpIdx: index('idx_supplier_communications_tenant_followup').on(table.tenantId, table.followUpRequired),
}));

// Supplier evaluations
export const supplierEvaluations = pgTable('supplier_evaluations', {
  ...baseSchema,
  supplierId: varchar('supplier_id', { length: 36 }).notNull(),
  
  // Evaluation Details
  evaluationPeriodStart: timestamp('evaluation_period_start', { withTimezone: true }).notNull(),
  evaluationPeriodEnd: timestamp('evaluation_period_end', { withTimezone: true }).notNull(),
  evaluationDate: timestamp('evaluation_date', { withTimezone: true }).defaultNow().notNull(),
  evaluatorId: varchar('evaluator_id', { length: 36 }).notNull(),
  
  // Overall Scores
  overallScore: decimal('overall_score', { precision: 5, scale: 2 }).notNull(),
  overallRating: supplierRatingEnum('overall_rating').notNull(),
  
  // Detailed Scores
  qualityScore: decimal('quality_score', { precision: 5, scale: 2 }),
  deliveryScore: decimal('delivery_score', { precision: 5, scale: 2 }),
  pricingScore: decimal('pricing_score', { precision: 5, scale: 2 }),
  serviceScore: decimal('service_score', { precision: 5, scale: 2 }),
  reliabilityScore: decimal('reliability_score', { precision: 5, scale: 2 }),
  complianceScore: decimal('compliance_score', { precision: 5, scale: 2 }),
  
  // Performance Metrics
  onTimeDeliveryRate: decimal('on_time_delivery_rate', { precision: 5, scale: 2 }),
  qualityDefectRate: decimal('quality_defect_rate', { precision: 5, scale: 2 }),
  responseTime: integer('response_time'), // in hours
  
  // Comments and Recommendations
  strengths: text('strengths'),
  weaknesses: text('weaknesses'),
  recommendations: text('recommendations'),
  actionItems: jsonb('action_items').default([]),
  
  // Status
  isApproved: boolean('is_approved').default(false),
  approvedBy: varchar('approved_by', { length: 36 }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  // Additional Information
  customScores: jsonb('custom_scores').default({}),
  attachments: jsonb('attachments').default([]),
}, (table) => ({
  tenantSupplierIdx: index('idx_supplier_evaluations_tenant_supplier').on(table.tenantId, table.supplierId),
  tenantDateIdx: index('idx_supplier_evaluations_tenant_date').on(table.tenantId, table.evaluationDate),
  tenantRatingIdx: index('idx_supplier_evaluations_tenant_rating').on(table.tenantId, table.overallRating),
  tenantApprovedIdx: index('idx_supplier_evaluations_tenant_approved').on(table.tenantId, table.isApproved),
}));

// Supplier performance metrics (aggregated data)
export const supplierPerformanceMetrics = pgTable('supplier_performance_metrics', {
  ...baseSchema,
  supplierId: varchar('supplier_id', { length: 36 }).notNull(),
  
  // Time Period
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  
  // Order Metrics
  totalOrders: integer('total_orders').default(0),
  completedOrders: integer('completed_orders').default(0),
  cancelledOrders: integer('cancelled_orders').default(0),
  
  // Delivery Metrics
  onTimeDeliveries: integer('on_time_deliveries').default(0),
  lateDeliveries: integer('late_deliveries').default(0),
  averageDeliveryTime: decimal('average_delivery_time', { precision: 8, scale: 2 }), // in days
  
  // Quality Metrics
  totalItemsReceived: integer('total_items_received').default(0),
  defectiveItems: integer('defective_items').default(0),
  returnedItems: integer('returned_items').default(0),
  
  // Financial Metrics
  totalSpend: decimal('total_spend', { precision: 15, scale: 2 }).default('0'),
  averageOrderValue: decimal('average_order_value', { precision: 15, scale: 2 }),
  costSavings: decimal('cost_savings', { precision: 15, scale: 2 }).default('0'),
  
  // Communication Metrics
  averageResponseTime: decimal('average_response_time', { precision: 8, scale: 2 }), // in hours
  communicationCount: integer('communication_count').default(0),
  
  // Calculated Rates
  completionRate: decimal('completion_rate', { precision: 5, scale: 2 }),
  onTimeDeliveryRate: decimal('on_time_delivery_rate', { precision: 5, scale: 2 }),
  qualityRate: decimal('quality_rate', { precision: 5, scale: 2 }),
  
  // Additional Metrics
  customMetrics: jsonb('custom_metrics').default({}),
}, (table) => ({
  tenantSupplierIdx: index('idx_supplier_performance_tenant_supplier').on(table.tenantId, table.supplierId),
  tenantPeriodIdx: index('idx_supplier_performance_tenant_period').on(table.tenantId, table.periodStart, table.periodEnd),
}));

// Define relationships
export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [suppliers.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [suppliers.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [suppliers.updatedBy],
    references: [users.id],
  }),
  contacts: many(supplierContacts),
  communications: many(supplierCommunications),
  evaluations: many(supplierEvaluations),
  performanceMetrics: many(supplierPerformanceMetrics),
}));

export const supplierContactsRelations = relations(supplierContacts, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierContacts.supplierId],
    references: [suppliers.id],
  }),
  tenant: one(tenants, {
    fields: [supplierContacts.tenantId],
    references: [tenants.id],
  }),
}));

export const supplierCommunicationsRelations = relations(supplierCommunications, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierCommunications.supplierId],
    references: [suppliers.id],
  }),
  contact: one(supplierContacts, {
    fields: [supplierCommunications.contactId],
    references: [supplierContacts.id],
  }),
  tenant: one(tenants, {
    fields: [supplierCommunications.tenantId],
    references: [tenants.id],
  }),
}));

export const supplierEvaluationsRelations = relations(supplierEvaluations, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierEvaluations.supplierId],
    references: [suppliers.id],
  }),
  evaluator: one(users, {
    fields: [supplierEvaluations.evaluatorId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [supplierEvaluations.approvedBy],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [supplierEvaluations.tenantId],
    references: [tenants.id],
  }),
}));

export const supplierPerformanceMetricsRelations = relations(supplierPerformanceMetrics, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierPerformanceMetrics.supplierId],
    references: [suppliers.id],
  }),
  tenant: one(tenants, {
    fields: [supplierPerformanceMetrics.tenantId],
    references: [tenants.id],
  }),
}));