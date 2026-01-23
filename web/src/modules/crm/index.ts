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

// Export all CRM hooks
export { useCRM } from '@/hooks/useCRM';
export { useCustomers, useCustomer, useCustomerByEmail, useCustomerByPhone, useCustomerSearch, useCustomerStats } from '@/hooks/useCustomers';
export { useLoyalty, useCustomerLoyalty, useCampaignLoyalty, useLoyaltyStats, useLoyaltyTiers } from '@/hooks/useLoyalty';
export { useCampaigns, useCampaign, useActiveCampaignsForCustomer, useCampaignPerformance, useCampaignStats, useCampaignValidation } from '@/hooks/useCampaigns';
export { useCustomerAnalytics, useCustomerLifetimeValue, useCustomersLifetimeValue, useCustomerPurchasePatterns, useCustomerChurnRisk, useSegmentAnalytics, useAllSegmentsAnalytics, useHighChurnRiskCustomers, useCustomerMetrics, useAnalyticsInsights, usePredictiveAnalytics } from '@/hooks/useCustomerAnalytics';
export { useB2BCustomers, useB2BCustomer, useB2BCustomerMetrics, useB2BCustomersByIndustry, useB2BCustomersBySalesRep, useB2BCustomersWithExpiringContracts, useB2BCreditManagement } from '@/hooks/useB2BCustomers';
export { useCommunications, useCustomerCommunications, useCommunicationStats, useCommunicationTemplates, useCommunicationAutomation } from '@/hooks/useCommunications';
export { useSegmentation, useSegment, useSegmentMembers, useSegmentCriteriaBuilder, useSegmentTemplates } from '@/hooks/useSegmentation';

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