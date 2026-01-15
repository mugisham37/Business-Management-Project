import { Module } from '@nestjs/common';
import { MobileApiController } from './controllers/mobile-api.controller';
import { MobileOptimizationService } from './services/mobile-optimization.service';
import { PayloadCompressionService } from './services/payload-compression.service';
import { ProgressiveLoadingService } from './services/progressive-loading.service';
import { OfflineDataSyncService } from './services/offline-data-sync.service';
import { PushNotificationService } from './services/push-notification.service';
import { BiometricAuthService } from './services/biometric-auth.service';
import { LocationBasedService } from './services/location-based.service';
import { CameraIntegrationService } from './services/camera-integration.service';
import { BatteryOptimizationService } from './services/battery-optimization.service';
import { DataUsageOptimizationService } from './services/data-usage-optimization.service';
import { IntelligentSyncSchedulerService } from './services/intelligent-sync-scheduler.service';
import { MobileApiInterceptor } from './interceptors/mobile-api.interceptor';
import { CompressionInterceptor } from './interceptors/compression.interceptor';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [CacheModule, DatabaseModule, QueueModule],
  controllers: [MobileApiController],
  providers: [
    MobileOptimizationService,
    PayloadCompressionService,
    ProgressiveLoadingService,
    OfflineDataSyncService,
    PushNotificationService,
    BiometricAuthService,
    LocationBasedService,
    CameraIntegrationService,
    BatteryOptimizationService,
    DataUsageOptimizationService,
    IntelligentSyncSchedulerService,
    MobileApiInterceptor,
    CompressionInterceptor,
  ],
  exports: [
    MobileOptimizationService,
    PayloadCompressionService,
    ProgressiveLoadingService,
    OfflineDataSyncService,
    PushNotificationService,
    BiometricAuthService,
    LocationBasedService,
    CameraIntegrationService,
    BatteryOptimizationService,
    DataUsageOptimizationService,
    IntelligentSyncSchedulerService,
  ],
})
export class MobileModule {}