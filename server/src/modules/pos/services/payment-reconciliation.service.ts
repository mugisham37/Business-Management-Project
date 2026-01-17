import { Injectable, Logger } from '@nestjs/common';
import { PaymentRepository } from '../repositories/payment.repository';
import { TransactionRepository } from '../repositories/transaction.repository';
import { CacheService } from '../../cache/cache.service';

export interface ReconciliationOptions {
  includeVoided?: boolean;
  includeRefunded?: boolean;
  paymentMethods?: string[];
  locationIds?: string[];
}

export interface ReconciliationDiscrepancy {
  type: 'missing_payment' | 'duplicate_payment' | 'amount_mismatch' | 'status_mismatch';
  transactionId?: string;
  paymentId?: string;
  expectedAmount?: number;
  actualAmount?: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface PaymentMethodSummary {
  paymentMethod: string;
  transactionCount: number;
  totalAmount: number;
  averageAmount: number;
  refundCount: number;
  refundAmount: number;
}

export interface ReconciliationReport {
  reconciliationId: string;
  tenantId: string;
  locationId?: string;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  generatedBy: string;
  
  // Summary
  totalTransactions: number;
  totalAmount: number;
  expectedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  
  // Payment method breakdown
  paymentMethodSummary: PaymentMethodSummary[];
  
  // Discrepancies
  discrepancies: ReconciliationDiscrepancy[];
  
  // Status
  status: 'balanced' | 'variance_detected' | 'major_discrepancy';
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  
  // Metadata
  options: ReconciliationOptions;
  processingTime: number;
}

@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly cacheService: CacheService,
  ) {}

  async performReconciliation(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    options: ReconciliationOptions = {},
    userId: string = 'system',
  ): Promise<ReconciliationReport> {
    const startTime = Date.now();
    const reconciliationId = `recon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(`Starting reconciliation ${reconciliationId} for tenant ${tenantId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    try {
      // Get transactions and payments for the period
      const { transactions } = await this.transactionRepository.findByTenant(tenantId, {
        startDate,
        endDate,
        limit: 10000, // Large limit to get all transactions
      });

      const { payments } = await this.paymentRepository.findByTenant(tenantId, {
        startDate,
        endDate,
        limit: 10000, // Large limit to get all payments
      });

      // Filter based on options
      const filteredTransactions = this.filterTransactions(transactions, options);
      const filteredPayments = this.filterPayments(payments, options);

      // Calculate summaries
      const paymentMethodSummary = this.calculatePaymentMethodSummary(filteredPayments);
      const totalTransactions = filteredTransactions.length;
      const expectedAmount = this.calculateExpectedAmount(filteredTransactions);
      const actualAmount = this.calculateActualAmount(filteredPayments);
      const variance = actualAmount - expectedAmount;
      const variancePercentage = expectedAmount > 0 ? (variance / expectedAmount) * 100 : 0;

      // Detect discrepancies
      const discrepancies = await this.detectDiscrepancies(
        filteredTransactions,
        filteredPayments,
        tenantId
      );

      // Determine status
      const status = this.determineReconciliationStatus(variance, discrepancies);

      const processingTime = Date.now() - startTime;

      const report: ReconciliationReport = {
        reconciliationId,
        tenantId,
        locationId: options.locationIds?.[0],
        startDate,
        endDate,
        generatedAt: new Date(),
        generatedBy: userId,
        
        totalTransactions,
        totalAmount: expectedAmount,
        expectedAmount,
        actualAmount,
        variance,
        variancePercentage,
        
        paymentMethodSummary,
        discrepancies,
        
        status,
        isApproved: false,
        
        options,
        processingTime,
      };

      // Cache the report
      await this.cacheReconciliationReport(report);

      this.logger.log(`Reconciliation ${reconciliationId} completed in ${processingTime}ms. Status: ${status}, Variance: $${variance.toFixed(2)}`);

      return report;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Reconciliation ${reconciliationId} failed: ${errorMessage}`);
      throw error;
    }
  }

  async performDailyReconciliation(
    tenantId: string,
    date: Date,
    options: ReconciliationOptions = {},
    userId: string = 'system',
  ): Promise<ReconciliationReport> {
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    return this.performReconciliation(tenantId, startDate, endDate, options, userId);
  }

  async getReconciliationHistory(
    tenantId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{
    reports: ReconciliationReport[];
    total: number;
  }> {
    this.logger.debug(`Getting reconciliation history for tenant ${tenantId}`);

    // In a real implementation, this would query the database
    // For now, return mock data
    const reports = await this.getMockReconciliationReports(tenantId, limit);

    return {
      reports: reports.slice(offset, offset + limit),
      total: reports.length,
    };
  }

  async approveReconciliation(
    tenantId: string,
    reconciliationId: string,
    userId: string,
    notes?: string,
  ): Promise<ReconciliationReport | null> {
    this.logger.log(`Approving reconciliation ${reconciliationId} by user ${userId}`);

    const report = await this.getReconciliationReport(tenantId, reconciliationId);
    if (!report) {
      return null;
    }

    const approvedReport: ReconciliationReport = {
      ...report,
      isApproved: true,
      approvedBy: userId,
      approvedAt: new Date(),
    };

    // Update cached report
    await this.cacheReconciliationReport(approvedReport);

    this.logger.log(`Reconciliation ${reconciliationId} approved by ${userId}`);
    return approvedReport;
  }

  async getReconciliationReport(
    tenantId: string,
    reconciliationId: string,
  ): Promise<ReconciliationReport | null> {
    const cacheKey = `reconciliation:${tenantId}:${reconciliationId}`;
    const cachedReport = await this.cacheService.get<ReconciliationReport>(cacheKey);

    if (cachedReport) {
      return cachedReport;
    }

    // In a real implementation, this would query the database
    // For now, return null if not in cache
    return null;
  }

  async getReconciliationSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalReconciliations: number;
    balancedReconciliations: number;
    varianceReconciliations: number;
    majorDiscrepancyReconciliations: number;
    totalVariance: number;
    averageVariance: number;
  }> {
    this.logger.debug(`Getting reconciliation summary for tenant ${tenantId}`);

    // In a real implementation, this would aggregate data from the database
    // For now, return mock summary
    return {
      totalReconciliations: 30,
      balancedReconciliations: 25,
      varianceReconciliations: 4,
      majorDiscrepancyReconciliations: 1,
      totalVariance: 125.50,
      averageVariance: 4.18,
    };
  }

  private filterTransactions(transactions: any[], options: ReconciliationOptions): any[] {
    let filtered = transactions;

    if (!options.includeVoided) {
      filtered = filtered.filter(t => t.status !== 'voided');
    }

    if (!options.includeRefunded) {
      filtered = filtered.filter(t => t.status !== 'refunded');
    }

    if (options.paymentMethods && options.paymentMethods.length > 0) {
      filtered = filtered.filter(t => options.paymentMethods!.includes(t.paymentMethod));
    }

    if (options.locationIds && options.locationIds.length > 0) {
      filtered = filtered.filter(t => options.locationIds!.includes(t.locationId));
    }

    return filtered;
  }

  private filterPayments(payments: any[], options: ReconciliationOptions): any[] {
    let filtered = payments;

    if (options.paymentMethods && options.paymentMethods.length > 0) {
      filtered = filtered.filter(p => options.paymentMethods!.includes(p.paymentMethod));
    }

    // Filter out failed payments
    filtered = filtered.filter(p => p.status === 'captured' || p.status === 'completed');

    return filtered;
  }

  private calculatePaymentMethodSummary(payments: any[]): PaymentMethodSummary[] {
    const summary = new Map<string, PaymentMethodSummary>();

    for (const payment of payments) {
      const method = payment.paymentMethod;
      const existing = summary.get(method) || {
        paymentMethod: method,
        transactionCount: 0,
        totalAmount: 0,
        averageAmount: 0,
        refundCount: 0,
        refundAmount: 0,
      };

      if (payment.amount > 0) {
        existing.transactionCount++;
        existing.totalAmount += payment.amount;
      } else {
        existing.refundCount++;
        existing.refundAmount += Math.abs(payment.amount);
      }

      summary.set(method, existing);
    }

    // Calculate averages
    for (const [method, data] of summary.entries()) {
      data.averageAmount = data.transactionCount > 0 ? data.totalAmount / data.transactionCount : 0;
      summary.set(method, data);
    }

    return Array.from(summary.values());
  }

  private calculateExpectedAmount(transactions: any[]): number {
    return transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.total, 0);
  }

  private calculateActualAmount(payments: any[]): number {
    return payments
      .filter(p => p.status === 'captured' || p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  private async detectDiscrepancies(
    transactions: any[],
    payments: any[],
    tenantId: string,
  ): Promise<ReconciliationDiscrepancy[]> {
    const discrepancies: ReconciliationDiscrepancy[] = [];

    // Create maps for quick lookup
    const transactionMap = new Map(transactions.map(t => [t.id, t]));
    const paymentsByTransaction = new Map<string, any[]>();

    // Group payments by transaction
    for (const payment of payments) {
      const existing = paymentsByTransaction.get(payment.transactionId) || [];
      existing.push(payment);
      paymentsByTransaction.set(payment.transactionId, existing);
    }

    // Check for missing payments
    for (const transaction of transactions) {
      if (transaction.status === 'completed') {
        const transactionPayments = paymentsByTransaction.get(transaction.id) || [];
        const totalPaid = transactionPayments.reduce((sum, p) => sum + p.amount, 0);

        if (transactionPayments.length === 0) {
          discrepancies.push({
            type: 'missing_payment',
            transactionId: transaction.id,
            expectedAmount: transaction.total,
            actualAmount: 0,
            description: `No payment record found for completed transaction ${transaction.transactionNumber}`,
            severity: 'high',
          });
        } else if (Math.abs(totalPaid - transaction.total) > 0.01) {
          discrepancies.push({
            type: 'amount_mismatch',
            transactionId: transaction.id,
            expectedAmount: transaction.total,
            actualAmount: totalPaid,
            description: `Payment amount mismatch for transaction ${transaction.transactionNumber}. Expected: $${transaction.total}, Actual: $${totalPaid}`,
            severity: Math.abs(totalPaid - transaction.total) > 10 ? 'high' : 'medium',
          });
        }
      }
    }

    // Check for orphaned payments
    for (const payment of payments) {
      if (!transactionMap.has(payment.transactionId)) {
        discrepancies.push({
          type: 'missing_payment',
          paymentId: payment.id,
          actualAmount: payment.amount,
          description: `Payment record ${payment.id} has no corresponding transaction`,
          severity: 'medium',
        });
      }
    }

    return discrepancies;
  }

  private determineReconciliationStatus(
    variance: number,
    discrepancies: ReconciliationDiscrepancy[],
  ): 'balanced' | 'variance_detected' | 'major_discrepancy' {
    const highSeverityDiscrepancies = discrepancies.filter(d => d.severity === 'high');
    
    if (highSeverityDiscrepancies.length > 0 || Math.abs(variance) > 100) {
      return 'major_discrepancy';
    } else if (Math.abs(variance) > 0.01 || discrepancies.length > 0) {
      return 'variance_detected';
    } else {
      return 'balanced';
    }
  }

  private async cacheReconciliationReport(report: ReconciliationReport): Promise<void> {
    const cacheKey = `reconciliation:${report.tenantId}:${report.reconciliationId}`;
    await this.cacheService.set(cacheKey, report, 7 * 24 * 3600); // Cache for 7 days
  }

  private async getMockReconciliationReports(tenantId: string, count: number): Promise<ReconciliationReport[]> {
    const reports: ReconciliationReport[] = [];
    
    for (let i = 0; i < count; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const variance = (Math.random() - 0.5) * 100; // Random variance between -50 and 50
      
      reports.push({
        reconciliationId: `recon_${Date.now() - i * 1000}`,
        tenantId,
        startDate: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        endDate: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        generatedAt: date,
        generatedBy: 'system',
        
        totalTransactions: Math.floor(Math.random() * 100) + 50,
        totalAmount: Math.floor(Math.random() * 10000) + 1000,
        expectedAmount: Math.floor(Math.random() * 10000) + 1000,
        actualAmount: 0, // Will be calculated
        variance,
        variancePercentage: 0, // Will be calculated
        
        paymentMethodSummary: [
          {
            paymentMethod: 'cash',
            transactionCount: Math.floor(Math.random() * 30) + 10,
            totalAmount: Math.floor(Math.random() * 3000) + 500,
            averageAmount: 0, // Will be calculated
            refundCount: Math.floor(Math.random() * 5),
            refundAmount: Math.floor(Math.random() * 200),
          },
          {
            paymentMethod: 'card',
            transactionCount: Math.floor(Math.random() * 40) + 20,
            totalAmount: Math.floor(Math.random() * 5000) + 1000,
            averageAmount: 0, // Will be calculated
            refundCount: Math.floor(Math.random() * 3),
            refundAmount: Math.floor(Math.random() * 300),
          },
        ],
        
        discrepancies: Math.abs(variance) > 10 ? [{
          type: 'amount_mismatch',
          transactionId: `txn_${i}`,
          expectedAmount: 25.99,
          actualAmount: 25.99 + variance,
          description: `Amount mismatch detected`,
          severity: Math.abs(variance) > 50 ? 'high' : 'medium',
        }] : [],
        
        status: Math.abs(variance) > 50 ? 'major_discrepancy' : 
                Math.abs(variance) > 0.01 ? 'variance_detected' : 'balanced',
        isApproved: Math.random() > 0.3, // 70% approved
        approvedBy: Math.random() > 0.3 ? 'admin_user' : undefined,
        approvedAt: Math.random() > 0.3 ? new Date(date.getTime() + 60000) : undefined,
        
        options: {},
        processingTime: Math.floor(Math.random() * 5000) + 1000,
      });
    }

    // Calculate derived fields
    reports.forEach(report => {
      report.actualAmount = report.expectedAmount + report.variance;
      report.variancePercentage = report.expectedAmount > 0 ? (report.variance / report.expectedAmount) * 100 : 0;
      
      report.paymentMethodSummary.forEach(summary => {
        summary.averageAmount = summary.transactionCount > 0 ? summary.totalAmount / summary.transactionCount : 0;
      });
    });

    return reports;
  }
}