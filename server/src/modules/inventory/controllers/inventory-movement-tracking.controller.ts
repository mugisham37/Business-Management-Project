import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { 
  InventoryMovementTrackingService,
  DetailedMovementQueryDto,
  MovementAnalysisDto,
} from '../services/inventory-movement-tracking.service';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';

@Controller('api/v1/inventory/movement-tracking')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('inventory-management')
@ApiTags('Inventory Movement Tracking')
export class InventoryMovementTrackingController {
  constructor(
    private readonly movementTrackingService: InventoryMovementTrackingService,
  ) {}

  @Get('detailed-history')
  @RequirePermission('inventory:read-movements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get detailed inventory movement history with analytics' })
  @ApiResponse({ status: 200, description: 'Detailed movement history retrieved successfully' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'movementType', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getDetailedMovementHistory(
    @Query() query: DetailedMovementQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.movementTrackingService.getDetailedMovementHistory(tenantId, query);
  }

  @Get('velocity-analysis/:productId/:locationId')
  @RequirePermission('inventory:read-analytics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyze inventory movement velocity for a product at a location' })
  @ApiResponse({ status: 200, description: 'Movement velocity analysis completed successfully' })
  @ApiParam({ name: 'productId', type: 'string' })
  @ApiParam({ name: 'locationId', type: 'string' })
  @ApiQuery({ name: 'periodDays', required: false, description: 'Analysis period in days (default: 30)' })
  async analyzeMovementVelocity(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
    @Query('periodDays') periodDays?: number,
  ) {
    return this.movementTrackingService.analyzeMovementVelocity(
      tenantId,
      productId,
      locationId,
      periodDays ? parseInt(periodDays.toString()) : 30,
    );
  }

  @Get('pattern-analysis')
  @RequirePermission('inventory:read-analytics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyze inventory movement patterns across locations' })
  @ApiResponse({ status: 200, description: 'Movement pattern analysis completed successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'periodDays', required: false, description: 'Analysis period in days (default: 30)' })
  async analyzeMovementPatterns(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
    @Query('periodDays') periodDays?: number,
  ) {
    return this.movementTrackingService.analyzeMovementPatterns(
      tenantId,
      locationId,
      periodDays ? parseInt(periodDays.toString()) : 30,
    );
  }

  @Get('accuracy-metrics/:locationId')
  @RequirePermission('inventory:read-analytics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate inventory accuracy metrics for a location' })
  @ApiResponse({ status: 200, description: 'Inventory accuracy metrics calculated successfully' })
  @ApiParam({ name: 'locationId', type: 'string' })
  @ApiQuery({ name: 'periodDays', required: false, description: 'Analysis period in days (default: 30)' })
  async calculateInventoryAccuracy(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
    @Query('periodDays') periodDays?: number,
  ) {
    return this.movementTrackingService.calculateInventoryAccuracy(
      tenantId,
      locationId,
      periodDays ? parseInt(periodDays.toString()) : 30,
    );
  }

  @Get('audit-trail/:productId')
  @RequirePermission('inventory:read-audit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get complete audit trail for a product' })
  @ApiResponse({ status: 200, description: 'Audit trail retrieved successfully' })
  @ApiParam({ name: 'productId', type: 'string' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getMovementAuditTrail(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.movementTrackingService.getMovementAuditTrail(
      tenantId,
      productId,
      locationId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  @Get('anomaly-detection')
  @RequirePermission('inventory:read-analytics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detect anomalous inventory movements' })
  @ApiResponse({ status: 200, description: 'Anomaly detection completed successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'lookbackDays', required: false, description: 'Lookback period in days (default: 7)' })
  async detectAnomalousMovements(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
    @Query('lookbackDays') lookbackDays?: number,
  ) {
    return this.movementTrackingService.detectAnomalousMovements(
      tenantId,
      locationId,
      lookbackDays ? parseInt(lookbackDays.toString()) : 7,
    );
  }
}