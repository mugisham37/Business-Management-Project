import { pgTable, varchar, decimal, timestamp, uuid, integer, boolean, text, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { baseSchema } from './base.schema';
import { tenants } from './tenant.schema';
import { users } from './user.schema';
import { transactions } from './transaction.schema';

// Enums for financial system
export const accountTypeEnum = pgEnum('account_type', [
  'asset',
  'liability', 
  'equity',
  'revenue',
  'expense',
  'contra_asset',
  'contra_liability',
  'contra_equity',
  'contra_revenue'
]);

export const accountSubTypeEnum = pgEnum('account_sub_type', [
  // Assets
  'current_asset',
  'fixed_asset',
  'other_asset',
  'cash',
  'accounts_receivable',
  'inventory',
  'prepaid_expense',
  'equipment',
  'accumulated_depreciation',
  
  // Liabilities
  'current_liability',
  'long_term_liability',
  'accounts_payable',
  'accrued_expense',
  'notes_payable',
  'mortgage_payable',
  
  // Equity
  'owners_equity',
  'retained_earnings',
  'capital_stock',
  
  // Revenue
  'sales_revenue',
  'service_revenue',
  'other_revenue',
  'sales_returns',
  'sales_discounts',
  
  // Expenses
  'cost_of_goods_sold',
  'operating_expense',
  'administrative_expense',
  'selling_expense',
  'interest_expense',
  'depreciation_expense'
]);

export const journalEntryStatusEnum = pgEnum('journal_entry_status', [
  'draft',
  'posted',
  'reversed',
  'voided'
]);

export const reconciliationStatusEnum = pgEnum('reconciliation_status', [
  'unreconciled',
  'reconciled',
  'disputed'
]);

// Chart of Accounts
export const chartOfAccounts: any = pgTable('chart_of_accounts', {
  ...baseSchema,
  
  // Account identification
  accountNumber: varchar('account_number', { length: 20 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  accountType: accountTypeEnum('account_type').notNull(),
  accountSubType: accountSubTypeEnum('account_sub_type').notNull(),
  
  // Hierarchy
  parentAccountId: uuid('parent_account_id'),
  accountLevel: integer('account_level').default(1).notNull(),
  accountPath: varchar('account_path', { length: 500 }), // For hierarchical queries
  
  // Account properties
  isActive: boolean('is_active').default(true).notNull(),
  isSystemAccount: boolean('is_system_account').default(false).notNull(),
  allowManualEntries: boolean('allow_manual_entries').default(true).notNull(),
  requireDepartment: boolean('require_department').default(false).notNull(),
  requireProject: boolean('require_project').default(false).notNull(),
  
  // Balance tracking
  currentBalance: decimal('current_balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  normalBalance: varchar('normal_balance', { length: 10 }).notNull(), // 'debit' or 'credit'
  
  // Metadata
  description: text('description'),
  taxReportingCategory: varchar('tax_reporting_category', { length: 100 }),
  externalAccountId: varchar('external_account_id', { length: 100 }), // For integrations
  
  // Configuration
  settings: jsonb('settings').default({}),
}, (table) => ({
  tenantAccountNumberIdx: index('idx_coa_tenant_account_number').on(table.tenantId, table.accountNumber),
  tenantAccountTypeIdx: index('idx_coa_tenant_account_type').on(table.tenantId, table.accountType),
  parentAccountIdx: index('idx_coa_parent_account').on(table.parentAccountId),
  accountPathIdx: index('idx_coa_account_path').on(table.accountPath),
}));

// Journal Entries (Double-entry bookkeeping)
export const journalEntries: any = pgTable('journal_entries', {
  ...baseSchema,
  
  // Entry identification
  entryNumber: varchar('entry_number', { length: 50 }).notNull(),
  entryDate: timestamp('entry_date').notNull(),
  postingDate: timestamp('posting_date'),
  
  // Entry details
  description: text('description').notNull(),
  reference: varchar('reference', { length: 100 }), // Invoice number, check number, etc.
  status: journalEntryStatusEnum('status').default('draft').notNull(),
  
  // Source information
  sourceType: varchar('source_type', { length: 50 }), // 'manual', 'pos_transaction', 'payroll', etc.
  sourceId: uuid('source_id'), // ID of the source record
  
  // Approval workflow
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  
  // Reversal information
  reversedBy: uuid('reversed_by').references(() => users.id),
  reversedAt: timestamp('reversed_at'),
  reversalReason: text('reversal_reason'),
  originalEntryId: uuid('original_entry_id'),
  
  // Metadata
  notes: text('notes'),
  attachments: jsonb('attachments').default([]),
  
  // Totals for validation
  totalDebits: decimal('total_debits', { precision: 15, scale: 2 }).notNull(),
  totalCredits: decimal('total_credits', { precision: 15, scale: 2 }).notNull(),
}, (table) => ({
  tenantEntryNumberIdx: index('idx_je_tenant_entry_number').on(table.tenantId, table.entryNumber),
  tenantEntryDateIdx: index('idx_je_tenant_entry_date').on(table.tenantId, table.entryDate),
  tenantStatusIdx: index('idx_je_tenant_status').on(table.tenantId, table.status),
  sourceIdx: index('idx_je_source').on(table.sourceType, table.sourceId),
  originalEntryIdx: index('idx_je_original_entry').on(table.originalEntryId),
}));

// Journal Entry Line Items
export const journalEntryLines = pgTable('journal_entry_lines', {
  ...baseSchema,
  
  // Relationships
  journalEntryId: uuid('journal_entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  
  // Line details
  lineNumber: integer('line_number').notNull(),
  description: text('description'),
  
  // Amounts
  debitAmount: decimal('debit_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  creditAmount: decimal('credit_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  
  // Dimensions for reporting
  departmentId: uuid('department_id'),
  projectId: uuid('project_id'),
  locationId: uuid('location_id'),
  customerId: uuid('customer_id'),
  supplierId: uuid('supplier_id'),
  
  // Reconciliation
  reconciliationStatus: reconciliationStatusEnum('reconciliation_status').default('unreconciled').notNull(),
  reconciledAt: timestamp('reconciled_at'),
  reconciledBy: uuid('reconciled_by').references(() => users.id),
  
  // Metadata
  reference: varchar('reference', { length: 100 }),
  externalReference: varchar('external_reference', { length: 100 }),
}, (table) => ({
  journalEntryIdx: index('idx_jel_journal_entry').on(table.journalEntryId),
  accountIdx: index('idx_jel_account').on(table.accountId),
  tenantAccountDateIdx: index('idx_jel_tenant_account_date').on(table.tenantId, table.accountId, table.createdAt),
  reconciliationIdx: index('idx_jel_reconciliation').on(table.reconciliationStatus),
}));

// Account Balances (for performance - materialized view concept)
export const accountBalances = pgTable('account_balances', {
  ...baseSchema,
  
  // Relationships
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  
  // Balance information
  balanceDate: timestamp('balance_date').notNull(),
  openingBalance: decimal('opening_balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  debitMovements: decimal('debit_movements', { precision: 15, scale: 2 }).default('0.00').notNull(),
  creditMovements: decimal('credit_movements', { precision: 15, scale: 2 }).default('0.00').notNull(),
  closingBalance: decimal('closing_balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  
  // Period information
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalPeriod: integer('fiscal_period').notNull(), // 1-12 for months, or custom periods
  
  // Metadata
  isAdjusted: boolean('is_adjusted').default(false).notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
}, (table) => ({
  accountBalanceDateIdx: index('idx_ab_account_balance_date').on(table.accountId, table.balanceDate),
  tenantFiscalIdx: index('idx_ab_tenant_fiscal').on(table.tenantId, table.fiscalYear, table.fiscalPeriod),
  balanceDateIdx: index('idx_ab_balance_date').on(table.balanceDate),
}));

// Fiscal Periods
export const fiscalPeriods = pgTable('fiscal_periods', {
  ...baseSchema,
  
  // Period identification
  fiscalYear: integer('fiscal_year').notNull(),
  periodNumber: integer('period_number').notNull(),
  periodName: varchar('period_name', { length: 50 }).notNull(),
  
  // Period dates
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isClosed: boolean('is_closed').default(false).notNull(),
  closedAt: timestamp('closed_at'),
  closedBy: uuid('closed_by').references(() => users.id),
  
  // Year-end processing
  isYearEnd: boolean('is_year_end').default(false).notNull(),
  yearEndProcessed: boolean('year_end_processed').default(false).notNull(),
  yearEndProcessedAt: timestamp('year_end_processed_at'),
}, (table) => ({
  tenantFiscalYearPeriodIdx: index('idx_fp_tenant_fiscal_year_period').on(table.tenantId, table.fiscalYear, table.periodNumber),
  tenantDateRangeIdx: index('idx_fp_tenant_date_range').on(table.tenantId, table.startDate, table.endDate),
}));

// Budget Management
export const budgets = pgTable('budgets', {
  ...baseSchema,
  
  // Budget identification
  budgetName: varchar('budget_name', { length: 255 }).notNull(),
  budgetType: varchar('budget_type', { length: 50 }).notNull(), // 'annual', 'quarterly', 'monthly', 'project'
  
  // Period
  fiscalYear: integer('fiscal_year').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  
  // Status
  status: varchar('status', { length: 20 }).default('draft').notNull(), // 'draft', 'approved', 'active', 'closed'
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  
  // Metadata
  description: text('description'),
  notes: text('notes'),
  version: integer('version').default(1).notNull(),
}, (table) => ({
  tenantFiscalYearIdx: index('idx_budget_tenant_fiscal_year').on(table.tenantId, table.fiscalYear),
  tenantStatusIdx: index('idx_budget_tenant_status').on(table.tenantId, table.status),
}));

// Budget Line Items
export const budgetLines = pgTable('budget_lines', {
  ...baseSchema,
  
  // Relationships
  budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  
  // Budget amounts by period
  annualAmount: decimal('annual_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  q1Amount: decimal('q1_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  q2Amount: decimal('q2_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  q3Amount: decimal('q3_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  q4Amount: decimal('q4_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  
  // Monthly breakdown
  monthlyAmounts: jsonb('monthly_amounts').default({}), // {1: amount, 2: amount, ...}
  
  // Dimensions
  departmentId: uuid('department_id'),
  projectId: uuid('project_id'),
  locationId: uuid('location_id'),
  
  // Metadata
  notes: text('notes'),
}, (table) => ({
  budgetAccountIdx: index('idx_bl_budget_account').on(table.budgetId, table.accountId),
  accountIdx: index('idx_bl_account').on(table.accountId),
}));

// Account Reconciliation
export const accountReconciliations = pgTable('account_reconciliations', {
  ...baseSchema,
  
  // Relationships
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  
  // Reconciliation details
  reconciliationDate: timestamp('reconciliation_date').notNull(),
  statementDate: timestamp('statement_date').notNull(),
  
  // Balances
  bookBalance: decimal('book_balance', { precision: 15, scale: 2 }).notNull(),
  statementBalance: decimal('statement_balance', { precision: 15, scale: 2 }).notNull(),
  adjustedBalance: decimal('adjusted_balance', { precision: 15, scale: 2 }).notNull(),
  
  // Status
  status: reconciliationStatusEnum('status').default('unreconciled').notNull(),
  reconciledBy: uuid('reconciled_by').references(() => users.id),
  
  // Differences
  outstandingDebits: decimal('outstanding_debits', { precision: 15, scale: 2 }).default('0.00').notNull(),
  outstandingCredits: decimal('outstanding_credits', { precision: 15, scale: 2 }).default('0.00').notNull(),
  
  // Metadata
  notes: text('notes'),
  attachments: jsonb('attachments').default([]),
}, (table) => ({
  accountReconciliationDateIdx: index('idx_ar_account_reconciliation_date').on(table.accountId, table.reconciliationDate),
  tenantStatusIdx: index('idx_ar_tenant_status').on(table.tenantId, table.status),
}));

// System-generated transaction postings
export const transactionPostings = pgTable('transaction_postings', {
  ...baseSchema,
  
  // Source transaction
  sourceTransactionId: uuid('source_transaction_id').notNull().references(() => transactions.id),
  journalEntryId: uuid('journal_entry_id').notNull().references(() => journalEntries.id),
  
  // Posting rules applied
  postingRuleId: uuid('posting_rule_id'),
  postingRuleName: varchar('posting_rule_name', { length: 100 }),
  
  // Status
  status: varchar('status', { length: 20 }).default('posted').notNull(),
  postedAt: timestamp('posted_at').defaultNow().notNull(),
  
  // Error handling
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0).notNull(),
}, (table) => ({
  sourceTransactionIdx: index('idx_tp_source_transaction').on(table.sourceTransactionId),
  journalEntryIdx: index('idx_tp_journal_entry').on(table.journalEntryId),
  tenantStatusIdx: index('idx_tp_tenant_status').on(table.tenantId, table.status),
}));

// Tax Management Tables

// Tax Jurisdictions
export const taxJurisdictions = pgTable('tax_jurisdictions', {
  ...baseSchema,
  
  // Jurisdiction identification
  jurisdictionCode: varchar('jurisdiction_code', { length: 20 }).notNull(),
  jurisdictionName: varchar('jurisdiction_name', { length: 255 }).notNull(),
  jurisdictionType: varchar('jurisdiction_type', { length: 50 }).notNull(), // 'federal', 'state', 'county', 'city', 'custom'
  
  // Geographic information
  country: varchar('country', { length: 3 }).notNull(), // ISO 3166-1 alpha-3
  stateProvince: varchar('state_province', { length: 10 }),
  county: varchar('county', { length: 100 }),
  city: varchar('city', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  
  // Tax authority information
  taxAuthorityName: varchar('tax_authority_name', { length: 255 }),
  taxAuthorityId: varchar('tax_authority_id', { length: 100 }),
  
  // Status and dates
  isActive: boolean('is_active').default(true).notNull(),
  effectiveDate: timestamp('effective_date').notNull(),
  expirationDate: timestamp('expiration_date'),
  
  // Configuration
  settings: jsonb('settings').default({}),
}, (table) => ({
  tenantJurisdictionCodeIdx: index('idx_tj_tenant_jurisdiction_code').on(table.tenantId, table.jurisdictionCode),
  countryStateIdx: index('idx_tj_country_state').on(table.country, table.stateProvince),
  effectiveDateIdx: index('idx_tj_effective_date').on(table.effectiveDate),
}));

// Tax Rates
export const taxRates = pgTable('tax_rates', {
  ...baseSchema,
  
  // Relationships
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => taxJurisdictions.id),
  
  // Tax identification
  taxType: varchar('tax_type', { length: 50 }).notNull(), // 'sales', 'vat', 'gst', 'income', 'property', 'excise'
  taxName: varchar('tax_name', { length: 255 }).notNull(),
  taxCode: varchar('tax_code', { length: 50 }).notNull(),
  
  // Rate information
  rate: decimal('rate', { precision: 8, scale: 6 }).notNull(), // Percentage as decimal (e.g., 0.0825 for 8.25%)
  flatAmount: decimal('flat_amount', { precision: 15, scale: 2 }).default('0.00'), // Fixed amount if applicable
  
  // Calculation method
  calculationMethod: varchar('calculation_method', { length: 20 }).default('percentage').notNull(), // 'percentage', 'flat', 'tiered'
  compoundingOrder: integer('compounding_order').default(1), // For compound taxes
  
  // Applicability
  applicableToProducts: boolean('applicable_to_products').default(true).notNull(),
  applicableToServices: boolean('applicable_to_services').default(true).notNull(),
  applicableToShipping: boolean('applicable_to_shipping').default(false).notNull(),
  
  // Thresholds
  minimumTaxableAmount: decimal('minimum_taxable_amount', { precision: 15, scale: 2 }).default('0.00'),
  maximumTaxableAmount: decimal('maximum_taxable_amount', { precision: 15, scale: 2 }),
  
  // Effective period
  effectiveDate: timestamp('effective_date').notNull(),
  expirationDate: timestamp('expiration_date'),
  isActive: boolean('is_active').default(true).notNull(),
  
  // Reporting
  reportingCategory: varchar('reporting_category', { length: 100 }),
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id),
  
  // Configuration
  settings: jsonb('settings').default({}),
}, (table) => ({
  jurisdictionTaxTypeIdx: index('idx_tr_jurisdiction_tax_type').on(table.jurisdictionId, table.taxType),
  tenantTaxCodeIdx: index('idx_tr_tenant_tax_code').on(table.tenantId, table.taxCode),
  effectiveDateIdx: index('idx_tr_effective_date').on(table.effectiveDate),
  glAccountIdx: index('idx_tr_gl_account').on(table.glAccountId),
}));

// Tax Calculations (for audit trail)
export const taxCalculations = pgTable('tax_calculations', {
  ...baseSchema,
  
  // Source information
  sourceType: varchar('source_type', { length: 50 }).notNull(), // 'transaction', 'invoice', 'manual'
  sourceId: uuid('source_id').notNull(),
  
  // Tax details
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => taxJurisdictions.id),
  taxRateId: uuid('tax_rate_id').notNull().references(() => taxRates.id),
  
  // Calculation inputs
  taxableAmount: decimal('taxable_amount', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 8, scale: 6 }).notNull(),
  
  // Calculation results
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull(),
  roundingAdjustment: decimal('rounding_adjustment', { precision: 15, scale: 2 }).default('0.00'),
  
  // Metadata
  calculationDate: timestamp('calculation_date').defaultNow().notNull(),
  calculationMethod: varchar('calculation_method', { length: 50 }),
  notes: text('notes'),
}, (table) => ({
  sourceIdx: index('idx_tc_source').on(table.sourceType, table.sourceId),
  jurisdictionIdx: index('idx_tc_jurisdiction').on(table.jurisdictionId),
  taxRateIdx: index('idx_tc_tax_rate').on(table.taxRateId),
  calculationDateIdx: index('idx_tc_calculation_date').on(table.calculationDate),
}));

// Tax Returns/Filings
export const taxReturns = pgTable('tax_returns', {
  ...baseSchema,
  
  // Return identification
  returnNumber: varchar('return_number', { length: 50 }).notNull(),
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => taxJurisdictions.id),
  
  // Period information
  periodType: varchar('period_type', { length: 20 }).notNull(), // 'monthly', 'quarterly', 'annual'
  periodYear: integer('period_year').notNull(),
  periodNumber: integer('period_number').notNull(), // 1-12 for monthly, 1-4 for quarterly, 1 for annual
  periodStartDate: timestamp('period_start_date').notNull(),
  periodEndDate: timestamp('period_end_date').notNull(),
  
  // Filing information
  filingStatus: varchar('filing_status', { length: 20 }).default('draft').notNull(), // 'draft', 'filed', 'amended', 'voided'
  filingDate: timestamp('filing_date'),
  dueDate: timestamp('due_date').notNull(),
  
  // Amounts
  totalTaxableAmount: decimal('total_taxable_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  totalTaxAmount: decimal('total_tax_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  totalPayments: decimal('total_payments', { precision: 15, scale: 2 }).default('0.00').notNull(),
  amountDue: decimal('amount_due', { precision: 15, scale: 2 }).default('0.00').notNull(),
  
  // Processing
  preparedBy: uuid('prepared_by').references(() => users.id),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  
  // External filing
  externalFilingId: varchar('external_filing_id', { length: 100 }),
  confirmationNumber: varchar('confirmation_number', { length: 100 }),
  
  // Attachments and notes
  attachments: jsonb('attachments').default([]),
  notes: text('notes'),
}, (table) => ({
  tenantReturnNumberIdx: index('idx_tr_tenant_return_number').on(table.tenantId, table.returnNumber),
  jurisdictionPeriodIdx: index('idx_tr_jurisdiction_period').on(table.jurisdictionId, table.periodYear, table.periodNumber),
  filingStatusIdx: index('idx_tr_filing_status').on(table.filingStatus),
  dueDateIdx: index('idx_tr_due_date').on(table.dueDate),
}));

// Tax Return Line Items
export const taxReturnLines = pgTable('tax_return_lines', {
  ...baseSchema,
  
  // Relationships
  taxReturnId: uuid('tax_return_id').notNull().references(() => taxReturns.id, { onDelete: 'cascade' }),
  taxRateId: uuid('tax_rate_id').references(() => taxRates.id),
  
  // Line information
  lineNumber: integer('line_number').notNull(),
  lineDescription: varchar('line_description', { length: 255 }).notNull(),
  
  // Amounts
  taxableAmount: decimal('taxable_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  taxRate: decimal('tax_rate', { precision: 8, scale: 6 }),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  
  // Source data
  sourceAccountId: uuid('source_account_id').references(() => chartOfAccounts.id),
  calculationMethod: varchar('calculation_method', { length: 100 }),
  
  // Metadata
  notes: text('notes'),
}, (table) => ({
  taxReturnIdx: index('idx_trl_tax_return').on(table.taxReturnId),
  taxRateIdx: index('idx_trl_tax_rate').on(table.taxRateId),
  sourceAccountIdx: index('idx_trl_source_account').on(table.sourceAccountId),
}));

// Accounts Receivable/Payable Tables

// AR/AP Invoices
export const arApInvoices = pgTable('ar_ap_invoices', {
  ...baseSchema,
  
  // Invoice identification
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull(),
  invoiceType: varchar('invoice_type', { length: 20 }).notNull(), // 'receivable', 'payable'
  
  // Relationships
  customerId: uuid('customer_id'), // For AR
  supplierId: uuid('supplier_id'), // For AP
  
  // Invoice details
  invoiceDate: timestamp('invoice_date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  
  // Amounts
  subtotalAmount: decimal('subtotal_amount', { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  balanceAmount: decimal('balance_amount', { precision: 15, scale: 2 }).notNull(),
  
  // Status and terms
  status: varchar('status', { length: 20 }).default('open').notNull(), // 'draft', 'open', 'paid', 'overdue', 'cancelled'
  paymentTerms: varchar('payment_terms', { length: 50 }), // 'net30', 'net60', 'cod', etc.
  paymentTermsDays: integer('payment_terms_days').default(30),
  
  // Currency
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 6 }).default('1.000000'),
  
  // References
  purchaseOrderNumber: varchar('purchase_order_number', { length: 100 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  
  // GL Integration
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  
  // Metadata
  description: text('description'),
  notes: text('notes'),
  attachments: jsonb('attachments').default([]),
}, (table) => ({
  tenantInvoiceNumberIdx: index('idx_arai_tenant_invoice_number').on(table.tenantId, table.invoiceNumber),
  tenantInvoiceTypeIdx: index('idx_arai_tenant_invoice_type').on(table.tenantId, table.invoiceType),
  customerIdx: index('idx_arai_customer').on(table.customerId),
  supplierIdx: index('idx_arai_supplier').on(table.supplierId),
  invoiceDateIdx: index('idx_arai_invoice_date').on(table.invoiceDate),
  dueDateIdx: index('idx_arai_due_date').on(table.dueDate),
  statusIdx: index('idx_arai_status').on(table.status),
  glAccountIdx: index('idx_arai_gl_account').on(table.glAccountId),
}));

// AR/AP Invoice Line Items
export const arApInvoiceLines = pgTable('ar_ap_invoice_lines', {
  ...baseSchema,
  
  // Relationships
  invoiceId: uuid('invoice_id').notNull().references(() => arApInvoices.id, { onDelete: 'cascade' }),
  productId: uuid('product_id'),
  
  // Line details
  lineNumber: integer('line_number').notNull(),
  description: text('description').notNull(),
  
  // Quantities and rates
  quantity: decimal('quantity', { precision: 15, scale: 6 }).default('1.000000').notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  lineAmount: decimal('line_amount', { precision: 15, scale: 2 }).notNull(),
  
  // Tax information
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  taxRateId: uuid('tax_rate_id').references(() => taxRates.id),
  
  // Discounts
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0.00'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  
  // GL Integration
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id),
  
  // Metadata
  notes: text('notes'),
}, (table) => ({
  invoiceIdx: index('idx_arail_invoice').on(table.invoiceId),
  productIdx: index('idx_arail_product').on(table.productId),
  glAccountIdx: index('idx_arail_gl_account').on(table.glAccountId),
}));

// Payments (for both AR and AP)
export const arApPayments = pgTable('ar_ap_payments', {
  ...baseSchema,
  
  // Payment identification
  paymentNumber: varchar('payment_number', { length: 100 }).notNull(),
  paymentType: varchar('payment_type', { length: 20 }).notNull(), // 'received', 'made'
  
  // Relationships
  customerId: uuid('customer_id'), // For AR payments
  supplierId: uuid('supplier_id'), // For AP payments
  
  // Payment details
  paymentDate: timestamp('payment_date').notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // 'cash', 'check', 'wire', 'ach', 'card'
  
  // Amounts
  paymentAmount: decimal('payment_amount', { precision: 15, scale: 2 }).notNull(),
  appliedAmount: decimal('applied_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  unappliedAmount: decimal('unapplied_amount', { precision: 15, scale: 2 }).notNull(),
  
  // Currency
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 6 }).default('1.000000'),
  
  // Bank information
  bankAccountId: uuid('bank_account_id'),
  checkNumber: varchar('check_number', { length: 50 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  
  // Status
  status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'cleared', 'bounced', 'voided'
  
  // GL Integration
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  
  // Metadata
  description: text('description'),
  notes: text('notes'),
  attachments: jsonb('attachments').default([]),
}, (table) => ({
  tenantPaymentNumberIdx: index('idx_arap_tenant_payment_number').on(table.tenantId, table.paymentNumber),
  tenantPaymentTypeIdx: index('idx_arap_tenant_payment_type').on(table.tenantId, table.paymentType),
  customerIdx: index('idx_arap_customer').on(table.customerId),
  supplierIdx: index('idx_arap_supplier').on(table.supplierId),
  paymentDateIdx: index('idx_arap_payment_date').on(table.paymentDate),
  statusIdx: index('idx_arap_status').on(table.status),
  glAccountIdx: index('idx_arap_gl_account').on(table.glAccountId),
}));

// Payment Applications (linking payments to invoices)
export const paymentApplications = pgTable('payment_applications', {
  ...baseSchema,
  
  // Relationships
  paymentId: uuid('payment_id').notNull().references(() => arApPayments.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => arApInvoices.id, { onDelete: 'cascade' }),
  
  // Application details
  appliedAmount: decimal('applied_amount', { precision: 15, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  
  // Currency
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 6 }).default('1.000000'),
  
  // Application date
  applicationDate: timestamp('application_date').defaultNow().notNull(),
  
  // GL Integration
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  
  // Metadata
  notes: text('notes'),
}, (table) => ({
  paymentIdx: index('idx_pa_payment').on(table.paymentId),
  invoiceIdx: index('idx_pa_invoice').on(table.invoiceId),
  applicationDateIdx: index('idx_pa_application_date').on(table.applicationDate),
}));

// Credit Memos
export const creditMemos = pgTable('credit_memos', {
  ...baseSchema,
  
  // Credit memo identification
  creditMemoNumber: varchar('credit_memo_number', { length: 100 }).notNull(),
  creditMemoType: varchar('credit_memo_type', { length: 20 }).notNull(), // 'customer_credit', 'supplier_credit'
  
  // Relationships
  customerId: uuid('customer_id'), // For customer credits
  supplierId: uuid('supplier_id'), // For supplier credits
  originalInvoiceId: uuid('original_invoice_id').references(() => arApInvoices.id),
  
  // Credit memo details
  creditMemoDate: timestamp('credit_memo_date').notNull(),
  
  // Amounts
  subtotalAmount: decimal('subtotal_amount', { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  appliedAmount: decimal('applied_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  balanceAmount: decimal('balance_amount', { precision: 15, scale: 2 }).notNull(),
  
  // Currency
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 6 }).default('1.000000'),
  
  // Status
  status: varchar('status', { length: 20 }).default('open').notNull(), // 'draft', 'open', 'applied', 'voided'
  
  // Reason
  reason: varchar('reason', { length: 100 }), // 'return', 'discount', 'error_correction', etc.
  
  // GL Integration
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  
  // Metadata
  description: text('description'),
  notes: text('notes'),
  attachments: jsonb('attachments').default([]),
}, (table) => ({
  tenantCreditMemoNumberIdx: index('idx_cm_tenant_credit_memo_number').on(table.tenantId, table.creditMemoNumber),
  tenantCreditMemoTypeIdx: index('idx_cm_tenant_credit_memo_type').on(table.tenantId, table.creditMemoType),
  customerIdx: index('idx_cm_customer').on(table.customerId),
  supplierIdx: index('idx_cm_supplier').on(table.supplierId),
  originalInvoiceIdx: index('idx_cm_original_invoice').on(table.originalInvoiceId),
  creditMemoDateIdx: index('idx_cm_credit_memo_date').on(table.creditMemoDate),
  statusIdx: index('idx_cm_status').on(table.status),
}));

// Aging Buckets (for reporting)
export const agingBuckets = pgTable('aging_buckets', {
  ...baseSchema,
  
  // Bucket identification
  bucketName: varchar('bucket_name', { length: 50 }).notNull(),
  bucketType: varchar('bucket_type', { length: 20 }).notNull(), // 'receivable', 'payable'
  
  // Age ranges
  minDays: integer('min_days').notNull(),
  maxDays: integer('max_days'), // null for "over X days"
  
  // Display
  displayOrder: integer('display_order').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => ({
  tenantBucketTypeIdx: index('idx_ab_tenant_bucket_type').on(table.tenantId, table.bucketType),
  displayOrderIdx: index('idx_ab_display_order').on(table.displayOrder),
}));

// Multi-Currency Support Tables

// Currencies
export const currencies = pgTable('currencies', {
  ...baseSchema,
  
  // Currency identification
  currencyCode: varchar('currency_code', { length: 3 }).notNull(), // ISO 4217 code (USD, EUR, etc.)
  currencyName: varchar('currency_name', { length: 100 }).notNull(),
  currencySymbol: varchar('currency_symbol', { length: 10 }).notNull(),
  
  // Display formatting
  decimalPlaces: integer('decimal_places').default(2).notNull(),
  decimalSeparator: varchar('decimal_separator', { length: 1 }).default('.').notNull(),
  thousandsSeparator: varchar('thousands_separator', { length: 1 }).default(',').notNull(),
  symbolPosition: varchar('symbol_position', { length: 10 }).default('before').notNull(), // 'before', 'after'
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isBaseCurrency: boolean('is_base_currency').default(false).notNull(),
  
  // Metadata
  countryCode: varchar('country_code', { length: 3 }), // ISO 3166-1 alpha-3
  notes: text('notes'),
}, (table) => ({
  tenantCurrencyCodeIdx: index('idx_curr_tenant_currency_code').on(table.tenantId, table.currencyCode),
  tenantBaseCurrencyIdx: index('idx_curr_tenant_base_currency').on(table.tenantId, table.isBaseCurrency),
  currencyCodeIdx: index('idx_curr_currency_code').on(table.currencyCode),
}));

// Exchange Rates
export const exchangeRates = pgTable('exchange_rates', {
  ...baseSchema,
  
  // Currency pair
  fromCurrencyId: uuid('from_currency_id').notNull().references(() => currencies.id),
  toCurrencyId: uuid('to_currency_id').notNull().references(() => currencies.id),
  
  // Rate information
  exchangeRate: decimal('exchange_rate', { precision: 15, scale: 8 }).notNull(),
  inverseRate: decimal('inverse_rate', { precision: 15, scale: 8 }).notNull(),
  
  // Effective period
  effectiveDate: timestamp('effective_date').notNull(),
  expirationDate: timestamp('expiration_date'),
  
  // Rate source
  rateSource: varchar('rate_source', { length: 50 }).default('manual').notNull(), // 'manual', 'api', 'bank'
  rateProvider: varchar('rate_provider', { length: 100 }), // 'xe.com', 'fixer.io', etc.
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  
  // Metadata
  notes: text('notes'),
}, (table) => ({
  tenantCurrencyPairIdx: index('idx_er_tenant_currency_pair').on(table.tenantId, table.fromCurrencyId, table.toCurrencyId),
  effectiveDateIdx: index('idx_er_effective_date').on(table.effectiveDate),
  fromCurrencyIdx: index('idx_er_from_currency').on(table.fromCurrencyId),
  toCurrencyIdx: index('idx_er_to_currency').on(table.toCurrencyId),
}));

// Currency Conversion History (for audit trail)
export const currencyConversions = pgTable('currency_conversions', {
  ...baseSchema,
  
  // Source information
  sourceType: varchar('source_type', { length: 50 }).notNull(), // 'transaction', 'invoice', 'payment', etc.
  sourceId: uuid('source_id').notNull(),
  
  // Conversion details
  fromCurrencyId: uuid('from_currency_id').notNull().references(() => currencies.id),
  toCurrencyId: uuid('to_currency_id').notNull().references(() => currencies.id),
  
  // Amounts
  originalAmount: decimal('original_amount', { precision: 15, scale: 2 }).notNull(),
  convertedAmount: decimal('converted_amount', { precision: 15, scale: 2 }).notNull(),
  exchangeRate: decimal('exchange_rate', { precision: 15, scale: 8 }).notNull(),
  
  // Conversion metadata
  conversionDate: timestamp('conversion_date').defaultNow().notNull(),
  rateSource: varchar('rate_source', { length: 50 }),
  
  // GL Impact
  gainLossAmount: decimal('gain_loss_amount', { precision: 15, scale: 2 }).default('0.00'),
  gainLossAccountId: uuid('gain_loss_account_id').references(() => chartOfAccounts.id),
  
  // Metadata
  notes: text('notes'),
}, (table) => ({
  sourceIdx: index('idx_cc_source').on(table.sourceType, table.sourceId),
  conversionDateIdx: index('idx_cc_conversion_date').on(table.conversionDate),
  fromCurrencyIdx: index('idx_cc_from_currency').on(table.fromCurrencyId),
  toCurrencyIdx: index('idx_cc_to_currency').on(table.toCurrencyId),
}));

// Multi-Currency Account Balances
export const multiCurrencyAccountBalances = pgTable('multi_currency_account_balances', {
  ...baseSchema,
  
  // Relationships
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  currencyId: uuid('currency_id').notNull().references(() => currencies.id),
  
  // Balance information
  balanceDate: timestamp('balance_date').notNull(),
  
  // Amounts in original currency
  openingBalance: decimal('opening_balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  debitMovements: decimal('debit_movements', { precision: 15, scale: 2 }).default('0.00').notNull(),
  creditMovements: decimal('credit_movements', { precision: 15, scale: 2 }).default('0.00').notNull(),
  closingBalance: decimal('closing_balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  
  // Amounts in base currency
  openingBalanceBase: decimal('opening_balance_base', { precision: 15, scale: 2 }).default('0.00').notNull(),
  debitMovementsBase: decimal('debit_movements_base', { precision: 15, scale: 2 }).default('0.00').notNull(),
  creditMovementsBase: decimal('credit_movements_base', { precision: 15, scale: 2 }).default('0.00').notNull(),
  closingBalanceBase: decimal('closing_balance_base', { precision: 15, scale: 2 }).default('0.00').notNull(),
  
  // Exchange rate used for conversion
  exchangeRate: decimal('exchange_rate', { precision: 15, scale: 8 }).notNull(),
  
  // Period information
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalPeriod: integer('fiscal_period').notNull(),
  
  // Metadata
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
}, (table) => ({
  accountCurrencyBalanceDateIdx: index('idx_mcab_account_currency_balance_date').on(table.accountId, table.currencyId, table.balanceDate),
  tenantFiscalIdx: index('idx_mcab_tenant_fiscal').on(table.tenantId, table.fiscalYear, table.fiscalPeriod),
  currencyIdx: index('idx_mcab_currency').on(table.currencyId),
}));

// Currency Revaluation (for period-end adjustments)
export const currencyRevaluations = pgTable('currency_revaluations', {
  ...baseSchema,
  
  // Revaluation identification
  revaluationNumber: varchar('revaluation_number', { length: 50 }).notNull(),
  revaluationDate: timestamp('revaluation_date').notNull(),
  
  // Period information
  fiscalYear: integer('fiscal_year').notNull(),
  fiscalPeriod: integer('fiscal_period').notNull(),
  
  // Currency information
  currencyId: uuid('currency_id').notNull().references(() => currencies.id),
  
  // Revaluation rates
  oldExchangeRate: decimal('old_exchange_rate', { precision: 15, scale: 8 }).notNull(),
  newExchangeRate: decimal('new_exchange_rate', { precision: 15, scale: 8 }).notNull(),
  
  // Impact
  totalGainLoss: decimal('total_gain_loss', { precision: 15, scale: 2 }).notNull(),
  
  // GL Integration
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  
  // Status
  status: varchar('status', { length: 20 }).default('draft').notNull(), // 'draft', 'posted', 'reversed'
  
  // Processing
  processedBy: uuid('processed_by').references(() => users.id),
  processedAt: timestamp('processed_at'),
  
  // Metadata
  notes: text('notes'),
}, (table) => ({
  tenantRevaluationNumberIdx: index('idx_cr_tenant_revaluation_number').on(table.tenantId, table.revaluationNumber),
  revaluationDateIdx: index('idx_cr_revaluation_date').on(table.revaluationDate),
  currencyIdx: index('idx_cr_currency').on(table.currencyId),
  fiscalPeriodIdx: index('idx_cr_fiscal_period').on(table.fiscalYear, table.fiscalPeriod),
}));

// Currency Revaluation Details
export const currencyRevaluationDetails = pgTable('currency_revaluation_details', {
  ...baseSchema,
  
  // Relationships
  revaluationId: uuid('revaluation_id').notNull().references(() => currencyRevaluations.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  
  // Balance information
  originalCurrencyBalance: decimal('original_currency_balance', { precision: 15, scale: 2 }).notNull(),
  oldBaseCurrencyBalance: decimal('old_base_currency_balance', { precision: 15, scale: 2 }).notNull(),
  newBaseCurrencyBalance: decimal('new_base_currency_balance', { precision: 15, scale: 2 }).notNull(),
  
  // Gain/Loss
  gainLossAmount: decimal('gain_loss_amount', { precision: 15, scale: 2 }).notNull(),
  
  // GL Integration
  journalEntryLineId: uuid('journal_entry_line_id').references(() => journalEntryLines.id),
}, (table) => ({
  revaluationIdx: index('idx_crd_revaluation').on(table.revaluationId),
  accountIdx: index('idx_crd_account').on(table.accountId),
}));