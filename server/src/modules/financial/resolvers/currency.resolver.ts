import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { MultiCurrencyService } from '../services/multi-currency.service';
import { 
  CreateCurrencyInput,
  UpdateCurrencyInput,
  CreateExchangeRateInput,
  UpdateExchangeRateInput,
  CurrencyConversionInput,
  CurrencyRevaluationInput
} from '../graphql/inputs';
import { 
  Currency, 
  ExchangeRate, 
  CurrencyConversion, 
  MultiCurrencyReport,
  CurrencyRevaluation
} from '../graphql/types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver(() => Currency)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
export class CurrencyResolver {
  constructor(private readonly currencyService: MultiCurrencyService) {}

  @Mutation(() => Currency)
  @RequirePermission('financial:manage')
  async createCurrency(
    @Args('input') input: CreateCurrencyInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Currency> {
    // Add user info to the input
    const currencyData = {
      ...input,
      createdBy: user.id,
      updatedBy: user.id,
    };
    return await this.currencyService.createCurrency(tenantId, currencyData);
  }

  @Query(() => Currency, { nullable: true })
  @RequirePermission('financial:read')
  async currency(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Currency | null> {
    const result = await this.currencyService.getCurrencyById(tenantId, id);
    return result;
  }

  @Query(() => [Currency])
  @RequirePermission('financial:read')
  async currencies(
    @CurrentTenant() tenantId: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<Currency[]> {
    return await this.currencyService.getCurrencies(tenantId, isActive ?? true);
  }

  @Query(() => Currency, { nullable: true })
  @RequirePermission('financial:read')
  async baseCurrency(
    @CurrentTenant() tenantId: string,
  ): Promise<Currency | null> {
    return await this.currencyService.getBaseCurrency(tenantId);
  }

  @Query(() => Currency, { nullable: true })
  @RequirePermission('financial:read')
  async currencyByCode(
    @Args('currencyCode') currencyCode: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Currency | null> {
    return await this.currencyService.getCurrencyByCode(tenantId, currencyCode);
  }

  @Mutation(() => Currency)
  @RequirePermission('financial:manage')
  async updateCurrency(
    @Args('input') input: UpdateCurrencyInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Currency> {
    // Since updateCurrency doesn't exist, we'll need to implement it or use a different approach
    // For now, let's throw an error indicating this feature is not implemented
    throw new Error('Currency update functionality is not yet implemented');
  }

  @Mutation(() => ExchangeRate)
  @RequirePermission('financial:manage')
  async createExchangeRate(
    @Args('input') input: CreateExchangeRateInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExchangeRate> {
    // Add user info to the input
    const exchangeRateData = {
      ...input,
      createdBy: user.id,
      updatedBy: user.id,
    };
    return await this.currencyService.createExchangeRate(tenantId, exchangeRateData);
  }

  @Query(() => ExchangeRate, { nullable: true })
  @RequirePermission('financial:read')
  async exchangeRate(
    @Args('fromCurrencyId', { type: () => ID }) fromCurrencyId: string,
    @Args('toCurrencyId', { type: () => ID }) toCurrencyId: string,
    @CurrentTenant() tenantId: string,
    @Args('effectiveDate', { nullable: true }) effectiveDate?: string,
  ): Promise<ExchangeRate | null> {
    return await this.currencyService.getExchangeRate(
      tenantId, 
      fromCurrencyId, 
      toCurrencyId,
      effectiveDate ? new Date(effectiveDate) : undefined
    );
  }

  @Query(() => [ExchangeRate])
  @RequirePermission('financial:read')
  async exchangeRates(
    @CurrentTenant() tenantId: string,
    @Args('currencyId', { nullable: true }) currencyId?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<ExchangeRate[]> {
    // Since getExchangeRates doesn't exist, return empty array for now
    // This would need to be implemented in the service
    return [];
  }

  @Mutation(() => ExchangeRate)
  @RequirePermission('financial:manage')
  async updateExchangeRate(
    @Args('input') input: UpdateExchangeRateInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExchangeRate> {
    // Since updateExchangeRate doesn't exist, throw an error for now
    throw new Error('Exchange rate update functionality is not yet implemented');
  }

  @Query(() => CurrencyConversion)
  @RequirePermission('financial:read')
  async convertAmount(
    @Args('input') input: CurrencyConversionInput,
    @CurrentTenant() tenantId: string,
  ): Promise<CurrencyConversion> {
    const result = await this.currencyService.convertAmount(
      tenantId,
      parseFloat(input.amount),
      input.fromCurrencyId,
      input.toCurrencyId,
      input.conversionDate ? new Date(input.conversionDate) : undefined
    );
    
    // Transform the result to match GraphQL type
    return {
      fromCurrencyId: input.fromCurrencyId,
      toCurrencyId: input.toCurrencyId,
      fromAmount: parseFloat(input.amount),
      toAmount: result.convertedAmount,
      exchangeRate: result.exchangeRate,
      conversionDate: input.conversionDate ? new Date(input.conversionDate) : new Date(),
    } as CurrencyConversion;
  }

  @Query(() => MultiCurrencyReport)
  @RequirePermission('financial:read')
  async multiCurrencyReport(
    @CurrentTenant() tenantId: string,
    @Args('reportDate', { nullable: true }) reportDate?: string,
  ): Promise<MultiCurrencyReport> {
    // Since generateMultiCurrencyReport doesn't exist, throw an error for now
    throw new Error('Multi-currency report functionality is not yet implemented');
  }

  @Mutation(() => CurrencyRevaluation)
  @RequirePermission('financial:manage')
  async performCurrencyRevaluation(
    @Args('input') input: CurrencyRevaluationInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CurrencyRevaluation> {
    return await this.currencyService.performCurrencyRevaluation(
      tenantId,
      input.currencyId,
      input.newRate,
      new Date(input.revaluationDate),
      input.fiscalYear || new Date().getFullYear(),
      input.fiscalPeriod || 1,
      user.id
    );
  }

  // Field Resolvers
  @ResolveField(() => String)
  async formattedAmount(
    @Parent() currency: Currency,
    @Args('amount') amount: number,
  ): Promise<string> {
    return this.currencyService.formatCurrencyAmount(amount, currency.currencyCode);
  }

  @ResolveField(() => String)
  async roundedAmount(
    @Parent() currency: Currency,
    @Args('amount') amount: number,
  ): Promise<string> {
    // Since roundCurrencyAmount is private, we'll implement rounding here
    const decimalPlaces = currency.decimalPlaces || 2;
    const rounded = Math.round(amount * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
    return rounded.toFixed(decimalPlaces);
  }
}