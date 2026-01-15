import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

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

import { BackupController } from './controllers/backup.controller';
import { BackupResolver } from './resolvers/backup.resolver';

import { BackupRepository } from './repositories/backup.repository';
import { BackupJobRepository } from './repositories/backup-job.repository';

import { BackupProcessor } from './processors/backup.processor';
import { BackupVerificationProcessor } from './processors/backup-verification.processor';

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
    BackupService,
    BackupSchedulerService,
    BackupVerificationService,
    BackupStorageService,
    PointInTimeRecoveryService,
    BackupEncryptionService,
    BackupRepository,
    BackupJobRepository,
    BackupProcessor,
    BackupVerificationProcessor,
  ],
  controllers: [BackupController],
  exports: [
    BackupService,
    BackupSchedulerService,
    PointInTimeRecoveryService,
    BackupVerificationService,
  ],
})
export class BackupModule {}