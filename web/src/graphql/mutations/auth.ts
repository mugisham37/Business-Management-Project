/**
 * Complete Auth GraphQL Mutations
 * Comprehensive mutations matching all backend auth endpoints
 */

import { gql } from '@apollo/client';

// Authentication Mutations
export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      user {
        id
        email
        tenantId
        role
        permissions
        firstName
        lastName
        displayName
        avatar
        lastLoginAt
      }
      accessToken
      refreshToken
      expiresIn
      tokenType
    }
  }
`;

export const LOGIN_WITH_MFA_MUTATION = gql`
  mutation LoginWithMfa($input: LoginWithMfaInput!) {
    loginWithMfa(input: $input) {
      user {
        id
        email
        tenantId
        role
        permissions
        firstName
        lastName
        displayName
        avatar
        lastLoginAt
      }
      accessToken
      refreshToken
      expiresIn
      tokenType
    }
  }
`;

export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      user {
        id
        email
        tenantId
        role
        permissions
        firstName
        lastName
        displayName
        avatar
      }
      accessToken
      refreshToken
      expiresIn
      tokenType
    }
  }
`;

export const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout {
      success
      message
    }
  }
`;

export const LOGOUT_ALL_SESSIONS_MUTATION = gql`
  mutation LogoutAllSessions {
    logoutAllSessions {
      success
      message
    }
  }
`;

export const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) {
      accessToken
      refreshToken
      expiresIn
      tokenType
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

// MFA Mutations
export const GENERATE_MFA_SETUP_MUTATION = gql`
  mutation GenerateMfaSetup {
    generateMfaSetup {
      secret
      qrCodeUrl
      backupCodes
      manualEntryKey
    }
  }
`;

export const ENABLE_MFA_MUTATION = gql`
  mutation EnableMfa($input: EnableMfaInput!) {
    enableMfa(input: $input) {
      success
      message
    }
  }
`;

export const DISABLE_MFA_MUTATION = gql`
  mutation DisableMfa($input: DisableMfaInput!) {
    disableMfa(input: $input) {
      success
      message
    }
  }
`;

export const VERIFY_MFA_TOKEN_MUTATION = gql`
  mutation VerifyMfaToken($input: VerifyMfaTokenInput!) {
    verifyMfaToken(input: $input) {
      success
      message
    }
  }
`;

export const GENERATE_BACKUP_CODES_MUTATION = gql`
  mutation GenerateBackupCodes($input: GenerateBackupCodesInput!) {
    generateBackupCodes(input: $input)
  }
`;

// Permission Mutations
export const GRANT_PERMISSION_MUTATION = gql`
  mutation GrantPermission($input: GrantPermissionInput!) {
    grantPermission(input: $input) {
      success
      message
    }
  }
`;

export const REVOKE_PERMISSION_MUTATION = gql`
  mutation RevokePermission($input: RevokePermissionInput!) {
    revokePermission(input: $input) {
      success
      message
    }
  }
`;

export const ASSIGN_ROLE_MUTATION = gql`
  mutation AssignRole($input: AssignRoleInput!) {
    assignRole(input: $input) {
      success
      message
    }
  }
`;

export const BULK_GRANT_PERMISSIONS_MUTATION = gql`
  mutation BulkGrantPermissions($input: BulkPermissionInput!) {
    bulkGrantPermissions(input: $input) {
      success
      failed
      results {
        userId
        success
        message
      }
    }
  }
`;

export const BULK_REVOKE_PERMISSIONS_MUTATION = gql`
  mutation BulkRevokePermissions($input: BulkPermissionInput!) {
    bulkRevokePermissions(input: $input) {
      success
      failed
      results {
        userId
        success
        message
      }
    }
  }
`;