/**
 * Location Pricing Management Hooks
 * Complete hook implementation for location pricing operations
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
  GET_LOCATION_PRICING,
  GET_PRICING_RULES
} from '@/graphql/queries/location-queries';
import {
  UPDATE_LOCATION_PRICING,
  APPLY_PRICING_RULE
} from '@/graphql/mutations/location-mutations';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

// Types
export interface PricingCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface PricingRule {
  id: string;
  name: string;
  description?: string;
  ruleType: string;
  productId: string;
  categoryId?: string;
  value: number;
  minQuantity?: number;
  maxQuantity?: number;
  startDate?: string;
  endDate?: string;
  priority?: number;
  conditions?: PricingCondition[];
  isActive: boolean;
  status: string;
}

export interface LocationPricing {
  locationId: string;
  productId?: string;
  basePrice?: number;
  rules: PricingRule[];
  effectivePrice?: number;
  discounts?: PricingDiscount[];
}

export interface PricingDiscount {
  id: string;
  discountType: string;
  value: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdatePricingInput {
  productId?: string;
  basePrice?: number;
  rules?: PricingRule[];
  effectiveDate?: string;
}

// Hook for location pricing
export function useLocationPricing(locationId: string, productId?: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();
  
  const { data, loading, error, refetch } = useQuery(GET_LOCATION_PRICING, {
    variables: { locationId, productId },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const pricing: LocationPricing | undefined = data?.getLocationPricing;

  return {
    pricing,
    loading,
    error,
    refetch,
  };
}

// Hook for pricing rules
export function usePricingRules(locationId: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();

  const { data, loading, error, refetch } = useQuery(GET_PRICING_RULES, {
    variables: { locationId },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const rules: PricingRule[] = data?.getPricingRules || [];

  return {
    rules,
    loading,
    error,
    refetch,
  };
}

// Hook for pricing mutations
export function useLocationPricingMutations() {
  const { user } = useAuth();
  const { tenant: currentTenant } = useTenant();

  const [updateLocationPricingMutation] = useMutation(UPDATE_LOCATION_PRICING);
  const [applyPricingRuleMutation] = useMutation(APPLY_PRICING_RULE);

  const updateLocationPricing = useCallback(async (
    locationId: string,
    pricing: UpdatePricingInput,
    options?: MutationHookOptions
  ): Promise<FetchResult<LocationPricing>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return updateLocationPricingMutation({
      variables: { locationId, pricing },
      refetchQueries: ['GetLocationPricing', 'GetPricingRules'],
      ...options,
    });
  }, [updateLocationPricingMutation, currentTenant?.id, user?.id]);

  const applyPricingRule = useCallback(async (
    locationId: string,
    ruleId: string,
    options?: MutationHookOptions
  ): Promise<FetchResult<LocationPricing>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return applyPricingRuleMutation({
      variables: { locationId, ruleId },
      refetchQueries: ['GetLocationPricing', 'GetPricingRules'],
      ...options,
    });
  }, [applyPricingRuleMutation, currentTenant?.id, user?.id]);

  return {
    updateLocationPricing,
    applyPricingRule,
  };
}

// Hook for pricing calculations
export function usePricingCalculations() {
  const calculateDiscountedPrice = useCallback((
    basePrice: number,
    discountPercentage?: number,
    discountAmount?: number
  ): number => {
    let finalPrice = basePrice;

    if (discountAmount) {
      finalPrice -= discountAmount;
    } else if (discountPercentage) {
      finalPrice -= (basePrice * discountPercentage / 100);
    }

    return Math.max(0, finalPrice);
  }, []);

  const calculateBulkDiscount = useCallback((
    basePrice: number,
    quantity: number,
    bulkRules: Array<{ minQuantity: number; discountPercentage: number }>
  ): number => {
    const applicableRule = bulkRules
      .filter(rule => quantity >= rule.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];

    if (applicableRule) {
      return calculateDiscountedPrice(basePrice, applicableRule.discountPercentage);
    }

    return basePrice;
  }, [calculateDiscountedPrice]);

  const calculateTieredPricing = useCallback((
    quantity: number,
    tiers: Array<{ minQuantity: number; maxQuantity?: number; price: number }>
  ): number => {
    let totalPrice = 0;
    let remainingQuantity = quantity;

    const sortedTiers = tiers.sort((a, b) => a.minQuantity - b.minQuantity);

    for (const tier of sortedTiers) {
      if (remainingQuantity <= 0) break;

      const tierQuantity = tier.maxQuantity 
        ? Math.min(remainingQuantity, tier.maxQuantity - tier.minQuantity + 1)
        : remainingQuantity;

      totalPrice += tierQuantity * tier.price;
      remainingQuantity -= tierQuantity;
    }

    return totalPrice;
  }, []);

  return {
    calculateDiscountedPrice,
    calculateBulkDiscount,
    calculateTieredPricing,
  };
}

// Hook for pricing validation
export function usePricingValidation() {
  const validatePrice = useCallback((price: number): string | null => {
    if (price < 0) return 'Price must be positive';
    if (price > 999999.99) return 'Price is too large';
    return null;
  }, []);

  const validateDiscountPercentage = useCallback((percentage: number): string | null => {
    if (percentage < 0 || percentage > 100) {
      return 'Discount percentage must be between 0 and 100';
    }
    return null;
  }, []);

  const validateQuantityRange = useCallback((min?: number, max?: number): string | null => {
    if (min !== undefined && min < 1) return 'Minimum quantity must be at least 1';
    if (max !== undefined && max < 1) return 'Maximum quantity must be at least 1';
    if (min !== undefined && max !== undefined && min > max) {
      return 'Minimum quantity cannot be greater than maximum quantity';
    }
    return null;
  }, []);

  const validateDateRange = useCallback((startDate?: string, endDate?: string): string | null => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        return 'Start date must be before end date';
      }
    }
    return null;
  }, []);

  const validatePricingRule = useCallback((rule: Partial<PricingRule>): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (rule.value !== undefined) {
      const priceError = validatePrice(rule.value);
      if (priceError) errors.value = priceError;
    }

    const quantityError = validateQuantityRange(rule.minQuantity, rule.maxQuantity);
    if (quantityError) errors.quantity = quantityError;

    const dateError = validateDateRange(rule.startDate, rule.endDate);
    if (dateError) errors.dates = dateError;

    if (rule.priority !== undefined && (rule.priority < 0 || rule.priority > 100)) {
      errors.priority = 'Priority must be between 0 and 100';
    }

    return errors;
  }, [validatePrice, validateQuantityRange, validateDateRange]);

  return {
    validatePrice,
    validateDiscountPercentage,
    validateQuantityRange,
    validateDateRange,
    validatePricingRule,
  };
}

// Main location pricing management hook
export function useLocationPricingManagement() {
  const pricingMutations = useLocationPricingMutations();
  const pricingCalculations = usePricingCalculations();
  const pricingValidation = usePricingValidation();

  return {
    ...pricingMutations,
    ...pricingCalculations,
    ...pricingValidation,
  };
}