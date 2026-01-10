import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ApiKeyService } from './api-key.service';
import { RateLimitService } from './rate-limit.service';
import { IntegrationService } from './integration.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface APIDocumentation {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      email: string;
      url: string;
    };
    license?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  security: Array<Record<string, any>>;
}

export interface SDKConfiguration {
  language: string;
  version: string;
  packageName: string;
  namespace?: string;
  clientName: string;
  features: string[];
  dependencies: Record<string, string>;
  examples: Array<{
    title: string;
    description: string;
    code: string;
  }>;
}

export interface DeveloperPortalStats {
  totalDevelopers: number;
  activeApiKeys: number;
  totalRequests: number;
  requestsToday: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
    averageResponseTime: number;
  }>;
  rateLimitStats: {
    totalLimited: number;
    limitedToday: number;
  };
}

@Injectable()
export class DeveloperPortalService {
  private readonly logger = new Logger(DeveloperPortalService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly apiKeyService: ApiKeyService,
    private readonly rateLimitService: RateLimitService,
    private readonly integrationService: IntegrationService,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generate comprehensive API documentation
   */
  async generateApiDocumentation(tenantId?: string): Promise<APIDocumentation> {
    this.logger.log('Generating comprehensive API documentation');

    const cacheKey = `api-docs:${tenantId || 'public'}`;
    let documentation = await this.cacheService.get<APIDocumentation>(cacheKey);
    
    if (documentation) {
      return documentation;
    }

    const baseUrl = this.configService.get('API_BASE_URL', 'https://api.example.com');
    const version = this.configService.get('API_VERSION', '1.0.0');

    documentation = {
      openapi: '3.0.3',
      info: {
        title: 'Unified Business Platform API',
        version,
        description: `
# Unified Business Platform API

The Unified Business Platform API provides comprehensive access to all business management features including:

- **Point of Sale (POS)** - Process transactions, manage payments, generate receipts
- **Inventory Management** - Track stock levels, manage products, automate reordering
- **Customer Relationship Management (CRM)** - Manage customer profiles, loyalty programs, analytics
- **Employee Management** - Handle HR functions, scheduling, payroll, performance tracking
- **Financial Management** - Accounting, reporting, budgeting, tax management
- **Multi-Location Operations** - Centralized control with location-specific flexibility
- **Real-time Communication** - WebSocket notifications, multi-channel messaging
- **Advanced Analytics** - Business intelligence, predictive analytics, custom reporting
- **Integration Platform** - Connect with third-party services, webhooks, data synchronization

## Authentication

The API uses API key authentication. Include your API key in the Authorization header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Rate Limiting

API requests are rate limited based on your subscription tier:
- **Micro Tier**: 1,000 requests/hour
- **Small Tier**: 10,000 requests/hour  
- **Medium Tier**: 100,000 requests/hour
- **Enterprise Tier**: 1,000,000 requests/hour

## Error Handling

The API uses standard HTTP status codes and returns detailed error information:

\`\`\`json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errorCode": "VALIDATION_ERROR",
  "context": {
    "field": "email",
    "value": "invalid-email"
  },
  "timestamp": "2024-01-10T10:00:00Z"
}
\`\`\`

## Pagination

List endpoints support cursor-based pagination:

\`\`\`json
{
  "data": [...],
  "pagination": {
    "hasNext": true,
    "hasPrevious": false,
    "nextCursor": "eyJpZCI6IjEyMyJ9",
    "previousCursor": null,
    "total": 150
  }
}
\`\`\`

## Webhooks

Subscribe to real-time events using webhooks. Configure webhook endpoints in your integration settings.

Supported events:
- \`transaction.created\`
- \`inventory.low_stock\`
- \`customer.created\`
- \`employee.clocked_in\`
- \`sync.completed\`

## SDKs

Official SDKs are available for:
- JavaScript/TypeScript
- Python
- PHP
- Java
- C#
- Go
- Ruby

Download SDKs from the developer portal.
        `,
        contact: {
          name: 'API Support',
          email: 'api-support@example.com',
          url: 'https://docs.example.com/support',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: baseUrl,
          description: 'Production API Server',
        },
        {
          url: baseUrl.replace('api.', 'api-staging.'),
          description: 'Staging API Server',
        },
      ],
      paths: await this.generateApiPaths(tenantId),
      components: {
        schemas: await this.generateSchemas(),
        securitySchemes: {
          ApiKeyAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'API Key',
            description: 'API key authentication. Include your API key in the Authorization header as a Bearer token.',
          },
          OAuth2: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: `${baseUrl}/oauth2/authorize`,
                tokenUrl: `${baseUrl}/oauth2/token`,
                scopes: {
                  'read': 'Read access to resources',
                  'write': 'Write access to resources',
                  'admin': 'Administrative access',
                },
              },
            },
          },
        },
      },
      security: [
        { ApiKeyAuth: [] },
        { OAuth2: ['read', 'write'] },
      ],
    };

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, documentation, 3600);

    return documentation;
  }

  /**
   * Generate SDK for specified programming language
   */
  async generateSDK(language: string, tenantId?: string): Promise<SDKConfiguration> {
    this.logger.log(`Generating SDK for language: ${language}`);

    const supportedLanguages = [
      'javascript', 'typescript', 'python', 'php', 'java', 'csharp', 'go', 'ruby'
    ];

    if (!supportedLanguages.includes(language.toLowerCase())) {
      throw new BadRequestException(`Unsupported language: ${language}. Supported languages: ${supportedLanguages.join(', ')}`);
    }

    const cacheKey = `sdk:${language}:${tenantId || 'public'}`;
    let sdkConfig = await this.cacheService.get<SDKConfiguration>(cacheKey);
    
    if (sdkConfig) {
      return sdkConfig;
    }

    const baseConfig = await this.getBaseSDKConfig(language);
    const apiDocs = await this.generateApiDocumentation(tenantId);

    sdkConfig = {
      ...baseConfig,
      version: apiDocs.info.version,
      examples: await this.generateSDKExamples(language),
    };

    // Cache for 6 hours
    await this.cacheService.set(cacheKey, sdkConfig, 21600);

    // Emit SDK generation event for analytics
    this.eventEmitter.emit('sdk.generated', {
      language,
      tenantId,
      timestamp: new Date(),
    });

    return sdkConfig;
  }

  /**
   * Get developer portal statistics
   */
  async getDeveloperPortalStats(tenantId: string): Promise<DeveloperPortalStats> {
    this.logger.log(`Getting developer portal stats for tenant: ${tenantId}`);

    const cacheKey = `dev-portal-stats:${tenantId}`;
    let stats = await this.cacheService.get<DeveloperPortalStats>(cacheKey);
    
    if (stats) {
      return stats;
    }

    // Get API key statistics
    const apiKeyStats = await this.apiKeyService.getStatistics(tenantId);
    
    // Get rate limit statistics
    const rateLimitStats = await this.rateLimitService.getRateLimitStats('api_key');

    // Calculate additional metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    stats = {
      totalDevelopers: apiKeyStats.totalKeys || 0,
      activeApiKeys: apiKeyStats.activeKeys || 0,
      totalRequests: apiKeyStats.totalRequests || 0,
      requestsToday: apiKeyStats.requestsToday || 0,
      averageResponseTime: apiKeyStats.averageResponseTime || 0,
      errorRate: apiKeyStats.errorRate || 0,
      topEndpoints: apiKeyStats.topEndpoints || [],
      rateLimitStats: {
        totalLimited: rateLimitStats.totalLimited || 0,
        limitedToday: rateLimitStats.limitedToday || 0,
      },
    };

    // Cache for 15 minutes
    await this.cacheService.set(cacheKey, stats, 900);

    return stats;
  }

  /**
   * Create developer API key
   */
  async createDeveloperApiKey(
    tenantId: string,
    userId: string,
    keyData: {
      name: string;
      description?: string;
      scopes: string[];
      rateLimit?: number;
      expiresAt?: Date;
    }
  ): Promise<{ apiKey: string; keyId: string }> {
    this.logger.log(`Creating developer API key for tenant: ${tenantId}`);

    // Create API key with developer-specific settings
    const result = await this.apiKeyService.createApiKey(tenantId, {
      name: keyData.name,
      description: keyData.description || 'Developer API Key',
      scopes: keyData.scopes,
      permissions: this.getDefaultDeveloperPermissions(keyData.scopes),
      rateLimit: keyData.rateLimit || this.getDefaultRateLimit(tenantId),
      expiresAt: keyData.expiresAt,
      createdBy: userId,
    });

    // Emit developer key creation event
    this.eventEmitter.emit('developer.api_key_created', {
      tenantId,
      userId,
      keyId: result.keyId,
      scopes: keyData.scopes,
    });

    return result;
  }

  /**
   * Get API usage analytics for developer
   */
  async getApiUsageAnalytics(
    tenantId: string,
    apiKeyId: string,
    timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<any> {
    this.logger.log(`Getting API usage analytics for key: ${apiKeyId}`);

    const cacheKey = `api-usage:${apiKeyId}:${timeRange}`;
    let analytics = await this.cacheService.get(cacheKey);
    
    if (analytics) {
      return analytics;
    }

    // Get usage data from rate limit service
    analytics = await this.rateLimitService.getUsageStats(apiKeyId, 'api_key', timeRange);

    // Cache based on time range
    const cacheTTL = timeRange === 'hour' ? 300 : timeRange === 'day' ? 900 : 3600;
    await this.cacheService.set(cacheKey, analytics, cacheTTL);

    return analytics;
  }

  /**
   * Validate API key and get quota information
   */
  async validateApiKeyAndGetQuota(apiKey: string): Promise<{
    isValid: boolean;
    tenantId?: string;
    keyId?: string;
    scopes?: string[];
    rateLimit?: {
      limit: number;
      remaining: number;
      resetTime: Date;
    };
  }> {
    // Validate API key
    const keyInfo = await this.apiKeyService.validateApiKey(apiKey);
    
    if (!keyInfo.isValid) {
      return { isValid: false };
    }

    // Get rate limit information
    const rateLimitInfo = await this.rateLimitService.checkRateLimit(
      keyInfo.keyId!,
      'api_key'
    );

    return {
      isValid: true,
      tenantId: keyInfo.tenantId,
      keyId: keyInfo.keyId,
      scopes: keyInfo.scopes,
      rateLimit: {
        limit: rateLimitInfo.limit,
        remaining: rateLimitInfo.remaining,
        resetTime: rateLimitInfo.resetTime,
      },
    };
  }

  /**
   * Generate API paths documentation
   */
  private async generateApiPaths(tenantId?: string): Promise<Record<string, any>> {
    // This would generate comprehensive OpenAPI paths for all endpoints
    // For brevity, returning a sample structure
    return {
      '/api/v1/pos/transactions': {
        post: {
          summary: 'Process a sale transaction',
          description: 'Create and process a new point-of-sale transaction',
          tags: ['Point of Sale'],
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateTransactionRequest' },
              },
            },
          },
          responses: {
            201: {
              description: 'Transaction created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Transaction' },
                },
              },
            },
            400: {
              description: 'Invalid request data',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
        get: {
          summary: 'List transactions',
          description: 'Retrieve a paginated list of transactions',
          tags: ['Point of Sale'],
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
            {
              name: 'cursor',
              in: 'query',
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'List of transactions',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Transaction' },
                      },
                      pagination: { $ref: '#/components/schemas/PaginationInfo' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // Add more endpoints...
    };
  }

  /**
   * Generate API schemas
   */
  private async generateSchemas(): Promise<Record<string, any>> {
    return {
      Transaction: {
        type: 'object',
        required: ['id', 'tenantId', 'locationId', 'total', 'status'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          locationId: { type: 'string', format: 'uuid' },
          customerId: { type: 'string', format: 'uuid', nullable: true },
          total: { type: 'number', format: 'decimal' },
          subtotal: { type: 'number', format: 'decimal' },
          tax: { type: 'number', format: 'decimal' },
          discount: { type: 'number', format: 'decimal' },
          status: { 
            type: 'string', 
            enum: ['pending', 'completed', 'cancelled', 'refunded'] 
          },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/TransactionItem' },
          },
          payments: {
            type: 'array',
            items: { $ref: '#/components/schemas/Payment' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateTransactionRequest: {
        type: 'object',
        required: ['locationId', 'items'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          customerId: { type: 'string', format: 'uuid', nullable: true },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'quantity', 'unitPrice'],
              properties: {
                productId: { type: 'string', format: 'uuid' },
                quantity: { type: 'number', minimum: 0.01 },
                unitPrice: { type: 'number', minimum: 0 },
                discount: { type: 'number', minimum: 0, default: 0 },
              },
            },
          },
          payments: {
            type: 'array',
            items: {
              type: 'object',
              required: ['method', 'amount'],
              properties: {
                method: { 
                  type: 'string', 
                  enum: ['cash', 'card', 'mobile_money', 'digital_wallet'] 
                },
                amount: { type: 'number', minimum: 0.01 },
                reference: { type: 'string' },
              },
            },
          },
          discountAmount: { type: 'number', minimum: 0, default: 0 },
          notes: { type: 'string', maxLength: 500 },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['statusCode', 'message', 'timestamp'],
        properties: {
          statusCode: { type: 'integer' },
          message: { type: 'string' },
          errorCode: { type: 'string' },
          context: { type: 'object' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      PaginationInfo: {
        type: 'object',
        properties: {
          hasNext: { type: 'boolean' },
          hasPrevious: { type: 'boolean' },
          nextCursor: { type: 'string', nullable: true },
          previousCursor: { type: 'string', nullable: true },
          total: { type: 'integer' },
        },
      },
    };
  }

  /**
   * Get base SDK configuration for language
   */
  private async getBaseSDKConfig(language: string): Promise<Partial<SDKConfiguration>> {
    const configs = {
      javascript: {
        language: 'javascript',
        packageName: 'unified-business-platform-sdk',
        clientName: 'UnifiedBusinessPlatformClient',
        features: ['async/await', 'promises', 'typescript-definitions'],
        dependencies: {
          'axios': '^1.0.0',
          'ws': '^8.0.0',
        },
      },
      typescript: {
        language: 'typescript',
        packageName: 'unified-business-platform-sdk',
        clientName: 'UnifiedBusinessPlatformClient',
        features: ['full-type-safety', 'async/await', 'websockets'],
        dependencies: {
          'axios': '^1.0.0',
          'ws': '^8.0.0',
        },
      },
      python: {
        language: 'python',
        packageName: 'unified-business-platform',
        clientName: 'UnifiedBusinessPlatformClient',
        features: ['async-support', 'type-hints', 'websockets'],
        dependencies: {
          'httpx': '>=0.24.0',
          'websockets': '>=11.0.0',
          'pydantic': '>=2.0.0',
        },
      },
      php: {
        language: 'php',
        packageName: 'unified-business-platform/sdk',
        namespace: 'UnifiedBusinessPlatform',
        clientName: 'Client',
        features: ['psr-7', 'psr-18', 'async-support'],
        dependencies: {
          'guzzlehttp/guzzle': '^7.0',
          'psr/http-message': '^1.0',
        },
      },
      java: {
        language: 'java',
        packageName: 'com.unifiedbusinessplatform.sdk',
        clientName: 'UnifiedBusinessPlatformClient',
        features: ['reactive-streams', 'completable-futures', 'websockets'],
        dependencies: {
          'com.squareup.okhttp3:okhttp': '4.12.0',
          'com.fasterxml.jackson.core:jackson-databind': '2.15.0',
        },
      },
      csharp: {
        language: 'csharp',
        packageName: 'UnifiedBusinessPlatform.SDK',
        namespace: 'UnifiedBusinessPlatform.SDK',
        clientName: 'UnifiedBusinessPlatformClient',
        features: ['async-await', 'cancellation-tokens', 'websockets'],
        dependencies: {
          'System.Net.Http': '4.3.4',
          'Newtonsoft.Json': '13.0.3',
        },
      },
      go: {
        language: 'go',
        packageName: 'github.com/unified-business-platform/go-sdk',
        clientName: 'Client',
        features: ['context-support', 'goroutines', 'websockets'],
        dependencies: {
          'github.com/gorilla/websocket': 'v1.5.0',
        },
      },
      ruby: {
        language: 'ruby',
        packageName: 'unified_business_platform',
        clientName: 'UnifiedBusinessPlatform::Client',
        features: ['async-support', 'websockets', 'active-support'],
        dependencies: {
          'faraday': '~> 2.0',
          'websocket-client-simple': '~> 0.6',
        },
      },
    };

    return configs[language.toLowerCase()] || {};
  }

  /**
   * Generate SDK examples for language
   */
  private async generateSDKExamples(language: string): Promise<Array<{ title: string; description: string; code: string }>> {
    const examples = {
      javascript: [
        {
          title: 'Initialize Client',
          description: 'Create and configure the API client',
          code: `
const { UnifiedBusinessPlatformClient } = require('unified-business-platform-sdk');

const client = new UnifiedBusinessPlatformClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.example.com',
});
          `,
        },
        {
          title: 'Process Transaction',
          description: 'Create and process a point-of-sale transaction',
          code: `
const transaction = await client.pos.createTransaction({
  locationId: 'location-123',
  customerId: 'customer-456',
  items: [
    {
      productId: 'product-789',
      quantity: 2,
      unitPrice: 19.99,
    },
  ],
  payments: [
    {
      method: 'card',
      amount: 39.98,
    },
  ],
});

console.log('Transaction created:', transaction.id);
          `,
        },
      ],
      python: [
        {
          title: 'Initialize Client',
          description: 'Create and configure the API client',
          code: `
from unified_business_platform import UnifiedBusinessPlatformClient

client = UnifiedBusinessPlatformClient(
    api_key="your-api-key",
    base_url="https://api.example.com"
)
          `,
        },
        {
          title: 'Process Transaction',
          description: 'Create and process a point-of-sale transaction',
          code: `
transaction = await client.pos.create_transaction({
    "location_id": "location-123",
    "customer_id": "customer-456",
    "items": [
        {
            "product_id": "product-789",
            "quantity": 2,
            "unit_price": 19.99,
        }
    ],
    "payments": [
        {
            "method": "card",
            "amount": 39.98,
        }
    ],
})

print(f"Transaction created: {transaction.id}")
          `,
        },
      ],
    };

    return examples[language.toLowerCase()] || [];
  }

  /**
   * Get default developer permissions based on scopes
   */
  private getDefaultDeveloperPermissions(scopes: string[]): string[] {
    const scopePermissionMap = {
      'pos': ['pos:read', 'pos:create'],
      'inventory': ['inventory:read', 'inventory:update'],
      'customers': ['customers:read', 'customers:create', 'customers:update'],
      'employees': ['employees:read'],
      'financial': ['financial:read'],
      'analytics': ['analytics:read'],
      'integrations': ['integrations:read', 'integrations:create'],
    };

    const permissions = new Set<string>();
    
    for (const scope of scopes) {
      const scopePermissions = scopePermissionMap[scope] || [];
      scopePermissions.forEach(permission => permissions.add(permission));
    }

    return Array.from(permissions);
  }

  /**
   * Get default rate limit based on tenant tier
   */
  private getDefaultRateLimit(tenantId: string): number {
    // This would typically check the tenant's business tier
    // For now, return a default value
    return 10000; // 10,000 requests per hour
  }
}