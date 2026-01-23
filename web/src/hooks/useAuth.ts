/**
 * Complete Auth Hooks
 * Comprehensive React hooks for all auth functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { advancedAuthManager, PasswordChangeRequest, PasswordResetRequest, PasswordResetConfirm } from '@/lib/auth/advanced-auth-manager';
import { completeMfaManager, MfaSetupResponse, MfaStatusResponse } from '@/lib/auth/mfa-manager-complete';
import { permissionsManager, Permission, Role, UserPermissionsResponse, GrantPermissionRequest, RevokePermissionRequest, AssignRoleRequest, BulkPermissionRequest, BulkPermissionResponse } from '@/lib/auth/permissions-manager';
import { authSubscriptionManager, AuthSubscriptionOptions } from '@/lib/auth/subscription-manager';
import { AuthEvent, AuthEventType } from '@/graphql/subscriptions/auth-subscriptions';

/**
 * Advanced Auth Hook
 * Provides advanced authentication features
 */
export function useAdvancedAuth() {
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const requiresMfa = useCallback(async (email: string): Promise<boolean> => {
    return advancedAuthManager.requiresMfa(email);
  }, []);

  const getCurrentUser = useCallback(async () => {
    return advancedAuthManager.getCurrentUser();
  }, []);

  const logoutAllSessions = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await advancedAuthManager.logoutAllSessions();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (request: PasswordChangeRequest): Promise<void> => {
    setIsLoading(true);
    try {
      await advancedAuthManager.changePassword(request);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (request: PasswordResetRequest): Promise<void> => {
    setIsLoading(true);
    try {
      await advancedAuthManager.forgotPassword(request);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (request: PasswordResetConfirm): Promise<void> => {
    setIsLoading(true);
    try {
      await advancedAuthManager.resetPassword(request);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    requiresMfa,
    getCurrentUser,
    logoutAllSessions,
    changePassword,
    forgotPassword,
    resetPassword,
  };
}

/**
 * Complete MFA Hook
 * Provides comprehensive MFA functionality
 */
export function useCompleteMfa() {
  const [mfaState, setMfaState] = useState(completeMfaManager.getMfaState());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = completeMfaManager.onMfaStateChange(setMfaState);
    return unsubscribe;
  }, []);

  const isMfaEnabled = useCallback(async (): Promise<boolean> => {
    return completeMfaManager.isMfaEnabled();
  }, []);

  const getMfaStatus = useCallback(async (): Promise<MfaStatusResponse> => {
    return completeMfaManager.getMfaStatus();
  }, []);

  const generateMfaSetup = useCallback(async (): Promise<MfaSetupResponse> => {
    setIsLoading(true);
    try {
      return await completeMfaManager.generateMfaSetup();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const enableMfa = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      return await completeMfaManager.enableMfa(token);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disableMfa = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      return await completeMfaManager.disableMfa(token);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyMfaToken = useCallback(async (token: string) => {
    return completeMfaManager.verifyMfaToken(token);
  }, []);

  const generateBackupCodes = useCallback(async (token: string): Promise<string[]> => {
    setIsLoading(true);
    try {
      return await completeMfaManager.generateBackupCodes(token);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelMfaSetup = useCallback(() => {
    completeMfaManager.cancelMfaSetup();
  }, []);

  return {
    ...mfaState,
    isLoading,
    isMfaEnabled,
    getMfaStatus,
    generateMfaSetup,
    enableMfa,
    disableMfa,
    verifyMfaToken,
    generateBackupCodes,
    cancelMfaSetup,
    isValidTotpCode: completeMfaManager.isValidTotpCode,
    isValidBackupCode: completeMfaManager.isValidBackupCode,
  };
}
/**
 * Permissions Hook
 * Provides comprehensive permission management
 */
export function usePermissions() {
  const [isLoading, setIsLoading] = useState(false);

  const getPermissions = useCallback(async (userId: string): Promise<string[]> => {
    return permissionsManager.getPermissions(userId);
  }, []);

  const getMyPermissions = useCallback(async (): Promise<string[]> => {
    return permissionsManager.getMyPermissions();
  }, []);

  const getRoles = useCallback(async (): Promise<Role[]> => {
    return permissionsManager.getRoles();
  }, []);

  const getRolePermissions = useCallback(async (role: string): Promise<string[]> => {
    return permissionsManager.getRolePermissions(role);
  }, []);

  const hasPermission = useCallback(async (
    userId: string,
    permission: string,
    resource?: string,
    resourceId?: string
  ): Promise<boolean> => {
    return permissionsManager.hasPermission(userId, permission, resource, resourceId);
  }, []);

  const hasAnyPermission = useCallback(async (userId: string, permissions: string[]): Promise<boolean> => {
    return permissionsManager.hasAnyPermission(userId, permissions);
  }, []);

  const hasAllPermissions = useCallback(async (userId: string, permissions: string[]): Promise<boolean> => {
    return permissionsManager.hasAllPermissions(userId, permissions);
  }, []);

  const getAllPermissions = useCallback(async (): Promise<string[]> => {
    return permissionsManager.getAllPermissions();
  }, []);

  const getDetailedPermissions = useCallback(async (userId: string): Promise<UserPermissionsResponse> => {
    return permissionsManager.getDetailedPermissions(userId);
  }, []);

  const getAvailablePermissions = useCallback(async () => {
    return permissionsManager.getAvailablePermissions();
  }, []);

  const grantPermission = useCallback(async (request: GrantPermissionRequest): Promise<void> => {
    setIsLoading(true);
    try {
      await permissionsManager.grantPermission(request);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revokePermission = useCallback(async (request: RevokePermissionRequest): Promise<void> => {
    setIsLoading(true);
    try {
      await permissionsManager.revokePermission(request);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const assignRole = useCallback(async (request: AssignRoleRequest): Promise<void> => {
    setIsLoading(true);
    try {
      await permissionsManager.assignRole(request);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const bulkGrantPermissions = useCallback(async (request: BulkPermissionRequest): Promise<BulkPermissionResponse> => {
    setIsLoading(true);
    try {
      return await permissionsManager.bulkGrantPermissions(request);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const bulkRevokePermissions = useCallback(async (request: BulkPermissionRequest): Promise<BulkPermissionResponse> => {
    setIsLoading(true);
    try {
      return await permissionsManager.bulkRevokePermissions(request);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    permissionsManager.clearCache();
  }, []);

  return {
    isLoading,
    getPermissions,
    getMyPermissions,
    getRoles,
    getRolePermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getAllPermissions,
    getDetailedPermissions,
    getAvailablePermissions,
    grantPermission,
    revokePermission,
    assignRole,
    bulkGrantPermissions,
    bulkRevokePermissions,
    clearCache,
  };
}

/**
 * Auth Subscriptions Hook
 * Provides real-time auth event subscriptions
 */
export function useAuthSubscriptions() {
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addEvent = useCallback((event: AuthEvent) => {
    setEvents(prev => [event, ...prev.slice(0, 99)]); // Keep last 100 events
  }, []);

  const subscribeToUserAuthEvents = useCallback((options: Partial<AuthSubscriptionOptions> = {}) => {
    return authSubscriptionManager.subscribeToUserAuthEvents({
      ...options,
      onEvent: (event) => {
        addEvent(event);
        options.onEvent?.(event);
      },
    });
  }, [addEvent]);

  const subscribeToUserPermissionEvents = useCallback((options: Partial<AuthSubscriptionOptions> = {}) => {
    return authSubscriptionManager.subscribeToUserPermissionEvents({
      ...options,
      onEvent: (event) => {
        addEvent(event);
        options.onEvent?.(event);
      },
    });
  }, [addEvent]);

  const subscribeToUserMfaEvents = useCallback((options: Partial<AuthSubscriptionOptions> = {}) => {
    return authSubscriptionManager.subscribeToUserMfaEvents({
      ...options,
      onEvent: (event) => {
        addEvent(event);
        options.onEvent?.(event);
      },
    });
  }, [addEvent]);

  const subscribeToUserSessionEvents = useCallback((options: Partial<AuthSubscriptionOptions> = {}) => {
    return authSubscriptionManager.subscribeToUserSessionEvents({
      ...options,
      onEvent: (event) => {
        addEvent(event);
        options.onEvent?.(event);
      },
    });
  }, [addEvent]);

  const subscribeToTenantAuthEvents = useCallback((options: Partial<AuthSubscriptionOptions> = {}) => {
    return authSubscriptionManager.subscribeToTenantAuthEvents({
      ...options,
      onEvent: (event) => {
        addEvent(event);
        options.onEvent?.(event);
      },
    });
  }, [addEvent]);

  const subscribeToSecurityAlerts = useCallback((options: Partial<AuthSubscriptionOptions> = {}) => {
    return authSubscriptionManager.subscribeToSecurityAlerts({
      ...options,
      onEvent: (event) => {
        addEvent(event);
        options.onEvent?.(event);
      },
    });
  }, [addEvent]);

  const addEventListener = useCallback((eventType: AuthEventType, listener: (event: AuthEvent) => void) => {
    return authSubscriptionManager.addEventListener(eventType, listener);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const unsubscribeAll = useCallback(() => {
    authSubscriptionManager.unsubscribeAll();
    setIsConnected(false);
  }, []);

  useEffect(() => {
    setIsConnected(authSubscriptionManager.isSubscriptionConnected());
  }, []);

  return {
    events,
    isConnected,
    subscribeToUserAuthEvents,
    subscribeToUserPermissionEvents,
    subscribeToUserMfaEvents,
    subscribeToUserSessionEvents,
    subscribeToTenantAuthEvents,
    subscribeToSecurityAlerts,
    addEventListener,
    clearEvents,
    unsubscribeAll,
    activeSubscriptionCount: authSubscriptionManager.getActiveSubscriptionCount(),
  };
}

/**
 * Auth Event Hook
 * Listen to specific auth event types
 */
export function useAuthEvent(eventType: AuthEventType, handler: (event: AuthEvent) => void) {
  useEffect(() => {
    const unsubscribe = authSubscriptionManager.addEventListener(eventType, handler);
    return unsubscribe;
  }, [eventType, handler]);
}

/**
 * Permission Guard Hook
 * Check permissions with loading state
 */
export function usePermissionGuard(permission: string | string[], userId?: string) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      setIsLoading(true);
      try {
        if (!userId) {
          // Check current user permissions
          const myPermissions = await permissionsManager.getMyPermissions();
          const permissions = Array.isArray(permission) ? permission : [permission];
          const hasAny = permissions.some(perm => 
            myPermissions.some(userPerm => {
              if (userPerm === perm) return true;
              if (userPerm.endsWith(':*')) {
                const prefix = userPerm.slice(0, -1);
                return perm.startsWith(prefix);
              }
              return false;
            })
          );
          setHasAccess(hasAny);
        } else {
          // Check specific user permissions
          if (Array.isArray(permission)) {
            const hasAny = await permissionsManager.hasAnyPermission(userId, permission);
            setHasAccess(hasAny);
          } else {
            const has = await permissionsManager.hasPermission(userId, permission);
            setHasAccess(has);
          }
        }
      } catch (error) {
        console.error('Permission check failed:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [permission, userId]);

  return { hasAccess, isLoading };
}