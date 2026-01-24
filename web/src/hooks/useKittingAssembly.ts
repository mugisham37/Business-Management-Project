/**
 * Kitting Assembly Operations Hooks
 * Complete set of hooks for kit assembly and component management
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  AssemblyWorkOrderStatus,
  CreateKitDefinitionInput,
  CreateAssemblyWorkOrderInput,
  OffsetPaginationArgs,

} from '@/types/warehouse';

// GraphQL Operations
import {
  GET_KIT_DEFINITION,
  GET_KIT_DEFINITIONS,
  GET_ACTIVE_KIT_DEFINITIONS,
  GET_ASSEMBLY_WORK_ORDER,
  GET_ASSEMBLY_WORK_ORDERS,
  GET_ASSEMBLY_WORK_ORDERS_BY_WAREHOUSE,
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
  ASSEMBLY_WORK_ORDER_UPDATED,
  ASSEMBLY_WORK_ORDER_STATUS_CHANGED,
  ASSEMBLY_WORK_ORDER_COMPLETED,
  COMPONENT_SHORTAGE_DETECTED,
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
      if (subscriptionData.data?.kitDefinitionUpdated) {
        apolloClient.cache.writeQuery({
          query: GET_KIT_DEFINITION,
          variables: { id: kitId },
          data: { kitDefinition: subscriptionData.data.kitDefinitionUpdated },
        });
      }
    },
  });

  const update = useCallback(async (input: CreateKitDefinitionInput) => {
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
      await deleteKitDefinition({
        variables: { id: kitDefinition.id },
        update: (cache) => {
          const kitId = cache.identify(kitDefinition);
          if (kitId) {
            cache.evict({ id: kitId });
          }
          cache.gc();
        },
      });
      return true;
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
        optimisticResponse: {
          activateKitDefinition: {
            ...kitDefinition,
            isActive: true,
            updatedAt: new Date(),
          },
        },
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
        optimisticResponse: {
          deactivateKitDefinition: {
            ...kitDefinition,
            isActive: false,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.deactivateKitDefinition;
    } catch (error) {
      console.error('Failed to deactivate kit definition:', error);
      throw error;
    }
  }, [deactivateKitDefinition, kitDefinition]);

  // Computed properties
  const isActive = useMemo(() => {
    return kitDefinition?.isActive;
  }, [kitDefinition?.isActive]);

  const componentCount = useMemo(() => {
    return kitDefinition?.components?.length || 0;
  }, [kitDefinition?.components]);

  const totalCost = useMemo(() => {
    return kitDefinition?.totalCost || 0;
  }, [kitDefinition?.totalCost]);

  const canActivate = useMemo(() => {
    return !kitDefinition?.isActive && componentCount > 0;
  }, [kitDefinition?.isActive, componentCount]);

  const canDeactivate = useMemo(() => {
    return kitDefinition?.isActive;
  }, [kitDefinition?.isActive]);

  return {
    kitDefinition,
    loading,
    error,
    refetch,
    update,
    remove,
    activate,
    deactivate,
    isActive,
    componentCount,
    totalCost,
    canActivate,
    canDeactivate,
  };
}

// ===== MULTIPLE KIT DEFINITIONS HOOK =====

/**
 * Hook for managing multiple kit definitions with pagination and filtering
 */
export function useKitDefinitions(
  paginationArgs?: OffsetPaginationArgs,
  filter?: Record<string, unknown>
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_KIT_DEFINITIONS, {
    variables: {
      first: paginationArgs?.limit || 20,
      after: null,
      filter,
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const [createKitDefinition] = useMutation(CREATE_KIT_DEFINITION);

  const kitDefinitions = data?.kitDefinitions?.edges?.map((edge: Record<string, unknown>) => edge.node) || [];
  const pageInfo = data?.kitDefinitions?.pageInfo;
  const totalCount = data?.kitDefinitions?.totalCount || 0;

  const create = useCallback(async (input: CreateKitDefinitionInput) => {
    try {
      const result = await createKitDefinition({
        variables: { input },
        update: (cache, { data: mutationData }) => {
          if (mutationData?.createKitDefinition) {
            const existingKits = cache.readQuery({
              query: GET_KIT_DEFINITIONS,
              variables: { first: 20, filter },
            });

            if (existingKits) {
              const existing = existingKits as Record<string, unknown>;
              cache.writeQuery({
                query: GET_KIT_DEFINITIONS,
                variables: { first: 20, filter },
                data: {
                  kitDefinitions: {
                    ...(existing.kitDefinitions as Record<string, unknown>),
                    edges: [
                      {
                        node: mutationData.createKitDefinition,
                        cursor: `kit-${Date.now()}`,
                        __typename: 'KitDefinitionEdge',
                      },
                      ...((existing.kitDefinitions as Record<string, unknown>).edges as unknown[]),
                    ],
                    totalCount: (((existing.kitDefinitions as Record<string, unknown>).totalCount) as number) + 1,
                  },
                },
              });
            }
          }
        },
      });
      return result.data?.createKitDefinition;
    } catch (error) {
      console.error('Failed to create kit definition:', error);
      throw error;
    }
  }, [createKitDefinition, filter]);

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
            kitDefinitions: {
              ...fetchMoreResult.kitDefinitions,
              edges: [
                ...prev.kitDefinitions.edges,
                ...fetchMoreResult.kitDefinitions.edges,
              ],
            },
          };
        },
      });
    } catch (error) {
      console.error('Failed to load more kit definitions:', error);
      throw error;
    }
  }, [fetchMore, pageInfo, loading]);

  return {
    kitDefinitions,
    loading,
    error,
    pageInfo,
    totalCount,
    refetch,
    create,
    loadMore,
  };
}

// ===== ACTIVE KIT DEFINITIONS HOOK =====

/**
 * Hook for getting active kit definitions
 */
export function useActiveKitDefinitions() {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_ACTIVE_KIT_DEFINITIONS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const activeKitDefinitions = data?.activeKitDefinitions || [];

  return {
    activeKitDefinitions,
    loading,
    error,
    refetch,
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

  const [updateWorkOrder] = useMutation(UPDATE_ASSEMBLY_WORK_ORDER);
  const [deleteWorkOrder] = useMutation(DELETE_ASSEMBLY_WORK_ORDER);
  const [startWorkOrder] = useMutation(START_ASSEMBLY_WORK_ORDER);
  const [completeWorkOrder] = useMutation(COMPLETE_ASSEMBLY_WORK_ORDER);
  const [cancelWorkOrder] = useMutation(CANCEL_ASSEMBLY_WORK_ORDER);
  const [allocateComponents] = useMutation(ALLOCATE_COMPONENTS);
  const [consumeComponents] = useMutation(CONSUME_COMPONENTS);
  const [recordQualityCheck] = useMutation(RECORD_QUALITY_CHECK);
  const [assignAssembler] = useMutation(ASSIGN_ASSEMBLER);

  const workOrder = data?.assemblyWorkOrder;

  // Real-time subscriptions
  useSubscription(ASSEMBLY_WORK_ORDER_UPDATED, {
    variables: { workOrderId },
    skip: !workOrderId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.assemblyWorkOrderUpdated) {
        apolloClient.cache.writeQuery({
          query: GET_ASSEMBLY_WORK_ORDER,
          variables: { id: workOrderId },
          data: { assemblyWorkOrder: subscriptionData.data.assemblyWorkOrderUpdated },
        });
      }
    },
  });

  const update = useCallback(async (input: Record<string, unknown>) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await updateWorkOrder({
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
  }, [updateWorkOrder, workOrder]);

  const remove = useCallback(async () => {
    if (!workOrder?.id) return false;
    
    try {
      await deleteWorkOrder({
        variables: { id: workOrder.id },
        update: (cache) => {
          const woId = cache.identify(workOrder);
          if (woId) {
            cache.evict({ id: woId });
          }
          cache.gc();
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to delete assembly work order:', error);
      throw error;
    }
  }, [deleteWorkOrder, workOrder]);

  const start = useCallback(async () => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await startWorkOrder({
        variables: { id: workOrder.id },
        optimisticResponse: {
          startAssemblyWorkOrder: {
            ...workOrder,
            status: AssemblyWorkOrderStatus.IN_PROGRESS,
            startedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.startAssemblyWorkOrder;
    } catch (error) {
      console.error('Failed to start assembly work order:', error);
      throw error;
    }
  }, [startWorkOrder, workOrder]);

  const complete = useCallback(async () => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await completeWorkOrder({
        variables: { id: workOrder.id },
        optimisticResponse: {
          completeAssemblyWorkOrder: {
            ...workOrder,
            status: AssemblyWorkOrderStatus.COMPLETED,
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.completeAssemblyWorkOrder;
    } catch (error) {
      console.error('Failed to complete assembly work order:', error);
      throw error;
    }
  }, [completeWorkOrder, workOrder]);

  const cancel = useCallback(async (reason?: string) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await cancelWorkOrder({
        variables: { id: workOrder.id, reason },
        optimisticResponse: {
          cancelAssemblyWorkOrder: {
            ...workOrder,
            status: AssemblyWorkOrderStatus.CANCELLED,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.cancelAssemblyWorkOrder;
    } catch (error) {
      console.error('Failed to cancel assembly work order:', error);
      throw error;
    }
  }, [cancelWorkOrder, workOrder]);

  const allocateWorkOrderComponents = useCallback(async (components: Record<string, unknown>[]) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await allocateComponents({
        variables: { workOrderId: workOrder.id, components },
      });
      return result.data?.allocateComponents;
    } catch (error) {
      console.error('Failed to allocate components:', error);
      throw error;
    }
  }, [allocateComponents, workOrder]);

  const consumeWorkOrderComponents = useCallback(async (components: Record<string, unknown>[]) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await consumeComponents({
        variables: { workOrderId: workOrder.id, components },
      });
      return result.data?.consumeComponents;
    } catch (error) {
      console.error('Failed to consume components:', error);
      throw error;
    }
  }, [consumeComponents, workOrder]);

  const recordQuality = useCallback(async (qualityCheck: Record<string, unknown>) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await recordQualityCheck({
        variables: { workOrderId: workOrder.id, qualityCheck },
      });
      return result.data?.recordQualityCheck;
    } catch (error) {
      console.error('Failed to record quality check:', error);
      throw error;
    }
  }, [recordQualityCheck, workOrder]);

  const assignToAssembler = useCallback(async (assemblerId: string) => {
    if (!workOrder?.id) return null;
    
    try {
      const result = await assignAssembler({
        variables: { workOrderId: workOrder.id, assemblerId },
        optimisticResponse: {
          assignAssembler: {
            ...workOrder,
            assignedTo: assemblerId,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.assignAssembler;
    } catch (error) {
      console.error('Failed to assign assembler:', error);
      throw error;
    }
  }, [assignAssembler, workOrder]);

  // Computed properties
  const isPending = useMemo(() => {
    return workOrder?.status === AssemblyWorkOrderStatus.PENDING;
  }, [workOrder?.status]);

  const isPlanned = useMemo(() => {
    return workOrder?.status === AssemblyWorkOrderStatus.PLANNED;
  }, [workOrder?.status]);

  const isInProgress = useMemo(() => {
    return workOrder?.status === AssemblyWorkOrderStatus.IN_PROGRESS;
  }, [workOrder?.status]);

  const isCompleted = useMemo(() => {
    return workOrder?.status === AssemblyWorkOrderStatus.COMPLETED;
  }, [workOrder?.status]);

  const isCancelled = useMemo(() => {
    return workOrder?.status === AssemblyWorkOrderStatus.CANCELLED;
  }, [workOrder?.status]);

  const isOnHold = useMemo(() => {
    return workOrder?.status === AssemblyWorkOrderStatus.ON_HOLD;
  }, [workOrder?.status]);

  const canStart = useMemo(() => {
    return [AssemblyWorkOrderStatus.PENDING, AssemblyWorkOrderStatus.PLANNED].includes(
      workOrder?.status as AssemblyWorkOrderStatus
    );
  }, [workOrder?.status]);

  const canComplete = useMemo(() => {
    return workOrder?.status === AssemblyWorkOrderStatus.IN_PROGRESS;
  }, [workOrder?.status]);

  const canCancel = useMemo(() => {
    return ![AssemblyWorkOrderStatus.COMPLETED, AssemblyWorkOrderStatus.CANCELLED].includes(
      workOrder?.status as AssemblyWorkOrderStatus
    );
  }, [workOrder?.status]);

  const completionPercentage = useMemo(() => {
    return workOrder?.completionPercentage || 0;
  }, [workOrder?.completionPercentage]);

  const hasComponentShortage = useMemo(() => {
    return workOrder?.hasComponentShortage || false;
  }, [workOrder?.hasComponentShortage]);

  const isOverdue = useMemo(() => {
    return workOrder?.isOverdue || false;
  }, [workOrder?.isOverdue]);

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
    allocateWorkOrderComponents,
    consumeWorkOrderComponents,
    recordQuality,
    assignToAssembler,
    isPending,
    isPlanned,
    isInProgress,
    isCompleted,
    isCancelled,
    isOnHold,
    canStart,
    canComplete,
    canCancel,
    completionPercentage,
    hasComponentShortage,
    isOverdue,
  };
}

// ===== MULTIPLE ASSEMBLY WORK ORDERS HOOK =====

/**
 * Hook for managing multiple assembly work orders with pagination and filtering
 */
export function useAssemblyWorkOrders(
  paginationArgs?: OffsetPaginationArgs,
  filter?: Record<string, unknown>
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_ASSEMBLY_WORK_ORDERS, {
    variables: {
      first: paginationArgs?.limit || 20,
      after: null,
      filter,
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const [createWorkOrder] = useMutation(CREATE_ASSEMBLY_WORK_ORDER);

  const workOrders = data?.assemblyWorkOrders?.edges?.map((edge: Record<string, unknown>) => edge.node) || [];
  const pageInfo = data?.assemblyWorkOrders?.pageInfo;
  const totalCount = data?.assemblyWorkOrders?.totalCount || 0;

  const create = useCallback(async (input: CreateAssemblyWorkOrderInput) => {
    try {
      const result = await createWorkOrder({
        variables: { input },
        update: (cache, { data: mutationData }) => {
          if (mutationData?.createAssemblyWorkOrder) {
            const existingWorkOrders = cache.readQuery({
              query: GET_ASSEMBLY_WORK_ORDERS,
              variables: { first: 20, filter },
            });

            if (existingWorkOrders) {
              const existing = existingWorkOrders as Record<string, unknown>;
              cache.writeQuery({
                query: GET_ASSEMBLY_WORK_ORDERS,
                variables: { first: 20, filter },
                data: {
                  assemblyWorkOrders: {
                    ...(existing.assemblyWorkOrders as Record<string, unknown>),
                    edges: [
                      {
                        node: mutationData.createAssemblyWorkOrder,
                        cursor: `workorder-${Date.now()}`,
                        __typename: 'AssemblyWorkOrderEdge',
                      },
                      ...((existing.assemblyWorkOrders as Record<string, unknown>).edges as unknown[]),
                    ],
                    totalCount: (((existing.assemblyWorkOrders as Record<string, unknown>).totalCount) as number) + 1,
                  },
                },
              });
            }
          }
        },
      });
      return result.data?.createAssemblyWorkOrder;
    } catch (error) {
      console.error('Failed to create assembly work order:', error);
      throw error;
    }
  }, [createWorkOrder, filter]);

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
            assemblyWorkOrders: {
              ...fetchMoreResult.assemblyWorkOrders,
              edges: [
                ...prev.assemblyWorkOrders.edges,
                ...fetchMoreResult.assemblyWorkOrders.edges,
              ],
            },
          };
        },
      });
    } catch (error) {
      console.error('Failed to load more assembly work orders:', error);
      throw error;
    }
  }, [fetchMore, pageInfo, loading]);

  return {
    workOrders,
    loading,
    error,
    pageInfo,
    totalCount,
    refetch,
    create,
    loadMore,
  };
}

// ===== WORK ORDERS BY WAREHOUSE HOOK =====

/**
 * Hook for getting work orders by warehouse
 */
export function useAssemblyWorkOrdersByWarehouse(warehouseId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_ASSEMBLY_WORK_ORDERS_BY_WAREHOUSE, {
    variables: { warehouseId },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
  });

  const workOrders = data?.assemblyWorkOrdersByWarehouse || [];

  // Real-time subscriptions for warehouse work orders
  useSubscription(ASSEMBLY_WORK_ORDER_STATUS_CHANGED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.assemblyWorkOrderStatusChanged) {
        refetch();
      }
    },
  });

  useSubscription(ASSEMBLY_WORK_ORDER_COMPLETED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.assemblyWorkOrderCompleted) {
        refetch();
      }
    },
  });

  useSubscription(COMPONENT_SHORTAGE_DETECTED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.componentShortageDetected) {
        refetch();
      }
    },
  });

  return {
    workOrders,
    loading,
    error,
    refetch,
  };
}

// ===== PENDING AND OVERDUE WORK ORDERS HOOKS =====

/**
 * Hook for getting pending assembly work orders
 */
export function usePendingAssemblyWorkOrders(warehouseId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_PENDING_ASSEMBLY_WORK_ORDERS, {
    variables: { warehouseId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 30000, // Poll every 30 seconds
  });

  const pendingWorkOrders = data?.pendingAssemblyWorkOrders || [];

  return {
    pendingWorkOrders,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for getting overdue assembly work orders
 */
export function useOverdueAssemblyWorkOrders(warehouseId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_OVERDUE_ASSEMBLY_WORK_ORDERS, {
    variables: { warehouseId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 60000, // Poll every minute
  });

  const overdueWorkOrders = data?.overdueAssemblyWorkOrders || [];

  return {
    overdueWorkOrders,
    loading,
    error,
    refetch,
  };
}

// ===== ASSEMBLY METRICS HOOK =====

/**
 * Hook for getting assembly metrics
 */
export function useAssemblyMetrics(
  kitId: string,
  startDate?: Date,
  endDate?: Date
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_ASSEMBLY_METRICS, {
    variables: { kitId, startDate, endDate },
    skip: !currentTenant?.id || !kitId,
    errorPolicy: 'all',
  });

  const metrics = data?.assemblyMetrics;

  return {
    metrics,
    loading,
    error,
    refetch,
  };
}

// ===== KIT DISASSEMBLY HOOK =====

/**
 * Hook for kit disassembly operations
 */
export function useKitDisassembly() {
  const [disassembleKit] = useMutation(DISASSEMBLE_KIT);

  const disassemble = useCallback(async (
    kitId: string,
    quantity: number,
    reason: string
  ) => {
    try {
      const result = await disassembleKit({
        variables: { kitId, quantity, reason },
      });
      return result.data?.disassembleKit;
    } catch (error) {
      console.error('Failed to disassemble kit:', error);
      throw error;
    }
  }, [disassembleKit]);

  return {
    disassemble,
  };
}

// ===== KITTING ASSEMBLY MANAGEMENT HOOK =====

/**
 * Combined hook for comprehensive kitting assembly management
 */
export function useKittingAssemblyManagement(warehouseId?: string) {
  const apolloClient = useApolloClient();
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);

  // Get all kit definitions
  const {
    kitDefinitions,
    loading: kitDefinitionsLoading,
    error: kitDefinitionsError,
    create: createKitDefinition,
    refetch: refetchKitDefinitions,
  } = useKitDefinitions();

  // Get active kit definitions
  const { activeKitDefinitions } = useActiveKitDefinitions();

  // Get all work orders
  const {
    workOrders,
    loading: workOrdersLoading,
    error: workOrdersError,
    create: createWorkOrder,
    refetch: refetchWorkOrders,
  } = useAssemblyWorkOrders();

  // Get warehouse work orders
  const {
    workOrders: warehouseWorkOrders,
    loading: warehouseWorkOrdersLoading,
  } = useAssemblyWorkOrdersByWarehouse(warehouseId || '');

  // Get pending and overdue work orders
  const { pendingWorkOrders } = usePendingAssemblyWorkOrders(warehouseId);
  const { overdueWorkOrders } = useOverdueAssemblyWorkOrders(warehouseId);

  // Get selected kit definition details
  const {
    kitDefinition: selectedKit,
    loading: selectedKitLoading,
    error: selectedKitError,
    update: updateKitDefinition,
    remove: deleteKitDefinition,
    activate: activateKitDefinition,
    deactivate: deactivateKitDefinition,
    isActive: selectedKitIsActive,
    componentCount: selectedKitComponentCount,
    totalCost: selectedKitTotalCost,
    canActivate: selectedKitCanActivate,
    canDeactivate: selectedKitCanDeactivate,
  } = useKitDefinition(selectedKitId || '');

  // Get selected work order details
  const {
    workOrder: selectedWorkOrder,
    loading: selectedWorkOrderLoading,
    error: selectedWorkOrderError,
    update: updateWorkOrder,
    remove: deleteWorkOrder,
    start: startWorkOrder,
    complete: completeWorkOrder,
    cancel: cancelWorkOrder,
    allocateWorkOrderComponents,
    consumeWorkOrderComponents,
    recordQuality,
    assignToAssembler,
    isPending: selectedWorkOrderIsPending,
    isInProgress: selectedWorkOrderIsInProgress,
    isCompleted: selectedWorkOrderIsCompleted,
    canStart: selectedWorkOrderCanStart,
    canComplete: selectedWorkOrderCanComplete,
    canCancel: selectedWorkOrderCanCancel,
    completionPercentage: selectedWorkOrderCompletion,
    hasComponentShortage: selectedWorkOrderHasShortage,
    isOverdue: selectedWorkOrderIsOverdue,
  } = useAssemblyWorkOrder(selectedWorkOrderId || '');

  // Kit disassembly
  const { disassemble: disassembleKit } = useKitDisassembly();

  const selectKit = useCallback((kitId: string) => {
    setSelectedKitId(kitId);
  }, []);

  const selectWorkOrder = useCallback((workOrderId: string) => {
    setSelectedWorkOrderId(workOrderId);
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedKitId(null);
    setSelectedWorkOrderId(null);
  }, []);

  // Assembly statistics
  const assemblyStats = useMemo(() => {
    const relevantWorkOrders = warehouseId ? warehouseWorkOrders : workOrders;
    
    const totalWorkOrders = relevantWorkOrders.length;
    const pendingCount = relevantWorkOrders.filter((wo: Record<string, unknown>) => wo.status === AssemblyWorkOrderStatus.PENDING).length;
    const plannedCount = relevantWorkOrders.filter((wo: Record<string, unknown>) => wo.status === AssemblyWorkOrderStatus.PLANNED).length;
    const inProgressCount = relevantWorkOrders.filter((wo: Record<string, unknown>) => wo.status === AssemblyWorkOrderStatus.IN_PROGRESS).length;
    const completedCount = relevantWorkOrders.filter((wo: Record<string, unknown>) => wo.status === AssemblyWorkOrderStatus.COMPLETED).length;
    const cancelledCount = relevantWorkOrders.filter((wo: Record<string, unknown>) => wo.status === AssemblyWorkOrderStatus.CANCELLED).length;
    const onHoldCount = relevantWorkOrders.filter((wo: Record<string, unknown>) => wo.status === AssemblyWorkOrderStatus.ON_HOLD).length;

    const totalQuantityToAssemble = relevantWorkOrders.reduce((sum: number, wo: Record<string, unknown>) => sum + ((typeof wo.quantityToAssemble === 'number' ? wo.quantityToAssemble : 0) || 0), 0);
    const totalQuantityAssembled = relevantWorkOrders.reduce((sum: number, wo: Record<string, unknown>) => sum + ((typeof wo.quantityAssembled === 'number' ? wo.quantityAssembled : 0) || 0), 0);

    const completedWorkOrders = relevantWorkOrders.filter((wo: Record<string, unknown>) => 
      wo.status === AssemblyWorkOrderStatus.COMPLETED && wo.actualDuration
    );
    
    const averageAssemblyTime = completedWorkOrders.length > 0
      ? completedWorkOrders.reduce((sum: number, wo: Record<string, unknown>) => sum + ((typeof wo.actualDuration === 'number' ? wo.actualDuration : 0) || 0), 0) / completedWorkOrders.length
      : 0;

    const qualityPassRate = completedWorkOrders.length > 0
      ? completedWorkOrders.reduce((sum: number, wo: Record<string, unknown>) => {
          const total = typeof wo.qualityChecksTotal === 'number' ? wo.qualityChecksTotal : 0;
          const passed = typeof wo.qualityChecksPassed === 'number' ? wo.qualityChecksPassed : 0;
          return sum + (total > 0 ? (passed / total) * 100 : 100);
        }, 0) / completedWorkOrders.length
      : 0;

    return {
      totalWorkOrders,
      pendingCount,
      plannedCount,
      inProgressCount,
      completedCount,
      cancelledCount,
      onHoldCount,
      overdueCount: overdueWorkOrders.length,
      totalQuantityToAssemble,
      totalQuantityAssembled,
      averageAssemblyTime,
      qualityPassRate,
    };
  }, [workOrders, warehouseWorkOrders, warehouseId, overdueWorkOrders]);

  const kitStats = useMemo(() => {
    const totalKits = kitDefinitions.length;
    const activeKits = kitDefinitions.filter((kit: Record<string, unknown>) => kit.isActive).length;
    const inactiveKits = kitDefinitions.filter((kit: Record<string, unknown>) => !kit.isActive).length;

    const totalComponents = kitDefinitions.reduce((sum: number, kit: Record<string, unknown>) => 
      sum + ((Array.isArray(kit.components) ? kit.components.length : 0) || 0), 0
    );

    const averageComponentsPerKit = totalKits > 0 ? totalComponents / totalKits : 0;

    return {
      totalKits,
      activeKits,
      inactiveKits,
      totalComponents,
      averageComponentsPerKit,
    };
  }, [kitDefinitions]);

  // Clear cache for assembly data
  const clearCache = useCallback(() => {
    apolloClient.cache.evict({ fieldName: 'kitDefinitions' });
    apolloClient.cache.evict({ fieldName: 'kitDefinition' });
    apolloClient.cache.evict({ fieldName: 'activeKitDefinitions' });
    apolloClient.cache.evict({ fieldName: 'assemblyWorkOrders' });
    apolloClient.cache.evict({ fieldName: 'assemblyWorkOrder' });
    apolloClient.cache.evict({ fieldName: 'assemblyWorkOrdersByWarehouse' });
    apolloClient.cache.evict({ fieldName: 'pendingAssemblyWorkOrders' });
    apolloClient.cache.evict({ fieldName: 'overdueAssemblyWorkOrders' });
    apolloClient.cache.gc();
  }, [apolloClient]);

  return {
    // Kit definitions
    kitDefinitions,
    activeKitDefinitions,
    kitDefinitionsLoading,
    kitDefinitionsError,
    createKitDefinition,
    refetchKitDefinitions,

    // Work orders
    workOrders: warehouseId ? warehouseWorkOrders : workOrders,
    workOrdersLoading: warehouseId ? warehouseWorkOrdersLoading : workOrdersLoading,
    workOrdersError,
    createWorkOrder,
    refetchWorkOrders,

    // Pending and overdue
    pendingWorkOrders,
    overdueWorkOrders,

    // Selected kit
    selectedKit,
    selectedKitId,
    selectedKitLoading,
    selectedKitError,
    selectKit,
    updateKitDefinition,
    deleteKitDefinition,
    activateKitDefinition,
    deactivateKitDefinition,
    selectedKitIsActive,
    selectedKitComponentCount,
    selectedKitTotalCost,
    selectedKitCanActivate,
    selectedKitCanDeactivate,

    // Selected work order
    selectedWorkOrder,
    selectedWorkOrderId,
    selectedWorkOrderLoading,
    selectedWorkOrderError,
    selectWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    startWorkOrder,
    completeWorkOrder,
    cancelWorkOrder,
    allocateWorkOrderComponents,
    consumeWorkOrderComponents,
    recordQuality,
    assignToAssembler,
    selectedWorkOrderIsPending,
    selectedWorkOrderIsInProgress,
    selectedWorkOrderIsCompleted,
    selectedWorkOrderCanStart,
    selectedWorkOrderCanComplete,
    selectedWorkOrderCanCancel,
    selectedWorkOrderCompletion,
    selectedWorkOrderHasShortage,
    selectedWorkOrderIsOverdue,

    // Selection management
    clearSelections,

    // Kit operations
    disassembleKit,

    // Statistics
    assemblyStats,
    kitStats,

    // Utilities
    clearCache,
  };
}