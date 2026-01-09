import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { 
  AccountsReceivablePayableService, 
  ARAPInvoice, 
  ARAPPayment, 
  CreateInvoiceInput, 
  CreatePaymentInput,
  AgingReport
} from '../services/accounts-receivable-payable.service';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/financial/ar-ap')
@UseGuards(AuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('accounts-receivable-payable')
@ApiTags('Accounts Receivable/Payable')
export class AccountsReceivablePayableController {
  constructor(private readonly arApService: AccountsReceivablePayableService) {}

  // Invoice Management
  @Post('invoices')
  @RequirePermission('ar-ap:create-invoice')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new AR/AP invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  async createInvoice(
    @Body() input: CreateInvoiceInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ARAPInvoice> {
    return this.arApService.createInvoice(tenantId, input, user.id);
  }

  @Get('invoices')
  @RequirePermission('ar-ap:read-invoices')
  @ApiOperation({ summary: 'Get AR/AP invoices' })
  @ApiQuery({ name: 'invoiceType', required: false, enum: ['receivable', 'payable'] })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'supplierId', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
  async getInvoices(
    @CurrentTenant() tenantId: string,
    @Query('invoiceType') invoiceType?: 'receivable' | 'payable',
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<ARAPInvoice[]> {
    return this.arApService.getInvoices(
      tenantId,
      invoiceType,
      status,
      customerId,
      supplierId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );
  }

  @Get('invoices/:id')
  @RequirePermission('ar-ap:read-invoices')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved successfully' })
  async getInvoiceById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ARAPInvoice | null> {
    return this.arApService.getInvoiceById(tenantId, id);
  }

  // Payment Management
  @Post('payments')
  @RequirePermission('ar-ap:create-payment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new AR/AP payment' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  async createPayment(
    @Body() input: CreatePaymentInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ARAPPayment> {
    return this.arApService.createPayment(tenantId, input, user.id);
  }

  @Get('payments')
  @RequirePermission('ar-ap:read-payments')
  @ApiOperation({ summary: 'Get AR/AP payments' })
  @ApiQuery({ name: 'paymentType', required: false, enum: ['received', 'made'] })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'supplierId', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async getPayments(
    @CurrentTenant() tenantId: string,
    @Query('paymentType') paymentType?: 'received' | 'made',
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<ARAPPayment[]> {
    return this.arApService.getPayments(
      tenantId,
      paymentType,
      status,
      customerId,
      supplierId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );
  }

  // Aging Reports
  @Get('aging/:reportType')
  @RequirePermission('ar-ap:read-reports')
  @ApiOperation({ summary: 'Generate aging report' })
  @ApiParam({ name: 'reportType', enum: ['receivable', 'payable'] })
  @ApiQuery({ name: 'asOfDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Aging report generated successfully' })
  async generateAgingReport(
    @Param('reportType') reportType: 'receivable' | 'payable',
    @CurrentTenant() tenantId: string,
    @Query('asOfDate') asOfDate?: string,
  ): Promise<AgingReport[]> {
    return this.arApService.generateAgingReport(
      tenantId,
      reportType,
      asOfDate ? new Date(asOfDate) : new Date()
    );
  }

  // Receivables specific endpoints
  @Get('receivables/summary')
  @RequirePermission('ar-ap:read-receivables')
  @ApiOperation({ summary: 'Get accounts receivable summary' })
  @ApiResponse({ status: 200, description: 'AR summary retrieved successfully' })
  async getReceivablesSummary(
    @CurrentTenant() tenantId: string,
  ) {
    const invoices = await this.arApService.getInvoices(tenantId, 'receivable', 'open');
    
    const summary = {
      totalOutstanding: invoices.reduce((sum, inv) => sum + Number(inv.balanceAmount), 0),
      totalOverdue: invoices
        .filter(inv => new Date(inv.dueDate) < new Date())
        .reduce((sum, inv) => sum + Number(inv.balanceAmount), 0),
      invoiceCount: invoices.length,
      overdueCount: invoices.filter(inv => new Date(inv.dueDate) < new Date()).length,
    };

    return summary;
  }

  // Payables specific endpoints
  @Get('payables/summary')
  @RequirePermission('ar-ap:read-payables')
  @ApiOperation({ summary: 'Get accounts payable summary' })
  @ApiResponse({ status: 200, description: 'AP summary retrieved successfully' })
  async getPayablesSummary(
    @CurrentTenant() tenantId: string,
  ) {
    const invoices = await this.arApService.getInvoices(tenantId, 'payable', 'open');
    
    const summary = {
      totalOutstanding: invoices.reduce((sum, inv) => sum + Number(inv.balanceAmount), 0),
      totalOverdue: invoices
        .filter(inv => new Date(inv.dueDate) < new Date())
        .reduce((sum, inv) => sum + Number(inv.balanceAmount), 0),
      invoiceCount: invoices.length,
      overdueCount: invoices.filter(inv => new Date(inv.dueDate) < new Date()).length,
    };

    return summary;
  }
}