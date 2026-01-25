import { useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  Quote, 
  QuoteStatus,
  CreateQuoteInput,
  UpdateQuoteInput,
} from '@/types/crm';
import {
  GET_QUOTES,
  GET_QUOTE,
} from '@/graphql/queries/b2b-queries';
import {
  CREATE_QUOTE,
  UPDATE_QUOTE,
  APPROVE_QUOTE,
  REJECT_QUOTE,
  SEND_QUOTE,
  CONVERT_QUOTE_TO_ORDER,
} from '@/graphql/mutations/b2b-mutations';
import {
  QUOTE_CREATED_SUBSCRIPTION,
  QUOTE_STATUS_CHANGED_SUBSCRIPTION,
  QUOTE_SENT_SUBSCRIPTION,
  QUOTE_CONVERTED_SUBSCRIPTION,
} from '@/graphql/subscriptions/b2b-subscriptions';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export interface QuoteQueryInput {
  search?: string;
  status?: QuoteStatus;
  customerId?: string;
  salesRepId?: string;
  startDate?: string;
  endDate?: string;
  expiringWithinDays?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SendQuoteInput {
  recipients: string[];
  subject?: string;
  message?: string;
  includeAttachments?: boolean;
}

export interface UseQuotesResult {
  quotes: Quote[];
  loading: boolean;
  error?: Error | null;
  totalCount: number;
  createQuote: (input: CreateQuoteInput) => Promise<Quote>;
  updateQuote: (id: string, input: UpdateQuoteInput) => Promise<Quote>;
  approveQuote: (id: string, approvalNotes?: string) => Promise<Quote>;
  rejectQuote: (id: string, rejectionReason: string) => Promise<Quote>;
  sendQuote: (id: string, input: SendQuoteInput) => Promise<Quote>;
  convertToOrder: (id: string) => Promise<{ quote: Quote; order: Record<string, unknown> }>;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing quotes with comprehensive operations
 */
export function useQuotes(query?: QuoteQueryInput): UseQuotesResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  // Query quotes with filters
  const { 
    data, 
    loading, 
    error, 
    refetch 
  } = useQuery(GET_QUOTES, {
    variables: { query: query || {} },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch quotes');
    },
  });

  // Mutations
  const [createQuoteMutation] = useMutation(CREATE_QUOTE, {
    onError: (error) => handleError(error, 'Failed to create quote'),
    refetchQueries: [{ query: GET_QUOTES, variables: { query: query || {} } }],
    awaitRefetchQueries: true,
  });

  const [updateQuoteMutation] = useMutation(UPDATE_QUOTE, {
    onError: (error) => handleError(error, 'Failed to update quote'),
  });

  const [approveQuoteMutation] = useMutation(APPROVE_QUOTE, {
    onError: (error) => handleError(error, 'Failed to approve quote'),
  });

  const [rejectQuoteMutation] = useMutation(REJECT_QUOTE, {
    onError: (error) => handleError(error, 'Failed to reject quote'),
  });

  const [sendQuoteMutation] = useMutation(SEND_QUOTE, {
    onError: (error) => handleError(error, 'Failed to send quote'),
  });

  const [convertQuoteMutation] = useMutation(CONVERT_QUOTE_TO_ORDER, {
    onError: (error) => handleError(error, 'Failed to convert quote to order'),
  });

  // Subscriptions for real-time updates
  useSubscription(QUOTE_CREATED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.quoteCreated) {
        refetch();
      }
    },
  });

  useSubscription(QUOTE_STATUS_CHANGED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.quoteStatusChanged) {
        refetch();
      }
    },
  });

  // Callbacks
  const createQuote = useCallback(async (input: CreateQuoteInput): Promise<Quote> => {
    try {
      const result = await createQuoteMutation({
        variables: { input },
        optimisticResponse: {
          createQuote: {
            __typename: 'QuoteType',
            id: `temp-${Date.now()}`,
            quoteNumber: `QUO-${Date.now()}`,
            customerId: input.customerId,
            salesRepId: input.salesRepId,
            accountManagerId: input.accountManagerId,
            status: QuoteStatus.DRAFT,
            quoteDate: new Date().toISOString(),
            expirationDate: input.expirationDate ? input.expirationDate.toISOString() : undefined,
            validUntil: input.expirationDate ? input.expirationDate.toISOString() : undefined,
            subtotal: 0,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: 0,
            currency: 'USD',
            requiresApproval: false,
            items: (input.items || []).map((item, index) => ({
              __typename: 'QuoteItemType',
              id: `temp-item-${index}`,
              quoteId: `temp-${Date.now()}`,
              productId: item.productId,
              productName: '',
              productSku: '',
              quantity: item.quantity,
              unitPrice: item.unitPrice || 0,
              listPrice: item.unitPrice || 0,
              discountPercentage: 0,
              discountAmount: 0,
              lineTotal: (item.unitPrice || 0) * item.quantity,
              notes: item.notes,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })),
            terms: input.terms,
            notes: input.notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.createQuote;
    } catch (error) {
      throw error;
    }
  }, [createQuoteMutation]);

  const updateQuote = useCallback(async (
    id: string, 
    input: UpdateQuoteInput
  ): Promise<Quote> => {
    try {
      const result = await updateQuoteMutation({
        variables: { id, input },
        optimisticResponse: {
          updateQuote: {
            __typename: 'QuoteType',
            id,
            ...input,
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          if (data?.updateQuote) {
            const cacheId = cache.identify(data.updateQuote);
            if (cacheId) {
              const fields: Record<string, () => unknown> = {
                updatedAt: () => new Date().toISOString(),
              };
              if (input.salesRepId !== undefined) fields.salesRepId = () => input.salesRepId;
              if (input.accountManagerId !== undefined) fields.accountManagerId = () => input.accountManagerId;
              if (input.expirationDate !== undefined) fields.expirationDate = () => input.expirationDate;
              if (input.items !== undefined) fields.items = () => input.items;
              if (input.terms !== undefined) fields.terms = () => input.terms;
              if (input.notes !== undefined) fields.notes = () => input.notes;
              
              cache.modify({
                id: cacheId,
                fields,
              });
            }
          }
        },
      });

      return result.data.updateQuote;
    } catch (error) {
      throw error;
    }
  }, [updateQuoteMutation]);

  const approveQuote = useCallback(async (
    id: string, 
    approvalNotes?: string
  ): Promise<Quote> => {
    try {
      const result = await approveQuoteMutation({
        variables: { 
          id, 
          input: { approvalNotes: approvalNotes || '' } 
        },
      });

      return result.data.approveQuote.quote;
    } catch (error) {
      throw error;
    }
  }, [approveQuoteMutation]);

  const rejectQuote = useCallback(async (
    id: string, 
    rejectionReason: string
  ): Promise<Quote> => {
    try {
      const result = await rejectQuoteMutation({
        variables: { 
          id, 
          input: { rejectionReason } 
        },
      });

      return result.data.rejectQuote.quote;
    } catch (error) {
      throw error;
    }
  }, [rejectQuoteMutation]);

  const sendQuote = useCallback(async (
    id: string, 
    input: SendQuoteInput
  ): Promise<Quote> => {
    try {
      const result = await sendQuoteMutation({
        variables: { id, input },
      });

      return result.data.sendQuote.quote;
    } catch (error) {
      throw error;
    }
  }, [sendQuoteMutation]);

  const convertToOrder = useCallback(async (
    id: string
  ): Promise<{ quote: Quote; order: Record<string, unknown> }> => {
    try {
      const result = await convertQuoteMutation({
        variables: { id },
      });

      return {
        quote: result.data.convertQuoteToOrder.quote,
        order: result.data.convertQuoteToOrder.order,
      };
    } catch (error) {
      throw error;
    }
  }, [convertQuoteMutation]);

  return {
    quotes: data?.getQuotes?.quotes || [],
    loading,
    error: error ? new Error(error.message) : null,
    totalCount: data?.getQuotes?.total || 0,
    createQuote,
    updateQuote,
    approveQuote,
    rejectQuote,
    sendQuote,
    convertToOrder,
    refetch: async () => {
      await refetch();
    },
  };
}

/**
 * Hook for fetching a single quote by ID
 */
export function useQuote(id: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_QUOTE, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch quote');
    },
  });
}

/**
 * Hook for quote real-time updates
 */
export function useQuoteSubscriptions(quoteId?: string) {
  const { handleError } = useErrorHandler();

  // Subscribe to quote status changes
  const { data: statusData } = useSubscription(QUOTE_STATUS_CHANGED_SUBSCRIPTION, {
    variables: { quoteId },
    onError: (error) => {
      handleError(error, 'Quote subscription error');
    },
  });

  // Subscribe to quote sent notifications
  const { data: sentData } = useSubscription(QUOTE_SENT_SUBSCRIPTION, {
    onError: (error) => {
      handleError(error, 'Quote sent subscription error');
    },
  });

  // Subscribe to quote conversions
  const { data: convertedData } = useSubscription(QUOTE_CONVERTED_SUBSCRIPTION, {
    onError: (error) => {
      handleError(error, 'Quote conversion subscription error');
    },
  });

  return {
    statusUpdate: statusData?.quoteStatusChanged,
    sentNotification: sentData?.quoteSent,
    conversionNotification: convertedData?.quoteConverted,
  };
}