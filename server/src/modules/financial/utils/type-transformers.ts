import { ChartOfAccount } from '../types/chart-of-accounts.types';
import { ChartOfAccountResponseDto, AccountHierarchyDto, NormalBalance } from '../dto/chart-of-accounts.dto';

/**
 * Transform ChartOfAccountResponseDto to ChartOfAccount
 * Handles type conversions and provides defaults for missing properties
 */
export function transformToChartOfAccount(dto: ChartOfAccountResponseDto): ChartOfAccount {
  const result: ChartOfAccount = {
    id: dto.id,
    tenantId: dto.tenantId,
    accountNumber: dto.accountNumber,
    accountName: dto.accountName,
    accountType: dto.accountType,
    accountSubType: dto.accountSubType,
    accountLevel: dto.accountLevel,
    accountPath: dto.accountPath || '',
    normalBalance: dto.normalBalance,
    isActive: dto.isActive,
    allowManualEntries: dto.allowManualEntries,
    requireDepartment: dto.requireDepartment,
    requireProject: dto.requireProject,
    isSystemAccount: dto.isSystemAccount,
    currentBalance: parseFloat(dto.currentBalance || '0'),
    settings: dto.settings || {},
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    version: dto.version || 1,
  };

  // Handle optional properties explicitly
  if (dto.parentAccountId !== undefined) {
    result.parentAccountId = dto.parentAccountId;
  }
  
  if (dto.description !== undefined) {
    result.description = dto.description;
  }
  
  if (dto.taxReportingCategory !== undefined) {
    result.taxReportingCategory = dto.taxReportingCategory;
  }
  
  if (dto.externalAccountId !== undefined) {
    result.externalAccountId = dto.externalAccountId;
  }
  
  if (dto.createdBy !== undefined) {
    result.createdBy = dto.createdBy;
  }
  
  if (dto.updatedBy !== undefined) {
    result.updatedBy = dto.updatedBy;
  }

  return result;
}

/**
 * Transform array of ChartOfAccountResponseDto to ChartOfAccount array
 */
export function transformToChartOfAccountArray(dtos: ChartOfAccountResponseDto[]): ChartOfAccount[] {
  return dtos.map(transformToChartOfAccount);
}

/**
 * Transform AccountHierarchyDto to ChartOfAccount
 * Flattens the hierarchy structure to match ChartOfAccount interface
 */
export function transformHierarchyToChartOfAccount(hierarchy: AccountHierarchyDto): ChartOfAccount {
  return transformToChartOfAccount(hierarchy.account);
}

/**
 * Transform array of AccountHierarchyDto to ChartOfAccount array
 */
export function transformHierarchyArrayToChartOfAccountArray(hierarchies: AccountHierarchyDto[]): ChartOfAccount[] {
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