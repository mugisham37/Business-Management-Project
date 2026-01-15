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
import { WarehouseService } from '../services/warehouse.service';
import { 
  CreateWarehouseDto, 
  UpdateWarehouseDto, 
  WarehouseQueryDto,
  WarehouseCapacityDto 
} from '../dto/warehouse.dto';
import { Warehouse } from '../entities/warehouse.entity';

@Controller('api/v1/warehouses')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('warehouse-management')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Warehouse Management')
@ApiBearerAuth()
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @RequirePermission('warehouses:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new warehouse' })
  @ApiResponse({ status: 201, description: 'Warehouse created successfully', type: Warehouse })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Warehouse code already exists' })
  async createWarehouse(
    @Body(ValidationPipe) createWarehouseDto: CreateWarehouseDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<Warehouse> {
    return this.warehouseService.createWarehouse(tenantId, createWarehouseDto, user.id);
  }

  @Get()
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get all warehouses' })
  @ApiResponse({ status: 200, description: 'Warehouses retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive', 'maintenance', 'closed'] })
  @ApiQuery({ name: 'locationId', required: false, type: String, description: 'Filter by location ID' })
  @ApiQuery({ name: 'managerId', required: false, type: String, description: 'Filter by manager ID' })
  async getWarehouses(
    @Query() query: WarehouseQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    warehouses: Warehouse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.warehouseService.getWarehouses(tenantId, query);
  }

  @Get('active')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get all active warehouses' })
  @ApiResponse({ status: 200, description: 'Active warehouses retrieved successfully' })
  async getActiveWarehouses(
    @CurrentTenant() tenantId: string,
  ): Promise<Warehouse[]> {
    return this.warehouseService.getActiveWarehouses(tenantId);
  }

  @Get(':id')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get warehouse by ID' })
  @ApiParam({ name: 'id', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Warehouse retrieved successfully', type: Warehouse })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async getWarehouse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Warehouse> {
    return this.warehouseService.getWarehouse(tenantId, id);
  }

  @Get('code/:warehouseCode')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get warehouse by code' })
  @ApiParam({ name: 'warehouseCode', type: 'string', description: 'Warehouse code' })
  @ApiResponse({ status: 200, description: 'Warehouse retrieved successfully', type: Warehouse })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async getWarehouseByCode(
    @Param('warehouseCode') warehouseCode: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Warehouse> {
    return this.warehouseService.getWarehouseByCode(tenantId, warehouseCode);
  }

  @Get(':id/capacity')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get warehouse capacity information' })
  @ApiParam({ name: 'id', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Warehouse capacity retrieved successfully', type: WarehouseCapacityDto })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async getWarehouseCapacity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<WarehouseCapacityDto> {
    return this.warehouseService.getWarehouseCapacity(tenantId, id);
  }

  @Get(':id/metrics')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get warehouse metrics and analytics' })
  @ApiParam({ name: 'id', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Warehouse metrics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async getWarehouseMetrics(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.warehouseService.getWarehouseMetrics(tenantId, id);
  }

  @Get(':id/report')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Generate comprehensive warehouse report' })
  @ApiParam({ name: 'id', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Warehouse report generated successfully' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async generateWarehouseReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.warehouseService.generateWarehouseReport(tenantId, id);
  }

  @Get('location/:locationId')
  @RequirePermission('warehouses:read')
  @ApiOperation({ summary: 'Get warehouse by location ID' })
  @ApiParam({ name: 'locationId', type: 'string', description: 'Location ID' })
  @ApiResponse({ status: 200, description: 'Warehouse retrieved successfully', type: Warehouse })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async getWarehouseByLocation(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Warehouse> {
    return this.warehouseService.getWarehousesByLocation(tenantId, locationId);
  }

  @Put(':id')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Update warehouse' })
  @ApiParam({ name: 'id', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Warehouse updated successfully', type: Warehouse })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async updateWarehouse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateWarehouseDto: UpdateWarehouseDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<Warehouse> {
    return this.warehouseService.updateWarehouse(tenantId, id, updateWarehouseDto, user.id);
  }

  @Put(':id/capacity')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Update warehouse capacity' })
  @ApiParam({ name: 'id', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Warehouse capacity updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid capacity change' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async updateWarehouseCapacity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { capacityChange: number; reason: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.warehouseService.updateWarehouseCapacity(
      tenantId, 
      id, 
      body.capacityChange, 
      body.reason, 
      user.id
    );
  }

  @Post(':id/initialize')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Initialize warehouse with default zones' })
  @ApiParam({ name: 'id', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Warehouse initialized successfully' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async initializeWarehouse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.warehouseService.initializeWarehouse(tenantId, id, user.id);
  }

  @Post(':id/optimize')
  @RequirePermission('warehouses:update')
  @ApiOperation({ summary: 'Optimize warehouse layout' })
  @ApiParam({ name: 'id', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'Warehouse optimization completed' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async optimizeWarehouseLayout(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.warehouseService.optimizeWarehouseLayout(tenantId, id, user.id);
  }

  @Delete(':id')
  @RequirePermission('warehouses:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete warehouse' })
  @ApiParam({ name: 'id', type: 'string', description: 'Warehouse ID' })
  @ApiResponse({ status: 204, description: 'Warehouse deleted successfully' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete warehouse with existing zones' })
  async deleteWarehouse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.warehouseService.deleteWarehouse(tenantId, id, user.id);
  }
}