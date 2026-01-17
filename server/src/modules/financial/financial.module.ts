import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { QueueModule } from '../queue/queue.module';

// GraphQL Types and Scalars
import { DecimalScalar } from './graphql/scalars';

// DataLoaders
import { FinancialDataLoaders } from './dataloaders/financial.dataloaders';

// Services
import { AccountingService } from './services/accounting.service';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';
import { JournalEntryService } from './services/journal-entry.service';
import { FinancialReportingService } from './services/financial-reporting.service';
import { ReconciliationService } from './services/reconciliation.service';
import { BudgetService } from './services/budget.service';
import { FiscalPeriodService } from './services/fiscal-period.service';
import { TransactionPostingService } from './services/transaction-posting.service';
import { TaxService } from './services/tax.service';
import { AccountsReceivablePayableService } from './services/accounts-receivable-payable.service';
import { MultiCurrencyService } from './services/multi-currency.service';

// Repositories
import { ChartOfAccountsRepository } from './repositories/chart-of-accounts.repository';
import { JournalEntryRepository } from './repositories/journal-entry.repository';
import { AccountBalanceRepository } from './repositories/account-balance.repository';
import { BudgetRepository } from './repositories/budget.repository';
import { FiscalPeriodRepository } from './repositories/fiscal-period.repository';
import { ReconciliationRepository } from './repositories/reconciliation.repository';

// Resolvers
import { AccountingResolver } from './resolvers/accounting.resolver';
import { ChartOfAccountsResolver } from './resolvers/chart-of-accounts.resolver';
import { AccountsReceivablePayableResolver } from './resolvers/accounts-receivable-payable.resolver';
import { BudgetResolver } from './resolvers/budget.resolver';
import { JournalEntryResolver } from './resolvers/journal-entry.resolver';
import { MultiCurrencyResolver } from './resolvers/multi-currency.resolver';
import { ReconciliationResolver } from './resolvers/reconciliation.resolver';
import { TaxResolver } from './resolvers/tax.resolver';
import { FinancialReportingResolver } from './resolvers/financial-reporting.resolver';
import { FiscalPeriodResolver } from './resolvers/fiscal-period.resolver';
import { ARAPResolver } from './resolvers/arap.resolver';
import { CurrencyResolver } from './resolvers/currency.resolver';
import { FinancialSubscriptionsResolver } from './resolvers/financial-subscriptions.resolver';
import { BatchOperationsResolver } from './resolvers/batch-operations.resolver';

// Event Handlers
import { TransactionPostedHandler } from './handlers/transaction-posted.handler';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    QueueModule,
  ],
  providers: [
    // GraphQL Scalars
    DecimalScalar,
    
    // DataLoaders
    FinancialDataLoaders,
    
    // Services
    AccountingService,
    ChartOfAccountsService,
    JournalEntryService,
    FinancialReportingService,
    ReconciliationService,
    BudgetService,
    FiscalPeriodService,
    TransactionPostingService,
    TaxService,
    AccountsReceivablePayableService,
    MultiCurrencyService,
    
    // Repositories
    ChartOfAccountsRepository,
    JournalEntryRepository,
    AccountBalanceRepository,
    BudgetRepository,
    FiscalPeriodRepository,
    ReconciliationRepository,
    
    // Resolvers
    AccountingResolver,
    ChartOfAccountsResolver,
    AccountsReceivablePayableResolver,
    BudgetResolver,
    JournalEntryResolver,
    MultiCurrencyResolver,
    ReconciliationResolver,
    TaxResolver,
    FinancialReportingResolver,
    FiscalPeriodResolver,
    ARAPResolver,
    CurrencyResolver,
    FinancialSubscriptionsResolver,
    BatchOperationsResolver,
    
    // Event Handlers
    TransactionPostedHandler,
  ],
  exports: [
    // Export all services for use by other modules
    AccountingService,
    ChartOfAccountsService,
    JournalEntryService,
    FinancialReportingService,
    ReconciliationService,
    BudgetService,
    FiscalPeriodService,
    TransactionPostingService,
    TaxService,
    AccountsReceivablePayableService,
    MultiCurrencyService,
    
    // Export DataLoaders for use by other modules
    FinancialDataLoaders,
  ],
})
export class FinancialModule {}