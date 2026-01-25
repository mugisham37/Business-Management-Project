import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useCallback } from 'react';
import {
  GET_PURCHASE_ORDER,
  GET_PURCHASE_ORDER_BY_NUMBER,
  GET_PURCHASE_ORDERS,
  GET_PURCHASE_ORDER_STATS,
  GET_SUPPLIER_PURCHASE_STATS,
  GET_ALL_SUPPLIER_PERFORMANCE,
  GET_SPEND_ANALYSIS,
  GET_COST_TRENDS,
  GET_LEAD_TIME_ANALYSIS,
  GET_EDI_STATUS,
} from '@/graphql/queries/supplier';
import {
  CREATE_PURCHASE_ORDER,
  UPDATE_PURCHASE_ORDER,
  DELETE_PURCHASE_ORDER,
  SUBMIT_PURCHASE_ORDER_FOR_APPROVAL,
  RESPOND_TO_APPROVAL,
  CREATE_PURCHASE_ORDER_RECEIPT,
  CREATE_PURCHASE_ORDER_INVOICE,
  SEND_EDI_DOCUMENT,
  RECEIVE_EDI_DOCUMENT,
  RETRY_EDI_DOCUMENT,
} from '@/graphql/mutations/supplier';
import {
  PURCHASE_ORDER_CREATED_SUBSCRIPTION,
  PURCHASE_ORDER_STATUS_CHANGED_SUBSCRIPTION,
  PURCHASE_ORDER_RECEIVED_SUBSCRIPTION,
  PURCHASE_ORDER_APPROVED_SUBSCRIPTION,
  PURCHASE_ORDER_SENT_SUBSCRIPTION,
  PURCHASE_ORDER_INVOICED_SUBSCRIPTION,
} from '@/graphql/subscriptions/supplier';
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from './useGraphQLMutations';
import type {
  PurchaseOrder,
  PurchaseOrderConnection,
  PurchaseOrderFilterInput,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderStats,
  SupplierPurchaseStats,
  SupplierPerformanceMetrics,
  SpendAnalysis,
  DateRangeInput,
  PurchaseOrderStatus,
  PurchaseOrderPriority,
} from '@/types/supplier';

// Hook for fetching purchase orders with pagination and filtering
export function usePurchaseOrders(
  first?: number,
  after?: string,
  filter?: PurchaseOrderFilterInput
) {
  const { data, loading, error, fetchMore, refetch } = useQuery<{
    purchaseOrders: PurchaseOrderConnection;
  }>(GET_PURCHASE_ORDERS, {
    variables: { first, after, filter },
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const loadMore = useCallback(async () => {
    if (!data?.purchaseOrders.pageInfo.hasNextPage || !data.purchaseOrders.pageInfo.endCursor) return;

    return fetchMore({
      variables: {
        after: data.purchaseOrders.pageInfo.endCursor,
      },
    });
  }, [data, fetchMore]);

  return {
    purchaseOrders: data?.purchaseOrders.edges.map(edge => edge.node) || [],
    pageInfo: data?.purchaseOrders.pageInfo,
    totalCount: data?.purchaseOrders.totalCount || 0,
    loading,
    error,
    loadMore,
    refetch,
  };
}

// Hook for fetching a single purchase order
export function usePurchaseOrder(id: string) {
  const { data, loading, error, refetch } = useQuery<{
    purchaseOrder: PurchaseOrder;
  }>(GET_PURCHASE_ORDER, {
    variables: { id },
    skip: !id,
    errorPolicy: 'all',
  });

  return {
    purchaseOrder: data?.purchaseOrder,
    loading,
    error,
    refetch,
  };
}

// Hook for fetching purchase order by number
export function usePurchaseOrderByNumber(poNumber: string) {
  const { data, loading, error } = useQuery<{
    purchaseOrderByNumber: PurchaseOrder;
  }>(GET_PURCHASE_ORDER_BY_NUMBER, {
    variables: { poNumber },
    skip: !poNumber,
    errorPolicy: 'all',
  });

  return {
    purchaseOrder: data?.purchaseOrderByNumber,
    loading,
    error,
  };
}

// Hook for purchase order statistics
export function usePurchaseOrderStats(startDate?: string, endDate?: string) {
  const { data, loading, error, refetch } = useQuery<{
    purchaseOrderStats: PurchaseOrderStats;
  }>(GET_PURCHASE_ORDER_STATS, {
    variables: { startDate, endDate },
    errorPolicy: 'all',
  });

  return {
    stats: data?.purchaseOrderStats,
    loading,
    error,
    refetch,
  };
}

// Hook for supplier purchase statistics
export function useSupplierPurchaseStats(
  supplierId: string,
  startDate?: string,
  endDate?: string
) {
  const { data, loading, error } = useQuery<{
    supplierPurchaseStats: SupplierPurchaseStats;
  }>(GET_SUPPLIER_PURCHASE_STATS, {
    variables: { supplierId, startDate, endDate },
    skip: !supplierId,
    errorPolicy: 'all',
  });

  return {
    stats: data?.supplierPurchaseStats,
    loading,
    error,
  };
}

// Hook for creating purchase orders
export function useCreatePurchaseOrder() {
  const [createPurchaseOrder, { loading, error }] = useCreateMutation(
    CREATE_PURCHASE_ORDER,
    GET_PURCHASE_ORDERS,
    'purchaseOrders',
    (variables: Record<string, unknown>) => {
      const input = variables.input as CreatePurchaseOrderInput | undefined;
      return {
        id: `temp-${Date.now()}`,
        poNumber: `PO-${Date.now()}`,
        ...(input || {}),
        status: 'draft',
        orderDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  );

  const create = useCallback(
    async (input: CreatePurchaseOrderInput) => {
      return createPurchaseOrder({ input });
    },
    [createPurchaseOrder]
  );

  return { createPurchaseOrder: create, loading, error };
}

// Hook for updating purchase orders
export function useUpdatePurchaseOrder() {
  const [updatePurchaseOrder, { loading, error }] = useUpdateMutation(
    UPDATE_PURCHASE_ORDER,
    GET_PURCHASE_ORDERS,
    'purchaseOrders'
  );

  const update = useCallback(
    async (id: string, input: UpdatePurchaseOrderInput) => {
      return updatePurchaseOrder({ id, input });
    },
    [updatePurchaseOrder]
  );

  return { updatePurchaseOrder: update, loading, error };
}

// Hook for deleting purchase orders
export function useDeletePurchaseOrder() {
  const [deletePurchaseOrder, { loading, error }] = useDeleteMutation(
    DELETE_PURCHASE_ORDER,
    GET_PURCHASE_ORDERS,
    'purchaseOrders'
  );

  const remove = useCallback(
    async (id: string) => {
      return deletePurchaseOrder({ variables: { id } });
    },
    [deletePurchaseOrder]
  );

  return { deletePurchaseOrder: remove, loading, error };
}

// Hook for submitting purchase order for approval
export function useSubmitPurchaseOrderForApproval() {
  const [submitForApproval, { loading, error }] = useMutation(
    SUBMIT_PURCHASE_ORDER_FOR_APPROVAL,
    {
      errorPolicy: 'all',
      update: (cache, { data }, { variables }) => {
        if (!data?.submitPurchaseOrderForApproval || !variables?.id) return;

        // Update the purchase order status in cache
        const poId = variables.id;
        const cacheId = cache.identify({ __typename: 'PurchaseOrder', id: poId });
        
        if (cacheId) {
          cache.modify({
            id: cacheId,
            fields: {
              status: () => 'pending_approval',
            },
          });
        }
      },
    }
  );

  const submit = useCallback(
    async (id: string) => {
      return submitForApproval({ variables: { id } });
    },
    [submitForApproval]
  );

  return { submitForApproval: submit, loading, error };
}

// Hook for responding to approval
export function useRespondToApproval() {
  const [respondToApproval, { loading, error }] = useMutation(RESPOND_TO_APPROVAL, {
    errorPolicy: 'all',
  });

  const respond = useCallback(
    async (approvalId: string, response: { status: string; comments?: string }) => {
      return respondToApproval({ variables: { approvalId, response } });
    },
    [respondToApproval]
  );

  return { respondToApproval: respond, loading, error };
}

// Hook for creating purchase order receipt
export function useCreatePurchaseOrderReceipt() {
  const [createReceipt, { loading, error }] = useMutation(CREATE_PURCHASE_ORDER_RECEIPT, {
    errorPolicy: 'all',
  });

  const create = useCallback(
    async (input: Record<string, unknown>) => {
      return createReceipt({ variables: { input } });
    },
    [createReceipt]
  );

  return { createReceipt: create, loading, error };
}

// Hook for creating purchase order invoice
export function useCreatePurchaseOrderInvoice() {
  const [createInvoice, { loading, error }] = useMutation(CREATE_PURCHASE_ORDER_INVOICE, {
    errorPolicy: 'all',
  });

  const create = useCallback(
    async (input: Record<string, unknown>) => {
      return createInvoice({ variables: { input } });
    },
    [createInvoice]
  );

  return { createInvoice: create, loading, error };
}

// Hook for procurement analytics
export function useProcurementAnalytics(dateRange: DateRangeInput) {
  const { data: performanceData, loading: performanceLoading } = useQuery<{
    getAllSupplierPerformance: SupplierPerformanceMetrics[];
  }>(GET_ALL_SUPPLIER_PERFORMANCE, {
    variables: { input: dateRange },
    skip: !dateRange.startDate || !dateRange.endDate,
    errorPolicy: 'all',
  });

  const { data: spendData, loading: spendLoading } = useQuery<{
    getSpendAnalysis: SpendAnalysis;
  }>(GET_SPEND_ANALYSIS, {
    variables: { input: dateRange },
    skip: !dateRange.startDate || !dateRange.endDate,
    errorPolicy: 'all',
  });

  const { data: trendsData, loading: trendsLoading } = useQuery<{
    getCostTrends: Array<{ month: string; amount: number }>;
  }>(GET_COST_TRENDS, {
    variables: { input: dateRange },
    skip: !dateRange.startDate || !dateRange.endDate,
    errorPolicy: 'all',
  });

  const { data: leadTimeData, loading: leadTimeLoading } = useQuery<{
    getLeadTimeAnalysis: Array<{
      supplierId: string;
      supplierName: string;
      averageLeadTime: number;
      minLeadTime: number;
      maxLeadTime: number;
      onTimeDeliveryPercentage: number;
    }>;
  }>(GET_LEAD_TIME_ANALYSIS, {
    variables: { input: dateRange },
    skip: !dateRange.startDate || !dateRange.endDate,
    errorPolicy: 'all',
  });

  const loading = performanceLoading || spendLoading || trendsLoading || leadTimeLoading;

  return {
    supplierPerformance: performanceData?.getAllSupplierPerformance || [],
    spendAnalysis: spendData?.getSpendAnalysis,
    costTrends: trendsData?.getCostTrends || [],
    leadTimeAnalysis: leadTimeData?.getLeadTimeAnalysis || [],
    loading,
  };
}

// Hook for EDI operations
export function useEDIOperations() {
  const [sendDocument, { loading: sendingDocument }] = useMutation(SEND_EDI_DOCUMENT, {
    errorPolicy: 'all',
  });

  const [receiveDocument, { loading: receivingDocument }] = useMutation(RECEIVE_EDI_DOCUMENT, {
    errorPolicy: 'all',
  });

  const [retryDocument, { loading: retryingDocument }] = useMutation(RETRY_EDI_DOCUMENT, {
    errorPolicy: 'all',
  });

  const { data: statusData, loading: statusLoading, refetch: refetchStatus } = useQuery(
    GET_EDI_STATUS,
    {
      skip: true, // Only fetch when explicitly called
      errorPolicy: 'all',
    }
  );

  const sendEDIDocument = useCallback(
    async (input: Record<string, unknown>) => {
      return sendDocument({ variables: { input } });
    },
    [sendDocument]
  );

  const receiveEDIDocument = useCallback(
    async (input: Record<string, unknown>) => {
      return receiveDocument({ variables: { input } });
    },
    [receiveDocument]
  );

  const retryEDIDocument = useCallback(
    async (input: Record<string, unknown>) => {
      return retryDocument({ variables: { input } });
    },
    [retryDocument]
  );

  const getEDIStatus = useCallback(
    async (documentId: string) => {
      return refetchStatus({ documentId });
    },
    [refetchStatus]
  );

  const isLoading = sendingDocument || receivingDocument || retryingDocument || statusLoading;

  return {
    sendEDIDocument,
    receiveEDIDocument,
    retryEDIDocument,
    getEDIStatus,
    ediStatus: statusData?.getEDIStatus,
    isLoading,
  };
}

// Hook for real-time purchase order updates
export function usePurchaseOrderSubscriptions(supplierId?: string) {
  const { data: createdData } = useSubscription<{ purchaseOrderCreated: PurchaseOrder }>(
    PURCHASE_ORDER_CREATED_SUBSCRIPTION
  );

  const { data: statusChangedData } = useSubscription<{ purchaseOrderStatusChanged: PurchaseOrder }>(
    PURCHASE_ORDER_STATUS_CHANGED_SUBSCRIPTION
  );

  const { data: receivedData } = useSubscription<{ purchaseOrderReceived: PurchaseOrder }>(
    PURCHASE_ORDER_RECEIVED_SUBSCRIPTION,
    {
      variables: { supplierId },
    }
  );

  const { data: approvedData } = useSubscription<{ purchaseOrderApproved: PurchaseOrder }>(
    PURCHASE_ORDER_APPROVED_SUBSCRIPTION
  );

  const { data: sentData } = useSubscription<{ purchaseOrderSent: PurchaseOrder }>(
    PURCHASE_ORDER_SENT_SUBSCRIPTION
  );

  const { data: invoicedData } = useSubscription<{ purchaseOrderInvoiced: PurchaseOrder }>(
    PURCHASE_ORDER_INVOICED_SUBSCRIPTION
  );

  return {
    createdPurchaseOrder: createdData?.purchaseOrderCreated,
    statusChangedPurchaseOrder: statusChangedData?.purchaseOrderStatusChanged,
    receivedPurchaseOrder: receivedData?.purchaseOrderReceived,
    approvedPurchaseOrder: approvedData?.purchaseOrderApproved,
    sentPurchaseOrder: sentData?.purchaseOrderSent,
    invoicedPurchaseOrder: invoicedData?.purchaseOrderInvoiced,
  };
}

// Comprehensive procurement management hook
export function useProcurementManagement() {
  const { createPurchaseOrder, loading: creating } = useCreatePurchaseOrder();
  const { updatePurchaseOrder, loading: updating } = useUpdatePurchaseOrder();
  const { deletePurchaseOrder, loading: deleting } = useDeletePurchaseOrder();
  const { submitForApproval, loading: submitting } = useSubmitPurchaseOrderForApproval();
  const { respondToApproval, loading: responding } = useRespondToApproval();
  const { createReceipt, loading: creatingReceipt } = useCreatePurchaseOrderReceipt();
  const { createInvoice, loading: creatingInvoice } = useCreatePurchaseOrderInvoice();
  const { stats, refetch: refetchStats } = usePurchaseOrderStats();

  const isLoading = creating || updating || deleting || submitting || responding || 
                   creatingReceipt || creatingInvoice;

  const actions = {
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    submitForApproval,
    respondToApproval,
    createReceipt,
    createInvoice,
    refreshStats: refetchStats,
  };

  return {
    actions,
    stats,
    isLoading,
  };
}

// Hook for purchase order filtering
export function usePurchaseOrderFilters() {
  const buildFilter = useCallback((params: {
    search?: string;
    status?: string;
    supplierId?: string;
    priority?: string;
    orderDateFrom?: string;
    orderDateTo?: string;
    deliveryDateFrom?: string;
    deliveryDateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): PurchaseOrderFilterInput => {
    const filter: PurchaseOrderFilterInput = {};
    if (params.search !== undefined) filter.search = params.search;
    if (params.status !== undefined && params.status !== null) filter.status = params.status as PurchaseOrderStatus;
    if (params.supplierId !== undefined) filter.supplierId = params.supplierId;
    if (params.priority !== undefined && params.priority !== null) filter.priority = params.priority as PurchaseOrderPriority;
    if (params.orderDateFrom !== undefined) filter.fromDate = params.orderDateFrom;
    if (params.deliveryDateTo !== undefined) filter.toDate = params.deliveryDateTo;
    if (params.sortBy !== undefined) filter.sortBy = params.sortBy;
    if (params.sortOrder !== undefined) filter.sortOrder = params.sortOrder;
    return filter;
  }, []);

  return { buildFilter };
}