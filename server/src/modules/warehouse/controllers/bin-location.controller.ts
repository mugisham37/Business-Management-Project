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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { LoggingInterceptor } from '../../../common/interceptors';
import { CacheInterceptor } from '../../../common/interceptors';
import { ValidationPipe } from '../../../common/rest/pipes';
import { BinLocationService } from '../services/bin-location.service';
import { 
  CreateBinLocationDto, 
  UpdateBinLocationDto, 
  BinLocationQueryDto,
  BulkCreateBinLocationsDto,
  BinLocationStatus 
} from '../dto/warehouse.dto';
import { BinLocation } from '../entities/warehouse.entity';

@Controller('api/v1/bin-locations')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('warehouse-management')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Bin Locations')
@ApiBearerAuth()
export class BinLocationController {
  constructor(private readonly binLocationService: BinLocationService) {}

  @Post()
  @RequirePermission('warehouses:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new bin location' })
  @ApiResponse({ status: 201, description: 'Bin location created successfully', type: BinLocation })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Bin code already exists in warehouse' })
  async createBinLocation(
    @Body(ValidationPipe) createBinLocationDto: CreateBinLocationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<BinLocation> {
    return this.binLocationService.createBinLocation(tenantId, createBinLocationDto, user.id);
  }

  @Post('bulk')
  @RequirePermission('warehouses:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk create bin locations' })
  @ApiResponse({ status: 201, description: 'Bin locations created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async bulkCreateBinLocations(
    @Body(ValidationPipe) bulkCreateDto: BulkCreateBinLocationsDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<BinLocation[]> {
    return this.binLocationService.bulkCreateBinLocations(tenantId, bulkCreateDto, user.id);
  }

  @Get()
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get all bin locations' })
  @ApiResponse({ status: 200, description: 'Bin locations retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiQuery({ name: 'warehouseId', required: false, type: String, description: 'Filter by warehouse ID' })
  @ApiQuery({ name: 'zoneId', required: false, type: String, description: 'Filter by zone ID' })
  @ApiQuery({ name: 'status', required: false, enum: BinLocationStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'aisle', required: false, type: String, description: 'Filter by aisle' })
  @ApiQuery({ name: 'assignedProductId', required: false, type: String, description: 'Filter by assigned product' })
  async getBinLocations(
    @Query() query: BinLocationQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    binLocations: BinLocation[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.binLocationService.getBinLocations(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get bin location by ID' })
  @ApiParam({ name: 'id', type: 'string', description: 'Bin location ID' })
  @ApiResponse({ status: 200, description: 'Bin location retrieved successfully', type: BinLocation })
  @ApiResponse({ status: 404, description: 'Bin location not found' })
  async getBinLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<BinLocation> {
    return this.binLocationService.getBinLocation(tenantId, id);
  }

  @Get('warehouse/:warehouseId/code/:binCode')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get bin location by warehouse and code' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiParam({ name: 'binCode', type: 'string', description: 'Bin code' })
  @ApiResponse({ status: 200, description: 'Bin location retrieved successfully', type: BinLocation })
  @ApiResponse({ status: 404, description: 'Bin location not found' })
  async getBinLocationByCode(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('binCode') binCode: string,
    @CurrentTenant() tenantId: string,
  ): Promise<BinLocation> {
    return this.binLocationService.getBinLocationByCode(tenantId, warehouseId, binCode);
  }

  @Get('zone/:zoneId')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get all bin locations for a zone' })
  @ApiParam({ name: 'zoneId', type: 'string', description: 'Zone ID' })
  @ApiResponse({ status: 200, description: 'Bin locations retrieved successfully' })
  async getBinLocationsByZone(
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<BinLocation[]> {
    return this.binLocationService.getBinLocationsByZone(tenantId, zoneId);
  }

  @Get('warehouse/:warehouseId')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get all bin locations for a warehouse' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Bin locations retrieved successfully' })
  async getBinLocationsByWarehouse(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<BinLocation[]> {
    return this.binLocationService.getBinLocationsByWarehouse(tenantId, warehouseId);
  }

  @Get('warehouse/:warehouseId/available')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get available bin locations for a warehouse' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiQuery({ name: 'zoneId', required: false, type: String, description: 'Filter by zone ID' })
  @ApiResponse({ status: 200, description: 'Available bin locations retrieved successfully' })
  async getAvailableBinLocations(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentTenant() tenantId: string,
    @Query('zoneId') zoneId?: string,
  ): Promise<BinLocation[]> {
    return this.binLocationService.getAvailableBinLocations(tenantId, warehouseId, zoneId);
  }

  @Get('product/:productId')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get bin locations assigned to a product' })
  @ApiParam({ name: 'productId', type: 'string', description: 'Product ID' })
  @ApiQuery({ name: 'variantId', required: false, type: String, description: 'Product variant ID' })
  @ApiResponse({ status: 200, description: 'Bin locations retrieved successfully' })
  async getBinLocationsByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentTenant() tenantId: string,
    @Query('variantId') variantId?: string,
  ): Promise<BinLocation[]> {
    return this.binLocationService.getBinLocationsByProduct(tenantId, productId, variantId);
  }

  @Get('warehouse/:warehouseId/metrics')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get bin location metrics for warehouse' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiQuery({ name: 'zoneId', required: false, type: String, description: 'Filter by zone ID' })
  @ApiResponse({ status: 200, description: 'Bin location metrics retrieved successfully' })
  async getBinLocationMetrics(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentTenant() tenantId: string,
    @Query('zoneId') zoneId?: string,
  ): Promise<any> {
    return this.binLocationService.getBinLocationMetrics(tenantId, warehouseId, zoneId);
  }

  @Get('warehouse/:warehouseId/report')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Generate bin location report for warehouse' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiQuery({ name: 'zoneId', required: false, type: String, description: 'Filter by zone ID' })
  @ApiResponse({ status: 200, description: 'Bin location report generated successfully' })
  async generateBinLocationReport(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentTenant() tenantId: string,
    @Query('zoneId') zoneId?: string,
  ): Promise<any> {
    return this.binLocationService.generateBinLocationReport(tenantId, warehouseId, zoneId);
  }

  @Get('warehouse/:warehouseId/optimal')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Find optimal bin location for product' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiQuery({ name: 'productId', type: String, description: 'Product ID' })
  @ApiQuery({ name: 'variantId', required: false, type: String, description: 'Product variant ID' })
  @ApiQuery({ name: 'requiredVolume', required: false, type: Number, description: 'Required volume' })
  @ApiQuery({ name: 'requiredWeight', required: false, type: Number, description: 'Required weight capacity' })
  @ApiQuery({ name: 'zoneType', required: false, type: String, description: 'Preferred zone type' })
  @ApiResponse({ status: 200, description: 'Optimal bin location found' })
  async findOptimalBinLocation(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Query('productId', ParseUUIDPipe) productId: string,
    @CurrentTenant() tenantId: string,
    @Query('variantId') variantId?: string,
    @Query('requiredVolume') requiredVolume?: number,
    @Query('requiredWeight') requiredWeight?: number,
    @Query('zoneType') zoneType?: string,
  ): Promise<BinLocation | null> {
    return this.binLocationService.findOptimalBinLocation(
      tenantId,
      warehouseId,
      productId,
      variantId || null,
      requiredVolume ? Number(requiredVolume) : undefined,
      requiredWeight ? Number(requiredWeight) : undefined,
      zoneType
    );
  }

  @Post('warehouse/:warehouseId/picking-route')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get optimized picking route for bin locations' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Picking route generated successfully' })
  async getPickingRoute(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Body() body: { binLocationIds: string[] },
    @CurrentTenant() tenantId: string,
  ): Promise<BinLocation[]> {
    return this.binLocationService.getPickingRoute(tenantId, warehouseId, body.binLocationIds);
  }

  @Put(':id')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Update bin location' })
  @ApiParam({ name: 'id', type: 'string', description: 'Bin location ID' })
  @ApiResponse({ status: 200, description: 'Bin location updated successfully', type: BinLocation })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Bin location not found' })
  async updateBinLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateBinLocationDto: UpdateBinLocationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<BinLocation> {
    return this.binLocationService.updateBinLocation(tenantId, id, updateBinLocationDto, user.id);
  }

  @Put(':id/status')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Update bin location status' })
  @ApiParam({ name: 'id', type: 'string', description: 'Bin location ID' })
  @ApiResponse({ status: 200, description: 'Bin location status updated successfully', type: BinLocation })
  @ApiResponse({ status: 404, description: 'Bin location not found' })
  async updateBinLocationStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: BinLocationStatus },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<BinLocation> {
    return this.binLocationService.updateBinLocationStatus(tenantId, id, body.status, user.id);
  }

  @Put(':id/assign-product')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Assign product to bin location' })
  @ApiParam({ name: 'id', type: 'string', description: 'Bin location ID' })
  @ApiResponse({ status: 200, description: 'Product assigned to bin location successfully', type: BinLocation })
  @ApiResponse({ status: 400, description: 'Invalid assignment' })
  @ApiResponse({ status: 404, description: 'Bin location not found' })
  @ApiResponse({ status: 409, description: 'Bin location not available for assignment' })
  async assignProductToBinLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { 
      productId: string; 
      variantId?: string; 
      dedicated: boolean 
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<BinLocation> {
    return this.binLocationService.assignProductToBinLocation(
      tenantId, 
      id, 
      body.productId, 
      body.variantId || null, 
      body.dedicated,
      user.id
    );
  }

  @Put(':id/unassign-product')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Unassign product from bin location' })
  @ApiParam({ name: 'id', type: 'string', description: 'Bin location ID' })
  @ApiResponse({ status: 200, description: 'Product unassigned from bin location successfully', type: BinLocation })
  @ApiResponse({ status: 404, description: 'Bin location not found' })
  async unassignProductFromBinLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<BinLocation> {
    return this.binLocationService.unassignProductFromBinLocation(tenantId, id, user.id);
  }

  @Put(':id/occupancy')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Update bin location occupancy' })
  @ApiParam({ name: 'id', type: 'string', description: 'Bin location ID' })
  @ApiResponse({ status: 200, description: 'Bin location occupancy updated successfully', type: BinLocation })
  @ApiResponse({ status: 400, description: 'Invalid occupancy data' })
  @ApiResponse({ status: 404, description: 'Bin location not found' })
  async updateBinLocationOccupancy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { 
      occupancyPercentage: number; 
      currentWeight: number 
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<BinLocation> {
    return this.binLocationService.updateBinLocationOccupancy(
      tenantId, 
      id, 
      body.occupancyPercentage, 
      body.currentWeight,
      user.id
    );
  }

  @Post('warehouse/:warehouseId/optimize')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Optimize bin location layout' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiQuery({ name: 'zoneId', required: false, type: String, description: 'Filter by zone ID' })
  @ApiResponse({ status: 200, description: 'Bin location optimization completed' })
  async optimizeBinLocationLayout(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentTenant() tenantId: string,
    @Query('zoneId') zoneId?: string,
  ): Promise<any> {
    return this.binLocationService.optimizeBinLocationLayout(tenantId, warehouseId, zoneId);
  }

  @Delete(':id')
  @RequirePermission('warehouses:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete bin location' })
  @ApiParam({ name: 'id', type: 'string', description: 'Bin location ID' })
  @ApiResponse({ status: 204, description: 'Bin location deleted successfully' })
  @ApiResponse({ status: 404, description: 'Bin location not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete occupied bin location' })
  async deleteBinLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.binLocationService.deleteBinLocation(tenantId, id, user.id);
  }
}