/**
 * POS GraphQL Subscriptions
 * Requirements: 11.1, 11.2, 11.3
 */

import { gql } from '@apollo/client';
import {
  TRANSACTION_WITH_DETAILS_FRAGMENT,
  PAYMENT_RECORD_FRAGMENT,
} from '../fragments/pos-fragments';

// Transaction Subscriptions
export const TRANSACTION_CREATED = gql`
  subscription TransactionCreated($tenantId: ID!) {
    transactionCreated(tenantId: $tenantId) {
      ...TransactionWithDetailsFragment
    }
  }
  ${TRANSACTION_WITH_DETAILS_FRAGMENT}
`;

export const TRANSACTION_UPDATED = gql`
  subscription TransactionUpdated($tenantId: ID!) {
    transactionUpdated(tenantId: $tenantId) {
      ...TransactionWithDetailsFragment
    }
  }
  ${TRANSACTION_WITH_DETAILS_FRAGMENT}
`;

export const PAYMENT_PROCESSED = gql`
  subscription PaymentProcessed($tenantId: ID!) {
    paymentProcessed(tenantId: $tenantId) {
      transactionId
      payment {
        ...PaymentRecordFragment
      }
      status
      timestamp
    }
  }
  ${PAYMENT_RECORD_FRAGMENT}
`;

// Offline Sync Subscriptions
export const OFFLINE_STATUS_CHANGED = gql`
  subscription OfflineStatusChanged($deviceId: String!) {
    offlineStatusChanged(deviceId: $deviceId) {
      deviceId
      isOnline
      lastSyncAt
      queuedOperations
      pendingConflicts
      syncInProgress
    }
  }
`;

export const SYNC_COMPLETED = gql`
  subscription SyncCompleted($deviceId: String!) {
    syncCompleted(deviceId: $deviceId) {
      deviceId
      success
      processed
      failed
      conflicts
      completedAt
      results {
        localId
        serverId
        status
        error
      }
    }
  }
`;

export const CACHE_UPDATED = gql`
  subscription CacheUpdated($category: String!) {
    cacheUpdated(category: $category) {
      category
      action
      itemId
      data
      timestamp
    }
  }
`;

// Real-time POS Updates
export const POS_SESSION_UPDATED = gql`
  subscription POSSessionUpdated($locationId: ID!) {
    posSessionUpdated(locationId: $locationId) {
      id
      status
      transactionCount
      totalSales
      updatedAt
    }
  }
`;

export const CASH_DRAWER_UPDATED = gql`
  subscription CashDrawerUpdated($locationId: ID!) {
    cashDrawerUpdated(locationId: $locationId) {
      locationId
      currentAmount
      expectedAmount
      variance
      lastCounted
      updatedAt
    }
  }
`;

// Receipt Delivery Subscriptions
export const RECEIPT_DELIVERY_STATUS = gql`
  subscription ReceiptDeliveryStatus($transactionId: ID!) {
    receiptDeliveryStatus(transactionId: $transactionId) {
      transactionId
      method
      status
      deliveredAt
      error
    }
  }
`;

// Reconciliation Subscriptions
export const RECONCILIATION_UPDATED = gql`
  subscription ReconciliationUpdated($locationId: ID!) {
    reconciliationUpdated(locationId: $locationId) {
      id
      status
      approvedBy
      approvedAt
      updatedAt
    }
  }
`;

// Printer Status Subscriptions
export const PRINTER_STATUS_CHANGED = gql`
  subscription PrinterStatusChanged($printerId: ID!) {
    printerStatusChanged(printerId: $printerId) {
      printerId
      status
      error
      lastJobAt
      updatedAt
    }
  }
`;