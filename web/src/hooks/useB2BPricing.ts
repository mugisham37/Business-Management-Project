import { useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  PricingRule, 
  CustomerPricing,
  PricingRuleType,
  PricingTargetType,
  UseB2BPricingResult,
  CreatePricingRuleInput,
  UpdatePricingRuleInput,
} from '@/types/crm';
import {
  GET_CUSTOMER_PRICING,
  GET_BULK_PRICING,
  GET_PRICING_RULES,
  GET_APPLICABLE_PRICING_RULES,
} from '@/graphql/queries/b2b-queries';
import {
  CREATE_PRICING_RULE,
  UPDATE_PRICING_RULE,
  DELETE_PRICING_RULE,
  SET_PRICING_RULE_ACTIVE,
} from '@/graphql/mutations/b2b-mutations';
import {
  PRICING_RULE_CREATED_SUBSCRIPTION,
  PRICING_RULE_UPDATED_SUBSCRIPTION,
  PRICING_CHANGED_SUBSCRIPTION,
} from '@/graphql/subscriptions/b2b-subscriptions';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from './useErrorHandler';

export interface PricingRuleQueryInput {
  search?: string;
  ruleType?: PricingRuleType;
  targetType?: PricingTargetType;
  targetId?: string;
  isActive?: boolean;
  effectiveDate?: string;
  expirationDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CustomerPricingQueryInput {
  customerId: string;
  productId: string;
  quantity: number;
}

export interface BulkPricingQueryInput {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

/**
 * Hook for managing B2B pricing with comprehensive operations
 */
export function useB2BPricing(query?: PricingRuleQueryInput): UseB2BPricingResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  // Query pricing rules with filters
  const { 
    data, 
    loading, 
    error, 
    refetch 
  } = useQuery(GET_PRICING_RULES, {
    variables: { query: query || {} },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error);
    },
  });

  // Mutations
  const [createPricingRuleMutation] = useMutation(CREATE_PRICING_RULE, {
    onError: (error) => handleError(error),
    refetchQueries: [{ query: GET_PRICING_RULES, variables: { query: query || {} } }],
    awaitRefetchQueries: true,
  });

  const [updatePricingRuleMutation] = useMutation(UPDATE_PRICING_RULE, {
    onError: (error) => handleError(error),
  });

  const [deletePricingRuleMutation] = useMutation(DELETE_PRICING_RULE, {
    onError: (error) => handleError(error),
    refetchQueries: [{ query: GET_PRICING_RULES, variables: { query: query || {} } }],
    awaitRefetchQueries: true,
  });

  const [setPricingRuleActiveMutation] = useMutation(SET_PRICING_RULE_ACTIVE, {
    onError: (error) => handleError(error),
  });

  // Subscriptions for real-time updates
  useSubscription(PRICING_RULE_CREATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.pricingRuleCreated) {
        refetch();
      }
    },
  });

  useSubscription(PRICING_RULE_UPDATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.pricingRuleUpdated) {
        refetch();
      }
    },
  });

  // Callbacks
  const getCustomerPricing = useCallback(async (
    customerId: string,
    productId: string,
    quantity: number
  ): Promise<CustomerPricing> => {
    try {
      const { data } = await refetch({
        query: GET_CUSTOMER_PRICING,
        variables: { 
          query: { customerId, productId, quantity } 
        },
      });

      return data.getCustomerPricing;
    } catch (error) {
      throw error;
    }
  }, [refetch]);

  const getBulkPricing = useCallback(async (
    customerId: string,
    items: Array<{ productId: string; quantity: number }>
  ): Promise<Record<string, unknown>> => {
    try {
      const { data } = await refetch({
        query: GET_BULK_PRICING,
        variables: { 
          query: { customerId, items } 
        },
      });

      return data.getBulkPricing;
    } catch (error) {
      throw error;
    }
  }, [refetch]);

  const createPricingRule = useCallback(async (input: CreatePricingRuleInput): Promise<PricingRule> => {
    try {
      const result = await createPricingRuleMutation({
        variables: { input },
        optimisticResponse: {
          createPricingRule: {
            rule: {
              __typename: 'PricingRuleType',
              id: `temp-${Date.now()}`,
              name: input.name,
              description: input.description,
              ruleType: input.ruleType,
              targetType: input.targetType,
              targetId: input.targetId,
              discountType: input.discountType,
              discountValue: input.discountValue,
              minimumQuantity: input.minimumQuantity,
              maximumQuantity: input.maximumQuantity,
              minimumAmount: input.minimumAmount,
              effectiveDate: input.effectiveDate.toISOString(),
              expirationDate: input.expirationDate?.toISOString(),
              priority: input.priority || 1,
              isActive: true,
              isCurrentlyActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            message: 'Pricing rule created successfully',
          },
        },
      });

      return result.data.createPricingRule.rule;
    } catch (error) {
      throw error;
    }
  }, [createPricingRuleMutation]);

  const updatePricingRule = useCallback(async (
    id: string, 
    input: UpdatePricingRuleInput
  ): Promise<PricingRule> => {
    try {
      const result = await updatePricingRuleMutation({
        variables: { id, input },
        optimisticResponse: {
          updatePricingRule: {
            rule: {
              __typename: 'PricingRuleType',
              id,
              ...input,
              updatedAt: new Date().toISOString(),
            },
            message: 'Pricing rule updated successfully',
          },
        },
        update: (cache, { data }) => {
          if (data?.updatePricingRule?.rule && id) {
            const cacheId = cache.identify({ __typename: 'PricingRuleType', id });
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

      return result.data.updatePricingRule.rule;
    } catch (error) {
      throw error;
    }
  }, [updatePricingRuleMutation]);

  const deletePricingRule = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await deletePricingRuleMutation({
        variables: { id },
        update: (cache) => {
          if (id) {
            const cacheId = cache.identify({ __typename: 'PricingRuleType', id });
            if (cacheId) {
              cache.evict({ id: cacheId });
              cache.gc();
            }
          }
        },
      });

      return result.data.deletePricingRule;
    } catch (error) {
      throw error;
    }
  }, [deletePricingRuleMutation]);

  const setPricingRuleActive = useCallback(async (
    id: string, 
    isActive: boolean
  ): Promise<boolean> => {
    try {
      await setPricingRuleActiveMutation({
        variables: { id, isActive },
        optimisticResponse: {
          setPricingRuleActive: {
            rule: {
              __typename: 'PricingRuleType',
              id,
              isActive,
              isCurrentlyActive: isActive,
              updatedAt: new Date().toISOString(),
            },
            message: `Pricing rule ${isActive ? 'activated' : 'deactivated'} successfully`,
          },
        },
        update: (cache, { data }) => {
          if (data?.setPricingRuleActive?.rule && id) {
            const cacheId = cache.identify({ __typename: 'PricingRuleType', id });
            if (cacheId) {
              cache.modify({
                id: cacheId,
                fields: {
                  isActive: () => isActive,
                  isCurrentlyActive: () => isActive,
                  updatedAt: () => new Date().toISOString(),
                },
              });
            }
          }
        },
      });

      return true;
    } catch (error) {
      throw error;
    }
  }, [setPricingRuleActiveMutation]);

  const getApplicableRules = useCallback(async (
    customerId: string,
    productId: string,
    quantity: number,
    amount: number
  ): Promise<PricingRule[]> => {
    try {
      const { data } = await refetch({
        query: GET_APPLICABLE_PRICING_RULES,
        variables: { customerId, productId, quantity, amount },
      });

      return data.getApplicablePricingRules;
    } catch (error) {
      throw error;
    }
  }, [refetch]);

  return {
    pricingRules: data?.getPricingRules?.rules || [],
    loading,
    error: error ?? null,
    totalCount: data?.getPricingRules?.total || 0,
    getCustomerPricing,
    getBulkPricing,
    createPricingRule,
    updatePricingRule,
    deletePricingRule,
    setPricingRuleActive,
    getApplicableRules,
    refetch: async () => {
      await refetch();
    },
  };
}

/**
 * Hook for real-time customer pricing
 */
export function useCustomerPricing(customerId: string, productId: string, quantity: number) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_CUSTOMER_PRICING, {
    variables: { query: { customerId, productId, quantity } },
    skip: !currentTenant?.id || !customerId || !productId || !quantity,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error);
    },
  });
}

/**
 * Hook for bulk pricing calculations
 */
export function useBulkPricing(customerId: string, items: Array<{ productId: string; quantity: number }>) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_BULK_PRICING, {
    variables: { query: { customerId, items } },
    skip: !currentTenant?.id || !customerId || !items?.length,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error);
    },
  });
}

/**
 * Hook for pricing change notifications
 */
export function usePricingChangeNotifications(customerId?: string, productId?: string) {
  const { handleError } = useErrorHandler();

  // Subscribe to pricing changes
  const { data: pricingData } = useSubscription(PRICING_CHANGED_SUBSCRIPTION, {
    variables: { customerId, productId },
    onError: (error) => {
      handleError(error);
    },
  });

  return {
    pricingChange: pricingData?.pricingChanged,
  };
}