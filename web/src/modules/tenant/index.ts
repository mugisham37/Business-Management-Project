/**
 * Tenant Module - Multi-tenant Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const TenantDashboard = lazy(() => 
  import('./components/TenantDashboard').then(module => ({
    default: module.TenantDashboard
  }))
);

export const TenantSettings = lazy(() => 
  import('./components/TenantSettings').then(module => ({
    default: module.TenantSettings
  }))
);

export const FeatureManagement = lazy(() => 
  import('./components/FeatureManagement').then(module => ({
    default: module.FeatureManagement
  }))
);

export { useTenantManagement } from './hooks/useTenantManagement';
export { useFeatureFlags } from './hooks/useFeatureFlags';

export const tenantModule = {
  name: 'Tenant Management',
  version: '1.0.0',
  description: 'Multi-tenant configuration and management',
  components: { TenantDashboard, TenantSettings, FeatureManagement },
  routes: ['/tenant', '/tenant/settings', '/tenant/features'],
  permissions: ['tenant:read', 'tenant:write', 'tenant:admin'],
  businessTier: 'MICRO',
  dependencies: ['auth'],
} as const;