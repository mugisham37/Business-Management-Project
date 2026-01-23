/**
 * Complete Auth Type Definitions
 * Comprehensive TypeScript types matching backend auth module
 */

// Re-export existing types
export * from './core';

// User Role Enum (matching backend)
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
  CUSTOMER = 'customer',
  READONLY = 'readonly',
}

// Auth Event Types (matching backend)
export enum AuthEventType {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTERED = 'USER_REGISTERED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  FAILED_LOGIN_ATTEMPT = 'FAILED_LOGIN_ATTEMPT',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
}

// Complete User Interface (matching backend AuthUser)
export interface CompleteUser {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
}

// Login Response (matching backend)
export interface CompleteLoginResponse {
  user: CompleteUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

// MFA Requirement Response (matching backend)
export interface MfaRequirementResponse {
  required: boolean;
  message?: string;
}

// MFA Setup Response (matching backend)
export interface CompleteMfaSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

// MFA Status Response (matching backend)
export interface CompleteMfaStatusResponse {
  isEnabled: boolean;
  backupCodesCount: number;
  lastUsedAt?: Date;
}

// Permission Interface (matching backend)
export interface CompletePermission {
  id: string;
  userId: string;
  permission: string;
  resource?: string;
  resourceId?: string;
  grantedBy?: string;
  grantedAt: Date;
  expiresAt?: Date;
  isInherited: boolean;
}

// Role Interface (matching backend)
export interface CompleteRole {
  name: string;
  permissions: string[];
}

// User Permissions Response (matching backend)
export interface CompleteUserPermissionsResponse {
  permissions: string[];
  role: string;
  detailedPermissions: CompletePermission[];
  includesInherited: boolean;
}

// Permission Check Response (matching backend)
export interface CompletePermissionCheckResponse {
  hasPermission: boolean;
  source: string;
  grantedAt?: Date;
  expiresAt?: Date;
}

// Bulk Permission Response (matching backend)
export interface CompleteBulkPermissionResponse {
  success: number;
  failed: number;
  results: {
    userId: string;
    success: boolean;
    message?: string;
  }[];
}

// Available Permissions Response (matching backend)
export interface CompleteAvailablePermissionsResponse {
  permissions: string[];
  resources: string[];
  actions: string[];
  roles: CompleteRole[];
}

// Auth Event Interface (matching backend)
export interface CompleteAuthEvent {
  type: AuthEventType;
  userId: string;
  tenantId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// Input Types (matching backend inputs)
export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginWithMfaInput {
  email: string;
  password: string;
  mfaToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  phone?: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface EnableMfaInput {
  token: string;
}

export interface DisableMfaInput {
  token: string;
}

export interface VerifyMfaTokenInput {
  token: string;
}

export interface GenerateBackupCodesInput {
  token: string;
}

export interface GrantPermissionInput {
  userId: string;
  permission: string;
  resource?: string;
  resourceId?: string;
  expiresAt?: string;
}

export interface RevokePermissionInput {
  userId: string;
  permission: string;
  resource?: string;
  resourceId?: string;
}

export interface AssignRoleInput {
  userId: string;
  role: string;
}

export interface CreateRoleInput {
  name: string;
  permissions: string[];
}

export interface UpdateRolePermissionsInput {
  role: string;
  permissions: string[];
}

export interface CheckPermissionInput {
  userId: string;
  permission: string;
  resource?: string;
  resourceId?: string;
}

export interface BulkPermissionInput {
  userIds: string[];
  permissions: string[];
  resource?: string;
  resourceId?: string;
  expiresAt?: string;
}

export interface PermissionFilterInput {
  userId?: string;
  permission?: string;
  resource?: string;
  isInherited?: boolean;
  includeExpired?: boolean;
}

// Session Information
export interface CompleteSessionInfo {
  id: string;
  userId: string;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  isCurrentSession: boolean;
}

// Security Settings
export interface CompleteSecuritySettings {
  mfaEnabled: boolean;
  sessionTimeout: number;
  maxSessions: number;
  passwordExpiryDays: number;
  requirePasswordChange: boolean;
  allowedIpAddresses?: string[];
  blockedIpAddresses?: string[];
  timeBasedAccess?: {
    allowedHours: number[];
    timezone: string;
  };
}

// Auth State (extended)
export interface CompleteAuthState {
  user: CompleteUser | null;
  tokens: TokenPair | null;
  permissions: string[];
  mfaRequired: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionInfo?: CompleteSessionInfo;
  securitySettings?: CompleteSecuritySettings;
  lastActivity: Date;
}

// MFA State (extended)
export interface CompleteMfaState {
  isEnabled: boolean;
  isSetupInProgress: boolean;
  backupCodesCount: number;
  lastUsedAt?: Date;
  setupData?: CompleteMfaSetupResponse;
  methods: string[];
  preferredMethod?: string;
}

// Permission Context (extended)
export interface CompletePermissionContext {
  user: CompleteUser | null;
  permissions: string[];
  role: UserRole | null;
  tenantId?: string;
  businessTier?: string;
  ipAddress?: string;
  timeZone?: string;
  sessionId?: string;
}

// Auth Configuration (complete)
export interface CompleteAuthConfig {
  // JWT Configuration
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  
  // Security Configuration
  bcryptRounds: number;
  maxFailedAttempts: number;
  lockoutDuration: number;
  passwordResetExpiration: number;
  
  // MFA Configuration
  mfaIssuer: string;
  mfaAppName: string;
  backupCodesCount: number;
  totpWindow: number;
  
  // Session Configuration
  sessionTimeout: number;
  maxSessions: number;
  extendedSessionDuration: number;
  
  // Permission Configuration
  permissionCacheTtl: number;
  enableWildcardPermissions: boolean;
  enableResourcePermissions: boolean;
  
  // Subscription Configuration
  enableRealTimeEvents: boolean;
  subscriptionRetryAttempts: number;
  subscriptionRetryDelay: number;
  
  // Security Configuration
  enableIpRestriction: boolean;
  enableTimeBasedAccess: boolean;
  enableAuditLogging: boolean;
  enableRateLimiting: boolean;
}

// Predefined Permissions (matching backend)
export const PREDEFINED_PERMISSIONS = {
  // Platform permissions
  PLATFORM_ALL: 'platform:*',
  
  // Tenant permissions
  TENANT_MANAGE: 'tenant:manage',
  
  // User permissions
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_ALL: 'users:*',
  
  // Role permissions
  ROLES_MANAGE: 'roles:manage',
  
  // Permission permissions
  PERMISSIONS_MANAGE: 'permissions:manage',
  PERMISSIONS_READ: 'permissions:read',
  
  // Settings permissions
  SETTINGS_MANAGE: 'settings:manage',
  
  // Reports permissions
  REPORTS_READ: 'reports:read',
  
  // Analytics permissions
  ANALYTICS_READ: 'analytics:read',
  
  // POS permissions
  POS_CREATE: 'pos:create',
  POS_READ: 'pos:read',
  POS_UPDATE: 'pos:update',
  POS_DELETE: 'pos:delete',
  POS_ALL: 'pos:*',
  
  // Inventory permissions
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_MANAGE: 'inventory:manage',
  INVENTORY_ALL: 'inventory:*',
  
  // Customer permissions
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_DELETE: 'customers:delete',
  CUSTOMERS_MANAGE: 'customers:manage',
  CUSTOMERS_ALL: 'customers:*',
  
  // Employee permissions
  EMPLOYEES_CREATE: 'employees:create',
  EMPLOYEES_READ: 'employees:read',
  EMPLOYEES_UPDATE: 'employees:update',
  EMPLOYEES_DELETE: 'employees:delete',
  EMPLOYEES_MANAGE: 'employees:manage',
  EMPLOYEES_ALL: 'employees:*',
  
  // Financial permissions
  FINANCIAL_READ: 'financial:read',
  FINANCIAL_MANAGE: 'financial:manage',
  FINANCIAL_ALL: 'financial:*',
  
  // Supplier permissions
  SUPPLIERS_CREATE: 'suppliers:create',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_UPDATE: 'suppliers:update',
  SUPPLIERS_DELETE: 'suppliers:delete',
  SUPPLIERS_MANAGE: 'suppliers:manage',
  SUPPLIERS_ALL: 'suppliers:*',
  
  // Security permissions
  SECURITY_MONITOR: 'security:monitor',
  SECURITY_ALERTS: 'security:alerts',
  
  // Profile permissions
  PROFILE_READ: 'profile:read',
  PROFILE_UPDATE: 'profile:update',
  
  // Orders permissions
  ORDERS_READ: 'orders:read',
  
  // Loyalty permissions
  LOYALTY_READ: 'loyalty:read',
} as const;

// Role Permissions Mapping (matching backend)
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.SUPER_ADMIN]: [
    PREDEFINED_PERMISSIONS.PLATFORM_ALL,
    'tenants:*',
    PREDEFINED_PERMISSIONS.USERS_ALL,
    'system:*',
  ],
  [UserRole.TENANT_ADMIN]: [
    PREDEFINED_PERMISSIONS.TENANT_MANAGE,
    PREDEFINED_PERMISSIONS.USERS_ALL,
    PREDEFINED_PERMISSIONS.ROLES_MANAGE,
    PREDEFINED_PERMISSIONS.PERMISSIONS_MANAGE,
    PREDEFINED_PERMISSIONS.SETTINGS_MANAGE,
    PREDEFINED_PERMISSIONS.REPORTS_READ,
    PREDEFINED_PERMISSIONS.ANALYTICS_READ,
    PREDEFINED_PERMISSIONS.POS_ALL,
    PREDEFINED_PERMISSIONS.INVENTORY_ALL,
    PREDEFINED_PERMISSIONS.CUSTOMERS_ALL,
    PREDEFINED_PERMISSIONS.EMPLOYEES_ALL,
    PREDEFINED_PERMISSIONS.FINANCIAL_ALL,
    PREDEFINED_PERMISSIONS.SUPPLIERS_ALL,
  ],
  [UserRole.MANAGER]: [
    PREDEFINED_PERMISSIONS.USERS_READ,
    PREDEFINED_PERMISSIONS.USERS_UPDATE,
    PREDEFINED_PERMISSIONS.EMPLOYEES_MANAGE,
    PREDEFINED_PERMISSIONS.REPORTS_READ,
    PREDEFINED_PERMISSIONS.ANALYTICS_READ,
    PREDEFINED_PERMISSIONS.POS_ALL,
    PREDEFINED_PERMISSIONS.INVENTORY_MANAGE,
    PREDEFINED_PERMISSIONS.CUSTOMERS_MANAGE,
    PREDEFINED_PERMISSIONS.FINANCIAL_READ,
    PREDEFINED_PERMISSIONS.SUPPLIERS_READ,
  ],
  [UserRole.EMPLOYEE]: [
    PREDEFINED_PERMISSIONS.POS_CREATE,
    PREDEFINED_PERMISSIONS.POS_READ,
    PREDEFINED_PERMISSIONS.INVENTORY_READ,
    PREDEFINED_PERMISSIONS.CUSTOMERS_READ,
    PREDEFINED_PERMISSIONS.CUSTOMERS_CREATE,
    PREDEFINED_PERMISSIONS.CUSTOMERS_UPDATE,
    PREDEFINED_PERMISSIONS.PROFILE_READ,
    PREDEFINED_PERMISSIONS.PROFILE_UPDATE,
  ],
  [UserRole.CUSTOMER]: [
    PREDEFINED_PERMISSIONS.PROFILE_READ,
    PREDEFINED_PERMISSIONS.PROFILE_UPDATE,
    PREDEFINED_PERMISSIONS.ORDERS_READ,
    PREDEFINED_PERMISSIONS.LOYALTY_READ,
  ],
  [UserRole.READONLY]: [
    PREDEFINED_PERMISSIONS.POS_READ,
    PREDEFINED_PERMISSIONS.INVENTORY_READ,
    PREDEFINED_PERMISSIONS.CUSTOMERS_READ,
    PREDEFINED_PERMISSIONS.REPORTS_READ,
  ],
};