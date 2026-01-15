import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

import { DatabaseModule } from '../database/database.module';
import { LoggerModule } from '../logger/logger.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { BackupModule } from '../backup/backup.module';

import { DisasterRecoveryService } from './services/disaster-recovery.service';
import { FailoverService } from './services/failover.service';
import { ReplicationService } from './services/replication.service';
import { RecoveryTimeOptimizationService } from './services/recovery-time-optimization.service';
import { DisasterRecoveryProceduresService } from './services/disaster-recovery-procedures.service';
import { BusinessContinuityService } from './services/business-continuity.service';
import { DataManagementService } from './services/data-management.service';

import { DisasterRecoveryController } from './controllers/disaster-recovery.controller';
import { DisasterRecoveryResolver } from './resolvers/disaster-recovery.resolver';

import { DisasterRecoveryRepository } from './repositories/disaster-recovery.repository';
import { FailoverRepository } from './repositories/failover.repository';
import { ReplicationRepository } from './repositories/replication.repository';

import { DisasterRecoveryProcessor } from './processors/disaster-recovery.processor';
import { FailoverProcessor } from './processors/failover.processor';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: 'disaster-recovery-queue',
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
    BullModule.registerQueue({
      name: 'failover-queue',
      defaultJobOptions: {
        removeOnComplete: 25,
        removeOnFail: 15,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
    DatabaseModule,
    LoggerModule,
    RealtimeModule,
    BackupModule,
  ],
  providers: [
    DisasterRecoveryService,
    FailoverService,
    ReplicationService,
    RecoveryTimeOptimizationService,
    DisasterRecoveryProceduresService,
    BusinessContinuityService,
    DataManagementService,
    DisasterRecoveryRepository,
    FailoverRepository,
    ReplicationRepository,
    DisasterRecoveryProcessor,
    FailoverProcessor,
  ],
  controllers: [DisasterRecoveryController],
  exports: [
    DisasterRecoveryService,
    FailoverService,
    ReplicationService,
    RecoveryTimeOptimizationService,
    BusinessContinuityService,
    DataManagementService,
  ],
})
export class DisasterRecoveryModule {}