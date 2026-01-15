import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { ComplianceService } from '../services/compliance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { SecurityInterceptor } from '../interceptors/security.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

export interface GdprExportRequest {
  userId: string;
  includeAuditLogs?: boolean;
  includeTransactions?: boolean;
  format?: 'json' | 'xml' | 'csv';
}

export interface GdprDeletionRequest {
  userId: string;
  reason: string;
  confirmDeletion: boolean;
}

export interface ComplianceAssessmentRequest {
  frameworkId: string;
  assessmentType?: 'full' | 'partial' | 'automated';
  includeEvidence?: boolean;
}

@ApiTags('Compliance')
@ApiBearerAuth()
@Controller('api/v1/compliance')
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(SecurityInterceptor)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('status')
  @RequirePermission('compliance:read')
  @ApiOperation({ summary: 'Get overall compliance status' })
  @ApiResponse({ status: 200, description: 'Compliance status retrieved successfully' })
  async getComplianceStatus(
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.complianceService.getComplianceStatus(tenantId);
  }

  @Get('frameworks')
  @RequirePermission('compliance:read')
  @ApiOperation({ summary: 'Get available compliance frameworks' })
  @ApiResponse({ status: 200, description: 'Compliance frameworks retrieved successfully' })
  async getFrameworks(): Promise<any> {
    // This would return available frameworks
    return {
      frameworks: [
        {
          id: 'soc2',
          name: 'SOC 2 Type II',
          description: 'Service Organization Control 2 Type II compliance',
          categories: ['Security', 'Availability', 'Processing Integrity', 'Confidentiality', 'Privacy'],
        },
        {
          id: 'gdpr',
          name: 'GDPR',
          description: 'General Data Protection Regulation compliance',
          categories: ['Data Protection', 'Privacy Rights', 'Consent Management'],
        },
        {
          id: 'pci_dss',
          name: 'PCI DSS',
          description: 'Payment Card Industry Data Security Standard',
          categories: ['Payment Security', 'Network Security', 'Access Control'],
        },
        {
          id: 'hipaa',
          name: 'HIPAA',
          description: 'Health Insurance Portability and Accountability Act',
          categories: ['Healthcare Data Protection', 'Privacy', 'Security'],
        },
      ],
    };
  }

  @Post('assessments')
  @RequirePermission('compliance:assess')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate compliance assessment' })
  @ApiResponse({ status: 201, description: 'Compliance assessment initiated successfully' })
  async initiateAssessment(
    @Body() request: ComplianceAssessmentRequest,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    const report = await this.complianceService.generateComplianceReport(
      tenantId,
      request.frameworkId,
    );

    return {
      assessmentId: `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      frameworkId: request.frameworkId,
      status: 'completed',
      report,
      initiatedBy: user.id,
      completedAt: new Date(),
    };
  }

  @Get('reports/:frameworkId')
  @RequirePermission('compliance:read')
  @ApiOperation({ summary: 'Get compliance report for specific framework' })
  @ApiResponse({ status: 200, description: 'Compliance report retrieved successfully' })
  async getComplianceReport(
    @Param('frameworkId') frameworkId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.complianceService.generateComplianceReport(tenantId, frameworkId);
  }

  @Post('gdpr/export')
  @RequirePermission('compliance:gdpr')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Generate GDPR data export' })
  @ApiResponse({ status: 202, description: 'GDPR data export initiated' })
  async initiateGdprExport(
    @Body() request: GdprExportRequest,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    const exportData = await this.complianceService.generateGdprDataExport(
      tenantId,
      request.userId,
    );

    return {
      exportId: `gdpr_export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      data: exportData,
      requestedBy: user.id,
      subjectUserId: request.userId,
      format: request.format || 'json',
      generatedAt: new Date(),
    };
  }

  @Post('gdpr/deletion')
  @RequirePermission('compliance:gdpr')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Process GDPR data deletion request' })
  @ApiResponse({ status: 202, description: 'GDPR data deletion initiated' })
  async processGdprDeletion(
    @Body() request: GdprDeletionRequest,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    if (!request.confirmDeletion) {
      return {
        error: 'Deletion confirmation required',
        message: 'Please confirm deletion by setting confirmDeletion to true',
      };
    }

    await this.complianceService.processGdprDeletionRequest(tenantId, request.userId);

    return {
      deletionId: `gdpr_deletion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      subjectUserId: request.userId,
      reason: request.reason,
      processedBy: user.id,
      processedAt: new Date(),
    };
  }

  @Get('data-retention/policies')
  @RequirePermission('compliance:read')
  @ApiOperation({ summary: 'Get data retention policies' })
  @ApiResponse({ status: 200, description: 'Data retention policies retrieved successfully' })
  async getRetentionPolicies(): Promise<any> {
    return {
      policies: [
        {
          id: 'audit_logs',
          name: 'Audit Log Retention',
          description: 'Retain audit logs for compliance requirements',
          retentionPeriod: '7 years',
          dataTypes: ['audit_log'],
          enabled: true,
        },
        {
          id: 'user_data',
          name: 'User Data Retention',
          description: 'Retain user data as per privacy policy',
          retentionPeriod: '3 years',
          dataTypes: ['user_profile', 'user_preferences'],
          enabled: true,
        },
        {
          id: 'transaction_data',
          name: 'Transaction Data Retention',
          description: 'Retain transaction data for financial compliance',
          retentionPeriod: '7 years',
          dataTypes: ['transaction', 'payment'],
          enabled: true,
        },
      ],
    };
  }

  @Post('data-retention/apply')
  @RequirePermission('compliance:manage')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Apply data retention policies' })
  @ApiResponse({ status: 202, description: 'Data retention policy application initiated' })
  async applyRetentionPolicies(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    // Trigger manual retention policy application
    await this.complianceService.applyDataRetentionPolicies();

    return {
      jobId: `retention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'initiated',
      initiatedBy: user.id,
      estimatedCompletion: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };
  }

  @Get('audit-trail')
  @RequirePermission('compliance:audit')
  @ApiOperation({ summary: 'Get compliance audit trail' })
  @ApiResponse({ status: 200, description: 'Compliance audit trail retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'framework', required: false, type: String })
  async getAuditTrail(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('framework') framework?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Mock audit trail for now
    return {
      tenantId,
      framework,
      period: { startDate: start, endDate: end },
      events: [
        {
          id: 'audit_1',
          timestamp: new Date(),
          type: 'compliance_check',
          framework: 'soc2',
          result: 'passed',
          details: 'Automated security control verification',
        },
        {
          id: 'audit_2',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          type: 'data_retention',
          framework: 'gdpr',
          result: 'completed',
          details: 'Applied data retention policies',
        },
      ],
      summary: {
        totalEvents: 2,
        passedChecks: 2,
        failedChecks: 0,
        complianceScore: 100,
      },
    };
  }

  @Get('certifications')
  @RequirePermission('compliance:read')
  @ApiOperation({ summary: 'Get compliance certifications' })
  @ApiResponse({ status: 200, description: 'Compliance certifications retrieved successfully' })
  async getCertifications(
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return {
      tenantId,
      certifications: [
        {
          framework: 'soc2',
          status: 'certified',
          issuedDate: new Date('2024-01-01'),
          expiryDate: new Date('2025-01-01'),
          certifyingBody: 'Independent Auditor',
          certificateUrl: '/certificates/soc2-2024.pdf',
        },
        {
          framework: 'gdpr',
          status: 'compliant',
          assessedDate: new Date('2024-06-01'),
          nextAssessment: new Date('2025-06-01'),
          assessor: 'Internal Compliance Team',
        },
      ],
      lastUpdated: new Date(),
    };
  }

  @Post('remediation/:requirementId')
  @RequirePermission('compliance:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate remediation for compliance requirement' })
  @ApiResponse({ status: 200, description: 'Remediation initiated successfully' })
  async initiateRemediation(
    @Param('requirementId') requirementId: string,
    @Body() body: { remediationPlan: string; priority: 'low' | 'medium' | 'high' | 'critical' },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    return {
      remediationId: `remediation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requirementId,
      plan: body.remediationPlan,
      priority: body.priority,
      status: 'initiated',
      assignedTo: user.id,
      estimatedCompletion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
    };
  }

  @Get('dashboard')
  @RequirePermission('compliance:read')
  @ApiOperation({ summary: 'Get compliance dashboard data' })
  @ApiResponse({ status: 200, description: 'Compliance dashboard data retrieved successfully' })
  async getComplianceDashboard(
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const status = await this.complianceService.getComplianceStatus(tenantId);

    return {
      ...status,
      dashboard: {
        overallScore: status.overallScore,
        frameworkCount: status.frameworks.length,
        criticalIssues: status.frameworks.reduce((count: number, f: any) => 
          count + f.requirements.filter((r: any) => r.status === 'non_compliant' && r.severity === 'critical').length, 0
        ),
        upcomingAudits: [
          {
            framework: 'soc2',
            scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            type: 'annual_review',
          },
        ],
        recentActivity: [
          {
            type: 'assessment_completed',
            framework: 'gdpr',
            timestamp: new Date(),
            result: 'compliant',
          },
        ],
      },
    };
  }
}