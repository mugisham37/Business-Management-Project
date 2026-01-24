/**
 * Batch Tracking Hooks
 * Complete set of hooks for batch tracking operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  BatchTracking,
  BatchFilterInput,
  CreateBatchInput,
  UpdateBatchInput,
  OffsetPaginationArgs,
  BatchStatus,
} from '@/types/inventory';

// GraphQL Operations
import {
  GET_BATCH_TRACKING,
  GET_BATCH_TRACKINGS,
  GET_EXPIRING_BATCHES,
  GET_FIFO_BATCHES,
} from '@/graphql/queries/inventory-queries';

import {
  CREATE_BATCH_TRACKING,
  UPDATE_BATCH_TRACKING,
  DELETE_BATCH_TRACKING,
} from '@/graphql/mutations/inventory-mutations';

import {
  BATCH_EXPIRING_SOON,
  BATCH_STATUS_CHANGED,
} from '@/graphql/subscriptions/inventory-subscriptions';

/**
 * Hook for managing a single batch
 */
export function useBatchTracking(productId: string, locationId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_BATCH_TRACKING, {
    variables: { productId, locationId },
    skip: !currentTenant?.id || !productId || !locationId,
    errorPolicy: 'all',
  });

  const [updateBatchTracking] = useMutation(UPDATE_BATCH_TRACKING);
  const [deleteBatchTracking] = useMutation(DELETE_BATCH_TRACKING);

  const batchTracking = data?.batchTracking;

  const update = useCallback(async (input: UpdateBatchInput) => {
    if (!batchTracking?.id) return null;
    
    try {
      const result = await updateBatchTracking({
        variables: { id: batchTracking.id, input },
        optimisticResponse: {
          updateBatchTracking: {
            ...batchTracking,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateBatchTracking;
    } catch (error) {
      console.error('Failed to update batch tracking:', error);
      throw error;
    }
  }, [updateBatchTracking, batchTracking]);

  const remove = useCallback(async () => {
    if (!batchTracking?.id) return false;
    
    try {
      const result = await deleteBatchTracking({
        variables: { id: batchTracking.id },
        refetchQueries: [
          { query: GET_BATCH_TRACKINGS, variables: {} },
        ],
      });
      return result.data?.deleteBatchTracking;
    } catch (error) {
      console.error('Failed to delete batch tracking:', error);
      throw error;
    }
  }, [deleteBatchTracking, batchTracking]);

  const isExpired = useMemo(() => {
    if (!batchTracking?.expiryDate) return false;
    return new Date(batchTracking.expiryDate) < new Date();
  }, [batchTracking]);

  const isExpiringSoon = useMemo(() => {
    if (!batchTracking?.expiryDate) return false;
    const expiryDate = new Date(batchTracking.expiryDate);
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 7); // 7 days warning
    return expiryDate <= warningDate && expiryDate > new Date();
  }, [batchTracking]);

  const daysUntilExpiry = useMemo(() => {
    if (!batchTracking?.expiryDate) return null;
    const expiryDate = new Date(batchTracking.expiryDate);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [batchTracking]);

  return {
    batchTracking,
    loading,
    error,
    refetch,
    update,
    remove,
    isExpired,
    isExpiringSoon,
    daysUntilExpiry,
  };
}

/**
 * Hook for managing multiple batches
 */
export function useBatchTrackings(
  filter?: BatchFilterInput,
  pagination?: OffsetPaginationArgs
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_BATCH_TRACKINGS, {
    variables: { filter, pagination },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const [createBatchTracking] = useMutation(CREATE_BATCH_TRACKING);

  const batches: BatchTracking[] = useMemo(
    () => data?.batchTrackings || [],
    [data?.batchTrackings]
  );

  const create = useCallback(async (input: CreateBatchInput) => {
    try {
      const result = await createBatchTracking({
        variables: { input },
        refetchQueries: [
          { query: GET_BATCH_TRACKINGS, variables: { filter, pagination } },
        ],
      });
      return result.data?.createBatchTracking;
    } catch (error) {
      console.error('Failed to create batch tracking:', error);
      throw error;
    }
  }, [createBatchTracking, filter, pagination]);

  const loadMore = useCallback(async () => {
    if (!data?.batchTrackings?.length) return;

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
      console.error('Failed to load more batch trackings:', error);
    }
  }, [fetchMore, filter, pagination, data]);

  const filterByProduct = useCallback((productId: string) => {
    const productFilter = {
      ...filter,
      productId,
    };
    
    refetch({ filter: productFilter, pagination });
  }, [filter, pagination, refetch]);

  const filterByLocation = useCallback((locationId: string) => {
    const locationFilter = {
      ...filter,
      locationId,
    };
    
    refetch({ filter: locationFilter, pagination });
  }, [filter, pagination, refetch]);

  const filterByStatus = useCallback((status: BatchStatus) => {
    const statusFilter = {
      ...filter,
      status,
    };
    
    refetch({ filter: statusFilter, pagination });
  }, [filter, pagination, refetch]);

  const filterByExpiryDate = useCallback((from?: string, to?: string) => {
    const expiryFilter = {
      ...filter,
      expiryDateFrom: from,
      expiryDateTo: to,
    };
    
    refetch({ filter: expiryFilter, pagination });
  }, [filter, pagination, refetch]);

  const clearFilters = useCallback(() => {
    refetch({ filter: {}, pagination });
  }, [pagination, refetch]);

  // Statistics
  const stats = useMemo(() => {
    const totalBatches = batches.length;
    const activeBatches = batches.filter((b: BatchTracking) => b.status === BatchStatus.ACTIVE).length;
    const expiredBatches = batches.filter((b: BatchTracking) => b.status === BatchStatus.EXPIRED).length;
    const consumedBatches = batches.filter((b: BatchTracking) => b.status === BatchStatus.CONSUMED).length;
    const recalledBatches = batches.filter((b: BatchTracking) => b.status === BatchStatus.RECALLED).length;
    
    const totalQuantity = batches.reduce((sum: number, b: BatchTracking) => sum + b.currentQuantity, 0);
    const totalValue = batches.reduce((sum: number, b: BatchTracking) => sum + b.totalCost, 0);

    const expiringSoon = batches.filter((b: BatchTracking) => {
      if (!b.expiryDate) return false;
      const expiryDate = new Date(b.expiryDate);
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + 7);
      return expiryDate <= warningDate && expiryDate > new Date();
    }).length;

    return {
      totalBatches,
      activeBatches,
      expiredBatches,
      consumedBatches,
      recalledBatches,
      expiringSoon,
      totalQuantity,
      totalValue,
    };
  }, [batches]);

  return {
    batches,
    stats,
    loading,
    error,
    refetch,
    loadMore,
    create,
    filterByProduct,
    filterByLocation,
    filterByStatus,
    filterByExpiryDate,
    clearFilters,
  };
}

/**
 * Hook for expiring batches
 */
export function useExpiringBatches(daysAhead = 30, locationId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_EXPIRING_BATCHES, {
    variables: { daysAhead, locationId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const expiringBatches: BatchTracking[] = useMemo(
    () => data?.expiringBatches || [],
    [data?.expiringBatches]
  );

  const groupByDaysUntilExpiry = useMemo(() => {
    const groups: Record<string, BatchTracking[]> = {
      'expired': [],
      '1-3': [],
      '4-7': [],
      '8-14': [],
      '15-30': [],
      '30+': [],
    };

    expiringBatches.forEach((batch: BatchTracking) => {
      if (!batch.expiryDate) return;
      
      const expiryDate = new Date(batch.expiryDate);
      const today = new Date();
      const diffTime = expiryDate.getTime() - today.getTime();
      const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        if (groups.expired) groups.expired.push(batch);
      } else if (daysUntilExpiry <= 3) {
        if (groups['1-3']) groups['1-3'].push(batch);
      } else if (daysUntilExpiry <= 7) {
        if (groups['4-7']) groups['4-7'].push(batch);
      } else if (daysUntilExpiry <= 14) {
        if (groups['8-14']) groups['8-14'].push(batch);
      } else if (daysUntilExpiry <= 30) {
        if (groups['15-30']) groups['15-30'].push(batch);
      } else {
        if (groups['30+']) groups['30+'].push(batch);
      }
    });

    return groups;
  }, [expiringBatches]);

  return {
    expiringBatches,
    groupByDaysUntilExpiry,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for FIFO batches
 */
export function useFIFOBatches(productId: string, locationId: string, variantId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_FIFO_BATCHES, {
    variables: { productId, variantId, locationId },
    skip: !currentTenant?.id || !productId || !locationId,
    errorPolicy: 'all',
  });

  const fifoBatches: BatchTracking[] = useMemo(
    () => data?.fifoBatches || [],
    [data?.fifoBatches]
  );

  const getNextBatchToConsume = useCallback((quantityNeeded: number) => {
    let remainingQuantity = quantityNeeded;
    const batchesToConsume: Array<{ batch: BatchTracking; quantity: number }> = [];

    for (const batch of fifoBatches) {
      if (remainingQuantity <= 0) break;
      if (batch.currentQuantity <= 0) continue;

      const quantityFromBatch = Math.min(remainingQuantity, batch.currentQuantity);
      batchesToConsume.push({ batch, quantity: quantityFromBatch });
      remainingQuantity -= quantityFromBatch;
    }

    return {
      batchesToConsume,
      canFulfill: remainingQuantity <= 0,
      shortfall: Math.max(0, remainingQuantity),
    };
  }, [fifoBatches]);

  return {
    fifoBatches,
    loading,
    error,
    refetch,
    getNextBatchToConsume,
  };
}

/**
 * Hook for batch subscriptions
 */
export function useBatchSubscriptions(locationId?: string, daysAhead = 7) {
  const [expiringAlerts, setExpiringAlerts] = useState<BatchTracking[]>([]);

  // Subscribe to expiring batches
  const { data: expiringData } = useSubscription(BATCH_EXPIRING_SOON, {
    variables: { locationId, daysAhead },
    onData: ({ data }) => {
      if (data?.data?.batchExpiringSoon) {
        setExpiringAlerts(prev => {
          const exists = prev.some(b => b.id === data.data.batchExpiringSoon.id);
          if (!exists) {
            return [data.data.batchExpiringSoon, ...prev.slice(0, 49)];
          }
          return prev;
        });
      }
    },
  });

  // Subscribe to batch status changes
  const { data: statusChangeData } = useSubscription(BATCH_STATUS_CHANGED, {
    onData: ({ data }) => {
      if (data?.data?.batchStatusChanged) {
        console.log('Batch status changed:', data.data.batchStatusChanged);
      }
    },
  });

  const dismissExpiringAlert = useCallback((batchId: string) => {
    setExpiringAlerts(prev => prev.filter(b => b.id !== batchId));
  }, []);

  const clearExpiringAlerts = useCallback(() => {
    setExpiringAlerts([]);
  }, []);

  return {
    expiringAlerts,
    dismissExpiringAlert,
    clearExpiringAlerts,
    expiringData: expiringData?.batchExpiringSoon,
    statusChangeData: statusChangeData?.batchStatusChanged,
  };
}

/**
 * Combined batch tracking management hook
 */
export function useBatchTrackingManagement(locationId?: string) {
  const batches = useBatchTrackings();
  const expiring = useExpiringBatches(30, locationId);
  const subscriptions = useBatchSubscriptions(locationId);

  return {
    // Batch data
    batches: batches.batches,
    expiringBatches: expiring.expiringBatches,
    groupByDaysUntilExpiry: expiring.groupByDaysUntilExpiry,
    expiringAlerts: subscriptions.expiringAlerts,
    stats: batches.stats,
    
    // Loading states
    loading: batches.loading || expiring.loading,
    error: batches.error || expiring.error,
    
    // Actions
    create: batches.create,
    filterByProduct: batches.filterByProduct,
    filterByLocation: batches.filterByLocation,
    filterByStatus: batches.filterByStatus,
    filterByExpiryDate: batches.filterByExpiryDate,
    clearFilters: batches.clearFilters,
    loadMore: batches.loadMore,
    dismissExpiringAlert: subscriptions.dismissExpiringAlert,
    clearExpiringAlerts: subscriptions.clearExpiringAlerts,
    
    // Refresh functions
    refresh: () => {
      batches.refetch();
      expiring.refetch();
    },
  };
}