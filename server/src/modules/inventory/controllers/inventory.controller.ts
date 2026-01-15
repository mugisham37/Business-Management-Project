import {
  Controller,
  Get,
  Post,
  Put,
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
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InventoryService } from '../services/inventory.service';
import { 
  CreateInventoryLevelDto,
  UpdateInventoryLevelDto,
  InventoryAdjustmentDto,
  InventoryTransferDto,
  InventoryReservationDto,
  InventoryQueryDto,
  InventoryLevelResponseDto,
  InventoryMovementResponseDto
} from '../dto/inventory.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/inventory')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('inventory-management')
@UseInterceptors(LoggingInterceptor)
@ApiTags('Inventory Management')
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('levels')
  @RequirePermission('inventory:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create inventory level for a product at a location' })
  @ApiResponse({ 
    status: 201, 
    description: 'Inventory level created successfully',
    type: InventoryLevelResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Invalid input data or inventory level already exists' })
  async createInventoryLevel(
    @Body() createInventoryDto: CreateInventoryLevelDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<InventoryLevelResponseDto> {
    return this.inventoryService.createInventoryLevel(tenantId, createInventoryDto, user.id);
  }

  @Get('levels')
  @RequirePermission('inventory:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get inventory levels with filtering and pagination' })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventory levels retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        inventoryLevels: { type: 'array', items: { $ref: '#/components/schemas/InventoryLevelResponseDto' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  async getInventoryLevels(
    @Query() query: InventoryQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.inventoryService.getInventoryLevels(tenantId, query);
  }

  @Get('levels/:productId/:locationId')
  @RequirePermission('inventory:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get inventory level for specific product and location' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiQuery({ name: 'variantId', description: 'Product variant ID', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventory level found',
    type: InventoryLevelResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Inventory level not found' })
  async getInventoryLevel(
    @CurrentTenant() tenantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query('variantId') variantId?: string,
  ): Promise<InventoryLevelResponseDto> {
    return this.inventoryService.getInventoryLevel(tenantId, productId, variantId || null, locationId);
  }

  @Post('adjustments')
  @RequirePermission('inventory:adjust')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Adjust inventory level' })
  @ApiResponse({ 
    status: 201, 
    description: 'Inventory adjusted successfully',
    type: InventoryLevelResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Invalid adjustment or would result in negative inventory' })
  async adjustInventory(
    @Body() adjustmentDto: InventoryAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<InventoryLevelResponseDto> {
    return this.inventoryService.adjustInventory(tenantId, adjustmentDto, user.id);
  }

  @Post('transfers')
  @RequirePermission('inventory:transfer')
  @RequireFeature('advanced-inventory')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Transfer inventory between locations' })
  @ApiResponse({ 
    status: 201, 
    description: 'Inventory transferred successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid transfer or insufficient inventory' })
  async transferInventory(
    @Body() transferDto: InventoryTransferDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.inventoryService.transferInventory(tenantId, transferDto, user.id);
    return { success: true, message: 'Inventory transferred successfully' };
  }

  @Post('reservations')
  @RequirePermission('inventory:reserve')
  @RequireFeature('advanced-inventory')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reserve inventory for orders or quotes' })
  @ApiResponse({ 
    status: 201, 
    description: 'Inventory reserved successfully'
  })
  @ApiResponse({ status: 400, description: 'Insufficient available inventory' })
  async reserveInventory(
    @Body() reservationDto: InventoryReservationDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.inventoryService.reserveInventory(
      tenantId,
      reservationDto.productId,
      reservationDto.variantId || null,
      reservationDto.locationId,
      reservationDto.quantity,
      reservationDto.reservedFor,
      reservationDto.referenceId,
      user.id,
    );
  }

  @Put('reservations/:reservationId/release')
  @RequirePermission('inventory:reserve')
  @RequireFeature('advanced-inventory')
  @ApiOperation({ summary: 'Release inventory reservation' })
  @ApiParam({ name: 'reservationId', description: 'Reservation ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Reservation released successfully'
  })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  async releaseReservation(
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.inventoryService.releaseReservation(tenantId, reservationId, user.id);
    return { success: true, message: 'Reservation released successfully' };
  }

  @Get('low-stock')
  @RequirePermission('inventory:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get products with low stock levels' })
  @ApiQuery({ name: 'locationId', description: 'Filter by location', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Low stock products retrieved successfully',
    type: [InventoryLevelResponseDto] 
  })
  async getLowStockProducts(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ): Promise<InventoryLevelResponseDto[]> {
    return this.inventoryService.getLowStockProducts(tenantId, locationId);
  }

  @Get('movements/:productId')
  @RequirePermission('inventory:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get inventory movements for a product' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'locationId', description: 'Filter by location', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventory movements retrieved successfully',
    type: [InventoryMovementResponseDto] 
  })
  async getInventoryMovements(
    @CurrentTenant() tenantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('locationId') locationId?: string,
  ): Promise<InventoryMovementResponseDto[]> {
    return this.inventoryService.getInventoryMovements(tenantId, productId, locationId);
  }

  @Post('alerts/low-stock')
  @RequirePermission('inventory:manage')
  @RequireFeature('advanced-inventory')
  @ApiOperation({ summary: 'Process low stock alerts for all products' })
  @ApiResponse({ 
    status: 200, 
    description: 'Low stock alerts processed successfully'
  })
  async processLowStockAlerts(
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.inventoryService.processLowStockAlerts(tenantId);
    return { success: true, message: 'Low stock alerts processed successfully' };
  }
}