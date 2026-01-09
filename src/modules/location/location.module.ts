import { Module } from '@nestjs/common';
import { LocationController } from './controllers/location.controller';
import { LocationSyncController } from './controllers/location-sync.controller';
import { LocationPricingController } from './controllers/location-pricing.controller';
import { LocationPromotionController } from './controllers/location-promotion.controller';
import { LocationInventoryPolicyController } from './controllers/location-inventory-policy.controller';
import { LocationService } from './services/location.service';
import { LocationSyncService } from './services/location-sync.service';
import { LocationOfflineService } from './services/location-offline.service';
import { LocationPricingService } from './services/location-pricing.service';
import { LocationPromotionService } from './services/location-promotion.service';
import { LocationInventoryPolicyService } from './services/location-inventory-policy.service';
import { LocationRepository } from './repositories/location.repository';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    TenantModule,
  ],
  controllers: [
    LocationController,
    LocationSyncController,
    LocationPricingController,
    LocationPromotionController,
    LocationInventoryPolicyController,
  ],
  providers: [
    LocationService,
    LocationSyncService,
    LocationOfflineService,
    LocationPricingService,
    LocationPromotionService,
    LocationInventoryPolicyService,
    LocationRepository,
  ],
  exports: [
    LocationService,
    LocationSyncService,
    LocationOfflineService,
    LocationPricingService,
    LocationPromotionService,
    LocationInventoryPolicyService,
    LocationRepository,
  ],
})
export class LocationModule {}