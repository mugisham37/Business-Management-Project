/**
 * Complete Auth GraphQL Queries
 * Comprehensive queries matching all backend auth endpoints
 */

import { gql } from '@apollo/client';

// Authentication Queries
export const REQUIRES_MFA_QUERY = gql`
  query RequiresMfa($email: String!) {
    requiresMfa(email: $email) {
      required
      message
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
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
  }
`;

// MFA Queries
export const MFA_STATUS_QUERY = gql`
  query MfaStatus {
    mfaStatus {
      isEnabled
      backupCodesCount
      lastUsedAt
    }
  }
`;

export const IS_MFA_ENABLED_QUERY = gql`
  query IsMfaEnabled {
    isMfaEnabled
  }
`;

// Permission Queries
export const GET_PERMISSIONS_QUERY = gql`
  query GetPermissions($userId: String!) {
    getPermissions(userId: $userId)
  }
`;

export const MY_PERMISSIONS_QUERY = gql`
  query MyPermissions {
    myPermissions
  }
`;

export const GET_ROLES_QUERY = gql`
  query GetRoles {
    getRoles {
      name
      permissions
    }
  }
`;

export const GET_ROLE_PERMISSIONS_QUERY = gql`
  query GetRolePermissions($role: String!) {
    getRolePermissions(role: $role)
  }
`;

export const HAS_PERMISSION_QUERY = gql`
  query HasPermission($userId: String!, $permission: String!, $resource: String, $resourceId: String) {
    hasPermission(userId: $userId, permission: $permission, resource: $resource, resourceId: $resourceId)
  }
`;

export const GET_ALL_PERMISSIONS_QUERY = gql`
  query GetAllPermissions {
    getAllPermissions
  }
`;

export const GET_DETAILED_PERMISSIONS_QUERY = gql`
  query GetDetailedPermissions($userId: String!) {
    getDetailedPermissions(userId: $userId) {
      permissions
      role
      detailedPermissions {
        id
        userId
        permission
        resource
        resourceId
        grantedBy
        grantedAt
        expiresAt
        isInherited
      }
      includesInherited
    }
  }
`;

export const CHECK_PERMISSION_QUERY = gql`
  query CheckPermission($input: CheckPermissionInput!) {
    checkPermission(input: $input) {
      hasPermission
      source
      grantedAt
      expiresAt
    }
  }
`;

export const GET_AVAILABLE_PERMISSIONS_QUERY = gql`
  query GetAvailablePermissions {
    getAvailablePermissions {
      permissions
      resources
      actions
      roles {
        name
        permissions
      }
    }
  }
`;