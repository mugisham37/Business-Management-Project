/**
 * Authentication Store
 * Global state management for authentication using Zustand
 * Requirements: 6.1, 6.3, 6.6
 */

import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import { User, Permission, TokenPair } from '@/types/core';

export interface AuthState {
  // Core auth state
  user: User | null;
  tokens: TokenPair | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaRequired: boolean;
  
  // Session management
  sessionId: string | null;
  lastActivity: Date | null;
  
  // Error state
  error: string | null;
}

export interface AuthActions {
  // Authentication actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: TokenPair | null) => void;
  setPermissions: (permissions: Permission[]) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setMfaRequired: (mfaRequired: boolean) => void;
  
  // Session actions
  setSessionId: (sessionId: string | null) => void;
  updateLastActivity: () => void;
  
  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Composite actions
  login: (user: User, tokens: TokenPair, permissions: Permission[]) => void;
  logout: () => void;
  refreshTokens: (tokens: TokenPair) => void;
  
  // State management
  reset: () => void;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  tokens: null,
  permissions: [],
  isAuthenticated: false,
  isLoading: false,
  mfaRequired: false,
  sessionId: null,
  lastActivity: null,
  error: null,
};

/**
 * Cross-tab synchronization storage
 */
const crossTabStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    const item = localStorage.getItem(name);
    if (!item) return null;
    
    try {
      const parsed = JSON.parse(item);
      // Add timestamp validation for security
      if (parsed.state?.tokens?.expiresAt) {
        const expiresAt = new Date(parsed.state.tokens.expiresAt);
        if (expiresAt <= new Date()) {
          localStorage.removeItem(name);
          return null;
        }
      }
      return item;
    } catch {
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    localStorage.setItem(name, value);
    
    // Broadcast change to other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: name,
      newValue: value,
      storageArea: localStorage,
    }));
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
    
    // Broadcast removal to other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: name,
      newValue: null,
      storageArea: localStorage,
    }));
  },
}));

/**
 * Authentication Store
 * Manages global authentication state with persistence and cross-tab sync
 */
export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        ...initialState,

        // Basic setters
        setUser: (user) => set((state) => ({
          ...state,
          user,
        })),

        setTokens: (tokens) => set((state) => ({
          ...state,
          tokens,
        })),

        setPermissions: (permissions) => set((state) => ({
          ...state,
          permissions,
        })),

        setAuthenticated: (isAuthenticated) => set((state) => ({
          ...state,
          isAuthenticated,
        })),

        setLoading: (isLoading) => set((state) => ({
          ...state,
          isLoading,
        })),

        setMfaRequired: (mfaRequired) => set((state) => ({
          ...state,
          mfaRequired,
        })),

        setSessionId: (sessionId) => set((state) => ({
          ...state,
          sessionId,
        })),

        updateLastActivity: () => set((state) => ({
          ...state,
          lastActivity: new Date(),
        })),

        setError: (error) => set((state) => ({
          ...state,
          error,
        })),

        clearError: () => set((state) => ({
          ...state,
          error: null,
        })),

        // Composite actions
        login: (user, tokens, permissions) => set((state) => ({
          ...state,
          user,
          tokens,
          permissions,
          isAuthenticated: true,
          isLoading: false,
          mfaRequired: false,
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          lastActivity: new Date(),
          error: null,
        })),

        logout: () => set(() => ({
          ...initialState,
        })),

        refreshTokens: (tokens) => set((state) => ({
          ...state,
          tokens,
          lastActivity: new Date(),
        })),

        reset: () => set(() => ({ ...initialState })),
      }),
      {
        name: 'auth-store',
        storage: crossTabStorage,
        partialize: (state) => ({
          // Only persist essential auth data
          user: state.user,
          tokens: state.tokens,
          permissions: state.permissions,
          isAuthenticated: state.isAuthenticated,
          sessionId: state.sessionId,
          lastActivity: state.lastActivity,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Validate session on rehydration
            if (state.tokens?.expiresAt) {
              const expiresAt = new Date(state.tokens.expiresAt);
              if (expiresAt <= new Date()) {
                state.logout();
              }
            }
          }
        },
      }
    )
  )
);

/**
 * Auth store selectors for optimized component subscriptions
 */
export const authSelectors = {
  user: (state: AuthStore) => state.user,
  isAuthenticated: (state: AuthStore) => state.isAuthenticated,
  isLoading: (state: AuthStore) => state.isLoading,
  permissions: (state: AuthStore) => state.permissions,
  tokens: (state: AuthStore) => state.tokens,
  mfaRequired: (state: AuthStore) => state.mfaRequired,
  error: (state: AuthStore) => state.error,
  sessionInfo: (state: AuthStore) => ({
    sessionId: state.sessionId,
    lastActivity: state.lastActivity,
  }),
};

/**
 * Permission checking utilities
 */
export const useAuthPermissions = () => {
  const permissions = useAuthStore(authSelectors.permissions);
  
  return {
    hasPermission: (permission: string) => 
      permissions.some(p => p.name === permission || p.name === '*'),
    
    hasAnyPermission: (requiredPermissions: string[]) =>
      requiredPermissions.some(permission => 
        permissions.some(p => p.name === permission || p.name === '*')
      ),
    
    hasAllPermissions: (requiredPermissions: string[]) =>
      requiredPermissions.every(permission => 
        permissions.some(p => p.name === permission || p.name === '*')
      ),
  };
};

/**
 * Cross-tab synchronization setup
 */
if (typeof window !== 'undefined') {
  // Listen for storage events from other tabs
  window.addEventListener('storage', (event) => {
    if (event.key === 'auth-store' && event.newValue !== event.oldValue) {
      // Force rehydration when auth state changes in another tab
      useAuthStore.persist.rehydrate();
    }
  });
  
  // Handle tab visibility changes for session management
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const state = useAuthStore.getState();
      if (state.isAuthenticated) {
        state.updateLastActivity();
      }
    }
  });
}