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
import { PickingWaveService } from '../services/picking-wave.service';
import {
  CreatePickingWaveDto,
  UpdatePickingWaveDto,
  PickingWaveQueryDto,
  WavePlanningDto,
  WaveStatus,
} from '../dto/picking.dto';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

@ApiTags('Picking Waves')
@ApiBearerAuth()
@Controller('warehouse/picking-waves')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('warehouse_management')
export class PickingWaveController {
  constructor(private readonly pickingWaveService: PickingWaveService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new picking wave' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Picking wave created successfully',
  })
  @RequirePermission('warehouse:waves:create')
  async createWave(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() createWaveDto: CreatePickingWaveDto,
  ) {
    return await this.pickingWaveService.createWave(tenantId, createWaveDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get picking waves with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Picking waves retrieved successfully',
  })
  @RequirePermission('warehouse:waves:read')
  async getWaves(
    @CurrentTenant() tenantId: string,
    @Query() query: PickingWaveQueryDto,
  ) {
    return await this.pickingWaveService.getWaves(tenantId, query);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active picking waves' })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active picking waves retrieved successfully',
  })
  @RequirePermission('warehouse:waves:read')
  async getActiveWaves(
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return await this.pickingWaveService.getActiveWaves(tenantId, warehouseId);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get picking wave statistics' })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Picking wave statistics retrieved successfully',
  })
  @RequirePermission('warehouse:waves:read')
  async getWaveStatistics(
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const dateFromObj = dateFrom ? new Date(dateFrom) : undefined;
    const dateToObj = dateTo ? new Date(dateTo) : undefined;
    
    return await this.pickingWaveService.getWaveStatistics(
      tenantId,
      warehouseId,
      dateFromObj,
      dateToObj,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get picking wave by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Picking wave retrieved successfully',
  })
  @RequirePermission('warehouse:waves:read')
  async getWave(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.pickingWaveService.getWave(tenantId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update picking wave' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Picking wave updated successfully',
  })
  @RequirePermission('warehouse:waves:update')
  async updateWave(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWaveDto: UpdatePickingWaveDto,
  ) {
    return await this.pickingWaveService.updateWave(tenantId, id, updateWaveDto, userId);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update picking wave status' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wave status updated successfully',
  })
  @RequirePermission('warehouse:waves:update')
  async updateWaveStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: WaveStatus,
  ) {
    return await this.pickingWaveService.updateWaveStatus(tenantId, id, status, userId);
  }

  @Post('plan')
  @ApiOperation({ summary: 'Plan picking waves for orders' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wave planning completed successfully',
  })
  @RequirePermission('warehouse:waves:create')
  async planWave(
    @CurrentTenant() tenantId: string,
    @Body() planningDto: WavePlanningDto,
  ) {
    return await this.pickingWaveService.planWave(tenantId, planningDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete picking wave' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Picking wave deleted successfully',
  })
  @RequirePermission('warehouse:waves:delete')
  async deleteWave(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.pickingWaveService.deleteWave(tenantId, id, userId);
  }
}