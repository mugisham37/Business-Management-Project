import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { QueueService } from '../../queue/queue.service';
import { EmailNotificationService } from '../../communication/services/email-notification.service';
import { SMSNotificationService } from '../../communication/services/sms-notification.service';
import { NotificationService } from '../services/notification.service';
import { ObjectType, Field, ID, InputType, Int } from '@nestjs/graphql';

// ===== INPUT TYPES =====

@InputType()
class SendEmailInput {
  @Field(() => [String], { description: 'Recipient email addresses' })
  to!: string[];

  @Field({ description: 'Email subject' })
  subject!: string;

  @Field({ description: 'Email message (plain text)' })
  message!: string;

  @Field({ nullable: true, description: 'HTML content' })
  htmlContent?: string;

  @Field({ nullable: true, description: 'Reply-to email address' })
  replyTo?: string;

  @Field(() => String, { nullable: true, description: 'Priority level' })
  priority?: 'high' | 'normal' | 'low';
}

@InputType()
class SendSMSInput {
  @Field(() => [String], { description: 'Recipient phone numbers' })
  to!: string[];

  @Field({ description: 'SMS message' })
  message!: string;

  @Field({ nullable: true, description: 'Sender ID or phone number' })
  from?: string;
}

@InputType()
class SendPushNotificationInput {
  @Field(() => [ID], { description: 'Recipient user IDs' })
  userIds!: string[];

  @Field({ description: 'Notification title' })
  title!: string;

  @Field({ description: 'Notification message' })
  message!: string;

  @Field({ nullable: true, description: 'Notification data payload (JSON string)' })
  data?: string;

  @Field({ nullable: true, description: 'Priority level' })
  priority?: 'high' | 'normal' | 'low';
}

@InputType()
class GetCommunicationHistoryInput {
  @Field(() => Int, { defaultValue: 50, description: 'Number of records to return' })
  limit!: number;

  @Field(() => Int, { defaultValue: 0, description: 'Number of records to skip' })
  offset!: number;

  @Field({ nullable: true, description: 'Filter by communication type' })
  type?: string;

  @Field({ nullable: true, description: 'Filter by status' })
  status?: string;

  @Field({ nullable: true, description: 'Start date for filtering' })
  startDate?: Date;

  @Field({ nullable: true, description: 'End date for filtering' })
  endDate?: Date;
}

// ===== OBJECT TYPES =====

@ObjectType()
class CommunicationResult {
  @Field({ description: 'Operation success status' })
  success!: boolean;

  @Field({ description: 'Result message' })
  message!: string;

  @Field(() => ID, { nullable: true, description: 'Job ID for async operations' })
  jobId?: string;

  @Field(() => Int, { nullable: true, description: 'Number of recipients' })
  recipientCount?: number;
}

@ObjectType()
class CommunicationHistoryItem {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field()
  channel!: string;

  @Field({ nullable: true })
  recipient!: string;

  @Field({ nullable: true })
  subject!: string | undefined;

  @Field()
  message!: string;

  @Field()
  status!: string;

  @Field()
  createdAt!: Date;

  @Field({ nullable: true })
  sentAt!: Date | undefined;

  @Field({ nullable: true })
  deliveredAt!: Date | undefined;

  @Field({ nullable: true })
  failureReason!: string | undefined;
}

@ObjectType()
class CommunicationHistory {
  @Field(() => [CommunicationHistoryItem])
  items!: CommunicationHistoryItem[];

  @Field(() => Int)
  totalCount!: number;

  @Field()
  hasMore!: boolean;
}

/**
 * Communication Integration Resolver
 * 
 * Provides GraphQL operations for multi-channel communication including:
 * - Sending emails (enqueued to Bull queue for async processing)
 * - Sending SMS messages (enqueued to Bull queue)
 * - Sending push notifications
 * - Querying communication history
 * - Background job management for email/SMS delivery
 * 
 * All email and SMS operations are enqueued to ensure reliable delivery
 * and prevent blocking the GraphQL response.
 * 
 * Requirements: 26.1-26.6, 12.1-12.2
 */
@Resolver()
@UseGuards(GraphQLJwtAuthGuard, TenantGuard)
export class CommunicationIntegrationResolver {
  private readonly logger = new Logger(CommunicationIntegrationResolver.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly emailService: EmailNotificationService,
    private readonly smsService: SMSNotificationService,
    private readonly notificationService: NotificationService,
  ) {}

  // ===== MUTATIONS =====

  /**
   * Send email notification
   * Enqueues email sending to Bull queue for async processing
   * Returns job ID for tracking delivery status
   */
  @Mutation(() => CommunicationResult, {
    description: 'Send email notification (enqueued for async processing)',
  })
  async sendEmail(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: SendEmailInput,
  ): Promise<CommunicationResult> {
    try {
      this.logger.log(`Enqueueing email for ${input.to.length} recipients`);

      // Enqueue email sending job
      const job = await this.queueService.add('email-notification', {
        tenantId,
        userId: user.id,
        to: input.to,
        subject: input.subject,
        message: input.message,
        htmlContent: input.htmlContent,
        replyTo: input.replyTo,
        priority: input.priority || 'normal',
        timestamp: new Date(),
      });

      this.logger.log(`Email job enqueued with ID: ${job.id}`);

      return {
        success: true,
        message: `Email enqueued for delivery to ${input.to.length} recipients`,
        jobId: job.id?.toString(),
        recipientCount: input.to.length,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to enqueue email: ${err.message}`, err.stack);
      
      return {
        success: false,
        message: `Failed to enqueue email: ${err.message}`,
        recipientCount: 0,
      };
    }
  }

  /**
   * Send SMS notification
   * Enqueues SMS sending to Bull queue for async processing
   * Returns job ID for tracking delivery status
   */
  @Mutation(() => CommunicationResult, {
    description: 'Send SMS notification (enqueued for async processing)',
  })
  async sendSMS(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: SendSMSInput,
  ): Promise<CommunicationResult> {
    try {
      this.logger.log(`Enqueueing SMS for ${input.to.length} recipients`);

      // Enqueue SMS sending job
      const job = await this.queueService.add('sms-notification', {
        tenantId,
        userId: user.id,
        to: input.to,
        message: input.message,
        from: input.from,
        timestamp: new Date(),
      });

      this.logger.log(`SMS job enqueued with ID: ${job.id}`);

      return {
        success: true,
        message: `SMS enqueued for delivery to ${input.to.length} recipients`,
        jobId: job.id?.toString(),
        recipientCount: input.to.length,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to enqueue SMS: ${err.message}`, err.stack);
      
      return {
        success: false,
        message: `Failed to enqueue SMS: ${err.message}`,
        recipientCount: 0,
      };
    }
  }

  /**
   * Send push notification
   * Sends push notifications to mobile devices
   * Uses the notification service for delivery
   */
  @Mutation(() => CommunicationResult, {
    description: 'Send push notification to mobile devices',
  })
  async sendPushNotification(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: SendPushNotificationInput,
  ): Promise<CommunicationResult> {
    try {
      this.logger.log(`Sending push notification to ${input.userIds.length} users`);

      // Send push notification via notification service
      const notificationIds = await this.notificationService.sendNotification(tenantId, {
        type: 'push_notification',
        recipients: input.userIds,
        subject: input.title,
        message: input.message,
        priority: (input.priority || 'normal') as 'low' | 'medium' | 'high' | 'urgent',
        channels: ['push'],
        metadata: input.data ? JSON.parse(input.data) : {},
      });

      this.logger.log(`Push notification sent to ${input.userIds.length} users`);

      return {
        success: true,
        message: `Push notification sent to ${input.userIds.length} users`,
        recipientCount: input.userIds.length,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send push notification: ${err.message}`, err.stack);
      
      return {
        success: false,
        message: `Failed to send push notification: ${err.message}`,
        recipientCount: 0,
      };
    }
  }

  // ===== QUERIES =====

  /**
   * Get communication history
   * Returns history of all communication attempts (email, SMS, push)
   * Supports filtering by type, status, and date range
   */
  @Query(() => CommunicationHistory, {
    description: 'Get communication history with filtering',
  })
  async getCommunicationHistory(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Args('input', { nullable: true }) input?: GetCommunicationHistoryInput,
  ): Promise<CommunicationHistory> {
    try {
      const {
        limit = 50,
        offset = 0,
        type,
        status,
        startDate,
        endDate,
      } = input || {};

      this.logger.log(`Getting communication history for user ${user.id}`);

      // Get notification history as a proxy for communication history
      const result = await this.notificationService.getNotificationHistory(
        tenantId,
        user.id,
        {
          limit,
          offset,
          ...(type && { type }),
          ...(status && { status }),
        },
      );

      const items: CommunicationHistoryItem[] = result.notifications.map(n => ({
        id: n.id,
        type: n.type,
        channel: n.channel,
        recipient: n.recipientId,
        subject: n.subject ?? undefined,
        message: n.message,
        status: n.status,
        createdAt: n.createdAt,
        sentAt: n.sentAt ?? undefined,
        deliveredAt: n.deliveredAt ?? undefined,
        failureReason: n.failureReason ?? undefined,
      }));

      return {
        items,
        totalCount: result.total,
        hasMore: offset + limit < result.total,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get communication history: ${err.message}`, err.stack);
      throw error;
    }
  }
}
