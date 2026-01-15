import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { JournalEntryService } from './journal-entry.service';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { AccountType } from '../dto/chart-of-accounts.dto';

@Injectable()
export class TransactionPostingService {
  constructor(
    private readonly journalEntryService: JournalEntryService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('transaction.created')
  async handleTransactionCreated(event: {
    tenantId: string;
    transaction: any;
    userId: string;
  }) {
    try {
      await this.postTransactionToAccounting(event.tenantId, event.transaction, event.userId);
    } catch (error) {
      console.error('Failed to post transaction to accounting:', error);
      // Could emit a failure event or queue for retry
    }
  }

  async postTransactionToAccounting(tenantId: string, transaction: any, userId: string) {
    // Get required accounts
    const accounts = await this.getRequiredAccounts(tenantId);
    
    if (!(accounts as any).cash || !(accounts as any).salesRevenue || !(accounts as any).inventory || !(accounts as any).cogs) {
      throw new Error('Required accounts not found. Please initialize chart of accounts.');
    }

    const journalLines = [];
    let lineNumber = 1;

    // Calculate totals
    const subtotal = transaction.items?.reduce((sum: number, item: any) => sum + parseFloat(item.totalPrice || '0'), 0) || 0;
    const totalTax = transaction.taxes?.reduce((sum: number, tax: any) => sum + parseFloat(tax.amount || '0'), 0) || 0;
    const totalAmount = subtotal + totalTax;

    // 1. Debit Cash/Payment Account
    const paymentAccountId = await this.getPaymentAccountId(tenantId, transaction.paymentMethod);
    journalLines.push({
      accountId: paymentAccountId || (accounts as any).cash?.id,
      lineNumber: lineNumber++,
      description: `Payment received - ${transaction.paymentMethod}`,
      debitAmount: totalAmount.toFixed(2),
      creditAmount: '0.00',
      customerId: transaction.customerId,
      locationId: transaction.locationId,
      reference: transaction.id,
    });

    // 2. Credit Sales Revenue
    journalLines.push({
      accountId: (accounts as any).salesRevenue?.id,
      lineNumber: lineNumber++,
      description: 'Sales revenue',
      debitAmount: '0.00',
      creditAmount: subtotal.toFixed(2),
      customerId: transaction.customerId,
      locationId: transaction.locationId,
      reference: transaction.id,
    });

    // 3. Credit Sales Tax (if applicable)
    if (totalTax > 0 && (accounts as any).salesTax) {
      journalLines.push({
        accountId: (accounts as any).salesTax?.id,
        lineNumber: lineNumber++,
        description: 'Sales tax collected',
        debitAmount: '0.00',
        creditAmount: totalTax.toFixed(2),
        customerId: transaction.customerId,
        locationId: transaction.locationId,
        reference: transaction.id,
      });
    }

    // 4. Record COGS and Inventory reduction for each item
    if (transaction.items) {
      for (const item of transaction.items) {
        const costAmount = await this.getItemCost(tenantId, item.productId, item.quantity);
        
        if (costAmount > 0) {
          // Debit COGS
          journalLines.push({
            accountId: (accounts as any).cogs?.id,
            lineNumber: lineNumber++,
            description: `COGS for ${item.productName || item.productId}`,
            debitAmount: costAmount.toFixed(2),
            creditAmount: '0.00',
            locationId: transaction.locationId,
            reference: transaction.id,
          });

          // Credit Inventory
          journalLines.push({
            accountId: (accounts as any).inventory?.id,
            lineNumber: lineNumber++,
            description: `Inventory reduction for ${item.productName || item.productId}`,
            debitAmount: '0.00',
            creditAmount: costAmount.toFixed(2),
            locationId: transaction.locationId,
            reference: transaction.id,
          });
        }
      }
    }

    // Create and post the journal entry
    const journalEntry = await this.journalEntryService.createAutomaticJournalEntry(
      tenantId,
      `Sales transaction ${transaction.transactionNumber || transaction.id}`,
      'pos_transaction',
      transaction.id,
      journalLines,
      userId,
      true // Auto-post
    );

    // Emit event for successful posting
    this.eventEmitter.emit('transaction.posted', {
      tenantId,
      transactionId: transaction.id,
      journalEntryId: journalEntry.id,
      amount: totalAmount,
    });

    return journalEntry;
  }

  async postPayrollToAccounting(tenantId: string, payrollData: any, userId: string) {
    const accounts = await this.getRequiredAccounts(tenantId);
    
    const journalLines = [];
    let lineNumber = 1;

    // Debit Salary Expense
    journalLines.push({
      accountId: (accounts as any).salaryExpense?.id,
      lineNumber: lineNumber++,
      description: `Payroll for period ${payrollData.payPeriod}`,
      debitAmount: payrollData.grossPay.toFixed(2),
      creditAmount: '0.00',
      departmentId: payrollData.departmentId,
      locationId: payrollData.locationId,
    });

    // Credit Cash (net pay)
    journalLines.push({
      accountId: (accounts as any).cash?.id,
      lineNumber: lineNumber++,
      description: 'Net pay disbursement',
      debitAmount: '0.00',
      creditAmount: payrollData.netPay.toFixed(2),
      locationId: payrollData.locationId,
    });

    // Credit various payroll liabilities
    if (payrollData.federalTax > 0) {
      journalLines.push({
        accountId: (accounts as any).federalTaxPayable?.id || (accounts as any).accruedExpenses?.id,
        lineNumber: lineNumber++,
        description: 'Federal tax withholding',
        debitAmount: '0.00',
        creditAmount: payrollData.federalTax.toFixed(2),
      });
    }

    // Create journal entry
    return await this.journalEntryService.createAutomaticJournalEntry(
      tenantId,
      `Payroll entry for ${payrollData.payPeriod}`,
      'payroll',
      payrollData.id,
      journalLines,
      userId,
      true
    );
  }

  async postInventoryAdjustmentToAccounting(tenantId: string, adjustmentData: any, userId: string) {
    const accounts = await this.getRequiredAccounts(tenantId);
    
    const journalLines = [];
    let lineNumber = 1;

    const adjustmentAmount = Math.abs(adjustmentData.adjustmentValue);
    const isIncrease = adjustmentData.adjustmentValue > 0;

    if (isIncrease) {
      // Inventory increase - Debit Inventory, Credit Inventory Adjustment (or specific account)
      journalLines.push({
        accountId: (accounts as any).inventory?.id,
        lineNumber: lineNumber++,
        description: `Inventory adjustment - ${adjustmentData.reason}`,
        debitAmount: adjustmentAmount.toFixed(2),
        creditAmount: '0.00',
        locationId: adjustmentData.locationId,
      });

      journalLines.push({
        accountId: (accounts as any).inventoryAdjustment?.id || (accounts as any).otherExpense?.id,
        lineNumber: lineNumber++,
        description: `Inventory adjustment - ${adjustmentData.reason}`,
        debitAmount: '0.00',
        creditAmount: adjustmentAmount.toFixed(2),
        locationId: adjustmentData.locationId,
      });
    } else {
      // Inventory decrease - Debit Inventory Adjustment, Credit Inventory
      journalLines.push({
        accountId: (accounts as any).inventoryAdjustment?.id || (accounts as any).otherExpense?.id,
        lineNumber: lineNumber++,
        description: `Inventory adjustment - ${adjustmentData.reason}`,
        debitAmount: adjustmentAmount.toFixed(2),
        creditAmount: '0.00',
        locationId: adjustmentData.locationId,
      });

      journalLines.push({
        accountId: (accounts as any).inventory?.id,
        lineNumber: lineNumber++,
        description: `Inventory adjustment - ${adjustmentData.reason}`,
        debitAmount: '0.00',
        creditAmount: adjustmentAmount.toFixed(2),
        locationId: adjustmentData.locationId,
      });
    }

    return await this.journalEntryService.createAutomaticJournalEntry(
      tenantId,
      `Inventory adjustment - ${adjustmentData.reason}`,
      'inventory_adjustment',
      adjustmentData.id,
      journalLines,
      userId,
      true
    );
  }

  private async getRequiredAccounts(tenantId: string) {
    const allAccounts = await this.chartOfAccountsService.getAllAccounts(tenantId) as any[];
    const accountMap = new Map(allAccounts.map((acc: any) => [acc.accountNumber, acc]));

    return {
      cash: accountMap.get('1110'), // Cash and Cash Equivalents
      salesRevenue: accountMap.get('4100'), // Sales Revenue
      inventory: accountMap.get('1130'), // Inventory
      cogs: accountMap.get('5000'), // Cost of Goods Sold
      salesTax: accountMap.get('2120'), // Accrued Expenses (for sales tax)
      salaryExpense: accountMap.get('6100'), // Salaries and Wages
      accruedExpenses: accountMap.get('2120'), // Accrued Expenses
      federalTaxPayable: accountMap.get('2130'), // Federal Tax Payable (if exists)
      inventoryAdjustment: accountMap.get('6700'), // Inventory Adjustment (if exists)
      otherExpense: accountMap.get('7100'), // Other Expenses
    };
  }

  private async getPaymentAccountId(tenantId: string, paymentMethod: string): Promise<string | null> {
    // Map payment methods to specific accounts
    const paymentAccountMap: Record<string, string> = {
      'cash': '1110', // Cash and Cash Equivalents
      'card': '1115', // Credit Card Receivable (if exists)
      'check': '1110', // Cash and Cash Equivalents
      'mobile_money': '1116', // Mobile Money Account (if exists)
      'bank_transfer': '1110', // Cash and Cash Equivalents
    };

    const accountNumber = paymentAccountMap[paymentMethod];
    if (!accountNumber) {
      return null;
    }

    const account = await this.chartOfAccountsService.findAccountByNumber(tenantId, accountNumber);
    return (account as any)?.id || null;
  }

  private async getItemCost(tenantId: string, productId: string, quantity: number): Promise<number> {
    // This would typically integrate with inventory management to get actual cost
    // For now, we'll use a simplified approach
    
    // In a real implementation, this would:
    // 1. Look up the product's cost from inventory records
    // 2. Use FIFO/LIFO/Average cost method
    // 3. Calculate the total cost for the quantity sold
    
    // Placeholder: assume 60% of selling price as cost
    return quantity * 10; // Simplified cost calculation
  }

  async reverseTransaction(tenantId: string, originalTransactionId: string, reason: string, userId: string) {
    // Find the original journal entry
    const journalEntries = await this.journalEntryService.findJournalEntriesByAccount(
      tenantId,
      '', // We'd need to search across all accounts or have a better lookup method
      {
        // sourceType: 'pos_transaction',
        // sourceId: originalTransactionId,
      }
    );

    if (journalEntries.length === 0) {
      throw new Error('Original transaction journal entry not found');
    }

    const originalEntry = journalEntries[0];

    // Reverse the journal entry
    const reversalEntry = await this.journalEntryService.reverseJournalEntry(
      tenantId,
      originalEntry.id,
      userId,
      reason
    );

    // Emit event for successful reversal
    this.eventEmitter.emit('transaction.reversed', {
      tenantId,
      originalTransactionId,
      reversalEntryId: reversalEntry.id,
      reason,
    });

    return reversalEntry;
  }
}