/**
 * Authentication Provider
 * Provides authentication context to the entire application
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authManager, mfaManager, type AuthState, type MFAState } from '@/lib/auth';

interface AuthContextValue {
  authState: AuthState;
  mfaState: MFAState;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Authentication Provider Component
 * Manages global authentication state and provides it to child components
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(authManager.getAuthState());
  const [mfaState, setMFAState] = useState<MFAState>(mfaManager.getMFAState());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribeAuth = authManager.onAuthStateChange((state) => {
      setAuthState(state);
      
      // Mark as initialized after first state update
      if (!isInitialized) {
        setIsInitialized(true);
      }
    });

    // Subscribe to MFA state changes
    const unsubscribeMFA = mfaManager.onMFAStateChange(setMFAState);

    // Cleanup subscriptions
    return () => {
      unsubscribeAuth();
      unsubscribeMFA();
    };
  }, [isInitialized]);

  const contextValue: AuthContextValue = {
    authState,
    mfaState,
    isInitialized,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * Authentication Loading Component
 * Shows loading state while authentication is initializing
 */
interface AuthLoadingProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthLoading({ children, fallback }: AuthLoadingProps) {
  const { isInitialized } = useAuthContext();

  if (!isInitialized) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing authentication...</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

/**
 * Authentication Status Component
 * Shows current authentication status for debugging
 */
export function AuthStatus() {
  const { authState, mfaState, isInitialized } = useAuthContext();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-3 rounded-lg text-xs font-mono max-w-sm">
      <div className="mb-2 font-semibold">Auth Status (Dev)</div>
      <div>Initialized: {isInitialized ? '✓' : '✗'}</div>
      <div>Authenticated: {authState.isAuthenticated ? '✓' : '✗'}</div>
      <div>Loading: {authState.isLoading ? '✓' : '✗'}</div>
      <div>MFA Required: {authState.mfaRequired ? '✓' : '✗'}</div>
      <div>MFA Enabled: {mfaState.isEnabled ? '✓' : '✗'}</div>
      <div>User: {authState.user?.email || 'None'}</div>
      <div>Permissions: {authState.permissions.length}</div>
    </div>
  );
}