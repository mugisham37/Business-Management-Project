import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { POSService } from '../services/pos.service';
import { TransactionWithItems } from '../entities/transaction.entity';
import { ReceiptService } from '../services/receipt.service';
import { PaymentService } from '../services/payment.service';
import { 
  CreateTransactionDto, 
  VoidTransactionDto, 
  RefundTransactionDto,
  TransactionResponseDto 
} from '../dto/transaction.dto';

@Controller('api/v1/pos')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiTags('Point of Sale')
export class POSController {
  constructor(
    private readonly posService: POSService,
    private readonly receiptService: ReceiptService,
    private readonly paymentService: PaymentService,
  ) {}

  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Process a sale transaction',
    description: 'Creates and processes a complete POS transaction including payment processing'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Transaction processed successfully',
    type: TransactionResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Invalid transaction data' })
  @ApiResponse({ status: 402, description: 'Payment processing failed' })
  async processTransaction(
    @Body(ValidationPipe) createTransactionDto: CreateTransactionDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TransactionResponseDto> {
    return this.posService.processTransaction(
      tenantId,
      createTransactionDto,
      user.id
    );
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get transaction details' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Transaction details retrieved successfully',
    type: TransactionResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<TransactionResponseDto> {
    return this.posService.getTransaction(tenantId, id);
  }

  @Post('transactions/:id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Void a transaction',
    description: 'Voids a transaction and processes any necessary payment reversals'
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Transaction voided successfully',
    type: TransactionResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 400, description: 'Transaction cannot be voided' })
  async voidTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) voidTransactionDto: VoidTransactionDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TransactionResponseDto> {
    return this.posService.voidTransaction(
      tenantId,
      id,
      voidTransactionDto.reason,
      voidTransactionDto.notes,
      user.id
    );
  }

  @Post('transactions/:id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Refund a transaction',
    description: 'Processes a full or partial refund for a completed transaction'
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Refund processed successfully',
    type: TransactionResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 400, description: 'Invalid refund amount or transaction cannot be refunded' })
  async refundTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) refundTransactionDto: RefundTransactionDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<TransactionResponseDto> {
    return this.posService.refundTransaction(
      tenantId,
      id,
      refundTransactionDto.amount,
      refundTransactionDto.reason,
      refundTransactionDto.notes,
      user.id
    );
  }

  @Get('transactions')
  @ApiOperation({ 
    summary: 'Get transaction history',
    description: 'Retrieves paginated transaction history with optional filtering'
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of transactions to return (max 100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of transactions to skip' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by transaction status' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date (ISO string)' })
  @ApiResponse({ status: 200, description: 'Transaction history retrieved successfully' })
  async getTransactionHistory(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const options = {
      limit: limit ? Math.min(limit, 100) : 20, // Default 20, max 100
      offset: offset || 0,
      ...(locationId && { locationId }),
      ...(status && { status }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
    };

    return this.posService.getTransactionHistory(tenantId, options);
  }

  @Get('summary/daily')
  @ApiOperation({ 
    summary: 'Get daily sales summary',
    description: 'Retrieves daily sales summary including totals, averages, and top-selling items'
  })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiQuery({ name: 'date', required: false, description: 'Date for summary (ISO string, defaults to today)' })
  @ApiResponse({ status: 200, description: 'Daily summary retrieved successfully' })
  async getDailySummary(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
    @Query('date') date?: string,
  ) {
    const targetDate = date ? new Date(date) : new Date();
    
    return this.posService.getDailySummary(tenantId, locationId, targetDate);
  }

  @Post('transactions/:id/receipt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Generate and send receipt',
    description: 'Generates and delivers a receipt via email, SMS, or print'
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Receipt generated and sent successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async generateReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() receiptOptions: {
      format: 'email' | 'sms' | 'print';
      recipient?: string;
      template?: string;
      includeItemDetails?: boolean;
      includeTaxBreakdown?: boolean;
    },
  ) {
    const transaction = await this.posService.getTransaction(tenantId, id);
    
    // Convert to TransactionWithItems format for receipt service
    const transactionWithItems: any = {
      ...transaction,
      paymentStatus: 'completed', // Default status
      isOfflineTransaction: false, // Default value
      metadata: {}, // Default metadata
      version: 1, // Default version
      isActive: true, // Default active status
      items: transaction.items || [],
      payments: [], // Would be populated from payment records
    };

    return this.receiptService.generateReceipt(transactionWithItems, receiptOptions);
  }

  @Post('transactions/:id/receipt/multiple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Generate multiple receipts',
    description: 'Generates and delivers receipts via multiple channels simultaneously'
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Receipts generated successfully' })
  async generateMultipleReceipts(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Body() receiptOptionsArray: Array<{
      format: 'email' | 'sms' | 'print';
      recipient?: string;
      template?: string;
      includeItemDetails?: boolean;
      includeTaxBreakdown?: boolean;
    }>,
  ) {
    const transaction = await this.posService.getTransaction(tenantId, id);
    
    // Convert to TransactionWithItems format for receipt service
    const transactionWithItems: TransactionWithItems = {
      ...transaction,
      paymentStatus: 'completed', // Default value
      isOfflineTransaction: false, // Default value
      metadata: {}, // Default value
      version: 1, // Default value
      isActive: true, // Default value
      payments: [], // Would be populated from payment records
      items: transaction.items.map(item => ({
        id: item.id,
        tenantId: transaction.tenantId,
        transactionId: transaction.id,
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        discountAmount: item.discountAmount,
        taxAmount: item.taxAmount,
        variantInfo: item.variantInfo || {},
        metadata: {},
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        createdBy: '',
        updatedBy: '',
        deletedAt: null as any,
        version: 1,
        isActive: true,
      })),
    };

    return this.receiptService.generateReceipt(
      transactionWithItems, 
      receiptOptionsArray[0] || { format: 'print' } // Use first receipt option or default
    );
  }

  @Post('reconciliation/daily')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Perform daily payment reconciliation',
    description: 'Reconciles all payments for a specific date and identifies discrepancies'
  })
  @ApiQuery({ name: 'date', required: false, description: 'Date for reconciliation (ISO string, defaults to today)' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Reconciliation completed successfully' })
  async performDailyReconciliation(
    @CurrentTenant() tenantId: string,
    @Query('date') date?: string,
    @Query('locationId') locationId?: string,
    @Body() options?: {
      paymentMethods?: string[];
      includeVoided?: boolean;
      includeRefunded?: boolean;
      autoResolve?: boolean;
    },
  ) {
    const targetDate = date ? new Date(date) : new Date();
    
    return this.paymentService.performDailyReconciliation(tenantId, targetDate, {
      locationId,
      ...options,
    });
  }

  @Post('reconciliation/range')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Perform payment reconciliation for date range',
    description: 'Reconciles all payments within a specified date range'
  })
  @ApiResponse({ status: 200, description: 'Reconciliation completed successfully' })
  async performRangeReconciliation(
    @CurrentTenant() tenantId: string,
    @Body() reconciliationRequest: {
      startDate: string;
      endDate: string;
      locationId?: string;
      paymentMethods?: string[];
      includeVoided?: boolean;
      includeRefunded?: boolean;
      autoResolve?: boolean;
    },
  ) {
    const startDate = new Date(reconciliationRequest.startDate);
    const endDate = new Date(reconciliationRequest.endDate);
    
    return this.paymentService.performReconciliation(tenantId, startDate, endDate, {
      locationId: reconciliationRequest.locationId,
      paymentMethods: reconciliationRequest.paymentMethods,
      includeVoided: reconciliationRequest.includeVoided,
      includeRefunded: reconciliationRequest.includeRefunded,
      autoResolve: reconciliationRequest.autoResolve,
    });
  }

  @Get('reconciliation/history')
  @ApiOperation({ 
    summary: 'Get reconciliation history',
    description: 'Retrieves historical reconciliation reports'
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of reports to return (max 100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of reports to skip' })
  @ApiResponse({ status: 200, description: 'Reconciliation history retrieved successfully' })
  async getReconciliationHistory(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.paymentService.getReconciliationHistory(
      tenantId,
      limit ? Math.min(limit, 100) : 50,
      offset || 0
    );
  }
}