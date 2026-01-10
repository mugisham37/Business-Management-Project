import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';

// Controllers
import { B2BOrderController } from './controllers/b2b-order.controller';
import { QuoteController } from './controllers/quote.controller';
import { ContractController } from './controllers/contract.controller';
import { TerritoryController } from './controllers/territory.controller';
import { CustomerPortalController } from './controllers/customer-portal.controller';

// Services
import { B2BOrderService } from './services/b2b-order.service';
import { QuoteService } from './services/quote.service';
import { ContractService } from './services/contract.service';
import { TerritoryService } from './services/territory.service';
import { CustomerPortalService } from './services/customer-portal.service';
import { B2BPricingService } from './services/b2b-pricing.service';
import { B2BWorkflowService } from './services/b2b-workflow.service';

// Repositories
import { B2BOrderRepository } from './repositories/b2b-order.repository';
import { QuoteRepository } from './repositories/quote.repository';
import { ContractRepository } from './repositories/contract.repository';
import { TerritoryRepository } from './repositories/territory.repository';

// Resolvers
import { B2BOrderResolver } from './resolvers/b2b-order.resolver';
import { QuoteResolver } from './resolvers/quote.resolver';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    EventEmitterModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [
    B2BOrderController,
    QuoteController,
    ContractController,
    TerritoryController,
    CustomerPortalController,
  ],
  providers: [
    // Services
    B2BOrderService,
    QuoteService,
    ContractService,
    TerritoryService,
    CustomerPortalService,
    B2BPricingService,
    B2BWorkflowService,
    
    // Repositories
    B2BOrderRepository,
    QuoteRepository,
    ContractRepository,
    TerritoryRepository,
    
    // Resolvers
    B2BOrderResolver,
    QuoteResolver,
  ],
  exports: [
    B2BOrderService,
    QuoteService,
    ContractService,
    TerritoryService,
    CustomerPortalService,
    B2BPricingService,
    B2BWorkflowService,
  ],
})
export class B2BModule {}