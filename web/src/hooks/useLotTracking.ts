/**
 * Lot Tracking Management Hooks
 * Complete set of hooks for lot tracking and FIFO operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  LotInfo,
  LotStatus,
  LotMovement,
  CreateLotInput,
  LotFilterInput,
  OffsetPaginationArgs,
  LotInfoConnection,
} from '@/types/warehouse';

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
export function useLotInfo(lotNumber: string, productId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
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

  const update = useCallback(async (input: Partial<CreateLotInput>) => {
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
          cache.evict({ id: cache.identify(lot) });
          cache.gc();
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to delete lot:', error);
      throw error;
    }
  }, [deleteLot, lot]);

  const recordLotMovement = useCallback(async (input: any) => {
    try {
      const result = await recordMovement({
        variables: { input },
        refetchQueries: [
          { query: GET_LOT_MOVEMENT_HISTORY, variables: { lotNumber, productId } },
        ],
      });
      return result.data?.recordLotMovement;
    } catch (error) {
      console.error('Failed to record lot movement:', error);
      throw error;
    }
  }, [recordMovement, lotNumber, productId]);

  const quarantine = useCallback(async (reason: string) => {
    if (!lot?.lotNumber || !lot?.productId) return false;
    
    try {
      await quarantineLot({
        variables: { 
          lotNumber: lot.lotNumber, 
          productId: lot.productId, 
          reason 
        },
        optimisticResponse: {
          quarantineLot: true,
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to quarantine lot:', error);
      throw error;
    }
  }, [quarantineLot, lot]);

  const releaseFromQuarantine = useCallback(async () => {
    if (!lot?.lotNumber || !lot?.productId) return false;
    
    try {
      await releaseLot({
        variables: { 
          lotNumber: lot.lotNumber, 
          productId: lot.productId 
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to release lot from quarantine:', error);
      throw error;
    }
  }, [releaseLot, lot]);

  // Real-time subscription
  useSubscription(LOT_UPDATED, {
    variables: { lotNumber, productId },
    skip: !lotNumber || !productId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.lotUpdated) {
        console.log('Lot updated via subscription:', subscriptionData.data.lotUpdated);
      }
    },
  });

  // Computed properties
  const isExpired = useMemo(() => {
    if (!lot?.expiryDate) return false;
    return new Date() > new Date(lot.expiryDate);
  }, [lot?.expiryDate]);

  const isNearExpiry = useMemo(() => {
    if (!lot?.expiryDate) return false;
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 30); // 30 days warning
    const expiryDate = new Date(lot.expiryDate);
    return expiryDate <= warningDate && expiryDate > new Date();
  }, [lot?.expiryDate]);

  const daysUntilExpiry = useMemo(() => {
    if (!lot?.expiryDate) return null;
    const today = new Date();
    const expiryDate = new Date(lot.expiryDate);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [lot?.expiryDate]);

  const isQuarantined = useMemo(() => {
    return lot?.status === LotStatus.QUARANTINE;
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
    isExpired,
    isNearExpiry,
    daysUntilExpiry,
    isQuarantined,
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

  const lots = data?.lots?.edges?.map(edge => edge.node) || [];
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
              cache.writeQuery({
                query: GET_LOTS,
                variables: { first: 20, filter },
                data: {
                  lots: {
                    ...existingLots.lots,
                    edges: [
                      {
                        node: mutationData.createLot,
                        cursor: `lot-${Date.now()}`,
                        __typename: 'LotInfoEdge',
                      },
                      ...existingLots.lots.edges,
                    ],
                    totalCount: existingLots.lots.totalCount + 1,
                  },
                },
              });
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

  // Real-time subscription for expired lots
  useSubscription(LOT_EXPIRED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.lotExpired) {
        console.log('Lot expired:', subscriptionData.data.lotExpired);
      }
    },
  });

  return {
    expiredLots,
    loading,
    error,
    refetch,
  };
}

// ===== NEAR EXPIRY LOTS HOOK =====

/**
 * Hook for getting lots near expiry
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

  // Real-time subscription for near expiry lots
  useSubscription(LOT_NEAR_EXPIRY, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.lotNearExpiry) {
        console.log('Lot near expiry:', subscriptionData.data.lotNearExpiry);
      }
    },
  });

  return {
    nearExpiryLots,
    loading,
    error,
    refetch,
  };
}

// ===== LOT TRACEABILITY HOOK =====

/**
 * Hook for getting lot traceability information
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
 * Hook for getting lot movement history
 */
export function useLotMovementHistory(lotNumber: string, productId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_LOT_MOVEMENT_HISTORY, {
    variables: { lotNumber, productId },
    skip: !currentTenant?.id || !lotNumber || !productId,
    errorPolicy: 'all',
  });

  const movementHistory = data?.lotMovementHistory || [];

  // Real-time subscription for movement updates
  useSubscription(LOT_MOVEMENT_RECORDED, {
    variables: { lotNumber, productId },
    skip: !lotNumber || !productId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.lotMovementRecorded) {
        console.log('Lot movement recorded:', subscriptionData.data.lotMovementRecorded);
        refetch();
      }
    },
  });

  return {
    movementHistory,
    loading,
    error,
    refetch,
  };
}

// ===== LOT TRACKING MANAGEMENT HOOK =====

/**
 * Combined hook for comprehensive lot tracking management
 */
export function useLotTrackingManagement(warehouseId?: string) {
  const apolloClient = useApolloClient();
  const [selectedLotNumber, setSelectedLotNumber] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [checkExpiryMutation] = useMutation(CHECK_LOT_EXPIRY);

  // Get all lots
  const {
    lots,
    loading: lotsLoading,
    error: lotsError,
    create: createLot,
    refetch: refetchLots,
  } = useLots();

  // Get expired lots
  const {
    expiredLots,
    loading: expiredLotsLoading,
  } = useExpiredLots(warehouseId);

  // Get near expiry lots
  const {
    nearExpiryLots,
    loading: nearExpiryLotsLoading,
  } = useNearExpiryLots(30, warehouseId);

  // Get selected lot details
  const {
    lot: selectedLot,
    loading: selectedLotLoading,
    error: selectedLotError,
    update: updateLot,
    remove: deleteLot,
    recordLotMovement,
    quarantine,
    releaseFromQuarantine,
    isExpired,
    isNearExpiry,
    daysUntilExpiry,
    isQuarantined,
  } = useLotInfo(selectedLotNumber || '', selectedProductId || '');

  // Get movement history for selected lot
  const {
    movementHistory,
    loading: movementHistoryLoading,
  } = useLotMovementHistory(selectedLotNumber || '', selectedProductId || '');

  const selectLot = useCallback((lotNumber: string, productId: string) => {
    setSelectedLotNumber(lotNumber);
    setSelectedProductId(productId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLotNumber(null);
    setSelectedProductId(null);
  }, []);

  // Check lot expiry for all lots in warehouse
  const checkLotExpiry = useCallback(async () => {
    try {
      await checkExpiryMutation({
        variables: { warehouseId },
        refetchQueries: [
          { query: GET_EXPIRED_LOTS, variables: { warehouseId } },
          { query: GET_NEAR_EXPIRY_LOTS, variables: { days: 30, warehouseId } },
        ],
      });
      return true;
    } catch (error) {
      console.error('Failed to check lot expiry:', error);
      throw error;
    }
  }, [checkExpiryMutation, warehouseId]);

  // Lot statistics
  const lotStats = useMemo(() => {
    const totalLots = lots.length;
    const activeLots = lots.filter(lot => lot.status === LotStatus.ACTIVE).length;
    const expiredCount = expiredLots.length;
    const nearExpiryCount = nearExpiryLots.length;
    const quarantinedLots = lots.filter(lot => lot.status === LotStatus.QUARANTINE).length;
    const recalledLots = lots.filter(lot => lot.status === LotStatus.RECALLED).length;

    const totalQuantity = lots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
    const expiredQuantity = expiredLots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
    const nearExpiryQuantity = nearExpiryLots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);

    return {
      totalLots,
      activeLots,
      expiredCount,
      nearExpiryCount,
      quarantinedLots,
      recalledLots,
      totalQuantity,
      expiredQuantity,
      nearExpiryQuantity,
    };
  }, [lots, expiredLots, nearExpiryLots]);

  // Get lots by status
  const getLotsByStatus = useCallback((status: LotStatus) => {
    return lots.filter(lot => lot.status === status);
  }, [lots]);

  // Get lots expiring within days
  const getLotsExpiringWithin = useCallback((days: number) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);
    
    return lots.filter(lot => {
      if (!lot.expiryDate) return false;
      const expiryDate = new Date(lot.expiryDate);
      return expiryDate <= cutoffDate && expiryDate > new Date();
    });
  }, [lots]);

  // Clear cache for lot data
  const clearCache = useCallback(() => {
    apolloClient.cache.evict({ fieldName: 'lots' });
    apolloClient.cache.evict({ fieldName: 'lotInfo' });
    apolloClient.cache.evict({ fieldName: 'expiredLots' });
    apolloClient.cache.evict({ fieldName: 'nearExpiryLots' });
    apolloClient.cache.gc();
  }, [apolloClient]);

  return {
    // Lots list
    lots,
    lotsLoading,
    lotsError,
    createLot,
    refetchLots,

    // Expiry tracking
    expiredLots,
    expiredLotsLoading,
    nearExpiryLots,
    nearExpiryLotsLoading,
    checkLotExpiry,

    // Selected lot
    selectedLot,
    selectedLotNumber,
    selectedProductId,
    selectedLotLoading,
    selectedLotError,
    selectLot,
    clearSelection,
    updateLot,
    deleteLot,
    recordLotMovement,
    quarantine,
    releaseFromQuarantine,
    isExpired,
    isNearExpiry,
    daysUntilExpiry,
    isQuarantined,

    // Movement history
    movementHistory,
    movementHistoryLoading,

    // Statistics and queries
    lotStats,
    getLotsByStatus,
    getLotsExpiringWithin,

    // Utilities
    clearCache,
  };
}

// ===== LOT VALIDATION HOOK =====

/**
 * Hook for lot data validation
 */
export function useLotValidation() {
  const validateLotNumber = useCallback((lotNumber: string): string | null => {
    if (!lotNumber) return 'Lot number is required';
    if (lotNumber.length < 1) return 'Lot number is required';
    if (lotNumber.length > 100) return 'Lot number must be less than 100 characters';
    return null;
  }, []);

  const validateQuantity = useCallback((quantity: number): string | null => {
    if (quantity <= 0) return 'Quantity must be greater than 0';
    if (quantity > 1000000) return 'Quantity seems unreasonably large';
    return null;
  }, []);

  const validateExpiryDate = useCallback((expiryDate: Date): string | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (expiryDate < today) return 'Expiry date cannot be in the past';
    
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);
    if (expiryDate > maxDate) return 'Expiry date seems too far in the future';
    
    return null;
  }, []);

  const validateCreateLotInput = useCallback((input: CreateLotInput): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!input.productId) errors.productId = 'Product is required';
    if (!input.warehouseId) errors.warehouseId = 'Warehouse is required';

    const lotNumberError = validateLotNumber(input.lotNumber);
    if (lotNumberError) errors.lotNumber = lotNumberError;

    const quantityError = validateQuantity(input.quantity);
    if (quantityError) errors.quantity = quantityError;

    if (input.expiryDate) {
      const expiryError = validateExpiryDate(input.expiryDate);
      if (expiryError) errors.expiryDate = expiryError;
    }

    return errors;
  }, [validateLotNumber, validateQuantity, validateExpiryDate]);

  return {
    validateLotNumber,
    validateQuantity,
    validateExpiryDate,
    validateCreateLotInput,
  };
}