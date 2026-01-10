import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { B2BOrderService } from '../services/b2b-order.service';
import { B2BPricingService } from '../services/b2b-pricing.service';
import { B2BWorkflowService } from '../services/b2b-workflow.service';
import { 
  CreateB2BOrderDto, 
  UpdateB2BOrderDto, 
  B2BOrderQueryDto,
  ApproveOrderDto,
  RejectOrderDto
} from '../dto/b2b-order.dto';

@ApiTags('B2B Orders')
@ApiBearerAuth()
@Controller('b2b-orders')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('b2b-operations')
export class B2BOrderController {
  private readonly logger = new Logger(B2BOrderController.name);

  constructor(
    private readonly b2bOrderService: B2BOrderService,
    private readonly pricingService: B2BPricingService,
    private readonly workflowService: B2BWorkflowService,
  ) {}

  @Post()
  @RequirePermission('b2b_order:create')
  @ApiOperation({ summary: 'Create a new B2B order' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'B2B order created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async createB2BOrder(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) createDto: CreateB2BOrderDto,
  ) {
    try {
      const order = await this.b2bOrderService.createB2BOrder(
        tenantId,
        createDto,
        userId,
      );

      this.logger.log(`Created B2B order ${order.orderNumber} for tenant ${tenantId}`);
      
      return {
        success: true,
        data: order,
        message: 'B2B order created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create B2B order for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Get(':id')
  @RequirePermission('b2b_order:read')
  @ApiOperation({ summary: 'Get B2B order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B order retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'B2B order not found',
  })
  async getB2BOrder(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) orderId: string,
  ) {
    try {
      const order = await this.b2bOrderService.findB2BOrderById(
        tenantId,
        orderId,
      );

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error(`Failed to get B2B order ${orderId}:`, error);
      throw error;
    }
  }

  @Get()
  @RequirePermission('b2b_order:read')
  @ApiOperation({ summary: 'Get B2B orders with filtering and pagination' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'status', required: false, description: 'Order status filter' })
  @ApiQuery({ name: 'customerId', required: false, description: 'Customer ID filter' })
  @ApiQuery({ name: 'salesRepId', required: false, description: 'Sales rep ID filter' })
  @ApiQuery({ name: 'accountManagerId', required: false, description: 'Account manager ID filter' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date filter' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date filter' })
  @ApiQuery({ name: 'minAmount', required: false, description: 'Minimum order amount' })
  @ApiQuery({ name: 'maxAmount', required: false, description: 'Maximum order amount' })
  @ApiQuery({ name: 'requiresApproval', required: false, description: 'Requires approval filter' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc/desc)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B orders retrieved successfully',
  })
  async getB2BOrders(
    @CurrentTenant() tenantId: string,
    @Query(ValidationPipe) query: B2BOrderQueryDto,
  ) {
    try {
      const result = await this.b2bOrderService.findB2BOrders(tenantId, query);

      return {
        success: true,
        data: result.orders,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (query.limit || 20)),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get B2B orders for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Put(':id')
  @RequirePermission('b2b_order:update')
  @ApiOperation({ summary: 'Update B2B order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B order updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'B2B order not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or order cannot be updated',
  })
  async updateB2BOrder(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body(ValidationPipe) updateDto: UpdateB2BOrderDto,
  ) {
    try {
      const order = await this.b2bOrderService.updateB2BOrder(
        tenantId,
        orderId,
        updateDto,
        userId,
      );

      this.logger.log(`Updated B2B order ${orderId} for tenant ${tenantId}`);

      return {
        success: true,
        data: order,
        message: 'B2B order updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update B2B order ${orderId}:`, error);
      throw error;
    }
  }

  @Post(':id/approve')
  @RequirePermission('b2b_order:approve')
  @ApiOperation({ summary: 'Approve B2B order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B order approved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'B2B order not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Order is not pending approval',
  })
  async approveOrder(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body(ValidationPipe) approveDto: ApproveOrderDto,
  ) {
    try {
      const order = await this.b2bOrderService.approveOrder(
        tenantId,
        orderId,
        approveDto.approvalNotes,
        userId,
      );

      this.logger.log(`Approved B2B order ${orderId} by user ${userId}`);

      return {
        success: true,
        data: order,
        message: 'B2B order approved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to approve B2B order ${orderId}:`, error);
      throw error;
    }
  }

  @Post(':id/reject')
  @RequirePermission('b2b_order:approve')
  @ApiOperation({ summary: 'Reject B2B order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B order rejected successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'B2B order not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Order is not pending approval',
  })
  async rejectOrder(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body(ValidationPipe) rejectDto: RejectOrderDto,
  ) {
    try {
      const order = await this.b2bOrderService.rejectOrder(
        tenantId,
        orderId,
        rejectDto.rejectionReason,
        userId,
      );

      this.logger.log(`Rejected B2B order ${orderId} by user ${userId}`);

      return {
        success: true,
        data: order,
        message: 'B2B order rejected successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to reject B2B order ${orderId}:`, error);
      throw error;
    }
  }

  @Get(':id/pricing')
  @RequirePermission('b2b_order:read')
  @ApiOperation({ summary: 'Get pricing details for order items' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order pricing details retrieved successfully',
  })
  async getOrderPricing(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) orderId: string,
  ) {
    try {
      const order = await this.b2bOrderService.findB2BOrderById(tenantId, orderId);
      
      const pricingDetails = await Promise.all(
        order.items.map(async (item) => {
          const pricing = await this.pricingService.getCustomerPricing(
            tenantId,
            order.customerId,
            item.productId,
            item.quantity
          );
          return {
            ...item,
            pricingDetails: pricing,
          };
        })
      );

      return {
        success: true,
        data: {
          orderId: order.id,
          customerId: order.customerId,
          items: pricingDetails,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get order pricing for ${orderId}:`, error);
      throw error;
    }
  }

  @Get(':id/workflow')
  @RequirePermission('b2b_order:read')
  @ApiOperation({ summary: 'Get approval workflow status for order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workflow status retrieved successfully',
  })
  async getOrderWorkflow(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) orderId: string,
  ) {
    try {
      // In a real implementation, we would look up the workflow by order ID
      // For now, return a placeholder response
      return {
        success: true,
        data: {
          orderId,
          workflowStatus: 'No active workflow',
          message: 'Workflow tracking feature coming soon',
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get workflow for order ${orderId}:`, error);
      throw error;
    }
  }

  @Get('analytics/summary')
  @RequirePermission('b2b_order:read')
  @ApiOperation({ summary: 'Get B2B order analytics summary' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B order analytics retrieved successfully',
  })
  async getOrderAnalyticsSummary(@CurrentTenant() tenantId: string) {
    try {
      // This would be implemented with actual analytics
      // For now, return a placeholder response
      return {
        success: true,
        data: {
          totalOrders: 0,
          totalValue: 0,
          averageOrderValue: 0,
          pendingApprovals: 0,
          statusDistribution: {},
          monthlyTrends: [],
        },
        message: 'B2B order analytics feature coming soon',
      };
    } catch (error) {
      this.logger.error(`Failed to get B2B order analytics for tenant ${tenantId}:`, error);
      throw error;
    }
  }
}