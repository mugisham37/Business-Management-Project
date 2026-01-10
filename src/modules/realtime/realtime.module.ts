import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { RealtimeGateway } from './gateways/realtime.gateway';
import { RealtimeService } from './services/realtime.service';
import { ConnectionManagerService } from './services/connection-manager.service';
import { NotificationService } from './services/notification.service';
import { NotificationWebhookService } from './services/notification-webhook.service';
import { RealtimeController } from './controllers/realtime.controller';
import { NotificationController } from './controllers/notification.controller';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { LoggerModule } from '../logger/logger.module';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    AuthModule,
    TenantModule,
    LoggerModule,
    DatabaseModule,
    QueueModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'fallback-secret',
        signOptions: {
          expiresIn: '15m',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [RealtimeController, NotificationController],
  providers: [
    RealtimeGateway,
    RealtimeService,
    ConnectionManagerService,
    NotificationService,
    NotificationWebhookService,
  ],
  exports: [
    RealtimeService,
    RealtimeGateway,
    ConnectionManagerService,
    NotificationService,
    NotificationWebhookService,
  ],
})
export class RealtimeModule {}