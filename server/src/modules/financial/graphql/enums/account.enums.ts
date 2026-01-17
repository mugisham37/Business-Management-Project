import { registerEnumType } from '@nestjs/graphql';

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
  CONTRA_ASSET = 'contra_asset',
  CONTRA_LIABILITY = 'contra_liability',
  CONTRA_EQUITY = 'contra_equity',
  CONTRA_REVENUE = 'contra_revenue',
}

export enum AccountSubType {
  // Assets
  CURRENT_ASSET = 'current_asset',
  FIXED_ASSET = 'fixed_asset',
  OTHER_ASSET = 'other_asset',
  CASH = 'cash',
  ACCOUNTS_RECEIVABLE = 'accounts_receivable',
  INVENTORY = 'inventory',
  PREPAID_EXPENSE = 'prepaid_expense',
  EQUIPMENT = 'equipment',
  ACCUMULATED_DEPRECIATION = 'accumulated_depreciation',
  
  // Liabilities
  CURRENT_LIABILITY = 'current_liability',
  LONG_TERM_LIABILITY = 'long_term_liability',
  ACCOUNTS_PAYABLE = 'accounts_payable',
  ACCRUED_EXPENSE = 'accrued_expense',
  NOTES_PAYABLE = 'notes_payable',
  MORTGAGE_PAYABLE = 'mortgage_payable',
  
  // Equity
  OWNERS_EQUITY = 'owners_equity',
  RETAINED_EARNINGS = 'retained_earnings',
  CAPITAL_STOCK = 'capital_stock',
  
  // Revenue
  SALES_REVENUE = 'sales_revenue',
  SERVICE_REVENUE = 'service_revenue',
  OTHER_REVENUE = 'other_revenue',
  SALES_RETURNS = 'sales_returns',
  SALES_DISCOUNTS = 'sales_discounts',
  
  // Expenses
  COST_OF_GOODS_SOLD = 'cost_of_goods_sold',
  OPERATING_EXPENSE = 'operating_expense',
  ADMINISTRATIVE_EXPENSE = 'administrative_expense',
  SELLING_EXPENSE = 'selling_expense',
  INTEREST_EXPENSE = 'interest_expense',
  DEPRECIATION_EXPENSE = 'depreciation_expense',
}

export enum NormalBalance {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

// Register enums with GraphQL
registerEnumType(AccountType, {
  name: 'AccountType',
  description: 'The type of account in the chart of accounts',
});

registerEnumType(AccountSubType, {
  name: 'AccountSubType',
  description: 'The sub-type of account for more specific categorization',
});

registerEnumType(NormalBalance, {
  name: 'NormalBalance',
  description: 'The normal balance side for the account (debit or credit)',
});