import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ParseDatePipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { FinancialReportingService, FinancialReport } from '../services/financial-reporting.service';

@ApiTags('Financial Reporting')
@Controller('api/v1/financial/reports')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FinancialReportingController {
  constructor(
    private readonly financialReportingService: FinancialReportingService,
  ) {}

  @Get('balance-sheet')
  @RequirePermission('financial:reports:read')
  @ApiOperation({ summary: 'Generate balance sheet report' })
  @ApiQuery({ name: 'asOfDate', required: false, description: 'As of date (defaults to today)' })
  @ApiResponse({ status: 200, description: 'Balance sheet generated successfully' })
  async generateBalanceSheet(
    @Request() req: any,
    @Query('asOfDate') asOfDate?: string,
  ): Promise<FinancialReport> {
    const reportDate = asOfDate ? new Date(asOfDate) : new Date();
    
    if (isNaN(reportDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.financialReportingService.generateBalanceSheet(
      req.tenant.id,
      reportDate,
      req.user.id,
    );
  }

  @Get('income-statement')
  @RequirePermission('financial:reports:read')
  @ApiOperation({ summary: 'Generate income statement (P&L) report' })
  @ApiQuery({ name: 'periodStart', required: true, description: 'Period start date' })
  @ApiQuery({ name: 'periodEnd', required: true, description: 'Period end date' })
  @ApiResponse({ status: 200, description: 'Income statement generated successfully' })
  async generateIncomeStatement(
    @Request() req: any,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ): Promise<FinancialReport> {
    if (!periodStart || !periodEnd) {
      throw new BadRequestException('Both periodStart and periodEnd are required');
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    if (startDate >= endDate) {
      throw new BadRequestException('Period start must be before period end');
    }

    return this.financialReportingService.generateIncomeStatement(
      req.tenant.id,
      startDate,
      endDate,
      req.user.id,
    );
  }

  @Get('cash-flow')
  @RequirePermission('financial:reports:read')
  @ApiOperation({ summary: 'Generate cash flow statement' })
  @ApiQuery({ name: 'periodStart', required: true, description: 'Period start date' })
  @ApiQuery({ name: 'periodEnd', required: true, description: 'Period end date' })
  @ApiResponse({ status: 200, description: 'Cash flow statement generated successfully' })
  async generateCashFlowStatement(
    @Request() req: any,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ): Promise<FinancialReport> {
    if (!periodStart || !periodEnd) {
      throw new BadRequestException('Both periodStart and periodEnd are required');
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    if (startDate >= endDate) {
      throw new BadRequestException('Period start must be before period end');
    }

    return this.financialReportingService.generateCashFlowStatement(
      req.tenant.id,
      startDate,
      endDate,
      req.user.id,
    );
  }

  @Get('trial-balance')
  @RequirePermission('financial:reports:read')
  @ApiOperation({ summary: 'Generate trial balance report' })
  @ApiQuery({ name: 'asOfDate', required: false, description: 'As of date (defaults to today)' })
  @ApiResponse({ status: 200, description: 'Trial balance generated successfully' })
  async generateTrialBalance(
    @Request() req: any,
    @Query('asOfDate') asOfDate?: string,
  ): Promise<FinancialReport> {
    const reportDate = asOfDate ? new Date(asOfDate) : new Date();
    
    if (isNaN(reportDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.financialReportingService.generateTrialBalance(
      req.tenant.id,
      reportDate,
      req.user.id,
    );
  }

  @Get('general-ledger')
  @RequirePermission('financial:reports:read')
  @ApiOperation({ summary: 'Generate general ledger report for specific account' })
  @ApiQuery({ name: 'accountId', required: true, description: 'Account ID' })
  @ApiQuery({ name: 'periodStart', required: true, description: 'Period start date' })
  @ApiQuery({ name: 'periodEnd', required: true, description: 'Period end date' })
  @ApiResponse({ status: 200, description: 'General ledger generated successfully' })
  async generateGeneralLedger(
    @Request() req: any,
    @Query('accountId') accountId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ): Promise<FinancialReport> {
    if (!accountId || !periodStart || !periodEnd) {
      throw new BadRequestException('accountId, periodStart, and periodEnd are required');
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    if (startDate >= endDate) {
      throw new BadRequestException('Period start must be before period end');
    }

    return this.financialReportingService.generateGeneralLedger(
      req.tenant.id,
      accountId,
      startDate,
      endDate,
      req.user.id,
    );
  }

  @Get('financial-ratios')
  @RequirePermission('financial:reports:read')
  @ApiOperation({ summary: 'Generate financial ratios analysis' })
  @ApiQuery({ name: 'asOfDate', required: false, description: 'As of date (defaults to today)' })
  @ApiResponse({ status: 200, description: 'Financial ratios generated successfully' })
  async generateFinancialRatios(
    @Request() req: any,
    @Query('asOfDate') asOfDate?: string,
  ): Promise<FinancialReport> {
    const reportDate = asOfDate ? new Date(asOfDate) : new Date();
    
    if (isNaN(reportDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.financialReportingService.generateFinancialRatios(
      req.tenant.id,
      reportDate,
      req.user.id,
    );
  }
}