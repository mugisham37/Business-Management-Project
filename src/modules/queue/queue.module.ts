import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { EmailProcessor } from './processors/email.processor';
import { ReportProcessor } from './processors/report.processor';
import { SyncProcessor } from './processors/sync.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { CommunicationModule } from '../communication/communication.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    CommunicationModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        
        return {
          redis: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db,
          },
          defaultJobOptions: {
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: 50,      // Keep last 50 failed jobs
            attempts: 3,           // Retry failed jobs 3 times
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    
    // Register individual queues
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'reports' },
      { name: 'sync' },
      { name: 'notifications' },
    ),
  ],
  providers: [
    QueueService,
    EmailProcessor,
    ReportProcessor,
    SyncProcessor,
    NotificationProcessor,
  ],
  exports: [QueueService],
})
export class QueueModule {}