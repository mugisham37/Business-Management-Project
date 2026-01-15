import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
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
import { NotificationService } from '../services/notification.service';
import {
  CreateNotificationDto,
  CreateTemplateDto,
  UpdatePreferencesDto,
  RegisterDeviceTokenDto,
  NotificationHistoryQueryDto,
  NotificationStatsQueryDto,
} from '../dto/notification.dto';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('notifications')
@ApiTags('Notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Send notification to users
   */
  @Post()
  @RequirePermission('notifications:send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send notification to users' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendNotification(
    @Body(ValidationPipe) dto: CreateNotificationDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ notificationIds: string[]; message: string }> {
    // Filter out undefined values to comply with exactOptionalPropertyTypes
    const notificationRequest: {
      type: string;
      recipients: string[];
      templateId?: string;
      subject?: string;
      message: string;
      htmlContent?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      scheduledAt?: Date;
      channels?: string[];
      variables?: Record<string, any>;
      actions?: Array<{
        id: string;
        label: string;
        url?: string;
        action?: string;
        style?: 'primary' | 'secondary' | 'danger';
      }>;
      groupId?: string;
      threadId?: string;
      metadata?: Record<string, any>;
    } = {
      type: dto.type,
      recipients: dto.recipients,
      message: dto.message,
    };

    if (dto.templateId !== undefined) notificationRequest.templateId = dto.templateId;
    if (dto.subject !== undefined) notificationRequest.subject = dto.subject;
    if (dto.htmlContent !== undefined) notificationRequest.htmlContent = dto.htmlContent;
    if (dto.priority !== undefined) notificationRequest.priority = dto.priority;
    if (dto.scheduledAt !== undefined) notificationRequest.scheduledAt = dto.scheduledAt;
    if (dto.channels !== undefined) notificationRequest.channels = dto.channels;
    if (dto.variables !== undefined) notificationRequest.variables = dto.variables;
    if (dto.actions !== undefined) notificationRequest.actions = dto.actions;
    if (dto.groupId !== undefined) notificationRequest.groupId = dto.groupId;
    if (dto.threadId !== undefined) notificationRequest.threadId = dto.threadId;
    if (dto.metadata !== undefined) notificationRequest.metadata = dto.metadata;

    const notificationIds = await this.notificationService.sendNotification(tenantId, notificationRequest);

    return {
      notificationIds,
      message: `Notification sent to ${dto.recipients.length} recipients`,
    };
  }

  /**
   * Send real-time notification
   */
  @Post('realtime')
  @RequirePermission('notifications:send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send real-time notification' })
  @ApiResponse({ status: 200, description: 'Real-time notification sent successfully' })
  async sendRealtimeNotification(
    @Body(ValidationPipe) dto: {
      recipients: string[];
      type: string;
      title: string;
      message: string;
      priority?: string;
      actions?: any[];
      metadata?: Record<string, any>;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    // Filter out undefined values to comply with exactOptionalPropertyTypes
    const notification: {
      id: string;
      type: string;
      title: string;
      message: string;
      priority: string;
      actions?: any[];
      metadata?: Record<string, any>;
    } = {
      id: `realtime-${Date.now()}`,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      priority: dto.priority || 'medium',
    };

    if (dto.actions !== undefined) notification.actions = dto.actions;
    if (dto.metadata !== undefined) notification.metadata = dto.metadata;

    await this.notificationService.sendRealtimeNotification(tenantId, dto.recipients, notification);

    return {
      message: `Real-time notification sent to ${dto.recipients.length} recipients`,
    };
  }

  /**
   * Create notification template
   */
  @Post('templates')
  @RequirePermission('notifications:manage-templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create notification template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(
    @Body(ValidationPipe) dto: CreateTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ templateId: string; message: string }> {
    const templateId = await this.notificationService.createTemplate(
      tenantId,
      {
        name: dto.name,
        type: dto.type,
        channel: dto.channel,
        subject: dto.subject ?? null,
        bodyTemplate: dto.bodyTemplate,
        htmlTemplate: dto.htmlTemplate ?? null,
        variables: dto.variables,
        isActive: dto.isActive ?? true,
        isSystem: false,
        metadata: dto.metadata || {},
      },
      user.id,
    );

    return {
      templateId,
      message: 'Template created successfully',
    };
  }

  /**
   * Update user notification preferences
   */
  @Put('preferences')
  @RequirePermission('notifications:manage-preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  async updatePreferences(
    @Body(ValidationPipe) dto: UpdatePreferencesDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.notificationService.updateUserPreferences(
      tenantId,
      dto.userId || user.id,
      dto.preferences,
      user.id,
    );

    return {
      message: 'Notification preferences updated successfully',
    };
  }

  /**
   * Register device token for push notifications
   */
  @Post('device-tokens')
  @RequirePermission('notifications:manage-devices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register device token for push notifications' })
  @ApiResponse({ status: 201, description: 'Device token registered successfully' })
  async registerDeviceToken(
    @Body(ValidationPipe) dto: RegisterDeviceTokenDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.notificationService.registerDeviceToken(
      tenantId,
      user.id,
      dto.token,
      dto.platform,
      dto.deviceId,
      dto.appVersion,
    );

    return {
      message: 'Device token registered successfully',
    };
  }

  /**
   * Mark notification as read
   */
  @Patch(':id/read')
  @RequirePermission('notifications:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) notificationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.notificationService.markAsRead(tenantId, notificationId, user.id);

    return {
      message: 'Notification marked as read',
    };
  }

  /**
   * Get notification history
   */
  @Get('history')
  @RequirePermission('notifications:read')
  @ApiOperation({ summary: 'Get notification history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Notification history retrieved successfully' })
  async getHistory(
    @Query() query: NotificationHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    // Filter out undefined values to comply with exactOptionalPropertyTypes
    const filters: {
      limit?: number;
      offset?: number;
      type?: string;
      status?: string;
      unreadOnly?: boolean;
    } = {};

    if (query.limit !== undefined) filters.limit = query.limit;
    if (query.offset !== undefined) filters.offset = query.offset;
    if (query.type !== undefined) filters.type = query.type;
    if (query.status !== undefined) filters.status = query.status;
    if (query.unreadOnly !== undefined) filters.unreadOnly = query.unreadOnly;

    return await this.notificationService.getNotificationHistory(tenantId, user.id, filters);
  }

  /**
   * Get notification statistics
   */
  @Get('stats')
  @RequirePermission('notifications:view-stats')
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Notification statistics retrieved successfully' })
  async getStats(
    @Query() query: NotificationStatsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    // Filter out undefined values to comply with exactOptionalPropertyTypes
    const filters: {
      startDate?: Date;
      endDate?: Date;
      type?: string;
      userId?: string;
    } = {};

    if (query.startDate !== undefined) filters.startDate = query.startDate;
    if (query.endDate !== undefined) filters.endDate = query.endDate;
    if (query.type !== undefined) filters.type = query.type;
    if (query.userId !== undefined) filters.userId = query.userId;

    return await this.notificationService.getNotificationStats(tenantId, filters);
  }

  /**
   * Get unread notification count
   */
  @Get('unread-count')
  @RequirePermission('notifications:read')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved successfully' })
  async getUnreadCount(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ count: number }> {
    const { total } = await this.notificationService.getNotificationHistory(
      tenantId,
      user.id,
      { limit: 1, unreadOnly: true },
    );

    return { count: total };
  }

  /**
   * Get user's notification preferences
   */
  @Get('preferences')
  @RequirePermission('notifications:read')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved successfully' })
  async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    const preferences = await this.notificationService.getUserAllPreferences(tenantId, user.id);
    
    return {
      preferences,
      message: 'Preferences retrieved successfully',
    };
  }

  /**
   * Get notification templates
   */
  @Get('templates')
  @RequirePermission('notifications:read')
  @ApiOperation({ summary: 'Get notification templates' })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'channel', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getTemplates(
    @Query() query: {
      type?: string;
      channel?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    },
    @CurrentTenant() tenantId: string,
  ) {
    // Filter out undefined values to comply with exactOptionalPropertyTypes
    const filters: {
      type?: string;
      channel?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    } = {};

    if (query.type !== undefined) filters.type = query.type;
    if (query.channel !== undefined) filters.channel = query.channel;
    if (query.isActive !== undefined) filters.isActive = query.isActive;
    if (query.limit !== undefined) filters.limit = query.limit;
    if (query.offset !== undefined) filters.offset = query.offset;

    return await this.notificationService.getTemplates(tenantId, filters);
  }

  /**
   * Update notification template
   */
  @Put('templates/:id')
  @RequirePermission('notifications:manage-templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) templateId: string,
    @Body(ValidationPipe) dto: Partial<CreateTemplateDto>,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.notificationService.updateTemplate(tenantId, templateId, dto, user.id);

    return {
      message: 'Template updated successfully',
    };
  }

  /**
   * Delete notification template
   */
  @Delete('templates/:id')
  @RequirePermission('notifications:manage-templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete notification template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async deleteTemplate(
    @Param('id', ParseUUIDPipe) templateId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.notificationService.deleteTemplate(tenantId, templateId);

    return {
      message: 'Template deleted successfully',
    };
  }

  /**
   * Send bulk notifications
   */
  @Post('bulk')
  @RequirePermission('notifications:send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send bulk notifications' })
  @ApiResponse({ status: 201, description: 'Bulk notifications sent successfully' })
  async sendBulkNotifications(
    @Body(ValidationPipe) dto: {
      notifications: CreateNotificationDto[];
      options?: {
        batchSize?: number;
        delayBetweenBatches?: number;
        priority?: string;
      };
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    // Filter out undefined values for each notification to comply with exactOptionalPropertyTypes
    const notifications = dto.notifications.map(n => {
      const notification: {
        type: string;
        recipients: string[];
        templateId?: string;
        subject?: string;
        message: string;
        htmlContent?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        scheduledAt?: Date;
        channels?: string[];
        variables?: Record<string, any>;
        actions?: Array<{
          id: string;
          label: string;
          url?: string;
          action?: string;
          style?: 'primary' | 'secondary' | 'danger';
        }>;
        groupId?: string;
        threadId?: string;
        metadata?: Record<string, any>;
      } = {
        type: n.type,
        recipients: n.recipients,
        message: n.message,
      };

      if (n.templateId !== undefined) notification.templateId = n.templateId;
      if (n.subject !== undefined) notification.subject = n.subject;
      if (n.htmlContent !== undefined) notification.htmlContent = n.htmlContent;
      if (n.priority !== undefined) notification.priority = n.priority;
      if (n.scheduledAt !== undefined) notification.scheduledAt = n.scheduledAt;
      if (n.channels !== undefined) notification.channels = n.channels;
      if (n.variables !== undefined) notification.variables = n.variables;
      if (n.actions !== undefined) notification.actions = n.actions;
      if (n.groupId !== undefined) notification.groupId = n.groupId;
      if (n.threadId !== undefined) notification.threadId = n.threadId;
      if (n.metadata !== undefined) notification.metadata = n.metadata;

      return notification;
    });

    // Filter out undefined values from options to comply with exactOptionalPropertyTypes
    const options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    } | undefined = dto.options ? {} : undefined;

    if (dto.options) {
      if (dto.options.batchSize !== undefined) options!.batchSize = dto.options.batchSize;
      if (dto.options.delayBetweenBatches !== undefined) options!.delayBetweenBatches = dto.options.delayBetweenBatches;
      if (dto.options.priority !== undefined) {
        options!.priority = dto.options.priority as 'low' | 'medium' | 'high' | 'urgent';
      }
    }

    const result = await this.notificationService.sendBulkNotifications(
      tenantId,
      notifications,
      options,
    );

    return {
      ...result,
      message: `Bulk notifications processed: ${result.totalSent} sent in ${result.batchCount} batches`,
    };
  }

  /**
   * Create default templates for tenant
   */
  @Post('templates/defaults')
  @RequirePermission('notifications:manage-templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create default notification templates' })
  @ApiResponse({ status: 201, description: 'Default templates created successfully' })
  async createDefaultTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.notificationService.createDefaultTemplates(tenantId, user.id);

    return {
      message: 'Default templates created successfully',
    };
  }

  /**
   * Get available notification types
   */
  @Get('types')
  @RequirePermission('notifications:read')
  @ApiOperation({ summary: 'Get available notification types' })
  @ApiResponse({ status: 200, description: 'Notification types retrieved successfully' })
  async getNotificationTypes(): Promise<{
    types: Array<{
      value: string;
      label: string;
      description: string;
      channels: string[];
    }>;
  }> {
    // Return predefined notification types
    return {
      types: [
        {
          value: 'transaction_created',
          label: 'Transaction Created',
          description: 'Notification when a new transaction is processed',
          channels: ['in-app', 'email', 'push'],
        },
        {
          value: 'low_stock_alert',
          label: 'Low Stock Alert',
          description: 'Alert when inventory levels are low',
          channels: ['in-app', 'email', 'sms', 'push'],
        },
        {
          value: 'payment_received',
          label: 'Payment Received',
          description: 'Notification when payment is received',
          channels: ['in-app', 'email', 'push'],
        },
        {
          value: 'system_maintenance',
          label: 'System Maintenance',
          description: 'System maintenance notifications',
          channels: ['in-app', 'email'],
        },
        {
          value: 'user_login',
          label: 'User Login',
          description: 'Security notification for user login',
          channels: ['email', 'sms'],
        },
        {
          value: 'report_ready',
          label: 'Report Ready',
          description: 'Notification when a report is ready for download',
          channels: ['in-app', 'email'],
        },
        {
          value: 'customer_milestone',
          label: 'Customer Milestone',
          description: 'Customer loyalty or purchase milestones',
          channels: ['in-app', 'email'],
        },
        {
          value: 'employee_schedule',
          label: 'Employee Schedule',
          description: 'Employee scheduling notifications',
          channels: ['in-app', 'email', 'sms', 'push'],
        },
      ],
    };
  }

  /**
   * Get available notification channels
   */
  @Get('channels')
  @RequirePermission('notifications:read')
  @ApiOperation({ summary: 'Get available notification channels' })
  @ApiResponse({ status: 200, description: 'Notification channels retrieved successfully' })
  async getNotificationChannels(): Promise<{
    channels: Array<{
      value: string;
      label: string;
      description: string;
      isActive: boolean;
    }>;
  }> {
    return {
      channels: [
        {
          value: 'in-app',
          label: 'In-App',
          description: 'Real-time notifications within the application',
          isActive: true,
        },
        {
          value: 'email',
          label: 'Email',
          description: 'Email notifications',
          isActive: true,
        },
        {
          value: 'sms',
          label: 'SMS',
          description: 'Text message notifications',
          isActive: true,
        },
        {
          value: 'push',
          label: 'Push Notification',
          description: 'Mobile and web push notifications',
          isActive: true,
        },
      ],
    };
  }
}