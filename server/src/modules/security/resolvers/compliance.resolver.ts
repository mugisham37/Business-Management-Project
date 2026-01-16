import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { ComplianceService } from '../services/compliance.service';
import { QueueService } from '../../queue/queue.service';
import { 
  ComplianceFramework, 
  ComplianceReport, 
  ComplianceViolation,
  ComplianceRequirement
} from '../types/security.types';
import { 
  RunComplianceCheckInput, 
  AcknowledgeViolationInput 
} from '../inputs/security.input';

/**
 * GraphQL resolver for compliance tracking
 * Provides queries and mutations for compliance management
 * Enqueues compliance checks to Bull queue for background processing
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class ComplianceResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly complianceService: ComplianceService,
    private readonly queueService: QueueService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Get compliance status for the current tenant
   */
  @Query(() => Object, { name: 'complianceStatus' })
  @UseGuards(PermissionsGuard)
  @Permissions('compliance:read')
  async getComplianceStatus(
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    try {
      const status = await this.complianceService.getComplianceStatus(tenantId);

      return {
        tenantId,
        frameworks: status.frameworks || [],
        overallScore: status.overallScore || 0,
        lastUpdated: status.lastUpdated || new Date(),
      };
    } catch (error) {
      this.handleError(error, 'Failed to fetch compliance status');
      throw error;
    }
  }

  /**
   * Get available compliance frameworks
   */
  @Query(() => [ComplianceFramework], { name: 'complianceFrameworks' })
  @UseGuards(PermissionsGuard)
  @Permissions('compliance:read')
  async getComplianceFrameworks(
    @CurrentTenant() tenantId: string,
  ): Promise<ComplianceFramework[]> {
    try {
      const frameworks = await this.complianceService.getFrameworks();

      return frameworks.map(framework => ({
        id: framework.id,
        name: framework.name,
        description: framework.description,
        enabled: framework.enabled,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to fetch compliance frameworks');
      throw error;
    }
  }

  /**
   * Get compliance reports for a specific period
   */
  @Query(() => [ComplianceReport], { name: 'complianceReports' })
  @UseGuards(PermissionsGuard)
  @Permissions('compliance:read')
  async getComplianceReports(
    @Args('frameworkId', { type: () => ID, nullable: true }) frameworkId: string,
    @Args('startDate', { type: () => Date, nullable: true }) startDate: Date,
    @Args('endDate', { type: () => Date, nullable: true }) endDate: Date,
    @CurrentTenant() tenantId: string,
  ): Promise<ComplianceReport[]> {
    try {
      const reports = await this.complianceService.getReports(tenantId, {
        frameworkId,
        startDate: startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: endDate || new Date(),
      });

      return reports.map(report => ({
        frameworkId: report.frameworkId,
        tenantId: report.tenantId,
        generatedAt: report.generatedAt,
        overallStatus: report.overallStatus,
        complianceScore: report.complianceScore,
        requirements: report.requirements.map((req: ComplianceRequirement) => ({
          id: req.id,
          title: req.title,
          description: req.description,
          category: req.category,
          severity: req.severity,
          status: req.status,
          lastAssessed: req.lastAssessed,
          nextAssessment: req.nextAssessment,
          evidence: req.evidence,
          remediation: req.remediation,
        })),
        recommendations: report.recommendations,
        nextAuditDate: report.nextAuditDate,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to fetch compliance reports');
      throw error;
    }
  }

  /**
   * Run a compliance check
   * Enqueues the check to Bull queue for background processing
   * Returns a job ID for tracking
   */
  @Mutation(() => String, { name: 'runComplianceCheck' })
  @UseGuards(PermissionsGuard)
  @Permissions('compliance:check')
  async runComplianceCheck(
    @Args('input') input: RunComplianceCheckInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      // Enqueue compliance check to queue
      const job = await this.queueService.add('compliance-check', {
        tenantId,
        frameworkId: input.frameworkId,
        checkType: input.checkType || 'standard',
        fullAudit: input.fullAudit || false,
        requestedBy: user.id,
        requestedAt: new Date(),
      });

      return job.id.toString();
    } catch (error) {
      this.handleError(error, 'Failed to enqueue compliance check');
      throw error;
    }
  }

  /**
   * Get compliance violations
   */
  @Query(() => [ComplianceViolation], { name: 'complianceViolations' })
  @UseGuards(PermissionsGuard)
  @Permissions('compliance:read')
  async getComplianceViolations(
    @Args('frameworkId', { type: () => ID, nullable: true }) frameworkId: string,
    @Args('acknowledged', { type: () => Boolean, nullable: true }) acknowledged: boolean,
    @CurrentTenant() tenantId: string,
  ): Promise<ComplianceViolation[]> {
    try {
      const violations = await this.complianceService.getViolations(tenantId, {
        frameworkId,
        acknowledged,
      });

      return violations.map(violation => ({
        id: violation.id,
        type: violation.type,
        description: violation.description,
        severity: violation.severity,
        detectedAt: violation.detectedAt,
        acknowledgedAt: violation.acknowledgedAt,
        acknowledgedBy: violation.acknowledgedBy,
        resolution: violation.resolution,
        resolvedAt: violation.resolvedAt,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to fetch compliance violations');
      throw error;
    }
  }

  /**
   * Acknowledge a compliance violation
   */
  @Mutation(() => ComplianceViolation, { name: 'acknowledgeViolation' })
  @UseGuards(PermissionsGuard)
  @Permissions('compliance:acknowledge')
  async acknowledgeViolation(
    @Args('input') input: AcknowledgeViolationInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ComplianceViolation> {
    try {
      const violation = await this.complianceService.acknowledgeViolation(
        tenantId,
        input.violationId,
        {
          acknowledgedBy: user.id,
          acknowledgedAt: new Date(),
          resolution: input.resolution,
          notes: input.notes,
        },
      );

      return {
        id: violation.id,
        type: violation.type,
        description: violation.description,
        severity: violation.severity,
        detectedAt: violation.detectedAt,
        acknowledgedAt: new Date(),
        acknowledgedBy: user.id,
        ...(input.resolution ? { resolution: input.resolution } : {}),
        ...(violation.resolvedAt ? { resolvedAt: violation.resolvedAt } : {}),
      };
    } catch (error) {
      this.handleError(error, 'Failed to acknowledge violation');
      throw error;
    }
  }

  /**
   * Get compliance check job status
   */
  @Query(() => Object, { name: 'complianceCheckStatus' })
  @UseGuards(PermissionsGuard)
  @Permissions('compliance:read')
  async getComplianceCheckStatus(
    @Args('jobId', { type: () => ID }) jobId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    try {
      const job = await this.queueService.getJob('sync', jobId);

      if (!job) {
        throw new Error('Job not found');
      }

      return {
        jobId: job.id,
        status: await job.getState(),
        progress: job.progress(),
        result: job.returnvalue,
        failedReason: job.failedReason,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      };
    } catch (error) {
      this.handleError(error, 'Failed to fetch compliance check status');
      throw error;
    }
  }
}
