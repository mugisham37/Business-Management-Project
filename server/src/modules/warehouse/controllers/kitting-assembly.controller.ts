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
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { LoggingInterceptor } from '../../../common/interceptors';
import { CacheInterceptor } from '../../../common/interceptors';
import { 
  KittingAssemblyService, 
  CreateKitDto, 
  CreateAssemblyWorkOrderDto, 
  UpdateAssemblyWorkOrderDto 
} from '../services/kitting-assembly.service';

@Controller('api/v1/warehouse/kitting-assembly')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('warehouse-management')
@UseInterceptors(LoggingInterceptor)
@ApiTags('Warehouse Kitting & Assembly')
export class KittingAssemblyController {
  constructor(
    private readonly kittingAssemblyService: KittingAssemblyService,
  ) {}

  // Kit Management Endpoints

  @Post('kits')
  @RequirePermission('warehouse:kitting:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new kit definition' })
  @ApiResponse({ status: 201, description: 'Kit created successfully' })
  async createKit(
    @Body() createKitDto: CreateKitDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const kit = await this.kittingAssemblyService.createKit(tenantId, {
      ...createKitDto,
      tenantId,
      userId: user.id,
    });
    
    return {
      success: true,
      data: kit,
      message: 'Kit created successfully',
    };
  }

  @Put('kits/:kitId')
  @RequirePermission('warehouse:kitting:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a kit definition' })
  @ApiParam({ name: 'kitId', description: 'Kit ID' })
  @ApiResponse({ status: 200, description: 'Kit updated successfully' })
  async updateKit(
    @Param('kitId') kitId: string,
    @Body() updateKitDto: Partial<CreateKitDto>,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const kit = await this.kittingAssemblyService.updateKit(tenantId, kitId, {
      ...updateKitDto,
      userId: user.id,
    });
    
    return {
      success: true,
      data: kit,
      message: 'Kit updated successfully',
    };
  }

  @Get('kits/:kitId')
  @RequirePermission('warehouse:kitting:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get kit definition' })
  @ApiParam({ name: 'kitId', description: 'Kit ID' })
  @ApiResponse({ status: 200, description: 'Kit details retrieved successfully' })
  async getKit(
    @Param('kitId') kitId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const kit = await this.kittingAssemblyService.getKit(tenantId, kitId);
    
    return {
      success: true,
      data: kit,
    };
  }

  @Get('kits')
  @RequirePermission('warehouse:kitting:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get all kits' })
  @ApiQuery({ name: 'kitType', required: false, description: 'Filter by kit type' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Kits retrieved successfully' })
  async getKits(
    @CurrentTenant() tenantId: string,
    @Query('kitType') kitType?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const options: any = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    if (kitType !== undefined) options.kitType = kitType;
    if (isActive !== undefined) options.isActive = isActive === 'true';
    if (search !== undefined) options.search = search;

    const result = await this.kittingAssemblyService.getKits(tenantId, options);
    
    return {
      success: true,
      data: result,
    };
  }

  @Get('kits/:kitId/cost-analysis')
  @RequirePermission('warehouse:kitting:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get kit cost analysis' })
  @ApiParam({ name: 'kitId', description: 'Kit ID' })
  @ApiResponse({ status: 200, description: 'Kit cost analysis retrieved successfully' })
  async getKitCostAnalysis(
    @Param('kitId') kitId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const analysis = await this.kittingAssemblyService.getKitCostAnalysis(tenantId, kitId);
    
    return {
      success: true,
      data: analysis,
    };
  }

  // Assembly Work Order Endpoints

  @Post('work-orders')
  @RequirePermission('warehouse:assembly:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new assembly work order' })
  @ApiResponse({ status: 201, description: 'Work order created successfully' })
  async createAssemblyWorkOrder(
    @Body() createWorkOrderDto: CreateAssemblyWorkOrderDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const workOrder = await this.kittingAssemblyService.createAssemblyWorkOrder(tenantId, {
      ...createWorkOrderDto,
      tenantId,
      userId: user.id,
    });
    
    return {
      success: true,
      data: workOrder,
      message: 'Assembly work order created successfully',
    };
  }

  @Put('work-orders/:workOrderId')
  @RequirePermission('warehouse:assembly:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an assembly work order' })
  @ApiParam({ name: 'workOrderId', description: 'Work order ID' })
  @ApiResponse({ status: 200, description: 'Work order updated successfully' })
  async updateAssemblyWorkOrder(
    @Param('workOrderId') workOrderId: string,
    @Body() updateWorkOrderDto: UpdateAssemblyWorkOrderDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const workOrder = await this.kittingAssemblyService.updateAssemblyWorkOrder(tenantId, workOrderId, {
      ...updateWorkOrderDto,
      userId: user.id,
    });
    
    return {
      success: true,
      data: workOrder,
      message: 'Work order updated successfully',
    };
  }

  @Get('work-orders/:workOrderId')
  @RequirePermission('warehouse:assembly:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get assembly work order details' })
  @ApiParam({ name: 'workOrderId', description: 'Work order ID' })
  @ApiResponse({ status: 200, description: 'Work order details retrieved successfully' })
  async getAssemblyWorkOrder(
    @Param('workOrderId') workOrderId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const workOrder = await this.kittingAssemblyService.getAssemblyWorkOrder(tenantId, workOrderId);
    
    return {
      success: true,
      data: workOrder,
    };
  }

  @Get('work-orders')
  @RequirePermission('warehouse:assembly:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get assembly work orders' })
  @ApiQuery({ name: 'warehouseId', required: false, description: 'Filter by warehouse' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'assignedTo', required: false, description: 'Filter by assigned user' })
  @ApiQuery({ name: 'kitId', required: false, description: 'Filter by kit' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter by priority' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Filter to date' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Work orders retrieved successfully' })
  async getAssemblyWorkOrders(
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('kitId') kitId?: string,
    @Query('priority') priority?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const options: {
      warehouseId?: string;
      status?: string;
      assignedTo?: string;
      kitId?: string;
      priority?: string;
      dateFrom?: Date;
      dateTo?: Date;
      page: number;
      limit: number;
    } = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    if (warehouseId) options.warehouseId = warehouseId;
    if (status) options.status = status;
    if (assignedTo) options.assignedTo = assignedTo;
    if (kitId) options.kitId = kitId;
    if (priority) options.priority = priority;
    if (dateFrom) options.dateFrom = new Date(dateFrom);
    if (dateTo) options.dateTo = new Date(dateTo);

    const result = await this.kittingAssemblyService.getAssemblyWorkOrders(tenantId, options);
    
    return {
      success: true,
      data: result,
    };
  }

  // Component Management Endpoints

  @Post('work-orders/:workOrderId/allocate-components')
  @RequirePermission('warehouse:assembly:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Allocate components for assembly work order' })
  @ApiParam({ name: 'workOrderId', description: 'Work order ID' })
  @ApiResponse({ status: 200, description: 'Components allocated successfully' })
  async allocateComponents(
    @Param('workOrderId') workOrderId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.kittingAssemblyService.allocateComponents(tenantId, workOrderId);
    
    return {
      success: true,
      data: result,
      message: result.success ? 'Components allocated successfully' : 'Component allocation completed with shortages',
    };
  }

  @Post('work-orders/:workOrderId/consume-components')
  @RequirePermission('warehouse:assembly:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consume components during assembly' })
  @ApiParam({ name: 'workOrderId', description: 'Work order ID' })
  @ApiResponse({ status: 200, description: 'Components consumed successfully' })
  async consumeComponents(
    @Param('workOrderId') workOrderId: string,
    @Body() consumptionData: Array<{
      componentId: string;
      quantityConsumed: number;
      lotNumbers?: string[];
      notes?: string;
    }>,
    @CurrentTenant() tenantId: string,
  ) {
    await this.kittingAssemblyService.consumeComponents(tenantId, workOrderId, consumptionData);
    
    return {
      success: true,
      message: 'Components consumed successfully',
    };
  }

  // Quality Control Endpoints

  @Post('work-orders/:workOrderId/quality-results')
  @RequirePermission('warehouse:assembly:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record quality control results' })
  @ApiParam({ name: 'workOrderId', description: 'Work order ID' })
  @ApiResponse({ status: 200, description: 'Quality results recorded successfully' })
  async recordQualityResults(
    @Param('workOrderId') workOrderId: string,
    @Body() qualityResults: Array<{
      checkId: string;
      checkName: string;
      result: 'pass' | 'fail' | 'na';
      notes?: string;
      measuredValue?: number;
      checkedBy: string;
      checkedAt: Date;
    }>,
    @CurrentTenant() tenantId: string,
  ) {
    await this.kittingAssemblyService.recordQualityResults(tenantId, workOrderId, qualityResults);
    
    return {
      success: true,
      message: 'Quality results recorded successfully',
    };
  }

  // Analytics and Reporting Endpoints

  @Get('warehouses/:warehouseId/metrics')
  @RequirePermission('warehouse:assembly:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get assembly metrics for warehouse' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID' })
  @ApiQuery({ name: 'dateFrom', required: true, description: 'Start date for metrics' })
  @ApiQuery({ name: 'dateTo', required: true, description: 'End date for metrics' })
  @ApiResponse({ status: 200, description: 'Assembly metrics retrieved successfully' })
  async getAssemblyMetrics(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @CurrentTenant() tenantId: string,
  ) {
    const dateRange = {
      from: new Date(dateFrom),
      to: new Date(dateTo),
    };

    const metrics = await this.kittingAssemblyService.getAssemblyMetrics(tenantId, warehouseId, dateRange);
    
    return {
      success: true,
      data: metrics,
    };
  }

  // Bulk Operations

  @Post('kits/bulk-create')
  @RequirePermission('warehouse:kitting:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create multiple kits in bulk' })
  @ApiResponse({ status: 201, description: 'Bulk kits created successfully' })
  async createBulkKits(
    @Body() bulkData: {
      kits: CreateKitDto[];
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const results = [];
    const errors = [];

    for (const [index, kitData] of bulkData.kits.entries()) {
      try {
        const kit = await this.kittingAssemblyService.createKit(tenantId, {
          ...kitData,
          tenantId,
          userId: user.id,
        });
        
        results.push({
          index,
          success: true,
          kit,
        });
      } catch (error: unknown) {
        errors.push({
          index,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          kitData,
        });
      }
    }
    
    return {
      success: true,
      data: {
        results,
        errors,
        summary: {
          total: bulkData.kits.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    };
  }

  @Post('work-orders/bulk-create')
  @RequirePermission('warehouse:assembly:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create multiple work orders in bulk' })
  @ApiResponse({ status: 201, description: 'Bulk work orders created successfully' })
  async createBulkWorkOrders(
    @Body() bulkData: {
      workOrders: CreateAssemblyWorkOrderDto[];
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const results = [];
    const errors = [];

    for (const [index, workOrderData] of bulkData.workOrders.entries()) {
      try {
        const workOrder = await this.kittingAssemblyService.createAssemblyWorkOrder(tenantId, {
          ...workOrderData,
          tenantId,
          userId: user.id,
        });
        
        results.push({
          index,
          success: true,
          workOrder,
        });
      } catch (error: unknown) {
        errors.push({
          index,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          workOrderData,
        });
      }
    }
    
    return {
      success: true,
      data: {
        results,
        errors,
        summary: {
          total: bulkData.workOrders.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    };
  }

  // Kit Templates and Cloning

  @Post('kits/:kitId/clone')
  @RequirePermission('warehouse:kitting:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone an existing kit' })
  @ApiParam({ name: 'kitId', description: 'Kit ID to clone' })
  @ApiResponse({ status: 201, description: 'Kit cloned successfully' })
  async cloneKit(
    @Param('kitId') kitId: string,
    @Body() cloneData: {
      newKitSku: string;
      newKitName: string;
      description?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const originalKit = await this.kittingAssemblyService.getKit(tenantId, kitId);
    if (!originalKit) {
      return {
        success: false,
        message: 'Original kit not found',
      };
    }

    const clonedKit = await this.kittingAssemblyService.createKit(tenantId, {
      tenantId,
      kitSku: cloneData.newKitSku,
      kitName: cloneData.newKitName,
      description: cloneData.description || `Cloned from ${originalKit.kitName}`,
      kitType: originalKit.kitType,
      components: originalKit.components.map(comp => ({
        productId: comp.productId,
        quantity: comp.quantity,
        unitOfMeasure: comp.unitOfMeasure,
        ...(comp.isOptional !== undefined && { isOptional: comp.isOptional }),
        ...(comp.isSubstitutable !== undefined && { isSubstitutable: comp.isSubstitutable }),
        ...(comp.substitutes && { substitutes: comp.substitutes }),
        ...(comp.position !== undefined && { position: comp.position }),
        ...(comp.notes && { notes: comp.notes }),
      })),
      ...(originalKit.assemblyInstructions && { assemblyInstructions: originalKit.assemblyInstructions }),
      ...(originalKit.assemblyTime !== undefined && { assemblyTime: originalKit.assemblyTime }),
      skillLevel: originalKit.skillLevel,
      ...(originalKit.qualityChecks && {
        qualityChecks: originalKit.qualityChecks.map(check => ({
          checkName: check.checkName,
          checkType: check.checkType,
          description: check.description,
          isRequired: check.isRequired,
          acceptanceCriteria: check.acceptanceCriteria,
          ...(check.tools && { tools: check.tools }),
        }))
      }),
      ...(originalKit.packaging && { packaging: originalKit.packaging }),
      ...(originalKit.costCalculation && { costCalculation: originalKit.costCalculation }),
      ...(originalKit.markup !== undefined && { markup: originalKit.markup }),
      ...(originalKit.fixedPrice !== undefined && { fixedPrice: originalKit.fixedPrice }),
      userId: user.id,
    });
    
    return {
      success: true,
      data: clonedKit,
      message: 'Kit cloned successfully',
    };
  }

  // Work Station Management

  @Get('work-stations')
  @RequirePermission('warehouse:assembly:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get available work stations' })
  @ApiQuery({ name: 'warehouseId', required: false, description: 'Filter by warehouse' })
  @ApiResponse({ status: 200, description: 'Work stations retrieved successfully' })
  async getWorkStations(
    @CurrentTenant() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    // This would typically come from a work station management service
    // For now, returning mock data
    const workStations = [
      {
        workStationId: 'WS-001',
        name: 'Assembly Station 1',
        warehouseId: warehouseId || 'warehouse-1',
        capabilities: ['simple_assembly', 'quality_check'],
        isActive: true,
        currentWorkOrder: null,
      },
      {
        workStationId: 'WS-002',
        name: 'Assembly Station 2',
        warehouseId: warehouseId || 'warehouse-1',
        capabilities: ['complex_assembly', 'packaging'],
        isActive: true,
        currentWorkOrder: 'WO-123',
      },
    ];
    
    return {
      success: true,
      data: { workStations },
    };
  }

  // Component Substitution

  @Post('work-orders/:workOrderId/substitute-component')
  @RequirePermission('warehouse:assembly:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Substitute a component in work order' })
  @ApiParam({ name: 'workOrderId', description: 'Work order ID' })
  @ApiResponse({ status: 200, description: 'Component substituted successfully' })
  async substituteComponent(
    @Param('workOrderId') workOrderId: string,
    @Body() substitutionData: {
      componentId: string;
      substituteProductId: string;
      reason: string;
      notes?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    // This would handle component substitution logic
    // For now, returning success response
    return {
      success: true,
      data: {
        workOrderId,
        componentId: substitutionData.componentId,
        originalProductId: 'original-product-id',
        substituteProductId: substitutionData.substituteProductId,
        reason: substitutionData.reason,
        substitutedBy: user.id,
        substitutedAt: new Date(),
      },
      message: 'Component substituted successfully',
    };
  }
}