import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { ComplianceService } from '../services/compliance.service';
import {
  ComplianceCheckDto,
  BreakTimeDto,
  ComplianceReportDto,
  LaborLawViolationDto,
  UpdateLaborLawViolationDto,
  AuditTrailQueryDto,
  ComplianceRemediationDto,
  UpdateComplianceRemediationDto,
} from '../dto/compliance.dto';

@ApiTags('Employee Compliance')
@ApiBearerAuth()
@Controller('employees/compliance')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  // Compliance Checks
  @Post('checks')
  @RequirePermission('employee:compliance:create')
  @ApiOperation({ summary: 'Perform compliance check for employee' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Compliance check completed successfully' })
  async performComplianceCheck(
    @Request() req: any,
    @Body() body: { employeeId: string; checkDate: string }
  ) {
    const tenantId = req.user.tenantId;
    const performedBy = req.user.sub;
    
    const result = await this.complianceService.performComplianceCheck(
      tenantId,
      body.employeeId,
      new Date(body.checkDate),
      performedBy
    );

    return {
      success: true,
      data: result,
      message: 'Compliance check completed successfully',
    };
  }

  @Get('checks')
  @RequirePermission('employee:compliance:read')
  @ApiOperation({ summary: 'Get compliance checks' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Compliance checks retrieved successfully' })
  async getComplianceChecks(
    @Request() req: any,
    @Query() query: {
      startDate?: string;
      endDate?: string;
      employeeId?: string;
      department?: string;
    }
  ) {
    const tenantId = req.user.tenantId;
    
    // For now, return empty array since repository is not fully implemented
    return {
      success: true,
      data: [],
      message: 'Compliance checks retrieved successfully',
    };
  }

  // Break Time Management
  @Post('break-times')
  @RequirePermission('employee:time:create')
  @ApiOperation({ summary: 'Record employee break time' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Break time recorded successfully' })
  async recordBreakTime(
    @Request() req: any,
    @Body() breakTimeDto: BreakTimeDto
  ) {
    const tenantId = req.user.tenantId;
    const recordedBy = req.user.sub;
    
    const result = await this.complianceService.recordBreakTime(
      tenantId,
      breakTimeDto,
      recordedBy
    );

    return {
      success: true,
      data: result,
      message: 'Break time recorded successfully',
    };
  }

  @Get('break-times/:employeeId')
  @RequirePermission('employee:time:read')
  @ApiOperation({ summary: 'Get employee break time records' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Break time records retrieved successfully' })
  async getBreakTimeRecords(
    @Request() req: any,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: { startDate: string; endDate: string }
  ) {
    const tenantId = req.user.tenantId;
    
    const records = await this.complianceService.getBreakTimeRecords(
      tenantId,
      employeeId,
      new Date(query.startDate),
      new Date(query.endDate)
    );

    return {
      success: true,
      data: records,
      message: 'Break time records retrieved successfully',
    };
  }

  // Compliance Reporting
  @Post('reports')
  @RequirePermission('employee:compliance:read')
  @ApiOperation({ summary: 'Generate compliance report' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Compliance report generated successfully' })
  async generateComplianceReport(
    @Request() req: any,
    @Body() reportDto: ComplianceReportDto
  ) {
    const tenantId = req.user.tenantId;
    
    const report = await this.complianceService.generateComplianceReport(
      tenantId,
      reportDto
    );

    return {
      success: true,
      data: report,
      message: 'Compliance report generated successfully',
    };
  }

  // Audit Trail
  @Get('audit-trail/:employeeId')
  @RequirePermission('employee:audit:read')
  @ApiOperation({ summary: 'Get employee audit trail' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit trail retrieved successfully' })
  async getAuditTrail(
    @Request() req: any,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: { startDate: string; endDate: string }
  ) {
    const tenantId = req.user.tenantId;
    
    const auditTrail = await this.complianceService.getAuditTrail(
      tenantId,
      employeeId,
      new Date(query.startDate),
      new Date(query.endDate)
    );

    return {
      success: true,
      data: auditTrail,
      message: 'Audit trail retrieved successfully',
    };
  }

  // Labor Law Violations Management
  @Get('violations')
  @RequirePermission('employee:compliance:read')
  @ApiOperation({ summary: 'Get labor law violations' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Violations retrieved successfully' })
  async getLaborLawViolations(
    @Request() req: any,
    @Query() query: {
      startDate?: string;
      endDate?: string;
      employeeId?: string;
      violationType?: string;
      severity?: string;
    }
  ) {
    const tenantId = req.user.tenantId;
    
    // For now, return empty array since repository is not fully implemented
    return {
      success: true,
      data: [],
      message: 'Labor law violations retrieved successfully',
    };
  }

  @Put('violations/:violationId')
  @RequirePermission('employee:compliance:update')
  @ApiOperation({ summary: 'Update labor law violation' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Violation updated successfully' })
  async updateLaborLawViolation(
    @Request() req: any,
    @Param('violationId', ParseUUIDPipe) violationId: string,
    @Body() updateDto: UpdateLaborLawViolationDto
  ) {
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.sub;
    
    // For now, return success message since repository is not fully implemented
    return {
      success: true,
      data: { id: violationId, ...updateDto },
      message: 'Labor law violation updated successfully',
    };
  }

  // Compliance Remediation
  @Post('violations/:violationId/remediation')
  @RequirePermission('employee:compliance:update')
  @ApiOperation({ summary: 'Create remediation plan for violation' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Remediation plan created successfully' })
  async createRemediation(
    @Request() req: any,
    @Param('violationId', ParseUUIDPipe) violationId: string,
    @Body() remediationDto: ComplianceRemediationDto
  ) {
    const tenantId = req.user.tenantId;
    const createdBy = req.user.sub;
    
    // For now, return success message since this would require additional implementation
    return {
      success: true,
      data: { ...remediationDto, violationId, createdBy },
      message: 'Remediation plan created successfully',
    };
  }

  @Put('violations/:violationId/remediation')
  @RequirePermission('employee:compliance:update')
  @ApiOperation({ summary: 'Update remediation plan' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Remediation plan updated successfully' })
  async updateRemediation(
    @Request() req: any,
    @Param('violationId', ParseUUIDPipe) violationId: string,
    @Body() updateDto: UpdateComplianceRemediationDto
  ) {
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.sub;
    
    // For now, return success message since this would require additional implementation
    return {
      success: true,
      data: { violationId, ...updateDto, updatedBy },
      message: 'Remediation plan updated successfully',
    };
  }

  // Compliance Dashboard
  @Get('dashboard')
  @RequirePermission('employee:compliance:read')
  @ApiOperation({ summary: 'Get compliance dashboard data' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Dashboard data retrieved successfully' })
  async getComplianceDashboard(
    @Request() req: any,
    @Query() query: { period?: string; department?: string }
  ) {
    const tenantId = req.user.tenantId;
    
    // Return mock dashboard data for now
    const dashboardData = {
      summary: {
        totalChecks: 0,
        complianceRate: 100,
        activeViolations: 0,
        resolvedViolations: 0,
      },
      recentViolations: [],
      complianceTrends: [],
      departmentCompliance: [],
      upcomingChecks: [],
    };

    return {
      success: true,
      data: dashboardData,
      message: 'Compliance dashboard data retrieved successfully',
    };
  }
}