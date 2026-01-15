import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Employee {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiProperty()
  employeeNumber!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiPropertyOptional()
  middleName?: string;

  @ApiPropertyOptional()
  displayName?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional()
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };

  @ApiPropertyOptional()
  department?: string;

  @ApiProperty()
  position!: string;

  @ApiProperty()
  employmentType!: string;

  @ApiProperty()
  employmentStatus!: string;

  @ApiProperty()
  hireDate!: Date;

  @ApiPropertyOptional()
  terminationDate?: Date;

  @ApiPropertyOptional()
  probationEndDate?: Date;

  @ApiPropertyOptional()
  baseSalary?: number;

  @ApiPropertyOptional()
  hourlyRate?: number;

  @ApiPropertyOptional()
  payFrequency?: string;

  @ApiPropertyOptional()
  benefits?: Record<string, any>;

  @ApiPropertyOptional()
  settings?: Record<string, any>;

  @ApiPropertyOptional()
  managerId?: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiPropertyOptional()
  documents?: any[];

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  customFields?: Record<string, any>;

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

  // Computed properties
  @ApiPropertyOptional()
  fullName?: string;

  @ApiPropertyOptional()
  manager?: Employee;

  @ApiPropertyOptional()
  directReports?: Employee[];

  @ApiPropertyOptional()
  user?: any; // User entity if linked
}

export class EmployeeSchedule {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  scheduleDate!: Date;

  @ApiProperty()
  startTime!: Date;

  @ApiProperty()
  endTime!: Date;

  @ApiPropertyOptional()
  breakDuration?: number;

  @ApiPropertyOptional()
  lunchBreakStart?: Date;

  @ApiPropertyOptional()
  lunchBreakEnd?: Date;

  @ApiPropertyOptional()
  scheduleType?: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  locationId?: string;

  @ApiPropertyOptional()
  department?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiPropertyOptional()
  approvedAt?: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional()
  employee?: Employee;

  // Computed properties
  @ApiPropertyOptional()
  totalHours?: number;
}

export class TimeEntry {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  clockInTime!: Date;

  @ApiPropertyOptional()
  clockOutTime?: Date;

  @ApiPropertyOptional()
  totalHours?: number;

  @ApiPropertyOptional()
  regularHours?: number;

  @ApiPropertyOptional()
  overtimeHours?: number;

  @ApiPropertyOptional()
  breakStartTime?: Date;

  @ApiPropertyOptional()
  breakEndTime?: Date;

  @ApiPropertyOptional()
  totalBreakTime?: number;

  @ApiProperty()
  entryType!: string;

  @ApiPropertyOptional()
  locationId?: string;

  @ApiPropertyOptional()
  department?: string;

  @ApiPropertyOptional()
  clockInLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };

  @ApiPropertyOptional()
  clockOutLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };

  @ApiProperty()
  isApproved!: boolean;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiPropertyOptional()
  approvedAt?: Date;

  @ApiPropertyOptional()
  adjustmentReason?: string;

  @ApiPropertyOptional()
  adjustedBy?: string;

  @ApiPropertyOptional()
  adjustedAt?: Date;

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

  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional()
  employee?: Employee;

  // Computed properties
  @ApiPropertyOptional()
  isCurrentlyWorking?: boolean;

  @ApiPropertyOptional()
  workDuration?: number; // in minutes
}

export class PerformanceReview {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  reviewerId!: string;

  @ApiProperty()
  reviewPeriodStart!: Date;

  @ApiProperty()
  reviewPeriodEnd!: Date;

  @ApiPropertyOptional()
  reviewType?: string;

  @ApiPropertyOptional()
  overallRating?: string;

  @ApiPropertyOptional()
  goals?: any[];

  @ApiPropertyOptional()
  achievements?: any[];

  @ApiPropertyOptional()
  areasForImprovement?: any[];

  @ApiPropertyOptional()
  ratings?: Record<string, string>;

  @ApiPropertyOptional()
  reviewerComments?: string;

  @ApiPropertyOptional()
  employeeComments?: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  acknowledgedAt?: Date;

  @ApiPropertyOptional()
  nextReviewDate?: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional()
  employee?: Employee;

  @ApiPropertyOptional()
  reviewer?: Employee;
}

export class TrainingRecord {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  trainingName!: string;

  @ApiPropertyOptional()
  trainingType?: string;

  @ApiPropertyOptional()
  provider?: string;

  @ApiPropertyOptional()
  startDate?: Date;

  @ApiPropertyOptional()
  completionDate?: Date;

  @ApiPropertyOptional()
  expirationDate?: Date;

  @ApiPropertyOptional()
  duration?: number;

  @ApiPropertyOptional()
  certificateNumber?: string;

  @ApiPropertyOptional()
  certificationBody?: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  score?: number;

  @ApiPropertyOptional()
  passingScore?: number;

  @ApiPropertyOptional()
  cost?: number;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiPropertyOptional()
  documents?: any[];

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

  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional()
  employee?: Employee;

  // Computed properties
  @ApiPropertyOptional()
  isExpired?: boolean;

  @ApiPropertyOptional()
  daysUntilExpiration?: number;
}

export class EmployeeGoal {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  targetDate!: Date;

  @ApiPropertyOptional()
  completedDate?: Date;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  progress!: number;

  @ApiPropertyOptional()
  metrics?: Record<string, any>;

  @ApiPropertyOptional()
  targetValue?: number;

  @ApiPropertyOptional()
  currentValue?: number;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiPropertyOptional()
  reviewedBy?: string;

  @ApiPropertyOptional()
  lastReviewDate?: Date;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  updates?: any[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  // Relations
  @ApiPropertyOptional()
  employee?: Employee;

  @ApiPropertyOptional()
  approver?: Employee;

  @ApiPropertyOptional()
  reviewer?: Employee;

  // Computed properties
  @ApiPropertyOptional()
  isOverdue?: boolean;

  @ApiPropertyOptional()
  daysRemaining?: number;

  @ApiPropertyOptional()
  progressPercentage?: number;
}