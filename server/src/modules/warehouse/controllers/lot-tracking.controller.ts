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
import { LotTrackingService, CreateLotDto, UpdateLotDto, CreateRecallDto } from '../services/lot-tracking.service';

@Controller('api/v1/warehouse/lot-tracking')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('warehouse-management')
@UseInterceptors(LoggingInterceptor)
@ApiTags('Warehouse Lot Tracking')
export class LotTrackingController {
  constructor(
    private readonly lotTrackingService: LotTrackingService,
  ) {}

  @Post('lots')
  @RequirePermission('warehouse:lot-tracking:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new lot' })
  @ApiResponse({ status: 201, description: 'Lot created successfully' })
  async createLot(
    @Body() createLotDto: CreateLotDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const lot = await this.lotTrackingService.createLot(tenantId, {
      ...createLotDto,
      tenantId,
      userId: user.id,
    });
    
    return {
      success: true,
      data: lot,
      message: 'Lot created successfully',
    };
  }

  @Put('lots/:productId/:lotNumber')
  @RequirePermission('warehouse:lot-tracking:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a lot' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiParam({ name: 'lotNumber', description: 'Lot number' })
  @ApiResponse({ status: 200, description: 'Lot updated successfully' })
  async updateLot(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('lotNumber') lotNumber: string,
    @Body() updateLotDto: UpdateLotDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const lot = await this.lotTrackingService.updateLot(tenantId, lotNumber, productId, {
      ...updateLotDto,
      userId: user.id,
    });
    
    return {
      success: true,
      data: lot,
      message: 'Lot updated successfully',
    };
  }

  @Get('lots/:productId/:lotNumber')
  @RequirePermission('warehouse:lot-tracking:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get lot details' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiParam({ name: 'lotNumber', description: 'Lot number' })
  @ApiResponse({ status: 200, description: 'Lot details retrieved successfully' })
  async getLot(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('lotNumber') lotNumber: string,
    @CurrentTenant() tenantId: string,
  ) {
    const lot = await this.lotTrackingService.getLotByNumber(tenantId, productId, lotNumber);
    
    return {
      success: true,
      data: lot,
    };
  }

  @Get('products/:productId/lots')
  @RequirePermission('warehouse:lot-tracking:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get lots for a product' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'warehouseId', required: false, description: 'Filter by warehouse' })
  @ApiQuery({ name: 'qualityStatus', required: false, description: 'Filter by quality status' })
  @ApiQuery({ name: 'includeExpired', required: false, description: 'Include expired lots' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  @ApiResponse({ status: 200, description: 'Product lots retrieved successfully' })
  async getProductLots(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('qualityStatus') qualityStatus?: string,
    @Query('includeExpired') includeExpired?: string,
    @Query('sortBy') sortBy?: 'expiryDate' | 'receivedDate' | 'quantity',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const options: {
      warehouseId?: string;
      qualityStatus?: string;
      includeExpired?: boolean;
      sortBy?: 'expiryDate' | 'receivedDate' | 'quantity';
      sortOrder?: 'asc' | 'desc';
    } = {
      includeExpired: includeExpired === 'true',
    };

    if (warehouseId) options.warehouseId = warehouseId;
    if (qualityStatus) options.qualityStatus = qualityStatus;
    if (sortBy) options.sortBy = sortBy;
    if (sortOrder) options.sortOrder = sortOrder;

    const lots = await this.lotTrackingService.getLotsForProduct(tenantId, productId, options);
    
    return {
      success: true,
      data: { lots },
    };
  }

  @Get('products/:productId/optimal-picking')
  @RequirePermission('warehouse:lot-tracking:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get optimal lots for picking' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'warehouseId', required: true, description: 'Warehouse ID' })
  @ApiQuery({ name: 'quantity', required: true, description: 'Requested quantity' })
  @ApiResponse({ status: 200, description: 'Optimal picking lots retrieved successfully' })
  async getOptimalPickingLots(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Query('quantity') quantity: string,
    @CurrentTenant() tenantId: string,
  ) {
    const requestedQuantity = parseFloat(quantity);
    
    const result = await this.lotTrackingService.getOptimalPickingLots(
      tenantId,
      productId,
      warehouseId,
      requestedQuantity,
    );
    
    return {
      success: true,
      data: result,
    };
  }

  @Post('products/:productId/pick')
  @RequirePermission('warehouse:lot-tracking:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pick from lots using FIFO/FEFO' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Lots picked successfully' })
  async pickFromLots(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() pickData: {
      warehouseId: string;
      quantity: number;
      orderId?: string;
      pickListId?: string;
      notes?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const result = await this.lotTrackingService.pickFromLots(
      tenantId,
      productId,
      pickData.warehouseId,
      pickData.quantity,
      {
        ...(pickData.orderId && { orderId: pickData.orderId }),
        ...(pickData.pickListId && { pickListId: pickData.pickListId }),
        userId: user.id,
        ...(pickData.notes && { notes: pickData.notes }),
      },
    );
    
    return {
      success: true,
      data: result,
      message: 'Lots picked successfully',
    };
  }

  @Get('lots/:productId/:lotNumber/traceability')
  @RequirePermission('warehouse:lot-tracking:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get complete lot traceability' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiParam({ name: 'lotNumber', description: 'Lot number' })
  @ApiResponse({ status: 200, description: 'Lot traceability retrieved successfully' })
  async getLotTraceability(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('lotNumber') lotNumber: string,
    @CurrentTenant() tenantId: string,
  ) {
    const traceability = await this.lotTrackingService.getLotTraceability(tenantId, lotNumber, productId);
    
    return {
      success: true,
      data: traceability,
    };
  }

  @Get('lots/:productId/:lotNumber/movements')
  @RequirePermission('warehouse:lot-tracking:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get lot movement history' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiParam({ name: 'lotNumber', description: 'Lot number' })
  @ApiResponse({ status: 200, description: 'Lot movement history retrieved successfully' })
  async getLotMovements(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('lotNumber') lotNumber: string,
    @CurrentTenant() tenantId: string,
  ) {
    const movements = await this.lotTrackingService.getLotMovementHistory(tenantId, lotNumber, productId);
    
    return {
      success: true,
      data: { movements },
    };
  }

  @Get('warehouses/:warehouseId/expiring-lots')
  @RequirePermission('warehouse:lot-tracking:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get lots expiring soon' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID' })
  @ApiQuery({ name: 'daysAhead', required: false, description: 'Days ahead to check (default: 30)' })
  @ApiResponse({ status: 200, description: 'Expiring lots retrieved successfully' })
  async getExpiringLots(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentTenant() tenantId: string,
    @Query('daysAhead') daysAhead?: string,
  ) {
    const days = daysAhead ? parseInt(daysAhead, 10) : 30;
    
    const expiringLots = await this.lotTrackingService.getExpiringLots(tenantId, warehouseId, days);
    
    return {
      success: true,
      data: { expiringLots },
    };
  }

  @Post('recalls')
  @RequirePermission('warehouse:lot-tracking:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a product recall' })
  @ApiResponse({ status: 201, description: 'Recall created successfully' })
  async createRecall(
    @Body() createRecallDto: CreateRecallDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const recall = await this.lotTrackingService.createRecall(tenantId, {
      ...createRecallDto,
      tenantId,
      userId: user.id,
    });
    
    return {
      success: true,
      data: recall,
      message: 'Recall created successfully',
    };
  }

  @Get('recalls/:recallId')
  @RequirePermission('warehouse:lot-tracking:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get recall details' })
  @ApiParam({ name: 'recallId', description: 'Recall ID' })
  @ApiResponse({ status: 200, description: 'Recall details retrieved successfully' })
  async getRecall(
    @Param('recallId') recallId: string,
    @CurrentTenant() tenantId: string,
  ) {
    // This would retrieve recall from database
    // For now, returning placeholder response
    return {
      success: true,
      data: {
        recallId,
        message: 'Recall details would be retrieved from database',
      },
    };
  }

  @Get('products/:productId/recalls')
  @RequirePermission('warehouse:lot-tracking:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get recalls for a product' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Product recalls retrieved successfully' })
  async getProductRecalls(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
  ) {
    // This would retrieve recalls from database
    // For now, returning placeholder response
    return {
      success: true,
      data: {
        recalls: [],
        message: 'Product recalls would be retrieved from database',
      },
    };
  }

  @Post('fifo-rules')
  @RequirePermission('warehouse:lot-tracking:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update FIFO rule' })
  @ApiResponse({ status: 201, description: 'FIFO rule created successfully' })
  async createFIFORule(
    @Body() fifoRuleData: {
      productId: string;
      warehouseId?: string;
      zoneId?: string;
      rotationType: 'FIFO' | 'FEFO' | 'LIFO' | 'MANUAL';
      enforceStrict: boolean;
      allowMixedLots: boolean;
      expiryWarningDays: number;
      autoQuarantineExpired: boolean;
      requireLotTracking: boolean;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    // This would create/update FIFO rule in database
    // For now, returning success response
    return {
      success: true,
      data: {
        ...fifoRuleData,
        tenantId,
        createdBy: user.id,
        createdAt: new Date(),
      },
      message: 'FIFO rule created successfully',
    };
  }

  @Get('products/:productId/fifo-rules')
  @RequirePermission('warehouse:lot-tracking:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get FIFO rules for a product' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'warehouseId', required: false, description: 'Filter by warehouse' })
  @ApiResponse({ status: 200, description: 'FIFO rules retrieved successfully' })
  async getFIFORules(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    // This would retrieve FIFO rules from database
    // For now, returning default rule
    const defaultRule = {
      productId,
      warehouseId,
      rotationType: 'FIFO',
      enforceStrict: true,
      allowMixedLots: false,
      expiryWarningDays: 30,
      autoQuarantineExpired: true,
      requireLotTracking: true,
    };

    return {
      success: true,
      data: { rules: [defaultRule] },
    };
  }

  @Post('lots/bulk-update')
  @RequirePermission('warehouse:lot-tracking:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk update lots' })
  @ApiResponse({ status: 200, description: 'Lots updated successfully' })
  async bulkUpdateLots(
    @Body() bulkUpdateData: {
      updates: Array<{
        productId: string;
        lotNumber: string;
        quantity?: number;
        binLocationId?: string;
        qualityStatus?: 'approved' | 'pending' | 'rejected' | 'quarantine';
        notes?: string;
      }>;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const results = [];
    const errors = [];

    for (const [index, update] of bulkUpdateData.updates.entries()) {
      try {
        const lot = await this.lotTrackingService.updateLot(
          tenantId,
          update.lotNumber,
          update.productId,
          {
            ...(update.quantity !== undefined && { quantity: update.quantity }),
            ...(update.binLocationId && { binLocationId: update.binLocationId }),
            ...(update.qualityStatus && { qualityStatus: update.qualityStatus }),
            ...(update.notes && { notes: update.notes }),
            userId: user.id,
          },
        );
        
        results.push({
          index,
          success: true,
          lot,
        });
      } catch (error: unknown) {
        errors.push({
          index,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          update,
        });
      }
    }
    
    return {
      success: true,
      data: {
        results,
        errors,
        summary: {
          total: bulkUpdateData.updates.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    };
  }

  @Post('lots/quality-test')
  @RequirePermission('warehouse:lot-tracking:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record quality test results for a lot' })
  @ApiResponse({ status: 200, description: 'Quality test results recorded successfully' })
  async recordQualityTest(
    @Body() testData: {
      productId: string;
      lotNumber: string;
      testResults: Record<string, any>;
      qualityStatus: 'approved' | 'pending' | 'rejected' | 'quarantine';
      testDate: Date;
      testerId: string;
      certificationNumber?: string;
      notes?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const lot = await this.lotTrackingService.updateLot(
      tenantId,
      testData.lotNumber,
      testData.productId,
      {
        qualityStatus: testData.qualityStatus,
        testResults: testData.testResults,
        ...(testData.notes && { notes: testData.notes }),
        userId: user.id,
      },
    );
    
    return {
      success: true,
      data: lot,
      message: 'Quality test results recorded successfully',
    };
  }
}