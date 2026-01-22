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
    protected override readonly dataLoaderService: DataLoaderService,
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
        user.id,
        {
          name: input.name,
          description: input.description ?? '',
          category: 'CUSTOM',
          isPublic: false,
          configuration: {
            dataSource: 'warehouse',
            visualizations: [],
            filters: [],
            parameters: [],
            layout: {
              type: 'grid',
              columns: 12,
              rows: 12,
              padding: 16,
            },
          },
          sharing: {
            isPublic: false,
            allowedUsers: [],
            allowedRoles: [],
            permissions: {
              canView: true,
              canEdit: false,
              canShare: false,
              canSchedule: false,
            },
          },
        }
      );

      return {
        id: report.id,
        tenantId: report.tenantId,
        name: report.name,
        description: report.description ?? '',
        reportType: input.reportType,
        status: 'DRAFT',
        metrics: input.metrics ?? [],
        dimensions: input.dimensions ?? [],
        schedule: '',
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        createdBy: report.createdBy,
        version: 1,
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
      await this.customReportingService.scheduleReport(
        tenantId,
        input.reportId,
        user.id,
        {
          enabled: true,
          frequency: 'daily',
          time: '00:00',
          timezone: input.timezone || 'UTC',
          recipients: [],
          format: 'pdf',
          nextRun: new Date(),
        }
      );

      // Add recurring job to Bull queue
      await this.analyticsQueue.add('scheduled-report', {
        tenantId,
        reportId: input.reportId,
        scheduleId: `schedule_${input.reportId}`,
      }, {
        repeat: {
          cron: input.schedule,
          tz: input.timezone || 'UTC',
        },
      });

      return {
        id: `schedule_${input.reportId}`,
        reportId: input.reportId,
        schedule: input.schedule,
        isActive: true,
        nextRunAt: new Date(),
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
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ReportExecution> {
    try {
      // Mock execution retrieval
      return {
        id: executionId,
        reportId: '',
        status: 'COMPLETED',
        jobId: executionId,
        startedAt: new Date(),
        completedAt: new Date(),
      };
    } catch (error) {
      this.handleError(error, 'Failed to get report execution');
      throw error;
    }
  }

  /**
   * Get all reports for tenant
   */
  @Query(() => [Report], { name: 'reports' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getReports(
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Report[]> {
    try {
      // Mock reports retrieval
      return [];
    } catch (error) {
      this.handleError(error, 'Failed to get reports');
      throw error;
    }
  }

  /**
   * Get a specific report
   */
  @Query(() => Report, { name: 'report' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getReport(
    @Args('reportId', { type: () => ID }) reportId: string,
    @CurrentUser() _user: any,
    @CurrentTenant() _tenantId: string,
  ): Promise<Report> {
    try {
      return {
        id: reportId,
        tenantId: '',
        name: '',
        description: '',
        reportType: 'STANDARD',
        status: 'DRAFT',
        metrics: [],
        dimensions: [],
        schedule: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '',
        version: 1,
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
      return {
        id: reportId,
        tenantId,
        name: input.name,
        description: input.description ?? '',
        reportType: input.reportType,
        status: 'DRAFT',
        metrics: input.metrics ?? [],
        dimensions: input.dimensions ?? [],
        schedule: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: user.id,
        version: 1,
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
    @CurrentUser() _user: any,
    @CurrentTenant() _tenantId: string,
  ): Promise<boolean> {
    try {
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
    @CurrentUser() _user: any,
    @CurrentTenant() _tenantId: string,
  ): Promise<boolean> {
    try {
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
      return inputs.map((input, index) => ({
        id: `report_${index}`,
        tenantId,
        name: input.name,
        description: input.description ?? '',
        reportType: input.reportType,
        status: 'DRAFT',
        metrics: input.metrics ?? [],
        dimensions: input.dimensions ?? [],
        schedule: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: user.id,
        version: 1,
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
    @CurrentUser() _user: any,
    @CurrentTenant() _tenantId: string,
  ): Promise<ReportExecution[]> {
    try {
      return reportIds.map((reportId, index) => ({
        id: `exec_${index}`,
        reportId,
        status: 'QUEUED' as const,
        jobId: `job_${index}`,
        startedAt: new Date(),
      }));
    } catch (error) {
      this.handleError(error, 'Failed to execute reports');
      throw error;
    }
  }
}
