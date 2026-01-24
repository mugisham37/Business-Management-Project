/**
 * Financial Utilities
 * Helper functions for financial calculations, formatting, and operations
 */

import { formatCurrency } from './index';

// Financial Calculation Types
export interface FinancialRatio {
  value: number;
  label: string;
  description: string;
  benchmark?: number;
  status: 'good' | 'fair' | 'poor';
}

export interface VarianceAnalysis {
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  status: 'favorable' | 'unfavorable' | 'neutral';
}

export interface CashFlowProjection {
  date: Date;
  inflows: number;
  outflows: number;
  netFlow: number;
  cumulativeFlow: number;
}

// Currency and Formatting Utilities
export function formatFinancialAmount(
  amount: number,
  currency = 'USD',
  options: {
    showCents?: boolean;
    showSymbol?: boolean;
    showParenthesesForNegative?: boolean;
  } = {}
): string {
  const {
    showCents = true,
    showSymbol = true,
    showParenthesesForNegative = true,
  } = options;

  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(amount);

  let formatted = new Intl.NumberFormat('en-US', {
    style: showSymbol ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(absoluteAmount);

  if (isNegative && showParenthesesForNegative) {
    formatted = `(${formatted})`;
  } else if (isNegative) {
    formatted = `-${formatted}`;
  }

  return formatted;
}

export function parseFinancialAmount(value: string): number {
  // Remove currency symbols, commas, and parentheses
  const cleaned = value
    .replace(/[$,()]/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();

  // Handle parentheses as negative
  const isNegative = value.includes('(') && value.includes(')');
  const amount = parseFloat(cleaned) || 0;

  return isNegative ? -Math.abs(amount) : amount;
}

export function formatPercentage(
  value: number,
  options: {
    decimals?: number;
    showSign?: boolean;
  } = {}
): string {
  const { decimals = 2, showSign = false } = options;
  
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);

  if (showSign && value > 0) {
    return `+${formatted}`;
  }

  return formatted;
}

// Financial Ratio Calculations
export function calculateCurrentRatio(currentAssets: number, currentLiabilities: number): FinancialRatio {
  const value = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  
  return {
    value,
    label: 'Current Ratio',
    description: 'Measures ability to pay short-term obligations',
    benchmark: 2.0,
    status: value >= 2.0 ? 'good' : value >= 1.0 ? 'fair' : 'poor',
  };
}

export function calculateQuickRatio(
  currentAssets: number,
  inventory: number,
  currentLiabilities: number
): FinancialRatio {
  const quickAssets = currentAssets - inventory;
  const value = currentLiabilities > 0 ? quickAssets / currentLiabilities : 0;
  
  return {
    value,
    label: 'Quick Ratio',
    description: 'Measures ability to pay short-term obligations without selling inventory',
    benchmark: 1.0,
    status: value >= 1.0 ? 'good' : value >= 0.5 ? 'fair' : 'poor',
  };
}

export function calculateDebtToEquityRatio(totalDebt: number, totalEquity: number): FinancialRatio {
  const value = totalEquity > 0 ? totalDebt / totalEquity : 0;
  
  return {
    value,
    label: 'Debt-to-Equity Ratio',
    description: 'Measures financial leverage and risk',
    benchmark: 0.5,
    status: value <= 0.5 ? 'good' : value <= 1.0 ? 'fair' : 'poor',
  };
}

export function calculateReturnOnAssets(netIncome: number, totalAssets: number): FinancialRatio {
  const value = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0;
  
  return {
    value,
    label: 'Return on Assets (ROA)',
    description: 'Measures how efficiently assets generate profit',
    benchmark: 5.0,
    status: value >= 5.0 ? 'good' : value >= 2.0 ? 'fair' : 'poor',
  };
}

export function calculateReturnOnEquity(netIncome: number, totalEquity: number): FinancialRatio {
  const value = totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0;
  
  return {
    value,
    label: 'Return on Equity (ROE)',
    description: 'Measures return generated on shareholders\' equity',
    benchmark: 15.0,
    status: value >= 15.0 ? 'good' : value >= 10.0 ? 'fair' : 'poor',
  };
}

export function calculateGrossProfitMargin(grossProfit: number, revenue: number): FinancialRatio {
  const value = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  
  return {
    value,
    label: 'Gross Profit Margin',
    description: 'Measures profitability after direct costs',
    benchmark: 30.0,
    status: value >= 30.0 ? 'good' : value >= 15.0 ? 'fair' : 'poor',
  };
}

export function calculateNetProfitMargin(netIncome: number, revenue: number): FinancialRatio {
  const value = revenue > 0 ? (netIncome / revenue) * 100 : 0;
  
  return {
    value,
    label: 'Net Profit Margin',
    description: 'Measures overall profitability',
    benchmark: 10.0,
    status: value >= 10.0 ? 'good' : value >= 5.0 ? 'fair' : 'poor',
  };
}

// Variance Analysis
export function calculateVariance(budgetAmount: number, actualAmount: number): VarianceAnalysis {
  const variance = budgetAmount - actualAmount;
  const variancePercentage = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;
  
  let status: 'favorable' | 'unfavorable' | 'neutral';
  if (Math.abs(variancePercentage) <= 5) {
    status = 'neutral';
  } else if (variance > 0) {
    status = 'favorable'; // Under budget
  } else {
    status = 'unfavorable'; // Over budget
  }
  
  return {
    budgetAmount,
    actualAmount,
    variance,
    variancePercentage,
    status,
  };
}

export function calculateBudgetUtilization(actualAmount: number, budgetAmount: number): number {
  return budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;
}

// Cash Flow Analysis
export function calculateWorkingCapital(currentAssets: number, currentLiabilities: number): number {
  return currentAssets - currentLiabilities;
}

export function calculateCashConversionCycle(
  daysInventoryOutstanding: number,
  daysReceivableOutstanding: number,
  daysPayableOutstanding: number
): number {
  return daysInventoryOutstanding + daysReceivableOutstanding - daysPayableOutstanding;
}

export function projectCashFlow(
  initialBalance: number,
  monthlyInflows: number[],
  monthlyOutflows: number[]
): CashFlowProjection[] {
  const projections: CashFlowProjection[] = [];
  let cumulativeFlow = initialBalance;
  
  const maxLength = Math.max(monthlyInflows.length, monthlyOutflows.length);
  
  for (let i = 0; i < maxLength; i++) {
    const inflow = monthlyInflows[i] || 0;
    const outflow = monthlyOutflows[i] || 0;
    const netFlow = inflow - outflow;
    cumulativeFlow += netFlow;
    
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    
    projections.push({
      date,
      inflows: inflow,
      outflows: outflow,
      netFlow,
      cumulativeFlow,
    });
  }
  
  return projections;
}

// Account Balance Calculations
export function calculateAccountBalance(
  openingBalance: number,
  debits: number,
  credits: number,
  normalBalance: 'debit' | 'credit'
): number {
  if (normalBalance === 'debit') {
    return openingBalance + debits - credits;
  } else {
    return openingBalance + credits - debits;
  }
}

export function isDebitAccount(accountType: string): boolean {
  const debitAccountTypes = ['ASSET', 'EXPENSE', 'DIVIDEND'];
  return debitAccountTypes.includes(accountType.toUpperCase());
}

export function isCreditAccount(accountType: string): boolean {
  const creditAccountTypes = ['LIABILITY', 'EQUITY', 'REVENUE'];
  return creditAccountTypes.includes(accountType.toUpperCase());
}

// Financial Period Calculations
export function getFinancialPeriod(date: Date, fiscalYearStart: number = 1): {
  fiscalYear: number;
  quarter: number;
  period: number;
} {
  const month = date.getMonth() + 1; // 1-based month
  const year = date.getFullYear();
  
  // Calculate fiscal year
  let fiscalYear = year;
  if (fiscalYearStart > 1 && month < fiscalYearStart) {
    fiscalYear = year - 1;
  } else if (fiscalYearStart > 1 && month >= fiscalYearStart) {
    fiscalYear = year;
  }
  
  // Calculate fiscal month (1-12 within fiscal year)
  let fiscalMonth = month - fiscalYearStart + 1;
  if (fiscalMonth <= 0) {
    fiscalMonth += 12;
  }
  
  // Calculate quarter
  const quarter = Math.ceil(fiscalMonth / 3);
  
  return {
    fiscalYear,
    quarter,
    period: fiscalMonth,
  };
}

export function getFiscalYearDates(fiscalYear: number, fiscalYearStart: number = 1): {
  startDate: Date;
  endDate: Date;
} {
  const startDate = new Date(fiscalYear, fiscalYearStart - 1, 1);
  const endDate = new Date(fiscalYear + 1, fiscalYearStart - 1, 0); // Last day of fiscal year
  
  return { startDate, endDate };
}

// Tax Calculations
export function calculateTaxAmount(
  taxableAmount: number,
  taxRate: number,
  taxType: 'percentage' | 'fixed' = 'percentage'
): number {
  if (taxType === 'percentage') {
    return taxableAmount * (taxRate / 100);
  } else {
    return taxRate;
  }
}

export function calculateCompoundTax(
  taxableAmount: number,
  taxRates: Array<{ rate: number; type: 'percentage' | 'fixed' }>
): number {
  return taxRates.reduce((total, tax) => {
    return total + calculateTaxAmount(taxableAmount, tax.rate, tax.type);
  }, 0);
}

// Depreciation Calculations
export function calculateStraightLineDepreciation(
  cost: number,
  salvageValue: number,
  usefulLife: number
): number {
  return (cost - salvageValue) / usefulLife;
}

export function calculateDoubleDecliningBalance(
  cost: number,
  accumulatedDepreciation: number,
  usefulLife: number
): number {
  const bookValue = cost - accumulatedDepreciation;
  const rate = 2 / usefulLife;
  return bookValue * rate;
}

// Financial Health Scoring
export function calculateFinancialHealthScore(ratios: {
  currentRatio: number;
  quickRatio: number;
  debtToEquity: number;
  returnOnAssets: number;
  netProfitMargin: number;
}): {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  description: string;
} {
  let score = 0;
  
  // Current Ratio (20 points)
  if (ratios.currentRatio >= 2.0) score += 20;
  else if (ratios.currentRatio >= 1.5) score += 15;
  else if (ratios.currentRatio >= 1.0) score += 10;
  else score += 5;
  
  // Quick Ratio (20 points)
  if (ratios.quickRatio >= 1.0) score += 20;
  else if (ratios.quickRatio >= 0.75) score += 15;
  else if (ratios.quickRatio >= 0.5) score += 10;
  else score += 5;
  
  // Debt to Equity (20 points)
  if (ratios.debtToEquity <= 0.3) score += 20;
  else if (ratios.debtToEquity <= 0.5) score += 15;
  else if (ratios.debtToEquity <= 1.0) score += 10;
  else score += 5;
  
  // Return on Assets (20 points)
  if (ratios.returnOnAssets >= 10) score += 20;
  else if (ratios.returnOnAssets >= 5) score += 15;
  else if (ratios.returnOnAssets >= 2) score += 10;
  else score += 5;
  
  // Net Profit Margin (20 points)
  if (ratios.netProfitMargin >= 15) score += 20;
  else if (ratios.netProfitMargin >= 10) score += 15;
  else if (ratios.netProfitMargin >= 5) score += 10;
  else score += 5;
  
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let description: string;
  
  if (score >= 90) {
    grade = 'A';
    description = 'Excellent financial health';
  } else if (score >= 80) {
    grade = 'B';
    description = 'Good financial health';
  } else if (score >= 70) {
    grade = 'C';
    description = 'Fair financial health';
  } else if (score >= 60) {
    grade = 'D';
    description = 'Poor financial health';
  } else {
    grade = 'F';
    description = 'Critical financial health';
  }
  
  return { score, grade, description };
}

// Utility Functions
export function roundToDecimalPlaces(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function isValidAccountNumber(accountNumber: string): boolean {
  // Account number should be 3-10 digits
  return /^\d{3,10}$/.test(accountNumber);
}

export function generateAccountNumber(
  accountType: string,
  existingNumbers: string[] = []
): string {
  const typePrefix: Record<string, string> = {
    ASSET: '1',
    LIABILITY: '2',
    EQUITY: '3',
    REVENUE: '4',
    EXPENSE: '5',
  };
  
  const prefix = typePrefix[accountType.toUpperCase()] || '9';
  let counter = 1000;
  
  while (existingNumbers.includes(`${prefix}${counter}`)) {
    counter++;
  }
  
  return `${prefix}${counter}`;
}

export function validateJournalEntryBalance(
  lineItems: Array<{ debitAmount: number; creditAmount: number }>
): { isBalanced: boolean; difference: number } {
  const totalDebits = lineItems.reduce((sum, item) => sum + item.debitAmount, 0);
  const totalCredits = lineItems.reduce((sum, item) => sum + item.creditAmount, 0);
  const difference = totalDebits - totalCredits;
  
  return {
    isBalanced: Math.abs(difference) < 0.01,
    difference: roundToDecimalPlaces(difference),
  };
}

// Export all utilities
export const financialUtils = {
  // Formatting
  formatFinancialAmount,
  parseFinancialAmount,
  formatPercentage,
  
  // Ratios
  calculateCurrentRatio,
  calculateQuickRatio,
  calculateDebtToEquityRatio,
  calculateReturnOnAssets,
  calculateReturnOnEquity,
  calculateGrossProfitMargin,
  calculateNetProfitMargin,
  
  // Variance
  calculateVariance,
  calculateBudgetUtilization,
  
  // Cash Flow
  calculateWorkingCapital,
  calculateCashConversionCycle,
  projectCashFlow,
  
  // Accounts
  calculateAccountBalance,
  isDebitAccount,
  isCreditAccount,
  
  // Periods
  getFinancialPeriod,
  getFiscalYearDates,
  
  // Tax
  calculateTaxAmount,
  calculateCompoundTax,
  
  // Depreciation
  calculateStraightLineDepreciation,
  calculateDoubleDecliningBalance,
  
  // Health Score
  calculateFinancialHealthScore,
  
  // Utilities
  roundToDecimalPlaces,
  isValidAccountNumber,
  generateAccountNumber,
  validateJournalEntryBalance,
};