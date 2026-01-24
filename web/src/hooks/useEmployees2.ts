/**
 * Employee Management Hook
 * Comprehensive hook for employee CRUD operations and data management
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useGraphQLMutations';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { errorLogger } from '@/lib/error-handling';

// GraphQL Operations
import {
  GET_EMPLOYEES,
  GET_EMPLOYEE,
  GET_ACTIVE_EMPLOYEES,
  GET_DEPARTMENTS,
  GET_POSITIONS,
  GET_MANAGERS,
} from '@/graphql/queries/employee';

import {
  CREATE_EMPLOYEE,
  UPDATE_EMPLOYEE,
  TERMINATE_EMPLOYEE,
  BULK_UPDATE_EMPLOYEES,
  IMPORT_EMPLOYEES,
  EXPORT_EMPLOYEES,
} from '@/graphql/mutations/employee';

import {
  EMPLOYEE_CREATED_SUBSCRIPTION,
  EMPLOYEE_UPDATED_SUBSCRIPTION,
  EMPLOYEE_TERMINATED_SUBSCRIPTION,
} from '@/graphql/subscriptions/employee';

// Types
import {
  Employee,
  EmployeeConnection,
  EmployeeQueryInput,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeFilters,
  EmployeeSortOptions,
  EmployeeExportOptions,
} from '@/types/employee';

interface UseEmployeesOptions {
  query?: EmployeeQueryInput;
  enableSubscriptions?: boolean;
  enableRealTimeUpdates?: boolean;
}

interface UseEmployeesReturn {
  // Data
  employees: Employee[];
  employee: Employee | null;
  connection: EmployeeConnection | null;
  departments: string[];
  positions: string[];
  managers: Employee[];
  activeEmployees: Employee[];
  
  // Loading states
  loading: boolean;
  employeeLoading: boolean;
  departmentsLoading: boolean;
  positionsLoading: boolean;
  managersLoading: boolean;
  
  // Error states
  error: Error | null;
  
  // Mutations
  createEmployee: (input: CreateEmployeeInput) => Promise<Employee>;
  updateEmployee: (id: string, input: UpdateEmployeeInput) => Promise<Employee>;
  terminateEmployee: (id: string) => Promise<boolean>;
  bulkUpdateEmployees: (updates: Array<{ id: string; input: UpdateEmployeeInput }>) => Promise<boolean>;
  
  // Data fetching
  fetchEmployee: (id: string) => Promise<Employee | null>;
  fetchEmployeeByNumber: (employeeNumber: string) => Promise<Employee | null>;
  refetchEmployees: () => Promise<void>;
  
  // Filtering and sorting
  setFilters: (filters: EmployeeFilters) => void;
  setSorting: (sort: EmployeeSortOptions) => void;
  clearFilters: () => void;
  
  // Pagination
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  
  // Import/Export
  importEmployees: (file: File, options?: Record<string, unknown>) => Promise<boolean>;
  exportEmployees: (options: EmployeeExportOptions) => Promise<string>;
  
  // Utilities
  searchEmployees: (searchTerm: string) => void;
  getEmployeesByDepartment: (department: string) => Employee[];
  getEmployeesByManager: (managerId: string) => Employee[];
  isManager: (employeeId: string) => boolean;
}

export function useEmployees(options: UseEmployeesOptions = {}): UseEmployeesReturn {
  const { query: initialQuery, enableSubscriptions = true, enableRealTimeUpdates = true } = options;
  
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [query, setQuery] = useState<EmployeeQueryInput>(initialQuery || { page: 1, limit: 20 });
  const [selectedEmployeeId] = useState<string | null>(null);
  
  // Main employees query
  const {
    data: employeesData,
    loading,
    error,
    refetch: refetchEmployeesQuery,
  } = useQuery(GET_EMPLOYEES, {
    variables: { query },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  // Wrap refetch to match interface signature
  const refetchEmployees = useCallback(async () => {
    await refetchEmployeesQuery();
  }, [refetchEmployeesQuery]);

  // Individual employee query
  const {
    data: employeeData,
    loading: employeeLoading,
    refetch: refetchEmployee,
  } = useQuery(GET_EMPLOYEE, {
    variables: { id: selectedEmployeeId || '' },
    skip: !selectedEmployeeId,
    errorPolicy: 'all',
  });

  // Supporting data queries
  const { data: departmentsData, loading: departmentsLoading } = useQuery(GET_DEPARTMENTS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const { data: positionsData, loading: positionsLoading } = useQuery(GET_POSITIONS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const { data: managersData, loading: managersLoading } = useQuery(GET_MANAGERS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const { data: activeEmployeesData } = useQuery(GET_ACTIVE_EMPLOYEES, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  // Mutations
  const [createEmployeeMutation] = useCreateMutation(
    CREATE_EMPLOYEE,
    GET_EMPLOYEES,
    'employees',
    (variables: Record<string, unknown>) => ({
      id: `temp-${Date.now()}`,
      ...(variables.input as Record<string, unknown>),
      __typename: 'Employee',
    })
  );

  const [updateEmployeeMutation] = useUpdateMutation(UPDATE_EMPLOYEE, GET_EMPLOYEES, 'employees');
  const [terminateEmployeeMutation] = useDeleteMutation(TERMINATE_EMPLOYEE, GET_EMPLOYEES, 'employees');
  const [bulkUpdateMutation] = useMutation(BULK_UPDATE_EMPLOYEES);
  const [importMutation] = useMutation(IMPORT_EMPLOYEES);
  const [exportMutation] = useMutation(EXPORT_EMPLOYEES);

  // Subscriptions
  useSubscription(EMPLOYEE_CREATED_SUBSCRIPTION, {
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data?.data?.employeeCreated && enableRealTimeUpdates) {
        refetchEmployees();
      }
    },
  });

  useSubscription(EMPLOYEE_UPDATED_SUBSCRIPTION, {
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data?.data?.employeeUpdated && enableRealTimeUpdates) {
        refetchEmployees();
        if (employeeData?.employee?.id === data.data.employeeUpdated.id) {
          refetchEmployee();
        }
      }
    },
  });

  useSubscription(EMPLOYEE_TERMINATED_SUBSCRIPTION, {
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data?.data?.employeeTerminated && enableRealTimeUpdates) {
        refetchEmployees();
      }
    },
  });

  // Computed values
  const employees = useMemo(() => {
    return employeesData?.employees?.employees || [];
  }, [employeesData]);

  const connection = useMemo(() => {
    return employeesData?.employees || null;
  }, [employeesData]);

  const departments = useMemo(() => {
    const depts = departmentsData?.employees?.employees
      ?.map((emp: Employee) => emp.department)
      .filter((dept: string | undefined): dept is string => Boolean(dept));
    return Array.from(new Set(depts ?? []));
  }, [departmentsData]);

  const positions = useMemo(() => {
    const pos = positionsData?.employees?.employees
      ?.map((emp: Employee) => emp.position)
      .filter((position: string | undefined): position is string => Boolean(position));
    return Array.from(new Set(pos ?? []));
  }, [positionsData]);

  const managers = useMemo(() => {
    return managersData?.employees?.employees?.filter((emp: Employee) => 
      emp.directReports && emp.directReports.length > 0
    ) || [];
  }, [managersData]);

  const activeEmployees = useMemo(() => {
    return activeEmployeesData?.employees?.employees || [];
  }, [activeEmployeesData]);

  // Mutation handlers
  const createEmployee = useCallback(async (input: CreateEmployeeInput): Promise<Employee> => {
    try {
      const result = await createEmployeeMutation({ input });
      return result.data?.createEmployee;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useEmployees',
        operationId: 'createEmployee',
      });
      throw error;
    }
  }, [createEmployeeMutation]);

  const updateEmployee = useCallback(async (id: string, input: UpdateEmployeeInput): Promise<Employee> => {
    try {
      const result = await updateEmployeeMutation({ id, input });
      return result.data?.updateEmployee;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useEmployees',
        operationId: 'updateEmployee',
      });
      throw error;
    }
  }, [updateEmployeeMutation]);

  const terminateEmployee = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await terminateEmployeeMutation(id as unknown as Record<string, unknown>);
      return result.data?.terminateEmployee?.success || false;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useEmployees',
        operationId: 'terminateEmployee',
      });
      throw error;
    }
  }, [terminateEmployeeMutation]);

  const bulkUpdateEmployees = useCallback(async (
    updates: Array<{ id: string; input: UpdateEmployeeInput }>
  ): Promise<boolean> => {
    try {
      const result = await bulkUpdateMutation({
        variables: { updates },
      });
      return result.data?.bulkUpdateEmployees?.success || false;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useEmployees',
        operationId: 'bulkUpdateEmployees',
      });
      throw error;
    }
  }, [bulkUpdateMutation]);

  // Data fetching
  const fetchEmployee = useCallback(async (id: string): Promise<Employee | null> => {
    try {
      const result = await refetchEmployee({ id });
      return result.data?.employee || null;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useEmployees',
        operationId: 'fetchEmployee',
      });
      return null;
    }
  }, [refetchEmployee]);

  const fetchEmployeeByNumber = useCallback(async (employeeNumber: string): Promise<Employee | null> => {
    try {
      const result = await refetchEmployee({ employeeNumber });
      return result.data?.employeeByNumber || null;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useEmployees',
        operationId: 'fetchEmployeeByNumber',
      });
      return null;
    }
  }, [refetchEmployee]);

  // Filtering and sorting
  const setFilters = useCallback((filters: EmployeeFilters) => {
    const newQuery: EmployeeQueryInput = {
      ...(filters.search !== undefined && { search: filters.search }),
      ...(filters.departments?.[0] !== undefined && { department: filters.departments[0] }),
      ...(filters.positions?.[0] !== undefined && { position: filters.positions[0] }),
      ...(filters.employmentStatuses?.[0] !== undefined && { employmentStatus: filters.employmentStatuses[0] }),
      ...(filters.employmentTypes?.[0] !== undefined && { employmentType: filters.employmentTypes[0] }),
      ...(filters.managers?.[0] !== undefined && { managerId: filters.managers[0] }),
      page: 1, // Reset to first page when filtering
    };
    setQuery(newQuery as EmployeeQueryInput);
  }, []);

  const setSorting = useCallback((sort: EmployeeSortOptions) => {
    setQuery(prev => ({
      ...prev,
      sortBy: sort.field as string,
      sortOrder: sort.direction,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery({ page: 1, limit: query.limit || 20 });
  }, [query.limit]);

  // Pagination
  const setPage = useCallback((page: number) => {
    setQuery(prev => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setQuery(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  // Import/Export
  const importEmployees = useCallback(async (file: File, options?: Record<string, unknown>): Promise<boolean> => {
    try {
      const result = await importMutation({
        variables: { file, options },
      });
      return result.data?.importEmployees?.success || false;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useEmployees',
        operationId: 'importEmployees',
      });
      throw error;
    }
  }, [importMutation]);

  const exportEmployees = useCallback(async (options: EmployeeExportOptions): Promise<string> => {
    try {
      const result = await exportMutation({
        variables: { 
          format: options.format,
          filters: query,
        },
      });
      return result.data?.exportEmployees?.downloadUrl || '';
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useEmployees',
        operationId: 'exportEmployees',
      });
      throw error;
    }
  }, [exportMutation, query]);

  // Utilities
  const searchEmployees = useCallback((searchTerm: string) => {
    setQuery(prev => ({ ...prev, search: searchTerm, page: 1 }));
  }, []);

  const getEmployeesByDepartment = useCallback((department: string): Employee[] => {
    return employees.filter((emp: Record<string, unknown>) => (emp as Record<string, string>).department === department);
  }, [employees]);

  const getEmployeesByManager = useCallback((managerId: string): Employee[] => {
    return employees.filter((emp: Record<string, unknown>) => (emp as Record<string, string>).managerId === managerId);
  }, [employees]);

  const isManager = useCallback((employeeId: string): boolean => {
    return managers.some((manager: Record<string, unknown>) => (manager as Record<string, string>).id === employeeId);
  }, [managers]);

  return {
    // Data
    employees,
    employee: employeeData?.employee || null,
    connection,
    departments: departments as string[],
    positions: positions as string[],
    managers,
    activeEmployees,
    
    // Loading states
    loading,
    employeeLoading,
    departmentsLoading,
    positionsLoading,
    managersLoading,
    
    // Error states
    error: error as Error | null,
    
    // Mutations
    createEmployee,
    updateEmployee,
    terminateEmployee,
    bulkUpdateEmployees,
    
    // Data fetching
    fetchEmployee,
    fetchEmployeeByNumber,
    refetchEmployees,
    
    // Filtering and sorting
    setFilters,
    setSorting,
    clearFilters,
    
    // Pagination
    setPage,
    setLimit,
    
    // Import/Export
    importEmployees,
    exportEmployees,
    
    // Utilities
    searchEmployees,
    getEmployeesByDepartment,
    getEmployeesByManager,
    isManager,
  };
}