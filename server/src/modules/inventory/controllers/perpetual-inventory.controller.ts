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
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { 
  PerpetualInventoryService,
  PerpetualInventoryUpdateDto,
  PerpetualInventoryReconciliationDto,
} from '../services/perpetual-inventory.service';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';

@Controller('api/v1/inventory/perpetual')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('inventory-management')
@ApiTags('Perpetual Inventory Management')
export class PerpetualInventoryController {
  constructor(
    private readonly perpetualInventoryService: PerpetualInventoryService,
  ) {}

  @Post('update')
  @RequirePermission('inventory:update-levels')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update perpetual inventory with real-time movement tracking' })
  @ApiResponse({ status: 200, description: 'Perpetual inventory updated successfully' })
  @ApiBody({ description: 'Perpetual inventory update data' })
  async updatePerpetualInventory(
    @Body() updateDto: PerpetualInventoryUpdateDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.perpetualInventoryService.updatePerpetualInventory(
      tenantId,
      updateDto,
      user.id,
    );
  }

  @Post('reconciliation')
  @RequirePermission('inventory:perform-reconciliation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform inventory reconciliation with variance analysis' })
  @ApiResponse({ status: 200, description: 'Inventory reconciliation completed successfully' })
  @ApiBody({ description: 'Inventory reconciliation data' })
  async performInventoryReconciliation(
    @Body() reconciliationDto: PerpetualInventoryReconciliationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.perpetualInventoryService.performInventoryReconciliation(
      tenantId,
      reconciliationDto,
      user.id,
    );
  }

  @Get('status/:locationId')
  @RequirePermission('inventory:read-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get perpetual inventory status for a location' })
  @ApiResponse({ status: 200, description: 'Perpetual inventory status retrieved successfully' })
  @ApiParam({ name: 'locationId', type: 'string' })
  async getPerpetualInventoryStatus(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.perpetualInventoryService.getPerpetualInventoryStatus(tenantId, locationId);
  }

  @Get('variance-analysis/:locationId')
  @RequirePermission('inventory:read-analytics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get detailed variance analysis for a location' })
  @ApiResponse({ status: 200, description: 'Variance analysis completed successfully' })
  @ApiParam({ name: 'locationId', type: 'string' })
  @ApiQuery({ name: 'periodDays', required: false, description: 'Analysis period in days (default: 30)' })
  async getInventoryVarianceAnalysis(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
    @Query('periodDays') periodDays?: number,
  ) {
    return this.perpetualInventoryService.getInventoryVarianceAnalysis(
      tenantId,
      locationId,
      periodDays ? parseInt(periodDays.toString()) : 30,
    );
  }
}