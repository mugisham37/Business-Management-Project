import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../decorators/public.decorator';

/**
 * Base API controller providing general API information
 */
@ApiTags('API Info')
@Controller('api')
export class ApiController {
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get API information',
    description: 'Returns general information about the API including version, status, and available endpoints.',
  })
  @ApiResponse({
    status: 200,
    description: 'API information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Unified Business Platform API' },
        version: { type: 'string', example: '1.0.0' },
        description: { type: 'string', example: 'Enterprise-level unified business platform API' },
        status: { type: 'string', example: 'operational' },
        timestamp: { type: 'string', example: '2024-01-01T12:00:00.000Z' },
        endpoints: {
          type: 'object',
          properties: {
            documentation: { type: 'string', example: '/docs' },
            graphql: { type: 'string', example: '/graphql' },
            health: { type: 'string', example: '/api/v1/health' },
          },
        },
      },
    },
  })
  getApiInfo() {
    return {
      name: 'Unified Business Platform API',
      version: '1.0.0',
      description: 'Enterprise-level unified business platform API with progressive feature disclosure',
      status: 'operational',
      timestamp: new Date().toISOString(),
      endpoints: {
        documentation: '/docs',
        redoc: '/redoc',
        graphql: '/graphql',
        health: '/api/v1/health',
      },
      features: [
        'Multi-tenant architecture',
        'Progressive feature disclosure',
        'Real-time capabilities',
        'Offline-first design',
        'Comprehensive authentication',
        'Advanced caching',
        'Rate limiting',
        'Comprehensive validation',
      ],
    };
  }

  @Get('versions')
  @Public()
  @ApiOperation({
    summary: 'Get supported API versions',
    description: 'Returns a list of all supported API versions and their status.',
  })
  @ApiResponse({
    status: 200,
    description: 'API versions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        current: { type: 'string', example: 'v1' },
        supported: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              version: { type: 'string', example: 'v1' },
              status: { type: 'string', example: 'stable' },
              deprecated: { type: 'boolean', example: false },
              sunset: { type: 'string', example: null },
            },
          },
        },
      },
    },
  })
  getApiVersions() {
    return {
      current: 'v1',
      supported: [
        {
          version: 'v1',
          status: 'stable',
          deprecated: false,
          sunset: null,
          baseUrl: '/api/v1',
        },
      ],
      deprecation_policy: 'API versions are supported for a minimum of 12 months after deprecation announcement',
    };
  }
}