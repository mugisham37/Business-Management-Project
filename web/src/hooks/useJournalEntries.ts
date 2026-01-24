/**
 * Journal Entries Hooks
 * Custom hooks for journal entry management and operations
 */

import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useState, useCallback, useMemo } from 'react';
import {
  GET_JOURNAL_ENTRY,
  GET_JOURNAL_ENTRIES,
  GET_GENERAL_LEDGER,
} from '@/graphql/queries/financial';
import {
  CREATE_JOURNAL_ENTRY,
  UPDATE_JOURNAL_ENTRY,
  POST_JOURNAL_ENTRY,
  REVERSE_JOURNAL_ENTRY,
  DELETE_JOURNAL_ENTRY,
  BATCH_POST_JOURNAL_ENTRIES,
  BATCH_CREATE_JOURNAL_ENTRIES,
} from '@/graphql/mutations/financial';
import {
  JOURNAL_ENTRY_CREATED,
  JOURNAL_ENTRY_POSTED,
  JOURNAL_ENTRY_UPDATED,
} from '@/graphql/subscriptions/financial';
import { useAuth } from './useAuth';
import { errorLogger } from '@/lib/error-handling';

export interface JournalEntryFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: 'draft' | 'posted' | 'reversed';
  sourceType?: string;
  limit?: number;
}

export interface CreateJournalEntryInput {
  entryDate: string;
  description: string;
  reference?: string;
  sourceType?: string;
  sourceId?: string;
  notes?: string;
  lineItems: CreateJournalEntryLineInput[];
}

export interface CreateJournalEntryLineInput {
  accountId: string;
  description: string;
  debitAmount?: string;
  creditAmount?: string;
  departmentId?: string;
  projectId?: string;
  customerId?: string;
  supplierId?: string;
}

export interface UpdateJournalEntryInput {
  entryDate?: string;
  description?: string;
  reference?: string;
  notes?: string;
  lineItems?: CreateJournalEntryLineInput[];
}

// Single Journal Entry Hook
export function useJournalEntry(entryId: string) {
  const { currentTenant } = useAuth();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_JOURNAL_ENTRY, {
    variables: { id: entryId },
    skip: !currentTenant || !entryId,
    errorPolicy: 'all',
  });

  const journalEntry = useMemo(() => {
    if (!data?.journalEntry) return null;
    
    const entry = data.journalEntry;
    const totalDebits = parseFloat(entry.totalDebitAmount || '0');
    const totalCredits = parseFloat(entry.totalCreditAmount || '0');
    
    return {
      ...entry,
      totalDebitAmount: totalDebits,
      totalCreditAmount: totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      balanceDifference: totalDebits - totalCredits,
      lineItems: entry.lineItems?.map((line: any) => ({
        ...line,
        debitAmount: parseFloat(line.debitAmount || '0'),
        creditAmount: parseFloat(line.creditAmount || '0'),
      })) || [],
    };
  }, [data]);

  return {
    journalEntry,
    loading,
    error,
    refetch,
  };
}

// Multiple Journal Entries Hook
export function useJournalEntries(filters: JournalEntryFilters = {}) {
  const { currentTenant } = useAuth();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_JOURNAL_ENTRIES, {
    variables: filters,
    skip: !currentTenant,
    errorPolicy: 'all',
  });

  const journalEntries = useMemo(() => {
    if (!data?.journalEntries) return [];
    
    return data.journalEntries.map((entry: any) => ({
      ...entry,
      totalDebitAmount: parseFloat(entry.totalDebitAmount || '0'),
      totalCreditAmount: parseFloat(entry.totalCreditAmount || '0'),
      isBalanced: entry.isBalanced || Math.abs(
        parseFloat(entry.totalDebitAmount || '0') - parseFloat(entry.totalCreditAmount || '0')
      ) < 0.01,
    }));
  }, [data]);

  const entrySummary = useMemo(() => {
    if (!journalEntries.length) return null;
    
    const totalEntries = journalEntries.length;
    const draftEntries = journalEntries.filter(e => e.status === 'draft').length;
    const postedEntries = journalEntries.filter(e => e.status === 'posted').length;
    const reversedEntries = journalEntries.filter(e => e.status === 'reversed').length;
    const unbalancedEntries = journalEntries.filter(e => !e.isBalanced).length;
    
    const totalDebits = journalEntries.reduce((sum, entry) => sum + entry.totalDebitAmount, 0);
    const totalCredits = journalEntries.reduce((sum, entry) => sum + entry.totalCreditAmount, 0);
    
    return {
      totalEntries,
      draftEntries,
      postedEntries,
      reversedEntries,
      unbalancedEntries,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      balanceDifference: totalDebits - totalCredits,
    };
  }, [journalEntries]);

  return {
    journalEntries,
    entrySummary,
    loading,
    error,
    refetch,
  };
}

// General Ledger Hook
export function useGeneralLedger(accountId: string, options: {
  dateFrom?: Date;
  dateTo?: Date;
  includeUnposted?: boolean;
} = {}) {
  const { currentTenant } = useAuth();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_GENERAL_LEDGER, {
    variables: {
      accountId,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      includeUnposted: options.includeUnposted || false,
    },
    skip: !currentTenant || !accountId,
    errorPolicy: 'all',
  });

  const generalLedger = useMemo(() => {
    if (!data?.getGeneralLedger) return null;
    
    const ledger = data.getGeneralLedger;
    
    return {
      ...ledger,
      transactions: ledger.transactions?.map((transaction: any) => ({
        ...transaction,
        debitAmount: parseFloat(transaction.debitAmount || '0'),
        creditAmount: parseFloat(transaction.creditAmount || '0'),
        runningBalance: parseFloat(transaction.runningBalance || '0'),
      })) || [],
      summary: {
        ...ledger.summary,
        openingBalance: parseFloat(ledger.summary?.openingBalance || '0'),
        totalDebits: parseFloat(ledger.summary?.totalDebits || '0'),
        totalCredits: parseFloat(ledger.summary?.totalCredits || '0'),
        closingBalance: parseFloat(ledger.summary?.closingBalance || '0'),
        transactionCount: ledger.summary?.transactionCount || 0,
      },
    };
  }, [data]);

  return {
    generalLedger,
    loading,
    error,
    refetch,
  };
}

// Journal Entry Mutations Hook
export function useJournalEntryMutations() {
  const { currentTenant } = useAuth();

  const [createJournalEntryMutation] = useMutation(CREATE_JOURNAL_ENTRY, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useJournalEntryMutations',
        operation: 'createJournalEntry',
        tenantId: currentTenant?.id,
      });
    },
  });

  const [updateJournalEntryMutation] = useMutation(UPDATE_JOURNAL_ENTRY, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useJournalEntryMutations',
        operation: 'updateJournalEntry',
        tenantId: currentTenant?.id,
      });
    },
  });

  const [postJournalEntryMutation] = useMutation(POST_JOURNAL_ENTRY, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useJournalEntryMutations',
        operation: 'postJournalEntry',
        tenantId: currentTenant?.id,
      });
    },
  });

  const [reverseJournalEntryMutation] = useMutation(REVERSE_JOURNAL_ENTRY, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useJournalEntryMutations',
        operation: 'reverseJournalEntry',
        tenantId: currentTenant?.id,
      });
    },
  });

  const [deleteJournalEntryMutation] = useMutation(DELETE_JOURNAL_ENTRY, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useJournalEntryMutations',
        operation: 'deleteJournalEntry',
        tenantId: currentTenant?.id,
      });
    },
  });

  const [batchPostJournalEntriesMutation] = useMutation(BATCH_POST_JOURNAL_ENTRIES, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useJournalEntryMutations',
        operation: 'batchPostJournalEntries',
        tenantId: currentTenant?.id,
      });
    },
  });

  const [batchCreateJournalEntriesMutation] = useMutation(BATCH_CREATE_JOURNAL_ENTRIES, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useJournalEntryMutations',
        operation: 'batchCreateJournalEntries',
        tenantId: currentTenant?.id,
      });
    },
  });

  const createJournalEntry = useCallback(async (input: CreateJournalEntryInput) => {
    // Validate that debits equal credits
    const totalDebits = input.lineItems.reduce((sum, line) => 
      sum + parseFloat(line.debitAmount || '0'), 0);
    const totalCredits = input.lineItems.reduce((sum, line) => 
      sum + parseFloat(line.creditAmount || '0'), 0);
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error('Journal entry is not balanced. Debits must equal credits.');
    }

    const result = await createJournalEntryMutation({
      variables: { input },
      refetchQueries: ['GetJournalEntries'],
    });
    return result.data?.createJournalEntry;
  }, [createJournalEntryMutation]);

  const updateJournalEntry = useCallback(async (id: string, input: UpdateJournalEntryInput) => {
    // Validate balance if line items are provided
    if (input.lineItems) {
      const totalDebits = input.lineItems.reduce((sum, line) => 
        sum + parseFloat(line.debitAmount || '0'), 0);
      const totalCredits = input.lineItems.reduce((sum, line) => 
        sum + parseFloat(line.creditAmount || '0'), 0);
      
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error('Journal entry is not balanced. Debits must equal credits.');
      }
    }

    const result = await updateJournalEntryMutation({
      variables: { id, input },
      refetchQueries: ['GetJournalEntry', 'GetJournalEntries'],
    });
    return result.data?.updateJournalEntry;
  }, [updateJournalEntryMutation]);

  const postJournalEntry = useCallback(async (id: string) => {
    const result = await postJournalEntryMutation({
      variables: { id },
      refetchQueries: ['GetJournalEntry', 'GetJournalEntries'],
    });
    return result.data?.postJournalEntry;
  }, [postJournalEntryMutation]);

  const reverseJournalEntry = useCallback(async (id: string, reversalDate: Date, reason: string) => {
    const result = await reverseJournalEntryMutation({
      variables: { id, reversalDate, reason },
      refetchQueries: ['GetJournalEntry', 'GetJournalEntries'],
    });
    return result.data?.reverseJournalEntry;
  }, [reverseJournalEntryMutation]);

  const deleteJournalEntry = useCallback(async (id: string) => {
    const result = await deleteJournalEntryMutation({
      variables: { id },
      refetchQueries: ['GetJournalEntries'],
    });
    return result.data?.deleteJournalEntry;
  }, [deleteJournalEntryMutation]);

  const batchPostJournalEntries = useCallback(async (entryIds: string[]) => {
    const result = await batchPostJournalEntriesMutation({
      variables: { entryIds },
      refetchQueries: ['GetJournalEntries'],
    });
    return result.data?.batchPostJournalEntries;
  }, [batchPostJournalEntriesMutation]);

  const batchCreateJournalEntries = useCallback(async (entries: CreateJournalEntryInput[]) => {
    // Validate all entries are balanced
    for (const entry of entries) {
      const totalDebits = entry.lineItems.reduce((sum, line) => 
        sum + parseFloat(line.debitAmount || '0'), 0);
      const totalCredits = entry.lineItems.reduce((sum, line) => 
        sum + parseFloat(line.creditAmount || '0'), 0);
      
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(`Journal entry "${entry.description}" is not balanced.`);
      }
    }

    const result = await batchCreateJournalEntriesMutation({
      variables: { entries },
      refetchQueries: ['GetJournalEntries'],
    });
    return result.data?.batchCreateJournalEntries;
  }, [batchCreateJournalEntriesMutation]);

  return {
    createJournalEntry,
    updateJournalEntry,
    postJournalEntry,
    reverseJournalEntry,
    deleteJournalEntry,
    batchPostJournalEntries,
    batchCreateJournalEntries,
  };
}

// Journal Entry Subscriptions Hook
export function useJournalEntrySubscriptions() {
  const { currentTenant } = useAuth();
  const [entryNotifications, setEntryNotifications] = useState<any[]>([]);

  useSubscription(JOURNAL_ENTRY_CREATED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.journalEntryCreated) {
        setEntryNotifications(prev => [
          ...prev,
          {
            type: 'entry_created',
            entry: data.data.journalEntryCreated,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  useSubscription(JOURNAL_ENTRY_POSTED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.journalEntryPosted) {
        setEntryNotifications(prev => [
          ...prev,
          {
            type: 'entry_posted',
            entry: data.data.journalEntryPosted,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  useSubscription(JOURNAL_ENTRY_UPDATED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.journalEntryUpdated) {
        setEntryNotifications(prev => [
          ...prev,
          {
            type: 'entry_updated',
            entry: data.data.journalEntryUpdated,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  const clearNotifications = useCallback(() => {
    setEntryNotifications([]);
  }, []);

  return {
    entryNotifications,
    clearNotifications,
  };
}

// Journal Entry Validation Hook
export function useJournalEntryValidation() {
  const validateJournalEntry = useCallback((entry: CreateJournalEntryInput) => {
    const errors: string[] = [];
    
    // Basic validation
    if (!entry.entryDate) {
      errors.push('Entry date is required');
    }
    
    if (!entry.description || entry.description.trim().length < 3) {
      errors.push('Description must be at least 3 characters');
    }
    
    if (!entry.lineItems || entry.lineItems.length < 2) {
      errors.push('At least 2 line items are required');
    }
    
    // Line item validation
    if (entry.lineItems) {
      entry.lineItems.forEach((line, index) => {
        if (!line.accountId) {
          errors.push(`Line ${index + 1}: Account is required`);
        }
        
        if (!line.description || line.description.trim().length < 2) {
          errors.push(`Line ${index + 1}: Description is required`);
        }
        
        const debitAmount = parseFloat(line.debitAmount || '0');
        const creditAmount = parseFloat(line.creditAmount || '0');
        
        if (debitAmount === 0 && creditAmount === 0) {
          errors.push(`Line ${index + 1}: Either debit or credit amount is required`);
        }
        
        if (debitAmount > 0 && creditAmount > 0) {
          errors.push(`Line ${index + 1}: Cannot have both debit and credit amounts`);
        }
        
        if (debitAmount < 0 || creditAmount < 0) {
          errors.push(`Line ${index + 1}: Amounts cannot be negative`);
        }
      });
      
      // Balance validation
      const totalDebits = entry.lineItems.reduce((sum, line) => 
        sum + parseFloat(line.debitAmount || '0'), 0);
      const totalCredits = entry.lineItems.reduce((sum, line) => 
        sum + parseFloat(line.creditAmount || '0'), 0);
      
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        errors.push('Journal entry is not balanced. Total debits must equal total credits');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  const validateLineItem = useCallback((lineItem: CreateJournalEntryLineInput) => {
    const errors: string[] = [];
    
    if (!lineItem.accountId) {
      errors.push('Account is required');
    }
    
    if (!lineItem.description || lineItem.description.trim().length < 2) {
      errors.push('Description is required');
    }
    
    const debitAmount = parseFloat(lineItem.debitAmount || '0');
    const creditAmount = parseFloat(lineItem.creditAmount || '0');
    
    if (debitAmount === 0 && creditAmount === 0) {
      errors.push('Either debit or credit amount is required');
    }
    
    if (debitAmount > 0 && creditAmount > 0) {
      errors.push('Cannot have both debit and credit amounts');
    }
    
    if (debitAmount < 0 || creditAmount < 0) {
      errors.push('Amounts cannot be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  return {
    validateJournalEntry,
    validateLineItem,
  };
}

// Comprehensive Journal Entries Hook
export function useJournalEntries(filters: JournalEntryFilters = {}) {
  const entries = useJournalEntries(filters);
  const mutations = useJournalEntryMutations();
  const subscriptions = useJournalEntrySubscriptions();
  const validation = useJournalEntryValidation();

  return {
    // Entries data
    journalEntries: entries.journalEntries,
    entrySummary: entries.entrySummary,
    loading: entries.loading,
    error: entries.error,
    
    // Mutations
    ...mutations,
    
    // Subscriptions
    ...subscriptions,
    
    // Validation
    ...validation,
    
    // Refresh functions
    refetch: entries.refetch,
  };
}