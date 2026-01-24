/**
 * Financial Dashboard Hook
 * Comprehensive hook that aggregates all financial data for dashboard views
 */

import { useMemo } from 'react';
import { useFinancialReporting } from './useFinancialReporting';
import { useBudgetManagement } from './useBudgetManagement';
import { useChartOfAccounts } from './useChartOfAccounts';
import { useJournalEntries } from './useJournalEntries';
import { useMultiCurrency } from './useMultiCurrency';
import { useAccountsReceivablePayable } from './useAccountsReceivablePayable';
import { financialUtils } from '@/lib/utils/financial';

export interface FinancialDashboardOptions {
  period?: {
    startDate: Date;
    endDate: Date;
  };
  asOfDate?: Date;
  includeBudgetComparison?: boolean;
  includeRatios?: boolean;
  includeCashFlow?: boolean;
}

export function useFinancialDashboard(options: FinancialDashboardOptions = {}) {
  const {
    period = {
      startDate: new Date(new Date().getFullYear(), 0, 1), // Start of current year
      endDate: new Date(),
    },
    asOfDate = new Date(),
    includeBudgetComparison = true,
    includeRatios = true,
    includeCashFlow = true,
  } = options;

  // Core financial data
  const financialReporting = useFinancialReporting({
    periodStart: period.startDate,
    periodEnd: period.endDate,
    asOfDate,
  });

  const budgetManagement = useBudgetManagement(undefined, {
    fiscalYear: new Date().getFullYear(),
  });

  const chartOfAccounts = useChartOfAccounts();
  
  const journalEntries = useJournalEntries({
    dateFrom: period.startDate.toISOString().split('T')[0] || '',
    dateTo: period.endDate.toISOString().split('T')[0] || '',
  });

  const multiCurrency = useMultiCurrency();
  const arap = useAccountsReceivablePayable();

  // Key Performance Indicators
  const kpis = useMemo(() => {
    const balanceSheet = financialReporting.balanceSheet.balanceSheet;
    const incomeStatement = financialReporting.incomeStatement.incomeStatement;
    const financialSummary = financialReporting.financialSummary.financialSummary;
    const ratios = financialReporting.financialRatios.financialRatios;

    if (!balanceSheet || !incomeStatement || !financialSummary) {
      return null;
    }

    const totalAssets = balanceSheet.data?.assets?.totalAssets || 0;
    const totalLiabilities = balanceSheet.data?.liabilities?.totalLiabilities || 0;
    const totalEquity = balanceSheet.data?.equity?.totalEquity || 0;
    const revenue = incomeStatement.data?.revenue?.total || 0;
    const netIncome = incomeStatement.data?.netIncome || 0;

    return {
      // Profitability KPIs
      revenue,
      netIncome,
      grossProfit: incomeStatement.data?.grossProfit || 0,
      netProfitMargin: revenue > 0 ? (netIncome / revenue) * 100 : 0,
      grossProfitMargin: revenue > 0 ? ((incomeStatement.data?.grossProfit || 0) / revenue) * 100 : 0,

      // Liquidity KPIs
      totalAssets,
      totalLiabilities,
      totalEquity,
      workingCapital: financialSummary.kpis?.workingCapital || 0,
      currentRatio: ratios?.data?.liquidity?.currentRatio || 0,
      quickRatio: ratios?.data?.liquidity?.quickRatio || 0,

      // Efficiency KPIs
      returnOnAssets: totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0,
      returnOnEquity: totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0,
      debtToEquityRatio: totalEquity > 0 ? totalLiabilities / totalEquity : 0,

      // Cash Flow KPIs
      cashBalance: financialSummary.cashBalance || 0,
      accountsReceivable: financialSummary.accountsReceivable || 0,
      accountsPayable: financialSummary.accountsPayable || 0,

      // AR/AP KPIs
      totalReceivables: arap.receivablesSummary?.totalOutstanding || 0,
      totalPayables: arap.payablesSummary?.totalOutstanding || 0,
      overdueReceivables: arap.receivablesSummary?.totalOverdue || 0,
      overduePayables: arap.payablesSummary?.totalOverdue || 0,
    };
  }, [
    financialReporting.balanceSheet.balanceSheet,
    financialReporting.incomeStatement.incomeStatement,
    financialReporting.financialSummary.financialSummary,
    financialReporting.financialRatios.financialRatios,
    arap.receivablesSummary,
    arap.payablesSummary,
  ]);

  // Budget vs Actual Analysis
  const budgetAnalysis = useMemo(() => {
    if (!includeBudgetComparison || !budgetManagement.budgets.length) {
      return null;
    }

    const currentYearBudgets = budgetManagement.budgets.filter(
      (b: Record<string, unknown>) => b.budgetYear === new Date().getFullYear() && b.status === 'approved'
    );

    if (!currentYearBudgets.length) {
      return null;
    }

    const totalBudgeted = currentYearBudgets.reduce((sum: number, b: Record<string, unknown>) => sum + (typeof b.totalBudgetAmount === 'number' ? b.totalBudgetAmount : 0), 0);
    const totalActual = currentYearBudgets.reduce((sum: number, b: Record<string, unknown>) => sum + (typeof b.totalActualAmount === 'number' ? b.totalActualAmount : 0), 0);
    const totalVariance = totalBudgeted - totalActual;
    const variancePercentage = totalBudgeted > 0 ? (totalVariance / totalBudgeted) * 100 : 0;

    return {
      totalBudgeted,
      totalActual,
      totalVariance,
      variancePercentage,
      utilizationRate: totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0,
      isOverBudget: totalActual > totalBudgeted,
      budgetAccuracy: Math.abs(variancePercentage),
      topVariances: currentYearBudgets
        .filter((b: Record<string, unknown>) => typeof b.variancePercentage === 'number' && Math.abs(b.variancePercentage) > 10)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
          const aVar = typeof a.variancePercentage === 'number' ? a.variancePercentage : 0;
          const bVar = typeof b.variancePercentage === 'number' ? b.variancePercentage : 0;
          return Math.abs(bVar) - Math.abs(aVar);
        })
        .slice(0, 5),
    };
  }, [includeBudgetComparison, budgetManagement.budgets]);

  // Financial Health Score
  const healthScore = useMemo(() => {
    if (!includeRatios || !kpis) {
      return null;
    }

    return financialUtils.calculateFinancialHealthScore({
      currentRatio: kpis.currentRatio,
      quickRatio: kpis.quickRatio,
      debtToEquity: kpis.debtToEquityRatio,
      returnOnAssets: kpis.returnOnAssets,
      netProfitMargin: kpis.netProfitMargin,
    });
  }, [includeRatios, kpis]);

  // Cash Flow Projection
  const cashFlowProjection = useMemo(() => {
    if (!includeCashFlow || !kpis) {
      return null;
    }

    // Simple 6-month projection based on current trends
    const monthlyRevenue = kpis.revenue / 12; // Assuming annual revenue
    const monthlyExpenses = (kpis.revenue - kpis.netIncome) / 12;
    const monthlyInflows = Array(6).fill(monthlyRevenue);
    const monthlyOutflows = Array(6).fill(monthlyExpenses);

    return financialUtils.projectCashFlow(
      kpis.cashBalance,
      monthlyInflows,
      monthlyOutflows
    );
  }, [includeCashFlow, kpis]);

  // Account Activity Summary
  const accountActivity = useMemo(() => {
    const accounts = chartOfAccounts.accounts;
    const entries = journalEntries.journalEntries;

    if (!accounts.length || !entries.length) {
      return null;
    }

    const recentEntries = entries
      .filter((e: Record<string, unknown>) => e.status === 'posted')
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aDate = typeof a.postingDate === 'string' ? new Date(a.postingDate).getTime() : 0;
        const bDate = typeof b.postingDate === 'string' ? new Date(b.postingDate).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 10);

    const accountsWithActivity = accounts
      .filter(a => a.currentBalance !== 0)
      .sort((a, b) => Math.abs(b.currentBalance) - Math.abs(a.currentBalance))
      .slice(0, 10);

    return {
      recentEntries,
      accountsWithActivity,
      totalPostedEntries: entries.filter((e: Record<string, unknown>) => e.status === 'posted').length,
      totalDraftEntries: entries.filter((e: Record<string, unknown>) => e.status === 'draft').length,
      unbalancedEntries: entries.filter((e: Record<string, unknown>) => e.isBalanced === false).length,
    };
  }, [chartOfAccounts.accounts, journalEntries.journalEntries]);

  // Alerts and Notifications
  const alerts = useMemo(() => {
    const alerts: Array<{
      type: 'warning' | 'error' | 'info';
      title: string;
      message: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // Financial health alerts
    if (healthScore && healthScore.score < 60) {
      alerts.push({
        type: 'error',
        title: 'Poor Financial Health',
        message: `Financial health score is ${healthScore.score}/100. Immediate attention required.`,
        priority: 'high',
      });
    }

    // Budget variance alerts
    if (budgetAnalysis && Math.abs(budgetAnalysis.variancePercentage) > 20) {
      alerts.push({
        type: 'warning',
        title: 'Significant Budget Variance',
        message: `Budget variance is ${budgetAnalysis.variancePercentage.toFixed(1)}%. Review budget performance.`,
        priority: 'medium',
      });
    }

    // Cash flow alerts
    if (kpis && kpis.cashBalance < 0) {
      alerts.push({
        type: 'error',
        title: 'Negative Cash Balance',
        message: 'Cash balance is negative. Immediate cash flow management required.',
        priority: 'high',
      });
    }

    // Overdue receivables alerts
    if (arap.receivablesSummary && arap.receivablesSummary.totalOverdue > 0) {
      alerts.push({
        type: 'warning',
        title: 'Overdue Receivables',
        message: `${financialUtils.formatFinancialAmount(arap.receivablesSummary.totalOverdue)} in overdue receivables.`,
        priority: 'medium',
      });
    }

    // Accounting integrity alerts
    if (financialReporting.integrityStatus.integrityStatus && !financialReporting.integrityStatus.integrityStatus.isValid) {
      alerts.push({
        type: 'error',
        title: 'Accounting Integrity Issues',
        message: 'Accounting integrity validation failed. Review journal entries.',
        priority: 'high',
      });
    }

    return alerts.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }, [healthScore, budgetAnalysis, kpis, arap.receivablesSummary, financialReporting.integrityStatus.integrityStatus]);

  // Loading states
  const isLoading = 
    financialReporting.isLoading ||
    budgetManagement.budgetsLoading ||
    chartOfAccounts.accountsLoading ||
    journalEntries.loading ||
    multiCurrency.currenciesLoading ||
    arap.receivablesLoading ||
    arap.payablesLoading;

  // Error states
  const errors = [
    financialReporting.balanceSheet.error,
    financialReporting.incomeStatement.error,
    budgetManagement.budgetsError,
    chartOfAccounts.accountsError,
    journalEntries.error,
    multiCurrency.currenciesError,
    arap.receivablesError,
    arap.payablesError,
  ].filter(Boolean);

  // Refresh all data
  const refreshAll = async () => {
    await Promise.all([
      financialReporting.balanceSheet.refetch(),
      financialReporting.incomeStatement.refetch(),
      budgetManagement.refreshBudgets(),
      chartOfAccounts.refreshAccounts(),
      journalEntries.refetch(),
      multiCurrency.refreshCurrencies(),
      arap.refreshReceivables(),
      arap.refreshPayables(),
    ]);
  };

  return {
    // Core data
    kpis,
    budgetAnalysis,
    healthScore,
    cashFlowProjection,
    accountActivity,
    alerts,

    // Individual module data
    financialReporting,
    budgetManagement,
    chartOfAccounts,
    journalEntries,
    multiCurrency,
    arap,

    // State
    isLoading,
    errors,
    hasErrors: errors.length > 0,

    // Actions
    refreshAll,

    // Utilities
    formatAmount: multiCurrency.formatAmount,
    baseCurrency: multiCurrency.baseCurrency,
  };
}