import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  payrollPeriods, 
  payrollRecords, 
  commissionRecords,
  employees
} from '../../database/schema';
import { 
  CreatePayrollPeriodDto,
  UpdatePayrollPeriodDto,
  PayrollCalculationDto,
  CreateCommissionRecordDto,
  UpdateCommissionRecordDto,
  PayrollReportQueryDto,
  CommissionQueryDto
} from '../dto/payroll.dto';
import { eq, and, gte, lte, desc, asc, isNull, count, sql, or } from 'drizzle-orm';
import { PayrollPeriod, PayrollRecord, CommissionRecord } from '../entities/payroll.entity';

@Injectable()
export class PayrollRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  // Payroll Period operations
  async createPayrollPeriod(tenantId: string, data: CreatePayrollPeriodDto, createdBy: string): Promise<PayrollPeriod> {
    const [period] = await this.drizzle.getDb()
      .insert(payrollPeriods)
      .values({
        tenantId,
        createdBy,
        updatedBy: createdBy,
        periodName: data.periodName,
        startDate: data.startDate,
        endDate: data.endDate,
        payDate: data.payDate,
        periodType: data.periodType,
        notes: data.notes,
      })
      .returning();

    return this.mapPayrollPeriodEntity(period);
  }

  async findPayrollPeriodById(tenantId: string, id: string): Promise<PayrollPeriod | null> {
    const [period] = await this.drizzle.getDb()
      .select()
      .from(payrollPeriods)
      .where(and(
        eq(payrollPeriods.tenantId, tenantId),
        eq(payrollPeriods.id, id),
        isNull(payrollPeriods.deletedAt)
      ));

    return period ? this.mapPayrollPeriodEntity(period) : null;
  }

  async findPayrollPeriods(tenantId: string, query: PayrollReportQueryDto): Promise<{ periods: PayrollPeriod[]; total: number }> {
    const conditions = [
      eq(payrollPeriods.tenantId, tenantId),
      isNull(payrollPeriods.deletedAt)
    ];

    if (query.startDate) {
      conditions.push(gte(payrollPeriods.startDate, query.startDate));
    }

    if (query.endDate) {
      conditions.push(lte(payrollPeriods.endDate, query.endDate));
    }

    if (query.periodType) {
      conditions.push(eq(payrollPeriods.periodType, query.periodType));
    }

    if (query.status) {
      conditions.push(eq(payrollPeriods.status, query.status));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await this.drizzle.getDb()
      .select({ count: count() })
      .from(payrollPeriods)
      .where(whereClause);
    
    const totalCount = countResult[0]?.count ?? 0;

    // Get paginated results with safe pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    
    // Use default sort if sortBy is not a valid column
    let orderByExpr;
    if (query.sortBy === 'startDate') {
      orderByExpr = query.sortOrder === 'desc' ? desc(payrollPeriods.startDate) : asc(payrollPeriods.startDate);
    } else if (query.sortBy === 'endDate') {
      orderByExpr = query.sortOrder === 'desc' ? desc(payrollPeriods.endDate) : asc(payrollPeriods.endDate);
    } else if (query.sortBy === 'periodName') {
      orderByExpr = query.sortOrder === 'desc' ? desc(payrollPeriods.periodName) : asc(payrollPeriods.periodName);
    } else {
      orderByExpr = query.sortOrder === 'desc' ? desc(payrollPeriods.startDate) : asc(payrollPeriods.startDate);
    }

    const results = await this.drizzle.getDb()
      .select()
      .from(payrollPeriods)
      .where(whereClause)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset);

    return {
      periods: results.map(period => this.mapPayrollPeriodEntity(period)),
      total: totalCount
    };
  }

  async findOverlappingPeriod(tenantId: string, startDate: Date, endDate: Date): Promise<PayrollPeriod | null> {
    const [period] = await this.drizzle.getDb()
      .select()
      .from(payrollPeriods)
      .where(and(
        eq(payrollPeriods.tenantId, tenantId),
        isNull(payrollPeriods.deletedAt),
        or(
          and(
            lte(payrollPeriods.startDate, startDate.toISOString()),
            gte(payrollPeriods.endDate, startDate.toISOString())
          ),
          and(
            lte(payrollPeriods.startDate, endDate.toISOString()),
            gte(payrollPeriods.endDate, endDate.toISOString())
          ),
          and(
            gte(payrollPeriods.startDate, startDate.toISOString()),
            lte(payrollPeriods.endDate, endDate.toISOString())
          )
        )
      ))
      .limit(1);

    return period ? this.mapPayrollPeriodEntity(period) : null;
  }

  async updatePayrollPeriod(tenantId: string, id: string, data: UpdatePayrollPeriodDto, updatedBy: string): Promise<PayrollPeriod> {
    const updateData: any = {
      updatedBy,
      updatedAt: new Date(),
      version: sql`${payrollPeriods.version} + 1`
    };

    // Only include provided fields
    if (data.periodName !== undefined) updateData.periodName = data.periodName;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.payDate !== undefined) updateData.payDate = data.payDate;
    if (data.periodType !== undefined) updateData.periodType = data.periodType;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.totalGrossPay !== undefined) updateData.totalGrossPay = String(data.totalGrossPay);
    if (data.totalNetPay !== undefined) updateData.totalNetPay = String(data.totalNetPay);
    if (data.totalTaxes !== undefined) updateData.totalTaxes = String(data.totalTaxes);
    if (data.totalDeductions !== undefined) updateData.totalDeductions = String(data.totalDeductions);
    if (data.processedBy !== undefined) updateData.processedBy = data.processedBy;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const result = await this.drizzle.getDb()
      .update(payrollPeriods)
      .set(updateData)
      .where(and(
        eq(payrollPeriods.tenantId, tenantId),
        eq(payrollPeriods.id, id),
        isNull(payrollPeriods.deletedAt)
      ))
      .returning() as any[];

    const period = result[0];
    if (!period) {
      throw new Error('Failed to update payroll period');
    }

    return this.mapPayrollPeriodEntity(period);
  }

  // Payroll Record operations
  async createPayrollRecord(tenantId: string, data: PayrollCalculationDto, createdBy: string): Promise<PayrollRecord> {
    const [record] = await this.drizzle.getDb()
      .insert(payrollRecords)
      .values({
        tenantId,
        createdBy,
        updatedBy: createdBy,
        employeeId: data.employeeId,
        payrollPeriodId: data.payrollPeriodId,
        regularHours: data.regularHours?.toString(),
        overtimeHours: data.overtimeHours?.toString(),
        holidayHours: data.holidayHours?.toString(),
        sickHours: data.sickHours?.toString(),
        vacationHours: data.vacationHours?.toString(),
        regularRate: data.regularRate?.toString(),
        overtimeRate: data.overtimeRate?.toString(),
        holidayRate: data.holidayRate?.toString(),
        regularPay: data.regularPay?.toString(),
        overtimePay: data.overtimePay?.toString(),
        holidayPay: data.holidayPay?.toString(),
        commissionPay: data.commissionPay?.toString(),
        bonusPay: data.bonusPay?.toString(),
        grossPay: data.grossPay?.toString(),
        federalTax: data.federalTax?.toString(),
        stateTax: data.stateTax?.toString(),
        localTax: data.localTax?.toString(),
        socialSecurityTax: data.socialSecurityTax?.toString(),
        medicareTax: data.medicareTax?.toString(),
        unemploymentTax: data.unemploymentTax?.toString(),
        totalTaxes: data.totalTaxes?.toString(),
        healthInsurance: data.healthInsurance?.toString(),
        dentalInsurance: data.dentalInsurance?.toString(),
        visionInsurance: data.visionInsurance?.toString(),
        retirement401k: data.retirement401k?.toString(),
        otherDeductions: data.otherDeductions?.toString(),
        totalDeductions: data.totalDeductions?.toString(),
        netPay: data.netPay?.toString(),
        commissionDetails: data.commissionDetails,
        bonusDetails: data.bonusDetails,
        taxDetails: data.taxDetails,
        status: data.status || 'draft',
        notes: data.notes,
      })
      .returning();

    return this.mapPayrollRecordEntity(record);
  }

  async findPayrollRecordsByPeriod(tenantId: string, payrollPeriodId: string): Promise<PayrollRecord[]> {
    const results = await this.drizzle.getDb()
      .select({
        payrollRecord: payrollRecords,
        employee: employees,
      })
      .from(payrollRecords)
      .leftJoin(employees, eq(payrollRecords.employeeId, employees.id))
      .where(and(
        eq(payrollRecords.tenantId, tenantId),
        eq(payrollRecords.payrollPeriodId, payrollPeriodId),
        isNull(payrollRecords.deletedAt)
      ))
      .orderBy(asc(employees.lastName));

    return results.map(result => {
      const record = this.mapPayrollRecordEntity(result.payrollRecord);
      if (result.employee) {
        record.employee = {
          id: result.employee.id,
          firstName: result.employee.firstName,
          lastName: result.employee.lastName,
          employeeNumber: result.employee.employeeNumber,
          department: result.employee.department,
          position: result.employee.position,
          employmentType: result.employee.employmentType,
        } as any;
      }
      return record;
    });
  }

  async updatePayrollRecord(tenantId: string, id: string, data: Partial<PayrollCalculationDto>, updatedBy: string): Promise<PayrollRecord> {
    const updateData: any = {
      ...data,
      updatedBy,
      updatedAt: new Date(),
      version: sql`${payrollRecords.version} + 1`
    };

    // Convert numbers to strings for decimal fields
    Object.keys(updateData).forEach(key => {
      if (typeof updateData[key] === 'number' && key !== 'version') {
        updateData[key] = updateData[key].toString();
      }
    });

    const [record] = await this.drizzle.getDb()
      .update(payrollRecords)
      .set(updateData)
      .where(and(
        eq(payrollRecords.tenantId, tenantId),
        eq(payrollRecords.id, id),
        isNull(payrollRecords.deletedAt)
      ))
      .returning();

    return this.mapPayrollRecordEntity(record);
  }

  // Commission Record operations
  async createCommissionRecord(tenantId: string, data: CreateCommissionRecordDto & { commissionAmount: number }, createdBy: string): Promise<CommissionRecord> {
    const [commission] = await this.drizzle.getDb()
      .insert(commissionRecords)
      .values({
        tenantId,
        createdBy,
        updatedBy: createdBy,
        employeeId: data.employeeId,
        transactionId: data.transactionId,
        saleAmount: data.saleAmount.toString(),
        commissionRate: data.commissionRate.toString(),
        commissionAmount: data.commissionAmount.toString(),
        saleDate: data.saleDate,
        commissionType: data.commissionType || 'sales',
        productCategory: data.productCategory,
        customerType: data.customerType,
        description: data.description,
        notes: data.notes,
      })
      .returning();

    return this.mapCommissionRecordEntity(commission);
  }

  async findCommissionRecords(tenantId: string, query: CommissionQueryDto): Promise<{ commissions: CommissionRecord[]; total: number }> {
    const conditions = [
      eq(commissionRecords.tenantId, tenantId),
      isNull(commissionRecords.deletedAt)
    ];

    if (query.employeeId) {
      conditions.push(eq(commissionRecords.employeeId, query.employeeId));
    }

    if (query.startDate) {
      conditions.push(gte(commissionRecords.saleDate, query.startDate));
    }

    if (query.endDate) {
      conditions.push(lte(commissionRecords.saleDate, query.endDate));
    }

    if (query.commissionType) {
      conditions.push(eq(commissionRecords.commissionType, query.commissionType));
    }

    if (query.status) {
      conditions.push(eq(commissionRecords.status, query.status));
    }

    if (query.payrollPeriodId) {
      conditions.push(eq(commissionRecords.payrollPeriodId, query.payrollPeriodId));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await this.drizzle.getDb()
      .select({ count: count() })
      .from(commissionRecords)
      .where(whereClause);
    
    const totalCount = countResult[0]?.count ?? 0;

    // Get paginated results with safe pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const results = await this.drizzle.getDb()
      .select({
        commissionRecord: commissionRecords,
        employee: employees,
      })
      .from(commissionRecords)
      .leftJoin(employees, eq(commissionRecords.employeeId, employees.id))
      .where(whereClause)
      .orderBy(desc(commissionRecords.saleDate))
      .limit(limit)
      .offset(offset);

    return {
      commissions: results.map(result => {
        const commission = this.mapCommissionRecordEntity(result.commissionRecord);
        if (result.employee) {
          commission.employee = {
            id: result.employee.id,
            firstName: result.employee.firstName,
            lastName: result.employee.lastName,
            employeeNumber: result.employee.employeeNumber,
          } as any;
        }
        return commission;
      }),
      total: totalCount
    };
  }

  async updateCommissionRecord(tenantId: string, id: string, data: UpdateCommissionRecordDto, updatedBy: string): Promise<CommissionRecord> {
    const updateData: any = {
      ...data,
      updatedBy,
      updatedAt: new Date(),
      version: sql`${commissionRecords.version} + 1`
    };

    // Convert numbers to strings for decimal fields
    Object.keys(updateData).forEach(key => {
      if (typeof updateData[key] === 'number' && key !== 'version') {
        updateData[key] = updateData[key].toString();
      }
    });

    const [commission] = await this.drizzle.getDb()
      .update(commissionRecords)
      .set(updateData)
      .where(and(
        eq(commissionRecords.tenantId, tenantId),
        eq(commissionRecords.id, id),
        isNull(commissionRecords.deletedAt)
      ))
      .returning();

    return this.mapCommissionRecordEntity(commission);
  }

  // Helper methods to map database records to entities
  private mapPayrollPeriodEntity(record: any): PayrollPeriod {
    return {
      id: record.id,
      tenantId: record.tenantId,
      periodName: record.periodName,
      startDate: record.startDate,
      endDate: record.endDate,
      payDate: record.payDate,
      periodType: record.periodType,
      status: record.status,
      totalGrossPay: record.totalGrossPay ? parseFloat(record.totalGrossPay) : 0,
      totalNetPay: record.totalNetPay ? parseFloat(record.totalNetPay) : 0,
      totalTaxes: record.totalTaxes ? parseFloat(record.totalTaxes) : 0,
      totalDeductions: record.totalDeductions ? parseFloat(record.totalDeductions) : 0,
      processedAt: record.processedAt,
      processedBy: record.processedBy,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      deletedAt: record.deletedAt,
      version: record.version,
      isActive: record.isActive,
    };
  }

  private mapPayrollRecordEntity(record: any): PayrollRecord {
    return {
      id: record.id,
      tenantId: record.tenantId,
      employeeId: record.employeeId,
      payrollPeriodId: record.payrollPeriodId,
      regularHours: record.regularHours ? parseFloat(record.regularHours) : 0,
      overtimeHours: record.overtimeHours ? parseFloat(record.overtimeHours) : 0,
      holidayHours: record.holidayHours ? parseFloat(record.holidayHours) : 0,
      sickHours: record.sickHours ? parseFloat(record.sickHours) : 0,
      vacationHours: record.vacationHours ? parseFloat(record.vacationHours) : 0,
      regularRate: record.regularRate ? parseFloat(record.regularRate) : 0,
      overtimeRate: record.overtimeRate ? parseFloat(record.overtimeRate) : 0,
      holidayRate: record.holidayRate ? parseFloat(record.holidayRate) : 0,
      regularPay: record.regularPay ? parseFloat(record.regularPay) : 0,
      overtimePay: record.overtimePay ? parseFloat(record.overtimePay) : 0,
      holidayPay: record.holidayPay ? parseFloat(record.holidayPay) : 0,
      commissionPay: record.commissionPay ? parseFloat(record.commissionPay) : 0,
      bonusPay: record.bonusPay ? parseFloat(record.bonusPay) : 0,
      grossPay: record.grossPay ? parseFloat(record.grossPay) : 0,
      federalTax: record.federalTax ? parseFloat(record.federalTax) : 0,
      stateTax: record.stateTax ? parseFloat(record.stateTax) : 0,
      localTax: record.localTax ? parseFloat(record.localTax) : 0,
      socialSecurityTax: record.socialSecurityTax ? parseFloat(record.socialSecurityTax) : 0,
      medicareTax: record.medicareTax ? parseFloat(record.medicareTax) : 0,
      unemploymentTax: record.unemploymentTax ? parseFloat(record.unemploymentTax) : 0,
      totalTaxes: record.totalTaxes ? parseFloat(record.totalTaxes) : 0,
      healthInsurance: record.healthInsurance ? parseFloat(record.healthInsurance) : 0,
      dentalInsurance: record.dentalInsurance ? parseFloat(record.dentalInsurance) : 0,
      visionInsurance: record.visionInsurance ? parseFloat(record.visionInsurance) : 0,
      retirement401k: record.retirement401k ? parseFloat(record.retirement401k) : 0,
      otherDeductions: record.otherDeductions ? parseFloat(record.otherDeductions) : 0,
      totalDeductions: record.totalDeductions ? parseFloat(record.totalDeductions) : 0,
      netPay: record.netPay ? parseFloat(record.netPay) : 0,
      commissionDetails: record.commissionDetails,
      bonusDetails: record.bonusDetails,
      taxDetails: record.taxDetails,
      status: record.status,
      approvedBy: record.approvedBy,
      approvedAt: record.approvedAt,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      deletedAt: record.deletedAt,
      version: record.version,
      isActive: record.isActive,
    };
  }

  private mapCommissionRecordEntity(record: any): CommissionRecord {
    return {
      id: record.id,
      tenantId: record.tenantId,
      employeeId: record.employeeId,
      transactionId: record.transactionId,
      saleAmount: record.saleAmount ? parseFloat(record.saleAmount) : 0,
      commissionRate: record.commissionRate ? parseFloat(record.commissionRate) : 0,
      commissionAmount: record.commissionAmount ? parseFloat(record.commissionAmount) : 0,
      saleDate: record.saleDate,
      payrollPeriodId: record.payrollPeriodId,
      commissionType: record.commissionType,
      productCategory: record.productCategory,
      customerType: record.customerType,
      status: record.status,
      description: record.description,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      deletedAt: record.deletedAt,
      version: record.version,
      isActive: record.isActive,
      isPaid: record.status === 'paid',
    };
  }
}