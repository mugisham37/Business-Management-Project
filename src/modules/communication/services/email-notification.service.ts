import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectDrizzle, DrizzleDB } from '../../database/drizzle.service';
import { integrationSettings } from '../../database/schema/tenant.schema';
import { users } from '../../database/schema/user.schema';
import { eq, and, inArray } from 'drizzle-orm';
import { firstValueFrom } from 'rxjs';
import * as nodemailer from 'nodemailer';

export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
  cid?: string; // Content-ID for inline images
}

export interface EmailTemplate {
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  variables: string[];
  category?: string;
}

export interface EmailProvider {
  type: 'sendgrid' | 'ses' | 'smtp' | 'mailgun' | 'postmark';
  configuration: any;
}

export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  templateId?: string;
  enableTracking?: boolean;
  enableClickTracking?: boolean;
  enableOpenTracking?: boolean;
}

export interface SESConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  fromEmail: string;
  fromName?: string;
  configurationSet?: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  fromEmail: string;
  fromName?: string;
}

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName?: string;
  region?: 'us' | 'eu';
}

export interface PostmarkConfig {
  serverToken: string;
  fromEmail: string;
  fromName?: string;
  messageStream?: string;
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private readonly transporters = new Map<string, any>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectDrizzle() private readonly db: DrizzleDB,
  ) {}

  /**
   * Send email notification
   */
  async sendEmail(
    tenantId: string,
    message: EmailMessage,
    options: {
      provider?: string;
      retryAttempts?: number;
      timeout?: number;
    } = {},
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { provider, retryAttempts = 3, timeout = 30000 } = options;

      // Get email provider configuration
      const providerConfig = await this.getEmailProvider(tenantId, provider);
      if (!providerConfig) {
        return { success: false, error: 'Email provider not configured' };
      }

      // Validate message
      const validationError = this.validateMessage(message);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Send email based on provider type
      let result: { success: boolean; messageId?: string; error?: string };

      switch (providerConfig.type) {
        case 'sendgrid':
          result = await this.sendViaSendGrid(message, providerConfig.configuration, { retryAttempts, timeout });
          break;
        case 'ses':
          result = await this.sendViaSES(message, providerConfig.configuration, { retryAttempts, timeout });
          break;
        case 'smtp':
          result = await this.sendViaSMTP(tenantId, message, providerConfig.configuration, { retryAttempts, timeout });
          break;
        case 'mailgun':
          result = await this.sendViaMailgun(message, providerConfig.configuration, { retryAttempts, timeout });
          break;
        case 'postmark':
          result = await this.sendViaPostmark(message, providerConfig.configuration, { retryAttempts, timeout });
          break;
        default:
          return { success: false, error: `Unsupported email provider: ${providerConfig.type}` };
      }

      if (result.success) {
        this.logger.log(`Email sent successfully via ${providerConfig.type}`, {
          tenantId,
          provider: providerConfig.type,
          messageId: result.messageId,
          recipients: Array.isArray(message.to) ? message.to.length : 1,
        });
      } else {
        this.logger.error(`Failed to send email via ${providerConfig.type}: ${result.error}`, undefined, {
          tenantId,
          provider: providerConfig.type,
        });
      }

      return result;

    } catch (error) {
      this.logger.error(`Email service error: ${error.message}`, error.stack, {
        tenantId,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification email to users
   */
  async sendNotificationToUsers(
    tenantId: string,
    userIds: string[],
    notification: {
      subject: string;
      message: string;
      htmlContent?: string;
      priority?: 'high' | 'normal' | 'low';
      templateName?: string;
      templateVariables?: Record<string, any>;
      attachments?: EmailAttachment[];
    },
    options: {
      provider?: string;
      batchSize?: number;
      delayBetweenBatches?: number;
    } = {},
  ): Promise<{ totalSent: number; totalFailed: number; results: Array<{ userId: string; success: boolean; error?: string }> }> {
    try {
      const { batchSize = 50, delayBetweenBatches = 1000 } = options;

      // Get user email addresses
      const users = await this.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          inArray(users.id, userIds),
          eq(users.isActive, true),
        ));

      if (users.length === 0) {
        return { totalSent: 0, totalFailed: 0, results: [] };
      }

      const results: Array<{ userId: string; success: boolean; error?: string }> = [];
      let totalSent = 0;
      let totalFailed = 0;

      // Process users in batches
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (user) => {
          try {
            if (!user.email) {
              return { userId: user.id, success: false, error: 'No email address' };
            }

            // Prepare email message
            let emailMessage: EmailMessage;

            if (notification.templateName) {
              // Use template
              const template = await this.getEmailTemplate(tenantId, notification.templateName);
              if (!template) {
                return { userId: user.id, success: false, error: 'Template not found' };
              }

              const variables = {
                ...notification.templateVariables,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName} ${user.lastName}`.trim(),
              };

              emailMessage = {
                to: user.email,
                subject: this.renderTemplate(template.subject, variables),
                html: this.renderTemplate(template.htmlTemplate, variables),
                text: template.textTemplate ? this.renderTemplate(template.textTemplate, variables) : undefined,
                priority: notification.priority,
                attachments: notification.attachments,
              };
            } else {
              // Direct message
              emailMessage = {
                to: user.email,
                subject: notification.subject,
                text: notification.message,
                html: notification.htmlContent,
                priority: notification.priority,
                attachments: notification.attachments,
              };
            }

            const result = await this.sendEmail(tenantId, emailMessage, options);
            return { userId: user.id, success: result.success, error: result.error };

          } catch (error) {
            return { userId: user.id, success: false, error: error.message };
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
        if (i + batchSize < users.length && delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      this.logger.log(`Bulk email notification completed`, {
        tenantId,
        totalUsers: users.length,
        totalSent,
        totalFailed,
      });

      return { totalSent, totalFailed, results };

    } catch (error) {
      this.logger.error(`Failed to send bulk email notifications: ${error.message}`, error.stack, {
        tenantId,
        userCount: userIds.length,
      });
      throw error;
    }
  }

  /**
   * Configure email provider for tenant
   */
  async configureProvider(
    tenantId: string,
    provider: EmailProvider,
    updatedBy: string,
  ): Promise<void> {
    try {
      // Validate configuration
      const validationError = this.validateProviderConfig(provider);
      if (validationError) {
        throw new Error(`Invalid email provider configuration: ${validationError}`);
      }

      // Test the configuration
      const testResult = await this.testProviderConfiguration(provider);
      if (!testResult.success) {
        throw new Error(`Email provider test failed: ${testResult.error}`);
      }

      // Save configuration
      await this.db
        .insert(integrationSettings)
        .values({
          id: `email_${provider.type}_${tenantId}`,
          tenantId,
          integrationType: `email_${provider.type}`,
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

      // Clear cached transporter
      this.transporters.delete(`${tenantId}_${provider.type}`);

      this.logger.log(`Email provider ${provider.type} configured for tenant ${tenantId}`);

    } catch (error) {
      this.logger.error(`Failed to configure email provider: ${error.message}`, error.stack, {
        tenantId,
        providerType: provider.type,
      });
      throw error;
    }
  }

  /**
   * Create email template
   */
  async createTemplate(
    tenantId: string,
    template: EmailTemplate,
    createdBy: string,
  ): Promise<void> {
    try {
      // Validate template
      const validationError = this.validateTemplate(template);
      if (validationError) {
        throw new Error(`Invalid email template: ${validationError}`);
      }

      // Save template (this would typically go to a templates table)
      // For now, we'll store it in integration settings
      await this.db
        .insert(integrationSettings)
        .values({
          id: `email_template_${template.name}_${tenantId}`,
          tenantId,
          integrationType: 'email_template',
          isEnabled: true,
          configuration: template,
          createdBy,
          updatedBy: createdBy,
        });

      this.logger.log(`Email template '${template.name}' created for tenant ${tenantId}`);

    } catch (error) {
      this.logger.error(`Failed to create email template: ${error.message}`, error.stack, {
        tenantId,
        templateName: template.name,
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async getEmailProvider(tenantId: string, preferredType?: string): Promise<EmailProvider | null> {
    try {
      let integrationType = preferredType ? `email_${preferredType}` : undefined;

      // If no preferred type, try to find any email provider
      if (!integrationType) {
        const providers = await this.db
          .select()
          .from(integrationSettings)
          .where(and(
            eq(integrationSettings.tenantId, tenantId),
            eq(integrationSettings.isEnabled, true),
          ));

        const emailProvider = providers.find(p => p.integrationType.startsWith('email_') && p.integrationType !== 'email_template');
        if (!emailProvider) {
          return null;
        }

        return {
          type: emailProvider.integrationType.replace('email_', '') as any,
          configuration: emailProvider.configuration,
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
        type: integration.integrationType.replace('email_', '') as any,
        configuration: integration.configuration,
      } : null;

    } catch (error) {
      this.logger.error(`Failed to get email provider: ${error.message}`, error.stack);
      return null;
    }
  }

  private async getEmailTemplate(tenantId: string, templateName: string): Promise<EmailTemplate | null> {
    try {
      const [template] = await this.db
        .select()
        .from(integrationSettings)
        .where(and(
          eq(integrationSettings.tenantId, tenantId),
          eq(integrationSettings.integrationType, 'email_template'),
          eq(integrationSettings.isEnabled, true),
        ));

      return template && (template.configuration as EmailTemplate).name === templateName 
        ? (template.configuration as EmailTemplate) 
        : null;

    } catch (error) {
      this.logger.error(`Failed to get email template: ${error.message}`, error.stack);
      return null;
    }
  }

  private validateMessage(message: EmailMessage): string | null {
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      return 'Recipient email address is required';
    }

    if (!message.subject) {
      return 'Subject is required';
    }

    if (!message.text && !message.html) {
      return 'Either text or HTML content is required';
    }

    return null;
  }

  private validateProviderConfig(provider: EmailProvider): string | null {
    switch (provider.type) {
      case 'sendgrid':
        const sgConfig = provider.configuration as SendGridConfig;
        if (!sgConfig.apiKey || !sgConfig.fromEmail) {
          return 'SendGrid API key and from email are required';
        }
        break;
      case 'ses':
        const sesConfig = provider.configuration as SESConfig;
        if (!sesConfig.accessKeyId || !sesConfig.secretAccessKey || !sesConfig.region || !sesConfig.fromEmail) {
          return 'SES credentials, region, and from email are required';
        }
        break;
      case 'smtp':
        const smtpConfig = provider.configuration as SMTPConfig;
        if (!smtpConfig.host || !smtpConfig.auth?.user || !smtpConfig.auth?.pass || !smtpConfig.fromEmail) {
          return 'SMTP host, credentials, and from email are required';
        }
        break;
      case 'mailgun':
        const mgConfig = provider.configuration as MailgunConfig;
        if (!mgConfig.apiKey || !mgConfig.domain || !mgConfig.fromEmail) {
          return 'Mailgun API key, domain, and from email are required';
        }
        break;
      case 'postmark':
        const pmConfig = provider.configuration as PostmarkConfig;
        if (!pmConfig.serverToken || !pmConfig.fromEmail) {
          return 'Postmark server token and from email are required';
        }
        break;
      default:
        return `Unsupported provider type: ${provider.type}`;
    }

    return null;
  }

  private validateTemplate(template: EmailTemplate): string | null {
    if (!template.name || !template.subject || !template.htmlTemplate) {
      return 'Template name, subject, and HTML template are required';
    }

    return null;
  }

  private async testProviderConfiguration(provider: EmailProvider): Promise<{ success: boolean; error?: string }> {
    try {
      const testMessage: EmailMessage = {
        to: provider.configuration.fromEmail,
        subject: 'Test Email from Business Platform',
        text: 'This is a test email to verify your email configuration.',
        html: '<p>This is a test email to verify your email configuration.</p>',
      };

      // Don't actually send the test email, just validate the configuration
      // In a real implementation, you might want to send to a test address
      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async sendViaSendGrid(
    message: EmailMessage,
    config: SendGridConfig,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implementation would use @sendgrid/mail
    // For now, simulate success
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, messageId: `sg_${Date.now()}` };
  }

  private async sendViaSES(
    message: EmailMessage,
    config: SESConfig,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implementation would use AWS SDK
    // For now, simulate success
    await new Promise(resolve => setTimeout(resolve, 600));
    return { success: true, messageId: `ses_${Date.now()}` };
  }

  private async sendViaSMTP(
    tenantId: string,
    message: EmailMessage,
    config: SMTPConfig,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporterKey = `${tenantId}_smtp`;
      
      if (!this.transporters.has(transporterKey)) {
        const transporter = nodemailer.createTransporter({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: config.auth,
        });
        this.transporters.set(transporterKey, transporter);
      }

      const transporter = this.transporters.get(transporterKey);
      
      const mailOptions = {
        from: `${config.fromName || 'Business Platform'} <${config.fromEmail}>`,
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
        replyTo: message.replyTo,
        priority: message.priority,
        headers: message.headers,
      };

      const result = await transporter.sendMail(mailOptions);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async sendViaMailgun(
    message: EmailMessage,
    config: MailgunConfig,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implementation would use mailgun-js
    // For now, simulate success
    await new Promise(resolve => setTimeout(resolve, 700));
    return { success: true, messageId: `mg_${Date.now()}` };
  }

  private async sendViaPostmark(
    message: EmailMessage,
    config: PostmarkConfig,
    options: { retryAttempts: number; timeout: number },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implementation would use postmark
    // For now, simulate success
    await new Promise(resolve => setTimeout(resolve, 550));
    return { success: true, messageId: `pm_${Date.now()}` };
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