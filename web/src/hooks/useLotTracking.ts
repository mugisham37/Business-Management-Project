/**
 * Lot Tracking Operations Hooks
 * Complete set of hooks for lot/batch tracking and traceability
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  LotInfo,
  LotStatus,
  CreateLotInput,
  UpdateLotInput,
  LotFilterInput,
  OffsetPaginationArgs,
} from '@/types/warehouse';

// Type alias for convenience
type Lot = LotInfo;

// GraphQL Operations
import {
  GET_LOT_INFO,
  GET_LOTS,
  GET_LOTS_BY_PRODUCT,
  GET_LOTS_BY_WAREHOUSE,
  GET_EXPIRED_LOTS,
  GET_NEAR_EXPIRY_LOTS,
  GET_LOT_TRACEABILITY,
  GET_LOT_MOVEMENT_HISTORY,
} from '@/graphql/queries/warehouse-queries';

import {
  CREATE_LOT,
  UPDATE_LOT,
  DELETE_LOT,
  RECORD_LOT_MOVEMENT,
  CREATE_FIFO_RULE,
  UPDATE_FIFO_RULE,
  DELETE_FIFO_RULE,
  CREATE_RECALL,
  UPDATE_RECALL_STATUS,
  QUARANTINE_LOT,
  RELEASE_LOT_FROM_QUARANTINE,
  CHECK_LOT_EXPIRY,
} from '@/graphql/mutations/warehouse-mutations';

import {
  LOT_UPDATED,
  LOT_MOVEMENT_RECORDED,
  RECALL_CREATED,
  LOT_EXPIRED,
  LOT_NEAR_EXPIRY,
} from '@/graphql/subscriptions/warehouse-subscriptions';

// ===== SINGLE LOT HOOK =====

/**
 * Hook for managing a single lot
 */
export function useLot(lotNumber: string, productId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const apolloClient = useApolloClient();
  
  const { data, loading, error, refetch } = useQuery(GET_LOT_INFO, {
    variables: { lotNumber, productId },
    skip: !currentTenant?.id || !lotNumber || !productId,
    errorPolicy: 'all',
  });

  const [updateLot] = useMutation(UPDATE_LOT);
  const [deleteLot] = useMutation(DELETE_LOT);
  const [recordMovement] = useMutation(RECORD_LOT_MOVEMENT);
  const [quarantineLot] = useMutation(QUARANTINE_LOT);
  const [releaseLot] = useMutation(RELEASE_LOT_FROM_QUARANTINE);

  const lot = data?.lotInfo;

  // Real-time subscriptions
  useSubscription(LOT_UPDATED, {
    variables: { lotNumber, productId },
    skip: !lotNumber || !productId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.lotUpdated) {
        apolloClient.cache.writeQuery({
          query: GET_LOT_INFO,
          variables: { lotNumber, productId },
          data: { lotInfo: subscriptionData.data.lotUpdated },
        });
      }
    },
  });

  useSubscription(LOT_MOVEMENT_RECORDED, {
    variables: { lotNumber, productId },
    skip: !lotNumber || !productId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.lotMovementRecorded) {
        refetch();
      }
    },
  });

  const update = useCallback(async (input: UpdateLotInput) => {
    if (!lot?.lotNumber || !lot?.productId) return null;
    
    try {
      const result = await updateLot({
        variables: { 
          lotNumber: lot.lotNumber, 
          productId: lot.productId, 
          input 
        },
        optimisticResponse: {
          updateLot: {
            ...lot,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateLot;
    } catch (error) {
      console.error('Failed to update lot:', error);
      throw error;
    }
  }, [updateLot, lot]);

  const remove = useCallback(async () => {
    if (!lot?.lotNumber || !lot?.productId) return false;
    
    try {
      await deleteLot({
        variables: { 
          lotNumber: lot.lotNumber, 
          productId: lot.productId 
        },
        update: (cache) => {
          const lotId = cache.identify(lot);
          if (lotId) {
            cache.evict({ id: lotId });
          }
          cache.gc();
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to delete lot:', error);
      throw error;
    }
  }, [deleteLot, lot]);

  const recordLotMovement = useCallback(async (input: {
    movementType: string;
    fromLocationId?: string;
    toLocationId?: string;
    quantity: number;
    unitOfMeasure: string;
    reason?: string;
    referenceId?: string;
    referenceType?: string;
  }) => {
    if (!lot?.lotNumber || !lot?.productId) return null;
    
    try {
      const result = await recordMovement({
        variables: { 
          input: {
            ...input,
            lotNumber: lot.lotNumber,
            productId: lot.productId,
          }
        },
      });
      
      if (result.data?.recordLotMovement) {
        refetch();
      }
      
      return result.data?.recordLotMovement;
    } catch (error) {
      console.error('Failed to record lot movement:', error);
      throw error;
    }
  }, [recordMovement, lot, refetch]);

  const quarantine = useCallback(async (reason: string) => {
    if (!lot?.lotNumber || !lot?.productId) return null;
    
    try {
      const result = await quarantineLot({
        variables: { 
          lotNumber: lot.lotNumber, 
          productId: lot.productId, 
          reason 
        },
      });
      
      if (result.data?.quarantineLot) {
        refetch();
      }
      
      return result.data?.quarantineLot;
    } catch (error) {
      console.error('Failed to quarantine lot:', error);
      throw error;
    }
  }, [quarantineLot, lot, refetch]);

  const releaseFromQuarantine = useCallback(async () => {
    if (!lot?.lotNumber || !lot?.productId) return null;
    
    try {
      const result = await releaseLot({
        variables: { 
          lotNumber: lot.lotNumber, 
          productId: lot.productId 
        },
      });
      
      if (result.data?.releaseLotFromQuarantine) {
        refetch();
      }
      
      return result.data?.releaseLotFromQuarantine;
    } catch (error) {
      console.error('Failed to release lot from quarantine:', error);
      throw error;
    }
  }, [releaseLot, lot, refetch]);

  // Computed properties
  const isActive = useMemo(() => {
    return lot?.status === LotStatus.ACTIVE;
  }, [lot?.status]);

  const isExpired = useMemo(() => {
    return lot?.status === LotStatus.EXPIRED || lot?.isExpired;
  }, [lot?.status, lot?.isExpired]);

  const isNearExpiry = useMemo(() => {
    return lot?.isNearExpiry;
  }, [lot?.isNearExpiry]);

  const isQuarantined = useMemo(() => {
    return lot?.status === LotStatus.QUARANTINE;
  }, [lot?.status]);

  const isRecalled = useMemo(() => {
    return lot?.status === LotStatus.RECALLED;
  }, [lot?.status]);

  const isConsumed = useMemo(() => {
    return lot?.status === LotStatus.CONSUMED;
  }, [lot?.status]);

  const daysUntilExpiry = useMemo(() => {
    if (!lot?.expiryDate) return null;
    
    const now = new Date();
    const expiry = new Date(lot.expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }, [lot]);

  const canQuarantine = useMemo(() => {
    return lot?.status === LotStatus.ACTIVE;
  }, [lot?.status]);

  const canRelease = useMemo(() => {
    return lot?.status === LotStatus.QUARANTINE;
  }, [lot?.status]);

  const canMove = useMemo(() => {
    return [LotStatus.ACTIVE, LotStatus.QUARANTINE].includes(lot?.status as LotStatus);
  }, [lot?.status]);

  return {
    lot,
    loading,
    error,
    refetch,
    update,
    remove,
    recordLotMovement,
    quarantine,
    releaseFromQuarantine,
    isActive,
    isExpired,
    isNearExpiry,
    isQuarantined,
    isRecalled,
    isConsumed,
    daysUntilExpiry,
    canQuarantine,
    canRelease,
    canMove,
  };
}

// ===== MULTIPLE LOTS HOOK =====

/**
 * Hook for managing multiple lots with pagination and filtering
 */
export function useLots(
  paginationArgs?: OffsetPaginationArgs,
  filter?: LotFilterInput
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_LOTS, {
    variables: {
      first: paginationArgs?.limit || 20,
      after: null,
      filter,
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const [createLot] = useMutation(CREATE_LOT);

  const lots = data?.lots?.edges?.map((edge: { node: Lot }) => edge.node) || [];
  const pageInfo = data?.lots?.pageInfo;
  const totalCount = data?.lots?.totalCount || 0;

  const create = useCallback(async (input: CreateLotInput) => {
    try {
      const result = await createLot({
        variables: { input },
        update: (cache, { data: mutationData }) => {
          if (mutationData?.createLot) {
            const existingLots = cache.readQuery({
              query: GET_LOTS,
              variables: { first: 20, filter },
            });

            if (existingLots) {
              const lotsData = (existingLots as { lots?: { edges?: Array<{ node: Lot; cursor: string }>; totalCount?: number } }).lots;
              if (lotsData) {
                cache.writeQuery({
                  query: GET_LOTS,
                  variables: { first: 20, filter },
                  data: {
                    lots: {
                      ...lotsData,
                      edges: [
                        {
                          node: mutationData.createLot,
                          cursor: `lot-${Date.now()}`,
                          __typename: 'LotEdge',
                        },
                        ...(lotsData.edges || []),
                      ],
                      totalCount: (lotsData.totalCount || 0) + 1,
                    },
                  },
                });
              }
            }
          }
        },
      });
      return result.data?.createLot;
    } catch (error) {
      console.error('Failed to create lot:', error);
      throw error;
    }
  }, [createLot, filter]);

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
            lots: {
              ...fetchMoreResult.lots,
              edges: [
                ...prev.lots.edges,
                ...fetchMoreResult.lots.edges,
              ],
            },
          };
        },
      });
    } catch (error) {
      console.error('Failed to load more lots:', error);
      throw error;
    }
  }, [fetchMore, pageInfo, loading]);

  return {
    lots,
    loading,
    error,
    pageInfo,
    totalCount,
    refetch,
    create,
    loadMore,
  };
}

// ===== LOTS BY PRODUCT HOOK =====

/**
 * Hook for getting lots by product
 */
export function useLotsByProduct(productId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_LOTS_BY_PRODUCT, {
    variables: { productId },
    skip: !currentTenant?.id || !productId,
    errorPolicy: 'all',
  });

  const lots = data?.lotsByProduct || [];

  return {
    lots,
    loading,
    error,
    refetch,
  };
}

// ===== LOTS BY WAREHOUSE HOOK =====

/**
 * Hook for getting lots by warehouse
 */
export function useLotsByWarehouse(warehouseId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_LOTS_BY_WAREHOUSE, {
    variables: { warehouseId },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
  });

  const lots = data?.lotsByWarehouse || [];

  // Real-time subscriptions for warehouse lots
  useSubscription(LOT_EXPIRED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.lotExpired) {
        refetch();
      }
    },
  });

  useSubscription(LOT_NEAR_EXPIRY, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.lotNearExpiry) {
        refetch();
      }
    },
  });

  return {
    lots,
    loading,
    error,
    refetch,
  };
}

// ===== EXPIRED LOTS HOOK =====

/**
 * Hook for getting expired lots
 */
export function useExpiredLots(warehouseId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_EXPIRED_LOTS, {
    variables: { warehouseId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 300000, // Poll every 5 minutes
  });

  const expiredLots = data?.expiredLots || [];

  return {
    expiredLots,
    loading,
    error,
    refetch,
  };
}

// ===== NEAR EXPIRY LOTS HOOK =====

/**
 * Hook for getting near expiry lots
 */
export function useNearExpiryLots(days: number = 30, warehouseId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_NEAR_EXPIRY_LOTS, {
    variables: { days, warehouseId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 300000, // Poll every 5 minutes
  });

  const nearExpiryLots = data?.nearExpiryLots || [];

  return {
    nearExpiryLots,
    loading,
    error,
    refetch,
  };
}

// ===== LOT TRACEABILITY HOOK =====

/**
 * Hook for lot traceability
 */
export function useLotTraceability(lotNumber: string, productId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_LOT_TRACEABILITY, {
    variables: { lotNumber, productId },
    skip: !currentTenant?.id || !lotNumber || !productId,
    errorPolicy: 'all',
  });

  const traceability = data?.lotTraceability;

  return {
    traceability,
    loading,
    error,
    refetch,
  };
}

// ===== LOT MOVEMENT HISTORY HOOK =====

/**
 * Hook for lot movement history
 */
export function useLotMovementHistory(lotNumber: string, productId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_LOT_MOVEMENT_HISTORY, {
    variables: { lotNumber, productId },
    skip: !currentTenant?.id || !lotNumber || !productId,
    errorPolicy: 'all',
  });

  const movementHistory = data?.lotMovementHistory || [];

  return {
    movementHistory,
    loading,
    error,
    refetch,
  };
}

// ===== FIFO RULES HOOK =====

/**
 * Hook for managing FIFO rules
 */
export function useFIFORules() {
  const [createFIFORule] = useMutation(CREATE_FIFO_RULE);
  const [updateFIFORule] = useMutation(UPDATE_FIFO_RULE);
  const [deleteFIFORule] = useMutation(DELETE_FIFO_RULE);

  const createRule = useCallback(async (input: {
    productId: string;
    warehouseId: string;
    enabled: boolean;
    strictMode?: boolean;
    exceptionRules?: Record<string, unknown>;
  }) => {
    try {
      const result = await createFIFORule({
        variables: { input },
      });
      return result.data?.createFIFORule;
    } catch (error) {
      console.error('Failed to create FIFO rule:', error);
      throw error;
    }
  }, [createFIFORule]);

  const updateRule = useCallback(async (id: string, input: {
    productId?: string;
    warehouseId?: string;
    enabled?: boolean;
    strictMode?: boolean;
    exceptionRules?: Record<string, unknown>;
  }) => {
    try {
      const result = await updateFIFORule({
        variables: { id, input },
      });
      return result.data?.updateFIFORule;
    } catch (error) {
      console.error('Failed to update FIFO rule:', error);
      throw error;
    }
  }, [updateFIFORule]);

  const deleteRule = useCallback(async (id: string) => {
    try {
      const result = await deleteFIFORule({
        variables: { id },
      });
      return result.data?.deleteFIFORule;
    } catch (error) {
      console.error('Failed to delete FIFO rule:', error);
      throw error;
    }
  }, [deleteFIFORule]);

  return {
    createRule,
    updateRule,
    deleteRule,
  };
}

// ===== RECALLS HOOK =====

/**
 * Hook for managing recalls
 */
export function useRecalls() {
  const [createRecall] = useMutation(CREATE_RECALL);
  const [updateRecallStatus] = useMutation(UPDATE_RECALL_STATUS);

  // Real-time subscription for recall notifications
  useSubscription(RECALL_CREATED, {
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.recallCreated) {
        console.log('New recall created:', subscriptionData.data.recallCreated);
        // Handle recall notification
      }
    },
  });

  const createNewRecall = useCallback(async (input: {
    productId: string;
    lotNumbers: string[];
    reason: string;
    severity: string;
  }) => {
    try {
      const result = await createRecall({
        variables: { input },
      });
      return result.data?.createRecall;
    } catch (error) {
      console.error('Failed to create recall:', error);
      throw error;
    }
  }, [createRecall]);

  const updateStatus = useCallback(async (recallId: string, status: string) => {
    try {
      const result = await updateRecallStatus({
        variables: { recallId, status },
      });
      return result.data?.updateRecallStatus;
    } catch (error) {
      console.error('Failed to update recall status:', error);
      throw error;
    }
  }, [updateRecallStatus]);

  return {
    createNewRecall,
    updateStatus,
  };
}

// ===== LOT EXPIRY MANAGEMENT HOOK =====

/**
 * Hook for lot expiry management
 */
export function useLotExpiryManagement(warehouseId?: string) {
  const [checkLotExpiry] = useMutation(CHECK_LOT_EXPIRY);

  const { expiredLots } = useExpiredLots(warehouseId);
  const { nearExpiryLots } = useNearExpiryLots(30, warehouseId);

  const checkExpiry = useCallback(async () => {
    try {
      const result = await checkLotExpiry({
        variables: { warehouseId },
      });
      return result.data?.checkLotExpiry;
    } catch (error) {
      console.error('Failed to check lot expiry:', error);
      throw error;
    }
  }, [checkLotExpiry, warehouseId]);

  const expiryStats = useMemo(() => {
    const expiredCount = expiredLots.length;
    const nearExpiryCount = nearExpiryLots.length;
    
    const criticalLots = nearExpiryLots.filter((lot: Lot) => 
      (lot.daysUntilExpiry || 0) <= 7
    ).length;
    
    const warningLots = nearExpiryLots.filter((lot: Lot) => 
      (lot.daysUntilExpiry || 0) > 7 && (lot.daysUntilExpiry || 0) <= 30
    ).length;

    return {
      expiredCount,
      nearExpiryCount,
      criticalLots,
      warningLots,
    };
  }, [expiredLots, nearExpiryLots]);

  return {
    expiredLots,
    nearExpiryLots,
    expiryStats,
    checkExpiry,
  };
}

// ===== LOT TRACKING MANAGEMENT HOOK =====

/**
 * Combined hook for comprehensive lot tracking management
 */
export function useLotTrackingManagement(warehouseId?: string) {
  const apolloClient = useApolloClient();
  const [selectedLotNumber, setSelectedLotNumber] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Get all lots
  const {
    lots,
    loading: lotsLoading,
    error: lotsError,
    create: createLot,
    refetch: refetchLots,
  } = useLots();

  // Get warehouse lots
  const {
    lots: warehouseLots,
    loading: warehouseLotsLoading,
  } = useLotsByWarehouse(warehouseId || '');

  // Get selected lot details
  const {
    lot: selectedLot,
    loading: selectedLotLoading,
    error: selectedLotError,
    update: updateLot,
    remove: deleteLot,
    recordLotMovement,
    quarantine: quarantineLot,
    releaseFromQuarantine,
    isActive,
    isExpired,
    isNearExpiry,
    isQuarantined,
    canQuarantine,
    canRelease,
    canMove,
    daysUntilExpiry,
  } = useLot(selectedLotNumber, selectedProductId);

  // Get traceability and movement history
  const {
    traceability,
    loading: traceabilityLoading,
  } = useLotTraceability(selectedLotNumber, selectedProductId);

  const {
    movementHistory,
    loading: movementHistoryLoading,
  } = useLotMovementHistory(selectedLotNumber, selectedProductId);

  // Expiry management
  const {
    expiredLots,
    nearExpiryLots,
    expiryStats,
    checkExpiry,
  } = useLotExpiryManagement(warehouseId);

  // FIFO and recalls
  const { createRule: createFIFORule, updateRule: updateFIFORule, deleteRule: deleteFIFORule } = useFIFORules();
  const { createNewRecall, updateStatus: updateRecallStatus } = useRecalls();

  const selectLot = useCallback((lotNumber: string, productId: string) => {
    setSelectedLotNumber(lotNumber);
    setSelectedProductId(productId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLotNumber('');
    setSelectedProductId('');
  }, []);

  // Lot statistics
  const lotStats = useMemo(() => {
    const relevantLots = warehouseId ? warehouseLots : lots;
    
    const totalLots = relevantLots.length;
    const activeLots = relevantLots.filter((lot: Lot) => lot.status === LotStatus.ACTIVE).length;
    const expiredLotsCount = relevantLots.filter((lot: Lot) => lot.status === LotStatus.EXPIRED).length;
    const quarantinedLots = relevantLots.filter((lot: Lot) => lot.status === LotStatus.QUARANTINE).length;
    const recalledLots = relevantLots.filter((lot: Lot) => lot.status === LotStatus.RECALLED).length;
    const consumedLots = relevantLots.filter((lot: Lot) => lot.status === LotStatus.CONSUMED).length;

    const totalQuantity = relevantLots.reduce((sum: number, lot: Lot) => sum + (lot.quantity || 0), 0);
    const activeQuantity = relevantLots
      .filter((lot: Lot) => lot.status === LotStatus.ACTIVE)
      .reduce((sum: number, lot: Lot) => sum + (lot.quantity || 0), 0);

    return {
      totalLots,
      activeLots,
      expiredLotsCount,
      quarantinedLots,
      recalledLots,
      consumedLots,
      totalQuantity,
      activeQuantity,
    };
  }, [lots, warehouseLots, warehouseId]);

  // Clear cache for lot data
  const clearCache = useCallback(() => {
    apolloClient.cache.evict({ fieldName: 'lots' });
    apolloClient.cache.evict({ fieldName: 'lotInfo' });
    apolloClient.cache.evict({ fieldName: 'lotsByProduct' });
    apolloClient.cache.evict({ fieldName: 'lotsByWarehouse' });
    apolloClient.cache.evict({ fieldName: 'expiredLots' });
    apolloClient.cache.evict({ fieldName: 'nearExpiryLots' });
    apolloClient.cache.gc();
  }, [apolloClient]);

  return {
    // Lots list
    lots: warehouseId ? warehouseLots : lots,
    lotsLoading: warehouseId ? warehouseLotsLoading : lotsLoading,
    lotsError,
    createLot,
    refetchLots,

    // Selected lot
    selectedLot,
    selectedLotNumber,
    selectedProductId,
    selectedLotLoading,
    selectedLotError,
    selectLot,
    clearSelection,

    // Lot operations
    updateLot,
    deleteLot,
    recordLotMovement,
    quarantineLot,
    releaseFromQuarantine,

    // Lot state
    isActive,
    isExpired,
    isNearExpiry,
    isQuarantined,
    canQuarantine,
    canRelease,
    canMove,
    daysUntilExpiry,

    // Traceability
    traceability,
    traceabilityLoading,
    movementHistory,
    movementHistoryLoading,

    // Expiry management
    expiredLots,
    nearExpiryLots,
    expiryStats,
    checkExpiry,

    // FIFO rules
    createFIFORule,
    updateFIFORule,
    deleteFIFORule,

    // Recalls
    createNewRecall,
    updateRecallStatus,

    // Statistics
    lotStats,

    // Utilities
    clearCache,
  };
}