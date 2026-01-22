/**
 * Multi-Factor Authentication Manager
 * Handles TOTP and SMS MFA flows
 * Requirements: 3.3
 */

import { apolloClient } from '@/lib/apollo/client';
import { SETUP_MFA_MUTATION, VERIFY_MFA_MUTATION, DISABLE_MFA_MUTATION } from '@/graphql/mutations/auth';

export type MFAMethod = 'TOTP' | 'SMS';

export interface MFASetupResult {
  success: boolean;
  message?: string;
  secret?: string;
  qrCode?: string;
  backupCodes?: string[];
}

export interface MFAVerificationResult {
  success: boolean;
  message?: string;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  };
}

export interface MFAState {
  isEnabled: boolean;
  method: MFAMethod | null;
  isSetupInProgress: boolean;
  isVerificationRequired: boolean;
  backupCodesRemaining: number;
}

/**
 * Multi-Factor Authentication Manager
 */
export class MFAManager {
  private currentState: MFAState = {
    isEnabled: false,
    method: null,
    isSetupInProgress: false,
    isVerificationRequired: false,
    backupCodesRemaining: 0,
  };

  private listeners: Set<(state: MFAState) => void> = new Set();

  /**
   * Setup MFA for the current user
   */
  async setupMFA(method: MFAMethod): Promise<MFASetupResult> {
    this.updateState({ isSetupInProgress: true });

    try {
      const result = await apolloClient.mutate({
        mutation: SETUP_MFA_MUTATION,
        variables: { method },
        errorPolicy: 'all',
      });

      const setupResult = result.data?.setupMFA;

      if (!setupResult?.success) {
        throw new Error(setupResult?.message || 'MFA setup failed');
      }

      // Update state to reflect setup in progress
      this.updateState({
        method,
        isSetupInProgress: true,
      });

      return {
        success: true,
        secret: setupResult.secret,
        qrCode: setupResult.qrCode,
        backupCodes: setupResult.backupCodes,
      };
    } catch (error) {
      console.error('MFA setup failed:', error);
      this.updateState({ isSetupInProgress: false });
      
      return {
        success: false,
        message: (error as Error).message || 'MFA setup failed',
      };
    }
  }

  /**
   * Verify MFA code during setup or login
   */
  async verifyMFA(code: string): Promise<MFAVerificationResult> {
    try {
      const result = await apolloClient.mutate({
        mutation: VERIFY_MFA_MUTATION,
        variables: { code },
        errorPolicy: 'all',
      });

      const verifyResult = result.data?.verifyMFA;

      if (!verifyResult?.success) {
        throw new Error(verifyResult?.message || 'MFA verification failed');
      }

      // If we get tokens back, MFA verification was part of login flow
      if (verifyResult.tokens) {
        this.updateState({
          isEnabled: true,
          isSetupInProgress: false,
          isVerificationRequired: false,
        });

        return {
          success: true,
          tokens: {
            accessToken: verifyResult.tokens.accessToken,
            refreshToken: verifyResult.tokens.refreshToken,
            expiresAt: new Date(verifyResult.tokens.expiresAt),
          },
        };
      }

      // Otherwise, it was setup verification
      this.updateState({
        isEnabled: true,
        isSetupInProgress: false,
      });

      return { success: true };
    } catch (error) {
      console.error('MFA verification failed:', error);
      
      return {
        success: false,
        message: (error as Error).message || 'MFA verification failed',
      };
    }
  }

  /**
   * Disable MFA for the current user
   */
  async disableMFA(password: string): Promise<{ success: boolean; message?: string }> {
    try {
      const result = await apolloClient.mutate({
        mutation: DISABLE_MFA_MUTATION,
        variables: { password },
        errorPolicy: 'all',
      });

      const disableResult = result.data?.disableMFA;

      if (!disableResult?.success) {
        throw new Error(disableResult?.message || 'MFA disable failed');
      }

      this.updateState({
        isEnabled: false,
        method: null,
        isSetupInProgress: false,
        isVerificationRequired: false,
        backupCodesRemaining: 0,
      });

      return { success: true };
    } catch (error) {
      console.error('MFA disable failed:', error);
      
      return {
        success: false,
        message: (error as Error).message || 'MFA disable failed',
      };
    }
  }

  /**
   * Generate TOTP code for testing (development only)
   */
  generateTOTPCode(secret: string): string {
    // This is a simplified TOTP implementation for development
    // In production, users would use an authenticator app
    const time = Math.floor(Date.now() / 30000);
    const hash = this.hmacSHA1(secret, time.toString());
    const offset = hash.charCodeAt(hash.length - 1) & 0x0f;
    const code = ((hash.charCodeAt(offset) & 0x7f) << 24) |
                 ((hash.charCodeAt(offset + 1) & 0xff) << 16) |
                 ((hash.charCodeAt(offset + 2) & 0xff) << 8) |
                 (hash.charCodeAt(offset + 3) & 0xff);
    
    return (code % 1000000).toString().padStart(6, '0');
  }

  /**
   * Validate TOTP code format
   */
  isValidTOTPCode(code: string): boolean {
    return /^\d{6}$/.test(code);
  }

  /**
   * Validate SMS code format
   */
  isValidSMSCode(code: string): boolean {
    return /^\d{4,8}$/.test(code);
  }

  /**
   * Get current MFA state
   */
  getMFAState(): MFAState {
    return { ...this.currentState };
  }

  /**
   * Check if MFA is enabled
   */
  isMFAEnabled(): boolean {
    return this.currentState.isEnabled;
  }

  /**
   * Check if MFA verification is required
   */
  isMFARequired(): boolean {
    return this.currentState.isVerificationRequired;
  }

  /**
   * Set MFA verification requirement (called by auth manager)
   */
  setMFARequired(required: boolean): void {
    this.updateState({ isVerificationRequired: required });
  }

  /**
   * Subscribe to MFA state changes
   */
  onMFAStateChange(listener: (state: MFAState) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.currentState);
    
    return () => this.listeners.delete(listener);
  }

  /**
   * Update MFA state and notify listeners
   */
  private updateState(updates: Partial<MFAState>): void {
    this.currentState = {
      ...this.currentState,
      ...updates,
    };

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('Error in MFA state listener:', error);
      }
    });
  }

  /**
   * Simple HMAC-SHA1 implementation for TOTP (development only)
   */
  private hmacSHA1(key: string, message: string): string {
    // This is a simplified implementation for development
    // In production, use a proper crypto library
    const keyBytes = new TextEncoder().encode(key);
    const messageBytes = new TextEncoder().encode(message);
    
    // Simple XOR-based hash for demo purposes
    let hash = '';
    for (let i = 0; i < 20; i++) {
      const keyByte = keyBytes[i % keyBytes.length] || 0;
      const messageByte = messageBytes[i % messageBytes.length] || 0;
      hash += String.fromCharCode((keyByte ^ messageByte ^ i) & 0xff);
    }
    
    return hash;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.listeners.clear();
  }
}

// Default MFA manager instance
let defaultMFAManager: MFAManager | null = null;

export function createMFAManager(): MFAManager {
  return new MFAManager();
}

export function getDefaultMFAManager(): MFAManager | null {
  return defaultMFAManager;
}

export function setDefaultMFAManager(manager: MFAManager): void {
  defaultMFAManager = manager;
}

// Export singleton instance
export const mfaManager = new MFAManager();