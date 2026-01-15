import { 
  IsString, 
  IsEmail, 
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
  IsPhoneNumber,
  IsDecimal,
  IsInt
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// Enums for validation
export enum EmploymentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TERMINATED = 'terminated',
  ON_LEAVE = 'on_leave',
  PROBATION = 'probation',
  SUSPENDED = 'suspended',
}

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  TEMPORARY = 'temporary',
  INTERN = 'intern',
  CONSULTANT = 'consultant',
}

export enum PayFrequency {
  WEEKLY = 'weekly',
  BI_WEEKLY = 'bi_weekly',
  SEMI_MONTHLY = 'semi_monthly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
}

export enum ScheduleStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

export enum TimeEntryType {
  REGULAR = 'regular',
  OVERTIME = 'overtime',
  HOLIDAY = 'holiday',
  SICK_LEAVE = 'sick_leave',
  VACATION = 'vacation',
  PERSONAL_LEAVE = 'personal_leave',
  TRAINING = 'training',
}

export enum PerformanceRating {
  OUTSTANDING = 'outstanding',
  EXCEEDS_EXPECTATIONS = 'exceeds_expectations',
  MEETS_EXPECTATIONS = 'meets_expectations',
  BELOW_EXPECTATIONS = 'below_expectations',
  UNSATISFACTORY = 'unsatisfactory',
}

// Address DTO
export class AddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;
}

// Create Employee DTO
export class CreateEmployeeDto {
  @ApiProperty()
  @IsString()
  @Length(1, 50)
  employeeNumber!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  middleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber()
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  department?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  position!: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiProperty()
  @IsDateString()
  hireDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  probationEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  baseSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  hourlyRate?: number;

  @ApiPropertyOptional({ enum: PayFrequency })
  @IsOptional()
  @IsEnum(PayFrequency)
  payFrequency?: PayFrequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  benefits?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

// Update Employee DTO
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

// Employee Schedule DTO
export class CreateEmployeeScheduleDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsDateString()
  scheduleDate!: string;

  @ApiProperty()
  @IsDateString()
  startTime!: string;

  @ApiProperty()
  @IsDateString()
  endTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480) // Max 8 hours break
  breakDuration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lunchBreakStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lunchBreakEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduleType?: string;

  @ApiPropertyOptional({ enum: ScheduleStatus })
  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEmployeeScheduleDto extends PartialType(CreateEmployeeScheduleDto) {}

// Time Entry DTO
export class CreateTimeEntryDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsDateString()
  clockInTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clockOutTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  breakStartTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  breakEndTime?: string;

  @ApiPropertyOptional({ enum: TimeEntryType })
  @IsOptional()
  @IsEnum(TimeEntryType)
  entryType?: TimeEntryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  clockInLocation?: { lat: number; lng: number; address?: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  clockOutLocation?: { lat: number; lng: number; address?: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTimeEntryDto extends PartialType(CreateTimeEntryDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  totalHours?: number;

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
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isApproved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approvedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  approvedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adjustmentReason?: string;
}

// Clock In/Out DTOs
export class ClockInDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  location?: { lat: number; lng: number; address?: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ClockOutDto {
  @ApiProperty()
  @IsUUID()
  timeEntryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  location?: { lat: number; lng: number; address?: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// Performance Review DTO
export class CreatePerformanceReviewDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsUUID()
  reviewerId!: string;

  @ApiProperty()
  @IsDateString()
  reviewPeriodStart!: string;

  @ApiProperty()
  @IsDateString()
  reviewPeriodEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewType?: string;

  @ApiPropertyOptional({ enum: PerformanceRating })
  @IsOptional()
  @IsEnum(PerformanceRating)
  overallRating?: PerformanceRating;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  goals?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  achievements?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  areasForImprovement?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  ratings?: Record<string, PerformanceRating>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewerComments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeComments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextReviewDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  acknowledgedAt?: string;
}

export class UpdatePerformanceReviewDto extends PartialType(CreatePerformanceReviewDto) {}

// Training Record DTO
export class CreateTrainingRecordDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  trainingName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trainingType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificationBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  passingScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  documents?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTrainingRecordDto extends PartialType(CreateTrainingRecordDto) {}

// Employee Goal DTO
export class CreateEmployeeGoalDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  targetDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metrics?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  targetValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  @Transform(({ value }) => parseFloat(value))
  currentValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approvedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  updates?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lastReviewDate?: string;
}

export class UpdateEmployeeGoalDto extends PartialType(CreateEmployeeGoalDto) {}

// Query DTOs
export class EmployeeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerId?: string;

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
  sortBy?: string = 'lastName';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

export class TimeEntryQueryDto {
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

  @ApiPropertyOptional({ enum: TimeEntryType })
  @IsOptional()
  @IsEnum(TimeEntryType)
  entryType?: TimeEntryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isApproved?: boolean;

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