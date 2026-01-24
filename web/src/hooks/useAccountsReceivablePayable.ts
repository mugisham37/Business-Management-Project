/**
 * Accounts Receivable/Payable Hooks
 * Custom hooks for AR/AP management and operations
 */

import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useState, useCallback, useMemo } from 'react';
import {
  GET_RECEIVABLES,
  GET_PAYABLES,
  GET_AGING_REPORT,
} from '@/graphql/queries/financial';
import {
  CREATE_RECEIVABLE,
  UPDATE_RECEIVABLE,
  RECORD_RECEIVABLE_PAYMENT,
  CREATE_PAYABLE,
  UPDATE_PAYABLE,
  RECORD_PAYABLE_PAYMENT,
} from '@/graphql/mutations/financial';
import {
  RECEIVABLE_CREATED,
  RECEIVABLE_PAYMENT_RECEIVED,
  PAYABLE_CREATED,
  PAYABLE_PAYMENT_MADE,
} from '@/graphql/subscriptions/financial';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { errorLogger } from '@/lib/error-handling';

export interface ReceivableFilters {
  status?: string;
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface PayableFilters {
  status?: string;
  supplierId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface CreateReceivableInput {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  customerId: string;
  totalAmount: number;
  currency?: string;
  description?: string;
}

export interface CreatePayableInput {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  supplierId: string;
  totalAmount: number;
  currency?: string;
  description?: string;
}

export interface RecordPaymentInput {
  receivableId?: string;
  payableId?: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

// Accounts Receivable Hook
export function useAccountsReceivable(filters: ReceivableFilters = {}) {
  const { currentTenant } = useTenantStore();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_RECEIVABLES, {
    variables: filters,
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const receivables = useMemo(() => {
    if (!data?.getReceivables) return [];
    
    return data.getReceivables.map((receivable: Record<string, unknown>) => {
      const totalAmount = parseFloat(receivable.totalAmount as string || '0');
      const paidAmount = parseFloat(receivable.paidAmount as string || '0');
      const balanceAmount = parseFloat(receivable.balanceAmount as string || '0');
      const dueDate = new Date(receivable.dueDate as string);
      const today = new Date();
      const daysOverdue = dueDate < today ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        ...receivable,
        totalAmount,
        paidAmount,
        balanceAmount,
        daysOverdue,
        isOverdue: daysOverdue > 0,
        paymentPercentage: totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0,
        agingCategory: getAgingCategory(daysOverdue),
      };
    });
  }, [data]);

  const receivablesSummary = useMemo(() => {
    if (!receivables.length) return null;
    
    const totalReceivables = receivables.length;
    const totalAmount = receivables.reduce((sum: number, r: Record<string, unknown>) => sum + (r.totalAmount as number), 0);
    const totalPaid = receivables.reduce((sum: number, r: Record<string, unknown>) => sum + (r.paidAmount as number), 0);
    const totalOutstanding = receivables.reduce((sum: number, r: Record<string, unknown>) => sum + (r.balanceAmount as number), 0);
    const overdueReceivables = receivables.filter((r: Record<string, unknown>) => r.isOverdue);
    const totalOverdue = overdueReceivables.reduce((sum: number, r: Record<string, unknown>) => sum + (r.balanceAmount as number), 0);
    
    const byStatus = receivables.reduce((acc: Record<string, number>, r: Record<string, unknown>) => {
      const status = r.status as string;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    const byAging = receivables.reduce((acc: Record<string, number>, r: Record<string, unknown>) => {
      const category = r.agingCategory as string;
      acc[category] = (acc[category] || 0) + (r.balanceAmount as number);
      return acc;
    }, {});
    
    return {
      totalReceivables,
      totalAmount,
      totalPaid,
      totalOutstanding,
      totalOverdue,
      overdueCount: overdueReceivables.length,
      collectionRate: totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0,
      averageDaysOverdue: overdueReceivables.length > 0 ? 
        overdueReceivables.reduce((sum: number, r: Record<string, unknown>) => sum + (r.daysOverdue as number), 0) / overdueReceivables.length : 0,
      byStatus,
      byAging,
    };
  }, [receivables]);

  return {
    receivables,
    receivablesSummary,
    loading,
    error,
    refetch,
  };
}

// Accounts Payable Hook
export function useAccountsPayable(filters: PayableFilters = {}) {
  const { currentTenant } = useTenantStore();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_PAYABLES, {
    variables: filters,
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const payables = useMemo(() => {
    if (!data?.getPayables) return [];
    
    return data.getPayables.map((payable: Record<string, unknown>) => {
      const totalAmount = parseFloat(payable.totalAmount as string || '0');
      const paidAmount = parseFloat(payable.paidAmount as string || '0');
      const balanceAmount = parseFloat(payable.balanceAmount as string || '0');
      const dueDate = new Date(payable.dueDate as string);
      const today = new Date();
      const daysOverdue = dueDate < today ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const daysToDue = dueDate > today ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        ...payable,
        totalAmount,
        paidAmount,
        balanceAmount,
        daysOverdue,
        daysToDue,
        isOverdue: daysOverdue > 0,
        isDueSoon: daysToDue <= 7 && daysToDue > 0,
        paymentPercentage: totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0,
        agingCategory: getAgingCategory(daysOverdue),
      };
    });
  }, [data]);

  const payablesSummary = useMemo(() => {
    if (!payables.length) return null;
    
    const totalPayables = payables.length;
    const totalAmount = payables.reduce((sum: number, p: Record<string, unknown>) => sum + (p.totalAmount as number), 0);
    const totalPaid = payables.reduce((sum: number, p: Record<string, unknown>) => sum + (p.paidAmount as number), 0);
    const totalOutstanding = payables.reduce((sum: number, p: Record<string, unknown>) => sum + (p.balanceAmount as number), 0);
    const overduePayables = payables.filter((p: Record<string, unknown>) => p.isOverdue);
    const totalOverdue = overduePayables.reduce((sum: number, p: Record<string, unknown>) => sum + (p.balanceAmount as number), 0);
    const dueSoonPayables = payables.filter((p: Record<string, unknown>) => p.isDueSoon);
    const totalDueSoon = dueSoonPayables.reduce((sum: number, p: Record<string, unknown>) => sum + (p.balanceAmount as number), 0);
    
    const byStatus = payables.reduce((acc: Record<string, number>, p: Record<string, unknown>) => {
      const status = p.status as string;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    const byAging = payables.reduce((acc: Record<string, number>, p: Record<string, unknown>) => {
      const category = p.agingCategory as string;
      acc[category] = (acc[category] || 0) + (p.balanceAmount as number);
      return acc;
    }, {});
    
    return {
      totalPayables,
      totalAmount,
      totalPaid,
      totalOutstanding,
      totalOverdue,
      totalDueSoon,
      overdueCount: overduePayables.length,
      dueSoonCount: dueSoonPayables.length,
      paymentRate: totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0,
      averageDaysOverdue: overduePayables.length > 0 ? 
        overduePayables.reduce((sum: number, p: Record<string, unknown>) => sum + (p.daysOverdue as number), 0) / overduePayables.length : 0,
      byStatus,
      byAging,
    };
  }, [payables]);

  return {
    payables,
    payablesSummary,
    loading,
    error,
    refetch,
  };
}

// Aging Report Hook
export function useAgingReport(reportType: 'receivables' | 'payables', asOfDate?: Date) {
  const { currentTenant } = useTenantStore();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_AGING_REPORT, {
    variables: { 
      reportType,
      asOfDate: asOfDate || new Date(),
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const agingReport = useMemo(() => {
    if (!data?.getAgingReport) return [];
    
    return data.getAgingReport.map((item: Record<string, unknown>) => ({
      ...item,
      totalAmount: parseFloat(item.totalAmount as string || '0'),
      current: parseFloat(item.current as string || '0'),
      days1to30: parseFloat(item.days1to30 as string || '0'),
      days31to60: parseFloat(item.days31to60 as string || '0'),
      days61to90: parseFloat(item.days61to90 as string || '0'),
      over90Days: parseFloat(item.over90Days as string || '0'),
      riskLevel: calculateRiskLevel(item),
    }));
  }, [data]);

  const agingSummary = useMemo(() => {
    if (!agingReport.length) return null;

    interface AgingTotals {
      totalAmount: number;
      current: number;
      days1to30: number;
      days31to60: number;
      days61to90: number;
      over90Days: number;
    }
    
    const initialTotals: AgingTotals = {
      totalAmount: 0,
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90Days: 0,
    };

    const totals = agingReport.reduce((acc: AgingTotals, item: Record<string, unknown>) => ({
      totalAmount: acc.totalAmount + (item.totalAmount as number),
      current: acc.current + (item.current as number),
      days1to30: acc.days1to30 + (item.days1to30 as number),
      days31to60: acc.days31to60 + (item.days31to60 as number),
      days61to90: acc.days61to90 + (item.days61to90 as number),
      over90Days: acc.over90Days + (item.over90Days as number),
    }), initialTotals);
    
    const percentages = {
      currentPercent: totals.totalAmount > 0 ? (totals.current / totals.totalAmount) * 100 : 0,
      days1to30Percent: totals.totalAmount > 0 ? (totals.days1to30 / totals.totalAmount) * 100 : 0,
      days31to60Percent: totals.totalAmount > 0 ? (totals.days31to60 / totals.totalAmount) * 100 : 0,
      days61to90Percent: totals.totalAmount > 0 ? (totals.days61to90 / totals.totalAmount) * 100 : 0,
      over90DaysPercent: totals.totalAmount > 0 ? (totals.over90Days / totals.totalAmount) * 100 : 0,
    };
    
    return {
      ...totals,
      ...percentages,
      totalEntities: agingReport.length,
      highRiskEntities: agingReport.filter((item: Record<string, unknown>) => item.riskLevel === 'high').length,
      mediumRiskEntities: agingReport.filter((item: Record<string, unknown>) => item.riskLevel === 'medium').length,
      lowRiskEntities: agingReport.filter((item: Record<string, unknown>) => item.riskLevel === 'low').length,
    };
  }, [agingReport]);

  return {
    agingReport,
    agingSummary,
    loading,
    error,
    refetch,
  };
}

// AR/AP Mutations Hook
export function useARAPMutations() {
  const { currentTenant } = useTenantStore();

  // Helper function to build error context with optional tenantId
  const buildErrorContext = (operationId: string) => {
    const context: Partial<import('@/lib/error-handling').ErrorLogEntry['context']> = {
      component: 'useARAPMutations',
      operationId,
    };
    if (currentTenant?.id) {
      context.tenantId = currentTenant.id;
    }
    return context;
  };

  const [createReceivableMutation] = useMutation(CREATE_RECEIVABLE, {
    onError: (error) => {
      errorLogger.logError(error, buildErrorContext('createReceivable'));
    },
  });

  const [updateReceivableMutation] = useMutation(UPDATE_RECEIVABLE, {
    onError: (error) => {
      errorLogger.logError(error, buildErrorContext('updateReceivable'));
    },
  });

  const [recordReceivablePaymentMutation] = useMutation(RECORD_RECEIVABLE_PAYMENT, {
    onError: (error) => {
      errorLogger.logError(error, buildErrorContext('recordReceivablePayment'));
    },
  });

  const [createPayableMutation] = useMutation(CREATE_PAYABLE, {
    onError: (error) => {
      errorLogger.logError(error, buildErrorContext('createPayable'));
    },
  });

  const [updatePayableMutation] = useMutation(UPDATE_PAYABLE, {
    onError: (error) => {
      errorLogger.logError(error, buildErrorContext('updatePayable'));
    },
  });

  const [recordPayablePaymentMutation] = useMutation(RECORD_PAYABLE_PAYMENT, {
    onError: (error) => {
      errorLogger.logError(error, buildErrorContext('recordPayablePayment'));
    },
  });

  const createReceivable = useCallback(async (input: CreateReceivableInput) => {
    const result = await createReceivableMutation({
      variables: { input },
      refetchQueries: ['GetReceivables'],
    });
    return result.data?.createReceivable;
  }, [createReceivableMutation]);

  const updateReceivable = useCallback(async (id: string, input: Partial<CreateReceivableInput>) => {
    const result = await updateReceivableMutation({
      variables: { id, input },
      refetchQueries: ['GetReceivables'],
    });
    return result.data?.updateReceivable;
  }, [updateReceivableMutation]);

  const recordReceivablePayment = useCallback(async (input: RecordPaymentInput) => {
    const result = await recordReceivablePaymentMutation({
      variables: { input },
      refetchQueries: ['GetReceivables'],
    });
    return result.data?.recordReceivablePayment;
  }, [recordReceivablePaymentMutation]);

  const createPayable = useCallback(async (input: CreatePayableInput) => {
    const result = await createPayableMutation({
      variables: { input },
      refetchQueries: ['GetPayables'],
    });
    return result.data?.createPayable;
  }, [createPayableMutation]);

  const updatePayable = useCallback(async (id: string, input: Partial<CreatePayableInput>) => {
    const result = await updatePayableMutation({
      variables: { id, input },
      refetchQueries: ['GetPayables'],
    });
    return result.data?.updatePayable;
  }, [updatePayableMutation]);

  const recordPayablePayment = useCallback(async (input: RecordPaymentInput) => {
    const result = await recordPayablePaymentMutation({
      variables: { input },
      refetchQueries: ['GetPayables'],
    });
    return result.data?.recordPayablePayment;
  }, [recordPayablePaymentMutation]);

  return {
    createReceivable,
    updateReceivable,
    recordReceivablePayment,
    createPayable,
    updatePayable,
    recordPayablePayment,
  };
}

// AR/AP Subscriptions Hook
export function useARAPSubscriptions() {
  const { currentTenant } = useTenantStore();
  const [arapNotifications, setArapNotifications] = useState<Record<string, unknown>[]>([]);

  useSubscription(RECEIVABLE_CREATED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.receivableCreated) {
        setArapNotifications(prev => [
          ...prev,
          {
            type: 'receivable_created',
            data: data.data.receivableCreated,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  useSubscription(RECEIVABLE_PAYMENT_RECEIVED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.receivablePaymentReceived) {
        setArapNotifications(prev => [
          ...prev,
          {
            type: 'receivable_payment',
            data: data.data.receivablePaymentReceived,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  useSubscription(PAYABLE_CREATED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.payableCreated) {
        setArapNotifications(prev => [
          ...prev,
          {
            type: 'payable_created',
            data: data.data.payableCreated,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  useSubscription(PAYABLE_PAYMENT_MADE, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.payablePaymentMade) {
        setArapNotifications(prev => [
          ...prev,
          {
            type: 'payable_payment',
            data: data.data.payablePaymentMade,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  const clearNotifications = useCallback(() => {
    setArapNotifications([]);
  }, []);

  return {
    arapNotifications,
    clearNotifications,
  };
}

// Utility Functions
function getAgingCategory(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1-30 days';
  if (daysOverdue <= 60) return '31-60 days';
  if (daysOverdue <= 90) return '61-90 days';
  return 'over 90 days';
}

function calculateRiskLevel(item: Record<string, unknown>): 'low' | 'medium' | 'high' {
  const totalAmount = parseFloat(item.totalAmount as string || '0');
  const over90Days = parseFloat(item.over90Days as string || '0');
  const days61to90 = parseFloat(item.days61to90 as string || '0');
  
  const highRiskPercentage = totalAmount > 0 ? (over90Days / totalAmount) * 100 : 0;
  const mediumRiskPercentage = totalAmount > 0 ? ((over90Days + days61to90) / totalAmount) * 100 : 0;
  
  if (highRiskPercentage > 50) return 'high';
  if (mediumRiskPercentage > 30) return 'medium';
  return 'low';
}

// Comprehensive AR/AP Hook
export function useAccountsReceivablePayable() {
  const receivables = useAccountsReceivable();
  const payables = useAccountsPayable();
  const receivablesAging = useAgingReport('receivables');
  const payablesAging = useAgingReport('payables');
  const mutations = useARAPMutations();
  const subscriptions = useARAPSubscriptions();

  const combinedSummary = useMemo(() => {
    const receivablesSummary = receivables.receivablesSummary;
    const payablesSummary = payables.payablesSummary;
    
    if (!receivablesSummary || !payablesSummary) return null;
    
    return {
      netPosition: receivablesSummary.totalOutstanding - payablesSummary.totalOutstanding,
      workingCapital: receivablesSummary.totalOutstanding - payablesSummary.totalOutstanding,
      dso: receivablesSummary.totalAmount > 0 ? 
        (receivablesSummary.totalOutstanding / receivablesSummary.totalAmount) * 365 : 0,
      dpo: payablesSummary.totalAmount > 0 ? 
        (payablesSummary.totalOutstanding / payablesSummary.totalAmount) * 365 : 0,
      cashFlowImpact: {
        receivablesOverdue: receivablesSummary.totalOverdue,
        payablesOverdue: payablesSummary.totalOverdue,
        netOverdue: receivablesSummary.totalOverdue - payablesSummary.totalOverdue,
      },
    };
  }, [receivables.receivablesSummary, payables.payablesSummary]);

  return {
    // Receivables
    receivables: receivables.receivables,
    receivablesSummary: receivables.receivablesSummary,
    receivablesLoading: receivables.loading,
    receivablesError: receivables.error,
    
    // Payables
    payables: payables.payables,
    payablesSummary: payables.payablesSummary,
    payablesLoading: payables.loading,
    payablesError: payables.error,
    
    // Aging reports
    receivablesAging: receivablesAging.agingReport,
    receivablesAgingSummary: receivablesAging.agingSummary,
    payablesAging: payablesAging.agingReport,
    payablesAgingSummary: payablesAging.agingSummary,
    agingLoading: receivablesAging.loading || payablesAging.loading,
    agingError: receivablesAging.error || payablesAging.error,
    
    // Combined analytics
    combinedSummary,
    
    // Mutations
    ...mutations,
    
    // Subscriptions
    ...subscriptions,
    
    // Refresh functions
    refreshReceivables: receivables.refetch,
    refreshPayables: payables.refetch,
    refreshReceivablesAging: receivablesAging.refetch,
    refreshPayablesAging: payablesAging.refetch,
  };
}