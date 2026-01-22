/**
 * B2B Integration Module - Business-to-Business Operations
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

// Lazy load components for better code splitting
export const B2BDashboard = lazy(() => 
  import('./components/B2BDashboard').then(module => ({
    default: module.B2BDashboard
  }))
);

export const PartnerManagement = lazy(() => 
  import('./components/PartnerManagement').then(module => ({
    default: module.PartnerManagement
  }))
);

export const IntegrationHub = lazy(() => 
  import('./components/IntegrationHub').then(module => ({
    default: module.IntegrationHub
  }))
);

// Export hooks
export { useB2BOperations } from './hooks/useB2BOperations';
export { usePartnerIntegrations } from './hooks/usePartnerIntegrations';

// Export module metadata
export const b2bModule = {
  name: 'B2B Integration',
  version: '1.0.0',
  description: 'Business-to-business operations and partner management',
  components: {
    B2BDashboard,
    PartnerManagement,
    IntegrationHub,
  },
  routes: [
    '/b2b',
    '/b2b/partners',
    '/b2b/integrations',
  ],
  permissions: ['b2b:read', 'b2b:write', 'b2b:admin'],
  businessTier: 'ENTERPRISE',
  dependencies: ['tenant', 'auth', 'integration'],
} as const;

export const B2B_MODULE_CONFIG = {
  name: 'b2b',
  displayName: 'B2B Integration',
  description: 'Business-to-business operations and partner ecosystem management',
  version: '1.0.0',
  features: [
    'Partner management',
    'API integrations',
    'Data synchronization',
    'Workflow automation',
    'Contract management',
    'Revenue sharing',
  ],
  dependencies: [
    '@apollo/client',
    'react',
  ],
  permissions: [
    'b2b:read',
    'b2b:write',
    'b2b:admin',
  ],
};