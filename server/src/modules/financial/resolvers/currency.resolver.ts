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
    const result = await this.currencyService.createCurrency(tenantId, currencyData);
    return this.transformServiceCurrency(result);
  }

  @Query(() => Currency, { nullable: true })
  @RequirePermission('financial:read')
  async currency(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Currency | null> {
    const result = await this.currencyService.getCurrencyById(tenantId, id);
    return result ? this.transformServiceCurrency(result) : null;
  }

  @Query(() => [Currency])
  @RequirePermission('financial:read')
  async currencies(
    @CurrentTenant() tenantId: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<Currency[]> {
    const results = await this.currencyService.getCurrencies(tenantId, isActive ?? true);
    return results.map(c => this.transformServiceCurrency(c));
  }

  @Query(() => Currency, { nullable: true })
  @RequirePermission('financial:read')
  async baseCurrency(
    @CurrentTenant() tenantId: string,
  ): Promise<Currency | null> {
    const result = await this.currencyService.getBaseCurrency(tenantId);
    return result ? this.transformServiceCurrency(result) : null;
  }

  @Query(() => Currency, { nullable: true })
  @RequirePermission('financial:read')
  async currencyByCode(
    @Args('currencyCode') currencyCode: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Currency | null> {
    const result = await this.currencyService.getCurrencyByCode(tenantId, currencyCode);
    return result ? this.transformServiceCurrency(result) : null;
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
    const exchangeRateData: any = {
      ...input,
      effectiveDate: new Date(input.effectiveDate),
      expirationDate: input.expirationDate ? new Date(input.expirationDate) : undefined,
      createdBy: user.id,
      updatedBy: user.id,
    };
    const result = await this.currencyService.createExchangeRate(tenantId, exchangeRateData);
    return this.transformServiceExchangeRate(result);
  }

  @Query(() => ExchangeRate, { nullable: true })
  @RequirePermission('financial:read')
  async exchangeRate(
    @Args('fromCurrencyId', { type: () => ID }) fromCurrencyId: string,
    @Args('toCurrencyId', { type: () => ID }) toCurrencyId: string,
    @CurrentTenant() tenantId: string,
    @Args('effectiveDate', { nullable: true }) effectiveDate?: string,
  ): Promise<ExchangeRate | null> {
    const result = await this.currencyService.getExchangeRate(
      tenantId, 
      fromCurrencyId, 
      toCurrencyId,
      effectiveDate ? new Date(effectiveDate) : undefined
    );
    return result ? this.transformServiceExchangeRate(result) : null;
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
    const fromCurrency = await this.currencyService.getCurrencyById(tenantId, input.fromCurrencyId);
    const toCurrency = await this.currencyService.getCurrencyById(tenantId, input.toCurrencyId);
    
    return {
      fromCurrencyId: input.fromCurrencyId,
      fromCurrency: fromCurrency ? this.transformServiceCurrency(fromCurrency) : undefined,
      toCurrencyId: input.toCurrencyId,
      toCurrency: toCurrency ? this.transformServiceCurrency(toCurrency) : undefined,
      fromAmount: input.amount,
      toAmount: result.convertedAmount.toFixed(2),
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
    const result = await this.currencyService.performCurrencyRevaluation(
      tenantId,
      input.currencyId,
      input.newRate,
      new Date(input.revaluationDate),
      new Date().getFullYear(),
      1,
      user.id
    );
    return this.transformServiceCurrencyRevaluation(result);
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

  // Helper transformation methods
  private transformServiceCurrency(serviceCurrency: any): Currency {
    return {
      id: serviceCurrency.id,
      currencyCode: serviceCurrency.currencyCode,
      currencyName: serviceCurrency.currencyName,
      currencySymbol: serviceCurrency.currencySymbol,
      decimalPlaces: serviceCurrency.decimalPlaces,
      isBaseCurrency: serviceCurrency.isBaseCurrency,
      isActive: serviceCurrency.isActive,
      description: serviceCurrency.notes || undefined,
      createdAt: serviceCurrency.createdAt || new Date(),
      updatedAt: serviceCurrency.updatedAt || new Date(),
      createdBy: serviceCurrency.createdBy || '',
      updatedBy: serviceCurrency.updatedBy || undefined,
      tenantId: serviceCurrency.tenantId,
    } as unknown as Currency;
  }

  private transformServiceExchangeRate(serviceRate: any): ExchangeRate {
    return {
      id: serviceRate.id,
      fromCurrencyId: serviceRate.fromCurrencyId,
      fromCurrency: serviceRate.fromCurrency ? this.transformServiceCurrency(serviceRate.fromCurrency) : ({} as Currency),
      toCurrencyId: serviceRate.toCurrencyId,
      toCurrency: serviceRate.toCurrency ? this.transformServiceCurrency(serviceRate.toCurrency) : ({} as Currency),
      rate: serviceRate.exchangeRate,
      effectiveDate: serviceRate.effectiveDate,
      expirationDate: serviceRate.expirationDate || undefined,
      rateType: serviceRate.rateSource || 'spot',
      source: serviceRate.rateProvider || undefined,
      isActive: serviceRate.isActive !== false,
      createdAt: serviceRate.createdAt || new Date(),
      updatedAt: serviceRate.updatedAt || new Date(),
      createdBy: serviceRate.createdBy || '',
      updatedBy: serviceRate.updatedBy || undefined,
      tenantId: serviceRate.tenantId,
    } as unknown as ExchangeRate;
  }

  private transformServiceCurrencyRevaluation(serviceRevaluation: any): CurrencyRevaluation {
    return {
      id: serviceRevaluation.id,
      revaluationDate: serviceRevaluation.revaluationDate,
      currency: serviceRevaluation.currency ? this.transformServiceCurrency(serviceRevaluation.currency) : ({} as unknown as Currency),
      oldRate: serviceRevaluation.oldRate,
      newRate: serviceRevaluation.newRate,
      revaluationAmount: serviceRevaluation.revaluationAmount?.toFixed(2) || '0.00',
      journalEntryId: serviceRevaluation.journalEntryId || undefined,
      status: serviceRevaluation.status || 'pending',
      notes: serviceRevaluation.notes || undefined,
      createdAt: serviceRevaluation.createdAt || new Date(),
      createdBy: serviceRevaluation.createdBy || '',
      tenantId: serviceRevaluation.tenantId,
    } as unknown as CurrencyRevaluation;
  }
}
