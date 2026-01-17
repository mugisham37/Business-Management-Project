import { ChartOfAccount } from '../types/chart-of-accounts.types';
import { ChartOfAccount as ChartOfAccountGQL, AccountHierarchy } from '../graphql/types';
import { NormalBalance } from '../graphql/enums';

/**
 * Transform ChartOfAccount to GraphQL ChartOfAccount
 * Handles type conversions and provides defaults for missing properties
 */
export function transformToChartOfAccount(account: ChartOfAccount): ChartOfAccountGQL {
  return {
    id: account.id,
    tenantId: account.tenantId,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    accountType: account.accountType,
    accountSubType: account.accountSubType,
    parentAccountId: account.parentAccountId,
    parentAccount: undefined, // Will be resolved by GraphQL field resolver
    childAccounts: [], // Will be resolved by GraphQL field resolver
    normalBalance: account.normalBalance,
    description: account.description,
    taxReportingCategory: account.taxReportingCategory,
    isActive: account.isActive,
    isSystemAccount: account.isSystemAccount,
    allowManualJournalEntries: account.allowManualEntries,
    requireDepartment: account.requireDepartment,
    requireProject: account.requireProject,
    requireCustomer: false, // Default value
    requireSupplier: false, // Default value
    currentBalance: account.currentBalance.toString(),
    beginningBalance: '0.00', // Default value
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    createdBy: account.createdBy || '',
    updatedBy: account.updatedBy,
  } as ChartOfAccountGQL;
}

/**
 * Transform array of ChartOfAccount to GraphQL ChartOfAccount array
 */
export function transformToChartOfAccountArray(accounts: ChartOfAccount[]): ChartOfAccountGQL[] {
  return accounts.map(transformToChartOfAccount);
}

/**
 * Transform AccountHierarchy to GraphQL ChartOfAccount
 * Flattens the hierarchy structure to match ChartOfAccount interface
 */
export function transformHierarchyToChartOfAccount(hierarchy: any): ChartOfAccountGQL {
  return transformToChartOfAccount(hierarchy.account);
}

/**
 * Transform array of AccountHierarchy to GraphQL ChartOfAccount array
 */
export function transformHierarchyArrayToChartOfAccountArray(hierarchies: any[]): ChartOfAccountGQL[] {
  return hierarchies.map(transformHierarchyToChartOfAccount);
}

/**
 * Safe enum comparison for NormalBalance
 */
export function isDebitAccount(normalBalance: NormalBalance): boolean {
  return normalBalance === NormalBalance.DEBIT;
}

/**
 * Safe enum comparison for NormalBalance
 */
export function isCreditAccount(normalBalance: NormalBalance): boolean {
  return normalBalance === NormalBalance.CREDIT;
}

/**
 * Type guard to check if an object has the required properties of ChartOfAccount
 */
export function isChartOfAccount(obj: any): obj is ChartOfAccount {
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.tenantId === 'string' &&
    typeof obj.accountNumber === 'string' &&
    typeof obj.accountName === 'string' &&
    typeof obj.currentBalance === 'number' &&
    typeof obj.version === 'number';
}

/**
 * Safe string to number conversion for balance amounts
 */
export function parseBalanceAmount(balance: string | number | undefined): number {
  if (typeof balance === 'number') {
    return balance;
  }
  if (typeof balance === 'string') {
    const parsed = parseFloat(balance);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}