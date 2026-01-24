/**
 * Complete Auth Library Index
 * Comprehensive exports for all authentication functionality
 */

// Token Management
export {
  SecureTokenStorage,
  TokenManager,
  type TokenStorage,
  type TokenManagerConfig,
} from './token-manager';

// Advanced Auth Management
export {
  AdvancedAuthManager,
  advancedAuthManager,
  type SessionInfo,
  type PasswordChangeRequest,
  type PasswordResetRequest,
  type PasswordResetConfirm,
  type SecuritySettings,
} from './advanced-auth-manager';

// Auth Manager - Main interface
export {
  authManager,
  type AuthManager,
} from './auth-manager';

// Complete MFA Management
export {
  CompleteMfaManager,
  completeMfaManager,
  type MfaSetupResponse,
  type MfaStatusResponse,
  type MfaState,
  type MfaVerificationResult,
} from './mfa-manager-complete';

// Permissions Management
export {
  PermissionsManager,
  permissionsManager,
  type Permission,
  type Role,
  type UserPermissionsResponse,
  type PermissionCheckResponse,
  type BulkPermissionResult,
  type BulkPermissionResponse,
  type AvailablePermissionsResponse,
  type GrantPermissionRequest,
  type RevokePermissionRequest,
  type AssignRoleRequest,
  type BulkPermissionRequest,
} from './permissions-manager';

// Subscription Management
export {
  AuthSubscriptionManager,
  authSubscriptionManager,
  type AuthSubscriptionOptions,
} from './subscription-manager';

/**
 * Complete Auth System Configuration
 */
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
  
  // Session Configuration
  sessionTimeout: number;
  maxSessions: number;
  
  // Subscription Configuration
  enableRealTimeEvents: boolean;
  subscriptionRetryAttempts: number;
  subscriptionRetryDelay: number;
}

/**
 * Auth System Status
 */
export interface AuthSystemStatus {
  isInitialized: boolean;
  isConnected: boolean;
  activeSubscriptions: number;
  cacheSize: number;
  lastActivity: Date;
}

/**
 * Complete Auth System Manager
 * Central manager for all auth functionality
 */
export class CompleteAuthSystem {
  private config: CompleteAuthConfig;
  private status: AuthSystemStatus;

  constructor(config: Partial<CompleteAuthConfig> = {}) {
    this.config = {
      jwtSecret: '',
      jwtExpiresIn: '15m',
      jwtRefreshSecret: '',
      jwtRefreshExpiresIn: '7d',
      bcryptRounds: 12,
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 * 1000,
      passwordResetExpiration: 60 * 60 * 1000,
      mfaIssuer: 'Unified Business Platform',
      mfaAppName: 'Unified Business Platform',
      backupCodesCount: 10,
      sessionTimeout: 30 * 60 * 1000,
      maxSessions: 5,
      enableRealTimeEvents: true,
      subscriptionRetryAttempts: 3,
      subscriptionRetryDelay: 5000,
      ...config,
    };

    this.status = {
      isInitialized: false,
      isConnected: false,
      activeSubscriptions: 0,
      cacheSize: 0,
      lastActivity: new Date(),
    };
  }

  /**
   * Initialize the complete auth system
   */
  async initialize(): Promise<void> {
    try {
      // Initialize managers
      await this.initializeManagers();
      
      // Setup subscriptions if enabled
      if (this.config.enableRealTimeEvents) {
        await this.setupSubscriptions();
      }
      
      this.status.isInitialized = true;
      this.status.isConnected = true;
      this.status.lastActivity = new Date();
    } catch (error) {
      console.error('Failed to initialize auth system:', error);
      throw error;
    }
  }

  /**
   * Initialize all managers
   */
  private async initializeManagers(): Promise<void> {
    // Managers are already initialized as singletons
    // This method can be used for additional setup if needed
  }

  /**
   * Setup default subscriptions
   */
  private async setupSubscriptions(): Promise<void> {
    // Setup basic user subscriptions
    authSubscriptionManager.subscribeToUserAuthEvents();
    authSubscriptionManager.subscribeToUserPermissionEvents();
    authSubscriptionManager.subscribeToUserMfaEvents();
    authSubscriptionManager.subscribeToUserSessionEvents();
  }

  /**
   * Get system status
   */
  getStatus(): AuthSystemStatus {
    return {
      ...this.status,
      activeSubscriptions: authSubscriptionManager.getActiveSubscriptionCount(),
      isConnected: authSubscriptionManager.isSubscriptionConnected(),
    };
  }

  /**
   * Get system configuration
   */
  getConfig(): CompleteAuthConfig {
    return { ...this.config };
  }

  /**
   * Update system configuration
   */
  updateConfig(updates: Partial<CompleteAuthConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Shutdown the auth system
   */
  shutdown(): void {
    authSubscriptionManager.unsubscribeAll();
    permissionsManager.clearCache();
    this.status.isInitialized = false;
    this.status.isConnected = false;
  }
}

// Export singleton instance
export const completeAuthSystem = new CompleteAuthSystem();