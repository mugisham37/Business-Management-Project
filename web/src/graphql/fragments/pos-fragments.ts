/**
 * POS GraphQL Fragments
 * Requirements: 11.1, 11.2, 11.3
 */

import { gql } from '@apollo/client';

// Core POS Fragments
export const POS_SESSION_FRAGMENT = gql`
  fragment POSSessionFragment on POSSession {
    id
    sessionNumber
    employeeId
    locationId
    status
    openingCash
    closingCash
    expectedCash
    cashVariance
    transactionCount
    totalSales
    openedAt
    closedAt
    createdAt
    updatedAt
  }
`;

export const TRANSACTION_ITEM_FRAGMENT = gql`
  fragment TransactionItemFragment on TransactionItem {
    id
    productId
    productSku
    productName
    quantity
    unitPrice
    lineTotal
    discountAmount
    taxAmount
    variantInfo
    metadata
  }
`;

export const PAYMENT_RECORD_FRAGMENT = gql`
  fragment PaymentRecordFragment on PaymentRecord {
    id
    paymentMethod
    amount
    status
    paymentProvider
    providerTransactionId
    processedAt
    refundedAmount
    refundedAt
    failureReason
    metadata
  }
`;

export const TRANSACTION_FRAGMENT = gql`
  fragment TransactionFragment on Transaction {
    id
    tenantId
    transactionNumber
    customerId
    locationId
    subtotal
    taxAmount
    discountAmount
    tipAmount
    total
    status
    itemCount
    notes
    paymentMethod
    paymentStatus
    paymentReference
    isOfflineTransaction
    offlineTimestamp
    syncedAt
    metadata
    createdAt
    updatedAt
    createdBy
    updatedBy
  }
`;

export const TRANSACTION_WITH_DETAILS_FRAGMENT = gql`
  fragment TransactionWithDetailsFragment on Transaction {
    ...TransactionFragment
    items {
      ...TransactionItemFragment
    }
    payments {
      ...PaymentRecordFragment
    }
  }
  ${TRANSACTION_FRAGMENT}
  ${TRANSACTION_ITEM_FRAGMENT}
  ${PAYMENT_RECORD_FRAGMENT}
`;

export const RECONCILIATION_REPORT_FRAGMENT = gql`
  fragment ReconciliationReportFragment on ReconciliationReport {
    id
    date
    locationId
    totalSales
    totalTransactions
    paymentMethodBreakdown {
      paymentMethod
      transactionCount
      totalAmount
      expectedAmount
      variance
    }
    discrepancies {
      type
      description
      amount
      transactionIds
    }
    status
    approvedBy
    approvedAt
    notes
  }
`;

export const DAILY_SALES_SUMMARY_FRAGMENT = gql`
  fragment DailySalesSummaryFragment on DailySalesSummary {
    date
    totalSales
    totalTransactions
    averageTransactionValue
    cashSales
    cardSales
    voidedTransactions
    refundedAmount
    topSellingItems {
      productId
      productName
      quantitySold
      revenue
    }
  }
`;

export const POS_CONFIGURATION_FRAGMENT = gql`
  fragment POSConfigurationFragment on POSConfiguration {
    locationId
    taxRate
    currency
    receiptTemplate
    printerSettings {
      id
      name
      type
      connectionType
      ipAddress
      port
      devicePath
      paperWidth
      isDefault
    }
    paymentMethods
    offlineMode
    autoSync
    syncInterval
  }
`;

export const OFFLINE_QUEUE_ITEM_FRAGMENT = gql`
  fragment OfflineQueueItemFragment on OfflineQueueItem {
    id
    operation
    data
    timestamp
    retryCount
    maxRetries
    status
    error
  }
`;

export const SYNC_CONFLICT_FRAGMENT = gql`
  fragment SyncConflictFragment on SyncConflict {
    id
    operation
    localData
    serverData
    conflictType
    resolution
    resolvedAt
  }
`;