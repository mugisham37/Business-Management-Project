import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { CommunicationIntegrationService } from '../../communication/services/communication-integration.service';
import { SlackIntegrationService } from '../../communication/services/slack-integration.service';
import { TeamsIntegrationService } from '../../communication/services/teams-integration.service';
import { EmailNotificationService } from '../../communication/services/email-notification.service';
import { SMSNotificationService } from '../../communication/services/sms-notification.service';
import {
  CreateSlackIntegrationDto,
  CreateTeamsIntegrationDto,
  CreateEmailProviderDto,
  CreateSMSProviderDto,
  SendMultiChannelNotificationDto,
  SendAlertDto,
  SendBusinessNotificationDto,
  ConfigureCommunicationChannelsDto,
} from '../dto/communication-integration.dto';

@Controller('api/v1/communication')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('communication-integrations')
@ApiTags('Communication Integrations')
export class CommunicationIntegrationController {
  constructor(
    private readonly communicationService: CommunicationIntegrationService,
    private readonly slackService: SlackIntegrationService,
    private readonly teamsService: TeamsIntegrationService,
    private readonly emailService: EmailNotificationService,
    private readonly smsService: SMSNotificationService,
  ) {}

  // Multi-channel notifications

  @Post('notifications/multi-channel')
  @RequirePermission('communication:send-notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send notification across multiple channels' })
  @ApiResponse({ status: 200, description: 'Notification sent successfully' })
  async sendMultiChannelNotification(
    @Body() dto: SendMultiChannelNotificationDto,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.communicationService.sendMultiChannelNotification(tenantId, dto);
  }

  @Post('alerts')
  @RequirePermission('communication:send-alerts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send alert across all configured channels' })
  @ApiResponse({ status: 200, description: 'Alert sent successfully' })
  async sendAlert(
    @Body() dto: SendAlertDto,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.communicationService.sendAlert(tenantId, dto);
  }

  @Post('notifications/business')
  @RequirePermission('communication:send-notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send business notification' })
  @ApiResponse({ status: 200, description: 'Business notification sent successfully' })
  async sendBusinessNotification(
    @Body() dto: SendBusinessNotificationDto,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.communicationService.sendBusinessNotification(tenantId, dto);
  }

  // Channel configuration

  @Put('channels')
  @RequirePermission('communication:configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Configure communication channels' })
  @ApiResponse({ status: 200, description: 'Channels configured successfully' })
  async configureChannels(
    @Body() dto: ConfigureCommunicationChannelsDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.communicationService.configureChannels(tenantId, dto.channels, user.id);
    return { success: true, message: 'Communication channels configured successfully' };
  }

  @Get('channels/test')
  @RequirePermission('communication:configure')
  @ApiOperation({ summary: 'Test all configured communication channels' })
  @ApiResponse({ status: 200, description: 'Channel test results' })
  async testAllChannels(@CurrentTenant() tenantId: string) {
    const results = await this.communicationService.testAllChannels(tenantId);
    return { results };
  }

  // Slack integration

  @Post('slack/configure')
  @RequirePermission('communication:configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Configure Slack integration' })
  @ApiResponse({ status: 200, description: 'Slack integration configured successfully' })
  async configureSlack(
    @Body() dto: CreateSlackIntegrationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.slackService.configureIntegration(tenantId, dto, user.id);
    return { success: true, message: 'Slack integration configured successfully' };
  }

  @Post('slack/test')
  @RequirePermission('communication:configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test Slack configuration' })
  @ApiResponse({ status: 200, description: 'Slack test result' })
  async testSlack(
    @Body() dto: CreateSlackIntegrationDto,
  ) {
    const result = await this.slackService.testConfiguration(dto);
    return result;
  }

  @Post('slack/send')
  @RequirePermission('communication:send-notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send Slack notification' })
  @ApiResponse({ status: 200, description: 'Slack notification sent successfully' })
  async sendSlackNotification(
    @Body() dto: {
      title: string;
      message: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      type: string;
      channel?: string;
      metadata?: Record<string, any>;
      actions?: Array<{
        id: string;
        label: string;
        url?: string;
        style?: 'primary' | 'secondary' | 'danger';
      }>;
    },
    @CurrentTenant() tenantId: string,
  ) {
    return await this.slackService.sendNotification(tenantId, dto);
  }

  // Teams integration

  @Post('teams/configure')
  @RequirePermission('communication:configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Configure Microsoft Teams integration' })
  @ApiResponse({ status: 200, description: 'Teams integration configured successfully' })
  async configureTeams(
    @Body() dto: CreateTeamsIntegrationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.teamsService.configureIntegration(tenantId, dto, user.id);
    return { success: true, message: 'Teams integration configured successfully' };
  }

  @Post('teams/test')
  @RequirePermission('communication:configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test Teams configuration' })
  @ApiResponse({ status: 200, description: 'Teams test result' })
  async testTeams(
    @Body() dto: CreateTeamsIntegrationDto,
  ) {
    const result = await this.teamsService.testConfiguration(dto);
    return result;
  }

  @Post('teams/send')
  @RequirePermission('communication:send-notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send Teams notification' })
  @ApiResponse({ status: 200, description: 'Teams notification sent successfully' })
  async sendTeamsNotification(
    @Body() dto: {
      title: string;
      message: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      type: string;
      metadata?: Record<string, any>;
      actions?: Array<{
        id: string;
        label: string;
        url?: string;
        style?: 'primary' | 'secondary' | 'danger';
      }>;
    },
    @CurrentTenant() tenantId: string,
  ) {
    return await this.teamsService.sendNotification(tenantId, dto);
  }

  // Email integration

  @Post('email/configure')
  @RequirePermission('communication:configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Configure email provider' })
  @ApiResponse({ status: 200, description: 'Email provider configured successfully' })
  async configureEmailProvider(
    @Body() dto: CreateEmailProviderDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.emailService.configureProvider(tenantId, dto, user.id);
    return { success: true, message: 'Email provider configured successfully' };
  }

  @Post('email/send')
  @RequirePermission('communication:send-notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send email notification to users' })
  @ApiResponse({ status: 200, description: 'Email notification sent successfully' })
  async sendEmailNotification(
    @Body() dto: {
      userIds: string[];
      subject: string;
      message: string;
      htmlContent?: string;
      priority?: 'high' | 'normal' | 'low';
      templateName?: string;
      templateVariables?: Record<string, any>;
    },
    @CurrentTenant() tenantId: string,
  ) {
    // Filter out undefined values to comply with exactOptionalPropertyTypes
    const notification: {
      subject: string;
      message: string;
      htmlContent?: string;
      priority?: 'high' | 'normal' | 'low';
      templateName?: string;
      templateVariables?: Record<string, any>;
    } = {
      subject: dto.subject,
      message: dto.message,
    };
    
    if (dto.htmlContent !== undefined) notification.htmlContent = dto.htmlContent;
    if (dto.priority !== undefined) notification.priority = dto.priority;
    if (dto.templateName !== undefined) notification.templateName = dto.templateName;
    if (dto.templateVariables !== undefined) notification.templateVariables = dto.templateVariables;

    return await this.emailService.sendNotificationToUsers(tenantId, dto.userIds, notification);
  }

  @Post('email/templates')
  @RequirePermission('communication:configure')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create email template' })
  @ApiResponse({ status: 201, description: 'Email template created successfully' })
  async createEmailTemplate(
    @Body() dto: {
      name: string;
      subject: string;
      htmlTemplate: string;
      textTemplate?: string;
      variables: string[];
      category?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.emailService.createTemplate(tenantId, dto, user.id);
    return { success: true, message: 'Email template created successfully' };
  }

  // SMS integration

  @Post('sms/configure')
  @RequirePermission('communication:configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Configure SMS provider' })
  @ApiResponse({ status: 200, description: 'SMS provider configured successfully' })
  async configureSMSProvider(
    @Body() dto: CreateSMSProviderDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.smsService.configureProvider(tenantId, dto, user.id);
    return { success: true, message: 'SMS provider configured successfully' };
  }

  @Post('sms/send')
  @RequirePermission('communication:send-notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send SMS notification to users' })
  @ApiResponse({ status: 200, description: 'SMS notification sent successfully' })
  async sendSMSNotification(
    @Body() dto: {
      userIds?: string[];
      phoneNumbers?: string[];
      message: string;
      priority?: 'high' | 'normal' | 'low';
      templateName?: string;
      templateVariables?: Record<string, any>;
      scheduledAt?: Date;
    },
    @CurrentTenant() tenantId: string,
  ) {
    if (dto.userIds && dto.userIds.length > 0) {
      // Filter out undefined values to comply with exactOptionalPropertyTypes
      const notification: {
        message: string;
        priority?: 'high' | 'normal' | 'low';
        templateName?: string;
        templateVariables?: Record<string, any>;
        scheduledAt?: Date;
      } = {
        message: dto.message,
      };
      
      if (dto.priority !== undefined) notification.priority = dto.priority;
      if (dto.templateName !== undefined) notification.templateName = dto.templateName;
      if (dto.templateVariables !== undefined) notification.templateVariables = dto.templateVariables;
      if (dto.scheduledAt !== undefined) notification.scheduledAt = dto.scheduledAt;

      return await this.smsService.sendNotificationToUsers(tenantId, dto.userIds, notification);
    } else if (dto.phoneNumbers && dto.phoneNumbers.length > 0) {
      // Filter out undefined values to comply with exactOptionalPropertyTypes
      const smsMessage: {
        to: string[];
        message: string;
        priority?: 'high' | 'normal' | 'low';
        scheduledAt?: Date;
      } = {
        to: dto.phoneNumbers,
        message: dto.message,
      };
      
      if (dto.priority !== undefined) smsMessage.priority = dto.priority;
      if (dto.scheduledAt !== undefined) smsMessage.scheduledAt = dto.scheduledAt;

      return await this.smsService.sendSMS(tenantId, smsMessage);
    } else {
      throw new Error('Either userIds or phoneNumbers must be provided');
    }
  }

  @Post('sms/otp')
  @RequirePermission('communication:send-notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP SMS' })
  @ApiResponse({ status: 200, description: 'OTP SMS sent successfully' })
  async sendOTP(
    @Body() dto: {
      phoneNumber: string;
      otp: string;
      validityMinutes?: number;
      brandName?: string;
    },
    @CurrentTenant() tenantId: string,
  ) {
    // Filter out undefined values to comply with exactOptionalPropertyTypes
    const options: {
      provider?: string;
      validityMinutes?: number;
      brandName?: string;
    } = {};
    
    if (dto.validityMinutes !== undefined) options.validityMinutes = dto.validityMinutes;
    if (dto.brandName !== undefined) options.brandName = dto.brandName;

    return await this.smsService.sendOTP(tenantId, dto.phoneNumber, dto.otp, options);
  }

  @Post('sms/templates')
  @RequirePermission('communication:configure')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create SMS template' })
  @ApiResponse({ status: 201, description: 'SMS template created successfully' })
  async createSMSTemplate(
    @Body() dto: {
      name: string;
      message: string;
      variables: string[];
      category?: string;
      maxLength?: number;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.smsService.createTemplate(tenantId, dto, user.id);
    return { success: true, message: 'SMS template created successfully' };
  }
}