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
  HttpStatus,
  HttpCode,
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
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorator';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { FranchiseService } from '../services/franchise.service';
import {
  Franchise,
  Territory,
  FranchiseLocation,
  FranchisePermission,
} from '../entities/franchise.entity';
import {
  CreateFranchiseDto,
  UpdateFranchiseDto,
  FranchiseQueryDto,
  CreateTerritoryDto,
  UpdateTerritoryDto,
  TerritoryQueryDto,
  CreateFranchiseLocationDto,
  CreateFranchisePermissionDto,
  FranchisePerformanceDto,
} from '../dto/franchise.dto';

@ApiTags('Franchise Management')
@Controller('api/v1/franchises')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('multi-location-operations')
@ApiBearerAuth()
export class FranchiseController {
  constructor(private readonly franchiseService: FranchiseService) {}

  @Post()
  @RequirePermission('franchises:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new franchise' })
  @ApiResponse({ status: 201, description: 'Franchise created successfully', type: Franchise })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Franchise code already exists' })
  async createFranchise(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateFranchiseDto,
  ): Promise<Franchise> {
    return this.franchiseService.createFranchise(tenantId, dto, user.id);
  }

  @Get()
  @RequirePermission('franchises:read')
  @ApiOperation({ summary: 'Get all franchises' })
  @ApiResponse({ status: 200, description: 'Franchises retrieved successfully' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by franchise type' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by franchise status' })
  @ApiQuery({ name: 'ownerId', required: false, description: 'Filter by owner ID' })
  @ApiQuery({ name: 'territoryId', required: false, description: 'Filter by territory ID' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  async getFranchises(
    @CurrentTenant() tenantId: string,
    @Query() query: FranchiseQueryDto,
  ): Promise<{ franchises: Franchise[]; total: number }> {
    return this.franchiseService.getFranchises(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('franchises:read')
  @ApiOperation({ summary: 'Get franchise by ID' })
  @ApiResponse({ status: 200, description: 'Franchise retrieved successfully', type: Franchise })
  @ApiResponse({ status: 404, description: 'Franchise not found' })
  @ApiParam({ name: 'id', description: 'Franchise ID' })
  async getFranchiseById(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Franchise> {
    return this.franchiseService.getFranchiseById(tenantId, id);
  }

  @Put(':id')
  @RequirePermission('franchises:update')
  @ApiOperation({ summary: 'Update franchise' })
  @ApiResponse({ status: 200, description: 'Franchise updated successfully', type: Franchise })
  @ApiResponse({ status: 404, description: 'Franchise not found' })
  @ApiResponse({ status: 409, description: 'Franchise code already exists' })
  @ApiParam({ name: 'id', description: 'Franchise ID' })
  async updateFranchise(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFranchiseDto,
  ): Promise<Franchise> {
    return this.franchiseService.updateFranchise(tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('franchises:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete franchise' })
  @ApiResponse({ status: 204, description: 'Franchise deleted successfully' })
  @ApiResponse({ status: 404, description: 'Franchise not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete franchise with active locations' })
  @ApiParam({ name: 'id', description: 'Franchise ID' })
  async deleteFranchise(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.franchiseService.deleteFranchise(tenantId, id, user.id);
  }

  @Get(':id/locations')
  @RequirePermission('franchises:read')
  @ApiOperation({ summary: 'Get franchise locations' })
  @ApiResponse({ status: 200, description: 'Franchise locations retrieved successfully' })
  @ApiParam({ name: 'id', description: 'Franchise ID' })
  async getFranchiseLocations(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FranchiseLocation[]> {
    return this.franchiseService.getFranchiseLocations(tenantId, id);
  }

  @Post(':id/locations')
  @RequirePermission('franchises:manage-locations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign location to franchise' })
  @ApiResponse({ status: 201, description: 'Location assigned successfully', type: FranchiseLocation })
  @ApiResponse({ status: 409, description: 'Location already has primary franchise assignment' })
  @ApiParam({ name: 'id', description: 'Franchise ID' })
  async assignLocationToFranchise(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Omit<CreateFranchiseLocationDto, 'franchiseId'>,
  ): Promise<FranchiseLocation> {
    return this.franchiseService.assignLocationToFranchise(
      tenantId,
      { ...dto, franchiseId: id },
      user.id,
    );
  }

  @Get(':id/permissions')
  @RequirePermission('franchises:read')
  @ApiOperation({ summary: 'Get franchise permissions' })
  @ApiResponse({ status: 200, description: 'Franchise permissions retrieved successfully' })
  @ApiParam({ name: 'id', description: 'Franchise ID' })
  async getFranchisePermissions(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FranchisePermission[]> {
    return this.franchiseService.getFranchisePermissions(tenantId, id);
  }

  @Post(':id/permissions')
  @RequirePermission('franchises:manage-permissions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Grant franchise permission to user' })
  @ApiResponse({ status: 201, description: 'Permission granted successfully', type: FranchisePermission })
  @ApiResponse({ status: 409, description: 'User already has active permissions for this franchise' })
  @ApiParam({ name: 'id', description: 'Franchise ID' })
  async grantFranchisePermission(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Omit<CreateFranchisePermissionDto, 'franchiseId'>,
  ): Promise<FranchisePermission> {
    return this.franchiseService.grantFranchisePermission(
      tenantId,
      { ...dto, franchiseId: id },
      user.id,
    );
  }

  @Get(':id/performance')
  @RequirePermission('franchises:read')
  @ApiOperation({ summary: 'Get franchise performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully', type: FranchisePerformanceDto })
  @ApiParam({ name: 'id', description: 'Franchise ID' })
  @ApiQuery({ name: 'period', required: false, description: 'Performance period (monthly, quarterly, yearly)' })
  async getFranchisePerformance(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('period') period: string = 'monthly',
  ): Promise<FranchisePerformanceDto> {
    return this.franchiseService.getFranchisePerformance(tenantId, id, period);
  }
}