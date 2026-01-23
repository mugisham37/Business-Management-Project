import { useCallback, useMemo } from 'react';
import { useCustomers } from './useCustomers';
import { useLoyalty } from './useLoyalty';
import { useCampaigns } from './useCampaigns';
import { useCustomerAnalytics } from './useCustomerAnalytics';
import { useB2BCustomers } from './useB2BCustomers';
import { useCommunications } from './useCommunications';
import { useSegmentation } from './useSegmentation';
import { 
  Customer, 
  Campaign, 
  LoyaltyTransaction,
  B2BCustomer,
  Communication,
  Segment,
  CRMModuleConfig 
} from '@/types/crm';
import { useTenantStore } from '@/lib/stores/tenant-store';

/**
 * Main CRM hook that provides unified access to all CRM functionality
 * This is the primary hook that components should use for CRM operations
 */
export function useCRM() {
  const { currentTenant } = useTenantStore();
  
  // Core hooks
  const customers = useCustomers();
  const loyalty = useLoyalty();
  const campaigns = useCampaigns();
  const analytics = useCustomerAnalytics();
  const b2bCustomers = useB2BCustomers();
  const communications = useCommunications();
  const segmentation = useSegmentation();

  // Configuration based on tenant features
  const config: CRMModuleConfig = useMemo(() => ({
    features: {
      loyaltyProgram: currentTenant?.features?.includes('loyalty-program') ?? false,
      b2bCustomers: currentTenant?.features?.includes('b2b-customers') ?? false,
      customerAnalytics: currentTenant?.features?.includes('customer-analytics') ?? false,
      campaignManagement: currentTenant?.features?.includes('loyalty-campaigns') ?? false,
      communicationTracking: currentTenant?.features?.includes('communication-tracking') ?? false,
      segmentation: currentTenant?.features?.includes('customer-segmentation') ?? false,
    },
    settings: {
      defaultLoyaltyTier: 'bronze',
      pointsExpirationDays: 365,
      maxCampaignsPerCustomer: 5,
      churnRiskThreshold: 0.7,
      segmentRecalculationInterval: 24, // hours
    },
    permissions: {
      canCreateCustomers: currentTenant?.permissions?.includes('customers:create') ?? false,
      canUpdateCustomers: currentTenant?.permissions?.includes('customers:update') ?? false,
      canDeleteCustomers: currentTenant?.permissions?.includes('customers:delete') ?? false,
      canManageLoyalty: currentTenant?.permissions?.includes('loyalty:manage-points') ?? false,
      canManageCampaigns: currentTenant?.permissions?.includes('campaigns:create') ?? false,
      canViewAnalytics: currentTenant?.permissions?.includes('analytics:read') ?? false,
      canManageSegments: currentTenant?.permissions?.includes('segments:create') ?? false,
    },
  }), [currentTenant]);

  // Unified loading state
  const loading = useMemo(() => 
    customers.loading || 
    loyalty.loading || 
    campaigns.loading || 
    analytics.loading ||
    b2bCustomers.loading ||
    communications.loading ||
    segmentation.loading
  , [
    customers.loading,
    loyalty.loading,
    campaigns.loading,
    analytics.loading,
    b2bCustomers.loading,
    communications.loading,
    segmentation.loading,
  ]);

  // Unified error state
  const error = useMemo(() => 
    customers.error || 
    loyalty.error || 
    campaigns.error || 
    analytics.error ||
    b2bCustomers.error ||
    communications.error ||
    segmentation.error
  , [
    customers.error,
    loyalty.error,
    campaigns.error,
    analytics.error,
    b2bCustomers.error,
    communications.error,
    segmentation.error,
  ]);

  // Quick actions for common CRM operations
  const quickActions = useMemo(() => ({
    // Customer quick actions
    findCustomerByEmail: customers.customers.find ? 
      (email: string) => customers.customers.find((c: Customer) => c.email === email) : 
      undefined,
    
    findCustomerByPhone: customers.customers.find ?
      (phone: string) => customers.customers.find((c: Customer) => c.phone === phone) :
      undefined,

    getCustomersByTier: customers.customers.filter ?
      (tier: string) => customers.customers.filter((c: Customer) => c.loyaltyTier === tier) :
      [],

    getHighValueCustomers: customers.customers.filter ?
      (threshold = 1000) => customers.customers.filter((c: Customer) => c.totalSpent > threshold) :
      [],

    // Campaign quick actions
    getActiveCampaigns: campaigns.campaigns.filter ?
      () => campaigns.campaigns.filter((c: Campaign) => c.status === 'active') :
      [],

    getUpcomingCampaigns: campaigns.campaigns.filter ?
      () => campaigns.campaigns.filter((c: Campaign) => 
        c.status === 'draft' && new Date(c.startDate) > new Date()
      ) :
      [],

    // Loyalty quick actions
    getRecentTransactions: loyalty.transactions.filter ?
      (days = 30) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return loyalty.transactions.filter((t: LoyaltyTransaction) => 
          new Date(t.createdAt) > cutoff
        );
      } :
      [],

    // B2B quick actions
    getExpiringContracts: b2bCustomers.customers.filter ?
      (days = 30) => b2bCustomers.customers.filter((c: B2BCustomer) => 
        c.daysUntilContractExpiry <= days && c.daysUntilContractExpiry > 0
      ) :
      [],

    // Communication quick actions
    getRecentCommunications: communications.communications.filter ?
      (days = 7) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return communications.communications.filter((c: Communication) => 
          new Date(c.createdAt) > cutoff
        );
      } :
      [],
  }), [
    customers.customers,
    campaigns.campaigns,
    loyalty.transactions,
    b2bCustomers.customers,
    communications.communications,
  ]);

  // Dashboard summary data
  const dashboardSummary = useMemo(() => ({
    totalCustomers: customers.customers?.length || 0,
    activeCustomers: customers.customers?.filter((c: Customer) => c.status === 'active').length || 0,
    totalRevenue: customers.customers?.reduce((sum: number, c: Customer) => sum + c.totalSpent, 0) || 0,
    activeCampaigns: campaigns.campaigns?.filter((c: Campaign) => c.status === 'active').length || 0,
    loyaltyParticipants: customers.customers?.filter((c: Customer) => c.loyaltyPoints > 0).length || 0,
    recentTransactions: loyalty.transactions?.length || 0,
    b2bCustomers: b2bCustomers.customers?.length || 0,
    pendingCommunications: communications.communications?.filter((c: Communication) => 
      c.status === 'scheduled'
    ).length || 0,
    activeSegments: segmentation.segments?.filter((s: Segment) => s.isActive).length || 0,
  }), [
    customers.customers,
    campaigns.campaigns,
    loyalty.transactions,
    b2bCustomers.customers,
    communications.communications,
    segmentation.segments,
  ]);

  // Bulk operations
  const bulkOperations = {
    bulkUpdateCustomers: useCallback(async (
      customerIds: string[], 
      updates: any
    ) => {
      const results = await Promise.allSettled(
        customerIds.map(id => customers.updateCustomer(id, updates))
      );
      return results;
    }, [customers.updateCustomer]),

    bulkAwardPoints: useCallback(async (
      customerIds: string[], 
      points: number, 
      reason: string
    ) => {
      const results = await Promise.allSettled(
        customerIds.map(id => loyalty.awardPoints(id, points, reason))
      );
      return results;
    }, [loyalty.awardPoints]),

    bulkSendCommunication: useCallback(async (
      customerIds: string[], 
      communicationData: any
    ) => {
      const results = await Promise.allSettled(
        customerIds.map(id => communications.recordCommunication({
          ...communicationData,
          customerId: id,
        }))
      );
      return results;
    }, [communications.recordCommunication]),
  };

  // Search and filtering utilities
  const searchUtils = {
    searchCustomers: useCallback((query: string) => {
      if (!customers.customers) return [];
      
      const lowercaseQuery = query.toLowerCase();
      return customers.customers.filter((customer: Customer) => 
        customer.firstName?.toLowerCase().includes(lowercaseQuery) ||
        customer.lastName?.toLowerCase().includes(lowercaseQuery) ||
        customer.email?.toLowerCase().includes(lowercaseQuery) ||
        customer.phone?.includes(query) ||
        customer.companyName?.toLowerCase().includes(lowercaseQuery)
      );
    }, [customers.customers]),

    filterCustomersBySegment: useCallback((segmentId: string) => {
      // This would need to be implemented with segment membership data
      return customers.customers || [];
    }, [customers.customers]),

    filterCustomersByRisk: useCallback((riskLevel: 'low' | 'medium' | 'high') => {
      if (!customers.customers) return [];
      
      const thresholds = { low: 0.3, medium: 0.7, high: 1.0 };
      const threshold = thresholds[riskLevel];
      
      return customers.customers.filter((customer: Customer) => {
        if (riskLevel === 'low') return customer.churnRisk < 0.3;
        if (riskLevel === 'medium') return customer.churnRisk >= 0.3 && customer.churnRisk < 0.7;
        return customer.churnRisk >= 0.7;
      });
    }, [customers.customers]),
  };

  return {
    // Core functionality
    customers,
    loyalty,
    campaigns,
    analytics,
    b2bCustomers,
    communications,
    segmentation,

    // Configuration and permissions
    config,

    // Unified states
    loading,
    error,

    // Quick actions and utilities
    quickActions,
    dashboardSummary,
    bulkOperations,
    searchUtils,

    // Refresh all data
    refreshAll: useCallback(async () => {
      await Promise.all([
        customers.refetch(),
        campaigns.campaigns && campaigns.refetch ? campaigns.refetch() : Promise.resolve(),
        b2bCustomers.customers && b2bCustomers.refetch ? b2bCustomers.refetch() : Promise.resolve(),
      ]);
    }, [customers.refetch]),
  };
}

/**
 * Hook for CRM module status and health
 */
export function useCRMStatus() {
  const crm = useCRM();

  const status = {
    isHealthy: !crm.error && !crm.loading,
    hasData: crm.dashboardSummary.totalCustomers > 0,
    featuresEnabled: Object.values(crm.config.features).filter(Boolean).length,
    lastUpdated: new Date(),
    
    // Module readiness
    readiness: {
      customers: crm.customers.customers.length > 0,
      campaigns: crm.config.features.campaignManagement ? crm.campaigns.campaigns.length > 0 : true,
      loyalty: crm.config.features.loyaltyProgram ? crm.loyalty.transactions.length > 0 : true,
      analytics: crm.config.features.customerAnalytics,
      b2b: crm.config.features.b2bCustomers ? crm.b2bCustomers.customers.length > 0 : true,
    },
  };

  return status;
}