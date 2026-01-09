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
import { LocationService } from '../services/location.service';
import { 
  CreateLocationDto, 
  UpdateLocationDto, 
  LocationQueryDto,
  LocationResponseDto 
} from '../dto/location.dto';
import { Location } from '../entities/location.entity';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission, CurrentUser, CurrentTenant } from '../../auth/decorators/auth.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/locations')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('multi-location-operations')
@ApiBearerAuth()
@ApiTags('Locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post()
  @RequirePermission('locations:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new location' })
  @ApiResponse({ 
    status: 201, 
    description: 'Location created successfully',
    type: LocationResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Location code already exists' })
  async create(
    @Body() createLocationDto: CreateLocationDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Location> {
    return this.locationService.create(tenantId, createLocationDto, user.id);
  }

  @Get()
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get all locations' })
  @ApiResponse({ 
    status: 200, 
    description: 'Locations retrieved successfully',
    type: [LocationResponseDto]
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'type', required: false, description: 'Location type filter' })
  @ApiQuery({ name: 'status', required: false, description: 'Location status filter' })
  @ApiQuery({ name: 'managerId', required: false, description: 'Manager ID filter' })
  @ApiQuery({ name: 'parentLocationId', required: false, description: 'Parent location ID filter' })
  @ApiQuery({ name: 'includeChildren', required: false, description: 'Include child locations' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  async findAll(
    @Query() query: LocationQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ locations: Location[]; total: number }> {
    return this.locationService.findAll(tenantId, query);
  }

  @Get('tree')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get location tree structure' })
  @ApiResponse({ 
    status: 200, 
    description: 'Location tree retrieved successfully',
    type: [LocationResponseDto]
  })
  @ApiQuery({ name: 'rootLocationId', required: false, description: 'Root location ID for tree' })
  async getLocationTree(
    @Query('rootLocationId') rootLocationId?: string,
    @CurrentTenant() tenantId: string = '',
  ): Promise<Location[]> {
    return this.locationService.getLocationTree(tenantId, rootLocationId);
  }

  @Get('by-manager/:managerId')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get locations by manager' })
  @ApiParam({ name: 'managerId', description: 'Manager user ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Locations retrieved successfully',
    type: [LocationResponseDto]
  })
  async getLocationsByManager(
    @Param('managerId', ParseUUIDPipe) managerId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Location[]> {
    return this.locationService.getLocationsByManager(tenantId, managerId);
  }

  @Get('by-type/:type')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get locations by type' })
  @ApiParam({ name: 'type', description: 'Location type' })
  @ApiResponse({ 
    status: 200, 
    description: 'Locations retrieved successfully',
    type: [LocationResponseDto]
  })
  async getLocationsByType(
    @Param('type') type: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Location[]> {
    return this.locationService.getLocationsByType(tenantId, type);
  }

  @Get(':id')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get location by ID' })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Location retrieved successfully',
    type: LocationResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Location> {
    return this.locationService.findById(tenantId, id);
  }

  @Get('code/:code')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get location by code' })
  @ApiParam({ name: 'code', description: 'Location code' })
  @ApiResponse({ 
    status: 200, 
    description: 'Location retrieved successfully',
    type: LocationResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async findByCode(
    @Param('code') code: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Location> {
    return this.locationService.findByCode(tenantId, code);
  }

  @Get(':id/children')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get child locations' })
  @ApiParam({ name: 'id', description: 'Parent location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Child locations retrieved successfully',
    type: [LocationResponseDto]
  })
  async findChildren(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Location[]> {
    return this.locationService.findChildren(tenantId, id);
  }

  @Get(':id/hierarchy')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get location hierarchy (all descendants)' })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Location hierarchy retrieved successfully',
    type: [LocationResponseDto]
  })
  async findHierarchy(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Location[]> {
    return this.locationService.findHierarchy(tenantId, id);
  }

  @Put(':id')
  @RequirePermission('locations:update')
  @ApiOperation({ summary: 'Update location' })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Location updated successfully',
    type: LocationResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Location not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLocationDto: UpdateLocationDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Location> {
    return this.locationService.update(tenantId, id, updateLocationDto, user.id);
  }

  @Put(':id/metrics')
  @RequirePermission('locations:update')
  @ApiOperation({ summary: 'Update location metrics' })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Location metrics updated successfully',
    type: LocationResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async updateMetrics(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() metrics: Record<string, any>,
    @CurrentTenant() tenantId: string,
  ): Promise<Location> {
    return this.locationService.updateLocationMetrics(tenantId, id, metrics);
  }

  @Delete(':id')
  @RequirePermission('locations:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete location' })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiResponse({ status: 204, description: 'Location deleted successfully' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete location with children' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    return this.locationService.delete(tenantId, id, user.id);
  }
}