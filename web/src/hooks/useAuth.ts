/**
 * Authentication React Hooks
 * Provides React integration for authentication system
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  AuthManager, 
  authManager, 
  MFAManager, 
  mfaManager,
  type LoginCredentials,
  type AuthResult,
  type AuthState,
  type MFAState,
  type MFAMethod,
} from '@/lib/auth';

/**
 * Main authentication hook
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(authManager.getAuthState());

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authManager.onAuthStateChange(setAuthState);
    return unsubscribe;
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResult> => {
    return authManager.login(credentials);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    return authManager.logout();
  }, []);

  const refreshTokens = useCallback(async (): Promise<void> => {
    try {
      await authManager.refreshTokens();
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    return authManager.hasPermission(permission);
  }, []);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    return authManager.hasAnyPermission(permissions);
  }, []);

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    return authManager.hasAllPermissions(permissions);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return authManager.getAccessToken();
  }, []);

  return {
    // State
    ...authState,
    
    // Actions
    login,
    logout,
    refreshTokens,
    
    // Permission checks
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    
    // Token access
    getAccessToken,
    
    // Computed properties
    isLoggedIn: authState.isAuthenticated,
    currentUser: authState.user,
  };
}

/**
 * MFA-specific hook
 */
export function useMFA() {
  const [mfaState, setMFAState] = useState<MFAState>(mfaManager.getMFAState());

  useEffect(() => {
    // Subscribe to MFA state changes
    const unsubscribe = mfaManager.onMFAStateChange(setMFAState);
    return unsubscribe;
  }, []);

  const setupMFA = useCallback(async (method: MFAMethod) => {
    return mfaManager.setupMFA(method);
  }, []);

  const verifyMFA = useCallback(async (code: string) => {
    return mfaManager.verifyMFA(code);
  }, []);

  const disableMFA = useCallback(async (password: string) => {
    return mfaManager.disableMFA(password);
  }, []);

  const generateTOTPCode = useCallback((secret: string): string => {
    return mfaManager.generateTOTPCode(secret);
  }, []);

  const isValidTOTPCode = useCallback((code: string): boolean => {
    return mfaManager.isValidTOTPCode(code);
  }, []);

  const isValidSMSCode = useCallback((code: string): boolean => {
    return mfaManager.isValidSMSCode(code);
  }, []);

  return {
    // State
    ...mfaState,
    
    // Actions
    setupMFA,
    verifyMFA,
    disableMFA,
    
    // Utilities
    generateTOTPCode,
    isValidTOTPCode,
    isValidSMSCode,
  };
}

/**
 * Permission checking hook
 */
export function usePermission(permission: string | string[]) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  if (typeof permission === 'string') {
    return hasPermission(permission);
  }

  // For array of permissions, check if user has any of them
  return hasAnyPermission(permission);
}

/**
 * Hook for checking if user has all specified permissions
 */
export function useRequireAllPermissions(permissions: string[]) {
  const { hasAllPermissions } = useAuth();
  return hasAllPermissions(permissions);
}

/**
 * Hook that redirects to login if not authenticated
 */
export function useRequireAuth(redirectTo = '/login') {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // In a real app, you'd use your router's redirect method
      if (typeof window !== 'undefined') {
        window.location.href = redirectTo;
      }
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  return { isAuthenticated, isLoading };
}

/**
 * Hook for handling authentication loading states
 */
export function useAuthLoading() {
  const { isLoading } = useAuth();
  return isLoading;
}

/**
 * Hook for getting current user information
 */
export function useCurrentUser() {
  const { user, isAuthenticated } = useAuth();
  return { user, isAuthenticated };
}

/**
 * Hook for token management
 */
export function useTokens() {
  const { tokens, getAccessToken } = useAuth();
  
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      return Date.now() >= expirationTime;
    } catch {
      return true;
    }
  }, []);

  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    const token = await getAccessToken();
    if (!token || isTokenExpired(token)) {
      return null;
    }
    return token;
  }, [getAccessToken, isTokenExpired]);

  return {
    tokens,
    getAccessToken,
    getValidAccessToken,
    isTokenExpired,
  };
}