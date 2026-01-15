import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReorderService, ReorderSuggestion, ForecastData } from '../services/reorder.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/inventory/reorder')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('advanced-inventory')
@ApiTags('Inventory Reordering')
@ApiBearerAuth()
export class ReorderController {
  constructor(private readonly reorderService: ReorderService) {}

  @Get('suggestions')
  @RequirePermission('inventory:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get reorder suggestions for products' })
  @ApiQuery({ name: 'locationId', description: 'Filter by location', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Reorder suggestions retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          variantId: { type: 'string', nullable: true },
          locationId: { type: 'string' },
          currentLevel: { type: 'number' },
          reorderPoint: { type: 'number' },
          reorderQuantity: { type: 'number' },
          suggestedQuantity: { type: 'number' },
          unitCost: { type: 'number' },
          totalCost: { type: 'number' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          daysUntilStockout: { type: 'number', nullable: true },
          averageDailySales: { type: 'number' },
          leadTimeDays: { type: 'number' },
          product: { type: 'object' },
          variant: { type: 'object', nullable: true },
        },
      },
    },
  })
  async getReorderSuggestions(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ): Promise<ReorderSuggestion[]> {
    return this.reorderService.generateReorderSuggestions(tenantId, locationId);
  }

  @Get('purchase-orders')
  @RequirePermission('inventory:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get purchase order suggestions grouped by supplier' })
  @ApiQuery({ name: 'supplierId', description: 'Filter by supplier', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Purchase order suggestions retrieved successfully',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            variantId: { type: 'string', nullable: true },
            locationId: { type: 'string' },
            currentLevel: { type: 'number' },
            reorderPoint: { type: 'number' },
            reorderQuantity: { type: 'number' },
            suggestedQuantity: { type: 'number' },
            unitCost: { type: 'number' },
            totalCost: { type: 'number' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            daysUntilStockout: { type: 'number', nullable: true },
            averageDailySales: { type: 'number' },
            leadTimeDays: { type: 'number' },
            product: { type: 'object' },
            variant: { type: 'object', nullable: true },
          },
        },
      },
    },
  })
  async getPurchaseOrderSuggestions(
    @CurrentTenant() tenantId: string,
    @Query('supplierId') supplierId?: string,
  ): Promise<{ [supplierId: string]: ReorderSuggestion[] }> {
    return this.reorderService.generatePurchaseOrderSuggestions(tenantId, supplierId);
  }

  @Get('forecast')
  @RequirePermission('inventory:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get demand forecast data for products' })
  @ApiQuery({ name: 'productId', description: 'Product ID', required: true })
  @ApiQuery({ name: 'variantId', description: 'Product variant ID', required: false })
  @ApiQuery({ name: 'locationId', description: 'Location ID', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Forecast data retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          variantId: { type: 'string', nullable: true },
          locationId: { type: 'string' },
          averageDailySales: { type: 'number' },
          trend: { type: 'string', enum: ['increasing', 'decreasing', 'stable'] },
          seasonalFactor: { type: 'number' },
          forecastedDemand: { type: 'number' },
          confidence: { type: 'number' },
        },
      },
    },
  })
  async getForecastData(
    @Query('productId') productId: string,
    @CurrentTenant() tenantId: string,
    @Query('variantId') variantId?: string,
    @Query('locationId') locationId?: string,
  ): Promise<ForecastData[]> {
    return this.reorderService.getForecastData(tenantId, productId, variantId, locationId);
  }

  @Post('process-alerts')
  @RequirePermission('inventory:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process automatic reorder alerts for high priority items' })
  @ApiResponse({ 
    status: 200, 
    description: 'Reorder alerts processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async processAutomaticReorders(
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.reorderService.processAutomaticReorders(tenantId);
    return { success: true, message: 'Reorder alerts processed successfully' };
  }

  @Post('update-reorder-points')
  @RequirePermission('inventory:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update reorder points based on sales history and demand forecasting' })
  @ApiQuery({ name: 'locationId', description: 'Filter by location', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Reorder points updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async updateReorderPoints(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.reorderService.updateReorderPoints(tenantId, locationId);
    return { success: true, message: 'Reorder points updated successfully' };
  }
}