import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { GraphQLTenantGuard } from '../../tenant/guards/graphql-tenant.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { FinancialReportingService, FinancialReport } from '../services/financial-reporting.service';

@Resolver()
@UseGuards(GraphQLJwtAuthGuard, GraphQLTenantGuard)
export class FinancialReportingResolver {
  constructor(
    private readonly financialReportingService: FinancialReportingService,
  ) {}

  @Query(() => String, { description: 'Generate balance sheet report' })
  @RequirePermission('financial:reports:read')
  async generateBalanceSheet(
    @Args('asOfDate', { nullable: true }) asOfDate: Date,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FinancialReport> {
    const reportDate = asOfDate || new Date();
    
    return this.financialReportingService.generateBalanceSheet(
      tenantId,
      reportDate,
      user.id,
    );
  }

  @Query(() => String, { description: 'Generate income statement (P&L) report' })
  @RequirePermission('financial:reports:read')
  async generateIncomeStatement(
    @Args('periodStart') periodStart: Date,
    @Args('periodEnd') periodEnd: Date,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FinancialReport> {
    if (periodStart >= periodEnd) {
      throw new Error('Period start must be before period end');
    }

    return this.financialReportingService.generateIncomeStatement(
      tenantId,
      periodStart,
      periodEnd,
      user.id,
    );
  }

  @Query(() => String, { description: 'Generate cash flow statement' })
  @RequirePermission('financial:reports:read')
  async generateCashFlowStatement(
    @Args('periodStart') periodStart: Date,
    @Args('periodEnd') periodEnd: Date,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FinancialReport> {
    if (periodStart >= periodEnd) {
      throw new Error('Period start must be before period end');
    }

    return this.financialReportingService.generateCashFlowStatement(
      tenantId,
      periodStart,
      periodEnd,
      user.id,
    );
  }

  @Query(() => String, { description: 'Generate trial balance report' })
  @RequirePermission('financial:reports:read')
  async generateTrialBalance(
    @Args('asOfDate', { nullable: true }) asOfDate: Date,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FinancialReport> {
    const reportDate = asOfDate || new Date();
    
    return this.financialReportingService.generateTrialBalance(
      tenantId,
      reportDate,
      user.id,
    );
  }

  @Query(() => String, { description: 'Generate general ledger report for specific account' })
  @RequirePermission('financial:reports:read')
  async generateGeneralLedger(
    @Args('accountId') accountId: string,
    @Args('periodStart') periodStart: Date,
    @Args('periodEnd') periodEnd: Date,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FinancialReport> {
    if (periodStart >= periodEnd) {
      throw new Error('Period start must be before period end');
    }

    return this.financialReportingService.generateGeneralLedger(
      tenantId,
      accountId,
      periodStart,
      periodEnd,
      user.id,
    );
  }

  @Query(() => String, { description: 'Generate financial ratios analysis' })
  @RequirePermission('financial:reports:read')
  async generateFinancialRatios(
    @Args('asOfDate', { nullable: true }) asOfDate: Date,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FinancialReport> {
    const reportDate = asOfDate || new Date();
    
    return this.financialReportingService.generateFinancialRatios(
      tenantId,
      reportDate,
      user.id,
    );
  }
}