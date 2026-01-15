import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { 
  CycleCountingService, 
  CreateStockCountSessionDto, 
  StockCountSessionQueryDto,
  StockCountItemQueryDto,
  CountItemDto
} from '../services/cycle-counting.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/inventory/cycle-counting')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('cycle-counting')
@ApiTags('Cycle Counting')
export class CycleCountingController {
  constructor(private readonly cycleCountingService: CycleCountingService) {}

  @Post('sessions')
  @RequirePermission('inventory:create-stock-count')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new stock count session' })
  @ApiResponse({ status: 201, description: 'Stock count session created successfully' })
  async createSession(
    @Body() createSessionDto: CreateStockCountSessionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cycleCountingService.createStockCountSession(tenantId, createSessionDto, user.id);
  }

  @Get('sessions')
  @RequirePermission('inventory:read-stock-count')
  @ApiOperation({ summary: 'Get stock count sessions' })
  @ApiResponse({ status: 200, description: 'Stock count sessions retrieved successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getSessions(
    @Query() query: StockCountSessionQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cycleCountingService.findSessions(tenantId, query);
  }

  @Get('sessions/:id')
  @RequirePermission('inventory:read-stock-count')
  @ApiOperation({ summary: 'Get stock count session by ID' })
  @ApiResponse({ status: 200, description: 'Stock count session retrieved successfully' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  async getSession(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cycleCountingService.findSessionById(tenantId, id);
  }

  @Post('sessions/:id/start')
  @RequirePermission('inventory:manage-stock-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a stock count session' })
  @ApiResponse({ status: 200, description: 'Stock count session started successfully' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  async startSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cycleCountingService.startStockCountSession(tenantId, id, user.id);
  }

  @Post('sessions/:id/complete')
  @RequirePermission('inventory:manage-stock-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a stock count session' })
  @ApiResponse({ status: 200, description: 'Stock count session completed successfully' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  async completeSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cycleCountingService.completeStockCountSession(tenantId, id, user.id);
  }

  @Get('sessions/:id/items')
  @RequirePermission('inventory:read-stock-count')
  @ApiOperation({ summary: 'Get count items for a session' })
  @ApiResponse({ status: 200, description: 'Count items retrieved successfully' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'hasVariance', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getCountItems(
    @Param('id') sessionId: string,
    @Query() query: Omit<StockCountItemQueryDto, 'sessionId'>,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cycleCountingService.findCountItems(tenantId, { ...query, sessionId });
  }

  @Post('items/:itemId/count')
  @RequirePermission('inventory:count-items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record count for an item' })
  @ApiResponse({ status: 200, description: 'Item count recorded successfully' })
  @ApiParam({ name: 'itemId', description: 'Count item ID' })
  async countItem(
    @Param('itemId') itemId: string,
    @Body() countDto: CountItemDto & { sessionId: string },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cycleCountingService.countItem(
      tenantId,
      countDto.sessionId,
      itemId,
      countDto,
      user.id,
    );
  }

  @Post('items/:itemId/adjust')
  @RequirePermission('inventory:adjust-from-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjust inventory based on count variance' })
  @ApiResponse({ status: 200, description: 'Inventory adjusted successfully' })
  @ApiParam({ name: 'itemId', description: 'Count item ID' })
  async adjustFromCount(
    @Param('itemId') itemId: string,
    @Body() adjustDto: { sessionId: string },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cycleCountingService.adjustInventoryFromCount(
      tenantId,
      adjustDto.sessionId,
      itemId,
      user.id,
    );
  }

  @Get('sessions/:id/summary')
  @RequirePermission('inventory:read-stock-count')
  @ApiOperation({ summary: 'Get session summary' })
  @ApiResponse({ status: 200, description: 'Session summary retrieved successfully' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  async getSessionSummary(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cycleCountingService.getSessionSummary(tenantId, id);
  }

  @Get('sessions/:id/variances')
  @RequirePermission('inventory:read-stock-count')
  @ApiOperation({ summary: 'Get variance report for session' })
  @ApiResponse({ status: 200, description: 'Variance report retrieved successfully' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  async getVarianceReport(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.cycleCountingService.getVarianceReport(tenantId, id);
  }
}