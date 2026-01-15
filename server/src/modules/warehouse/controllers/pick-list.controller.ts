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
import { PickListService } from '../services/pick-list.service';
import {
  CreatePickListDto,
  UpdatePickListDto,
  PickListQueryDto,
  CreatePickListItemDto,
  UpdatePickListItemDto,
  OptimizePickingRouteDto,
  PickListStatus,
} from '../dto/picking.dto';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

@ApiTags('Pick Lists')
@ApiBearerAuth()
@Controller('warehouse/pick-lists')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('warehouse_management')
export class PickListController {
  constructor(private readonly pickListService: PickListService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new pick list' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Pick list created successfully',
  })
  @RequirePermission('warehouse:pick_lists:create')
  async createPickList(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() createPickListDto: CreatePickListDto,
  ) {
    return await this.pickListService.createPickList(tenantId, createPickListDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get pick lists with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pick lists retrieved successfully',
  })
  @RequirePermission('warehouse:pick_lists:read')
  async getPickLists(
    @CurrentTenant() tenantId: string,
    @Query() query: PickListQueryDto,
  ) {
    return await this.pickListService.getPickLists(tenantId, query);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get pick list statistics' })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'pickerId', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pick list statistics retrieved successfully',
  })
  @RequirePermission('warehouse:pick_lists:read')
  async getPickListStatistics(
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('pickerId') pickerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const dateFromObj = dateFrom ? new Date(dateFrom) : undefined;
    const dateToObj = dateTo ? new Date(dateTo) : undefined;
    
    return await this.pickListService.getPickListStatistics(
      tenantId,
      warehouseId,
      pickerId,
      dateFromObj,
      dateToObj,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pick list by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pick list retrieved successfully',
  })
  @RequirePermission('warehouse:pick_lists:read')
  async getPickList(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.pickListService.getPickList(tenantId, id);
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'Get pick list items' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pick list items retrieved successfully',
  })
  @RequirePermission('warehouse:pick_lists:read')
  async getPickListItems(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.pickListService.getPickListItems(tenantId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update pick list' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pick list updated successfully',
  })
  @RequirePermission('warehouse:pick_lists:update')
  async updatePickList(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePickListDto: UpdatePickListDto,
  ) {
    return await this.pickListService.updatePickList(tenantId, id, updatePickListDto, userId);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update pick list status' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pick list status updated successfully',
  })
  @RequirePermission('warehouse:pick_lists:update')
  async updatePickListStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: PickListStatus,
  ) {
    return await this.pickListService.updatePickListStatus(tenantId, id, status, userId);
  }

  @Post(':id/optimize-route')
  @ApiOperation({ summary: 'Optimize picking route for pick list' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Picking route optimized successfully',
  })
  @RequirePermission('warehouse:pick_lists:update')
  async optimizePickingRoute(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() optimizeRouteDto: OptimizePickingRouteDto,
  ) {
    return await this.pickListService.optimizePickingRoute(
      tenantId,
      id,
      optimizeRouteDto,
      userId,
    );
  }

  @Put('items/:itemId')
  @ApiOperation({ summary: 'Update pick list item' })
  @ApiParam({ name: 'itemId', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pick list item updated successfully',
  })
  @RequirePermission('warehouse:pick_lists:update')
  async updateItem(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() updateItemDto: UpdatePickListItemDto,
  ) {
    return await this.pickListService.updateItem(tenantId, itemId, updateItemDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete pick list' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Pick list deleted successfully',
  })
  @RequirePermission('warehouse:pick_lists:delete')
  async deletePickList(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.pickListService.deletePickList(tenantId, id, userId);
  }
}