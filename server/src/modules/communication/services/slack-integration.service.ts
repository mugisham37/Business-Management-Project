import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectDrizzle, DrizzleDB } from '../../database/drizzle.service';
import { integrationSettings } from '../../database/schema/tenant.schema';
import { eq, and } from 'drizzle-orm';
import { firstValueFrom } from 'rxjs';

export interface SlackMessage {
  channel: string;
  text: string;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
  attachments?: SlackAttachment[];
  blocks?: SlackBlock[];
  thread_ts?: string;
  reply_broadcast?: boolean;
}

export interface SlackAttachment {
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
  actions?: SlackAction[];
}

export interface SlackAction {
  type: 'button' | 'select';
  text: string;
  url?: string;
  value?: string;
  style?: 'default' | 'primary' | 'danger';
  confirm?: {
    title: string;
    text: string;
    ok_text?: string;
    dismiss_text?: string;
  };
}

export interface SlackBlock {
  type: string;
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  elements?: any[];
  accessory?: any;
}

export interface SlackIntegrationConfig {
  webhookUrl: string;
  botToken?: string;
  defaultChannel?: string;
  username?: string;
  iconEmoji?: string;
  iconUrl?: string;
  enableThreads?: boolean;
  enableMentions?: boolean;
  mentionUsers?: string[];
  mentionChannels?: string[];
}

@Injectable()
export class SlackIntegrationService {
  private readonly logger = new Logger(SlackIntegrationService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectDrizzle() private readonly db: DrizzleDB,
  ) {}

  /**
   * Send message to Slack channel
   */
  async sendMessage(
    tenantId: string,
    message: SlackMessage,
    options: {
      useWebhook?: boolean;
      retryAttempts?: number;
      timeout?: number;
    } = {},
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { useWebhook = true, retryAttempts = 3, timeout = 10000 } = options;

      // Get Slack integration configuration
      const config = await this.getSlackConfig(tenantId);
      if (!config) {
        return { success: false, error: 'Slack integration not configured' };
      }

      // Validate message
      const validationError = this.validateMessage(message);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Prepare message payload
      const payload = this.prepareMessagePayload(message, config);

      let result: { success: boolean; messageId?: string; error?: string };

      if (useWebhook && config.webhookUrl) {
        result = await this.sendViaWebhook(config.webhookUrl, payload, { retryAttempts, timeout });
      } else if (config.botToken) {
        result = await this.sendViaAPI(config.botToken, payload, { retryAttempts, timeout });
      } else {
        return { success: false, error: 'No webhook URL or bot token configured' };
      }

      if (result.success) {
        this.logger.log(`Slack message sent successfully`, {
          tenantId,
          channel: message.channel,
          messageId: result.messageId,
        });
      } else {
        this.logger.error(`Failed to send Slack message: ${result.error}`, undefined, {
          tenantId,
          channel: message.channel,
        });
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Slack integration error: ${errorMessage}`, errorStack, {
        tenantId,
        channel: message.channel,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send notification as formatted Slack message
   */
  async sendNotification(
    tenantId: string,
    notification: {
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
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const config = await this.getSlackConfig(tenantId);
      if (!config) {
        return { success: false, error: 'Slack integration not configured' };
      }

      const channel = notification.channel || config.defaultChannel || '#general';
      
      // Create Slack message with rich formatting
      const slackMessage: SlackMessage = {
        channel,
        text: notification.title,
        attachments: [
          {
            color: this.getPriorityColor(notification.priority),
            title: notification.title,
            text: notification.message,
            fields: [
              {
                title: 'Priority',
                value: notification.priority.toUpperCase(),
                short: true,
              },
              {
                title: 'Type',
                value: notification.type,
                short: true,
              },
            ],
            footer: 'Business Platform',
            footer_icon: 'https://platform.example.com/icon.png',
            ts: Math.floor(Date.now() / 1000),
            ...(notification.actions?.some(action => action.url) && {
              actions: notification.actions.filter(action => action.url).map(action => ({
                type: 'button' as const,
                text: action.label,
                url: action.url!,
                style: this.mapActionStyle(action.style),
              }))
            }),
          },
        ],
      };

      // Add metadata fields if present
      if (notification.metadata && slackMessage.attachments?.[0]?.fields) {
        const metadataFields = Object.entries(notification.metadata)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([key, value]) => ({
            title: this.formatFieldName(key),
            value: String(value),
            short: true,
          }));

        if (metadataFields.length > 0) {
          slackMessage.attachments[0].fields.push(...metadataFields);
        }
      }

      return await this.sendMessage(tenantId, slackMessage);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send Slack notification: ${errorMessage}`, errorStack, {
        tenantId,
        notificationType: notification.type,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send alert with mention support
   */
  async sendAlert(
    tenantId: string,
    alert: {
      title: string;
      message: string;
      severity: 'info' | 'warning' | 'error' | 'critical';
      channel?: string;
      mentionUsers?: string[];
      mentionChannel?: boolean;
      metadata?: Record<string, any>;
    },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const config = await this.getSlackConfig(tenantId);
      if (!config) {
        return { success: false, error: 'Slack integration not configured' };
      }

      const channel = alert.channel || config.defaultChannel || '#alerts';
      
      // Build mention text
      let mentionText = '';
      if (alert.mentionChannel) {
        mentionText += '<!channel> ';
      }
      if (alert.mentionUsers && alert.mentionUsers.length > 0) {
        mentionText += alert.mentionUsers.map(user => `<@${user}>`).join(' ') + ' ';
      }

      const slackMessage: SlackMessage = {
        channel,
        text: `${mentionText}${alert.title}`,
        attachments: [
          {
            color: this.getSeverityColor(alert.severity),
            title: `🚨 ${alert.title}`,
            text: alert.message,
            fields: [
              {
                title: 'Severity',
                value: alert.severity.toUpperCase(),
                short: true,
              },
              {
                title: 'Time',
                value: new Date().toISOString(),
                short: true,
              },
            ],
            footer: 'Business Platform Alert System',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      // Add metadata fields
      if (alert.metadata && slackMessage.attachments?.[0]?.fields) {
        const metadataFields = Object.entries(alert.metadata)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([key, value]) => ({
            title: this.formatFieldName(key),
            value: String(value),
            short: true,
          }));

        if (metadataFields.length > 0) {
          slackMessage.attachments[0].fields.push(...metadataFields);
        }
      }

      return await this.sendMessage(tenantId, slackMessage);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send Slack alert: ${errorMessage}`, errorStack, {
        tenantId,
        severity: alert.severity,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Configure Slack integration for tenant
   */
  async configureIntegration(
    tenantId: string,
    config: SlackIntegrationConfig,
    updatedBy: string,
  ): Promise<void> {
    try {
      // Validate configuration
      const validationError = this.validateConfig(config);
      if (validationError) {
        throw new Error(`Invalid Slack configuration: ${validationError}`);
      }

      // Test the configuration
      const testResult = await this.testConfiguration(config);
      if (!testResult.success) {
        throw new Error(`Slack configuration test failed: ${testResult.error}`);
      }

      // Save configuration
      await this.db
        .insert(integrationSettings)
        .values({
          id: `slack_${tenantId}`,
          tenantId,
          integrationType: 'slack',
          isEnabled: true,
          configuration: config,
          createdBy: updatedBy,
          updatedBy: updatedBy,
        })
        .onConflictDoUpdate({
          target: [integrationSettings.tenantId, integrationSettings.integrationType],
          set: {
            configuration: config,
            isEnabled: true,
            updatedAt: new Date(),
            updatedBy: updatedBy,
          },
        });

      this.logger.log(`Slack integration configured for tenant ${tenantId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to configure Slack integration: ${errorMessage}`, errorStack, {
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Test Slack configuration
   */
  async testConfiguration(config: SlackIntegrationConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const testMessage: SlackMessage = {
        channel: config.defaultChannel || '#general',
        text: 'Test message from Business Platform',
        attachments: [
          {
            color: 'good',
            title: 'Configuration Test',
            text: 'If you can see this message, your Slack integration is working correctly!',
            footer: 'Business Platform',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      const payload = this.prepareMessagePayload(testMessage, config);

      if (config.webhookUrl) {
        return await this.sendViaWebhook(config.webhookUrl, payload, { retryAttempts: 1, timeout: 5000 });
      } else if (config.botToken) {
        return await this.sendViaAPI(config.botToken, payload, { retryAttempts: 1, timeout: 5000 });
      } else {
        return { success: false, error: 'No webhook URL or bot token provided' };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Private helper methods
   */

  private async getSlackConfig(tenantId: string): Promise<SlackIntegrationConfig | null> {
    try {
      const [integration] = await this.db
        .select()
        .from(integrationSettings)
        .where(and(
          eq(integrationSettings.tenantId, tenantId),
          eq(integrationSettings.integrationType, 'slack'),
          eq(integrationSettings.isEnabled, true),
        ));

      return integration ? (integration.configuration as SlackIntegrationConfig) : null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get Slack config: ${errorMessage}`, errorStack);
      return null;
    }
  }

  private validateMessage(message: SlackMessage): string | null {
    if (!message.channel) {
      return 'Channel is required';
    }

    if (!message.text && (!message.attachments || message.attachments.length === 0)) {
      return 'Message must have text or attachments';
    }

    if (message.channel && !message.channel.startsWith('#') && !message.channel.startsWith('@')) {
      return 'Channel must start with # or @';
    }

    return null;
  }

  private validateConfig(config: SlackIntegrationConfig): string | null {
    if (!config.webhookUrl && !config.botToken) {
      return 'Either webhook URL or bot token is required';
    }

    if (config.webhookUrl && !config.webhookUrl.startsWith('https://hooks.slack.com/')) {
      return 'Invalid Slack webhook URL format';
    }

    if (config.botToken && !config.botToken.startsWith('xoxb-')) {
      return 'Invalid Slack bot token format';
    }

    return null;
  }

  private prepareMessagePayload(message: SlackMessage, config: SlackIntegrationConfig): any {
    return {
      ...message,
      username: message.username || config.username || 'Business Platform',
      icon_emoji: message.icon_emoji || config.iconEmoji,
      icon_url: message.icon_url || config.iconUrl,
    };
  }

  private async sendViaWebhook(
    webhookUrl: string,
    payload: any,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    for (let attempt = 1; attempt <= options.retryAttempts; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(webhookUrl, payload, {
            timeout: options.timeout,
            headers: {
              'Content-Type': 'application/json',
            },
          }),
        );

        if (response.status === 200) {
          return { success: true, messageId: `webhook_${Date.now()}` };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        if (attempt === options.retryAttempts) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMessage };
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    return { success: false, error: 'Max retry attempts exceeded' };
  }

  private async sendViaAPI(
    botToken: string,
    payload: any,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    for (let attempt = 1; attempt <= options.retryAttempts; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.post('https://slack.com/api/chat.postMessage', payload, {
            timeout: options.timeout,
            headers: {
              'Authorization': `Bearer ${botToken}`,
              'Content-Type': 'application/json',
            },
          }),
        );

        if (response.data.ok) {
          return { success: true, messageId: response.data.ts };
        } else {
          throw new Error(`Slack API error: ${response.data.error}`);
        }

      } catch (error) {
        if (attempt === options.retryAttempts) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMessage };
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    return { success: false, error: 'Max retry attempts exceeded' };
  }

  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'good';
      case 'low':
        return '#36a64f';
      default:
        return 'good';
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'error':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'info':
        return 'good';
      default:
        return 'good';
    }
  }

  private mapActionStyle(style?: string): 'default' | 'primary' | 'danger' {
    switch (style) {
      case 'primary':
        return 'primary';
      case 'danger':
        return 'danger';
      default:
        return 'default';
    }
  }

  private formatFieldName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}