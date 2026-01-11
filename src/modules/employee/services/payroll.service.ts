import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PayrollRepository } from '../repositories/payroll.repository';
import { EmployeeRepository } from '../repositories/employee.repository';
import { 
  CreatePayrollPeriodDto,
  UpdatePayrollPeriodDto,
  CreateCommissionRecordDto,
  PayrollCalculationDto,
  PayrollReportQueryDto,
  PayrollStatus,
  CommissionStatus,
} from '../dto/payroll.dto';
import { EmploymentStatus } from '../dto/employee.dto';
import { PayrollPeriod, PayrollRecord, CommissionRecord } from '../entities/payroll.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PayrollService {
  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly employeeRepository: EmployeeRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Payroll Period Management
  async createPayrollPeriod(tenantId: string, data: CreatePayrollPeriodDto, createdBy: string): Promise<PayrollPeriod> {
    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const payDate = new Date(data.payDate);

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    if (payDate < endDate) {
      throw new BadRequestException('Pay date must be on or after end date');
    }

    // Check for overlapping periods
    const overlappingPeriod = await this.payrollRepository.findOverlappingPeriod(
      tenantId,
      startDate,
      endDate
    );

    if (overlappingPeriod) {
      throw new BadRequestException('Payroll period overlaps with existing period');
    }

    const period = await this.payrollRepository.createPayrollPeriod(tenantId, data, createdBy);

    // Emit event for payroll period creation
    this.eventEmitter.emit('payroll.period.created', {
      tenantId,
      periodId: period.id,
      period,
      createdBy,
    });

    return period;
  }

  async findPayrollPeriods(tenantId: string, query: PayrollReportQueryDto): Promise<{ periods: PayrollPeriod[]; total: number }> {
    return this.payrollRepository.findPayrollPeriods(tenantId, query);
  }

  async findPayrollPeriodById(tenantId: string, id: string): Promise<PayrollPeriod> {
    const period = await this.payrollRepository.findPayrollPeriodById(tenantId, id);
    if (!period) {
      throw new NotFoundException(`Payroll period with ID ${id} not found`);
    }
    return period;
  }

  async updatePayrollPeriod(tenantId: string, id: string, data: UpdatePayrollPeriodDto, updatedBy: string): Promise<PayrollPeriod> {
    // Verify period exists and is not processed
    const period = await this.findPayrollPeriodById(tenantId, id);
    
    if (period.status === 'completed' || period.status === 'paid') {
      throw new BadRequestException('Cannot update completed or paid payroll period');
    }

    const updatedPeriod = await this.payrollRepository.updatePayrollPeriod(tenantId, id, data, updatedBy);

    // Emit event for payroll period update
    this.eventEmitter.emit('payroll.period.updated', {
      tenantId,
      periodId: id,
      period: updatedPeriod,
      updatedBy,
      changes: data,
    });

    return updatedPeriod;
  }

  // Payroll Calculation
  async calculatePayroll(tenantId: string, periodId: string, calculatedBy: string): Promise<PayrollRecord[]> {
    const period = await this.findPayrollPeriodById(tenantId, periodId);
    
    if (period.status !== 'draft') {
      throw new BadRequestException('Can only calculate payroll for draft periods');
    }

    // Get all active employees
    const employees = await this.employeeRepository.findEmployees(tenantId, {
      employmentStatus: EmploymentStatus.ACTIVE,
      page: 1,
      limit: 1000, // Get all employees
    });

    const payrollRecords: PayrollRecord[] = [];

    for (const employee of employees.employees) {
      const payrollRecord = await this.calculateEmployeePayroll(
        tenantId,
        employee.id,
        periodId,
        new Date(period.startDate),
        new Date(period.endDate),
        calculatedBy
      );
      payrollRecords.push(payrollRecord);
    }

    // Update period totals
    const totals = this.calculatePeriodTotals(payrollRecords);
    await this.payrollRepository.updatePayrollPeriod(tenantId, periodId, {
      ...totals,
      status: 'processing',
      processedAt: new Date().toISOString(),
      processedBy: calculatedBy,
    }, calculatedBy);

    // Emit event for payroll calculation
    this.eventEmitter.emit('payroll.calculated', {
      tenantId,
      periodId,
      recordCount: payrollRecords.length,
      totals,
      calculatedBy,
    });

    return payrollRecords;
  }

  private async calculateEmployeePayroll(
    tenantId: string,
    employeeId: string,
    periodId: string,
    startDate: Date,
    endDate: Date,
    calculatedBy: string
  ): Promise<PayrollRecord> {
    // Get employee details
    const employee = await this.employeeRepository.findEmployeeById(tenantId, employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    // Get time entries for the period
    const timeEntries = await this.employeeRepository.findTimeEntries(tenantId, {
      employeeId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isApproved: true,
      page: 1,
      limit: 1000,
    });

    // Calculate hours
    const hours = this.calculateHours(timeEntries.timeEntries);

    // Get commission records for the period
    const commissions = await this.payrollRepository.findCommissionRecords(tenantId, {
      employeeId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: CommissionStatus.PENDING,
    });

    // Calculate pay rates
    const rates = this.calculatePayRates(employee);

    // Calculate gross pay
    const grossPay = this.calculateGrossPay(hours, rates, commissions.commissions);

    // Calculate taxes
    const taxes = this.calculateTaxes(grossPay, employee);

    // Calculate deductions
    const deductions = this.calculateDeductions(grossPay, employee);

    // Calculate net pay
    const netPay = grossPay.total - taxes.total - deductions.total;

    // Create payroll record
    const payrollData: PayrollCalculationDto = {
      employeeId,
      payrollPeriodId: periodId,
      ...hours,
      ...rates,
      ...grossPay,
      ...taxes,
      ...deductions,
      netPay,
      commissionDetails: commissions.commissions.map(c => ({
        id: c.id,
        amount: c.commissionAmount,
        description: c.description,
      })),
      status: PayrollStatus.CALCULATED,
    };

    const payrollRecord = await this.payrollRepository.createPayrollRecord(tenantId, payrollData, calculatedBy);

    // Mark commission records as calculated
    for (const commission of commissions.commissions) {
      await this.payrollRepository.updateCommissionRecord(tenantId, commission.id, {
        status: CommissionStatus.CALCULATED,
        payrollPeriodId: periodId,
      }, calculatedBy);
    }

    return payrollRecord;
  }

  private calculateHours(timeEntries: any[]): any {
    return timeEntries.reduce(
      (acc, entry) => {
        switch (entry.entryType) {
          case 'regular':
            acc.regularHours += entry.regularHours || 0;
            acc.overtimeHours += entry.overtimeHours || 0;
            break;
          case 'holiday':
            acc.holidayHours += entry.totalHours || 0;
            break;
          case 'sick_leave':
            acc.sickHours += entry.totalHours || 0;
            break;
          case 'vacation':
            acc.vacationHours += entry.totalHours || 0;
            break;
        }
        return acc;
      },
      {
        regularHours: 0,
        overtimeHours: 0,
        holidayHours: 0,
        sickHours: 0,
        vacationHours: 0,
      }
    );
  }

  private calculatePayRates(employee: any): any {
    const baseRate = employee.hourlyRate || 0;
    return {
      regularRate: baseRate,
      overtimeRate: baseRate * 1.5, // Time and a half for overtime
      holidayRate: baseRate * 2.0, // Double time for holidays
    };
  }

  private calculateGrossPay(hours: any, rates: any, commissions: any[]): any {
    const regularPay = hours.regularHours * rates.regularRate;
    const overtimePay = hours.overtimeHours * rates.overtimeRate;
    const holidayPay = hours.holidayHours * rates.holidayRate;
    const commissionPay = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const bonusPay = 0; // TODO: Implement bonus calculation

    const total = regularPay + overtimePay + holidayPay + commissionPay + bonusPay;

    return {
      regularPay,
      overtimePay,
      holidayPay,
      commissionPay,
      bonusPay,
      grossPay: total,
      total,
    };
  }

  private calculateTaxes(grossPay: any, employee: any): any {
    // Simplified tax calculation - in production, integrate with tax service
    const federalTaxRate = 0.12; // 12% federal tax
    const stateTaxRate = 0.05; // 5% state tax
    const socialSecurityRate = 0.062; // 6.2% Social Security
    const medicareRate = 0.0145; // 1.45% Medicare

    const federalTax = grossPay.total * federalTaxRate;
    const stateTax = grossPay.total * stateTaxRate;
    const socialSecurityTax = Math.min(grossPay.total * socialSecurityRate, 9932.40); // 2023 SS wage base
    const medicareTax = grossPay.total * medicareRate;

    const total = federalTax + stateTax + socialSecurityTax + medicareTax;

    return {
      federalTax,
      stateTax,
      localTax: 0,
      socialSecurityTax,
      medicareTax,
      unemploymentTax: 0,
      totalTaxes: total,
      total,
    };
  }

  private calculateDeductions(grossPay: any, employee: any): any {
    // Get deductions from employee benefits
    const benefits = employee.benefits || {};
    
    const healthInsurance = benefits.healthInsurance || 0;
    const dentalInsurance = benefits.dentalInsurance || 0;
    const visionInsurance = benefits.visionInsurance || 0;
    const retirement401k = grossPay.total * (benefits.retirement401kPercent || 0) / 100;
    const otherDeductions = benefits.otherDeductions || 0;

    const total = healthInsurance + dentalInsurance + visionInsurance + retirement401k + otherDeductions;

    return {
      healthInsurance,
      dentalInsurance,
      visionInsurance,
      retirement401k,
      otherDeductions,
      totalDeductions: total,
      total,
    };
  }

  private calculatePeriodTotals(payrollRecords: PayrollRecord[]): any {
    return payrollRecords.reduce(
      (acc, record) => {
        acc.totalGrossPay += record.grossPay ?? 0;
        acc.totalNetPay += record.netPay ?? 0;
        acc.totalTaxes += record.totalTaxes ?? 0;
        acc.totalDeductions += record.totalDeductions ?? 0;
        return acc;
      },
      {
        totalGrossPay: 0,
        totalNetPay: 0,
        totalTaxes: 0,
        totalDeductions: 0,
      }
    );
  }

  // Commission Management
  async createCommissionRecord(tenantId: string, data: CreateCommissionRecordDto, createdBy: string): Promise<CommissionRecord> {
    // Verify employee exists
    await this.employeeRepository.findEmployeeById(tenantId, data.employeeId);

    // Calculate commission amount
    const commissionAmount = data.saleAmount * data.commissionRate;

    const commissionData = {
      ...data,
      commissionAmount,
    };

    const commission = await this.payrollRepository.createCommissionRecord(tenantId, commissionData, createdBy);

    // Emit event for commission creation
    this.eventEmitter.emit('payroll.commission.created', {
      tenantId,
      employeeId: data.employeeId,
      commissionId: commission.id,
      commission,
      createdBy,
    });

    return commission;
  }

  async findCommissionRecords(tenantId: string, query: any): Promise<{ commissions: CommissionRecord[]; total: number }> {
    return this.payrollRepository.findCommissionRecords(tenantId, query);
  }

  // Payroll Reports
  async getPayrollSummary(tenantId: string, periodId: string): Promise<any> {
    const period = await this.findPayrollPeriodById(tenantId, periodId);
    const records = await this.payrollRepository.findPayrollRecordsByPeriod(tenantId, periodId);

    const summary = {
      period: {
        id: period.id,
        name: period.periodName,
        startDate: period.startDate,
        endDate: period.endDate,
        payDate: period.payDate,
        status: period.status,
      },
      totals: {
        employeeCount: records.length,
        totalGrossPay: period.totalGrossPay,
        totalNetPay: period.totalNetPay,
        totalTaxes: period.totalTaxes,
        totalDeductions: period.totalDeductions,
      },
      breakdown: {
        byDepartment: this.groupByDepartment(records),
        byEmploymentType: this.groupByEmploymentType(records),
      },
    };

    return summary;
  }

  private groupByDepartment(records: PayrollRecord[]): any {
    const grouped = records.reduce((acc: Record<string, any>, record) => {
      const dept = record.employee?.department || 'Unassigned';
      if (!acc[dept]) {
        acc[dept] = {
          employeeCount: 0,
          totalGrossPay: 0,
          totalNetPay: 0,
        };
      }
      acc[dept].employeeCount++;
      acc[dept].totalGrossPay += record.grossPay ?? 0;
      acc[dept].totalNetPay += record.netPay ?? 0;
      return acc;
    }, {});

    return Object.entries(grouped).map(([department, data]) => ({
      department,
      ...data,
    }));
  }

  private groupByEmploymentType(records: PayrollRecord[]): any {
    const grouped = records.reduce((acc: Record<string, any>, record) => {
      const type = record.employee?.employmentType || 'Unknown';
      if (!acc[type]) {
        acc[type] = {
          employeeCount: 0,
          totalGrossPay: 0,
          totalNetPay: 0,
        };
      }
      acc[type].employeeCount++;
      acc[type].totalGrossPay += record.grossPay ?? 0;
      acc[type].totalNetPay += record.netPay ?? 0;
      return acc;
    }, {});

    return Object.entries(grouped).map(([employmentType, data]) => ({
      employmentType,
      ...data,
    }));
  }


  // Payroll Approval
  async approvePayrollRecord(tenantId: string, recordId: string, approvedBy: string): Promise<PayrollRecord> {
    const record = await this.payrollRepository.updatePayrollRecord(tenantId, recordId, {
      status: PayrollStatus.APPROVED,
      approvedBy,
      approvedAt: new Date().toISOString(),
    }, approvedBy);

    // Emit event for payroll approval
    this.eventEmitter.emit('payroll.record.approved', {
      tenantId,
      recordId,
      record,
      approvedBy,
    });

    return record;
  }

  async approvePayrollPeriod(tenantId: string, periodId: string, approvedBy: string): Promise<PayrollPeriod> {
    // Verify all records in period are calculated
    const records = await this.payrollRepository.findPayrollRecordsByPeriod(tenantId, periodId);
    const unapprovedRecords = records.filter(r => r.status !== PayrollStatus.APPROVED && r.status !== PayrollStatus.PAID);

    if (unapprovedRecords.length > 0) {
      throw new BadRequestException('All payroll records must be approved before approving the period');
    }

    const period = await this.payrollRepository.updatePayrollPeriod(tenantId, periodId, {
      status: PayrollStatus.COMPLETED,
    }, approvedBy);

    // Emit event for period approval
    this.eventEmitter.emit('payroll.period.approved', {
      tenantId,
      periodId,
      period,
      approvedBy,
    });

    return period;
  }
}