import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectDrizzle, DrizzleDB } from '../../database/drizzle.service';
import { integrationSettings } from '../../database/schema/tenant.schema';
import { eq, and } from 'drizzle-orm';
import { firstValueFrom } from 'rxjs';

export interface TeamsMessage {
  text?: string;
  summary?: string;
  themeColor?: string;
  sections?: TeamsSection[];
  potentialAction?: TeamsAction[];
}

export interface TeamsSection {
  activityTitle?: string;
  activitySubtitle?: string;
  activityImage?: string;
  facts?: Array<{
    name: string;
    value: string;
  }>;
  markdown?: boolean;
  text?: string;
}

export interface TeamsAction {
  '@type': 'OpenUri' | 'HttpPOST' | 'ActionCard';
  name: string;
  targets?: Array<{
    os: 'default' | 'iOS' | 'android' | 'windows';
    uri: string;
  }>;
  body?: string;
  method?: 'POST' | 'GET';
  headers?: Array<{
    name: string;
    value: string;
  }>;
}

export interface TeamsIntegrationConfig {
  webhookUrl: string;
  defaultTitle?: string;
  defaultThemeColor?: string;
  enableMentions?: boolean;
  mentionUsers?: string[];
  enableActivityImages?: boolean;
  activityImageUrl?: string;
}

@Injectable()
export class TeamsIntegrationService {
  private readonly logger = new Logger(TeamsIntegrationService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectDrizzle() private readonly db: DrizzleDB,
  ) {}

  /**
   * Send message to Microsoft Teams channel
   */
  async sendMessage(
    tenantId: string,
    message: TeamsMessage,
    options: {
      retryAttempts?: number;
      timeout?: number;
    } = {},
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { retryAttempts = 3, timeout = 10000 } = options;

      // Get Teams integration configuration
      const config = await this.getTeamsConfig(tenantId);
      if (!config) {
        return { success: false, error: 'Teams integration not configured' };
      }

      // Validate message
      const validationError = this.validateMessage(message);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Prepare message payload
      const payload = this.prepareMessagePayload(message, config);

      const result = await this.sendViaWebhook(config.webhookUrl, payload, { retryAttempts, timeout });

      if (result.success) {
        this.logger.log(`Teams message sent successfully`, {
          tenantId,
          messageId: result.messageId,
        });
      } else {
        this.logger.error(`Failed to send Teams message: ${result.error}`, undefined, {
          tenantId,
        });
      }

      return result;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Teams integration error: ${errorMessage}`, errorStack, {
        tenantId,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send notification as formatted Teams message
   */
  async sendNotification(
    tenantId: string,
    notification: {
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
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const config = await this.getTeamsConfig(tenantId);
      if (!config) {
        return { success: false, error: 'Teams integration not configured' };
      }

      // Create Teams message with rich formatting
      const teamsMessage: TeamsMessage = {
        summary: notification.title,
        themeColor: this.getPriorityColor(notification.priority),
        sections: [
          {
            activityTitle: notification.title,
            activitySubtitle: `Priority: ${notification.priority.toUpperCase()} | Type: ${notification.type}`,
            activityImage: config.activityImageUrl || 'https://platform.example.com/icon.png',
            text: notification.message,
            markdown: true,
            facts: [
              {
                name: 'Priority',
                value: notification.priority.toUpperCase(),
              },
              {
                name: 'Type',
                value: notification.type,
              },
              {
                name: 'Time',
                value: new Date().toLocaleString(),
              },
            ],
          },
        ],
      };

      // Add metadata facts if present
      if (notification.metadata && teamsMessage.sections?.[0]?.facts) {
        const metadataFacts = Object.entries(notification.metadata)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([key, value]) => ({
            name: this.formatFieldName(key),
            value: String(value),
          }));

        if (metadataFacts.length > 0) {
          teamsMessage.sections[0].facts.push(...metadataFacts);
        }
      }

      // Add actions if present
      if (notification.actions && notification.actions.length > 0) {
        const validActions = notification.actions
          .filter(action => action.url)
          .map(action => ({
            '@type': 'OpenUri' as const,
            name: action.label,
            targets: [
              {
                os: 'default' as const,
                uri: action.url!,
              },
            ],
          }));
        
        if (validActions.length > 0) {
          teamsMessage.potentialAction = validActions;
        }
      }

      return await this.sendMessage(tenantId, teamsMessage);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send Teams notification: ${errorMessage}`, errorStack, {
        tenantId,
        notificationType: notification.type,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send alert with enhanced formatting
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
    },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const config = await this.getTeamsConfig(tenantId);
      if (!config) {
        return { success: false, error: 'Teams integration not configured' };
      }

      const teamsMessage: TeamsMessage = {
        summary: `🚨 ${alert.title}`,
        themeColor: this.getSeverityColor(alert.severity),
        sections: [
          {
            activityTitle: `🚨 ${alert.title}`,
            activitySubtitle: `Severity: ${alert.severity.toUpperCase()}`,
            activityImage: config.activityImageUrl || 'https://platform.example.com/alert-icon.png',
            text: alert.message,
            markdown: true,
            facts: [
              {
                name: 'Severity',
                value: alert.severity.toUpperCase(),
              },
              {
                name: 'Alert Time',
                value: new Date().toLocaleString(),
              },
              {
                name: 'System',
                value: 'Business Platform',
              },
            ],
          },
        ],
      };

      // Add metadata facts
      if (alert.metadata && teamsMessage.sections?.[0]?.facts) {
        const metadataFacts = Object.entries(alert.metadata)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([key, value]) => ({
            name: this.formatFieldName(key),
            value: String(value),
          }));

        if (metadataFacts.length > 0) {
          teamsMessage.sections[0].facts.push(...metadataFacts);
        }
      }

      // Add action if provided
      if (alert.actionUrl && alert.actionLabel) {
        teamsMessage.potentialAction = [
          {
            '@type': 'OpenUri',
            name: alert.actionLabel,
            targets: [
              {
                os: 'default',
                uri: alert.actionUrl,
              },
            ],
          },
        ];
      }

      return await this.sendMessage(tenantId, teamsMessage);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send Teams alert: ${errorMessage}`, errorStack, {
        tenantId,
        severity: alert.severity,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send rich card with multiple sections
   */
  async sendRichCard(
    tenantId: string,
    card: {
      title: string;
      subtitle?: string;
      summary?: string;
      themeColor?: string;
      sections: Array<{
        title?: string;
        subtitle?: string;
        text?: string;
        facts?: Array<{ name: string; value: string }>;
        image?: string;
      }>;
      actions?: Array<{
        type: 'OpenUri' | 'HttpPOST';
        name: string;
        url?: string;
        method?: 'POST' | 'GET';
        body?: string;
      }>;
    },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const config = await this.getTeamsConfig(tenantId);
      if (!config) {
        return { success: false, error: 'Teams integration not configured' };
      }

      const teamsMessage: TeamsMessage = {
        summary: card.summary || card.title,
        themeColor: card.themeColor || config.defaultThemeColor || '0078D4',
        sections: card.sections.map(section => ({
          ...(section.title && { activityTitle: section.title }),
          ...(section.subtitle && { activitySubtitle: section.subtitle }),
          ...(section.image && { activityImage: section.image }),
          ...(section.text && { text: section.text }),
          ...(section.facts && { facts: section.facts }),
          markdown: true,
        })),
      };

      // Add actions if provided
      if (card.actions && card.actions.length > 0) {
        const actions: TeamsAction[] = [];
        
        for (const action of card.actions) {
          if (action.type === 'OpenUri' && action.url) {
            actions.push({
              '@type': 'OpenUri',
              name: action.name,
              targets: [
                {
                  os: 'default',
                  uri: action.url,
                },
              ],
            });
          } else if (action.type === 'HttpPOST' && action.body && action.method) {
            actions.push({
              '@type': 'HttpPOST',
              name: action.name,
              body: action.body,
              method: action.method as 'GET' | 'POST',
            });
          }
        }
        
        if (actions.length > 0) {
          teamsMessage.potentialAction = actions;
        }
      }

      return await this.sendMessage(tenantId, teamsMessage);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send Teams rich card: ${errorMessage}`, errorStack, {
        tenantId,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Configure Teams integration for tenant
   */
  async configureIntegration(
    tenantId: string,
    config: TeamsIntegrationConfig,
    updatedBy: string,
  ): Promise<void> {
    try {
      // Validate configuration
      const validationError = this.validateConfig(config);
      if (validationError) {
        throw new Error(`Invalid Teams configuration: ${validationError}`);
      }

      // Test the configuration
      const testResult = await this.testConfiguration(config);
      if (!testResult.success) {
        throw new Error(`Teams configuration test failed: ${testResult.error}`);
      }

      // Save configuration
      await this.db
        .insert(integrationSettings)
        .values({
          id: `teams_${tenantId}`,
          tenantId,
          integrationType: 'teams',
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

      this.logger.log(`Teams integration configured for tenant ${tenantId}`);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to configure Teams integration: ${errorMessage}`, errorStack, {
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Test Teams configuration
   */
  async testConfiguration(config: TeamsIntegrationConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const testMessage: TeamsMessage = {
        summary: 'Test message from Business Platform',
        themeColor: '0078D4',
        sections: [
          {
            activityTitle: 'Configuration Test',
            activitySubtitle: 'Microsoft Teams Integration',
            text: 'If you can see this message, your Teams integration is working correctly!',
            facts: [
              {
                name: 'Status',
                value: 'Test Successful',
              },
              {
                name: 'Time',
                value: new Date().toLocaleString(),
              },
            ],
          },
        ],
      };

      const payload = this.prepareMessagePayload(testMessage, config);
      return await this.sendViaWebhook(config.webhookUrl, payload, { retryAttempts: 1, timeout: 5000 });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Private helper methods
   */

  private async getTeamsConfig(tenantId: string): Promise<TeamsIntegrationConfig | null> {
    try {
      const [integration] = await this.db
        .select()
        .from(integrationSettings)
        .where(and(
          eq(integrationSettings.tenantId, tenantId),
          eq(integrationSettings.integrationType, 'teams'),
          eq(integrationSettings.isEnabled, true),
        ));

      return integration ? (integration.configuration as TeamsIntegrationConfig) : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get Teams config: ${errorMessage}`, errorStack);
      return null;
    }
  }

  private validateMessage(message: TeamsMessage): string | null {
    if (!message.text && (!message.sections || message.sections.length === 0)) {
      return 'Message must have text or sections';
    }

    return null;
  }

  private validateConfig(config: TeamsIntegrationConfig): string | null {
    if (!config.webhookUrl) {
      return 'Webhook URL is required';
    }

    if (!config.webhookUrl.includes('outlook.office.com') && !config.webhookUrl.includes('outlook.office365.com')) {
      return 'Invalid Teams webhook URL format';
    }

    return null;
  }

  private prepareMessagePayload(message: TeamsMessage, config: TeamsIntegrationConfig): any {
    return {
      ...message,
      themeColor: message.themeColor || config.defaultThemeColor || '0078D4',
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
          return { success: true, messageId: `teams_${Date.now()}` };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error: unknown) {
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
        return 'FF0000'; // Red
      case 'high':
        return 'FF8C00'; // Orange
      case 'medium':
        return '0078D4'; // Blue
      case 'low':
        return '00B294'; // Green
      default:
        return '0078D4';
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'FF0000'; // Red
      case 'error':
        return 'FF4B4B'; // Light Red
      case 'warning':
        return 'FF8C00'; // Orange
      case 'info':
        return '0078D4'; // Blue
      default:
        return '0078D4';
    }
  }

  private formatFieldName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}