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
import { WarehouseZoneService } from '../services/warehouse-zone.service';
import { 
  CreateWarehouseZoneDto, 
  UpdateWarehouseZoneDto,
  WarehouseZoneType 
} from '../dto/warehouse.dto';
import { WarehouseZone } from '../entities/warehouse.entity';

@Controller('api/v1/warehouse-zones')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('warehouse-management')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Warehouse Zones')
@ApiBearerAuth()
export class WarehouseZoneController {
  constructor(private readonly warehouseZoneService: WarehouseZoneService) {}

  @Post()
  @RequirePermission('warehouses:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new warehouse zone' })
  @ApiResponse({ status: 201, description: 'Warehouse zone created successfully', type: WarehouseZone })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Zone code already exists in warehouse' })
  async createZone(
    @Body(ValidationPipe) createZoneDto: CreateWarehouseZoneDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<WarehouseZone> {
    return this.warehouseZoneService.createZone(tenantId, createZoneDto, user.id);
  }

  @Get(':id')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get warehouse zone by ID' })
  @ApiParam({ name: 'id', type: 'string', description: 'Zone ID' })
  @ApiResponse({ status: 200, description: 'Warehouse zone retrieved successfully', type: WarehouseZone })
  @ApiResponse({ status: 404, description: 'Warehouse zone not found' })
  async getZone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseZone> {
    return this.warehouseZoneService.getZone(tenantId, id);
  }

  @Get('warehouse/:warehouseId')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get all zones for a warehouse' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Warehouse zones retrieved successfully' })
  async getZonesByWarehouse(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseZone[]> {
    return this.warehouseZoneService.getZonesByWarehouse(tenantId, warehouseId);
  }

  @Get('warehouse/:warehouseId/type/:zoneType')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get zones by warehouse and type' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiParam({ name: 'zoneType', enum: WarehouseZoneType, description: 'Zone type' })
  @ApiResponse({ status: 200, description: 'Warehouse zones retrieved successfully' })
  async getZonesByType(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('zoneType') zoneType: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseZone[]> {
    return this.warehouseZoneService.getZonesByType(tenantId, warehouseId, zoneType);
  }

  @Get('warehouse/:warehouseId/available')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get available zones for a warehouse' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiQuery({ name: 'zoneType', required: false, enum: WarehouseZoneType, description: 'Filter by zone type' })
  @ApiResponse({ status: 200, description: 'Available warehouse zones retrieved successfully' })
  async getAvailableZones(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentTenant() tenantId: string,
    @Query('zoneType') zoneType?: string,
  ): Promise<WarehouseZone[]> {
    return this.warehouseZoneService.getAvailableZones(tenantId, warehouseId, zoneType);
  }

  @Get('warehouse/:warehouseId/code/:zoneCode')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get zone by warehouse and code' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiParam({ name: 'zoneCode', type: 'string', description: 'Zone code' })
  @ApiResponse({ status: 200, description: 'Warehouse zone retrieved successfully', type: WarehouseZone })
  @ApiResponse({ status: 404, description: 'Warehouse zone not found' })
  async getZoneByCode(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('zoneCode') zoneCode: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseZone> {
    return this.warehouseZoneService.getZoneByCode(tenantId, warehouseId, zoneCode);
  }

  @Get(':id/capacity')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get zone capacity information' })
  @ApiParam({ name: 'id', type: 'string', description: 'Zone ID' })
  @ApiResponse({ status: 200, description: 'Zone capacity retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  async getZoneCapacity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    maxBinLocations: number;
    currentBinLocations: number;
    availableBinLocations: number;
    utilizationPercentage: number;
  }> {
    return this.warehouseZoneService.getZoneCapacity(tenantId, id);
  }

  @Get(':id/metrics')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get zone metrics and analytics' })
  @ApiParam({ name: 'id', type: 'string', description: 'Zone ID' })
  @ApiResponse({ status: 200, description: 'Zone metrics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  async getZoneMetrics(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.warehouseZoneService.getZoneMetrics(tenantId, id);
  }

  @Get(':id/report')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Generate comprehensive zone report' })
  @ApiParam({ name: 'id', type: 'string', description: 'Zone ID' })
  @ApiResponse({ status: 200, description: 'Zone report generated successfully' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  async generateZoneReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.warehouseZoneService.generateZoneReport(tenantId, id);
  }

  @Get('warehouse/:warehouseId/coordinates')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Find zones by coordinates' })
  @ApiParam({ name: 'warehouseId', type: 'string', description: 'Warehouse ID' })
  @ApiQuery({ name: 'x', type: Number, description: 'X coordinate' })
  @ApiQuery({ name: 'y', type: Number, description: 'Y coordinate' })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Search radius (default: 10)' })
  @ApiResponse({ status: 200, description: 'Zones found by coordinates' })
  async findZonesByCoordinates(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Query('x') x: number,
    @Query('y') y: number,
    @CurrentTenant() tenantId: string,
    @Query('radius') radius?: number,
  ): Promise<WarehouseZone[]> {
    return this.warehouseZoneService.findZonesByCoordinates(
      tenantId, 
      warehouseId, 
      Number(x), 
      Number(y), 
      radius ? Number(radius) : 10
    );
  }

  @Put(':id')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Update warehouse zone' })
  @ApiParam({ name: 'id', type: 'string', description: 'Zone ID' })
  @ApiResponse({ status: 200, description: 'Warehouse zone updated successfully', type: WarehouseZone })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Warehouse zone not found' })
  async updateZone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateZoneDto: UpdateWarehouseZoneDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<WarehouseZone> {
    return this.warehouseZoneService.updateZone(tenantId, id, updateZoneDto, user.id);
  }

  @Put(':id/bin-count')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Update zone bin location count' })
  @ApiParam({ name: 'id', type: 'string', description: 'Zone ID' })
  @ApiResponse({ status: 200, description: 'Zone bin location count updated successfully' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  async updateZoneBinLocationCount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.warehouseZoneService.updateZoneBinLocationCount(tenantId, id, user.id);
  }

  @Post(':id/optimize')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Optimize zone layout' })
  @ApiParam({ name: 'id', type: 'string', description: 'Zone ID' })
  @ApiResponse({ status: 200, description: 'Zone optimization completed' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  async optimizeZoneLayout(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.warehouseZoneService.optimizeZoneLayout(tenantId, id, user.id);
  }

  @Delete(':id')
  @RequirePermission('warehouses:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete warehouse zone' })
  @ApiParam({ name: 'id', type: 'string', description: 'Zone ID' })
  @ApiResponse({ status: 204, description: 'Warehouse zone deleted successfully' })
  @ApiResponse({ status: 404, description: 'Warehouse zone not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete zone with existing bin locations' })
  async deleteZone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.warehouseZoneService.deleteZone(tenantId, id, user.id);
  }
}