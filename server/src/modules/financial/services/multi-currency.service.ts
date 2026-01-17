import { Injectable, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { 
  currencies, 
  exchangeRates, 
  currencyConversions
} from '../../database/schema/financial.schema';
import { eq, and, gte, lte, isNull, or, desc, asc } from 'drizzle-orm';

export interface Currency {
  id: string;
  tenantId: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  decimalPlaces: number;
  decimalSeparator: string;
  thousandsSeparator: string;
  symbolPosition: string;
  isActive: boolean;
  isBaseCurrency: boolean;
  countryCode: string;
  notes?: string;
}

export interface ExchangeRate {
  id: string;
  tenantId: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  exchangeRate: number;
  inverseRate: number;
  effectiveDate: Date;
  expirationDate?: Date;
  rateSource: string;
  rateProvider?: string;
  isActive: boolean;
  notes?: string;
}

export interface ConversionResult {
  originalAmount: number;
  convertedAmount: number;
  exchangeRate: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  conversionDate: Date;
  rateSource: string;
}

export interface CurrencyRevaluation {
  id: string;
  tenantId: string;
  currencyId: string;
  newExchangeRate: number;
  revaluationDate: Date;
  fiscalYear: number;
  fiscalPeriod: number;
  totalGainLoss: number;
  status: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class MultiCurrencyService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  // Currency Management
  async createCurrency(tenantId: string, data: Partial<Currency>): Promise<Currency> {
    // Ensure only one base currency per tenant
    if (data.isBaseCurrency) {
      await this.drizzle.getDb()
        .update(currencies)
        .set({ isBaseCurrency: false, updatedAt: new Date() })
        .where(
          and(
            eq(currencies.tenantId, tenantId),
            eq(currencies.isBaseCurrency, true)
          )
        );
    }

    const currency = await this.drizzle.getDb()
      .insert(currencies)
      .values({
        tenantId,
        currencyCode: data.currencyCode!,
        currencyName: data.currencyName!,
        currencySymbol: data.currencySymbol!,
        decimalPlaces: data.decimalPlaces || 2,
        decimalSeparator: data.decimalSeparator || '.',
        thousandsSeparator: data.thousandsSeparator || ',',
        symbolPosition: data.symbolPosition || 'before',
        isActive: data.isActive !== undefined ? data.isActive : true,
        isBaseCurrency: data.isBaseCurrency || false,
        countryCode: data.countryCode,
        notes: data.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await this.invalidateCurrencyCache(tenantId);
    return currency[0] as Currency;
  }

  async getCurrencies(tenantId: string, activeOnly: boolean = true): Promise<Currency[]> {
    const cacheKey = `currency:list:${tenantId}:${activeOnly}`;
    let currencies_list = await this.cacheService.get<any[]>(cacheKey);

    if (!currencies_list) {
      const conditions = [eq(currencies.tenantId, tenantId)];
      if (activeOnly) {
        conditions.push(eq(currencies.isActive, true));
      }

      currencies_list = await this.drizzle.getDb()
        .select()
        .from(currencies)
        .where(and(...conditions))
        .orderBy(asc(currencies.currencyCode));

      await this.cacheService.set(cacheKey, currencies_list, { ttl: 300 }); // 5 minutes
    }

    // Transform the database results to match the Currency interface
    return (currencies_list || []).map(currency => ({
      id: currency.id,
      tenantId: currency.tenantId,
      currencyCode: currency.currencyCode,
      currencyName: currency.currencyName,
      currencySymbol: currency.currencySymbol,
      decimalPlaces: currency.decimalPlaces,
      decimalSeparator: currency.decimalSeparator,
      thousandsSeparator: currency.thousandsSeparator,
      symbolPosition: currency.symbolPosition,
      isActive: currency.isActive,
      isBaseCurrency: currency.isBaseCurrency,
      countryCode: currency.countryCode || '',
      notes: currency.notes,
    })) as Currency[];
  }

  async getBaseCurrency(tenantId: string): Promise<Currency> {
    const cacheKey = `currency:base:${tenantId}`;
    let baseCurrency = await this.cacheService.get<Currency>(cacheKey);

    if (!baseCurrency) {
      const result = await this.drizzle.getDb()
        .select()
        .from(currencies)
        .where(
          and(
            eq(currencies.tenantId, tenantId),
            eq(currencies.isBaseCurrency, true),
            eq(currencies.isActive, true)
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new NotFoundException('No base currency configured for tenant');
      }

      baseCurrency = result[0] as Currency;
      await this.cacheService.set(cacheKey, baseCurrency, { ttl: 600 }); // 10 minutes
    }

    return baseCurrency;
  }

  async getCurrencyByCode(tenantId: string, currencyCode: string): Promise<Currency | null> {
    const cacheKey = `currency:code:${tenantId}:${currencyCode}`;
    let currency = await this.cacheService.get<Currency>(cacheKey);

    if (!currency) {
      const result = await this.drizzle.getDb()
        .select()
        .from(currencies)
        .where(
          and(
            eq(currencies.tenantId, tenantId),
            eq(currencies.currencyCode, currencyCode),
            eq(currencies.isActive, true)
          )
        )
        .limit(1);

      currency = result[0] as Currency || null;
      if (currency) {
        await this.cacheService.set(cacheKey, currency, { ttl: 300 });
      }
    }

    return currency;
  }

  async getCurrencyById(tenantId: string, currencyId: string): Promise<Currency | null> {
    const cacheKey = `currency:id:${tenantId}:${currencyId}`;
    let currency = await this.cacheService.get<Currency>(cacheKey);

    if (!currency) {
      const result = await this.drizzle.getDb()
        .select()
        .from(currencies)
        .where(
          and(
            eq(currencies.tenantId, tenantId),
            eq(currencies.id, currencyId),
            eq(currencies.isActive, true)
          )
        )
        .limit(1);

      currency = result[0] as Currency || null;
      if (currency) {
        await this.cacheService.set(cacheKey, currency, { ttl: 300 });
      }
    }

    return currency;
  }

  // Exchange Rate Management
  async createExchangeRate(tenantId: string, data: Partial<ExchangeRate>): Promise<ExchangeRate> {
    // Calculate inverse rate
    if (data.exchangeRate && !data.inverseRate) {
      data.inverseRate = 1 / data.exchangeRate;
    }

    // Deactivate existing rates for the same currency pair
    if (data.fromCurrencyId && data.toCurrencyId) {
      await this.drizzle.getDb()
        .update(exchangeRates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(exchangeRates.tenantId, tenantId),
            eq(exchangeRates.fromCurrencyId, data.fromCurrencyId),
            eq(exchangeRates.toCurrencyId, data.toCurrencyId),
            eq(exchangeRates.isActive, true)
          )
        );
    }

    const exchangeRate = await this.drizzle.getDb()
      .insert(exchangeRates)
      .values({
        tenantId,
        fromCurrencyId: data.fromCurrencyId!,
        toCurrencyId: data.toCurrencyId!,
        exchangeRate: data.exchangeRate!.toString(),
        inverseRate: data.inverseRate!.toString(),
        effectiveDate: data.effectiveDate!,
        expirationDate: data.expirationDate,
        rateSource: data.rateSource || 'manual',
        rateProvider: data.rateProvider,
        isActive: data.isActive !== undefined ? data.isActive : true,
        notes: data.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await this.invalidateExchangeRateCache(tenantId);
    
    if (!exchangeRate[0]) {
      throw new Error('Failed to create exchange rate');
    }
    
    return {
      ...exchangeRate[0],
      exchangeRate: Number(exchangeRate[0].exchangeRate),
      inverseRate: Number(exchangeRate[0].inverseRate),
    } as ExchangeRate;
  }

  async getExchangeRate(
    tenantId: string,
    fromCurrencyId: string,
    toCurrencyId: string,
    effectiveDate: Date = new Date()
  ): Promise<ExchangeRate | null> {
    const cacheKey = `exchange-rate:${tenantId}:${fromCurrencyId}:${toCurrencyId}:${effectiveDate.toISOString().split('T')[0]}`;
    let rate = await this.cacheService.get<ExchangeRate>(cacheKey);

    if (!rate) {
      // Try direct rate first
      let result = await this.drizzle.getDb()
        .select()
        .from(exchangeRates)
        .where(
          and(
            eq(exchangeRates.tenantId, tenantId),
            eq(exchangeRates.fromCurrencyId, fromCurrencyId),
            eq(exchangeRates.toCurrencyId, toCurrencyId),
            eq(exchangeRates.isActive, true),
            lte(exchangeRates.effectiveDate, effectiveDate),
            or(
              isNull(exchangeRates.expirationDate),
              gte(exchangeRates.expirationDate, effectiveDate)
            )
          )
        )
        .orderBy(desc(exchangeRates.effectiveDate))
        .limit(1);

      if (result.length === 0) {
        // Try inverse rate
        result = await this.drizzle.getDb()
          .select()
          .from(exchangeRates)
          .where(
            and(
              eq(exchangeRates.tenantId, tenantId),
              eq(exchangeRates.fromCurrencyId, toCurrencyId),
              eq(exchangeRates.toCurrencyId, fromCurrencyId),
              eq(exchangeRates.isActive, true),
              lte(exchangeRates.effectiveDate, effectiveDate),
              or(
                isNull(exchangeRates.expirationDate),
                gte(exchangeRates.expirationDate, effectiveDate)
              )
            )
          )
          .orderBy(desc(exchangeRates.effectiveDate))
          .limit(1);

        if (result.length > 0 && result[0]) {
          // Use inverse rate
          const inverseRate = result[0];
          rate = {
            ...inverseRate,
            fromCurrencyId,
            toCurrencyId,
            exchangeRate: Number(inverseRate.inverseRate || 1),
            inverseRate: Number(inverseRate.exchangeRate || 1),
          } as ExchangeRate;
        }
      } else if (result[0]) {
        rate = {
          ...result[0],
          exchangeRate: Number(result[0].exchangeRate || 1),
          inverseRate: Number(result[0].inverseRate || 1),
        } as ExchangeRate;
      }

      if (rate) {
        await this.cacheService.set(cacheKey, rate, { ttl: 300 }); // 5 minutes
      }
    }

    return rate;
  }

  // Currency Conversion
  async convertAmount(
    tenantId: string,
    amount: number,
    fromCurrencyId: string,
    toCurrencyId: string,
    conversionDate: Date = new Date(),
    sourceType?: string,
    sourceId?: string
  ): Promise<ConversionResult> {
    // If same currency, no conversion needed
    if (fromCurrencyId === toCurrencyId) {
      const currency = await this.drizzle.getDb()
        .select()
        .from(currencies)
        .where(eq(currencies.id, fromCurrencyId))
        .limit(1);

      return {
        originalAmount: amount,
        convertedAmount: amount,
        exchangeRate: 1,
        fromCurrency: currency[0] as Currency,
        toCurrency: currency[0] as Currency,
        conversionDate,
        rateSource: 'same_currency',
      };
    }

    // Get exchange rate
    const rate = await this.getExchangeRate(tenantId, fromCurrencyId, toCurrencyId, conversionDate);
    if (!rate) {
      throw new NotFoundException(`No exchange rate found for currency pair on ${conversionDate.toISOString()}`);
    }

    // Calculate converted amount
    const convertedAmount = this.roundCurrencyAmount(amount * rate.exchangeRate, toCurrencyId);

    // Get currency details
    const [fromCurrency, toCurrency] = await Promise.all([
      this.drizzle.getDb().select().from(currencies).where(eq(currencies.id, fromCurrencyId)).limit(1),
      this.drizzle.getDb().select().from(currencies).where(eq(currencies.id, toCurrencyId)).limit(1),
    ]);

    // Record conversion for audit trail
    if (sourceType && sourceId) {
      await this.drizzle.getDb()
        .insert(currencyConversions)
        .values({
          tenantId,
          sourceType,
          sourceId,
          fromCurrencyId,
          toCurrencyId,
          originalAmount: amount.toString(),
          convertedAmount: convertedAmount.toString(),
          exchangeRate: rate.exchangeRate.toString(),
          conversionDate,
          rateSource: rate.rateSource,
          gainLossAmount: '0.00', // Would be calculated for revaluations
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }

    return {
      originalAmount: amount,
      convertedAmount,
      exchangeRate: rate.exchangeRate,
      fromCurrency: fromCurrency[0] as Currency,
      toCurrency: toCurrency[0] as Currency,
      conversionDate,
      rateSource: rate.rateSource,
    };
  }

  async convertToBaseCurrency(
    tenantId: string,
    amount: number,
    fromCurrencyId: string,
    conversionDate: Date = new Date(),
    sourceType?: string,
    sourceId?: string
  ): Promise<ConversionResult> {
    const baseCurrency = await this.getBaseCurrency(tenantId);
    return this.convertAmount(
      tenantId,
      amount,
      fromCurrencyId,
      baseCurrency.id,
      conversionDate,
      sourceType,
      sourceId
    );
  }

  // Utility Methods
  async formatCurrencyAmount(amount: number, currencyId: string): Promise<string> {
    const currency = await this.drizzle.getDb()
      .select()
      .from(currencies)
      .where(eq(currencies.id, currencyId))
      .limit(1);

    if (currency.length === 0) {
      return amount.toFixed(2);
    }

    const curr = currency[0];
    if (!curr) {
      return amount.toFixed(2);
    }

    const formattedAmount = amount.toFixed(curr.decimalPlaces);
    const [integerPart, decimalPart] = formattedAmount.split('.');
    
    if (!integerPart) {
      return amount.toFixed(2);
    }

    // Add thousands separators
    const integerWithSeparators = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, curr.thousandsSeparator);
    
    // Combine parts
    const fullAmount = decimalPart ? 
      `${integerWithSeparators}${curr.decimalSeparator}${decimalPart}` : 
      integerWithSeparators;

    // Add currency symbol
    return curr.symbolPosition === 'before' ? 
      `${curr.currencySymbol}${fullAmount}` : 
      `${fullAmount}${curr.currencySymbol}`;
  }

  private roundCurrencyAmount(amount: number, currencyId: string): number {
    // For now, round to 2 decimal places
    // In a real implementation, you'd get the currency's decimal places
    return Math.round(amount * 100) / 100;
  }

  private async invalidateCurrencyCache(tenantId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`currency:*:${tenantId}:*`);
  }

  private async invalidateExchangeRateCache(tenantId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`exchange-rate:${tenantId}:*`);
  }

  // Placeholder for currency revaluation - simplified for now
  async performCurrencyRevaluation(
    tenantId: string,
    currencyId: string,
    newExchangeRate: number,
    revaluationDate: Date,
    fiscalYear: number,
    fiscalPeriod: number,
    createdBy: string
  ): Promise<CurrencyRevaluation> {
    // Simplified implementation - would need full transaction logic
    return {
      id: `revaluation_${Date.now()}`,
      tenantId,
      currencyId,
      newExchangeRate,
      revaluationDate,
      fiscalYear,
      fiscalPeriod,
      totalGainLoss: 0,
      status: 'draft',
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}