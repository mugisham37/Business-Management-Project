/**
 * Employee Type Definitions
 * TypeScript interfaces for employee-related data structures
 */

// Core Employee Types
export interface Employee {
  id: string;
  tenantId: string;
  userId?: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: Address;
  department?: string;
  position: string;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  hireDate: Date;
  terminationDate?: Date;
  probationEndDate?: Date;
  baseSalary?: number;
  hourlyRate?: number;
  payFrequency?: PayFrequency;
  benefits?: Record<string, any>;
  settings?: Record<string, any>;
  managerId?: string;
  avatar?: string;
  documents?: any[];
  notes?: string;
  customFields?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: Date;
  version: number;
  isActive: boolean;
  
  // Computed properties
  fullName?: string;
  manager?: Employee;
  directReports?: Employee[];
  user?: any;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

// Employee Schedule Types
export interface EmployeeSchedule {
  id: string;
  tenantId: string;
  employeeId: string;
  scheduleDate: Date;
  startTime: Date;
  endTime: Date;
  breakDuration?: number;
  lunchBreakStart?: Date;
  lunchBreakEnd?: Date;
  scheduleType?: string;
  status: ScheduleStatus;
  locationId?: string;
  department?: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  isActive: boolean;
  
  // Relations
  employee?: Employee;
  
  // Computed properties
  totalHours?: number;
}

// Time Entry Types
export interface TimeEntry {
  id: string;
  tenantId: string;
  employeeId: string;
  clockInTime: Date;
  clockOutTime?: Date;
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  breakStartTime?: Date;
  breakEndTime?: Date;
  totalBreakTime?: number;
  entryType: TimeEntryType;
  locationId?: string;
  department?: string;
  clockInLocation?: Location;
  clockOutLocation?: Location;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  adjustmentReason?: string;
  adjustedBy?: string;
  adjustedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  isActive: boolean;
  
  // Relations
  employee?: Employee;
  
  // Computed properties
  isCurrentlyWorking?: boolean;
  workDuration?: number;
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

// Performance Review Types
export interface PerformanceReview {
  id: string;
  tenantId: string;
  employeeId: string;
  reviewerId: string;
  reviewPeriodStart: Date;
  reviewPeriodEnd: Date;
  reviewType?: string;
  overallRating?: PerformanceRating;
  goals?: any[];
  achievements?: any[];
  areasForImprovement?: any[];
  ratings?: Record<string, string>;
  reviewerComments?: string;
  employeeComments?: string;
  status: string;
  completedAt?: Date;
  acknowledgedAt?: Date;
  nextReviewDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  isActive: boolean;
  
  // Relations
  employee?: Employee;
  reviewer?: Employee;
}

// Training Record Types
export interface TrainingRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  trainingName: string;
  trainingType?: string;
  provider?: string;
  startDate?: Date;
  completionDate?: Date;
  expirationDate?: Date;
  duration?: number;
  certificateNumber?: string;
  certificationBody?: string;
  status: string;
  score?: number;
  passingScore?: number;
  cost?: number;
  approvedBy?: string;
  documents?: any[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  isActive: boolean;
  
  // Relations
  employee?: Employee;
  
  // Computed properties
  isExpired?: boolean;
  daysUntilExpiration?: number;
}

// Employee Goal Types
export interface EmployeeGoal {
  id: string;
  tenantId: string;
  employeeId: string;
  title: string;
  description?: string;
  category?: string;
  startDate: Date;
  targetDate: Date;
  completedDate?: Date;
  status: string;
  progress: number;
  metrics?: Record<string, any>;
  targetValue?: number;
  currentValue?: number;
  approvedBy?: string;
  reviewedBy?: string;
  lastReviewDate?: Date;
  notes?: string;
  updates?: any[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  isActive: boolean;
  
  // Relations
  employee?: Employee;
  approver?: Employee;
  reviewer?: Employee;
  
  // Computed properties
  isOverdue?: boolean;
  daysRemaining?: number;
  progressPercentage?: number;
}

// Enums
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

// Input Types
export interface CreateEmployeeInput {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: Address;
  department?: string;
  position: string;
  employmentType?: EmploymentType;
  employmentStatus?: EmploymentStatus;
  hireDate: string;
  terminationDate?: string;
  probationEndDate?: string;
  baseSalary?: number;
  hourlyRate?: number;
  payFrequency?: PayFrequency;
  managerId?: string;
  userId?: string;
  notes?: string;
  benefits?: Record<string, any>;
  settings?: Record<string, any>;
  customFields?: Record<string, any>;
}

export interface UpdateEmployeeInput {
  employeeNumber?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  employmentType?: EmploymentType;
  employmentStatus?: EmploymentStatus;
  terminationDate?: string;
  probationEndDate?: string;
  baseSalary?: number;
  hourlyRate?: number;
  payFrequency?: PayFrequency;
  managerId?: string;
  notes?: string;
}

export interface EmployeeQueryInput {
  search?: string;
  department?: string;
  position?: string;
  employmentStatus?: EmploymentStatus;
  employmentType?: EmploymentType;
  managerId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TimeEntryQueryInput {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  entryType?: TimeEntryType;
  isApproved?: boolean;
  page?: number;
  limit?: number;
}

// Connection Types
export interface EmployeeConnection {
  employees: Employee[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Analytics Types
export interface EmployeeAnalytics {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  attendanceRate: number;
  performanceScore: number;
  goalsCompleted: number;
  trainingCompleted: number;
  productivityMetrics: Record<string, any>;
  timeDistribution: Record<string, number>;
  departmentComparison: Record<string, any>;
}

// Real-time Event Types
export interface EmployeeActivityEvent {
  type: string;
  timestamp: Date;
  employeeId: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface ManagerNotification {
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: Date;
  employeeId: string;
  message: string;
  actionRequired: boolean;
  data?: any;
}

// Dashboard Types
export interface EmployeeDashboardData {
  totalEmployees: number;
  activeEmployees: number;
  newHires: number;
  pendingApprovals: number;
  recentActivity: EmployeeActivityEvent[];
  upcomingReviews: PerformanceReview[];
  expiringTraining: TrainingRecord[];
  departmentBreakdown: Record<string, number>;
  attendanceOverview: {
    present: number;
    absent: number;
    late: number;
  };
}

// Form Types
export interface EmployeeFormData extends CreateEmployeeInput {
  id?: string;
}

export interface TimeEntryFormData {
  employeeId: string;
  clockInTime: string;
  clockOutTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
  entryType?: TimeEntryType;
  locationId?: string;
  department?: string;
  notes?: string;
}

// Filter and Sort Types
export interface EmployeeFilters {
  search?: string;
  departments?: string[];
  positions?: string[];
  employmentStatuses?: EmploymentStatus[];
  employmentTypes?: EmploymentType[];
  managers?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface EmployeeSortOptions {
  field: keyof Employee;
  direction: 'asc' | 'desc';
}

// Export/Import Types
export interface EmployeeExportOptions {
  format: 'csv' | 'xlsx' | 'pdf';
  fields?: (keyof Employee)[];
  filters?: EmployeeFilters;
}

export interface EmployeeImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  skippedCount: number;
  errors: Array<{
    row: number;
    message: string;
    timestamp: Date;
  }>;
}