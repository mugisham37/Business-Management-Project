import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TaxService } from '../services/tax.service';
import { 
  CreateTaxJurisdictionInput,
  UpdateTaxJurisdictionInput,
  CreateTaxRateInput,
  UpdateTaxRateInput,
  TaxCalculationInput,
  CreateTaxReturnInput,
  UpdateTaxReturnInput
} from '../graphql/inputs';
import { 
  TaxJurisdiction, 
  TaxRate, 
  TaxCalculationResult, 
  TaxReturn 
} from '../graphql/types';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

/**
 * GraphQL resolver for Tax operations
 * Handles tax calculations, tax rates, jurisdictions, and tax returns
 */
@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
export class TaxResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly taxService: TaxService,
    private readonly cacheService: IntelligentCacheService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Query: Calculate tax
   * Calculates tax for a given amount and jurisdiction
   */
  @Query(() => TaxCalculationResult)
  @RequirePermission('financial:read')
  async calculateTax(
    @Args('input') input: TaxCalculationInput,
    @CurrentTenant() tenantId: string,
  ): Promise<TaxCalculationResult> {
    return await this.taxService.calculateTax(tenantId, input);
  }

  /**
   * Query: Get tax rates
   * Returns all tax rates with optional filtering
   */
  @Query(() => [String])
  @RequirePermission('financial:read')
  async getTaxRates(
    @CurrentTenant() tenantId: string,
    @Args('jurisdictionId', { type: () => ID, nullable: true }) jurisdictionId?: string,
    @Args('activeOnly', { nullable: true }) activeOnly?: boolean,
  ): Promise<TaxRate[]> {
    // Check cache first (24-hour TTL)
    const cacheKey = `tax:rates:${tenantId}:${jurisdictionId || 'all'}:${activeOnly ?? true}`;
    let rates = await this.cacheService.get<TaxRate[]>(cacheKey);

    if (!rates) {
      rates = await this.taxService.getTaxRates(tenantId, jurisdictionId, activeOnly ?? true);

      // Cache for 24 hours
      await this.cacheService.set(cacheKey, rates, { ttl: 86400 });
    }

    return rates;
  }

  /**
   * Query: Get tax jurisdictions
   * Returns all tax jurisdictions
   */
  @Query(() => [String])
  @RequirePermission('financial:read')
  async taxJurisdictions(
    @CurrentTenant() tenantId: string,
    @Args('activeOnly', { nullable: true }) activeOnly?: boolean,
  ): Promise<TaxJurisdiction[]> {
    // Check cache first (24-hour TTL)
    const cacheKey = `tax:jurisdictions:${tenantId}:${activeOnly ?? true}`;
    let jurisdictions = await this.cacheService.get<TaxJurisdiction[]>(cacheKey);

    if (!jurisdictions) {
      jurisdictions = await this.taxService.getJurisdictions(tenantId, activeOnly ?? true);

      // Cache for 24 hours
      await this.cacheService.set(cacheKey, jurisdictions, { ttl: 86400 });
    }

    return jurisdictions;
  }

  /**
   * Query: Get tax report
   * Returns tax report for a period
   */
  @Query(() => String)
  @RequirePermission('financial:read')
  async getTaxReport(
    @CurrentTenant() tenantId: string,
    @Args('jurisdictionId', { type: () => ID }) jurisdictionId: string,
    @Args('periodYear') periodYear: number,
    @Args('periodNumber') periodNumber: number,
    @Args('periodType') periodType: string,
  ): Promise<TaxReturn> {
    // Check cache first (24-hour TTL)
    const cacheKey = `tax:report:${tenantId}:${jurisdictionId}:${periodYear}:${periodNumber}:${periodType}`;
    let report = await this.cacheService.get<TaxReturn>(cacheKey);

    if (!report) {
      report = await this.taxService.generateTaxReturn(
        tenantId,
        jurisdictionId,
        periodYear,
        periodNumber,
        periodType,
      );

      // Cache for 24 hours
      await this.cacheService.set(cacheKey, report, { ttl: 86400 });
    }

    return report;
  }

  /**
   * Query: Get tax returns
   * Returns list of tax returns with optional filtering
   */
  @Query(() => [String])
  @RequirePermission('financial:read')
  async taxReturns(
    @CurrentTenant() tenantId: string,
    @Args('jurisdictionId', { type: () => ID, nullable: true }) jurisdictionId?: string,
    @Args('periodYear', { nullable: true }) periodYear?: number,
    @Args('filingStatus', { nullable: true }) filingStatus?: string,
  ): Promise<TaxReturn[]> {
    return await this.taxService.getTaxReturns(
      tenantId,
      jurisdictionId,
      periodYear,
      filingStatus,
    );
  }

  /**
   * Mutation: Update tax rate
   * Creates or updates a tax rate
   */
  @Mutation(() => String)
  @RequirePermission('financial:manage')
  async updateTaxRate(
    @Args('input') input: any,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaxRate> {
    const taxRate = await this.taxService.createTaxRate(tenantId, {
      jurisdictionId: input.jurisdictionId,
      taxType: input.taxType,
      taxName: input.taxName,
      taxCode: input.taxCode,
      rate: parseFloat(input.rate),
      flatAmount: input.flatAmount ? parseFloat(input.flatAmount) : null,
      calculationMethod: input.calculationMethod || 'percentage',
      compoundingOrder: input.compoundingOrder,
      applicableToProducts: input.applicableToProducts ?? true,
      applicableToServices: input.applicableToServices ?? true,
      applicableToShipping: input.applicableToShipping ?? false,
      minimumTaxableAmount: input.minimumTaxableAmount ? parseFloat(input.minimumTaxableAmount) : null,
      maximumTaxableAmount: input.maximumTaxableAmount ? parseFloat(input.maximumTaxableAmount) : null,
      effectiveDate: new Date(input.effectiveDate),
      expirationDate: input.expirationDate ? new Date(input.expirationDate) : undefined,
      reportingCategory: input.reportingCategory,
      glAccountId: input.glAccountId,
      settings: input.settings || {},
    } as any);

    // Invalidate cache
    await this.cacheService.invalidatePattern(`tax:*:${tenantId}:*`);

    return taxRate;
  }

  /**
   * Mutation: Create tax jurisdiction
   * Adds a new tax jurisdiction
   */
  @Mutation(() => String)
  @RequirePermission('financial:manage')
  async createTaxJurisdiction(
    @Args('input') input: any,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaxJurisdiction> {
    const jurisdiction = await this.taxService.createJurisdiction(tenantId, {
      jurisdictionCode: input.jurisdictionCode,
      jurisdictionName: input.jurisdictionName,
      jurisdictionType: input.jurisdictionType,
      country: input.country,
      stateProvince: input.stateProvince,
      county: input.county,
      city: input.city,
      postalCode: input.postalCode,
      taxAuthorityName: input.taxAuthorityName,
      taxAuthorityId: input.taxAuthorityId,
      effectiveDate: new Date(input.effectiveDate),
      expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
      settings: input.settings || {},
    });

    // Invalidate cache
    await this.cacheService.invalidatePattern(`tax:*:${tenantId}:*`);

    return jurisdiction;
  }

  /**
   * Mutation: Create tax return
   * Creates a new tax return for filing
   */
  @Mutation(() => String)
  @RequirePermission('financial:manage')
  async createTaxReturn(
    @Args('input') input: any,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaxReturn> {
    const taxReturn = await this.taxService.createTaxReturn(tenantId, {
      jurisdictionId: input.jurisdictionId,
      periodType: input.periodType,
      periodYear: input.periodYear,
      periodNumber: input.periodNumber,
      periodStartDate: new Date(input.periodStartDate),
      periodEndDate: new Date(input.periodEndDate),
      dueDate: new Date(input.dueDate),
      totalTaxableAmount: input.totalTaxableAmount ? parseFloat(input.totalTaxableAmount) : 0,
      totalTaxAmount: input.totalTaxAmount ? parseFloat(input.totalTaxAmount) : 0,
      totalPayments: input.totalPayments ? parseFloat(input.totalPayments) : 0,
      amountDue: input.amountDue ? parseFloat(input.amountDue) : 0,
      filingStatus: input.filingStatus || 'draft',
      preparedBy: user.id,
      notes: input.notes,
      attachments: input.attachments || [],
    });

    return taxReturn;
  }
}
