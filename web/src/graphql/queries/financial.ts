/**
 * Financial Module GraphQL Queries
 * Comprehensive queries for all financial operations
 */

import { gql } from '@apollo/client';

// Chart of Accounts Queries
export const GET_ACCOUNTS = gql`
  query GetAccounts(
    $accountType: AccountType
    $isActive: Boolean
    $parentAccountId: String
    $includeInactive: Boolean
  ) {
    accounts(
      accountType: $accountType
      isActive: $isActive
      parentAccountId: $parentAccountId
      includeInactive: $includeInactive
    ) {
      id
      accountNumber
      accountName
      accountType
      accountSubType
      parentAccountId
      accountLevel
      normalBalance
      description
      isActive
      allowManualEntries
      requireDepartment
      requireProject
      isSystemAccount
      currentBalance
      createdAt
      updatedAt
    }
  }
`;

export const GET_ACCOUNT = gql`
  query GetAccount($id: ID!) {
    account(id: $id) {
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
      parentAccount {
        id
        accountName
        accountNumber
      }
      childAccounts {
        id
        accountName
        accountNumber
        accountType
      }
      currentAccountBalance {
        accountId
        debitBalance
        creditBalance
        netBalance
        asOfDate
      }
    }
  }
`;

export const GET_ACCOUNT_HIERARCHY = gql`
  query GetAccountHierarchy($rootAccountId: String) {
    accountHierarchy(rootAccountId: $rootAccountId) {
      id
      accountNumber
      accountName
      accountType
      accountSubType
      level
      children {
        id
        accountNumber
        accountName
        accountType
        accountSubType
        level
        children {
          id
          accountNumber
          accountName
          accountType
          accountSubType
          level
        }
      }
    }
  }
`;

export const SEARCH_ACCOUNTS = gql`
  query SearchAccounts($searchTerm: String!, $limit: Int) {
    searchAccounts(searchTerm: $searchTerm, limit: $limit) {
      id
      accountNumber
      accountName
      accountType
      accountSubType
      currentBalance
      isActive
    }
  }
`;

// Journal Entry Queries
export const GET_JOURNAL_ENTRY = gql`
  query GetJournalEntry($id: ID!) {
    journalEntry(id: $id) {
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
      createdBy
      updatedBy
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

export const GET_JOURNAL_ENTRIES = gql`
  query GetJournalEntries(
    $dateFrom: String
    $dateTo: String
    $status: JournalEntryStatus
    $sourceType: String
    $limit: Int
  ) {
    journalEntries(
      dateFrom: $dateFrom
      dateTo: $dateTo
      status: $status
      sourceType: $sourceType
      limit: $limit
    ) {
      id
      entryNumber
      entryDate
      postingDate
      description
      reference
      sourceType
      status
      totalDebitAmount
      totalCreditAmount
      isBalanced
      createdAt
      createdBy
    }
  }
`;

export const GET_GENERAL_LEDGER = gql`
  query GetGeneralLedger(
    $accountId: ID!
    $dateFrom: DateTime
    $dateTo: DateTime
    $includeUnposted: Boolean
  ) {
    getGeneralLedger(
      accountId: $accountId
      dateFrom: $dateFrom
      dateTo: $dateTo
      includeUnposted: $includeUnposted
    ) {
      accountId
      accountName
      accountNumber
      transactions {
        id
        entryDate
        postingDate
        description
        reference
        debitAmount
        creditAmount
        runningBalance
        journalEntryId
        status
      }
      summary {
        openingBalance
        totalDebits
        totalCredits
        closingBalance
        transactionCount
      }
    }
  }
`;

// Budget Queries
export const GET_BUDGET = gql`
  query GetBudget($id: ID!) {
    budget(id: $id) {
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
      budgetLines {
        id
        lineNumber
        accountId
        account {
          id
          accountNumber
          accountName
        }
        description
        budgetAmount
        actualAmount
        variance
        variancePercentage
        notes
      }
    }
  }
`;

export const GET_BUDGETS = gql`
  query GetBudgets(
    $fiscalYear: Int
    $status: String
    $budgetType: String
  ) {
    budgets(
      fiscalYear: $fiscalYear
      status: $status
      budgetType: $budgetType
    ) {
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
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const GET_BUDGET_VARIANCE = gql`
  query GetBudgetVariance($budgetId: ID!, $asOfDate: DateTime) {
    getBudgetVariance(budgetId: $budgetId, asOfDate: $asOfDate) {
      budgetId
      totalBudget
      totalActual
      totalVariance
      variancePercentage
      analysisDate
      accountVariances {
        accountId
        accountName
        budgetAmount
        actualAmount
        variance
        variancePercentage
      }
    }
  }
`;

// Financial Reporting Queries
export const GENERATE_BALANCE_SHEET = gql`
  query GenerateBalanceSheet($asOfDate: DateTime) {
    generateBalanceSheet(asOfDate: $asOfDate) {
      reportType
      reportDate
      periodStart
      periodEnd
      currency
      data {
        assets {
          currentAssets {
            accounts {
              accountId
              accountName
              balance
            }
            total
          }
          fixedAssets {
            accounts {
              accountId
              accountName
              balance
            }
            total
          }
          totalAssets
        }
        liabilities {
          currentLiabilities {
            accounts {
              accountId
              accountName
              balance
            }
            total
          }
          longTermLiabilities {
            accounts {
              accountId
              accountName
              balance
            }
            total
          }
          totalLiabilities
        }
        equity {
          ownersEquity {
            accounts {
              accountId
              accountName
              balance
            }
            total
          }
          retainedEarnings
          totalEquity
        }
        isBalanced
      }
      metadata {
        generatedAt
        generatedBy
        tenantId
      }
    }
  }
`;

export const GENERATE_INCOME_STATEMENT = gql`
  query GenerateIncomeStatement($periodStart: DateTime!, $periodEnd: DateTime!) {
    generateIncomeStatement(periodStart: $periodStart, periodEnd: $periodEnd) {
      reportType
      reportDate
      periodStart
      periodEnd
      currency
      data {
        revenue {
          accounts {
            accountId
            accountName
            balance
          }
          total
        }
        expenses {
          costOfGoodsSold {
            accounts {
              accountId
              accountName
              balance
            }
            total
          }
          operatingExpenses {
            accounts {
              accountId
              accountName
              balance
            }
            total
          }
          totalExpenses
        }
        grossProfit
        netIncome
      }
      metadata {
        generatedAt
        generatedBy
        tenantId
      }
    }
  }
`;

export const GENERATE_CASH_FLOW_STATEMENT = gql`
  query GenerateCashFlowStatement($periodStart: DateTime!, $periodEnd: DateTime!) {
    generateCashFlowStatement(periodStart: $periodStart, periodEnd: $periodEnd) {
      reportType
      reportDate
      periodStart
      periodEnd
      currency
      data {
        operatingActivities {
          netIncome
          adjustments {
            depreciation
            accountsReceivableChange
            accountsPayableChange
            inventoryChange
            other
          }
          netCashFromOperating
        }
        investingActivities {
          equipmentPurchases
          equipmentSales
          investments
          netCashFromInvesting
        }
        financingActivities {
          loanProceeds
          loanPayments
          ownerContributions
          ownerWithdrawals
          netCashFromFinancing
        }
        netCashChange
        beginningCash
        endingCash
      }
      metadata {
        generatedAt
        generatedBy
        tenantId
      }
    }
  }
`;

export const GENERATE_TRIAL_BALANCE = gql`
  query GenerateTrialBalance($asOfDate: DateTime) {
    generateTrialBalance(asOfDate: $asOfDate) {
      reportType
      reportDate
      periodStart
      periodEnd
      currency
      data {
        accounts {
          accountId
          accountNumber
          accountName
          accountType
          debitBalance
          creditBalance
        }
        totals {
          totalDebits
          totalCredits
          isBalanced
        }
      }
      metadata {
        generatedAt
        generatedBy
        tenantId
      }
    }
  }
`;

export const GENERATE_FINANCIAL_RATIOS = gql`
  query GenerateFinancialRatios($asOfDate: DateTime) {
    generateFinancialRatios(asOfDate: $asOfDate) {
      reportType
      reportDate
      currency
      data {
        liquidityRatios {
          currentRatio
          quickRatio
          cashRatio
        }
        profitabilityRatios {
          grossProfitMargin
          netProfitMargin
          returnOnAssets
          returnOnEquity
        }
        leverageRatios {
          debtToEquity
          debtToAssets
          equityMultiplier
        }
        efficiencyRatios {
          assetTurnover
          inventoryTurnover
          receivablesTurnover
        }
      }
      metadata {
        generatedAt
        generatedBy
        tenantId
      }
    }
  }
`;

// Multi-Currency Queries
export const CONVERT_CURRENCY = gql`
  query ConvertCurrency(
    $amount: Float!
    $fromCurrencyId: ID!
    $toCurrencyId: ID!
    $conversionDate: DateTime
  ) {
    convertCurrency(
      amount: $amount
      fromCurrencyId: $fromCurrencyId
      toCurrencyId: $toCurrencyId
      conversionDate: $conversionDate
    ) {
      originalAmount
      convertedAmount
      exchangeRate
      fromCurrency {
        id
        currencyCode
        currencyName
        currencySymbol
      }
      toCurrency {
        id
        currencyCode
        currencyName
        currencySymbol
      }
      conversionDate
      rateSource
    }
  }
`;

export const GET_EXCHANGE_RATES = gql`
  query GetExchangeRates(
    $fromCurrencyId: ID
    $toCurrencyId: ID
    $effectiveDate: DateTime
  ) {
    getExchangeRates(
      fromCurrencyId: $fromCurrencyId
      toCurrencyId: $toCurrencyId
      effectiveDate: $effectiveDate
    ) {
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
    }
  }
`;

export const GET_CURRENCIES = gql`
  query GetCurrencies($activeOnly: Boolean) {
    currencies(activeOnly: $activeOnly) {
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
    }
  }
`;

// Tax Queries
export const CALCULATE_TAX = gql`
  query CalculateTax($input: TaxCalculationInput!) {
    calculateTax(input: $input) {
      taxableAmount
      totalTaxAmount
      taxDetails {
        jurisdictionId
        jurisdictionName
        taxType
        taxName
        taxRate
        taxAmount
        calculationMethod
      }
      calculationDate
      sourceType
      sourceId
    }
  }
`;

export const GET_TAX_RATES = gql`
  query GetTaxRates($jurisdictionId: ID, $activeOnly: Boolean) {
    getTaxRates(jurisdictionId: $jurisdictionId, activeOnly: $activeOnly) {
      id
      jurisdiction {
        id
        jurisdictionCode
        jurisdictionName
      }
      taxType
      rateName
      rate
      createdAt
      updatedAt
    }
  }
`;

export const GET_TAX_JURISDICTIONS = gql`
  query GetTaxJurisdictions($activeOnly: Boolean) {
    taxJurisdictions(activeOnly: $activeOnly) {
      id
      jurisdictionCode
      jurisdictionName
      taxRates {
        id
        taxType
        rateName
        rate
      }
      createdAt
      updatedAt
    }
  }
`;

// Accounts Receivable/Payable Queries
export const GET_RECEIVABLES = gql`
  query GetReceivables(
    $status: String
    $customerId: String
    $fromDate: DateTime
    $toDate: DateTime
  ) {
    getReceivables(
      status: $status
      customerId: $customerId
      fromDate: $fromDate
      toDate: $toDate
    ) {
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
    }
  }
`;

export const GET_PAYABLES = gql`
  query GetPayables(
    $status: String
    $supplierId: String
    $fromDate: DateTime
    $toDate: DateTime
  ) {
    getPayables(
      status: $status
      supplierId: $supplierId
      fromDate: $fromDate
      toDate: $toDate
    ) {
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
    }
  }
`;

export const GET_AGING_REPORT = gql`
  query GetAgingReport($reportType: String!, $asOfDate: DateTime) {
    getAgingReport(reportType: $reportType, asOfDate: $asOfDate) {
      entityId
      entityName
      totalAmount
      current
      days1to30
      days31to60
      days61to90
      over90Days
      oldestInvoiceDate
      contactInfo
    }
  }
`;

// Reconciliation Queries
export const GET_RECONCILIATION = gql`
  query GetReconciliation($id: ID!) {
    reconciliation(id: $id) {
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
      items {
        id
        transactionId
        description
        amount
        isMatched
        matchedDate
      }
    }
  }
`;

export const GET_RECONCILIATIONS = gql`
  query GetReconciliations(
    $accountId: ID!
    $dateFrom: DateTime
    $dateTo: DateTime
    $status: String
    $limit: Int
  ) {
    reconciliations(
      accountId: $accountId
      dateFrom: $dateFrom
      dateTo: $dateTo
      status: $status
      limit: $limit
    ) {
      id
      accountId
      reconciliationDate
      statementDate
      statementBalance
      bookBalance
      difference
      status
      createdAt
      updatedAt
    }
  }
`;

// Accounting Summary Queries
export const GET_TRIAL_BALANCE = gql`
  query GetTrialBalance($asOfDate: DateTime) {
    trialBalance(asOfDate: $asOfDate) {
      accounts {
        accountId
        accountNumber
        accountName
        accountType
        debitBalance
        creditBalance
      }
      totals {
        totalDebits
        totalCredits
        isBalanced
      }
      asOfDate
    }
  }
`;

export const GET_FINANCIAL_SUMMARY = gql`
  query GetFinancialSummary($dateFrom: DateTime, $dateTo: DateTime) {
    financialSummary(dateFrom: $dateFrom, dateTo: $dateTo) {
      totalRevenue
      totalExpenses
      netIncome
      totalAssets
      totalLiabilities
      totalEquity
      cashBalance
      accountsReceivable
      accountsPayable
      inventory
      periodStart
      periodEnd
      currency
    }
  }
`;

export const VALIDATE_ACCOUNTING_INTEGRITY = gql`
  query ValidateAccountingIntegrity {
    validateAccountingIntegrity {
      isValid
      errors {
        type
        message
        affectedAccounts
        suggestedFix
      }
      warnings {
        type
        message
        affectedAccounts
      }
      summary {
        totalAccounts
        totalTransactions
        totalDebits
        totalCredits
        balanceDifference
      }
    }
  }
`;