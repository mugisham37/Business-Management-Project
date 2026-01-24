/**
 * Financial Module - Financial Management and Accounting
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const FinancialDashboard = lazy(() => 
  import('./components/FinancialDashboard').then(module => ({
    default: module.FinancialDashboard
  }))
);

export const AccountingView = lazy(() => 
  import('./components/AccountingView').then(module => ({
    default: module.AccountingView
  }))
);

export const InvoiceManagement = lazy(() => 
  import('./components/InvoiceManagement').then(module => ({
    default: module.InvoiceManagement
  }))
);

export const BudgetManagement = lazy(() => 
  import('./components/BudgetManagement').then(module => ({
    default: module.BudgetManagement
  }))
);

export const ChartOfAccounts = lazy(() => 
  import('./components/ChartOfAccounts').then(module => ({
    default: module.ChartOfAccounts
  }))
);

export const JournalEntries = lazy(() => 
  import('./components/JournalEntries').then(module => ({
    default: module.JournalEntries
  }))
);

export const FinancialReports = lazy(() => 
  import('./components/FinancialReports').then(module => ({
    default: module.FinancialReports
  }))
);

// Export hooks
export { useFinancialReporting } from '@/hooks/useFinancialReporting';
export { useBudgetManagement } from '@/hooks/useBudgetManagement';
export { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
export { useJournalEntries } from '@/hooks/useJournalEntries';
export { useMultiCurrency } from '@/hooks/useMultiCurrency';
export { useAccountsReceivablePayable } from '@/hooks/useAccountsReceivablePayable';
export { useFinancialDashboard } from '@/hooks/useFinancialDashboard';

// Export utilities
export { financialUtils } from '@/lib/utils/financial';

export const financialModule = {
  name: 'Financial Management',
  version: '1.0.0',
  description: 'Comprehensive financial management and accounting operations',
  components: { 
    FinancialDashboard, 
    AccountingView, 
    InvoiceManagement,
    BudgetManagement,
    ChartOfAccounts,
    JournalEntries,
    FinancialReports,
  },
  routes: [
    '/financial',
    '/financial/dashboard',
    '/financial/accounting',
    '/financial/invoices',
    '/financial/budgets',
    '/financial/accounts',
    '/financial/journal-entries',
    '/financial/reports',
  ],
  permissions: [
    'financial:read',
    'financial:write',
    'financial:manage',
    'financial:approve',
    'financial:reports:read',
    'financial:reports:generate',
  ],
  businessTier: 'SMALL',
  dependencies: ['tenant', 'auth', 'cache', 'queue'],
  features: [
    'chart-of-accounts',
    'journal-entries',
    'financial-reporting',
    'budget-management',
    'multi-currency',
    'tax-management',
    'accounts-receivable-payable',
    'reconciliation',
    'real-time-subscriptions',
    'batch-operations',
  ],
} as const;