import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { DeveloperPortalService } from '../services/developer-portal.service';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';

import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';

import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/developer')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@UseInterceptors(LoggingInterceptor)
@RequireFeature('custom-integrations')
@ApiBearerAuth()
@ApiTags('Developer Portal')
export class DeveloperPortalController {
  constructor(private readonly developerPortalService: DeveloperPortalService) {}

  @Get('documentation')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get comprehensive API documentation' })
  @ApiResponse({ status: 200, description: 'OpenAPI 3.0 specification' })
  async getDocumentation(@CurrentTenant() tenantId: string) {
    return this.developerPortalService.generateApiDocumentation(tenantId);
  }

  @Get('documentation/public')
  @ApiOperation({ summary: 'Get public API documentation (no authentication required)' })
  @ApiResponse({ status: 200, description: 'Public OpenAPI 3.0 specification' })
  async getPublicDocumentation() {
    return this.developerPortalService.generateApiDocumentation();
  }

  @Post('sdk/:language')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Generate SDK for specified programming language' })
  @ApiParam({ 
    name: 'language', 
    description: 'Programming language (javascript, typescript, python, php, java, csharp, go, ruby)',
    enum: ['javascript', 'typescript', 'python', 'php', 'java', 'csharp', 'go', 'ruby']
  })
  @ApiResponse({ status: 200, description: 'SDK configuration and download information' })
  @ApiResponse({ status: 400, description: 'Unsupported programming language' })
  async generateSDK(
    @Param('language') language: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.developerPortalService.generateSDK(language, tenantId);
  }

  @Get('stats')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get developer portal statistics and analytics' })
  @ApiResponse({ status: 200, description: 'Developer portal statistics' })
  async getStats(@CurrentTenant() tenantId: string) {
    return this.developerPortalService.getDeveloperPortalStats(tenantId);
  }

  @Post('api-keys')
  @RequirePermission('integrations:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new developer API key' })
  @ApiResponse({ status: 201, description: 'API key created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid API key configuration' })
  async createApiKey(
    @Body() keyData: {
      name: string;
      description?: string;
      scopes: string[];
      rateLimit?: number;
      expiresAt?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    const apiKeyData: {
      name: string;
      description?: string;
      scopes: string[];
      rateLimit?: number;
      expiresAt?: Date;
    } = {
      name: keyData.name,
      scopes: keyData.scopes,
    };

    if (keyData.description !== undefined) {
      apiKeyData.description = keyData.description;
    }
    if (keyData.rateLimit !== undefined) {
      apiKeyData.rateLimit = keyData.rateLimit;
    }
    if (keyData.expiresAt !== undefined) {
      apiKeyData.expiresAt = new Date(keyData.expiresAt);
    }

    return this.developerPortalService.createDeveloperApiKey(tenantId, user.id, apiKeyData);
  }

  @Get('api-keys/:keyId/usage')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get API usage analytics for a specific API key' })
  @ApiParam({ name: 'keyId', description: 'API key ID' })
  @ApiQuery({ 
    name: 'timeRange', 
    required: false, 
    description: 'Time range for analytics',
    enum: ['hour', 'day', 'week', 'month']
  })
  @ApiResponse({ status: 200, description: 'API usage analytics' })
  async getApiUsage(
    @Param('keyId', ParseUUIDPipe) keyId: string,
    @Query('timeRange') timeRange: 'hour' | 'day' | 'week' | 'month' = 'day',
    @CurrentTenant() tenantId: string,
  ) {
    return this.developerPortalService.getApiUsageAnalytics(tenantId, keyId);
  }

  @Post('validate-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate API key and get quota information' })
  @ApiResponse({ status: 200, description: 'API key validation result' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  async validateApiKey(@Body() { apiKey }: { apiKey: string }) {
    return this.developerPortalService.validateApiKeyAndGetQuota(apiKey);
  }

  @Get('examples/:language')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get code examples for specific programming language' })
  @ApiParam({ name: 'language', description: 'Programming language' })
  @ApiResponse({ status: 200, description: 'Code examples' })
  async getCodeExamples(@Param('language') language: string) {
    const sdk = await this.developerPortalService.generateSDK(language);
    return { examples: sdk.examples };
  }

  @Get('webhooks/events')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get list of available webhook events' })
  @ApiResponse({ status: 200, description: 'Available webhook events' })
  async getWebhookEvents() {
    return {
      events: [
        {
          name: 'transaction.created',
          description: 'Triggered when a new transaction is created',
          payload: {
            transactionId: 'string',
            tenantId: 'string',
            locationId: 'string',
            total: 'number',
            status: 'string',
          },
        },
        {
          name: 'inventory.low_stock',
          description: 'Triggered when inventory falls below reorder point',
          payload: {
            productId: 'string',
            tenantId: 'string',
            locationId: 'string',
            currentLevel: 'number',
            reorderPoint: 'number',
          },
        },
        {
          name: 'customer.created',
          description: 'Triggered when a new customer is created',
          payload: {
            customerId: 'string',
            tenantId: 'string',
            email: 'string',
            firstName: 'string',
            lastName: 'string',
          },
        },
        {
          name: 'employee.clocked_in',
          description: 'Triggered when an employee clocks in',
          payload: {
            employeeId: 'string',
            tenantId: 'string',
            locationId: 'string',
            clockInTime: 'string',
          },
        },
        {
          name: 'sync.completed',
          description: 'Triggered when data synchronization completes',
          payload: {
            syncId: 'string',
            integrationId: 'string',
            tenantId: 'string',
            status: 'string',
            recordsProcessed: 'number',
          },
        },
      ],
    };
  }

  @Get('rate-limits')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get rate limit information for current tenant' })
  @ApiResponse({ status: 200, description: 'Rate limit information' })
  async getRateLimits(@CurrentTenant() tenantId: string) {
    return {
      limits: {
        micro: { requestsPerHour: 1000, burstLimit: 10 },
        small: { requestsPerHour: 10000, burstLimit: 50 },
        medium: { requestsPerHour: 100000, burstLimit: 200 },
        enterprise: { requestsPerHour: 1000000, burstLimit: 1000 },
      },
      headers: {
        'X-RateLimit-Limit': 'Total requests allowed per hour',
        'X-RateLimit-Remaining': 'Remaining requests in current window',
        'X-RateLimit-Reset': 'Unix timestamp when rate limit resets',
        'X-RateLimit-Retry-After': 'Seconds to wait before retrying (when rate limited)',
      },
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get developer portal health status' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        documentation: 'healthy',
        sdk_generation: 'healthy',
        api_keys: 'healthy',
        rate_limiting: 'healthy',
      },
    };
  }
}