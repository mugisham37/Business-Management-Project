/**
 * Inventory Management Hooks
 * Complete set of hooks for inventory operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  InventoryFilterInput,
  CreateInventoryLevelInput,
  UpdateInventoryLevelInput,
  AdjustInventoryInput,
  TransferInventoryInput,
  ReserveInventoryInput,
  OffsetPaginationArgs,
  StockStatus,
  InventoryAlert,
} from '@/types/inventory';

// GraphQL Operations
import {
  GET_INVENTORY_LEVEL,
  GET_INVENTORY_LEVELS,
  GET_INVENTORY_HISTORY,
  GET_INVENTORY_SUMMARY,
  GET_LOW_STOCK_ITEMS,
  GET_OUT_OF_STOCK_ITEMS,
} from '@/graphql/queries/inventory-queries';

import {
  CREATE_INVENTORY_LEVEL,
  UPDATE_INVENTORY_LEVEL,
  ADJUST_INVENTORY,
  TRANSFER_INVENTORY,
  RESERVE_INVENTORY,
  RELEASE_RESERVATION,
} from '@/graphql/mutations/inventory-mutations';

import {
  INVENTORY_CHANGED,
  LOW_STOCK_ALERT,
  INVENTORY_MOVEMENT,
} from '@/graphql/subscriptions/inventory-subscriptions';

// ===== INVENTORY LEVEL HOOKS =====

/**
 * Hook for managing a single inventory level
 */
export function useInventoryLevel(productId: string, locationId: string, variantId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_INVENTORY_LEVEL, {
    variables: { productId, locationId, variantId },
    skip: !currentTenant?.id || !productId || !locationId,
    errorPolicy: 'all',
  });

  const [createInventoryLevel] = useMutation(CREATE_INVENTORY_LEVEL);
  const [updateInventoryLevel] = useMutation(UPDATE_INVENTORY_LEVEL);
  const [adjustInventory] = useMutation(ADJUST_INVENTORY);

  const inventoryLevel = data?.getInventory;

  const create = useCallback(async (input: CreateInventoryLevelInput) => {
    try {
      const result = await createInventoryLevel({
        variables: { input },
        refetchQueries: [
          { query: GET_INVENTORY_LEVEL, variables: { productId, locationId, variantId } },
        ],
      });
      return result.data?.createInventoryLevel;
    } catch (error) {
      console.error('Failed to create inventory level:', error);
      throw error;
    }
  }, [createInventoryLevel, productId, locationId, variantId]);

  const update = useCallback(async (input: UpdateInventoryLevelInput) => {
    if (!inventoryLevel?.id) return null;
    
    try {
      const result = await updateInventoryLevel({
        variables: { id: inventoryLevel.id, input },
        optimisticResponse: {
          updateInventoryLevel: {
            ...inventoryLevel,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateInventoryLevel;
    } catch (error) {
      console.error('Failed to update inventory level:', error);
      throw error;
    }
  }, [updateInventoryLevel, inventoryLevel]);

  const adjust = useCallback(async (input: AdjustInventoryInput) => {
    try {
      const result = await adjustInventory({
        variables: { input },
        refetchQueries: [
          { query: GET_INVENTORY_LEVEL, variables: { productId, locationId, variantId } },
        ],
      });
      return result.data?.adjustInventory;
    } catch (error) {
      console.error('Failed to adjust inventory:', error);
      throw error;
    }
  }, [adjustInventory, productId, locationId, variantId]);

  const stockStatus = useMemo((): StockStatus => {
    if (!inventoryLevel) {
      return { status: 'out_of_stock', level: 0, reorderPoint: 0 };
    }

    const { currentLevel, reorderPoint, maxStockLevel } = inventoryLevel;
    
    if (currentLevel <= 0) {
      return { status: 'out_of_stock', level: currentLevel, reorderPoint };
    }
    
    if (currentLevel <= reorderPoint) {
      return { status: 'low_stock', level: currentLevel, reorderPoint };
    }
    
    if (maxStockLevel && currentLevel > maxStockLevel) {
      return { status: 'overstocked', level: currentLevel, reorderPoint };
    }
    
    return { status: 'in_stock', level: currentLevel, reorderPoint };
  }, [inventoryLevel]);

  return {
    inventoryLevel,
    stockStatus,
    loading,
    error,
    refetch,
    create,
    update,
    adjust,
  };
}

/**
 * Hook for managing multiple inventory levels
 */
export function useInventoryLevels(
  filter?: InventoryFilterInput,
  pagination?: OffsetPaginationArgs
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_INVENTORY_LEVELS, {
    variables: { filter, pagination },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const inventoryLevels = data?.getInventoryLevels || [];

  const loadMore = useCallback(async () => {
    if (!data?.getInventoryLevels?.length) return;

    try {
      await fetchMore({
        variables: {
          filter,
          pagination: {
            ...pagination,
            offset: (pagination?.offset || 0) + (pagination?.limit || 20),
          },
        },
      });
    } catch (error) {
      console.error('Failed to load more inventory levels:', error);
    }
  }, [fetchMore, filter, pagination, data]);

  return {
    inventoryLevels,
    loading,
    error,
    refetch,
    loadMore,
  };
}

/**
 * Hook for inventory movements/history
 */
export function useInventoryHistory(productId: string, locationId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_INVENTORY_HISTORY, {
    variables: { productId, locationId },
    skip: !currentTenant?.id || !productId,
    errorPolicy: 'all',
  });

  const movements = data?.getInventoryHistory || [];

  return {
    movements,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for inventory transfers
 */
export function useInventoryTransfer() {
  const [transferInventory, { loading }] = useMutation(TRANSFER_INVENTORY);

  const transfer = useCallback(async (input: TransferInventoryInput) => {
    try {
      const result = await transferInventory({
        variables: { input },
        refetchQueries: [
          { query: GET_INVENTORY_LEVELS, variables: {} },
        ],
      });
      return result.data?.transferInventory;
    } catch (error) {
      console.error('Failed to transfer inventory:', error);
      throw error;
    }
  }, [transferInventory]);

  return {
    transfer,
    loading,
  };
}

/**
 * Hook for inventory reservations
 */
export function useInventoryReservation() {
  const [reserveInventory, { loading: reserveLoading }] = useMutation(RESERVE_INVENTORY);
  const [releaseReservation, { loading: releaseLoading }] = useMutation(RELEASE_RESERVATION);

  const reserve = useCallback(async (input: ReserveInventoryInput) => {
    try {
      const result = await reserveInventory({
        variables: { input },
        refetchQueries: [
          { query: GET_INVENTORY_LEVELS, variables: {} },
        ],
      });
      return result.data?.reserveInventory;
    } catch (error) {
      console.error('Failed to reserve inventory:', error);
      throw error;
    }
  }, [reserveInventory]);

  const release = useCallback(async (reservationId: string) => {
    try {
      const result = await releaseReservation({
        variables: { reservationId },
        refetchQueries: [
          { query: GET_INVENTORY_LEVELS, variables: {} },
        ],
      });
      return result.data?.releaseReservation;
    } catch (error) {
      console.error('Failed to release reservation:', error);
      throw error;
    }
  }, [releaseReservation]);

  return {
    reserve,
    release,
    loading: reserveLoading || releaseLoading,
  };
}

/**
 * Hook for inventory summary and dashboard data
 */
export function useInventorySummary(locationId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_INVENTORY_SUMMARY, {
    variables: { locationId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 60000, // Poll every minute
  });

  const summary = data?.inventorySummary;

  return {
    summary,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for low stock items
 */
export function useLowStockItems(locationId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_LOW_STOCK_ITEMS, {
    variables: { locationId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const lowStockItems = data?.lowStockItems || [];

  return {
    lowStockItems,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for out of stock items
 */
export function useOutOfStockItems(locationId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_OUT_OF_STOCK_ITEMS, {
    variables: { locationId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const outOfStockItems = data?.outOfStockItems || [];

  return {
    outOfStockItems,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for real-time inventory updates
 */
export function useInventorySubscriptions(productId?: string, locationId?: string) {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);

  // Subscribe to inventory changes
  const { data: inventoryChangeData } = useSubscription(INVENTORY_CHANGED, {
    variables: { productId, locationId },
    onData: ({ data }) => {
      if (data?.data?.inventoryChanged) {
        // Handle inventory change event
        console.log('Inventory changed:', data.data.inventoryChanged);
      }
    },
  });

  // Subscribe to low stock alerts
  const { data: lowStockData } = useSubscription(LOW_STOCK_ALERT, {
    variables: { locationId },
    onData: ({ data }) => {
      if (data?.data?.lowStockAlert) {
        const alert: InventoryAlert = {
          id: `low-stock-${data.data.lowStockAlert.id}`,
          type: 'low_stock',
          severity: 'warning',
          productId: data.data.lowStockAlert.productId,
          locationId: data.data.lowStockAlert.locationId,
          message: `Low stock alert for ${data.data.lowStockAlert.product?.name}`,
          data: data.data.lowStockAlert,
          createdAt: new Date(),
        };
        setAlerts(prev => [alert, ...prev.slice(0, 49)]);
      }
    },
  });

  // Subscribe to inventory movements
  const { data: movementData } = useSubscription(INVENTORY_MOVEMENT, {
    variables: { productId, locationId },
    onData: ({ data }) => {
      if (data?.data?.inventoryMovement) {
        // Handle inventory movement event
        console.log('Inventory movement:', data.data.inventoryMovement);
      }
    },
  });

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    alerts,
    dismissAlert,
    clearAlerts,
    inventoryChangeData: inventoryChangeData?.inventoryChanged,
    lowStockData: lowStockData?.lowStockAlert,
    movementData: movementData?.inventoryMovement,
  };
}

/**
 * Combined inventory management hook
 */
export function useInventoryManagement(locationId?: string) {
  const summary = useInventorySummary(locationId);
  const lowStock = useLowStockItems(locationId);
  const outOfStock = useOutOfStockItems(locationId);
  const subscriptions = useInventorySubscriptions(undefined, locationId);
  const transfer = useInventoryTransfer();
  const reservation = useInventoryReservation();

  return {
    summary: summary.summary,
    lowStockItems: lowStock.lowStockItems,
    outOfStockItems: outOfStock.outOfStockItems,
    alerts: subscriptions.alerts,
    loading: summary.loading || lowStock.loading || outOfStock.loading,
    error: summary.error || lowStock.error || outOfStock.error,
    
    // Actions
    transfer: transfer.transfer,
    reserve: reservation.reserve,
    release: reservation.release,
    dismissAlert: subscriptions.dismissAlert,
    clearAlerts: subscriptions.clearAlerts,
    
    // Refresh functions
    refresh: () => {
      summary.refetch();
      lowStock.refetch();
      outOfStock.refetch();
    },
  };
}