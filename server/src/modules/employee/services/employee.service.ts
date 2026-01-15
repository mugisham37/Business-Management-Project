import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { EmployeeRepository } from '../repositories/employee.repository';
import { 
  CreateEmployeeDto, 
  UpdateEmployeeDto,
  CreateEmployeeScheduleDto,
  UpdateEmployeeScheduleDto,
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
  ClockInDto,
  ClockOutDto,
  CreatePerformanceReviewDto,
  UpdatePerformanceReviewDto,
  CreateTrainingRecordDto,
  UpdateTrainingRecordDto,
  CreateEmployeeGoalDto,
  UpdateEmployeeGoalDto,
  EmployeeQueryDto,
  TimeEntryQueryDto
} from '../dto/employee.dto';
import { Employee, EmployeeSchedule, TimeEntry, PerformanceReview, TrainingRecord, EmployeeGoal } from '../entities/employee.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Employee management
  async createEmployee(tenantId: string, data: CreateEmployeeDto, createdBy: string): Promise<Employee> {
    // Check if employee number already exists
    const existingEmployee = await this.employeeRepository.findEmployeeByNumber(tenantId, data.employeeNumber);
    if (existingEmployee) {
      throw new ConflictException(`Employee with number ${data.employeeNumber} already exists`);
    }

    const employee = await this.employeeRepository.createEmployee(tenantId, data, createdBy);

    // Emit event for employee creation
    this.eventEmitter.emit('employee.created', {
      tenantId,
      employeeId: employee.id,
      employee,
      createdBy,
    });

    return employee;
  }

  async findEmployeeById(tenantId: string, id: string): Promise<Employee> {
    const employee = await this.employeeRepository.findEmployeeById(tenantId, id);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return employee;
  }

  async findEmployeeByNumber(tenantId: string, employeeNumber: string): Promise<Employee> {
    const employee = await this.employeeRepository.findEmployeeByNumber(tenantId, employeeNumber);
    if (!employee) {
      throw new NotFoundException(`Employee with number ${employeeNumber} not found`);
    }
    return employee;
  }

  async findEmployees(tenantId: string, query: EmployeeQueryDto): Promise<{ employees: Employee[]; total: number; page: number; limit: number }> {
    const result = await this.employeeRepository.findEmployees(tenantId, query);
    
    return {
      ...result,
      page: query.page || 1,
      limit: query.limit || 20,
    };
  }

  async updateEmployee(tenantId: string, id: string, data: UpdateEmployeeDto, updatedBy: string): Promise<Employee> {
    // Verify employee exists
    await this.findEmployeeById(tenantId, id);

    // Check if employee number is being changed and if it conflicts
    if (data.employeeNumber) {
      const existingEmployee = await this.employeeRepository.findEmployeeByNumber(tenantId, data.employeeNumber);
      if (existingEmployee && existingEmployee.id !== id) {
        throw new ConflictException(`Employee with number ${data.employeeNumber} already exists`);
      }
    }

    const employee = await this.employeeRepository.updateEmployee(tenantId, id, data, updatedBy);

    // Emit event for employee update
    this.eventEmitter.emit('employee.updated', {
      tenantId,
      employeeId: employee.id,
      employee,
      updatedBy,
      changes: data,
    });

    return employee;
  }

  async deleteEmployee(tenantId: string, id: string, deletedBy: string): Promise<void> {
    // Verify employee exists
    const employee = await this.findEmployeeById(tenantId, id);

    await this.employeeRepository.deleteEmployee(tenantId, id, deletedBy);

    // Emit event for employee deletion
    this.eventEmitter.emit('employee.deleted', {
      tenantId,
      employeeId: id,
      employee,
      deletedBy,
    });
  }

  // Employee scheduling
  async createSchedule(tenantId: string, data: CreateEmployeeScheduleDto, createdBy: string): Promise<EmployeeSchedule> {
    // Verify employee exists
    await this.findEmployeeById(tenantId, data.employeeId);

    // Validate schedule times
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check for schedule conflicts
    const existingSchedules = await this.employeeRepository.findSchedulesByEmployee(
      tenantId, 
      data.employeeId, 
      new Date(data.scheduleDate), 
      new Date(data.scheduleDate)
    );

    const hasConflict = existingSchedules.some(schedule => {
      const existingStart = new Date(schedule.startTime);
      const existingEnd = new Date(schedule.endTime);
      
      return (startTime < existingEnd && endTime > existingStart);
    });

    if (hasConflict) {
      throw new ConflictException('Schedule conflicts with existing schedule');
    }

    const schedule = await this.employeeRepository.createSchedule(tenantId, data, createdBy);

    // Emit event for schedule creation
    this.eventEmitter.emit('employee.schedule.created', {
      tenantId,
      employeeId: data.employeeId,
      scheduleId: schedule.id,
      schedule,
      createdBy,
    });

    return schedule;
  }

  async findSchedulesByEmployee(tenantId: string, employeeId: string, startDate?: Date, endDate?: Date): Promise<EmployeeSchedule[]> {
    // Verify employee exists
    await this.findEmployeeById(tenantId, employeeId);

    return this.employeeRepository.findSchedulesByEmployee(tenantId, employeeId, startDate, endDate);
  }

  async updateSchedule(tenantId: string, id: string, data: UpdateEmployeeScheduleDto, updatedBy: string): Promise<EmployeeSchedule> {
    const schedule = await this.employeeRepository.updateSchedule(tenantId, id, data, updatedBy);

    // Emit event for schedule update
    this.eventEmitter.emit('employee.schedule.updated', {
      tenantId,
      scheduleId: id,
      schedule,
      updatedBy,
      changes: data,
    });

    return schedule;
  }

  // Time tracking
  async clockIn(tenantId: string, data: ClockInDto, createdBy: string): Promise<TimeEntry> {
    // Verify employee exists
    await this.findEmployeeById(tenantId, data.employeeId);

    // Check if employee is already clocked in
    const activeTimeEntry = await this.employeeRepository.findActiveTimeEntry(tenantId, data.employeeId);
    if (activeTimeEntry) {
      throw new ConflictException('Employee is already clocked in');
    }

    const timeEntryData: CreateTimeEntryDto = {
      employeeId: data.employeeId,
      clockInTime: new Date().toISOString(),
      ...(data.locationId && { locationId: data.locationId }),
      ...(data.location && { clockInLocation: data.location }),
      ...(data.notes && { notes: data.notes }),
    };

    const timeEntry = await this.employeeRepository.createTimeEntry(tenantId, timeEntryData, createdBy);

    // Emit event for clock in
    this.eventEmitter.emit('employee.clocked.in', {
      tenantId,
      employeeId: data.employeeId,
      timeEntryId: timeEntry.id,
      timeEntry,
      clockInTime: timeEntry.clockInTime,
    });

    return timeEntry;
  }

  async clockOut(tenantId: string, data: ClockOutDto, updatedBy: string): Promise<TimeEntry> {
    const clockOutTime = new Date();
    
    const updateData: UpdateTimeEntryDto = {
      clockOutTime: clockOutTime.toISOString(),
      ...(data.location && { clockOutLocation: data.location }),
      ...(data.notes && { notes: data.notes }),
    };

    // Calculate total hours
    const timeEntry = await this.employeeRepository.findActiveTimeEntry(tenantId, data.timeEntryId);
    if (!timeEntry) {
      throw new NotFoundException('Active time entry not found');
    }

    const clockInTime = new Date(timeEntry.clockInTime);
    const totalHours = this.calculateHours(clockInTime, clockOutTime);
    const { regularHours, overtimeHours } = this.calculateRegularAndOvertimeHours(totalHours);

    updateData.totalHours = totalHours;
    updateData.regularHours = regularHours;
    updateData.overtimeHours = overtimeHours;

    const updatedTimeEntry = await this.employeeRepository.updateTimeEntry(tenantId, data.timeEntryId, updateData, updatedBy);

    // Emit event for clock out
    this.eventEmitter.emit('employee.clocked.out', {
      tenantId,
      employeeId: updatedTimeEntry.employeeId,
      timeEntryId: updatedTimeEntry.id,
      timeEntry: updatedTimeEntry,
      clockOutTime: updatedTimeEntry.clockOutTime,
      totalHours: updatedTimeEntry.totalHours,
    });

    return updatedTimeEntry;
  }

  async findTimeEntries(tenantId: string, query: TimeEntryQueryDto): Promise<{ timeEntries: TimeEntry[]; total: number; page: number; limit: number }> {
    const result = await this.employeeRepository.findTimeEntries(tenantId, query);
    
    return {
      ...result,
      page: query.page || 1,
      limit: query.limit || 20,
    };
  }

  async approveTimeEntry(tenantId: string, timeEntryId: string, approvedBy: string): Promise<TimeEntry> {
    const updateData: UpdateTimeEntryDto = {
      isApproved: true,
      approvedBy,
      approvedAt: new Date().toISOString(),
    };

    const timeEntry = await this.employeeRepository.updateTimeEntry(tenantId, timeEntryId, updateData, approvedBy);

    // Emit event for time entry approval
    this.eventEmitter.emit('employee.timeentry.approved', {
      tenantId,
      timeEntryId,
      timeEntry,
      approvedBy,
    });

    return timeEntry;
  }

  // Performance management
  async createPerformanceReview(tenantId: string, data: CreatePerformanceReviewDto, createdBy: string): Promise<PerformanceReview> {
    // Verify employee and reviewer exist
    await this.findEmployeeById(tenantId, data.employeeId);
    await this.findEmployeeById(tenantId, data.reviewerId);

    const review = await this.employeeRepository.createPerformanceReview(tenantId, data, createdBy);

    // Emit event for performance review creation
    this.eventEmitter.emit('employee.performance.review.created', {
      tenantId,
      employeeId: data.employeeId,
      reviewId: review.id,
      review,
      createdBy,
    });

    return review;
  }

  async findPerformanceReviewsByEmployee(tenantId: string, employeeId: string): Promise<PerformanceReview[]> {
    // Verify employee exists
    await this.findEmployeeById(tenantId, employeeId);

    return this.employeeRepository.findPerformanceReviewsByEmployee(tenantId, employeeId);
  }

  // Training management
  async createTrainingRecord(tenantId: string, data: CreateTrainingRecordDto, createdBy: string): Promise<TrainingRecord> {
    // Verify employee exists
    await this.findEmployeeById(tenantId, data.employeeId);

    const training = await this.employeeRepository.createTrainingRecord(tenantId, data, createdBy);

    // Emit event for training record creation
    this.eventEmitter.emit('employee.training.created', {
      tenantId,
      employeeId: data.employeeId,
      trainingId: training.id,
      training,
      createdBy,
    });

    return training;
  }

  async findTrainingRecordsByEmployee(tenantId: string, employeeId: string): Promise<TrainingRecord[]> {
    // Verify employee exists
    await this.findEmployeeById(tenantId, employeeId);

    return this.employeeRepository.findTrainingRecordsByEmployee(tenantId, employeeId);
  }

  // Goal management
  async createEmployeeGoal(tenantId: string, data: CreateEmployeeGoalDto, createdBy: string): Promise<EmployeeGoal> {
    // Verify employee exists
    await this.findEmployeeById(tenantId, data.employeeId);

    const goal = await this.employeeRepository.createEmployeeGoal(tenantId, data, createdBy);

    // Emit event for goal creation
    this.eventEmitter.emit('employee.goal.created', {
      tenantId,
      employeeId: data.employeeId,
      goalId: goal.id,
      goal,
      createdBy,
    });

    return goal;
  }

  async findGoalsByEmployee(tenantId: string, employeeId: string): Promise<EmployeeGoal[]> {
    // Verify employee exists
    await this.findEmployeeById(tenantId, employeeId);

    return this.employeeRepository.findGoalsByEmployee(tenantId, employeeId);
  }

  // Helper methods
  private calculateHours(startTime: Date, endTime: Date): number {
    const diffInMs = endTime.getTime() - startTime.getTime();
    return Math.round((diffInMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimal places
  }

  private calculateRegularAndOvertimeHours(totalHours: number): { regularHours: number; overtimeHours: number } {
    const regularWorkDay = 8; // 8 hours regular work day
    
    if (totalHours <= regularWorkDay) {
      return {
        regularHours: totalHours,
        overtimeHours: 0,
      };
    }

    return {
      regularHours: regularWorkDay,
      overtimeHours: totalHours - regularWorkDay,
    };
  }

  // Analytics and reporting methods
  async getEmployeeAnalytics(tenantId: string, employeeId: string, startDate: Date, endDate: Date): Promise<any> {
    // Verify employee exists
    await this.findEmployeeById(tenantId, employeeId);

    const timeEntries = await this.employeeRepository.findTimeEntries(tenantId, {
      employeeId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      page: 1,
      limit: 1000, // Get all entries for analytics
    });

    const totalHours = timeEntries.timeEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0);
    const regularHours = timeEntries.timeEntries.reduce((sum, entry) => sum + (entry.regularHours || 0), 0);
    const overtimeHours = timeEntries.timeEntries.reduce((sum, entry) => sum + (entry.overtimeHours || 0), 0);
    const workDays = timeEntries.timeEntries.length;

    return {
      employeeId,
      period: { startDate, endDate },
      totalHours,
      regularHours,
      overtimeHours,
      workDays,
      averageHoursPerDay: workDays > 0 ? totalHours / workDays : 0,
      attendanceRate: this.calculateAttendanceRate(timeEntries.timeEntries, startDate, endDate),
    };
  }

  private calculateAttendanceRate(timeEntries: TimeEntry[], startDate: Date, endDate: Date): number {
    // Calculate expected work days (excluding weekends)
    const expectedWorkDays = this.getWorkDaysBetween(startDate, endDate);
    const actualWorkDays = timeEntries.length;
    
    return expectedWorkDays > 0 ? (actualWorkDays / expectedWorkDays) * 100 : 0;
  }

  private getWorkDaysBetween(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }
}