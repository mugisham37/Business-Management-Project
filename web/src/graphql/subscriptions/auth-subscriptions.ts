/**
 * Complete Auth GraphQL Subscriptions
 * Real-time subscriptions matching all backend auth events
 */

import { gql } from '@apollo/client';

// User-specific subscriptions
export const USER_AUTH_EVENTS_SUBSCRIPTION = gql`
  subscription UserAuthEvents {
    userAuthEvents {
      type
      userId
      tenantId
      timestamp
      metadata
      ipAddress
      userAgent
    }
  }
`;

export const USER_PERMISSION_EVENTS_SUBSCRIPTION = gql`
  subscription UserPermissionEvents {
    userPermissionEvents {
      type
      userId
      tenantId
      timestamp
      metadata
      ipAddress
      userAgent
    }
  }
`;

export const USER_MFA_EVENTS_SUBSCRIPTION = gql`
  subscription UserMfaEvents {
    userMfaEvents {
      type
      userId
      tenantId
      timestamp
      metadata
      ipAddress
      userAgent
    }
  }
`;

export const USER_SESSION_EVENTS_SUBSCRIPTION = gql`
  subscription UserSessionEvents {
    userSessionEvents {
      type
      userId
      tenantId
      timestamp
      metadata
      ipAddress
      userAgent
    }
  }
`;

// Tenant-wide subscriptions (require admin permissions)
export const TENANT_AUTH_EVENTS_SUBSCRIPTION = gql`
  subscription TenantAuthEvents {
    tenantAuthEvents {
      type
      userId
      tenantId
      timestamp
      metadata
      ipAddress
      userAgent
    }
  }
`;

export const SECURITY_ALERTS_SUBSCRIPTION = gql`
  subscription SecurityAlerts {
    securityAlerts {
      type
      userId
      tenantId
      timestamp
      metadata
      ipAddress
      userAgent
    }
  }
`;

export const TENANT_ROLE_EVENTS_SUBSCRIPTION = gql`
  subscription TenantRoleEvents {
    tenantRoleEvents {
      type
      userId
      tenantId
      timestamp
      metadata
      ipAddress
      userAgent
    }
  }
`;

// Admin subscriptions
export const USER_EVENTS_SUBSCRIPTION = gql`
  subscription UserEvents($userId: String!) {
    userEvents(userId: $userId) {
      type
      userId
      tenantId
      timestamp
      metadata
      ipAddress
      userAgent
    }
  }
`;

// Auth event types enum for TypeScript
export enum AuthEventType {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTERED = 'USER_REGISTERED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  FAILED_LOGIN_ATTEMPT = 'FAILED_LOGIN_ATTEMPT',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
}

// Auth event interface
export interface AuthEvent {
  type: AuthEventType;
  userId: string;
  tenantId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}