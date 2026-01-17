import { AccountType, AccountSubType, NormalBalance } from '../graphql/enums';

export interface ChartOfAccount {
  id: string;
  tenantId: string;
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  accountSubType: AccountSubType;
  parentAccountId?: string;
  accountLevel: number;
  accountPath: string;
  normalBalance: NormalBalance;
  description?: string;
  taxReportingCategory?: string;
  isActive: boolean;
  allowManualEntries: boolean;
  requireDepartment: boolean;
  requireProject: boolean;
  isSystemAccount: boolean;
  externalAccountId?: string;
  currentBalance: number;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
}

export interface ChartOfAccountWithBalance extends ChartOfAccount {
  currentBalance: number;
  debitBalance: number;
  creditBalance: number;
}

export interface AccountHierarchy extends ChartOfAccount {
  children?: AccountHierarchy[];
  level: number;
}