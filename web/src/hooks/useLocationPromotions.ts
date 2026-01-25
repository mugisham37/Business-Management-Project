/**
 * Location Promotions Management Hooks
 * Complete hook implementation for location promotion operations
 */

import { useCallback } from 'react';
import { 
  useQuery, 
  useMutation,
  useSubscription,
  QueryHookOptions,
  MutationHookOptions,
  FetchResult
} from '@apollo/client';
import { 
  GET_LOCATION_PROMOTIONS
} from '@/graphql/queries/location-queries';
import {
  CREATE_LOCATION_PROMOTION,
  ACTIVATE_PROMOTION,
  DEACTIVATE_PROMOTION
} from '@/graphql/mutations/location-mutations';
import {
  PROMOTION_ACTIVATED
} from '@/graphql/subscriptions/location-subscriptions';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

// Types
export interface PromotionCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface PromotionAction {
  type: string;
  value: number;
}

export interface LocationPromotion {
  id: string;
  name: string;
  description?: string;
  promotionType: string;
  status: string;
  targetType: string;
  targetProductIds?: string[];
  targetCategoryIds?: string[];
  targetCustomerSegments?: string[];
  startDate: string;
  endDate: string;
  discountPercentage?: number;
  discountAmount?: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  maxUsesPerCustomer?: number;
  maxTotalUses?: number;
  priority?: number;
  isCombinable?: boolean;
  conditions?: PromotionCondition[];
  actions?: PromotionAction[];
  promotionCode?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromotionInput {
  name: string;
  description?: string;
  promotionType: string;
  targetType: string;
  targetProductIds?: string[];
  targetCategoryIds?: string[];
  targetCustomerSegments?: string[];
  startDate: string;
  endDate: string;
  discountPercentage?: number;
  discountAmount?: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  maxUsesPerCustomer?: number;
  maxTotalUses?: number;
  priority?: number;
  isCombinable?: boolean;
  conditions?: PromotionCondition[];
  actions?: PromotionAction[];
  promotionCode?: string;
  isActive?: boolean;
}

export interface CartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface PromotionApplication {
  promotionIdOrCode: string;
  cartItems: CartItem[];
  customerId?: string;
}

// Hook for location promotions
export function useLocationPromotions(locationId: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();
  
  const { data, loading, error, refetch } = useQuery(GET_LOCATION_PROMOTIONS, {
    variables: { locationId },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const promotions: LocationPromotion[] = data?.locationPromotions || [];

  return {
    promotions,
    loading,
    error,
    refetch,
  };
}

// Hook for promotion mutations
export function useLocationPromotionMutations() {
  const { user } = useAuth();
  const { tenant: currentTenant } = useTenant();

  const [createLocationPromotionMutation] = useMutation(CREATE_LOCATION_PROMOTION);
  const [activatePromotionMutation] = useMutation(ACTIVATE_PROMOTION);
  const [deactivatePromotionMutation] = useMutation(DEACTIVATE_PROMOTION);

  const createLocationPromotion = useCallback(async (
    locationId: string,
    promotion: CreatePromotionInput,
    options?: MutationHookOptions
  ): Promise<FetchResult<LocationPromotion>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return createLocationPromotionMutation({
      variables: { locationId, promotion },
      refetchQueries: ['GetLocationPromotions'],
      ...options,
    });
  }, [createLocationPromotionMutation, currentTenant?.id, user?.id]);

  const activatePromotion = useCallback(async (
    promotionId: string,
    options?: MutationHookOptions
  ): Promise<FetchResult<LocationPromotion>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return activatePromotionMutation({
      variables: { promotionId },
      refetchQueries: ['GetLocationPromotions'],
      ...options,
    });
  }, [activatePromotionMutation, currentTenant?.id, user?.id]);

  const deactivatePromotion = useCallback(async (
    promotionId: string,
    options?: MutationHookOptions
  ): Promise<FetchResult<LocationPromotion>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return deactivatePromotionMutation({
      variables: { promotionId },
      refetchQueries: ['GetLocationPromotions'],
      ...options,
    });
  }, [deactivatePromotionMutation, currentTenant?.id, user?.id]);

  return {
    createLocationPromotion,
    activatePromotion,
    deactivatePromotion,
  };
}

// Hook for promotion subscriptions
export function usePromotionSubscriptions(options?: { enabled?: boolean }) {
  const { tenant: currentTenant } = useTenant();
  const { enabled = true } = options || {};

  const { data: promotionActivatedData } = useSubscription(PROMOTION_ACTIVATED, {
    skip: !currentTenant?.id || !enabled,
  });

  return {
    promotionActivatedData: promotionActivatedData?.promotionActivated,
  };
}

// Hook for promotion calculations
export function usePromotionCalculations() {
  const calculatePromotionDiscount = useCallback((
    cartTotal: number,
    promotion: LocationPromotion
  ): number => {
    let discount = 0;

    // Check minimum purchase requirement
    if (promotion.minPurchaseAmount && cartTotal < promotion.minPurchaseAmount) {
      return 0;
    }

    // Calculate discount
    if (promotion.discountAmount) {
      discount = promotion.discountAmount;
    } else if (promotion.discountPercentage) {
      discount = cartTotal * (promotion.discountPercentage / 100);
    }

    // Apply maximum discount limit
    if (promotion.maxDiscountAmount && discount > promotion.maxDiscountAmount) {
      discount = promotion.maxDiscountAmount;
    }

    return Math.min(discount, cartTotal);
  }, []);

  const calculateCartTotal = useCallback((items: CartItem[]): number => {
    return items.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
  }, []);

  const applyPromotionToCart = useCallback((
    items: CartItem[],
    promotion: LocationPromotion
  ): {
    originalTotal: number;
    discountAmount: number;
    finalTotal: number;
    appliedItems: CartItem[];
  } => {
    const originalTotal = calculateCartTotal(items);
    
    // Filter items that qualify for the promotion
    let qualifyingItems = items;
    
    if (promotion.targetProductIds && promotion.targetProductIds.length > 0) {
      qualifyingItems = items.filter(item => 
        promotion.targetProductIds!.includes(item.productId)
      );
    }

    const qualifyingTotal = calculateCartTotal(qualifyingItems);
    const discountAmount = calculatePromotionDiscount(qualifyingTotal, promotion);
    const finalTotal = originalTotal - discountAmount;

    return {
      originalTotal,
      discountAmount,
      finalTotal: Math.max(0, finalTotal),
      appliedItems: qualifyingItems,
    };
  }, [calculateCartTotal, calculatePromotionDiscount]);

  return {
    calculatePromotionDiscount,
    calculateCartTotal,
    applyPromotionToCart,
  };
}

// Hook for promotion validation
export function usePromotionValidation() {
  const validatePromotionName = useCallback((name: string): string | null => {
    if (!name) return 'Promotion name is required';
    if (name.length > 255) return 'Name must be 255 characters or less';
    return null;
  }, []);

  const validatePromotionDates = useCallback((startDate: string, endDate: string): string | null => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start >= end) {
      return 'Start date must be before end date';
    }

    if (end <= now) {
      return 'End date must be in the future';
    }

    return null;
  }, []);

  const validateDiscountValues = useCallback((
    discountPercentage?: number,
    discountAmount?: number
  ): string | null => {
    if (!discountPercentage && !discountAmount) {
      return 'Either discount percentage or discount amount is required';
    }

    if (discountPercentage && (discountPercentage <= 0 || discountPercentage > 100)) {
      return 'Discount percentage must be between 0 and 100';
    }

    if (discountAmount && discountAmount <= 0) {
      return 'Discount amount must be positive';
    }

    return null;
  }, []);

  const validatePromotionLimits = useCallback((
    maxUsesPerCustomer?: number,
    maxTotalUses?: number
  ): string | null => {
    if (maxUsesPerCustomer && maxUsesPerCustomer < 1) {
      return 'Max uses per customer must be at least 1';
    }

    if (maxTotalUses && maxTotalUses < 1) {
      return 'Max total uses must be at least 1';
    }

    return null;
  }, []);

  const validatePromotion = useCallback((promotion: CreatePromotionInput): Record<string, string> => {
    const errors: Record<string, string> = {};

    const nameError = validatePromotionName(promotion.name);
    if (nameError) errors.name = nameError;

    const dateError = validatePromotionDates(promotion.startDate, promotion.endDate);
    if (dateError) errors.dates = dateError;

    const discountError = validateDiscountValues(promotion.discountPercentage, promotion.discountAmount);
    if (discountError) errors.discount = discountError;

    const limitsError = validatePromotionLimits(promotion.maxUsesPerCustomer, promotion.maxTotalUses);
    if (limitsError) errors.limits = limitsError;

    if (promotion.minPurchaseAmount && promotion.minPurchaseAmount < 0) {
      errors.minPurchase = 'Minimum purchase amount must be positive';
    }

    if (promotion.maxDiscountAmount && promotion.maxDiscountAmount < 0) {
      errors.maxDiscount = 'Maximum discount amount must be positive';
    }

    if (promotion.priority !== undefined && (promotion.priority < 0 || promotion.priority > 100)) {
      errors.priority = 'Priority must be between 0 and 100';
    }

    return errors;
  }, [validatePromotionName, validatePromotionDates, validateDiscountValues, validatePromotionLimits]);

  return {
    validatePromotionName,
    validatePromotionDates,
    validateDiscountValues,
    validatePromotionLimits,
    validatePromotion,
  };
}

// Hook for promotion status management
export function usePromotionStatus() {
  const isPromotionActive = useCallback((promotion: LocationPromotion): boolean => {
    const now = new Date();
    const startDate = new Date(promotion.startDate);
    const endDate = new Date(promotion.endDate);

    return promotion.isActive && 
           promotion.status === 'active' &&
           now >= startDate && 
           now <= endDate;
  }, []);

  const getPromotionStatus = useCallback((promotion: LocationPromotion): string => {
    const now = new Date();
    const startDate = new Date(promotion.startDate);
    const endDate = new Date(promotion.endDate);

    if (!promotion.isActive) return 'inactive';
    if (promotion.status !== 'active') return promotion.status;
    if (now < startDate) return 'scheduled';
    if (now > endDate) return 'expired';
    return 'active';
  }, []);

  const canActivatePromotion = useCallback((promotion: LocationPromotion): boolean => {
    const now = new Date();
    const endDate = new Date(promotion.endDate);
    
    return !promotion.isActive && now <= endDate;
  }, []);

  const canDeactivatePromotion = useCallback((promotion: LocationPromotion): boolean => {
    return promotion.isActive;
  }, []);

  return {
    isPromotionActive,
    getPromotionStatus,
    canActivatePromotion,
    canDeactivatePromotion,
  };
}

// Main location promotion management hook
export function useLocationPromotionManagement() {
  const promotionMutations = useLocationPromotionMutations();
  const promotionCalculations = usePromotionCalculations();
  const promotionValidation = usePromotionValidation();
  const promotionStatus = usePromotionStatus();
  const promotionSubscriptions = usePromotionSubscriptions();

  return {
    ...promotionMutations,
    ...promotionCalculations,
    ...promotionValidation,
    ...promotionStatus,
    ...promotionSubscriptions,
  };
}