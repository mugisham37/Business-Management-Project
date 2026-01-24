/**
 * Budget Management Hooks
 * Custom hooks for budget operations and management
 */

import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useState, useCallback, useMemo } from 'react';
import {
  GET_BUDGET,
  GET_BUDGETS,
  GET_BUDGET_VARIANCE,
} from '@/graphql/queries/financial';
import {
  CREATE_BUDGET,
  UPDATE_BUDGET,
  APPROVE_BUDGET,
  DELETE_BUDGET,
  ADD_BUDGET_LINE,
  UPDATE_BUDGET_LINE,
  DELETE_BUDGET_LINE,
} from '@/graphql/mutations/financial';
import {
  BUDGET_CREATED,
  BUDGET_APPROVED,
  BUDGET_VARIANCE_ALERT,
} from '@/graphql/subscriptions/financial';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { errorLogger } from '@/lib/error-handling';

export interface BudgetFilters {
  fiscalYear?: number;
  status?: string;
  budgetType?: string;
}

export interface CreateBudgetInput {
  budgetName: string;
  budgetYear: number;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface UpdateBudgetInput {
  budgetName?: string;
  description?: string;
}

export interface CreateBudgetLineInput {
  accountId: string;
  lineNumber: number;
  description: string;
  budgetAmount: string;
  notes?: string;
}

export interface UpdateBudgetLineInput {
  lineNumber?: number;
  description?: string;
  budgetAmount?: string;
  notes?: string;
}

// Single Budget Hook
export function useBudget(budgetId: string) {
  const { currentTenant } = useTenantStore();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_BUDGET, {
    variables: { id: budgetId },
    skip: !currentTenant?.id || !budgetId,
    errorPolicy: 'all',
  });

  const budget = useMemo(() => {
    if (!data?.budget) return null;
    
    const budgetData = data.budget;
    const totalBudget = parseFloat(budgetData.totalBudgetAmount || '0');
    const totalActual = parseFloat(budgetData.totalActualAmount || '0');
    const variance = totalBudget - totalActual;
    const variancePercentage = totalBudget > 0 ? (variance / totalBudget) * 100 : 0;
    
    return {
      ...budgetData,
      totalBudgetAmount: totalBudget,
      totalActualAmount: totalActual,
      totalVariance: variance,
      variancePercentage,
      utilizationPercentage: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0,
      remainingBudget: variance,
      isOverBudget: totalActual > totalBudget,
      budgetLines: budgetData.budgetLines?.map((line: Record<string, unknown>) => ({
        ...line,
        budgetAmount: parseFloat((line.budgetAmount as string) || '0'),
        actualAmount: parseFloat((line.actualAmount as string) || '0'),
        variance: parseFloat((line.budgetAmount as string) || '0') - parseFloat((line.actualAmount as string) || '0'),
        variancePercentage: parseFloat((line.budgetAmount as string) || '0') > 0 ? 
          ((parseFloat((line.budgetAmount as string) || '0') - parseFloat((line.actualAmount as string) || '0')) / parseFloat((line.budgetAmount as string) || '0')) * 100 : 0,
      })) || [],
    };
  }, [data]);

  return {
    budget,
    loading,
    error,
    refetch,
  };
}

// Multiple Budgets Hook
export function useBudgets(filters: BudgetFilters = {}) {
  const { currentTenant } = useTenantStore();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_BUDGETS, {
    variables: filters,
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const budgets = useMemo(() => {
    if (!data?.budgets) return [];
    
    return data.budgets.map((budget: Record<string, unknown>) => {
      const totalBudget = parseFloat((budget.totalBudgetAmount as string) || '0');
      const totalActual = parseFloat((budget.totalActualAmount as string) || '0');
      const variance = totalBudget - totalActual;
      
      return {
        ...budget,
        totalBudgetAmount: totalBudget,
        totalActualAmount: totalActual,
        totalVariance: variance,
        variancePercentage: totalBudget > 0 ? (variance / totalBudget) * 100 : 0,
        utilizationPercentage: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0,
        isOverBudget: totalActual > totalBudget,
      };
    });
  }, [data]);

  const budgetSummary = useMemo(() => {
    if (!budgets.length) return null;
    
    const totalBudgeted = budgets.reduce((sum: number, budget: Record<string, unknown>) => sum + (budget.totalBudgetAmount as number), 0);
    const totalActual = budgets.reduce((sum: number, budget: Record<string, unknown>) => sum + (budget.totalActualAmount as number), 0);
    const totalVariance = totalBudgeted - totalActual;
    
    return {
      totalBudgets: budgets.length,
      activeBudgets: budgets.filter((b: Record<string, unknown>) => b.isActive).length,
      approvedBudgets: budgets.filter((b: Record<string, unknown>) => b.status === 'approved').length,
      draftBudgets: budgets.filter((b: Record<string, unknown>) => b.status === 'draft').length,
      totalBudgeted,
      totalActual,
      totalVariance,
      overallVariancePercentage: totalBudgeted > 0 ? (totalVariance / totalBudgeted) * 100 : 0,
      overBudgetCount: budgets.filter((b: Record<string, unknown>) => b.isOverBudget).length,
    };
  }, [budgets]);

  return {
    budgets,
    budgetSummary,
    loading,
    error,
    refetch,
  };
}

// Budget Variance Hook
export function useBudgetVariance(budgetId: string, asOfDate?: Date) {
  const { currentTenant } = useTenantStore();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_BUDGET_VARIANCE, {
    variables: { 
      budgetId,
      asOfDate: asOfDate || new Date(),
    },
    skip: !currentTenant?.id || !budgetId,
    errorPolicy: 'all',
  });

  const varianceAnalysis = useMemo(() => {
    if (!data?.getBudgetVariance) return null;
    
    const variance = data.getBudgetVariance;
    const totalBudget = parseFloat(variance.totalBudget || '0');
    const totalActual = parseFloat(variance.totalActual || '0');
    const totalVarianceAmount = parseFloat(variance.totalVariance || '0');
    
    return {
      ...variance,
      totalBudget,
      totalActual,
      totalVariance: totalVarianceAmount,
      variancePercentage: parseFloat(variance.variancePercentage || '0'),
      isOverBudget: totalActual > totalBudget,
      utilizationRate: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0,
      accountVariances: variance.accountVariances?.map((account: Record<string, unknown>) => ({
        ...account,
        budgetAmount: parseFloat((account.budgetAmount as string) || '0'),
        actualAmount: parseFloat((account.actualAmount as string) || '0'),
        variance: parseFloat((account.variance as string) || '0'),
        variancePercentage: parseFloat((account.variancePercentage as string) || '0'),
        isOverBudget: parseFloat((account.actualAmount as string) || '0') > parseFloat((account.budgetAmount as string) || '0'),
      })) || [],
    };
  }, [data]);

  return {
    varianceAnalysis,
    loading,
    error,
    refetch,
  };
}

// Budget Mutations Hook
export function useBudgetMutations() {
  const { currentTenant } = useTenantStore();
  const tenantId = currentTenant?.id;

  const [createBudgetMutation] = useMutation(CREATE_BUDGET, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useBudgetMutations',
        operationId: 'createBudget',
        ...(tenantId && { tenantId }),
      });
    },
  });

  const [updateBudgetMutation] = useMutation(UPDATE_BUDGET, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useBudgetMutations',
        operationId: 'updateBudget',
        ...(tenantId && { tenantId }),
      });
    },
  });

  const [approveBudgetMutation] = useMutation(APPROVE_BUDGET, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useBudgetMutations',
        operationId: 'approveBudget',
        ...(tenantId && { tenantId }),
      });
    },
  });

  const [deleteBudgetMutation] = useMutation(DELETE_BUDGET, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useBudgetMutations',
        operationId: 'deleteBudget',
        ...(tenantId && { tenantId }),
      });
    },
  });

  const [addBudgetLineMutation] = useMutation(ADD_BUDGET_LINE, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useBudgetMutations',
        operationId: 'addBudgetLine',
        ...(tenantId && { tenantId }),
      });
    },
  });

  const [updateBudgetLineMutation] = useMutation(UPDATE_BUDGET_LINE, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useBudgetMutations',
        operationId: 'updateBudgetLine',
        ...(tenantId && { tenantId }),
      });
    },
  });

  const [deleteBudgetLineMutation] = useMutation(DELETE_BUDGET_LINE, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useBudgetMutations',
        operationId: 'deleteBudgetLine',
        ...(tenantId && { tenantId }),
      });
    },
  });

  const createBudget = useCallback(async (input: CreateBudgetInput) => {
    const result = await createBudgetMutation({
      variables: { input },
      refetchQueries: ['GetBudgets'],
    });
    return result.data?.createBudget;
  }, [createBudgetMutation]);

  const updateBudget = useCallback(async (id: string, input: UpdateBudgetInput) => {
    const result = await updateBudgetMutation({
      variables: { id, input },
      refetchQueries: ['GetBudget', 'GetBudgets'],
    });
    return result.data?.updateBudget;
  }, [updateBudgetMutation]);

  const approveBudget = useCallback(async (id: string) => {
    const result = await approveBudgetMutation({
      variables: { id },
      refetchQueries: ['GetBudget', 'GetBudgets'],
    });
    return result.data?.approveBudget;
  }, [approveBudgetMutation]);

  const deleteBudget = useCallback(async (id: string) => {
    await deleteBudgetMutation({
      variables: { id },
      refetchQueries: ['GetBudgets'],
    });
    return true;
  }, [deleteBudgetMutation]);

  const addBudgetLine = useCallback(async (budgetId: string, input: CreateBudgetLineInput) => {
    const result = await addBudgetLineMutation({
      variables: { budgetId, input },
      refetchQueries: ['GetBudget'],
    });
    return result.data?.addBudgetLine;
  }, [addBudgetLineMutation]);

  const updateBudgetLine = useCallback(async (id: string, input: UpdateBudgetLineInput) => {
    const result = await updateBudgetLineMutation({
      variables: { id, input },
      refetchQueries: ['GetBudget'],
    });
    return result.data?.updateBudgetLine;
  }, [updateBudgetLineMutation]);

  const deleteBudgetLine = useCallback(async (id: string) => {
    await deleteBudgetLineMutation({
      variables: { id },
      refetchQueries: ['GetBudget'],
    });
    return true;
  }, [deleteBudgetLineMutation]);

  return {
    createBudget,
    updateBudget,
    approveBudget,
    deleteBudget,
    addBudgetLine,
    updateBudgetLine,
    deleteBudgetLine,
  };
}

// Budget Subscriptions Hook
export function useBudgetSubscriptions() {
  const { currentTenant } = useTenantStore();
  const [budgetNotifications, setBudgetNotifications] = useState<Record<string, unknown>[]>([]);

  useSubscription(BUDGET_CREATED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant?.id,
    onData: ({ data }) => {
      if (data.data?.budgetCreated) {
        setBudgetNotifications(prev => [
          ...prev,
          {
            type: 'budget_created',
            budget: data.data.budgetCreated,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  useSubscription(BUDGET_APPROVED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant?.id,
    onData: ({ data }) => {
      if (data.data?.budgetApproved) {
        setBudgetNotifications(prev => [
          ...prev,
          {
            type: 'budget_approved',
            budget: data.data.budgetApproved,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  useSubscription(BUDGET_VARIANCE_ALERT, {
    variables: { 
      tenantId: currentTenant?.id,
      thresholdPercentage: 10, // Alert when variance exceeds 10%
    },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.budgetVarianceAlert) {
        setBudgetNotifications(prev => [
          ...prev,
          {
            type: 'variance_alert',
            alert: data.data.budgetVarianceAlert,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  const clearNotifications = useCallback(() => {
    setBudgetNotifications([]);
  }, []);

  return {
    budgetNotifications,
    clearNotifications,
  };
}

// Comprehensive Budget Management Hook
export function useBudgetManagement(budgetId?: string, filters: BudgetFilters = {}) {
  const budget = useBudget(budgetId || '');
  const budgets = useBudgets(filters);
  const varianceAnalysis = useBudgetVariance(budgetId || '');
  const mutations = useBudgetMutations();
  const subscriptions = useBudgetSubscriptions();

  const budgetAnalytics = useMemo(() => {
    if (!budgets.budgets.length) return null;
    
    const currentYear = new Date().getFullYear();
    const currentYearBudgets = budgets.budgets.filter((b: Record<string, unknown>) => (b.budgetYear as number) === currentYear);
    const previousYearBudgets = budgets.budgets.filter((b: Record<string, unknown>) => (b.budgetYear as number) === currentYear - 1);
    
    const currentYearTotal = currentYearBudgets.reduce((sum: number, b: Record<string, unknown>) => sum + (b.totalBudgetAmount as number), 0);
    const previousYearTotal = previousYearBudgets.reduce((sum: number, b: Record<string, unknown>) => sum + (b.totalBudgetAmount as number), 0);
    
    return {
      yearOverYearGrowth: previousYearTotal > 0 ? 
        ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100 : 0,
      averageBudgetSize: currentYearBudgets.length > 0 ? 
        currentYearTotal / currentYearBudgets.length : 0,
      budgetAccuracy: currentYearBudgets.length > 0 ? 
        currentYearBudgets.reduce((sum: number, b: Record<string, unknown>) => sum + Math.abs((b.variancePercentage as number)), 0) / currentYearBudgets.length : 0,
      topVarianceBudgets: currentYearBudgets
        .filter((b: Record<string, unknown>) => Math.abs((b.variancePercentage as number)) > 10)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Math.abs((b.variancePercentage as number)) - Math.abs((a.variancePercentage as number)))
        .slice(0, 5),
    };
  }, [budgets.budgets]);

  return {
    // Single budget data
    budget: budget.budget,
    budgetLoading: budget.loading,
    budgetError: budget.error,
    
    // Multiple budgets data
    budgets: budgets.budgets,
    budgetSummary: budgets.budgetSummary,
    budgetsLoading: budgets.loading,
    budgetsError: budgets.error,
    
    // Variance analysis
    varianceAnalysis: varianceAnalysis.varianceAnalysis,
    varianceLoading: varianceAnalysis.loading,
    varianceError: varianceAnalysis.error,
    
    // Analytics
    budgetAnalytics,
    
    // Mutations
    ...mutations,
    
    // Subscriptions
    ...subscriptions,
    
    // Refresh functions
    refreshBudget: budget.refetch,
    refreshBudgets: budgets.refetch,
    refreshVariance: varianceAnalysis.refetch,
  };
}