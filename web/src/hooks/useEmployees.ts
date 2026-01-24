/**
 * Employee Management Hooks
 * Complete hooks for employee operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useSubscription } from '@apollo/client';
import { 
  GET_EMPLOYEES, 
  GET_EMPLOYEE, 
  GET_EMPLOYEE_BY_NUMBER,
  GET_EMPLOYEE_ANALYTICS 
} from '@/graphql/queries/employee';
import { 
  CREATE_EMPLOYEE, 
  UPDATE_EMPLOYEE, 
  TERMINATE_EMPLOYEE 
} from '@/graphql/mutations/employee';
import { 
  EMPLOYEE_CREATED_SUBSCRIPTION, 
  EMPLOYEE_UPDATED_SUBSCRIPTION, 
  EMPLOYEE_TERMINATED_SUBSCRIPTION 
} from '@/graphql/subscriptions/employee';
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from './useGraphQLMutations';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { 
  Employee, 
  EmployeeConnection, 
  EmployeeQueryInput, 
  CreateEmployeeInput, 
  UpdateEmployeeInput,
  EmployeeAnalytics
} from '@/types/employee';

/**
 * Hook for managing employee list with real-time updates
 */
export function useEmployees(query?: EmployeeQueryInput) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [localQuery, setLocalQuery] = useState<EmployeeQueryInput>(query || {});

  // Query employees
  const { data, loading, error, refetch, fetchMore } = useQuery<{
    employees: EmployeeConnection;
  }>(GET_EMPLOYEES, {
    variables: { query: localQuery },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  // Create employee mutation
  const [createEmployeeMutation, { loading: creating }] = useCreateMutation(
    CREATE_EMPLOYEE,
    GET_EMPLOYEES,
    'employees',
    (variables: Record<string, unknown>) => ({
      id: `temp-${Date.now()}`,
      ...(variables.input as Record<string, unknown>),
      tenantId: currentTenant?.id || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isActive: true,
    })
  );

  // Update employee mutation
  const [updateEmployeeMutation, { loading: updating }] = useUpdateMutation(
    UPDATE_EMPLOYEE,
    GET_EMPLOYEES,
    'employees'
  );

  // Terminate employee mutation
  const [terminateEmployeeMutation, { loading: terminating }] = useDeleteMutation(
    TERMINATE_EMPLOYEE,
    GET_EMPLOYEES,
    'employees'
  );

  // Real-time subscriptions
  useSubscription(EMPLOYEE_CREATED_SUBSCRIPTION, {
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData?.data?.employeeCreated) {
        // Cache will be updated automatically by useCreateMutation
        console.log('Employee created:', subscriptionData.data.employeeCreated);
      }
    },
  });

  useSubscription(EMPLOYEE_UPDATED_SUBSCRIPTION, {
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData?.data?.employeeUpdated) {
        // Cache will be updated automatically by useUpdateMutation
        console.log('Employee updated:', subscriptionData.data.employeeUpdated);
      }
    },
  });

  useSubscription(EMPLOYEE_TERMINATED_SUBSCRIPTION, {
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData?.data?.employeeTerminated) {
        // Cache will be updated automatically by useDeleteMutation
        console.log('Employee terminated:', subscriptionData.data.employeeTerminated);
      }
    },
  });

  // Actions
  const createEmployee = useCallback(async (input: CreateEmployeeInput) => {
    try {
      const result = await createEmployeeMutation({ variables: { input } });
      return result.data?.createEmployee;
    } catch (error) {
      console.error('Failed to create employee:', error);
      throw error;
    }
  }, [createEmployeeMutation]);

  const updateEmployee = useCallback(async (id: string, input: UpdateEmployeeInput) => {
    try {
      const result = await updateEmployeeMutation({ variables: { id, input } });
      return result.data?.updateEmployee;
    } catch (error) {
      console.error('Failed to update employee:', error);
      throw error;
    }
  }, [updateEmployeeMutation]);

  const terminateEmployee = useCallback(async (id: string) => {
    try {
      const result = await terminateEmployeeMutation({ variables: { id } });
      return result.data?.terminateEmployee;
    } catch (error) {
      console.error('Failed to terminate employee:', error);
      throw error;
    }
  }, [terminateEmployeeMutation]);

  const updateQuery = useCallback((newQuery: Partial<EmployeeQueryInput>) => {
    setLocalQuery(prev => ({ ...prev, ...newQuery }));
  }, []);

  const loadMore = useCallback(async () => {
    if (!data?.employees || data.employees.page >= data.employees.totalPages) {
      return;
    }

    try {
      await fetchMore({
        variables: {
          query: {
            ...localQuery,
            page: data.employees.page + 1,
          },
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.employees) return prev;

          return {
            employees: {
              ...fetchMoreResult.employees,
              employees: [
                ...prev.employees.employees,
                ...fetchMoreResult.employees.employees,
              ],
            },
          };
        },
      });
    } catch (error) {
      console.error('Failed to load more employees:', error);
    }
  }, [data, localQuery, fetchMore]);

  // Computed values
  const employees = useMemo(() => data?.employees?.employees || [], [data]);
  const totalCount = useMemo(() => data?.employees?.total || 0, [data]);
  const hasMore = useMemo(() => {
    if (!data?.employees) return false;
    return data.employees.page < data.employees.totalPages;
  }, [data]);

  return {
    // Data
    employees,
    totalCount,
    hasMore,
    
    // Loading states
    loading,
    creating,
    updating,
    terminating,
    
    // Error state
    error,
    
    // Actions
    createEmployee,
    updateEmployee,
    terminateEmployee,
    updateQuery,
    loadMore,
    refetch,
    
    // Query state
    query: localQuery,
  };
}

/**
 * Hook for managing a single employee
 */
export function useEmployee(id?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const { data, loading, error, refetch } = useQuery<{ employee: Employee }>(
    GET_EMPLOYEE,
    {
      variables: { id: id! },
      skip: !id || !currentTenant?.id,
      errorPolicy: 'all',
    }
  );

  const employee = useMemo(() => data?.employee, [data]);

  return {
    employee,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for finding employee by employee number
 */
export function useEmployeeByNumber(employeeNumber?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const { data, loading, error, refetch } = useQuery<{ employeeByNumber: Employee }>(
    GET_EMPLOYEE_BY_NUMBER,
    {
      variables: { employeeNumber: employeeNumber! },
      skip: !employeeNumber || !currentTenant?.id,
      errorPolicy: 'all',
    }
  );

  const employee = useMemo(() => data?.employeeByNumber, [data]);

  return {
    employee,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for employee analytics
 */
export function useEmployeeAnalytics(employeeId?: string, startDate?: Date, endDate?: Date) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const { data, loading, error, refetch } = useQuery<{ employeeAnalytics: EmployeeAnalytics }>(
    GET_EMPLOYEE_ANALYTICS,
    {
      variables: { 
        employeeId: employeeId!, 
        startDate: startDate!, 
        endDate: endDate! 
      },
      skip: !employeeId || !startDate || !endDate || !currentTenant?.id,
      errorPolicy: 'all',
    }
  );

  const analytics = useMemo(() => data?.employeeAnalytics, [data]);

  return {
    analytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for employee search and filtering
 */
export function useEmployeeSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Partial<EmployeeQueryInput>>({});
  
  const query = useMemo(() => ({
    ...filters,
    ...(searchTerm && { search: searchTerm }),
  }), [searchTerm, filters]);

  const { employees, loading, error, totalCount, refetch } = useEmployees(query);

  const updateFilter = useCallback((key: keyof EmployeeQueryInput, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchTerm('');
  }, []);

  return {
    // Data
    employees,
    totalCount,
    
    // Search state
    searchTerm,
    filters,
    query,
    
    // Loading/error
    loading,
    error,
    
    // Actions
    setSearchTerm,
    updateFilter,
    clearFilters,
    refetch,
  };
}

/**
 * Hook for employee hierarchy (managers and direct reports)
 */
export function useEmployeeHierarchy(employeeId?: string) {
  const { employee, loading, error } = useEmployee(employeeId);

  const manager = useMemo(() => employee?.manager, [employee]);
  const directReports = useMemo(() => employee?.directReports || [], [employee]);

  return {
    employee,
    manager,
    directReports,
    loading,
    error,
  };
}