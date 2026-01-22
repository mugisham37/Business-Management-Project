/**
 * Authentication Library Index
 * Central exports for all authentication functionality
 */

// Token Management
export {
  TokenManager,
  SecureTokenStorage,
  createTokenManager,
  getDefaultTokenManager,
  setDefaultTokenManager,
  type TokenStorage,
  type TokenManagerConfig,
} from './token-manager';

// Authentication Management
export {
  AuthManager,
  createAuthManager,
  getDefaultAuthManager,
  setDefaultAuthManager,
  authManager,
  type LoginCredentials,
  type AuthResult,
  type AuthManagerConfig,
} from './auth-manager';

// Multi-Factor Authentication
export {
  MFAManager,
  createMFAManager,
  getDefaultMFAManager,
  setDefaultMFAManager,
  mfaManager,
  type MFAMethod,
  type MFASetupResult,
  type MFAVerificationResult,
  type MFAState,
} from './mfa-manager';

// Permission Engine
export {
  PermissionEngine,
  usePermissions,
  withPermissions,
  PermissionGuard,
  usePermissionGuard,
  createPermissionEngine,
  getDefaultPermissionEngine,
  setDefaultPermissionEngine,
  type Permission,
  type PermissionCheck,
  type PermissionContext,
  type WithPermissionsProps,
  type PermissionGuardProps,
} from './permission-engine';

// GraphQL Mutations
export {
  LOGIN_MUTATION,
  REFRESH_TOKEN_MUTATION,
  LOGOUT_MUTATION,
  SETUP_MFA_MUTATION,
  VERIFY_MFA_MUTATION,
  DISABLE_MFA_MUTATION,
} from '@/graphql/mutations/auth';

// Re-export types from core
export type {
  User,
  TokenPair,
  AuthState,
} from '@/types/core';