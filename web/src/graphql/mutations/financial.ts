/**
 * Financial Module GraphQL Mutations
 * Comprehensive mutations for all financial operations
 */

import { gql } from '@apollo/client';

// Chart of Accounts Mutations
export const CREATE_ACCOUNT = gql`
  mutation CreateAccount($input: CreateChartOfAccountInput!) {
    createAccount(input: $input) {
      id
      accountNumber
      accountName
      accountType
      accountSubType
      parentAccountId
      accountLevel
      normalBalance
      description
      taxReportingCategory
      isActive
      allowManualEntries
      requireDepartment
      requireProject
      isSystemAccount
      currentBalance
      settings
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_ACCOUNT = gql`
  mutation UpdateAccount($id: ID!, $input: UpdateChartOfAccountInput!) {
    updateAccount(id: $id, input: $input) {
      id
      accountNumber
      accountName
      accountType
      accountSubType
      parentAccountId
      accountLevel
      normalBalance
      description
      taxReportingCategory
      isActive
      allowManualEntries
      requireDepartment
      requireProject
      isSystemAccount
      currentBalance
      settings
      updatedAt
    }
  }
`;

export const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($id: ID!) {
    deleteAccount(id: $id) {
      success
      message
    }
  }
`;

export const ACTIVATE_ACCOUNT = gql`
  mutation ActivateAccount($id: ID!) {
    activateAccount(id: $id) {
      id
      isActive
      updatedAt
    }
  }
`;

export const DEACTIVATE_ACCOUNT = gql`
  mutation DeactivateAccount($id: ID!) {
    deactivateAccount(id: $id) {
      id
      isActive
      updatedAt
    }
  }
`;

// Journal Entry Mutations
export const CREATE_JOURNAL_ENTRY = gql`
  mutation CreateJournalEntry($input: CreateJournalEntryInput!) {
    createJournalEntry(input: $input) {
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
      notes
      attachments
      createdAt
      updatedAt
      lineItems {
        id
        lineNumber
        accountId
        account {
          id
          accountNumber
          accountName
        }
        description
        debitAmount
        creditAmount
        departmentId
        projectId
        customerId
        supplierId
      }
    }
  }
`;

export const UPDATE_JOURNAL_ENTRY = gql`
  mutation UpdateJournalEntry($id: ID!, $input: UpdateJournalEntryInput!) {
    updateJournalEntry(id: $id, input: $input) {
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
      notes
      attachments
      updatedAt
      lineItems {
        id
        lineNumber
        accountId
        account {
          id
          accountNumber
          accountName
        }
        description
        debitAmount
        creditAmount
        departmentId
        projectId
        customerId
        supplierId
      }
    }
  }
`;

export const POST_JOURNAL_ENTRY = gql`
  mutation PostJournalEntry($id: ID!) {
    postJournalEntry(id: $id) {
      id
      status
      postingDate
      updatedAt
    }
  }
`;

export const REVERSE_JOURNAL_ENTRY = gql`
  mutation ReverseJournalEntry($id: ID!, $reversalDate: DateTime!, $reason: String!) {
    reverseJournalEntry(id: $id, reversalDate: $reversalDate, reason: $reason) {
      originalEntry {
        id
        status
      }
      reversalEntry {
        id
        entryNumber
        entryDate
        postingDate
        description
        reference
        status
        totalDebitAmount
        totalCreditAmount
      }
    }
  }
`;

export const DELETE_JOURNAL_ENTRY = gql`
  mutation DeleteJournalEntry($id: ID!) {
    deleteJournalEntry(id: $id) {
      success
      message
    }
  }
`;

// Budget Mutations
export const CREATE_BUDGET = gql`
  mutation CreateBudget($input: CreateBudgetInput!) {
    createBudget(input: $input) {
      id
      budgetName
      budgetYear
      startDate
      endDate
      status
      totalBudgetAmount
      totalActualAmount
      totalVariance
      description
      approvedDate
      approvedBy
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_BUDGET = gql`
  mutation UpdateBudget($id: ID!, $input: UpdateBudgetInput!) {
    updateBudget(id: $id, input: $input) {
      id
      budgetName
      budgetYear
      startDate
      endDate
      status
      totalBudgetAmount
      totalActualAmount
      totalVariance
      description
      approvedDate
      approvedBy
      isActive
      updatedAt
    }
  }
`;

export const APPROVE_BUDGET = gql`
  mutation ApproveBudget($id: ID!) {
    approveBudget(id: $id) {
      id
      status
      approvedDate
      approvedBy
      updatedAt
    }
  }
`;

export const DELETE_BUDGET = gql`
  mutation DeleteBudget($id: ID!) {
    deleteBudget(id: $id)
  }
`;

export const ADD_BUDGET_LINE = gql`
  mutation AddBudgetLine($budgetId: ID!, $input: CreateBudgetLineInput!) {
    addBudgetLine(budgetId: $budgetId, input: $input) {
      id
      budgetId
      accountId
      account {
        id
        accountNumber
        accountName
      }
      lineNumber
      description
      budgetAmount
      actualAmount
      variance
      variancePercentage
      notes
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_BUDGET_LINE = gql`
  mutation UpdateBudgetLine($id: ID!, $input: UpdateBudgetLineInput!) {
    updateBudgetLine(id: $id, input: $input) {
      id
      budgetId
      accountId
      account {
        id
        accountNumber
        accountName
      }
      lineNumber
      description
      budgetAmount
      actualAmount
      variance
      variancePercentage
      notes
      updatedAt
    }
  }
`;

export const DELETE_BUDGET_LINE = gql`
  mutation DeleteBudgetLine($id: ID!) {
    deleteBudgetLine(id: $id) {
      success
      message
    }
  }
`;

// Multi-Currency Mutations
export const CREATE_CURRENCY = gql`
  mutation CreateCurrency($input: CreateCurrencyInput!) {
    createCurrency(input: $input) {
      id
      currencyCode
      currencyName
      currencySymbol
      decimalPlaces
      decimalSeparator
      thousandsSeparator
      symbolPosition
      isActive
      isBaseCurrency
      countryCode
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_CURRENCY = gql`
  mutation UpdateCurrency($id: ID!, $input: UpdateCurrencyInput!) {
    updateCurrency(id: $id, input: $input) {
      id
      currencyCode
      currencyName
      currencySymbol
      decimalPlaces
      decimalSeparator
      thousandsSeparator
      symbolPosition
      isActive
      isBaseCurrency
      countryCode
      updatedAt
    }
  }
`;

export const SET_BASE_CURRENCY = gql`
  mutation SetBaseCurrency($currencyId: ID!) {
    setBaseCurrency(currencyId: $currencyId) {
      id
      currencyCode
      isBaseCurrency
      updatedAt
    }
  }
`;

export const CREATE_EXCHANGE_RATE = gql`
  mutation CreateExchangeRate($input: CreateExchangeRateInput!) {
    createExchangeRate(input: $input) {
      id
      fromCurrency {
        id
        currencyCode
        currencyName
      }
      toCurrency {
        id
        currencyCode
        currencyName
      }
      exchangeRate
      effectiveDate
      expirationDate
      rateSource
      rateProvider
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_EXCHANGE_RATE = gql`
  mutation UpdateExchangeRate($id: ID!, $input: UpdateExchangeRateInput!) {
    updateExchangeRate(id: $id, input: $input) {
      id
      fromCurrency {
        id
        currencyCode
        currencyName
      }
      toCurrency {
        id
        currencyCode
        currencyName
      }
      exchangeRate
      effectiveDate
      expirationDate
      rateSource
      rateProvider
      updatedAt
    }
  }
`;

// Tax Mutations
export const CREATE_TAX_JURISDICTION = gql`
  mutation CreateTaxJurisdiction($input: CreateTaxJurisdictionInput!) {
    createTaxJurisdiction(input: $input) {
      id
      jurisdictionCode
      jurisdictionName
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_TAX_JURISDICTION = gql`
  mutation UpdateTaxJurisdiction($id: ID!, $input: UpdateTaxJurisdictionInput!) {
    updateTaxJurisdiction(id: $id, input: $input) {
      id
      jurisdictionCode
      jurisdictionName
      updatedAt
    }
  }
`;

export const CREATE_TAX_RATE = gql`
  mutation CreateTaxRate($input: CreateTaxRateInput!) {
    createTaxRate(input: $input) {
      id
      jurisdiction {
        id
        jurisdictionCode
        jurisdictionName
      }
      taxType
      rateName
      rate
      effectiveDate
      expirationDate
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_TAX_RATE = gql`
  mutation UpdateTaxRate($id: ID!, $input: UpdateTaxRateInput!) {
    updateTaxRate(id: $id, input: $input) {
      id
      jurisdiction {
        id
        jurisdictionCode
        jurisdictionName
      }
      taxType
      rateName
      rate
      effectiveDate
      expirationDate
      updatedAt
    }
  }
`;

// Accounts Receivable/Payable Mutations
export const CREATE_RECEIVABLE = gql`
  mutation CreateReceivable($input: CreateReceivableInput!) {
    createReceivable(input: $input) {
      id
      invoiceNumber
      invoiceDate
      dueDate
      customerId
      customer {
        id
        name
        email
      }
      totalAmount
      paidAmount
      balanceAmount
      status
      currency
      description
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_RECEIVABLE = gql`
  mutation UpdateReceivable($id: ID!, $input: UpdateReceivableInput!) {
    updateReceivable(id: $id, input: $input) {
      id
      invoiceNumber
      invoiceDate
      dueDate
      customerId
      customer {
        id
        name
        email
      }
      totalAmount
      paidAmount
      balanceAmount
      status
      currency
      description
      updatedAt
    }
  }
`;

export const RECORD_RECEIVABLE_PAYMENT = gql`
  mutation RecordReceivablePayment($input: RecordPaymentInput!) {
    recordReceivablePayment(input: $input) {
      id
      paidAmount
      balanceAmount
      status
      updatedAt
      payments {
        id
        paymentDate
        amount
        paymentMethod
        reference
      }
    }
  }
`;

export const CREATE_PAYABLE = gql`
  mutation CreatePayable($input: CreatePayableInput!) {
    createPayable(input: $input) {
      id
      invoiceNumber
      invoiceDate
      dueDate
      supplierId
      supplier {
        id
        name
        email
      }
      totalAmount
      paidAmount
      balanceAmount
      status
      currency
      description
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_PAYABLE = gql`
  mutation UpdatePayable($id: ID!, $input: UpdatePayableInput!) {
    updatePayable(id: $id, input: $input) {
      id
      invoiceNumber
      invoiceDate
      dueDate
      supplierId
      supplier {
        id
        name
        email
      }
      totalAmount
      paidAmount
      balanceAmount
      status
      currency
      description
      updatedAt
    }
  }
`;

export const RECORD_PAYABLE_PAYMENT = gql`
  mutation RecordPayablePayment($input: RecordPaymentInput!) {
    recordPayablePayment(input: $input) {
      id
      paidAmount
      balanceAmount
      status
      updatedAt
      payments {
        id
        paymentDate
        amount
        paymentMethod
        reference
      }
    }
  }
`;

// Reconciliation Mutations
export const CREATE_RECONCILIATION = gql`
  mutation CreateReconciliation($input: CreateReconciliationInput!) {
    createReconciliation(input: $input) {
      id
      accountId
      account {
        id
        accountNumber
        accountName
      }
      reconciliationDate
      statementDate
      statementBalance
      bookBalance
      difference
      status
      notes
      attachments
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_RECONCILIATION = gql`
  mutation UpdateReconciliation($id: ID!, $input: UpdateReconciliationInput!) {
    updateReconciliation(id: $id, input: $input) {
      id
      accountId
      reconciliationDate
      statementDate
      statementBalance
      bookBalance
      difference
      status
      notes
      attachments
      updatedAt
    }
  }
`;

export const COMPLETE_RECONCILIATION = gql`
  mutation CompleteReconciliation($id: ID!) {
    completeReconciliation(id: $id) {
      id
      status
      difference
      updatedAt
    }
  }
`;

export const ADD_RECONCILIATION_ITEM = gql`
  mutation AddReconciliationItem($reconciliationId: ID!, $input: CreateReconciliationItemInput!) {
    addReconciliationItem(reconciliationId: $reconciliationId, input: $input) {
      id
      transactionId
      description
      amount
      isMatched
      matchedDate
      createdAt
    }
  }
`;

export const MATCH_RECONCILIATION_ITEM = gql`
  mutation MatchReconciliationItem($id: ID!, $transactionId: ID!) {
    matchReconciliationItem(id: $id, transactionId: $transactionId) {
      id
      transactionId
      isMatched
      matchedDate
      updatedAt
    }
  }
`;

// Accounting Operations
export const INITIALIZE_ACCOUNTING = gql`
  mutation InitializeAccounting {
    initializeAccounting
  }
`;

export const CLOSE_FISCAL_PERIOD = gql`
  mutation CloseFiscalPeriod($input: CloseFiscalPeriodInput!) {
    closeFiscalPeriod(input: $input) {
      success
      message
      closedPeriod {
        id
        periodName
        startDate
        endDate
        status
        closedDate
      }
    }
  }
`;

export const REOPEN_FISCAL_PERIOD = gql`
  mutation ReopenFiscalPeriod($periodId: ID!, $reason: String!) {
    reopenFiscalPeriod(periodId: $periodId, reason: $reason) {
      success
      message
      reopenedPeriod {
        id
        periodName
        startDate
        endDate
        status
        reopenedDate
      }
    }
  }
`;

// Batch Operations
export const BATCH_POST_JOURNAL_ENTRIES = gql`
  mutation BatchPostJournalEntries($entryIds: [ID!]!) {
    batchPostJournalEntries(entryIds: $entryIds) {
      successCount
      failureCount
      results {
        entryId
        success
        message
      }
    }
  }
`;

export const BATCH_CREATE_JOURNAL_ENTRIES = gql`
  mutation BatchCreateJournalEntries($entries: [CreateJournalEntryInput!]!) {
    batchCreateJournalEntries(entries: $entries) {
      successCount
      failureCount
      results {
        success
        message
        entry {
          id
          entryNumber
          status
        }
      }
    }
  }
`;

export const IMPORT_CHART_OF_ACCOUNTS = gql`
  mutation ImportChartOfAccounts($file: Upload!) {
    importChartOfAccounts(file: $file) {
      success
      message
      importedCount
      failedCount
      errors {
        row
        message
      }
    }
  }
`;

export const EXPORT_FINANCIAL_DATA = gql`
  mutation ExportFinancialData($input: ExportFinancialDataInput!) {
    exportFinancialData(input: $input) {
      success
      message
      downloadUrl
      expiresAt
    }
  }
`;