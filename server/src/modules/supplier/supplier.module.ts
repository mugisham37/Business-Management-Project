import { Module } from '@nestjs/common';
import { SupplierController } from './controllers/supplier.controller';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { ProcurementAnalyticsController } from './controllers/procurement-analytics.controller';
import { EDIIntegrationController } from './controllers/edi-integration.controller';
import { SupplierService } from './services/supplier.service';
import { PurchaseOrderService } from './services/purchase-order.service';
import { ProcurementAnalyticsService } from './services/procurement-analytics.service';
import { EDIIntegrationService } from './services/edi-integration.service';
import { SupplierRepository } from './repositories/supplier.repository';
import { SupplierContactRepository } from './repositories/supplier-contact.repository';
import { SupplierCommunicationRepository } from './repositories/supplier-communication.repository';
import { SupplierEvaluationRepository } from './repositories/supplier-evaluation.repository';
import { PurchaseOrderRepository } from './repositories/purchase-order.repository';
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
    SupplierController,
    PurchaseOrderController,
    ProcurementAnalyticsController,
    EDIIntegrationController,
  ],
  providers: [
    SupplierService,
    PurchaseOrderService,
    ProcurementAnalyticsService,
    EDIIntegrationService,
    SupplierRepository,
    SupplierContactRepository,
    SupplierCommunicationRepository,
    SupplierEvaluationRepository,
    PurchaseOrderRepository,
  ],
  exports: [
    SupplierService,
    PurchaseOrderService,
    ProcurementAnalyticsService,
    EDIIntegrationService,
    SupplierRepository,
    SupplierContactRepository,
    SupplierCommunicationRepository,
    SupplierEvaluationRepository,
    PurchaseOrderRepository,
  ],
})
export class SupplierModule {}