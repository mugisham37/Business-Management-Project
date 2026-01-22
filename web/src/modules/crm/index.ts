/**
 * CRM Module - Customer Relationship Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const CRMDashboard = lazy(() => 
  import('./components/CRMDashboard').then(module => ({
    default: module.CRMDashboard
  }))
);

export const CustomerManagement = lazy(() => 
  import('./components/CustomerManagement').then(module => ({
    default: module.CustomerManagement
  }))
);

export const SalesPipeline = lazy(() => 
  import('./components/SalesPipeline').then(module => ({
    default: module.SalesPipeline
  }))
);

export { useCRM } from './hooks/useCRM';
export { useCustomers } from './hooks/useCustomers';

export const crmModule = {
  name: 'Customer Relationship Management',
  version: '1.0.0',
  description: 'Customer relationship and sales management',
  components: { CRMDashboard, CustomerManagement, SalesPipeline },
  routes: ['/crm', '/crm/customers', '/crm/pipeline'],
  permissions: ['crm:read', 'crm:write'],
  businessTier: 'MEDIUM',
  dependencies: ['tenant', 'auth'],
} as const;