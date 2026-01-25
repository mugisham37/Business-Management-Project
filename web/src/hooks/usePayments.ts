/**
 * Payments Hook - Payment Processing
 * Requirements: 11.1, 11.2, 11.3
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useTenant } from '@/hooks/useTenant';
import { useUnifiedCache } from '@/lib/cache';
import {
  VALIDATE_PAYMENT_METHOD,
  GET_CASH_DRAWER_STATUS,
} from '@/graphql/queries/pos-queries';
import {
  PROCESS_PAYMENT,
  VOID_PAYMENT,
  REFUND_PAYMENT,
  CALCULATE_CHANGE,
  RECORD_CASH_COUNT,
  INITIATE_MOBILE_MONEY_PAYMENT,
  CREATE_STRIPE_PAYMENT_METHOD,
} from '@/graphql/mutations/pos-mutations';
import {
  PAYMENT_PROCESSED,
  CASH_DRAWER_UPDATED,
} from '@/graphql/subscriptions/pos-subscriptions';
import type {
  PaymentRecord,
  PaymentRequest,
  PaymentResult,
  PaymentMethod,
} from '@/types/pos';

interface UsePaymentsOptions {
  enableSubscriptions?: boolean;
}

interface UsePaymentsResult {
  // State
  isProcessing: boolean;
  error: Error | null;
  cashDrawerStatus: {
    currentAmount: number;
    expectedAmount: number;
    variance: number;
    lastCounted: Date;
    changeAvailable: Array<{ denomination: number; count: number }>;
  } | null;

  // Payment Processing
  processPayment: (transactionId: string, request: PaymentRequest) => Promise<PaymentResult>;
  voidPayment: (transactionId: string) => Promise<void>;
  refundPayment: (transactionId: string, amount: number) => Promise<void>;
  
  // Cash Operations
  calculateChange: (received: number, required: number) => Promise<{
    changeAmount: number;
    changeDenominations: Array<{ denomination: number; count: number }>;
  }>;
  recordCashCount: (denominations: Array<{ denomination: number; count: number }>) => Promise<{
    totalAmount: number;
    variance: number;
  }>;
  
  // Mobile Money Operations
  initiateMobileMoneyPayment: (phoneNumber: string, amount: number, reference: string) => Promise<{
    requestId: string;
    status: string;
    message: string;
    expiresAt: Date;
  }>;
  checkMobileMoneyAccount: (phoneNumber: string) => Promise<{
    isActive: boolean;
    provider: string;
    accountName?: string;
    balance?: number;
    currency?: string;
  }>;
  
  // Stripe Operations
  createStripePaymentMethod: (cardDetails: {
    number: string;
    expMonth: number;
    expYear: number;
    cvc: string;
  }) => Promise<{
    paymentMethodId: string;
    status: string;
    error?: string;
    requiresAction?: boolean;
    clientSecret?: string;
  }>;
  
  // Validation
  validatePaymentMethod: (method: PaymentMethod, amount: number) => Promise<{
    valid: boolean;
    error?: string;
    provider?: string;
    supportedFeatures?: string[];
  }>;
  
  // Data Fetching
  getPaymentHistory: (transactionId: string) => Promise<PaymentRecord[]>;
  refreshCashDrawerStatus: () => Promise<void>;
}

export function usePayments(options: UsePaymentsOptions = {}): UsePaymentsResult {
  const { enableSubscriptions = true } = options;
  const { tenant: currentTenant } = useTenant();
  const cache = useUnifiedCache();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Queries
  const {
    data: cashDrawerData,
    loading: cashDrawerLoading,
    refetch: refetchCashDrawer,
  } = useQuery(GET_CASH_DRAWER_STATUS, {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onError: (error) => setError(error),
  });

  // Mutations
  const [processPaymentMutation] = useMutation(PROCESS_PAYMENT, {
    onCompleted: () => {
      cache.invalidateFromMutation('processPayment', {}, currentTenant?.id);
    },
    onError: (error) => setError(error),
  });

  const [voidPaymentMutation] = useMutation(VOID_PAYMENT, {
    onCompleted: () => {
      cache.invalidateFromMutation('voidPayment', {}, currentTenant?.id);
    },
    onError: (error) => setError(error),
  });

  const [refundPaymentMutation] = useMutation(REFUND_PAYMENT, {
    onCompleted: () => {
      cache.invalidateFromMutation('refundPayment', {}, currentTenant?.id);
    },
    onError: (error) => setError(error),
  });

  const [calculateChangeMutation] = useMutation(CALCULATE_CHANGE);
  const [recordCashCountMutation] = useMutation(RECORD_CASH_COUNT);
  const [initiateMobileMoneyMutation] = useMutation(INITIATE_MOBILE_MONEY_PAYMENT);
  const [createStripePaymentMethodMutation] = useMutation(CREATE_STRIPE_PAYMENT_METHOD);
  const [validatePaymentMethodMutation] = useMutation(VALIDATE_PAYMENT_METHOD);

  // Subscriptions
  useSubscription(PAYMENT_PROCESSED, {
    variables: { tenantId: currentTenant?.id || '' },
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data.data?.paymentProcessed) {
        // Refresh cash drawer status after payment
        refetchCashDrawer();
      }
    },
  });

  useSubscription(CASH_DRAWER_UPDATED, {
    variables: { locationId: currentTenant?.id || '' },
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data.data?.cashDrawerUpdated) {
        // Refresh cash drawer status
        refetchCashDrawer();
      }
    },
  });

  // Handlers
  const processPayment = useCallback(async (transactionId: string, request: PaymentRequest): Promise<PaymentResult> => {
    try {
      setError(null);
      setIsProcessing(true);
      
      const result = await processPaymentMutation({
        variables: { transactionId, input: request },
      });

      const paymentResult = result.data?.processPayment;
      if (paymentResult) {
        return paymentResult;
      } else {
        throw new Error('Failed to process payment');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [processPaymentMutation]);

  const voidPayment = useCallback(async (transactionId: string): Promise<void> => {
    try {
      setError(null);
      setIsProcessing(true);
      
      const result = await voidPaymentMutation({
        variables: { transactionId },
      });

      if (!result.data?.voidPayment.success) {
        throw new Error(result.data?.voidPayment.message || 'Failed to void payment');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [voidPaymentMutation]);

  const refundPayment = useCallback(async (transactionId: string, amount: number): Promise<void> => {
    try {
      setError(null);
      setIsProcessing(true);
      
      const result = await refundPaymentMutation({
        variables: { transactionId, amount },
      });

      if (!result.data?.refundPayment.success) {
        throw new Error(result.data?.refundPayment.message || 'Failed to refund payment');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [refundPaymentMutation]);

  const calculateChange = useCallback(async (received: number, required: number) => {
    try {
      setError(null);
      
      const result = await calculateChangeMutation({
        variables: { received, required },
      });

      return result.data?.calculateChange || { changeAmount: 0, changeDenominations: [] };
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [calculateChangeMutation]);

  const recordCashCount = useCallback(async (denominations: Array<{ denomination: number; count: number }>) => {
    try {
      setError(null);
      
      const result = await recordCashCountMutation({
        variables: { denominations },
      });

      if (result.data?.recordCashCount.success) {
        return {
          totalAmount: result.data.recordCashCount.totalAmount,
          variance: result.data.recordCashCount.variance,
        };
      } else {
        throw new Error(result.data?.recordCashCount.message || 'Failed to record cash count');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [recordCashCountMutation]);

  const initiateMobileMoneyPayment = useCallback(async (phoneNumber: string, amount: number, reference: string) => {
    try {
      setError(null);
      
      const result = await initiateMobileMoneyMutation({
        variables: { phoneNumber, amount, reference },
      });

      return result.data?.initiateMobileMoneyPayment || {
        requestId: '',
        status: 'failed',
        message: 'Failed to initiate payment',
        expiresAt: new Date(),
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [initiateMobileMoneyMutation]);

  const checkMobileMoneyAccount = useCallback(async (phoneNumber: string) => {
    try {
      setError(null);
      
      const { data } = await cache.get(`mobile-money-account:${phoneNumber}`, {
        fallbackLoader: async () => {
          const result = await validatePaymentMethodMutation({
            variables: { phoneNumber },
          });
          return result.data?.mobileMoneyAccountStatus;
        },
      });

      return data || {
        isActive: false,
        provider: '',
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [cache, validatePaymentMethodMutation]);

  const createStripePaymentMethod = useCallback(async (cardDetails: {
    number: string;
    expMonth: number;
    expYear: number;
    cvc: string;
  }) => {
    try {
      setError(null);
      
      const result = await createStripePaymentMethodMutation({
        variables: { cardDetails },
      });

      return result.data?.createStripePaymentMethod || {
        paymentMethodId: '',
        status: 'failed',
        error: 'Failed to create payment method',
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [createStripePaymentMethodMutation]);

  const validatePaymentMethod = useCallback(async (method: PaymentMethod, amount: number) => {
    try {
      setError(null);
      
      const result = await validatePaymentMethodMutation({
        variables: { method, amount },
      });

      return result.data?.validatePaymentMethod || {
        valid: false,
        error: 'Validation failed',
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [validatePaymentMethodMutation]);

  const getPaymentHistory = useCallback(async (transactionId: string): Promise<PaymentRecord[]> => {
    try {
      setError(null);
      
      const { data } = await cache.get(`payment-history:${transactionId}`, {
        fallbackLoader: async () => {
          const result = await validatePaymentMethodMutation({
            variables: { transactionId },
          });
          return result.data?.paymentHistory;
        },
      });

      return data || [];
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [cache, validatePaymentMethodMutation]);

  const refreshCashDrawerStatus = useCallback(async () => {
    try {
      setError(null);
      await refetchCashDrawer();
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchCashDrawer]);

  // Computed values
  const cashDrawerStatus = cashDrawerData?.cashDrawerStatus || null;

  return {
    // State
    isProcessing: isProcessing || cashDrawerLoading,
    error,
    cashDrawerStatus,

    // Payment Processing
    processPayment,
    voidPayment,
    refundPayment,
    
    // Cash Operations
    calculateChange,
    recordCashCount,
    
    // Mobile Money Operations
    initiateMobileMoneyPayment,
    checkMobileMoneyAccount,
    
    // Stripe Operations
    createStripePaymentMethod,
    
    // Validation
    validatePaymentMethod,
    
    // Data Fetching
    getPaymentHistory,
    refreshCashDrawerStatus,
  };
}