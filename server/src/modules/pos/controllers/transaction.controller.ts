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
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { TransactionService } from '../services/transaction.service';
import { OfflineSyncService } from '../services/offline-sync.service';
import { UpdateTransactionDto, TransactionResponseDto } from '../dto/transaction.dto';

@Controller('api/v1/transactions')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiTags('Transactions')
export class TransactionController {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly offlineSyncService: OfflineSyncService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Transaction retrieved successfully',
    type: TransactionResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const transaction = await this.transactionService.findById(tenantId, id);
    return this.mapToResponseDto(transaction);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update transaction',
    description: 'Updates transaction metadata, status, or notes'
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Transaction updated successfully',
    type: TransactionResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 400, description: 'Invalid update data or status transition' })
  async updateTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateTransactionDto: UpdateTransactionDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ) {
    const updatedTransaction = await this.transactionService.updateTransaction(
      tenantId,
      id,
      updateTransactionDto,
      user.id
    );

    // Get full transaction with items for response
    const fullTransaction = await this.transactionService.findById(tenantId, id);
    return this.mapToResponseDto(fullTransaction);
  }

  @Get()
  @ApiOperation({ 
    summary: 'List transactions',
    description: 'Retrieves paginated list of transactions with optional filtering'
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of transactions to return (max 100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of transactions to skip' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by transaction status' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date (ISO string)' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  async listTransactions(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Create options object without undefined properties
    const options: any = {
      limit: limit ? Math.min(limit, 100) : 20,
      offset: offset || 0,
    };

    // Only add optional properties if they are defined
    if (locationId) {
      options.locationId = locationId;
    }
    if (status) {
      options.status = status;
    }
    if (startDate) {
      options.startDate = new Date(startDate);
    }
    if (endDate) {
      options.endDate = new Date(endDate);
    }

    const { transactions, total } = await this.transactionService.findTransactionsByTenant(
      tenantId,
      options
    );

    return {
      transactions: transactions.map(transaction => ({
        id: transaction.id,
        transactionNumber: transaction.transactionNumber,
        tenantId: transaction.tenantId,
        customerId: transaction.customerId,
        locationId: transaction.locationId,
        subtotal: transaction.subtotal,
        taxAmount: transaction.taxAmount,
        discountAmount: transaction.discountAmount,
        tipAmount: transaction.tipAmount,
        total: transaction.total,
        status: transaction.status,
        itemCount: transaction.itemCount,
        paymentMethod: transaction.paymentMethod,
        notes: transaction.notes,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        // Items not included in list view for performance
      })),
      total,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        hasMore: options.offset + transactions.length < total,
      },
    };
  }

  @Get('summary/stats')
  @ApiOperation({ 
    summary: 'Get transaction statistics',
    description: 'Retrieves transaction statistics and summary data'
  })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date (ISO string)' })
  @ApiResponse({ status: 200, description: 'Transaction statistics retrieved successfully' })
  async getTransactionStats(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.transactionService.getTransactionSummary(
      tenantId,
      locationId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  @Post('sync/offline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Sync offline transactions',
    description: 'Synchronizes pending offline transactions with the server'
  })
  @ApiQuery({ name: 'deviceId', required: false, description: 'Sync only transactions from specific device' })
  @ApiResponse({ status: 200, description: 'Offline sync completed' })
  async syncOfflineTransactions(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.offlineSyncService.syncPendingOperations(tenantId, deviceId, user.id);
  }

  @Post('queue/offline')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Queue offline operation',
    description: 'Queues a transaction operation for later synchronization when offline'
  })
  @ApiResponse({ status: 201, description: 'Operation queued successfully' })
  async queueOfflineOperation(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() operationData: {
      type: 'create_transaction' | 'update_transaction' | 'void_transaction' | 'refund_transaction';
      data: any;
      deviceId: string;
      priority?: number;
    },
  ) {
    const operation = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: operationData.type,
      data: operationData.data,
      timestamp: new Date(),
      deviceId: operationData.deviceId,
      priority: operationData.priority || 1,
    };

    await this.offlineSyncService.queueOfflineOperation(tenantId, operation, user.id);

    return {
      success: true,
      operationId: operation.id,
      queuedAt: operation.timestamp,
    };
  }

  private mapToResponseDto(transaction: any): TransactionResponseDto {
    return {
      id: transaction.id,
      transactionNumber: transaction.transactionNumber,
      tenantId: transaction.tenantId,
      customerId: transaction.customerId,
      locationId: transaction.locationId,
      subtotal: transaction.subtotal,
      taxAmount: transaction.taxAmount,
      discountAmount: transaction.discountAmount,
      tipAmount: transaction.tipAmount,
      total: transaction.total,
      status: transaction.status as any,
      itemCount: transaction.itemCount,
      paymentMethod: transaction.paymentMethod as any,
      notes: transaction.notes,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      items: transaction.items?.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        discountAmount: item.discountAmount,
        taxAmount: item.taxAmount,
        variantInfo: item.variantInfo,
      })) || [],
    };
  }
}