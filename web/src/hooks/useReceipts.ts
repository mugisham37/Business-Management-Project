/**
 * Receipts Hook - Receipt Generation and Delivery
 * Requirements: 11.1, 11.2, 11.3
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useUnifiedCache } from '@/lib/cache';
import {
  GENERATE_RECEIPT,
  PREVIEW_RECEIPT,
  GET_AVAILABLE_PRINTERS,
} from '@/graphql/queries/pos-queries';
import {
  SEND_EMAIL_RECEIPT,
  SEND_SMS_RECEIPT,
  PRINT_RECEIPT,
  SEND_BULK_EMAIL_RECEIPTS,
  RESEND_FAILED_RECEIPTS,
  ADD_PRINTER,
  TEST_PRINTER,
  REMOVE_PRINTER,
} from '@/graphql/mutations/pos-mutations';
import {
  RECEIPT_DELIVERY_STATUS,
  PRINTER_STATUS_CHANGED,
} from '@/graphql/subscriptions/pos-subscriptions';
import type {
  ReceiptOptions,
  EmailReceiptOptions,
  SmsReceiptOptions,
  PrinterConfiguration,
} from '@/types/pos';

interface UseReceiptsOptions {
  enableSubscriptions?: boolean;
}

interface UseReceiptsResult {
  // State
  isGenerating: boolean;
  isSending: boolean;
  isPrinting: boolean;
  error: Error | null;
  availablePrinters: PrinterConfiguration[];

  // Receipt Generation
  generateReceipt: (transactionId: string, template?: string, options?: ReceiptOptions) => Promise<{
    content: string;
    format: string;
    size: number;
  }>;
  previewReceipt: (transactionId: string, template?: string, method?: string) => Promise<{
    content: string;
    format: string;
    estimatedSize: number;
  }>;
  
  // Receipt Delivery
  sendEmailReceipt: (transactionId: string, email: string, options?: EmailReceiptOptions) => Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
  sendSmsReceipt: (transactionId: string, phoneNumber: string, options?: SmsReceiptOptions) => Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    segments?: number;
  }>;
  printReceipt: (transactionId: string, printerId: string) => Promise<{
    success: boolean;
    printJobId?: string;
    error?: string;
  }>;
  
  // Bulk Operations
  sendBulkEmailReceipts: (requests: Array<{
    transactionId: string;
    email: string;
    options?: EmailReceiptOptions;
  }>) => Promise<{
    success: boolean;
    processed: number;
    failed: number;
    results: Array<{
      transactionId: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }>;
  }>;
  resendFailedReceipts: (transactionIds: string[]) => Promise<{
    success: boolean;
    processed: number;
    failed: number;
    results: Array<{
      transactionId: string;
      success: boolean;
      error?: string;
    }>;
  }>;
  
  // Printer Management
  addPrinter: (config: Omit<PrinterConfiguration, 'id'>) => Promise<PrinterConfiguration>;
  testPrinter: (printerId: string) => Promise<{
    success: boolean;
    testResult: {
      connected: boolean;
      responseTime: number;
      error?: string;
    };
  }>;
  removePrinter: (printerId: string) => Promise<void>;
  
  // Data Fetching
  getReceiptHistory: (transactionId: string) => Promise<Array<{
    id: string;
    method: string;
    recipient: string;
    status: string;
    sentAt: Date;
    deliveredAt?: Date;
    error?: string;
  }>>;
  refreshPrinters: () => Promise<void>;
}

export function useReceipts(options: UseReceiptsOptions = {}): UseReceiptsResult {
  const { enableSubscriptions = true } = options;
  const cache = useUnifiedCache();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Queries
  const {
    data: printersData,
    loading: printersLoading,
    refetch: refetchPrinters,
  } = useQuery(GET_AVAILABLE_PRINTERS, {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onError: (error) => setError(error),
  });

  // Mutations
  const [generateReceiptMutation] = useMutation(GENERATE_RECEIPT);
  const [previewReceiptMutation] = useMutation(PREVIEW_RECEIPT);
  const [sendEmailReceiptMutation] = useMutation(SEND_EMAIL_RECEIPT);
  const [sendSmsReceiptMutation] = useMutation(SEND_SMS_RECEIPT);
  const [printReceiptMutation] = useMutation(PRINT_RECEIPT);
  const [sendBulkEmailReceiptsMutation] = useMutation(SEND_BULK_EMAIL_RECEIPTS);
  const [resendFailedReceiptsMutation] = useMutation(RESEND_FAILED_RECEIPTS);
  const [addPrinterMutation] = useMutation(ADD_PRINTER);
  const [testPrinterMutation] = useMutation(TEST_PRINTER);
  const [removePrinterMutation] = useMutation(REMOVE_PRINTER);

  // Subscriptions
  useSubscription(RECEIPT_DELIVERY_STATUS, {
    variables: { transactionId: '' }, // Will be updated per transaction
    skip: !enableSubscriptions,
    onData: ({ data }) => {
      if (data.data?.receiptDeliveryStatus) {
        // Handle receipt delivery status updates
        console.log('Receipt delivery status:', data.data.receiptDeliveryStatus);
      }
    },
  });

  useSubscription(PRINTER_STATUS_CHANGED, {
    variables: { printerId: '' }, // Will be updated per printer
    skip: !enableSubscriptions,
    onData: ({ data }) => {
      if (data.data?.printerStatusChanged) {
        // Refresh printers list
        refetchPrinters();
      }
    },
  });

  // Handlers
  const generateReceipt = useCallback(async (transactionId: string, template?: string, options?: ReceiptOptions) => {
    try {
      setError(null);
      setIsGenerating(true);
      
      const result = await generateReceiptMutation({
        variables: { transactionId, template, options },
      });

      return result.data?.generateReceipt || {
        content: '',
        format: 'text',
        size: 0,
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [generateReceiptMutation]);

  const previewReceipt = useCallback(async (transactionId: string, template?: string, method?: string) => {
    try {
      setError(null);
      
      const result = await previewReceiptMutation({
        variables: { transactionId, template, method: method || 'email' },
      });

      return result.data?.previewReceipt || {
        content: '',
        format: 'text',
        estimatedSize: 0,
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [previewReceiptMutation]);

  const sendEmailReceipt = useCallback(async (transactionId: string, email: string, options?: EmailReceiptOptions) => {
    try {
      setError(null);
      setIsSending(true);
      
      const result = await sendEmailReceiptMutation({
        variables: { transactionId, email, options },
      });

      return result.data?.sendEmailReceipt || {
        success: false,
        error: 'Failed to send email receipt',
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [sendEmailReceiptMutation]);

  const sendSmsReceipt = useCallback(async (transactionId: string, phoneNumber: string, options?: SmsReceiptOptions) => {
    try {
      setError(null);
      setIsSending(true);
      
      const result = await sendSmsReceiptMutation({
        variables: { transactionId, phoneNumber, options },
      });

      return result.data?.sendSmsReceipt || {
        success: false,
        error: 'Failed to send SMS receipt',
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [sendSmsReceiptMutation]);

  const printReceipt = useCallback(async (transactionId: string, printerId: string) => {
    try {
      setError(null);
      setIsPrinting(true);
      
      const result = await printReceiptMutation({
        variables: { transactionId, printerId },
      });

      return result.data?.printReceipt || {
        success: false,
        error: 'Failed to print receipt',
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsPrinting(false);
    }
  }, [printReceiptMutation]);

  const sendBulkEmailReceipts = useCallback(async (requests: Array<{
    transactionId: string;
    email: string;
    options?: EmailReceiptOptions;
  }>) => {
    try {
      setError(null);
      setIsSending(true);
      
      const result = await sendBulkEmailReceiptsMutation({
        variables: { requests },
      });

      return result.data?.sendBulkEmailReceipts || {
        success: false,
        processed: 0,
        failed: requests.length,
        results: [],
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [sendBulkEmailReceiptsMutation]);

  const resendFailedReceipts = useCallback(async (transactionIds: string[]) => {
    try {
      setError(null);
      setIsSending(true);
      
      const result = await resendFailedReceiptsMutation({
        variables: { transactionIds },
      });

      return result.data?.resendFailedReceipts || {
        success: false,
        processed: 0,
        failed: transactionIds.length,
        results: [],
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [resendFailedReceiptsMutation]);

  const addPrinter = useCallback(async (config: Omit<PrinterConfiguration, 'id'>): Promise<PrinterConfiguration> => {
    try {
      setError(null);
      
      const result = await addPrinterMutation({
        variables: { config },
      });

      if (result.data?.addPrinter.success) {
        await refetchPrinters();
        return result.data.addPrinter.printer;
      } else {
        throw new Error(result.data?.addPrinter.message || 'Failed to add printer');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [addPrinterMutation, refetchPrinters]);

  const testPrinter = useCallback(async (printerId: string) => {
    try {
      setError(null);
      
      const result = await testPrinterMutation({
        variables: { printerId },
      });

      return result.data?.testPrinter || {
        success: false,
        testResult: {
          connected: false,
          responseTime: 0,
          error: 'Test failed',
        },
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [testPrinterMutation]);

  const removePrinter = useCallback(async (printerId: string): Promise<void> => {
    try {
      setError(null);
      
      const result = await removePrinterMutation({
        variables: { printerId },
      });

      if (result.data?.removePrinter.success) {
        await refetchPrinters();
      } else {
        throw new Error(result.data?.removePrinter.message || 'Failed to remove printer');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [removePrinterMutation, refetchPrinters]);

  const getReceiptHistory = useCallback(async (transactionId: string) => {
    try {
      setError(null);
      
      const { data } = await cache.get(`receipt-history:${transactionId}`, {
        fallbackLoader: async () => {
          const result = await generateReceiptMutation({
            variables: { transactionId },
          });
          return result.data?.receiptHistory;
        },
      });

      return data || [];
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [cache, generateReceiptMutation]);

  const refreshPrinters = useCallback(async () => {
    try {
      setError(null);
      await refetchPrinters();
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchPrinters]);

  // Computed values
  const availablePrinters = printersData?.availablePrinters || [];

  return {
    // State
    isGenerating,
    isSending,
    isPrinting: isPrinting || printersLoading,
    error,
    availablePrinters,

    // Receipt Generation
    generateReceipt,
    previewReceipt,
    
    // Receipt Delivery
    sendEmailReceipt,
    sendSmsReceipt,
    printReceipt,
    
    // Bulk Operations
    sendBulkEmailReceipts,
    resendFailedReceipts,
    
    // Printer Management
    addPrinter,
    testPrinter,
    removePrinter,
    
    // Data Fetching
    getReceiptHistory,
    refreshPrinters,
  };
}