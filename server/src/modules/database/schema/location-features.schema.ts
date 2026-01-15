import { pgTable, uuid, varchar, text, decimal, integer, timestamp, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { locations } from './location.schema';

// Enums for location features
export const pricingRuleTypeEnum = pgEnum('pricing_rule_type', [
  'markup',
  'markdown', 
  'fixed_price',
  'percentage_discount',
  'bulk_discount'
]);

export const pricingRuleStatusEnum = pgEnum('pricing_rule_status', [
  'active',
  'inactive',
  'scheduled',
  'expired'
]);

export const promotionTypeEnum = pgEnum('promotion_type', [
  'percentage_discount',
  'fixed_amount_discount',
  'buy_x_get_y',
  'bundle_discount',
  'free_shipping',
  'loyalty_points_multiplier'
]);

export const promotionStatusEnum = pgEnum('promotion_status', [
  'draft',
  'active',
  'paused',
  'expired',
  'cancelled'
]);

export const promotionTargetTypeEnum = pgEnum('promotion_target_type', [
  'all_products',
  'specific_products',
  'product_categories',
  'customer_segments'
]);

export const inventoryPolicyTypeEnum = pgEnum('inventory_policy_type', [
  'reorder_point',
  'safety_stock',
  'max_stock_level',
  'abc_classification',
  'seasonal_adjustment',
  'demand_forecasting'
]);

export const inventoryPolicyStatusEnum = pgEnum('inventory_policy_status', [
  'active',
  'inactive',
  'suspended'
]);

export const stockReplenishmentMethodEnum = pgEnum('stock_replenishment_method', [
  'automatic',
  'manual',
  'scheduled',
  'demand_based'
]);

export const abcClassificationEnum = pgEnum('abc_classification', [
  'A',
  'B',
  'C'
]);

// Location Pricing Rules Table
export const locationPricingRules = pgTable('location_pricing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: varchar('tenant_id', { length: 255 }).notNull(),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  ruleType: pricingRuleTypeEnum('rule_type').notNull(),
  productId: varchar('product_id', { length: 255 }),
  categoryId: varchar('category_id', { length: 255 }),
  value: decimal('value', { precision: 10, scale: 2 }).notNull(),
  minQuantity: integer('min_quantity'),
  maxQuantity: integer('max_quantity'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  priority: integer('priority').default(0),
  conditions: jsonb('conditions'),
  isActive: boolean('is_active').default(true),
  status: pricingRuleStatusEnum('status').default('active'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Location Promotions Table
export const locationPromotions = pgTable('location_promotions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: varchar('tenant_id', { length: 255 }).notNull(),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  promotionType: promotionTypeEnum('promotion_type').notNull(),
  targetType: promotionTargetTypeEnum('target_type').notNull(),
  targetProductIds: jsonb('target_product_ids'),
  targetCategoryIds: jsonb('target_category_ids'),
  targetCustomerSegments: jsonb('target_customer_segments'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }),
  minPurchaseAmount: decimal('min_purchase_amount', { precision: 10, scale: 2 }),
  maxDiscountAmount: decimal('max_discount_amount', { precision: 10, scale: 2 }),
  maxUsesPerCustomer: integer('max_uses_per_customer'),
  maxTotalUses: integer('max_total_uses'),
  currentUses: integer('current_uses').default(0),
  priority: integer('priority').default(0),
  isCombinable: boolean('is_combinable').default(false),
  conditions: jsonb('conditions'),
  actions: jsonb('actions'),
  promotionCode: varchar('promotion_code', { length: 50 }),
  isActive: boolean('is_active').default(true),
  status: promotionStatusEnum('status').default('draft'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Location Inventory Policies Table
export const locationInventoryPolicies = pgTable('location_inventory_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: varchar('tenant_id', { length: 255 }).notNull(),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  policyType: inventoryPolicyTypeEnum('policy_type').notNull(),
  productId: varchar('product_id', { length: 255 }),
  categoryId: varchar('category_id', { length: 255 }),
  minStockLevel: integer('min_stock_level'),
  maxStockLevel: integer('max_stock_level'),
  safetyStock: integer('safety_stock'),
  reorderQuantity: integer('reorder_quantity'),
  leadTimeDays: integer('lead_time_days'),
  replenishmentMethod: stockReplenishmentMethodEnum('replenishment_method').default('manual'),
  abcClassification: abcClassificationEnum('abc_classification'),
  seasonalMultiplier: decimal('seasonal_multiplier', { precision: 4, scale: 2 }).default('1.00'),
  forecastPeriodDays: integer('forecast_period_days').default(30),
  autoCreatePurchaseOrders: boolean('auto_create_purchase_orders').default(false),
  preferredSupplierId: varchar('preferred_supplier_id', { length: 255 }),
  rules: jsonb('rules'),
  priority: integer('priority').default(0),
  parameters: jsonb('parameters'),
  isActive: boolean('is_active').default(true),
  status: inventoryPolicyStatusEnum('status').default('active'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Promotion Usage Tracking Table
export const promotionUsage = pgTable('promotion_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: varchar('tenant_id', { length: 255 }).notNull(),
  promotionId: uuid('promotion_id').notNull().references(() => locationPromotions.id, { onDelete: 'cascade' }),
  customerId: varchar('customer_id', { length: 255 }),
  orderId: varchar('order_id', { length: 255 }),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).notNull(),
  originalAmount: decimal('original_amount', { precision: 10, scale: 2 }).notNull(),
  finalAmount: decimal('final_amount', { precision: 10, scale: 2 }).notNull(),
  usageDetails: jsonb('usage_details'),
  usedAt: timestamp('used_at').defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
});

// Price Calculation History Table (for auditing)
export const priceCalculationHistory = pgTable('price_calculation_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: varchar('tenant_id', { length: 255 }).notNull(),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  productId: varchar('product_id', { length: 255 }).notNull(),
  customerId: varchar('customer_id', { length: 255 }),
  quantity: integer('quantity').notNull(),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
  finalPrice: decimal('final_price', { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0.00'),
  appliedRules: jsonb('applied_rules'),
  calculationBreakdown: jsonb('calculation_breakdown'),
  calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
  calculatedBy: varchar('calculated_by', { length: 255 }),
});

// Inventory Policy Execution Log Table
export const inventoryPolicyExecutionLog = pgTable('inventory_policy_execution_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: varchar('tenant_id', { length: 255 }).notNull(),
  policyId: uuid('policy_id').notNull().references(() => locationInventoryPolicies.id, { onDelete: 'cascade' }),
  productId: varchar('product_id', { length: 255 }).notNull(),
  executionType: varchar('execution_type', { length: 50 }).notNull(), // 'reorder_check', 'stock_adjustment', etc.
  currentStock: integer('current_stock').notNull(),
  recommendedAction: varchar('recommended_action', { length: 100 }),
  recommendedQuantity: integer('recommended_quantity'),
  actionTaken: varchar('action_taken', { length: 100 }),
  actualQuantity: integer('actual_quantity'),
  executionResult: jsonb('execution_result'),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
  executedBy: varchar('executed_by', { length: 255 }),
});