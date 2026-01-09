import { pgEnum } from 'drizzle-orm/pg-core';

// Business tier enumeration for progressive feature disclosure
export const businessTierEnum = pgEnum('business_tier', [
  'micro',      // 0-5 employees
  'small',      // 5-20 employees  
  'medium',     // 20-100 employees
  'enterprise', // 100+ employees
]);

// Subscription status enumeration
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trial',
  'active',
  'past_due',
  'canceled',
  'suspended',
]);

// User role enumeration
export const userRoleEnum = pgEnum('user_role', [
  'super_admin',    // Platform administrator
  'tenant_admin',   // Tenant administrator
  'manager',        // Business manager
  'employee',       // Regular employee
  'customer',       // Customer user
  'readonly',       // Read-only access
]);

// Audit action enumeration
export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'read',
  'update',
  'delete',
  'login',
  'logout',
  'export',
  'import',
]);

// Feature flag status enumeration
export const featureFlagStatusEnum = pgEnum('feature_flag_status', [
  'enabled',
  'disabled',
  'rollout',    // Gradual rollout
  'testing',    // A/B testing
]);