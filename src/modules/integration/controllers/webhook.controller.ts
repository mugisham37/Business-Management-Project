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
  ApiBearerAuth,
} from '@nestjs/swagger';

import { WebhookService } from '../services/webhook.service';

import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';

import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';

import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

import {
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookTestDto,
} from '../dto/webhook.dto';

import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/integrations/:integrationId/webhooks')
@UseGuards(AuthGuard, TenantGuard, FeatureGuard)
@UseInterceptors(LoggingInterceptor)
@RequireFeature('advanced-integrations')
@ApiBearerAuth()
@ApiTags('Integration Webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @RequirePermission('integrations:create')
  @ApiOperation({ summary: 'Create a new webhook' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  @ApiResponse({ status: 201, description: 'Webhook created successfully' })
  async create(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Body() dto: CreateWebhookDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.webhookService.create(integrationId, dto);
  }

  @Put(':webhookId')
  @RequirePermission('integrations:update')
  @ApiOperation({ summary: 'Update webhook configuration' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  @ApiParam({ name: 'webhookId', description: 'Webhook ID' })
  @ApiResponse({ status: 200, description: 'Webhook updated successfully' })
  async update(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhookService.update(webhookId, dto);
  }

  @Delete(':webhookId')
  @RequirePermission('integrations:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  @ApiParam({ name: 'webhookId', description: 'Webhook ID' })
  @ApiResponse({ status: 204, description: 'Webhook deleted successfully' })
  async delete(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
  ) {
    await this.webhookService.delete(webhookId);
  }

  @Post(':webhookId/test')
  @RequirePermission('integrations:test')
  @ApiOperation({ summary: 'Test webhook delivery' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  @ApiParam({ name: 'webhookId', description: 'Webhook ID' })
  @ApiResponse({ status: 200, description: 'Webhook test result' })
  async test(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
    @Body() dto: WebhookTestDto,
  ) {
    return this.webhookService.testWebhook(webhookId, dto);
  }

  @Get(':webhookId/deliveries')
  @RequirePermission('integrations:read')
  @ApiOperation({ summary: 'Get webhook delivery history' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  @ApiParam({ name: 'webhookId', description: 'Webhook ID' })
  @ApiResponse({ status: 200, description: 'Webhook delivery history' })
  async getDeliveries(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.webhookService.getDeliveryHistory(
      webhookId,
      limit || 50,
      offset || 0,
    );
  }
}