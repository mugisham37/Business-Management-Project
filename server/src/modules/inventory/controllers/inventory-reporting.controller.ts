import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { InventoryReportingService, ReportQueryDto } from '../services/inventory-reporting.service';
import { InventoryValuationService } from '../services/inventory-valuation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

@Controller('api/v1/inventory/reports')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('inventory-reporting')
@ApiTags('Inventory Reporting')
export class InventoryReportingController {
  constructor(
    private readonly reportingService: InventoryReportingService,
    private readonly valuationService: InventoryValuationService,
  ) {}

  @Get('stock-level')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate stock level report' })
  @ApiResponse({ status: 200, description: 'Stock level report generated successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  async getStockLevelReport(
    @Query() query: ReportQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.reportingService.generateStockLevelReport(tenantId, query);
  }

  @Get('movement')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate inventory movement report' })
  @ApiResponse({ status: 200, description: 'Movement report generated successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getMovementReport(
    @Query() query: ReportQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.reportingService.generateMovementReport(tenantId, query);
  }

  @Get('aging')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate inventory aging report' })
  @ApiResponse({ status: 200, description: 'Aging report generated successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  async getAgingReport(
    @Query() query: ReportQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.reportingService.generateAgingReport(tenantId, query);
  }

  @Get('turnover')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate inventory turnover report' })
  @ApiResponse({ status: 200, description: 'Turnover report generated successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getTurnoverReport(
    @Query() query: ReportQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.reportingService.generateTurnoverReport(tenantId, query);
  }

  @Get('valuation')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate inventory valuation report' })
  @ApiResponse({ status: 200, description: 'Valuation report generated successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'asOfDate', required: false })
  async getValuationReport(
    @Query() query: ReportQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.reportingService.generateValuationReport(tenantId, query);
  }

  @Get('valuation/summary')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get inventory valuation summary' })
  @ApiResponse({ status: 200, description: 'Valuation summary retrieved successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'asOfDate', required: false })
  async getValuationSummary(
    @Query() query: ReportQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.valuationService.getValuationSummary(tenantId, {
      ...(query.locationId && { locationId: query.locationId }),
      ...(query.productId && { productId: query.productId }),
      ...(query.dateTo && { asOfDate: query.dateTo }),
    });
  }

  @Get('valuation/product/:productId')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get product valuation details' })
  @ApiResponse({ status: 200, description: 'Product valuation retrieved successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'variantId', required: false })
  @ApiQuery({ name: 'valuationMethod', required: false })
  @ApiQuery({ name: 'asOfDate', required: false })
  async getProductValuation(
    @Query('productId') productId: string,
    @Query() query: { 
      locationId?: string; 
      variantId?: string; 
      valuationMethod?: 'fifo' | 'lifo' | 'average' | 'specific';
      asOfDate?: string;
    },
    @CurrentTenant() tenantId: string,
  ) {
    if (!query.locationId) {
      // Get valuation for all locations
      return this.valuationService.calculateInventoryValuation(tenantId, {
        productId,
        ...(query.valuationMethod && { valuationMethod: query.valuationMethod }),
        ...(query.asOfDate && { asOfDate: new Date(query.asOfDate) }),
      });
    }

    return this.valuationService.calculateProductValuation(
      tenantId,
      productId,
      query.variantId || null,
      query.locationId,
      query.valuationMethod || 'fifo',
      query.asOfDate ? new Date(query.asOfDate) : undefined,
    );
  }
}