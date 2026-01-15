import { Module } from '@nestjs/common';
import { TenantService } from './services/tenant.service';
import { TenantController } from './controllers/tenant.controller';
import { TenantResolver } from './resolvers/tenant.resolver';
import { TenantGuard } from './guards/tenant.guard';
import { FeatureGuard } from './guards/feature.guard';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { BusinessMetricsService } from './services/business-metrics.service';
import { FeatureFlagService } from './services/feature-flag.service';
import { TenantMetricsTrackingService } from './services/tenant-metrics-tracking.service';
import { FeatureFlagController } from './controllers/feature-flag.controller';
import { TenantMetricsController } from './controllers/tenant-metrics.controller';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [DatabaseModule, CacheModule, LoggerModule],
  controllers: [TenantController, FeatureFlagController, TenantMetricsController],
  providers: [
    TenantService,
    TenantResolver,
    TenantGuard,
    FeatureGuard,
    TenantInterceptor,
    BusinessMetricsService,
    FeatureFlagService,
    TenantMetricsTrackingService,
  ],
  exports: [
    TenantService,
    TenantGuard,
    FeatureGuard,
    TenantInterceptor,
    BusinessMetricsService,
    FeatureFlagService,
    TenantMetricsTrackingService,
  ],
})
export class TenantModule {}