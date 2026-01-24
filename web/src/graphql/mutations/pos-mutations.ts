/**
 * POS GraphQL Mutations
 * Requirements: 11.1, 11.2, 11.3
 */

import { gql } from '@apollo/client';
import {
  POS_SESSION_FRAGMENT,
  TRANSACTION_WITH_DETAILS_FRAGMENT,
  PAYMENT_RECORD_FRAGMENT,
  RECONCILIATION_REPORT_FRAGMENT,
} from '../fragments/pos-fragments';

// POS Session Mutations
export const OPEN_POS_SESSION = gql`
  mutation OpenPOSSession($input: OpenPOSSessionInput!) {
    openPOSSession(input: $input) {
      success
      message
      session {
        ...POSSessionFragment
      }
      errors {
        field
        message
      }
    }
  }
  ${POS_SESSION_FRAGMENT}
`;

export const CLOSE_POS_SESSION = gql`
  mutation ClosePOSSession($id: ID!, $input: ClosePOSSessionInput!) {
    closePOSSession(id: $id, input: $input) {
      success
      message
      session {
        ...POSSessionFragment
      }
      errors {
        field
        message
      }
    }
  }
  ${POS_SESSION_FRAGMENT}
`;

// Transaction Mutations
export const CREATE_TRANSACTION = gql`
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      success
      message
      transaction {
        ...TransactionWithDetailsFragment
      }
      errors {
        field
        message
      }
    }
  }
  ${TRANSACTION_WITH_DETAILS_FRAGMENT}
`;

export const UPDATE_TRANSACTION = gql`
  mutation UpdateTransaction($id: ID!, $input: UpdateTransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      success
      message
      transaction {
        ...TransactionWithDetailsFragment
      }
      errors {
        field
        message
      }
    }
  }
  ${TRANSACTION_WITH_DETAILS_FRAGMENT}
`;

export const VOID_TRANSACTION = gql`
  mutation VoidTransaction($id: ID!, $input: VoidTransactionInput!) {
    voidTransaction(id: $id, input: $input) {
      success
      message
      transaction {
        ...TransactionWithDetailsFragment
      }
      errors {
        field
        message
      }
    }
  }
  ${TRANSACTION_WITH_DETAILS_FRAGMENT}
`;

export const REFUND_TRANSACTION = gql`
  mutation RefundTransaction($id: ID!, $input: RefundTransactionInput!) {
    refundTransaction(id: $id, input: $input) {
      success
      message
      transaction {
        ...TransactionWithDetailsFragment
      }
      refund {
        id
        amount
        reason
        refundMethod
        processedAt
      }
      errors {
        field
        message
      }
    }
  }
  ${TRANSACTION_WITH_DETAILS_FRAGMENT}
`;

// Payment Mutations
export const PROCESS_PAYMENT = gql`
  mutation ProcessPayment($transactionId: ID!, $input: PaymentRequestInput!) {
    processPayment(transactionId: $transactionId, input: $input) {
      success
      paymentId
      providerTransactionId
      error
      metadata
    }
  }
`;

export const VOID_PAYMENT = gql`
  mutation VoidPayment($transactionId: ID!) {
    voidPayment(transactionId: $transactionId) {
      success
      message
      payment {
        ...PaymentRecordFragment
      }
      errors {
        field
        message
      }
    }
  }
  ${PAYMENT_RECORD_FRAGMENT}
`;

export const REFUND_PAYMENT = gql`
  mutation RefundPayment($transactionId: ID!, $amount: Float!) {
    refundPayment(transactionId: $transactionId, amount: $amount) {
      success
      message
      refund {
        id
        amount
        status
        processedAt
      }
      errors {
        field
        message
      }
    }
  }
`;

export const CALCULATE_CHANGE = gql`
  mutation CalculateChange($received: Float!, $required: Float!) {
    calculateChange(received: $received, required: $required) {
      changeAmount
      changeDenominations {
        denomination
        count
      }
    }
  }
`;

export const RECORD_CASH_COUNT = gql`
  mutation RecordCashCount($denominations: [DenominationCountInput!]!) {
    recordCashCount(denominations: $denominations) {
      success
      message
      totalAmount
      variance
      errors {
        field
        message
      }
    }
  }
`;

// Mobile Money Mutations
export const INITIATE_MOBILE_MONEY_PAYMENT = gql`
  mutation InitiateMobileMoneyPayment(
    $phoneNumber: String!
    $amount: Float!
    $reference: String!
  ) {
    initiateMobileMoneyPayment(
      phoneNumber: $phoneNumber
      amount: $amount
      reference: $reference
    ) {
      requestId
      status
      message
      expiresAt
    }
  }
`;

// Stripe Mutations
export const CREATE_STRIPE_PAYMENT_METHOD = gql`
  mutation CreateStripePaymentMethod($cardDetails: StripeCardInput!) {
    createStripePaymentMethod(cardDetails: $cardDetails) {
      paymentMethodId
      status
      error
      requiresAction
      clientSecret
    }
  }
`;

// Reconciliation Mutations
export const PERFORM_DAILY_RECONCILIATION = gql`
  mutation PerformDailyReconciliation(
    $date: Date!
    $options: ReconciliationOptionsInput
  ) {
    performDailyReconciliation(date: $date, options: $options) {
      success
      message
      report {
        ...ReconciliationReportFragment
      }
      errors {
        field
        message
      }
    }
  }
  ${RECONCILIATION_REPORT_FRAGMENT}
`;

export const APPROVE_RECONCILIATION = gql`
  mutation ApproveReconciliation($reconciliationId: ID!, $notes: String) {
    approveReconciliation(reconciliationId: $reconciliationId, notes: $notes) {
      success
      message
      report {
        ...ReconciliationReportFragment
      }
      errors {
        field
        message
      }
    }
  }
  ${RECONCILIATION_REPORT_FRAGMENT}
`;

// Printer Mutations
export const ADD_PRINTER = gql`
  mutation AddPrinter($config: PrinterConfigurationInput!) {
    addPrinter(config: $config) {
      success
      message
      printer {
        id
        name
        type
        connectionType
        status
      }
      errors {
        field
        message
      }
    }
  }
`;

export const TEST_PRINTER = gql`
  mutation TestPrinter($printerId: ID!) {
    testPrinter(printerId: $printerId) {
      success
      message
      testResult {
        connected
        responseTime
        error
      }
      errors {
        field
        message
      }
    }
  }
`;

export const REMOVE_PRINTER = gql`
  mutation RemovePrinter($printerId: ID!) {
    removePrinter(printerId: $printerId) {
      success
      message
      errors {
        field
        message
      }
    }
  }
`;

// Receipt Mutations
export const SEND_EMAIL_RECEIPT = gql`
  mutation SendEmailReceipt(
    $transactionId: ID!
    $email: String!
    $options: EmailReceiptOptionsInput
  ) {
    sendEmailReceipt(
      transactionId: $transactionId
      email: $email
      options: $options
    ) {
      success
      messageId
      error
    }
  }
`;

export const SEND_SMS_RECEIPT = gql`
  mutation SendSmsReceipt(
    $transactionId: ID!
    $phoneNumber: String!
    $options: SmsReceiptOptionsInput
  ) {
    sendSmsReceipt(
      transactionId: $transactionId
      phoneNumber: $phoneNumber
      options: $options
    ) {
      success
      messageId
      error
      segments
    }
  }
`;

export const PRINT_RECEIPT = gql`
  mutation PrintReceipt($transactionId: ID!, $printerId: ID!) {
    printReceipt(transactionId: $transactionId, printerId: $printerId) {
      success
      printJobId
      error
    }
  }
`;

export const SEND_BULK_EMAIL_RECEIPTS = gql`
  mutation SendBulkEmailReceipts($requests: [BulkEmailReceiptInput!]!) {
    sendBulkEmailReceipts(requests: $requests) {
      success
      processed
      failed
      results {
        transactionId
        success
        messageId
        error
      }
    }
  }
`;

export const RESEND_FAILED_RECEIPTS = gql`
  mutation ResendFailedReceipts($transactionIds: [ID!]!) {
    resendFailedReceipts(transactionIds: $transactionIds) {
      success
      processed
      failed
      results {
        transactionId
        success
        error
      }
    }
  }
`;

// Offline Sync Mutations
export const SYNC_OFFLINE_TRANSACTIONS = gql`
  mutation SyncOfflineTransactions($input: OfflineSyncInput!) {
    syncOfflineTransactions(input: $input) {
      success
      processed
      failed
      conflicts
      results {
        localId
        serverId
        status
        error
      }
    }
  }
`;

export const RESOLVE_CONFLICT = gql`
  mutation ResolveConflict($input: ConflictResolutionInput!) {
    resolveConflict(input: $input) {
      success
      message
      resolvedData
      errors {
        field
        message
      }
    }
  }
`;

export const CLEAR_OFFLINE_CACHE = gql`
  mutation ClearOfflineCache($input: ClearCacheInput!) {
    clearOfflineCache(input: $input) {
      success
      message
      clearedItems
      errors {
        field
        message
      }
    }
  }
`;

export const CACHE_ESSENTIAL_DATA = gql`
  mutation CacheEssentialData($input: CacheDataInput!) {
    cacheEssentialData(input: $input) {
      success
      message
      cachedItems
      errors {
        field
        message
      }
    }
  }
`;

export const QUEUE_OFFLINE_OPERATION = gql`
  mutation QueueOfflineOperation($input: QueueOperationInput!) {
    queueOfflineOperation(input: $input) {
      success
      message
      queueId
      errors {
        field
        message
      }
    }
  }
`;

// Validation Mutations
export const VALIDATE_TRANSACTION = gql`
  mutation ValidateTransaction($input: CreateTransactionInput!) {
    validateTransaction(input: $input) {
      valid
      errors {
        field
        message
        code
      }
      warnings {
        field
        message
        code
      }
    }
  }
`;

export const VALIDATE_REFUND = gql`
  mutation ValidateRefund(
    $transactionId: ID!
    $amount: Float!
    $reason: String!
  ) {
    validateRefund(
      transactionId: $transactionId
      amount: $amount
      reason: $reason
    ) {
      valid
      maxRefundAmount
      errors {
        field
        message
        code
      }
    }
  }
`;

export const VALIDATE_INVENTORY_AVAILABILITY = gql`
  mutation ValidateInventoryAvailability($items: [TransactionItemInput!]!) {
    validateInventoryAvailability(items: $items) {
      valid
      unavailableItems {
        productId
        requestedQuantity
        availableQuantity
      }
      errors {
        field
        message
        code
      }
    }
  }
`;