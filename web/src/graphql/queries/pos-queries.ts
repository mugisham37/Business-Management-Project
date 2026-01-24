/**
 * POS GraphQL Queries
 * Requirements: 11.1, 11.2, 11.3
 */

import { gql } from '@apollo/client';
import {
  POS_SESSION_FRAGMENT,
  TRANSACTION_FRAGMENT,
  TRANSACTION_WITH_DETAILS_FRAGMENT,
  RECONCILIATION_REPORT_FRAGMENT,
  DAILY_SALES_SUMMARY_FRAGMENT,
  POS_CONFIGURATION_FRAGMENT,
  OFFLINE_QUEUE_ITEM_FRAGMENT,
  SYNC_CONFLICT_FRAGMENT,
} from '../fragments/pos-fragments';

// POS Session Queries
export const GET_POS_SESSION = gql`
  query GetPOSSession($id: ID!) {
    posSession(id: $id) {
      ...POSSessionFragment
    }
  }
  ${POS_SESSION_FRAGMENT}
`;

export const GET_ACTIVE_POS_SESSIONS = gql`
  query GetActivePOSSessions($locationId: ID!) {
    activePOSSessions(locationId: $locationId) {
      ...POSSessionFragment
    }
  }
  ${POS_SESSION_FRAGMENT}
`;

export const GET_POS_CONFIGURATION = gql`
  query GetPOSConfiguration($locationId: ID!) {
    posConfiguration(locationId: $locationId) {
      ...POSConfigurationFragment
    }
  }
  ${POS_CONFIGURATION_FRAGMENT}
`;

// Transaction Queries
export const GET_TRANSACTION = gql`
  query GetTransaction($id: ID!) {
    transaction(id: $id) {
      ...TransactionWithDetailsFragment
    }
  }
  ${TRANSACTION_WITH_DETAILS_FRAGMENT}
`;

export const GET_TRANSACTIONS = gql`
  query GetTransactions(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $query: TransactionQueryInput
  ) {
    transactions(
      first: $first
      after: $after
      last: $last
      before: $before
      query: $query
    ) {
      edges {
        node {
          ...TransactionFragment
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
  ${TRANSACTION_FRAGMENT}
`;

export const GET_TRANSACTION_HISTORY = gql`
  query GetTransactionHistory(
    $limit: Int!
    $offset: Int!
    $locationId: ID
    $status: TransactionStatus
    $paymentMethod: PaymentMethod
    $startDate: DateTime
    $endDate: DateTime
    $customerId: ID
  ) {
    transactionHistory(
      limit: $limit
      offset: $offset
      filters: {
        locationId: $locationId
        status: $status
        paymentMethod: $paymentMethod
        startDate: $startDate
        endDate: $endDate
        customerId: $customerId
      }
    ) {
      transactions {
        ...TransactionFragment
      }
      totalCount
      hasMore
    }
  }
  ${TRANSACTION_FRAGMENT}
`;

export const GET_TRANSACTION_SUMMARY = gql`
  query GetTransactionSummary(
    $locationId: ID!
    $startDate: DateTime!
    $endDate: DateTime!
  ) {
    transactionSummary(
      locationId: $locationId
      startDate: $startDate
      endDate: $endDate
    ) {
      totalSales
      totalTransactions
      averageTransactionValue
      paymentMethodBreakdown {
        paymentMethod
        transactionCount
        totalAmount
      }
    }
  }
`;

// Payment Queries
export const GET_PAYMENT_HISTORY = gql`
  query GetPaymentHistory($transactionId: ID!) {
    paymentHistory(transactionId: $transactionId) {
      ...PaymentRecordFragment
    }
  }
  ${PAYMENT_RECORD_FRAGMENT}
`;

export const VALIDATE_PAYMENT_METHOD = gql`
  query ValidatePaymentMethod($method: PaymentMethod!, $amount: Float!) {
    validatePaymentMethod(method: $method, amount: $amount) {
      valid
      error
      provider
      supportedFeatures
    }
  }
`;

export const GET_CASH_DRAWER_STATUS = gql`
  query GetCashDrawerStatus {
    cashDrawerStatus {
      currentAmount
      expectedAmount
      variance
      lastCounted
      changeAvailable {
        denomination
        count
      }
    }
  }
`;

export const GET_MOBILE_MONEY_ACCOUNT_STATUS = gql`
  query GetMobileMoneyAccountStatus($phoneNumber: String!) {
    mobileMoneyAccountStatus(phoneNumber: $phoneNumber) {
      isActive
      provider
      accountName
      balance
      currency
    }
  }
`;

// Reconciliation Queries
export const GET_RECONCILIATION_HISTORY = gql`
  query GetReconciliationHistory($limit: Int!, $offset: Int!) {
    reconciliationHistory(limit: $limit, offset: $offset) {
      reports {
        ...ReconciliationReportFragment
      }
      totalCount
      hasMore
    }
  }
  ${RECONCILIATION_REPORT_FRAGMENT}
`;

export const GET_DAILY_SALES_SUMMARY = gql`
  query GetDailySalesSummary($locationId: ID!, $date: Date!) {
    dailySalesSummary(locationId: $locationId, date: $date) {
      ...DailySalesSummaryFragment
    }
  }
  ${DAILY_SALES_SUMMARY_FRAGMENT}
`;

// Offline Sync Queries
export const GET_OFFLINE_QUEUE = gql`
  query GetOfflineQueue($deviceId: String!) {
    offlineQueue(deviceId: $deviceId) {
      ...OfflineQueueItemFragment
    }
  }
  ${OFFLINE_QUEUE_ITEM_FRAGMENT}
`;

export const GET_OFFLINE_STATUS = gql`
  query GetOfflineStatus($deviceId: String!) {
    offlineStatus(deviceId: $deviceId) {
      isOnline
      lastSyncAt
      queuedOperations
      pendingConflicts
      syncInProgress
    }
  }
`;

export const GET_SYNC_CONFLICTS = gql`
  query GetSyncConflicts($deviceId: String!) {
    syncConflicts(deviceId: $deviceId) {
      ...SyncConflictFragment
    }
  }
  ${SYNC_CONFLICT_FRAGMENT}
`;

export const GET_STORAGE_STATS = gql`
  query GetStorageStats {
    storageStats {
      totalSize
      usedSize
      availableSize
      itemCount
      categories {
        category
        size
        itemCount
      }
    }
  }
`;

// Receipt Queries
export const GENERATE_RECEIPT = gql`
  query GenerateReceipt(
    $transactionId: ID!
    $template: String
    $options: ReceiptOptionsInput
  ) {
    generateReceipt(
      transactionId: $transactionId
      template: $template
      options: $options
    ) {
      content
      format
      size
    }
  }
`;

export const GET_RECEIPT_HISTORY = gql`
  query GetReceiptHistory($transactionId: ID!) {
    receiptHistory(transactionId: $transactionId) {
      id
      method
      recipient
      status
      sentAt
      deliveredAt
      error
    }
  }
`;

export const PREVIEW_RECEIPT = gql`
  query PreviewReceipt(
    $transactionId: ID!
    $template: String
    $method: String!
  ) {
    previewReceipt(
      transactionId: $transactionId
      template: $template
      method: $method
    ) {
      content
      format
      estimatedSize
    }
  }
`;

// Printer Queries
export const GET_AVAILABLE_PRINTERS = gql`
  query GetAvailablePrinters {
    availablePrinters {
      id
      name
      type
      connectionType
      status
      isDefault
    }
  }
`;