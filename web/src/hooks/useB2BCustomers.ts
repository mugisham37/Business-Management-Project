import { useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { 
  B2BCustomer, 
  B2BCustomerFilterInput,
  B2BCustomerMetrics,
  UseB2BCustomersResult 
} from '@/types/crm';
import {
  GET_B2B_CUSTOMER,
  GET_B2B_CUSTOMERS,
  GET_B2B_CUSTOMERS_BY_INDUSTRY,
  GET_B2B_CUSTOMERS_BY_SALES_REP,
  GET_B2B_CUSTOMERS_WITH_EXPIRING_CONTRACTS,
  GET_B2B_CUSTOMER_METRICS,
} from '@/graphql/queries/crm-queries';
import {
  CREATE_B2B_CUSTOMER,
  UPDATE_B2B_CUSTOMER,
  UPDATE_B2B_CUSTOMER_CREDIT_LIMIT,
  UPDATE_B2B_CUSTOMER_CREDIT_STATUS,
} from '@/graphql/mutations/crm-mutations';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from '@/hooks/useErrorHandler';

/**
 * Hook for managing B2B customers with comprehensive operations
 */
export function useB2BCustomers(filters?: B2BCustomerFilterInput): UseB2BCustomersResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  // Query B2B customers with filters
  const { 
    data, 
    loading, 
    error, 
    refetch 
  } = useQuery(GET_B2B_CUSTOMERS, {
    variables: { filter: filters },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B customers');
    },
  });

  // Query B2B customer metrics
  const { 
    data: metricsData,
    loading: metricsLoading,
    error: metricsError 
  } = useQuery(GET_B2B_CUSTOMER_METRICS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B customer metrics');
    },
  });

  // Mutations
  const [createCustomerMutation] = useMutation(CREATE_B2B_CUSTOMER, {
    onError: (error) => handleError(error, 'Failed to create B2B customer'),
    refetchQueries: [{ query: GET_B2B_CUSTOMERS, variables: { filter: filters } }],
    awaitRefetchQueries: true,
  });

  const [updateCustomerMutation] = useMutation(UPDATE_B2B_CUSTOMER, {
    onError: (error) => handleError(error, 'Failed to update B2B customer'),
  });

  const [updateCreditLimitMutation] = useMutation(UPDATE_B2B_CUSTOMER_CREDIT_LIMIT, {
    onError: (error) => handleError(error, 'Failed to update credit limit'),
  });

  const [updateCreditStatusMutation] = useMutation(UPDATE_B2B_CUSTOMER_CREDIT_STATUS, {
    onError: (error) => handleError(error, 'Failed to update credit status'),
  });

  // Callbacks
  const createCustomer = useCallback(async (input: any): Promise<B2BCustomer> => {
    try {
      const result = await createCustomerMutation({
        variables: { input },
        optimisticResponse: {
          createB2BCustomer: {
            __typename: 'B2BCustomer',
            id: `temp-${Date.now()}`,
            ...input,
            availableCredit: input.creditLimit || 0,
            outstandingBalance: 0,
            contractExpiringSoon: false,
            daysUntilContractExpiry: -1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.createB2BCustomer;
    } catch (error) {
      throw error;
    }
  }, [createCustomerMutation]);

  const updateCustomer = useCallback(async (
    id: string, 
    input: any
  ): Promise<B2BCustomer> => {
    try {
      const result = await updateCustomerMutation({
        variables: { id, input },
        optimisticResponse: {
          updateB2BCustomer: {
            __typename: 'B2BCustomer',
            id,
            ...input,
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          if (data?.updateB2BCustomer) {
            cache.modify({
              id: cache.identify(data.updateB2BCustomer),
              fields: {
                ...input,
                updatedAt: () => new Date().toISOString(),
              },
            });
          }
        },
      });

      return result.data.updateB2BCustomer;
    } catch (error) {
      throw error;
    }
  }, [updateCustomerMutation]);

  const updateCreditLimit = useCallback(async (
    id: string, 
    creditLimit: number, 
    reason: string
  ): Promise<boolean> => {
    try {
      await updateCreditLimitMutation({
        variables: { id, creditLimit, reason },
      });

      return true;
    } catch (error) {
      throw error;
    }
  }, [updateCreditLimitMutation]);

  const updateCreditStatus = useCallback(async (
    id: string, 
    status: string, 
    reason: string
  ): Promise<boolean> => {
    try {
      await updateCreditStatusMutation({
        variables: { id, status, reason },
      });

      return true;
    } catch (error) {
      throw error;
    }
  }, [updateCreditStatusMutation]);

  const getCustomersByIndustry = useCallback(async (industry: string): Promise<B2BCustomer[]> => {
    try {
      const { data } = await refetch({
        query: GET_B2B_CUSTOMERS_BY_INDUSTRY,
        variables: { industry },
      });

      return data.b2bCustomersByIndustry;
    } catch (error) {
      throw error;
    }
  }, []);

  const getCustomersBySalesRep = useCallback(async (salesRepId: string): Promise<B2BCustomer[]> => {
    try {
      const { data } = await refetch({
        query: GET_B2B_CUSTOMERS_BY_SALES_REP,
        variables: { salesRepId },
      });

      return data.b2bCustomersBySalesRep;
    } catch (error) {
      throw error;
    }
  }, []);

  const getCustomersWithExpiringContracts = useCallback(async (days = 30): Promise<B2BCustomer[]> => {
    try {
      const { data } = await refetch({
        query: GET_B2B_CUSTOMERS_WITH_EXPIRING_CONTRACTS,
        variables: { days },
      });

      return data.b2bCustomersWithExpiringContracts;
    } catch (error) {
      throw error;
    }
  }, []);

  return {
    customers: data?.b2bCustomers || [],
    loading: loading || metricsLoading,
    error: error || metricsError || undefined,
    metrics: metricsData?.b2bCustomerMetrics,
    createCustomer,
    updateCustomer,
    updateCreditLimit,
    updateCreditStatus,
    getCustomersByIndustry,
    getCustomersBySalesRep,
    getCustomersWithExpiringContracts,
  };
}

/**
 * Hook for fetching a single B2B customer by ID
 */
export function useB2BCustomer(id: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_B2B_CUSTOMER, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B customer');
    },
  });
}

/**
 * Hook for B2B customer metrics and analytics
 */
export function useB2BCustomerMetrics() {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_B2B_CUSTOMER_METRICS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 300000, // Refresh every 5 minutes
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B customer metrics');
    },
  });
}

/**
 * Hook for B2B customers by industry
 */
export function useB2BCustomersByIndustry(industry: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_B2B_CUSTOMERS_BY_INDUSTRY, {
    variables: { industry },
    skip: !currentTenant?.id || !industry,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B customers by industry');
    },
  });
}

/**
 * Hook for B2B customers by sales representative
 */
export function useB2BCustomersBySalesRep(salesRepId: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_B2B_CUSTOMERS_BY_SALES_REP, {
    variables: { salesRepId },
    skip: !currentTenant?.id || !salesRepId,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B customers by sales rep');
    },
  });
}

/**
 * Hook for B2B customers with expiring contracts
 */
export function useB2BCustomersWithExpiringContracts(days = 30) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_B2B_CUSTOMERS_WITH_EXPIRING_CONTRACTS, {
    variables: { days },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B customers with expiring contracts');
    },
  });
}

/**
 * Hook for B2B customer credit management
 */
export function useB2BCreditManagement() {
  const { handleError } = useErrorHandler();

  const [updateCreditLimitMutation] = useMutation(UPDATE_B2B_CUSTOMER_CREDIT_LIMIT, {
    onError: (error) => handleError(error, 'Failed to update credit limit'),
  });

  const [updateCreditStatusMutation] = useMutation(UPDATE_B2B_CUSTOMER_CREDIT_STATUS, {
    onError: (error) => handleError(error, 'Failed to update credit status'),
  });

  const updateCreditLimit = useCallback(async (
    customerId: string,
    newLimit: number,
    reason: string
  ) => {
    try {
      await updateCreditLimitMutation({
        variables: {
          id: customerId,
          creditLimit: newLimit,
          reason,
        },
      });
      return true;
    } catch (error) {
      throw error;
    }
  }, [updateCreditLimitMutation]);

  const updateCreditStatus = useCallback(async (
    customerId: string,
    status: string,
    reason: string
  ) => {
    try {
      await updateCreditStatusMutation({
        variables: {
          id: customerId,
          status,
          reason,
        },
      });
      return true;
    } catch (error) {
      throw error;
    }
  }, [updateCreditStatusMutation]);

  const calculateCreditUtilization = useCallback((customer: B2BCustomer) => {
    if (customer.creditLimit === 0) return 0;
    return (customer.outstandingBalance / customer.creditLimit) * 100;
  }, []);

  const getCreditRiskLevel = useCallback((customer: B2BCustomer) => {
    const utilization = calculateCreditUtilization(customer);
    
    if (utilization >= 90) return 'high';
    if (utilization >= 70) return 'medium';
    return 'low';
  }, [calculateCreditUtilization]);

  return {
    updateCreditLimit,
    updateCreditStatus,
    calculateCreditUtilization,
    getCreditRiskLevel,
  };
}