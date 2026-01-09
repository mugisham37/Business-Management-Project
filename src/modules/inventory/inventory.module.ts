import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheConfigModule } from '../cache/cache.module';
import { QueueModule } from '../queue/queue.module';
import { TenantModule } from '../tenant/tenant.module';

// Controllers
import { ProductController } from './controllers/product.controller';
import { CategoryController } from './controllers/category.controller';
import { BrandController } from './controllers/brand.controller';
import { InventoryController } from './controllers/inventory.controller';
import { ReorderController } from './controllers/reorder.controller';
import { BatchTrackingController } from './controllers/batch-tracking.controller';
import { CycleCountingController } from './controllers/cycle-counting.controller';
import { InventoryReportingController } from './controllers/inventory-reporting.controller';

// Services
import { ProductService } from './services/product.service';
import { ProductCategoryService } from './services/product-category.service';
import { ProductBrandService } from './services/product-brand.service';
import { InventoryService } from './services/inventory.service';
import { ReorderService } from './services/reorder.service';
import { BatchTrackingService } from './services/batch-tracking.service';
import { CycleCountingService } from './services/cycle-counting.service';
import { InventoryValuationService } from './services/inventory-valuation.service';
import { InventoryReportingService } from './services/inventory-reporting.service';

// Repositories
import { ProductRepository } from './repositories/product.repository';
import { ProductCategoryRepository } from './repositories/product-category.repository';
import { ProductBrandRepository } from './repositories/product-brand.repository';
import { InventoryRepository } from './repositories/inventory.repository';
import { InventoryMovementRepository } from './repositories/inventory-movement.repository';
import { BatchTrackingRepository } from './repositories/batch-tracking.repository';
import { CycleCountingRepository } from './repositories/cycle-counting.repository';

// Resolvers (GraphQL)
import { ProductResolver } from './resolvers/product.resolver';

// Event handlers
// import { InventoryEventHandler } from './handlers/inventory-event.handler';

@Module({
  imports: [
    DatabaseModule,
    CacheConfigModule,
    QueueModule,
    TenantModule,
  ],
  controllers: [
    ProductController,
    CategoryController,
    BrandController,
    InventoryController,
    ReorderController,
    BatchTrackingController,
    CycleCountingController,
    InventoryReportingController,
  ],
  providers: [
    // Core services
    ProductService,
    ProductCategoryService,
    ProductBrandService,
    InventoryService,
    ReorderService,
    
    // Advanced inventory services
    BatchTrackingService,
    CycleCountingService,
    InventoryValuationService,
    InventoryReportingService,
    
    // Repositories
    ProductRepository,
    ProductCategoryRepository,
    ProductBrandRepository,
    InventoryRepository,
    InventoryMovementRepository,
    BatchTrackingRepository,
    CycleCountingRepository,
    
    // GraphQL Resolvers
    ProductResolver,
    
    // Event handlers
    // InventoryEventHandler,
  ],
  exports: [
    ProductService,
    ProductCategoryService,
    ProductBrandService,
    InventoryService,
    ReorderService,
    BatchTrackingService,
    CycleCountingService,
    InventoryValuationService,
    InventoryReportingService,
  ],
})
export class InventoryModule {}