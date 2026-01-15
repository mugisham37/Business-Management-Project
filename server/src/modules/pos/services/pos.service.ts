import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionService } from './transaction.service';
import { PaymentService } from './payment.service';
import { TransactionValidationService } from './transaction-validation.service';
import { 
  CreateTransactionDto, 
  TransactionResponseDto, 
  TransactionStatus, 
  PaymentMethod,
  createWithoutUndefined 
} from '../dto/transaction.dto';
import { TransactionWithItems } from '../entities/transaction.entity';

@Injectable()
export class POSService {
  private readonly logger = new Logger(POSService.name);

  constructor(
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly validationService: TransactionValidationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async processTransaction(
    tenantId: string,
    transactionData: CreateTransactionDto,
    userId: string,
  ): Promise<TransactionResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Processing transaction for tenant ${tenantId}, user ${userId}`);

      // Step 1: Create transaction record
      const transaction = await this.transactionService.createTransaction(
        tenantId,
        transactionData,
        userId
      );

      // Step 2: Process payment with proper optional property handling
      const paymentRequest: any = {
        paymentMethod: transactionData.paymentMethod,
        amount: transaction.total,
      };

      // Only add optional properties if they are defined
      if (transactionData.paymentReference !== undefined) {
        paymentRequest.paymentReference = transactionData.paymentReference;
      }

      const paymentResult = await this.paymentService.processPayment(
        tenantId,
        transaction.id,
        paymentRequest,
        userId
      );

      // Step 3: Update transaction status based on payment result
      let finalTransaction: TransactionWithItems;
      if (paymentResult.success) {
        const updatedTransaction = await this.transactionService.updateTransaction(
          tenantId,
          transaction.id,
          { status: TransactionStatus.COMPLETED },
          userId
        );
        finalTransaction = {
          ...updatedTransaction,
          items: transaction.items,
          payments: transaction.payments,
        };
      } else {
        const failedTransaction = await this.transactionService.updateTransaction(
          tenantId,
          transaction.id,
          { status: TransactionStatus.FAILED },
          userId
        );
        finalTransaction = {
          ...failedTransaction,
          items: transaction.items,
          payments: transaction.payments,
        };
        
        throw new BadRequestException(`Payment failed: ${paymentResult.error}`);
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`Transaction processed successfully in ${processingTime}ms`);

      // Emit POS transaction completed event
      this.eventEmitter.emit('pos.transaction.completed', {
        tenantId,
        transaction: finalTransaction,
        paymentResult,
        processingTime,
        userId,
      });

      return this.mapToResponseDto(finalTransaction);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Transaction processing failed in ${processingTime}ms: ${errorMessage}`);

      // Emit POS transaction failed event
      this.eventEmitter.emit('pos.transaction.failed', {
        tenantId,
        transactionData,
        error: errorMessage,
        processingTime,
        userId,
      });

      throw error;
    }
  }

  async getTransaction(tenantId: string, transactionId: string): Promise<TransactionResponseDto> {
    const transaction = await this.transactionService.findById(tenantId, transactionId);
    return this.mapToResponseDto(transaction);
  }

  async voidTransaction(
    tenantId: string,
    transactionId: string,
    reason: string,
    notes: string | undefined,
    userId: string,
  ): Promise<TransactionResponseDto> {
    this.logger.log(`Voiding transaction ${transactionId} for tenant ${tenantId}`);

    const voidData: any = { reason };
    if (notes !== undefined) {
      voidData.notes = notes;
    }
    
    await this.transactionService.voidTransaction(
      tenantId,
      transactionId,
      voidData,
      userId
    );

    // Process void with payment provider if needed
    await this.paymentService.voidPayment(tenantId, transactionId, userId);

    // Emit POS void event
    this.eventEmitter.emit('pos.transaction.voided', {
      tenantId,
      transactionId,
      reason,
      notes,
      userId,
    });

    // Get updated transaction with items
    const fullTransaction = await this.transactionService.findById(tenantId, transactionId);
    return this.mapToResponseDto(fullTransaction);
  }

  async refundTransaction(
    tenantId: string,
    transactionId: string,
    amount: number,
    reason: string,
    notes: string | undefined,
    userId: string,
  ): Promise<TransactionResponseDto> {
    this.logger.log(`Refunding transaction ${transactionId} for tenant ${tenantId}, amount: ${amount}`);

    const refundData: any = { amount, reason };
    if (notes !== undefined) {
      refundData.notes = notes;
    }
    
    await this.transactionService.refundTransaction(
      tenantId,
      transactionId,
      refundData,
      userId
    );

    // Process refund with payment provider
    await this.paymentService.refundPayment(
      tenantId,
      transactionId,
      amount,
      userId
    );

    // Emit POS refund event
    this.eventEmitter.emit('pos.transaction.refunded', {
      tenantId,
      transactionId,
      amount,
      reason,
      notes,
      userId,
    });

    // Get updated transaction with items
    const fullTransaction = await this.transactionService.findById(tenantId, transactionId);
    return this.mapToResponseDto(fullTransaction);
  }

  async getTransactionHistory(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      locationId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<{
    transactions: TransactionResponseDto[];
    total: number;
    summary: any;
  }> {
    const { transactions, total } = await this.transactionService.findTransactionsByTenant(
      tenantId,
      options
    );

    const summary = await this.transactionService.getTransactionSummary(
      tenantId,
      options.locationId,
      options.startDate,
      options.endDate
    );

    return {
      transactions: transactions.map(transaction => {
        const responseDto: any = {
          id: transaction.id,
          transactionNumber: transaction.transactionNumber,
          tenantId: transaction.tenantId,
          locationId: transaction.locationId,
          subtotal: transaction.subtotal,
          taxAmount: transaction.taxAmount,
          discountAmount: transaction.discountAmount,
          tipAmount: transaction.tipAmount,
          total: transaction.total,
          status: transaction.status as TransactionStatus,
          itemCount: transaction.itemCount,
          paymentMethod: transaction.paymentMethod as PaymentMethod,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
          items: [], // Items not included in list view for performance
        };
        
        // Only add optional properties if they exist
        if (transaction.customerId) {
          responseDto.customerId = transaction.customerId;
        }
        if (transaction.notes) {
          responseDto.notes = transaction.notes;
        }
        
        return responseDto;
      }),
      total,
      summary,
    };
  }

  async getDailySummary(
    tenantId: string,
    locationId?: string,
    date?: Date,
  ): Promise<{
    date: Date;
    totalSales: number;
    totalTransactions: number;
    averageTransactionValue: number;
    cashSales: number;
    cardSales: number;
    voidedTransactions: number;
    refundedAmount: number;
    topSellingItems: Array<{
      productId: string;
      productName: string;
      quantitySold: number;
      revenue: number;
    }>;
  }> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

    const summary = await this.transactionService.getTransactionSummary(
      tenantId,
      locationId,
      startOfDay,
      endOfDay
    );

    // Get detailed transactions for additional analysis
    const { transactions } = await this.transactionService.findTransactionsByTenant(tenantId, {
      ...(locationId && { locationId }),
      startDate: startOfDay,
      endDate: endOfDay,
      limit: 10000,
    });

    // Calculate payment method breakdown
    let cashSales = 0;
    let cardSales = 0;
    let refundedAmount = 0;

    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const transaction of transactions) {
      if (transaction.status === 'completed') {
        if (transaction.paymentMethod === 'cash') {
          cashSales += transaction.total;
        } else if (transaction.paymentMethod === 'card') {
          cardSales += transaction.total;
        }
      } else if (transaction.status === 'refunded') {
        refundedAmount += transaction.total;
      }
    }

    // Get top selling items (this would require joining with transaction items)
    const topSellingItems: Array<{
      productId: string;
      productName: string;
      quantitySold: number;
      revenue: number;
    }> = [];

    return {
      date: targetDate,
      totalSales: summary.totalAmount,
      totalTransactions: summary.totalTransactions,
      averageTransactionValue: summary.averageTransactionValue,
      cashSales,
      cardSales,
      voidedTransactions: summary.voidedTransactions,
      refundedAmount,
      topSellingItems,
    };
  }

  private mapToResponseDto(transaction: TransactionWithItems): TransactionResponseDto {
    const responseDto: any = {
      id: transaction.id,
      transactionNumber: transaction.transactionNumber,
      tenantId: transaction.tenantId,
      locationId: transaction.locationId,
      subtotal: transaction.subtotal,
      taxAmount: transaction.taxAmount,
      discountAmount: transaction.discountAmount,
      tipAmount: transaction.tipAmount,
      total: transaction.total,
      status: transaction.status as TransactionStatus,
      itemCount: transaction.itemCount,
      paymentMethod: transaction.paymentMethod as PaymentMethod,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      items: transaction.items.map(item => ({
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
      })),
    };

    // Only add optional properties if they exist
    if (transaction.customerId) {
      responseDto.customerId = transaction.customerId;
    }
    if (transaction.notes) {
      responseDto.notes = transaction.notes;
    }

    return responseDto;
  }
}