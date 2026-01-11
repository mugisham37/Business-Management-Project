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

// Employee-related enums
export const employmentStatusEnum = pgEnum('employment_status', [
  'active',
  'inactive',
  'terminated',
  'on_leave',
  'probation',
  'suspended',
]);

export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time',
  'part_time',
  'contract',
  'temporary',
  'intern',
  'consultant',
]);

export const payFrequencyEnum = pgEnum('pay_frequency', [
  'weekly',
  'bi_weekly',
  'semi_monthly',
  'monthly',
  'quarterly',
  'annually',
]);

export const scheduleStatusEnum = pgEnum('schedule_status', [
  'scheduled',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
]);

export const timeEntryTypeEnum = pgEnum('time_entry_type', [
  'regular',
  'overtime',
  'holiday',
  'sick_leave',
  'vacation',
  'personal_leave',
  'training',
]);

export const performanceRatingEnum = pgEnum('performance_rating', [
  'outstanding',
  'exceeds_expectations',
  'meets_expectations',
  'below_expectations',
  'unsatisfactory',
]);

// Payroll-related enums
export const payrollPeriodTypeEnum = pgEnum('payroll_period_type', [
  'weekly',
  'bi_weekly',
  'semi_monthly',
  'monthly',
]);

export const payrollStatusEnum = pgEnum('payroll_status', [
  'draft',
  'processing',
  'calculated',
  'approved',
  'completed',
  'paid',
]);

export const commissionTypeEnum = pgEnum('commission_type', [
  'sales',
  'referral',
  'bonus',
]);

export const commissionStatusEnum = pgEnum('commission_status', [
  'pending',
  'calculated',
  'paid',
]);

// Compliance-related enums
export const complianceCheckTypeEnum = pgEnum('compliance_check_type', [
  'labor_law_compliance',
  'break_time_compliance',
  'overtime_compliance',
  'safety_compliance',
]);

export const complianceStatusEnum = pgEnum('compliance_status', [
  'compliant',
  'violations_found',
  'pending_review',
  'remediated',
]);

export const violationTypeEnum = pgEnum('violation_type', [
  'daily_hours_exceeded',
  'weekly_hours_exceeded',
  'insufficient_break_time',
  'insufficient_break_time_extended',
  'consecutive_work_days_exceeded',
  'insufficient_rest_period',
  'overtime_without_approval',
  'safety_violation',
]);

export const violationSeverityEnum = pgEnum('violation_severity', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const breakTypeEnum = pgEnum('break_type', [
  'meal_break',
  'rest_break',
  'personal_break',
  'smoke_break',
]);