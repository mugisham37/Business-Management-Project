import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { SecurityModule } from '../security/security.module';
import { LoggerModule } from '../logger/logger.module';

import { BackupService } from './services/backup.service';
import { BackupSchedulerService } from './services/backup-scheduler.service';
import { BackupVerificationService } from './services/backup-verification.service';
import { BackupStorageService } from './services/backup-storage.service';
import { PointInTimeRecoveryService } from './services/point-in-time-recovery.service';
import { BackupEncryptionService } from './services/backup-encryption.service';

import { BackupResolver } from './resolvers/backup.resolver';

import { BackupRepository } from './repositories/backup.repository';
import { BackupJobRepository } from './repositories/backup-job.repository';

import { BackupProcessor } from './processors/backup.processor';
import { BackupVerificationProcessor } from './processors/backup-verification.processor';

import { BackupEventHandler } from './handlers/backup-event.handler';

import { BackupAccessGuard, BackupConcurrencyGuard, BackupQuotaGuard, BackupTimingGuard } from './guards/backup-access.guard';
import { BackupLoggingInterceptor, BackupMetricsInterceptor, BackupCacheInterceptor } from './interceptors/backup-logging.interceptor';
import { 
  BackupContextMiddleware, 
  BackupRateLimitMiddleware, 
  BackupSecurityMiddleware, 
  BackupValidationMiddleware,
  BackupAuditMiddleware,
  BackupPerformanceMiddleware
} from './middleware/backup-context.middleware';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: 'backup-queue',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
    BullModule.registerQueue({
      name: 'backup-verification-queue',
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
    DatabaseModule,
    CacheModule,
    SecurityModule,
    LoggerModule,
  ],
  providers: [
    // Core Services
    BackupService,
    BackupSchedulerService,
    BackupVerificationService,
    BackupStorageService,
    PointInTimeRecoveryService,
    BackupEncryptionService,
    
    // Repositories
    BackupRepository,
    BackupJobRepository,
    
    // Processors
    BackupProcessor,
    BackupVerificationProcessor,
    
    // Resolvers
    BackupResolver,
    
    // Event Handlers
    BackupEventHandler,
    
    // Global Guards
    {
      provide: APP_GUARD,
      useClass: BackupAccessGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BackupConcurrencyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BackupQuotaGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BackupTimingGuard,
    },
    
    // Global Interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: BackupLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: BackupMetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: BackupCacheInterceptor,
    },
  ],
  exports: [
    BackupService,
    BackupSchedulerService,
    PointInTimeRecoveryService,
    BackupVerificationService,
    BackupStorageService,
    BackupEncryptionService,
    BackupRepository,
    BackupJobRepository,
  ],
})
export class BackupModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        BackupContextMiddleware,
        BackupSecurityMiddleware,
        BackupRateLimitMiddleware,
        BackupValidationMiddleware,
        BackupAuditMiddleware,
        BackupPerformanceMiddleware,
      )
      .forRoutes('*'); // Apply to all routes, but middleware will filter backup-related requests
  }
}