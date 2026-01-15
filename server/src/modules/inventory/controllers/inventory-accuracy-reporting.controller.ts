import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { 
  InventoryAccuracyReportingService,
  AccuracyReportQueryDto,
} from '../services/inventory-accuracy-reporting.service';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

@Controller('api/v1/inventory/accuracy-reports')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('inventory-reporting')
@ApiTags('Inventory Accuracy Reporting')
export class InventoryAccuracyReportingController {
  constructor(
    private readonly accuracyReportingService: InventoryAccuracyReportingService,
  ) {}

  @Get('summary')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate inventory accuracy summary report' })
  @ApiResponse({ status: 200, description: 'Accuracy summary report generated successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getAccuracySummaryReport(
    @Query() query: Omit<AccuracyReportQueryDto, 'reportType'>,
    @CurrentTenant() tenantId: string,
  ) {
    return this.accuracyReportingService.generateAccuracyReport(tenantId, {
      ...query,
      reportType: 'summary',
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    } as AccuracyReportQueryDto);
  }

  @Get('detailed')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate detailed inventory accuracy report' })
  @ApiResponse({ status: 200, description: 'Detailed accuracy report generated successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['location', 'product', 'category', 'user', 'time'] })
  @ApiQuery({ name: 'includeZeroVariances', required: false, type: 'boolean' })
  async getDetailedAccuracyReport(
    @Query() query: Omit<AccuracyReportQueryDto, 'reportType'>,
    @CurrentTenant() tenantId: string,
  ) {
    return this.accuracyReportingService.generateAccuracyReport(tenantId, {
      ...query,
      reportType: 'detailed',
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      includeZeroVariances: query.includeZeroVariances === true,
    } as AccuracyReportQueryDto);
  }

  @Get('trends')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate inventory accuracy trends report' })
  @ApiResponse({ status: 200, description: 'Accuracy trends report generated successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getAccuracyTrendsReport(
    @Query() query: Omit<AccuracyReportQueryDto, 'reportType'>,
    @CurrentTenant() tenantId: string,
  ) {
    return this.accuracyReportingService.generateAccuracyReport(tenantId, {
      ...query,
      reportType: 'trends',
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    } as AccuracyReportQueryDto);
  }

  @Get('comparative')
  @RequirePermission('inventory:read-reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate comparative inventory accuracy report' })
  @ApiResponse({ status: 200, description: 'Comparative accuracy report generated successfully' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getComparativeAccuracyReport(
    @Query() query: Omit<AccuracyReportQueryDto, 'reportType'>,
    @CurrentTenant() tenantId: string,
  ) {
    return this.accuracyReportingService.generateAccuracyReport(tenantId, {
      ...query,
      reportType: 'comparative',
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    } as AccuracyReportQueryDto);
  }
}