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

// Export all POS hooks
export { 
  usePOS, 
  usePOSSession, 
  usePOSConfiguration, 
  useDailySalesSummary 
} from '@/hooks/usePOS';

export { 
  useTransactions, 
  useTransaction 
} from '@/hooks/useTransactions';

export { 
  usePayments 
} from '@/hooks/usePayments';

export { 
  useReceipts 
} from '@/hooks/useReceipts';

export { 
  useOfflineSync 
} from '@/hooks/useOfflineSync';

export { 
  useReconciliation, 
  useReconciliationReport 
} from '@/hooks/useReconciliation';

// Export POS types
export type {
  POSSession,
  POSConfiguration,
  Transaction,
  TransactionItem,
  PaymentRecord,
  PaymentMethod,
  TransactionStatus,
  CreateTransactionInput,
  UpdateTransactionInput,
  VoidTransactionInput,
  RefundTransactionInput,
  PaymentRequest,
  PaymentResult,
  ReceiptOptions,
  EmailReceiptOptions,
  SmsReceiptOptions,
  PrintReceiptOptions,
  OfflineQueueItem,
  SyncConflict,
  ReconciliationReport,
  PaymentMethodSummary,
  ReconciliationDiscrepancy,
  DailySalesSummary,
  TopSellingItem,
  PrinterConfiguration,
  TransactionFilter,
  POSError,
  POSState,
} from '@/types/pos';

export const posModule = {
  name: 'Point of Sale',
  version: '1.0.0',
  description: 'Comprehensive point of sale and transaction management system',
  components: { POSDashboard, SalesTerminal, TransactionHistory },
  routes: ['/pos', '/pos/terminal', '/pos/transactions', '/pos/reconciliation', '/pos/settings'],
  permissions: [
    'pos:read', 
    'pos:write', 
    'pos:create', 
    'pos:update', 
    'pos:void', 
    'pos:refund',
    'pos:payment',
    'pos:payment:void',
    'pos:payment:refund',
    'pos:cash',
    'pos:mobile_money',
    'pos:stripe',
    'pos:reconciliation',
    'pos:reconciliation:approve',
    'pos:receipt',
    'pos:receipt:email',
    'pos:receipt:sms',
    'pos:receipt:print',
    'pos:receipt:bulk',
    'pos:receipt:resend',
    'pos:sync',
    'pos:admin',
    'pos:validate'
  ],
  businessTier: 'MICRO',
  dependencies: ['tenant', 'auth', 'inventory', 'cache', 'realtime'],
  features: {
    transactions: {
      create: true,
      update: true,
      void: true,
      refund: true,
      validation: true,
    },
    payments: {
      cash: true,
      card: true,
      mobileMoneyy: true,
      digitalWallet: true,
      bankTransfer: true,
      check: true,
      storeCredit: true,
    },
    receipts: {
      email: true,
      sms: true,
      print: true,
      thermal: true,
      bulk: true,
    },
    offline: {
      sync: true,
      conflictResolution: true,
      caching: true,
      queueing: true,
    },
    reconciliation: {
      daily: true,
      approval: true,
      discrepancyDetection: true,
      reporting: true,
    },
    realtime: {
      transactions: true,
      payments: true,
      sessions: true,
      cashDrawer: true,
    },
  },
} as const;