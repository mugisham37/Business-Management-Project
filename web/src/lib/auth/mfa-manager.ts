/**
 * Complete MFA Manager
 * Comprehensive multi-factor authentication management
 */

import { apolloClient } from '@/lib/apollo/client';
import {
  GENERATE_MFA_SETUP_MUTATION,
  ENABLE_MFA_MUTATION,
  DISABLE_MFA_MUTATION,
  VERIFY_MFA_TOKEN_MUTATION,
  GENERATE_BACKUP_CODES_MUTATION,
} from '@/graphql/mutations/auth-complete';
import {
  MFA_STATUS_QUERY,
  IS_MFA_ENABLED_QUERY,
} from '@/graphql/queries/auth-complete';

export interface MfaSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MfaStatusResponse {
  isEnabled: boolean;
  backupCodesCount: number;
  lastUsedAt?: Date;
}

export interface MfaState {
  isEnabled: boolean;
  isSetupInProgress: boolean;
  backupCodesCount: number;
  lastUsedAt?: Date;
  setupData?: MfaSetupResponse;
}

export interface MfaVerificationResult {
  success: boolean;
  message?: string;
}

/**
 * Complete MFA Manager
 * Handles all MFA operations with full backend integration
 */
export class CompleteMfaManager {
  private currentState: MfaState = {
    isEnabled: false,
    isSetupInProgress: false,
    backupCodesCount: 0,
  };

  private listeners: Set<(state: MfaState) => void> = new Set();

  /**
   * Get current MFA state
   */
  getMfaState(): MfaState {
    return { ...this.currentState };
  }

  /**
   * Subscribe to MFA state changes
   */
  onMfaStateChange(listener: (state: MfaState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update MFA state and notify listeners
   */
  private updateState(updates: Partial<MfaState>): void {
    this.currentState = { ...this.currentState, ...updates };
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('MFA state listener error:', error);
      }
    });
  }

  /**
   * Check if MFA is enabled
   */
  async isMfaEnabled(): Promise<boolean> {
    try {
      const result = await apolloClient.query({
        query: IS_MFA_ENABLED_QUERY,
        fetchPolicy: 'network-only',
      });

      const isEnabled = result.data?.isMfaEnabled || false;
      this.updateState({ isEnabled });
      return isEnabled;
    } catch (error) {
      console.error('Failed to check MFA status:', error);
      return false;
    }
  }
  /**
   * Get detailed MFA status
   */
  async getMfaStatus(): Promise<MfaStatusResponse> {
    try {
      const result = await apolloClient.query({
        query: MFA_STATUS_QUERY,
        fetchPolicy: 'network-only',
      });

      const status = result.data?.mfaStatus || {
        isEnabled: false,
        backupCodesCount: 0,
      };

      this.updateState({
        isEnabled: status.isEnabled,
        backupCodesCount: status.backupCodesCount,
        lastUsedAt: status.lastUsedAt ? new Date(status.lastUsedAt) : undefined,
      });

      return status;
    } catch (error) {
      console.error('Failed to get MFA status:', error);
      throw error;
    }
  }

  /**
   * Generate MFA setup (QR code and backup codes)
   */
  async generateMfaSetup(): Promise<MfaSetupResponse> {
    try {
      this.updateState({ isSetupInProgress: true });

      const result = await apolloClient.mutate({
        mutation: GENERATE_MFA_SETUP_MUTATION,
      });

      const setupData = result.data?.generateMfaSetup;
      if (!setupData) {
        throw new Error('Failed to generate MFA setup');
      }

      this.updateState({ setupData });
      return setupData;
    } catch (error) {
      this.updateState({ isSetupInProgress: false });
      console.error('Failed to generate MFA setup:', error);
      throw error;
    }
  }

  /**
   * Enable MFA after setup verification
   */
  async enableMfa(token: string): Promise<MfaVerificationResult> {
    try {
      const result = await apolloClient.mutate({
        mutation: ENABLE_MFA_MUTATION,
        variables: {
          input: { token },
        },
      });

      const response = result.data?.enableMfa;
      if (response?.success) {
        this.updateState({
          isEnabled: true,
          isSetupInProgress: false,
          setupData: undefined,
        });
      }

      return {
        success: response?.success || false,
        message: response?.message,
      };
    } catch (error) {
      console.error('Failed to enable MFA:', error);
      return {
        success: false,
        message: (error as Error).message || 'Failed to enable MFA',
      };
    }
  }

  /**
   * Disable MFA
   */
  async disableMfa(token: string): Promise<MfaVerificationResult> {
    try {
      const result = await apolloClient.mutate({
        mutation: DISABLE_MFA_MUTATION,
        variables: {
          input: { token },
        },
      });

      const response = result.data?.disableMfa;
      if (response?.success) {
        this.updateState({
          isEnabled: false,
          backupCodesCount: 0,
          lastUsedAt: undefined,
        });
      }

      return {
        success: response?.success || false,
        message: response?.message,
      };
    } catch (error) {
      console.error('Failed to disable MFA:', error);
      return {
        success: false,
        message: (error as Error).message || 'Failed to disable MFA',
      };
    }
  }

  /**
   * Verify MFA token
   */
  async verifyMfaToken(token: string): Promise<MfaVerificationResult> {
    try {
      const result = await apolloClient.mutate({
        mutation: VERIFY_MFA_TOKEN_MUTATION,
        variables: {
          input: { token },
        },
      });

      const response = result.data?.verifyMfaToken;
      return {
        success: response?.success || false,
        message: response?.message,
      };
    } catch (error) {
      console.error('Failed to verify MFA token:', error);
      return {
        success: false,
        message: (error as Error).message || 'Failed to verify MFA token',
      };
    }
  }

  /**
   * Generate new backup codes
   */
  async generateBackupCodes(token: string): Promise<string[]> {
    try {
      const result = await apolloClient.mutate({
        mutation: GENERATE_BACKUP_CODES_MUTATION,
        variables: {
          input: { token },
        },
      });

      const backupCodes = result.data?.generateBackupCodes || [];
      this.updateState({ backupCodesCount: backupCodes.length });
      return backupCodes;
    } catch (error) {
      console.error('Failed to generate backup codes:', error);
      throw error;
    }
  }

  /**
   * Validate TOTP code format
   */
  isValidTotpCode(code: string): boolean {
    return /^\d{6}$/.test(code);
  }

  /**
   * Validate backup code format
   */
  isValidBackupCode(code: string): boolean {
    return /^[a-f0-9]{8}$/i.test(code);
  }

  /**
   * Cancel MFA setup
   */
  cancelMfaSetup(): void {
    this.updateState({
      isSetupInProgress: false,
      setupData: undefined,
    });
  }
}

// Export singleton instance
export const completeMfaManager = new CompleteMfaManager();