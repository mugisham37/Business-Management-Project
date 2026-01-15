import { IsString, IsEnum, IsOptional, IsBoolean, IsUUID, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class CreateChartOfAccountDto {
  @ApiProperty({ description: 'Account number (unique within tenant)' })
  @IsString()
  @Length(1, 20)
  accountNumber!: string;

  @ApiProperty({ description: 'Account name' })
  @IsString()
  @Length(1, 255)
  accountName!: string;

  @ApiProperty({ enum: AccountType, description: 'Account type' })
  @IsEnum(AccountType)
  accountType!: AccountType;

  @ApiProperty({ enum: AccountSubType, description: 'Account sub-type' })
  @IsEnum(AccountSubType)
  accountSubType!: AccountSubType;

  @ApiPropertyOptional({ description: 'Parent account ID for hierarchical structure' })
  @IsOptional()
  @IsUUID()
  parentAccountId?: string;

  @ApiProperty({ enum: NormalBalance, description: 'Normal balance (debit or credit)' })
  @IsEnum(NormalBalance)
  normalBalance!: NormalBalance;

  @ApiPropertyOptional({ description: 'Account description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Tax reporting category' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  taxReportingCategory?: string;

  @ApiPropertyOptional({ description: 'Whether account is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether to allow manual journal entries', default: true })
  @IsOptional()
  @IsBoolean()
  allowManualEntries?: boolean;

  @ApiPropertyOptional({ description: 'Whether department is required for entries', default: false })
  @IsOptional()
  @IsBoolean()
  requireDepartment?: boolean;

  @ApiPropertyOptional({ description: 'Whether project is required for entries', default: false })
  @IsOptional()
  @IsBoolean()
  requireProject?: boolean;

  @ApiPropertyOptional({ description: 'External account ID for integrations' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  externalAccountId?: string;

  @ApiPropertyOptional({ description: 'Additional account settings' })
  @IsOptional()
  settings?: Record<string, any>;
}

export class UpdateChartOfAccountDto {
  @ApiPropertyOptional({ description: 'Account name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  accountName?: string;

  @ApiPropertyOptional({ description: 'Account description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Tax reporting category' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  taxReportingCategory?: string;

  @ApiPropertyOptional({ description: 'Whether account is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether to allow manual journal entries' })
  @IsOptional()
  @IsBoolean()
  allowManualEntries?: boolean;

  @ApiPropertyOptional({ description: 'Whether department is required for entries' })
  @IsOptional()
  @IsBoolean()
  requireDepartment?: boolean;

  @ApiPropertyOptional({ description: 'Whether project is required for entries' })
  @IsOptional()
  @IsBoolean()
  requireProject?: boolean;

  @ApiPropertyOptional({ description: 'External account ID for integrations' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  externalAccountId?: string;

  @ApiPropertyOptional({ description: 'Additional account settings' })
  @IsOptional()
  settings?: Record<string, any>;
}

export class ChartOfAccountResponseDto {
  @ApiProperty({ description: 'Account ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Account number' })
  accountNumber!: string;

  @ApiProperty({ description: 'Account name' })
  accountName!: string;

  @ApiProperty({ enum: AccountType, description: 'Account type' })
  accountType!: AccountType;

  @ApiProperty({ enum: AccountSubType, description: 'Account sub-type' })
  accountSubType!: AccountSubType;

  @ApiPropertyOptional({ description: 'Parent account ID' })
  parentAccountId?: string;

  @ApiProperty({ description: 'Account level in hierarchy' })
  accountLevel!: number;

  @ApiPropertyOptional({ description: 'Account path for hierarchical queries' })
  accountPath?: string;

  @ApiProperty({ description: 'Whether account is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Whether this is a system account' })
  isSystemAccount!: boolean;

  @ApiProperty({ description: 'Whether manual entries are allowed' })
  allowManualEntries!: boolean;

  @ApiProperty({ description: 'Whether department is required' })
  requireDepartment!: boolean;

  @ApiProperty({ description: 'Whether project is required' })
  requireProject!: boolean;

  @ApiProperty({ description: 'Current account balance' })
  currentBalance!: string;

  @ApiProperty({ enum: NormalBalance, description: 'Normal balance' })
  normalBalance!: NormalBalance;

  @ApiPropertyOptional({ description: 'Account description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Tax reporting category' })
  taxReportingCategory?: string;

  @ApiPropertyOptional({ description: 'External account ID' })
  externalAccountId?: string;

  @ApiPropertyOptional({ description: 'Account settings' })
  settings?: Record<string, any>;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Version for optimistic locking' })
  version!: number;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  updatedBy?: string;

  @ApiPropertyOptional({ description: 'Child accounts' })
  children?: ChartOfAccountResponseDto[];
}

export class AccountBalanceDto {
  @ApiProperty({ description: 'Account ID' })
  accountId!: string;

  @ApiProperty({ description: 'Balance date' })
  balanceDate!: Date;

  @ApiProperty({ description: 'Opening balance' })
  openingBalance!: string;

  @ApiProperty({ description: 'Debit movements' })
  debitMovements!: string;

  @ApiProperty({ description: 'Credit movements' })
  creditMovements!: string;

  @ApiProperty({ description: 'Closing balance' })
  closingBalance!: string;

  @ApiProperty({ description: 'Fiscal year' })
  fiscalYear!: number;

  @ApiProperty({ description: 'Fiscal period' })
  fiscalPeriod!: number;
}

export class AccountHierarchyDto {
  @ApiProperty({ description: 'Account details' })
  @ValidateNested()
  @Type(() => ChartOfAccountResponseDto)
  account!: ChartOfAccountResponseDto;

  @ApiProperty({ description: 'Child accounts', type: [AccountHierarchyDto] })
  @ValidateNested({ each: true })
  @Type(() => AccountHierarchyDto)
  children!: AccountHierarchyDto[];

  @ApiProperty({ description: 'Total balance including children' })
  totalBalance!: string;
}