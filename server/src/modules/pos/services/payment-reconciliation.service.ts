import { Injectable, Logger } from '@nestjs/common';
import { PaymentRepository } from '../repositories/payment.repository';
import { TransactionRepository } from '../repositories/transaction.repository';
import { StripePaymentProvider } from '../providers/stripe-payment.provider';
import { CashPaymentProvider } from '../providers/cash-payment.provider';

export interface ReconciliationReport {
  reconciliationId: string;
  tenantId: string;
  locationId?: string;
  startDate: Date;
  endDate: Date;
  totalTransactions: number;
  totalAmount: number;
  paymentMethodBreakdown: {
    [method: string]: {
      count: number;
      amount: number;
      fees: number;
      discrepancies: number;
    };
  };
  discrepancies: ReconciliationDiscrepancy[];
  summary: {
    expectedAmount: number;
    actualAmount: number;
    difference: number;
    reconciled: boolean;
  };
  generatedAt: Date;
}

export interface ReconciliationDiscrepancy {
  type: 'missing_payment' | 'duplicate_payment' | 'amount_mismatch' | 'status_mismatch';
  transactionId: string;
  paymentId?: string;
  description: string;
  expectedAmount?: number;
  actualAmount?: number;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
}

export interface ReconciliationOptions {
  locationId?: string;
  paymentMethods?: string[];
  includeVoided?: boolean;
  includeRefunded?: boolean;
  autoResolve?: boolean;
}

@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly stripeProvider: StripePaymentProvider,
    private readonly cashProvider: CashPaymentProvider,
  ) {}

  async performReconciliation(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    options: ReconciliationOptions = {},
  ): Promise<ReconciliationReport> {
    this.logger.log(`Starting payment reconciliation for tenant ${tenantId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const reconciliationId = `recon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Get all transactions in the date range
    const transactions = await this.transactionRepository.findByDateRange(
      tenantId,
      startDate,
      endDate,
      options.locationId
    );

    // Get all payments for these transactions
    const payments = await this.paymentRepository.findByDateRange(
      tenantId,
      startDate,
      endDate,
      options.locationId
    );

    // Perform reconciliation analysis
    const paymentMethodBreakdown = this.analyzePaymentMethods(payments);
    const discrepancies = await this.detectDiscrepancies(transactions, payments);

    // Auto-resolve discrepancies if requested
    if (options.autoResolve) {
      await this.autoResolveDiscrepancies(tenantId, discrepancies);
    }

    // Calculate summary
    const expectedAmount = transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.total, 0);

    const actualAmount = payments
      .filter(p => p.status === 'captured')
      .reduce((sum, p) => sum + p.amount, 0);

    const report: ReconciliationReport = {
      reconciliationId,
      tenantId,
      startDate,
      endDate,
      totalTransactions: transactions.length,
      totalAmount: expectedAmount,
      paymentMethodBreakdown,
      discrepancies,
      summary: {
        expectedAmount,
        actualAmount,
        difference: Math.abs(expectedAmount - actualAmount),
        reconciled: Math.abs(expectedAmount - actualAmount) < 0.01, // Within 1 cent
      },
      generatedAt: new Date(),
    };

    // Only add locationId if it exists
    if (options.locationId) {
      (report as any).locationId = options.locationId;
    }

    this.logger.log(`Reconciliation completed: ${discrepancies.length} discrepancies found, difference: $${report.summary.difference.toFixed(2)}`);

    return report;
  }

  async performDailyReconciliation(
    tenantId: string,
    date: Date,
    options: ReconciliationOptions = {},
  ): Promise<ReconciliationReport> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    return this.performReconciliation(tenantId, startOfDay, endOfDay, options);
  }

  async getReconciliationHistory(
    tenantId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{
    reports: ReconciliationReport[];
    total: number;
  }> {
    // In a real implementation, this would fetch from a reconciliation reports table
    // For now, return empty results
    return {
      reports: [],
      total: 0,
    };
  }

  async resolveDiscrepancy(
    tenantId: string,
    discrepancyId: string,
    resolution: {
      action: 'ignore' | 'adjust_payment' | 'adjust_transaction' | 'manual_entry';
      notes?: string;
      adjustmentAmount?: number;
    },
    userId: string,
  ): Promise<void> {
    this.logger.log(`Resolving discrepancy ${discrepancyId} with action: ${resolution.action}`);

    // In a real implementation, this would:
    // 1. Update the discrepancy record
    // 2. Apply the resolution action
    // 3. Log the resolution for audit purposes
    // 4. Notify relevant stakeholders

    switch (resolution.action) {
      case 'ignore':
        // Mark discrepancy as resolved but no action taken
        break;

      case 'adjust_payment':
        // Create adjustment payment record
        if (resolution.adjustmentAmount) {
          await this.createAdjustmentPayment(
            tenantId,
            discrepancyId,
            resolution.adjustmentAmount,
            resolution.notes || 'Reconciliation adjustment',
            userId
          );
        }
        break;

      case 'adjust_transaction':
        // Update transaction amount or status
        break;

      case 'manual_entry':
        // Create manual reconciliation entry
        break;
    }
  }

  private analyzePaymentMethods(payments: any[]): ReconciliationReport['paymentMethodBreakdown'] {
    const breakdown: ReconciliationReport['paymentMethodBreakdown'] = {};

    for (const payment of payments) {
      const method = payment.paymentMethod;
      
      if (!breakdown[method]) {
        breakdown[method] = {
          count: 0,
          amount: 0,
          fees: 0,
          discrepancies: 0,
        };
      }

      const methodBreakdown = breakdown[method];
      if (methodBreakdown) {
        methodBreakdown.count++;
        methodBreakdown.amount += payment.amount;
        
        // Calculate fees based on payment method
        if (method === 'card' || method === 'digital_wallet') {
          methodBreakdown.fees += this.calculateStripeFees(payment.amount);
        }
      }
    }

    return breakdown;
  }

  private async detectDiscrepancies(
    transactions: any[],
    payments: any[],
  ): Promise<ReconciliationDiscrepancy[]> {
    const discrepancies: ReconciliationDiscrepancy[] = [];

    // Create maps for efficient lookup
    const transactionMap = new Map(transactions.map(t => [t.id, t]));
    const paymentsByTransaction = new Map<string, any[]>();

    // Group payments by transaction
    for (const payment of payments) {
      if (!paymentsByTransaction.has(payment.transactionId)) {
        paymentsByTransaction.set(payment.transactionId, []);
      }
      paymentsByTransaction.get(payment.transactionId)!.push(payment);
    }

    // Check for missing payments
    for (const transaction of transactions) {
      if (transaction.status === 'completed') {
        const transactionPayments = paymentsByTransaction.get(transaction.id) || [];
        const totalPaid = transactionPayments
          .filter(p => p.status === 'captured')
          .reduce((sum, p) => sum + p.amount, 0);

        if (Math.abs(totalPaid - transaction.total) > 0.01) {
          discrepancies.push({
            type: 'amount_mismatch',
            transactionId: transaction.id,
            description: `Payment amount mismatch: expected $${transaction.total.toFixed(2)}, received $${totalPaid.toFixed(2)}`,
            expectedAmount: transaction.total,
            actualAmount: totalPaid,
            severity: Math.abs(totalPaid - transaction.total) > 10 ? 'high' : 'medium',
            resolved: false,
          });
        }

        if (transactionPayments.length === 0) {
          discrepancies.push({
            type: 'missing_payment',
            transactionId: transaction.id,
            description: `No payment record found for completed transaction`,
            expectedAmount: transaction.total,
            actualAmount: 0,
            severity: 'high',
            resolved: false,
          });
        }
      }
    }

    // Check for orphaned payments
    for (const payment of payments) {
      if (!transactionMap.has(payment.transactionId)) {
        discrepancies.push({
          type: 'missing_payment',
          transactionId: payment.transactionId,
          paymentId: payment.id,
          description: `Payment exists but transaction not found`,
          actualAmount: payment.amount,
          severity: 'medium',
          resolved: false,
        });
      }
    }

    // Check for duplicate payments
    for (const [transactionId, transactionPayments] of paymentsByTransaction) {
      const capturedPayments = transactionPayments.filter(p => p.status === 'captured');
      if (capturedPayments.length > 1) {
        const transaction = transactionMap.get(transactionId);
        if (transaction) {
          discrepancies.push({
            type: 'duplicate_payment',
            transactionId,
            description: `Multiple captured payments found for single transaction`,
            expectedAmount: transaction.total,
            actualAmount: capturedPayments.reduce((sum, p) => sum + p.amount, 0),
            severity: 'high',
            resolved: false,
          });
        }
      }
    }

    return discrepancies;
  }

  private async autoResolveDiscrepancies(
    tenantId: string,
    discrepancies: ReconciliationDiscrepancy[],
  ): Promise<void> {
    for (const discrepancy of discrepancies) {
      // Only auto-resolve low severity discrepancies
      if (discrepancy.severity === 'low') {
        try {
          // Auto-resolve based on discrepancy type
          switch (discrepancy.type) {
            case 'amount_mismatch':
              // If difference is very small (< $0.05), mark as resolved
              const difference = Math.abs((discrepancy.expectedAmount || 0) - (discrepancy.actualAmount || 0));
              if (difference < 0.05) {
                discrepancy.resolved = true;
              }
              break;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          this.logger.error(`Failed to auto-resolve discrepancy: ${errorMessage}`);
        }
      }
    }
  }

  private async createAdjustmentPayment(
    tenantId: string,
    discrepancyId: string,
    amount: number,
    notes: string,
    userId: string,
  ): Promise<void> {
    // Create an adjustment payment record
    await this.paymentRepository.create(
      tenantId,
      {
        transactionId: discrepancyId, // Use discrepancy ID as reference
        paymentMethod: 'adjustment',
        amount,
        paymentProvider: 'manual',
        providerTransactionId: `adj_${Date.now()}`,
        providerResponse: {
          type: 'reconciliation_adjustment',
          notes,
          adjustedAt: new Date().toISOString(),
        },
        metadata: {
          discrepancyId,
          adjustmentType: 'reconciliation',
        },
      },
      userId
    );
  }

  private calculateStripeFees(amount: number): number {
    // Stripe standard fees: 2.9% + $0.30
    return Math.round((amount * 0.029 + 0.30) * 100) / 100;
  }
}