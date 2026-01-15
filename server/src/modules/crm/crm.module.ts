import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { QueueModule } from '../queue/queue.module';

// Controllers
import { CustomerController } from './controllers/customer.controller';
import { LoyaltyController } from './controllers/loyalty.controller';
import { SegmentationController } from './controllers/segmentation.controller';
import { CommunicationController } from './controllers/communication.controller';
import { CustomerAnalyticsController } from './controllers/customer-analytics.controller';
import { B2BCustomerController } from './controllers/b2b-customer.controller';

// Services
import { CustomerService } from './services/customer.service';
import { LoyaltyService } from './services/loyalty.service';
import { SegmentationService } from './services/segmentation.service';
import { CommunicationService } from './services/communication.service';
import { CustomerAnalyticsService } from './services/customer-analytics.service';
import { CampaignService } from './services/campaign.service';
import { B2BCustomerService } from './services/b2b-customer.service';

// Repositories
import { CustomerRepository } from './repositories/customer.repository';
import { LoyaltyRepository } from './repositories/loyalty.repository';
import { SegmentationRepository } from './repositories/segmentation.repository';
import { CommunicationRepository } from './repositories/communication.repository';

// Resolvers (GraphQL)
import { CustomerResolver } from './resolvers/customer.resolver';
import { LoyaltyResolver } from './resolvers/loyalty.resolver';

// Event Handlers
import { CustomerEventHandler } from './handlers/customer-event.handler';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    QueueModule,
  ],
  controllers: [
    CustomerController,
    LoyaltyController,
    SegmentationController,
    CommunicationController,
    CustomerAnalyticsController,
    B2BCustomerController,
  ],
  providers: [
    // Services
    CustomerService,
    LoyaltyService,
    SegmentationService,
    CommunicationService,
    CustomerAnalyticsService,
    CampaignService,
    B2BCustomerService,
    
    // Repositories
    CustomerRepository,
    LoyaltyRepository,
    SegmentationRepository,
    CommunicationRepository,
    
    // GraphQL Resolvers
    CustomerResolver,
    LoyaltyResolver,
    
    // Event Handlers
    CustomerEventHandler,
  ],
  exports: [
    CustomerService,
    LoyaltyService,
    SegmentationService,
    CommunicationService,
    CustomerAnalyticsService,
    CampaignService,
    B2BCustomerService,
  ],
})
export class CrmModule {}