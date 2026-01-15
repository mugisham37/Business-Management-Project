import { pgTable, varchar, jsonb, index, unique, uuid, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { systemBaseSchema } from './base.schema';
import { businessTierEnum, subscriptionStatusEnum, auditActionEnum } from './enums';

// Tenant table - system-wide, not tenant-isolated
export const tenants = pgTable('tenants', {
  ...systemBaseSchema,
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  businessTier: businessTierEnum('business_tier').notNull().default('micro'),
  subscriptionStatus: subscriptionStatusEnum('subscription_status').notNull().default('trial'),
  
  // Configuration and settings
  settings: jsonb('settings').default({}),
  featureFlags: jsonb('feature_flags').default({}),
  
  // Business metrics for tier calculation
  metrics: jsonb('metrics').default({
    employeeCount: 0,
    locationCount: 1,
    monthlyTransactionVolume: 0,
    monthlyRevenue: 0,
  }),
  
  // Contact and billing information
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  billingAddress: jsonb('billing_address'),
  
  // Subscription details
  subscriptionStartDate: timestamp('subscription_start_date', { withTimezone: true }),
  subscriptionEndDate: timestamp('subscription_end_date', { withTimezone: true }),
  trialEndDate: timestamp('trial_end_date', { withTimezone: true }),
}, (table) => ({
  slugIdx: index('tenants_slug_idx').on(table.slug),
  businessTierIdx: index('tenants_business_tier_idx').on(table.businessTier),
  subscriptionStatusIdx: index('tenants_subscription_status_idx').on(table.subscriptionStatus),
}));

// Tenant feature flags table for granular feature control
export const tenantFeatureFlags = pgTable('tenant_feature_flags', {
  ...systemBaseSchema,
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  featureName: varchar('feature_name', { length: 100 }).notNull(),
  isEnabled: boolean('is_enabled').notNull().default(false),
  rolloutPercentage: integer('rollout_percentage').default(100),
  customRules: jsonb('custom_rules').default({}),
  enabledAt: timestamp('enabled_at', { withTimezone: true }),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
}, (table) => ({
  tenantFeatureIdx: unique('tenant_feature_unique').on(table.tenantId, table.featureName),
  tenantIdIdx: index('tenant_feature_flags_tenant_id_idx').on(table.tenantId),
  featureNameIdx: index('tenant_feature_flags_feature_name_idx').on(table.featureName),
}));

// Integration settings table for third-party service configurations
export const integrationSettings = pgTable('integration_settings', {
  ...systemBaseSchema,
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  integrationType: varchar('integration_type', { length: 100 }).notNull(), // e.g., 'slack', 'teams', 'email_sendgrid', 'sms_twilio'
  isEnabled: boolean('is_enabled').notNull().default(true),
  configuration: jsonb('configuration').notNull().default({}),
  lastTestAt: timestamp('last_test_at', { withTimezone: true }),
  lastTestResult: jsonb('last_test_result'),
  healthStatus: varchar('health_status', { length: 50 }).default('unknown'), // 'healthy', 'degraded', 'unhealthy', 'unknown'
  lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
}, (table) => ({
  tenantIntegrationIdx: unique('tenant_integration_unique').on(table.tenantId, table.integrationType),
  tenantIdIdx: index('integration_settings_tenant_id_idx').on(table.tenantId),
  integrationTypeIdx: index('integration_settings_type_idx').on(table.integrationType),
  enabledIdx: index('integration_settings_enabled_idx').on(table.isEnabled),
}));

// Audit log table for compliance and security
export const auditLogs = pgTable('audit_logs', {
  ...systemBaseSchema,
  tenantId: uuid('tenant_id'), // Nullable for system-wide events
  userId: uuid('user_id'),
  action: auditActionEnum('action').notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  resourceId: uuid('resource_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  metadata: jsonb('metadata').default({}),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  requestId: uuid('request_id'),
}, (table) => ({
  tenantIdIdx: index('audit_logs_tenant_id_idx').on(table.tenantId),
  userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
  resourceIdx: index('audit_logs_resource_idx').on(table.resource),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}));