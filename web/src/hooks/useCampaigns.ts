import { useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  Campaign, 
  CampaignPerformance,
  CampaignFilterInput,
  UseCampaignsResult,
  CreateCampaignInput,
  UpdateCampaignInput
} from '@/types/crm';
import {
  GET_CAMPAIGNS,
  GET_CAMPAIGN,
  GET_ACTIVE_CAMPAIGNS_FOR_CUSTOMER,
  GET_CAMPAIGN_PERFORMANCE,
} from '@/graphql/queries/crm-queries';
import {
  CREATE_CAMPAIGN,
  UPDATE_CAMPAIGN,
  DELETE_CAMPAIGN,
  ACTIVATE_CAMPAIGN,
  PAUSE_CAMPAIGN,
} from '@/graphql/mutations/crm-mutations';
import {
  CAMPAIGN_CREATED,
  CAMPAIGN_UPDATED,
  CAMPAIGN_ACTIVATED,
} from '@/graphql/subscriptions/crm-subscriptions';
import { useTenantStore } from '@/lib/stores/tenant-store';

/**
 * Hook for managing campaigns with comprehensive CRUD operations
 */
export function useCampaigns(filters?: CampaignFilterInput): UseCampaignsResult {
  const { currentTenant } = useTenantStore();

  // Query campaigns with filters
  const { 
    data, 
    loading, 
    error, 
    refetch 
  } = useQuery(GET_CAMPAIGNS, {
    variables: { filter: filters },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  // Mutations
  const [createCampaignMutation] = useMutation(CREATE_CAMPAIGN, {
    refetchQueries: [{ query: GET_CAMPAIGNS, variables: { filter: filters } }],
    awaitRefetchQueries: true,
  });

  const [updateCampaignMutation] = useMutation(UPDATE_CAMPAIGN, {
  });

  const [deleteCampaignMutation] = useMutation(DELETE_CAMPAIGN, {
    refetchQueries: [{ query: GET_CAMPAIGNS, variables: { filter: filters } }],
    awaitRefetchQueries: true,
  });

  const [activateCampaignMutation] = useMutation(ACTIVATE_CAMPAIGN, {
  });

  const [pauseCampaignMutation] = useMutation(PAUSE_CAMPAIGN, {
  });

  // Subscriptions for real-time updates
  useSubscription(CAMPAIGN_CREATED, {
    onData: ({ data }) => {
      if (data?.data?.campaignCreated) {
        refetch();
      }
    },
  });

  useSubscription(CAMPAIGN_UPDATED, {
    onData: ({ data }) => {
      if (data?.data?.campaignUpdated) {
        refetch();
      }
    },
  });

  useSubscription(CAMPAIGN_ACTIVATED, {
    onData: ({ data }) => {
      if (data?.data?.campaignActivated) {
        refetch();
      }
    },
  });

  // Callbacks
  const createCampaign = useCallback(async (input: CreateCampaignInput): Promise<Campaign> => {
    try {
      const result = await createCampaignMutation({
        variables: { input },
        optimisticResponse: {
          createCampaign: {
            __typename: 'Campaign',
            id: `temp-${Date.now()}`,
            ...input,
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.createCampaign;
    } catch (error) {
      throw error;
    }
  }, [createCampaignMutation]);

  const updateCampaign = useCallback(async (
    id: string, 
    input: UpdateCampaignInput
  ): Promise<Campaign> => {
    try {
      const result = await updateCampaignMutation({
        variables: { id, input },
        optimisticResponse: {
          updateCampaign: {
            __typename: 'Campaign',
            id,
            ...input,
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          if (data?.updateCampaign) {
            const cacheId = cache.identify(data.updateCampaign);
            if (cacheId) {
              cache.modify({
                id: cacheId,
                fields: {
                  updatedAt: () => new Date().toISOString(),
                },
              });
            }
          }
        },
      });

      return result.data.updateCampaign;
    } catch (error) {
      throw error;
    }
  }, [updateCampaignMutation]);

  const deleteCampaign = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteCampaignMutation({
        variables: { id },
        optimisticResponse: {
          deleteCampaign: true,
        },
        update: (cache) => {
          const cacheId = cache.identify({ __typename: 'Campaign', id: id as string });
          if (cacheId) {
            cache.evict({ id: cacheId });
            cache.gc();
          }
        },
      });

      return true;
    } catch (error) {
      throw error;
    }
  }, [deleteCampaignMutation]);

  const activateCampaign = useCallback(async (id: string): Promise<Campaign> => {
    try {
      const result = await activateCampaignMutation({
        variables: { id },
        optimisticResponse: {
          activateCampaign: {
            __typename: 'Campaign',
            id,
            status: 'active',
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.activateCampaign;
    } catch (error) {
      throw error;
    }
  }, [activateCampaignMutation]);

  const pauseCampaign = useCallback(async (id: string): Promise<Campaign> => {
    try {
      const result = await pauseCampaignMutation({
        variables: { id },
        optimisticResponse: {
          pauseCampaign: {
            __typename: 'Campaign',
            id,
            status: 'paused',
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.pauseCampaign;
    } catch (error) {
      throw error;
    }
  }, [pauseCampaignMutation]);

  const getCampaignPerformance = useCallback(async (id: string): Promise<CampaignPerformance> => {
    try {
      const result = await refetch({
        query: GET_CAMPAIGN_PERFORMANCE,
        variables: { id },
      });

      return result.data.campaignPerformance;
    } catch (error) {
      throw error;
    }
  }, [refetch]);

  return {
    campaigns: data?.campaigns || [],
    loading,
    error: error ?? null,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    activateCampaign,
    pauseCampaign,
    getCampaignPerformance,
  };
}

/**
 * Hook for fetching a single campaign by ID
 */
export function useCampaign(id: string) {
  const { currentTenant } = useTenantStore();

  return useQuery(GET_CAMPAIGN, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
  });
}

/**
 * Hook for fetching active campaigns for a specific customer
 */
export function useActiveCampaignsForCustomer(
  customerId: string,
  customerTier?: string,
  customerSegments?: string[]
) {
  const { currentTenant } = useTenantStore();

  return useQuery(GET_ACTIVE_CAMPAIGNS_FOR_CUSTOMER, {
    variables: { 
      customerId, 
      customerTier, 
      customerSegments 
    },
    skip: !currentTenant?.id || !customerId,
    errorPolicy: 'all',
  });
}

/**
 * Hook for campaign performance analytics
 */
export function useCampaignPerformance(id: string) {
  const { currentTenant } = useTenantStore();

  return useQuery(GET_CAMPAIGN_PERFORMANCE, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
  });
}

/**
 * Hook for campaign statistics and metrics
 */
export function useCampaignStats() {
  const { campaigns } = useCampaigns();

  const stats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    draftCampaigns: campaigns.filter(c => c.status === 'draft').length,
    pausedCampaigns: campaigns.filter(c => c.status === 'paused').length,
    completedCampaigns: campaigns.filter(c => c.status === 'completed').length,
    campaignsByType: campaigns.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    upcomingCampaigns: campaigns.filter(c => 
      c.status === 'draft' && new Date(c.startDate) > new Date()
    ).length,
    expiringSoon: campaigns.filter(c => {
      const endDate = new Date(c.endDate);
      const now = new Date();
      const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return c.status === 'active' && daysUntilEnd <= 7 && daysUntilEnd > 0;
    }).length,
  };

  return stats;
}

/**
 * Hook for campaign validation and business rules
 */
export function useCampaignValidation() {
  const validateCampaignDates = useCallback((startDate: Date, endDate: Date) => {
    const now = new Date();
    const errors: string[] = [];

    if (startDate < now) {
      errors.push('Start date cannot be in the past');
    }

    if (endDate <= startDate) {
      errors.push('End date must be after start date');
    }

    const duration = endDate.getTime() - startDate.getTime();
    const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year
    if (duration > maxDuration) {
      errors.push('Campaign duration cannot exceed 1 year');
    }

    return errors;
  }, []);

  const validateCampaignBudget = useCallback((
    totalPointsBudget?: number,
    maxPointsPerCustomer?: number
  ) => {
    const errors: string[] = [];

    if (totalPointsBudget && totalPointsBudget <= 0) {
      errors.push('Total points budget must be positive');
    }

    if (maxPointsPerCustomer && maxPointsPerCustomer <= 0) {
      errors.push('Max points per customer must be positive');
    }

    if (
      totalPointsBudget && 
      maxPointsPerCustomer && 
      maxPointsPerCustomer > totalPointsBudget
    ) {
      errors.push('Max points per customer cannot exceed total budget');
    }

    return errors;
  }, []);

  const validateCampaignTargeting = useCallback((
    targetSegments?: string[],
    targetTiers?: string[]
  ) => {
    const errors: string[] = [];

    if (
      (!targetSegments || targetSegments.length === 0) &&
      (!targetTiers || targetTiers.length === 0)
    ) {
      errors.push('Campaign must target at least one segment or tier');
    }

    return errors;
  }, []);

  return {
    validateCampaignDates,
    validateCampaignBudget,
    validateCampaignTargeting,
  };
}