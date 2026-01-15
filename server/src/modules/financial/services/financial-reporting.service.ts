import { Injectable } from '@nestjs/common';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { JournalEntryService } from './journal-entry.service';
import { AccountType, AccountSubType } from '../dto/chart-of-accounts.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

interface ChartOfAccountsEntity {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  accountSubType: AccountSubType;
  normalBalance: 'debit' | 'credit';
  currentBalance: string;
  isActive: boolean;
}

export interface FinancialReport {
  reportType: string;
  reportDate: Date;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  data: any;
  metadata: {
    generatedAt: Date;
    generatedBy: string;
    tenantId: string;
  };
}

export interface BalanceSheetData {
  assets: {
    currentAssets: BalanceSheetSection;
    fixedAssets: BalanceSheetSection;
    otherAssets: BalanceSheetSection;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: BalanceSheetSection;
    longTermLiabilities: BalanceSheetSection;
    totalLiabilities: number;
  };
  equity: {
    ownersEquity: BalanceSheetSection;
    retainedEarnings: number;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface IncomeStatementData {
  revenue: {
    salesRevenue: IncomeStatementSection;
    serviceRevenue: IncomeStatementSection;
    otherRevenue: IncomeStatementSection;
    totalRevenue: number;
  };
  costOfGoodsSold: {
    totalCOGS: number;
    grossProfit: number;
    grossProfitMargin: number;
  };
  operatingExpenses: {
    sellingExpenses: IncomeStatementSection;
    administrativeExpenses: IncomeStatementSection;
    operatingExpenses: IncomeStatementSection;
    totalOperatingExpenses: number;
  };
  otherExpenses: {
    interestExpense: number;
    otherExpenses: number;
    totalOtherExpenses: number;
  };
  netIncome: number;
  netProfitMargin: number;
}

export interface CashFlowData {
  operatingActivities: {
    netIncome: number;
    adjustments: CashFlowAdjustment[];
    workingCapitalChanges: CashFlowAdjustment[];
    netCashFromOperating: number;
  };
  investingActivities: {
    activities: CashFlowAdjustment[];
    netCashFromInvesting: number;
  };
  financingActivities: {
    activities: CashFlowAdjustment[];
    netCashFromFinancing: number;
  };
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
}

interface BalanceSheetSection {
  accounts: Array<{
    accountId: string;
    accountNumber: string;
    accountName: string;
    balance: number;
  }>;
  total: number;
}

interface IncomeStatementSection {
  accounts: Array<{
    accountId: string;
    accountNumber: string;
    accountName: string;
    amount: number;
  }>;
  total: number;
}

interface CashFlowAdjustment {
  description: string;
  amount: number;
  type: 'addition' | 'subtraction';
}

@Injectable()
export class FinancialReportingService {
  constructor(
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly journalEntryService: JournalEntryService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  async generateBalanceSheet(
    tenantId: string,
    asOfDate: Date,
    userId: string,
  ): Promise<FinancialReport> {
    const cacheKey = `balance-sheet:${tenantId}:${asOfDate.toISOString()}`;
    let balanceSheetData = await this.cacheService.get<BalanceSheetData>(cacheKey);

    if (!balanceSheetData) {
      balanceSheetData = await this.calculateBalanceSheet(tenantId, asOfDate);
      await this.cacheService.set(cacheKey, balanceSheetData, { ttl: 1800 }); // 30 minutes
    }

    return {
      reportType: 'balance_sheet',
      reportDate: asOfDate,
      periodStart: asOfDate,
      periodEnd: asOfDate,
      currency: 'USD', // This could be configurable per tenant
      data: balanceSheetData,
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        tenantId,
      },
    };
  }

  async generateIncomeStatement(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    userId: string,
  ): Promise<FinancialReport> {
    const cacheKey = `income-statement:${tenantId}:${periodStart.toISOString()}:${periodEnd.toISOString()}`;
    let incomeStatementData = await this.cacheService.get<IncomeStatementData>(cacheKey);

    if (!incomeStatementData) {
      incomeStatementData = await this.calculateIncomeStatement(tenantId, periodStart, periodEnd);
      await this.cacheService.set(cacheKey, incomeStatementData, { ttl: 1800 }); // 30 minutes
    }

    return {
      reportType: 'income_statement',
      reportDate: periodEnd,
      periodStart,
      periodEnd,
      currency: 'USD',
      data: incomeStatementData,
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        tenantId,
      },
    };
  }

  async generateCashFlowStatement(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    userId: string,
  ): Promise<FinancialReport> {
    const cacheKey = `cash-flow:${tenantId}:${periodStart.toISOString()}:${periodEnd.toISOString()}`;
    let cashFlowData = await this.cacheService.get<CashFlowData>(cacheKey);

    if (!cashFlowData) {
      cashFlowData = await this.calculateCashFlow(tenantId, periodStart, periodEnd);
      await this.cacheService.set(cacheKey, cashFlowData, { ttl: 1800 }); // 30 minutes
    }

    return {
      reportType: 'cash_flow_statement',
      reportDate: periodEnd,
      periodStart,
      periodEnd,
      currency: 'USD',
      data: cashFlowData,
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        tenantId,
      },
    };
  }

  async generateTrialBalance(
    tenantId: string,
    asOfDate: Date,
    userId: string,
  ): Promise<FinancialReport> {
    const accounts = await this.chartOfAccountsService.getAllAccounts(tenantId, {
      includeInactive: false,
    }) as ChartOfAccountsEntity[];

    const trialBalanceData = accounts.map((account: ChartOfAccountsEntity) => {
      const balance = parseFloat(account.currentBalance);
      const isDebitAccount = account.normalBalance === 'debit';

      return {
        accountId: account.id,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
        debitBalance: isDebitAccount && balance > 0 ? balance : 0,
        creditBalance: !isDebitAccount && balance > 0 ? balance : 0,
        balance,
      };
    });

    const totalDebits = trialBalanceData.reduce((sum: number, account) => sum + account.debitBalance, 0);
    const totalCredits = trialBalanceData.reduce((sum: number, account) => sum + account.creditBalance, 0);

    return {
      reportType: 'trial_balance',
      reportDate: asOfDate,
      periodStart: asOfDate,
      periodEnd: asOfDate,
      currency: 'USD',
      data: {
        accounts: trialBalanceData,
        totalDebits,
        totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        tenantId,
      },
    };
  }

  async generateGeneralLedger(
    tenantId: string,
    accountId: string,
    periodStart: Date,
    periodEnd: Date,
    userId: string,
  ): Promise<FinancialReport> {
    const account = await this.chartOfAccountsService.findAccountById(tenantId, accountId);
    const ledgerEntries = await this.journalEntryService.getAccountLedger(tenantId, accountId, {
      dateFrom: periodStart,
      dateTo: periodEnd,
      includeUnposted: false,
    });

    return {
      reportType: 'general_ledger',
      reportDate: periodEnd,
      periodStart,
      periodEnd,
      currency: 'USD',
      data: {
        account: {
          id: (account as any).id,
          number: (account as any).accountNumber,
          name: (account as any).accountName,
          type: (account as any).accountType,
          normalBalance: (account as any).normalBalance,
        },
        entries: ledgerEntries,
        summary: {
          totalEntries: ledgerEntries.length,
          totalDebits: ledgerEntries.reduce((sum: number, entry: any) => sum + parseFloat(entry.debitAmount), 0),
          totalCredits: ledgerEntries.reduce((sum: number, entry: any) => sum + parseFloat(entry.creditAmount), 0),
          endingBalance: ledgerEntries.length > 0 ? parseFloat(ledgerEntries[ledgerEntries.length - 1]?.runningBalance || '0') : 0,
        },
      },
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        tenantId,
      },
    };
  }

  async generateFinancialRatios(
    tenantId: string,
    asOfDate: Date,
    userId: string,
  ): Promise<FinancialReport> {
    const balanceSheet = await this.generateBalanceSheet(tenantId, asOfDate, userId);
    const yearStart = new Date(asOfDate.getFullYear(), 0, 1);
    const incomeStatement = await this.generateIncomeStatement(tenantId, yearStart, asOfDate, userId);

    const bsData = balanceSheet.data as BalanceSheetData;
    const isData = incomeStatement.data as IncomeStatementData;

    const ratios = {
      liquidity: {
        currentRatio: bsData.liabilities.currentLiabilities.total > 0 
          ? bsData.assets.currentAssets.total / bsData.liabilities.currentLiabilities.total 
          : 0,
        quickRatio: 0, // Would need to calculate quick assets
        workingCapital: bsData.assets.currentAssets.total - bsData.liabilities.currentLiabilities.total,
      },
      profitability: {
        grossProfitMargin: isData.costOfGoodsSold.grossProfitMargin,
        netProfitMargin: isData.netProfitMargin,
        returnOnAssets: bsData.assets.totalAssets > 0 ? (isData.netIncome / bsData.assets.totalAssets) * 100 : 0,
        returnOnEquity: bsData.equity.totalEquity > 0 ? (isData.netIncome / bsData.equity.totalEquity) * 100 : 0,
      },
      leverage: {
        debtToEquityRatio: bsData.equity.totalEquity > 0 ? bsData.liabilities.totalLiabilities / bsData.equity.totalEquity : 0,
        debtToAssetsRatio: bsData.assets.totalAssets > 0 ? bsData.liabilities.totalLiabilities / bsData.assets.totalAssets : 0,
        equityRatio: bsData.assets.totalAssets > 0 ? bsData.equity.totalEquity / bsData.assets.totalAssets : 0,
      },
      efficiency: {
        assetTurnover: bsData.assets.totalAssets > 0 ? isData.revenue.totalRevenue / bsData.assets.totalAssets : 0,
        // Additional efficiency ratios would require more detailed data
      },
    };

    return {
      reportType: 'financial_ratios',
      reportDate: asOfDate,
      periodStart: yearStart,
      periodEnd: asOfDate,
      currency: 'USD',
      data: ratios,
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        tenantId,
      },
    };
  }

  private async calculateBalanceSheet(tenantId: string, asOfDate: Date): Promise<BalanceSheetData> {
    const accounts = await this.chartOfAccountsService.getAllAccounts(tenantId, {
      includeInactive: false,
    }) as ChartOfAccountsEntity[];

    // Group accounts by type and subtype
    const assetAccounts = accounts.filter((acc: ChartOfAccountsEntity) => acc.accountType === AccountType.ASSET);
    const liabilityAccounts = accounts.filter((acc: ChartOfAccountsEntity) => acc.accountType === AccountType.LIABILITY);
    const equityAccounts = accounts.filter((acc: ChartOfAccountsEntity) => acc.accountType === AccountType.EQUITY);

    // Calculate asset sections
    const currentAssets = this.calculateSection(
      assetAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.CURRENT_ASSET || 
                                  acc.accountSubType === AccountSubType.CASH ||
                                  acc.accountSubType === AccountSubType.ACCOUNTS_RECEIVABLE ||
                                  acc.accountSubType === AccountSubType.INVENTORY ||
                                  acc.accountSubType === AccountSubType.PREPAID_EXPENSE)
    );

    const fixedAssets = this.calculateSection(
      assetAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.FIXED_ASSET ||
                                  acc.accountSubType === AccountSubType.EQUIPMENT)
    );

    const otherAssets = this.calculateSection(
      assetAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.OTHER_ASSET)
    );

    // Calculate liability sections
    const currentLiabilities = this.calculateSection(
      liabilityAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.CURRENT_LIABILITY ||
                                      acc.accountSubType === AccountSubType.ACCOUNTS_PAYABLE ||
                                      acc.accountSubType === AccountSubType.ACCRUED_EXPENSE)
    );

    const longTermLiabilities = this.calculateSection(
      liabilityAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.LONG_TERM_LIABILITY ||
                                      acc.accountSubType === AccountSubType.NOTES_PAYABLE ||
                                      acc.accountSubType === AccountSubType.MORTGAGE_PAYABLE)
    );

    // Calculate equity sections
    const ownersEquity = this.calculateSection(equityAccounts);

    // Calculate totals
    const totalAssets = currentAssets.total + fixedAssets.total + otherAssets.total;
    const totalLiabilities = currentLiabilities.total + longTermLiabilities.total;
    const retainedEarnings = 0; // This would be calculated from income statement
    const totalEquity = ownersEquity.total + retainedEarnings;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      assets: {
        currentAssets,
        fixedAssets,
        otherAssets,
        totalAssets,
      },
      liabilities: {
        currentLiabilities,
        longTermLiabilities,
        totalLiabilities,
      },
      equity: {
        ownersEquity,
        retainedEarnings,
        totalEquity,
      },
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    };
  }

  private async calculateIncomeStatement(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<IncomeStatementData> {
    const accounts = await this.chartOfAccountsService.getAllAccounts(tenantId, {
      includeInactive: false,
    }) as ChartOfAccountsEntity[];

    // Get revenue accounts
    const revenueAccounts = accounts.filter((acc: ChartOfAccountsEntity) => acc.accountType === AccountType.REVENUE);
    const expenseAccounts = accounts.filter((acc: ChartOfAccountsEntity) => acc.accountType === AccountType.EXPENSE);

    // Calculate revenue sections
    const salesRevenue = this.calculateIncomeSection(
      revenueAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.SALES_REVENUE)
    );

    const serviceRevenue = this.calculateIncomeSection(
      revenueAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.SERVICE_REVENUE)
    );

    const otherRevenue = this.calculateIncomeSection(
      revenueAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.OTHER_REVENUE)
    );

    const totalRevenue = salesRevenue.total + serviceRevenue.total + otherRevenue.total;

    // Calculate COGS
    const cogsAccounts = expenseAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.COST_OF_GOODS_SOLD);
    const totalCOGS = cogsAccounts.reduce((sum: number, acc: ChartOfAccountsEntity) => sum + parseFloat(acc.currentBalance), 0);
    const grossProfit = totalRevenue - totalCOGS;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Calculate expense sections
    const sellingExpenses = this.calculateIncomeSection(
      expenseAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.SELLING_EXPENSE)
    );

    const administrativeExpenses = this.calculateIncomeSection(
      expenseAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.ADMINISTRATIVE_EXPENSE)
    );

    const operatingExpenses = this.calculateIncomeSection(
      expenseAccounts.filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.OPERATING_EXPENSE)
    );

    const totalOperatingExpenses = sellingExpenses.total + administrativeExpenses.total + operatingExpenses.total;

    // Calculate other expenses
    const interestExpense = expenseAccounts
      .filter((acc: ChartOfAccountsEntity) => acc.accountSubType === AccountSubType.INTEREST_EXPENSE)
      .reduce((sum: number, acc: ChartOfAccountsEntity) => sum + parseFloat(acc.currentBalance), 0);

    const otherExpenses = expenseAccounts
      .filter((acc: ChartOfAccountsEntity) => !['cost_of_goods_sold', 'selling_expense', 'administrative_expense', 'operating_expense', 'interest_expense'].includes(acc.accountSubType))
      .reduce((sum: number, acc: ChartOfAccountsEntity) => sum + parseFloat(acc.currentBalance), 0);

    const totalOtherExpenses = interestExpense + otherExpenses;

    // Calculate net income
    const netIncome = grossProfit - totalOperatingExpenses - totalOtherExpenses;
    const netProfitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    return {
      revenue: {
        salesRevenue,
        serviceRevenue,
        otherRevenue,
        totalRevenue,
      },
      costOfGoodsSold: {
        totalCOGS,
        grossProfit,
        grossProfitMargin,
      },
      operatingExpenses: {
        sellingExpenses,
        administrativeExpenses,
        operatingExpenses,
        totalOperatingExpenses,
      },
      otherExpenses: {
        interestExpense,
        otherExpenses,
        totalOtherExpenses,
      },
      netIncome,
      netProfitMargin,
    };
  }

  private async calculateCashFlow(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<CashFlowData> {
    // This is a simplified cash flow calculation
    // In a real implementation, this would require more sophisticated analysis
    
    const incomeStatement = await this.calculateIncomeStatement(tenantId, periodStart, periodEnd);
    const netIncome = incomeStatement.netIncome;

    // Operating activities (simplified)
    const adjustments: CashFlowAdjustment[] = [
      { description: 'Depreciation', amount: 0, type: 'addition' }, // Would need to calculate
    ];

    const workingCapitalChanges: CashFlowAdjustment[] = [
      { description: 'Changes in working capital', amount: 0, type: 'subtraction' }, // Would need to calculate
    ];

    const netCashFromOperating = netIncome + 
      adjustments.reduce((sum, adj) => sum + (adj.type === 'addition' ? adj.amount : -adj.amount), 0) +
      workingCapitalChanges.reduce((sum, adj) => sum + (adj.type === 'addition' ? adj.amount : -adj.amount), 0);

    // Investing activities (simplified)
    const investingActivities: CashFlowAdjustment[] = [];
    const netCashFromInvesting = investingActivities.reduce((sum, adj) => sum + (adj.type === 'addition' ? adj.amount : -adj.amount), 0);

    // Financing activities (simplified)
    const financingActivities: CashFlowAdjustment[] = [];
    const netCashFromFinancing = financingActivities.reduce((sum, adj) => sum + (adj.type === 'addition' ? adj.amount : -adj.amount), 0);

    const netCashFlow = netCashFromOperating + netCashFromInvesting + netCashFromFinancing;
    const beginningCash = 0; // Would need to get from previous period
    const endingCash = beginningCash + netCashFlow;

    return {
      operatingActivities: {
        netIncome,
        adjustments,
        workingCapitalChanges,
        netCashFromOperating,
      },
      investingActivities: {
        activities: investingActivities,
        netCashFromInvesting,
      },
      financingActivities: {
        activities: financingActivities,
        netCashFromFinancing,
      },
      netCashFlow,
      beginningCash,
      endingCash,
    };
  }

  private calculateSection(accounts: ChartOfAccountsEntity[]): BalanceSheetSection {
    const sectionAccounts = accounts.map((account: ChartOfAccountsEntity) => ({
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      balance: parseFloat(account.currentBalance),
    }));

    const total = sectionAccounts.reduce((sum: number, account) => sum + account.balance, 0);

    return {
      accounts: sectionAccounts,
      total,
    };
  }

  private calculateIncomeSection(accounts: ChartOfAccountsEntity[]): IncomeStatementSection {
    const sectionAccounts = accounts.map((account: ChartOfAccountsEntity) => ({
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      amount: parseFloat(account.currentBalance),
    }));

    const total = sectionAccounts.reduce((sum: number, account) => sum + account.amount, 0);

    return {
      accounts: sectionAccounts,
      total,
    };
  }

  async invalidateReportCache(tenantId: string) {
    await Promise.all([
      this.cacheService.invalidatePattern(`balance-sheet:${tenantId}:*`),
      this.cacheService.invalidatePattern(`income-statement:${tenantId}:*`),
      this.cacheService.invalidatePattern(`cash-flow:${tenantId}:*`),
    ]);
  }
}