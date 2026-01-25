/**
 * Franchise Management Hooks
 * Complete hook implementation for franchise operations
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
  GET_FRANCHISE,
  GET_FRANCHISES,
  GET_FRANCHISE_PERFORMANCE
} from '@/graphql/queries/location-queries';
import {
  CREATE_FRANCHISE,
  UPDATE_FRANCHISE
} from '@/graphql/mutations/location-mutations';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

// Types
export interface Franchise {
  id: string;
  name: string;
  code: string;
  performance?: FranchisePerformance;
}

export interface FranchisePerformance {
  franchiseId: string;
  period?: string;
  totalRevenue: number;
  operatingCosts: number;
  netProfit: number;
  royaltiesPaid: number;
  marketingFeePaid: number;
  customerSatisfactionScore?: number;
  operationalEfficiency?: number;
  [key: string]: unknown;
}

export interface CreateFranchiseInput {
  name: string;
  code: string;
  description?: string;
  type: string;
  ownerId?: string;
  operatorId?: string;
  businessName?: string;
  businessRegistrationNumber?: string;
  taxId?: string;
  royaltyRate?: number;
  marketingFeeRate?: number;
  initialFranchiseFee?: number;
  contractStartDate?: string;
  contractEndDate?: string;
  primaryTerritoryId?: string;
  parentFranchiseId?: string;
}

export interface UpdateFranchiseInput {
  name?: string;
  description?: string;
  type?: string;
  status?: string;
  ownerId?: string;
  operatorId?: string;
  businessName?: string;
  businessRegistrationNumber?: string;
  taxId?: string;
  royaltyRate?: number;
  marketingFeeRate?: number;
  initialFranchiseFee?: number;
  contractStartDate?: string;
  contractEndDate?: string;
  primaryTerritoryId?: string;
  parentFranchiseId?: string;
}

// Hook for single franchise
export function useFranchise(id: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();
  
  const { data, loading, error, refetch } = useQuery(GET_FRANCHISE, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    ...options,
  });

  const franchise = data?.franchise;

  return {
    franchise,
    loading,
    error,
    refetch,
  };
}

// Hook for multiple franchises
export function useFranchises(options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();

  const { data, loading, error, refetch } = useQuery(GET_FRANCHISES, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    ...options,
  });

  const franchises = data?.franchises || [];

  return {
    franchises,
    loading,
    error,
    refetch,
  };
}

// Hook for franchise performance
export function useFranchisePerformance(id: string, period?: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();

  const { data, loading, error, refetch } = useQuery(GET_FRANCHISE_PERFORMANCE, {
    variables: { id, period },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    ...options,
  });

  const performance: FranchisePerformance | undefined = data?.getFranchisePerformance;

  return {
    performance,
    loading,
    error,
    refetch,
  };
}

// Hook for franchise mutations
export function useFranchiseMutations() {
  const { user } = useAuth();
  const { tenant: currentTenant } = useTenant();

  const [createFranchiseMutation] = useMutation(CREATE_FRANCHISE);
  const [updateFranchiseMutation] = useMutation(UPDATE_FRANCHISE);

  const createFranchise = useCallback(async (
    input: CreateFranchiseInput,
    options?: MutationHookOptions
  ): Promise<FetchResult<Franchise>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return createFranchiseMutation({
      variables: { input },
      refetchQueries: ['GetFranchises'],
      ...options,
    });
  }, [createFranchiseMutation, currentTenant?.id, user?.id]);

  const updateFranchise = useCallback(async (
    id: string,
    input: UpdateFranchiseInput,
    options?: MutationHookOptions
  ): Promise<FetchResult<Franchise>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return updateFranchiseMutation({
      variables: { id, input },
      refetchQueries: ['GetFranchise', 'GetFranchises'],
      ...options,
    });
  }, [updateFranchiseMutation, currentTenant?.id, user?.id]);

  return {
    createFranchise,
    updateFranchise,
  };
}

// Hook for franchise validation
export function useFranchiseValidation() {
  const validateFranchiseCode = useCallback((code: string): string | null => {
    if (!code) return 'Franchise code is required';
    if (code.length > 50) return 'Code must be 50 characters or less';
    return null;
  }, []);

  const validateFranchiseName = useCallback((name: string): string | null => {
    if (!name) return 'Franchise name is required';
    if (name.length > 255) return 'Name must be 255 characters or less';
    return null;
  }, []);

  const validateRoyaltyRate = useCallback((rate?: number): string | null => {
    if (rate !== undefined && (rate < 0 || rate > 1)) {
      return 'Royalty rate must be between 0 and 1';
    }
    return null;
  }, []);

  const validateMarketingFeeRate = useCallback((rate?: number): string | null => {
    if (rate !== undefined && (rate < 0 || rate > 1)) {
      return 'Marketing fee rate must be between 0 and 1';
    }
    return null;
  }, []);

  const validateFranchise = useCallback((franchise: CreateFranchiseInput | UpdateFranchiseInput): Record<string, string> => {
    const errors: Record<string, string> = {};

    if ('name' in franchise) {
      const nameError = validateFranchiseName(franchise.name!);
      if (nameError) errors.name = nameError;
    }

    if ('code' in franchise) {
      const codeError = validateFranchiseCode(franchise.code!);
      if (codeError) errors.code = codeError;
    }

    const royaltyError = validateRoyaltyRate(franchise.royaltyRate);
    if (royaltyError) errors.royaltyRate = royaltyError;

    const marketingError = validateMarketingFeeRate(franchise.marketingFeeRate);
    if (marketingError) errors.marketingFeeRate = marketingError;

    if (franchise.initialFranchiseFee !== undefined && franchise.initialFranchiseFee < 0) {
      errors.initialFranchiseFee = 'Initial franchise fee must be positive';
    }

    return errors;
  }, [validateFranchiseName, validateFranchiseCode, validateRoyaltyRate, validateMarketingFeeRate]);

  return {
    validateFranchiseCode,
    validateFranchiseName,
    validateRoyaltyRate,
    validateMarketingFeeRate,
    validateFranchise,
  };
}

// Main franchise management hook
export function useFranchiseManagement() {
  const franchiseMutations = useFranchiseMutations();
  const franchiseValidation = useFranchiseValidation();

  return {
    ...franchiseMutations,
    ...franchiseValidation,
  };
}