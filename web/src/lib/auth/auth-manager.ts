/**
 * Advanced Authentication Manager
 * Handles advanced auth patterns, session management, and security features
 */

import { apolloClient } from '@/lib/apollo/client';
import { AuthEvent, AuthEventType } from '@/graphql/subscriptions/auth-subscriptions';
import {
  LOGOUT_ALL_SESSIONS_MUTATION,
  CHANGE_PASSWORD_MUTATION,
  FORGOT_PASSWORD_MUTATION,
  RESET_PASSWORD_MUTATION,
} from '@/graphql/mutations/auth-complete';
import {
  REQUIRES_MFA_QUERY,
  ME_QUERY,
} from '@/graphql/queries/auth-complete';

export interface SessionInfo {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  lastActivity: Date;
  isCurrentSession: boolean;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface SecuritySettings {
  mfaEnabled: boolean;
  sessionTimeout: number;
  maxSessions: number;
  passwordExpiryDays: number;
}

/**
 * Advanced Authentication Manager
 * Extends basic auth with advanced security features
 */
export class AdvancedAuthManager {
  private securitySettings: SecuritySettings | null = null;
  private activeSessions: SessionInfo[] = [];
  private authEventListeners: Set<(event: AuthEvent) => void> = new Set();

  /**
   * Check if user requires MFA before login
   */
  async requiresMfa(email: string): Promise<boolean> {
    try {
      const result = await apolloClient.query({
        query: REQUIRES_MFA_QUERY,
        variables: { email },
        fetchPolicy: 'network-only',
      });

      return result.data?.requiresMfa?.required || false;
    } catch (error) {
      console.error('Failed to check MFA requirement:', error);
      return false;
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser() {
    try {
      const result = await apolloClient.query({
        query: ME_QUERY,
        fetchPolicy: 'cache-first',
      });

      return result.data?.me || null;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }
  /**
   * Logout from all sessions
   */
  async logoutAllSessions(): Promise<void> {
    try {
      await apolloClient.mutate({
        mutation: LOGOUT_ALL_SESSIONS_MUTATION,
      });

      // Clear local state
      this.activeSessions = [];
    } catch (error) {
      console.error('Failed to logout all sessions:', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(request: PasswordChangeRequest): Promise<void> {
    try {
      const result = await apolloClient.mutate({
        mutation: CHANGE_PASSWORD_MUTATION,
        variables: {
          input: {
            currentPassword: request.currentPassword,
            newPassword: request.newPassword,
          },
        },
      });

      if (!result.data?.changePassword?.success) {
        throw new Error(result.data?.changePassword?.message || 'Password change failed');
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(request: PasswordResetRequest): Promise<void> {
    try {
      const result = await apolloClient.mutate({
        mutation: FORGOT_PASSWORD_MUTATION,
        variables: {
          input: {
            email: request.email,
          },
        },
      });

      if (!result.data?.forgotPassword?.success) {
        throw new Error(result.data?.forgotPassword?.message || 'Password reset request failed');
      }
    } catch (error) {
      console.error('Failed to request password reset:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(request: PasswordResetConfirm): Promise<void> {
    try {
      const result = await apolloClient.mutate({
        mutation: RESET_PASSWORD_MUTATION,
        variables: {
          input: {
            token: request.token,
            newPassword: request.newPassword,
          },
        },
      });

      if (!result.data?.resetPassword?.success) {
        throw new Error(result.data?.resetPassword?.message || 'Password reset failed');
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
      throw error;
    }
  }

  /**
   * Add auth event listener
   */
  addAuthEventListener(listener: (event: AuthEvent) => void): () => void {
    this.authEventListeners.add(listener);
    return () => this.authEventListeners.delete(listener);
  }

  /**
   * Emit auth event to listeners
   */
  private emitAuthEvent(event: AuthEvent): void {
    this.authEventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Auth event listener error:', error);
      }
    });
  }

  /**
   * Get security settings
   */
  getSecuritySettings(): SecuritySettings | null {
    return this.securitySettings;
  }

  /**
   * Update security settings
   */
  updateSecuritySettings(settings: Partial<SecuritySettings>): void {
    this.securitySettings = {
      ...this.securitySettings,
      ...settings,
    } as SecuritySettings;
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): SessionInfo[] {
    return [...this.activeSessions];
  }

  /**
   * Validate session security
   */
  validateSessionSecurity(): boolean {
    if (!this.securitySettings) return true;

    // Check session timeout
    const now = new Date();
    const currentSession = this.activeSessions.find(s => s.isCurrentSession);
    
    if (currentSession && this.securitySettings.sessionTimeout > 0) {
      const timeSinceActivity = now.getTime() - currentSession.lastActivity.getTime();
      if (timeSinceActivity > this.securitySettings.sessionTimeout * 60 * 1000) {
        return false;
      }
    }

    // Check max sessions
    if (this.activeSessions.length > this.securitySettings.maxSessions) {
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const advancedAuthManager = new AdvancedAuthManager();