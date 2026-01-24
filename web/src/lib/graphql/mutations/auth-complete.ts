/**
 * Complete Auth GraphQL Mutations
 * Re-exports all auth mutation operations needed by auth managers
 */

import { gql } from '@apollo/client';
export { LOGIN_MUTATION, LOGIN_WITH_MFA_MUTATION, REFRESH_TOKEN_MUTATION, LOGOUT_MUTATION } from './auth';

// Additional mutations for advanced auth operations
export const LOGOUT_ALL_SESSIONS_MUTATION = gql`
  mutation LogoutAllSessions {
    logoutAllSessions {
      success
      message
    }
  }
`;

export const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input) {
      success
      message
    }
  }
`;

export const FORGOT_PASSWORD_MUTATION = gql`
  mutation ForgotPassword($input: ForgotPasswordInput!) {
    forgotPassword(input: $input) {
      success
      message
    }
  }
`;

export const RESET_PASSWORD_MUTATION = gql`
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
      success
      message
    }
  }
`;

export const SETUP_MFA_MUTATION = gql`
  mutation SetupMfa {
    setupMfa {
      qrCode
      secret
      backupCodes
    }
  }
`;

export const VERIFY_MFA_MUTATION = gql`
  mutation VerifyMfa($code: String!) {
    verifyMfa(code: $code) {
      success
      message
    }
  }
`;

export const DISABLE_MFA_MUTATION = gql`
  mutation DisableMfa {
    disableMfa {
      success
      message
    }
  }
`;
