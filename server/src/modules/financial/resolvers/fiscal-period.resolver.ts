import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FiscalPeriodService } from '../services/fiscal-period.service';
import { 
  CreateFiscalPeriodInput,
  UpdateFiscalPeriodInput,
  CloseFiscalPeriodInput,
  CreateStandardFiscalYearInput,
  ProcessYearEndInput
} from '../graphql/inputs';
import { 
  FiscalPeriod, 
  FiscalYear, 
  YearEndSummary 
} from '../graphql/types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver(() => FiscalPeriod)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
export class FiscalPeriodResolver {
  constructor(private readonly fiscalPeriodService: FiscalPeriodService) {}

  @Mutation(() => FiscalPeriod, { nullable: true })
  @RequirePermission('financial:manage')
  async createFiscalPeriod(
    @Args('input') input: CreateFiscalPeriodInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FiscalPeriod | null> {
    // Transform input to match service interface
    const fiscalPeriodData = {
      fiscalYear: input.fiscalYear,
      periodNumber: input.periodNumber,
      periodName: input.periodName,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      isYearEnd: input.isYearEnd,
    };
    
    const result = await this.fiscalPeriodService.createFiscalPeriod(tenantId, fiscalPeriodData, user.id);
    return result ? this.transformToGraphQLType(result) : null;
  }

  @Query(() => FiscalPeriod, { nullable: true })
  @RequirePermission('financial:read')
  async fiscalPeriod(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<FiscalPeriod | null> {
    const result = await this.fiscalPeriodService.findFiscalPeriodById(tenantId, id);
    return result ? this.transformToGraphQLType(result) : null;
  }

  @Query(() => [FiscalPeriod])
  @RequirePermission('financial:read')
  async fiscalPeriods(
    @CurrentTenant() tenantId: string,
    @Args('fiscalYear', { nullable: true }) fiscalYear?: number,
    @Args('status', { nullable: true }) status?: string,
  ): Promise<FiscalPeriod[]> {
    if (fiscalYear) {
      return await this.fiscalPeriodService.findFiscalPeriodsByYear(tenantId, fiscalYear);
    }
    return await this.fiscalPeriodService.findAllFiscalPeriods(tenantId, { status });
  }

  @Query(() => FiscalPeriod, { nullable: true })
  @RequirePermission('financial:read')
  async currentFiscalPeriod(
    @CurrentTenant() tenantId: string,
  ): Promise<FiscalPeriod | null> {
    return await this.fiscalPeriodService.findCurrentFiscalPeriod(tenantId);
  }

  @Query(() => [FiscalPeriod])
  @RequirePermission('financial:read')
  async openFiscalPeriods(
    @CurrentTenant() tenantId: string,
  ): Promise<FiscalPeriod[]> {
    return await this.fiscalPeriodService.findOpenFiscalPeriods(tenantId);
  }

  @Query(() => FiscalYear)
  @RequirePermission('financial:read')
  async fiscalYear(
    @Args('year') year: number,
    @CurrentTenant() tenantId: string,
  ): Promise<FiscalYear> {
    return await this.fiscalPeriodService.getFiscalYearSummary(tenantId, year);
  }

  @Mutation(() => FiscalPeriod)
  @RequirePermission('financial:manage')
  async updateFiscalPeriod(
    @Args('input') input: UpdateFiscalPeriodInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FiscalPeriod> {
    return await this.fiscalPeriodService.updateFiscalPeriod(tenantId, input.id, input, user.id);
  }

  @Mutation(() => FiscalPeriod)
  @RequirePermission('financial:manage')
  async closeFiscalPeriod(
    @Args('input') input: CloseFiscalPeriodInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FiscalPeriod> {
    return await this.fiscalPeriodService.closeFiscalPeriod(tenantId, input.id, user.id, input.notes);
  }

  @Mutation(() => [FiscalPeriod])
  @RequirePermission('financial:manage')
  async createStandardFiscalYear(
    @Args('input') input: CreateStandardFiscalYearInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FiscalPeriod[]> {
    return await this.fiscalPeriodService.createStandardFiscalYear(
      tenantId, 
      input.fiscalYear, 
      new Date(input.startDate), 
      user.id,
      input.periodType
    );
  }

  @Mutation(() => YearEndSummary)
  @RequirePermission('financial:manage')
  async processYearEnd(
    @Args('input') input: ProcessYearEndInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<YearEndSummary> {
    return await this.fiscalPeriodService.processYearEnd(
      tenantId, 
      input.fiscalYear, 
      user.id,
      input.processDate ? new Date(input.processDate) : undefined
    );
  }

  @Mutation(() => Boolean)
  @RequirePermission('financial:manage')
  async deleteFiscalPeriod(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.fiscalPeriodService.deleteFiscalPeriod(tenantId, id, user.id);
    return true;
  }

  @Query(() => String)
  @RequirePermission('financial:read')
  async validateFiscalPeriodIntegrity(
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    const result = await this.fiscalPeriodService.validateFiscalPeriodIntegrity(tenantId);
    return JSON.stringify(result);
  }
}