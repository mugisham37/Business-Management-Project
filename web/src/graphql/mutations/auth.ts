import { gql } from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      success
      message
      user {
        id
        email
        firstName
        lastName
        permissions
      }
      tokens {
        accessToken
        refreshToken
        expiresAt
      }
      mfaRequired
    }
  }
`;

export const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      success
      message
      tokens {
        accessToken
        refreshToken
        expiresAt
      }
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

export const SETUP_MFA_MUTATION = gql`
  mutation SetupMFA($method: MFAMethod!) {
    setupMFA(method: $method) {
      success
      message
      secret
      qrCode
      backupCodes
    }
  }
`;

export const VERIFY_MFA_MUTATION = gql`
  mutation VerifyMFA($code: String!) {
    verifyMFA(code: $code) {
      success
      message
      tokens {
        accessToken
        refreshToken
        expiresAt
      }
    }
  }
`;

export const DISABLE_MFA_MUTATION = gql`
  mutation DisableMFA($password: String!) {
    disableMFA(password: $password) {
      success
      message
    }
  }
`;