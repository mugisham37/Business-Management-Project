import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { AuditService } from '../services/audit.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { SecurityInterceptor } from '../interceptors/security.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

export interface AuditLogQuery {
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: string;
  resource?: string;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface AuditReportQuery {
  startDate: string;
  endDate: string;
  reportType?: 'summary' | 'detailed' | 'security' | 'compliance';
  format?: 'json' | 'csv' | 'pdf';
}

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('api/v1/audit')
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(SecurityInterceptor)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @RequirePermission('audit:read')
  @ApiOperation({ summary: 'Query audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'resource', required: false, type: String })
  @ApiQuery({ name: 'ipAddress', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async queryLogs(
    @Query() query: AuditLogQuery,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const filters: any = {
      tenantId,
    };
    
    if (query.startDate) filters.startDate = new Date(query.startDate);
    if (query.endDate) filters.endDate = new Date(query.endDate);
    if (query.userId) filters.userId = query.userId;
    if (query.action) filters.action = query.action;
    if (query.resource) filters.resource = query.resource;
    if (query.ipAddress) filters.ipAddress = query.ipAddress;

    const logs = await this.auditService.queryLogs(filters);

    // Apply pagination
    const limit = Math.min(query.limit || 100, 1000); // Max 1000 records
    const offset = query.offset || 0;
    const paginatedLogs = logs.slice(offset, offset + limit);

    return {
      logs: paginatedLogs,
      pagination: {
        total: logs.length,
        limit,
        offset,
        hasMore: offset + limit < logs.length,
      },
    };
  }

  @Get('reports')
  @RequirePermission('audit:report')
  @ApiOperation({ summary: 'Generate audit report' })
  @ApiResponse({ status: 200, description: 'Audit report generated successfully' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'reportType', required: false, enum: ['summary', 'detailed', 'security', 'compliance'] })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv', 'pdf'] })
  async generateReport(
    @Query() query: AuditReportQuery,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    const reportType = query.reportType || 'summary';
    const format = query.format || 'json';

    const report = await this.auditService.generateReport(
      tenantId,
      startDate,
      endDate,
      reportType,
    );

    if (format === 'json') {
      return report;
    } else {
      // For CSV/PDF formats, return download URL or file content
      return {
        reportId: report.id,
        downloadUrl: `/api/v1/audit/reports/${report.id}/download?format=${format}`,
        format,
        generatedAt: new Date(),
      };
    }
  }

  @Get('statistics')
  @RequirePermission('audit:read')
  @ApiOperation({ summary: 'Get audit statistics' })
  @ApiResponse({ status: 200, description: 'Audit statistics retrieved successfully' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.auditService.getStatistics(tenantId, start, end);
  }

  @Post('events')
  @RequirePermission('audit:write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log custom audit event' })
  @ApiResponse({ status: 201, description: 'Audit event logged successfully' })
  async logEvent(
    @Body() eventData: any,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean; eventId: string }> {
    const event = {
      ...eventData,
      tenantId,
      userId: user.id,
      timestamp: new Date(),
    };

    await this.auditService.logEvent(event);

    return {
      success: true,
      eventId: Math.random().toString(36).substr(2, 9),
    };
  }

  @Get('integrity/verify')
  @RequirePermission('audit:verify')
  @ApiOperation({ summary: 'Verify audit log integrity' })
  @ApiResponse({ status: 200, description: 'Audit log integrity verification completed' })
  async verifyIntegrity(
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const verification = await this.auditService.verifyIntegrity(tenantId);

    return {
      tenantId,
      verificationResult: verification,
      verifiedAt: new Date(),
    };
  }

  @Get('search')
  @RequirePermission('audit:read')
  @ApiOperation({ summary: 'Search audit logs with advanced filters' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @ApiQuery({ name: 'filters', required: false, type: String, description: 'JSON filters' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async searchLogs(
    @Query('q') query: string,
    @Query('filters') filters?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @CurrentTenant() tenantId?: string,
  ): Promise<any> {
    const searchFilters = filters ? JSON.parse(filters) : {};
    const searchOptions = {
      tenantId,
      query,
      filters: searchFilters,
      limit: Math.min(limit || 100, 1000),
      offset: offset || 0,
    };

    const results = await this.auditService.searchLogs(searchOptions);

    return {
      results: results.logs,
      pagination: {
        total: results.total,
        limit: searchOptions.limit,
        offset: searchOptions.offset,
        hasMore: searchOptions.offset + searchOptions.limit < results.total,
      },
      query,
      filters: searchFilters,
    };
  }

  @Get('export')
  @RequirePermission('audit:export')
  @ApiOperation({ summary: 'Export audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs export initiated' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json', 'xlsx'] })
  async exportLogs(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: string = 'csv',
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    const exportRequest = {
      tenantId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      format,
      requestedBy: user.id,
    };

    const exportId = await this.auditService.initiateExport(exportRequest);

    return {
      exportId,
      status: 'initiated',
      estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      downloadUrl: `/api/v1/audit/exports/${exportId}/download`,
    };
  }

  @Get('compliance/trail')
  @RequirePermission('audit:compliance')
  @ApiOperation({ summary: 'Get compliance audit trail' })
  @ApiResponse({ status: 200, description: 'Compliance audit trail retrieved' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'complianceFramework', required: false, type: String })
  async getComplianceTrail(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('complianceFramework') framework?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const trail = await this.auditService.getComplianceTrail(tenantId, start, end, framework);

    return {
      tenantId,
      framework,
      period: { startDate: start, endDate: end },
      trail,
      summary: {
        totalEvents: trail.length,
        complianceEvents: trail.filter(e => e.metadata?.compliance).length,
        securityEvents: trail.filter(e => e.metadata?.category === 'security').length,
      },
    };
  }
}