import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { 
  LoyaltyTransaction, 
  LoyaltyReward,
  LoyaltyTransactionFilterInput,
  CreateRewardInput,
  CreateCampaignInput,
  Campaign,
  UseLoyaltyResult 
} from '@/types/crm';
import {
  GET_LOYALTY_TRANSACTIONS,
} from '@/graphql/queries/crm-queries';
import {
  AWARD_LOYALTY_POINTS,
  REDEEM_LOYALTY_POINTS,
  ADJUST_LOYALTY_POINTS,
  CREATE_LOYALTY_REWARD,
  CREATE_LOYALTY_CAMPAIGN,
} from '@/graphql/mutations/crm-mutations';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from '@/hooks/useErrorHandler';

/**
 * Hook for managing loyalty program operations
 */
export function useLoyalty(filters?: LoyaltyTransactionFilterInput): UseLoyaltyResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();
  const [rewards] = useState<LoyaltyReward[]>([]);

  // Query loyalty transactions
  const { 
    data, 
    loading, 
    error
  } = useQuery(GET_LOYALTY_TRANSACTIONS, {
    variables: { query: filters },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch loyalty transactions');
    },
  });

  // Mutations
  const [awardPointsMutation] = useMutation(AWARD_LOYALTY_POINTS, {
    onError: (error) => handleError(error, 'Failed to award loyalty points'),
    refetchQueries: [{ query: GET_LOYALTY_TRANSACTIONS, variables: { query: filters } }],
  });

  const [redeemPointsMutation] = useMutation(REDEEM_LOYALTY_POINTS, {
    onError: (error) => handleError(error, 'Failed to redeem loyalty points'),
    refetchQueries: [{ query: GET_LOYALTY_TRANSACTIONS, variables: { query: filters } }],
  });

  const [adjustPointsMutation] = useMutation(ADJUST_LOYALTY_POINTS, {
    onError: (error) => handleError(error, 'Failed to adjust loyalty points'),
    refetchQueries: [{ query: GET_LOYALTY_TRANSACTIONS, variables: { query: filters } }],
  });

  const [createRewardMutation] = useMutation(CREATE_LOYALTY_REWARD, {
    onError: (error) => handleError(error, 'Failed to create loyalty reward'),
  });

  const [createCampaignMutation] = useMutation(CREATE_LOYALTY_CAMPAIGN, {
    onError: (error) => handleError(error, 'Failed to create loyalty campaign'),
  });

  // Callbacks
  const awardPoints = useCallback(async (
    customerId: string,
    points: number,
    reason: string,
    campaignId?: string
  ): Promise<LoyaltyTransaction> => {
    try {
      const result = await awardPointsMutation({
        variables: {
          customerId,
          points,
          reason,
          campaignId,
        },
        optimisticResponse: {
          awardLoyaltyPoints: {
            __typename: 'LoyaltyTransaction',
            id: `temp-${Date.now()}`,
            customerId,
            type: 'earned',
            points,
            description: reason,
            campaignId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.awardLoyaltyPoints;
    } catch (error) {
      throw error;
    }
  }, [awardPointsMutation]);

  const redeemPoints = useCallback(async (
    customerId: string,
    points: number,
    reason: string
  ): Promise<LoyaltyTransaction> => {
    try {
      const result = await redeemPointsMutation({
        variables: {
          customerId,
          points,
          reason,
        },
        optimisticResponse: {
          redeemLoyaltyPoints: {
            __typename: 'LoyaltyTransaction',
            id: `temp-${Date.now()}`,
            customerId,
            type: 'redeemed',
            points: -points,
            description: reason,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.redeemLoyaltyPoints;
    } catch (error) {
      throw error;
    }
  }, [redeemPointsMutation]);

  const adjustPoints = useCallback(async (
    customerId: string,
    pointsChange: number,
    reason: string
  ): Promise<LoyaltyTransaction> => {
    try {
      const result = await adjustPointsMutation({
        variables: {
          customerId,
          pointsChange,
          reason,
        },
        optimisticResponse: {
          adjustLoyaltyPoints: {
            __typename: 'LoyaltyTransaction',
            id: `temp-${Date.now()}`,
            customerId,
            type: 'adjusted',
            points: pointsChange,
            description: reason,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.adjustLoyaltyPoints;
    } catch (error) {
      throw error;
    }
  }, [adjustPointsMutation]);

  const createReward = useCallback(async (input: CreateRewardInput): Promise<LoyaltyReward> => {
    try {
      const result = await createRewardMutation({
        variables: { input },
      });

      return result.data?.createLoyaltyReward || {} as LoyaltyReward;
    } catch (error) {
      throw error;
    }
  }, [createRewardMutation]);

  const createCampaign = useCallback(async (input: CreateCampaignInput): Promise<Campaign> => {
    try {
      const result = await createCampaignMutation({
        variables: { input },
      });

      return result.data?.createLoyaltyCampaign || {} as Campaign;
    } catch (error) {
      throw error;
    }
  }, [createCampaignMutation]);

  return {
    transactions: data?.loyaltyTransactions || [],
    rewards,
    loading,
    ...(error && { error }),
    awardPoints,
    redeemPoints,
    adjustPoints,
    createReward,
    createCampaign,
  };
}

/**
 * Hook for customer-specific loyalty operations
 */
export function useCustomerLoyalty(customerId: string) {
  return useLoyalty({ customerId });
}

/**
 * Hook for campaign-specific loyalty transactions
 */
export function useCampaignLoyalty(campaignId: string) {
  return useLoyalty({ campaignId });
}

/**
 * Hook for loyalty program statistics
 */
export function useLoyaltyStats() {
  const { transactions } = useLoyalty();

  const stats = {
    totalTransactions: transactions.length,
    totalPointsAwarded: transactions
      .filter(t => t.type === 'earned')
      .reduce((sum, t) => sum + t.points, 0),
    totalPointsRedeemed: transactions
      .filter(t => t.type === 'redeemed')
      .reduce((sum, t) => sum + Math.abs(t.points), 0),
    totalPointsAdjusted: transactions
      .filter(t => t.type === 'adjusted')
      .reduce((sum, t) => sum + t.points, 0),
    activeCustomers: new Set(transactions.map(t => t.customerId)).size,
    averagePointsPerTransaction: transactions.length > 0 
      ? transactions.reduce((sum, t) => sum + Math.abs(t.points), 0) / transactions.length 
      : 0,
    transactionsByType: transactions.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return stats;
}

/**
 * Hook for loyalty tier management
 */
export function useLoyaltyTiers() {
  const tiers = useMemo(() => [
    { name: 'bronze', minPoints: 0, maxPoints: 999, benefits: ['Basic rewards'] },
    { name: 'silver', minPoints: 1000, maxPoints: 4999, benefits: ['5% bonus points', 'Priority support'] },
    { name: 'gold', minPoints: 5000, maxPoints: 9999, benefits: ['10% bonus points', 'Free shipping', 'Early access'] },
    { name: 'platinum', minPoints: 10000, maxPoints: 24999, benefits: ['15% bonus points', 'Exclusive offers', 'Personal shopper'] },
    { name: 'diamond', minPoints: 25000, maxPoints: Infinity, benefits: ['20% bonus points', 'VIP treatment', 'Concierge service'] },
  ], []);

  const getTierForPoints = useCallback((points: number) => {
    return tiers.find(tier => points >= tier.minPoints && points <= tier.maxPoints) || tiers[0];
  }, [tiers]);

  const getNextTier = useCallback((currentPoints: number) => {
    const currentTier = getTierForPoints(currentPoints);
    if (!currentTier) return null;
    const currentIndex = tiers.findIndex(t => t.name === currentTier.name);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  }, [getTierForPoints, tiers]);

  const getPointsToNextTier = useCallback((currentPoints: number) => {
    const nextTier = getNextTier(currentPoints);
    return nextTier ? nextTier.minPoints - currentPoints : 0;
  }, [getNextTier]);

  return {
    tiers,
    getTierForPoints,
    getNextTier,
    getPointsToNextTier,
  };
}