import { Injectable } from '@nestjs/common';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { JournalEntryService } from './journal-entry.service';
import { AccountType, NormalBalance } from '../dto/chart-of-accounts.dto';
import { ChartOfAccount } from '../types/chart-of-accounts.types';
import { transformToChartOfAccountArray, isDebitAccount, parseBalanceAmount } from '../utils/type-transformers';

@Injectable()
export class AccountingService {
  constructor(
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly journalEntryService: JournalEntryService,
  ) {}

  async initializeTenantAccounting(tenantId: string, userId: string) {
    // Initialize default chart of accounts
    const accountDtos = await this.chartOfAccountsService.initializeDefaultChartOfAccounts(tenantId, userId);
    const accounts = transformToChartOfAccountArray(accountDtos);

    return {
      message: 'Accounting system initialized successfully',
      accountsCreated: accounts.length,
      accounts: accounts.map((account: ChartOfAccount) => ({
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
      })),
    };
  }

  async getTrialBalance(tenantId: string, asOfDate?: Date) {
    const accountDtos = await this.chartOfAccountsService.getAllAccounts(tenantId, {
      includeInactive: false,
    });
    const allAccounts = transformToChartOfAccountArray(accountDtos);

    const trialBalance = (allAccounts || []).map((account: ChartOfAccount) => {
      const balance = parseBalanceAmount(account.currentBalance);
      const isDebit = isDebitAccount(account.normalBalance);

      return {
        accountId: account.id,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
        debitBalance: isDebit && balance > 0 ? balance.toFixed(2) : '0.00',
        creditBalance: !isDebit && balance > 0 ? balance.toFixed(2) : '0.00',
        balance: balance.toFixed(2),
      };
    });

    // Calculate totals
    const totalDebits = trialBalance.reduce((sum, account) => sum + parseFloat(account.debitBalance || '0'), 0);
    const totalCredits = trialBalance.reduce((sum, account) => sum + parseFloat(account.creditBalance || '0'), 0);

    return {
      asOfDate: asOfDate || new Date(),
      accounts: trialBalance,
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
  }

  async getAccountBalances(tenantId: string, accountType?: AccountType, asOfDate?: Date) {
    const options = accountType ? { accountType } : undefined;
    const accountDtos = await this.chartOfAccountsService.getAllAccounts(tenantId, options);
    const accounts = transformToChartOfAccountArray(accountDtos);

    return (accounts || []).map((account: ChartOfAccount) => ({
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      accountType: account.accountType,
      accountSubType: account.accountSubType,
      currentBalance: account.currentBalance,
      normalBalance: account.normalBalance,
    }));
  }

  async postTransactionToAccounting(
    tenantId: string,
    transactionData: {
      transactionId: string;
      description: string;
      amount: number;
      customerId?: string;
      locationId?: string;
      items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
      taxes: Array<{
        taxType: string;
        rate: number;
        amount: number;
      }>;
      paymentMethod: string;
    },
    userId: string
  ) {
    // Get relevant accounts
    const accountDtos = await this.chartOfAccountsService.getAllAccounts(tenantId);
    const accounts = transformToChartOfAccountArray(accountDtos);
    const accountMap = new Map((accounts || []).map((acc: ChartOfAccount) => [acc.accountNumber, acc]));

    // Find required accounts
    const cashAccount = accountMap.get('1110') as ChartOfAccount; // Cash and Cash Equivalents
    const salesRevenueAccount = accountMap.get('4100') as ChartOfAccount; // Sales Revenue
    const cogsAccount = accountMap.get('5000') as ChartOfAccount; // Cost of Goods Sold
    const inventoryAccount = accountMap.get('1130') as ChartOfAccount; // Inventory
    const salesTaxAccount = accountMap.get('2120') as ChartOfAccount; // Accrued Expenses (for sales tax)

    if (!cashAccount || !salesRevenueAccount || !cogsAccount || !inventoryAccount) {
      throw new Error('Required accounts not found. Please initialize chart of accounts.');
    }

    const journalLines = [];
    let lineNumber = 1;

    // Calculate totals
    const subtotal = transactionData.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalTax = transactionData.taxes.reduce((sum, tax) => sum + tax.amount, 0);
    const totalAmount = subtotal + totalTax;

    // Debit Cash (or appropriate payment account)
    journalLines.push({
      accountId: cashAccount.id,
      description: `Payment received - ${transactionData.paymentMethod}`,
      debitAmount: totalAmount.toFixed(2),
      creditAmount: '0.00',
      customerId: transactionData.customerId,
      locationId: transactionData.locationId,
    });

    // Credit Sales Revenue
    journalLines.push({
      accountId: salesRevenueAccount.id,
      description: 'Sales revenue',
      debitAmount: '0.00',
      creditAmount: subtotal.toFixed(2),
      customerId: transactionData.customerId,
      locationId: transactionData.locationId,
    });

    // Credit Sales Tax (if applicable)
    if (totalTax > 0 && salesTaxAccount) {
      journalLines.push({
        accountId: salesTaxAccount.id,
        description: 'Sales tax collected',
        debitAmount: '0.00',
        creditAmount: totalTax.toFixed(2),
        customerId: transactionData.customerId,
        locationId: transactionData.locationId,
      });
    }

    // For each item, record COGS and reduce inventory
    for (const item of transactionData.items) {
      // This would typically require looking up the cost of the item
      // For now, we'll use a simplified approach
      const estimatedCost = item.totalPrice * 0.6; // Assume 40% margin

      // Debit COGS
      journalLines.push({
        accountId: cogsAccount.id,
        description: `COGS for product ${item.productId}`,
        debitAmount: estimatedCost.toFixed(2),
        creditAmount: '0.00',
        locationId: transactionData.locationId,
      });

      // Credit Inventory
      journalLines.push({
        accountId: inventoryAccount.id,
        description: `Inventory reduction for product ${item.productId}`,
        debitAmount: '0.00',
        creditAmount: estimatedCost.toFixed(2),
        locationId: transactionData.locationId,
      });
    }

    // Create the journal entry
    const journalEntry = await this.journalEntryService.createAutomaticJournalEntry(
      tenantId,
      `Sales transaction ${transactionData.transactionId}`,
      'pos_transaction',
      transactionData.transactionId,
      journalLines.map(line => {
        const journalLine: any = { ...line };
        if (line.locationId) journalLine.locationId = line.locationId;
        if (line.customerId) journalLine.customerId = line.customerId;
        return journalLine;
      }),
      userId,
      true // Auto-post
    );

    return journalEntry;
  }

  async getFinancialSummary(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    const accountDtos = await this.chartOfAccountsService.getAllAccounts(tenantId);
    const accounts = transformToChartOfAccountArray(accountDtos);
    
    // Group accounts by type
    const accountsByType = (accounts || []).reduce((acc, account) => {
      if (!account) return acc;
      const accountType = account.accountType;
      if (!acc[accountType]) {
        acc[accountType] = [];
      }
      acc[accountType]!.push(account);
      return acc;
    }, {} as Record<string, ChartOfAccount[]>);

    // Calculate totals by type
    const summary = {
      assets: this.calculateTypeTotal(accountsByType[AccountType.ASSET] || []),
      liabilities: this.calculateTypeTotal(accountsByType[AccountType.LIABILITY] || []),
      equity: this.calculateTypeTotal(accountsByType[AccountType.EQUITY] || []),
      revenue: this.calculateTypeTotal(accountsByType[AccountType.REVENUE] || []),
      expenses: this.calculateTypeTotal(accountsByType[AccountType.EXPENSE] || []),
    };

    // Calculate key metrics
    const netIncome = summary.revenue - summary.expenses;
    const totalEquity = summary.equity + netIncome;

    return {
      period: {
        from: dateFrom,
        to: dateTo,
      },
      balanceSheet: {
        assets: summary.assets,
        liabilities: summary.liabilities,
        equity: totalEquity,
        totalLiabilitiesAndEquity: summary.liabilities + totalEquity,
        isBalanced: Math.abs(summary.assets - (summary.liabilities + totalEquity)) < 0.01,
      },
      incomeStatement: {
        revenue: summary.revenue,
        expenses: summary.expenses,
        netIncome,
      },
      keyMetrics: {
        workingCapital: this.calculateWorkingCapital(accountsByType),
        debtToEquityRatio: summary.equity > 0 ? (summary.liabilities / summary.equity) : 0,
        profitMargin: summary.revenue > 0 ? (netIncome / summary.revenue) * 100 : 0,
      },
    };
  }

  private calculateTypeTotal(accounts: ChartOfAccount[]): number {
    return accounts.reduce((sum, account) => {
      const balance = parseBalanceAmount(account.currentBalance);
      return sum + (balance > 0 ? balance : 0);
    }, 0);
  }

  private calculateWorkingCapital(accountsByType: Record<string, ChartOfAccount[]>): number {
    const currentAssets = (accountsByType[AccountType.ASSET] || [])
      .filter(acc => acc.accountSubType.toString().includes('current'))
      .reduce((sum, acc) => sum + parseBalanceAmount(acc.currentBalance), 0);

    const currentLiabilities = (accountsByType[AccountType.LIABILITY] || [])
      .filter(acc => acc.accountSubType.toString().includes('current'))
      .reduce((sum, acc) => sum + parseBalanceAmount(acc.currentBalance), 0);

    return currentAssets - currentLiabilities;
  }

  async validateAccountingIntegrity(tenantId: string) {
    const trialBalance = await this.getTrialBalance(tenantId);
    const summary = await this.getFinancialSummary(tenantId);

    const issues = [];

    // Check if trial balance is balanced
    if (!trialBalance.isBalanced) {
      issues.push({
        type: 'trial_balance_imbalance',
        message: 'Trial balance does not balance',
        details: {
          totalDebits: trialBalance.totalDebits,
          totalCredits: trialBalance.totalCredits,
          difference: (parseFloat(trialBalance.totalDebits || '0') - parseFloat(trialBalance.totalCredits || '0')).toFixed(2),
        },
      });
    }

    // Check if balance sheet balances
    if (!summary.balanceSheet.isBalanced) {
      issues.push({
        type: 'balance_sheet_imbalance',
        message: 'Balance sheet does not balance',
        details: {
          assets: summary.balanceSheet.assets,
          liabilitiesAndEquity: summary.balanceSheet.totalLiabilitiesAndEquity,
          difference: (parseFloat(summary.balanceSheet.assets.toString()) - parseFloat(summary.balanceSheet.totalLiabilitiesAndEquity.toString())).toFixed(2),
        },
      });
    }

    // Check for accounts with negative balances that shouldn't have them
    const accountDtos = await this.chartOfAccountsService.getAllAccounts(tenantId);
    const accounts = transformToChartOfAccountArray(accountDtos);
    for (const account of accounts) {
      const balance = parseBalanceAmount(account.currentBalance);
      if (balance < 0) {
        const shouldBePositive = (
          (isDebitAccount(account.normalBalance) && [AccountType.ASSET, AccountType.EXPENSE].includes(account.accountType)) ||
          (!isDebitAccount(account.normalBalance) && [AccountType.LIABILITY, AccountType.EQUITY, AccountType.REVENUE].includes(account.accountType))
        );

        if (shouldBePositive) {
          issues.push({
            type: 'negative_balance',
            message: `Account ${account.accountName} has unexpected negative balance`,
            details: {
              accountNumber: account.accountNumber,
              accountName: account.accountName,
              balance: account.currentBalance.toString(),
              normalBalance: account.normalBalance,
            },
          });
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      summary: {
        totalAccounts: accounts.length,
        trialBalanceTotal: trialBalance.totalDebits,
        lastChecked: new Date(),
      },
    };
  }
}