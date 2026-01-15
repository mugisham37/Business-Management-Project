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
import { BatchTrackingService, CreateBatchDto, BatchQueryDto } from '../services/batch-tracking.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/inventory/batches')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('batch-tracking')
@ApiTags('Batch Tracking')
export class BatchTrackingController {
  constructor(private readonly batchTrackingService: BatchTrackingService) {}

  @Post()
  @RequirePermission('inventory:create-batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new inventory batch' })
  @ApiResponse({ status: 201, description: 'Batch created successfully' })
  async createBatch(
    @Body() createBatchDto: CreateBatchDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.batchTrackingService.createBatch(tenantId, createBatchDto, user.id);
  }

  @Get()
  @RequirePermission('inventory:read-batch')
  @ApiOperation({ summary: 'Get inventory batches' })
  @ApiResponse({ status: 200, description: 'Batches retrieved successfully' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getBatches(
    @Query() query: BatchQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.batchTrackingService.findBatches(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('inventory:read-batch')
  @ApiOperation({ summary: 'Get batch by ID' })
  @ApiResponse({ status: 200, description: 'Batch retrieved successfully' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  async getBatch(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.batchTrackingService.findById(tenantId, id);
  }

  @Get('number/:batchNumber/location/:locationId')
  @RequirePermission('inventory:read-batch')
  @ApiOperation({ summary: 'Get batch by batch number and location' })
  @ApiResponse({ status: 200, description: 'Batch retrieved successfully' })
  @ApiParam({ name: 'batchNumber', description: 'Batch number' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  async getBatchByNumber(
    @Param('batchNumber') batchNumber: string,
    @Param('locationId') locationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.batchTrackingService.findByBatchNumber(tenantId, batchNumber, locationId);
  }

  @Post(':id/consume')
  @RequirePermission('inventory:consume-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consume quantity from batch' })
  @ApiResponse({ status: 200, description: 'Batch consumption recorded successfully' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  async consumeBatch(
    @Param('id') id: string,
    @Body() consumeDto: { quantity: number; reason: string },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.batchTrackingService.consumeBatch(
      tenantId,
      id,
      consumeDto.quantity,
      consumeDto.reason,
      user.id,
    );
  }

  @Get('expiring/:days')
  @RequirePermission('inventory:read-batch')
  @ApiOperation({ summary: 'Get batches expiring within specified days' })
  @ApiResponse({ status: 200, description: 'Expiring batches retrieved successfully' })
  @ApiParam({ name: 'days', description: 'Number of days ahead to check' })
  @ApiQuery({ name: 'locationId', required: false })
  async getExpiringBatches(
    @CurrentTenant() tenantId: string,
    @Param('days') days: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.batchTrackingService.getExpiringBatches(tenantId, parseInt(days), locationId);
  }

  @Post('recall/:batchNumber')
  @RequirePermission('inventory:recall-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recall all batches with specified batch number' })
  @ApiResponse({ status: 200, description: 'Batch recall initiated successfully' })
  @ApiParam({ name: 'batchNumber', description: 'Batch number to recall' })
  async recallBatch(
    @Param('batchNumber') batchNumber: string,
    @Body() recallDto: { reason: string },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.batchTrackingService.recallBatch(
      tenantId,
      batchNumber,
      recallDto.reason,
      user.id,
    );
  }

  @Get('fifo/:productId/location/:locationId')
  @RequirePermission('inventory:read-batch')
  @ApiOperation({ summary: 'Get FIFO ordered batches for product and location' })
  @ApiResponse({ status: 200, description: 'FIFO batches retrieved successfully' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiQuery({ name: 'variantId', required: false })
  async getFIFOBatches(
    @CurrentTenant() tenantId: string,
    @Param('productId') productId: string,
    @Param('locationId') locationId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.batchTrackingService.getFIFOBatches(tenantId, productId, variantId || null, locationId);
  }

  @Get('lifo/:productId/location/:locationId')
  @RequirePermission('inventory:read-batch')
  @ApiOperation({ summary: 'Get LIFO ordered batches for product and location' })
  @ApiResponse({ status: 200, description: 'LIFO batches retrieved successfully' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiQuery({ name: 'variantId', required: false })
  async getLIFOBatches(
    @CurrentTenant() tenantId: string,
    @Param('productId') productId: string,
    @Param('locationId') locationId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.batchTrackingService.getLIFOBatches(tenantId, productId, variantId || null, locationId);
  }

  @Get('fefo/:productId/location/:locationId')
  @RequirePermission('inventory:read-batch')
  @ApiOperation({ summary: 'Get FEFO ordered batches for product and location' })
  @ApiResponse({ status: 200, description: 'FEFO batches retrieved successfully' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiQuery({ name: 'variantId', required: false })
  async getFEFOBatches(
    @CurrentTenant() tenantId: string,
    @Param('productId') productId: string,
    @Param('locationId') locationId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.batchTrackingService.getFEFOBatches(tenantId, productId, variantId || null, locationId);
  }

  @Put(':id/quality')
  @RequirePermission('inventory:update-batch-quality')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update batch quality status' })
  @ApiResponse({ status: 200, description: 'Batch quality status updated successfully' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  async updateQualityStatus(
    @Param('id') id: string,
    @Body() qualityDto: { 
      qualityStatus: 'approved' | 'rejected' | 'quarantine' | 'testing';
      qualityNotes: string;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.batchTrackingService.updateQualityStatus(
      tenantId,
      id,
      qualityDto.qualityStatus,
      qualityDto.qualityNotes,
      user.id,
    );
  }

  @Get(':id/history')
  @RequirePermission('inventory:read-batch')
  @ApiOperation({ summary: 'Get batch movement history' })
  @ApiResponse({ status: 200, description: 'Batch history retrieved successfully' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  async getBatchHistory(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.batchTrackingService.getBatchHistory(tenantId, id);
  }
}