/**
 * Transactions Hook - Transaction Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useAuth } from './useAuth';
import { useTenant } from '@/lib/tenant';
import { useUnifiedCache } from '@/lib/cache';
import {
  GET_TRANSACTION,
  GET_TRANSACTIONS,
  GET_TRANSACTION_HISTORY,
  GET_TRANSACTION_SUMMARY,
} from '@/graphql/queries/pos-queries';
import {
  CREATE_TRANSACTION,
  UPDATE_TRANSACTION,
  VOID_TRANSACTION,
  REFUND_TRANSACTION,
  VALIDATE_TRANSACTION,
  VALIDATE_REFUND,
  VALIDATE_INVENTORY_AVAILABILITY,
} from '@/graphql/mutations/pos-mutations';
import {
  TRANSACTION_CREATED,
  TRANSACTION_UPDATED,
} from '@/graphql/subscriptions/pos-subscriptions';
import type {
  Transaction,
  TransactionConnection,
  CreateTransactionInput,
  UpdateTransactionInput,
  VoidTransactionInput,
  RefundTransactionInput,
  TransactionFilter,
  TransactionStatus,
} from '@/types/pos';

interface UseTransactionsOptions {
  locationId?: string;
  autoRefresh?: boolean;
  enableSubscriptions?: boolean;
  pageSize?: number;
}

interface UseTransactionsResult {
  // State
  transactions: Transaction[];
  currentTransaction: Transaction | null;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading: boolean;
  error: Error | null;

  // Transaction Management
  createTransaction: (input: CreateTransactionInput) => Promise<Transaction>;
  updateTransaction: (id: string, input: UpdateTransactionInput) => Promise<Transaction>;
  voidTransaction: (id: string, input: VoidTransactionInput) => Promise<Transaction>;
  refundTransaction: (id: string, input: RefundTransactionInput) => Promise<Transaction>;
  
  // Data Fetching
  loadTransaction: (id: string) => Promise<Transaction>;
  loadTransactions: (filter?: TransactionFilter) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  
  // Validation
  validateTransaction: (input: CreateTransactionInput) => Promise<{
    valid: boolean;
    errors: Array<{ field: string; message: string; code: string }>;
    warnings: Array<{ field: string; message: string; code: string }>;
  }>;
  validateRefund: (transactionId: string, amount: number, reason: string) => Promise<{
    valid: boolean;
    maxRefundAmount: number;
    errors: Array<{ field: string; message: string; code: string }>;
  }>;
  validateInventory: (items: Array<{ productId: string; quantity: number }>) => Promise<{
    valid: boolean;
    unavailableItems: Array<{
      productId: string;
      requestedQuantity: number;
      availableQuantity: number;
    }>;
  }>;
  
  // Utilities
  getTransactionsByStatus: (status: TransactionStatus) => Transaction[];
  getTotalSales: () => number;
  getAverageTransactionValue: () => number;
}

export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsResult {
  const { 
    locationId, 
    autoRefresh = true, 
    enableSubscriptions = true,
    pageSize = 20 
  } = options;
  
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const cache = useUnifiedCache();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  // Queries
  const {
    data: transactionsData,
    loading: transactionsLoading,
    fetchMore,
    refetch: refetchTransactions,
  } = useQuery(GET_TRANSACTIONS, {
    variables: {
      first: pageSize,
      query: locationId ? { locationId } : undefined,
    },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data.transactions) {
        setTransactions(data.transactions.edges.map(edge => edge.node));
        setCursor(data.transactions.pageInfo.endCursor);
      }
    },
    onError: (error) => setError(error),
  });

  // Mutations
  const [createTransactionMutation, { loading: creatingTransaction }] = useMutation(CREATE_TRANSACTION, {
    onCompleted: (data) => {
      if (data.createTransaction.success) {
        const newTransaction = data.createTransaction.transaction;
        setTransactions(prev => [newTransaction, ...prev]);
        setCurrentTransaction(newTransaction);
        cache.invalidateFromMutation('createTransaction', {}, currentTenant?.id);
      }
    },
    onError: (error) => setError(error),
  });

  const [updateTransactionMutation, { loading: updatingTransaction }] = useMutation(UPDATE_TRANSACTION, {
    onCompleted: (data) => {
      if (data.updateTransaction.success) {
        const updatedTransaction = data.updateTransaction.transaction;
        setTransactions(prev => 
          prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t)
        );
        if (currentTransaction?.id === updatedTransaction.id) {
          setCurrentTransaction(updatedTransaction);
        }
        cache.invalidateFromMutation('updateTransaction', {}, currentTenant?.id);
      }
    },
    onError: (error) => setError(error),
  });

  const [voidTransactionMutation, { loading: voidingTransaction }] = useMutation(VOID_TRANSACTION, {
    onCompleted: (data) => {
      if (data.voidTransaction.success) {
        const voidedTransaction = data.voidTransaction.transaction;
        setTransactions(prev => 
          prev.map(t => t.id === voidedTransaction.id ? voidedTransaction : t)
        );
        if (currentTransaction?.id === voidedTransaction.id) {
          setCurrentTransaction(voidedTransaction);
        }
        cache.invalidateFromMutation('voidTransaction', {}, currentTenant?.id);
      }
    },
    onError: (error) => setError(error),
  });

  const [refundTransactionMutation, { loading: refundingTransaction }] = useMutation(REFUND_TRANSACTION, {
    onCompleted: (data) => {
      if (data.refundTransaction.success) {
        const refundedTransaction = data.refundTransaction.transaction;
        setTransactions(prev => 
          prev.map(t => t.id === refundedTransaction.id ? refundedTransaction : t)
        );
        if (currentTransaction?.id === refundedTransaction.id) {
          setCurrentTransaction(refundedTransaction);
        }
        cache.invalidateFromMutation('refundTransaction', {}, currentTenant?.id);
      }
    },
    onError: (error) => setError(error),
  });

  // Validation mutations
  const [validateTransactionMutation] = useMutation(VALIDATE_TRANSACTION);
  const [validateRefundMutation] = useMutation(VALIDATE_REFUND);
  const [validateInventoryMutation] = useMutation(VALIDATE_INVENTORY_AVAILABILITY);

  // Subscriptions
  useSubscription(TRANSACTION_CREATED, {
    variables: { tenantId: currentTenant?.id || '' },
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data.data?.transactionCreated) {
        const newTransaction = data.data.transactionCreated;
        setTransactions(prev => {
          // Avoid duplicates
          if (prev.some(t => t.id === newTransaction.id)) {
            return prev;
          }
          return [newTransaction, ...prev];
        });
      }
    },
  });

  useSubscription(TRANSACTION_UPDATED, {
    variables: { tenantId: currentTenant?.id || '' },
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data.data?.transactionUpdated) {
        const updatedTransaction = data.data.transactionUpdated;
        setTransactions(prev => 
          prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t)
        );
        if (currentTransaction?.id === updatedTransaction.id) {
          setCurrentTransaction(updatedTransaction);
        }
      }
    },
  });

  // Effects
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refetchTransactions();
      }, 60000); // Refresh every minute

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refetchTransactions]);

  // Handlers
  const createTransaction = useCallback(async (input: CreateTransactionInput): Promise<Transaction> => {
    try {
      setError(null);
      const result = await createTransactionMutation({
        variables: { input },
      });

      if (result.data?.createTransaction.success) {
        return result.data.createTransaction.transaction;
      } else {
        throw new Error(result.data?.createTransaction.message || 'Failed to create transaction');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [createTransactionMutation]);

  const updateTransaction = useCallback(async (id: string, input: UpdateTransactionInput): Promise<Transaction> => {
    try {
      setError(null);
      const result = await updateTransactionMutation({
        variables: { id, input },
      });

      if (result.data?.updateTransaction.success) {
        return result.data.updateTransaction.transaction;
      } else {
        throw new Error(result.data?.updateTransaction.message || 'Failed to update transaction');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [updateTransactionMutation]);

  const voidTransaction = useCallback(async (id: string, input: VoidTransactionInput): Promise<Transaction> => {
    try {
      setError(null);
      const result = await voidTransactionMutation({
        variables: { id, input },
      });

      if (result.data?.voidTransaction.success) {
        return result.data.voidTransaction.transaction;
      } else {
        throw new Error(result.data?.voidTransaction.message || 'Failed to void transaction');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [voidTransactionMutation]);

  const refundTransaction = useCallback(async (id: string, input: RefundTransactionInput): Promise<Transaction> => {
    try {
      setError(null);
      const result = await refundTransactionMutation({
        variables: { id, input },
      });

      if (result.data?.refundTransaction.success) {
        return result.data.refundTransaction.transaction;
      } else {
        throw new Error(result.data?.refundTransaction.message || 'Failed to refund transaction');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [refundTransactionMutation]);

  const loadTransaction = useCallback(async (id: string): Promise<Transaction> => {
    try {
      setError(null);
      const { data } = await cache.get(`transaction:${id}`, {
        fallbackLoader: async () => {
          const result = await refetchTransactions({ id });
          return result.data?.transaction;
        },
      });
      
      if (data) {
        setCurrentTransaction(data);
        return data;
      }
      
      throw new Error('Transaction not found');
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [cache, refetchTransactions]);

  const loadTransactions = useCallback(async (filter?: TransactionFilter) => {
    try {
      setError(null);
      await refetchTransactions({
        first: pageSize,
        query: { ...filter, locationId },
      });
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchTransactions, pageSize, locationId]);

  const loadMore = useCallback(async () => {
    if (!cursor || !transactionsData?.transactions.pageInfo.hasNextPage) return;

    try {
      setError(null);
      await fetchMore({
        variables: {
          first: pageSize,
          after: cursor,
          query: locationId ? { locationId } : undefined,
        },
      });
    } catch (error) {
      setError(error as Error);
    }
  }, [cursor, fetchMore, pageSize, locationId, transactionsData]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await refetchTransactions();
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchTransactions]);

  // Validation functions
  const validateTransaction = useCallback(async (input: CreateTransactionInput) => {
    const result = await validateTransactionMutation({
      variables: { input },
    });
    return result.data?.validateTransaction || { valid: false, errors: [], warnings: [] };
  }, [validateTransactionMutation]);

  const validateRefund = useCallback(async (transactionId: string, amount: number, reason: string) => {
    const result = await validateRefundMutation({
      variables: { transactionId, amount, reason },
    });
    return result.data?.validateRefund || { valid: false, maxRefundAmount: 0, errors: [] };
  }, [validateRefundMutation]);

  const validateInventory = useCallback(async (items: Array<{ productId: string; quantity: number }>) => {
    const result = await validateInventoryMutation({
      variables: { items },
    });
    return result.data?.validateInventoryAvailability || { valid: false, unavailableItems: [] };
  }, [validateInventoryMutation]);

  // Utility functions
  const getTransactionsByStatus = useCallback((status: TransactionStatus) => {
    return transactions.filter(t => t.status === status);
  }, [transactions]);

  const getTotalSales = useCallback(() => {
    return transactions
      .filter(t => t.status === TransactionStatus.COMPLETED)
      .reduce((total, t) => total + t.total, 0);
  }, [transactions]);

  const getAverageTransactionValue = useCallback(() => {
    const completedTransactions = transactions.filter(t => t.status === TransactionStatus.COMPLETED);
    if (completedTransactions.length === 0) return 0;
    return getTotalSales() / completedTransactions.length;
  }, [transactions, getTotalSales]);

  // Computed values
  const totalCount = transactionsData?.transactions.totalCount || 0;
  const hasNextPage = transactionsData?.transactions.pageInfo.hasNextPage || false;
  const hasPreviousPage = transactionsData?.transactions.pageInfo.hasPreviousPage || false;
  const isLoading = transactionsLoading || creatingTransaction || updatingTransaction || voidingTransaction || refundingTransaction;

  return {
    // State
    transactions,
    currentTransaction,
    totalCount,
    hasNextPage,
    hasPreviousPage,
    isLoading,
    error,

    // Transaction Management
    createTransaction,
    updateTransaction,
    voidTransaction,
    refundTransaction,
    
    // Data Fetching
    loadTransaction,
    loadTransactions,
    loadMore,
    refresh,
    
    // Validation
    validateTransaction,
    validateRefund,
    validateInventory,
    
    // Utilities
    getTransactionsByStatus,
    getTotalSales,
    getAverageTransactionValue,
  };
}

// Specialized hook for single transaction
export function useTransaction(transactionId?: string) {
  const { data, loading, error, refetch } = useQuery(GET_TRANSACTION, {
    variables: { id: transactionId || '' },
    skip: !transactionId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    transaction: data?.transaction || null,
    loading,
    error,
    refetch,
  };
}