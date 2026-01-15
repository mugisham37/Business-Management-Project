import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { QueueModule } from '../queue/queue.module';

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

// Controllers
import { AccountingController } from './controllers/accounting.controller';
import { ChartOfAccountsController } from './controllers/chart-of-accounts.controller';
import { FinancialReportingController } from './controllers/financial-reporting.controller';
import { JournalEntryController } from './controllers/journal-entry.controller';
import { BudgetController } from './controllers/budget.controller';
import { ReconciliationController } from './controllers/reconciliation.controller';
import { TaxController } from './controllers/tax.controller';
import { AccountsReceivablePayableController } from './controllers/accounts-receivable-payable.controller';
import { MultiCurrencyController } from './controllers/multi-currency.controller';

// Resolvers
import { AccountingResolver } from './resolvers/accounting.resolver';
import { ChartOfAccountsResolver } from './resolvers/chart-of-accounts.resolver';

// Event Handlers
import { TransactionPostedHandler } from './handlers/transaction-posted.handler';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    QueueModule,
  ],
  providers: [
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
    
    // Event Handlers
    TransactionPostedHandler,
  ],
  controllers: [
    AccountingController,
    ChartOfAccountsController,
    FinancialReportingController,
    JournalEntryController,
    BudgetController,
    ReconciliationController,
    TaxController,
    AccountsReceivablePayableController,
    MultiCurrencyController,
  ],
  exports: [
    AccountingService,
    ChartOfAccountsService,
    JournalEntryService,
    FinancialReportingService,
    TransactionPostingService,
    TaxService,
    AccountsReceivablePayableService,
    MultiCurrencyService,
  ],
})
export class FinancialModule {}