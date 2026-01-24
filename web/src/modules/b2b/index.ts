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

// Export B2B hooks
export { 
  useB2BOrders, 
  useB2BOrder, 
  useB2BOrderByNumber, 
  useOrdersRequiringApproval, 
  useB2BOrderAnalytics 
} from '../../hooks/useB2BOrders';

export { 
  useQuotes, 
  useQuote, 
  useQuoteSubscriptions 
} from '../../hooks/useQuotes';

export { 
  useContracts, 
  useContract, 
  useExpiringContracts, 
  useContractExpirationNotifications 
} from '../../hooks/useContracts';

export { 
  useB2BPricing, 
  useCustomerPricing, 
  useBulkPricing, 
  usePricingChangeNotifications 
} from '../../hooks/useB2BPricing';

export { 
  useTerritories, 
  useTerritory, 
  useTerritoryPerformance, 
  useTerritoryCustomers 
} from '../../hooks/useTerritories';

export { 
  useB2BWorkflows, 
  useB2BWorkflow, 
  usePendingApprovals, 
  useWorkflowAnalytics, 
  useWorkflowHistory 
} from '../../hooks/useB2BWorkflows';

// Export legacy hooks for backward compatibility
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
    '/b2b/orders',
    '/b2b/quotes',
    '/b2b/contracts',
    '/b2b/pricing',
    '/b2b/territories',
    '/b2b/workflows',
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
    'Order management with approval workflows',
    'Quote generation and conversion',
    'Contract lifecycle management',
    'Dynamic pricing with customer tiers',
    'Territory and sales management',
    'Multi-step approval workflows',
    'Partner management',
    'API integrations',
    'Data synchronization',
    'Workflow automation',
    'Revenue sharing',
    'Real-time notifications',
  ],
  dependencies: [
    '@apollo/client',
    'react',
  ],
  permissions: [
    'b2b:read',
    'b2b:write',
    'b2b:admin',
    'b2b_order:read',
    'b2b_order:create',
    'b2b_order:update',
    'b2b_order:approve',
    'b2b_order:ship',
    'b2b_order:cancel',
    'quote:read',
    'quote:create',
    'quote:update',
    'quote:approve',
    'quote:send',
    'quote:convert',
    'contract:read',
    'contract:create',
    'contract:update',
    'contract:approve',
    'contract:sign',
    'contract:renew',
    'contract:terminate',
    'pricing:read',
    'pricing:create',
    'pricing:update',
    'pricing:delete',
    'territory:read',
    'territory:create',
    'territory:update',
    'territory:assign',
    'workflow:read',
    'workflow:approve',
    'workflow:reassign',
  ],
};