import { pgTable, varchar, text, boolean, jsonb, index, unique, timestamp, uuid, integer, decimal, date } from 'drizzle-orm/pg-core';
import { baseSchema } from './base.schema';
import { 
  employmentStatusEnum, 
  employmentTypeEnum, 
  payFrequencyEnum, 
  scheduleStatusEnum, 
  timeEntryTypeEnum, 
  performanceRatingEnum,
  payrollPeriodTypeEnum,
  payrollStatusEnum,
  commissionTypeEnum,
  commissionStatusEnum,
  complianceCheckTypeEnum,
  complianceStatusEnum,
  violationTypeEnum,
  violationSeverityEnum,
  breakTypeEnum
} from './enums';
import { tenants } from './tenant.schema';
import { users } from './user.schema';

// Employee profiles table
export const employees: any = pgTable('employees', {
  ...baseSchema,
  
  // Link to user account (optional - employees may not have system access)
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  // Basic employee information
  employeeNumber: varchar('employee_number', { length: 50 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  middleName: varchar('middle_name', { length: 100 }),
  displayName: varchar('display_name', { length: 200 }),
  
  // Contact information
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  emergencyContactName: varchar('emergency_contact_name', { length: 200 }),
  emergencyContactPhone: varchar('emergency_contact_phone', { length: 50 }),
  
  // Address information
  address: jsonb('address').default({}), // {street, city, state, zipCode, country}
  
  // Employment details
  department: varchar('department', { length: 100 }),
  position: varchar('position', { length: 100 }).notNull(),
  employmentType: employmentTypeEnum('employment_type').notNull().default('full_time'),
  employmentStatus: employmentStatusEnum('employment_status').notNull().default('active'),
  
  // Dates
  hireDate: date('hire_date').notNull(),
  terminationDate: date('termination_date'),
  probationEndDate: date('probation_end_date'),
  
  // Compensation
  baseSalary: decimal('base_salary', { precision: 12, scale: 2 }),
  hourlyRate: decimal('hourly_rate', { precision: 8, scale: 2 }),
  payFrequency: payFrequencyEnum('pay_frequency').default('bi_weekly'),
  
  // Benefits and settings
  benefits: jsonb('benefits').default({}),
  settings: jsonb('settings').default({}),
  
  // Manager relationship
  managerId: uuid('manager_id'),
  
  // Profile and documents
  avatar: varchar('avatar', { length: 500 }),
  documents: jsonb('documents').default([]), // Array of document references
  
  // Notes and additional info
  notes: text('notes'),
  customFields: jsonb('custom_fields').default({}),
}, (table) => ({
  // Unique constraint on tenant_id + employee_number
  tenantEmployeeNumberIdx: unique('employees_tenant_employee_number_unique').on(table.tenantId, table.employeeNumber),
  
  // Indexes for performance
  tenantIdIdx: index('employees_tenant_id_idx').on(table.tenantId),
  userIdIdx: index('employees_user_id_idx').on(table.userId),
  employeeNumberIdx: index('employees_employee_number_idx').on(table.employeeNumber),
  departmentIdx: index('employees_department_idx').on(table.department),
  positionIdx: index('employees_position_idx').on(table.position),
  employmentStatusIdx: index('employees_employment_status_idx').on(table.employmentStatus),
  managerIdIdx: index('employees_manager_id_idx').on(table.managerId),
  hireDateIdx: index('employees_hire_date_idx').on(table.hireDate),
}));

// Employee schedules table
export const employeeSchedules = pgTable('employee_schedules', {
  ...baseSchema,
  
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  
  // Schedule details
  scheduleDate: date('schedule_date').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  
  // Break information
  breakDuration: integer('break_duration').default(0), // in minutes
  lunchBreakStart: timestamp('lunch_break_start', { withTimezone: true }),
  lunchBreakEnd: timestamp('lunch_break_end', { withTimezone: true }),
  
  // Schedule metadata
  scheduleType: varchar('schedule_type', { length: 50 }).default('regular'), // regular, overtime, holiday
  status: scheduleStatusEnum('status').default('scheduled'),
  
  // Location and department
  locationId: uuid('location_id'),
  department: varchar('department', { length: 100 }),
  
  // Notes and approvals
  notes: text('notes'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
}, (table) => ({
  employeeScheduleDateIdx: unique('employee_schedules_employee_date_unique').on(table.employeeId, table.scheduleDate),
  employeeIdIdx: index('employee_schedules_employee_id_idx').on(table.employeeId),
  scheduleDateIdx: index('employee_schedules_schedule_date_idx').on(table.scheduleDate),
  statusIdx: index('employee_schedules_status_idx').on(table.status),
  locationIdIdx: index('employee_schedules_location_id_idx').on(table.locationId),
}));

// Time tracking table for clock-in/clock-out
export const timeEntries = pgTable('time_entries', {
  ...baseSchema,
  
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  
  // Time tracking
  clockInTime: timestamp('clock_in_time', { withTimezone: true }).notNull(),
  clockOutTime: timestamp('clock_out_time', { withTimezone: true }),
  
  // Calculated fields
  totalHours: decimal('total_hours', { precision: 8, scale: 2 }),
  regularHours: decimal('regular_hours', { precision: 8, scale: 2 }),
  overtimeHours: decimal('overtime_hours', { precision: 8, scale: 2 }),
  
  // Break tracking
  breakStartTime: timestamp('break_start_time', { withTimezone: true }),
  breakEndTime: timestamp('break_end_time', { withTimezone: true }),
  totalBreakTime: integer('total_break_time').default(0), // in minutes
  
  // Entry metadata
  entryType: timeEntryTypeEnum('entry_type').default('regular'),
  locationId: uuid('location_id'),
  department: varchar('department', { length: 100 }),
  
  // Geolocation for mobile clock-in/out
  clockInLocation: jsonb('clock_in_location'), // {lat, lng, address}
  clockOutLocation: jsonb('clock_out_location'), // {lat, lng, address}
  
  // Approval and adjustments
  isApproved: boolean('is_approved').default(false),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  // Manual adjustments
  adjustmentReason: text('adjustment_reason'),
  adjustedBy: uuid('adjusted_by').references(() => users.id),
  adjustedAt: timestamp('adjusted_at', { withTimezone: true }),
  
  // Notes
  notes: text('notes'),
}, (table) => ({
  employeeIdIdx: index('time_entries_employee_id_idx').on(table.employeeId),
  clockInTimeIdx: index('time_entries_clock_in_time_idx').on(table.clockInTime),
  entryTypeIdx: index('time_entries_entry_type_idx').on(table.entryType),
  isApprovedIdx: index('time_entries_is_approved_idx').on(table.isApproved),
  locationIdIdx: index('time_entries_location_id_idx').on(table.locationId),
}));

// Employee performance reviews table
export const performanceReviews = pgTable('performance_reviews', {
  ...baseSchema,
  
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  reviewerId: uuid('reviewer_id').notNull().references(() => employees.id),
  
  // Review period
  reviewPeriodStart: date('review_period_start').notNull(),
  reviewPeriodEnd: date('review_period_end').notNull(),
  
  // Review details
  reviewType: varchar('review_type', { length: 50 }).default('annual'), // annual, quarterly, probation
  overallRating: performanceRatingEnum('overall_rating'),
  
  // Goals and achievements
  goals: jsonb('goals').default([]), // Array of goal objects
  achievements: jsonb('achievements').default([]),
  areasForImprovement: jsonb('areas_for_improvement').default([]),
  
  // Ratings by category
  ratings: jsonb('ratings').default({}), // {category: rating}
  
  // Comments and feedback
  reviewerComments: text('reviewer_comments'),
  employeeComments: text('employee_comments'),
  
  // Status and completion
  status: varchar('status', { length: 50 }).default('draft'), // draft, completed, acknowledged
  completedAt: timestamp('completed_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  
  // Next review
  nextReviewDate: date('next_review_date'),
}, (table) => ({
  employeeIdIdx: index('performance_reviews_employee_id_idx').on(table.employeeId),
  reviewerIdIdx: index('performance_reviews_reviewer_id_idx').on(table.reviewerId),
  reviewPeriodIdx: index('performance_reviews_period_idx').on(table.reviewPeriodStart, table.reviewPeriodEnd),
  statusIdx: index('performance_reviews_status_idx').on(table.status),
}));

// Employee training records table
export const trainingRecords = pgTable('training_records', {
  ...baseSchema,
  
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  
  // Training details
  trainingName: varchar('training_name', { length: 255 }).notNull(),
  trainingType: varchar('training_type', { length: 100 }), // certification, safety, skills, compliance
  provider: varchar('provider', { length: 255 }),
  
  // Dates and duration
  startDate: date('start_date'),
  completionDate: date('completion_date'),
  expirationDate: date('expiration_date'),
  duration: integer('duration'), // in hours
  
  // Certification details
  certificateNumber: varchar('certificate_number', { length: 100 }),
  certificationBody: varchar('certification_body', { length: 255 }),
  
  // Status and results
  status: varchar('status', { length: 50 }).default('in_progress'), // scheduled, in_progress, completed, expired
  score: decimal('score', { precision: 5, scale: 2 }),
  passingScore: decimal('passing_score', { precision: 5, scale: 2 }),
  
  // Cost and approval
  cost: decimal('cost', { precision: 10, scale: 2 }),
  approvedBy: uuid('approved_by').references(() => users.id),
  
  // Documents and notes
  documents: jsonb('documents').default([]),
  notes: text('notes'),
}, (table) => ({
  employeeIdIdx: index('training_records_employee_id_idx').on(table.employeeId),
  trainingTypeIdx: index('training_records_training_type_idx').on(table.trainingType),
  statusIdx: index('training_records_status_idx').on(table.status),
  expirationDateIdx: index('training_records_expiration_date_idx').on(table.expirationDate),
}));

// Employee goals table
export const employeeGoals = pgTable('employee_goals', {
  ...baseSchema,
  
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  
  // Goal details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }), // performance, development, behavioral
  
  // Timeline
  startDate: date('start_date').notNull(),
  targetDate: date('target_date').notNull(),
  completedDate: date('completed_date'),
  
  // Progress tracking
  status: varchar('status', { length: 50 }).default('active'), // active, completed, cancelled, overdue
  progress: integer('progress').default(0), // percentage 0-100
  
  // Metrics and measurement
  metrics: jsonb('metrics').default({}), // Key performance indicators
  targetValue: decimal('target_value', { precision: 15, scale: 2 }),
  currentValue: decimal('current_value', { precision: 15, scale: 2 }),
  
  // Approval and review
  approvedBy: uuid('approved_by').references(() => employees.id),
  reviewedBy: uuid('reviewed_by').references(() => employees.id),
  lastReviewDate: date('last_review_date'),
  
  // Notes and updates
  notes: text('notes'),
  updates: jsonb('updates').default([]), // Array of progress updates
}, (table) => ({
  employeeIdIdx: index('employee_goals_employee_id_idx').on(table.employeeId),
  statusIdx: index('employee_goals_status_idx').on(table.status),
  targetDateIdx: index('employee_goals_target_date_idx').on(table.targetDate),
  categoryIdx: index('employee_goals_category_idx').on(table.category),
}));

// Payroll periods table
export const payrollPeriods = pgTable('payroll_periods', {
  ...baseSchema,
  
  // Period details
  periodName: varchar('period_name', { length: 100 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  payDate: date('pay_date').notNull(),
  
  // Period metadata
  periodType: payrollPeriodTypeEnum('period_type').notNull(),
  status: payrollStatusEnum('status').default('draft'),
  
  // Totals
  totalGrossPay: decimal('total_gross_pay', { precision: 15, scale: 2 }).default('0'),
  totalNetPay: decimal('total_net_pay', { precision: 15, scale: 2 }).default('0'),
  totalTaxes: decimal('total_taxes', { precision: 15, scale: 2 }).default('0'),
  totalDeductions: decimal('total_deductions', { precision: 15, scale: 2 }).default('0'),
  
  // Processing details
  processedAt: timestamp('processed_at', { withTimezone: true }),
  processedBy: uuid('processed_by').references(() => users.id),
  
  // Notes
  notes: text('notes'),
}, (table) => ({
  tenantIdIdx: index('payroll_periods_tenant_id_idx').on(table.tenantId),
  periodTypeIdx: index('payroll_periods_period_type_idx').on(table.periodType),
  statusIdx: index('payroll_periods_status_idx').on(table.status),
  startDateIdx: index('payroll_periods_start_date_idx').on(table.startDate),
  endDateIdx: index('payroll_periods_end_date_idx').on(table.endDate),
  payDateIdx: index('payroll_periods_pay_date_idx').on(table.payDate),
}));

// Payroll records table
export const payrollRecords = pgTable('payroll_records', {
  ...baseSchema,
  
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  payrollPeriodId: uuid('payroll_period_id').notNull().references(() => payrollPeriods.id, { onDelete: 'cascade' }),
  
  // Hours worked
  regularHours: decimal('regular_hours', { precision: 8, scale: 2 }).default('0'),
  overtimeHours: decimal('overtime_hours', { precision: 8, scale: 2 }).default('0'),
  holidayHours: decimal('holiday_hours', { precision: 8, scale: 2 }).default('0'),
  sickHours: decimal('sick_hours', { precision: 8, scale: 2 }).default('0'),
  vacationHours: decimal('vacation_hours', { precision: 8, scale: 2 }).default('0'),
  
  // Pay rates
  regularRate: decimal('regular_rate', { precision: 8, scale: 2 }),
  overtimeRate: decimal('overtime_rate', { precision: 8, scale: 2 }),
  holidayRate: decimal('holiday_rate', { precision: 8, scale: 2 }),
  
  // Gross pay calculations
  regularPay: decimal('regular_pay', { precision: 12, scale: 2 }).default('0'),
  overtimePay: decimal('overtime_pay', { precision: 12, scale: 2 }).default('0'),
  holidayPay: decimal('holiday_pay', { precision: 12, scale: 2 }).default('0'),
  commissionPay: decimal('commission_pay', { precision: 12, scale: 2 }).default('0'),
  bonusPay: decimal('bonus_pay', { precision: 12, scale: 2 }).default('0'),
  grossPay: decimal('gross_pay', { precision: 12, scale: 2 }).default('0'),
  
  // Tax calculations
  federalTax: decimal('federal_tax', { precision: 12, scale: 2 }).default('0'),
  stateTax: decimal('state_tax', { precision: 12, scale: 2 }).default('0'),
  localTax: decimal('local_tax', { precision: 12, scale: 2 }).default('0'),
  socialSecurityTax: decimal('social_security_tax', { precision: 12, scale: 2 }).default('0'),
  medicareTax: decimal('medicare_tax', { precision: 12, scale: 2 }).default('0'),
  unemploymentTax: decimal('unemployment_tax', { precision: 12, scale: 2 }).default('0'),
  totalTaxes: decimal('total_taxes', { precision: 12, scale: 2 }).default('0'),
  
  // Deductions
  healthInsurance: decimal('health_insurance', { precision: 12, scale: 2 }).default('0'),
  dentalInsurance: decimal('dental_insurance', { precision: 12, scale: 2 }).default('0'),
  visionInsurance: decimal('vision_insurance', { precision: 12, scale: 2 }).default('0'),
  retirement401k: decimal('retirement_401k', { precision: 12, scale: 2 }).default('0'),
  otherDeductions: decimal('other_deductions', { precision: 12, scale: 2 }).default('0'),
  totalDeductions: decimal('total_deductions', { precision: 12, scale: 2 }).default('0'),
  
  // Net pay
  netPay: decimal('net_pay', { precision: 12, scale: 2 }).default('0'),
  
  // Commission and bonus details
  commissionDetails: jsonb('commission_details').default({}),
  bonusDetails: jsonb('bonus_details').default({}),
  
  // Tax details
  taxDetails: jsonb('tax_details').default({}),
  
  // Status
  status: payrollStatusEnum('status').default('draft'),
  
  // Approval
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  // Notes
  notes: text('notes'),
}, (table) => ({
  employeeIdIdx: index('payroll_records_employee_id_idx').on(table.employeeId),
  payrollPeriodIdIdx: index('payroll_records_payroll_period_id_idx').on(table.payrollPeriodId),
  statusIdx: index('payroll_records_status_idx').on(table.status),
  tenantEmployeePeriodIdx: unique('payroll_records_tenant_employee_period_unique').on(table.tenantId, table.employeeId, table.payrollPeriodId),
}));

// Commission tracking table
export const commissionRecords = pgTable('commission_records', {
  ...baseSchema,
  
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  
  // Commission details
  transactionId: uuid('transaction_id'), // Reference to POS transaction if applicable
  saleAmount: decimal('sale_amount', { precision: 12, scale: 2 }).notNull(),
  commissionRate: decimal('commission_rate', { precision: 5, scale: 4 }).notNull(), // e.g., 0.0250 for 2.5%
  commissionAmount: decimal('commission_amount', { precision: 12, scale: 2 }).notNull(),
  
  // Period information
  saleDate: date('sale_date').notNull(),
  payrollPeriodId: uuid('payroll_period_id').references(() => payrollPeriods.id),
  
  // Commission metadata
  commissionType: commissionTypeEnum('commission_type').default('sales'),
  productCategory: varchar('product_category', { length: 100 }),
  customerType: varchar('customer_type', { length: 50 }),
  
  // Status
  status: commissionStatusEnum('status').default('pending'),
  
  // Notes
  description: text('description'),
  notes: text('notes'),
}, (table) => ({
  employeeIdIdx: index('commission_records_employee_id_idx').on(table.employeeId),
  saleDateIdx: index('commission_records_sale_date_idx').on(table.saleDate),
  payrollPeriodIdIdx: index('commission_records_payroll_period_id_idx').on(table.payrollPeriodId),
  statusIdx: index('commission_records_status_idx').on(table.status),
  transactionIdIdx: index('commission_records_transaction_id_idx').on(table.transactionId),
}));

// Compliance checks table
export const complianceChecks = pgTable('compliance_checks', {
  ...baseSchema,
  
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  
  // Check details
  checkDate: date('check_date').notNull(),
  checkType: complianceCheckTypeEnum('check_type').notNull(),
  status: complianceStatusEnum('status').notNull(),
  
  // Violation summary
  totalViolations: integer('total_violations').default(0),
  violations: jsonb('violations').default([]), // Array of violation summaries
  
  // Additional details
  notes: text('notes'),
  details: jsonb('details').default({}),
}, (table) => ({
  employeeIdIdx: index('compliance_checks_employee_id_idx').on(table.employeeId),
  checkDateIdx: index('compliance_checks_check_date_idx').on(table.checkDate),
  checkTypeIdx: index('compliance_checks_check_type_idx').on(table.checkType),
  statusIdx: index('compliance_checks_status_idx').on(table.status),
}));

// Break time records table
export const breakTimeRecords = pgTable('break_time_records', {
  ...baseSchema,
  
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  
  // Break timing
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  duration: integer('duration').notNull(), // in minutes
  
  // Break details
  breakType: breakTypeEnum('break_type').notNull(),
  isPaid: boolean('is_paid').default(false),
  location: varchar('location', { length: 255 }),
  
  // Notes
  notes: text('notes'),
}, (table) => ({
  employeeIdIdx: index('break_time_records_employee_id_idx').on(table.employeeId),
  startTimeIdx: index('break_time_records_start_time_idx').on(table.startTime),
  breakTypeIdx: index('break_time_records_break_type_idx').on(table.breakType),
}));

// Labor law violations table
export const laborLawViolations = pgTable('labor_law_violations', {
  ...baseSchema,
  
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  complianceCheckId: uuid('compliance_check_id').references(() => complianceChecks.id, { onDelete: 'cascade' }),
  
  // Violation details
  violationType: violationTypeEnum('violation_type').notNull(),
  violationDate: date('violation_date').notNull(),
  description: text('description').notNull(),
  severity: violationSeverityEnum('severity').notNull(),
  
  // Additional details
  details: jsonb('details').default({}),
  
  // Remediation
  correctiveAction: text('corrective_action'),
  correctedDate: date('corrected_date'),
  correctedBy: uuid('corrected_by').references(() => users.id),
  
  // Notes
  notes: text('notes'),
}, (table) => ({
  employeeIdIdx: index('labor_law_violations_employee_id_idx').on(table.employeeId),
  complianceCheckIdIdx: index('labor_law_violations_compliance_check_id_idx').on(table.complianceCheckId),
  violationTypeIdx: index('labor_law_violations_violation_type_idx').on(table.violationType),
  violationDateIdx: index('labor_law_violations_violation_date_idx').on(table.violationDate),
  severityIdx: index('labor_law_violations_severity_idx').on(table.severity),
}));

// Audit events table for HR actions
export const auditEvents = pgTable('audit_events', {
  ...baseSchema,
  
  // Event details
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventDate: timestamp('event_date', { withTimezone: true }).notNull(),
  performedBy: uuid('performed_by').notNull().references(() => users.id),
  
  // Event data
  description: text('description').notNull(),
  details: jsonb('details').default({}),
  
  // Request metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
}, (table) => ({
  employeeIdIdx: index('audit_events_employee_id_idx').on(table.employeeId),
  eventTypeIdx: index('audit_events_event_type_idx').on(table.eventType),
  eventDateIdx: index('audit_events_event_date_idx').on(table.eventDate),
  performedByIdx: index('audit_events_performed_by_idx').on(table.performedBy),
}));