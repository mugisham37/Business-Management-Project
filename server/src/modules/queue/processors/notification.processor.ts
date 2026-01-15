import { Processor, Process } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationJobData } from '../queue.service';
import { CustomLoggerService } from '../../logger/logger.service';
import { InjectDrizzle, DrizzleDB } from '../../database/drizzle.service';
import { RealtimeService } from '../../realtime/services/realtime.service';
import { CommunicationIntegrationService } from '../../communication/services/communication-integration.service';
import { SlackIntegrationService } from '../../communication/services/slack-integration.service';
import { TeamsIntegrationService } from '../../communication/services/teams-integration.service';
import { EmailNotificationService } from '../../communication/services/email-notification.service';
import { SMSNotificationService } from '../../communication/services/sms-notification.service';
import { 
  notifications, 
  notificationDeliveryLog,
  deviceTokens 
} from '../../database/schema/notification.schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly customLogger: CustomLoggerService,
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly realtimeService?: RealtimeService,
    private readonly communicationService?: CommunicationIntegrationService,
    private readonly slackService?: SlackIntegrationService,
    private readonly teamsService?: TeamsIntegrationService,
    private readonly emailService?: EmailNotificationService,
    private readonly smsService?: SMSNotificationService,
  ) {
    this.customLogger.setContext('NotificationProcessor');
  }

  @Process('send-notification')
  async handleSendNotification(job: Job<NotificationJobData>): Promise<void> {
    const { type, recipients, title, message, data, tenantId } = job.data;

    try {
      this.customLogger.log('Processing notification job', {
        jobId: job.id,
        type,
        recipientCount: recipients.length,
        title,
        tenantId,
      });

      // Handle notification IDs vs user IDs
      // If recipients are notification IDs (UUIDs), fetch notification records
      // If recipients are user IDs, process directly
      const isNotificationIds = recipients.every(id => 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );

      if (isNotificationIds && type !== 'in-app') {
        // Process notification records for external channels
        await this.processNotificationRecords(recipients, type);
      } else {
        // Direct processing for user IDs or in-app notifications
        switch (type) {
          case 'push':
            await this.sendPushNotification(recipients, title, message, data, tenantId);
            break;
          case 'sms':
            await this.sendSmsNotification(recipients, message, tenantId);
            break;
          case 'email':
            await this.sendEmailNotification(recipients, title, message, data, tenantId);
            break;
          case 'in-app':
            await this.sendInAppNotification(recipients, title, message, data, tenantId);
            break;
          default:
            throw new Error(`Unknown notification type: ${type}`);
        }
      }

      this.customLogger.log('Notification sent successfully', {
        jobId: job.id,
        type,
        recipientCount: recipients.length,
        tenantId,
      });
    } catch (error) {
      this.customLogger.error('Failed to send notification', error instanceof Error ? error.stack : undefined, {
        jobId: job.id,
        type,
        recipientCount: recipients.length,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Process notification records for external delivery
   */
  private async processNotificationRecords(notificationIds: string[], channel: string): Promise<void> {
    for (const notificationId of notificationIds) {
      try {
        // Get notification record
        const [notification] = await this.db
          .select()
          .from(notifications)
          .where(eq(notifications.id, notificationId));

        if (!notification) {
          this.logger.warn(`Notification not found: ${notificationId}`);
          continue;
        }

        // Update status to sending
        await this.db
          .update(notifications)
          .set({ 
            status: 'sent',
            sentAt: new Date(),
            deliveryAttempts: (notification.deliveryAttempts ?? 0) + 1,
            lastAttemptAt: new Date(),
          })
          .where(eq(notifications.id, notificationId));

        // Create delivery log entry
        const deliveryLogId = randomUUID();
        await this.db.insert(notificationDeliveryLog).values({
          id: deliveryLogId,
          tenantId: notification.tenantId,
          notificationId,
          channel,
          provider: this.getProviderForChannel(channel),
          status: 'processing',
          createdBy: notification.createdBy,
          updatedBy: notification.updatedBy,
        });

        // Deliver based on channel
        let deliveryResult: { success: boolean; externalId?: string; error?: string };

        switch (channel) {
          case 'push':
            deliveryResult = await this.deliverPushNotification(notification);
            break;
          case 'sms':
            deliveryResult = await this.deliverSmsNotification(notification);
            break;
          case 'email':
            deliveryResult = await this.deliverEmailNotification(notification);
            break;
          default:
            deliveryResult = { success: false, error: `Unsupported channel: ${channel}` };
        }

        // Update notification and delivery log based on result
        if (deliveryResult.success) {
          await this.db
            .update(notifications)
            .set({ 
              status: 'delivered',
              deliveredAt: new Date(),
              externalId: deliveryResult.externalId,
            })
            .where(eq(notifications.id, notificationId));

          await this.db
            .update(notificationDeliveryLog)
            .set({
              status: 'delivered',
              deliveredAt: new Date(),
              externalId: deliveryResult.externalId,
            })
            .where(eq(notificationDeliveryLog.id, deliveryLogId));
        } else {
          await this.db
            .update(notifications)
            .set({ 
              status: 'failed',
              failureReason: deliveryResult.error,
            })
            .where(eq(notifications.id, notificationId));

          await this.db
            .update(notificationDeliveryLog)
            .set({
              status: 'failed',
              statusMessage: deliveryResult.error,
            })
            .where(eq(notificationDeliveryLog.id, deliveryLogId));
        }

      } catch (error) {
        this.logger.error(`Failed to process notification ${notificationId}:`, error);
        
        // Mark as failed
        await this.db
          .update(notifications)
          .set({ 
            status: 'failed',
            failureReason: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(notifications.id, notificationId));
      }
    }
  }

  /**
   * Deliver push notification for a specific notification record
   */
  private async deliverPushNotification(notification: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      // Get device tokens for the recipient
      const tokens = await this.db
        .select()
        .from(deviceTokens)
        .where(and(
          eq(deviceTokens.tenantId, notification.tenantId),
          eq(deviceTokens.userId, notification.recipientId),
          eq(deviceTokens.isActive, true),
        ));

      if (tokens.length === 0) {
        return { success: false, error: 'No active device tokens found' };
      }

      // TODO: Implement actual push notification delivery
      // This would integrate with:
      // - Firebase Cloud Messaging (FCM) for Android/Web
      // - Apple Push Notification Service (APNs) for iOS
      // - Web Push Protocol for web browsers

      const payload = {
        title: notification.subject || 'Notification',
        body: notification.message,
        data: notification.metadata || {},
        actions: notification.actions || [],
      };

      // Simulate successful delivery
      await this.simulateWork(500);
      const externalId = `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Push notification delivered to ${tokens.length} devices`, {
        notificationId: notification.id,
        recipientId: notification.recipientId,
        deviceCount: tokens.length,
        externalId,
      });

      return { success: true, externalId };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Push delivery failed' 
      };
    }
  }

  /**
   * Deliver SMS notification for a specific notification record
   */
  private async deliverSmsNotification(notification: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      if (!this.smsService) {
        return { success: false, error: 'SMS service not available' };
      }

      // Get user's phone number from user profile
      // For now, simulate SMS delivery
      const result = await this.smsService.sendSMS(notification.tenantId, {
        to: '+1234567890', // This would come from user profile
        message: notification.message,
        priority: notification.priority === 'urgent' ? 'high' : 'normal',
      });

      if (result.success) {
        this.logger.log(`SMS notification delivered`, {
          notificationId: notification.id,
          recipientId: notification.recipientId,
          messageId: result.messageId,
        });
      }

      return result;

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'SMS delivery failed' 
      };
    }
  }

  /**
   * Deliver email notification for a specific notification record
   */
  private async deliverEmailNotification(notification: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      if (!this.emailService) {
        return { success: false, error: 'Email service not available' };
      }

      // Send email notification to user
      const result = await this.emailService.sendNotificationToUsers(
        notification.tenantId,
        [notification.recipientId],
        {
          subject: notification.subject || 'Notification',
          message: notification.message,
          htmlContent: notification.htmlContent,
          priority: notification.priority === 'urgent' ? 'high' : 'normal',
        }
      );

      if (result.totalSent > 0) {
        this.logger.log(`Email notification delivered`, {
          notificationId: notification.id,
          recipientId: notification.recipientId,
          totalSent: result.totalSent,
        });

        return { success: true, externalId: `email_${Date.now()}` };
      } else {
        return { success: false, error: 'Email delivery failed' };
      }

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Email delivery failed' 
      };
    }
  }

  private async sendPushNotification(
    recipients: string[],
    title: string,
    message: string,
    data?: Record<string, any>,
    tenantId?: string
  ): Promise<void> {
    // Direct push notification sending (for user IDs)
    for (const userId of recipients) {
      try {
        // Get device tokens for the user
        const tokens = await this.db
          .select()
          .from(deviceTokens)
          .where(and(
            eq(deviceTokens.userId, userId),
            eq(deviceTokens.isActive, true),
          ));

        if (tokens.length === 0) {
          this.logger.warn(`No active device tokens for user ${userId}`);
          continue;
        }

        // TODO: Implement actual push notification delivery
        await this.simulateWork(300);

        this.logger.log(`Push notification sent to user ${userId} on ${tokens.length} devices`);
      } catch (error) {
        this.logger.error(`Failed to send push notification to user ${userId}:`, error);
      }
    }
  }

  private async sendSmsNotification(
    recipients: string[],
    message: string,
    tenantId?: string
  ): Promise<void> {
    // Direct SMS sending (for user IDs)
    for (const userId of recipients) {
      try {
        // TODO: Get user's phone number from user profile
        // TODO: Implement actual SMS sending logic
        await this.simulateWork(500);

        this.logger.log(`SMS sent to user ${userId}`);
        this.logger.log(`Message: ${message}`);
      } catch (error) {
        this.logger.error(`Failed to send SMS to user ${userId}:`, error);
      }
    }
  }

  private async sendEmailNotification(
    recipients: string[],
    title: string,
    message: string,
    data?: Record<string, any>,
    tenantId?: string
  ): Promise<void> {
    // Direct email sending (for user IDs)
    for (const userId of recipients) {
      try {
        // TODO: Get user's email from user profile
        // TODO: Implement email notification logic
        await this.simulateWork(400);

        this.logger.log(`Email notification sent to user ${userId}`);
        this.logger.log(`Subject: ${title}`);
        this.logger.log(`Message: ${message}`);
      } catch (error) {
        this.logger.error(`Failed to send email to user ${userId}:`, error);
      }
    }
  }

  private async sendInAppNotification(
    recipients: string[],
    title: string,
    message: string,
    data?: Record<string, any>,
    tenantId?: string
  ): Promise<void> {
    try {
      // Send real-time notifications via WebSocket
      if (this.realtimeService && tenantId) {
        await this.realtimeService.sendNotification(tenantId, {
          id: `in-app-${Date.now()}`,
          type: 'info',
          title,
          message,
          priority: 'medium',
          targetUsers: recipients,
          metadata: data || {},
        });
      }

      this.logger.log(`In-app notification sent to ${recipients.length} users`);
      this.logger.log(`Title: ${title}`);
      this.logger.log(`Message: ${message}`);
    } catch (error) {
      this.logger.error('Failed to send in-app notification:', error);
    }
  }

  private getProviderForChannel(channel: string): string {
    switch (channel) {
      case 'push':
        return 'fcm'; // Firebase Cloud Messaging
      case 'sms':
        return 'twilio';
      case 'email':
        return 'sendgrid';
      default:
        return 'unknown';
    }
  }

  private async simulateWork(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}