import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsDateString, 
  IsNumber, 
  IsBoolean, 
  IsUUID, 
  IsArray, 
  IsObject,
  ValidateNested,
  Min,
  Max,
  Length,
  IsDecimal,
  IsInt
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// Enums for validation
export enum PayrollPeriodType {
  WEEKLY = 'weekly',
  BI_WEEKLY = 'bi_weekly',
  SEMI_MONTHLY = 'semi_monthly',
  MONTHLY = 'monthly',
}

export enum PayrollStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  PAID = 'paid',
}

export enum CommissionType {
  SALES = 'sales',
  REFERRAL = 'referral',
  BONUS = 'bonus',
}

export enum CommissionStatus {
  PENDING = 'pending',
  CALCULATED = 'calculated',
  PAID = 'paid',
}

// Payroll Period DTOs
export class CreatePayrollPeriodDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  periodName!: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiProperty()
  @IsDateString()
  payDate!: string;

  @ApiProperty({ enum: PayrollPeriodType })
  @IsEnum(PayrollPeriodType)
  periodType!: PayrollPeriodType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayrollPeriodDto extends PartialType(CreatePayrollPeriodDto) {
  @ApiPropertyOptional({ enum: PayrollStatus })
  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  totalGrossPay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  totalNetPay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  totalTaxes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  totalDeductions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  processedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  processedBy?: string;
}

// Payroll Calculation DTO
export class PayrollCalculationDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsUUID()
  payrollPeriodId!: string;

  // Hours worked
  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  regularHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  overtimeHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  holidayHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  sickHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  vacationHours?: number;

  // Pay rates
  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  regularRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  overtimeRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  holidayRate?: number;

  // Gross pay calculations
  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  regularPay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  overtimePay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  holidayPay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  commissionPay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  bonusPay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  grossPay?: number;

  // Tax calculations
  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  federalTax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  stateTax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  localTax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  socialSecurityTax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  medicareTax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  unemploymentTax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  totalTaxes?: number;

  // Deductions
  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  healthInsurance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  dentalInsurance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  visionInsurance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  retirement401k?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  otherDeductions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  totalDeductions?: number;

  // Net pay
  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  netPay?: number;

  // Additional details
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  commissionDetails?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  bonusDetails?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  taxDetails?: Record<string, any>;

  @ApiPropertyOptional({ enum: PayrollStatus })
  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// Commission Record DTOs
export class CreateCommissionRecordDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @ApiProperty()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  saleAmount: number;

  @ApiProperty()
  @IsDecimal({ decimal_digits: '4' })
  @Transform(({ value }) => parseFloat(value))
  commissionRate: number;

  @ApiProperty()
  @IsDateString()
  saleDate: string;

  @ApiPropertyOptional({ enum: CommissionType })
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCommissionRecordDto extends PartialType(CreateCommissionRecordDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  commissionAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  payrollPeriodId?: string;

  @ApiPropertyOptional({ enum: CommissionStatus })
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;
}

// Query DTOs
export class PayrollReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: PayrollPeriodType })
  @IsOptional()
  @IsEnum(PayrollPeriodType)
  periodType?: PayrollPeriodType;

  @ApiPropertyOptional({ enum: PayrollStatus })
  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string = 'startDate';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class CommissionQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: CommissionType })
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @ApiPropertyOptional({ enum: CommissionStatus })
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  payrollPeriodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// Payroll Calculation Request DTO
export class CalculatePayrollDto {
  @ApiProperty()
  @IsUUID()
  payrollPeriodId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID({}, { each: true })
  employeeIds?: string[]; // If not provided, calculate for all active employees
}

// Payroll Approval DTO
export class ApprovePayrollDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}