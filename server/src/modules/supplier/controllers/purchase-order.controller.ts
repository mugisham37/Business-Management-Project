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
import { PurchaseOrderService } from '../services/purchase-order.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  PurchaseOrderQueryDto,
  PurchaseOrderResponseDto,
  CreateApprovalDto,
  ApprovalResponseDto,
  CreateReceiptDto,
  CreateInvoiceDto,
} from '../dto/purchase-order.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/purchase-orders')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('purchase-order-management')
@ApiBearerAuth()
@ApiTags('Purchase Orders')
export class PurchaseOrderController {
  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  @Post()
  @RequirePermission('purchase-orders:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new purchase order' })
  @ApiResponse({ status: 201, description: 'Purchase order created successfully', type: PurchaseOrderResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createPurchaseOrder(
    @Body() createPurchaseOrderDto: CreatePurchaseOrderDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.purchaseOrderService.createPurchaseOrder(tenantId, createPurchaseOrderDto, user.id);
  }

  @Get()
  @RequirePermission('purchase-orders:read')
  @ApiOperation({ summary: 'Get purchase orders with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Purchase orders retrieved successfully' })
  async getPurchaseOrders(
    @Query() query: PurchaseOrderQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.purchaseOrderService.getPurchaseOrders(tenantId, query);
  }

  @Get('stats')
  @RequirePermission('purchase-orders:read')
  @ApiOperation({ summary: 'Get purchase order statistics' })
  @ApiQuery({ name: 'startDate', description: 'Start date', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date', required: false })
  @ApiResponse({ status: 200, description: 'Purchase order statistics retrieved successfully' })
  async getPurchaseOrderStats(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return await this.purchaseOrderService.getPurchaseOrderStats(tenantId, start, end);
  }

  @Get('po-number/:poNumber')
  @RequirePermission('purchase-orders:read')
  @ApiOperation({ summary: 'Get purchase order by PO number' })
  @ApiParam({ name: 'poNumber', description: 'Purchase order number' })
  @ApiResponse({ status: 200, description: 'Purchase order retrieved successfully', type: PurchaseOrderResponseDto })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async getPurchaseOrderByPoNumber(
    @Param('poNumber') poNumber: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.purchaseOrderService.getPurchaseOrderByPoNumber(tenantId, poNumber);
  }

  @Get(':id')
  @RequirePermission('purchase-orders:read')
  @ApiOperation({ summary: 'Get purchase order by ID' })
  @ApiParam({ name: 'id', description: 'Purchase order ID' })
  @ApiQuery({ name: 'include', description: 'Include relations', required: false })
  @ApiResponse({ status: 200, description: 'Purchase order retrieved successfully', type: PurchaseOrderResponseDto })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async getPurchaseOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Query('include') include?: string,
  ) {
    const includeRelations = include === 'relations';
    
    if (includeRelations) {
      return await this.purchaseOrderService.getPurchaseOrderWithRelations(tenantId, id);
    }
    
    return await this.purchaseOrderService.getPurchaseOrder(tenantId, id);
  }

  @Put(':id')
  @RequirePermission('purchase-orders:update')
  @ApiOperation({ summary: 'Update purchase order' })
  @ApiParam({ name: 'id', description: 'Purchase order ID' })
  @ApiResponse({ status: 200, description: 'Purchase order updated successfully', type: PurchaseOrderResponseDto })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async updatePurchaseOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.purchaseOrderService.updatePurchaseOrder(tenantId, id, updatePurchaseOrderDto, user.id);
  }

  @Delete(':id')
  @RequirePermission('purchase-orders:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete purchase order' })
  @ApiParam({ name: 'id', description: 'Purchase order ID' })
  @ApiResponse({ status: 204, description: 'Purchase order deleted successfully' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async deletePurchaseOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.purchaseOrderService.deletePurchaseOrder(tenantId, id, user.id);
  }

  // Approval Workflow
  @Post(':id/submit-for-approval')
  @RequirePermission('purchase-orders:submit-approval')
  @ApiOperation({ summary: 'Submit purchase order for approval' })
  @ApiParam({ name: 'id', description: 'Purchase order ID' })
  @ApiResponse({ status: 200, description: 'Purchase order submitted for approval successfully' })
  async submitForApproval(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.purchaseOrderService.submitForApproval(tenantId, id, user.id);
  }

  @Post('approvals')
  @RequirePermission('purchase-orders:create-approval')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create purchase order approval' })
  @ApiResponse({ status: 201, description: 'Approval created successfully' })
  async createApproval(
    @Body() createApprovalDto: CreateApprovalDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.purchaseOrderService.createApproval(tenantId, createApprovalDto, user.id);
  }

  @Put('approvals/:approvalId')
  @RequirePermission('purchase-orders:approve')
  @ApiOperation({ summary: 'Respond to purchase order approval' })
  @ApiParam({ name: 'approvalId', description: 'Approval ID' })
  @ApiResponse({ status: 200, description: 'Approval response recorded successfully' })
  async respondToApproval(
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() response: ApprovalResponseDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.purchaseOrderService.respondToApproval(tenantId, approvalId, response, user.id);
  }

  @Get('approvals/pending')
  @RequirePermission('purchase-orders:read')
  @ApiOperation({ summary: 'Get pending approvals' })
  @ApiQuery({ name: 'approverId', description: 'Filter by approver ID', required: false })
  @ApiResponse({ status: 200, description: 'Pending approvals retrieved successfully' })
  async getPendingApprovals(
    @CurrentTenant() tenantId: string,
    @Query('approverId') approverId?: string,
  ) {
    return await this.purchaseOrderService.getPendingApprovals(tenantId, approverId);
  }

  // Receipt Management
  @Post('receipts')
  @RequirePermission('purchase-orders:receive')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create purchase order receipt' })
  @ApiResponse({ status: 201, description: 'Receipt created successfully' })
  async createReceipt(
    @Body() createReceiptDto: CreateReceiptDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.purchaseOrderService.createReceipt(tenantId, createReceiptDto, user.id);
  }

  // Invoice Management
  @Post('invoices')
  @RequirePermission('purchase-orders:invoice')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create purchase order invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  async createInvoice(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.purchaseOrderService.createInvoice(tenantId, createInvoiceDto, user.id);
  }

  // Supplier Analytics
  @Get('suppliers/:supplierId/stats')
  @RequirePermission('purchase-orders:read')
  @ApiOperation({ summary: 'Get supplier purchase statistics' })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiQuery({ name: 'startDate', description: 'Start date', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date', required: false })
  @ApiResponse({ status: 200, description: 'Supplier purchase statistics retrieved successfully' })
  async getSupplierPurchaseStats(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return await this.purchaseOrderService.getSupplierPurchaseStats(tenantId, supplierId, start, end);
  }

  // Workflow Automation
  @Post('automation/auto-approve-small-orders')
  @RequirePermission('purchase-orders:admin')
  @ApiOperation({ summary: 'Auto-approve small orders below threshold' })
  @ApiQuery({ name: 'threshold', description: 'Approval threshold amount', required: false })
  @ApiResponse({ status: 200, description: 'Auto-approval process completed' })
  async autoApproveSmallOrders(
    @CurrentTenant() tenantId: string,
    @Query('threshold') threshold?: number,
  ) {
    await this.purchaseOrderService.autoApproveSmallOrders(tenantId, threshold);
    return { message: 'Auto-approval process completed' };
  }

  @Post('automation/send-overdue-reminders')
  @RequirePermission('purchase-orders:admin')
  @ApiOperation({ summary: 'Send reminders for overdue deliveries' })
  @ApiResponse({ status: 200, description: 'Overdue reminders sent' })
  async sendOverdueReminders(@CurrentTenant() tenantId: string) {
    await this.purchaseOrderService.sendOverdueReminders(tenantId);
    return { message: 'Overdue reminders sent' };
  }
}