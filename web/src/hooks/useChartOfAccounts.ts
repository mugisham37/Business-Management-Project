/**
 * Chart of Accounts Hooks
 * Custom hooks for account management and operations
 */

import { useQuery, useMutation, useSubscription } from '@apollo/client';
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
import { useAuth } from './useAuth';
import { errorLogger } from '@/lib/error-handling';

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
  const { currentTenant } = useAuth();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_ACCOUNT, {
    variables: { id: accountId },
    skip: !currentTenant || !accountId,
    errorPolicy: 'all',
  });

  const account = useMemo(() => {
    if (!data?.account) return null;
    
    const accountData = data.account;
    return {
      ...accountData,
      currentBalance: parseFloat(accountData.currentBalance || '0'),
      hasChildren: accountData.childAccounts?.length > 0,
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
  const { currentTenant } = useAuth();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_ACCOUNTS, {
    variables: filters,
    skip: !currentTenant,
    errorPolicy: 'all',
  });

  const accounts = useMemo(() => {
    if (!data?.accounts) return [];
    
    return data.accounts.map((account: any) => ({
      ...account,
      currentBalance: parseFloat(account.currentBalance || '0'),
      depth: account.accountLevel || 0,
    }));
  }, [data]);

  const accountSummary = useMemo(() => {
    if (!accounts.length) return null;
    
    const byType = accounts.reduce((acc, account) => {
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
      activeAccounts: accounts.filter(a => a.isActive).length,
      inactiveAccounts: accounts.filter(a => !a.isActive).length,
      byType,
      totalBalance: accounts.reduce((sum, account) => sum + account.currentBalance, 0),
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
  const { currentTenant } = useAuth();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_ACCOUNT_HIERARCHY, {
    variables: { rootAccountId },
    skip: !currentTenant,
    errorPolicy: 'all',
  });

  const hierarchy = useMemo(() => {
    if (!data?.accountHierarchy) return [];
    
    const buildHierarchy = (accounts: any[], level = 0): any[] => {
      return accounts.map(account => ({
        ...account,
        level,
        children: account.children ? buildHierarchy(account.children, level + 1) : [],
        hasChildren: account.children && account.children.length > 0,
        isExpanded: level < 2, // Auto-expand first 2 levels
      }));
    };
    
    return buildHierarchy(data.accountHierarchy);
  }, [data]);

  const flattenedAccounts = useMemo(() => {
    const flatten = (accounts: any[]): any[] => {
      return accounts.reduce((acc, account) => {
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
  const { currentTenant } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [searchAccounts] = useQuery(SEARCH_ACCOUNTS, {
    skip: true,
    errorPolicy: 'all',
  });

  const performSearch = useCallback(async (term: string, limit = 10) => {
    if (!term.trim() || !currentTenant) {
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
      setSearchResults(results.map((account: any) => ({
        ...account,
        currentBalance: parseFloat(account.currentBalance || '0'),
      })));
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useAccountSearch',
        operation: 'performSearch',
        tenantId: currentTenant.id,
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [currentTenant, searchAccounts]);

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
  const { currentTenant } = useAuth();

  const [createAccountMutation] = useMutation(CREATE_ACCOUNT, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useAccountMutations',
        operation: 'createAccount',
        tenantId: currentTenant?.id,
      });
    },
  });

  const [updateAccountMutation] = useMutation(UPDATE_ACCOUNT, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useAccountMutations',
        operation: 'updateAccount',
        tenantId: currentTenant?.id,
      });
    },
  });

  const [deleteAccountMutation] = useMutation(DELETE_ACCOUNT, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useAccountMutations',
        operation: 'deleteAccount',
        tenantId: currentTenant?.id,
      });
    },
  });

  const [activateAccountMutation] = useMutation(ACTIVATE_ACCOUNT, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useAccountMutations',
        operation: 'activateAccount',
        tenantId: currentTenant?.id,
      });
    },
  });

  const [deactivateAccountMutation] = useMutation(DEACTIVATE_ACCOUNT, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useAccountMutations',
        operation: 'deactivateAccount',
        tenantId: currentTenant?.id,
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
  const { currentTenant } = useAuth();
  const [balanceUpdates, setBalanceUpdates] = useState<any[]>([]);

  useSubscription(ACCOUNT_BALANCE_UPDATED, {
    variables: { 
      tenantId: currentTenant?.id,
      accountIds,
    },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.accountBalanceUpdated) {
        setBalanceUpdates(prev => [
          ...prev.slice(-9), // Keep last 10 updates
          {
            ...data.data.accountBalanceUpdated,
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
  const validateAccountNumber = useCallback((accountNumber: string, existingAccounts: any[] = []) => {
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
      
      if (existingAccounts.some(acc => acc.accountNumber === accountNumber)) {
        errors.push('Account number already exists');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  const validateAccountName = useCallback((accountName: string, existingAccounts: any[] = []) => {
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
      
      if (existingAccounts.some(acc => acc.accountName.toLowerCase() === accountName.toLowerCase())) {
        errors.push('Account name already exists');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  const validateAccountHierarchy = useCallback((parentAccountId: string, accountType: string, accounts: any[] = []) => {
    const errors: string[] = [];
    
    if (parentAccountId) {
      const parentAccount = accounts.find(acc => acc.id === parentAccountId);
      
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
      { value: 'ASSET', label: 'Assets', normalBalance: 'debit' },
      { value: 'LIABILITY', label: 'Liabilities', normalBalance: 'credit' },
      { value: 'EQUITY', label: 'Equity', normalBalance: 'credit' },
      { value: 'REVENUE', label: 'Revenue', normalBalance: 'credit' },
      { value: 'EXPENSE', label: 'Expenses', normalBalance: 'debit' },
    ];
    
    return types.map(type => ({
      ...type,
      accounts: accounts.accounts.filter(acc => acc.accountType === type.value),
      totalBalance: accounts.accounts
        .filter(acc => acc.accountType === type.value)
        .reduce((sum, acc) => sum + acc.currentBalance, 0),
    }));
  }, [accounts.accounts]);

  const accountsByType = useMemo(() => {
    return accounts.accounts.reduce((acc, account) => {
      const type = account.accountType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(account);
      return acc;
    }, {} as Record<string, any[]>);
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