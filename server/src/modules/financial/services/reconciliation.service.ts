import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReconciliationRepository } from '../repositories/reconciliation.repository';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { JournalEntryService } from './journal-entry.service';

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly reconciliationRepository: ReconciliationRepository,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly journalEntryService: JournalEntryService,
  ) {}

  async createReconciliation(tenantId: string, data: {
    accountId: string;
    reconciliationDate: Date;
    statementDate: Date;
    statementBalance: string;
    notes?: string;
    attachments?: any[];
  }, userId: string) {
    // Verify account exists
    await this.chartOfAccountsService.findAccountById(tenantId, data.accountId);

    // Get current book balance
    const bookBalance = await this.chartOfAccountsService.getAccountBalance(tenantId, data.accountId);

    // Calculate adjusted balance (initially same as book balance)
    const adjustedBalance = bookBalance;

    const reconciliation = await this.reconciliationRepository.create(tenantId, {
      ...data,
      bookBalance,
      adjustedBalance,
    }, userId);

    return reconciliation;
  }

  async findReconciliationById(tenantId: string, id: string) {
    const reconciliation = await this.reconciliationRepository.findById(tenantId, id);
    
    if (!reconciliation) {
      throw new NotFoundException('Reconciliation not found');
    }

    return reconciliation;
  }

  async findReconciliationsByAccount(tenantId: string, accountId: string, options?: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: string;
    limit?: number;
  }) {
    // Verify account exists
    await this.chartOfAccountsService.findAccountById(tenantId, accountId);

    return await this.reconciliationRepository.findByAccount(tenantId, accountId, options);
  }

  async updateReconciliation(tenantId: string, id: string, data: {
    reconciliationDate?: Date;
    statementDate?: Date;
    statementBalance?: string;
    notes?: string;
    attachments?: any[];
  }, userId: string) {
    const reconciliation = await this.findReconciliationById(tenantId, id);

    if (reconciliation.status === 'reconciled') {
      throw new BadRequestException('Cannot update reconciled reconciliation');
    }

    // If statement balance is updated, recalculate adjusted balance
    let updateData: any = { ...data };
    if (data.statementBalance) {
      const bookBalance = parseFloat(reconciliation.bookBalance);
      const statementBalance = parseFloat(data.statementBalance);
      const outstandingDebits = parseFloat(reconciliation.outstandingDebits);
      const outstandingCredits = parseFloat(reconciliation.outstandingCredits);
      
      const adjustedBalance = (bookBalance + outstandingDebits - outstandingCredits).toFixed(2);
      updateData.adjustedBalance = adjustedBalance;
    }

    return await this.reconciliationRepository.update(tenantId, id, updateData, userId);
  }

  async markAsReconciled(tenantId: string, id: string, userId: string) {
    const reconciliation = await this.findReconciliationById(tenantId, id);

    if (reconciliation.status === 'reconciled') {
      throw new BadRequestException('Reconciliation is already reconciled');
    }

    // Check if adjusted balance matches statement balance
    const adjustedBalance = parseFloat(reconciliation.adjustedBalance);
    const statementBalance = parseFloat(reconciliation.statementBalance);

    if (Math.abs(adjustedBalance - statementBalance) > 0.01) {
      throw new BadRequestException('Adjusted balance does not match statement balance');
    }

    return await this.reconciliationRepository.markAsReconciled(tenantId, id, userId);
  }

  async markAsDisputed(tenantId: string, id: string, userId: string, notes?: string) {
    const reconciliation = await this.findReconciliationById(tenantId, id);

    if (reconciliation.status === 'reconciled') {
      throw new BadRequestException('Cannot dispute a reconciled reconciliation');
    }

    return await this.reconciliationRepository.markAsDisputed(tenantId, id, userId, notes);
  }

  async getReconciliationItems(tenantId: string, reconciliationId: string) {
    const reconciliation = await this.findReconciliationById(tenantId, reconciliationId);

    // Get account ledger entries for the reconciliation period
    const ledgerEntries = await this.journalEntryService.getAccountLedger(
      tenantId,
      reconciliation.accountId,
      {
        dateTo: reconciliation.reconciliationDate,
        includeUnposted: false,
      }
    );

    // Calculate running balance and identify unreconciled items
    let runningBalance = 0;
    const items = ledgerEntries.map(entry => {
      const debitAmount = parseFloat(entry.debitAmount);
      const creditAmount = parseFloat(entry.creditAmount);
      
      runningBalance += debitAmount - creditAmount;

      return {
        entryDate: entry.entryDate,
        entryNumber: entry.entryNumber,
        description: entry.description,
        reference: entry.reference,
        debitAmount: entry.debitAmount,
        creditAmount: entry.creditAmount,
        runningBalance: runningBalance.toFixed(2),
        isReconciled: entry.entryDate <= reconciliation.reconciliationDate,
      };
    });

    return {
      reconciliation,
      items,
      summary: {
        totalItems: items.length,
        reconciledItems: items.filter(item => item.isReconciled).length,
        unreconciledItems: items.filter(item => !item.isReconciled).length,
        finalBalance: runningBalance.toFixed(2),
      },
    };
  }

  async autoReconcile(tenantId: string, accountId: string, reconciliationDate: Date, statementBalance: string, userId: string) {
    // Verify account exists
    await this.chartOfAccountsService.findAccountById(tenantId, accountId);

    // Get current book balance
    const bookBalance = await this.chartOfAccountsService.getAccountBalance(tenantId, accountId);
    const bookBalanceNum = parseFloat(bookBalance);
    const statementBalanceNum = parseFloat(statementBalance);

    // Create reconciliation
    const reconciliation = await this.reconciliationRepository.create(tenantId, {
      accountId,
      reconciliationDate,
      statementDate: reconciliationDate,
      bookBalance,
      statementBalance,
      adjustedBalance: bookBalance,
    }, userId);

    // If balances match exactly, mark as reconciled
    if (Math.abs(bookBalanceNum - statementBalanceNum) < 0.01) {
      return await this.reconciliationRepository.markAsReconciled(tenantId, reconciliation?.id || '', userId);
    }

    // Otherwise, calculate outstanding items
    const difference = statementBalanceNum - bookBalanceNum;
    
    if (difference > 0) {
      // Outstanding credits (deposits in transit)
      await this.reconciliationRepository.update(tenantId, reconciliation?.id || '', {
        outstandingCredits: Math.abs(difference).toFixed(2),
        adjustedBalance: statementBalance,
      }, userId);
    } else {
      // Outstanding debits (checks not yet cleared)
      await this.reconciliationRepository.update(tenantId, reconciliation?.id || '', {
        outstandingDebits: Math.abs(difference).toFixed(2),
        adjustedBalance: statementBalance,
      }, userId);
    }

    return reconciliation;
  }

  async getReconciliationSummary(tenantId: string, accountId: string, dateFrom?: Date, dateTo?: Date) {
    // Verify account exists
    await this.chartOfAccountsService.findAccountById(tenantId, accountId);

    return await this.reconciliationRepository.getReconciliationSummary(tenantId, accountId, dateFrom, dateTo);
  }

  async deleteReconciliation(tenantId: string, id: string, userId: string) {
    const reconciliation = await this.findReconciliationById(tenantId, id);

    if (reconciliation.status === 'reconciled') {
      throw new BadRequestException('Cannot delete reconciled reconciliation');
    }

    return await this.reconciliationRepository.delete(tenantId, id, userId);
  }
}