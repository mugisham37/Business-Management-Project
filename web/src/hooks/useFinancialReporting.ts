/**
 * Financial Reporting Hooks
 * Custom hooks for financial report generation and management
 */

import { useQuery, useSubscription } from '@apollo/client';
import { useState, useCallback, useMemo } from 'react';
import {
  GENERATE_BALANCE_SHEET,
  GENERATE_INCOME_STATEMENT,
  GENERATE_CASH_FLOW_STATEMENT,
  GENERATE_TRIAL_BALANCE,
  GENERATE_FINANCIAL_RATIOS,
  GET_FINANCIAL_SUMMARY,
  VALIDATE_ACCOUNTING_INTEGRITY,
} from '@/graphql/queries/financial';
import {
  FINANCIAL_REPORT_GENERATED,
  FINANCIAL_REPORT_FAILED,
} from '@/graphql/subscriptions/financial';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { errorLogger } from '@/lib/error-handling';

export interface FinancialReportOptions {
  asOfDate?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  includeComparativePeriod?: boolean;
  format?: 'detailed' | 'summary';
  currency?: string;
}

export interface ReportGenerationStatus {
  isGenerating: boolean;
  progress: number;
  error: string | null;
  reportId: string | null;
}

// Balance Sheet Hook
export function useBalanceSheet(options: FinancialReportOptions = {}) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [reportStatus, setReportStatus] = useState<ReportGenerationStatus>({
    isGenerating: false,
    progress: 0,
    error: null,
    reportId: null,
  });

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GENERATE_BALANCE_SHEET, {
    variables: {
      asOfDate: options.asOfDate || new Date(),
    },
    skip: !currentTenant,
    errorPolicy: 'all',
    onError: (error) => {
      errorLogger.logError(error, currentTenant?.id
        ? { component: 'useBalanceSheet', tenantId: currentTenant.id }
        : { component: 'useBalanceSheet' });
      setReportStatus(prev => ({ ...prev, error: error.message, isGenerating: false }));
    },
  });

  const generateBalanceSheet = useCallback(async (reportOptions: FinancialReportOptions = {}) => {
    setReportStatus({ isGenerating: true, progress: 0, error: null, reportId: null });
    
    try {
      const result = await refetch({
        asOfDate: reportOptions.asOfDate || new Date(),
      });
      
      setReportStatus({
        isGenerating: false,
        progress: 100,
        error: null,
        reportId: result.data?.generateBalanceSheet?.metadata?.reportId || null,
      });
      
      return result.data?.generateBalanceSheet;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate balance sheet';
      setReportStatus({
        isGenerating: false,
        progress: 0,
        error: errorMessage,
        reportId: null,
      });
      throw error;
    }
  }, [refetch]);

  const balanceSheetData = useMemo(() => {
    if (!data?.generateBalanceSheet) return null;
    
    const report = data.generateBalanceSheet;
    return {
      ...report,
      isBalanced: report.data?.assets?.totalAssets === 
        (report.data?.liabilities?.totalLiabilities + report.data?.equity?.totalEquity),
      totalAssets: report.data?.assets?.totalAssets || 0,
      totalLiabilitiesAndEquity: 
        (report.data?.liabilities?.totalLiabilities || 0) + (report.data?.equity?.totalEquity || 0),
    };
  }, [data]);

  return {
    balanceSheet: balanceSheetData,
    loading,
    error,
    reportStatus,
    generateBalanceSheet,
    refetch,
  };
}

// Income Statement Hook
export function useIncomeStatement(options: FinancialReportOptions = {}) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [reportStatus, setReportStatus] = useState<ReportGenerationStatus>({
    isGenerating: false,
    progress: 0,
    error: null,
    reportId: null,
  });

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GENERATE_INCOME_STATEMENT, {
    variables: {
      periodStart: options.periodStart || new Date(new Date().getFullYear(), 0, 1),
      periodEnd: options.periodEnd || new Date(),
    },
    skip: !currentTenant || !options.periodStart || !options.periodEnd,
    errorPolicy: 'all',
    onError: (error) => {
      errorLogger.logError(error, currentTenant?.id
        ? { component: 'useIncomeStatement', tenantId: currentTenant.id }
        : { component: 'useIncomeStatement' });
      setReportStatus(prev => ({ ...prev, error: error.message, isGenerating: false }));
    },
  });

  const generateIncomeStatement = useCallback(async (reportOptions: FinancialReportOptions) => {
    if (!reportOptions.periodStart || !reportOptions.periodEnd) {
      throw new Error('Period start and end dates are required for income statement');
    }

    setReportStatus({ isGenerating: true, progress: 0, error: null, reportId: null });
    
    try {
      const result = await refetch({
        periodStart: reportOptions.periodStart,
        periodEnd: reportOptions.periodEnd,
      });
      
      setReportStatus({
        isGenerating: false,
        progress: 100,
        error: null,
        reportId: result.data?.generateIncomeStatement?.metadata?.reportId || null,
      });
      
      return result.data?.generateIncomeStatement;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate income statement';
      setReportStatus({
        isGenerating: false,
        progress: 0,
        error: errorMessage,
        reportId: null,
      });
      throw error;
    }
  }, [refetch]);

  const incomeStatementData = useMemo(() => {
    if (!data?.generateIncomeStatement) return null;
    
    const report = data.generateIncomeStatement;
    const revenue = report.data?.revenue?.total || 0;
    const expenses = report.data?.expenses?.totalExpenses || 0;
    
    return {
      ...report,
      grossProfit: revenue - (report.data?.expenses?.costOfGoodsSold?.total || 0),
      netIncome: revenue - expenses,
      grossMargin: revenue > 0 ? ((revenue - (report.data?.expenses?.costOfGoodsSold?.total || 0)) / revenue) * 100 : 0,
      netMargin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
    };
  }, [data]);

  return {
    incomeStatement: incomeStatementData,
    loading,
    error,
    reportStatus,
    generateIncomeStatement,
    refetch,
  };
}

// Cash Flow Statement Hook
export function useCashFlowStatement(options: FinancialReportOptions = {}) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [reportStatus, setReportStatus] = useState<ReportGenerationStatus>({
    isGenerating: false,
    progress: 0,
    error: null,
    reportId: null,
  });

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GENERATE_CASH_FLOW_STATEMENT, {
    variables: {
      periodStart: options.periodStart || new Date(new Date().getFullYear(), 0, 1),
      periodEnd: options.periodEnd || new Date(),
    },
    skip: !currentTenant || !options.periodStart || !options.periodEnd,
    errorPolicy: 'all',
    onError: (error) => {
      errorLogger.logError(error, currentTenant?.id
        ? { component: 'useCashFlowStatement', tenantId: currentTenant.id }
        : { component: 'useCashFlowStatement' });
      setReportStatus(prev => ({ ...prev, error: error.message, isGenerating: false }));
    },
  });

  const generateCashFlowStatement = useCallback(async (reportOptions: FinancialReportOptions) => {
    if (!reportOptions.periodStart || !reportOptions.periodEnd) {
      throw new Error('Period start and end dates are required for cash flow statement');
    }

    setReportStatus({ isGenerating: true, progress: 0, error: null, reportId: null });
    
    try {
      const result = await refetch({
        periodStart: reportOptions.periodStart,
        periodEnd: reportOptions.periodEnd,
      });
      
      setReportStatus({
        isGenerating: false,
        progress: 100,
        error: null,
        reportId: result.data?.generateCashFlowStatement?.metadata?.reportId || null,
      });
      
      return result.data?.generateCashFlowStatement;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate cash flow statement';
      setReportStatus({
        isGenerating: false,
        progress: 0,
        error: errorMessage,
        reportId: null,
      });
      throw error;
    }
  }, [refetch]);

  return {
    cashFlowStatement: data?.generateCashFlowStatement,
    loading,
    error,
    reportStatus,
    generateCashFlowStatement,
    refetch,
  };
}

// Trial Balance Hook
export function useTrialBalance(options: FinancialReportOptions = {}) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GENERATE_TRIAL_BALANCE, {
    variables: {
      asOfDate: options.asOfDate || new Date(),
    },
    skip: !currentTenant,
    errorPolicy: 'all',
  });

  const trialBalanceData = useMemo(() => {
    if (!data?.generateTrialBalance) return null;
    
    const report = data.generateTrialBalance;
    const totals = report.data?.totals;
    
    return {
      ...report,
      isBalanced: totals?.isBalanced || false,
      balanceDifference: (totals?.totalDebits || 0) - (totals?.totalCredits || 0),
      accounts: report.data?.accounts || [],
    };
  }, [data]);

  return {
    trialBalance: trialBalanceData,
    loading,
    error,
    refetch,
  };
}

// Financial Ratios Hook
export function useFinancialRatios(options: FinancialReportOptions = {}) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GENERATE_FINANCIAL_RATIOS, {
    variables: {
      asOfDate: options.asOfDate || new Date(),
    },
    skip: !currentTenant,
    errorPolicy: 'all',
  });

  const ratiosWithAnalysis = useMemo(() => {
    if (!data?.generateFinancialRatios) return null;
    
    const ratios = data.generateFinancialRatios.data;
    
    // Add ratio analysis and benchmarks
    const analysis = {
      liquidity: {
        ...ratios.liquidityRatios,
        currentRatioHealth: ratios.liquidityRatios?.currentRatio >= 1.5 ? 'good' : 
                           ratios.liquidityRatios?.currentRatio >= 1.0 ? 'fair' : 'poor',
        quickRatioHealth: ratios.liquidityRatios?.quickRatio >= 1.0 ? 'good' : 
                         ratios.liquidityRatios?.quickRatio >= 0.5 ? 'fair' : 'poor',
      },
      profitability: {
        ...ratios.profitabilityRatios,
        grossMarginHealth: ratios.profitabilityRatios?.grossProfitMargin >= 0.3 ? 'good' : 
                          ratios.profitabilityRatios?.grossProfitMargin >= 0.15 ? 'fair' : 'poor',
        netMarginHealth: ratios.profitabilityRatios?.netProfitMargin >= 0.1 ? 'good' : 
                        ratios.profitabilityRatios?.netProfitMargin >= 0.05 ? 'fair' : 'poor',
      },
      leverage: {
        ...ratios.leverageRatios,
        debtToEquityHealth: ratios.leverageRatios?.debtToEquity <= 0.5 ? 'good' : 
                           ratios.leverageRatios?.debtToEquity <= 1.0 ? 'fair' : 'poor',
      },
      efficiency: {
        ...ratios.efficiencyRatios,
        assetTurnoverHealth: ratios.efficiencyRatios?.assetTurnover >= 1.0 ? 'good' : 
                            ratios.efficiencyRatios?.assetTurnover >= 0.5 ? 'fair' : 'poor',
      },
    };
    
    return {
      ...data.generateFinancialRatios,
      data: analysis,
    };
  }, [data]);

  return {
    financialRatios: ratiosWithAnalysis,
    loading,
    error,
    refetch,
  };
}

// Financial Summary Hook
export function useFinancialSummary(options: FinancialReportOptions = {}) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_FINANCIAL_SUMMARY, {
    variables: {
      dateFrom: options.periodStart,
      dateTo: options.periodEnd,
    },
    skip: !currentTenant,
    errorPolicy: 'all',
  });

  const summaryWithKPIs = useMemo(() => {
    if (!data?.financialSummary) return null;
    
    const summary = data.financialSummary;
    
    return {
      ...summary,
      kpis: {
        profitMargin: summary.totalRevenue > 0 ? 
          ((summary.netIncome / summary.totalRevenue) * 100) : 0,
        returnOnAssets: summary.totalAssets > 0 ? 
          ((summary.netIncome / summary.totalAssets) * 100) : 0,
        currentRatio: summary.totalLiabilities > 0 ? 
          (summary.totalAssets / summary.totalLiabilities) : 0,
        workingCapital: summary.totalAssets - summary.totalLiabilities,
        debtToEquityRatio: summary.totalEquity > 0 ? 
          (summary.totalLiabilities / summary.totalEquity) : 0,
      },
    };
  }, [data]);

  return {
    financialSummary: summaryWithKPIs,
    loading,
    error,
    refetch,
  };
}

// Accounting Integrity Hook
export function useAccountingIntegrity() {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(VALIDATE_ACCOUNTING_INTEGRITY, {
    skip: !currentTenant,
    errorPolicy: 'all',
  });

  const integrityStatus = useMemo(() => {
    if (!data?.validateAccountingIntegrity) return null;
    
    const validation = data.validateAccountingIntegrity;
    
    return {
      ...validation,
      overallHealth: validation.isValid ? 'healthy' : 
                    validation.errors?.length > 0 ? 'critical' : 'warning',
      criticalIssues: validation.errors?.filter((e: Record<string, unknown> & { type?: string }) => e.type === 'critical') || [],
      warningIssues: validation.warnings || [],
    };
  }, [data]);

  return {
    integrityStatus,
    loading,
    error,
    validateIntegrity: refetch,
  };
}

// Report Subscription Hook
export function useFinancialReportSubscriptions() {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [reportNotifications, setReportNotifications] = useState<Array<Record<string, unknown>>>([]);

  useSubscription(FINANCIAL_REPORT_GENERATED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.financialReportGenerated) {
        setReportNotifications(prev => [
          ...prev,
          {
            type: 'success',
            report: data.data.financialReportGenerated,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  useSubscription(FINANCIAL_REPORT_FAILED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.financialReportFailed) {
        setReportNotifications(prev => [
          ...prev,
          {
            type: 'error',
            report: data.data.financialReportFailed,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  const clearNotifications = useCallback(() => {
    setReportNotifications([]);
  }, []);

  return {
    reportNotifications,
    clearNotifications,
  };
}

// Comprehensive Financial Reporting Hook
export function useFinancialReporting(options: FinancialReportOptions = {}) {
  const balanceSheet = useBalanceSheet(options);
  const incomeStatement = useIncomeStatement(options);
  const cashFlowStatement = useCashFlowStatement(options);
  const trialBalance = useTrialBalance(options);
  const financialRatios = useFinancialRatios(options);
  const financialSummary = useFinancialSummary(options);
  const integrityStatus = useAccountingIntegrity();
  const reportSubscriptions = useFinancialReportSubscriptions();

  const generateAllReports = useCallback(async (reportOptions: FinancialReportOptions) => {
    const results = await Promise.allSettled([
      balanceSheet.generateBalanceSheet(reportOptions),
      incomeStatement.generateIncomeStatement(reportOptions),
      cashFlowStatement.generateCashFlowStatement(reportOptions),
    ]);

    return {
      balanceSheet: results[0],
      incomeStatement: results[1],
      cashFlowStatement: results[2],
    };
  }, [balanceSheet, incomeStatement, cashFlowStatement]);

  const isLoading = balanceSheet.loading || incomeStatement.loading || 
                   cashFlowStatement.loading || trialBalance.loading || 
                   financialRatios.loading || financialSummary.loading;

  return {
    balanceSheet,
    incomeStatement,
    cashFlowStatement,
    trialBalance,
    financialRatios,
    financialSummary,
    integrityStatus,
    reportSubscriptions,
    generateAllReports,
    isLoading,
  };
}