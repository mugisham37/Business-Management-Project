import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { ConnectorService } from '../services/connector.service';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';

import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';

import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';

import { ConnectorListDto } from '../dto/connector.dto';

@Controller('api/v1/connectors')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@UseInterceptors(LoggingInterceptor)
@RequireFeature('api-access')
@ApiBearerAuth()
@ApiTags('Connectors')
export class ConnectorController {
  constructor(private readonly connectorService: ConnectorService) {}

  @Get()
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'List available connectors' })
  @ApiResponse({ status: 200, description: 'List of connectors' })
  async list(@Query() filters: ConnectorListDto) {
    return this.connectorService.listConnectors(filters);
  }

  @Get(':type/:name')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get connector metadata' })
  @ApiParam({ name: 'type', description: 'Connector type' })
  @ApiParam({ name: 'name', description: 'Connector name' })
  @ApiResponse({ status: 200, description: 'Connector metadata' })
  async getMetadata(
    @Param('type') type: string,
    @Param('name') name: string,
  ) {
    return this.connectorService.getConnectorMetadata(type as any, name);
  }

  @Get(':type/:name/config-schema')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get connector configuration schema' })
  @ApiParam({ name: 'type', description: 'Connector type' })
  @ApiParam({ name: 'name', description: 'Connector name' })
  @ApiResponse({ status: 200, description: 'Configuration schema' })
  async getConfigSchema(
    @Param('type') type: string,
    @Param('name') name: string,
  ) {
    return this.connectorService.getConfigSchema(type as any, name);
  }

  @Post(':type/:name/validate-config')
  @RequirePermission('integrations:create')
  @ApiOperation({ summary: 'Validate connector configuration' })
  @ApiParam({ name: 'type', description: 'Connector type' })
  @ApiParam({ name: 'name', description: 'Connector name' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateConfig(
    @Param('type') type: string,
    @Param('name') name: string,
    @Body() config: Record<string, any>,
  ) {
    return this.connectorService.validateConfig(type as any, name, config);
  }

  @Get('statistics')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get connector statistics' })
  @ApiResponse({ status: 200, description: 'Connector statistics' })
  async getStatistics() {
    return this.connectorService.getConnectorStats();
  }
}