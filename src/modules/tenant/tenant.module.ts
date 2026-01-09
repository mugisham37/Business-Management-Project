import { Module } from '@nestjs/common';
import { TenantService } from './services/tenant.service';
import { TenantController } from './controllers/tenant.controller';
import { TenantResolver } from './resolvers/tenant.resolver';
import { TenantGuard } from './guards/tenant.guard';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { BusinessMetricsService } from './services/business-metrics.service';
import { DatabaseModule } from '../database/database.module';
import { CacheConfigModule } from '../cache/cache.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [DatabaseModule, CacheConfigModule, LoggerModule],
  controllers: [TenantController],
  providers: [
    TenantService,
    TenantResolver,
    TenantGuard,
    TenantInterceptor,
    BusinessMetricsService,
  ],
  exports: [
    TenantService,
    TenantGuard,
    TenantInterceptor,
    BusinessMetricsService,
  ],
})
export class TenantModule {}