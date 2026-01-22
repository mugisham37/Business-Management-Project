/**
 * Authentication Manager
 * Central authentication system handling login, logout, and session management
 * Requirements: 3.1, 3.2, 3.7, 3.8
 */

import { User, TokenPair, AuthState } from '@/types/core';
import { TokenManager, createTokenManager } from './token-manager';
import { apolloClient } from '@/lib/apollo/client';
import { LOGIN_MUTATION, REFRESH_TOKEN_MUTATION, LOGOUT_MUTATION } from '@/graphql/mutations/auth';

export interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
  tokens?: TokenPair;
  mfaRequired?: boolean;
}

export interface AuthManagerConfig {
  onAuthStateChange?: (state: AuthState) => void;
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthError?: (error: Error) => void;
}

/**
 * Authentication Manager
 * Handles all authentication operations and state management
 */
export class AuthManager {
  private tokenManager: TokenManager;
  private currentState: AuthState;
  private listeners: Set<(state: AuthState) => void> = new Set();

  constructor(private config: AuthManagerConfig = {}) {
    this.currentState = {
      user: null,
      tokens: null,
      permissions: [],
      mfaRequired: false,
      isAuthenticated: false,
      isLoading: false,
    };

    // Initialize token manager with refresh function
    this.tokenManager = createTokenManager(
      this.refreshTokens.bind(this),
      {
        refreshThreshold: 5, // Refresh 5 minutes before expiry
        maxRetries: 3,
      }
    );

    // Listen for token changes
    this.tokenManager.onTokenChange(this.handleTokenChange.bind(this));

    // Initialize state from stored tokens
    this.initializeFromStorage();
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    this.setLoading(true);

    try {
      const result = await apolloClient.mutate({
        mutation: LOGIN_MUTATION,
        variables: { input: credentials },
        errorPolicy: 'all',
      });

      const authResult = result.data?.login;
      
      if (!authResult?.success) {
        throw new Error(authResult?.message || 'Login failed');
      }

      // Handle MFA requirement
      if (authResult.mfaRequired) {
        this.updateState({
          mfaRequired: true,
          isLoading: false,
        });
        return { success: true, mfaRequired: true };
      }

      // Handle successful login
      if (authResult.user && authResult.tokens) {
        this.handleSuccessfulAuth(authResult.user, authResult.tokens);
        return { 
          success: true, 
          user: authResult.user, 
          tokens: authResult.tokens 
        };
      }

      throw new Error('Invalid login response');
    } catch (error) {
      console.error('Login failed:', error);
      this.handleAuthError(error as Error);
      return { 
        success: false, 
        message: (error as Error).message || 'Login failed' 
      };
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Logout and clear all authentication data
   */
  async logout(): Promise<void> {
    this.setLoading(true);

    try {
      // Call logout mutation to invalidate server-side session
      await apolloClient.mutate({
        mutation: LOGOUT_MUTATION,
        errorPolicy: 'all',
      });
    } catch (error) {
      console.warn('Logout mutation failed:', error);
      // Continue with client-side cleanup even if server logout fails
    }

    // Clear all authentication data
    this.clearAuthData();
    
    // Reset Apollo cache to prevent data leaks
    await apolloClient.clearStore();
    
    this.setLoading(false);
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.currentState };
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentState.user;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentState.isAuthenticated;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: string): boolean {
    return this.currentState.permissions.some(
      p => p.id === permission || p.name === permission || `${p.resource}:${p.action}` === permission
    );
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  /**
   * Get valid access token
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this.tokenManager.getValidTokens();
    return tokens?.accessToken || null;
  }

  /**
   * Subscribe to authentication state changes
   */
  onAuthStateChange(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.currentState);
    
    return () => this.listeners.delete(listener);
  }

  /**
   * Force refresh current tokens
   */
  async refreshTokens(refreshToken?: string): Promise<TokenPair> {
    const currentTokens = this.tokenManager.getValidTokens();
    const tokenToUse = refreshToken || (await currentTokens)?.refreshToken;

    if (!tokenToUse) {
      throw new Error('No refresh token available');
    }

    try {
      const result = await apolloClient.mutate({
        mutation: REFRESH_TOKEN_MUTATION,
        variables: { refreshToken: tokenToUse },
        errorPolicy: 'all',
      });

      const refreshResult = result.data?.refreshToken;
      
      if (!refreshResult?.success || !refreshResult.tokens) {
        throw new Error(refreshResult?.message || 'Token refresh failed');
      }

      const newTokens = refreshResult.tokens;
      
      // Update tokens in manager
      this.tokenManager.setTokens(newTokens);
      
      // Notify config callback
      this.config.onTokenRefresh?.(newTokens);
      
      return newTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Clear auth data on refresh failure
      this.clearAuthData();
      throw error;
    }
  }

  /**
   * Initialize authentication state from stored tokens
   */
  private async initializeFromStorage(): Promise<void> {
    this.setLoading(true);

    try {
      const tokens = await this.tokenManager.getValidTokens();
      
      if (tokens) {
        // We have valid tokens, but need to fetch user data
        await this.fetchCurrentUser();
      }
    } catch (error) {
      console.error('Failed to initialize from storage:', error);
      this.clearAuthData();
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Fetch current user data using stored tokens
   */
  private async fetchCurrentUser(): Promise<void> {
    try {
      // This would use a GET_CURRENT_USER query
      // For now, we'll assume the user data is available from the last login
      // In a real implementation, you'd fetch fresh user data here
      
      const tokens = await this.tokenManager.getValidTokens();
      if (tokens) {
        this.updateState({
          tokens,
          isAuthenticated: true,
        });
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      this.clearAuthData();
    }
  }

  /**
   * Handle successful authentication
   */
  private handleSuccessfulAuth(user: User, tokens: TokenPair): void {
    // Store tokens
    this.tokenManager.setTokens(tokens);
    
    // Update state
    this.updateState({
      user,
      tokens,
      permissions: user.permissions || [],
      mfaRequired: false,
      isAuthenticated: true,
    });

    // Notify config callback
    this.config.onAuthStateChange?.(this.currentState);
  }

  /**
   * Handle token changes from token manager
   */
  private handleTokenChange(tokens: TokenPair | null): void {
    if (tokens) {
      this.updateState({ tokens });
    } else {
      // Tokens were cleared, update auth state
      this.updateState({
        user: null,
        tokens: null,
        permissions: [],
        isAuthenticated: false,
        mfaRequired: false,
      });
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: Error): void {
    console.error('Authentication error:', error);
    
    // Clear auth data on certain errors
    if (error.message.includes('UNAUTHENTICATED') || 
        error.message.includes('invalid') ||
        error.message.includes('expired')) {
      this.clearAuthData();
    }

    // Notify config callback
    this.config.onAuthError?.(error);
  }

  /**
   * Clear all authentication data
   */
  private clearAuthData(): void {
    this.tokenManager.clearTokens();
    
    this.updateState({
      user: null,
      tokens: null,
      permissions: [],
      mfaRequired: false,
      isAuthenticated: false,
    });
  }

  /**
   * Update authentication state and notify listeners
   */
  private updateState(updates: Partial<AuthState>): void {
    this.currentState = {
      ...this.currentState,
      ...updates,
    };

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });

    // Notify config callback
    this.config.onAuthStateChange?.(this.currentState);
  }

  /**
   * Set loading state
   */
  private setLoading(isLoading: boolean): void {
    this.updateState({ isLoading });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.tokenManager.destroy();
    this.listeners.clear();
  }
}

// Default auth manager instance
let defaultAuthManager: AuthManager | null = null;

export function createAuthManager(config?: AuthManagerConfig): AuthManager {
  return new AuthManager(config);
}

export function getDefaultAuthManager(): AuthManager | null {
  return defaultAuthManager;
}

export function setDefaultAuthManager(manager: AuthManager): void {
  defaultAuthManager = manager;
}

// Export singleton instance
export const authManager = new AuthManager();