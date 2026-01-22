/**
 * Authentication Module - Core Authentication System
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

// Lazy load components for better code splitting
export const AuthDashboard = lazy(() => 
  import('./components/AuthDashboard').then(module => ({
    default: module.AuthDashboard
  }))
);

export const UserManagement = lazy(() => 
  import('./components/UserManagement').then(module => ({
    default: module.UserManagement
  }))
);

export const SessionManagement = lazy(() => 
  import('./components/SessionManagement').then(module => ({
    default: module.SessionManagement
  }))
);

// Export hooks
export { useAuthManagement } from './hooks/useAuthManagement';
export { useUserSessions } from './hooks/useUserSessions';

// Export module metadata
export const authModule = {
  name: 'Authentication Management',
  version: '1.0.0',
  description: 'User authentication and session management',
  components: {
    AuthDashboard,
    UserManagement,
    SessionManagement,
  },
  routes: [
    '/auth',
    '/auth/users',
    '/auth/sessions',
  ],
  permissions: ['auth:read', 'auth:write', 'auth:admin'],
  businessTier: 'MICRO',
  dependencies: ['tenant'],
} as const;

export const AUTH_MODULE_CONFIG = {
  name: 'auth',
  displayName: 'Authentication Management',
  description: 'User authentication, authorization, and session management',
  version: '1.0.0',
  features: [
    'User authentication',
    'Multi-factor authentication',
    'Session management',
    'Permission management',
    'Audit logging',
    'Security monitoring',
  ],
  dependencies: [
    '@apollo/client',
    'react',
    'jose',
  ],
  permissions: [
    'auth:read',
    'auth:write',
    'auth:admin',
  ],
};