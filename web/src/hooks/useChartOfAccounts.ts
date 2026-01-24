/**
 * Chart of Accounts Hooks
 * Custom hooks for account management and operations
 */

import { useQuery, useMutation, useSubscription, useLazyQuery, ApolloError } from '@apollo/client';
import { useState, useCallback, useMemo } from 'react';
import {
  GET_ACCOUNTS,
  GET_ACCOUNT,
  GET_ACCOUNT_HIERARCHY,
  SEARCH_ACCOUNTS,
} from '@/graphql/queries/financial';
import {
  CREATE_ACCOUNT,
  UPDATE_ACCOUNT,
  DELETE_ACCOUNT,
  ACTIVATE_ACCOUNT,
  DEACTIVATE_ACCOUNT,
} from '@/graphql/mutations/financial';
import {
  ACCOUNT_BALANCE_UPDATED,
} from '@/graphql/subscriptions/financial';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { errorLogger } from '@/lib/error-handling';

// Type definitions matching backend
export interface ChartOfAccount {
  id: string;
  tenantId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  accountSubType: string;
  parentAccountId?: string;
  accountLevel: number;
  accountPath: string;
  normalBalance: 'debit' | 'credit';
  description?: string;
  taxReportingCategory?: string;
  isActive: boolean;
  allowManualEntries: boolean;
  requireDepartment: boolean;
  requireProject: boolean;
  isSystemAccount: boolean;
  externalAccountId?: string;
  currentBalance: number | string;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  parentAccount?: Omit<ChartOfAccount, 'parentAccount' | 'childAccounts'>;
  childAccounts?: Omit<ChartOfAccount, 'childAccounts'>[];
  currentAccountBalance?: {
    accountId: string;
    debitBalance: string;
    creditBalance: string;
    netBalance: string;
    asOfDate: Date;
  };
}

// Hierarchy node with UI properties
export interface HierarchyNode extends ChartOfAccount {
  level: number;
  children: HierarchyNode[];
  hasChildren: boolean;
  isExpanded: boolean;
}

export interface AccountFilters {
  accountType?: string;
  isActive?: boolean;
  parentAccountId?: string;
  includeInactive?: boolean;
}

export interface CreateAccountInput {
  accountNumber: string;
  accountName: string;
  accountType: string;
  accountSubType: string;
  parentAccountId?: string;
  normalBalance: 'debit' | 'credit';
  description?: string;
  taxReportingCategory?: string;
  allowManualEntries?: boolean;
  requireDepartment?: boolean;
  requireProject?: boolean;
}

export interface UpdateAccountInput {
  accountNumber?: string;
  accountName?: string;
  accountType?: string;
  accountSubType?: string;
  parentAccountId?: string;
  normalBalance?: 'debit' | 'credit';
  description?: string;
  taxReportingCategory?: string;
  allowManualEntries?: boolean;
  requireDepartment?: boolean;
  requireProject?: boolean;
  isActive?: boolean;
}

// Single Account Hook
export function useAccount(accountId: string) {
  const { currentTenant } = useTenantStore();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery<{ account: ChartOfAccount }>(GET_ACCOUNT, {
    variables: { id: accountId },
    skip: !currentTenant?.id || !accountId,
    errorPolicy: 'all',
  });

  const account = useMemo(() => {
    if (!data?.account) return null;
    
    const accountData = data.account;
    return {
      ...accountData,
      currentBalance: typeof accountData.currentBalance === 'string' 
        ? parseFloat(accountData.currentBalance || '0') 
        : accountData.currentBalance,
      hasChildren: accountData.childAccounts?.length ?? 0 > 0,
      depth: accountData.accountLevel || 0,
      fullPath: accountData.parentAccount ? 
        `${accountData.parentAccount.accountName} > ${accountData.accountName}` : 
        accountData.accountName,
    };
  }, [data]);

  return {
    account,
    loading,
    error,
    refetch,
  };
}

// Multiple Accounts Hook
export function useAccounts(filters: AccountFilters = {}) {
  const { currentTenant } = useTenantStore();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery<{ accounts: ChartOfAccount[] }>(GET_ACCOUNTS, {
    variables: filters,
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const accounts = useMemo(() => {
    if (!data?.accounts) return [];
    
    return data.accounts.map((account: ChartOfAccount) => ({
      ...account,
      currentBalance: typeof account.currentBalance === 'string'
        ? parseFloat(account.currentBalance || '0')
        : account.currentBalance,
      depth: account.accountLevel || 0,
    }));
  }, [data]);

  const accountSummary = useMemo(() => {
    if (!accounts.length) return null;
    
    const byType = accounts.reduce((acc: Record<string, { count: number; totalBalance: number }>, account: ChartOfAccount & { currentBalance: number }) => {
      const type = account.accountType;
      if (!acc[type]) {
        acc[type] = { count: 0, totalBalance: 0 };
      }
      acc[type].count++;
      acc[type].totalBalance += account.currentBalance;
      return acc;
    }, {} as Record<string, { count: number; totalBalance: number }>);
    
    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a: ChartOfAccount) => a.isActive).length,
      inactiveAccounts: accounts.filter((a: ChartOfAccount) => !a.isActive).length,
      byType,
      totalBalance: accounts.reduce((sum: number, account: ChartOfAccount & { currentBalance: number }) => sum + account.currentBalance, 0),
    };
  }, [accounts]);

  return {
    accounts,
    accountSummary,
    loading,
    error,
    refetch,
  };
}

// Account Hierarchy Hook
export function useAccountHierarchy(rootAccountId?: string) {
  const { currentTenant } = useTenantStore();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery<{ accountHierarchy: ChartOfAccount[] }>(GET_ACCOUNT_HIERARCHY, {
    variables: { rootAccountId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const hierarchy = useMemo(() => {
    if (!data?.accountHierarchy) return [];
    
    const buildHierarchy = (accounts: ChartOfAccount[], level = 0): HierarchyNode[] => {
      return accounts.map((account: ChartOfAccount) => ({
        ...account,
        level,
        children: account.childAccounts ? buildHierarchy(account.childAccounts, level + 1) : [],
        hasChildren: account.childAccounts ? account.childAccounts.length > 0 : false,
        isExpanded: level < 2, // Auto-expand first 2 levels
      }));
    };
    
    return buildHierarchy(data.accountHierarchy);
  }, [data]);

  const flattenedAccounts = useMemo(() => {
    const flatten = (accounts: HierarchyNode[]): HierarchyNode[] => {
      return accounts.reduce((acc: HierarchyNode[], account: HierarchyNode) => {
        acc.push(account);
        if (account.children) {
          acc.push(...flatten(account.children));
        }
        return acc;
      }, []);
    };
    
    return flatten(hierarchy);
  }, [hierarchy]);

  return {
    hierarchy,
    flattenedAccounts,
    loading,
    error,
    refetch,
  };
}

// Account Search Hook
export function useAccountSearch() {
  const { currentTenant } = useTenantStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ChartOfAccount[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [searchAccounts] = useLazyQuery<{ searchAccounts: ChartOfAccount[] }>(SEARCH_ACCOUNTS, {
    errorPolicy: 'all',
  });

  const performSearch = useCallback(async (term: string, limit = 10) => {
    if (!term.trim() || !currentTenant?.id) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchTerm(term);

    try {
      const result = await searchAccounts({
        variables: { searchTerm: term, limit },
      });

      const results = result.data?.searchAccounts || [];
      setSearchResults(results.map((account: ChartOfAccount) => ({
        ...account,
        currentBalance: typeof account.currentBalance === 'string'
          ? parseFloat(account.currentBalance || '0')
          : account.currentBalance,
      })));
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useAccountSearch',
        operationId: 'performSearch',
        tenantId: currentTenant?.id,
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [currentTenant?.id, searchAccounts]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
  }, []);

  return {
    searchTerm,
    searchResults,
    isSearching,
    performSearch,
    clearSearch,
  };
}

// Account Mutations Hook
export function useAccountMutations() {
  const { currentTenant } = useTenantStore();

  const [createAccountMutation] = useMutation<{ createAccount: ChartOfAccount }>(CREATE_ACCOUNT, {
    onError: (error: ApolloError) => {
      errorLogger.logError(error, {
        component: 'useAccountMutations',
        operationId: 'createAccount',
        ...(currentTenant?.id && { tenantId: currentTenant.id }),
      });
    },
  });

  const [updateAccountMutation] = useMutation<{ updateAccount: ChartOfAccount }>(UPDATE_ACCOUNT, {
    onError: (error: ApolloError) => {
      errorLogger.logError(error, {
        component: 'useAccountMutations',
        operationId: 'updateAccount',
        ...(currentTenant?.id && { tenantId: currentTenant.id }),
      });
    },
  });

  const [deleteAccountMutation] = useMutation<{ deleteAccount: { success: boolean } }>(DELETE_ACCOUNT, {
    onError: (error: ApolloError) => {
      errorLogger.logError(error, {
        component: 'useAccountMutations',
        operationId: 'deleteAccount',
        ...(currentTenant?.id && { tenantId: currentTenant.id }),
      });
    },
  });

  const [activateAccountMutation] = useMutation<{ activateAccount: ChartOfAccount }>(ACTIVATE_ACCOUNT, {
    onError: (error: ApolloError) => {
      errorLogger.logError(error, {
        component: 'useAccountMutations',
        operationId: 'activateAccount',
        ...(currentTenant?.id && { tenantId: currentTenant.id }),
      });
    },
  });

  const [deactivateAccountMutation] = useMutation<{ deactivateAccount: ChartOfAccount }>(DEACTIVATE_ACCOUNT, {
    onError: (error: ApolloError) => {
      errorLogger.logError(error, {
        component: 'useAccountMutations',
        operationId: 'deactivateAccount',
        ...(currentTenant?.id && { tenantId: currentTenant.id }),
      });
    },
  });

  const createAccount = useCallback(async (input: CreateAccountInput) => {
    const result = await createAccountMutation({
      variables: { input },
      refetchQueries: ['GetAccounts', 'GetAccountHierarchy'],
    });
    return result.data?.createAccount;
  }, [createAccountMutation]);

  const updateAccount = useCallback(async (id: string, input: UpdateAccountInput) => {
    const result = await updateAccountMutation({
      variables: { id, input },
      refetchQueries: ['GetAccount', 'GetAccounts', 'GetAccountHierarchy'],
    });
    return result.data?.updateAccount;
  }, [updateAccountMutation]);

  const deleteAccount = useCallback(async (id: string) => {
    const result = await deleteAccountMutation({
      variables: { id },
      refetchQueries: ['GetAccounts', 'GetAccountHierarchy'],
    });
    return result.data?.deleteAccount;
  }, [deleteAccountMutation]);

  const activateAccount = useCallback(async (id: string) => {
    const result = await activateAccountMutation({
      variables: { id },
      refetchQueries: ['GetAccount', 'GetAccounts'],
    });
    return result.data?.activateAccount;
  }, [activateAccountMutation]);

  const deactivateAccount = useCallback(async (id: string) => {
    const result = await deactivateAccountMutation({
      variables: { id },
      refetchQueries: ['GetAccount', 'GetAccounts'],
    });
    return result.data?.deactivateAccount;
  }, [deactivateAccountMutation]);

  return {
    createAccount,
    updateAccount,
    deleteAccount,
    activateAccount,
    deactivateAccount,
  };
}

// Account Balance Subscriptions Hook
export function useAccountBalanceSubscriptions(accountIds?: string[]) {
  const { currentTenant } = useTenantStore();
  const [balanceUpdates, setBalanceUpdates] = useState<Array<{ timestamp: Date; [key: string]: unknown }>>([]);

  useSubscription<{ accountBalanceUpdated: { [key: string]: unknown } }>(ACCOUNT_BALANCE_UPDATED, {
    variables: { 
      tenantId: currentTenant?.id,
      accountIds,
    },
    skip: !currentTenant?.id,
    onData: ({ data }) => {
      const balanceUpdate = data?.data?.accountBalanceUpdated;
      if (balanceUpdate) {
        setBalanceUpdates(prev => [
          ...prev.slice(-9), // Keep last 10 updates
          {
            ...balanceUpdate,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  const clearUpdates = useCallback(() => {
    setBalanceUpdates([]);
  }, []);

  return {
    balanceUpdates,
    clearUpdates,
  };
}

// Account Validation Hook
export function useAccountValidation() {
  const validateAccountNumber = useCallback((accountNumber: string, existingAccounts: ChartOfAccount[] = []) => {
    const errors: string[] = [];
    
    if (!accountNumber) {
      errors.push('Account number is required');
    } else {
      if (!/^\d+$/.test(accountNumber)) {
        errors.push('Account number must contain only digits');
      }
      
      if (accountNumber.length < 3 || accountNumber.length > 10) {
        errors.push('Account number must be between 3 and 10 digits');
      }
      
      if (existingAccounts.some((acc: ChartOfAccount) => acc.accountNumber === accountNumber)) {
        errors.push('Account number already exists');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  const validateAccountName = useCallback((accountName: string, existingAccounts: ChartOfAccount[] = []) => {
    const errors: string[] = [];
    
    if (!accountName) {
      errors.push('Account name is required');
    } else {
      if (accountName.length < 2) {
        errors.push('Account name must be at least 2 characters');
      }
      
      if (accountName.length > 100) {
        errors.push('Account name must be less than 100 characters');
      }
      
      if (existingAccounts.some((acc: ChartOfAccount) => acc.accountName.toLowerCase() === accountName.toLowerCase())) {
        errors.push('Account name already exists');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  const validateAccountHierarchy = useCallback((parentAccountId: string, accountType: string, accounts: ChartOfAccount[] = []) => {
    const errors: string[] = [];
    
    if (parentAccountId) {
      const parentAccount = accounts.find((acc: ChartOfAccount) => acc.id === parentAccountId);
      
      if (!parentAccount) {
        errors.push('Parent account not found');
      } else {
        if (parentAccount.accountType !== accountType) {
          errors.push('Parent account must be of the same type');
        }
        
        if (parentAccount.accountLevel >= 5) {
          errors.push('Maximum account hierarchy depth (5 levels) exceeded');
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  return {
    validateAccountNumber,
    validateAccountName,
    validateAccountHierarchy,
  };
}

// Comprehensive Chart of Accounts Hook
export function useChartOfAccounts(filters: AccountFilters = {}) {
  const accounts = useAccounts(filters);
  const hierarchy = useAccountHierarchy();
  const search = useAccountSearch();
  const mutations = useAccountMutations();
  const balanceSubscriptions = useAccountBalanceSubscriptions();
  const validation = useAccountValidation();

  const accountTypes = useMemo(() => {
    const types = [
      { value: 'ASSET', label: 'Assets', normalBalance: 'debit' as const },
      { value: 'LIABILITY', label: 'Liabilities', normalBalance: 'credit' as const },
      { value: 'EQUITY', label: 'Equity', normalBalance: 'credit' as const },
      { value: 'REVENUE', label: 'Revenue', normalBalance: 'credit' as const },
      { value: 'EXPENSE', label: 'Expenses', normalBalance: 'debit' as const },
    ];
    
    return types.map((type) => ({
      ...type,
      accounts: accounts.accounts.filter((acc: ChartOfAccount) => acc.accountType === type.value),
      totalBalance: accounts.accounts
        .filter((acc: ChartOfAccount) => acc.accountType === type.value)
        .reduce((sum: number, acc: ChartOfAccount) => sum + (typeof acc.currentBalance === 'string' ? parseFloat(acc.currentBalance) : acc.currentBalance), 0),
    }));
  }, [accounts.accounts]);

  const accountsByType = useMemo(() => {
    return accounts.accounts.reduce((acc: Record<string, ChartOfAccount[]>, account: ChartOfAccount) => {
      const type = account.accountType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(account);
      return acc;
    }, {} as Record<string, ChartOfAccount[]>);
  }, [accounts.accounts]);

  return {
    // Accounts data
    accounts: accounts.accounts,
    accountSummary: accounts.accountSummary,
    accountsLoading: accounts.loading,
    accountsError: accounts.error,
    
    // Hierarchy data
    hierarchy: hierarchy.hierarchy,
    flattenedAccounts: hierarchy.flattenedAccounts,
    hierarchyLoading: hierarchy.loading,
    hierarchyError: hierarchy.error,
    
    // Organized data
    accountTypes,
    accountsByType,
    
    // Search functionality
    ...search,
    
    // Mutations
    ...mutations,
    
    // Subscriptions
    ...balanceSubscriptions,
    
    // Validation
    ...validation,
    
    // Refresh functions
    refreshAccounts: accounts.refetch,
    refreshHierarchy: hierarchy.refetch,
  };
}