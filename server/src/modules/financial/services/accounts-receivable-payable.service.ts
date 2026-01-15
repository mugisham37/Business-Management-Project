import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { 
  arApInvoices, 
  arApInvoiceLines, 
  arApPayments, 
  paymentApplications,
  agingBuckets
} from '../../database/schema/financial.schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';

export interface ARAPInvoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  invoiceType: 'receivable' | 'payable';
  customerId?: string;
  supplierId?: string;
  invoiceDate: Date;
  dueDate: Date;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  paymentTerms?: string;
  paymentTermsDays: number;
  currency: string;
  exchangeRate: number;
  purchaseOrderNumber?: string;
  referenceNumber?: string;
  glAccountId?: string;
  journalEntryId?: string;
  description?: string;
  notes?: string;
  attachments: any[];
}

export interface ARAPPayment {
  id: string;
  tenantId: string;
  paymentNumber: string;
  paymentType: 'received' | 'made';
  customerId?: string;
  supplierId?: string;
  paymentDate: Date;
  paymentMethod: string;
  paymentAmount: number;
  appliedAmount: number;
  unappliedAmount: number;
  currency: string;
  exchangeRate: number;
  bankAccountId?: string;
  checkNumber?: string;
  referenceNumber?: string;
  status: string;
  glAccountId?: string;
  journalEntryId?: string;
  description?: string;
  notes?: string;
  attachments: any[];
}

export interface PaymentApplication {
  id: string;
  tenantId: string;
  paymentId: string;
  invoiceId: string;
  appliedAmount: number;
  discountAmount: number;
  currency: string;
  exchangeRate: number;
  applicationDate: Date;
  journalEntryId?: string;
  notes?: string;
}

export interface AgingReport {
  entityId: string;
  entityName: string;
  entityType: 'customer' | 'supplier';
  totalBalance: number;
  buckets: Array<{
    bucketName: string;
    minDays: number;
    maxDays?: number;
    amount: number;
  }>;
}

export interface CreateInvoiceInput {
  invoiceNumber?: string;
  invoiceType: 'receivable' | 'payable';
  customerId?: string;
  supplierId?: string;
  invoiceDate: Date;
  dueDate?: Date;
  paymentTerms?: string;
  paymentTermsDays?: number;
  currency?: string;
  exchangeRate?: number;
  purchaseOrderNumber?: string;
  referenceNumber?: string;
  description?: string;
  notes?: string;
  lines: Array<{
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRateId?: string;
    discountPercent?: number;
    glAccountId?: string;
    notes?: string;
  }>;
}

export interface CreatePaymentInput {
  paymentNumber?: string;
  paymentType: 'received' | 'made';
  customerId?: string;
  supplierId?: string;
  paymentDate: Date;
  paymentMethod: string;
  paymentAmount: number;
  currency?: string;
  exchangeRate?: number;
  bankAccountId?: string;
  checkNumber?: string;
  referenceNumber?: string;
  description?: string;
  notes?: string;
  applications?: Array<{
    invoiceId: string;
    appliedAmount: number;
    discountAmount?: number;
  }>;
}

@Injectable()
export class AccountsReceivablePayableService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  // Invoice Management
  async createInvoice(tenantId: string, input: CreateInvoiceInput, userId: string): Promise<ARAPInvoice> {
    return await this.drizzle.getDb().transaction(async (tx) => {
      // Generate invoice number if not provided
      if (!input.invoiceNumber) {
        input.invoiceNumber = await this.generateInvoiceNumber(tenantId, input.invoiceType);
      }

      // Calculate due date if not provided
      if (!input.dueDate && input.paymentTermsDays) {
        input.dueDate = new Date(input.invoiceDate);
        input.dueDate.setDate(input.dueDate.getDate() + input.paymentTermsDays);
      }

      // Calculate line totals
      let subtotalAmount = 0;
      let taxAmount = 0;
      let discountAmount = 0;

      for (const line of input.lines) {
        const lineAmount = line.quantity * line.unitPrice;
        const lineDiscount = lineAmount * (line.discountPercent || 0) / 100;
        const lineNet = lineAmount - lineDiscount;
        
        subtotalAmount += lineNet;
        discountAmount += lineDiscount;
        
        // Tax calculation would be done here if taxRateId is provided
        // For now, we'll assume tax is calculated separately
      }

      const totalAmount = subtotalAmount + taxAmount - discountAmount;

      // Create invoice
      const invoice = await tx
        .insert(arApInvoices)
        .values({
          tenantId,
          invoiceNumber: input.invoiceNumber,
          invoiceType: input.invoiceType,
          customerId: input.customerId,
          supplierId: input.supplierId,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate || input.invoiceDate,
          subtotalAmount: subtotalAmount.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          paidAmount: '0.00',
          balanceAmount: totalAmount.toFixed(2),
          status: 'open',
          paymentTerms: input.paymentTerms,
          paymentTermsDays: input.paymentTermsDays || 30,
          currency: input.currency || 'USD',
          exchangeRate: (input.exchangeRate || 1).toFixed(4),
          purchaseOrderNumber: input.purchaseOrderNumber,
          referenceNumber: input.referenceNumber,
          description: input.description,
          notes: input.notes,
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Create invoice lines
      let lineNumber = 1;
      for (const line of input.lines) {
        const lineAmount = line.quantity * line.unitPrice;
        const lineDiscount = lineAmount * (line.discountPercent || 0) / 100;
        const netAmount = lineAmount - lineDiscount;

        await tx
          .insert(arApInvoiceLines)
          .values({
            tenantId,
            invoiceId: invoice[0]?.id || '',
            productId: line.productId,
            lineNumber,
            description: line.description,
            quantity: line.quantity.toString(),
            unitPrice: line.unitPrice.toFixed(2),
            lineAmount: netAmount.toFixed(2),
            taxAmount: '0.00', // Would be calculated based on taxRateId
            taxRateId: line.taxRateId,
            discountPercent: (line.discountPercent || 0).toFixed(2),
            discountAmount: lineDiscount.toFixed(2),
            glAccountId: line.glAccountId,
            notes: line.notes,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
            updatedBy: userId,
          });

        lineNumber++;
      }

      // Create journal entry for the invoice
      if (invoice[0]) {
        await this.createInvoiceJournalEntry(tx, tenantId, invoice[0]);
      }

      return this.transformToARAPInvoice(invoice[0]);
    });
  }

  async getInvoices(
    tenantId: string,
    invoiceType?: 'receivable' | 'payable',
    status?: string,
    customerId?: string,
    supplierId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ARAPInvoice[]> {
    const conditions = [eq(arApInvoices.tenantId, tenantId)];
    
    if (invoiceType) {
      conditions.push(eq(arApInvoices.invoiceType, invoiceType));
    }
    
    if (status) {
      conditions.push(eq(arApInvoices.status, status));
    }
    
    if (customerId) {
      conditions.push(eq(arApInvoices.customerId, customerId));
    }
    
    if (supplierId) {
      conditions.push(eq(arApInvoices.supplierId, supplierId));
    }
    
    if (fromDate) {
      conditions.push(gte(arApInvoices.invoiceDate, fromDate));
    }
    
    if (toDate) {
      conditions.push(lte(arApInvoices.invoiceDate, toDate));
    }

    const invoices = await this.drizzle.getDb()
      .select()
      .from(arApInvoices)
      .where(and(...conditions))
      .orderBy(desc(arApInvoices.invoiceDate));
    
    return invoices.map(invoice => this.transformToARAPInvoice(invoice));
  }

  async getInvoiceById(tenantId: string, invoiceId: string): Promise<ARAPInvoice | null> {
    const result = await this.drizzle.getDb()
      .select()
      .from(arApInvoices)
      .where(
        and(
          eq(arApInvoices.tenantId, tenantId),
          eq(arApInvoices.id, invoiceId)
        )
      )
      .limit(1);

    return result[0] ? this.transformToARAPInvoice(result[0]) : null;
  }

  // Payment Management
  async createPayment(tenantId: string, input: CreatePaymentInput, userId: string): Promise<ARAPPayment> {
    return await this.drizzle.getDb().transaction(async (tx) => {
      // Generate payment number if not provided
      if (!input.paymentNumber) {
        input.paymentNumber = await this.generatePaymentNumber(tenantId, input.paymentType);
      }

      // Create payment
      const payment = await tx
        .insert(arApPayments)
        .values({
          tenantId,
          paymentNumber: input.paymentNumber,
          paymentType: input.paymentType,
          customerId: input.customerId,
          supplierId: input.supplierId,
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod,
          paymentAmount: input.paymentAmount.toFixed(2),
          appliedAmount: '0.00',
          unappliedAmount: input.paymentAmount.toFixed(2),
          currency: input.currency || 'USD',
          exchangeRate: (input.exchangeRate || 1).toFixed(4),
          bankAccountId: input.bankAccountId,
          checkNumber: input.checkNumber,
          referenceNumber: input.referenceNumber,
          status: 'pending',
          description: input.description,
          notes: input.notes,
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Apply payment to invoices if specified
      if (input.applications && input.applications.length > 0) {
        let totalApplied = 0;
        
        for (const application of input.applications) {
          await this.applyPaymentToInvoice(
            tx,
            tenantId,
            payment[0]?.id || '',
            application.invoiceId,
            application.appliedAmount,
            application.discountAmount || 0,
            userId
          );
          
          totalApplied += application.appliedAmount;
        }

        // Update payment applied amounts
        if (payment[0]) {
          await tx
            .update(arApPayments)
            .set({
              appliedAmount: totalApplied.toFixed(2),
              unappliedAmount: (input.paymentAmount - totalApplied).toFixed(2),
              updatedAt: new Date(),
              updatedBy: userId,
            })
            .where(eq(arApPayments.id, payment[0].id));
        }
      }

      // Create journal entry for the payment
      if (payment[0]) {
        await this.createPaymentJournalEntry(tx, tenantId, payment[0]);
      }

      return this.transformToARAPPayment(payment[0]);
    });
  }

  async getPayments(
    tenantId: string,
    paymentType?: 'received' | 'made',
    status?: string,
    customerId?: string,
    supplierId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ARAPPayment[]> {
    const conditions = [eq(arApPayments.tenantId, tenantId)];
    
    if (paymentType) {
      conditions.push(eq(arApPayments.paymentType, paymentType));
    }
    
    if (status) {
      conditions.push(eq(arApPayments.status, status));
    }
    
    if (customerId) {
      conditions.push(eq(arApPayments.customerId, customerId));
    }
    
    if (supplierId) {
      conditions.push(eq(arApPayments.supplierId, supplierId));
    }
    
    if (fromDate) {
      conditions.push(gte(arApPayments.paymentDate, fromDate));
    }
    
    if (toDate) {
      conditions.push(lte(arApPayments.paymentDate, toDate));
    }

    const payments = await this.drizzle.getDb()
      .select()
      .from(arApPayments)
      .where(and(...conditions))
      .orderBy(desc(arApPayments.paymentDate));
    
    return payments.map(payment => this.transformToARAPPayment(payment));
  }

  // Aging Reports
  async generateAgingReport(
    tenantId: string,
    reportType: 'receivable' | 'payable',
    asOfDate: Date = new Date()
  ): Promise<AgingReport[]> {
    // Get aging buckets
    const buckets = await this.drizzle.getDb()
      .select()
      .from(agingBuckets)
      .where(
        and(
          eq(agingBuckets.tenantId, tenantId),
          eq(agingBuckets.bucketType, reportType),
          eq(agingBuckets.isActive, true)
        )
      )
      .orderBy(asc(agingBuckets.displayOrder));

    // Get open invoices
    const invoices = await this.drizzle.getDb()
      .select()
      .from(arApInvoices)
      .where(
        and(
          eq(arApInvoices.tenantId, tenantId),
          eq(arApInvoices.invoiceType, reportType),
          eq(arApInvoices.status, 'open'),
          lte(arApInvoices.invoiceDate, asOfDate)
        )
      );

    // Group by entity (customer or supplier)
    const entityGroups = new Map<string, { name: string; invoices: any[] }>();
    
    for (const invoice of invoices) {
      const entityId = reportType === 'receivable' ? invoice.customerId : invoice.supplierId;
      if (!entityId) continue;

      if (!entityGroups.has(entityId)) {
        // In a real implementation, you'd fetch the customer/supplier name
        entityGroups.set(entityId, { name: `Entity ${entityId}`, invoices: [] });
      }
      
      entityGroups.get(entityId)!.invoices.push(invoice);
    }

    // Calculate aging for each entity
    const agingReports: AgingReport[] = [];
    
    for (const [entityId, group] of entityGroups) {
      const report: AgingReport = {
        entityId,
        entityName: group.name,
        entityType: reportType === 'receivable' ? 'customer' : 'supplier',
        totalBalance: 0,
        buckets: buckets.map(bucket => ({
          bucketName: bucket.bucketName,
          minDays: bucket.minDays,
          ...(bucket.maxDays !== null && { maxDays: bucket.maxDays }),
          amount: 0,
        })),
      };

      for (const invoice of group.invoices) {
        const daysPastDue = Math.floor(
          (asOfDate.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        report.totalBalance += Number(invoice.balanceAmount);

        // Find appropriate bucket
        const bucket = report.buckets.find(b => {
          return daysPastDue >= b.minDays && (b.maxDays === undefined || daysPastDue <= b.maxDays);
        });

        if (bucket) {
          bucket.amount += Number(invoice.balanceAmount);
        }
      }

      if (report.totalBalance > 0) {
        agingReports.push(report);
      }
    }

    return agingReports.sort((a, b) => b.totalBalance - a.totalBalance);
  }

  // Helper Methods
  private async applyPaymentToInvoice(
    tx: any,
    tenantId: string,
    paymentId: string,
    invoiceId: string,
    appliedAmount: number,
    discountAmount: number,
    userId: string
  ): Promise<void> {
    // Create payment application
    await tx
      .insert(paymentApplications)
      .values({
        tenantId,
        paymentId,
        invoiceId,
        appliedAmount,
        discountAmount,
        currency: 'USD',
        exchangeRate: 1,
        applicationDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      });

    // Update invoice balance
    const invoice = await tx
      .select()
      .from(arApInvoices)
      .where(eq(arApInvoices.id, invoiceId))
      .limit(1);

    if (invoice.length > 0) {
      const newPaidAmount = Number(invoice[0].paidAmount) + appliedAmount + discountAmount;
      const newBalanceAmount = Number(invoice[0].totalAmount) - newPaidAmount;
      const newStatus = newBalanceAmount <= 0.01 ? 'paid' : 'open'; // Allow for rounding

      await tx
        .update(arApInvoices)
        .set({
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newStatus,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(arApInvoices.id, invoiceId));
    }
  }

  private async createInvoiceJournalEntry(tx: any, tenantId: string, invoice: any): Promise<void> {
    // This would create the appropriate journal entries for the invoice
    // For AR: Debit AR, Credit Revenue
    // For AP: Debit Expense, Credit AP
    // Implementation would depend on the specific GL account setup
    
    // Placeholder implementation
    console.log(`Creating journal entry for invoice ${invoice.id} in tenant ${tenantId}`);
  }

  private async createPaymentJournalEntry(tx: any, tenantId: string, payment: any): Promise<void> {
    // This would create the appropriate journal entries for the payment
    // For AR payment: Debit Cash, Credit AR
    // For AP payment: Debit AP, Credit Cash
    // Implementation would depend on the specific GL account setup
    
    // Placeholder implementation
    console.log(`Creating journal entry for payment ${payment.id} in tenant ${tenantId}`);
  }

  private async generateInvoiceNumber(tenantId: string, invoiceType: string): Promise<string> {
    const prefix = invoiceType === 'receivable' ? 'INV' : 'BILL';
    const year = new Date().getFullYear();
    
    // Get the next sequence number for this tenant and type
    const lastInvoice = await this.drizzle.getDb()
      .select()
      .from(arApInvoices)
      .where(
        and(
          eq(arApInvoices.tenantId, tenantId),
          eq(arApInvoices.invoiceType, invoiceType),
          sql`EXTRACT(YEAR FROM ${arApInvoices.invoiceDate}) = ${year}`
        )
      )
      .orderBy(desc(arApInvoices.createdAt))
      .limit(1);

    let nextNumber = 1;
    if (lastInvoice.length > 0 && lastInvoice[0]) {
      const lastNumber = lastInvoice[0].invoiceNumber;
      if (lastNumber) {
        const match = lastNumber.match(/(\d+)$/);
        if (match && match[1]) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
    }

    return `${prefix}-${year}-${nextNumber.toString().padStart(6, '0')}`;
  }

  private async generatePaymentNumber(tenantId: string, paymentType: string): Promise<string> {
    const prefix = paymentType === 'received' ? 'PMT' : 'PAY';
    const year = new Date().getFullYear();
    
    // Get the next sequence number for this tenant and type
    const lastPayment = await this.drizzle.getDb()
      .select()
      .from(arApPayments)
      .where(
        and(
          eq(arApPayments.tenantId, tenantId),
          eq(arApPayments.paymentType, paymentType),
          sql`EXTRACT(YEAR FROM ${arApPayments.paymentDate}) = ${year}`
        )
      )
      .orderBy(desc(arApPayments.createdAt))
      .limit(1);

    let nextNumber = 1;
    if (lastPayment.length > 0 && lastPayment[0]) {
      const lastNumber = lastPayment[0].paymentNumber;
      if (lastNumber) {
        const match = lastNumber.match(/(\d+)$/);
        if (match && match[1]) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
    }

    return `${prefix}-${year}-${nextNumber.toString().padStart(6, '0')}`;
  }

  private transformToARAPInvoice(invoice: any): ARAPInvoice {
    return {
      ...invoice,
      subtotalAmount: typeof invoice.subtotalAmount === 'string' ? parseFloat(invoice.subtotalAmount) : invoice.subtotalAmount,
      taxAmount: typeof invoice.taxAmount === 'string' ? parseFloat(invoice.taxAmount) : invoice.taxAmount,
      totalAmount: typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount,
      paidAmount: typeof invoice.paidAmount === 'string' ? parseFloat(invoice.paidAmount) : invoice.paidAmount,
      balanceAmount: typeof invoice.balanceAmount === 'string' ? parseFloat(invoice.balanceAmount) : invoice.balanceAmount,
      discountAmount: typeof invoice.discountAmount === 'string' ? parseFloat(invoice.discountAmount) : invoice.discountAmount,
      invoiceType: invoice.invoiceType as 'receivable' | 'payable',
    } as ARAPInvoice;
  }

  private transformToARAPPayment(payment: any): ARAPPayment {
    return {
      ...payment,
      paymentAmount: typeof payment.paymentAmount === 'string' ? parseFloat(payment.paymentAmount) : payment.paymentAmount,
      appliedAmount: typeof payment.appliedAmount === 'string' ? parseFloat(payment.appliedAmount) : payment.appliedAmount,
      unappliedAmount: typeof payment.unappliedAmount === 'string' ? parseFloat(payment.unappliedAmount) : payment.unappliedAmount,
      exchangeRate: typeof payment.exchangeRate === 'string' ? parseFloat(payment.exchangeRate) : payment.exchangeRate,
      paymentType: payment.paymentType as 'received' | 'made',
    } as ARAPPayment;
  }
}