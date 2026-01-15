import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CommunicationIntegrationService } from './services/communication-integration.service';
import { SlackIntegrationService } from './services/slack-integration.service';
import { TeamsIntegrationService } from './services/teams-integration.service';
import { EmailNotificationService } from './services/email-notification.service';
import { SMSNotificationService } from './services/sms-notification.service';
import { DatabaseModule } from '../database/database.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [
    DatabaseModule,
    LoggerModule,
    ConfigModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [
    CommunicationIntegrationService,
    SlackIntegrationService,
    TeamsIntegrationService,
    EmailNotificationService,
    SMSNotificationService,
  ],
  exports: [
    CommunicationIntegrationService,
    SlackIntegrationService,
    TeamsIntegrationService,
    EmailNotificationService,
    SMSNotificationService,
  ],
})
export class CommunicationModule {}