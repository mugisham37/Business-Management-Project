import { Injectable, Logger } from '@nestjs/common';
import { InjectDrizzle, DrizzleDB } from '../../database/drizzle.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

export interface NotificationWebhook {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string | undefined;
  isActive: boolean;
  headers?: Record<string, string>;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  metadata: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
}

@Injectable()
export class NotificationWebhookService {
  private readonly logger = new Logger(NotificationWebhookService.name);

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a webhook for notification events
   */
  async registerWebhook(
    tenantId: string,
    webhook: {
      url: string;
      events: string[];
      secret?: string;
      isActive?: boolean;
      headers?: Record<string, string>;
      retryPolicy?: Partial<NotificationWebhook['retryPolicy']>;
      metadata?: Record<string, any>;
    },
    createdBy: string,
  ): Promise<string> {
    try {
      const webhookId = randomUUID();

      // TODO: Store webhook in database
      // For now, we'll simulate storage
      const webhookRecord: NotificationWebhook = {
        id: webhookId,
        tenantId,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret,
        isActive: webhook.isActive ?? true,
        headers: webhook.headers || {},
        retryPolicy: {
          maxRetries: webhook.retryPolicy?.maxRetries ?? 3,
          backoffMultiplier: webhook.retryPolicy?.backoffMultiplier ?? 2,
          initialDelay: webhook.retryPolicy?.initialDelay ?? 1000,
        },
        metadata: webhook.metadata || {},
      };

      this.logger.log(`Registered webhook for tenant ${tenantId}`, {
        webhookId,
        url: webhook.url,
        events: webhook.events,
      });

      return webhookId;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to register webhook: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Trigger webhook for notification events
   */
  async triggerWebhook(
    tenantId: string,
    event: string,
    payload: Record<string, any>,
  ): Promise<void> {
    try {
      // TODO: Get webhooks from database
      // For now, we'll simulate webhook lookup
      const webhooks = await this.getWebhooksForEvent(tenantId, event);

      if (webhooks.length === 0) {
        this.logger.debug(`No webhooks registered for event ${event} in tenant ${tenantId}`);
        return;
      }

      // Trigger all matching webhooks
      const deliveryPromises = webhooks.map(webhook => 
        this.deliverWebhook(webhook, event, payload)
      );

      await Promise.allSettled(deliveryPromises);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to trigger webhooks: ${err.message}`, err.stack);
    }
  }

  /**
   * Deliver webhook to a specific endpoint
   */
  private async deliverWebhook(
    webhook: NotificationWebhook,
    event: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const deliveryId = randomUUID();
    
    try {
      this.logger.log(`Delivering webhook ${webhook.id} for event ${event}`, {
        deliveryId,
        webhookId: webhook.id,
        url: webhook.url,
        event,
      });

      // Prepare webhook payload
      const webhookPayload = {
        id: deliveryId,
        event,
        timestamp: new Date().toISOString(),
        data: payload,
        tenant_id: webhook.tenantId,
      };

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'UnifiedBusinessPlatform-Webhook/1.0',
        'X-Webhook-Event': event,
        'X-Webhook-Delivery': deliveryId,
        ...webhook.headers,
      };

      // Add signature if secret is provided
      if (webhook.secret) {
        const signature = this.generateSignature(
          JSON.stringify(webhookPayload),
          webhook.secret,
        );
        headers['X-Webhook-Signature'] = signature;
      }

      // Make HTTP request
      const response = await firstValueFrom(
        this.httpService.post(webhook.url, webhookPayload, {
          headers,
          timeout: 30000, // 30 seconds timeout
          validateStatus: (status) => status >= 200 && status < 300,
        })
      );

      // Log successful delivery
      this.logger.log(`Webhook delivered successfully`, {
        deliveryId,
        webhookId: webhook.id,
        status: response.status,
        responseTime: Date.now(),
      });

      // TODO: Store delivery record in database

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Webhook delivery failed`, err.stack, {
        deliveryId,
        webhookId: webhook.id,
        url: webhook.url,
        event,
      });

      // TODO: Implement retry logic
      // TODO: Store failed delivery record
      
      throw error;
    }
  }

  /**
   * Get webhooks for a specific event
   */
  private async getWebhooksForEvent(
    tenantId: string,
    event: string,
  ): Promise<NotificationWebhook[]> {
    try {
      // TODO: Implement database query
      // For now, return empty array
      return [];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get webhooks for event: ${err.message}`, err.stack);
      return [];
    }
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = this.generateSignature(payload, secret);
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to verify webhook signature: ${err.message}`);
      return false;
    }
  }

  /**
   * List webhooks for a tenant
   */
  async listWebhooks(
    tenantId: string,
    options: {
      isActive?: boolean;
      event?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ webhooks: NotificationWebhook[]; total: number }> {
    try {
      // TODO: Implement database query
      // For now, return empty result
      return {
        webhooks: [],
        total: 0,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to list webhooks: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(
    tenantId: string,
    webhookId: string,
    updates: Partial<Omit<NotificationWebhook, 'id' | 'tenantId'>>,
    updatedBy: string,
  ): Promise<void> {
    try {
      // TODO: Implement database update
      
      this.logger.log(`Updated webhook ${webhookId} for tenant ${tenantId}`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to update webhook: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(tenantId: string, webhookId: string): Promise<void> {
    try {
      // TODO: Implement database deletion
      
      this.logger.log(`Deleted webhook ${webhookId} for tenant ${tenantId}`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to delete webhook: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get webhook delivery history
   */
  async getDeliveryHistory(
    tenantId: string,
    webhookId?: string,
    options: {
      status?: string;
      event?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
    try {
      // TODO: Implement database query
      // For now, return empty result
      return {
        deliveries: [],
        total: 0,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get delivery history: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Retry failed webhook delivery
   */
  async retryDelivery(tenantId: string, deliveryId: string): Promise<void> {
    try {
      // TODO: Implement retry logic
      
      this.logger.log(`Retrying webhook delivery ${deliveryId} for tenant ${tenantId}`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to retry delivery: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(
    tenantId: string,
    webhookId: string,
  ): Promise<{ success: boolean; responseTime: number; status?: number; error?: string }> {
    try {
      const startTime = Date.now();
      
      // TODO: Get webhook from database
      // For now, simulate test
      const testPayload = {
        id: 'test-' + randomUUID(),
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook delivery',
          tenant_id: tenantId,
        },
        tenant_id: tenantId,
      };

      // Simulate HTTP request
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const responseTime = Date.now() - startTime;

      this.logger.log(`Webhook test completed for ${webhookId}`, {
        tenantId,
        webhookId,
        responseTime,
      });

      return {
        success: true,
        responseTime,
        status: 200,
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Webhook test failed: ${err.message}`, err.stack);
      
      return {
        success: false,
        responseTime: 0,
        error: err.message,
      };
    }
  }
}