import { Module } from '@nestjs/common';
import { LocationController } from './controllers/location.controller';
import { LocationSyncController } from './controllers/location-sync.controller';
import { LocationPricingController } from './controllers/location-pricing.controller';
import { LocationPromotionController } from './controllers/location-promotion.controller';
import { LocationInventoryPolicyController } from './controllers/location-inventory-policy.controller';
import { LocationReportingController } from './controllers/location-reporting.controller';
import { FranchiseController } from './controllers/franchise.controller';
import { TerritoryController } from './controllers/territory.controller';
import { DealerPortalController } from './controllers/dealer-portal.controller';
import { LocationService } from './services/location.service';
import { LocationSyncService } from './services/location-sync.service';
import { LocationOfflineService } from './services/location-offline.service';
import { LocationPricingService } from './services/location-pricing.service';
import { LocationPromotionService } from './services/location-promotion.service';
import { LocationInventoryPolicyService } from './services/location-inventory-policy.service';
import { LocationReportingService } from './services/location-reporting.service';
import { FranchiseService } from './services/franchise.service';
import { LocationRepository } from './repositories/location.repository';
import { FranchiseRepository } from './repositories/franchise.repository';
import { LocationResolver } from './resolvers/location.resolver';
import { DealerPortalResolver } from './resolvers/dealer-portal.resolver';
import { FranchiseResolver } from './resolvers/franchise.resolver';
import { LocationInventoryPolicyResolver } from './resolvers/location-inventory-policy.resolver';
import { LocationPricingResolver } from './resolvers/location-pricing.resolver';
import { LocationPromotionResolver } from './resolvers/location-promotion.resolver';
import { LocationReportingResolver } from './resolvers/location-reporting.resolver';
import { LocationSyncResolver } from './resolvers/location-sync.resolver';
import { TerritoryResolver } from './resolvers/territory.resolver';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { FinancialModule } from '../financial/financial.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CrmModule } from '../crm/crm.module';
import { SupplierModule } from '../supplier/supplier.module';
import { POSModule } from '../pos/pos.module';
import { GraphQLCommonModule } from '../../common/graphql/graphql-common.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    TenantModule,
    FinancialModule,
    InventoryModule,
    CrmModule,
    SupplierModule,
    POSModule,
    GraphQLCommonModule,
  ],
  controllers: [
    LocationController,
    LocationSyncController,
    LocationPricingController,
    LocationPromotionController,
    LocationInventoryPolicyController,
    LocationReportingController,
    FranchiseController,
    TerritoryController,
    DealerPortalController,
  ],
  providers: [
    LocationService,
    LocationSyncService,
    LocationOfflineService,
    LocationPricingService,
    LocationPromotionService,
    LocationInventoryPolicyService,
    LocationReportingService,
    FranchiseService,
    LocationRepository,
    FranchiseRepository,
    // GraphQL Resolvers
    LocationResolver,
    DealerPortalResolver,
    FranchiseResolver,
    LocationInventoryPolicyResolver,
    LocationPricingResolver,
    LocationPromotionResolver,
    LocationReportingResolver,
    LocationSyncResolver,
    TerritoryResolver,
  ],
  exports: [
    LocationService,
    LocationSyncService,
    LocationOfflineService,
    LocationPricingService,
    LocationPromotionService,
    LocationInventoryPolicyService,
    LocationReportingService,
    FranchiseService,
    LocationRepository,
    FranchiseRepository,
  ],
})
export class LocationModule {}