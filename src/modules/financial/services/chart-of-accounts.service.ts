import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { ChartOfAccountsRepository } from '../repositories/chart-of-accounts.repository';
import { CreateChartOfAccountDto, UpdateChartOfAccountDto, AccountType, AccountSubType, NormalBalance } from '../dto/chart-of-accounts.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

@Injectable()
export class ChartOfAccountsService {
  constructor(
    private readonly chartOfAccountsRepository: ChartOfAccountsRepository,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  async createAccount(tenantId: string, dto: CreateChartOfAccountDto, userId: string) {
    // Validate account number uniqueness
    const isAccountNumberAvailable = await this.chartOfAccountsRepository.validateAccountNumber(
      tenantId,
      dto.accountNumber
    );

    if (!isAccountNumberAvailable) {
      throw new ConflictException(`Account number ${dto.accountNumber} already exists`);
    }

    // Validate parent account if provided
    if (dto.parentAccountId) {
      const parentAccount = await this.chartOfAccountsRepository.findById(tenantId, dto.parentAccountId);
      if (!parentAccount) {
        throw new BadRequestException('Parent account not found');
      }

      // Validate that parent account type is compatible
      if (!this.isCompatibleAccountType(dto.accountType, parentAccount.accountType)) {
        throw new BadRequestException('Account type is not compatible with parent account type');
      }
    }

    // Validate normal balance based on account type
    const expectedNormalBalance = this.getExpectedNormalBalance(dto.accountType);
    if (dto.normalBalance !== expectedNormalBalance) {
      throw new BadRequestException(
        `Account type ${dto.accountType} should have normal balance of ${expectedNormalBalance}`
      );
    }

    const account = await this.chartOfAccountsRepository.create(tenantId, dto, userId);

    // Clear cache
    await this.invalidateAccountCache(tenantId);

    return account;
  }

  async findAccountById(tenantId: string, id: string) {
    const cacheKey = `account:${tenantId}:${id}`;
    let account = await this.cacheService.get(cacheKey);

    if (!account) {
      account = await this.chartOfAccountsRepository.findById(tenantId, id);
      if (account) {
        await this.cacheService.set(cacheKey, account, { ttl: 300 }); // 5 minutes
      }
    }

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  async findAccountByNumber(tenantId: string, accountNumber: string) {
    const cacheKey = `account:${tenantId}:number:${accountNumber}`;
    let account = await this.cacheService.get(cacheKey);

    if (!account) {
      account = await this.chartOfAccountsRepository.findByAccountNumber(tenantId, accountNumber);
      if (account) {
        await this.cacheService.set(cacheKey, account, { ttl: 300 }); // 5 minutes
      }
    }

    return account;
  }

  async getAllAccounts(tenantId: string, options?: {
    accountType?: AccountType;
    isActive?: boolean;
    parentAccountId?: string;
    includeInactive?: boolean;
  }) {
    const cacheKey = `accounts:${tenantId}:${JSON.stringify(options || {})}`;
    let accounts = await this.cacheService.get(cacheKey);

    if (!accounts) {
      accounts = await this.chartOfAccountsRepository.findAll(tenantId, options);
      await this.cacheService.set(cacheKey, accounts, { ttl: 180 }); // 3 minutes
    }

    return accounts;
  }

  async getAccountHierarchy(tenantId: string, rootAccountId?: string) {
    const cacheKey = `account-hierarchy:${tenantId}:${rootAccountId || 'root'}`;
    let hierarchy = await this.cacheService.get(cacheKey);

    if (!hierarchy) {
      hierarchy = await this.chartOfAccountsRepository.findHierarchy(tenantId, rootAccountId);
      await this.cacheService.set(cacheKey, hierarchy, { ttl: 300 }); // 5 minutes
    }

    return hierarchy;
  }

  async updateAccount(tenantId: string, id: string, dto: UpdateChartOfAccountDto, userId: string) {
    const existingAccount = await this.findAccountById(tenantId, id);

    // Check if account is a system account
    if (existingAccount.isSystemAccount) {
      throw new BadRequestException('System accounts cannot be modified');
    }

    const updatedAccount = await this.chartOfAccountsRepository.update(tenantId, id, dto, userId);

    // Clear cache
    await this.invalidateAccountCache(tenantId);

    return updatedAccount;
  }

  async deleteAccount(tenantId: string, id: string, userId: string) {
    const account = await this.findAccountById(tenantId, id);

    // Check if account is a system account
    if (account.isSystemAccount) {
      throw new BadRequestException('System accounts cannot be deleted');
    }

    // Check if account has a balance
    if (parseFloat(account.currentBalance) !== 0) {
      throw new BadRequestException('Cannot delete account with non-zero balance');
    }

    const deletedAccount = await this.chartOfAccountsRepository.delete(tenantId, id, userId);

    // Clear cache
    await this.invalidateAccountCache(tenantId);

    return deletedAccount;
  }

  async getAccountsByType(tenantId: string, accountTypes: AccountType[]) {
    const cacheKey = `accounts-by-type:${tenantId}:${accountTypes.join(',')}`;
    let accounts = await this.cacheService.get(cacheKey);

    if (!accounts) {
      accounts = await this.chartOfAccountsRepository.getAccountsByType(tenantId, accountTypes);
      await this.cacheService.set(cacheKey, accounts, { ttl: 300 }); // 5 minutes
    }

    return accounts;
  }

  async searchAccounts(tenantId: string, searchTerm: string, limit = 20) {
    if (!searchTerm || searchTerm.length < 2) {
      throw new BadRequestException('Search term must be at least 2 characters');
    }

    return await this.chartOfAccountsRepository.searchAccounts(tenantId, searchTerm, limit);
  }

  async updateAccountBalance(tenantId: string, accountId: string, newBalance: string) {
    const updatedAccount = await this.chartOfAccountsRepository.updateBalance(tenantId, accountId, newBalance);

    // Clear cache for this account
    await this.cacheService.invalidatePattern(`account:${tenantId}:${accountId}*`);

    return updatedAccount;
  }

  async getAccountBalance(tenantId: string, accountId: string): Promise<string> {
    return await this.chartOfAccountsRepository.getAccountBalance(tenantId, accountId);
  }

  async initializeDefaultChartOfAccounts(tenantId: string, userId: string) {
    const defaultAccounts = this.getDefaultAccountStructure();

    const createdAccounts = [];
    
    // Create accounts in order (parents first)
    for (const accountData of defaultAccounts) {
      try {
        // Find parent account ID if parent account number is specified
        let parentAccountId: string | undefined;
        if (accountData.parentAccountNumber) {
          const parentAccount = await this.findAccountByNumber(tenantId, accountData.parentAccountNumber);
          parentAccountId = parentAccount?.id;
        }

        const account = await this.createAccount(tenantId, {
          accountNumber: accountData.accountNumber,
          accountName: accountData.accountName,
          accountType: accountData.accountType,
          accountSubType: accountData.accountSubType,
          normalBalance: accountData.normalBalance,
          parentAccountId,
          description: accountData.description,
          isActive: true,
          allowManualEntries: accountData.allowManualEntries ?? true,
        }, userId);

        createdAccounts.push(account);
      } catch (error) {
        // Log error but continue with other accounts
        console.error(`Failed to create account ${accountData.accountNumber}:`, error.message);
      }
    }

    return createdAccounts;
  }

  private async invalidateAccountCache(tenantId: string) {
    await Promise.all([
      this.cacheService.invalidatePattern(`account:${tenantId}:*`),
      this.cacheService.invalidatePattern(`accounts:${tenantId}:*`),
      this.cacheService.invalidatePattern(`account-hierarchy:${tenantId}:*`),
      this.cacheService.invalidatePattern(`accounts-by-type:${tenantId}:*`),
    ]);
  }

  private isCompatibleAccountType(childType: AccountType, parentType: AccountType): boolean {
    // Define compatible parent-child relationships
    const compatibilityMap: Record<AccountType, AccountType[]> = {
      [AccountType.ASSET]: [AccountType.ASSET],
      [AccountType.LIABILITY]: [AccountType.LIABILITY],
      [AccountType.EQUITY]: [AccountType.EQUITY],
      [AccountType.REVENUE]: [AccountType.REVENUE],
      [AccountType.EXPENSE]: [AccountType.EXPENSE],
      [AccountType.CONTRA_ASSET]: [AccountType.ASSET],
      [AccountType.CONTRA_LIABILITY]: [AccountType.LIABILITY],
      [AccountType.CONTRA_EQUITY]: [AccountType.EQUITY],
      [AccountType.CONTRA_REVENUE]: [AccountType.REVENUE],
    };

    return compatibilityMap[childType]?.includes(parentType) || false;
  }

  private getExpectedNormalBalance(accountType: AccountType): NormalBalance {
    const normalBalanceMap: Record<AccountType, NormalBalance> = {
      [AccountType.ASSET]: NormalBalance.DEBIT,
      [AccountType.EXPENSE]: NormalBalance.DEBIT,
      [AccountType.LIABILITY]: NormalBalance.CREDIT,
      [AccountType.EQUITY]: NormalBalance.CREDIT,
      [AccountType.REVENUE]: NormalBalance.CREDIT,
      [AccountType.CONTRA_ASSET]: NormalBalance.CREDIT,
      [AccountType.CONTRA_LIABILITY]: NormalBalance.DEBIT,
      [AccountType.CONTRA_EQUITY]: NormalBalance.DEBIT,
      [AccountType.CONTRA_REVENUE]: NormalBalance.DEBIT,
    };

    return normalBalanceMap[accountType];
  }

  private getDefaultAccountStructure() {
    return [
      // Assets
      { accountNumber: '1000', accountName: 'Assets', accountType: AccountType.ASSET, accountSubType: AccountSubType.CURRENT_ASSET, normalBalance: NormalBalance.DEBIT, description: 'Total Assets', allowManualEntries: false },
      { accountNumber: '1100', accountName: 'Current Assets', accountType: AccountType.ASSET, accountSubType: AccountSubType.CURRENT_ASSET, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '1000', allowManualEntries: false },
      { accountNumber: '1110', accountName: 'Cash and Cash Equivalents', accountType: AccountType.ASSET, accountSubType: AccountSubType.CASH, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '1100' },
      { accountNumber: '1120', accountName: 'Accounts Receivable', accountType: AccountType.ASSET, accountSubType: AccountSubType.ACCOUNTS_RECEIVABLE, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '1100' },
      { accountNumber: '1130', accountName: 'Inventory', accountType: AccountType.ASSET, accountSubType: AccountSubType.INVENTORY, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '1100' },
      { accountNumber: '1140', accountName: 'Prepaid Expenses', accountType: AccountType.ASSET, accountSubType: AccountSubType.PREPAID_EXPENSE, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '1100' },
      
      { accountNumber: '1200', accountName: 'Fixed Assets', accountType: AccountType.ASSET, accountSubType: AccountSubType.FIXED_ASSET, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '1000', allowManualEntries: false },
      { accountNumber: '1210', accountName: 'Equipment', accountType: AccountType.ASSET, accountSubType: AccountSubType.EQUIPMENT, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '1200' },
      { accountNumber: '1220', accountName: 'Accumulated Depreciation - Equipment', accountType: AccountType.CONTRA_ASSET, accountSubType: AccountSubType.ACCUMULATED_DEPRECIATION, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '1200' },

      // Liabilities
      { accountNumber: '2000', accountName: 'Liabilities', accountType: AccountType.LIABILITY, accountSubType: AccountSubType.CURRENT_LIABILITY, normalBalance: NormalBalance.CREDIT, description: 'Total Liabilities', allowManualEntries: false },
      { accountNumber: '2100', accountName: 'Current Liabilities', accountType: AccountType.LIABILITY, accountSubType: AccountSubType.CURRENT_LIABILITY, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '2000', allowManualEntries: false },
      { accountNumber: '2110', accountName: 'Accounts Payable', accountType: AccountType.LIABILITY, accountSubType: AccountSubType.ACCOUNTS_PAYABLE, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '2100' },
      { accountNumber: '2120', accountName: 'Accrued Expenses', accountType: AccountType.LIABILITY, accountSubType: AccountSubType.ACCRUED_EXPENSE, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '2100' },
      
      { accountNumber: '2200', accountName: 'Long-term Liabilities', accountType: AccountType.LIABILITY, accountSubType: AccountSubType.LONG_TERM_LIABILITY, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '2000', allowManualEntries: false },
      { accountNumber: '2210', accountName: 'Notes Payable', accountType: AccountType.LIABILITY, accountSubType: AccountSubType.NOTES_PAYABLE, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '2200' },

      // Equity
      { accountNumber: '3000', accountName: 'Equity', accountType: AccountType.EQUITY, accountSubType: AccountSubType.OWNERS_EQUITY, normalBalance: NormalBalance.CREDIT, description: 'Total Equity', allowManualEntries: false },
      { accountNumber: '3100', accountName: 'Owner\'s Equity', accountType: AccountType.EQUITY, accountSubType: AccountSubType.OWNERS_EQUITY, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '3000' },
      { accountNumber: '3200', accountName: 'Retained Earnings', accountType: AccountType.EQUITY, accountSubType: AccountSubType.RETAINED_EARNINGS, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '3000' },

      // Revenue
      { accountNumber: '4000', accountName: 'Revenue', accountType: AccountType.REVENUE, accountSubType: AccountSubType.SALES_REVENUE, normalBalance: NormalBalance.CREDIT, description: 'Total Revenue', allowManualEntries: false },
      { accountNumber: '4100', accountName: 'Sales Revenue', accountType: AccountType.REVENUE, accountSubType: AccountSubType.SALES_REVENUE, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '4000' },
      { accountNumber: '4200', accountName: 'Service Revenue', accountType: AccountType.REVENUE, accountSubType: AccountSubType.SERVICE_REVENUE, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '4000' },
      { accountNumber: '4900', accountName: 'Other Revenue', accountType: AccountType.REVENUE, accountSubType: AccountSubType.OTHER_REVENUE, normalBalance: NormalBalance.CREDIT, parentAccountNumber: '4000' },

      // Expenses
      { accountNumber: '5000', accountName: 'Cost of Goods Sold', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.COST_OF_GOODS_SOLD, normalBalance: NormalBalance.DEBIT, parentAccountNumber: null },
      
      { accountNumber: '6000', accountName: 'Operating Expenses', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, description: 'Total Operating Expenses', allowManualEntries: false },
      { accountNumber: '6100', accountName: 'Salaries and Wages', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '6000' },
      { accountNumber: '6200', accountName: 'Rent Expense', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '6000' },
      { accountNumber: '6300', accountName: 'Utilities Expense', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '6000' },
      { accountNumber: '6400', accountName: 'Marketing Expense', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.SELLING_EXPENSE, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '6000' },
      { accountNumber: '6500', accountName: 'Office Supplies', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.ADMINISTRATIVE_EXPENSE, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '6000' },
      { accountNumber: '6600', accountName: 'Depreciation Expense', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.DEPRECIATION_EXPENSE, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '6000' },
      
      { accountNumber: '7000', accountName: 'Other Expenses', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.OPERATING_EXPENSE, normalBalance: NormalBalance.DEBIT, description: 'Other Expenses', allowManualEntries: false },
      { accountNumber: '7100', accountName: 'Interest Expense', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.INTEREST_EXPENSE, normalBalance: NormalBalance.DEBIT, parentAccountNumber: '7000' },
    ];
  }
}