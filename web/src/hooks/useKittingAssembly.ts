/**
 * Kitting and Assembly Management Hooks
 * Complete set of hooks for kit definition and assembly work order operations
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useSubscription, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  KitDefinition,
  AssemblyWorkOrder,
  KitType,
  AssemblyWorkOrderStatus,
  AssemblyPriority,
  ComponentStatus,
  QualityResult,
  CreateKitDefinitionInput,
  UpdateKitDefinitionInput,
  CreateAssemblyWorkOrderInput,
  UpdateAssemblyWorkOrderInput,
  PaginationArgs,
  KitDefinitionConnection,
  AssemblyWorkOrderConnection,
} from '@/types/warehouse';

// GraphQL Operations
import {
  GET_KIT_DEFINITION,
  GET_KIT_DEFINITIONS,
  GET_KIT_DEFINITION_BY_SKU,
  GET_ACTIVE_KIT_DEFINITIONS,
  GET_ASSEMBLY_WORK_ORDER,
  GET_ASSEMBLY_WORK_ORDERS,
  GET_ASSEMBLY_WORK_ORDERS_BY_KIT,
  GET_ASSEMBLY_WORK_ORDERS_BY_ASSEMBLER,
  GET_PENDING_ASSEMBLY_WORK_ORDERS,
  GET_OVERDUE_ASSEMBLY_WORK_ORDERS,
  GET_ASSEMBLY_METRICS,
} from '@/graphql/queries/warehouse-queries';

import {
  CREATE_KIT_DEFINITION,
  UPDATE_KIT_DEFINITION,
  DELETE_KIT_DEFINITION,
  ACTIVATE_KIT_DEFINITION,
  DEACTIVATE_KIT_DEFINITION,
  CREATE_ASSEMBLY_WORK_ORDER,
  UPDATE_ASSEMBLY_WORK_ORDER,
  DELETE_ASSEMBLY_WORK_ORDER,
  START_ASSEMBLY_WORK_ORDER,
  COMPLETE_ASSEMBLY_WORK_ORDER,
  CANCEL_ASSEMBLY_WORK_ORDER,
  ALLOCATE_COMPONENTS,
  CONSUME_COMPONENTS,
  RECORD_QUALITY_CHECK,
  ASSIGN_ASSEMBLER,
  DISASSEMBLE_KIT,
} from '@/graphql/mutations/warehouse-mutations';

import {
  KIT_DEFINITION_UPDATED,
  KIT_DEFINITION_STATUS_CHANGED,
  ASSEMBLY_WORK_ORDER_UPDATED,
  ASSEMBLY_WORK_ORDER_STATUS_CHANGED,
  ASSEMBLY_WORK_ORDER_COMPLETED,
  COMPONENT_SHORTAGE_DETECTED,
  ASSEMBLY_PROGRESS_UPDATED,
} from '@/graphql/subscriptions/warehouse-subscriptions';

// ===== SINGLE KIT DEFINITION HOOK =====

/**
 * Hook for managing a single kit definition
 */
export function useKitDefinition(kitId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const apolloClient = useApolloClient();
  
  const { data, loading, error, refetch } = useQuery(GET_KIT_DEFINITION, {
    variables: { id: kitId },
    skip: !currentTenant?.id || !kitId,
    errorPolicy: 'all',
  });

  const [updateKitDefinition] = useMutation(UPDATE_KIT_DEFINITION);
  const [deleteKitDefinition] = useMutation(DELETE_KIT_DEFINITION);
  const [activateKitDefinition] = useMutation(ACTIVATE_KIT_DEFINITION);
  const [deactivateKitDefinition] = useMutation(DEACTIVATE_KIT_DEFINITION);

  const kitDefinition = data?.kitDefinition;

  // Real-time subscriptions
  useSubscription(KIT_DEFINITION_UPDATED, {
    variables: { kitId },
    skip: !kitId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.kitDefinitionUpdated?.id === kitId) {
        apolloClient.cache.writeQuery({
          query: GET_KIT_DEFINITION,
          variables: { id: kitId },
          data: { kitDefinition: subscriptionData.data.kitDefinitionUpdated },
        });
      }
    },
  });

  const update = useCallback(async (input: UpdateKitDefinitionInput) => {
    if (!kitDefinition?.id) return null;
    
    try {
      const result = await updateKitDefinition({
        variables: { id: kitDefinition.id, input },
        optimisticResponse: {
          updateKitDefinition: {
            ...kitDefinition,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateKitDefinition;
    } catch (error) {
      console.error('Failed to update kit definition:', error);
      throw error;
    }
  }, [updateKitDefinition, kitDefinition]);

  const remove = useCallback(async () => {
    if (!kitDefinition?.id) return false;
    
    try {
      const result = await deleteKitDefinition({
        variables: { id: kitDefinition.id },
        refetchQueries: [
          { query: GET_KIT_DEFINITIONS, variables: { first: 20 } },
        ],
      });
      return result.data?.deleteKitDefinition?.success || false;
    } catch (error) {
      console.error('Failed to delete kit definition:', error);
      throw error;
    }
  }, [deleteKitDefinition, kitDefinition]);

  const activate = useCallback(async () => {
    if (!kitDefinition?.id) return null;
    
    try {
      const result = await activateKitDefinition({
        variables: { id: kitDefinition.id },
      });
      return result.data?.activateKitDefinition;
    } catch (error) {
      console.error('Failed to activate kit definition:', error);
      throw error;
    }
  }, [activateKitDefinition, kitDefinition]);

  const deactivate = useCallback(async () => {
    if (!kitDefinition?.id) return null;
    
    try {
      const result = await deactivateKitDefinition({
        variables: { id: kitDefinition.id },
      });
      return result.data?.deactivateKitDefinition;
    } catch (error) {
      console.error('Failed to deactivate kit definition:', error);
      throw error;
    }
  }, [deactivateKitDefinition, kitDefinition]);

  // Computed properties
  const totalComponents = useMemo(() => {
    return kitDefinition?.components?.length || 0;
  }, [kitDefinition]);

  const requiredComponents = useMemo(() => {
    return kitDefinition?.components?.filter(component => !component.isOptional).length || 0;
  }, [kitDefinition]);

  const optionalComponents = useMemo(() => {
    return kitDefinition?.components?.filter(component => component.isOptional).length || 0;
  }, [kitDefinition]);

  const totalQualityChecks = useMemo(() => {
    return kitDefinition?.qualityChecks?.length || 0;
  }, [kitDefinition]);

  const requiredQualityChecks = useMemo(() => {
    return kitDefinition?.qualityChecks?.filter(check => check.isRequired).length || 0;
  }, [kitDefinition]);

  const isActive = useMemo(() => {
    return kitDefinition?.isActive === true;
  }, [kitDefinition]);

  const canActivate = useMemo(() => {
    return !isActive && totalComponents > 0;
  }, [isActive, totalComponents]);

  const canDeactivate = useMemo(() => {
    return isActive;
  }, [isActive]);

  return {
    kitDefinition,
    loading,
    error,
    refetch,
    update,
    remove,
    activate,
    deactivate,
    totalComponents,
    requiredComponents,
    optionalComponents,
    totalQualityChecks,
    requiredQualityChecks,
    isActive,
    canActivate,
    canDeactivate,
  };
}

// ===== MULTIPLE KIT DEFINITIONS HOOK =====

/**
 * Hook for managing multiple kit definitions
 */
export function useKitDefinitions(
  paginationArgs?: PaginationArgs,
  filter?: any
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_KIT_DEFINITIONS, {
    variables: { 
      first: paginationArgs?.first || 20,
      after: paginationArgs?.after,
      filter,
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const { data: activeData, loading: activeLoading } = useQuery(GET_ACTIVE_KIT_DEFINITIONS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const [createKitDefinition] = useMutation(CREATE_KIT_DEFINITION);

  const kitDefinitions = useMemo(() => {
    return data?.kitDefinitions?.edges?.map(edge => edge.node) || [];
  }, [data]);

  const activeKitDefinitions = activeData?.activeKitDefinitions || [];

  const create = useCallback(async (input: CreateKitDefinitionInput) => {
    try {
      const result = await createKitDefinition({
        variables: { input },
        refetchQueries: [
          { query: GET_KIT_DEFINITIONS, variables: { first: 20, filter } },
          { query: GET_ACTIVE_KIT_DEFINITIONS },
        ],
      });
      return result.data?.createKitDefinition;
    } catch (error) {
      console.error('Failed to create kit definition:', error);
      throw error;
    }
  }, [createKitDefinition, filter]);

  // Statistics
  const kitsByType = useMemo(() => {
    const grouped: Record<KitType, KitDefinition[]> = {} as any;
    
    kitDefinitions.forEach((kit: KitDefinition) => {
      if (!grouped[kit.kitType]) {
        grouped[kit.kitType] = [];
      }
      grouped[kit.kitType].push(kit);
    });
    
    return grouped;
  }, [kitDefinitions]);

  const activeKitsCount = useMemo(() => {
    return activeKitDefinitions.length;
  }, [activeKitDefinitions]);

  const inactiveKitsCount = useMemo(() => {
    return kitDefinitions.filter((kit: KitDefinition) => !kit.isActive).length;
  }, [kitDefinitions]);

  return {
    kitDefinitions,
    activeKitDefinitions,
    kitsByType,
    activeKitsCount,
    inactiveKitsCount,
    loading: loading || activeLoading,
    error,
    refetch,
    create,
  };
}

// ===== SINGLE ASSEMBLY WORK ORDER HOOK =====

/**
 * Hook for managing a single assembly work order
 */
export function useAssemblyWorkOrder(workOrderId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const apolloClient = useApolloClient();
  
  const { data, loading, error, refetch } = useQuery(GET_ASSEMBLY_WORK_ORDER, {
    variables: { id: workOrderId },
    skip: !currentTenant?.id || !workOrderId,
    errorPolicy: 'all',
  });

  const [updateAssemblyWorkOrder] = useMutation(UPDATE_ASSEMBLY_WORK_ORDER);
  const [deleteAssemblyWorkOrder] = useMutation(DELETE_ASSEMBLY_WORK_ORDER);
  const [startAssemblyWorkOrder] = useMutation(START_ASSEMBLY_WORK_ORDER);
  const [completeAssemblyWorkOrder] = useMutation(COMPLETE_ASSEMBLY_WORK_ORDER);
  const [cancelAssemblyWorkOrder] = useMutation(CANCEL_ASSEMBLY_WORK_ORDER);
  const [allocateComponents] = useMutation(ALLOCATE_COMPONENTS);
  const [consumeComponents] = useMutation(CONSUME_COMPONENTS);
  const [recordQualityCheck] = useMutation(RECORD_QUALITY_CHECK);
  const [assignAssembler] = useMutation(ASSIGN_ASSEMBLER);
  const [disassembleKit] = useMutation(DISASSEMBLE_KIT);

  const workOrder = data?.assemblyWorkOrder;

  // Real-time subscriptions
  useSubscription(ASSEMBLY_WORK_ORDER_UPDATED, {
    variables: { warehouseId: workOrder?.warehouseId },
    skip: !workOrder?.warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.assemblyWorkOrderUpdated?.id === workOrderId) {
        apolloClient.cache.writeQuery({
          query: GET_ASSEMBLY_WORK_ORDER,
          variables: { id: workOrderId },
          data: { assemblyWorkOrder: subscriptionData.data.assemblyWorkOrderUpdated },
        });
      }
    },
  });

  useSubscription(ASSEMBLY_PROGRESS_UPDATED, {
    variables: { workOrderId },
    skip: !workOrderId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.assemblyProgressUpdated) {
        refetch();
      }
    },
  });

  useSubscription(COMPONENT_SHORTAGE_DETECTED, {
    variables: { warehouseId: workOrder?.warehouseId },
    skip: !workOrder?.warehouseId,
    onData: ({ data: subscriptionData }) => {
      const shortageData = subscriptionData.data?.componentShortageDetected;
      if (shortageData?.workOrderId === workOrderId) {
        refetch();
      }
    },
  });

  const update = useCallback(async (input: UpdateAssemblyWorkOrderInput) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await updateAssemblyWorkOrder({
        variables: { id: workOrder.id, input },
        optimisticResponse: {
          updateAssemblyWorkOrder: {
            ...workOrder,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateAssemblyWorkOrder;
    } catch (error) {
      console.error('Failed to update assembly work order:', error);
      throw error;
    }
  }, [updateAssemblyWorkOrder, workOrder]);

  const remove = useCallback(async () => {
    if (!workOrder?.id) return false;
    
    try {
      const result = await deleteAssemblyWorkOrder({
        variables: { id: workOrder.id },
      });
      return result.data?.deleteAssemblyWorkOrder?.success || false;
    } catch (error) {
      console.error('Failed to delete assembly work order:', error);
      throw error;
    }
  }, [deleteAssemblyWorkOrder, workOrder]);

  const start = useCallback(async () => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await startAssemblyWorkOrder({
        variables: { id: workOrder.id },
      });
      return result.data?.startAssemblyWorkOrder;
    } catch (error) {
      console.error('Failed to start assembly work order:', error);
      throw error;
    }
  }, [startAssemblyWorkOrder, workOrder]);

  const complete = useCallback(async () => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await completeAssemblyWorkOrder({
        variables: { id: workOrder.id },
      });
      return result.data?.completeAssemblyWorkOrder;
    } catch (error) {
      console.error('Failed to complete assembly work order:', error);
      throw error;
    }
  }, [completeAssemblyWorkOrder, workOrder]);

  const cancel = useCallback(async () => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await cancelAssemblyWorkOrder({
        variables: { id: workOrder.id },
      });
      return result.data?.cancelAssemblyWorkOrder;
    } catch (error) {
      console.error('Failed to cancel assembly work order:', error);
      throw error;
    }
  }, [cancelAssemblyWorkOrder, workOrder]);

  const allocateComponentsForOrder = useCallback(async (input: any) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await allocateComponents({
        variables: { id: workOrder.id, input },
      });
      return result.data?.allocateComponents;
    } catch (error) {
      console.error('Failed to allocate components:', error);
      throw error;
    }
  }, [allocateComponents, workOrder]);

  const consumeComponentsForOrder = useCallback(async (componentIds: string[]) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await consumeComponents({
        variables: { id: workOrder.id, componentIds },
      });
      return result.data?.consumeComponents;
    } catch (error) {
      console.error('Failed to consume components:', error);
      throw error;
    }
  }, [consumeComponents, workOrder]);

  const recordQualityCheckForOrder = useCallback(async (input: any) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await recordQualityCheck({
        variables: { id: workOrder.id, input },
      });
      return result.data?.recordQualityCheck;
    } catch (error) {
      console.error('Failed to record quality check:', error);
      throw error;
    }
  }, [recordQualityCheck, workOrder]);

  const assignAssemblerToOrder = useCallback(async (assemblerId: string) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await assignAssembler({
        variables: { id: workOrder.id, assemblerId },
      });
      return result.data?.assignAssembler;
    } catch (error) {
      console.error('Failed to assign assembler:', error);
      throw error;
    }
  }, [assignAssembler, workOrder]);

  const disassemble = useCallback(async (reason: string) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await disassembleKit({
        variables: { workOrderId: workOrder.id, reason },
      });
      return result.data?.disassembleKit;
    } catch (error) {
      console.error('Failed to disassemble kit:', error);
      throw error;
    }
  }, [disassembleKit, workOrder]);

  // Computed properties
  const completionPercentage = useMemo(() => {
    if (!workOrder?.quantityToAssemble || workOrder.quantityToAssemble === 0) return 0;
    return (workOrder.quantityCompleted / workOrder.quantityToAssemble) * 100;
  }, [workOrder]);

  const assemblyProgress = useMemo(() => {
    if (!workOrder?.quantityToAssemble || workOrder.quantityToAssemble === 0) return 0;
    return (workOrder.quantityAssembled / workOrder.quantityToAssemble) * 100;
  }, [workOrder]);

  const hasComponentShortage = useMemo(() => {
    return workOrder?.components?.some(component => 
      component.status === ComponentStatus.SHORTAGE
    ) || false;
  }, [workOrder]);

  const isOverdue = useMemo(() => {
    if (!workOrder?.estimatedCompletionTime) return false;
    const now = new Date();
    const estimated = new Date(workOrder.estimatedCompletionTime);
    return now > estimated && workOrder.status !== AssemblyWorkOrderStatus.COMPLETED;
  }, [workOrder]);

  const canStart = useMemo(() => {
    return workOrder?.status === AssemblyWorkOrderStatus.PENDING;
  }, [workOrder]);

  const canComplete = useMemo(() => {
    return workOrder?.status === AssemblyWorkOrderStatus.IN_PROGRESS;
  }, [workOrder]);

  const canCancel = useMemo(() => {
    return [
      AssemblyWorkOrderStatus.PENDING,
      AssemblyWorkOrderStatus.IN_PROGRESS,
      AssemblyWorkOrderStatus.ON_HOLD,
    ].includes(workOrder?.status as AssemblyWorkOrderStatus);
  }, [workOrder]);

  const isAssigned = useMemo(() => {
    return !!workOrder?.assemblerId;
  }, [workOrder]);

  const estimatedCost = useMemo(() => {
    if (!workOrder?.components) return 0;
    // This would typically be calculated based on component costs
    return workOrder.components.reduce((total, component) => {
      // Placeholder calculation - would need actual component pricing
      return total + (component.quantityRequired * 10); // $10 per component as example
    }, 0);
  }, [workOrder]);

  return {
    workOrder,
    loading,
    error,
    refetch,
    update,
    remove,
    start,
    complete,
    cancel,
    allocateComponentsForOrder,
    consumeComponentsForOrder,
    recordQualityCheckForOrder,
    assignAssemblerToOrder,
    disassemble,
    completionPercentage,
    assemblyProgress,
    hasComponentShortage,
    isOverdue,
    canStart,
    canComplete,
    canCancel,
    isAssigned,
    estimatedCost,
  };
}

// ===== MULTIPLE ASSEMBLY WORK ORDERS HOOK =====

/**
 * Hook for managing multiple assembly work orders
 */
export function useAssemblyWorkOrders(
  warehouseId: string,
  paginationArgs?: PaginationArgs,
  filter?: any
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_ASSEMBLY_WORK_ORDERS, {
    variables: { 
      warehouseId,
      first: paginationArgs?.first || 20,
      after: paginationArgs?.after,
      filter,
    },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
  });

  const { data: pendingData, loading: pendingLoading } = useQuery(GET_PENDING_ASSEMBLY_WORK_ORDERS, {
    variables: { warehouseId },
    skip: !warehouseId,
    errorPolicy: 'all',
  });

  const { data: overdueData, loading: overdueLoading } = useQuery(GET_OVERDUE_ASSEMBLY_WORK_ORDERS, {
    variables: { warehouseId },
    skip: !warehouseId,
    errorPolicy: 'all',
  });

  const [createAssemblyWorkOrder] = useMutation(CREATE_ASSEMBLY_WORK_ORDER);

  const workOrders = useMemo(() => {
    return data?.assemblyWorkOrders?.edges?.map(edge => edge.node) || [];
  }, [data]);

  const pendingWorkOrders = pendingData?.pendingAssemblyWorkOrders || [];
  const overdueWorkOrders = overdueData?.overdueAssemblyWorkOrders || [];

  const create = useCallback(async (input: CreateAssemblyWorkOrderInput) => {
    try {
      const result = await createAssemblyWorkOrder({
        variables: { input: { ...input, warehouseId } },
        refetchQueries: [
          { 
            query: GET_ASSEMBLY_WORK_ORDERS, 
            variables: { warehouseId, first: 20, filter } 
          },
          { query: GET_PENDING_ASSEMBLY_WORK_ORDERS, variables: { warehouseId } },
        ],
      });
      return result.data?.createAssemblyWorkOrder;
    } catch (error) {
      console.error('Failed to create assembly work order:', error);
      throw error;
    }
  }, [createAssemblyWorkOrder, warehouseId, filter]);

  // Statistics
  const workOrdersByStatus = useMemo(() => {
    const grouped: Record<AssemblyWorkOrderStatus, AssemblyWorkOrder[]> = {} as any;
    
    workOrders.forEach((workOrder: AssemblyWorkOrder) => {
      if (!grouped[workOrder.status]) {
        grouped[workOrder.status] = [];
      }
      grouped[workOrder.status].push(workOrder);
    });
    
    return grouped;
  }, [workOrders]);

  const activeWorkOrders = useMemo(() => {
    return workOrders.filter((workOrder: AssemblyWorkOrder) => 
      [
        AssemblyWorkOrderStatus.PENDING,
        AssemblyWorkOrderStatus.IN_PROGRESS,
        AssemblyWorkOrderStatus.ON_HOLD,
      ].includes(workOrder.status)
    );
  }, [workOrders]);

  const completedWorkOrders = useMemo(() => {
    return workOrders.filter((workOrder: AssemblyWorkOrder) => 
      workOrder.status === AssemblyWorkOrderStatus.COMPLETED
    );
  }, [workOrders]);

  return {
    workOrders,
    pendingWorkOrders,
    overdueWorkOrders,
    workOrdersByStatus,
    activeWorkOrders,
    completedWorkOrders,
    loading: loading || pendingLoading || overdueLoading,
    error,
    refetch,
    create,
  };
}

// ===== ASSEMBLY METRICS HOOK =====

/**
 * Hook for assembly performance metrics
 */
export function useAssemblyMetrics(warehouseId: string, dateRange?: any) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_ASSEMBLY_METRICS, {
    variables: { warehouseId, dateRange },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
    pollInterval: 60000, // Poll every minute
  });

  const metrics = data?.assemblyMetrics;

  const performanceScore = useMemo(() => {
    if (!metrics) return 0;
    
    const {
      assemblyAccuracy = 0,
      utilizationRate = 0,
      throughputPerHour = 0,
    } = metrics;
    
    // Calculate weighted performance score
    const accuracyScore = assemblyAccuracy * 0.4;
    const utilizationScore = utilizationRate * 0.3;
    const throughputScore = Math.min(throughputPerHour / 50, 1) * 0.3; // Normalize to 50 units/hour
    
    return Math.round((accuracyScore + utilizationScore + throughputScore) * 100);
  }, [metrics]);

  const alerts = useMemo(() => {
    if (!metrics) return [];
    
    const alerts = [];
    
    if (metrics.componentShortages > 0) {
      alerts.push({
        type: 'warning',
        message: `${metrics.componentShortages} component shortages detected`,
        severity: 'high',
      });
    }
    
    if (metrics.qualityFailures > 0) {
      alerts.push({
        type: 'error',
        message: `${metrics.qualityFailures} quality failures recorded`,
        severity: 'medium',
      });
    }
    
    if (metrics.overdueWorkOrders > 0) {
      alerts.push({
        type: 'warning',
        message: `${metrics.overdueWorkOrders} work orders are overdue`,
        severity: 'high',
      });
    }
    
    return alerts;
  }, [metrics]);

  return {
    metrics,
    performanceScore,
    alerts,
    loading,
    error,
    refetch,
  };
}

// ===== KITTING ASSEMBLY MANAGEMENT HOOK =====

/**
 * Combined hook for comprehensive kitting and assembly management
 */
export function useKittingAssemblyManagement(warehouseId: string) {
  const [selectedKitId, setSelectedKitId] = useState<string>('');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>('');
  
  const {
    kitDefinitions,
    activeKitDefinitions,
    kitsByType,
    activeKitsCount,
    inactiveKitsCount,
    loading: kitsLoading,
    error: kitsError,
    create: createKit,
    refetch: refetchKits,
  } = useKitDefinitions();

  const {
    kitDefinition: selectedKit,
    loading: kitLoading,
    error: kitError,
    update: updateKit,
    remove: deleteKit,
    activate: activateKit,
    deactivate: deactivateKit,
    isActive: selectedKitIsActive,
    canActivate: selectedKitCanActivate,
    canDeactivate: selectedKitCanDeactivate,
  } = useKitDefinition(selectedKitId);

  const {
    workOrders,
    pendingWorkOrders,
    overdueWorkOrders,
    workOrdersByStatus,
    activeWorkOrders,
    completedWorkOrders,
    loading: workOrdersLoading,
    error: workOrdersError,
    create: createWorkOrder,
    refetch: refetchWorkOrders,
  } = useAssemblyWorkOrders(warehouseId);

  const {
    workOrder: selectedWorkOrder,
    loading: workOrderLoading,
    error: workOrderError,
    update: updateWorkOrder,
    start: startWorkOrder,
    complete: completeWorkOrder,
    cancel: cancelWorkOrder,
    assignAssemblerToOrder,
    allocateComponentsForOrder,
    consumeComponentsForOrder,
    recordQualityCheckForOrder,
    completionPercentage: selectedWorkOrderCompletion,
    hasComponentShortage: selectedWorkOrderHasShortage,
    isOverdue: selectedWorkOrderIsOverdue,
    canStart: selectedWorkOrderCanStart,
    canComplete: selectedWorkOrderCanComplete,
    canCancel: selectedWorkOrderCanCancel,
  } = useAssemblyWorkOrder(selectedWorkOrderId);

  const {
    metrics,
    performanceScore,
    alerts,
    loading: metricsLoading,
  } = useAssemblyMetrics(warehouseId);

  const selectKit = useCallback((kitId: string) => {
    setSelectedKitId(kitId);
  }, []);

  const selectWorkOrder = useCallback((workOrderId: string) => {
    setSelectedWorkOrderId(workOrderId);
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedKitId('');
    setSelectedWorkOrderId('');
  }, []);

  const isLoading = kitsLoading || kitLoading || workOrdersLoading || workOrderLoading || metricsLoading;
  const error = kitsError || kitError || workOrdersError || workOrderError;

  return {
    // Kit Definitions
    kitDefinitions,
    activeKitDefinitions,
    kitsByType,
    activeKitsCount,
    inactiveKitsCount,
    selectedKit,
    selectedKitId,
    selectKit,
    
    // Work Orders
    workOrders,
    pendingWorkOrders,
    overdueWorkOrders,
    workOrdersByStatus,
    activeWorkOrders,
    completedWorkOrders,
    selectedWorkOrder,
    selectedWorkOrderId,
    selectWorkOrder,
    
    // Selection Management
    clearSelections,
    
    // Kit Operations
    createKit,
    updateKit,
    deleteKit,
    activateKit,
    deactivateKit,
    refetchKits,
    
    // Work Order Operations
    createWorkOrder,
    updateWorkOrder,
    startWorkOrder,
    completeWorkOrder,
    cancelWorkOrder,
    assignAssemblerToOrder,
    allocateComponentsForOrder,
    consumeComponentsForOrder,
    recordQualityCheckForOrder,
    refetchWorkOrders,
    
    // Kit State
    selectedKitIsActive,
    selectedKitCanActivate,
    selectedKitCanDeactivate,
    
    // Work Order State
    selectedWorkOrderCompletion,
    selectedWorkOrderHasShortage,
    selectedWorkOrderIsOverdue,
    selectedWorkOrderCanStart,
    selectedWorkOrderCanComplete,
    selectedWorkOrderCanCancel,
    
    // Metrics
    metrics,
    performanceScore,
    alerts,
    
    // State
    isLoading,
    error,
  };
}