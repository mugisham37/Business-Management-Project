import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Employee } from './employee.entity';

export class PayrollPeriod {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  periodName!: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty()
  payDate!: Date;

  @ApiProperty()
  periodType!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  totalGrossPay?: number;

  @ApiPropertyOptional()
  totalNetPay?: number;

  @ApiPropertyOptional()
  totalTaxes?: number;

  @ApiPropertyOptional()
  totalDeductions?: number;

  @ApiPropertyOptional()
  processedAt?: Date;

  @ApiPropertyOptional()
  processedBy?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiPropertyOptional()
  deletedAt?: Date;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional()
  payrollRecords?: PayrollRecord[];

  // Computed properties
  @ApiPropertyOptional()
  employeeCount?: number;

  @ApiPropertyOptional()
  daysInPeriod?: number;
}

export class PayrollRecord {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  payrollPeriodId!: string;

  // Hours worked
  @ApiPropertyOptional()
  regularHours?: number;

  @ApiPropertyOptional()
  overtimeHours?: number;

  @ApiPropertyOptional()
  holidayHours?: number;

  @ApiPropertyOptional()
  sickHours?: number;

  @ApiPropertyOptional()
  vacationHours?: number;

  // Pay rates
  @ApiPropertyOptional()
  regularRate?: number;

  @ApiPropertyOptional()
  overtimeRate?: number;

  @ApiPropertyOptional()
  holidayRate?: number;

  // Gross pay calculations
  @ApiPropertyOptional()
  regularPay?: number;

  @ApiPropertyOptional()
  overtimePay?: number;

  @ApiPropertyOptional()
  holidayPay?: number;

  @ApiPropertyOptional()
  commissionPay?: number;

  @ApiPropertyOptional()
  bonusPay?: number;

  @ApiPropertyOptional()
  grossPay?: number;

  // Tax calculations
  @ApiPropertyOptional()
  federalTax?: number;

  @ApiPropertyOptional()
  stateTax?: number;

  @ApiPropertyOptional()
  localTax?: number;

  @ApiPropertyOptional()
  socialSecurityTax?: number;

  @ApiPropertyOptional()
  medicareTax?: number;

  @ApiPropertyOptional()
  unemploymentTax?: number;

  @ApiPropertyOptional()
  totalTaxes?: number;

  // Deductions
  @ApiPropertyOptional()
  healthInsurance?: number;

  @ApiPropertyOptional()
  dentalInsurance?: number;

  @ApiPropertyOptional()
  visionInsurance?: number;

  @ApiPropertyOptional()
  retirement401k?: number;

  @ApiPropertyOptional()
  otherDeductions?: number;

  @ApiPropertyOptional()
  totalDeductions?: number;

  // Net pay
  @ApiPropertyOptional()
  netPay?: number;

  // Commission and bonus details
  @ApiPropertyOptional()
  commissionDetails?: any[];

  @ApiPropertyOptional()
  bonusDetails?: any[];

  // Tax details
  @ApiPropertyOptional()
  taxDetails?: Record<string, any>;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiPropertyOptional()
  approvedAt?: Date;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiPropertyOptional()
  deletedAt?: Date;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional()
  employee?: Employee;

  @ApiPropertyOptional()
  payrollPeriod?: PayrollPeriod;

  // Computed properties
  @ApiPropertyOptional()
  totalHours?: number;

  @ApiPropertyOptional()
  effectiveHourlyRate?: number;

  @ApiPropertyOptional()
  taxRate?: number;

  @ApiPropertyOptional()
  deductionRate?: number;
}

export class CommissionRecord {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiPropertyOptional()
  transactionId?: string;

  @ApiProperty()
  saleAmount!: number;

  @ApiProperty()
  commissionRate!: number;

  @ApiProperty()
  commissionAmount!: number;

  @ApiProperty()
  saleDate!: Date;

  @ApiPropertyOptional()
  payrollPeriodId?: string;

  @ApiPropertyOptional()
  commissionType?: string;

  @ApiPropertyOptional()
  productCategory?: string;

  @ApiPropertyOptional()
  customerType?: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiPropertyOptional()
  deletedAt?: Date;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional()
  employee?: Employee;

  @ApiPropertyOptional()
  payrollPeriod?: PayrollPeriod;

  // Computed properties
  @ApiPropertyOptional()
  isPaid?: boolean;

  @ApiPropertyOptional()
  daysOld?: number;
}