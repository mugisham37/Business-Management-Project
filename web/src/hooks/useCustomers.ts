import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { 
  Customer, 
  CreateCustomerInput, 
  UpdateCustomerInput, 
  CustomerFilterInput,
  UseCustomersResult,
} from '@/types/crm';
import {
  GET_CUSTOMERS,
  GET_CUSTOMER,
  GET_CUSTOMER_BY_EMAIL,
  GET_CUSTOMER_BY_PHONE,
} from '@/graphql/queries/crm-queries';
import {
  CREATE_CUSTOMER,
  UPDATE_CUSTOMER,
  DELETE_CUSTOMER,
  UPDATE_CUSTOMER_PURCHASE_STATS,
  UPDATE_CUSTOMER_LOYALTY_POINTS,
} from '@/graphql/mutations/crm-mutations';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from './useErrorHandler';

/**
 * Hook for managing customers with comprehensive CRUD operations
 */
export function useCustomers(filters?: CustomerFilterInput): UseCustomersResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();
  
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  // Query customers with filters
  const { 
    data, 
    loading, 
    error, 
    refetch: refetchQuery,
    fetchMore: fetchMoreQuery 
  } = useQuery(GET_CUSTOMERS, {
    variables: { query: filters },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
    onCompleted: (data) => {
      if (data?.customers) {
        // Assuming pagination info is included in response
        setTotalCount(data.customers.length);
        setHasNextPage(data.customers.length === (filters?.limit || 50));
        setHasPreviousPage((filters?.page || 1) > 1);
      }
    },
    onError: (error) => {
      handleError(error, 'Failed to fetch customers');
    },
  });

  // Mutations
  const [createCustomerMutation] = useMutation(CREATE_CUSTOMER, {
    onError: (error) => handleError(error, 'Failed to create customer'),
    refetchQueries: [{ query: GET_CUSTOMERS, variables: { query: filters } }],
    awaitRefetchQueries: true,
  });

  const [updateCustomerMutation] = useMutation(UPDATE_CUSTOMER, {
    onError: (error) => handleError(error, 'Failed to update customer'),
  });

  const [deleteCustomerMutation] = useMutation(DELETE_CUSTOMER, {
    onError: (error) => handleError(error, 'Failed to delete customer'),
    refetchQueries: [{ query: GET_CUSTOMERS, variables: { query: filters } }],
    awaitRefetchQueries: true,
  });

  const [updatePurchaseStatsMutation] = useMutation(UPDATE_CUSTOMER_PURCHASE_STATS, {
    onError: (error) => handleError(error, 'Failed to update purchase stats'),
  });

  const [updateLoyaltyPointsMutation] = useMutation(UPDATE_CUSTOMER_LOYALTY_POINTS, {
    onError: (error) => handleError(error, 'Failed to update loyalty points'),
  });

  // Callbacks
  const refetch = useCallback(async () => {
    try {
      await refetchQuery();
    } catch (error) {
      handleError(error as Error, 'Failed to refresh customers');
    }
  }, [refetchQuery, handleError]);

  const fetchMore = useCallback(async () => {
    if (!hasNextPage || loading) return;

    try {
      await fetchMoreQuery({
        variables: {
          query: {
            ...filters,
            page: (filters?.page || 1) + 1,
          },
        },
      });
    } catch (error) {
      handleError(error as Error, 'Failed to load more customers');
    }
  }, [fetchMoreQuery, filters, hasNextPage, loading, handleError]);

  const createCustomer = useCallback(async (input: CreateCustomerInput): Promise<Customer> => {
    try {
      const result = await createCustomerMutation({
        variables: { input },
      });

      return result.data.createCustomer;
    } catch (error) {
      handleError(error as Error, 'Failed to create customer');
      throw error;
    }
  }, [createCustomerMutation, handleError]);

  const updateCustomer = useCallback(async (
    id: string, 
    input: UpdateCustomerInput
  ): Promise<Customer> => {
    try {
      const result = await updateCustomerMutation({
        variables: { id, input },
        optimisticResponse: {
          updateCustomer: {
            __typename: 'Customer',
            id,
            ...input,
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.updateCustomer;
    } catch (error) {
      throw error;
    }
  }, [updateCustomerMutation]);

  const deleteCustomer = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteCustomerMutation({
        variables: { id },
        optimisticResponse: {
          deleteCustomer: true,
        },
        update: (cache) => {
          const cacheId = cache.identify({ __typename: 'Customer', id });
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
  }, [deleteCustomerMutation]);

  const updatePurchaseStats = useCallback(async (
    id: string, 
    orderValue: number, 
    orderDate?: Date
  ): Promise<boolean> => {
    try {
      await updatePurchaseStatsMutation({
        variables: { 
          id, 
          orderValue, 
          orderDate: orderDate?.toISOString() 
        },
      });

      return true;
    } catch (error) {
      throw error;
    }
  }, [updatePurchaseStatsMutation]);

  const updateLoyaltyPoints = useCallback(async (
    id: string, 
    pointsChange: number, 
    reason: string
  ): Promise<boolean> => {
    try {
      await updateLoyaltyPointsMutation({
        variables: { id, pointsChange, reason },
      });

      return true;
    } catch (error) {
      throw error;
    }
  }, [updateLoyaltyPointsMutation]);

  return {
    customers: data?.customers || [],
    loading,
    error: error ? new Error(error.message) : undefined,
    totalCount,
    hasNextPage,
    hasPreviousPage,
    refetch,
    fetchMore,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    updatePurchaseStats,
    updateLoyaltyPoints,
  };
}

/**
 * Hook for fetching a single customer by ID
 */
export function useCustomer(id: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_CUSTOMER, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch customer');
    },
  });
}

/**
 * Hook for finding customer by email
 */
export function useCustomerByEmail(email: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_CUSTOMER_BY_EMAIL, {
    variables: { email },
    skip: !currentTenant?.id || !email,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch customer by email');
    },
  });
}

/**
 * Hook for finding customer by phone
 */
export function useCustomerByPhone(phone: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_CUSTOMER_BY_PHONE, {
    variables: { phone },
    skip: !currentTenant?.id || !phone,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch customer by phone');
    },
  });
}

/**
 * Hook for customer search with debouncing
 */
export function useCustomerSearch(searchTerm: string, debounceMs = 300) {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  return useCustomers({
    search: debouncedSearchTerm,
    limit: 20,
  });
}

/**
 * Hook for customer statistics and metrics
 */
export function useCustomerStats() {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  const { data: allCustomers } = useQuery(GET_CUSTOMERS, {
    variables: { query: {} },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch customer stats');
    },
  });

  const customers = allCustomers?.customers || [];

  return {
    totalCustomers: customers.length,
    activeCustomers: customers.filter((c: Customer) => c.status === 'active').length,
    prospectCustomers: customers.filter((c: Customer) => c.status === 'prospect').length,
    blockedCustomers: customers.filter((c: Customer) => c.status === 'blocked').length,
    averageOrderValue: customers.reduce((sum: number, c: Customer) => sum + c.averageOrderValue, 0) / customers.length || 0,
    totalRevenue: customers.reduce((sum: number, c: Customer) => sum + c.totalSpent, 0),
    highValueCustomers: customers.filter((c: Customer) => c.totalSpent > 1000).length,
    loyaltyParticipants: customers.filter((c: Customer) => c.loyaltyPoints > 0).length,
    customersByTier: customers.reduce((acc: Record<string, number>, c: Customer) => {
      const tier = c.loyaltyTier || 'bronze';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {}),
  };
}