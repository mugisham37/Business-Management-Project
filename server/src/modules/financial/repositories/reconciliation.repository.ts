import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, isNull, gte, lte } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { accountReconciliations } from '../../database/schema/financial.schema';

@Injectable()
export class ReconciliationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: {
    accountId: string;
    reconciliationDate: Date;
    statementDate: Date;
    bookBalance: string;
    statementBalance: string;
    adjustedBalance: string;
    outstandingDebits?: string;
    outstandingCredits?: string;
    notes?: string;
    attachments?: any[];
  }, userId: string) {
    const [reconciliation] = await this.drizzle.getDb()
      .insert(accountReconciliations)
      .values({
        tenantId,
        ...data,
        status: 'unreconciled',
        outstandingDebits: data.outstandingDebits || '0.00',
        outstandingCredits: data.outstandingCredits || '0.00',
        attachments: data.attachments || [],
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return reconciliation;
  }

  async findById(tenantId: string, id: string) {
    const [reconciliation] = await this.drizzle.getDb()
      .select()
      .from(accountReconciliations)
      .where(and(
        eq(accountReconciliations.tenantId, tenantId),
        eq(accountReconciliations.id, id),
        isNull(accountReconciliations.deletedAt)
      ));

    return reconciliation;
  }

  async findByAccount(tenantId: string, accountId: string, options?: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: string;
    limit?: number;
  }) {
    const conditions = [
      eq(accountReconciliations.tenantId, tenantId),
      eq(accountReconciliations.accountId, accountId),
      isNull(accountReconciliations.deletedAt)
    ];

    if (options?.dateFrom) {
      conditions.push(gte(accountReconciliations.reconciliationDate, options.dateFrom));
    }

    if (options?.dateTo) {
      conditions.push(lte(accountReconciliations.reconciliationDate, options.dateTo));
    }

    if (options?.status) {
      conditions.push(eq(accountReconciliations.status, options.status as any));
    }

    const query = this.drizzle.getDb()
      .select()
      .from(accountReconciliations)
      .where(and(...conditions))
      .orderBy(desc(accountReconciliations.reconciliationDate));

    if (options?.limit) {
      query.limit(options.limit);
    }

    const reconciliations = await query;
    return reconciliations;
  }

  async findAll(tenantId: string, options?: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: string;
    accountId?: string;
  }) {
    const conditions = [
      eq(accountReconciliations.tenantId, tenantId),
      isNull(accountReconciliations.deletedAt)
    ];

    if (options?.accountId) {
      conditions.push(eq(accountReconciliations.accountId, options.accountId));
    }

    if (options?.dateFrom) {
      conditions.push(gte(accountReconciliations.reconciliationDate, options.dateFrom));
    }

    if (options?.dateTo) {
      conditions.push(lte(accountReconciliations.reconciliationDate, options.dateTo));
    }

    if (options?.status) {
      conditions.push(eq(accountReconciliations.status, options.status as any));
    }

    const reconciliations = await this.drizzle.getDb()
      .select()
      .from(accountReconciliations)
      .where(and(...conditions))
      .orderBy(desc(accountReconciliations.reconciliationDate));

    return reconciliations;
  }

  async update(tenantId: string, id: string, data: {
    reconciliationDate?: Date;
    statementDate?: Date;
    bookBalance?: string;
    statementBalance?: string;
    adjustedBalance?: string;
    outstandingDebits?: string;
    outstandingCredits?: string;
    notes?: string;
    attachments?: any[];
  }, userId: string) {
    const [reconciliation] = await this.drizzle.getDb()
      .update(accountReconciliations)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(accountReconciliations.tenantId, tenantId),
        eq(accountReconciliations.id, id),
        isNull(accountReconciliations.deletedAt)
      ))
      .returning();

    return reconciliation;
  }

  async markAsReconciled(tenantId: string, id: string, userId: string) {
    const [reconciliation] = await this.drizzle.getDb()
      .update(accountReconciliations)
      .set({
        status: 'reconciled' as any,
        reconciledBy: userId,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(accountReconciliations.tenantId, tenantId),
        eq(accountReconciliations.id, id),
        isNull(accountReconciliations.deletedAt)
      ))
      .returning();

    return reconciliation;
  }

  async markAsDisputed(tenantId: string, id: string, userId: string, notes?: string) {
    const updateData: any = {
      status: 'disputed' as any,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (notes) {
      updateData.notes = notes;
    }

    const [reconciliation] = await this.drizzle.getDb()
      .update(accountReconciliations)
      .set(updateData)
      .where(and(
        eq(accountReconciliations.tenantId, tenantId),
        eq(accountReconciliations.id, id),
        isNull(accountReconciliations.deletedAt)
      ))
      .returning();

    return reconciliation;
  }

  async getLatestReconciliation(tenantId: string, accountId: string) {
    const [reconciliation] = await this.drizzle.getDb()
      .select()
      .from(accountReconciliations)
      .where(and(
        eq(accountReconciliations.tenantId, tenantId),
        eq(accountReconciliations.accountId, accountId),
        isNull(accountReconciliations.deletedAt)
      ))
      .orderBy(desc(accountReconciliations.reconciliationDate))
      .limit(1);

    return reconciliation;
  }

  async delete(tenantId: string, id: string, userId: string) {
    const [reconciliation] = await this.drizzle.getDb()
      .update(accountReconciliations)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(accountReconciliations.tenantId, tenantId),
        eq(accountReconciliations.id, id),
        isNull(accountReconciliations.deletedAt)
      ))
      .returning();

    return reconciliation;
  }

  async getReconciliationSummary(tenantId: string, accountId: string, dateFrom?: Date, dateTo?: Date) {
    const conditions = [
      eq(accountReconciliations.tenantId, tenantId),
      eq(accountReconciliations.accountId, accountId),
      isNull(accountReconciliations.deletedAt)
    ];

    if (dateFrom) {
      conditions.push(gte(accountReconciliations.reconciliationDate, dateFrom));
    }

    if (dateTo) {
      conditions.push(lte(accountReconciliations.reconciliationDate, dateTo));
    }

    const reconciliations = await this.drizzle.getDb()
      .select()
      .from(accountReconciliations)
      .where(and(...conditions))
      .orderBy(desc(accountReconciliations.reconciliationDate));

    const summary = {
      totalReconciliations: reconciliations.length,
      reconciledCount: reconciliations.filter(r => r.status === 'reconciled').length,
      unreconciledCount: reconciliations.filter(r => r.status === 'unreconciled').length,
      disputedCount: reconciliations.filter(r => r.status === 'disputed').length,
      totalOutstandingDebits: reconciliations.reduce((sum, r) => sum + parseFloat(r.outstandingDebits), 0),
      totalOutstandingCredits: reconciliations.reduce((sum, r) => sum + parseFloat(r.outstandingCredits), 0),
      latestReconciliation: reconciliations[0] || null,
    };

    return summary;
  }
}