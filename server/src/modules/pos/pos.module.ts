import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { QueueModule } from '../queue/queue.module';
import { TenantModule } from '../tenant/tenant.module';
import { GraphQLCommonModule } from '../../common/graphql/graphql-common.module';

// Resolvers
import { POSResolver } from './resolvers/pos.resolver';
import { TransactionResolver } from './resolvers/transaction.resolver';
import { OfflineResolver } from './resolvers/offline.resolver';
import { PaymentResolver } from './resolvers/payment.resolver';
import { ReceiptResolver } from './resolvers/receipt.resolver';

// Services
import { POSService } from './services/pos.service';
import { TransactionService } from './services/transaction.service';
import { PaymentService } from './services/payment.service';
import { ReceiptService } from './services/receipt.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { TransactionValidationService } from './services/transaction-validation.service';
import { PaymentReconciliationService } from './services/payment-reconciliation.service';
import { EmailReceiptService } from './services/email-receipt.service';
import { SmsReceiptService } from './services/sms-receipt.service';
import { PrintReceiptService } from './services/print-receipt.service';
import { OfflineStorageService } from './services/offline-storage.service';

// Repositories
import { TransactionRepository } from './repositories/transaction.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { OfflineQueueRepository } from './repositories/offline-queue.repository';

// Event handlers
import { TransactionEventHandler } from './handlers/transaction-event.handler';

// Payment providers
import { StripePaymentProvider } from './providers/stripe-payment.provider';
import { CashPaymentProvider } from './providers/cash-payment.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    QueueModule,
    TenantModule,
    GraphQLCommonModule,
  ],
  providers: [
    // GraphQL Resolvers
    POSResolver,
    TransactionResolver,
    OfflineResolver,
    PaymentResolver,
    ReceiptResolver,
    
    // Core services
    POSService,
    TransactionService,
    PaymentService,
    ReceiptService,
    OfflineSyncService,
    TransactionValidationService,
    PaymentReconciliationService,
    EmailReceiptService,
    SmsReceiptService,
    PrintReceiptService,
    OfflineStorageService,
    
    // Repositories
    TransactionRepository,
    PaymentRepository,
    OfflineQueueRepository,
    
    // Event handlers
    TransactionEventHandler,
    
    // Payment providers
    StripePaymentProvider,
    CashPaymentProvider,
    MobileMoneyProvider,
  ],
  exports: [
    POSService,
    TransactionService,
    PaymentService,
    ReceiptService,
  ],
})
export class POSModule {}