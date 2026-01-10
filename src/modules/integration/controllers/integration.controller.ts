import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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

import { IntegrationService } from '../services/integration.service';
import { ConnectorService } from '../services/connector.service';

import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';

import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';

import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { IntegrationLoggingInterceptor } from '../interceptors/integration-logging.interceptor';

import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  IntegrationListDto,
  IntegrationStatusDto,
  TriggerSyncDto,
} from '../dto/integration.dto';

import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/integrations')
@UseGuards(AuthGuard, TenantGuard, FeatureGuard, RateLimitGuard)
@UseInterceptors(LoggingInterceptor, IntegrationLoggingInterceptor)
@RequireFeature('api-access')
@ApiBearerAuth()
@ApiTags('Integrations')
export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly connectorService: ConnectorService,
  ) {}

  @Post()
  @RequirePermission('integrations:create')
  @ApiOperation({ summary: 'Create a new integration' })
  @ApiResponse({ status: 201, description: 'Integration created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid integration configuration' })
  @ApiResponse({ status: 403, description: 'Feature not available for current tier' })
  async create(
    @Body() dto: CreateIntegrationDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.integrationService.create(tenantId, dto, user.id);
  }

  @Get()
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'List all integrations' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by integration type' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'provider', required: false, description: 'Filter by provider name' })
  @ApiResponse({ status: 200, description: 'List of integrations' })
  async findAll(
    @Query() filters: IntegrationListDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.integrationService.findAll(tenantId, filters);
  }

  @Get(':id')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get integration by ID' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Integration details' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.integrationService.findById(tenantId, id);
  }

  @Put(':id')
  @RequirePermission('integrations:update')
  @ApiOperation({ summary: 'Update integration configuration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Integration updated successfully' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIntegrationDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.integrationService.update(tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('integrations:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 204, description: 'Integration deleted successfully' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    await this.integrationService.delete(tenantId, id, user.id);
  }

  @Post(':id/test-connection')
  @RequirePermission('integrations:test')
  @ApiOperation({ summary: 'Test integration connection' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.integrationService.testConnection(tenantId, id);
    return { success: result };
  }

  @Put(':id/status')
  @RequirePermission('integrations:update')
  @ApiOperation({ summary: 'Update integration status' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IntegrationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.integrationService.updateStatus(tenantId, id, dto.status, user.id);
  }

  @Post(':id/sync')
  @RequirePermission('integrations:sync')
  @RequireFeature('advanced-integrations')
  @ApiOperation({ summary: 'Trigger manual synchronization' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Sync triggered successfully' })
  @ApiResponse({ status: 400, description: 'Integration not active or sync not supported' })
  async triggerSync(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TriggerSyncDto,
    @CurrentTenant() tenantId: string,
  ) {
    const syncId = await this.integrationService.triggerSync(
      tenantId,
      id,
      dto.syncType,
    );
    return { syncId, message: 'Sync triggered successfully' };
  }

  @Get(':id/statistics')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get integration statistics' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Integration statistics' })
  async getStatistics(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.integrationService.getStatistics(tenantId, id);
  }

  @Get('connectors/available')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'List available connectors' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by connector type' })
  @ApiQuery({ name: 'active', required: false, description: 'Filter by active status' })
  @ApiResponse({ status: 200, description: 'List of available connectors' })
  async listConnectors(
    @Query('type') type?: string,
    @Query('active') active?: boolean,
  ) {
    return this.connectorService.listConnectors({
      type: type as any,
      isActive: active,
    });
  }

  @Get('connectors/:type/:name/metadata')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get connector metadata' })
  @ApiParam({ name: 'type', description: 'Connector type' })
  @ApiParam({ name: 'name', description: 'Connector name' })
  @ApiResponse({ status: 200, description: 'Connector metadata' })
  @ApiResponse({ status: 404, description: 'Connector not found' })
  async getConnectorMetadata(
    @Param('type') type: string,
    @Param('name') name: string,
  ) {
    return this.connectorService.getConnectorMetadata(type as any, name);
  }

  @Get('connectors/:type/:name/config-schema')
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

  @Post('connectors/:type/:name/validate-config')
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

  @Get(':id/sync/history')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get synchronization history' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of sync logs to return' })
  @ApiResponse({ status: 200, description: 'Sync history' })
  async getSyncHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit: number = 50,
    @CurrentTenant() tenantId: string,
  ) {
    return this.integrationService.getSyncHistory(id, tenantId, limit);
  }

  @Get('sync/:syncId')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get sync details by ID' })
  @ApiParam({ name: 'syncId', description: 'Sync ID' })
  @ApiResponse({ status: 200, description: 'Sync details' })
  @ApiResponse({ status: 404, description: 'Sync not found' })
  async getSyncDetails(
    @Param('syncId', ParseUUIDPipe) syncId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.integrationService.getSyncDetails(syncId, tenantId);
  }

  @Post('sync/:syncId/retry')
  @RequirePermission('integrations:sync')
  @RequireFeature('advanced-integrations')
  @ApiOperation({ summary: 'Retry failed synchronization' })
  @ApiParam({ name: 'syncId', description: 'Sync ID' })
  @ApiResponse({ status: 200, description: 'Sync retry initiated' })
  @ApiResponse({ status: 400, description: 'Sync cannot be retried' })
  async retrySync(
    @Param('syncId', ParseUUIDPipe) syncId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const newSyncId = await this.integrationService.retrySync(syncId, tenantId);
    return { syncId: newSyncId, message: 'Sync retry initiated' };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get integration platform health status' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        connectors: 'healthy',
        webhooks: 'healthy',
        sync: 'healthy',
      },
    };
  }
}