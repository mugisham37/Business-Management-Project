import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AccountingService } from '../services/accounting.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
export class AccountingResolver {
  constructor(private readonly accountingService: AccountingService) {}

  @Mutation(() => String)
  @RequirePermission('financial:manage')
  async initializeAccounting(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<string> {
    const result = await this.accountingService.initializeTenantAccounting(tenantId, user.id);
    return result.message;
  }

  @Query(() => String)
  @RequirePermission('financial:read')
  async trialBalance(
    @CurrentTenant() tenantId: string,
    @Args('asOfDate', { nullable: true }) asOfDate?: Date,
  ): Promise<any> {
    return await this.accountingService.getTrialBalance(tenantId, asOfDate);
  }

  @Query(() => String)
  @RequirePermission('financial:read')
  async financialSummary(
    @CurrentTenant() tenantId: string,
    @Args('dateFrom', { nullable: true }) dateFrom?: Date,
    @Args('dateTo', { nullable: true }) dateTo?: Date,
  ): Promise<any> {
    return await this.accountingService.getFinancialSummary(tenantId, dateFrom, dateTo);
  }

  @Query(() => String)
  @RequirePermission('financial:read')
  async validateAccountingIntegrity(
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return await this.accountingService.validateAccountingIntegrity(tenantId);
  }
}