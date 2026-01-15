import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Configure Swagger/OpenAPI documentation
 */
export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  // Skip Swagger in production for security
  if (isProduction) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Unified Business Platform API')
    .setDescription(`
      Enterprise-level unified business platform API with progressive feature disclosure.
      
      ## Features
      - Multi-tenant architecture with complete data isolation
      - Progressive feature unlocking based on business growth
      - Comprehensive authentication and authorization
      - Real-time capabilities with WebSocket support
      - Advanced caching and performance optimization
      - Offline-first architecture for reliability
      
      ## Authentication
      This API uses JWT Bearer tokens for authentication. Include the token in the Authorization header:
      \`Authorization: Bearer <your-jwt-token>\`
      
      ## Versioning
      The API uses URL versioning (e.g., /api/v1/). Always specify the version in your requests.
      
      ## Rate Limiting
      API requests are rate-limited per user/IP. Check the X-RateLimit-* headers for current limits.
      
      ## Error Handling
      All errors follow a standardized format with success, message, errors, code, and timestamp fields.
    `)
    .setVersion('1.0.0')
    .setContact(
      'API Support',
      'https://example.com/support',
      'support@example.com'
    )
    .setLicense(
      'MIT',
      'https://opensource.org/licenses/MIT'
    )
    .addServer('http://localhost:3000', 'Development Server')
    .addServer('https://api-staging.example.com', 'Staging Server')
    .addServer('https://api.example.com', 'Production Server')
    
    // Authentication schemes
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API Key for service-to-service authentication',
      },
      'API-Key'
    )
    
    // Tags for organizing endpoints
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Multi-Tenant', 'Multi-tenancy management and configuration')
    .addTag('Feature Flags', 'Progressive feature disclosure management')
    .addTag('Point of Sale', 'POS transaction processing and management')
    .addTag('Inventory', 'Inventory management and tracking')
    .addTag('Customers', 'Customer relationship management')
    .addTag('Employees', 'Employee and HR management')
    .addTag('Financial', 'Financial management and reporting')
    .addTag('Suppliers', 'Supplier and procurement management')
    .addTag('Analytics', 'Business intelligence and analytics')
    .addTag('Integrations', 'Third-party service integrations')
    .addTag('Health', 'System health checks and monitoring')
    .addTag('Admin', 'Administrative operations')
    
    // External documentation
    .setExternalDoc('API Documentation', 'https://docs.example.com/api')
    
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  });

  // Customize the document
  document.info.version = '1.0.0';
  (document.info as any)['x-logo'] = {
    url: 'https://example.com/logo.png',
    altText: 'Unified Business Platform Logo',
  };

  // Add global responses
  document.components = document.components || {};
  document.components.responses = {
    ...document.components.responses,
    UnauthorizedError: {
      description: 'Authentication information is missing or invalid',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Unauthorized' },
              code: { type: 'string', example: 'UNAUTHORIZED' },
              timestamp: { type: 'string', example: '2024-01-01T12:00:00.000Z' },
            },
          },
        },
      },
    },
    ForbiddenError: {
      description: 'Insufficient permissions or feature not available',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Forbidden' },
              code: { type: 'string', example: 'FORBIDDEN' },
              timestamp: { type: 'string', example: '2024-01-01T12:00:00.000Z' },
            },
          },
        },
      },
    },
    ValidationError: {
      description: 'Request validation failed',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Validation failed' },
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string', example: 'email' },
                    value: { type: 'string', example: 'invalid-email' },
                    constraints: {
                      type: 'object',
                      example: { isEmail: 'email must be a valid email' },
                    },
                  },
                },
              },
              timestamp: { type: 'string', example: '2024-01-01T12:00:00.000Z' },
            },
          },
        },
      },
    },
    RateLimitError: {
      description: 'Rate limit exceeded',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Too many requests' },
              code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
              retryAfter: { type: 'number', example: 60 },
              timestamp: { type: 'string', example: '2024-01-01T12:00:00.000Z' },
            },
          },
        },
      },
    },
  };

  // Setup Swagger UI
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
    customSiteTitle: 'Unified Business Platform API Documentation',
    customfavIcon: 'https://example.com/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c3e50; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px; border-radius: 5px; }
    `,
  });

  // Also setup ReDoc (alternative documentation)
  SwaggerModule.setup('redoc', app, document, {
    useGlobalPrefix: true,
  });

  console.log('📚 Swagger documentation available at: /docs');
  console.log('📖 ReDoc documentation available at: /redoc');
}