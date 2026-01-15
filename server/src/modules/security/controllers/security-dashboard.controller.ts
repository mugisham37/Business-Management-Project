import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { SecurityMonitoringService } from '../services/security-monitoring.service';
import { ThreatDetectionService } from '../services/threat-detection.service';
import { AuditService } from '../services/audit.service';
import { ComplianceService } from '../services/compliance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

@Controller('api/v1/security/dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Security Dashboard')
export class SecurityDashboardController {
  constructor(
    private readonly securityMonitoringService: SecurityMonitoringService,
    private readonly threatDetectionService: ThreatDetectionService,
    private readonly auditService: AuditService,
    private readonly complianceService: ComplianceService,
  ) {}

  @Get('overview')
  @RequirePermission('security:read')
  @ApiOperation({ summary: 'Get security dashboard overview' })
  @ApiResponse({ status: 200, description: 'Security dashboard data' })
  async getSecurityOverview(@CurrentTenant() tenantId: string) {
    const [
      dashboard,
      complianceStatus,
      threatPatterns,
    ] = await Promise.all([
      this.securityMonitoringService.getSecurityDashboard(tenantId),
      this.complianceService.getComplianceStatus(tenantId),
      this.threatDetectionService.getThreatPatterns(),
    ]);

    return {
      dashboard,
      compliance: complianceStatus,
      threatPatterns: threatPatterns.filter(p => p.enabled),
      lastUpdated: new Date(),
    };
  }

  @Get('metrics')
  @RequirePermission('security:read')
  @ApiOperation({ summary: 'Get security metrics' })
  @ApiResponse({ status: 200, description: 'Security metrics data' })
  async getSecurityMetrics(@CurrentTenant() tenantId: string) {
    return this.securityMonitoringService.getSecurityMetrics(tenantId);
  }

  @Get('threats')
  @RequirePermission('security:read')
  @ApiOperation({ summary: 'Get active security threats' })
  @ApiResponse({ status: 200, description: 'Active security threats' })
  async getActiveThreats(@CurrentTenant() tenantId: string) {
    return this.securityMonitoringService.getActiveThreats(tenantId);
  }

  @Get('compliance/:framework')
  @RequirePermission('security:read')
  @ApiOperation({ summary: 'Get compliance report for framework' })
  @ApiResponse({ status: 200, description: 'Compliance report' })
  async getComplianceReport(
    @CurrentTenant() tenantId: string,
    @Param('framework') framework: string,
  ) {
    return this.complianceService.generateComplianceReport(tenantId, framework);
  }

  @Post('alerts/:alertId/acknowledge')
  @RequirePermission('security:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge security alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged' })
  async acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Body('userId') userId: string,
  ) {
    await this.securityMonitoringService.acknowledgeAlert(alertId, userId);
    return { message: 'Alert acknowledged successfully' };
  }

  @Post('threats/:threatId/resolve')
  @RequirePermission('security:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve security threat' })
  @ApiResponse({ status: 200, description: 'Threat resolved' })
  async resolveThreat(
    @Param('threatId') threatId: string,
    @Body() body: { resolution: string; userId: string },
  ) {
    await this.securityMonitoringService.resolveThreat(
      threatId,
      body.resolution,
      body.userId,
    );
    return { message: 'Threat resolved successfully' };
  }

  @Get('audit/export')
  @RequirePermission('security:export')
  @ApiOperation({ summary: 'Export audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs exported' })
  async exportAuditLogs(
    @CurrentTenant() tenantId: string,
    @Body() query: {
      startDate: string;
      endDate: string;
      format?: 'json' | 'csv';
    },
  ) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    const format = query.format || 'json';

    const exportData = await this.auditService.exportLogs(
      tenantId,
      startDate,
      endDate,
      format,
    );

    return {
      data: exportData,
      format,
      exportedAt: new Date(),
      recordCount: exportData.split('\n').length - 1, // Approximate for CSV
    };
  }

  @Post('behavioral-analysis/:userId')
  @RequirePermission('security:analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform behavioral analysis on user' })
  @ApiResponse({ status: 200, description: 'Behavioral analysis results' })
  async performBehavioralAnalysis(
    @CurrentTenant() tenantId: string,
    @Param('userId') userId: string,
  ) {
    const analyses = await this.threatDetectionService.performBehavioralAnalysis(
      userId,
      tenantId,
    );

    const isCompromised = await this.threatDetectionService.isAccountCompromised(
      tenantId,
      userId,
    );

    return {
      userId,
      tenantId,
      analyses,
      isCompromised,
      analyzedAt: new Date(),
    };
  }

  @Get('penetration-test/status')
  @RequirePermission('security:penetration_test')
  @ApiOperation({ summary: 'Get penetration test status' })
  @ApiResponse({ status: 200, description: 'Penetration test status' })
  async getPenetrationTestStatus(@CurrentTenant() tenantId: string) {
    // This would integrate with the penetration testing service
    return {
      tenantId,
      lastTest: new Date('2024-01-01'),
      nextScheduled: new Date('2024-07-01'),
      status: 'scheduled',
      findings: [],
    };
  }
}