import { useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  Territory, 
  TerritoryType,
  TerritoryPerformance,
  TerritoryCustomerAssignment,
  UseTerritoriesResult 
} from '@/types/crm';
import {
  GET_TERRITORIES,
  GET_TERRITORY,
  GET_TERRITORY_PERFORMANCE,
  GET_TERRITORY_CUSTOMERS,
} from '@/graphql/queries/b2b-queries';
import {
  CREATE_TERRITORY,
  UPDATE_TERRITORY,
  ASSIGN_CUSTOMER_TO_TERRITORY,
  BULK_ASSIGN_CUSTOMERS_TO_TERRITORY,
  SET_TERRITORY_ACTIVE,
} from '@/graphql/mutations/b2b-mutations';
import {
  TERRITORY_ASSIGNMENT_CHANGED_SUBSCRIPTION,
  TERRITORY_PERFORMANCE_UPDATED_SUBSCRIPTION,
} from '@/graphql/subscriptions/b2b-subscriptions';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export interface TerritoryQueryInput {
  search?: string;
  territoryType?: TerritoryType;
  primarySalesRepId?: string;
  managerId?: string;
  isActive?: boolean;
  hasRevenueTarget?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateTerritoryInput {
  territoryCode: string;
  name: string;
  description?: string;
  territoryType: TerritoryType;
  primarySalesRepId?: string;
  secondarySalesRepIds?: string[];
  managerId?: string;
  revenueTarget?: number;
  customerTarget?: number;
  regions?: string[];
  postalCodes?: string[];
  states?: string[];
  countries?: string[];
}

export interface UpdateTerritoryInput {
  territoryCode?: string;
  name?: string;
  description?: string;
  territoryType?: TerritoryType;
  primarySalesRepId?: string;
  secondarySalesRepIds?: string[];
  managerId?: string;
  isActive?: boolean;
  revenueTarget?: number;
  customerTarget?: number;
  regions?: string[];
  postalCodes?: string[];
  states?: string[];
  countries?: string[];
}

export interface AssignCustomerToTerritoryInput {
  customerId: string;
  notes?: string;
}

export interface BulkAssignCustomersInput {
  customerIds: string[];
  notes?: string;
}

export interface TerritoryPerformanceQueryInput {
  startDate?: Date;
  endDate?: Date;
}

export interface UseTerritoriesResult {
  territories: Territory[];
  loading: boolean;
  error?: Error;
  totalCount: number;
  createTerritory: (input: CreateTerritoryInput) => Promise<Territory>;
  updateTerritory: (id: string, input: UpdateTerritoryInput) => Promise<Territory>;
  assignCustomer: (territoryId: string, input: AssignCustomerToTerritoryInput) => Promise<TerritoryCustomerAssignment>;
  bulkAssignCustomers: (territoryId: string, input: BulkAssignCustomersInput) => Promise<TerritoryCustomerAssignment[]>;
  setTerritoryActive: (id: string, isActive: boolean) => Promise<Territory>;
  getTerritoryPerformance: (id: string, query: TerritoryPerformanceQueryInput) => Promise<TerritoryPerformance>;
  getTerritoryCustomers: (id: string) => Promise<any[]>;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing territories with comprehensive operations
 */
export function useTerritories(query?: TerritoryQueryInput): UseTerritoriesResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  // Query territories with filters
  const { 
    data, 
    loading, 
    error, 
    refetch 
  } = useQuery(GET_TERRITORIES, {
    variables: { query: query || {} },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch territories');
    },
  });

  // Mutations
  const [createTerritoryMutation] = useMutation(CREATE_TERRITORY, {
    onError: (error) => handleError(error, 'Failed to create territory'),
    refetchQueries: [{ query: GET_TERRITORIES, variables: { query: query || {} } }],
    awaitRefetchQueries: true,
  });

  const [updateTerritoryMutation] = useMutation(UPDATE_TERRITORY, {
    onError: (error) => handleError(error, 'Failed to update territory'),
  });

  const [assignCustomerMutation] = useMutation(ASSIGN_CUSTOMER_TO_TERRITORY, {
    onError: (error) => handleError(error, 'Failed to assign customer to territory'),
  });

  const [bulkAssignCustomersMutation] = useMutation(BULK_ASSIGN_CUSTOMERS_TO_TERRITORY, {
    onError: (error) => handleError(error, 'Failed to bulk assign customers to territory'),
  });

  const [setTerritoryActiveMutation] = useMutation(SET_TERRITORY_ACTIVE, {
    onError: (error) => handleError(error, 'Failed to update territory status'),
  });

  // Subscriptions for real-time updates
  useSubscription(TERRITORY_ASSIGNMENT_CHANGED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.territoryAssignmentChanged) {
        refetch();
      }
    },
  });

  useSubscription(TERRITORY_PERFORMANCE_UPDATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.territoryPerformanceUpdated) {
        refetch();
      }
    },
  });

  // Callbacks
  const createTerritory = useCallback(async (input: CreateTerritoryInput): Promise<Territory> => {
    try {
      const result = await createTerritoryMutation({
        variables: { input },
        optimisticResponse: {
          createTerritory: {
            __typename: 'TerritoryGraphQLType',
            id: `temp-${Date.now()}`,
            territoryCode: input.territoryCode,
            name: input.name,
            description: input.description,
            territoryType: input.territoryType,
            primarySalesRepId: input.primarySalesRepId,
            secondarySalesRepIds: input.secondarySalesRepIds || [],
            managerId: input.managerId,
            isActive: true,
            revenueTarget: input.revenueTarget,
            customerTarget: input.customerTarget,
            regions: input.regions || [],
            postalCodes: input.postalCodes || [],
            states: input.states || [],
            countries: input.countries || [],
            customerCount: 0,
            currentRevenue: 0,
            targetAchievement: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.createTerritory;
    } catch (error) {
      throw error;
    }
  }, [createTerritoryMutation]);

  const updateTerritory = useCallback(async (
    id: string, 
    input: UpdateTerritoryInput
  ): Promise<Territory> => {
    try {
      const result = await updateTerritoryMutation({
        variables: { id, input },
        optimisticResponse: {
          updateTerritory: {
            __typename: 'TerritoryGraphQLType',
            id,
            ...input,
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          if (data?.updateTerritory) {
            cache.modify({
              id: cache.identify(data.updateTerritory),
              fields: {
                ...input,
                updatedAt: () => new Date().toISOString(),
              },
            });
          }
        },
      });

      return result.data.updateTerritory;
    } catch (error) {
      throw error;
    }
  }, [updateTerritoryMutation]);

  const assignCustomer = useCallback(async (
    territoryId: string,
    input: AssignCustomerToTerritoryInput
  ): Promise<TerritoryCustomerAssignment> => {
    try {
      const result = await assignCustomerMutation({
        variables: { territoryId, input },
      });

      return result.data.assignCustomerToTerritory.assignment;
    } catch (error) {
      throw error;
    }
  }, [assignCustomerMutation]);

  const bulkAssignCustomers = useCallback(async (
    territoryId: string,
    input: BulkAssignCustomersInput
  ): Promise<TerritoryCustomerAssignment[]> => {
    try {
      const result = await bulkAssignCustomersMutation({
        variables: { territoryId, input },
      });

      return result.data.bulkAssignCustomersToTerritory.assignments;
    } catch (error) {
      throw error;
    }
  }, [bulkAssignCustomersMutation]);

  const setTerritoryActive = useCallback(async (
    id: string, 
    isActive: boolean
  ): Promise<Territory> => {
    try {
      const result = await setTerritoryActiveMutation({
        variables: { id, isActive },
        optimisticResponse: {
          setTerritoryActive: {
            __typename: 'TerritoryGraphQLType',
            id,
            isActive,
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          if (data?.setTerritoryActive) {
            cache.modify({
              id: cache.identify(data.setTerritoryActive),
              fields: {
                isActive: () => isActive,
                updatedAt: () => new Date().toISOString(),
              },
            });
          }
        },
      });

      return result.data.setTerritoryActive;
    } catch (error) {
      throw error;
    }
  }, [setTerritoryActiveMutation]);

  const getTerritoryPerformance = useCallback(async (
    id: string,
    query: TerritoryPerformanceQueryInput
  ): Promise<TerritoryPerformance> => {
    try {
      const { data } = await refetch({
        query: GET_TERRITORY_PERFORMANCE,
        variables: { id, query },
      });

      return data.getTerritoryPerformance;
    } catch (error) {
      throw error;
    }
  }, []);

  const getTerritoryCustomers = useCallback(async (id: string): Promise<any[]> => {
    try {
      const { data } = await refetch({
        query: GET_TERRITORY_CUSTOMERS,
        variables: { id },
      });

      return data.getTerritoryCustomers.customers;
    } catch (error) {
      throw error;
    }
  }, []);

  return {
    territories: data?.getTerritories?.territories || [],
    loading,
    error: error || undefined,
    totalCount: data?.getTerritories?.total || 0,
    createTerritory,
    updateTerritory,
    assignCustomer,
    bulkAssignCustomers,
    setTerritoryActive,
    getTerritoryPerformance,
    getTerritoryCustomers,
    refetch: async () => {
      await refetch();
    },
  };
}

/**
 * Hook for fetching a single territory by ID
 */
export function useTerritory(id: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_TERRITORY, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch territory');
    },
  });
}

/**
 * Hook for territory performance metrics
 */
export function useTerritoryPerformance(
  id: string,
  startDate?: Date,
  endDate?: Date
) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_TERRITORY_PERFORMANCE, {
    variables: { 
      id, 
      query: { startDate, endDate } 
    },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch territory performance');
    },
  });
}

/**
 * Hook for territory customers
 */
export function useTerritoryCustomers(id: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_TERRITORY_CUSTOMERS, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch territory customers');
    },
  });
}