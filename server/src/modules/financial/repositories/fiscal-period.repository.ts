import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, isNull, gte, lte } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { fiscalPeriods } from '../../database/schema/financial.schema';

@Injectable()
export class FiscalPeriodRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: {
    fiscalYear: number;
    periodNumber: number;
    periodName: string;
    startDate: Date;
    endDate: Date;
    isYearEnd?: boolean;
  }, userId: string) {
    const [period] = await this.drizzle.getDb()
      .insert(fiscalPeriods)
      .values({
        tenantId,
        ...data,
        isActive: true,
        isClosed: false,
        isYearEnd: data.isYearEnd ?? false,
        yearEndProcessed: false,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return period;
  }

  async findById(tenantId: string, id: string) {
    const [period] = await this.drizzle.getDb()
      .select()
      .from(fiscalPeriods)
      .where(and(
        eq(fiscalPeriods.tenantId, tenantId),
        eq(fiscalPeriods.id, id),
        isNull(fiscalPeriods.deletedAt)
      ));

    return period;
  }

  async findByYearAndPeriod(tenantId: string, fiscalYear: number, periodNumber: number) {
    const [period] = await this.drizzle.getDb()
      .select()
      .from(fiscalPeriods)
      .where(and(
        eq(fiscalPeriods.tenantId, tenantId),
        eq(fiscalPeriods.fiscalYear, fiscalYear),
        eq(fiscalPeriods.periodNumber, periodNumber),
        isNull(fiscalPeriods.deletedAt)
      ));

    return period;
  }

  async findByYear(tenantId: string, fiscalYear: number) {
    const periods = await this.drizzle.getDb()
      .select()
      .from(fiscalPeriods)
      .where(and(
        eq(fiscalPeriods.tenantId, tenantId),
        eq(fiscalPeriods.fiscalYear, fiscalYear),
        isNull(fiscalPeriods.deletedAt)
      ))
      .orderBy(asc(fiscalPeriods.periodNumber));

    return periods;
  }

  async findByDateRange(tenantId: string, startDate: Date, endDate: Date) {
    const periods = await this.drizzle.getDb()
      .select()
      .from(fiscalPeriods)
      .where(and(
        eq(fiscalPeriods.tenantId, tenantId),
        gte(fiscalPeriods.startDate, startDate),
        lte(fiscalPeriods.endDate, endDate),
        isNull(fiscalPeriods.deletedAt)
      ))
      .orderBy(asc(fiscalPeriods.fiscalYear), asc(fiscalPeriods.periodNumber));

    return periods;
  }

  async findCurrentPeriod(tenantId: string, asOfDate?: Date) {
    const date = asOfDate || new Date();
    
    const [period] = await this.drizzle.getDb()
      .select()
      .from(fiscalPeriods)
      .where(and(
        eq(fiscalPeriods.tenantId, tenantId),
        lte(fiscalPeriods.startDate, date),
        gte(fiscalPeriods.endDate, date),
        eq(fiscalPeriods.isActive, true),
        isNull(fiscalPeriods.deletedAt)
      ));

    return period;
  }

  async findOpenPeriods(tenantId: string) {
    const periods = await this.drizzle.getDb()
      .select()
      .from(fiscalPeriods)
      .where(and(
        eq(fiscalPeriods.tenantId, tenantId),
        eq(fiscalPeriods.isActive, true),
        eq(fiscalPeriods.isClosed, false),
        isNull(fiscalPeriods.deletedAt)
      ))
      .orderBy(asc(fiscalPeriods.fiscalYear), asc(fiscalPeriods.periodNumber));

    return periods;
  }

  async update(tenantId: string, id: string, data: {
    periodName?: string;
    startDate?: Date;
    endDate?: Date;
    isActive?: boolean;
  }, userId: string) {
    const [period] = await this.drizzle.getDb()
      .update(fiscalPeriods)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(fiscalPeriods.tenantId, tenantId),
        eq(fiscalPeriods.id, id),
        isNull(fiscalPeriods.deletedAt)
      ))
      .returning();

    return period;
  }

  async closePeriod(tenantId: string, id: string, userId: string) {
    const [period] = await this.drizzle.getDb()
      .update(fiscalPeriods)
      .set({
        isClosed: true,
        closedAt: new Date(),
        closedBy: userId,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(fiscalPeriods.tenantId, tenantId),
        eq(fiscalPeriods.id, id),
        eq(fiscalPeriods.isClosed, false),
        isNull(fiscalPeriods.deletedAt)
      ))
      .returning();

    return period;
  }

  async processYearEnd(tenantId: string, id: string, userId: string) {
    const [period] = await this.drizzle.getDb()
      .update(fiscalPeriods)
      .set({
        yearEndProcessed: true,
        yearEndProcessedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(fiscalPeriods.tenantId, tenantId),
        eq(fiscalPeriods.id, id),
        eq(fiscalPeriods.isYearEnd, true),
        eq(fiscalPeriods.yearEndProcessed, false),
        isNull(fiscalPeriods.deletedAt)
      ))
      .returning();

    return period;
  }

  async createStandardFiscalYear(tenantId: string, fiscalYear: number, startDate: Date, userId: string) {
    const periods = [];
    const currentDate = new Date(startDate);

    for (let month = 1; month <= 12; month++) {
      const periodStartDate = new Date(currentDate);
      const periodEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); // Last day of month

      const period = await this.create(tenantId, {
        fiscalYear,
        periodNumber: month,
        periodName: `Period ${month} - ${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`,
        startDate: periodStartDate,
        endDate: periodEndDate,
        isYearEnd: month === 12,
      }, userId);

      periods.push(period);

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return periods;
  }

  async delete(tenantId: string, id: string, userId: string) {
    // Check if period has any transactions
    // This would require joining with journal entries
    // For now, we'll allow deletion if not closed

    const [period] = await this.drizzle.getDb()
      .update(fiscalPeriods)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(fiscalPeriods.tenantId, tenantId),
        eq(fiscalPeriods.id, id),
        eq(fiscalPeriods.isClosed, false),
        isNull(fiscalPeriods.deletedAt)
      ))
      .returning();

    return period;
  }
}