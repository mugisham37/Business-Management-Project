import { pgTable, varchar, text, boolean, jsonb, index, unique, timestamp, uuid, decimal, integer, pgEnum } from 'drizzle-orm/pg-core';
import { baseSchema } from './base.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';

// Enums for customer-related fields
export const customerTypeEnum = pgEnum('customer_type', [
  'individual',
  'business'
]);

export const customerStatusEnum = pgEnum('customer_status', [
  'active',
  'inactive',
  'blocked',
  'prospect'
]);

export const loyaltyTierEnum = pgEnum('loyalty_tier', [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond'
]);

export const communicationChannelEnum = pgEnum('communication_channel', [
  'email',
  'sms',
  'phone',
  'in_person',
  'chat',
  'social_media'
]);

export const segmentTypeEnum = pgEnum('segment_type', [
  'demographic',
  'behavioral',
  'geographic',
  'psychographic',
  'value_based'
]);

export const paymentTermsEnum = pgEnum('payment_terms', [
  'net_15',
  'net_30',
  'net_45',
  'net_60',
  'net_90',
  'cod',
  'prepaid',
  'custom'
]);

export const creditStatusEnum = pgEnum('credit_status', [
  'approved',
  'pending',
  'rejected',
  'suspended',
  'under_review'
]);

export const pricingTierEnum = pgEnum('pricing_tier', [
  'standard',
  'preferred',
  'premium',
  'enterprise',
  'custom'
]);

// Main customers table
export const customers: any = pgTable('customers', {
  ...baseSchema,
  
  // Basic information
  customerNumber: varchar('customer_number', { length: 50 }).notNull().unique(),
  type: customerTypeEnum('type').default('individual').notNull(),
  status: customerStatusEnum('status').default('active').notNull(),
  
  // Personal/Business information
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  displayName: varchar('display_name', { length: 200 }),
  companyName: varchar('company_name', { length: 255 }),
  
  // Contact information
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  alternatePhone: varchar('alternate_phone', { length: 50 }),
  website: varchar('website', { length: 255 }),
  
  // Address information
  addressLine1: varchar('address_line1', { length: 255 }),
  addressLine2: varchar('address_line2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 100 }),
  
  // Business information (for B2B customers)
  taxId: varchar('tax_id', { length: 50 }),
  creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).default('0.00'),
  paymentTerms: integer('payment_terms').default(0), // Days
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).default('0.00'),
  
  // Loyalty program
  loyaltyTier: loyaltyTierEnum('loyalty_tier').default('bronze'),
  loyaltyPoints: integer('loyalty_points').default(0).notNull(),
  loyaltyPointsLifetime: integer('loyalty_points_lifetime').default(0).notNull(),
  
  // Customer analytics
  totalSpent: decimal('total_spent', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalOrders: integer('total_orders').default(0).notNull(),
  averageOrderValue: decimal('average_order_value', { precision: 10, scale: 2 }).default('0.00').notNull(),
  lastPurchaseDate: timestamp('last_purchase_date', { withTimezone: true }),
  firstPurchaseDate: timestamp('first_purchase_date', { withTimezone: true }),
  
  // Customer lifetime value
  lifetimeValue: decimal('lifetime_value', { precision: 12, scale: 2 }).default('0.00').notNull(),
  predictedLifetimeValue: decimal('predicted_lifetime_value', { precision: 12, scale: 2 }).default('0.00').notNull(),
  churnRisk: decimal('churn_risk', { precision: 5, scale: 4 }).default('0.0000'), // 0-1 probability
  
  // Preferences and settings
  preferences: jsonb('preferences').default({}),
  marketingOptIn: boolean('marketing_opt_in').default(false),
  emailOptIn: boolean('email_opt_in').default(false),
  smsOptIn: boolean('sms_opt_in').default(false),
  
  // Additional metadata
  tags: jsonb('tags').default([]),
  customFields: jsonb('custom_fields').default({}),
  notes: text('notes'),
  
  // Referral information
  referredBy: uuid('referred_by'),
  referralCode: varchar('referral_code', { length: 50 }),
  
  // Social media
  socialProfiles: jsonb('social_profiles').default({}),
  
  // Birthday and anniversary for marketing
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  anniversary: timestamp('anniversary', { withTimezone: true }),
}, (table) => ({
  // Unique constraints
  tenantCustomerNumberIdx: unique('customers_tenant_customer_number_unique').on(
    table.tenantId, 
    table.customerNumber
  ),
  tenantEmailIdx: unique('customers_tenant_email_unique').on(
    table.tenantId, 
    table.email
  ),
  
  // Performance indexes
  tenantIdIdx: index('customers_tenant_id_idx').on(table.tenantId),
  emailIdx: index('customers_email_idx').on(table.email),
  phoneIdx: index('customers_phone_idx').on(table.phone),
  statusIdx: index('customers_status_idx').on(table.status),
  typeIdx: index('customers_type_idx').on(table.type),
  loyaltyTierIdx: index('customers_loyalty_tier_idx').on(table.loyaltyTier),
  lastPurchaseDateIdx: index('customers_last_purchase_date_idx').on(table.lastPurchaseDate),
  totalSpentIdx: index('customers_total_spent_idx').on(table.totalSpent),
  churnRiskIdx: index('customers_churn_risk_idx').on(table.churnRisk),
  referralCodeIdx: index('customers_referral_code_idx').on(table.referralCode),
}));

// Customer segments table
export const customerSegments = pgTable('customer_segments', {
  ...baseSchema,
  
  // Segment information
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: segmentTypeEnum('type').notNull(),
  
  // Segment criteria
  criteria: jsonb('criteria').notNull(), // JSON rules for segment membership
  
  // Segment statistics
  customerCount: integer('customer_count').default(0).notNull(),
  lastCalculatedAt: timestamp('last_calculated_at', { withTimezone: true }),
  
  // Segment settings
  isActive: boolean('is_active').default(true).notNull(),
  isAutoUpdated: boolean('is_auto_updated').default(true).notNull(),
  updateFrequency: varchar('update_frequency', { length: 50 }).default('daily'), // daily, weekly, monthly
  
  // Marketing settings
  defaultCampaignSettings: jsonb('default_campaign_settings').default({}),
}, (table) => ({
  tenantIdIdx: index('customer_segments_tenant_id_idx').on(table.tenantId),
  nameIdx: index('customer_segments_name_idx').on(table.name),
  typeIdx: index('customer_segments_type_idx').on(table.type),
  isActiveIdx: index('customer_segments_is_active_idx').on(table.isActive),
}));

// Customer segment memberships (many-to-many)
export const customerSegmentMemberships = pgTable('customer_segment_memberships', {
  ...baseSchema,
  
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  segmentId: uuid('segment_id').notNull().references(() => customerSegments.id, { onDelete: 'cascade' }),
  
  // Membership metadata
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  addedBy: varchar('added_by', { length: 50 }).default('system'), // 'system' or user ID
  
  // Segment score (for behavioral segments)
  score: decimal('score', { precision: 10, scale: 4 }),
  
}, (table) => ({
  // Unique constraint
  customerSegmentIdx: unique('customer_segment_memberships_unique').on(
    table.customerId, 
    table.segmentId
  ),
  
  // Performance indexes
  customerIdIdx: index('customer_segment_memberships_customer_id_idx').on(table.customerId),
  segmentIdIdx: index('customer_segment_memberships_segment_id_idx').on(table.segmentId),
  tenantIdIdx: index('customer_segment_memberships_tenant_id_idx').on(table.tenantId),
}));

// Customer communication history
export const customerCommunications = pgTable('customer_communications', {
  ...baseSchema,
  
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
  // Communication details
  channel: communicationChannelEnum('channel').notNull(),
  direction: varchar('direction', { length: 20 }).notNull(), // 'inbound', 'outbound'
  subject: varchar('subject', { length: 500 }),
  content: text('content'),
  
  // Communication metadata
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  
  // Campaign information
  campaignId: uuid('campaign_id'),
  campaignName: varchar('campaign_name', { length: 255 }),
  
  // Status and tracking
  status: varchar('status', { length: 50 }).default('sent'), // sent, delivered, read, responded, failed
  externalId: varchar('external_id', { length: 255 }), // ID from external service
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
  attachments: jsonb('attachments').default([]),
}, (table) => ({
  customerIdIdx: index('customer_communications_customer_id_idx').on(table.customerId),
  channelIdx: index('customer_communications_channel_idx').on(table.channel),
  sentAtIdx: index('customer_communications_sent_at_idx').on(table.sentAt),
  campaignIdIdx: index('customer_communications_campaign_id_idx').on(table.campaignId),
  statusIdx: index('customer_communications_status_idx').on(table.status),
  tenantIdIdx: index('customer_communications_tenant_id_idx').on(table.tenantId),
}));

// Customer loyalty transactions
export const loyaltyTransactions = pgTable('loyalty_transactions', {
  ...baseSchema,
  
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
  // Transaction details
  type: varchar('type', { length: 50 }).notNull(), // 'earned', 'redeemed', 'expired', 'adjusted'
  points: integer('points').notNull(), // Positive for earned, negative for redeemed
  description: varchar('description', { length: 500 }),
  
  // Related transaction
  relatedTransactionId: uuid('related_transaction_id'), // POS transaction that generated points
  
  // Expiration
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  // Campaign or promotion
  campaignId: uuid('campaign_id'),
  promotionId: uuid('promotion_id'),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  customerIdIdx: index('loyalty_transactions_customer_id_idx').on(table.customerId),
  typeIdx: index('loyalty_transactions_type_idx').on(table.type),
  relatedTransactionIdIdx: index('loyalty_transactions_related_transaction_id_idx').on(table.relatedTransactionId),
  expiresAtIdx: index('loyalty_transactions_expires_at_idx').on(table.expiresAt),
  tenantIdIdx: index('loyalty_transactions_tenant_id_idx').on(table.tenantId),
}));

// Loyalty rewards catalog
export const loyaltyRewards = pgTable('loyalty_rewards', {
  ...baseSchema,
  
  // Reward information
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(), // 'discount_percentage', 'discount_fixed', 'free_product', 'free_shipping', 'store_credit', 'custom'
  
  // Points and value
  pointsRequired: integer('points_required').notNull(),
  value: decimal('value', { precision: 10, scale: 2 }), // Amount or percentage
  
  // Product-specific rewards
  productId: uuid('product_id'), // For free product rewards
  
  // Constraints
  minimumOrderValue: decimal('minimum_order_value', { precision: 10, scale: 2 }),
  maximumDiscountAmount: decimal('maximum_discount_amount', { precision: 10, scale: 2 }),
  
  // Availability
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  
  // Usage limits
  usageLimitPerCustomer: integer('usage_limit_per_customer'),
  totalUsageLimit: integer('total_usage_limit'),
  currentUsageCount: integer('current_usage_count').default(0).notNull(),
  
  // Tier restrictions
  requiredTiers: jsonb('required_tiers').default([]), // Array of loyalty tiers
  
  // Terms and conditions
  termsAndConditions: text('terms_and_conditions'),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  tenantIdIdx: index('loyalty_rewards_tenant_id_idx').on(table.tenantId),
  typeIdx: index('loyalty_rewards_type_idx').on(table.type),
  pointsRequiredIdx: index('loyalty_rewards_points_required_idx').on(table.pointsRequired),
  isActiveIdx: index('loyalty_rewards_is_active_idx').on(table.isActive),
  startDateIdx: index('loyalty_rewards_start_date_idx').on(table.startDate),
  endDateIdx: index('loyalty_rewards_end_date_idx').on(table.endDate),
}));

// Loyalty reward redemptions
export const loyaltyRedemptions = pgTable('loyalty_redemptions', {
  ...baseSchema,
  
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  rewardId: uuid('reward_id').notNull().references(() => loyaltyRewards.id, { onDelete: 'cascade' }),
  
  // Redemption details
  pointsUsed: integer('points_used').notNull(),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }),
  
  // Related transaction
  transactionId: uuid('transaction_id'), // POS transaction where reward was applied
  
  // Status
  status: varchar('status', { length: 50 }).default('active').notNull(), // 'active', 'used', 'expired', 'cancelled'
  usedAt: timestamp('used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  customerIdIdx: index('loyalty_redemptions_customer_id_idx').on(table.customerId),
  rewardIdIdx: index('loyalty_redemptions_reward_id_idx').on(table.rewardId),
  transactionIdIdx: index('loyalty_redemptions_transaction_id_idx').on(table.transactionId),
  statusIdx: index('loyalty_redemptions_status_idx').on(table.status),
  tenantIdIdx: index('loyalty_redemptions_tenant_id_idx').on(table.tenantId),
}));

// Loyalty campaigns
export const loyaltyCampaigns = pgTable('loyalty_campaigns', {
  ...baseSchema,
  
  // Campaign information
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Campaign period
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  
  // Campaign rules
  pointsMultiplier: decimal('points_multiplier', { precision: 5, scale: 2 }).default('1.00').notNull(),
  minimumPurchaseAmount: decimal('minimum_purchase_amount', { precision: 10, scale: 2 }),
  
  // Targeting
  targetSegments: jsonb('target_segments').default([]), // Array of segment IDs
  targetTiers: jsonb('target_tiers').default([]), // Array of loyalty tiers
  applicableCategories: jsonb('applicable_categories').default([]), // Array of product categories
  applicableProducts: jsonb('applicable_products').default([]), // Array of product IDs
  
  // Limits
  maxPointsPerCustomer: integer('max_points_per_customer'),
  totalPointsBudget: integer('total_points_budget'),
  currentPointsAwarded: integer('current_points_awarded').default(0).notNull(),
  
  // Status
  status: varchar('status', { length: 50 }).default('draft').notNull(), // 'draft', 'active', 'paused', 'completed', 'cancelled'
  
  // Terms and conditions
  termsAndConditions: text('terms_and_conditions'),
  
  // Statistics
  participantCount: integer('participant_count').default(0).notNull(),
  totalTransactions: integer('total_transactions').default(0).notNull(),
  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }).default('0.00').notNull(),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  tenantIdIdx: index('loyalty_campaigns_tenant_id_idx').on(table.tenantId),
  statusIdx: index('loyalty_campaigns_status_idx').on(table.status),
  startDateIdx: index('loyalty_campaigns_start_date_idx').on(table.startDate),
  endDateIdx: index('loyalty_campaigns_end_date_idx').on(table.endDate),
}));

// Customer preferences and settings
export const customerPreferences = pgTable('customer_preferences', {
  ...baseSchema,
  
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
  // Preference details
  category: varchar('category', { length: 100 }).notNull(), // 'communication', 'marketing', 'product', etc.
  key: varchar('key', { length: 100 }).notNull(),
  value: jsonb('value').notNull(),
  
  // Preference metadata
  source: varchar('source', { length: 50 }).default('manual'), // 'manual', 'inferred', 'imported'
  confidence: decimal('confidence', { precision: 5, scale: 4 }).default('1.0000'), // 0-1 confidence score
  
}, (table) => ({
  // Unique constraint
  customerPreferenceIdx: unique('customer_preferences_unique').on(
    table.customerId, 
    table.category,
    table.key
  ),
  
  // Performance indexes
  customerIdIdx: index('customer_preferences_customer_id_idx').on(table.customerId),
  categoryIdx: index('customer_preferences_category_idx').on(table.category),
  tenantIdIdx: index('customer_preferences_tenant_id_idx').on(table.tenantId),
}));

// B2B customer extensions
export const b2bCustomers = pgTable('b2b_customers', {
  ...baseSchema,
  
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
  // Company information
  primaryContactFirstName: varchar('primary_contact_first_name', { length: 100 }),
  primaryContactLastName: varchar('primary_contact_last_name', { length: 100 }),
  primaryContactTitle: varchar('primary_contact_title', { length: 100 }),
  dunsNumber: varchar('duns_number', { length: 20 }),
  
  // Financial terms
  paymentTermsType: paymentTermsEnum('payment_terms_type').default('net_30').notNull(),
  customPaymentTermsDays: integer('custom_payment_terms_days'),
  earlyPaymentDiscountPercentage: decimal('early_payment_discount_percentage', { precision: 5, scale: 2 }),
  earlyPaymentDiscountDays: integer('early_payment_discount_days'),
  creditStatus: creditStatusEnum('credit_status').default('pending').notNull(),
  creditCheckDate: timestamp('credit_check_date', { withTimezone: true }),
  creditCheckScore: integer('credit_check_score'),
  
  // Pricing and discounts
  pricingTier: pricingTierEnum('pricing_tier').default('standard').notNull(),
  volumeDiscountPercentage: decimal('volume_discount_percentage', { precision: 5, scale: 2 }),
  minimumOrderAmount: decimal('minimum_order_amount', { precision: 10, scale: 2 }),
  
  // Account management
  salesRepId: uuid('sales_rep_id').references(() => users.id),
  accountManagerId: uuid('account_manager_id').references(() => users.id),
  
  // Company details
  industry: varchar('industry', { length: 100 }),
  employeeCount: integer('employee_count'),
  annualRevenue: decimal('annual_revenue', { precision: 15, scale: 2 }),
  preferredCategories: jsonb('preferred_categories').default([]),
  
  // Billing address
  billingAddressLine1: varchar('billing_address_line1', { length: 255 }),
  billingAddressLine2: varchar('billing_address_line2', { length: 255 }),
  billingCity: varchar('billing_city', { length: 100 }),
  billingState: varchar('billing_state', { length: 100 }),
  billingPostalCode: varchar('billing_postal_code', { length: 20 }),
  billingCountry: varchar('billing_country', { length: 100 }),
  
  // Shipping address
  shippingAddressLine1: varchar('shipping_address_line1', { length: 255 }),
  shippingAddressLine2: varchar('shipping_address_line2', { length: 255 }),
  shippingCity: varchar('shipping_city', { length: 100 }),
  shippingState: varchar('shipping_state', { length: 100 }),
  shippingPostalCode: varchar('shipping_postal_code', { length: 20 }),
  shippingCountry: varchar('shipping_country', { length: 100 }),
  
  // Contract information
  contractStartDate: timestamp('contract_start_date', { withTimezone: true }),
  contractEndDate: timestamp('contract_end_date', { withTimezone: true }),
  contractValue: decimal('contract_value', { precision: 15, scale: 2 }),
  autoRenewal: boolean('auto_renewal').default(false),
  
  // Special instructions and notes
  specialInstructions: text('special_instructions'),
  
  // Additional B2B metadata
  b2bMetadata: jsonb('b2b_metadata').default({}),
}, (table) => ({
  customerIdIdx: index('b2b_customers_customer_id_idx').on(table.customerId),
  creditStatusIdx: index('b2b_customers_credit_status_idx').on(table.creditStatus),
  pricingTierIdx: index('b2b_customers_pricing_tier_idx').on(table.pricingTier),
  paymentTermsIdx: index('b2b_customers_payment_terms_idx').on(table.paymentTermsType),
  salesRepIdIdx: index('b2b_customers_sales_rep_id_idx').on(table.salesRepId),
  accountManagerIdIdx: index('b2b_customers_account_manager_id_idx').on(table.accountManagerId),
  industryIdx: index('b2b_customers_industry_idx').on(table.industry),
  contractEndDateIdx: index('b2b_customers_contract_end_date_idx').on(table.contractEndDate),
  tenantIdIdx: index('b2b_customers_tenant_id_idx').on(table.tenantId),
}));

// Customer pricing rules (for custom pricing)
export const customerPricingRules = pgTable('customer_pricing_rules', {
  ...baseSchema,
  
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
  // Pricing rule details
  ruleType: varchar('rule_type', { length: 50 }).notNull(), // 'product', 'category', 'volume', 'contract'
  targetId: uuid('target_id'), // Product ID, Category ID, etc.
  targetType: varchar('target_type', { length: 50 }), // 'product', 'category', 'all'
  
  // Pricing configuration
  discountType: varchar('discount_type', { length: 20 }).notNull(), // 'percentage', 'fixed_amount', 'fixed_price'
  discountValue: decimal('discount_value', { precision: 10, scale: 4 }).notNull(),
  
  // Volume-based pricing
  minimumQuantity: integer('minimum_quantity'),
  maximumQuantity: integer('maximum_quantity'),
  minimumAmount: decimal('minimum_amount', { precision: 10, scale: 2 }),
  
  // Validity period
  effectiveDate: timestamp('effective_date', { withTimezone: true }).defaultNow().notNull(),
  expirationDate: timestamp('expiration_date', { withTimezone: true }),
  
  // Rule metadata
  priority: integer('priority').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  description: varchar('description', { length: 500 }),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  customerIdIdx: index('customer_pricing_rules_customer_id_idx').on(table.customerId),
  ruleTypeIdx: index('customer_pricing_rules_rule_type_idx').on(table.ruleType),
  targetIdIdx: index('customer_pricing_rules_target_id_idx').on(table.targetId),
  effectiveDateIdx: index('customer_pricing_rules_effective_date_idx').on(table.effectiveDate),
  expirationDateIdx: index('customer_pricing_rules_expiration_date_idx').on(table.expirationDate),
  isActiveIdx: index('customer_pricing_rules_is_active_idx').on(table.isActive),
  tenantIdIdx: index('customer_pricing_rules_tenant_id_idx').on(table.tenantId),
}));

// Customer credit history
export const customerCreditHistory = pgTable('customer_credit_history', {
  ...baseSchema,
  
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
  // Credit event details
  eventType: varchar('event_type', { length: 50 }).notNull(), // 'application', 'approval', 'increase', 'decrease', 'suspension', 'review'
  previousCreditLimit: decimal('previous_credit_limit', { precision: 12, scale: 2 }),
  newCreditLimit: decimal('new_credit_limit', { precision: 12, scale: 2 }),
  previousStatus: creditStatusEnum('previous_status'),
  newStatus: creditStatusEnum('new_status').notNull(),
  
  // Credit assessment
  creditScore: integer('credit_score'),
  riskRating: varchar('risk_rating', { length: 20 }), // 'low', 'medium', 'high'
  assessmentNotes: text('assessment_notes'),
  
  // Review information
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewDate: timestamp('review_date', { withTimezone: true }).defaultNow().notNull(),
  nextReviewDate: timestamp('next_review_date', { withTimezone: true }),
  
  // Supporting documents
  documents: jsonb('documents').default([]),
  
  // Additional metadata
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  customerIdIdx: index('customer_credit_history_customer_id_idx').on(table.customerId),
  eventTypeIdx: index('customer_credit_history_event_type_idx').on(table.eventType),
  newStatusIdx: index('customer_credit_history_new_status_idx').on(table.newStatus),
  reviewDateIdx: index('customer_credit_history_review_date_idx').on(table.reviewDate),
  nextReviewDateIdx: index('customer_credit_history_next_review_date_idx').on(table.nextReviewDate),
  tenantIdIdx: index('customer_credit_history_tenant_id_idx').on(table.tenantId),
}));