import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

import { WebhookRepository } from '../repositories/webhook.repository';
import { QueueService } from '../../queue/queue.service';
import { CacheService } from '../../cache/cache.service';

import {
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookDeliveryDto,
  WebhookTestDto,
} from '../dto/webhook.dto';

import {
  Webhook,
  WebhookDelivery,
  WebhookStatus,
  AuthType,
} from '../entities/webhook.entity';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  tenantId: string;
  integrationId?: string;
}

interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  duration: number;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly webhookRepository: WebhookRepository,
    private readonly httpService: HttpService,
    private readonly queueService: QueueService,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new webhook
   */
  async create(integrationId: string, dto: CreateWebhookDto): Promise<Webhook> {
    this.logger.log(`Creating webhook: ${dto.name} for integration: ${integrationId}`);

    // Validate webhook URL
    if (!this.isValidUrl(dto.url)) {
      throw new BadRequestException('Invalid webhook URL');
    }

    // Generate secret key if not provided
    const secretKey = dto.secretKey || this.generateSecretKey();

    const webhook = await this.webhookRepository.create({
      integrationId,
      name: dto.name,
      url: dto.url,
      method: dto.method || 'POST',
      events: dto.events || [],
      filters: dto.filters || {},
      authType: dto.authType || AuthType.BEARER_TOKEN,
      authConfig: dto.authConfig || {},
      secretKey,
      headers: dto.headers || {},
      timeout: dto.timeout || 30,
      retryAttempts: dto.retryAttempts || 3,
      retryDelay: dto.retryDelay || 1000,
      status: WebhookStatus.ACTIVE,
      isActive: true,
    });

    this.logger.log(`Webhook created successfully: ${webhook.id}`);
    return webhook;
  }

  /**
   * Update webhook configuration
   */
  async update(webhookId: string, dto: UpdateWebhookDto): Promise<Webhook> {
    this.logger.log(`Updating webhook: ${webhookId}`);

    if (dto.url && !this.isValidUrl(dto.url)) {
      throw new BadRequestException('Invalid webhook URL');
    }

    const webhook = await this.webhookRepository.update(webhookId, dto);
    
    // Clear cache for this webhook
    await this.cacheService.del(`webhook:${webhookId}`);

    this.logger.log(`Webhook updated successfully: ${webhookId}`);
    return webhook;
  }

  /**
   * Delete webhook
   */
  async delete(webhookId: string): Promise<void> {
    this.logger.log(`Deleting webhook: ${webhookId}`);

    await this.webhookRepository.softDelete(webhookId);
    await this.cacheService.del(`webhook:${webhookId}`);

    this.logger.log(`Webhook deleted successfully: ${webhookId}`);
  }

  /**
   * Delete all webhooks for an integration
   */
  async deleteByIntegration(integrationId: string): Promise<void> {
    this.logger.log(`Deleting all webhooks for integration: ${integrationId}`);

    const webhooks = await this.webhookRepository.findByIntegration(integrationId);
    
    for (const webhook of webhooks) {
      await this.delete(webhook.id);
    }

    this.logger.log(`Deleted ${webhooks.length} webhooks for integration: ${integrationId}`);
  }

  /**
   * Trigger webhook delivery
   */
  async triggerWebhook(
    tenantId: string,
    event: string,
    data: any,
    integrationId?: string,
  ): Promise<void> {
    this.logger.log(`Triggering webhooks for event: ${event}, tenant: ${tenantId}`);

    // Find matching webhooks
    const webhooks = await this.findMatchingWebhooks(tenantId, event, integrationId);

    if (webhooks.length === 0) {
      this.logger.debug(`No webhooks found for event: ${event}`);
      return;
    }

    // Prepare payload
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      tenantId,
      integrationId,
    };

    // Queue webhook deliveries
    const deliveryPromises = webhooks.map(webhook => 
      this.queueWebhookDelivery(webhook, payload)
    );

    await Promise.allSettled(deliveryPromises);

    this.logger.log(`Queued ${webhooks.length} webhook deliveries for event: ${event}`);
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string, dto: WebhookTestDto): Promise<DeliveryResult> {
    this.logger.log(`Testing webhook: ${webhookId}`);

    const webhook = await this.webhookRepository.findById(webhookId);
    if (!webhook) {
      throw new BadRequestException(`Webhook not found: ${webhookId}`);
    }

    const testPayload: WebhookPayload = {
      event: dto.event || 'test',
      timestamp: new Date().toISOString(),
      data: dto.data || { test: true },
      tenantId: dto.tenantId,
      integrationId: webhook.integrationId,
    };

    const result = await this.deliverWebhook(webhook, testPayload);

    this.logger.log(`Webhook test completed: ${webhookId}, success: ${result.success}`);
    return result;
  }

  /**
   * Get webhook statistics
   */
  async getStatistics(integrationId: string): Promise<any> {
    const webhooks = await this.webhookRepository.findByIntegration(integrationId);
    
    const stats = {
      totalWebhooks: webhooks.length,
      activeWebhooks: webhooks.filter(w => w.isActive).length,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageResponseTime: 0,
      lastDeliveryAt: null as Date | null,
    };

    for (const webhook of webhooks) {
      stats.totalDeliveries += webhook.successCount + webhook.failureCount;
      stats.successfulDeliveries += webhook.successCount;
      stats.failedDeliveries += webhook.failureCount;
      
      if (webhook.lastDeliveryAt && (!stats.lastDeliveryAt || webhook.lastDeliveryAt > stats.lastDeliveryAt)) {
        stats.lastDeliveryAt = webhook.lastDeliveryAt;
      }
    }

    // Calculate success rate
    const successRate = stats.totalDeliveries > 0 
      ? (stats.successfulDeliveries / stats.totalDeliveries) * 100 
      : 0;

    return {
      ...stats,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Get webhook delivery history
   */
  async getDeliveryHistory(
    webhookId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<WebhookDelivery[]> {
    return this.webhookRepository.getDeliveryHistory(webhookId, limit, offset);
  }

  /**
   * Queue webhook delivery for background processing
   */
  private async queueWebhookDelivery(webhook: Webhook, payload: WebhookPayload): Promise<void> {
    // Check if webhook matches event filters
    if (!this.matchesFilters(webhook, payload)) {
      this.logger.debug(`Webhook ${webhook.id} filters don't match event ${payload.event}`);
      return;
    }

    await this.queueService.add('webhook-delivery', {
      webhookId: webhook.id,
      payload,
      attempt: 1,
      maxAttempts: webhook.retryAttempts + 1,
    }, {
      delay: 0,
      attempts: webhook.retryAttempts + 1,
      backoff: {
        type: 'exponential',
        delay: webhook.retryDelay,
      },
    });
  }

  /**
   * Process webhook delivery (called by queue processor)
   */
  async processWebhookDelivery(job: any): Promise<void> {
    const { webhookId, payload, attempt, maxAttempts } = job.data;

    this.logger.log(`Processing webhook delivery: ${webhookId}, attempt: ${attempt}`);

    const webhook = await this.webhookRepository.findById(webhookId);
    if (!webhook || !webhook.isActive) {
      this.logger.warn(`Webhook not found or inactive: ${webhookId}`);
      return;
    }

    const result = await this.deliverWebhook(webhook, payload);

    // Log delivery result
    await this.logDelivery(webhook, payload, result, attempt);

    // Update webhook statistics
    await this.updateWebhookStats(webhook, result);

    if (!result.success && attempt < maxAttempts) {
      // Retry will be handled by the queue system
      throw new Error(`Webhook delivery failed: ${result.error}`);
    }

    this.logger.log(`Webhook delivery completed: ${webhookId}, success: ${result.success}`);
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(webhook: Webhook, payload: WebhookPayload): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'UnifiedBusinessPlatform-Webhook/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        'X-Webhook-ID': crypto.randomUUID(),
        ...webhook.headers,
      };

      // Add authentication headers
      if (webhook.authType === AuthType.BEARER_TOKEN && webhook.authConfig.token) {
        headers['Authorization'] = `Bearer ${webhook.authConfig.token}`;
      } else if (webhook.authType === AuthType.API_KEY && webhook.authConfig.apiKey) {
        headers[webhook.authConfig.headerName || 'X-API-Key'] = webhook.authConfig.apiKey;
      }

      // Add signature for verification
      if (webhook.secretKey) {
        const signature = this.generateSignature(payload, webhook.secretKey);
        headers['X-Webhook-Signature'] = signature;
      }

      // Make HTTP request
      const response = await firstValueFrom(
        this.httpService.request({
          method: webhook.method as any,
          url: webhook.url,
          data: payload,
          headers,
          timeout: webhook.timeout * 1000,
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
        })
      );

      const duration = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        responseBody: JSON.stringify(response.data),
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        statusCode: error.response?.status,
        responseBody: error.response?.data ? JSON.stringify(error.response.data) : undefined,
        error: error.message,
        duration,
      };
    }
  }

  /**
   * Find webhooks matching the event and filters
   */
  private async findMatchingWebhooks(
    tenantId: string,
    event: string,
    integrationId?: string,
  ): Promise<Webhook[]> {
    const cacheKey = `webhooks:${tenantId}:${event}:${integrationId || 'all'}`;
    
    let webhooks = await this.cacheService.get<Webhook[]>(cacheKey);
    
    if (!webhooks) {
      webhooks = await this.webhookRepository.findMatchingWebhooks(tenantId, event, integrationId);
      await this.cacheService.set(cacheKey, webhooks, 300); // Cache for 5 minutes
    }

    return webhooks.filter(webhook => webhook.isActive && webhook.status === WebhookStatus.ACTIVE);
  }

  /**
   * Check if payload matches webhook filters
   */
  private matchesFilters(webhook: Webhook, payload: WebhookPayload): boolean {
    if (!webhook.filters || Object.keys(webhook.filters).length === 0) {
      return true;
    }

    // Check event filter
    if (webhook.events && webhook.events.length > 0) {
      if (!webhook.events.includes(payload.event)) {
        return false;
      }
    }

    // Check custom filters
    for (const [key, value] of Object.entries(webhook.filters)) {
      if (key === 'events') continue; // Already checked above
      
      const payloadValue = this.getNestedValue(payload.data, key);
      if (payloadValue !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Log webhook delivery
   */
  private async logDelivery(
    webhook: Webhook,
    payload: WebhookPayload,
    result: DeliveryResult,
    attempt: number,
  ): Promise<void> {
    await this.webhookRepository.logDelivery({
      webhookId: webhook.id,
      eventType: payload.event,
      payload: payload.data,
      headers: {}, // Could include request headers if needed
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      responseHeaders: {},
      deliveredAt: new Date(),
      duration: result.duration,
      success: result.success,
      error: result.error,
      retryCount: attempt - 1,
    });
  }

  /**
   * Update webhook statistics
   */
  private async updateWebhookStats(webhook: Webhook, result: DeliveryResult): Promise<void> {
    const updates: any = {
      lastDeliveryAt: new Date(),
    };

    if (result.success) {
      updates.successCount = webhook.successCount + 1;
      updates.lastSuccessAt = new Date();
      updates.status = WebhookStatus.ACTIVE;
    } else {
      updates.failureCount = webhook.failureCount + 1;
      updates.lastFailureAt = new Date();
      updates.lastError = result.error;

      // Suspend webhook if too many failures
      if (webhook.failureCount + 1 >= 10) {
        updates.status = WebhookStatus.FAILED;
        updates.isActive = false;
      }
    }

    await this.webhookRepository.update(webhook.id, updates);
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Generate random secret key
   */
  private generateSecretKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Retry failed webhook deliveries
   */
  @Cron(CronExpression.EVERY_HOUR)
  async retryFailedDeliveries(): Promise<void> {
    this.logger.log('Retrying failed webhook deliveries');

    try {
      const failedDeliveries = await this.webhookRepository.getFailedDeliveries();
      
      for (const delivery of failedDeliveries) {
        if (delivery.retryCount < 3) { // Max 3 retries
          await this.queueService.add('webhook-delivery', {
            webhookId: delivery.webhookId,
            payload: delivery.payload,
            attempt: delivery.retryCount + 1,
            maxAttempts: 3,
          }, {
            delay: Math.pow(2, delivery.retryCount) * 60000, // Exponential backoff
          });
        }
      }

      this.logger.log(`Queued ${failedDeliveries.length} failed deliveries for retry`);
    } catch (error) {
      this.logger.error('Failed to retry webhook deliveries:', error);
    }
  }
}