/**
 * POS Module - Point of Sale System
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const POSDashboard = lazy(() => 
  import('./components/POSDashboard').then(module => ({
    default: module.POSDashboard
  }))
);

export const SalesTerminal = lazy(() => 
  import('./components/SalesTerminal').then(module => ({
    default: module.SalesTerminal
  }))
);

export const TransactionHistory = lazy(() => 
  import('./components/TransactionHistory').then(module => ({
    default: module.TransactionHistory
  }))
);

export { usePOS } from './hooks/usePOS';
export { useTransactions } from './hooks/useTransactions';

export const posModule = {
  name: 'Point of Sale',
  version: '1.0.0',
  description: 'Point of sale and transaction management',
  components: { POSDashboard, SalesTerminal, TransactionHistory },
  routes: ['/pos', '/pos/terminal', '/pos/transactions'],
  permissions: ['pos:read', 'pos:write'],
  businessTier: 'MICRO',
  dependencies: ['tenant', 'auth', 'inventory'],
} as const;