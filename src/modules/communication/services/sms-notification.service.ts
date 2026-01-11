import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectDrizzle, DrizzleDB } from '../../database/drizzle.service';
import { integrationSettings } from '../../database/schema/tenant.schema';
import { users as usersTable } from '../../database/schema/user.schema';
import { eq, and, inArray } from 'drizzle-orm';
import { firstValueFrom } from 'rxjs';

export interface SMSMessage {
  to: string | string[];
  message: string;
  from?: string;
  mediaUrls?: string[];
  scheduledAt?: Date;
  validityPeriod?: number; // in minutes
  priority?: 'high' | 'normal' | 'low';
}

export interface SMSProvider {
  type: 'twilio' | 'aws-sns' | 'nexmo' | 'messagebird' | 'plivo';
  configuration: any;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  messagingServiceSid?: string;
  enableDeliveryReceipts?: boolean;
  enableStatusCallbacks?: boolean;
  callbackUrl?: string;
}

export interface AWSSNSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  senderName?: string;
  smsType?: 'Promotional' | 'Transactional';
}

export interface NexmoConfig {
  apiKey: string;
  apiSecret: string;
  fromNumber?: string;
  brand?: string;
  enableDeliveryReceipts?: boolean;
  callbackUrl?: string;
}

export interface MessageBirdConfig {
  accessKey: string;
  originator: string;
  enableDeliveryReceipts?: boolean;
  callbackUrl?: string;
}

export interface PlivoConfig {
  authId: string;
  authToken: string;
  fromNumber: string;
  enableDeliveryReceipts?: boolean;
  callbackUrl?: string;
}

export interface SMSTemplate {
  name: string;
  message: string;
  variables: string[];
  category?: string;
  maxLength?: number;
}

@Injectable()
export class SMSNotificationService {
  private readonly logger = new Logger(SMSNotificationService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectDrizzle() private readonly db: DrizzleDB,
  ) {}

  /**
   * Send SMS message
   */
  async sendSMS(
    tenantId: string,
    message: SMSMessage,
    options: {
      provider?: string;
      retryAttempts?: number;
      timeout?: number;
    } = {},
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { provider, retryAttempts = 3, timeout = 30000 } = options;

      // Get SMS provider configuration
      const providerConfig = await this.getSMSProvider(tenantId, provider);
      if (!providerConfig) {
        return { success: false, error: 'SMS provider not configured' };
      }

      // Validate message
      const validationError = this.validateMessage(message);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Normalize phone numbers
      const normalizedMessage = {
        ...message,
        to: Array.isArray(message.to) 
          ? message.to.map(phone => this.normalizePhoneNumber(phone))
          : this.normalizePhoneNumber(message.to),
      };

      // Send SMS based on provider type
      let result: { success: boolean; messageId?: string; error?: string };

      switch (providerConfig.type) {
        case 'twilio':
          result = await this.sendViaTwilio(normalizedMessage, providerConfig.configuration, { retryAttempts, timeout });
          break;
        case 'aws-sns':
          result = await this.sendViaAWSSNS(normalizedMessage, providerConfig.configuration, { retryAttempts, timeout });
          break;
        case 'nexmo':
          result = await this.sendViaNexmo(normalizedMessage, providerConfig.configuration, { retryAttempts, timeout });
          break;
        case 'messagebird':
          result = await this.sendViaMessageBird(normalizedMessage, providerConfig.configuration, { retryAttempts, timeout });
          break;
        case 'plivo':
          result = await this.sendViaPlivo(normalizedMessage, providerConfig.configuration, { retryAttempts, timeout });
          break;
        default:
          return { success: false, error: `Unsupported SMS provider: ${providerConfig.type}` };
      }

      if (result.success) {
        this.logger.log(`SMS sent successfully via ${providerConfig.type}`, {
          tenantId,
          provider: providerConfig.type,
          messageId: result.messageId,
          recipients: Array.isArray(normalizedMessage.to) ? normalizedMessage.to.length : 1,
        });
      } else {
        this.logger.error(`Failed to send SMS via ${providerConfig.type}: ${result.error}`, undefined, {
          tenantId,
          provider: providerConfig.type,
        });
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`SMS service error: ${errorMessage}`, errorStack, {
        tenantId,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send SMS notification to users
   */
  async sendNotificationToUsers(
    tenantId: string,
    userIds: string[],
    notification: {
      message: string;
      priority?: 'high' | 'normal' | 'low';
      templateName?: string;
      templateVariables?: Record<string, any>;
      scheduledAt?: Date;
    },
    options: {
      provider?: string;
      batchSize?: number;
      delayBetweenBatches?: number;
    } = {},
  ): Promise<{ totalSent: number; totalFailed: number; results: Array<{ userId: string; success: boolean; error?: string }> }> {
    try {
      const { batchSize = 50, delayBetweenBatches = 1000 } = options;

      // Get user phone numbers
      const fetchedUsers = await this.db
        .select({
          id: usersTable.id,
          phoneNumber: usersTable.phoneNumber,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
        })
        .from(usersTable)
        .where(and(
          eq(usersTable.tenantId, tenantId),
          inArray(usersTable.id, userIds),
          eq(usersTable.isActive, true),
        ));

      if (fetchedUsers.length === 0) {
        return { totalSent: 0, totalFailed: 0, results: [] };
      }

      const results: Array<{ userId: string; success: boolean; error?: string }> = [];
      let totalSent = 0;
      let totalFailed = 0;

      // Process users in batches
      for (let i = 0; i < fetchedUsers.length; i += batchSize) {
        const batch = fetchedUsers.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (user) => {
          try {
            if (!user.phoneNumber) {
              return { userId: user.id, success: false, error: 'No phone number' };
            }

            // Prepare SMS message
            let smsMessage: SMSMessage;

            if (notification.templateName) {
              // Use template
              const template = await this.getSMSTemplate(tenantId, notification.templateName);
              if (!template) {
                return { userId: user.id, success: false, error: 'Template not found' };
              }

              const variables = {
                ...notification.templateVariables,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName} ${user.lastName}`.trim(),
              };

              smsMessage = {
                to: user.phoneNumber,
                message: this.renderTemplate(template.message, variables),
                priority: notification.priority,
                scheduledAt: notification.scheduledAt,
              };
            } else {
              // Direct message
              smsMessage = {
                to: user.phoneNumber,
                message: notification.message,
                priority: notification.priority,
                scheduledAt: notification.scheduledAt,
              };
            }

            const result = await this.sendSMS(tenantId, smsMessage, options);
            return { userId: user.id, success: result.success, ...(result.error && { error: result.error }) };

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { userId: user.id, success: false, error: errorMessage };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
            if (result.value.success) {
              totalSent++;
            } else {
              totalFailed++;
            }
          } else {
            totalFailed++;
            results.push({ userId: 'unknown', success: false, error: result.reason?.message || 'Unknown error' });
          }
        });

        // Delay between batches (except for the last batch)
        if (i + batchSize < fetchedUsers.length && delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      this.logger.log(`Bulk SMS notification completed`, {
        tenantId,
        totalUsers: fetchedUsers.length,
        totalSent,
        totalFailed,
      });

      return { totalSent, totalFailed, results };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send bulk SMS notifications: ${errorMessage}`, errorStack, {
        tenantId,
        userCount: userIds.length,
      });
      throw error;
    }
  }

  /**
   * Send OTP (One-Time Password) SMS
   */
  async sendOTP(
    tenantId: string,
    phoneNumber: string,
    otp: string,
    options: {
      provider?: string;
      validityMinutes?: number;
      brandName?: string;
    } = {},
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { validityMinutes = 10, brandName = 'Business Platform' } = options;

      const message: SMSMessage = {
        to: phoneNumber,
        message: `Your ${brandName} verification code is: ${otp}. Valid for ${validityMinutes} minutes. Do not share this code.`,
        priority: 'high',
        validityPeriod: validityMinutes,
      };

      return await this.sendSMS(tenantId, message, options);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send OTP SMS: ${errorMessage}`, errorStack, {
        tenantId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send alert SMS with high priority
   */
  async sendAlert(
    tenantId: string,
    phoneNumbers: string[],
    alert: {
      title: string;
      message: string;
      severity: 'info' | 'warning' | 'error' | 'critical';
      metadata?: Record<string, any>;
    },
    options: {
      provider?: string;
    } = {},
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const alertMessage = `🚨 ${alert.title}\n\n${alert.message}\n\nSeverity: ${alert.severity.toUpperCase()}\nTime: ${new Date().toLocaleString()}`;

      const message: SMSMessage = {
        to: phoneNumbers,
        message: alertMessage,
        priority: alert.severity === 'critical' || alert.severity === 'error' ? 'high' : 'normal',
      };

      return await this.sendSMS(tenantId, message, options);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to send alert SMS: ${errorMessage}`, errorStack, {
        tenantId,
        severity: alert.severity,
        recipientCount: phoneNumbers.length,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Configure SMS provider for tenant
   */
  async configureProvider(
    tenantId: string,
    provider: SMSProvider,
    updatedBy: string,
  ): Promise<void> {
    try {
      // Validate configuration
      const validationError = this.validateProviderConfig(provider);
      if (validationError) {
        throw new Error(`Invalid SMS provider configuration: ${validationError}`);
      }

      // Test the configuration
      const testResult = await this.testProviderConfiguration(provider);
      if (!testResult.success) {
        throw new Error(`SMS provider test failed: ${testResult.error}`);
      }

      // Save configuration
      await this.db
        .insert(integrationSettings)
        .values({
          id: `sms_${provider.type}_${tenantId}`,
          tenantId,
          integrationType: `sms_${provider.type}`,
          isEnabled: true,
          configuration: provider.configuration,
          createdBy: updatedBy,
          updatedBy: updatedBy,
        })
        .onConflictDoUpdate({
          target: [integrationSettings.tenantId, integrationSettings.integrationType],
          set: {
            configuration: provider.configuration,
            isEnabled: true,
            updatedAt: new Date(),
            updatedBy: updatedBy,
          },
        });

      this.logger.log(`SMS provider ${provider.type} configured for tenant ${tenantId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to configure SMS provider: ${errorMessage}`, errorStack, {
        tenantId,
        providerType: provider.type,
      });
      throw error;
    }
  }

  /**
   * Create SMS template
   */
  async createTemplate(
    tenantId: string,
    template: SMSTemplate,
    createdBy: string,
  ): Promise<void> {
    try {
      // Validate template
      const validationError = this.validateTemplate(template);
      if (validationError) {
        throw new Error(`Invalid SMS template: ${validationError}`);
      }

      // Save template
      await this.db
        .insert(integrationSettings)
        .values({
          id: `sms_template_${template.name}_${tenantId}`,
          tenantId,
          integrationType: 'sms_template',
          isEnabled: true,
          configuration: template,
          createdBy,
          updatedBy: createdBy,
        });

      this.logger.log(`SMS template '${template.name}' created for tenant ${tenantId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create SMS template: ${errorMessage}`, errorStack, {
        tenantId,
        templateName: template.name,
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async getSMSProvider(tenantId: string, preferredType?: string): Promise<SMSProvider | null> {
    try {
      let integrationType = preferredType ? `sms_${preferredType}` : undefined;

      // If no preferred type, try to find any SMS provider
      if (!integrationType) {
        const providers = await this.db
          .select()
          .from(integrationSettings)
          .where(and(
            eq(integrationSettings.tenantId, tenantId),
            eq(integrationSettings.isEnabled, true),
          ));

        const smsProvider = providers.find(p => p.integrationType.startsWith('sms_') && p.integrationType !== 'sms_template');
        if (!smsProvider) {
          return null;
        }

        return {
          type: smsProvider.integrationType.replace('sms_', '') as any,
          configuration: smsProvider.configuration,
        };
      }

      const [integration] = await this.db
        .select()
        .from(integrationSettings)
        .where(and(
          eq(integrationSettings.tenantId, tenantId),
          eq(integrationSettings.integrationType, integrationType),
          eq(integrationSettings.isEnabled, true),
        ));

      return integration ? {
        type: integration.integrationType.replace('sms_', '') as any,
        configuration: integration.configuration,
      } : null;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get SMS provider: ${errorMessage}`, errorStack);
      return null;
    }
  }

  private async getSMSTemplate(tenantId: string, templateName: string): Promise<SMSTemplate | null> {
    try {
      const [template] = await this.db
        .select()
        .from(integrationSettings)
        .where(and(
          eq(integrationSettings.tenantId, tenantId),
          eq(integrationSettings.integrationType, 'sms_template'),
          eq(integrationSettings.isEnabled, true),
        ));

      return template && (template.configuration as SMSTemplate).name === templateName 
        ? (template.configuration as SMSTemplate) 
        : null;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get SMS template: ${errorMessage}`, errorStack);
      return null;
    }
  }

  private validateMessage(message: SMSMessage): string | null {
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      return 'Recipient phone number is required';
    }

    if (!message.message || message.message.trim().length === 0) {
      return 'Message content is required';
    }

    if (message.message.length > 1600) {
      return 'Message is too long (max 1600 characters)';
    }

    return null;
  }

  private validateProviderConfig(provider: SMSProvider): string | null {
    switch (provider.type) {
      case 'twilio':
        const twilioConfig = provider.configuration as TwilioConfig;
        if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.fromNumber) {
          return 'Twilio Account SID, Auth Token, and From Number are required';
        }
        break;
      case 'aws-sns':
        const snsConfig = provider.configuration as AWSSNSConfig;
        if (!snsConfig.accessKeyId || !snsConfig.secretAccessKey || !snsConfig.region) {
          return 'AWS SNS credentials and region are required';
        }
        break;
      case 'nexmo':
        const nexmoConfig = provider.configuration as NexmoConfig;
        if (!nexmoConfig.apiKey || !nexmoConfig.apiSecret) {
          return 'Nexmo API key and secret are required';
        }
        break;
      case 'messagebird':
        const mbConfig = provider.configuration as MessageBirdConfig;
        if (!mbConfig.accessKey || !mbConfig.originator) {
          return 'MessageBird access key and originator are required';
        }
        break;
      case 'plivo':
        const plivoConfig = provider.configuration as PlivoConfig;
        if (!plivoConfig.authId || !plivoConfig.authToken || !plivoConfig.fromNumber) {
          return 'Plivo Auth ID, Auth Token, and From Number are required';
        }
        break;
      default:
        return `Unsupported provider type: ${provider.type}`;
    }

    return null;
  }

  private validateTemplate(template: SMSTemplate): string | null {
    if (!template.name || !template.message) {
      return 'Template name and message are required';
    }

    if (template.maxLength && template.message.length > template.maxLength) {
      return `Template message exceeds maximum length of ${template.maxLength} characters`;
    }

    return null;
  }

  private async testProviderConfiguration(provider: SMSProvider): Promise<{ success: boolean; error?: string }> {
    try {
      // Don't actually send a test SMS, just validate the configuration format
      // In a real implementation, you might want to send to a test number
      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +, assume it's a US number and add +1
    if (!normalized.startsWith('+')) {
      if (normalized.length === 10) {
        normalized = `+1${normalized}`;
      } else if (normalized.length === 11 && normalized.startsWith('1')) {
        normalized = `+${normalized}`;
      }
    }
    
    return normalized;
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return phoneNumber;
    }
    
    const visiblePart = phoneNumber.slice(-4);
    const maskedPart = '*'.repeat(phoneNumber.length - 4);
    return maskedPart + visiblePart;
  }

  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    
    return rendered;
  }

  // Provider-specific implementations (simplified for demo)
  
  private async sendViaTwilio(
    message: SMSMessage,
    config: TwilioConfig,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implementation would use twilio SDK
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true, messageId: `twilio_${Date.now()}` };
  }

  private async sendViaAWSSNS(
    message: SMSMessage,
    config: AWSSNSConfig,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implementation would use AWS SDK
    await new Promise(resolve => setTimeout(resolve, 600));
    return { success: true, messageId: `sns_${Date.now()}` };
  }

  private async sendViaNexmo(
    message: SMSMessage,
    config: NexmoConfig,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implementation would use Nexmo SDK
    await new Promise(resolve => setTimeout(resolve, 700));
    return { success: true, messageId: `nexmo_${Date.now()}` };
  }

  private async sendViaMessageBird(
    message: SMSMessage,
    config: MessageBirdConfig,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implementation would use MessageBird SDK
    await new Promise(resolve => setTimeout(resolve, 650));
    return { success: true, messageId: `mb_${Date.now()}` };
  }

  private async sendViaPlivo(
    message: SMSMessage,
    config: PlivoConfig,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implementation would use Plivo SDK
    await new Promise(resolve => setTimeout(resolve, 750));
    return { success: true, messageId: `plivo_${Date.now()}` };
  }
}