import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PayrollService } from '../services/payroll.service';
import {
  CreatePayrollPeriodDto,
  UpdatePayrollPeriodDto,
  CreateCommissionRecordDto,
  CalculatePayrollDto,
  ApprovePayrollDto,
  PayrollReportQueryDto,
  CommissionQueryDto,
} from '../dto/payroll.dto';
import {
  PayrollPeriod,
  PayrollRecord,
  CommissionRecord,
} from '../entities/payroll.entity';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/payroll')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('payroll-management')
@ApiBearerAuth()
@ApiTags('Payroll Management')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // Payroll Period Management
  @Post('periods')
  @RequirePermission('payroll:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create payroll period' })
  @ApiResponse({ status: 201, description: 'Payroll period created successfully', type: PayrollPeriod })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createPayrollPeriod(
    @Body() createPeriodDto: CreatePayrollPeriodDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PayrollPeriod> {
    return this.payrollService.createPayrollPeriod(tenantId, createPeriodDto, user.id);
  }

  @Get('periods')
  @RequirePermission('payroll:read')
  @ApiOperation({ summary: 'Get payroll periods with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Payroll periods retrieved successfully' })
  async findPayrollPeriods(
    @Query() query: PayrollReportQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ periods: PayrollPeriod[]; total: number }> {
    return this.payrollService.findPayrollPeriods(tenantId, query);
  }

  @Get('periods/:id')
  @RequirePermission('payroll:read')
  @ApiOperation({ summary: 'Get payroll period by ID' })
  @ApiParam({ name: 'id', description: 'Payroll period ID' })
  @ApiResponse({ status: 200, description: 'Payroll period retrieved successfully', type: PayrollPeriod })
  @ApiResponse({ status: 404, description: 'Payroll period not found' })
  async findPayrollPeriodById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<PayrollPeriod> {
    return this.payrollService.findPayrollPeriodById(tenantId, id);
  }

  @Put('periods/:id')
  @RequirePermission('payroll:update')
  @ApiOperation({ summary: 'Update payroll period' })
  @ApiParam({ name: 'id', description: 'Payroll period ID' })
  @ApiResponse({ status: 200, description: 'Payroll period updated successfully', type: PayrollPeriod })
  @ApiResponse({ status: 404, description: 'Payroll period not found' })
  async updatePayrollPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePeriodDto: UpdatePayrollPeriodDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PayrollPeriod> {
    return this.payrollService.updatePayrollPeriod(tenantId, id, updatePeriodDto, user.id);
  }

  // Payroll Calculation
  @Post('periods/:id/calculate')
  @RequirePermission('payroll:calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate payroll for period' })
  @ApiParam({ name: 'id', description: 'Payroll period ID' })
  @ApiResponse({ status: 200, description: 'Payroll calculated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async calculatePayroll(
    @Param('id', ParseUUIDPipe) periodId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PayrollRecord[]> {
    return this.payrollService.calculatePayroll(tenantId, periodId, user.id);
  }

  // Payroll Approval
  @Put('periods/:id/approve')
  @RequirePermission('payroll:approve')
  @ApiOperation({ summary: 'Approve payroll period' })
  @ApiParam({ name: 'id', description: 'Payroll period ID' })
  @ApiResponse({ status: 200, description: 'Payroll period approved successfully', type: PayrollPeriod })
  async approvePayrollPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approveDto: ApprovePayrollDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PayrollPeriod> {
    return this.payrollService.approvePayrollPeriod(tenantId, id, user.id);
  }

  @Put('records/:id/approve')
  @RequirePermission('payroll:approve')
  @ApiOperation({ summary: 'Approve payroll record' })
  @ApiParam({ name: 'id', description: 'Payroll record ID' })
  @ApiResponse({ status: 200, description: 'Payroll record approved successfully', type: PayrollRecord })
  async approvePayrollRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PayrollRecord> {
    return this.payrollService.approvePayrollRecord(tenantId, id, user.id);
  }

  // Payroll Reports
  @Get('periods/:id/summary')
  @RequirePermission('payroll:read')
  @ApiOperation({ summary: 'Get payroll summary for period' })
  @ApiParam({ name: 'id', description: 'Payroll period ID' })
  @ApiResponse({ status: 200, description: 'Payroll summary retrieved successfully' })
  async getPayrollSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.payrollService.getPayrollSummary(tenantId, id);
  }

  // Commission Management
  @Post('commissions')
  @RequirePermission('payroll:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create commission record' })
  @ApiResponse({ status: 201, description: 'Commission record created successfully', type: CommissionRecord })
  async createCommissionRecord(
    @Body() createCommissionDto: CreateCommissionRecordDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommissionRecord> {
    return this.payrollService.createCommissionRecord(tenantId, createCommissionDto, user.id);
  }

  @Get('commissions')
  @RequirePermission('payroll:read')
  @ApiOperation({ summary: 'Get commission records with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Commission records retrieved successfully' })
  async findCommissionRecords(
    @Query() query: CommissionQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ commissions: CommissionRecord[]; total: number }> {
    return this.payrollService.findCommissionRecords(tenantId, query);
  }
}

@Controller('api/v1/payroll-reports')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('payroll-reporting')
@ApiBearerAuth()
@ApiTags('Payroll Reports')
export class PayrollReportsController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('summary')
  @RequirePermission('payroll:read')
  @ApiOperation({ summary: 'Get payroll summary report' })
  @ApiQuery({ name: 'periodId', description: 'Payroll period ID' })
  @ApiResponse({ status: 200, description: 'Payroll summary report retrieved successfully' })
  async getPayrollSummaryReport(
    @Query('periodId', ParseUUIDPipe) periodId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.payrollService.getPayrollSummary(tenantId, periodId);
  }

  @Get('employee/:employeeId')
  @RequirePermission('payroll:read')
  @ApiOperation({ summary: 'Get employee payroll history' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date filter' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date filter' })
  @ApiResponse({ status: 200, description: 'Employee payroll history retrieved successfully' })
  async getEmployeePayrollHistory(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<any> {
    // This would be implemented to get employee-specific payroll history
    // For now, return a placeholder
    return {
      employeeId,
      startDate,
      endDate,
      records: [],
      totals: {
        totalGrossPay: 0,
        totalNetPay: 0,
        totalTaxes: 0,
        totalDeductions: 0,
      },
    };
  }

  @Get('tax-summary')
  @RequirePermission('payroll:read')
  @ApiOperation({ summary: 'Get tax summary report' })
  @ApiQuery({ name: 'year', description: 'Tax year' })
  @ApiResponse({ status: 200, description: 'Tax summary report retrieved successfully' })
  async getTaxSummaryReport(
    @Query('year') year: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    // This would be implemented to get tax summary for the year
    // For now, return a placeholder
    return {
      year,
      tenantId,
      summary: {
        totalGrossPay: 0,
        totalFederalTax: 0,
        totalStateTax: 0,
        totalSocialSecurityTax: 0,
        totalMedicareTax: 0,
      },
      quarterlyBreakdown: [],
    };
  }
}