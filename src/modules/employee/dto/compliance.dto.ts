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
  IsInt
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// Enums for validation
export enum ComplianceCheckType {
  LABOR_LAW_COMPLIANCE = 'labor_law_compliance',
  BREAK_TIME_COMPLIANCE = 'break_time_compliance',
  OVERTIME_COMPLIANCE = 'overtime_compliance',
  SAFETY_COMPLIANCE = 'safety_compliance',
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  VIOLATIONS_FOUND = 'violations_found',
  PENDING_REVIEW = 'pending_review',
  REMEDIATED = 'remediated',
}

export enum ViolationType {
  DAILY_HOURS_EXCEEDED = 'daily_hours_exceeded',
  WEEKLY_HOURS_EXCEEDED = 'weekly_hours_exceeded',
  INSUFFICIENT_BREAK_TIME = 'insufficient_break_time',
  INSUFFICIENT_BREAK_TIME_EXTENDED = 'insufficient_break_time_extended',
  CONSECUTIVE_WORK_DAYS_EXCEEDED = 'consecutive_work_days_exceeded',
  INSUFFICIENT_REST_PERIOD = 'insufficient_rest_period',
  OVERTIME_WITHOUT_APPROVAL = 'overtime_without_approval',
  SAFETY_VIOLATION = 'safety_violation',
}

export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum BreakType {
  MEAL_BREAK = 'meal_break',
  REST_BREAK = 'rest_break',
  PERSONAL_BREAK = 'personal_break',
  SMOKE_BREAK = 'smoke_break',
}

// Compliance Check DTOs
export class ComplianceCheckDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsDateString()
  checkDate!: string;

  @ApiProperty({ enum: ComplianceCheckType })
  @IsEnum(ComplianceCheckType)
  checkType!: ComplianceCheckType;

  @ApiProperty({ enum: ComplianceStatus })
  @IsEnum(ComplianceStatus)
  status!: ComplianceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  violations?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  totalViolations?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}

export class UpdateComplianceCheckDto extends PartialType(ComplianceCheckDto) {}

// Break Time DTOs
export class BreakTimeDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsDateString()
  startTime!: string;

  @ApiProperty()
  @IsDateString()
  endTime!: string;

  @ApiProperty({ enum: BreakType })
  @IsEnum(BreakType)
  breakType!: BreakType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number; // in minutes

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBreakTimeDto extends PartialType(BreakTimeDto) {}

// Labor Law Violation DTOs
export class LaborLawViolationDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  complianceCheckId?: string;

  @ApiProperty({ enum: ViolationType })
  @IsEnum(ViolationType)
  violationType!: ViolationType;

  @ApiProperty()
  @IsDateString()
  violationDate!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 500)
  description!: string;

  @ApiProperty({ enum: ViolationSeverity })
  @IsEnum(ViolationSeverity)
  severity!: ViolationSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  correctedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correctedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLaborLawViolationDto extends PartialType(LaborLawViolationDto) {}

// Compliance Report DTOs
export class ComplianceReportDto {
  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ enum: ComplianceCheckType })
  @IsOptional()
  @IsEnum(ComplianceCheckType)
  checkType?: ComplianceCheckType;

  @ApiPropertyOptional({ enum: ViolationType })
  @IsOptional()
  @IsEnum(ViolationType)
  violationType?: ViolationType;

  @ApiPropertyOptional({ enum: ViolationSeverity })
  @IsOptional()
  @IsEnum(ViolationSeverity)
  severity?: ViolationSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeRemediated?: boolean;
}

// Audit Trail DTOs
export class AuditTrailQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  performedBy?: string;

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
  limit?: number = 50;
}

// Compliance Remediation DTOs
export class ComplianceRemediationDto {
  @ApiProperty()
  @IsUUID()
  violationId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 1000)
  correctiveAction!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetCompletionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateComplianceRemediationDto extends PartialType(ComplianceRemediationDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  completedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  completionNotes?: string;
}

// Compliance Settings DTOs
export class ComplianceSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  maxDailyHours?: number = 12;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  maxWeeklyHours?: number = 52;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxConsecutiveDays?: number = 6;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  minRestHours?: number = 8;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(480)
  minBreakTimeFor6Hours?: number = 30; // minutes

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(480)
  minBreakTimeFor8Hours?: number = 60; // minutes

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableAutomaticChecks?: boolean = true;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notificationEmails?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customRules?: Record<string, any>;
}