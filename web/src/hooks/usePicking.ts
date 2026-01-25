/**
 * Picking Operations Hooks
 * Complete set of hooks for picking wave and pick list operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  PickingWave,
  PickList,
  PickingWaveStatus,
  PickListStatus,
  CreatePickingWaveInput,
  UpdatePickingWaveInput,
  CreatePickListInput,
  UpdatePickListInput,
  PaginationArgs,
  CursorPaginationArgs,
  Edge,
} from '@/types/warehouse';

// GraphQL Operations
import {
  GET_PICKING_WAVE,
  GET_PICKING_WAVES,
  GET_PICKING_WAVES_BY_PICKER,
  GET_WAVE_STATISTICS,
  GET_OVERDUE_PICKING_WAVES,
  GET_PICK_LIST,
  GET_PICK_LISTS,
  GET_PICK_LISTS_BY_PICKER,
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
  CREATE_PICK_LIST,
  ASSIGN_PICK_LIST,
  RECORD_PICK,
  COMPLETE_PICK_LIST,
  UPDATE_PICK_LIST,
  DELETE_PICK_LIST,
} from '@/graphql/mutations/warehouse-mutations';

import {
  PICKING_WAVE_UPDATED,
  PICKING_WAVE_STATUS_CHANGED,
  PICKING_WAVE_STATISTICS_UPDATED,
  PICK_LIST_ASSIGNED,
  PICK_LIST_UPDATED,
  PICK_RECORDED,
  PICKER_ASSIGNED_TO_WAVE,
  PICKING_WAVE_COMPLETED,
} from '@/graphql/subscriptions/warehouse-subscriptions';

// ===== SINGLE PICKING WAVE HOOK =====

/**
 * Hook for managing a single picking wave
 */
export function usePickingWave(waveId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const apolloClient = useApolloClient();
  
  const { data, loading, error, refetch } = useQuery(GET_PICKING_WAVE, {
    variables: { id: waveId },
    skip: !currentTenant?.id || !waveId,
    errorPolicy: 'all',
  });

  const { data: statisticsData, loading: statisticsLoading } = useQuery(GET_WAVE_STATISTICS, {
    variables: { waveId },
    skip: !waveId,
    errorPolicy: 'all',
    pollInterval: 30000, // Poll every 30 seconds
  });

  const [updatePickingWave] = useMutation(UPDATE_PICKING_WAVE);
  const [deletePickingWave] = useMutation(DELETE_PICKING_WAVE);
  const [releasePickingWave] = useMutation(RELEASE_PICKING_WAVE);
  const [startPickingWave] = useMutation(START_PICKING_WAVE);
  const [completePickingWave] = useMutation(COMPLETE_PICKING_WAVE);
  const [cancelPickingWave] = useMutation(CANCEL_PICKING_WAVE);
  const [assignPickersToWave] = useMutation(ASSIGN_PICKERS_TO_WAVE);
  const [optimizePickingWave] = useMutation(OPTIMIZE_PICKING_WAVE);

  const wave = data?.pickingWave;
  const statistics = statisticsData?.pickingWaveStatistics;

  // Real-time subscriptions
  useSubscription(PICKING_WAVE_UPDATED, {
    variables: { warehouseId: wave?.warehouseId },
    skip: !wave?.warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickingWaveUpdated?.id === waveId) {
        apolloClient.cache.writeQuery({
          query: GET_PICKING_WAVE,
          variables: { id: waveId },
          data: { pickingWave: subscriptionData.data.pickingWaveUpdated },
        });
      }
    },
  });

  useSubscription(PICKING_WAVE_STATUS_CHANGED, {
    variables: { warehouseId: wave?.warehouseId },
    skip: !wave?.warehouseId,
    onData: ({ data: subscriptionData }) => {
      const statusData = subscriptionData.data?.pickingWaveStatusChanged;
      if (statusData?.waveId === waveId) {
        refetch();
      }
    },
  });

  useSubscription(PICKING_WAVE_STATISTICS_UPDATED, {
    variables: { waveId },
    skip: !waveId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickingWaveStatisticsUpdated) {
        apolloClient.cache.writeQuery({
          query: GET_WAVE_STATISTICS,
          variables: { waveId },
          data: { pickingWaveStatistics: subscriptionData.data.pickingWaveStatisticsUpdated },
        });
      }
    },
  });

  const update = useCallback(async (input: UpdatePickingWaveInput) => {
    if (!wave?.id) return null;
    
    try {
      const result = await updatePickingWave({
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
  }, [updatePickingWave, wave]);

  const remove = useCallback(async () => {
    if (!wave?.id) return false;
    
    try {
      const result = await deletePickingWave({
        variables: { id: wave.id },
        refetchQueries: [
          { 
            query: GET_PICKING_WAVES, 
            variables: { warehouseId: wave.warehouseId, first: 20 } 
          },
        ],
      });
      return result.data?.deletePickingWave?.success || false;
    } catch (error) {
      console.error('Failed to delete picking wave:', error);
      throw error;
    }
  }, [deletePickingWave, wave]);

  const release = useCallback(async () => {
    if (!wave?.id) return null;
    
    try {
      const result = await releasePickingWave({
        variables: { id: wave.id },
      });
      return result.data?.releasePickingWave;
    } catch (error) {
      console.error('Failed to release picking wave:', error);
      throw error;
    }
  }, [releasePickingWave, wave]);

  const start = useCallback(async () => {
    if (!wave?.id) return null;
    
    try {
      const result = await startPickingWave({
        variables: { id: wave.id },
      });
      return result.data?.startPickingWave;
    } catch (error) {
      console.error('Failed to start picking wave:', error);
      throw error;
    }
  }, [startPickingWave, wave]);

  const complete = useCallback(async () => {
    if (!wave?.id) return null;
    
    try {
      const result = await completePickingWave({
        variables: { id: wave.id },
      });
      return result.data?.completePickingWave;
    } catch (error) {
      console.error('Failed to complete picking wave:', error);
      throw error;
    }
  }, [completePickingWave, wave]);

  const cancel = useCallback(async () => {
    if (!wave?.id) return null;
    
    try {
      const result = await cancelPickingWave({
        variables: { id: wave.id },
      });
      return result.data?.cancelPickingWave;
    } catch (error) {
      console.error('Failed to cancel picking wave:', error);
      throw error;
    }
  }, [cancelPickingWave, wave]);

  const assignPickers = useCallback(async (pickerIds: string[]) => {
    if (!wave?.id) return null;
    
    try {
      const result = await assignPickersToWave({
        variables: { id: wave.id, input: { pickerIds } },
      });
      return result.data?.assignPickersToWave;
    } catch (error) {
      console.error('Failed to assign pickers to wave:', error);
      throw error;
    }
  }, [assignPickersToWave, wave]);

  const optimize = useCallback(async () => {
    if (!wave?.id) return null;
    
    try {
      const result = await optimizePickingWave({
        variables: { id: wave.id },
      });
      return result.data?.optimizePickingWave;
    } catch (error) {
      console.error('Failed to optimize picking wave:', error);
      throw error;
    }
  }, [optimizePickingWave, wave]);

  // Computed properties
  const canRelease = useMemo(() => {
    return wave?.status === PickingWaveStatus.PLANNED;
  }, [wave]);

  const canStart = useMemo(() => {
    return wave?.status === PickingWaveStatus.RELEASED || wave?.status === PickingWaveStatus.READY;
  }, [wave]);

  const canComplete = useMemo(() => {
    return wave?.status === PickingWaveStatus.IN_PROGRESS;
  }, [wave]);

  const canCancel = useMemo(() => {
    return [PickingWaveStatus.PLANNED, PickingWaveStatus.RELEASED, PickingWaveStatus.READY].includes(wave?.status as PickingWaveStatus);
  }, [wave]);

  const isActive = useMemo(() => {
    return [PickingWaveStatus.RELEASED, PickingWaveStatus.READY, PickingWaveStatus.IN_PROGRESS].includes(wave?.status as PickingWaveStatus);
  }, [wave]);

  const isCompleted = useMemo(() => {
    return wave?.status === PickingWaveStatus.COMPLETED;
  }, [wave]);

  const isCancelled = useMemo(() => {
    return wave?.status === PickingWaveStatus.CANCELLED;
  }, [wave]);

  const completionPercentage = useMemo(() => {
    if (!statistics) return 0;
    return statistics.completionPercentage || 0;
  }, [statistics]);

  const estimatedTimeRemaining = useMemo(() => {
    if (!statistics?.estimatedCompletionTime) return null;
    const now = new Date();
    const estimated = new Date(statistics.estimatedCompletionTime);
    return estimated.getTime() - now.getTime();
  }, [statistics]);

  return {
    wave,
    statistics,
    loading: loading || statisticsLoading,
    error,
    refetch,
    update,
    remove,
    release,
    start,
    complete,
    cancel,
    assignPickers,
    optimize,
    canRelease,
    canStart,
    canComplete,
    canCancel,
    isActive,
    isCompleted,
    isCancelled,
    completionPercentage,
    estimatedTimeRemaining,
  };
}

// ===== MULTIPLE PICKING WAVES HOOK =====

/**
 * Hook for managing multiple picking waves with pagination and filtering
 */
export function usePickingWaves(
  warehouseId: string,
  paginationArgs?: PaginationArgs,
  filter?: Record<string, unknown>
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const cursorPagination = paginationArgs as CursorPaginationArgs | undefined;
  
  const { data, loading, error, refetch } = useQuery(GET_PICKING_WAVES, {
    variables: { 
      warehouseId,
      first: cursorPagination?.first || 20,
      after: cursorPagination?.after,
      filter,
    },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const { data: overdueData, loading: overdueLoading } = useQuery(GET_OVERDUE_PICKING_WAVES, {
    variables: { warehouseId },
    skip: !warehouseId,
    errorPolicy: 'all',
    pollInterval: 60000, // Poll every minute
  });

  const [createPickingWave] = useMutation(CREATE_PICKING_WAVE);
  const [planPickingWaves] = useMutation(PLAN_PICKING_WAVES);

  const waves = useMemo(() => {
    return data?.pickingWaves?.edges?.map((edge: Edge<PickingWave>) => edge.node) || [];
  }, [data]);

  const overdueWaves = overdueData?.overduePickingWaves || [];

  const pageInfo = useMemo(() => {
    return data?.pickingWaves?.pageInfo;
  }, [data]);

  const totalCount = useMemo(() => {
    return data?.pickingWaves?.totalCount || 0;
  }, [data]);
  
  // Compute pagination flags directly from pageInfo
  const hasNextPage = pageInfo?.hasNextPage ?? false;
  const hasPreviousPage = pageInfo?.hasPreviousPage ?? false;

  // Real-time subscriptions
  useSubscription(PICKING_WAVE_UPDATED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickingWaveUpdated) {
        refetch();
      }
    },
  });

  useSubscription(PICKING_WAVE_COMPLETED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickingWaveCompleted) {
        refetch();
      }
    },
  });

  const loadMore = useCallback(async () => {
    if (!hasNextPage || loading) return;

    try {
      await refetch({
        after: pageInfo?.endCursor,
      });
    } catch (error) {
      console.error('Failed to load more picking waves:', error);
    }
  }, [refetch, hasNextPage, loading, pageInfo]);

  const create = useCallback(async (input: CreatePickingWaveInput) => {
    try {
      const result = await createPickingWave({
        variables: { input: { ...input, warehouseId } },
        refetchQueries: [
          { 
            query: GET_PICKING_WAVES, 
            variables: { warehouseId, first: 20, filter } 
          },
        ],
      });
      return result.data?.createPickingWave;
    } catch (error) {
      console.error('Failed to create picking wave:', error);
      throw error;
    }
  }, [createPickingWave, warehouseId, filter]);

  const planWaves = useCallback(async (input: CreatePickingWaveInput) => {
    try {
      const result = await planPickingWaves({
        variables: { input: { ...input, warehouseId } },
        refetchQueries: [
          { 
            query: GET_PICKING_WAVES, 
            variables: { warehouseId, first: 20, filter } 
          },
        ],
      });
      return result.data?.planPickingWaves;
    } catch (error) {
      console.error('Failed to plan picking waves:', error);
      throw error;
    }
  }, [planPickingWaves, warehouseId, filter]);

  // Statistics
  const wavesByStatus = useMemo(() => {
    const grouped: Record<PickingWaveStatus, PickingWave[]> = Object.values(PickingWaveStatus).reduce((acc, status) => {
      acc[status] = [];
      return acc;
    }, {} as Record<PickingWaveStatus, PickingWave[]>);
    
    waves.forEach((wave: PickingWave) => {
      if (!grouped[wave.status]) {
        grouped[wave.status] = [];
      }
      grouped[wave.status].push(wave);
    });
    
    return grouped;
  }, [waves]);

  const activeWaves = useMemo(() => {
    return waves.filter((wave: PickingWave) => 
      [PickingWaveStatus.RELEASED, PickingWaveStatus.READY, PickingWaveStatus.IN_PROGRESS].includes(wave.status)
    );
  }, [waves]);

  const completedWaves = useMemo(() => {
    return waves.filter((wave: PickingWave) => wave.status === PickingWaveStatus.COMPLETED);
  }, [waves]);

  const averagePickTime = useMemo(() => {
    const completedWithTime = completedWaves.filter((wave: PickingWave) => wave.actualDuration);
    if (completedWithTime.length === 0) return 0;
    
    const totalTime = completedWithTime.reduce((sum: number, wave: PickingWave) => 
      sum + (wave.actualDuration || 0), 0
    );
    return totalTime / completedWithTime.length;
  }, [completedWaves]);

  const averageAccuracy = useMemo(() => {
    const completedWithAccuracy = completedWaves.filter((wave: PickingWave) => wave.pickingAccuracy);
    if (completedWithAccuracy.length === 0) return 0;
    
    const totalAccuracy = completedWithAccuracy.reduce((sum: number, wave: PickingWave) => 
      sum + (wave.pickingAccuracy || 0), 0
    );
    return totalAccuracy / completedWithAccuracy.length;
  }, [completedWaves]);

  return {
    waves,
    overdueWaves,
    wavesByStatus,
    activeWaves,
    completedWaves,
    loading: loading || overdueLoading,
    error,
    totalCount,
    hasNextPage,
    hasPreviousPage,
    pageInfo,
    averagePickTime,
    averageAccuracy,
    refetch,
    loadMore,
    create,
    planWaves,
  };
}

// ===== SINGLE PICK LIST HOOK =====

/**
 * Hook for managing a single pick list
 */
export function usePickList(pickListId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const apolloClient = useApolloClient();
  
  const { data, loading, error, refetch } = useQuery(GET_PICK_LIST, {
    variables: { id: pickListId },
    skip: !currentTenant?.id || !pickListId,
    errorPolicy: 'all',
  });

  const [updatePickList] = useMutation(UPDATE_PICK_LIST);
  const [assignPickList] = useMutation(ASSIGN_PICK_LIST);
  const [recordPick] = useMutation(RECORD_PICK);
  const [completePickList] = useMutation(COMPLETE_PICK_LIST);
  const [deletePickList] = useMutation(DELETE_PICK_LIST);

  const pickList = data?.pickList;

  // Real-time subscriptions
  useSubscription(PICK_LIST_UPDATED, {
    variables: { warehouseId: pickList?.warehouseId },
    skip: !pickList?.warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickListUpdated?.id === pickListId) {
        apolloClient.cache.writeQuery({
          query: GET_PICK_LIST,
          variables: { id: pickListId },
          data: { pickList: subscriptionData.data.pickListUpdated },
        });
      }
    },
  });

  useSubscription(PICK_RECORDED, {
    variables: { pickListId },
    skip: !pickListId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickRecorded) {
        refetch();
      }
    },
  });

  const update = useCallback(async (input: UpdatePickListInput) => {
    if (!pickList?.id) return null;
    
    try {
      const result = await updatePickList({
        variables: { id: pickList.id, input },
        optimisticResponse: {
          updatePickList: {
            ...pickList,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updatePickList;
    } catch (error) {
      console.error('Failed to update pick list:', error);
      throw error;
    }
  }, [updatePickList, pickList]);

  const assign = useCallback(async (pickerId: string) => {
    if (!pickList?.id) return null;
    
    try {
      const result = await assignPickList({
        variables: { id: pickList.id, pickerId },
      });
      return result.data?.assignPickList;
    } catch (error) {
      console.error('Failed to assign pick list:', error);
      throw error;
    }
  }, [assignPickList, pickList]);

  const recordPickItem = useCallback(async (input: Record<string, unknown>) => {
    if (!pickList?.id) return null;
    
    try {
      const result = await recordPick({
        variables: { id: pickList.id, input },
      });
      return result.data?.recordPick;
    } catch (error) {
      console.error('Failed to record pick:', error);
      throw error;
    }
  }, [recordPick, pickList]);

  const complete = useCallback(async () => {
    if (!pickList?.id) return null;
    
    try {
      const result = await completePickList({
        variables: { id: pickList.id },
      });
      return result.data?.completePickList;
    } catch (error) {
      console.error('Failed to complete pick list:', error);
      throw error;
    }
  }, [completePickList, pickList]);

  const remove = useCallback(async () => {
    if (!pickList?.id) return false;
    
    try {
      const result = await deletePickList({
        variables: { id: pickList.id },
      });
      return result.data?.deletePickList?.success || false;
    } catch (error) {
      console.error('Failed to delete pick list:', error);
      throw error;
    }
  }, [deletePickList, pickList]);

  // Computed properties
  const completionPercentage = useMemo(() => {
    if (!pickList?.totalItems || pickList.totalItems === 0) return 0;
    return (pickList.pickedItems / pickList.totalItems) * 100;
  }, [pickList]);

  const accuracy = useMemo(() => {
    if (!pickList?.pickedItems || pickList.pickedItems === 0) return 100;
    const totalPicked = pickList.pickedItems + (pickList.shortItems || 0);
    return (pickList.pickedItems / totalPicked) * 100;
  }, [pickList]);

  const isAssigned = useMemo(() => {
    return !!pickList?.pickerId;
  }, [pickList]);

  const isInProgress = useMemo(() => {
    return pickList?.status === PickListStatus.IN_PROGRESS;
  }, [pickList]);

  const isCompleted = useMemo(() => {
    return pickList?.status === PickListStatus.COMPLETED;
  }, [pickList]);

  const canStart = useMemo(() => {
    return pickList?.status === PickListStatus.ASSIGNED && isAssigned;
  }, [pickList, isAssigned]);

  const canComplete = useMemo(() => {
    return pickList?.status === PickListStatus.IN_PROGRESS;
  }, [pickList]);

  return {
    pickList,
    loading,
    error,
    refetch,
    update,
    assign,
    recordPickItem,
    complete,
    remove,
    completionPercentage,
    accuracy,
    isAssigned,
    isInProgress,
    isCompleted,
    canStart,
    canComplete,
  };
}

// ===== MULTIPLE PICK LISTS HOOK =====

/**
 * Hook for managing multiple pick lists
 */
export function usePickLists(
  warehouseId: string,
  paginationArgs?: PaginationArgs,
  filter?: Record<string, unknown>
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const cursorPagination = paginationArgs as CursorPaginationArgs | undefined;
  
  const { data, loading, error, refetch } = useQuery(GET_PICK_LISTS, {
    variables: { 
      warehouseId,
      first: cursorPagination?.first || 20,
      after: cursorPagination?.after,
      filter,
    },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const [createPickList] = useMutation(CREATE_PICK_LIST);

  const pickLists = useMemo(() => {
    return data?.pickLists?.edges?.map((edge: Edge<PickList>) => edge.node) || [];
  }, [data]);

  const create = useCallback(async (input: CreatePickListInput) => {
    try {
      const result = await createPickList({
        variables: { input: { ...input, warehouseId } },
        refetchQueries: [
          { 
            query: GET_PICK_LISTS, 
            variables: { warehouseId, first: 20, filter } 
          },
        ],
      });
      return result.data?.createPickList;
    } catch (error) {
      console.error('Failed to create pick list:', error);
      throw error;
    }
  }, [createPickList, warehouseId, filter]);

  return {
    pickLists,
    loading,
    error,
    refetch,
    create,
  };
}

// ===== PICKER ASSIGNMENTS HOOK =====

/**
 * Hook for managing picker assignments
 */
export function usePickerAssignments(pickerId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data: waveData, loading: waveLoading } = useQuery(GET_PICKING_WAVES_BY_PICKER, {
    variables: { pickerId },
    skip: !currentTenant?.id || !pickerId,
    errorPolicy: 'all',
  });

  const { data: pickListData, loading: pickListLoading } = useQuery(GET_PICK_LISTS_BY_PICKER, {
    variables: { pickerId },
    skip: !currentTenant?.id || !pickerId,
    errorPolicy: 'all',
  });

  const assignedWaves = useMemo(() => 
    waveData?.pickingWavesByPicker || [], 
    [waveData]
  );
  
  const assignedPickLists = useMemo(() => 
    pickListData?.pickListsByPicker || [], 
    [pickListData]
  );

  // Real-time subscriptions
  useSubscription(PICKER_ASSIGNED_TO_WAVE, {
    variables: { pickerId },
    skip: !pickerId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickerAssignedToWave) {
        // Refetch assignments
      }
    },
  });

  useSubscription(PICK_LIST_ASSIGNED, {
    variables: { pickerId },
    skip: !pickerId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.pickListAssigned) {
        // Refetch assignments
      }
    },
  });

  const activeAssignments = useMemo(() => {
    const activeWaves = assignedWaves.filter((wave: PickingWave) => 
      [PickingWaveStatus.RELEASED, PickingWaveStatus.READY, PickingWaveStatus.IN_PROGRESS].includes(wave.status)
    );
    
    const activePickLists = assignedPickLists.filter((pickList: PickList) => 
      [PickListStatus.ASSIGNED, PickListStatus.IN_PROGRESS].includes(pickList.status)
    );
    
    return {
      waves: activeWaves,
      pickLists: activePickLists,
      totalActive: activeWaves.length + activePickLists.length,
    };
  }, [assignedWaves, assignedPickLists]);

  const workload = useMemo(() => {
    const totalItems = assignedPickLists.reduce((sum: number, pickList: PickList) => 
      sum + (pickList.totalItems || 0), 0
    );
    
    const completedItems = assignedPickLists.reduce((sum: number, pickList: PickList) => 
      sum + (pickList.pickedItems || 0), 0
    );
    
    return {
      totalItems,
      completedItems,
      remainingItems: totalItems - completedItems,
      completionPercentage: totalItems > 0 ? (completedItems / totalItems) * 100 : 0,
    };
  }, [assignedPickLists]);

  return {
    assignedWaves,
    assignedPickLists,
    activeAssignments,
    workload,
    loading: waveLoading || pickListLoading,
  };
}

// ===== PICKING MANAGEMENT HOOK =====

/**
 * Combined hook for comprehensive picking management
 */
export function usePickingManagement(warehouseId: string) {
  const [selectedWaveId, setSelectedWaveId] = useState<string>('');
  const [selectedPickListId, setSelectedPickListId] = useState<string>('');
  
  const {
    waves,
    overdueWaves,
    wavesByStatus,
    activeWaves,
    loading: wavesLoading,
    error: wavesError,
    averagePickTime,
    averageAccuracy,
    create: createWave,
    planWaves,
    refetch: refetchWaves,
  } = usePickingWaves(warehouseId);

  const {
    wave: selectedWave,
    statistics: selectedWaveStatistics,
    loading: waveLoading,
    error: waveError,
    release: releaseWave,
    start: startWave,
    complete: completeWave,
    cancel: cancelWave,
    assignPickers: assignPickersToWave,
    optimize: optimizeWave,
    canRelease,
    canStart,
    canComplete,
    canCancel,
    isActive: selectedWaveIsActive,
    completionPercentage: selectedWaveCompletion,
  } = usePickingWave(selectedWaveId);

  const {
    pickLists,
    loading: pickListsLoading,
    error: pickListsError,
    create: createPickList,
    refetch: refetchPickLists,
  } = usePickLists(warehouseId);

  const {
    pickList: selectedPickList,
    loading: pickListLoading,
    error: pickListError,
    assign: assignPickList,
    recordPickItem,
    complete: completePickList,
    completionPercentage: selectedPickListCompletion,
    accuracy: selectedPickListAccuracy,
    isAssigned: selectedPickListIsAssigned,
    canStart: selectedPickListCanStart,
    canComplete: selectedPickListCanComplete,
  } = usePickList(selectedPickListId);

  const selectWave = useCallback((waveId: string) => {
    setSelectedWaveId(waveId);
  }, []);

  const selectPickList = useCallback((pickListId: string) => {
    setSelectedPickListId(pickListId);
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedWaveId('');
    setSelectedPickListId('');
  }, []);

  const isLoading = wavesLoading || waveLoading || pickListsLoading || pickListLoading;
  const error = wavesError || waveError || pickListsError || pickListError;

  // Performance metrics
  const performanceMetrics = useMemo(() => {
    return {
      totalWaves: waves.length,
      activeWaves: activeWaves.length,
      overdueWaves: overdueWaves.length,
      averagePickTime,
      averageAccuracy,
      wavesByStatus: Object.keys(wavesByStatus).map(status => ({
        status,
        count: wavesByStatus[status as PickingWaveStatus].length,
      })),
    };
  }, [waves, activeWaves, overdueWaves, averagePickTime, averageAccuracy, wavesByStatus]);

  return {
    // Waves
    waves,
    overdueWaves,
    activeWaves,
    selectedWave,
    selectedWaveId,
    selectedWaveStatistics,
    selectWave,
    
    // Pick Lists
    pickLists,
    selectedPickList,
    selectedPickListId,
    selectPickList,
    
    // Selection Management
    clearSelections,
    
    // Wave Operations
    createWave,
    planWaves,
    releaseWave,
    startWave,
    completeWave,
    cancelWave,
    assignPickersToWave,
    optimizeWave,
    refetchWaves,
    
    // Pick List Operations
    createPickList,
    assignPickList,
    recordPickItem,
    completePickList,
    refetchPickLists,
    
    // Wave State
    canRelease,
    canStart,
    canComplete,
    canCancel,
    selectedWaveIsActive,
    selectedWaveCompletion,
    
    // Pick List State
    selectedPickListCompletion,
    selectedPickListAccuracy,
    selectedPickListIsAssigned,
    selectedPickListCanStart,
    selectedPickListCanComplete,
    
    // Performance
    performanceMetrics,
    
    // State
    isLoading,
    error,
  };
}