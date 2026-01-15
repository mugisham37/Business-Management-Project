import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, isNull, like } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { budgets, budgetLines } from '../../database/schema/financial.schema';

@Injectable()
export class BudgetRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: {
    budgetName: string;
    budgetType: string;
    fiscalYear: number;
    startDate: Date;
    endDate: Date;
    description?: string;
    notes?: string;
  }, userId: string) {
    const [budget] = await this.drizzle.getDb()
      .insert(budgets)
      .values({
        tenantId,
        ...data,
        status: 'draft',
        version: 1,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return budget;
  }

  async findById(tenantId: string, id: string) {
    const [budget] = await this.drizzle.getDb()
      .select()
      .from(budgets)
      .where(and(
        eq(budgets.tenantId, tenantId),
        eq(budgets.id, id),
        isNull(budgets.deletedAt)
      ));

    return budget;
  }

  async findAll(tenantId: string, options?: {
    fiscalYear?: number;
    status?: string;
    budgetType?: string;
  }) {
    const conditions = [
      eq(budgets.tenantId, tenantId),
      isNull(budgets.deletedAt)
    ];

    if (options?.fiscalYear) {
      conditions.push(eq(budgets.fiscalYear, options.fiscalYear));
    }

    if (options?.status) {
      conditions.push(eq(budgets.status, options.status));
    }

    if (options?.budgetType) {
      conditions.push(eq(budgets.budgetType, options.budgetType));
    }

    const budgetList = await this.drizzle.getDb()
      .select()
      .from(budgets)
      .where(and(...conditions))
      .orderBy(desc(budgets.fiscalYear), asc(budgets.budgetName));

    return budgetList;
  }

  async update(tenantId: string, id: string, data: {
    budgetName?: string;
    description?: string;
    notes?: string;
    status?: string;
    approvedBy?: string;
    approvedAt?: Date;
  }, userId: string) {
    const [budget] = await this.drizzle.getDb()
      .update(budgets)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(budgets.tenantId, tenantId),
        eq(budgets.id, id),
        isNull(budgets.deletedAt)
      ))
      .returning();

    return budget;
  }

  async delete(tenantId: string, id: string, userId: string) {
    const [budget] = await this.drizzle.getDb()
      .update(budgets)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(budgets.tenantId, tenantId),
        eq(budgets.id, id),
        isNull(budgets.deletedAt)
      ))
      .returning();

    return budget;
  }

  // Budget Lines methods
  async createBudgetLine(tenantId: string, data: {
    budgetId: string;
    accountId: string;
    annualAmount: string;
    q1Amount?: string;
    q2Amount?: string;
    q3Amount?: string;
    q4Amount?: string;
    monthlyAmounts?: Record<string, any>;
    departmentId?: string;
    projectId?: string;
    locationId?: string;
    notes?: string;
  }, userId: string) {
    const [budgetLine] = await this.drizzle.getDb()
      .insert(budgetLines)
      .values({
        tenantId,
        ...data,
        q1Amount: data.q1Amount || '0.00',
        q2Amount: data.q2Amount || '0.00',
        q3Amount: data.q3Amount || '0.00',
        q4Amount: data.q4Amount || '0.00',
        monthlyAmounts: data.monthlyAmounts || {},
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return budgetLine;
  }

  async findBudgetLines(tenantId: string, budgetId: string) {
    const lines = await this.drizzle.getDb()
      .select()
      .from(budgetLines)
      .where(and(
        eq(budgetLines.tenantId, tenantId),
        eq(budgetLines.budgetId, budgetId),
        isNull(budgetLines.deletedAt)
      ))
      .orderBy(asc(budgetLines.accountId));

    return lines;
  }

  async updateBudgetLine(tenantId: string, lineId: string, data: {
    annualAmount?: string;
    q1Amount?: string;
    q2Amount?: string;
    q3Amount?: string;
    q4Amount?: string;
    monthlyAmounts?: Record<string, any>;
    notes?: string;
  }, userId: string) {
    const [budgetLine] = await this.drizzle.getDb()
      .update(budgetLines)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(budgetLines.tenantId, tenantId),
        eq(budgetLines.id, lineId),
        isNull(budgetLines.deletedAt)
      ))
      .returning();

    return budgetLine;
  }

  async deleteBudgetLine(tenantId: string, lineId: string, userId: string) {
    const [budgetLine] = await this.drizzle.getDb()
      .update(budgetLines)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(budgetLines.tenantId, tenantId),
        eq(budgetLines.id, lineId),
        isNull(budgetLines.deletedAt)
      ))
      .returning();

    return budgetLine;
  }

  async getBudgetWithLines(tenantId: string, budgetId: string) {
    const budget = await this.findById(tenantId, budgetId);
    if (!budget) {
      return null;
    }

    const lines = await this.findBudgetLines(tenantId, budgetId);

    return {
      ...budget,
      lines,
    };
  }
}