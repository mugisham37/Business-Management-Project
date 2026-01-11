import { Injectable, BadRequestException } from '@nestjs/common';
import { EmployeeRepository } from '../repositories/employee.repository';
import { ComplianceRepository } from '../repositories/compliance.repository';
import { 
  ComplianceCheckDto,
  BreakTimeDto,
  ComplianceReportDto,
  LaborLawViolationDto,
  ComplianceCheckType,
  ComplianceStatus,
  ViolationType,
  ViolationSeverity
} from '../dto/compliance.dto';
import { ComplianceCheck, BreakTimeRecord, LaborLawViolation } from '../entities/compliance.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly complianceRepository: ComplianceRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Labor Law Compliance Checks
  async performComplianceCheck(tenantId: string, employeeId: string, checkDate: Date, performedBy: string): Promise<ComplianceCheck> {
    // Verify employee exists
    const employee = await this.employeeRepository.findEmployeeById(tenantId, employeeId);
    if (!employee) {
      throw new BadRequestException(`Employee with ID ${employeeId} not found`);
    }

    // Get time entries for the check period (last 7 days)
    const endDate = new Date(checkDate);
    const startDate = new Date(checkDate);
    startDate.setDate(startDate.getDate() - 7);

    const timeEntries = await this.employeeRepository.findTimeEntries(tenantId, {
      employeeId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      page: 1,
      limit: 1000,
    });

    // Perform various compliance checks
    const violations = [];

    // Check maximum hours per day (8 hours regular + 4 hours overtime max)
    const dailyHoursViolations = this.checkDailyHoursCompliance(timeEntries.timeEntries);
    violations.push(...dailyHoursViolations);

    // Check maximum hours per week (40 hours regular + 12 hours overtime max)
    const weeklyHoursViolations = this.checkWeeklyHoursCompliance(timeEntries.timeEntries);
    violations.push(...weeklyHoursViolations);

    // Check break time compliance
    const breakViolations = this.checkBreakTimeCompliance(timeEntries.timeEntries);
    violations.push(...breakViolations);

    // Check consecutive work days (max 6 days without a day off)
    const consecutiveDaysViolations = this.checkConsecutiveWorkDays(timeEntries.timeEntries);
    violations.push(...consecutiveDaysViolations);

    // Check minimum rest between shifts (8 hours minimum)
    const restPeriodViolations = this.checkRestPeriodCompliance(timeEntries.timeEntries);
    violations.push(...restPeriodViolations);

    const complianceData: ComplianceCheckDto = {
      employeeId,
      checkDate: checkDate.toISOString(),
      checkType: ComplianceCheckType.LABOR_LAW_COMPLIANCE,
      status: violations.length > 0 ? ComplianceStatus.VIOLATIONS_FOUND : ComplianceStatus.COMPLIANT,
      violations,
      totalViolations: violations.length,
      notes: `Compliance check performed for period ${startDate.toISOString()} to ${endDate.toISOString()}`,
    };

    const complianceCheck = await this.complianceRepository.createComplianceCheck(tenantId, complianceData, performedBy);

    // Create violation records if any
    for (const violation of violations) {
      await this.complianceRepository.createLaborLawViolation(tenantId, {
        employeeId,
        complianceCheckId: complianceCheck.id,
        violationType: violation.type,
        violationDate: violation.date,
        description: violation.description,
        severity: violation.severity,
        details: violation.details,
      }, performedBy);
    }

    // Emit event for compliance check
    this.eventEmitter.emit('compliance.check.completed', {
      tenantId,
      employeeId,
      complianceCheckId: complianceCheck.id,
      violationsFound: violations.length,
      performedBy,
    });

    return complianceCheck;
  }

  // Break Time Management
  async recordBreakTime(tenantId: string, data: BreakTimeDto, recordedBy: string): Promise<BreakTimeRecord> {
    // Verify employee exists
    const employee = await this.employeeRepository.findEmployeeById(tenantId, data.employeeId);
    if (!employee) {
      throw new BadRequestException(`Employee with ID ${data.employeeId} not found`);
    }

    // Validate break times
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException('Break start time must be before end time');
    }

    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // Duration in minutes

    const breakRecord = await this.complianceRepository.createBreakTimeRecord(tenantId, {
      ...data,
      duration,
    }, recordedBy);

    // Emit event for break time recording
    this.eventEmitter.emit('compliance.break.recorded', {
      tenantId,
      employeeId: data.employeeId,
      breakRecordId: breakRecord.id,
      duration,
      recordedBy,
    });

    return breakRecord;
  }

  async getBreakTimeRecords(tenantId: string, employeeId: string, startDate: Date, endDate: Date): Promise<BreakTimeRecord[]> {
    return this.complianceRepository.findBreakTimeRecords(tenantId, employeeId, startDate, endDate);
  }

  // Compliance Reporting
  async generateComplianceReport(tenantId: string, query: ComplianceReportDto): Promise<any> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    // Get all compliance checks in the period
    const complianceChecks = await this.complianceRepository.findComplianceChecks(tenantId, {
      startDate: query.startDate,
      endDate: query.endDate,
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.department && { department: query.department }),
    });

    // Get all violations in the period
    const violations = await this.complianceRepository.findLaborLawViolations(tenantId, {
      startDate: query.startDate,
      endDate: query.endDate,
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.violationType && { violationType: query.violationType }),
    });

    // Calculate compliance metrics
    const totalChecks = complianceChecks.length;
    const compliantChecks = complianceChecks.filter(check => check.status === ComplianceStatus.COMPLIANT).length;
    const complianceRate = totalChecks > 0 ? (compliantChecks / totalChecks) * 100 : 100;

    // Group violations by type
    const violationsByType = violations.reduce((acc: Record<string, any[]>, violation) => {
      const type = violation.violationType;
      if (type) {
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(violation);
      }
      return acc;
    }, {} as Record<string, any[]>);

    // Group violations by severity
    const violationsBySeverity = violations.reduce((acc: Record<string, number>, violation) => {
      const severity = violation.severity;
      if (severity) {
        if (!acc[severity]) {
          acc[severity] = 0;
        }
        acc[severity]++;
      }
      return acc;
    }, {} as Record<string, number>);

    // Calculate trends
    const trends = this.calculateComplianceTrends(complianceChecks, startDate, endDate);

    const report = {
      period: { startDate, endDate },
      summary: {
        totalChecks,
        compliantChecks,
        complianceRate,
        totalViolations: violations.length,
        violationsByType: Object.keys(violationsByType).map(type => ({
          type,
          count: violationsByType[type]?.length ?? 0,
          violations: violationsByType[type] ?? [],
        })),
        violationsBySeverity,
      },
      trends,
      recommendations: this.generateComplianceRecommendations(violations, complianceRate),
      generatedAt: new Date().toISOString(),
    };

    return report;
  }

  // Audit Trail Management
  async getAuditTrail(tenantId: string, employeeId: string, startDate: Date, endDate: Date): Promise<any[]> {
    // Get all HR-related audit events for the employee
    const auditEvents = await this.complianceRepository.findAuditTrail(tenantId, {
      employeeId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      eventTypes: [
        'employee.created',
        'employee.updated',
        'employee.deleted',
        'schedule.created',
        'schedule.updated',
        'timeentry.created',
        'timeentry.updated',
        'timeentry.approved',
        'performance.review.created',
        'performance.review.completed',
        'goal.created',
        'goal.updated',
        'training.created',
        'training.completed',
        'payroll.calculated',
        'compliance.check.completed',
      ],
    });

    return auditEvents.map(event => ({
      id: event.id,
      eventType: event.eventType,
      eventDate: event.eventDate,
      performedBy: event.performedBy,
      description: event.description,
      details: event.details,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    }));
  }

  // Private helper methods for compliance checks
  private checkDailyHoursCompliance(timeEntries: any[]): any[] {
    const violations = [];
    const dailyHours = this.groupTimeEntriesByDate(timeEntries);

    for (const [date, entries] of Object.entries(dailyHours)) {
      const totalHours = entries.reduce((sum: number, entry: any) => sum + (entry.totalHours || 0), 0);
      
      if (totalHours > 12) { // Maximum 12 hours per day (8 regular + 4 overtime)
        violations.push({
          type: 'daily_hours_exceeded',
          date,
          description: `Daily hours exceeded: ${totalHours} hours worked (maximum 12 hours allowed)`,
          severity: 'high',
          details: {
            hoursWorked: totalHours,
            maxAllowed: 12,
            entries: entries.map((e: any) => ({
              clockIn: e.clockInTime,
              clockOut: e.clockOutTime,
              hours: e.totalHours,
            })),
          },
        });
      }
    }

    return violations;
  }

  private checkWeeklyHoursCompliance(timeEntries: any[]): any[] {
    const violations = [];
    const weeklyHours = this.groupTimeEntriesByWeek(timeEntries);

    for (const [week, entries] of Object.entries(weeklyHours)) {
      const totalHours = entries.reduce((sum: number, entry: any) => sum + (entry.totalHours || 0), 0);
      
      if (totalHours > 52) { // Maximum 52 hours per week (40 regular + 12 overtime)
        violations.push({
          type: 'weekly_hours_exceeded',
          date: week,
          description: `Weekly hours exceeded: ${totalHours} hours worked (maximum 52 hours allowed)`,
          severity: 'high',
          details: {
            hoursWorked: totalHours,
            maxAllowed: 52,
            weekStart: week,
          },
        });
      }
    }

    return violations;
  }

  private checkBreakTimeCompliance(timeEntries: any[]): any[] {
    const violations = [];

    for (const entry of timeEntries) {
      const totalHours = entry.totalHours || 0;
      const breakTime = entry.totalBreakTime || 0; // in minutes

      // If working more than 6 hours, must have at least 30 minutes break
      if (totalHours > 6 && breakTime < 30) {
        violations.push({
          type: 'insufficient_break_time',
          date: entry.clockInTime.split('T')[0],
          description: `Insufficient break time: ${breakTime} minutes for ${totalHours} hours worked (minimum 30 minutes required)`,
          severity: 'medium',
          details: {
            hoursWorked: totalHours,
            breakTime,
            requiredBreakTime: 30,
          },
        });
      }

      // If working more than 8 hours, must have at least 60 minutes break
      if (totalHours > 8 && breakTime < 60) {
        violations.push({
          type: 'insufficient_break_time_extended',
          date: entry.clockInTime.split('T')[0],
          description: `Insufficient break time for extended shift: ${breakTime} minutes for ${totalHours} hours worked (minimum 60 minutes required)`,
          severity: 'high',
          details: {
            hoursWorked: totalHours,
            breakTime,
            requiredBreakTime: 60,
          },
        });
      }
    }

    return violations;
  }

  private checkConsecutiveWorkDays(timeEntries: any[]): any[] {
    const violations = [];
    const workDates = timeEntries
      .map(entry => entry.clockInTime.split('T')[0])
      .sort()
      .filter((date, index, array) => array.indexOf(date) === index); // Remove duplicates

    let consecutiveDays = 1;
    let startDate = workDates[0];

    for (let i = 1; i < workDates.length; i++) {
      const currentDate = new Date(workDates[i]);
      const previousDate = new Date(workDates[i - 1]);
      const dayDifference = (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);

      if (dayDifference === 1) {
        consecutiveDays++;
      } else {
        if (consecutiveDays > 6) {
          violations.push({
            type: 'consecutive_work_days_exceeded',
            date: startDate,
            description: `Consecutive work days exceeded: ${consecutiveDays} days (maximum 6 days allowed)`,
            severity: 'high',
            details: {
              consecutiveDays,
              maxAllowed: 6,
              startDate,
              endDate: workDates[i - 1],
            },
          });
        }
        consecutiveDays = 1;
        startDate = workDates[i];
      }
    }

    // Check the last sequence
    if (consecutiveDays > 6) {
      violations.push({
        type: 'consecutive_work_days_exceeded',
        date: startDate,
        description: `Consecutive work days exceeded: ${consecutiveDays} days (maximum 6 days allowed)`,
        severity: 'high',
        details: {
          consecutiveDays,
          maxAllowed: 6,
          startDate,
          endDate: workDates[workDates.length - 1],
        },
      });
    }

    return violations;
  }

  private checkRestPeriodCompliance(timeEntries: any[]): any[] {
    const violations = [];
    const sortedEntries = timeEntries.sort((a, b) => 
      new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime()
    );

    for (let i = 1; i < sortedEntries.length; i++) {
      const previousEntry = sortedEntries[i - 1];
      const currentEntry = sortedEntries[i];

      if (previousEntry.clockOutTime && currentEntry.clockInTime) {
        const previousClockOut = new Date(previousEntry.clockOutTime);
        const currentClockIn = new Date(currentEntry.clockInTime);
        const restHours = (currentClockIn.getTime() - previousClockOut.getTime()) / (1000 * 60 * 60);

        if (restHours < 8) {
          violations.push({
            type: 'insufficient_rest_period',
            date: currentEntry.clockInTime.split('T')[0],
            description: `Insufficient rest period: ${restHours.toFixed(1)} hours between shifts (minimum 8 hours required)`,
            severity: 'medium',
            details: {
              restHours: restHours.toFixed(1),
              minRequired: 8,
              previousClockOut: previousEntry.clockOutTime,
              currentClockIn: currentEntry.clockInTime,
            },
          });
        }
      }
    }

    return violations;
  }

  private groupTimeEntriesByDate(timeEntries: any[]): Record<string, any[]> {
    return timeEntries.reduce((acc: Record<string, any[]>, entry: any) => {
      if (entry?.clockInTime) {
        const date = entry.clockInTime.split('T')[0];
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(entry);
      }
      return acc;
    }, {} as Record<string, any[]>);
  }

  private groupTimeEntriesByWeek(timeEntries: any[]): Record<string, any[]> {
    return timeEntries.reduce((acc: Record<string, any[]>, entry: any) => {
      if (entry?.clockInTime) {
        const date = new Date(entry.clockInTime);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
        const weekKey = weekStart.toISOString().split('T')[0]!;
        
        if (!acc[weekKey]) {
          acc[weekKey] = [];
        }
        acc[weekKey].push(entry);
      }
      return acc;
    }, {} as Record<string, any[]>);
  }

  private calculateComplianceTrends(complianceChecks: any[], startDate: Date, endDate: Date): any {
    // Group checks by week
    const weeklyData = complianceChecks.reduce((acc: Record<string, { total: number; compliant: number }>, check: any) => {
      if (check?.checkDate) {
        const checkDate = new Date(check.checkDate);
        const weekStart = new Date(checkDate);
        weekStart.setDate(checkDate.getDate() - checkDate.getDay());
        const weekKey = weekStart.toISOString().split('T')[0]!;

        if (!acc[weekKey]) {
          acc[weekKey] = { total: 0, compliant: 0 };
        }
        acc[weekKey].total++;
        if (check.status === ComplianceStatus.COMPLIANT) {
          acc[weekKey].compliant++;
        }
      }
      return acc;
    }, {} as Record<string, { total: number; compliant: number }>);

    const trends = Object.entries(weeklyData).map(([week, data]: [string, { total: number; compliant: number }]) => ({
      week,
      complianceRate: data.total > 0 ? (data.compliant / data.total) * 100 : 100,
      totalChecks: data.total,
    }));

    return trends.sort((a, b) => a.week.localeCompare(b.week));
  }

  private generateComplianceRecommendations(violations: any[], complianceRate: number): any[] {
    const recommendations = [];

    if (complianceRate < 80) {
      recommendations.push({
        priority: 'high',
        title: 'Improve Overall Compliance',
        description: 'Compliance rate is below acceptable threshold. Implement systematic compliance monitoring.',
        actions: [
          'Conduct weekly compliance audits',
          'Provide additional training to managers',
          'Implement automated compliance alerts',
        ],
      });
    }

    const violationTypes = violations.reduce((acc: Record<string, number>, violation) => {
      const type = violation.type;
      if (type) {
        acc[type] = (acc[type] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    if (violationTypes['daily_hours_exceeded'] && violationTypes['daily_hours_exceeded'] > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Address Daily Hours Violations',
        description: 'Multiple instances of daily hour limits being exceeded.',
        actions: [
          'Implement automatic overtime alerts',
          'Review scheduling practices',
          'Ensure proper break scheduling',
        ],
      });
    }

    if (violationTypes['insufficient_break_time'] && violationTypes['insufficient_break_time'] > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Improve Break Time Management',
        description: 'Employees are not taking required break times.',
        actions: [
          'Implement mandatory break reminders',
          'Train supervisors on break time requirements',
          'Monitor break compliance more closely',
        ],
      });
    }

    return recommendations;
  }
}