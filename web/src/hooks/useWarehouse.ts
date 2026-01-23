/**
 * Warehouse Management Hooks
 * Complete set of hooks for warehouse operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  Warehouse,
  WarehouseCapacity,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseFilterInput,
  InitializeWarehouseInput,
  UpdateWarehouseCapacityInput,
  WarehouseConfigurationInput,
  OffsetPaginationArgs,
  WarehouseConnection,
  WarehouseError,
} from '@/types/warehouse';

// GraphQL Operations
import {
  GET_WAREHOUSE,
  GET_WAREHOUSES,
  GET_WAREHOUSE_CAPACITY,
  GET_WAREHOUSES_BY_LOCATION,
} from '@/graphql/queries/warehouse-queries';

import {
  CREATE_WAREHOUSE,
  UPDATE_WAREHOUSE,
  DELETE_WAREHOUSE,
  INITIALIZE_WAREHOUSE,
  UPDATE_WAREHOUSE_CAPACITY,
  UPDATE_WAREHOUSE_CONFIGURATION,
  UPDATE_WAREHOUSE_OPERATING_HOURS,
  OPTIMIZE_WAREHOUSE_LAYOUT,
  UPDATE_WAREHOUSE_PERFORMANCE_METRICS,
} from '@/graphql/mutations/warehouse-mutations';

import {
  WAREHOUSE_UPDATED,
  WAREHOUSE_CAPACITY_UPDATED,
} from '@/graphql/subscriptions/warehouse-subscriptions';

// ===== SINGLE WAREHOUSE HOOK =====

/**
 * Hook for managing a single warehouse
 */
export function useWarehouse(warehouseId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_WAREHOUSE, {
    variables: { id: warehouseId },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
  });

  const [updateWarehouse] = useMutation(UPDATE_WAREHOUSE);
  const [deleteWarehouse] = useMutation(DELETE_WAREHOUSE);
  const [initializeWarehouse] = useMutation(INITIALIZE_WAREHOUSE);
  const [updateCapacity] = useMutation(UPDATE_WAREHOUSE_CAPACITY);
  const [updateConfiguration] = useMutation(UPDATE_WAREHOUSE_CONFIGURATION);

  const warehouse = data?.warehouse;

  const update = useCallback(async (input: UpdateWarehouseInput) => {
    if (!warehouse?.id) return null;
    
    try {
      const result = await updateWarehouse({
        variables: { id: warehouse.id, input },
        optimisticResponse: {
          updateWarehouse: {
            ...warehouse,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateWarehouse;
    } catch (error) {
      console.error('Failed to update warehouse:', error);
      throw error;
    }
  }, [updateWarehouse, warehouse]);

  const remove = useCallback(async () => {
    if (!warehouse?.id) return false;
    
    try {
      await deleteWarehouse({
        variables: { id: warehouse.id },
        update: (cache) => {
          cache.evict({ id: cache.identify(warehouse) });
          cache.gc();
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to delete warehouse:', error);
      throw error;
    }
  }, [deleteWarehouse, warehouse]);

  const initialize = useCallback(async (input: InitializeWarehouseInput) => {
    try {
      const result = await initializeWarehouse({
        variables: { input },
        refetchQueries: [
          { query: GET_WAREHOUSE, variables: { id: input.warehouseId } },
        ],
      });
      return result.data?.initializeWarehouse;
    } catch (error) {
      console.error('Failed to initialize warehouse:', error);
      throw error;
    }
  }, [initializeWarehouse]);

  const updateWarehouseCapacity = useCallback(async (input: UpdateWarehouseCapacityInput) => {
    try {
      const result = await updateCapacity({
        variables: { input },
        refetchQueries: [
          { query: GET_WAREHOUSE_CAPACITY, variables: { warehouseId: input.warehouseId } },
        ],
      });
      return result.data?.updateWarehouseCapacity;
    } catch (error) {
      console.error('Failed to update warehouse capacity:', error);
      throw error;
    }
  }, [updateCapacity]);

  const updateWarehouseConfiguration = useCallback(async (input: WarehouseConfigurationInput) => {
    if (!warehouse?.id) return null;
    
    try {
      const result = await updateConfiguration({
        variables: { warehouseId: warehouse.id, input },
        optimisticResponse: {
          updateWarehouseConfiguration: {
            ...warehouse,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateWarehouseConfiguration;
    } catch (error) {
      console.error('Failed to update warehouse configuration:', error);
      throw error;
    }
  }, [updateConfiguration, warehouse]);

  // Real-time subscription
  useSubscription(WAREHOUSE_UPDATED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.warehouseUpdated) {
        // Apollo will automatically update the cache
        console.log('Warehouse updated via subscription:', subscriptionData.data.warehouseUpdated);
      }
    },
  });

  return {
    warehouse,
    loading,
    error,
    refetch,
    update,
    remove,
    initialize,
    updateCapacity: updateWarehouseCapacity,
    updateConfiguration: updateWarehouseConfiguration,
  };
}

// ===== MULTIPLE WAREHOUSES HOOK =====

/**
 * Hook for managing multiple warehouses with pagination and filtering
 */
export function useWarehouses(
  paginationArgs?: OffsetPaginationArgs,
  filter?: WarehouseFilterInput
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_WAREHOUSES, {
    variables: {
      first: paginationArgs?.limit || 20,
      after: null,
      filter,
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const [createWarehouse] = useMutation(CREATE_WAREHOUSE);

  const warehouses = data?.warehouses?.edges?.map(edge => edge.node) || [];
  const pageInfo = data?.warehouses?.pageInfo;
  const totalCount = data?.warehouses?.totalCount || 0;

  const create = useCallback(async (input: CreateWarehouseInput) => {
    try {
      const result = await createWarehouse({
        variables: { input },
        update: (cache, { data: mutationData }) => {
          if (mutationData?.createWarehouse) {
            const existingWarehouses = cache.readQuery({
              query: GET_WAREHOUSES,
              variables: { first: 20, filter },
            });

            if (existingWarehouses) {
              cache.writeQuery({
                query: GET_WAREHOUSES,
                variables: { first: 20, filter },
                data: {
                  warehouses: {
                    ...existingWarehouses.warehouses,
                    edges: [
                      {
                        node: mutationData.createWarehouse,
                        cursor: `warehouse-${Date.now()}`,
                        __typename: 'WarehouseEdge',
                      },
                      ...existingWarehouses.warehouses.edges,
                    ],
                    totalCount: existingWarehouses.warehouses.totalCount + 1,
                  },
                },
              });
            }
          }
        },
      });
      return result.data?.createWarehouse;
    } catch (error) {
      console.error('Failed to create warehouse:', error);
      throw error;
    }
  }, [createWarehouse, filter]);

  const loadMore = useCallback(async () => {
    if (!pageInfo?.hasNextPage || loading) return;

    try {
      await fetchMore({
        variables: {
          after: pageInfo.endCursor,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult) return prev;

          return {
            warehouses: {
              ...fetchMoreResult.warehouses,
              edges: [
                ...prev.warehouses.edges,
                ...fetchMoreResult.warehouses.edges,
              ],
            },
          };
        },
      });
    } catch (error) {
      console.error('Failed to load more warehouses:', error);
      throw error;
    }
  }, [fetchMore, pageInfo, loading]);

  return {
    warehouses,
    loading,
    error,
    pageInfo,
    totalCount,
    refetch,
    create,
    loadMore,
  };
}

// ===== WAREHOUSE CAPACITY HOOK =====

/**
 * Hook for managing warehouse capacity
 */
export function useWarehouseCapacity(warehouseId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_WAREHOUSE_CAPACITY, {
    variables: { warehouseId },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
    pollInterval: 30000, // Poll every 30 seconds for capacity updates
  });

  const capacity = data?.warehouseCapacity;

  // Real-time subscription for capacity updates
  useSubscription(WAREHOUSE_CAPACITY_UPDATED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.warehouseCapacityUpdated) {
        console.log('Warehouse capacity updated via subscription:', subscriptionData.data.warehouseCapacityUpdated);
      }
    },
  });

  const utilizationLevel = useMemo(() => {
    if (!capacity?.utilizationPercentage) return 'low';
    
    if (capacity.utilizationPercentage >= 90) return 'critical';
    if (capacity.utilizationPercentage >= 75) return 'high';
    if (capacity.utilizationPercentage >= 50) return 'medium';
    return 'low';
  }, [capacity?.utilizationPercentage]);

  const isNearCapacity = useMemo(() => {
    return (capacity?.utilizationPercentage || 0) >= 85;
  }, [capacity?.utilizationPercentage]);

  const availableCapacityPercentage = useMemo(() => {
    return 100 - (capacity?.utilizationPercentage || 0);
  }, [capacity?.utilizationPercentage]);

  return {
    capacity,
    loading,
    error,
    refetch,
    utilizationLevel,
    isNearCapacity,
    availableCapacityPercentage,
  };
}

// ===== WAREHOUSES BY LOCATION HOOK =====

/**
 * Hook for getting warehouses by location
 */
export function useWarehousesByLocation(locationId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_WAREHOUSES_BY_LOCATION, {
    variables: { locationId },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
  });

  const warehouses = data?.warehousesByLocation || [];

  return {
    warehouses,
    loading,
    error,
    refetch,
  };
}

// ===== WAREHOUSE MANAGEMENT HOOK =====

/**
 * Combined hook for comprehensive warehouse management
 */
export function useWarehouseManagement() {
  const apolloClient = useApolloClient();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  // Get all warehouses
  const {
    warehouses,
    loading: warehousesLoading,
    error: warehousesError,
    create: createWarehouse,
    refetch: refetchWarehouses,
  } = useWarehouses();

  // Get selected warehouse details
  const {
    warehouse: selectedWarehouse,
    loading: selectedWarehouseLoading,
    error: selectedWarehouseError,
    update: updateWarehouse,
    remove: deleteWarehouse,
    initialize: initializeWarehouse,
    updateCapacity,
    updateConfiguration,
  } = useWarehouse(selectedWarehouseId || '');

  // Get selected warehouse capacity
  const {
    capacity: selectedWarehouseCapacity,
    loading: capacityLoading,
    utilizationLevel,
    isNearCapacity,
  } = useWarehouseCapacity(selectedWarehouseId || '');

  const selectWarehouse = useCallback((warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedWarehouseId(null);
  }, []);

  // Get warehouse statistics
  const warehouseStats = useMemo(() => {
    const totalWarehouses = warehouses.length;
    const activeWarehouses = warehouses.filter(w => w.status === 'ACTIVE').length;
    const inactiveWarehouses = warehouses.filter(w => w.status === 'INACTIVE').length;
    const maintenanceWarehouses = warehouses.filter(w => w.status === 'MAINTENANCE').length;

    const totalCapacity = warehouses.reduce((sum, w) => sum + (w.maxCapacityUnits || 0), 0);
    const usedCapacity = warehouses.reduce((sum, w) => sum + (w.currentCapacityUnits || 0), 0);
    const overallUtilization = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

    return {
      totalWarehouses,
      activeWarehouses,
      inactiveWarehouses,
      maintenanceWarehouses,
      totalCapacity,
      usedCapacity,
      overallUtilization,
    };
  }, [warehouses]);

  // Clear cache for warehouse data
  const clearCache = useCallback(() => {
    apolloClient.cache.evict({ fieldName: 'warehouses' });
    apolloClient.cache.evict({ fieldName: 'warehouse' });
    apolloClient.cache.evict({ fieldName: 'warehouseCapacity' });
    apolloClient.cache.gc();
  }, [apolloClient]);

  return {
    // Warehouses list
    warehouses,
    warehousesLoading,
    warehousesError,
    createWarehouse,
    refetchWarehouses,

    // Selected warehouse
    selectedWarehouse,
    selectedWarehouseId,
    selectedWarehouseLoading,
    selectedWarehouseError,
    selectWarehouse,
    clearSelection,
    updateWarehouse,
    deleteWarehouse,
    initializeWarehouse,

    // Capacity management
    selectedWarehouseCapacity,
    capacityLoading,
    utilizationLevel,
    isNearCapacity,
    updateCapacity,
    updateConfiguration,

    // Statistics
    warehouseStats,

    // Utilities
    clearCache,
  };
}

// ===== WAREHOUSE SEARCH HOOK =====

/**
 * Hook for searching warehouses with debounced input
 */
export function useWarehouseSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useState(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  });

  const filter: WarehouseFilterInput = useMemo(() => ({
    search: debouncedSearchTerm || undefined,
  }), [debouncedSearchTerm]);

  const {
    warehouses,
    loading,
    error,
    refetch,
  } = useWarehouses(undefined, filter);

  const updateSearchTerm = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  }, []);

  return {
    searchTerm,
    debouncedSearchTerm,
    warehouses,
    loading,
    error,
    updateSearchTerm,
    clearSearch,
    refetch,
  };
}

// ===== WAREHOUSE VALIDATION HOOK =====

/**
 * Hook for warehouse data validation
 */
export function useWarehouseValidation() {
  const validateWarehouseCode = useCallback((code: string): string | null => {
    if (!code) return 'Warehouse code is required';
    if (code.length < 2) return 'Warehouse code must be at least 2 characters';
    if (code.length > 50) return 'Warehouse code must be less than 50 characters';
    if (!/^[A-Z0-9_-]+$/i.test(code)) return 'Warehouse code can only contain letters, numbers, hyphens, and underscores';
    return null;
  }, []);

  const validateWarehouseName = useCallback((name: string): string | null => {
    if (!name) return 'Warehouse name is required';
    if (name.length < 1) return 'Warehouse name is required';
    if (name.length > 255) return 'Warehouse name must be less than 255 characters';
    return null;
  }, []);

  const validateCapacity = useCallback((capacity: number): string | null => {
    if (capacity < 0) return 'Capacity cannot be negative';
    if (capacity > 1000000) return 'Capacity seems unreasonably large';
    return null;
  }, []);

  const validateCreateWarehouseInput = useCallback((input: CreateWarehouseInput): Record<string, string> => {
    const errors: Record<string, string> = {};

    const codeError = validateWarehouseCode(input.warehouseCode);
    if (codeError) errors.warehouseCode = codeError;

    const nameError = validateWarehouseName(input.name);
    if (nameError) errors.name = nameError;

    if (!input.locationId) errors.locationId = 'Location is required';

    if (input.totalSquareFootage !== undefined) {
      const capacityError = validateCapacity(input.totalSquareFootage);
      if (capacityError) errors.totalSquareFootage = capacityError;
    }

    return errors;
  }, [validateWarehouseCode, validateWarehouseName, validateCapacity]);

  return {
    validateWarehouseCode,
    validateWarehouseName,
    validateCapacity,
    validateCreateWarehouseInput,
  };
}