/**
 * Multi-Currency Hooks
 * Custom hooks for currency management and exchange rate operations
 */

import { useLazyQuery, useQuery, useMutation, useSubscription } from '@apollo/client';
import { useState, useCallback, useMemo } from 'react';
import {
  CONVERT_CURRENCY,
  GET_EXCHANGE_RATES,
  GET_CURRENCIES,
} from '@/graphql/queries/financial';
import {
  CREATE_CURRENCY,
  UPDATE_CURRENCY,
  SET_BASE_CURRENCY,
  CREATE_EXCHANGE_RATE,
  UPDATE_EXCHANGE_RATE,
} from '@/graphql/mutations/financial';
import {
  EXCHANGE_RATE_UPDATED,
  CURRENCY_CONVERSION_ALERT,
} from '@/graphql/subscriptions/financial';
import { useTenant } from '@/hooks/useTenant';
import { errorLogger } from '@/lib/error-handling';

export interface CurrencyConversionInput {
  amount: number;
  fromCurrencyId: string;
  toCurrencyId: string;
  conversionDate?: Date;
}

export interface CreateCurrencyInput {
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  decimalPlaces?: number;
  decimalSeparator?: string;
  thousandsSeparator?: string;
  symbolPosition?: 'before' | 'after';
  countryCode?: string;
}

export interface CreateExchangeRateInput {
  fromCurrencyId: string;
  toCurrencyId: string;
  exchangeRate: number;
  effectiveDate: Date;
  expirationDate?: Date;
  rateSource?: string;
  rateProvider?: string;
}

// Currency Conversion Hook
export function useCurrencyConversion() {
  const { tenant: currentTenant } = useTenant();
  const [conversionHistory, setConversionHistory] = useState<Record<string, unknown>[]>([]);

  const [convertCurrency] = useLazyQuery(CONVERT_CURRENCY, {
    errorPolicy: 'all',
  });

  const performConversion = useCallback(async (input: CurrencyConversionInput) => {
    if (!currentTenant) {
      throw new Error('No tenant context available');
    }

    try {
      const result = await convertCurrency({
        variables: {
          amount: input.amount,
          fromCurrencyId: input.fromCurrencyId,
          toCurrencyId: input.toCurrencyId,
          conversionDate: input.conversionDate || new Date(),
        },
      });

      const conversion = result.data?.convertCurrency;
      if (conversion) {
        setConversionHistory(prev => [
          ...prev.slice(-9), // Keep last 10 conversions
          {
            ...conversion,
            timestamp: new Date(),
          },
        ]);
      }

      return conversion;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useCurrencyConversion',
        operationId: 'performConversion',
        tenantId: currentTenant.id,
      });
      throw error;
    }
  }, [currentTenant, convertCurrency]);

  const clearHistory = useCallback(() => {
    setConversionHistory([]);
  }, []);

  return {
    performConversion,
    conversionHistory,
    clearHistory,
  };
}

// Exchange Rates Hook
export function useExchangeRates(filters: {
  fromCurrencyId?: string;
  toCurrencyId?: string;
  effectiveDate?: Date;
} = {}) {
  const { tenant: currentTenant } = useTenant();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_EXCHANGE_RATES, {
    variables: filters,
    skip: !currentTenant,
    errorPolicy: 'all',
  });

  const exchangeRates = useMemo(() => {
    if (!data?.getExchangeRates) return [];
    
    return data.getExchangeRates.map((rate: Record<string, unknown>) => {
      const exchangeRateNum = typeof rate.exchangeRate === 'string' ? parseFloat(rate.exchangeRate) : (rate.exchangeRate as number);
      const expirationDate = rate.expirationDate as string | null | undefined;
      return {
        ...rate,
        exchangeRate: exchangeRateNum,
        isExpired: expirationDate ? new Date(expirationDate) < new Date() : false,
        daysUntilExpiration: expirationDate ? 
          Math.ceil((new Date(expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null,
      };
    });
  }, [data]);

  const ratesSummary = useMemo(() => {
    if (!exchangeRates.length) return null;
    
    return {
      totalRates: exchangeRates.length,
      activeRates: exchangeRates.filter((r: Record<string, unknown>) => !r.isExpired).length,
      expiredRates: exchangeRates.filter((r: Record<string, unknown>) => r.isExpired).length,
      expiringRates: exchangeRates.filter((r: Record<string, unknown>) => {
        const daysUntilExp = r.daysUntilExpiration as number | null | undefined;
        return daysUntilExp !== null && daysUntilExp !== undefined && daysUntilExp <= 7 && daysUntilExp > 0;
      }).length,
      rateSources: [...new Set(exchangeRates.map((r: Record<string, unknown>) => r.rateSource))],
    };
  }, [exchangeRates]);

  return {
    exchangeRates,
    ratesSummary,
    loading,
    error,
    refetch,
  };
}

// Currencies Hook
export function useCurrencies(activeOnly = true) {
  const { tenant: currentTenant } = useTenant();

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(GET_CURRENCIES, {
    variables: { activeOnly },
    skip: !currentTenant,
    errorPolicy: 'all',
  });

  const currencies = useMemo(() => {
    if (!data?.currencies) return [];
    
    return data.currencies.map((currency: Record<string, unknown>) => ({
      ...currency,
      displayName: `${currency.currencyCode} - ${currency.currencyName}`,
      formattedSymbol: currency.symbolPosition === 'before' ? 
        `${currency.currencySymbol}0.00` : 
        `0.00${currency.currencySymbol}`,
    }));
  }, [data]);

  const baseCurrency = useMemo(() => {
    return currencies.find((c: Record<string, unknown>) => c.isBaseCurrency) || null;
  }, [currencies]);

  const currenciesByCode = useMemo(() => {
    return currencies.reduce((acc: Record<string, Record<string, unknown>>, currency: Record<string, unknown>) => {
      const currencyCode = currency.currencyCode as string;
      acc[currencyCode] = currency;
      return acc;
    }, {} as Record<string, Record<string, unknown>>);
  }, [currencies]);

  return {
    currencies,
    baseCurrency,
    currenciesByCode,
    loading,
    error,
    refetch,
  };
}

// Currency Mutations Hook
export function useCurrencyMutations() {
  const { tenant: currentTenant } = useTenant();

  const [createCurrencyMutation] = useMutation(CREATE_CURRENCY, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useCurrencyMutations',
        operationId: 'createCurrency',
        ...(currentTenant?.id && { tenantId: currentTenant.id }),
      });
    },
  });

  const [updateCurrencyMutation] = useMutation(UPDATE_CURRENCY, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useCurrencyMutations',
        operationId: 'updateCurrency',
        ...(currentTenant?.id && { tenantId: currentTenant.id }),
      });
    },
  });

  const [setBaseCurrencyMutation] = useMutation(SET_BASE_CURRENCY, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useCurrencyMutations',
        operationId: 'setBaseCurrency',
        ...(currentTenant?.id && { tenantId: currentTenant.id }),
      });
    },
  });

  const [createExchangeRateMutation] = useMutation(CREATE_EXCHANGE_RATE, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useCurrencyMutations',
        operationId: 'createExchangeRate',
        ...(currentTenant?.id && { tenantId: currentTenant.id }),
      });
    },
  });

  const [updateExchangeRateMutation] = useMutation(UPDATE_EXCHANGE_RATE, {
    onError: (error) => {
      errorLogger.logError(error, {
        component: 'useCurrencyMutations',
        operationId: 'updateExchangeRate',
        ...(currentTenant?.id && { tenantId: currentTenant.id }),
      });
    },
  });

  const createCurrency = useCallback(async (input: CreateCurrencyInput) => {
    const result = await createCurrencyMutation({
      variables: { input },
      refetchQueries: ['GetCurrencies'],
    });
    return result.data?.createCurrency;
  }, [createCurrencyMutation]);

  const updateCurrency = useCallback(async (id: string, input: Partial<CreateCurrencyInput>) => {
    const result = await updateCurrencyMutation({
      variables: { id, input },
      refetchQueries: ['GetCurrencies'],
    });
    return result.data?.updateCurrency;
  }, [updateCurrencyMutation]);

  const setBaseCurrency = useCallback(async (currencyId: string) => {
    const result = await setBaseCurrencyMutation({
      variables: { currencyId },
      refetchQueries: ['GetCurrencies'],
    });
    return result.data?.setBaseCurrency;
  }, [setBaseCurrencyMutation]);

  const createExchangeRate = useCallback(async (input: CreateExchangeRateInput) => {
    const result = await createExchangeRateMutation({
      variables: { input },
      refetchQueries: ['GetExchangeRates'],
    });
    return result.data?.createExchangeRate;
  }, [createExchangeRateMutation]);

  const updateExchangeRate = useCallback(async (id: string, input: Partial<CreateExchangeRateInput>) => {
    const result = await updateExchangeRateMutation({
      variables: { id, input },
      refetchQueries: ['GetExchangeRates'],
    });
    return result.data?.updateExchangeRate;
  }, [updateExchangeRateMutation]);

  return {
    createCurrency,
    updateCurrency,
    setBaseCurrency,
    createExchangeRate,
    updateExchangeRate,
  };
}

// Currency Subscriptions Hook
export function useCurrencySubscriptions() {
  const { tenant: currentTenant } = useTenant();
  const [currencyNotifications, setCurrencyNotifications] = useState<Record<string, unknown>[]>([]);

  useSubscription(EXCHANGE_RATE_UPDATED, {
    variables: { tenantId: currentTenant?.id },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.exchangeRateUpdated) {
        setCurrencyNotifications(prev => [
          ...prev,
          {
            type: 'rate_updated',
            data: data.data.exchangeRateUpdated,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  useSubscription(CURRENCY_CONVERSION_ALERT, {
    variables: { 
      tenantId: currentTenant?.id,
      thresholdPercentage: 5, // Alert when rate changes by 5%
    },
    skip: !currentTenant,
    onData: ({ data }) => {
      if (data.data?.currencyConversionAlert) {
        setCurrencyNotifications(prev => [
          ...prev,
          {
            type: 'conversion_alert',
            data: data.data.currencyConversionAlert,
            timestamp: new Date(),
          },
        ]);
      }
    },
  });

  const clearNotifications = useCallback(() => {
    setCurrencyNotifications([]);
  }, []);

  return {
    currencyNotifications,
    clearNotifications,
  };
}

// Currency Formatting Hook
export function useCurrencyFormatting() {
  const { currencies, baseCurrency } = useCurrencies();

  const formatAmount = useCallback((
    amount: number,
    currencyCode?: string,
    options: {
      showSymbol?: boolean;
      showCode?: boolean;
      precision?: number;
    } = {}
  ) => {
    const {
      showSymbol = true,
      showCode = false,
      precision,
    } = options;

    const currency = currencyCode ? 
      currencies.find((c: Record<string, unknown>) => c.currencyCode === currencyCode) : 
      baseCurrency;

    if (!currency) {
      return amount.toFixed(2);
    }

    const decimalPlaces = precision !== undefined ? precision : currency.decimalPlaces;
    const formattedAmount = amount.toLocaleString('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });

    let result = formattedAmount;

    if (showSymbol && currency.currencySymbol) {
      if (currency.symbolPosition === 'before') {
        result = `${currency.currencySymbol}${result}`;
      } else {
        result = `${result}${currency.currencySymbol}`;
      }
    }

    if (showCode) {
      result = `${result} ${currency.currencyCode}`;
    }

    return result;
  }, [currencies, baseCurrency]);

  const parseAmount = useCallback((
    value: string,
    currencyCode?: string
  ): number => {
    const currency = currencyCode ? 
      currencies.find((c: Record<string, unknown>) => c.currencyCode === currencyCode) : 
      baseCurrency;

    if (!currency) {
      return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
    }

    // Remove currency symbol and separators
    let cleaned = value;
    if (currency.currencySymbol) {
      cleaned = cleaned.replace(new RegExp(`\\${currency.currencySymbol}`, 'g'), '');
    }
    if (currency.thousandsSeparator) {
      cleaned = cleaned.replace(new RegExp(`\\${currency.thousandsSeparator}`, 'g'), '');
    }
    if (currency.decimalSeparator && currency.decimalSeparator !== '.') {
      cleaned = cleaned.replace(currency.decimalSeparator, '.');
    }

    return parseFloat(cleaned) || 0;
  }, [currencies, baseCurrency]);

  return {
    formatAmount,
    parseAmount,
  };
}

// Comprehensive Multi-Currency Hook
export function useMultiCurrency() {
  const conversion = useCurrencyConversion();
  const exchangeRates = useExchangeRates();
  const currencies = useCurrencies();
  const mutations = useCurrencyMutations();
  const subscriptions = useCurrencySubscriptions();
  const formatting = useCurrencyFormatting();

  const currencyAnalytics = useMemo(() => {
    if (!exchangeRates.exchangeRates.length) return null;
    
    const ratesByPair = exchangeRates.exchangeRates.reduce((acc: Record<string, Record<string, unknown>[]>, rate: Record<string, unknown>) => {
      const pair = `${(rate.fromCurrency as Record<string, unknown>).currencyCode}/${(rate.toCurrency as Record<string, unknown>).currencyCode}`;
      if (!acc[pair]) {
        acc[pair] = [];
      }
      acc[pair].push(rate);
      return acc;
    }, {} as Record<string, Record<string, unknown>[]>);

    const volatilePairs = Object.entries(ratesByPair)
      .filter(([, rates]) => (rates as Record<string, unknown>[]).length > 1)
      .map(([pair, rates]) => {
        const sortedRates = (rates as Record<string, unknown>[]).sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
          new Date(b.effectiveDate as string).getTime() - new Date(a.effectiveDate as string).getTime()
        );
        const latest = sortedRates[0];
        const previous = sortedRates[1];
        
        if (latest && previous) {
          const latestRate = latest.exchangeRate as number;
          const previousRate = previous.exchangeRate as number;
          const change = ((latestRate - previousRate) / previousRate) * 100;
          return {
            pair,
            latestRate,
            previousRate,
            change,
            volatility: Math.abs(change),
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => (b?.volatility || 0) - (a?.volatility || 0));

    return {
      totalPairs: Object.keys(ratesByPair).length,
      volatilePairs: volatilePairs.slice(0, 5),
      mostVolatilePair: volatilePairs[0] || null,
    };
  }, [exchangeRates.exchangeRates]);

  return {
    // Conversion
    ...conversion,
    
    // Exchange rates
    exchangeRates: exchangeRates.exchangeRates,
    ratesSummary: exchangeRates.ratesSummary,
    exchangeRatesLoading: exchangeRates.loading,
    exchangeRatesError: exchangeRates.error,
    
    // Currencies
    currencies: currencies.currencies,
    baseCurrency: currencies.baseCurrency,
    currenciesByCode: currencies.currenciesByCode,
    currenciesLoading: currencies.loading,
    currenciesError: currencies.error,
    
    // Analytics
    currencyAnalytics,
    
    // Mutations
    ...mutations,
    
    // Subscriptions
    ...subscriptions,
    
    // Formatting
    ...formatting,
    
    // Refresh functions
    refreshExchangeRates: exchangeRates.refetch,
    refreshCurrencies: currencies.refetch,
  };
}