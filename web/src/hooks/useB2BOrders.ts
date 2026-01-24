import { useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  B2BOrder, 
  B2BOrderStatus,
  UseB2BOrdersResult,
  CreateB2BOrderInput,
  UpdateB2BOrderInput,
} from '@/types/crm';
import {
  GET_B2B_ORDERS,
  GET_B2B_ORDER,
  GET_B2B_ORDER_BY_NUMBER,
  GET_ORDERS_REQUIRING_APPROVAL,
  GET_ORDER_ANALYTICS,
} from '@/graphql/queries/b2b-queries';
import {
  CREATE_B2B_ORDER,
  UPDATE_B2B_ORDER,
  APPROVE_B2B_ORDER,
  REJECT_B2B_ORDER,
  SHIP_B2B_ORDER,
  CANCEL_B2B_ORDER,
} from '@/graphql/mutations/b2b-mutations';
import {
  B2B_ORDER_CREATED_SUBSCRIPTION,
  B2B_ORDER_STATUS_CHANGED_SUBSCRIPTION,
} from '@/graphql/subscriptions/b2b-subscriptions';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from './useErrorHandler';

export interface B2BOrderQueryInput {
  search?: string;
  status?: B2BOrderStatus;
  customerId?: string;
  salesRepId?: string;
  startDate?: string;
  endDate?: string;
  requiresApproval?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Hook for managing B2B orders with comprehensive operations
 */
export function useB2BOrders(query?: B2BOrderQueryInput): UseB2BOrdersResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  // Query B2B orders with filters
  const { 
    data, 
    loading, 
    error, 
    refetch 
  } = useQuery(GET_B2B_ORDERS, {
    variables: { query: query || {} },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B orders');
    },
  });

  // Query order analytics
  const { 
    data: analyticsData,
    loading: analyticsLoading,
    error: analyticsError 
  } = useQuery(GET_ORDER_ANALYTICS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch order analytics');
    },
  });

  // Mutations
  const [createOrderMutation] = useMutation(CREATE_B2B_ORDER, {
    onError: (error) => handleError(error, 'Failed to create B2B order'),
    refetchQueries: [{ query: GET_B2B_ORDERS, variables: { query: query || {} } }],
    awaitRefetchQueries: true,
  });

  const [updateOrderMutation] = useMutation(UPDATE_B2B_ORDER, {
    onError: (error) => handleError(error, 'Failed to update B2B order'),
  });

  const [approveOrderMutation] = useMutation(APPROVE_B2B_ORDER, {
    onError: (error) => handleError(error, 'Failed to approve B2B order'),
  });

  const [rejectOrderMutation] = useMutation(REJECT_B2B_ORDER, {
    onError: (error) => handleError(error, 'Failed to reject B2B order'),
  });

  const [shipOrderMutation] = useMutation(SHIP_B2B_ORDER, {
    onError: (error) => handleError(error, 'Failed to ship B2B order'),
  });

  const [cancelOrderMutation] = useMutation(CANCEL_B2B_ORDER, {
    onError: (error) => handleError(error, 'Failed to cancel B2B order'),
  });

  // Subscriptions for real-time updates
  useSubscription(B2B_ORDER_CREATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.b2bOrderCreated) {
        refetch();
      }
    },
  });

  useSubscription(B2B_ORDER_STATUS_CHANGED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.b2bOrderStatusChanged) {
        refetch();
      }
    },
  });

  // Callbacks
  const createOrder = useCallback(async (input: CreateB2BOrderInput): Promise<B2BOrder> => {
    try {
      const result = await createOrderMutation({
        variables: { input },
        optimisticResponse: {
          createB2BOrder: {
            __typename: 'B2BOrderType',
            id: `temp-${Date.now()}`,
            orderNumber: `ORD-${Date.now()}`,
            customerId: input.customerId,
            salesRepId: input.salesRepId,
            accountManagerId: input.accountManagerId,
            quoteId: input.quoteId,
            status: B2BOrderStatus.DRAFT,
            orderDate: new Date().toISOString(),
            requestedDeliveryDate: input.requestedDeliveryDate?.toISOString(),
            paymentTerms: input.paymentTerms,
            subtotal: 0,
            taxAmount: 0,
            shippingAmount: 0,
            discountAmount: 0,
            totalAmount: 0,
            currency: 'USD',
            requiresApproval: false,
            items: input.items.map((item, index) => ({
              __typename: 'B2BOrderItemType',
              id: `temp-item-${index}`,
              orderId: `temp-${Date.now()}`,
              productId: item.productId,
              productName: '',
              productSku: '',
              quantity: item.quantity,
              unitPrice: item.unitPrice || 0,
              listPrice: item.unitPrice || 0,
              discountPercentage: 0,
              discountAmount: 0,
              lineTotal: (item.unitPrice || 0) * item.quantity,
              quantityShipped: 0,
              quantityBackordered: 0,
              notes: item.notes,
              isBackordered: false,
              totalSavings: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })),
            shippingAddress: input.shippingAddress,
            billingAddress: input.billingAddress,
            notes: input.notes,
            canBeApproved: false,
            canBeRejected: false,
            canBeCancelled: true,
            canBeShipped: false,
            isOverdue: false,
            daysUntilDue: -1,
            totalSavings: 0,
            fulfillmentPercentage: 0,
            availableActions: ['edit', 'cancel'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.createB2BOrder;
    } catch (error) {
      throw error;
    }
  }, [createOrderMutation]);

  const updateOrder = useCallback(async (
    id: string, 
    input: UpdateB2BOrderInput
  ): Promise<B2BOrder> => {
    try {
      const result = await updateOrderMutation({
        variables: { id, input },
        optimisticResponse: {
          updateB2BOrder: {
            __typename: 'B2BOrderType',
            id,
            orderNumber: '',
            customerId: '',
            status: B2BOrderStatus.DRAFT,
            orderDate: new Date().toISOString(),
            paymentTerms: '',
            subtotal: 0,
            taxAmount: 0,
            shippingAmount: 0,
            discountAmount: 0,
            totalAmount: 0,
            currency: 'USD',
            requiresApproval: false,
            items: [],
            ...input,
            updatedAt: new Date().toISOString(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        },
      });

      return result.data.updateB2BOrder;
    } catch (error) {
      throw error;
    }
  }, [updateOrderMutation]);

  const approveOrder = useCallback(async (
    id: string, 
    approvalNotes?: string
  ): Promise<B2BOrder> => {
    try {
      const result = await approveOrderMutation({
        variables: { 
          id, 
          input: { approvalNotes: approvalNotes || '' } 
        },
      });

      return result.data.approveB2BOrder.order;
    } catch (error) {
      throw error;
    }
  }, [approveOrderMutation]);

  const rejectOrder = useCallback(async (
    id: string, 
    rejectionReason?: string
  ): Promise<B2BOrder> => {
    try {
      const result = await rejectOrderMutation({
        variables: { 
          id, 
          input: { rejectionReason: rejectionReason || '' } 
        },
      });

      return result.data.rejectB2BOrder.order;
    } catch (error) {
      throw error;
    }
  }, [rejectOrderMutation]);

  const shipOrder = useCallback(async (
    id: string, 
    trackingNumber: string,
    estimatedDeliveryDate?: Date
  ): Promise<B2BOrder> => {
    try {
      const result = await shipOrderMutation({
        variables: { 
          id, 
          input: { 
            trackingNumber,
            estimatedDeliveryDate 
          } 
        },
      });

      return result.data.shipB2BOrder.order;
    } catch (error) {
      throw error;
    }
  }, [shipOrderMutation]);

  const cancelOrder = useCallback(async (
    id: string, 
    cancellationReason?: string
  ): Promise<B2BOrder> => {
    try {
      const result = await cancelOrderMutation({
        variables: { id, input: { cancellationReason: cancellationReason || '' } },
      });

      return result.data.cancelB2BOrder;
    } catch (error) {
      throw error;
    }
  }, [cancelOrderMutation]);

  return {
    orders: data?.getB2BOrders?.orders || [],
    loading: loading || analyticsLoading,
    error: error || analyticsError || null,
    totalCount: data?.getB2BOrders?.total,
    hasNextPage: data?.getB2BOrders?.hasNextPage,
    hasPreviousPage: data?.getB2BOrders?.hasPreviousPage,
    analytics: analyticsData?.getOrderAnalytics,
    createOrder,
    updateOrder,
    approveOrder,
    rejectOrder,
    shipOrder,
    cancelOrder,
    refetch: async () => {
      await refetch();
    },
  };
}

/**
 * Hook for fetching a single B2B order by ID
 */
export function useB2BOrder(id: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_B2B_ORDER, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B order');
    },
  });
}

/**
 * Hook for fetching a B2B order by order number
 */
export function useB2BOrderByNumber(orderNumber: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_B2B_ORDER_BY_NUMBER, {
    variables: { orderNumber },
    skip: !currentTenant?.id || !orderNumber,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B order by number');
    },
  });
}

/**
 * Hook for fetching orders requiring approval
 */
export function useOrdersRequiringApproval(page = 1, limit = 20) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_ORDERS_REQUIRING_APPROVAL, {
    variables: { page, limit },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 30000, // Refresh every 30 seconds
    onError: (error) => {
      handleError(error, 'Failed to fetch orders requiring approval');
    },
  });
}

/**
 * Hook for B2B order analytics
 */
export function useB2BOrderAnalytics(
  startDate?: Date,
  endDate?: Date,
  customerId?: string,
  salesRepId?: string
) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_ORDER_ANALYTICS, {
    variables: { startDate, endDate, customerId, salesRepId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch B2B order analytics');
    },
  });
}