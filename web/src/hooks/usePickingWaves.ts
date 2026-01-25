/**
 * Picking Wave Management Hooks
 * Complete set of hooks for picking wave operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  PickingWave,
  PickingWaveStatus,
  CreatePickingWaveInput,
  UpdatePickingWaveInput,
  PickingWaveFilterInput,
  OffsetPaginationArgs,
} from '@/types/warehouse';

// GraphQL Operations
import {
  GET_PICKING_WAVE,
  GET_PICKING_WAVES,
  GET_PICKING_WAVES_BY_WAREHOUSE,
  GET_PICKING_WAVES_BY_PICKER,
  GET_OVERDUE_PICKING_WAVES,
  GET_WAVE_STATISTICS,
  GET_WAVE_RECOMMENDATIONS,
} from '@/graphql/queries/warehouse-queries';

import {
  CREATE_PICKING_WAVE,
  UPDATE_PICKING_WAVE,
  DELETE_PICKING_WAVE,
  RELEASE_PICKING_WAVE,
  START_PICKING_WAVE,
  COMPLETE_PICKING_WAVE,
  CANCEL_PICKING_WAVE,
  ASSIGN_PICKERS_TO_WAVE,
  PLAN_PICKING_WAVES,
  OPTIMIZE_PICKING_WAVE,
} from '@/graphql/mutations/warehouse-mutations';

import {
  PICKING_WAVE_UPDATED,
  PICKING_WAVE_STATISTICS_UPDATED,
  PICKING_WAVE_STATUS_CHANGED,
} from '@/graphql/subscriptions/warehouse-subscriptions';

// ===== SINGLE PICKING WAVE HOOK =====

/**
 * Hook for managing a single picking wave
 */
export function usePickingWave(waveId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_PICKING_WAVE, {
    variables: { id: waveId },
    skip: !currentTenant?.id || !waveId,
    errorPolicy: 'all',
  });

  const [updateWave] = useMutation(UPDATE_PICKING_WAVE);
  const [deleteWave] = useMutation(DELETE_PICKING_WAVE);
  const [releaseWave] = useMutation(RELEASE_PICKING_WAVE);
  const [startWave] = useMutation(START_PICKING_WAVE);
  const [completeWave] = useMutation(COMPLETE_PICKING_WAVE);
  const [cancelWave] = useMutation(CANCEL_PICKING_WAVE);
  const [assignPickers] = useMutation(ASSIGN_PICKERS_TO_WAVE);
  const [optimizeWave] = useMutation(OPTIMIZE_PICKING_WAVE);

  const wave = data?.pickingWave;

  const update = useCallback(async (input: UpdatePickingWaveInput) => {
    if (!wave?.id) return null;
    
    try {
      const result = await updateWave({
        variables: { id: wave.id, input },
        optimisticResponse: {
          updatePickingWave: {
            ...wave,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updatePickingWave;
    } catch (error) {
      console.error('Failed to update picking wave:', error);
      throw error;
    }
  }, [updateWave, wave]);

  const remove = useCallback(async () => {
    if (!wave?.id) return false;
    
    try {
      await deleteWave({
        variables: { id: wave.id },
        update: (cache) => {
          const waveId = cache.identify(wave);
          if (waveId) {
            cache.evict({ id: waveId });
            cache.gc();
          }
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to delete picking wave:', error);
      throw error;
    }
  }, [deleteWave, wave]);

  const release = useCallback(async () => {
    if (!wave?.id) return null;
    
    try {
      const result = await releaseWave({
        variables: { id: wave.id },
        optimisticResponse: {
          releasePickingWave: {
            ...wave,
            status: PickingWaveStatus.RELEASED,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.releasePickingWave;
    } catch (error) {
      console.error('Failed to release picking wave:', error);
      throw error;
    }
  }, [releaseWave, wave]);

  const start = useCallback(async () => {
    if (!wave?.id) return null;
    
    try {
      const result = await startWave({
        variables: { id: wave.id },
        optimisticResponse: {
          startPickingWave: {
            ...wave,
            status: PickingWaveStatus.IN_PROGRESS,
            startedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.startPickingWave;
    } catch (error) {
      console.error('Failed to start picking wave:', error);
      throw error;
    }
  }, [startWave, wave]);

  const complete = useCallback(async () => {
    if (!wave?.id) return null;
    
    try {
      const result = await completeWave({
        variables: { id: wave.id },
        optimisticResponse: {
          completePickingWave: {
            ...wave,
            status: PickingWaveStatus.COMPLETED,
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.completePickingWave;
    } catch (error) {
      console.error('Failed to complete picking wave:', error);
      throw error;
    }
  }, [completeWave, wave]);

  const cancel = useCallback(async (reason?: string) => {
    if (!wave?.id) return null;
    
    try {
      const result = await cancelWave({
        variables: { id: wave.id, reason },
        optimisticResponse: {
          cancelPickingWave: {
            ...wave,
            status: PickingWaveStatus.CANCELLED,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.cancelPickingWave;
    } catch (error) {
      console.error('Failed to cancel picking wave:', error);
      throw error;
    }
  }, [cancelWave, wave]);

  const assignPickersToWave = useCallback(async (pickerIds: string[]) => {
    if (!wave?.id) return null;
    
    try {
      const result = await assignPickers({
        variables: { 
          waveId: wave.id, 
          input: { pickerIds } 
        },
        optimisticResponse: {
          assignPickersToWave: {
            ...wave,
            assignedPickers: pickerIds,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.assignPickersToWave;
    } catch (error) {
      console.error('Failed to assign pickers to wave:', error);
      throw error;
    }
  }, [assignPickers, wave]);

  const optimize = useCallback(async () => {
    if (!wave?.id) return null;
    
    try {
      const result = await optimizeWave({
        variables: { waveId: wave.id },
      });
      return result.data?.optimizePickingWave;
    } catch (error) {
      console.error('Failed to optimize picking wave:', error);
      throw error;
    }
  }, [optimizeWave, wave]);

  // Real-time subscription
  useSubscription(PICKING_WAVE_UPDATED, {
    variables: { waveId },
    skip: !waveId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickingWaveUpdated) {
        console.log('Picking wave updated via subscription:', subscriptionData.data.pickingWaveUpdated);
      }
    },
  });

  // Computed properties
  const canRelease = useMemo(() => {
    return wave?.status === PickingWaveStatus.PLANNED;
  }, [wave?.status]);

  const canStart = useMemo(() => {
    return wave?.status === PickingWaveStatus.RELEASED || wave?.status === PickingWaveStatus.READY;
  }, [wave?.status]);

  const canComplete = useMemo(() => {
    return wave?.status === PickingWaveStatus.IN_PROGRESS;
  }, [wave?.status]);

  const canCancel = useMemo(() => {
    return wave?.status !== PickingWaveStatus.COMPLETED && wave?.status !== PickingWaveStatus.CANCELLED;
  }, [wave?.status]);

  const isActive = useMemo(() => {
    return wave?.status === PickingWaveStatus.IN_PROGRESS;
  }, [wave?.status]);

  const isCompleted = useMemo(() => {
    return wave?.status === PickingWaveStatus.COMPLETED;
  }, [wave?.status]);

  const progressPercentage = useMemo(() => {
    if (!wave?.statistics) return 0;
    return wave.statistics.progressPercentage || 0;
  }, [wave?.statistics]);

  return {
    wave,
    loading,
    error,
    refetch,
    update,
    remove,
    release,
    start,
    complete,
    cancel,
    assignPickersToWave,
    optimize,
    canRelease,
    canStart,
    canComplete,
    canCancel,
    isActive,
    isCompleted,
    progressPercentage,
  };
}

// ===== MULTIPLE PICKING WAVES HOOK =====

/**
 * Hook for managing multiple picking waves with pagination and filtering
 */
export function usePickingWaves(
  paginationArgs?: OffsetPaginationArgs,
  filter?: PickingWaveFilterInput
) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  interface WaveEdge {
    node: PickingWave;
    cursor: string;
    __typename: string;
  }

  interface PickingWavesResponse {
    pickingWaves: {
      edges: WaveEdge[];
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        endCursor: string | null;
        startCursor: string | null;
      };
      totalCount: number;
    };
  }
  
  const { data, loading, error, refetch, fetchMore } = useQuery<PickingWavesResponse>(GET_PICKING_WAVES, {
    variables: {
      first: paginationArgs?.limit || 20,
      after: null,
      filter,
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const [createWave] = useMutation(CREATE_PICKING_WAVE);
  const [planWaves] = useMutation(PLAN_PICKING_WAVES);
  
  const waves = (data?.pickingWaves?.edges as WaveEdge[] | undefined)?.map((edge: WaveEdge) => edge.node) || [];
  const pageInfo = data?.pickingWaves?.pageInfo;
  const totalCount = data?.pickingWaves?.totalCount || 0;

  const create = useCallback(async (input: CreatePickingWaveInput) => {
    try {
      const result = await createWave({
        variables: { input },
        update: (cache, { data: mutationData }) => {
          if (mutationData?.createPickingWave) {
            const existingWaves = cache.readQuery({
              query: GET_PICKING_WAVES,
              variables: { first: 20, filter },
            }) as PickingWavesResponse | null;

            if (existingWaves) {
              cache.writeQuery({
                query: GET_PICKING_WAVES,
                variables: { first: 20, filter },
                data: {
                  pickingWaves: {
                    ...existingWaves.pickingWaves,
                    edges: [
                      {
                        node: mutationData.createPickingWave,
                        cursor: `wave-${Date.now()}`,
                        __typename: 'PickingWaveEdge',
                      },
                      ...existingWaves.pickingWaves.edges,
                    ],
                    totalCount: existingWaves.pickingWaves.totalCount + 1,
                  },
                },
              });
            }
          }
        },
      });
      return result.data?.createPickingWave;
    } catch (error) {
      console.error('Failed to create picking wave:', error);
      throw error;
    }
  }, [createWave, filter]);

  const planWave = useCallback(async (input: Record<string, unknown>) => {
    try {
      const result = await planWaves({
        variables: { input },
        refetchQueries: [
          { query: GET_PICKING_WAVES, variables: { first: 20, filter } },
        ],
      });
      return result.data?.planPickingWaves;
    } catch (error) {
      console.error('Failed to plan picking waves:', error);
      throw error;
    }
  }, [planWaves, filter]);

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
            pickingWaves: {
              ...fetchMoreResult.pickingWaves,
              edges: [
                ...prev.pickingWaves.edges,
                ...fetchMoreResult.pickingWaves.edges,
              ],
            },
          };
        },
      });
    } catch (error) {
      console.error('Failed to load more picking waves:', error);
      throw error;
    }
  }, [fetchMore, pageInfo, loading]);

  return {
    waves,
    loading,
    error,
    pageInfo,
    totalCount,
    refetch,
    create,
    planWave,
    loadMore,
  };
}

// ===== PICKING WAVES BY WAREHOUSE HOOK =====

/**
 * Hook for getting picking waves by warehouse
 */
export function usePickingWavesByWarehouse(warehouseId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_PICKING_WAVES_BY_WAREHOUSE, {
    variables: { warehouseId },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
  });

  const waves = data?.pickingWavesByWarehouse || [];

  // Real-time subscription for warehouse wave updates
  useSubscription(PICKING_WAVE_STATUS_CHANGED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickingWaveStatusChanged) {
        console.log('Picking wave status changed:', subscriptionData.data.pickingWaveStatusChanged);
      }
    },
  });

  return {
    waves,
    loading,
    error,
    refetch,
  };
}

// ===== PICKING WAVES BY PICKER HOOK =====

/**
 * Hook for getting picking waves assigned to a specific picker
 */
export function usePickingWavesByPicker(pickerId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_PICKING_WAVES_BY_PICKER, {
    variables: { pickerId },
    skip: !currentTenant?.id || !pickerId,
    errorPolicy: 'all',
  });

  const waves = data?.pickingWavesByPicker || [];

  return {
    waves,
    loading,
    error,
    refetch,
  };
}

// ===== OVERDUE PICKING WAVES HOOK =====

/**
 * Hook for getting overdue picking waves
 */
export function useOverduePickingWaves(warehouseId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_OVERDUE_PICKING_WAVES, {
    variables: { warehouseId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 60000, // Poll every minute for overdue waves
  });

  const overdueWaves = data?.overduePickingWaves || [];

  return {
    overdueWaves,
    loading,
    error,
    refetch,
  };
}

// ===== WAVE STATISTICS HOOK =====

/**
 * Hook for getting wave statistics with real-time updates
 */
export function useWaveStatistics(waveId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_WAVE_STATISTICS, {
    variables: { waveId },
    skip: !currentTenant?.id || !waveId,
    errorPolicy: 'all',
    pollInterval: 30000, // Poll every 30 seconds
  });

  const statistics = data?.pickingWaveStatistics;

  // Real-time subscription for statistics updates
  useSubscription(PICKING_WAVE_STATISTICS_UPDATED, {
    variables: { waveId },
    skip: !waveId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickingWaveStatisticsUpdated) {
        console.log('Wave statistics updated:', subscriptionData.data.pickingWaveStatisticsUpdated);
      }
    },
  });

  return {
    statistics,
    loading,
    error,
    refetch,
  };
}

// ===== WAVE RECOMMENDATIONS HOOK =====

/**
 * Hook for getting wave recommendations
 */
export function useWaveRecommendations(warehouseId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_WAVE_RECOMMENDATIONS, {
    variables: { warehouseId },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
  });

  const recommendations = data?.pickingWaveRecommendations || [];

  return {
    recommendations,
    loading,
    error,
    refetch,
  };
}

// ===== PICKING WAVE MANAGEMENT HOOK =====

/**
 * Combined hook for comprehensive picking wave management
 */
export function usePickingWaveManagement(warehouseId?: string) {
  const apolloClient = useApolloClient();
  const [selectedWaveId, setSelectedWaveId] = useState<string | null>(null);

  // Get all waves
  const {
    waves,
    loading: wavesLoading,
    error: wavesError,
    create: createWave,
    planWave,
    refetch: refetchWaves,
  } = usePickingWaves();

  // Get waves by warehouse if specified
  const {
    waves: warehouseWaves,
    loading: warehouseWavesLoading,
    error: warehouseWavesError,
  } = usePickingWavesByWarehouse(warehouseId || '');

  // Get overdue waves
  const {
    overdueWaves,
    loading: overdueWavesLoading,
  } = useOverduePickingWaves(warehouseId);

  // Get selected wave details
  const {
    wave: selectedWave,
    loading: selectedWaveLoading,
    error: selectedWaveError,
    update: updateWave,
    remove: deleteWave,
    release: releaseWave,
    start: startWave,
    complete: completeWave,
    cancel: cancelWave,
    assignPickersToWave,
    optimize: optimizeWave,
    canRelease,
    canStart,
    canComplete,
    canCancel,
    isActive,
    isCompleted,
    progressPercentage,
  } = usePickingWave(selectedWaveId || '');

  // Get wave statistics
  const {
    statistics: selectedWaveStatistics,
    loading: statisticsLoading,
  } = useWaveStatistics(selectedWaveId || '');

  // Get recommendations
  const {
    recommendations,
    loading: recommendationsLoading,
  } = useWaveRecommendations(warehouseId || '');

  const selectWave = useCallback((waveId: string) => {
    setSelectedWaveId(waveId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedWaveId(null);
  }, []);

  // Wave statistics
  const waveStats = useMemo(() => {
    const relevantWaves = warehouseId ? warehouseWaves : waves;
    
    const totalWaves = relevantWaves.length;
    const planningWaves = relevantWaves.filter((w: PickingWave) => w.status === PickingWaveStatus.PLANNING).length;
    const plannedWaves = relevantWaves.filter((w: PickingWave) => w.status === PickingWaveStatus.PLANNED).length;
    const releasedWaves = relevantWaves.filter((w: PickingWave) => w.status === PickingWaveStatus.RELEASED).length;
    const inProgressWaves = relevantWaves.filter((w: PickingWave) => w.status === PickingWaveStatus.IN_PROGRESS).length;
    const completedWaves = relevantWaves.filter((w: PickingWave) => w.status === PickingWaveStatus.COMPLETED).length;
    const cancelledWaves = relevantWaves.filter((w: PickingWave) => w.status === PickingWaveStatus.CANCELLED).length;
    
    const totalOrders = relevantWaves.reduce((sum: number, w: PickingWave) => sum + (w.totalOrders || 0), 0);
    const totalItems = relevantWaves.reduce((sum: number, w: PickingWave) => sum + (w.totalItems || 0), 0);
    const totalQuantity = relevantWaves.reduce((sum: number, w: PickingWave) => sum + (w.totalQuantity || 0), 0);
    
    const averageAccuracy = relevantWaves.length > 0 
      ? relevantWaves.reduce((sum: number, w: PickingWave) => sum + (w.pickingAccuracy || 0), 0) / relevantWaves.length 
      : 0;
    
    const averagePickTime = relevantWaves.length > 0 
      ? relevantWaves.reduce((sum: number, w: PickingWave) => sum + (w.averagePickTime || 0), 0) / relevantWaves.length 
      : 0;

    return {
      totalWaves,
      planningWaves,
      plannedWaves,
      releasedWaves,
      inProgressWaves,
      completedWaves,
      cancelledWaves,
      overdueWaves: overdueWaves.length,
      totalOrders,
      totalItems,
      totalQuantity,
      averageAccuracy,
      averagePickTime,
    };
  }, [waves, warehouseWaves, warehouseId, overdueWaves]);

  // Clear cache for wave data
  const clearCache = useCallback(() => {
    apolloClient.cache.evict({ fieldName: 'pickingWaves' });
    apolloClient.cache.evict({ fieldName: 'pickingWave' });
    apolloClient.cache.evict({ fieldName: 'pickingWavesByWarehouse' });
    apolloClient.cache.evict({ fieldName: 'overduePickingWaves' });
    apolloClient.cache.gc();
  }, [apolloClient]);

  return {
    // Waves list
    waves: warehouseId ? warehouseWaves : waves,
    wavesLoading: warehouseId ? warehouseWavesLoading : wavesLoading,
    wavesError: warehouseId ? warehouseWavesError : wavesError,
    createWave,
    planWave,
    refetchWaves,

    // Overdue waves
    overdueWaves,
    overdueWavesLoading,

    // Selected wave
    selectedWave,
    selectedWaveId,
    selectedWaveLoading,
    selectedWaveError,
    selectWave,
    clearSelection,
    updateWave,
    deleteWave,
    releaseWave,
    startWave,
    completeWave,
    cancelWave,
    assignPickersToWave,
    optimizeWave,

    // Wave state
    canRelease,
    canStart,
    canComplete,
    canCancel,
    isActive,
    isCompleted,
    progressPercentage,

    // Statistics and recommendations
    selectedWaveStatistics,
    statisticsLoading,
    recommendations,
    recommendationsLoading,
    waveStats,

    // Utilities
    clearCache,
  };
}

// ===== WAVE VALIDATION HOOK =====

/**
 * Hook for picking wave validation
 */
export function useWaveValidation() {
  const validateWaveName = useCallback((name: string): string | null => {
    if (!name) return 'Wave name is required';
    if (name.length < 1) return 'Wave name is required';
    if (name.length > 255) return 'Wave name must be less than 255 characters';
    return null;
  }, []);

  const validatePriority = useCallback((priority: number): string | null => {
    if (priority < 1) return 'Priority must be at least 1';
    if (priority > 10) return 'Priority cannot exceed 10';
    return null;
  }, []);

  const validateScheduledDate = useCallback((scheduledDate: Date): string | null => {
    const now = new Date();
    if (scheduledDate < now) return 'Scheduled date cannot be in the past';
    return null;
  }, []);

  const validateCreateWaveInput = useCallback((input: CreatePickingWaveInput): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!input.warehouseId) errors.warehouseId = 'Warehouse is required';

    const priorityError = validatePriority(input.priority);
    if (priorityError) errors.priority = priorityError;

    if (input.scheduledDate) {
      const dateError = validateScheduledDate(input.scheduledDate);
      if (dateError) errors.scheduledDate = dateError;
    }

    return errors;
  }, [validatePriority, validateScheduledDate]);

  return {
    validateWaveName,
    validatePriority,
    validateScheduledDate,
    validateCreateWaveInput,
  };
}