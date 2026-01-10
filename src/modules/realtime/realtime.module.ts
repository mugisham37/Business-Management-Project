import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { RealtimeGateway } from './gateways/realtime.gateway';
import { RealtimeService } from './services/realtime.service';
import { ConnectionManagerService } from './services/connection-manager.service';
import { NotificationService } from './services/notification.service';
import { NotificationWebhookService } from './services/notification-webhook.service';
import { LiveInventoryService } from './services/live-inventory.service';
import { LiveSalesDashboardService } from './services/live-sales-dashboard.service';
import { LiveCustomerActivityService } from './services/live-customer-activity.service';
import { LiveAnalyticsService } from './services/live-analytics.service';
import { CommunicationIntegrationService } from '../communication/services/communication-integration.service';
import { SlackIntegrationService } from '../communication/services/slack-integration.service';
import { TeamsIntegrationService } from '../communication/services/teams-integration.service';
import { EmailNotificationService } from '../communication/services/email-notification.service';
import { SMSNotificationService } from '../communication/services/sms-notification.service';
import { RealtimeController } from './controllers/realtime.controller';
import { NotificationController } from './controllers/notification.controller';
import { LiveDataController } from './controllers/live-data.controller';
import { CommunicationIntegrationController } from './controllers/communication-integration.controller';
import { LiveDataResolver } from './resolvers/live-data.resolver';
import { CommunicationModule } from '../communication/communication.module';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { LoggerModule } from '../logger/logger.module';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    CommunicationModule,
    AuthModule,
    TenantModule,
    LoggerModule,
    DatabaseModule,
    QueueModule,
    CacheModule,
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
  controllers: [
    RealtimeController, 
    NotificationController, 
    LiveDataController,
    CommunicationIntegrationController,
  ],
  providers: [
    RealtimeGateway,
    RealtimeService,
    ConnectionManagerService,
    NotificationService,
    NotificationWebhookService,
    LiveInventoryService,
    LiveSalesDashboardService,
    LiveCustomerActivityService,
    LiveAnalyticsService,
    LiveDataResolver,
  ],
  exports: [
    RealtimeService,
    RealtimeGateway,
    ConnectionManagerService,
    NotificationService,
    NotificationWebhookService,
    LiveInventoryService,
    LiveSalesDashboardService,
    LiveCustomerActivityService,
    LiveAnalyticsService,
  ],
})
export class RealtimeModule {}