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

export { useFinancials } from './hooks/useFinancials';
export { useInvoices } from './hooks/useInvoices';

export const financialModule = {
  name: 'Financial Management',
  version: '1.0.0',
  description: 'Financial management and accounting operations',
  components: { FinancialDashboard, AccountingView, InvoiceManagement },
  routes: ['/financial', '/financial/accounting', '/financial/invoices'],
  permissions: ['financial:read', 'financial:write', 'financial:admin'],
  businessTier: 'SMALL',
  dependencies: ['tenant', 'auth'],
} as const;