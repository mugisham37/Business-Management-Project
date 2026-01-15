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
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { LoggingInterceptor } from '../../../common/interceptors';
import { CacheInterceptor } from '../../../common/interceptors';
import { ShippingIntegrationService, CreateShipmentDto } from '../services/shipping-integration.service';

@Controller('api/v1/warehouse/shipping')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('warehouse-management')
@UseInterceptors(LoggingInterceptor)
@ApiTags('Warehouse Shipping')
export class ShippingIntegrationController {
  constructor(
    private readonly shippingService: ShippingIntegrationService,
  ) {}

  @Post('rates')
  @RequirePermission('warehouse:shipping:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get shipping rates for a shipment' })
  @ApiResponse({ status: 200, description: 'Shipping rates retrieved successfully' })
  async getShippingRates(
    @Body() shipmentData: CreateShipmentDto,
    @CurrentTenant() tenantId: string,
  ) {
    const rates = await this.shippingService.getShippingRates(tenantId, shipmentData);
    
    return {
      success: true,
      data: {
        rates,
        requestedAt: new Date(),
        validUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    };
  }

  @Post('shipments')
  @RequirePermission('warehouse:shipping:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new shipment' })
  @ApiResponse({ status: 201, description: 'Shipment created successfully' })
  async createShipment(
    @Body() shipmentData: CreateShipmentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const shipment = await this.shippingService.createShipment(tenantId, {
      ...shipmentData,
      tenantId,
      userId: user.id,
    });
    
    return {
      success: true,
      data: shipment,
      message: 'Shipment created successfully',
    };
  }

  @Get('shipments/track/:trackingNumber')
  @RequirePermission('warehouse:shipping:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Track a shipment by tracking number' })
  @ApiParam({ name: 'trackingNumber', description: 'Tracking number' })
  @ApiResponse({ status: 200, description: 'Tracking information retrieved successfully' })
  async trackShipment(
    @Param('trackingNumber') trackingNumber: string,
    @CurrentTenant() tenantId: string,
  ) {
    const trackingData = await this.shippingService.trackShipment(tenantId, trackingNumber);
    
    return {
      success: true,
      data: trackingData,
    };
  }

  @Delete('shipments/:shipmentId')
  @RequirePermission('warehouse:shipping:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a shipment' })
  @ApiParam({ name: 'shipmentId', description: 'Shipment ID' })
  @ApiResponse({ status: 200, description: 'Shipment cancelled successfully' })
  async cancelShipment(
    @Param('shipmentId', ParseUUIDPipe) shipmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const cancelled = await this.shippingService.cancelShipment(tenantId, shipmentId, user.id);
    
    return {
      success: true,
      data: { cancelled },
      message: cancelled ? 'Shipment cancelled successfully' : 'Failed to cancel shipment',
    };
  }

  @Get('warehouses/:warehouseId/shipments')
  @RequirePermission('warehouse:shipping:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get shipments for a warehouse' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'carrierId', required: false, description: 'Filter by carrier' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Filter to date' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Shipments retrieved successfully' })
  async getWarehouseShipments(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('carrierId') carrierId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const options: {
      status?: string;
      carrierId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      page: number;
      limit: number;
    } = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    if (status) options.status = status;
    if (carrierId) options.carrierId = carrierId;
    if (dateFrom) options.dateFrom = new Date(dateFrom);
    if (dateTo) options.dateTo = new Date(dateTo);

    const result = await this.shippingService.getShipmentsByWarehouse(tenantId, warehouseId, options);
    
    return {
      success: true,
      data: result,
    };
  }

  @Get('warehouses/:warehouseId/metrics')
  @RequirePermission('warehouse:shipping:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get shipping metrics for a warehouse' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID' })
  @ApiQuery({ name: 'dateFrom', required: true, description: 'Start date for metrics' })
  @ApiQuery({ name: 'dateTo', required: true, description: 'End date for metrics' })
  @ApiResponse({ status: 200, description: 'Shipping metrics retrieved successfully' })
  async getShippingMetrics(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @CurrentTenant() tenantId: string,
  ) {
    const dateRange = {
      from: new Date(dateFrom),
      to: new Date(dateTo),
    };

    const metrics = await this.shippingService.getShippingMetrics(tenantId, warehouseId, dateRange);
    
    return {
      success: true,
      data: metrics,
    };
  }

  @Get('carriers')
  @RequirePermission('warehouse:shipping:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get available shipping carriers' })
  @ApiResponse({ status: 200, description: 'Available carriers retrieved successfully' })
  async getAvailableCarriers() {
    // This would typically come from configuration or database
    const carriers = [
      {
        carrierId: 'ups',
        carrierName: 'United Parcel Service',
        services: [
          { serviceType: 'ground', serviceName: 'UPS Ground' },
          { serviceType: 'next_day', serviceName: 'UPS Next Day Air' },
          { serviceType: '2nd_day', serviceName: 'UPS 2nd Day Air' },
        ],
        features: ['tracking', 'insurance', 'signature_confirmation'],
        supportedCountries: ['US', 'CA', 'MX'],
      },
      {
        carrierId: 'fedex',
        carrierName: 'Federal Express',
        services: [
          { serviceType: 'ground', serviceName: 'FedEx Ground' },
          { serviceType: 'overnight', serviceName: 'FedEx Standard Overnight' },
          { serviceType: 'priority', serviceName: 'FedEx Priority Overnight' },
        ],
        features: ['tracking', 'insurance', 'signature_confirmation', 'saturday_delivery'],
        supportedCountries: ['US', 'CA', 'MX', 'EU'],
      },
      {
        carrierId: 'usps',
        carrierName: 'United States Postal Service',
        services: [
          { serviceType: 'ground', serviceName: 'USPS Ground Advantage' },
          { serviceType: 'priority', serviceName: 'USPS Priority Mail' },
          { serviceType: 'express', serviceName: 'USPS Priority Mail Express' },
        ],
        features: ['tracking', 'insurance'],
        supportedCountries: ['US'],
      },
    ];
    
    return {
      success: true,
      data: { carriers },
    };
  }

  @Post('addresses/validate')
  @RequirePermission('warehouse:shipping:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a shipping address' })
  @ApiResponse({ status: 200, description: 'Address validated successfully' })
  async validateAddress(
    @Body() address: {
      name: string;
      company?: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone?: string;
      email?: string;
    },
    @Query('carrierId') carrierId: string = 'ups',
  ) {
    // This would use the carrier's address validation service
    // For now, returning the address as-is with validation status
    const validatedAddress = {
      ...address,
      isValid: true,
      validationScore: 95,
      suggestions: [],
      standardizedAddress: address, // Would be the carrier's standardized version
    };
    
    return {
      success: true,
      data: validatedAddress,
    };
  }

  @Get('labels/:labelId')
  @RequirePermission('warehouse:shipping:read')
  @ApiOperation({ summary: 'Download shipping label' })
  @ApiParam({ name: 'labelId', description: 'Label ID' })
  @ApiResponse({ status: 200, description: 'Label downloaded successfully' })
  async downloadLabel(
    @Param('labelId') labelId: string,
    @CurrentTenant() tenantId: string,
  ) {
    // This would retrieve the label from storage and return it
    // For now, returning mock label data
    return {
      success: true,
      data: {
        labelId,
        format: 'PDF',
        data: 'base64-encoded-label-data',
        downloadUrl: `https://api.example.com/labels/${labelId}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    };
  }

  @Post('bulk-shipments')
  @RequirePermission('warehouse:shipping:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create multiple shipments in bulk' })
  @ApiResponse({ status: 201, description: 'Bulk shipments created successfully' })
  async createBulkShipments(
    @Body() bulkData: {
      shipments: CreateShipmentDto[];
      defaultCarrierId?: string;
      defaultServiceType?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const results = [];
    const errors = [];

    for (const [index, shipmentData] of bulkData.shipments.entries()) {
      try {
        const shipment = await this.shippingService.createShipment(tenantId, {
          ...shipmentData,
          tenantId,
          userId: user.id,
          carrierId: shipmentData.carrierId || bulkData.defaultCarrierId || 'ups',
          serviceType: shipmentData.serviceType || bulkData.defaultServiceType || 'ground',
        });
        
        results.push({
          index,
          success: true,
          shipment,
        });
      } catch (error: unknown) {
        errors.push({
          index,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          shipmentData,
        });
      }
    }
    
    return {
      success: true,
      data: {
        results,
        errors,
        summary: {
          total: bulkData.shipments.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    };
  }
}