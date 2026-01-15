import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { QueueModule } from '../queue/queue.module';
import { TenantModule } from '../tenant/tenant.module';

// Controllers
import { WarehouseController } from './controllers/warehouse.controller';
import { WarehouseZoneController } from './controllers/warehouse-zone.controller';
import { BinLocationController } from './controllers/bin-location.controller';
import { PickingWaveController } from './controllers/picking-wave.controller';
import { PickListController } from './controllers/pick-list.controller';
import { ShippingIntegrationController } from './controllers/shipping-integration.controller';
import { LotTrackingController } from './controllers/lot-tracking.controller';
import { KittingAssemblyController } from './controllers/kitting-assembly.controller';

// Services
import { WarehouseService } from './services/warehouse.service';
import { WarehouseZoneService } from './services/warehouse-zone.service';
import { BinLocationService } from './services/bin-location.service';
import { PickingWaveService } from './services/picking-wave.service';
import { PickListService } from './services/pick-list.service';
import { ShippingIntegrationService } from './services/shipping-integration.service';
import { LotTrackingService } from './services/lot-tracking.service';
import { KittingAssemblyService } from './services/kitting-assembly.service';

// Repositories
import { WarehouseRepository } from './repositories/warehouse.repository';
import { WarehouseZoneRepository } from './repositories/warehouse-zone.repository';
import { BinLocationRepository } from './repositories/bin-location.repository';
import { PickingWaveRepository } from './repositories/picking-wave.repository';
import { PickListRepository } from './repositories/pick-list.repository';

// Event handlers (to be implemented in future tasks)
// import { WarehouseEventHandler } from './handlers/warehouse-event.handler';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    QueueModule,
    TenantModule,
  ],
  controllers: [
    WarehouseController,
    WarehouseZoneController,
    BinLocationController,
    PickingWaveController,
    PickListController,
    ShippingIntegrationController,
    LotTrackingController,
    KittingAssemblyController,
  ],
  providers: [
    // Core services
    WarehouseService,
    WarehouseZoneService,
    BinLocationService,
    PickingWaveService,
    PickListService,
    ShippingIntegrationService,
    LotTrackingService,
    KittingAssemblyService,
    
    // Repositories
    WarehouseRepository,
    WarehouseZoneRepository,
    BinLocationRepository,
    PickingWaveRepository,
    PickListRepository,
    
    // Event handlers (to be implemented)
    // WarehouseEventHandler,
  ],
  exports: [
    WarehouseService,
    WarehouseZoneService,
    BinLocationService,
    PickingWaveService,
    PickListService,
    ShippingIntegrationService,
    LotTrackingService,
    KittingAssemblyService,
    WarehouseRepository,
    WarehouseZoneRepository,
    BinLocationRepository,
    PickingWaveRepository,
    PickListRepository,
  ],
})
export class WarehouseModule {}