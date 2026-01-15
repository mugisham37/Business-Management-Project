import { Injectable, Logger } from '@nestjs/common';
import { InjectDrizzle, DrizzleDB } from '../../database/drizzle.service';
import { QueueService } from '../../queue/queue.service';
import { RealtimeService } from './realtime.service';
import { NotificationWebhookService } from './notification-webhook.service';
import { 
  notifications, 
  notificationTemplates, 
  notificationPreferences, 
  notificationSubscriptions,
  deviceTokens,
  notificationDeliveryLog 
} from '../../database/schema/notification.schema';
import { users } from '../../database/schema/user.schema';
import { eq, and, or, inArray, desc, asc, count, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  htmlTemplate: string | null;
  variables: string[];
  isActive: boolean;
  isSystem: boolean;
  metadata: Record<string, any>;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: string;
  channel: string;
  isEnabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string | null;
  settings: Record<string, any>;
}

export interface NotificationRequest {
  type: string;
  recipients: string[]; // User IDs
  templateId?: string;
  subject?: string;
  message: string;
  htmlContent?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  scheduledAt?: Date;
  channels?: string[]; // If not provided, uses user preferences
  variables?: Record<string, any>; // For template rendering
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
}

export interface NotificationHistory {
  id: string;
  recipientId: string;
  type: string;
  channel: string;
  subject: string | null;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  priority: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  deliveryAttempts: number;
  failureReason: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface NotificationStats {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  deliveryRate: number;
  readRate: number;
  byChannel: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
  }>;
  byType: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly queueService: QueueService,
    private readonly realtimeService: RealtimeService,
    private readonly webhookService: NotificationWebhookService,
  ) {}

  /**
   * Send notification to users
   */
  async sendNotification(tenantId: string, request: NotificationRequest): Promise<string[]> {
    try {
      this.logger.log(`Sending notification: ${request.type} to ${request.recipients.length} recipients`);

      const notificationIds: string[] = [];
      const allChannels = new Set<string>();

      // Get template if specified
      let template: NotificationTemplate | null = null;
      if (request.templateId) {
        template = await this.getTemplate(tenantId, request.templateId);
        if (!template) {
          throw new Error(`Template not found: ${request.templateId}`);
        }
      }

      // Process each recipient
      for (const recipientId of request.recipients) {
        // Get user preferences for this notification type
        const preferences = await this.getUserPreferences(tenantId, recipientId, request.type);
        
        // Determine channels to use
        const channels = request.channels || this.getEnabledChannels(preferences);
        
        if (channels.length === 0) {
          this.logger.warn(`No enabled channels for user ${recipientId}, notification type ${request.type}`);
          continue;
        }

        // Track all channels used
        channels.forEach(ch => allChannels.add(ch));

        // Create notification record for each channel
        for (const channel of channels) {
          const notificationId = await this.createNotificationRecord(
            tenantId,
            recipientId,
            request,
            channel,
            template,
          );
          
          notificationIds.push(notificationId);

          // Schedule delivery based on user preferences
          const preference = preferences.find(p => p.channel === channel);
          const shouldSchedule = this.shouldScheduleNotification(preference, request.scheduledAt);

          if (shouldSchedule.schedule) {
            await this.scheduleNotificationDelivery(
              notificationId,
              channel,
              shouldSchedule.scheduledAt || new Date(),
            );
          } else {
            // Send immediately
            await this.deliverNotification(notificationId, channel);
          }
        }
      }

      this.logger.log(`Created ${notificationIds.length} notification records`);

      // Trigger webhooks for notification events
      await this.triggerNotificationWebhooks(tenantId, 'notification.created', {
        notificationIds,
        type: request.type,
        recipientCount: request.recipients.length,
        channels: Array.from(allChannels),
        priority: request.priority || 'medium',
      });

      return notificationIds;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send notification: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Send real-time notification (in-app)
   */
  async sendRealtimeNotification(
    tenantId: string,
    recipientIds: string[],
    notification: {
      id: string;
      type: string;
      title: string;
      message: string;
      priority: string;
      actions?: any[];
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      // Send via WebSocket to online users
      await this.realtimeService.sendNotification(tenantId, {
        id: notification.id,
        type: notification.type as any,
        title: notification.title,
        message: notification.message,
        priority: notification.priority as any,
        targetUsers: recipientIds,
        metadata: notification.metadata || {},
      });

      this.logger.log(`Sent real-time notification to ${recipientIds.length} users`);

      // Trigger webhooks for real-time notifications
      await this.triggerNotificationWebhooks(tenantId, 'notification.realtime', {
        notificationId: notification.id,
        type: notification.type,
        recipientIds,
        title: notification.title,
        message: notification.message,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send real-time notification: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Create notification template
   */
  async createTemplate(
    tenantId: string,
    template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    createdBy: string,
  ): Promise<string> {
    try {
      const templateId = randomUUID();

      await this.db.insert(notificationTemplates).values({
        id: templateId,
        tenantId,
        name: template.name,
        type: template.type,
        channel: template.channel,
        subject: template.subject,
        bodyTemplate: template.bodyTemplate,
        htmlTemplate: template.htmlTemplate,
        variables: template.variables,
        isActive: template.isActive,
        isSystem: template.isSystem,
        metadata: template.metadata,
        createdBy,
        updatedBy: createdBy,
      });

      this.logger.log(`Created notification template: ${template.name} (${templateId})`);
      return templateId;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to create notification template: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    tenantId: string,
    userId: string,
    preferences: Array<{
      notificationType: string;
      channel: string;
      isEnabled: boolean;
      frequency?: string;
      quietHoursStart?: string;
      quietHoursEnd?: string;
      timezone?: string;
      settings?: Record<string, any>;
    }>,
    updatedBy: string,
  ): Promise<void> {
    try {
      // Delete existing preferences for this user
      await this.db
        .delete(notificationPreferences)
        .where(and(
          eq(notificationPreferences.tenantId, tenantId),
          eq(notificationPreferences.userId, userId),
        ));

      // Insert new preferences
      if (preferences.length > 0) {
        await this.db.insert(notificationPreferences).values(
          preferences.map(pref => ({
            id: randomUUID(),
            tenantId,
            userId,
            notificationType: pref.notificationType,
            channel: pref.channel,
            isEnabled: pref.isEnabled,
            frequency: pref.frequency || 'immediate',
            quietHoursStart: pref.quietHoursStart,
            quietHoursEnd: pref.quietHoursEnd,
            timezone: pref.timezone || 'UTC',
            settings: pref.settings || {},
            createdBy: updatedBy,
            updatedBy,
          })),
        );
      }

      this.logger.log(`Updated notification preferences for user ${userId}`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to update user preferences: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Register device token for push notifications
   */
  async registerDeviceToken(
    tenantId: string,
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
    deviceId?: string,
    appVersion?: string,
  ): Promise<void> {
    try {
      // Deactivate existing tokens for this device
      if (deviceId) {
        await this.db
          .update(deviceTokens)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(
            eq(deviceTokens.tenantId, tenantId),
            eq(deviceTokens.userId, userId),
            eq(deviceTokens.deviceId, deviceId),
          ));
      }

      // Insert new token
      await this.db.insert(deviceTokens).values({
        id: randomUUID(),
        tenantId,
        userId,
        token,
        platform,
        deviceId,
        appVersion,
        isActive: true,
        lastUsedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      });

      this.logger.log(`Registered device token for user ${userId}, platform ${platform}`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to register device token: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(tenantId: string, notificationId: string, userId: string): Promise<void> {
    try {
      await this.db
        .update(notifications)
        .set({ 
          status: 'read',
          readAt: new Date(),
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.tenantId, tenantId),
          eq(notifications.recipientId, userId),
        ));

      this.logger.log(`Marked notification ${notificationId} as read by user ${userId}`);

      // Trigger webhooks for read notifications
      await this.triggerNotificationWebhooks(tenantId, 'notification.read', {
        notificationId,
        userId,
        readAt: new Date(),
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to mark notification as read: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get notification history for user
   */
  async getNotificationHistory(
    tenantId: string,
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      type?: string;
      status?: string;
      unreadOnly?: boolean;
    } = {},
  ): Promise<{ notifications: NotificationHistory[]; total: number }> {
    try {
      const { limit = 50, offset = 0, type, status, unreadOnly } = options;

      let whereConditions = and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.recipientId, userId),
      );

      if (type) {
        whereConditions = and(whereConditions, eq(notifications.type, type));
      }

      if (status) {
        whereConditions = and(whereConditions, eq(notifications.status, status));
      }

      if (unreadOnly) {
        whereConditions = and(
          whereConditions,
          or(
            eq(notifications.status, 'pending'),
            eq(notifications.status, 'sent'),
            eq(notifications.status, 'delivered'),
          ),
        );
      }

      // Get total count
      const countResult = await this.db
        .select({ count: count() })
        .from(notifications)
        .where(whereConditions);
      
      const total = countResult[0]?.count ?? 0;

      // Get notifications
      const notificationList = await this.db
        .select()
        .from(notifications)
        .where(whereConditions)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        notifications: notificationList.map(n => ({
          id: n.id,
          recipientId: n.recipientId,
          type: n.type,
          channel: n.channel,
          subject: n.subject,
          message: n.message,
          status: n.status as any,
          priority: n.priority,
          scheduledAt: n.scheduledAt,
          sentAt: n.sentAt,
          deliveredAt: n.deliveredAt,
          readAt: n.readAt,
          deliveryAttempts: n.deliveryAttempts ?? 0,
          failureReason: n.failureReason,
          metadata: n.metadata as Record<string, any>,
          createdAt: n.createdAt,
        })),
        total,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get notification history: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(
    tenantId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      type?: string;
      userId?: string;
    } = {},
  ): Promise<NotificationStats> {
    try {
      const { startDate, endDate, type, userId } = options;

      let whereConditions: any = eq(notifications.tenantId, tenantId);

      if (startDate) {
        whereConditions = and(whereConditions, sql`${notifications.createdAt} >= ${startDate}`);
      }

      if (endDate) {
        whereConditions = and(whereConditions, sql`${notifications.createdAt} <= ${endDate}`);
      }

      if (type) {
        whereConditions = and(whereConditions, eq(notifications.type, type));
      }

      if (userId) {
        whereConditions = and(whereConditions, eq(notifications.recipientId, userId));
      }

      // Get overall stats
      const overallStats = await this.db
        .select({
          status: notifications.status,
          channel: notifications.channel,
          type: notifications.type,
          count: count(),
        })
        .from(notifications)
        .where(whereConditions)
        .groupBy(notifications.status, notifications.channel, notifications.type);

      // Calculate aggregated stats
      const stats: NotificationStats = {
        totalSent: 0,
        totalDelivered: 0,
        totalRead: 0,
        totalFailed: 0,
        deliveryRate: 0,
        readRate: 0,
        byChannel: {},
        byType: {},
      };

      for (const stat of overallStats) {
        const count = Number(stat.count);
        const status = stat.status ?? '';

        // Overall totals
        if (['sent', 'delivered', 'read'].includes(status)) {
          stats.totalSent += count;
        }
        if (['delivered', 'read'].includes(status)) {
          stats.totalDelivered += count;
        }
        if (status === 'read') {
          stats.totalRead += count;
        }
        if (status === 'failed') {
          stats.totalFailed += count;
        }

        // By channel
        if (!stats.byChannel[stat.channel]) {
          stats.byChannel[stat.channel] = {
            sent: 0,
            delivered: 0,
            failed: 0,
            deliveryRate: 0,
          };
        }

        const channelStats = stats.byChannel[stat.channel];
        if (channelStats) {
          if (['sent', 'delivered', 'read'].includes(status)) {
            channelStats.sent += count;
          }
          if (['delivered', 'read'].includes(status)) {
            channelStats.delivered += count;
          }
          if (status === 'failed') {
            channelStats.failed += count;
          }
        }

        // By type
        if (!stats.byType[stat.type]) {
          stats.byType[stat.type] = {
            sent: 0,
            delivered: 0,
            failed: 0,
          };
        }

        const typeStats = stats.byType[stat.type];
        if (typeStats) {
          if (['sent', 'delivered', 'read'].includes(status)) {
            typeStats.sent += count;
          }
          if (['delivered', 'read'].includes(status)) {
            typeStats.delivered += count;
          }
          if (status === 'failed') {
            typeStats.failed += count;
          }
        }
      }

      // Calculate rates
      stats.deliveryRate = stats.totalSent > 0 ? (stats.totalDelivered / stats.totalSent) * 100 : 0;
      stats.readRate = stats.totalDelivered > 0 ? (stats.totalRead / stats.totalDelivered) * 100 : 0;

      // Calculate channel delivery rates
      for (const channel in stats.byChannel) {
        const channelStats = stats.byChannel[channel];
        if (channelStats) {
          channelStats.deliveryRate = channelStats.sent > 0 
            ? (channelStats.delivered / channelStats.sent) * 100 
            : 0;
        }
      }

      return stats;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get notification stats: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get notification templates
   */
  async getTemplates(
    tenantId: string,
    options: {
      type?: string;
      channel?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ templates: NotificationTemplate[]; total: number }> {
    try {
      const { type, channel, isActive, limit = 50, offset = 0 } = options;

      let whereConditions: any = eq(notificationTemplates.tenantId, tenantId);

      if (type) {
        whereConditions = and(whereConditions, eq(notificationTemplates.type, type));
      }

      if (channel) {
        whereConditions = and(whereConditions, eq(notificationTemplates.channel, channel));
      }

      if (isActive !== undefined) {
        whereConditions = and(whereConditions, eq(notificationTemplates.isActive, isActive));
      }

      // Get total count
      const countResult = await this.db
        .select({ count: count() })
        .from(notificationTemplates)
        .where(whereConditions);
      
      const total = countResult[0]?.count ?? 0;

      // Get templates
      const templateList = await this.db
        .select()
        .from(notificationTemplates)
        .where(whereConditions)
        .orderBy(desc(notificationTemplates.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        templates: templateList.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          channel: t.channel,
          subject: t.subject,
          bodyTemplate: t.bodyTemplate,
          htmlTemplate: t.htmlTemplate,
          variables: t.variables as string[],
          isActive: t.isActive ?? false,
          isSystem: t.isSystem ?? false,
          metadata: t.metadata as Record<string, any>,
        })),
        total,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get notification templates: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Update notification template
   */
  async updateTemplate(
    tenantId: string,
    templateId: string,
    updates: Partial<Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>>,
    updatedBy: string,
  ): Promise<void> {
    try {
      await this.db
        .update(notificationTemplates)
        .set({
          ...updates,
          updatedAt: new Date(),
          updatedBy,
        })
        .where(and(
          eq(notificationTemplates.id, templateId),
          eq(notificationTemplates.tenantId, tenantId),
          eq(notificationTemplates.isSystem, false), // Prevent updating system templates
        ));

      this.logger.log(`Updated notification template: ${templateId}`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to update notification template: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Delete notification template
   */
  async deleteTemplate(tenantId: string, templateId: string): Promise<void> {
    try {
      await this.db
        .delete(notificationTemplates)
        .where(and(
          eq(notificationTemplates.id, templateId),
          eq(notificationTemplates.tenantId, tenantId),
          eq(notificationTemplates.isSystem, false), // Prevent deleting system templates
        ));

      this.logger.log(`Deleted notification template: ${templateId}`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to delete notification template: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserAllPreferences(
    tenantId: string,
    userId: string,
  ): Promise<NotificationPreference[]> {
    try {
      const preferences = await this.db
        .select()
        .from(notificationPreferences)
        .where(and(
          eq(notificationPreferences.tenantId, tenantId),
          eq(notificationPreferences.userId, userId),
        ));

      return preferences.map(p => ({
        id: p.id,
        userId: p.userId,
        notificationType: p.notificationType,
        channel: p.channel,
        isEnabled: p.isEnabled ?? false,
        frequency: p.frequency as any,
        quietHoursStart: p.quietHoursStart,
        quietHoursEnd: p.quietHoursEnd,
        timezone: p.timezone,
        settings: p.settings as Record<string, any>,
      }));

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get user preferences: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(
    tenantId: string,
    notifications: NotificationRequest[],
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    } = {},
  ): Promise<{ totalSent: number; batchCount: number; notificationIds: string[] }> {
    try {
      const { batchSize = 100, delayBetweenBatches = 1000 } = options;
      const allNotificationIds: string[] = [];
      let totalSent = 0;
      let batchCount = 0;

      // Process notifications in batches
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        // Send batch
        const batchPromises = batch.map(notification => 
          this.sendNotification(tenantId, notification)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Collect results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            allNotificationIds.push(...result.value);
            const batchItem = batch[index];
            if (batchItem) {
              totalSent += batchItem.recipients.length;
            }
          } else {
            this.logger.error(`Failed to send notification in batch ${batchCount}:`, result.reason);
          }
        });

        batchCount++;

        // Delay between batches (except for the last batch)
        if (i + batchSize < notifications.length && delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      this.logger.log(`Bulk notification completed: ${totalSent} notifications sent in ${batchCount} batches`);

      return {
        totalSent,
        batchCount,
        notificationIds: allNotificationIds,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send bulk notifications: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Create default notification templates for a tenant
   */
  async createDefaultTemplates(tenantId: string, createdBy: string): Promise<void> {
    try {
      const defaultTemplates = [
        {
          name: 'Transaction Created',
          type: 'transaction_created',
          channel: 'email',
          subject: 'Transaction Confirmation - {{transactionId}}',
          bodyTemplate: 'Your transaction {{transactionId}} for {{amount}} has been processed successfully.',
          htmlTemplate: null,
          variables: ['transactionId', 'amount', 'customerName'],
          isActive: true,
          isSystem: true,
          metadata: {},
        },
        {
          name: 'Low Stock Alert',
          type: 'low_stock_alert',
          channel: 'email',
          subject: 'Low Stock Alert - {{productName}}',
          bodyTemplate: 'Product {{productName}} is running low. Current stock: {{currentStock}}. Reorder point: {{reorderPoint}}.',
          htmlTemplate: null,
          variables: ['productName', 'currentStock', 'reorderPoint'],
          isActive: true,
          isSystem: true,
          metadata: {},
        },
        {
          name: 'Payment Received',
          type: 'payment_received',
          channel: 'email',
          subject: 'Payment Received - {{amount}}',
          bodyTemplate: 'We have received your payment of {{amount}} for invoice {{invoiceNumber}}. Thank you!',
          htmlTemplate: null,
          variables: ['amount', 'invoiceNumber', 'customerName'],
          isActive: true,
          isSystem: true,
          metadata: {},
        },
        {
          name: 'System Maintenance',
          type: 'system_maintenance',
          channel: 'email',
          subject: 'Scheduled System Maintenance',
          bodyTemplate: 'System maintenance is scheduled for {{maintenanceDate}} from {{startTime}} to {{endTime}}. Please plan accordingly.',
          htmlTemplate: null,
          variables: ['maintenanceDate', 'startTime', 'endTime'],
          isActive: true,
          isSystem: true,
          metadata: {},
        },
      ];

      for (const template of defaultTemplates) {
        await this.createTemplate(tenantId, template, createdBy);
      }

      this.logger.log(`Created ${defaultTemplates.length} default templates for tenant ${tenantId}`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to create default templates: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Trigger notification webhooks
   */
  private async triggerNotificationWebhooks(
    tenantId: string,
    event: string,
    payload: Record<string, any>,
  ): Promise<void> {
    try {
      await this.webhookService.triggerWebhook(tenantId, event, payload);
    } catch (error) {
      // Don't fail the main operation if webhook fails
      this.logger.error(`Failed to trigger webhook for event ${event}:`, error);
    }
  }

  /**
   * Private helper methods
   */

  private async createNotificationRecord(
    tenantId: string,
    recipientId: string,
    request: NotificationRequest,
    channel: string,
    template: NotificationTemplate | null,
  ): Promise<string> {
    const notificationId = randomUUID();

    // Render template if provided
    let subject = request.subject;
    let message = request.message;
    let htmlContent = request.htmlContent;

    if (template && request.variables) {
      subject = this.renderTemplate(template.subject || '', request.variables);
      message = this.renderTemplate(template.bodyTemplate, request.variables);
      if (template.htmlTemplate) {
        htmlContent = this.renderTemplate(template.htmlTemplate, request.variables);
      }
    }

    await this.db.insert(notifications).values({
      id: notificationId,
      tenantId,
      recipientId,
      type: request.type,
      channel,
      templateId: request.templateId,
      subject,
      message,
      htmlContent,
      status: 'pending',
      priority: request.priority || 'medium',
      scheduledAt: request.scheduledAt,
      actions: request.actions || [],
      groupId: request.groupId,
      threadId: request.threadId,
      metadata: request.metadata || {},
      createdBy: recipientId, // Assuming system-generated
      updatedBy: recipientId,
    });

    return notificationId;
  }

  private async getTemplate(tenantId: string, templateId: string): Promise<NotificationTemplate | null> {
    const [template] = await this.db
      .select()
      .from(notificationTemplates)
      .where(and(
        eq(notificationTemplates.id, templateId),
        eq(notificationTemplates.tenantId, tenantId),
        eq(notificationTemplates.isActive, true),
      ));

    return template ? {
      id: template.id,
      name: template.name,
      type: template.type,
      channel: template.channel,
      subject: template.subject,
      bodyTemplate: template.bodyTemplate,
      htmlTemplate: template.htmlTemplate,
      variables: template.variables as string[],
      isActive: template.isActive ?? false,
      isSystem: template.isSystem ?? false,
      metadata: template.metadata as Record<string, any>,
    } : null;
  }

  private async getUserPreferences(
    tenantId: string,
    userId: string,
    notificationType: string,
  ): Promise<NotificationPreference[]> {
    const preferences = await this.db
      .select()
      .from(notificationPreferences)
      .where(and(
        eq(notificationPreferences.tenantId, tenantId),
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.notificationType, notificationType),
      ));

    return preferences.map(p => ({
      id: p.id,
      userId: p.userId,
      notificationType: p.notificationType,
      channel: p.channel,
      isEnabled: p.isEnabled ?? false,
      frequency: p.frequency as any,
      quietHoursStart: p.quietHoursStart,
      quietHoursEnd: p.quietHoursEnd,
      timezone: p.timezone,
      settings: p.settings as Record<string, any>,
    }));
  }

  private getEnabledChannels(preferences: NotificationPreference[]): string[] {
    return preferences
      .filter(p => p.isEnabled)
      .map(p => p.channel);
  }

  private shouldScheduleNotification(
    preference: NotificationPreference | undefined,
    requestedSchedule?: Date,
  ): { schedule: boolean; scheduledAt?: Date } {
    if (requestedSchedule) {
      return { schedule: true, scheduledAt: requestedSchedule };
    }

    if (!preference || preference.frequency === 'immediate') {
      return { schedule: false };
    }

    // TODO: Implement batching logic for hourly, daily, weekly frequencies
    // For now, send immediately
    return { schedule: false };
  }

  private async scheduleNotificationDelivery(
    notificationId: string,
    channel: string,
    scheduledAt: Date,
  ): Promise<void> {
    // Schedule via queue system
    const delay = scheduledAt.getTime() - Date.now();
    
    await this.queueService.addNotificationJob(
      {
        type: channel as any,
        recipients: [notificationId], // Pass notification ID instead of user ID
        title: 'Scheduled Notification',
        message: 'Processing scheduled notification',
      },
      { delay: Math.max(0, delay) },
    );
  }

  private async deliverNotification(notificationId: string, channel: string): Promise<void> {
    // Queue for immediate delivery
    await this.queueService.addNotificationJob({
      type: channel as any,
      recipients: [notificationId], // Pass notification ID instead of user ID
      title: 'Immediate Notification',
      message: 'Processing immediate notification',
    });
  }

  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    
    return rendered;
  }
}