/**
 * Reconciliation Hook - Daily Reconciliation Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useUnifiedCache } from '@/lib/cache';
import {
  GET_RECONCILIATION_HISTORY,
} from '@/graphql/queries/pos-queries';
import {
  PERFORM_DAILY_RECONCILIATION,
  APPROVE_RECONCILIATION,
} from '@/graphql/mutations/pos-mutations';
import {
  RECONCILIATION_UPDATED,
} from '@/graphql/subscriptions/pos-subscriptions';
import type {
  ReconciliationReport,
  ReconciliationDiscrepancy,
} from '@/types/pos';

interface UseReconciliationOptions {
  locationId?: string;
  enableSubscriptions?: boolean;
}

interface UseReconciliationResult {
  // State
  reconciliationReports: ReconciliationReport[];
  currentReconciliation: ReconciliationReport | null;
  isReconciling: boolean;
  isApproving: boolean;
  totalCount: number;
  hasMore: boolean;
  error: Error | null;

  // Reconciliation Operations
  performDailyReconciliation: (date: Date, options?: {
    includeVoids?: boolean;
    includeRefunds?: boolean;
    autoApprove?: boolean;
  }) => Promise<ReconciliationReport>;
  approveReconciliation: (reconciliationId: string, notes?: string) => Promise<ReconciliationReport>;
  
  // Data Fetching
  loadReconciliationHistory: (limit?: number, offset?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  
  // Analysis Functions
  getTotalDiscrepancies: (report: ReconciliationReport) => number;
  getDiscrepanciesByType: (report: ReconciliationReport, type: string) => ReconciliationDiscrepancy[];
  getPaymentMethodVariance: (report: ReconciliationReport, paymentMethod: string) => number;
  hasSignificantDiscrepancies: (report: ReconciliationReport, threshold?: number) => boolean;
  
  // Utilities
  canPerformReconciliation: boolean;
  canApproveReconciliation: (report: ReconciliationReport) => boolean;
  getReconciliationStatus: (report: ReconciliationReport) => 'pending' | 'approved' | 'rejected';
}

export function useReconciliation(options: UseReconciliationOptions = {}): UseReconciliationResult {
  const { locationId, enableSubscriptions = true } = options;
  const currentTenant = useTenantStore(state => state.currentTenant);
  const cache = useUnifiedCache();
  
  const [reconciliationReports, setReconciliationReports] = useState<ReconciliationReport[]>([]);
  const [currentReconciliation, setCurrentReconciliation] = useState<ReconciliationReport | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const pageSize = 20;

  // Queries
  const {
    data: reconciliationHistoryData,
    loading: reconciliationHistoryLoading,
    refetch: refetchReconciliationHistory,
    fetchMore,
  } = useQuery(GET_RECONCILIATION_HISTORY, {
    variables: { limit: pageSize, offset: 0 },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data.reconciliationHistory) {
        setReconciliationReports(data.reconciliationHistory.reports);
        setHasMore(data.reconciliationHistory.hasMore);
      }
    },
    onError: (error) => setError(error),
  });

  // Mutations
  const [performDailyReconciliationMutation] = useMutation(PERFORM_DAILY_RECONCILIATION, {
    onCompleted: (data) => {
      if (data.performDailyReconciliation.success) {
        const newReport = data.performDailyReconciliation.report;
        setReconciliationReports(prev => [newReport, ...prev]);
        setCurrentReconciliation(newReport);
        cache.invalidateFromMutation('performDailyReconciliation', {}, currentTenant?.id);
      }
    },
    onError: (error) => setError(error),
  });

  const [approveReconciliationMutation] = useMutation(APPROVE_RECONCILIATION, {
    onCompleted: (data) => {
      if (data.approveReconciliation.success) {
        const approvedReport = data.approveReconciliation.report;
        setReconciliationReports(prev => 
          prev.map(report => 
            report.id === approvedReport.id ? approvedReport : report
          )
        );
        if (currentReconciliation?.id === approvedReport.id) {
          setCurrentReconciliation(approvedReport);
        }
        cache.invalidateFromMutation('approveReconciliation', {}, currentTenant?.id);
      }
    },
    onError: (error) => setError(error),
  });

  // Subscriptions
  useSubscription(RECONCILIATION_UPDATED, {
    variables: { locationId: locationId || '' },
    skip: !enableSubscriptions || !locationId,
    onData: ({ data }) => {
      if (data.data?.reconciliationUpdated) {
        const updatedReport = data.data.reconciliationUpdated;
        setReconciliationReports(prev => 
          prev.map(report => 
            report.id === updatedReport.id ? { ...report, ...updatedReport } : report
          )
        );
        if (currentReconciliation?.id === updatedReport.id) {
          setCurrentReconciliation(prev => prev ? { ...prev, ...updatedReport } : null);
        }
      }
    },
  });

  // Handlers
  const performDailyReconciliation = useCallback(async (date: Date, options?: {
    includeVoids?: boolean;
    includeRefunds?: boolean;
    autoApprove?: boolean;
  }): Promise<ReconciliationReport> => {
    try {
      setError(null);
      setIsReconciling(true);
      
      const result = await performDailyReconciliationMutation({
        variables: {
          date: date.toISOString().split('T')[0],
          options: {
            locationId,
            includeVoids: options?.includeVoids ?? true,
            includeRefunds: options?.includeRefunds ?? true,
            autoApprove: options?.autoApprove ?? false,
          },
        },
      });

      if (result.data?.performDailyReconciliation.success) {
        return result.data.performDailyReconciliation.report;
      } else {
        throw new Error(result.data?.performDailyReconciliation.message || 'Failed to perform reconciliation');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsReconciling(false);
    }
  }, [performDailyReconciliationMutation, locationId]);

  const approveReconciliation = useCallback(async (reconciliationId: string, notes?: string): Promise<ReconciliationReport> => {
    try {
      setError(null);
      setIsApproving(true);
      
      const result = await approveReconciliationMutation({
        variables: { reconciliationId, notes },
      });

      if (result.data?.approveReconciliation.success) {
        return result.data.approveReconciliation.report;
      } else {
        throw new Error(result.data?.approveReconciliation.message || 'Failed to approve reconciliation');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setIsApproving(false);
    }
  }, [approveReconciliationMutation]);

  const loadReconciliationHistory = useCallback(async (limit = pageSize, offset = 0) => {
    try {
      setError(null);
      await refetchReconciliationHistory({
        limit,
        offset,
      });
      setOffset(offset);
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchReconciliationHistory, pageSize]);

  const loadMore = useCallback(async () => {
    if (!hasMore || reconciliationHistoryLoading) return;

    try {
      setError(null);
      const newOffset = offset + pageSize;
      
      await fetchMore({
        variables: {
          limit: pageSize,
          offset: newOffset,
        },
      });
      
      setOffset(newOffset);
    } catch (error) {
      setError(error as Error);
    }
  }, [hasMore, reconciliationHistoryLoading, offset, pageSize, fetchMore]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await refetchReconciliationHistory();
      setOffset(0);
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchReconciliationHistory]);

  // Analysis Functions
  const getTotalDiscrepancies = useCallback((report: ReconciliationReport): number => {
    return report.discrepancies.reduce((total, discrepancy) => total + Math.abs(discrepancy.amount), 0);
  }, []);

  const getDiscrepanciesByType = useCallback((report: ReconciliationReport, type: string): ReconciliationDiscrepancy[] => {
    return report.discrepancies.filter(discrepancy => discrepancy.type === type);
  }, []);

  const getPaymentMethodVariance = useCallback((report: ReconciliationReport, paymentMethod: string): number => {
    const summary = report.paymentMethodBreakdown.find(pm => pm.paymentMethod === paymentMethod);
    return summary?.variance || 0;
  }, []);

  const hasSignificantDiscrepancies = useCallback((report: ReconciliationReport, threshold = 10): boolean => {
    const totalDiscrepancies = getTotalDiscrepancies(report);
    return totalDiscrepancies > threshold;
  }, [getTotalDiscrepancies]);

  // Utility Functions
  const canPerformReconciliation = true; // TODO: Check user permissions from auth context
  
  const canApproveReconciliation = useCallback((report: ReconciliationReport): boolean => {
    return report.status === 'pending'; // TODO: Check user permissions and ensure user is not approver
  }, []);

  const getReconciliationStatus = useCallback((report: ReconciliationReport): 'pending' | 'approved' | 'rejected' => {
    return report.status as 'pending' | 'approved' | 'rejected';
  }, []);

  // Computed values
  const totalCount = reconciliationHistoryData?.reconciliationHistory.totalCount || 0;

  return {
    // State
    reconciliationReports,
    currentReconciliation,
    isReconciling,
    isApproving,
    totalCount,
    hasMore,
    error: error || null,

    // Reconciliation Operations
    performDailyReconciliation,
    approveReconciliation,
    
    // Data Fetching
    loadReconciliationHistory,
    loadMore,
    refresh,
    
    // Analysis Functions
    getTotalDiscrepancies,
    getDiscrepanciesByType,
    getPaymentMethodVariance,
    hasSignificantDiscrepancies,
    
    // Utilities
    canPerformReconciliation,
    canApproveReconciliation,
    getReconciliationStatus,
  };
}

// Specialized hook for single reconciliation report
export function useReconciliationReport(reportId?: string) {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cache = useUnifiedCache();

  const loadReport = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const cachedReport = await cache.get(`reconciliation-report:${id}`);
      if (cachedReport) {
        setReport(cachedReport as ReconciliationReport);
      } else {
        // In a real implementation, you would fetch from the server
        throw new Error('Report not found in cache');
      }
    } catch (error) {
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  }, [cache]);

  useEffect(() => {
    if (reportId) {
      loadReport(reportId);
    }
  }, [reportId, loadReport]);

  return {
    report,
    loading,
    error,
    refetch: () => reportId ? loadReport(reportId) : Promise.resolve(),
  };
}