import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { CustomReportingService } from '../services/custom-reporting.service';
import { Report, ReportExecution, ScheduledReport } from '../types/analytics.types';
import { CreateReportInput, ExecuteReportInput, ScheduleReportInput } from '../inputs/analytics.input';

/**
 * GraphQL resolver for custom reporting operations
 * Provides mutations for creating, executing, and scheduling reports
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class CustomReportingResolver extends BaseResolver {
  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly customReportingService: CustomReportingService,
    @InjectQueue('analytics') private readonly analyticsQueue: Queue,
  ) {
    super(dataLoaderService);
  }

  /**
   * Create a new custom report
   */
  @Mutation(() => Report, { name: 'createReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:write')
  async createReport(
    @Args('input', { type: () => CreateReportInput }) input: CreateReportInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Report> {
    try {
      const report = await this.customReportingService.createReport(
        tenantId,
        {
          name: input.name,
          description: input.description,
          reportType: input.reportType,
          metrics: input.metrics,
          dimensions: input.dimensions,
          startDate: input.startDate,
          endDate: input.endDate,
        },
        user.id
      );

      return {
        id: report.id,
        tenantId: report.tenantId,
        name: report.name,
        description: report.description,
        reportType: report.reportType,
        status: report.status || 'DRAFT',
        metrics: report.metrics,
        dimensions: report.dimensions,
        schedule: report.schedule,
        lastRunAt: report.lastRunAt,
        nextRunAt: report.nextRunAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        deletedAt: report.deletedAt,
        createdBy: report.createdBy,
        updatedBy: report.updatedBy,
        version: report.version || 1,
      };
    } catch (error) {
      this.handleError(error, 'Failed to create report');
      throw error;
    }
  }

  /**
   * Execute a report (enqueues to Bull queue for long-running reports)
   */
  @Query(() => ReportExecution, { name: 'executeReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async executeReport(
    @Args('input', { type: () => ExecuteReportInput }) input: ExecuteReportInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ReportExecution> {
    try {
      // Get report details
      const report = await this.customReportingService.getReport(tenantId, input.reportId);
      
      if (!report) {
        throw new Error(`Report not found: ${input.reportId}`);
      }

      // Create execution record
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Enqueue report execution to Bull queue
      const job = await this.analyticsQueue.add('execute-report', {
        tenantId,
        reportId: input.reportId,
        executionId,
        startDate: input.startDate,
        endDate: input.endDate,
        userId: user.id,
      }, {
        jobId: executionId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });

      // Return execution info with job ID for tracking
      return {
        id: executionId,
        reportId: input.reportId,
        status: 'QUEUED',
        jobId: job.id.toString(),
        startedAt: new Date(),
        completedAt: undefined,
        error: undefined,
        result: undefined,
      };
    } catch (error) {
      this.handleError(error, 'Failed to execute report');
      throw error;
    }
  }

  /**
   * Schedule a report for recurring execution
   */
  @Mutation(() => ScheduledReport, { name: 'scheduleReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:write')
  async scheduleReport(
    @Args('input', { type: () => ScheduleReportInput }) input: ScheduleReportInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ScheduledReport> {
    try {
      const schedule = await this.customReportingService.scheduleReport(
        tenantId,
        {
          reportId: input.reportId,
          schedule: input.schedule,
          timezone: input.timezone || 'UTC',
        },
        user.id
      );

      // Add recurring job to Bull queue
      await this.analyticsQueue.add('scheduled-report', {
        tenantId,
        reportId: input.reportId,
        scheduleId: schedule.id,
      }, {
        repeat: {
          cron: input.schedule,
          tz: input.timezone || 'UTC',
        },
      });

      return {
        id: schedule.id,
        reportId: schedule.reportId,
        schedule: schedule.schedule,
        isActive: schedule.isActive !== false,
        nextRunAt: schedule.nextRunAt,
        lastRunAt: schedule.lastRunAt,
      };
    } catch (error) {
      this.handleError(error, 'Failed to schedule report');
      throw error;
    }
  }

  /**
   * Get report execution status
   */
  @Query(() => ReportExecution, { name: 'getReportExecution' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getReportExecution(
    @Args('executionId', { type: () => ID }) executionId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ReportExecution> {
    try {
      const execution = await this.customReportingService.getExecution(tenantId, executionId);
      
      if (!execution) {
        throw new Error(`Execution not found: ${executionId}`);
      }

      return {
        id: execution.id,
        reportId: execution.reportId,
        status: execution.status,
        jobId: execution.jobId,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        error: execution.error,
        result: execution.result,
      };
    } catch (error) {
      this.handleError(error, 'Failed to get report execution');
      throw error;
    }
  }

  /**
   * Get all reports for tenant
   */
  @Query(() => [Report], { name: 'getReports' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getReports(
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Report[]> {
    try {
      const reports = await this.customReportingService.getReports(tenantId);
      
      return reports.map(report => ({
        id: report.id,
        tenantId: report.tenantId,
        name: report.name,
        description: report.description,
        reportType: report.reportType,
        status: report.status || 'DRAFT',
        metrics: report.metrics,
        dimensions: report.dimensions,
        schedule: report.schedule,
        lastRunAt: report.lastRunAt,
        nextRunAt: report.nextRunAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        deletedAt: report.deletedAt,
        createdBy: report.createdBy,
        updatedBy: report.updatedBy,
        version: report.version || 1,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to get reports');
      throw error;
    }
  }

  /**
   * Get a specific report
   */
  @Query(() => Report, { name: 'getReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getReport(
    @Args('reportId', { type: () => ID }) reportId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Report> {
    try {
      const report = await this.customReportingService.getReport(tenantId, reportId);
      
      if (!report) {
        throw new Error(`Report not found: ${reportId}`);
      }

      return {
        id: report.id,
        tenantId: report.tenantId,
        name: report.name,
        description: report.description,
        reportType: report.reportType,
        status: report.status || 'DRAFT',
        metrics: report.metrics,
        dimensions: report.dimensions,
        schedule: report.schedule,
        lastRunAt: report.lastRunAt,
        nextRunAt: report.nextRunAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        deletedAt: report.deletedAt,
        createdBy: report.createdBy,
        updatedBy: report.updatedBy,
        version: report.version || 1,
      };
    } catch (error) {
      this.handleError(error, 'Failed to get report');
      throw error;
    }
  }

  /**
   * Update an existing report
   */
  @Mutation(() => Report, { name: 'updateReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:write')
  async updateReport(
    @Args('reportId', { type: () => ID }) reportId: string,
    @Args('input', { type: () => CreateReportInput }) input: CreateReportInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Report> {
    try {
      const report = await this.customReportingService.updateReport(
        tenantId,
        reportId,
        user.id,
        {
          name: input.name,
          description: input.description,
          reportType: input.reportType,
          metrics: input.metrics,
          dimensions: input.dimensions,
          startDate: input.startDate,
          endDate: input.endDate,
        }
      );

      return {
        id: report.id,
        tenantId: report.tenantId,
        name: report.name,
        description: report.description,
        reportType: report.reportType,
        status: report.status || 'DRAFT',
        metrics: report.metrics,
        dimensions: report.dimensions,
        schedule: report.schedule,
        lastRunAt: report.lastRunAt,
        nextRunAt: report.nextRunAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        deletedAt: report.deletedAt,
        createdBy: report.createdBy,
        updatedBy: report.updatedBy,
        version: report.version || 1,
      };
    } catch (error) {
      this.handleError(error, 'Failed to update report');
      throw error;
    }
  }

  /**
   * Delete a report
   */
  @Mutation(() => Boolean, { name: 'deleteReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:write')
  async deleteReport(
    @Args('reportId', { type: () => ID }) reportId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    try {
      await this.customReportingService.deleteReport(tenantId, reportId);
      return true;
    } catch (error) {
      this.handleError(error, 'Failed to delete report');
      throw error;
    }
  }

  /**
   * Unschedule a report
   */
  @Mutation(() => Boolean, { name: 'unscheduleReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:write')
  async unscheduleReport(
    @Args('reportId', { type: () => ID }) reportId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    try {
      await this.customReportingService.unscheduleReport?.(tenantId, reportId);
      return true;
    } catch (error) {
      this.handleError(error, 'Failed to unschedule report');
      throw error;
    }
  }

  /**
   * Batch create reports
   */
  @Mutation(() => [Report], { name: 'createReports' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:write')
  async createReports(
    @Args('inputs', { type: () => [CreateReportInput] }) inputs: CreateReportInput[],
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Report[]> {
    try {
      const reports = await Promise.all(
        inputs.map(input => this.customReportingService.createReport(
          tenantId,
          {
            name: input.name,
            description: input.description,
            reportType: input.reportType,
            metrics: input.metrics,
            dimensions: input.dimensions,
            startDate: input.startDate,
            endDate: input.endDate,
          },
          user.id
        ))
      );

      return reports.map(report => ({
        id: report.id,
        tenantId: report.tenantId,
        name: report.name,
        description: report.description,
        reportType: report.reportType,
        status: report.status || 'DRAFT',
        metrics: report.metrics,
        dimensions: report.dimensions,
        schedule: report.schedule,
        lastRunAt: report.lastRunAt,
        nextRunAt: report.nextRunAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        deletedAt: report.deletedAt,
        createdBy: report.createdBy,
        updatedBy: report.updatedBy,
        version: report.version || 1,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to create reports');
      throw error;
    }
  }

  /**
   * Batch execute reports
   */
  @Mutation(() => [ReportExecution], { name: 'executeReports' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async executeReports(
    @Args('reportIds', { type: () => [ID] }) reportIds: string[],
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ReportExecution[]> {
    try {
      const executions = await Promise.all(
        reportIds.map(async (reportId) => {
          const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          
          const job = await this.analyticsQueue.add('execute-report', {
            tenantId,
            reportId,
            executionId,
            userId: user.id,
          }, {
            jobId: executionId,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          });

          return {
            id: executionId,
            reportId,
            status: 'QUEUED' as const,
            jobId: job.id.toString(),
            startedAt: new Date(),
            completedAt: undefined,
            error: undefined,
            result: undefined,
          };
        })
      );

      return executions;
    } catch (error) {
      this.handleError(error, 'Failed to execute reports');
      throw error;
    }
  }
}
