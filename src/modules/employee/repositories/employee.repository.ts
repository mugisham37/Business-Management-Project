import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  employees, 
  employeeSchedules, 
  timeEntries, 
  performanceReviews, 
  trainingRecords, 
  employeeGoals 
} from '../../database/schema';
import { 
  CreateEmployeeDto, 
  UpdateEmployeeDto,
  CreateEmployeeScheduleDto,
  UpdateEmployeeScheduleDto,
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
  CreatePerformanceReviewDto,
  UpdatePerformanceReviewDto,
  CreateTrainingRecordDto,
  UpdateTrainingRecordDto,
  CreateEmployeeGoalDto,
  UpdateEmployeeGoalDto,
  EmployeeQueryDto,
  TimeEntryQueryDto
} from '../dto/employee.dto';
import { eq, and, gte, lte, like, desc, asc, isNull, count, sql } from 'drizzle-orm';
import { Employee, EmployeeSchedule, TimeEntry, PerformanceReview, TrainingRecord, EmployeeGoal } from '../entities/employee.entity';

@Injectable()
export class EmployeeRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  // Employee CRUD operations
  async createEmployee(tenantId: string, data: CreateEmployeeDto, createdBy: string): Promise<Employee> {
    const result = await this.drizzle.getDb()
      .insert(employees)
      .values({
        tenantId,
        createdBy,
        updatedBy: createdBy,
        employeeNumber: data.employeeNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName,
        displayName: data.displayName,
        email: data.email,
        phone: data.phone,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        address: data.address,
        department: data.department,
        position: data.position,
        employmentType: data.employmentType || 'full_time',
        employmentStatus: data.employmentStatus || 'active',
        hireDate: data.hireDate,
        terminationDate: data.terminationDate,
        probationEndDate: data.probationEndDate,
        baseSalary: data.baseSalary?.toString(),
        hourlyRate: data.hourlyRate?.toString(),
        payFrequency: data.payFrequency,
        benefits: data.benefits,
        settings: data.settings,
        managerId: data.managerId,
        userId: data.userId,
        notes: data.notes,
        customFields: data.customFields,
      })
      .returning() as any[];

    const employee = result[0];
    if (!employee) {
      throw new Error('Failed to create employee');
    }

    return this.mapEmployeeEntity(employee);
  }

  async findEmployeeById(tenantId: string, id: string): Promise<Employee | null> {
    const result = await this.drizzle.getDb()
      .select()
      .from(employees)
      .where(and(
        eq(employees.tenantId, tenantId),
        eq(employees.id, id),
        isNull(employees.deletedAt)
      ));

    const employee = result[0];
    return employee ? this.mapEmployeeEntity(employee) : null;
  }

  async findEmployeeByNumber(tenantId: string, employeeNumber: string): Promise<Employee | null> {
    const [employee] = await this.drizzle.getDb()
      .select()
      .from(employees)
      .where(and(
        eq(employees.tenantId, tenantId),
        eq(employees.employeeNumber, employeeNumber),
        isNull(employees.deletedAt)
      ));

    return employee ? this.mapEmployeeEntity(employee) : null;
  }

  async findEmployees(tenantId: string, query: EmployeeQueryDto): Promise<{ employees: Employee[]; total: number }> {
    const conditions = [
      eq(employees.tenantId, tenantId),
      isNull(employees.deletedAt)
    ];

    // Add search conditions
    if (query.search) {
      conditions.push(
        sql`(${employees.firstName} ILIKE ${`%${query.search}%`} OR 
             ${employees.lastName} ILIKE ${`%${query.search}%`} OR 
             ${employees.employeeNumber} ILIKE ${`%${query.search}%`} OR 
             ${employees.email} ILIKE ${`%${query.search}%`})`
      );
    }

    if (query.department) {
      conditions.push(eq(employees.department, query.department));
    }

    if (query.position) {
      conditions.push(like(employees.position, `%${query.position}%`));
    }

    if (query.employmentStatus) {
      conditions.push(eq(employees.employmentStatus, query.employmentStatus));
    }

    if (query.employmentType) {
      conditions.push(eq(employees.employmentType, query.employmentType));
    }

    if (query.managerId) {
      conditions.push(eq(employees.managerId, query.managerId));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await this.drizzle.getDb()
      .select({ count: count() })
      .from(employees)
      .where(whereClause);
    
    const totalCount = countResult[0]?.count ?? 0;

    // Get paginated results with safe pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const orderBy = query.sortOrder === 'desc' 
      ? desc(employees[query.sortBy as keyof typeof employees] || employees.lastName)
      : asc(employees[query.sortBy as keyof typeof employees] || employees.lastName);

    const results = await this.drizzle.getDb()
      .select()
      .from(employees)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      employees: results.map(emp => this.mapEmployeeEntity(emp)),
      total: totalCount
    };
  }

  async updateEmployee(tenantId: string, id: string, data: UpdateEmployeeDto, updatedBy: string): Promise<Employee> {
    const [employee] = await this.drizzle.getDb()
      .update(employees)
      .set({
        ...data,
        updatedBy,
        updatedAt: new Date(),
        version: sql`${employees.version} + 1`
      })
      .where(and(
        eq(employees.tenantId, tenantId),
        eq(employees.id, id),
        isNull(employees.deletedAt)
      ))
      .returning();

    return this.mapEmployeeEntity(employee);
  }

  async deleteEmployee(tenantId: string, id: string, deletedBy: string): Promise<void> {
    await this.drizzle.getDb()
      .update(employees)
      .set({
        deletedAt: new Date(),
        updatedBy: deletedBy,
        updatedAt: new Date(),
        version: sql`${employees.version} + 1`
      })
      .where(and(
        eq(employees.tenantId, tenantId),
        eq(employees.id, id)
      ));
  }

  // Employee Schedule operations
  async createSchedule(tenantId: string, data: CreateEmployeeScheduleDto, createdBy: string): Promise<EmployeeSchedule> {
    const now = new Date();
    const scheduleData: any = {
      ...data,
      tenantId,
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.drizzle.getDb()
      .insert(employeeSchedules)
      .values(scheduleData)
      .returning();

    const schedule = result[0];
    if (!schedule) {
      throw new Error('Failed to create schedule');
    }

    return this.mapScheduleEntity(schedule);
  }

  async findSchedulesByEmployee(tenantId: string, employeeId: string, startDate?: Date, endDate?: Date): Promise<EmployeeSchedule[]> {
    const conditions = [
      eq(employeeSchedules.tenantId, tenantId),
      eq(employeeSchedules.employeeId, employeeId),
      isNull(employeeSchedules.deletedAt)
    ];

    if (startDate) {
      conditions.push(gte(employeeSchedules.scheduleDate, startDate.toISOString()));
    }

    if (endDate) {
      conditions.push(lte(employeeSchedules.scheduleDate, endDate.toISOString()));
    }

    const results = await this.drizzle.getDb()
      .select()
      .from(employeeSchedules)
      .where(and(...conditions))
      .orderBy(asc(employeeSchedules.scheduleDate));

    return results.map(schedule => this.mapScheduleEntity(schedule));
  }

  async updateSchedule(tenantId: string, id: string, data: UpdateEmployeeScheduleDto, updatedBy: string): Promise<EmployeeSchedule> {
    const [schedule] = await this.drizzle.getDb()
      .update(employeeSchedules)
      .set({
        ...(data.employeeId !== undefined && { employeeId: data.employeeId }),
        ...(data.scheduleDate !== undefined && { scheduleDate: data.scheduleDate }),
        ...(data.startTime !== undefined && { startTime: typeof data.startTime === 'string' ? new Date(data.startTime) : data.startTime }),
        ...(data.endTime !== undefined && { endTime: typeof data.endTime === 'string' ? new Date(data.endTime) : data.endTime }),
        ...(data.breakDuration !== undefined && { breakDuration: data.breakDuration }),
        ...(data.lunchBreakStart !== undefined && { lunchBreakStart: typeof data.lunchBreakStart === 'string' ? new Date(data.lunchBreakStart) : data.lunchBreakStart }),
        ...(data.lunchBreakEnd !== undefined && { lunchBreakEnd: typeof data.lunchBreakEnd === 'string' ? new Date(data.lunchBreakEnd) : data.lunchBreakEnd }),
        ...(data.scheduleType !== undefined && { scheduleType: data.scheduleType }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.locationId !== undefined && { locationId: data.locationId }),
        ...(data.department !== undefined && { department: data.department }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedBy,
        updatedAt: new Date(),
        version: sql`${employeeSchedules.version} + 1`
      })
      .where(and(
        eq(employeeSchedules.tenantId, tenantId),
        eq(employeeSchedules.id, id),
        isNull(employeeSchedules.deletedAt)
      ))
      .returning();

    return this.mapScheduleEntity(schedule);
  }

  // Time Entry operations
  async createTimeEntry(tenantId: string, data: CreateTimeEntryDto, createdBy: string): Promise<TimeEntry> {
    const now = new Date();
    const timeEntryData: any = {
      ...data,
      tenantId,
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.drizzle.getDb()
      .insert(timeEntries)
      .values(timeEntryData)
      .returning();

    const timeEntry = result[0];
    if (!timeEntry) {
      throw new Error('Failed to create time entry');
    }

    return this.mapTimeEntryEntity(timeEntry);
  }

  async findActiveTimeEntry(tenantId: string, employeeId: string): Promise<TimeEntry | null> {
    const result = await this.drizzle.getDb()
      .select()
      .from(timeEntries)
      .where(and(
        eq(timeEntries.tenantId, tenantId),
        eq(timeEntries.employeeId, employeeId),
        isNull(timeEntries.clockOutTime),
        isNull(timeEntries.deletedAt)
      ))
      .orderBy(desc(timeEntries.clockInTime))
      .limit(1);

    const timeEntry = result[0];
    return timeEntry ? this.mapTimeEntryEntity(timeEntry) : null;
  }

  async findTimeEntries(tenantId: string, query: TimeEntryQueryDto): Promise<{ timeEntries: TimeEntry[]; total: number }> {
    const conditions = [
      eq(timeEntries.tenantId, tenantId),
      isNull(timeEntries.deletedAt)
    ];

    if (query.employeeId) {
      conditions.push(eq(timeEntries.employeeId, query.employeeId));
    }

    if (query.entryType) {
      conditions.push(eq(timeEntries.entryType, query.entryType));
    }

    if (query.isApproved !== undefined) {
      conditions.push(eq(timeEntries.isApproved, query.isApproved));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await this.drizzle.getDb()
      .select({ count: count() })
      .from(timeEntries)
      .where(whereClause);
    
    const totalCount = countResult[0]?.count ?? 0;

    // Get paginated results with safe pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const results = await this.drizzle.getDb()
      .select()
      .from(timeEntries)
      .where(whereClause)
      .orderBy(desc(timeEntries.clockInTime))
      .limit(limit)
      .offset(offset);

    return {
      timeEntries: results.map(entry => this.mapTimeEntryEntity(entry)),
      total: totalCount
    };
  }

  async updateTimeEntry(tenantId: string, id: string, data: UpdateTimeEntryDto, updatedBy: string): Promise<TimeEntry> {
    const updateData: any = {
      ...data,
      updatedBy,
      updatedAt: new Date(),
      version: sql`${timeEntries.version} + 1`
    };

    // Calculate hours if clock out time is provided
    if (data.clockOutTime) {
      // This would be calculated in the service layer
      // updateData.totalHours = calculateHours(clockInTime, clockOutTime);
    }

    const [timeEntry] = await this.drizzle.getDb()
      .update(timeEntries)
      .set(updateData)
      .where(and(
        eq(timeEntries.tenantId, tenantId),
        eq(timeEntries.id, id),
        isNull(timeEntries.deletedAt)
      ))
      .returning();

    return this.mapTimeEntryEntity(timeEntry);
  }

  // Performance Review operations
  async createPerformanceReview(tenantId: string, data: CreatePerformanceReviewDto, createdBy: string): Promise<PerformanceReview> {
    const [review] = await this.drizzle.getDb()
      .insert(performanceReviews)
      .values({
        ...data,
        tenantId,
        createdBy,
        updatedBy: createdBy,
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
        acknowledgedAt: data.acknowledgedAt ? new Date(data.acknowledgedAt) : null,
      })
      .returning();

    return this.mapPerformanceReviewEntity(review);
  }

  async findPerformanceReviewsByEmployee(tenantId: string, employeeId: string): Promise<PerformanceReview[]> {
    const results = await this.drizzle.getDb()
      .select()
      .from(performanceReviews)
      .where(and(
        eq(performanceReviews.tenantId, tenantId),
        eq(performanceReviews.employeeId, employeeId),
        isNull(performanceReviews.deletedAt)
      ))
      .orderBy(desc(performanceReviews.reviewPeriodEnd));

    return results.map(review => this.mapPerformanceReviewEntity(review));
  }

  // Training Record operations
  async createTrainingRecord(tenantId: string, data: CreateTrainingRecordDto, createdBy: string): Promise<TrainingRecord> {
    const now = new Date();
    const trainingData: any = {
      employeeId: data.employeeId,
      tenantId,
      trainingName: data.trainingName,
      trainingType: data.trainingType,
      provider: data.provider,
      startDate: data.startDate,
      completionDate: data.completionDate,
      expirationDate: data.expirationDate,
      duration: data.duration,
      certificateNumber: data.certificateNumber,
      certificationBody: data.certificationBody,
      status: data.status || 'in_progress',
      score: data.score ? String(data.score) : undefined,
      passingScore: data.passingScore ? String(data.passingScore) : undefined,
      cost: data.cost ? String(data.cost) : undefined,
      documents: data.documents,
      notes: data.notes,
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.drizzle.getDb()
      .insert(trainingRecords)
      .values(trainingData)
      .returning();

    const training = result[0];
    if (!training) {
      throw new Error('Failed to create training record');
    }

    return this.mapTrainingRecordEntity(training);
  }

  async findTrainingRecordsByEmployee(tenantId: string, employeeId: string): Promise<TrainingRecord[]> {
    const results = await this.drizzle.getDb()
      .select()
      .from(trainingRecords)
      .where(and(
        eq(trainingRecords.tenantId, tenantId),
        eq(trainingRecords.employeeId, employeeId),
        isNull(trainingRecords.deletedAt)
      ))
      .orderBy(desc(trainingRecords.startDate));

    return results.map(training => this.mapTrainingRecordEntity(training));
  }

  // Employee Goal operations
  async createEmployeeGoal(tenantId: string, data: CreateEmployeeGoalDto, createdBy: string): Promise<EmployeeGoal> {
    const now = new Date();
    const goalData: any = {
      employeeId: data.employeeId,
      tenantId,
      title: data.title,
      description: data.description,
      category: data.category,
      startDate: data.startDate,
      targetDate: data.targetDate,
      completedDate: data.completedDate,
      status: data.status || 'active',
      progress: data.progress || 0,
      metrics: data.metrics,
      targetValue: data.targetValue ? String(data.targetValue) : undefined,
      currentValue: data.currentValue ? String(data.currentValue) : undefined,
      notes: data.notes,
      updates: data.updates,
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.drizzle.getDb()
      .insert(employeeGoals)
      .values(goalData)
      .returning();

    const goal = result[0];
    if (!goal) {
      throw new Error('Failed to create employee goal');
    }

    return this.mapEmployeeGoalEntity(goal);
  }

  async findGoalsByEmployee(tenantId: string, employeeId: string): Promise<EmployeeGoal[]> {
    const results = await this.drizzle.getDb()
      .select()
      .from(employeeGoals)
      .where(and(
        eq(employeeGoals.tenantId, tenantId),
        eq(employeeGoals.employeeId, employeeId),
        isNull(employeeGoals.deletedAt)
      ))
      .orderBy(desc(employeeGoals.targetDate));

    return results.map(goal => this.mapEmployeeGoalEntity(goal));
  }

  async findGoalById(tenantId: string, id: string): Promise<EmployeeGoal | null> {
    const [goal] = await this.drizzle.getDb()
      .select()
      .from(employeeGoals)
      .where(and(
        eq(employeeGoals.tenantId, tenantId),
        eq(employeeGoals.id, id),
        isNull(employeeGoals.deletedAt)
      ));

    return goal ? this.mapEmployeeGoalEntity(goal) : null;
  }

  async updatePerformanceReview(tenantId: string, id: string, data: UpdatePerformanceReviewDto, updatedBy: string): Promise<PerformanceReview> {
    const [review] = await this.drizzle.getDb()
      .update(performanceReviews)
      .set({
        ...data,
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        acknowledgedAt: data.acknowledgedAt ? new Date(data.acknowledgedAt) : undefined,
        updatedBy,
        updatedAt: new Date(),
        version: sql`${performanceReviews.version} + 1`
      })
      .where(and(
        eq(performanceReviews.tenantId, tenantId),
        eq(performanceReviews.id, id),
        isNull(performanceReviews.deletedAt)
      ))
      .returning();

    return this.mapPerformanceReviewEntity(review);
  }

  async updateEmployeeGoal(tenantId: string, id: string, data: UpdateEmployeeGoalDto, updatedBy: string): Promise<EmployeeGoal> {
    const updateData: any = {
      updatedBy,
      updatedAt: new Date(),
      version: sql`${employeeGoals.version} + 1`
    };

    // Only include provided fields
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.targetDate !== undefined) updateData.targetDate = data.targetDate;
    if (data.completedDate !== undefined) updateData.completedDate = data.completedDate;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.metrics !== undefined) updateData.metrics = data.metrics;
    if (data.targetValue !== undefined) updateData.targetValue = String(data.targetValue);
    if (data.currentValue !== undefined) updateData.currentValue = String(data.currentValue);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.updates !== undefined) updateData.updates = data.updates;

    const result = await this.drizzle.getDb()
      .update(employeeGoals)
      .set(updateData)
      .where(and(
        eq(employeeGoals.tenantId, tenantId),
        eq(employeeGoals.id, id),
        isNull(employeeGoals.deletedAt)
      ))
      .returning();

    const goal = result[0];
    if (!goal) {
      throw new Error('Failed to update employee goal');
    }

    return this.mapEmployeeGoalEntity(goal);
  }

  async updateTrainingRecord(tenantId: string, id: string, data: UpdateTrainingRecordDto, updatedBy: string): Promise<TrainingRecord> {
    const updateData: any = {
      updatedBy,
      updatedAt: new Date(),
      version: sql`${trainingRecords.version} + 1`
    };

    // Only include provided fields
    if (data.trainingName !== undefined) updateData.trainingName = data.trainingName;
    if (data.trainingType !== undefined) updateData.trainingType = data.trainingType;
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.completionDate !== undefined) updateData.completionDate = data.completionDate;
    if (data.expirationDate !== undefined) updateData.expirationDate = data.expirationDate;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.certificateNumber !== undefined) updateData.certificateNumber = data.certificateNumber;
    if (data.certificationBody !== undefined) updateData.certificationBody = data.certificationBody;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.score !== undefined) updateData.score = String(data.score);
    if (data.passingScore !== undefined) updateData.passingScore = String(data.passingScore);
    if (data.cost !== undefined) updateData.cost = String(data.cost);
    if (data.documents !== undefined) updateData.documents = data.documents;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const result = await this.drizzle.getDb()
      .update(trainingRecords)
      .set(updateData)
      .where(and(
        eq(trainingRecords.tenantId, tenantId),
        eq(trainingRecords.id, id),
        isNull(trainingRecords.deletedAt)
      ))
      .returning();

    const training = result[0];
    if (!training) {
      throw new Error('Failed to update training record');
    }

    return this.mapTrainingRecordEntity(training);
  }

  // Helper methods to map database records to entities
  private mapEmployeeEntity(record: any): Employee {
    const result: any = {
      id: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      employeeNumber: record.employeeNumber,
      firstName: record.firstName,
      lastName: record.lastName,
      middleName: record.middleName,
      displayName: record.displayName || `${record.firstName} ${record.lastName}`,
      email: record.email,
      phone: record.phone,
      emergencyContactName: record.emergencyContactName,
      emergencyContactPhone: record.emergencyContactPhone,
      address: record.address,
      department: record.department,
      position: record.position,
      employmentType: record.employmentType,
      employmentStatus: record.employmentStatus,
      hireDate: record.hireDate,
      terminationDate: record.terminationDate,
      probationEndDate: record.probationEndDate,
      payFrequency: record.payFrequency,
      benefits: record.benefits,
      settings: record.settings,
      managerId: record.managerId,
      avatar: record.avatar,
      documents: record.documents,
      notes: record.notes,
      customFields: record.customFields,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      deletedAt: record.deletedAt,
      version: record.version,
      isActive: record.isActive,
      fullName: `${record.firstName} ${record.lastName}`,
    };

    if (record.baseSalary) {
      result.baseSalary = parseFloat(record.baseSalary);
    }
    if (record.hourlyRate) {
      result.hourlyRate = parseFloat(record.hourlyRate);
    }

    return result;
  }

  private mapScheduleEntity(record: any): EmployeeSchedule {
    return {
      id: record.id,
      tenantId: record.tenantId,
      employeeId: record.employeeId,
      scheduleDate: record.scheduleDate,
      startTime: record.startTime,
      endTime: record.endTime,
      breakDuration: record.breakDuration,
      lunchBreakStart: record.lunchBreakStart,
      lunchBreakEnd: record.lunchBreakEnd,
      scheduleType: record.scheduleType,
      status: record.status,
      locationId: record.locationId,
      department: record.department,
      notes: record.notes,
      approvedBy: record.approvedBy,
      approvedAt: record.approvedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
      isActive: record.isActive,
    };
  }

  private mapTimeEntryEntity(record: any): TimeEntry {
    const result: any = {
      id: record.id,
      tenantId: record.tenantId,
      employeeId: record.employeeId,
      clockInTime: record.clockInTime,
      clockOutTime: record.clockOutTime,
      breakStartTime: record.breakStartTime,
      breakEndTime: record.breakEndTime,
      totalBreakTime: record.totalBreakTime,
      entryType: record.entryType,
      locationId: record.locationId,
      department: record.department,
      clockInLocation: record.clockInLocation,
      clockOutLocation: record.clockOutLocation,
      isApproved: record.isApproved,
      approvedBy: record.approvedBy,
      approvedAt: record.approvedAt,
      adjustmentReason: record.adjustmentReason,
      adjustedBy: record.adjustedBy,
      adjustedAt: record.adjustedAt,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
      isActive: record.isActive,
      isCurrentlyWorking: !record.clockOutTime,
    };

    if (record.totalHours) {
      result.totalHours = parseFloat(record.totalHours);
    }
    if (record.regularHours) {
      result.regularHours = parseFloat(record.regularHours);
    }
    if (record.overtimeHours) {
      result.overtimeHours = parseFloat(record.overtimeHours);
    }

    return result;
  }

  private mapPerformanceReviewEntity(record: any): PerformanceReview {
    return {
      id: record.id,
      tenantId: record.tenantId,
      employeeId: record.employeeId,
      reviewerId: record.reviewerId,
      reviewPeriodStart: record.reviewPeriodStart,
      reviewPeriodEnd: record.reviewPeriodEnd,
      reviewType: record.reviewType,
      overallRating: record.overallRating,
      goals: record.goals,
      achievements: record.achievements,
      areasForImprovement: record.areasForImprovement,
      ratings: record.ratings,
      reviewerComments: record.reviewerComments,
      employeeComments: record.employeeComments,
      status: record.status,
      completedAt: record.completedAt,
      acknowledgedAt: record.acknowledgedAt,
      nextReviewDate: record.nextReviewDate,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
      isActive: record.isActive,
    };
  }

  private mapTrainingRecordEntity(record: any): TrainingRecord {
    const result: any = {
      id: record.id,
      tenantId: record.tenantId,
      employeeId: record.employeeId,
      trainingName: record.trainingName,
      trainingType: record.trainingType,
      provider: record.provider,
      startDate: record.startDate,
      completionDate: record.completionDate,
      expirationDate: record.expirationDate,
      duration: record.duration,
      certificateNumber: record.certificateNumber,
      certificationBody: record.certificationBody,
      status: record.status,
      approvedBy: record.approvedBy,
      documents: record.documents,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
      isActive: record.isActive,
      isExpired: record.expirationDate ? new Date(record.expirationDate) < new Date() : false,
    };

    if (record.score) {
      result.score = parseFloat(record.score);
    }
    if (record.passingScore) {
      result.passingScore = parseFloat(record.passingScore);
    }
    if (record.cost) {
      result.cost = parseFloat(record.cost);
    }

    return result;
  }

  private mapEmployeeGoalEntity(record: any): EmployeeGoal {
    const result: any = {
      id: record.id,
      tenantId: record.tenantId,
      employeeId: record.employeeId,
      title: record.title,
      description: record.description,
      category: record.category,
      startDate: record.startDate,
      targetDate: record.targetDate,
      completedDate: record.completedDate,
      status: record.status,
      progress: record.progress,
      metrics: record.metrics,
      approvedBy: record.approvedBy,
      reviewedBy: record.reviewedBy,
      lastReviewDate: record.lastReviewDate,
      notes: record.notes,
      updates: record.updates,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      version: record.version,
      isActive: record.isActive,
      isOverdue: record.targetDate ? new Date(record.targetDate) < new Date() && record.status !== 'completed' : false,
    };

    if (record.targetValue) {
      result.targetValue = parseFloat(record.targetValue);
    }
    if (record.currentValue) {
      result.currentValue = parseFloat(record.currentValue);
    }

    return result;
  }
}