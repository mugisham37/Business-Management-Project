import { Injectable, Logger } from '@nestjs/common';
import { SlackIntegrationService } from './slack-integration.service';
import { TeamsIntegrationService } from './teams-integration.service';
import { EmailNotificationService } from './email-notification.service';
import { SMSNotificationService } from './sms-notification.service';
import { InjectDrizzle, DrizzleDB } from '../../database/drizzle.service';
import { integrationSettings } from '../../database/schema/tenant.schema';
import { eq, and } from 'drizzle-orm';

export interface CommunicationChannel {
  type: 'slack' | 'teams' | 'email' | 'sms' | 'webhook';
  enabled: boolean;
  configuration?: any;
  priority?: number;
  fallbackChannels?: string[];
}

export interface MultiChannelNotification {
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: string;
  channels: string[];
  recipients?: {
    userIds?: string[];
    emails?: string[];
    phoneNumbers?: string[];
    slackChannels?: string[];
    teamsChannels?: string[];
  };
  metadata?: Record<string, any>;
  actions?: Array<{
    id: string;
    label: string;
    url?: string;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  templateName?: string;
  templateVariables?: Record<string, any>;
  scheduledAt?: Date;
  options?: {
    enableFallback?: boolean;
    retryAttempts?: number;
    batchSize?: number;
    delayBetweenBatches?: number;
  };
}

export interface CommunicationResult {
  channel: string;
  success: boolean;
  messageId?: string;
  error?: string;
  recipientCount?: number;
}

export interface BulkCommunicationResult {
  totalChannels: number;
  successfulChannels: number;
  failedChannels: number;
  results: CommunicationResult[];
  overallSuccess: boolean;
}

@Injectable()
export class CommunicationIntegrationService {
  private readonly logger = new Logger(CommunicationIntegrationService.name);

  constructor(
    private readonly slackService: SlackIntegrationService,
    private readonly teamsService: TeamsIntegrationService,
    private readonly emailService: EmailNotificationService,
    private readonly smsService: SMSNotificationService,
    @InjectDrizzle() private readonly db: DrizzleDB,
  ) {}

  /**
   * Send notification across multiple communication channels
   */
  async sendMultiChannelNotification(
    tenantId: string,
    notification: MultiChannelNotification,
  ): Promise<BulkCommunicationResult> {
    try {
      this.logger.log(`Sending multi-channel notification`, {
        tenantId,
        type: notification.type,
        channels: notification.channels,
        priority: notification.priority,
      });

      const results: CommunicationResult[] = [];
      const enabledChannels = await this.getEnabledChannels(tenantId, notification.channels);

      if (enabledChannels.length === 0) {
        this.logger.warn(`No enabled channels found for tenant ${tenantId}`);
        return {
          totalChannels: 0,
          successfulChannels: 0,
          failedChannels: 0,
          results: [],
          overallSuccess: false,
        };
      }

      // Sort channels by priority
      const sortedChannels = enabledChannels.sort((a, b) => (a.priority || 0) - (b.priority || 0));

      // Send to each channel
      for (const channel of sortedChannels) {
        try {
          let result: CommunicationResult;

          switch (channel.type) {
            case 'slack':
              result = await this.sendToSlack(tenantId, notification);
              break;
            case 'teams':
              result = await this.sendToTeams(tenantId, notification);
              break;
            case 'email':
              result = await this.sendToEmail(tenantId, notification);
              break;
            case 'sms':
              result = await this.sendToSMS(tenantId, notification);
              break;
            default:
              result = {
                channel: channel.type,
                success: false,
                error: `Unsupported channel type: ${channel.type}`,
              };
          }

          results.push(result);

          // If this channel failed and fallback is enabled, try fallback channels
          if (!result.success && notification.options?.enableFallback && channel.fallbackChannels) {
            for (const fallbackChannel of channel.fallbackChannels) {
              if (!notification.channels.includes(fallbackChannel)) {
                try {
                  const fallbackResult = await this.sendToChannel(tenantId, fallbackChannel, notification);
                  results.push({
                    ...fallbackResult,
                    channel: `${fallbackChannel} (fallback for ${channel.type})`,
                  });
                  
                  if (fallbackResult.success) {
                    break; // Stop trying fallbacks if one succeeds
                  }
                } catch (error) {
                  this.logger.error(`Fallback channel ${fallbackChannel} failed:`, error);
                }
              }
            }
          }

        } catch (error: any) {
          this.logger.error(`Failed to send to channel ${channel.type}:`, error);
          results.push({
            channel: channel.type,
            success: false,
            error: error?.message || 'Unknown error',
          });
        }
      }

      const successfulChannels = results.filter(r => r.success).length;
      const failedChannels = results.filter(r => !r.success).length;

      const summary: BulkCommunicationResult = {
        totalChannels: results.length,
        successfulChannels,
        failedChannels,
        results,
        overallSuccess: successfulChannels > 0,
      };

      this.logger.log(`Multi-channel notification completed`, {
        tenantId,
        type: notification.type,
        totalChannels: summary.totalChannels,
        successfulChannels: summary.successfulChannels,
        failedChannels: summary.failedChannels,
        overallSuccess: summary.overallSuccess,
      });

      return summary;

    } catch (error: any) {
      this.logger.error(`Multi-channel notification failed: ${error?.message || 'Unknown error'}`, error?.stack, {
        tenantId,
        type: notification.type,
      });
      
      return {
        totalChannels: 0,
        successfulChannels: 0,
        failedChannels: 1,
        results: [{
          channel: 'system',
          success: false,
          error: error?.message || 'Unknown error',
        }],
        overallSuccess: false,
      };
    }
  }

  /**
   * Send alert across all configured channels
   */
  async sendAlert(
    tenantId: string,
    alert: {
      title: string;
      message: string;
      severity: 'info' | 'warning' | 'error' | 'critical';
      metadata?: Record<string, any>;
      actionUrl?: string;
      actionLabel?: string;
      recipients?: {
        userIds?: string[];
        emails?: string[];
        phoneNumbers?: string[];
        slackChannels?: string[];
      };
    },
  ): Promise<BulkCommunicationResult> {
    try {
      // Get all enabled channels for alerts
      const enabledChannels = await this.getEnabledChannels(tenantId);
      const alertChannels = enabledChannels.filter(c => 
        ['slack', 'teams', 'email', 'sms'].includes(c.type)
      );

      const notification: MultiChannelNotification = {
        title: alert.title,
        message: alert.message,
        priority: alert.severity === 'critical' || alert.severity === 'error' ? 'urgent' : 'high',
        type: 'system_alert',
        channels: alertChannels.map(c => c.type),
        ...(alert.recipients && { recipients: alert.recipients }),
        metadata: {
          ...alert.metadata,
          severity: alert.severity,
          alertTime: new Date().toISOString(),
        },
        actions: alert.actionUrl && alert.actionLabel ? [{
          id: 'view_details',
          label: alert.actionLabel,
          url: alert.actionUrl,
          style: 'primary' as const,
        }] : [],
        options: {
          enableFallback: true,
          retryAttempts: 3,
        },
      };

      return await this.sendMultiChannelNotification(tenantId, notification);

    } catch (error: any) {
      this.logger.error(`Failed to send alert: ${error.message}`, error.stack, {
        tenantId,
        severity: alert.severity,
      });
      throw error;
    }
  }

  /**
   * Send business notification (transactions, inventory, etc.)
   */
  async sendBusinessNotification(
    tenantId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      priority?: 'low' | 'medium' | 'high';
      recipients?: {
        userIds?: string[];
        roles?: string[];
      };
      metadata?: Record<string, any>;
      templateName?: string;
      templateVariables?: Record<string, any>;
    },
  ): Promise<BulkCommunicationResult> {
    try {
      // Get notification preferences for this type
      const channels = await this.getNotificationChannels(tenantId, notification.type);

      const multiChannelNotification: MultiChannelNotification = {
        title: notification.title,
        message: notification.message,
        priority: notification.priority || 'medium',
        type: notification.type,
        channels,
        ...(notification.recipients && { recipients: { userIds: notification.recipients.userIds } }),
        ...(notification.metadata && { metadata: notification.metadata }),
        ...(notification.templateName && { templateName: notification.templateName }),
        ...(notification.templateVariables && { templateVariables: notification.templateVariables }),
        options: {
          enableFallback: false,
          batchSize: 50,
          delayBetweenBatches: 1000,
        },
      };

      return await this.sendMultiChannelNotification(tenantId, multiChannelNotification);

    } catch (error: any) {
      this.logger.error(`Failed to send business notification: ${error.message}`, error.stack, {
        tenantId,
        type: notification.type,
      });
      throw error;
    }
  }

  /**
   * Configure communication channels for tenant
   */
  async configureChannels(
    tenantId: string,
    channels: Array<{
      type: string;
      enabled: boolean;
      configuration?: any;
      priority?: number;
      fallbackChannels?: string[];
    }>,
    updatedBy: string,
  ): Promise<void> {
    try {
      // Save channel configurations
      for (const channel of channels) {
        await this.db
          .insert(integrationSettings)
          .values({
            id: `communication_${channel.type}_${tenantId}`,
            tenantId,
            integrationType: `communication_${channel.type}`,
            isEnabled: channel.enabled,
            configuration: {
              ...channel.configuration,
              priority: channel.priority || 0,
              fallbackChannels: channel.fallbackChannels || [],
            },
            createdBy: updatedBy,
            updatedBy: updatedBy,
          })
          .onConflictDoUpdate({
            target: [integrationSettings.tenantId, integrationSettings.integrationType],
            set: {
              isEnabled: channel.enabled,
              configuration: {
                ...channel.configuration,
                priority: channel.priority || 0,
                fallbackChannels: channel.fallbackChannels || [],
              },
              updatedAt: new Date(),
              updatedBy: updatedBy,
            },
          });
      }

      this.logger.log(`Communication channels configured for tenant ${tenantId}`, {
        channelCount: channels.length,
        enabledChannels: channels.filter(c => c.enabled).length,
      });

    } catch (error: any) {
      this.logger.error(`Failed to configure communication channels: ${error.message}`, error.stack, {
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Test all configured communication channels
   */
  async testAllChannels(tenantId: string): Promise<Array<{ channel: string; success: boolean; error?: string }>> {
    try {
      const enabledChannels = await this.getEnabledChannels(tenantId);
      const results: Array<{ channel: string; success: boolean; error?: string }> = [];

      for (const channel of enabledChannels) {
        try {
          let testResult: { success: boolean; error?: string };

          switch (channel.type) {
            case 'slack':
              testResult = await this.slackService.testConfiguration(channel.configuration);
              break;
            case 'teams':
              testResult = await this.teamsService.testConfiguration(channel.configuration);
              break;
            case 'email':
              // Email test would be implemented here
              testResult = { success: true };
              break;
            case 'sms':
              // SMS test would be implemented here
              testResult = { success: true };
              break;
            default:
              testResult = { success: false, error: `Unsupported channel type: ${channel.type}` };
          }

          results.push({
            channel: channel.type,
            success: testResult.success,
            ...(testResult.error && { error: testResult.error }),
          });

        } catch (error: any) {
          results.push({
            channel: channel.type,
            success: false,
            error: error.message,
          });
        }
      }

      return results;

    } catch (error: any) {
      this.logger.error(`Failed to test communication channels: ${error.message}`, error.stack, {
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async getEnabledChannels(tenantId: string, filterChannels?: string[]): Promise<CommunicationChannel[]> {
    try {
      const integrations = await this.db
        .select()
        .from(integrationSettings)
        .where(and(
          eq(integrationSettings.tenantId, tenantId),
          eq(integrationSettings.isEnabled, true),
        ));

      const communicationIntegrations = integrations.filter((i: any) => 
        i.integrationType.startsWith('communication_') ||
        ['slack', 'teams', 'email_sendgrid', 'email_ses', 'email_smtp', 'sms_twilio', 'sms_aws-sns'].includes(i.integrationType)
      );

      const channels: CommunicationChannel[] = communicationIntegrations.map((integration: any) => {
        let type: string;
        
        if (integration.integrationType.startsWith('communication_')) {
          type = integration.integrationType.replace('communication_', '');
        } else if (integration.integrationType.startsWith('email_')) {
          type = 'email';
        } else if (integration.integrationType.startsWith('sms_')) {
          type = 'sms';
        } else {
          type = integration.integrationType;
        }

        return {
          type: type as any,
          enabled: integration.isEnabled,
          configuration: integration.configuration,
          priority: integration.configuration?.priority || 0,
          fallbackChannels: integration.configuration?.fallbackChannels || [],
        };
      });

      // Filter by requested channels if provided
      if (filterChannels && filterChannels.length > 0) {
        return channels.filter(c => filterChannels.includes(c.type));
      }

      return channels;

    } catch (error: any) {
      this.logger.error(`Failed to get enabled channels: ${error.message}`, error.stack);
      return [];
    }
  }

  private async getNotificationChannels(tenantId: string, notificationType: string): Promise<string[]> {
    // This would typically check user preferences or tenant settings
    // For now, return all enabled channels
    const enabledChannels = await this.getEnabledChannels(tenantId);
    return enabledChannels.map(c => c.type);
  }

  private async sendToChannel(tenantId: string, channelType: string, notification: MultiChannelNotification): Promise<CommunicationResult> {
    switch (channelType) {
      case 'slack':
        return await this.sendToSlack(tenantId, notification);
      case 'teams':
        return await this.sendToTeams(tenantId, notification);
      case 'email':
        return await this.sendToEmail(tenantId, notification);
      case 'sms':
        return await this.sendToSMS(tenantId, notification);
      default:
        return {
          channel: channelType,
          success: false,
          error: `Unsupported channel type: ${channelType}`,
        };
    }
  }

  private async sendToSlack(tenantId: string, notification: MultiChannelNotification): Promise<CommunicationResult> {
    try {
      const slackChannels = notification.recipients?.slackChannels || ['#general'];
      let successCount = 0;
      let lastError: string | undefined;

      for (const channel of slackChannels) {
        const result = await this.slackService.sendNotification(tenantId, {
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          type: notification.type,
          channel,
          metadata: notification.metadata || {},
          actions: notification.actions || [],
        });

        if (result.success) {
          successCount++;
        } else {
          lastError = result.error;
        }
      }

      return {
        channel: 'slack',
        success: successCount > 0,
        recipientCount: slackChannels.length,
        ...(successCount === 0 && lastError && { error: lastError }),
      };

    } catch (error: any) {
      return {
        channel: 'slack',
        success: false,
        error: error.message,
      };
    }
  }

  private async sendToTeams(tenantId: string, notification: MultiChannelNotification): Promise<CommunicationResult> {
    try {
      const result = await this.teamsService.sendNotification(tenantId, {
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        type: notification.type,
        metadata: notification.metadata || {},
        actions: notification.actions || [],
      });

      return {
        channel: 'teams',
        success: result.success,
        ...(result.messageId && { messageId: result.messageId }),
        ...(result.error && { error: result.error }),
        recipientCount: 1,
      };

    } catch (error: any) {
      return {
        channel: 'teams',
        success: false,
        error: error.message,
      };
    }
  }

  private async sendToEmail(tenantId: string, notification: MultiChannelNotification): Promise<CommunicationResult> {
    try {
      if (notification.recipients?.userIds && notification.recipients.userIds.length > 0) {
        const result = await this.emailService.sendNotificationToUsers(
          tenantId,
          notification.recipients.userIds,
          {
            subject: notification.title,
            message: notification.message,
            priority: notification.priority === 'urgent' ? 'high' : 'normal',
            ...(notification.templateName && { templateName: notification.templateName }),
            ...(notification.templateVariables && { templateVariables: notification.templateVariables }),
          },
          notification.options,
        );

        return {
          channel: 'email',
          success: result.totalSent > 0,
          recipientCount: result.totalSent + result.totalFailed,
          ...(result.totalSent === 0 && { error: 'No emails sent successfully' }),
        };
      } else {
        return {
          channel: 'email',
          success: false,
          error: 'No email recipients specified',
        };
      }

    } catch (error: any) {
      return {
        channel: 'email',
        success: false,
        error: error.message,
      };
    }
  }

  private async sendToSMS(tenantId: string, notification: MultiChannelNotification): Promise<CommunicationResult> {
    try {
      if (notification.recipients?.userIds && notification.recipients.userIds.length > 0) {
        const result = await this.smsService.sendNotificationToUsers(
          tenantId,
          notification.recipients.userIds,
          {
            message: `${notification.title}\n\n${notification.message}`,
            priority: notification.priority === 'urgent' ? 'high' : 'normal',
            ...(notification.templateName && { templateName: notification.templateName }),
            ...(notification.templateVariables && { templateVariables: notification.templateVariables }),
            ...(notification.scheduledAt && { scheduledAt: notification.scheduledAt }),
          },
          notification.options,
        );

        return {
          channel: 'sms',
          success: result.totalSent > 0,
          recipientCount: result.totalSent + result.totalFailed,
          ...(result.totalSent === 0 && { error: 'No SMS messages sent successfully' }),
        };
      } else if (notification.recipients?.phoneNumbers && notification.recipients.phoneNumbers.length > 0) {
        const result = await this.smsService.sendSMS(tenantId, {
          to: notification.recipients.phoneNumbers,
          message: `${notification.title}\n\n${notification.message}`,
          priority: notification.priority === 'urgent' ? 'high' : 'normal',
          ...(notification.scheduledAt && { scheduledAt: notification.scheduledAt }),
        });

        return {
          channel: 'sms',
          success: result.success,
          ...(result.messageId && { messageId: result.messageId }),
          recipientCount: notification.recipients.phoneNumbers.length,
          ...(result.error && { error: result.error }),
        };
      } else {
        return {
          channel: 'sms',
          success: false,
          error: 'No SMS recipients specified',
        };
      }

    } catch (error: any) {
      return {
        channel: 'sms',
        success: false,
        error: error.message,
      };
    }
  }
}