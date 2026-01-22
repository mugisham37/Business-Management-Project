import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { TenantInterceptor } from '../../tenant/interceptors/tenant.interceptor';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';

import { DeveloperPortalService } from '../services/developer-portal.service';
import { ApiKeyService } from '../services/api-key.service';

import {
  APIKeyType,
  APIKeyWithSecret,
  APIUsageType,
  WebhookLogType,
  DeveloperPortalStatsType,
} from '../types/developer-portal.graphql.types';
import { CreateAPIKeyInput } from '../inputs/developer-portal.input';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
export class DeveloperPortalResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly developerPortalService: DeveloperPortalService,
    private readonly apiKeyService: ApiKeyService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => [APIKeyType], { name: 'getAPIKeys' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getAPIKeys(
    @CurrentTenant() tenantId: string,
  ): Promise<APIKeyType[]> {
    const apiKeys = await this.apiKeyService.findByIntegration(tenantId, '', true);
    
    return apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      description: key.description,
      scopes: key.scopes,
      rateLimit: key.rateLimit,
      isActive: key.isActive,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      requestCount: key.requestCount,
    })) as any[];
  }

  @Mutation(() => APIKeyWithSecret, { name: 'createAPIKey' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:create')
  async createAPIKey(
    @Args('input') input: CreateAPIKeyInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<APIKeyWithSecret> {
    const createInput: any = {
      name: input.name,
      scopes: input.scopes,
    };
    if (input.description !== undefined) createInput.description = input.description;
    if (input.rateLimit !== undefined) createInput.rateLimit = input.rateLimit;
    if (input.expiresAt !== undefined) createInput.expiresAt = input.expiresAt;
    
    const result = await this.developerPortalService.createDeveloperApiKey(
      tenantId,
      user.id,
      createInput,
    );

    return {
      apiKey: result.apiKey,
      keyId: result.keyId,
      name: input.name,
      scopes: input.scopes,
    };
  }

  @Mutation(() => Boolean, { name: 'revokeAPIKey' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:delete')
  async revokeAPIKey(
    @Args('keyId', { type: () => ID }) keyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.apiKeyService.revoke(tenantId, keyId, user.id);
    return true;
  }

  @Query(() => APIUsageType, { name: 'getAPIUsage' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getAPIUsage(
    @Args('keyId', { type: () => ID }) keyId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<APIUsageType> {
    const analytics = await this.developerPortalService.getApiUsageAnalytics(tenantId, keyId);
    
    return {
      totalRequests: analytics.totalRequests || 0,
      requestsToday: analytics.requestsToday || 0,
      rateLimit: analytics.rateLimit || 10000,
      remaining: analytics.remaining || 0,
      resetTime: analytics.resetTime || new Date(),
      averageResponseTime: analytics.averageResponseTime || 0,
      errorRate: analytics.errorRate || 0,
    };
  }

  @Query(() => [WebhookLogType], { name: 'getWebhookLogs' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getWebhookLogs(
    @Args('webhookId', { type: () => ID }) webhookId: string,
    @Args('limit', { type: () => Number, defaultValue: 50 }) limit: number,
    @Args('offset', { type: () => Number, defaultValue: 0 }) offset: number,
  ): Promise<WebhookLogType[]> {
    // This would need to be implemented in webhook service
    // For now, return empty array
    return [];
  }

  @Query(() => DeveloperPortalStatsType, { name: 'getDeveloperPortalStats' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getDeveloperPortalStats(
    @CurrentTenant() tenantId: string,
  ): Promise<DeveloperPortalStatsType> {
    const stats = await this.developerPortalService.getDeveloperPortalStats(tenantId);
    
    return {
      totalDevelopers: stats.totalDevelopers,
      activeApiKeys: stats.activeApiKeys,
      totalRequests: stats.totalRequests,
      requestsToday: stats.requestsToday,
      averageResponseTime: stats.averageResponseTime,
      errorRate: stats.errorRate,
    };
  }
}
