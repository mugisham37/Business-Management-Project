import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, isNull, gte, lte } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { accountBalances } from '../../database/schema/financial.schema';

@Injectable()
export class AccountBalanceRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: {
    accountId: string;
    balanceDate: Date;
    openingBalance: string;
    debitMovements: string;
    creditMovements: string;
    closingBalance: string;
    fiscalYear: number;
    fiscalPeriod: number;
    isAdjusted?: boolean;
  }, userId: string) {
    const [balance] = await this.drizzle.getDb()
      .insert(accountBalances)
      .values({
        tenantId,
        ...data,
        isAdjusted: data.isAdjusted ?? false,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return balance;
  }

  async findByAccountAndDate(tenantId: string, accountId: string, balanceDate: Date) {
    const [balance] = await this.drizzle.getDb()
      .select()
      .from(accountBalances)
      .where(and(
        eq(accountBalances.tenantId, tenantId),
        eq(accountBalances.accountId, accountId),
        eq(accountBalances.balanceDate, balanceDate),
        isNull(accountBalances.deletedAt)
      ));

    return balance;
  }

  async findByAccountAndPeriod(tenantId: string, accountId: string, fiscalYear: number, fiscalPeriod: number) {
    const [balance] = await this.drizzle.getDb()
      .select()
      .from(accountBalances)
      .where(and(
        eq(accountBalances.tenantId, tenantId),
        eq(accountBalances.accountId, accountId),
        eq(accountBalances.fiscalYear, fiscalYear),
        eq(accountBalances.fiscalPeriod, fiscalPeriod),
        isNull(accountBalances.deletedAt)
      ));

    return balance;
  }

  async findByPeriod(tenantId: string, fiscalYear: number, fiscalPeriod: number) {
    const balances = await this.drizzle.getDb()
      .select()
      .from(accountBalances)
      .where(and(
        eq(accountBalances.tenantId, tenantId),
        eq(accountBalances.fiscalYear, fiscalYear),
        eq(accountBalances.fiscalPeriod, fiscalPeriod),
        isNull(accountBalances.deletedAt)
      ))
      .orderBy(asc(accountBalances.accountId));

    return balances;
  }

  async findByDateRange(tenantId: string, accountId: string, startDate: Date, endDate: Date) {
    const balances = await this.drizzle.getDb()
      .select()
      .from(accountBalances)
      .where(and(
        eq(accountBalances.tenantId, tenantId),
        eq(accountBalances.accountId, accountId),
        gte(accountBalances.balanceDate, startDate),
        lte(accountBalances.balanceDate, endDate),
        isNull(accountBalances.deletedAt)
      ))
      .orderBy(asc(accountBalances.balanceDate));

    return balances;
  }

  async update(tenantId: string, id: string, data: {
    openingBalance?: string;
    debitMovements?: string;
    creditMovements?: string;
    closingBalance?: string;
    isAdjusted?: boolean;
  }, userId: string) {
    const [balance] = await this.drizzle.getDb()
      .update(accountBalances)
      .set({
        ...data,
        lastUpdated: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(accountBalances.tenantId, tenantId),
        eq(accountBalances.id, id),
        isNull(accountBalances.deletedAt)
      ))
      .returning();

    return balance;
  }

  async upsertBalance(tenantId: string, data: {
    accountId: string;
    balanceDate: Date;
    openingBalance: string;
    debitMovements: string;
    creditMovements: string;
    closingBalance: string;
    fiscalYear: number;
    fiscalPeriod: number;
    isAdjusted?: boolean;
  }, userId: string) {
    // Try to find existing balance
    const existing = await this.findByAccountAndDate(tenantId, data.accountId, data.balanceDate);

    if (existing) {
      // Update existing
      const updateData: any = {
        openingBalance: data.openingBalance,
        debitMovements: data.debitMovements,
        creditMovements: data.creditMovements,
        closingBalance: data.closingBalance,
      };

      if (data.isAdjusted !== undefined) {
        updateData.isAdjusted = data.isAdjusted;
      }

      return await this.update(tenantId, existing.id, updateData, userId);
    } else {
      // Create new
      return await this.create(tenantId, data, userId);
    }
  }

  async getLatestBalance(tenantId: string, accountId: string) {
    const [balance] = await this.drizzle.getDb()
      .select()
      .from(accountBalances)
      .where(and(
        eq(accountBalances.tenantId, tenantId),
        eq(accountBalances.accountId, accountId),
        isNull(accountBalances.deletedAt)
      ))
      .orderBy(desc(accountBalances.balanceDate))
      .limit(1);

    return balance;
  }

  async calculatePeriodMovements(tenantId: string, accountId: string, startDate: Date, endDate: Date) {
    // This would typically involve joining with journal entry lines
    // For now, return a placeholder structure
    return {
      openingBalance: '0.00',
      debitMovements: '0.00',
      creditMovements: '0.00',
      closingBalance: '0.00',
    };
  }
}