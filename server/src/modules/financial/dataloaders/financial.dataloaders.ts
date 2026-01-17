import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';
import { JournalEntryService } from '../services/journal-entry.service';
import { BudgetService } from '../services/budget.service';
import { TaxService } from '../services/tax.service';
import { MultiCurrencyService } from '../services/multi-currency.service';
import { ChartOfAccount, JournalEntry, Budget, TaxJurisdiction, Currency } from '../graphql/types';

@Injectable()
export class FinancialDataLoaders {
  constructor(
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly journalEntryService: JournalEntryService,
    private readonly budgetService: BudgetService,
    private readonly taxService: TaxService,
    private readonly currencyService: MultiCurrencyService,
  ) {}

  createAccountLoader(tenantId: string): DataLoader<string, ChartOfAccount> {
    return new DataLoader<string, ChartOfAccount>(
      async (accountIds: readonly string[]) => {
        const accounts = await Promise.all(
          accountIds.map(id => 
            this.chartOfAccountsService.findAccountById(tenantId, id)
          )
        );
        return accounts;
      },
      {
        cache: true,
        maxBatchSize: 100,
        cacheKeyFn: (key) => `account:${tenantId}:${key}`,
      }
    );
  }

  createAccountsByParentLoader(tenantId: string): DataLoader<string, ChartOfAccount[]> {
    return new DataLoader<string, ChartOfAccount[]>(
      async (parentIds: readonly string[]) => {
        const results = await Promise.all(
          parentIds.map(parentId =>
            this.chartOfAccountsService.getAllAccounts(tenantId, {
              parentAccountId: parentId,
              isActive: true,
            })
          )
        );
        return results;
      },
      {
        cache: true,
        maxBatchSize: 50,
        cacheKeyFn: (key) => `accountsByParent:${tenantId}:${key}`,
      }
    );
  }

  createAccountBalanceLoader(tenantId: string): DataLoader<string, any> {
    return new DataLoader<string, any>(
      async (accountIds: readonly string[]) => {
        const balances = await Promise.all(
          accountIds.map(id =>
            this.chartOfAccountsService.getAccountBalance(tenantId, id)
          )
        );
        return balances;
      },
      {
        cache: true,
        maxBatchSize: 100,
        cacheKeyFn: (key) => `accountBalance:${tenantId}:${key}`,
      }
    );
  }

  createJournalEntryLoader(tenantId: string): DataLoader<string, JournalEntry> {
    return new DataLoader<string, JournalEntry>(
      async (entryIds: readonly string[]) => {
        const entries = await Promise.all(
          entryIds.map(id =>
            this.journalEntryService.findJournalEntryById(tenantId, id)
          )
        );
        return entries;
      },
      {
        cache: true,
        maxBatchSize: 100,
        cacheKeyFn: (key) => `journalEntry:${tenantId}:${key}`,
      }
    );
  }

  createJournalEntryLinesByAccountLoader(tenantId: string): DataLoader<string, any[]> {
    return new DataLoader<string, any[]>(
      async (accountIds: readonly string[]) => {
        const results = await Promise.all(
          accountIds.map(accountId =>
            this.journalEntryService.findJournalEntriesByAccount(tenantId, accountId)
          )
        );
        return results;
      },
      {
        cache: true,
        maxBatchSize: 50,
        cacheKeyFn: (key) => `journalLinesByAccount:${tenantId}:${key}`,
      }
    );
  }

  createBudgetLoader(tenantId: string): DataLoader<string, Budget> {
    return new DataLoader<string, Budget>(
      async (budgetIds: readonly string[]) => {
        const budgets = await Promise.all(
          budgetIds.map(async id => {
            try {
              const budget = await this.budgetService.findBudgetById(tenantId, id);
              // Transform the service result to match GraphQL Budget type
              return {
                id: budget.id,
                budgetName: budget.budgetName,
                budgetYear: budget.fiscalYear, // Map fiscalYear to budgetYear
                startDate: budget.startDate,
                endDate: budget.endDate,
                status: budget.status,
                totalBudgetAmount: '0.00', // Will be calculated from lines
                totalActualAmount: '0.00', // Will be calculated from actual data
                totalVariance: '0.00', // Will be calculated
                budgetLines: [], // Will be loaded separately
                description: budget.description,
                approvedDate: budget.approvedAt,
                approvedBy: budget.approvedBy,
                isActive: budget.isActive,
                createdAt: budget.createdAt,
                updatedAt: budget.updatedAt,
                createdBy: budget.createdBy,
                updatedBy: budget.updatedBy,
                tenantId: budget.tenantId,
              } as Budget;
            } catch (error) {
              // Return error for this specific budget
              return new Error(`Budget not found: ${id}`);
            }
          })
        );
        return budgets;
      },
      {
        cache: true,
        maxBatchSize: 50,
        cacheKeyFn: (key) => `budget:${tenantId}:${key}`,
      }
    );
  }

  createBudgetLinesLoader(tenantId: string): DataLoader<string, any[]> {
    return new DataLoader<string, any[]>(
      async (budgetIds: readonly string[]) => {
        const results = await Promise.all(
          budgetIds.map(async budgetId => {
            try {
              const budgetWithLines = await this.budgetService.getBudgetWithLines(tenantId, budgetId);
              // Return just the lines array, not the whole budget object
              return budgetWithLines.lines || [];
            } catch (error) {
              // Return empty array for failed requests
              return [];
            }
          })
        );
        return results;
      },
      {
        cache: true,
        maxBatchSize: 50,
        cacheKeyFn: (key) => `budgetLines:${tenantId}:${key}`,
      }
    );
  }

  createTaxJurisdictionLoader(tenantId: string): DataLoader<string, TaxJurisdiction> {
    return new DataLoader<string, TaxJurisdiction>(
      async (jurisdictionIds: readonly string[]) => {
        const jurisdictions = await Promise.all(
          jurisdictionIds.map(async id => {
            try {
              const jurisdiction = await this.taxService.getJurisdictionById(tenantId, id);
              if (!jurisdiction) {
                return new Error(`Tax jurisdiction not found: ${id}`);
              }
              // Transform service result to match GraphQL TaxJurisdiction type
              const transformedJurisdiction = {
                id: jurisdiction.id,
                jurisdictionCode: jurisdiction.jurisdictionCode,
                jurisdictionName: jurisdiction.jurisdictionName,
                jurisdictionType: jurisdiction.jurisdictionType as any, // Cast to enum type
                country: jurisdiction.country,
                stateProvince: jurisdiction.stateProvince || undefined,
                county: jurisdiction.county || undefined,
                city: jurisdiction.city || undefined,
                postalCode: jurisdiction.postalCode || undefined,
                taxAuthorityName: jurisdiction.taxAuthorityName || undefined,
                taxAuthorityId: jurisdiction.taxAuthorityId || undefined,
                effectiveDate: jurisdiction.effectiveDate,
                expirationDate: jurisdiction.expirationDate || undefined,
                isActive: jurisdiction.isActive,
                taxRates: [], // Will be loaded separately
                settings: JSON.stringify(jurisdiction.settings || {}),
                createdAt: jurisdiction.createdAt,
                updatedAt: jurisdiction.updatedAt,
                createdBy: '', // Add default value
                updatedBy: undefined, // This is optional in GraphQL type
                tenantId: jurisdiction.tenantId,
              } as unknown as TaxJurisdiction;
              return transformedJurisdiction;
            } catch (error) {
              return new Error(`Tax jurisdiction not found: ${id}`);
            }
          })
        );
        return jurisdictions;
      },
      {
        cache: true,
        maxBatchSize: 100,
        cacheKeyFn: (key) => `taxJurisdiction:${tenantId}:${key}`,
      }
    );
  }

  createTaxRatesByJurisdictionLoader(tenantId: string): DataLoader<string, any[]> {
    return new DataLoader<string, any[]>(
      async (jurisdictionIds: readonly string[]) => {
        const results = await Promise.all(
          jurisdictionIds.map(async jurisdictionId => {
            try {
              return await this.taxService.getTaxRates(tenantId, { jurisdictionId });
            } catch (error) {
              return [];
            }
          })
        );
        return results;
      },
      {
        cache: true,
        maxBatchSize: 50,
        cacheKeyFn: (key) => `taxRatesByJurisdiction:${tenantId}:${key}`,
      }
    );
  }

  createCurrencyLoader(tenantId: string): DataLoader<string, Currency> {
    return new DataLoader<string, Currency>(
      async (currencyIds: readonly string[]) => {
        const currencies = await Promise.all(
          currencyIds.map(async id => {
            try {
              const currency = await this.currencyService.getCurrencyById(tenantId, id);
              if (!currency) {
                return new Error(`Currency not found: ${id}`);
              }
              // Transform service result to match GraphQL Currency type
              const transformedCurrency = {
                id: currency.id,
                currencyCode: currency.currencyCode,
                currencyName: currency.currencyName,
                currencySymbol: currency.currencySymbol,
                decimalPlaces: currency.decimalPlaces,
                isBaseCurrency: currency.isBaseCurrency,
                isActive: currency.isActive,
                description: currency.notes, // Keep as is since both are optional
                createdAt: new Date(), // Add default value
                updatedAt: new Date(), // Add default value
                createdBy: '', // Add default value
                updatedBy: undefined, // This is optional in GraphQL type
                tenantId: currency.tenantId,
              } as unknown as Currency;
              return transformedCurrency;
            } catch (error) {
              return new Error(`Currency not found: ${id}`);
            }
          })
        );
        return currencies;
      },
      {
        cache: true,
        maxBatchSize: 100,
        cacheKeyFn: (key) => `currency:${tenantId}:${key}`,
      }
    );
  }

  createExchangeRateLoader(tenantId: string): DataLoader<string, any> {
    return new DataLoader<string, any>(
      async (currencyPairs: readonly string[]) => {
        // currencyPairs format: "fromCurrencyId:toCurrencyId"
        const results = await Promise.all(
          currencyPairs.map(async pair => {
            try {
              const [fromId, toId] = pair.split(':');
              if (!fromId || !toId) {
                return new Error(`Invalid currency pair format: ${pair}`);
              }
              const rate = await this.currencyService.getExchangeRate(tenantId, fromId, toId);
              return rate || new Error(`Exchange rate not found for pair: ${pair}`);
            } catch (error) {
              return new Error(`Exchange rate not found for pair: ${pair}`);
            }
          })
        );
        return results;
      },
      {
        cache: true,
        maxBatchSize: 100,
        cacheKeyFn: (key) => `exchangeRate:${tenantId}:${key}`,
      }
    );
  }

  // Batch operations for performance
  createBatchAccountUpdateLoader(tenantId: string): DataLoader<any, ChartOfAccount> {
    return new DataLoader<any, ChartOfAccount>(
      async (updates: readonly any[]) => {
        // Batch update multiple accounts
        const results = await Promise.all(
          updates.map(update =>
            this.chartOfAccountsService.updateAccount(tenantId, update.id, update.data, update.userId)
          )
        );
        return results;
      },
      {
        cache: false, // Don't cache mutations
        maxBatchSize: 20,
      }
    );
  }

  createBatchJournalEntryLineLoader(tenantId: string): DataLoader<string, any[]> {
    return new DataLoader<string, any[]>(
      async (entryIds: readonly string[]) => {
        // Batch load journal entry lines for multiple entries
        const results = await Promise.all(
          entryIds.map(async entryId => {
            try {
              return await this.journalEntryService.getJournalEntryLines(tenantId, entryId);
            } catch (error) {
              return [];
            }
          })
        );
        return results;
      },
      {
        cache: true,
        maxBatchSize: 50,
        cacheKeyFn: (key) => `journalEntryLines:${tenantId}:${key}`,
      }
    );
  }
}