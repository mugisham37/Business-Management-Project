/**
 * Integration Module - Third-party Integrations
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const IntegrationDashboard = lazy(() => 
  import('./components/IntegrationDashboard').then(module => ({
    default: module.IntegrationDashboard
  }))
);

export const ConnectorManagement = lazy(() => 
  import('./components/ConnectorManagement').then(module => ({
    default: module.ConnectorManagement
  }))
);

export const APIManagement = lazy(() => 
  import('./components/APIManagement').then(module => ({
    default: module.APIManagement
  }))
);

export { useIntegrations } from './hooks/useIntegrations';
export { useConnectors } from './hooks/useConnectors';

export const integrationModule = {
  name: 'Integration Management',
  version: '1.0.0',
  description: 'Third-party integrations and API management',
  components: { IntegrationDashboard, ConnectorManagement, APIManagement },
  routes: ['/integration', '/integration/connectors', '/integration/api'],
  permissions: ['integration:read', 'integration:write', 'integration:admin'],
  businessTier: 'MEDIUM',
  dependencies: ['tenant', 'auth'],
} as const;