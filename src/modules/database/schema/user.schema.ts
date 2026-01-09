import { pgTable, varchar, text, boolean, jsonb, index, unique, timestamp, uuid, integer } from 'drizzle-orm/pg-core';
import { baseSchema } from './base.schema';
import { userRoleEnum } from './enums';
import { tenants } from './tenant.schema';

// Users table with multi-tenant support
export const users = pgTable('users', {
  ...baseSchema,
  // Add foreign key reference to tenants
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Authentication fields
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  
  // Profile information
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  displayName: varchar('display_name', { length: 200 }),
  avatar: varchar('avatar', { length: 500 }),
  phone: varchar('phone', { length: 50 }),
  
  // Role and permissions
  role: userRoleEnum('role').notNull().default('employee'),
  permissions: jsonb('permissions').default([]),
  customPermissions: jsonb('custom_permissions').default({}),
  
  // Security and session management
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastLoginIp: varchar('last_login_ip', { length: 45 }),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  
  // Multi-factor authentication
  mfaEnabled: boolean('mfa_enabled').default(false),
  mfaSecret: varchar('mfa_secret', { length: 255 }),
  mfaBackupCodes: jsonb('mfa_backup_codes').default([]),
  
  // Password reset
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires', { withTimezone: true }),
  
  // User preferences and settings
  preferences: jsonb('preferences').default({}),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  locale: varchar('locale', { length: 10 }).default('en'),
  
  // Employment information (for employee users)
  employeeId: varchar('employee_id', { length: 50 }),
  department: varchar('department', { length: 100 }),
  position: varchar('position', { length: 100 }),
  hireDate: timestamp('hire_date', { withTimezone: true }),
  
  // Status flags
  isEmailNotificationEnabled: boolean('is_email_notification_enabled').default(true),
  isSmsNotificationEnabled: boolean('is_sms_notification_enabled').default(false),
  isPushNotificationEnabled: boolean('is_push_notification_enabled').default(true),
}, (table) => ({
  // Unique constraint on tenant_id + email
  tenantEmailIdx: unique('users_tenant_email_unique').on(table.tenantId, table.email),
  
  // Indexes for performance
  tenantIdIdx: index('users_tenant_id_idx').on(table.tenantId),
  emailIdx: index('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
  employeeIdIdx: index('users_employee_id_idx').on(table.employeeId),
  lastLoginIdx: index('users_last_login_idx').on(table.lastLoginAt),
}));

// User sessions table for session management
export const userSessions = pgTable('user_sessions', {
  ...baseSchema,
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  refreshToken: varchar('refresh_token', { length: 255 }).notNull().unique(),
  
  // Session metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  deviceInfo: jsonb('device_info').default({}),
  
  // Session timing
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).defaultNow(),
  
  // Security flags
  isRevoked: boolean('is_revoked').default(false),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedReason: varchar('revoked_reason', { length: 100 }),
}, (table) => ({
  userIdIdx: index('user_sessions_user_id_idx').on(table.userId),
  sessionTokenIdx: index('user_sessions_session_token_idx').on(table.sessionToken),
  refreshTokenIdx: index('user_sessions_refresh_token_idx').on(table.refreshToken),
  expiresAtIdx: index('user_sessions_expires_at_idx').on(table.expiresAt),
}));

// User permissions table for granular permission management
export const userPermissions = pgTable('user_permissions', {
  ...baseSchema,
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  permission: varchar('permission', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }),
  resourceId: uuid('resource_id'),
  
  // Permission metadata
  grantedBy: uuid('granted_by').references(() => users.id),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  // Conditions and constraints
  conditions: jsonb('conditions').default({}),
  isInherited: boolean('is_inherited').default(false),
}, (table) => ({
  userPermissionIdx: unique('user_permissions_unique').on(
    table.userId, 
    table.permission, 
    table.resource, 
    table.resourceId
  ),
  userIdIdx: index('user_permissions_user_id_idx').on(table.userId),
  permissionIdx: index('user_permissions_permission_idx').on(table.permission),
  resourceIdx: index('user_permissions_resource_idx').on(table.resource),
}));