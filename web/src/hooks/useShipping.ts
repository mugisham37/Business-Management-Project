/**
 * Shipping Operations Hooks
 * Complete set of hooks for shipping and shipment management
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  Shipment,
  ShipmentStatus,
  CreateShipmentInput,
  ShipmentFilterInput,
  Address,
  ShipmentDimensions,
  OffsetPaginationArgs,
} from '@/types/warehouse';

// GraphQL Operations
import {
  GET_SHIPMENT,
  GET_SHIPMENTS,
  GET_SHIPMENTS_BY_WAREHOUSE,
  GET_PENDING_SHIPMENTS,
  GET_IN_TRANSIT_SHIPMENTS,
  GET_DELIVERED_SHIPMENTS,
  GET_EXCEPTION_SHIPMENTS,
  GET_SHIPPING_RATES,
  GET_TRACKING_EVENTS,
  GET_SHIPPING_METRICS,
} from '@/graphql/queries/warehouse-queries';

import {
  CREATE_SHIPMENT,
  CANCEL_SHIPMENT,
  UPDATE_SHIPMENT_STATUS,
  TRACK_SHIPMENT,
  UPDATE_ALL_TRACKING_INFO,
  CONFIRM_DELIVERY,
  GENERATE_RETURN_LABEL,
  VALIDATE_ADDRESS,
  SCHEDULE_PICKUP,
} from '@/graphql/mutations/warehouse-mutations';

import {
  SHIPMENT_UPDATED,
  TRACKING_EVENT_ADDED,
  SHIPMENT_DELIVERED,
  SHIPMENT_EXCEPTION,
} from '@/graphql/subscriptions/warehouse-subscriptions';

// ===== SINGLE SHIPMENT HOOK =====

/**
 * Hook for managing a single shipment
 */
export function useShipment(shipmentId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const apolloClient = useApolloClient();
  
  const { data, loading, error, refetch } = useQuery(GET_SHIPMENT, {
    variables: { id: shipmentId },
    skip: !currentTenant?.id || !shipmentId,
    errorPolicy: 'all',
  });

  const [cancelShipment] = useMutation(CANCEL_SHIPMENT);
  const [updateShipmentStatus] = useMutation(UPDATE_SHIPMENT_STATUS);
  const [trackShipment] = useMutation(TRACK_SHIPMENT);
  const [confirmDelivery] = useMutation(CONFIRM_DELIVERY);
  const [generateReturnLabel] = useMutation(GENERATE_RETURN_LABEL);

  const shipment = data?.shipment;

  // Real-time subscriptions
  useSubscription(SHIPMENT_UPDATED, {
    variables: { shipmentId },
    skip: !shipmentId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.shipmentUpdated) {
        apolloClient.cache.writeQuery({
          query: GET_SHIPMENT,
          variables: { id: shipmentId },
          data: { shipment: subscriptionData.data.shipmentUpdated },
        });
      }
    },
  });

  useSubscription(TRACKING_EVENT_ADDED, {
    variables: { trackingNumber: shipment?.trackingNumber },
    skip: !shipment?.trackingNumber,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.trackingEventAdded) {
        refetch();
      }
    },
  });

  const cancel = useCallback(async (reason?: string) => {
    if (!shipment?.id) return null;
    
    try {
      const result = await cancelShipment({
        variables: { shipmentId: shipment.id, reason },
        optimisticResponse: {
          cancelShipment: true,
        },
      });
      
      if (result.data?.cancelShipment) {
        refetch();
      }
      
      return result.data?.cancelShipment;
    } catch (error) {
      console.error('Failed to cancel shipment:', error);
      throw error;
    }
  }, [cancelShipment, shipment, refetch]);

  const updateStatus = useCallback(async (status: ShipmentStatus) => {
    if (!shipment?.id) return null;
    
    try {
      const result = await updateShipmentStatus({
        variables: { shipmentId: shipment.id, status },
        optimisticResponse: {
          updateShipmentStatus: {
            ...shipment,
            status,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateShipmentStatus;
    } catch (error) {
      console.error('Failed to update shipment status:', error);
      throw error;
    }
  }, [updateShipmentStatus, shipment]);

  const track = useCallback(async () => {
    if (!shipment?.trackingNumber) return null;
    
    try {
      const result = await trackShipment({
        variables: { trackingNumber: shipment.trackingNumber },
      });
      
      if (result.data?.trackShipment) {
        refetch();
      }
      
      return result.data?.trackShipment;
    } catch (error) {
      console.error('Failed to track shipment:', error);
      throw error;
    }
  }, [trackShipment, shipment, refetch]);

  const confirmShipmentDelivery = useCallback(async (
    deliveryDate?: Date, 
    signature?: string
  ) => {
    if (!shipment?.id) return null;
    
    try {
      const result = await confirmDelivery({
        variables: { 
          shipmentId: shipment.id, 
          deliveryDate, 
          signature 
        },
        optimisticResponse: {
          confirmDelivery: {
            ...shipment,
            status: ShipmentStatus.DELIVERED,
            actualDeliveryDate: deliveryDate || new Date(),
            signature,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.confirmDelivery;
    } catch (error) {
      console.error('Failed to confirm delivery:', error);
      throw error;
    }
  }, [confirmDelivery, shipment]);

  const generateReturn = useCallback(async (reason?: string) => {
    if (!shipment?.id) return null;
    
    try {
      const result = await generateReturnLabel({
        variables: { shipmentId: shipment.id, reason },
      });
      return result.data?.generateReturnLabel;
    } catch (error) {
      console.error('Failed to generate return label:', error);
      throw error;
    }
  }, [generateReturnLabel, shipment]);

  // Computed properties
  const isPending = useMemo(() => {
    return shipment?.status === ShipmentStatus.PENDING;
  }, [shipment?.status]);

  const isProcessing = useMemo(() => {
    return shipment?.status === ShipmentStatus.PROCESSING;
  }, [shipment?.status]);

  const isShipped = useMemo(() => {
    return [ShipmentStatus.SHIPPED, ShipmentStatus.IN_TRANSIT].includes(shipment?.status as ShipmentStatus);
  }, [shipment?.status]);

  const isDelivered = useMemo(() => {
    return shipment?.status === ShipmentStatus.DELIVERED || shipment?.isDelivered;
  }, [shipment?.status, shipment?.isDelivered]);

  const hasException = useMemo(() => {
    return shipment?.status === ShipmentStatus.EXCEPTION || shipment?.hasException;
  }, [shipment?.status, shipment?.hasException]);

  const isCancelled = useMemo(() => {
    return shipment?.status === ShipmentStatus.CANCELLED;
  }, [shipment?.status]);

  const canCancel = useMemo(() => {
    return [ShipmentStatus.PENDING, ShipmentStatus.PROCESSING].includes(shipment?.status as ShipmentStatus);
  }, [shipment?.status]);

  const canTrack = useMemo(() => {
    return !!shipment?.trackingNumber && isShipped;
  }, [shipment?.trackingNumber, isShipped]);

  const transitDays = useMemo(() => {
    if (!shipment?.shippedDate) return 0;
    
    const shippedDate = new Date(shipment.shippedDate);
    const currentDate = shipment.actualDeliveryDate ? new Date(shipment.actualDeliveryDate) : new Date();
    
    return Math.ceil((currentDate.getTime() - shippedDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [shipment]);

  const isOnTime = useMemo(() => {
    if (!shipment?.estimatedDeliveryDate || !shipment?.actualDeliveryDate) return null;
    
    const estimated = new Date(shipment.estimatedDeliveryDate);
    const actual = new Date(shipment.actualDeliveryDate);
    
    return actual <= estimated;
  }, [shipment]);

  return {
    shipment,
    loading,
    error,
    refetch,
    cancel,
    updateStatus,
    track,
    confirmShipmentDelivery,
    generateReturn,
    isPending,
    isProcessing,
    isShipped,
    isDelivered,
    hasException,
    isCancelled,
    canCancel,
    canTrack,
    transitDays,
    isOnTime,
  };
}

// ===== MULTIPLE SHIPMENTS HOOK =====

/**
 * Hook for managing multiple shipments with pagination and filtering
 */
export function useShipments(
  paginationArgs?: OffsetPaginationArgs,
  filter?: ShipmentFilterInput
) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  interface ShipmentEdge {
    node: Record<string, unknown>;
    cursor: string;
  }

  interface ShipmentsResponse {
    shipments: {
      edges: ShipmentEdge[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      totalCount: number;
    };
  }
  
  const { data, loading, error, refetch, fetchMore } = useQuery<ShipmentsResponse>(GET_SHIPMENTS, {
    variables: {
      first: paginationArgs?.limit || 20,
      after: null,
      filter,
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const [createShipment] = useMutation(CREATE_SHIPMENT);
  const [updateAllTracking] = useMutation(UPDATE_ALL_TRACKING_INFO);

  const shipments = data?.shipments?.edges?.map(edge => edge.node) || [];
  const pageInfo = data?.shipments?.pageInfo;
  const totalCount = data?.shipments?.totalCount || 0;

  const create = useCallback(async (input: CreateShipmentInput) => {
    try {
      const result = await createShipment({
        variables: { input },
        update: (cache, { data: mutationData }) => {
          if (mutationData?.createShipment) {
            const existingShipments = cache.readQuery({
              query: GET_SHIPMENTS,
              variables: { first: 20, filter },
            }) as ShipmentsResponse | null;

            if (existingShipments) {
              cache.writeQuery({
                query: GET_SHIPMENTS,
                variables: { first: 20, filter },
                data: {
                  shipments: {
                    ...existingShipments.shipments,
                    edges: [
                      {
                        node: mutationData.createShipment,
                        cursor: `shipment-${Date.now()}`,
                        __typename: 'ShipmentEdge',
                      },
                      ...existingShipments.shipments.edges,
                    ],
                    totalCount: existingShipments.shipments.totalCount + 1,
                  },
                },
              });
            }
          }
        },
      });
      return result.data?.createShipment;
    } catch (error) {
      console.error('Failed to create shipment:', error);
      throw error;
    }
  }, [createShipment, filter]);

  const updateAllTrackingInfo = useCallback(async (warehouseId?: string) => {
    try {
      const result = await updateAllTracking({
        variables: { warehouseId },
      });
      
      if (result.data?.updateAllTrackingInfo) {
        refetch();
      }
      
      return result.data?.updateAllTrackingInfo;
    } catch (error) {
      console.error('Failed to update all tracking info:', error);
      throw error;
    }
  }, [updateAllTracking, refetch]);

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
            shipments: {
              ...fetchMoreResult.shipments,
              edges: [
                ...prev.shipments.edges,
                ...fetchMoreResult.shipments.edges,
              ],
            },
          };
        },
      });
    } catch (error) {
      console.error('Failed to load more shipments:', error);
      throw error;
    }
  }, [fetchMore, pageInfo, loading]);

  return {
    shipments,
    loading,
    error,
    pageInfo,
    totalCount,
    refetch,
    create,
    updateAllTrackingInfo,
    loadMore,
  };
}

// ===== SHIPMENTS BY WAREHOUSE HOOK =====

/**
 * Hook for getting shipments by warehouse
 */
export function useShipmentsByWarehouse(warehouseId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_SHIPMENTS_BY_WAREHOUSE, {
    variables: { warehouseId },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
  });

  const shipments = data?.shipmentsByWarehouse || [];

  // Real-time subscriptions for warehouse shipments
  useSubscription(SHIPMENT_DELIVERED, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.shipmentDelivered) {
        refetch();
      }
    },
  });

  useSubscription(SHIPMENT_EXCEPTION, {
    variables: { warehouseId },
    skip: !warehouseId,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.shipmentException) {
        refetch();
      }
    },
  });

  return {
    shipments,
    loading,
    error,
    refetch,
  };
}

// ===== SHIPMENT STATUS HOOKS =====

/**
 * Hook for getting pending shipments
 */
export function usePendingShipments(warehouseId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_PENDING_SHIPMENTS, {
    variables: { warehouseId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 30000, // Poll every 30 seconds
  });

  const pendingShipments = data?.pendingShipments || [];

  return {
    pendingShipments,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for getting in-transit shipments
 */
export function useInTransitShipments(warehouseId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_IN_TRANSIT_SHIPMENTS, {
    variables: { warehouseId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 60000, // Poll every minute
  });

  const inTransitShipments = data?.inTransitShipments || [];

  return {
    inTransitShipments,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for getting delivered shipments
 */
export function useDeliveredShipments(warehouseId?: string, days: number = 7) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_DELIVERED_SHIPMENTS, {
    variables: { warehouseId, days },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const deliveredShipments = data?.deliveredShipments || [];

  return {
    deliveredShipments,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for getting exception shipments
 */
export function useExceptionShipments(warehouseId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_EXCEPTION_SHIPMENTS, {
    variables: { warehouseId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 60000, // Poll every minute
  });

  const exceptionShipments = data?.exceptionShipments || [];

  return {
    exceptionShipments,
    loading,
    error,
    refetch,
  };
}

// ===== SHIPPING RATES HOOK =====

/**
 * Hook for getting shipping rates
 */
export function useShippingRates() {
  const [getShippingRates] = useMutation(GET_SHIPPING_RATES);

  const getRates = useCallback(async (input: {
    fromAddress: Address;
    toAddress: Address;
    weight?: number;
    dimensions?: ShipmentDimensions;
    declaredValue?: number;
  }) => {
    try {
      const result = await getShippingRates({
        variables: { input },
      });
      return result.data?.shippingRates || [];
    } catch (error) {
      console.error('Failed to get shipping rates:', error);
      throw error;
    }
  }, [getShippingRates]);

  return {
    getRates,
  };
}

// ===== SHIPPING LABEL HOOK =====

/**
 * Hook for managing shipping labels
 */
export function useShippingLabel() {
  const [generateReturnLabel] = useMutation(GENERATE_RETURN_LABEL);
  const [validateAddress] = useMutation(VALIDATE_ADDRESS);
  const [schedulePickup] = useMutation(SCHEDULE_PICKUP);

  const createLabel = useCallback(async (input: Record<string, unknown>) => {
    try {
      const result = await generateReturnLabel({
        variables: { input },
      });
      return result.data?.generateReturnLabel;
    } catch (error) {
      console.error('Failed to create shipping label:', error);
      throw error;
    }
  }, [generateReturnLabel]);

  const validateShippingAddress = useCallback(async (address: Address) => {
    try {
      const result = await validateAddress({
        variables: { address },
      });
      return result.data?.validateAddress;
    } catch (error) {
      console.error('Failed to validate address:', error);
      throw error;
    }
  }, [validateAddress]);

  const scheduleCarrierPickup = useCallback(async (
    warehouseId: string,
    pickupDate: Date,
    shipmentIds: string[]
  ) => {
    try {
      const result = await schedulePickup({
        variables: { warehouseId, pickupDate, shipmentIds },
      });
      return result.data?.schedulePickup;
    } catch (error) {
      console.error('Failed to schedule pickup:', error);
      throw error;
    }
  }, [schedulePickup]);

  return {
    createLabel,
    validateShippingAddress,
    scheduleCarrierPickup,
  };
}

// ===== TRACKING HOOK =====

/**
 * Hook for tracking shipments
 */
export function useTracking(trackingNumber: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_TRACKING_EVENTS, {
    variables: { trackingNumber },
    skip: !currentTenant?.id || !trackingNumber,
    errorPolicy: 'all',
    pollInterval: 300000, // Poll every 5 minutes
  });

  const trackingEvents = useMemo(() => {
    return data?.trackingEvents || [];
  }, [data?.trackingEvents]);

  // Real-time subscription for tracking updates
  useSubscription(TRACKING_EVENT_ADDED, {
    variables: { trackingNumber },
    skip: !trackingNumber,
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData.data?.trackingEventAdded) {
        refetch();
      }
    },
  });

  const latestEvent = useMemo(() => {
    return trackingEvents.length > 0 ? trackingEvents[0] : null;
  }, [trackingEvents]);

  return {
    trackingEvents,
    latestEvent,
    loading,
    error,
    refetch,
  };
}

// ===== SHIPPING METRICS HOOK =====

/**
 * Hook for getting shipping metrics
 */
export function useShippingMetrics(
  warehouseId: string,
  startDate?: Date,
  endDate?: Date
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_SHIPPING_METRICS, {
    variables: { warehouseId, startDate, endDate },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
  });

  const metrics = data?.shippingMetrics;

  return {
    metrics,
    loading,
    error,
    refetch,
  };
}

// ===== SHIPPING MANAGEMENT HOOK =====

/**
 * Combined hook for comprehensive shipping management
 */
export function useShippingManagement(warehouseId?: string) {
  const apolloClient = useApolloClient();
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

  // Get all shipments
  const {
    shipments,
    loading: shipmentsLoading,
    error: shipmentsError,
    create: createShipment,
    refetch: refetchShipments,
  } = useShipments();

  // Get warehouse-specific shipments
  const {
    shipments: warehouseShipments,
    loading: warehouseShipmentsLoading,
  } = useShipmentsByWarehouse(warehouseId || '');

  // Get shipments by status
  const { pendingShipments } = usePendingShipments(warehouseId);
  const { inTransitShipments } = useInTransitShipments(warehouseId);
  const { deliveredShipments } = useDeliveredShipments(warehouseId);
  const { exceptionShipments } = useExceptionShipments(warehouseId);

  // Get selected shipment details
  const {
    shipment: selectedShipment,
    loading: selectedShipmentLoading,
    error: selectedShipmentError,
    cancel: cancelShipment,
    updateStatus: updateShipmentStatus,
    track: trackShipment,
    confirmShipmentDelivery,
    generateReturn,
    isPending,
    isProcessing,
    isShipped,
    isDelivered,
    hasException,
    canCancel,
    canTrack,
    transitDays,
    isOnTime,
  } = useShipment(selectedShipmentId || '');

  // Shipping utilities
  const { getRates } = useShippingRates();
  const { createLabel, validateShippingAddress, scheduleCarrierPickup } = useShippingLabel();

  // Metrics
  const { metrics: shippingMetrics } = useShippingMetrics(warehouseId || '');

  const selectShipment = useCallback((shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedShipmentId(null);
  }, []);

  // Shipment statistics
  const shipmentStats = useMemo(() => {
    const relevantShipments = warehouseId ? warehouseShipments : shipments;
    
    const totalShipments = relevantShipments.length;
    const pendingCount = relevantShipments.filter((s: Shipment) => s.status === ShipmentStatus.PENDING).length;
    const processingCount = relevantShipments.filter((s: Shipment) => s.status === ShipmentStatus.PROCESSING).length;
    const shippedCount = relevantShipments.filter((s: Shipment) => s.status === ShipmentStatus.SHIPPED).length;
    const inTransitCount = relevantShipments.filter((s: Shipment) => s.status === ShipmentStatus.IN_TRANSIT).length;
    const deliveredCount = relevantShipments.filter((s: Shipment) => s.status === ShipmentStatus.DELIVERED).length;
    const exceptionCount = relevantShipments.filter((s: Shipment) => s.status === ShipmentStatus.EXCEPTION).length;
    const cancelledCount = relevantShipments.filter((s: Shipment) => s.status === ShipmentStatus.CANCELLED).length;

    const totalCost = relevantShipments.reduce((sum: number, s: Shipment) => sum + ((s.totalCost as number) || 0), 0);
    const averageCost = totalShipments > 0 ? totalCost / totalShipments : 0;

    const deliveredShipmentsWithTime = relevantShipments.filter((s: Shipment) => 
      s.status === ShipmentStatus.DELIVERED && s.shippedDate && s.actualDeliveryDate
    );
    
    const averageTransitTime = deliveredShipmentsWithTime.length > 0
      ? deliveredShipmentsWithTime.reduce((sum: number, s: Shipment) => {
          const shipped = new Date(s.shippedDate!);
          const delivered = new Date(s.actualDeliveryDate!);
          return sum + Math.ceil((delivered.getTime() - shipped.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / deliveredShipmentsWithTime.length
      : 0;

    const onTimeDeliveries = deliveredShipmentsWithTime.filter((s: Shipment) => {
      if (!s.estimatedDeliveryDate || !s.actualDeliveryDate) return false;
      return new Date(s.actualDeliveryDate) <= new Date(s.estimatedDeliveryDate);
    }).length;

    const onTimeDeliveryRate = deliveredShipmentsWithTime.length > 0 
      ? (onTimeDeliveries / deliveredShipmentsWithTime.length) * 100 
      : 0;

    return {
      totalShipments,
      pendingCount,
      processingCount,
      shippedCount,
      inTransitCount,
      deliveredCount,
      exceptionCount,
      cancelledCount,
      totalCost,
      averageCost,
      averageTransitTime,
      onTimeDeliveryRate,
    };
  }, [shipments, warehouseShipments, warehouseId]);

  // Clear cache for shipping data
  const clearCache = useCallback(() => {
    apolloClient.cache.evict({ fieldName: 'shipments' });
    apolloClient.cache.evict({ fieldName: 'shipment' });
    apolloClient.cache.evict({ fieldName: 'shipmentsByWarehouse' });
    apolloClient.cache.evict({ fieldName: 'pendingShipments' });
    apolloClient.cache.evict({ fieldName: 'inTransitShipments' });
    apolloClient.cache.evict({ fieldName: 'deliveredShipments' });
    apolloClient.cache.evict({ fieldName: 'exceptionShipments' });
    apolloClient.cache.gc();
  }, [apolloClient]);

  return {
    // Shipments list
    shipments: warehouseId ? warehouseShipments : shipments,
    shipmentsLoading: warehouseId ? warehouseShipmentsLoading : shipmentsLoading,
    shipmentsError,
    createShipment,
    refetchShipments,

    // Shipments by status
    pendingShipments,
    inTransitShipments,
    deliveredShipments,
    exceptionShipments,

    // Selected shipment
    selectedShipment,
    selectedShipmentId,
    selectedShipmentLoading,
    selectedShipmentError,
    selectShipment,
    clearSelection,

    // Shipment operations
    cancelShipment,
    updateShipmentStatus,
    trackShipment,
    confirmShipmentDelivery,
    generateReturn,

    // Shipment state
    isPending,
    isProcessing,
    isShipped,
    isDelivered,
    hasException,
    canCancel,
    canTrack,
    transitDays,
    isOnTime,

    // Shipping utilities
    getRates,
    createLabel,
    validateShippingAddress,
    scheduleCarrierPickup,

    // Metrics and statistics
    shippingMetrics,
    shipmentStats,

    // Utilities
    clearCache,
  };
}