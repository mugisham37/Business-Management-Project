import { Resolver, Query, Mutation, Args, ID, Subscription } from '@nestjs/graphql';
import { UseGuards, UseInterceptors, Inject } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { TenantInterceptor } from '../../tenant/interceptors/tenant.interceptor';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';

import { WebhookService } from '../services/webhook.service';

import {
  WebhookType,
  WebhookDeliveryType,
  WebhookTestResult,
} from '../types/webhook.graphql.types';
import {
  CreateWebhookInput,
  UpdateWebhookInput,
  TestWebhookInput,
} from '../inputs/webhook.input';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver(() => WebhookType)
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
export class WebhookResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly webhookService: WebhookService,
    @Inject('PUB_SUB') private readonly pubSub: RedisPubSub,
  ) {
    super(dataLoaderService);
  }

  @Query(() => WebhookType, { name: 'webhook', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getWebhook(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WebhookType | null> {
    const webhook = await this.webhookService['webhookRepository'].findById(id);
    
    if (!webhook) {
      return null;
    }

    return {
      id: webhook.id,
      integrationId: webhook.integrationId,
      name: webhook.name,
      url: webhook.url,
      method: webhook.method,
      events: webhook.events,
      status: webhook.status as any,
      authType: webhook.authType as any,
      isActive: webhook.isActive,
      timeout: webhook.timeout,
      retryAttempts: webhook.retryAttempts,
      successCount: webhook.successCount,
      failureCount: webhook.failureCount,
      lastDeliveryAt: webhook.lastDeliveryAt,
      lastSuccessAt: webhook.lastSuccessAt,
      lastFailureAt: webhook.lastFailureAt,
      lastError: webhook.lastError,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    } as any;
  }

  @Query(() => [WebhookType], { name: 'webhooks' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getWebhooks(
    @Args('integrationId', { type: () => ID }) integrationId: string,
  ): Promise<WebhookType[]> {
    const webhooks = await this.webhookService['webhookRepository'].findByIntegration(integrationId);
    
    return webhooks.map(webhook => ({
      id: webhook.id,
      integrationId: webhook.integrationId,
      name: webhook.name,
      url: webhook.url,
      method: webhook.method,
      events: webhook.events,
      status: webhook.status as any,
      authType: webhook.authType as any,
      isActive: webhook.isActive,
      timeout: webhook.timeout,
      retryAttempts: webhook.retryAttempts,
      successCount: webhook.successCount,
      failureCount: webhook.failureCount,
      lastDeliveryAt: webhook.lastDeliveryAt,
      lastSuccessAt: webhook.lastSuccessAt,
      lastFailureAt: webhook.lastFailureAt,
      lastError: webhook.lastError,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    })) as any[];
  }

  @Mutation(() => WebhookType, { name: 'createWebhook' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:create')
  async createWebhook(
    @Args('input') input: CreateWebhookInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WebhookType> {
    const createInput = {
      ...input,
      authType: input.authType as any,
    };
    const webhook = await this.webhookService.create(input.integrationId, createInput);

    return {
      id: webhook.id,
      integrationId: webhook.integrationId,
      name: webhook.name,
      url: webhook.url,
      method: webhook.method,
      events: webhook.events,
      status: webhook.status as any,
      authType: webhook.authType as any,
      isActive: webhook.isActive,
      timeout: webhook.timeout,
      retryAttempts: webhook.retryAttempts,
      successCount: webhook.successCount,
      failureCount: webhook.failureCount,
      lastDeliveryAt: webhook.lastDeliveryAt,
      lastSuccessAt: webhook.lastSuccessAt,
      lastFailureAt: webhook.lastFailureAt,
      lastError: webhook.lastError,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    } as any;
  }

  @Mutation(() => WebhookType, { name: 'updateWebhook' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:update')
  async updateWebhook(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateWebhookInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WebhookType> {
    const webhook = await this.webhookService.update(id, input as any);

    return {
      id: webhook.id,
      integrationId: webhook.integrationId,
      name: webhook.name,
      url: webhook.url,
      method: webhook.method,
      events: webhook.events,
      status: webhook.status as any,
      authType: webhook.authType as any,
      isActive: webhook.isActive,
      timeout: webhook.timeout,
      retryAttempts: webhook.retryAttempts,
      successCount: webhook.successCount,
      failureCount: webhook.failureCount,
      lastDeliveryAt: webhook.lastDeliveryAt,
      lastSuccessAt: webhook.lastSuccessAt,
      lastFailureAt: webhook.lastFailureAt,
      lastError: webhook.lastError,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    } as any;
  }

  @Mutation(() => Boolean, { name: 'deleteWebhook' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:delete')
  async deleteWebhook(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.webhookService.delete(id);
    return true;
  }

  @Mutation(() => WebhookTestResult, { name: 'testWebhook' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:test')
  async testWebhook(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: TestWebhookInput,
  ): Promise<WebhookTestResult> {
    const testInput: any = {
      tenantId: input.tenantId,
      event: input.event || 'test',
    };
    if (input.data !== undefined) testInput.data = input.data;

    const result = await this.webhookService.testWebhook(id, testInput);

    return {
      success: result.success,
      statusCode: result.statusCode || 0,
      error: result.error || '',
      duration: result.duration,
      timestamp: new Date(),
    };
  }

  @Query(() => [WebhookDeliveryType], { name: 'getWebhookDeliveries' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getWebhookDeliveries(
    @Args('webhookId', { type: () => ID }) webhookId: string,
    @Args('limit', { type: () => Number, defaultValue: 50 }) limit: number,
    @Args('offset', { type: () => Number, defaultValue: 0 }) offset: number,
  ): Promise<WebhookDeliveryType[]> {
    const deliveries = await this.webhookService.getDeliveryHistory(webhookId, limit, offset);
    
    return deliveries.map(delivery => ({
      id: delivery.id,
      webhookId: delivery.webhookId,
      eventType: delivery.eventType,
      statusCode: delivery.statusCode,
      success: delivery.success,
      error: delivery.error,
      duration: delivery.duration,
      deliveredAt: delivery.deliveredAt,
      retryCount: delivery.retryCount,
    })) as any[];
  }

  @Subscription(() => WebhookDeliveryType, {
    name: 'webhookDelivered',
    filter: (payload, variables, context) => {
      return payload.webhookDelivered.webhookId === variables.webhookId;
    },
  })
  webhookDelivered(
    @Args('webhookId', { type: () => ID }) webhookId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator('WEBHOOK_DELIVERED');
  }
}