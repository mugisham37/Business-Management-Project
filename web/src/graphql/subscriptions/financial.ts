/**
 * Financial Module GraphQL Subscriptions
 * Real-time subscriptions for financial operations
 */

import { gql } from '@apollo/client';

// Journal Entry Subscriptions
export const JOURNAL_ENTRY_CREATED = gql`
  subscription JournalEntryCreated($tenantId: ID!) {
    journalEntryCreated(tenantId: $tenantId) {
      id
      entryNumber
      entryDate
      postingDate
      description
      reference
      sourceType
      sourceId
      status
      totalDebitAmount
      totalCreditAmount
      isBalanced
      createdAt
      createdBy
    }
  }
`;

export const JOURNAL_ENTRY_POSTED = gql`
  subscription JournalEntryPosted($tenantId: ID!) {
    journalEntryPosted(tenantId: $tenantId) {
      id
      entryNumber
      status
      postingDate
      totalDebitAmount
      totalCreditAmount
      updatedAt
    }
  }
`;

export const JOURNAL_ENTRY_UPDATED = gql`
  subscription JournalEntryUpdated($tenantId: ID!) {
    journalEntryUpdated(tenantId: $tenantId) {
      id
      entryNumber
      entryDate
      postingDate
      description
      reference
      status
      totalDebitAmount
      totalCreditAmount
      isBalanced
      updatedAt
      updatedBy
    }
  }
`;

// Budget Subscriptions
export const BUDGET_CREATED = gql`
  subscription BudgetCreated($tenantId: ID!) {
    budgetCreated(tenantId: $tenantId) {
      id
      budgetName
      budgetYear
      startDate
      endDate
      status
      totalBudgetAmount
      description
      createdAt
      createdBy
    }
  }
`;

export const BUDGET_APPROVED = gql`
  subscription BudgetApproved($tenantId: ID!) {
    budgetApproved(tenantId: $tenantId) {
      id
      budgetName
      budgetYear
      status
      approvedDate
      approvedBy
      updatedAt
    }
  }
`;

export const BUDGET_VARIANCE_ALERT = gql`
  subscription BudgetVarianceAlert($tenantId: ID!, $thresholdPercentage: Float!) {
    budgetVarianceAlert(tenantId: $tenantId, thresholdPercentage: $thresholdPercentage) {
      budgetId
      budgetName
      accountId
      accountName
      budgetAmount
      actualAmount
      variance
      variancePercentage
      alertDate
      alertType
    }
  }
`;

// Account Balance Subscriptions
export const ACCOUNT_BALANCE_UPDATED = gql`
  subscription AccountBalanceUpdated($tenantId: ID!, $accountIds: [ID!]) {
    accountBalanceUpdated(tenantId: $tenantId, accountIds: $accountIds) {
      accountId
      accountNumber
      accountName
      previousBalance
      newBalance
      changeAmount
      changeDate
      transactionId
      transactionReference
    }
  }
`;

export const TRIAL_BALANCE_UPDATED = gql`
  subscription TrialBalanceUpdated($tenantId: ID!) {
    trialBalanceUpdated(tenantId: $tenantId) {
      asOfDate
      totalDebits
      totalCredits
      isBalanced
      balanceDifference
      updatedAt
      affectedAccounts {
        accountId
        accountNumber
        accountName
        newBalance
      }
    }
  }
`;

// Financial Report Subscriptions
export const FINANCIAL_REPORT_GENERATED = gql`
  subscription FinancialReportGenerated($tenantId: ID!) {
    financialReportGenerated(tenantId: $tenantId) {
      reportId
      reportType
      reportDate
      periodStart
      periodEnd
      status
      generatedAt
      generatedBy
      downloadUrl
    }
  }
`;

export const FINANCIAL_REPORT_FAILED = gql`
  subscription FinancialReportFailed($tenantId: ID!) {
    financialReportFailed(tenantId: $tenantId) {
      reportId
      reportType
      errorMessage
      failedAt
      retryCount
    }
  }
`;

// Reconciliation Subscriptions
export const RECONCILIATION_CREATED = gql`
  subscription ReconciliationCreated($tenantId: ID!) {
    reconciliationCreated(tenantId: $tenantId) {
      id
      accountId
      accountName
      reconciliationDate
      statementDate
      statementBalance
      bookBalance
      difference
      status
      createdAt
      createdBy
    }
  }
`;

export const RECONCILIATION_COMPLETED = gql`
  subscription ReconciliationCompleted($tenantId: ID!) {
    reconciliationCompleted(tenantId: $tenantId) {
      id
      accountId
      accountName
      reconciliationDate
      finalDifference
      status
      completedAt
      completedBy
      itemsMatched
      itemsUnmatched
    }
  }
`;

// Accounts Receivable/Payable Subscriptions
export const RECEIVABLE_CREATED = gql`
  subscription ReceivableCreated($tenantId: ID!) {
    receivableCreated(tenantId: $tenantId) {
      id
      invoiceNumber
      invoiceDate
      dueDate
      customerId
      customerName
      totalAmount
      status
      currency
      createdAt
    }
  }
`;

export const RECEIVABLE_PAYMENT_RECEIVED = gql`
  subscription ReceivablePaymentReceived($tenantId: ID!) {
    receivablePaymentReceived(tenantId: $tenantId) {
      receivableId
      invoiceNumber
      customerId
      customerName
      paymentAmount
      paymentDate
      paymentMethod
      newBalance
      status
    }
  }
`;

export const PAYABLE_CREATED = gql`
  subscription PayableCreated($tenantId: ID!) {
    payableCreated(tenantId: $tenantId) {
      id
      invoiceNumber
      invoiceDate
      dueDate
      supplierId
      supplierName
      totalAmount
      status
      currency
      createdAt
    }
  }
`;

export const PAYABLE_PAYMENT_MADE = gql`
  subscription PayablePaymentMade($tenantId: ID!) {
    payablePaymentMade(tenantId: $tenantId) {
      payableId
      invoiceNumber
      supplierId
      supplierName
      paymentAmount
      paymentDate
      paymentMethod
      newBalance
      status
    }
  }
`;

// Currency and Exchange Rate Subscriptions
export const EXCHANGE_RATE_UPDATED = gql`
  subscription ExchangeRateUpdated($tenantId: ID!) {
    exchangeRateUpdated(tenantId: $tenantId) {
      id
      fromCurrencyCode
      toCurrencyCode
      previousRate
      newRate
      rateChange
      rateChangePercentage
      effectiveDate
      rateSource
      updatedAt
    }
  }
`;

export const CURRENCY_CONVERSION_ALERT = gql`
  subscription CurrencyConversionAlert($tenantId: ID!, $thresholdPercentage: Float!) {
    currencyConversionAlert(tenantId: $tenantId, thresholdPercentage: $thresholdPercentage) {
      fromCurrencyCode
      toCurrencyCode
      previousRate
      newRate
      rateChange
      rateChangePercentage
      alertDate
      alertType
      impactedTransactions
    }
  }
`;

// Tax Subscriptions
export const TAX_RATE_UPDATED = gql`
  subscription TaxRateUpdated($tenantId: ID!) {
    taxRateUpdated(tenantId: $tenantId) {
      id
      jurisdictionCode
      jurisdictionName
      taxType
      rateName
      previousRate
      newRate
      effectiveDate
      updatedAt
    }
  }
`;

// Fiscal Period Subscriptions
export const FISCAL_PERIOD_CLOSED = gql`
  subscription FiscalPeriodClosed($tenantId: ID!) {
    fiscalPeriodClosed(tenantId: $tenantId) {
      periodId
      periodName
      startDate
      endDate
      closedDate
      closedBy
      finalBalances {
        accountId
        accountName
        closingBalance
      }
    }
  }
`;

export const FISCAL_PERIOD_REOPENED = gql`
  subscription FiscalPeriodReopened($tenantId: ID!) {
    fiscalPeriodReopened(tenantId: $tenantId) {
      periodId
      periodName
      startDate
      endDate
      reopenedDate
      reopenedBy
      reason
    }
  }
`;

// Batch Operation Subscriptions
export const BATCH_OPERATION_PROGRESS = gql`
  subscription BatchOperationProgress($tenantId: ID!, $operationId: ID!) {
    batchOperationProgress(tenantId: $tenantId, operationId: $operationId) {
      operationId
      operationType
      totalItems
      processedItems
      successCount
      failureCount
      progressPercentage
      status
      estimatedTimeRemaining
      currentItem
    }
  }
`;

export const BATCH_OPERATION_COMPLETED = gql`
  subscription BatchOperationCompleted($tenantId: ID!, $operationId: ID!) {
    batchOperationCompleted(tenantId: $tenantId, operationId: $operationId) {
      operationId
      operationType
      totalItems
      successCount
      failureCount
      completedAt
      duration
      status
      resultSummary
      downloadUrl
    }
  }
`;

// Financial Alert Subscriptions
export const FINANCIAL_ALERT = gql`
  subscription FinancialAlert($tenantId: ID!) {
    financialAlert(tenantId: $tenantId) {
      alertId
      alertType
      severity
      title
      message
      data
      createdAt
      expiresAt
      actionRequired
      actionUrl
    }
  }
`;

export const CASH_FLOW_ALERT = gql`
  subscription CashFlowAlert($tenantId: ID!, $thresholdAmount: Float!) {
    cashFlowAlert(tenantId: $tenantId, thresholdAmount: $thresholdAmount) {
      alertType
      currentCashBalance
      projectedCashBalance
      projectionDate
      shortfallAmount
      recommendedActions
      alertDate
    }
  }
`;

// Audit Trail Subscriptions
export const FINANCIAL_AUDIT_EVENT = gql`
  subscription FinancialAuditEvent($tenantId: ID!) {
    financialAuditEvent(tenantId: $tenantId) {
      eventId
      eventType
      entityType
      entityId
      userId
      userName
      action
      changes
      timestamp
      ipAddress
      userAgent
    }
  }
`;