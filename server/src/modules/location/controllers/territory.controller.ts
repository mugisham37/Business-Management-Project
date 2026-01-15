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
  Territory,
  TerritoryAssignment,
} from '../entities/franchise.entity';
import {
  CreateTerritoryDto,
  UpdateTerritoryDto,
  TerritoryQueryDto,
  CreateTerritoryAssignmentDto,
} from '../dto/franchise.dto';

@ApiTags('Territory Management')
@Controller('api/v1/territories')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('multi-location-operations')
@ApiBearerAuth()
export class TerritoryController {
  constructor(private readonly franchiseService: FranchiseService) {}

  @Post()
  @RequirePermission('territories:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new territory' })
  @ApiResponse({ status: 201, description: 'Territory created successfully', type: Territory })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Territory code already exists' })
  async createTerritory(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateTerritoryDto,
  ): Promise<Territory> {
    return this.franchiseService.createTerritory(tenantId, dto, user.id);
  }

  @Get()
  @RequirePermission('territories:read')
  @ApiOperation({ summary: 'Get all territories' })
  @ApiResponse({ status: 200, description: 'Territories retrieved successfully' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by territory type' })
  @ApiQuery({ name: 'franchiseId', required: false, description: 'Filter by assigned franchise ID' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by assigned user ID' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  async getTerritories(
    @CurrentTenant() tenantId: string,
    @Query() query: TerritoryQueryDto,
  ): Promise<{ territories: Territory[]; total: number }> {
    return this.franchiseService.getTerritories(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('territories:read')
  @ApiOperation({ summary: 'Get territory by ID' })
  @ApiResponse({ status: 200, description: 'Territory retrieved successfully', type: Territory })
  @ApiResponse({ status: 404, description: 'Territory not found' })
  @ApiParam({ name: 'id', description: 'Territory ID' })
  async getTerritoryById(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Territory> {
    return this.franchiseService.getTerritoryById(tenantId, id);
  }

  @Put(':id')
  @RequirePermission('territories:update')
  @ApiOperation({ summary: 'Update territory' })
  @ApiResponse({ status: 200, description: 'Territory updated successfully', type: Territory })
  @ApiResponse({ status: 404, description: 'Territory not found' })
  @ApiResponse({ status: 409, description: 'Territory code already exists' })
  @ApiParam({ name: 'id', description: 'Territory ID' })
  async updateTerritory(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTerritoryDto,
  ): Promise<Territory> {
    return this.franchiseService.updateTerritory(tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('territories:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete territory' })
  @ApiResponse({ status: 204, description: 'Territory deleted successfully' })
  @ApiResponse({ status: 404, description: 'Territory not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete territory with active assignments' })
  @ApiParam({ name: 'id', description: 'Territory ID' })
  async deleteTerritory(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.franchiseService.deleteTerritory(tenantId, id, user.id);
  }

  @Post(':id/assign-franchise')
  @RequirePermission('territories:assign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign territory to franchise' })
  @ApiResponse({ status: 201, description: 'Territory assigned successfully', type: TerritoryAssignment })
  @ApiResponse({ status: 409, description: 'Territory already assigned to another franchise' })
  @ApiParam({ name: 'id', description: 'Territory ID' })
  async assignTerritoryToFranchise(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { franchiseId: string },
  ): Promise<TerritoryAssignment> {
    return this.franchiseService.assignTerritoryToFranchise(tenantId, { territoryId: id, franchiseId: body.franchiseId }, user.id);
  }

  @Post('assignments')
  @RequirePermission('territories:assign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create territory assignment' })
  @ApiResponse({ status: 201, description: 'Territory assignment created successfully', type: TerritoryAssignment })
  async createTerritoryAssignment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateTerritoryAssignmentDto,
  ): Promise<TerritoryAssignment> {
    return this.franchiseService.createTerritoryAssignment(tenantId, dto, user.id);
  }
}