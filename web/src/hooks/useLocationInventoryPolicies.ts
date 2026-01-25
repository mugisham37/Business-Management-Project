/**
 * Location Inventory Policies Management Hooks
 * Complete hook implementation for location inventory policy operations
 */

import { useCallback } from 'react';
import { 
  useQuery, 
  useMutation,
  QueryHookOptions,
  MutationHookOptions,
  FetchResult
} from '@apollo/client';
import { 
  GET_INVENTORY_POLICY,
  GET_REORDER_RULES
} from '@/graphql/queries/location-queries';
import {
  UPDATE_INVENTORY_POLICY,
  UPDATE_REORDER_RULES
} from '@/graphql/mutations/location-mutations';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

// Types
export interface InventoryPolicy {
  id: string;
  name: string;
  description?: string;
  policyType: string;
  status: string;
  productId?: string;
  categoryId?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  safetyStock?: number;
  reorderQuantity?: number;
  leadTimeDays?: number;
  replenishmentMethod?: string;
  abcClassification?: string;
  seasonalMultiplier?: number;
  forecastPeriodDays?: number;
  autoCreatePurchaseOrders?: boolean;
  preferredSupplierId?: string;
  rules?: InventoryRule[];
  priority?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryRule {
  id?: string;
  priority: number;
  condition: string;
  action: string;
}

export interface ReorderRule {
  id: string;
  productId: string;
  locationId: string;
  minStockLevel: number;
  reorderQuantity: number;
  leadTimeDays: number;
  supplierId?: string;
  isActive: boolean;
}

export interface UpdateInventoryPolicyInput {
  name?: string;
  description?: string;
  policyType?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  safetyStock?: number;
  reorderQuantity?: number;
  leadTimeDays?: number;
  replenishmentMethod?: string;
  abcClassification?: string;
  seasonalMultiplier?: number;
  forecastPeriodDays?: number;
  autoCreatePurchaseOrders?: boolean;
  preferredSupplierId?: string;
  rules?: InventoryRule[];
  priority?: number;
  isActive?: boolean;
  status?: string;
}

export interface InventoryRecommendation {
  productId: string;
  currentStock: number;
  recommendedAction: string;
  recommendedQuantity: number;
  reason: string;
  priority: string;
  expectedStockOutDate?: string;
  appliedPolicies: Array<{
    policyId: string;
    policyName: string;
    policyType: string;
  }>;
}

// Hook for inventory policy
export function useLocationInventoryPolicy(locationId: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();
  
  const { data, loading, error, refetch } = useQuery(GET_INVENTORY_POLICY, {
    variables: { locationId },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const policy = data?.getInventoryPolicy;

  return {
    policy,
    loading,
    error,
    refetch,
  };
}

// Hook for reorder rules
export function useLocationReorderRules(locationId: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();

  const { data, loading, error, refetch } = useQuery(GET_REORDER_RULES, {
    variables: { locationId },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const rules = data?.getReorderRules || [];

  return {
    rules,
    loading,
    error,
    refetch,
  };
}

// Hook for inventory policy mutations
export function useLocationInventoryPolicyMutations() {
  const { user } = useAuth();
  const { tenant: currentTenant } = useTenant();

  const [updateInventoryPolicyMutation] = useMutation(UPDATE_INVENTORY_POLICY);
  const [updateReorderRulesMutation] = useMutation(UPDATE_REORDER_RULES);

  const updateInventoryPolicy = useCallback(async (
    locationId: string,
    policy: UpdateInventoryPolicyInput,
    options?: MutationHookOptions
  ): Promise<FetchResult<InventoryPolicy>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return updateInventoryPolicyMutation({
      variables: { locationId, policy },
      refetchQueries: ['GetInventoryPolicy'],
      ...options,
    });
  }, [updateInventoryPolicyMutation, currentTenant?.id, user?.id]);

  const updateReorderRules = useCallback(async (
    locationId: string,
    rules: ReorderRule[],
    options?: MutationHookOptions
  ): Promise<FetchResult<ReorderRule[]>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return updateReorderRulesMutation({
      variables: { locationId, rules },
      refetchQueries: ['GetReorderRules'],
      ...options,
    });
  }, [updateReorderRulesMutation, currentTenant?.id, user?.id]);

  return {
    updateInventoryPolicy,
    updateReorderRules,
  };
}

// Hook for inventory calculations
export function useInventoryCalculations() {
  const calculateReorderPoint = useCallback((
    averageDailyUsage: number,
    leadTimeDays: number,
    safetyStock: number = 0
  ): number => {
    return Math.ceil((averageDailyUsage * leadTimeDays) + safetyStock);
  }, []);

  const calculateSafetyStock = useCallback((
    averageDailyUsage: number,
    maxLeadTime: number,
    averageLeadTime: number,
    maxDailyUsage: number
  ): number => {
    return Math.ceil(
      (maxLeadTime * maxDailyUsage) - (averageLeadTime * averageDailyUsage)
    );
  }, []);

  const calculateEconomicOrderQuantity = useCallback((
    annualDemand: number,
    orderingCost: number,
    holdingCostPerUnit: number
  ): number => {
    if (holdingCostPerUnit <= 0) return 0;
    return Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit));
  }, []);

  const calculateInventoryTurnover = useCallback((
    costOfGoodsSold: number,
    averageInventoryValue: number
  ): number => {
    if (averageInventoryValue <= 0) return 0;
    return costOfGoodsSold / averageInventoryValue;
  }, []);

  const calculateDaysOfSupply = useCallback((
    currentStock: number,
    averageDailyUsage: number
  ): number => {
    if (averageDailyUsage <= 0) return 0;
    return currentStock / averageDailyUsage;
  }, []);

  const calculateStockoutRisk = useCallback((
    currentStock: number,
    reorderPoint: number,
    averageDailyUsage: number,
    leadTimeDays: number
  ): 'low' | 'medium' | 'high' | 'critical' => {
    const daysUntilStockout = currentStock / averageDailyUsage;
    
    if (currentStock <= 0) return 'critical';
    if (daysUntilStockout <= leadTimeDays) return 'high';
    if (currentStock <= reorderPoint) return 'medium';
    return 'low';
  }, []);

  return {
    calculateReorderPoint,
    calculateSafetyStock,
    calculateEconomicOrderQuantity,
    calculateInventoryTurnover,
    calculateDaysOfSupply,
    calculateStockoutRisk,
  };
}

// Hook for inventory policy validation
export function useInventoryPolicyValidation() {
  const validateStockLevels = useCallback((
    minStock?: number,
    maxStock?: number,
    safetyStock?: number
  ): string | null => {
    if (minStock !== undefined && minStock < 0) {
      return 'Minimum stock level must be non-negative';
    }

    if (maxStock !== undefined && maxStock < 0) {
      return 'Maximum stock level must be non-negative';
    }

    if (safetyStock !== undefined && safetyStock < 0) {
      return 'Safety stock must be non-negative';
    }

    if (minStock !== undefined && maxStock !== undefined && minStock > maxStock) {
      return 'Minimum stock level cannot be greater than maximum stock level';
    }

    if (minStock !== undefined && safetyStock !== undefined && safetyStock > minStock) {
      return 'Safety stock should not exceed minimum stock level';
    }

    return null;
  }, []);

  const validateReorderQuantity = useCallback((quantity?: number): string | null => {
    if (quantity !== undefined && quantity < 1) {
      return 'Reorder quantity must be at least 1';
    }
    return null;
  }, []);

  const validateLeadTime = useCallback((days?: number): string | null => {
    if (days !== undefined && days < 0) {
      return 'Lead time must be non-negative';
    }
    if (days !== undefined && days > 365) {
      return 'Lead time cannot exceed 365 days';
    }
    return null;
  }, []);

  const validateSeasonalMultiplier = useCallback((multiplier?: number): string | null => {
    if (multiplier !== undefined && (multiplier < 0.1 || multiplier > 10.0)) {
      return 'Seasonal multiplier must be between 0.1 and 10.0';
    }
    return null;
  }, []);

  const validateForecastPeriod = useCallback((days?: number): string | null => {
    if (days !== undefined && (days < 1 || days > 365)) {
      return 'Forecast period must be between 1 and 365 days';
    }
    return null;
  }, []);

  const validateInventoryPolicy = useCallback((policy: UpdateInventoryPolicyInput): Record<string, string> => {
    const errors: Record<string, string> = {};

    const stockError = validateStockLevels(
      policy.minStockLevel,
      policy.maxStockLevel,
      policy.safetyStock
    );
    if (stockError) errors.stockLevels = stockError;

    const reorderError = validateReorderQuantity(policy.reorderQuantity);
    if (reorderError) errors.reorderQuantity = reorderError;

    const leadTimeError = validateLeadTime(policy.leadTimeDays);
    if (leadTimeError) errors.leadTime = leadTimeError;

    const seasonalError = validateSeasonalMultiplier(policy.seasonalMultiplier);
    if (seasonalError) errors.seasonalMultiplier = seasonalError;

    const forecastError = validateForecastPeriod(policy.forecastPeriodDays);
    if (forecastError) errors.forecastPeriod = forecastError;

    if (policy.priority !== undefined && (policy.priority < 0 || policy.priority > 100)) {
      errors.priority = 'Priority must be between 0 and 100';
    }

    return errors;
  }, [
    validateStockLevels,
    validateReorderQuantity,
    validateLeadTime,
    validateSeasonalMultiplier,
    validateForecastPeriod,
  ]);

  return {
    validateStockLevels,
    validateReorderQuantity,
    validateLeadTime,
    validateSeasonalMultiplier,
    validateForecastPeriod,
    validateInventoryPolicy,
  };
}

// Hook for inventory recommendations
export function useInventoryRecommendations() {
  const generateReorderRecommendation = useCallback((
    currentStock: number,
    reorderPoint: number,
    reorderQuantity: number,
    averageDailyUsage: number,
    leadTimeDays: number
  ): InventoryRecommendation | null => {
    if (currentStock <= reorderPoint) {
      const daysUntilStockout = currentStock / averageDailyUsage;
      const expectedStockOutDate = new Date();
      expectedStockOutDate.setDate(expectedStockOutDate.getDate() + daysUntilStockout);

      return {
        productId: '', // Would be provided by caller
        currentStock,
        recommendedAction: 'REORDER',
        recommendedQuantity: reorderQuantity,
        reason: `Stock level (${currentStock}) is at or below reorder point (${reorderPoint})`,
        priority: daysUntilStockout <= leadTimeDays ? 'HIGH' : 'MEDIUM',
        expectedStockOutDate: expectedStockOutDate.toISOString(),
        appliedPolicies: [],
      };
    }

    return null;
  }, []);

  const generateOverstockRecommendation = useCallback((
    currentStock: number,
    maxStockLevel: number
  ): InventoryRecommendation | null => {
    if (maxStockLevel && currentStock > maxStockLevel) {
      const excessQuantity = currentStock - maxStockLevel;
      
      return {
        productId: '', // Would be provided by caller
        currentStock,
        recommendedAction: 'REDUCE_STOCK',
        recommendedQuantity: excessQuantity,
        reason: `Stock level (${currentStock}) exceeds maximum (${maxStockLevel})`,
        priority: 'LOW',
        appliedPolicies: [],
      };
    }

    return null;
  }, []);

  const generateSlowMovingRecommendation = useCallback((
    currentStock: number,
    averageDailyUsage: number,
    daysOfSupply: number
  ): InventoryRecommendation | null => {
    if (daysOfSupply > 90 && averageDailyUsage < 0.1) { // Less than 0.1 units per day
      return {
        productId: '', // Would be provided by caller
        currentStock,
        recommendedAction: 'REVIEW_SLOW_MOVING',
        recommendedQuantity: 0,
        reason: `Item has ${daysOfSupply.toFixed(0)} days of supply with low usage`,
        priority: 'LOW',
        appliedPolicies: [],
      };
    }

    return null;
  }, []);

  return {
    generateReorderRecommendation,
    generateOverstockRecommendation,
    generateSlowMovingRecommendation,
  };
}

// Main location inventory policy management hook
export function useLocationInventoryPolicyManagement() {
  const policyMutations = useLocationInventoryPolicyMutations();
  const inventoryCalculations = useInventoryCalculations();
  const policyValidation = useInventoryPolicyValidation();
  const inventoryRecommendations = useInventoryRecommendations();

  return {
    ...policyMutations,
    ...inventoryCalculations,
    ...policyValidation,
    ...inventoryRecommendations,
  };
}