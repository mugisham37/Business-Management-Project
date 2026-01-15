import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionRepository } from '../repositories/transaction.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { TransactionValidationService } from './transaction-validation.service';
import { 
  CreateTransactionDto, 
  UpdateTransactionDto, 
  VoidTransactionDto, 
  RefundTransactionDto,
  TransactionResponseDto 
} from '../dto/transaction.dto';
import { Transaction, TransactionWithItems, PaymentRecord } from '../entities/transaction.entity';

@Injectable()
export class TransactionService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly validationService: TransactionValidationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTransaction(
    tenantId: string,
    transactionData: CreateTransactionDto,
    userId: string,
  ): Promise<TransactionWithItems> {
    // Validate transaction data
    this.validationService.validateTransaction(transactionData);
    
    // Additional validation for offline transactions
    if (transactionData.isOfflineTransaction) {
      this.validationService.validateOfflineTransaction(transactionData);
    }

    try {
      // Create the transaction
      const transaction = await this.transactionRepository.create(
        tenantId,
        transactionData,
        userId
      );

      // Create transaction items
      const items = await this.transactionRepository.createItems(
        tenantId,
        transaction.id,
        transactionData.items,
        userId
      );

      // Create initial payment record
      const payment = await this.paymentRepository.create(
        tenantId,
        {
          transactionId: transaction.id,
          paymentMethod: transactionData.paymentMethod,
          amount: transaction.total,
          ...(transactionData.metadata && { metadata: transactionData.metadata }),
        },
        userId
      );

      const transactionWithItems: TransactionWithItems = {
        ...transaction,
        items,
        payments: [payment],
      };

      // Emit transaction created event
      this.eventEmitter.emit('transaction.created', {
        tenantId,
        transaction: transactionWithItems,
        userId,
      });

      return transactionWithItems;
    } catch (error) {
      // Emit transaction failed event
      this.eventEmitter.emit('transaction.failed', {
        tenantId,
        transactionData,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }

  async findById(tenantId: string, id: string): Promise<TransactionWithItems> {
    const transaction = await this.transactionRepository.findByIdWithItems(tenantId, id);
    
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async updateTransaction(
    tenantId: string,
    id: string,
    updates: UpdateTransactionDto,
    userId: string,
  ): Promise<Transaction> {
    const existingTransaction = await this.transactionRepository.findById(tenantId, id);
    
    if (!existingTransaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    // Validate status transitions
    if (updates.status) {
      this.validateStatusTransition(existingTransaction.status, updates.status);
    }

    const updatedTransaction = await this.transactionRepository.update(
      tenantId,
      id,
      updates,
      userId
    );

    if (!updatedTransaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    // Emit transaction updated event
    this.eventEmitter.emit('transaction.updated', {
      tenantId,
      transactionId: id,
      updates,
      userId,
    });

    return updatedTransaction;
  }

  async voidTransaction(
    tenantId: string,
    id: string,
    voidData: VoidTransactionDto,
    userId: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(tenantId, id);
    
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    // Validate that transaction can be voided
    this.validationService.validateVoid(transaction.status);

    // Update transaction status to voided
    const voidedTransaction = await this.transactionRepository.update(
      tenantId,
      id,
      {
        status: 'voided',
        notes: `${transaction.notes || ''}\n\nVOIDED: ${voidData.reason}${voidData.notes ? ` - ${voidData.notes}` : ''}`.trim(),
        metadata: {
          ...transaction.metadata,
          voidInfo: {
            reason: voidData.reason,
            notes: voidData.notes,
            voidedAt: new Date(),
            voidedBy: userId,
          },
        },
      },
      userId
    );

    if (!voidedTransaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    // Update payment status
    const payments = await this.paymentRepository.findByTransactionId(tenantId, id);
    for (const payment of payments) {
      await this.paymentRepository.update(
        tenantId,
        payment.id,
        { status: 'cancelled' },
        userId
      );
    }

    // Emit transaction voided event
    this.eventEmitter.emit('transaction.voided', {
      tenantId,
      transaction: voidedTransaction,
      voidData,
      userId,
    });

    return voidedTransaction;
  }

  async refundTransaction(
    tenantId: string,
    id: string,
    refundData: RefundTransactionDto,
    userId: string,
  ): Promise<{ transaction: Transaction; refundPayment: PaymentRecord }> {
    const transaction = await this.transactionRepository.findById(tenantId, id);
    
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    if (transaction.status !== 'completed') {
      throw new BadRequestException('Only completed transactions can be refunded');
    }

    // Get existing payments to calculate already refunded amount
    const payments = await this.paymentRepository.findByTransactionId(tenantId, id);
    const totalRefunded = payments.reduce((sum, payment) => sum + payment.refundedAmount, 0);

    // Validate refund amount
    this.validationService.validateRefund(transaction.total, refundData.amount, totalRefunded);

    // Create refund payment record
    const refundPayment = await this.paymentRepository.create(
      tenantId,
      {
        transactionId: id,
        paymentMethod: transaction.paymentMethod,
        amount: -refundData.amount, // Negative amount for refund
        metadata: {
          refundReason: refundData.reason,
          refundNotes: refundData.notes,
          originalTransactionId: id,
        },
      },
      userId
    );

    // Update refund payment status
    await this.paymentRepository.update(
      tenantId,
      refundPayment.id,
      {
        status: 'captured',
        processedAt: new Date(),
      },
      userId
    );

    // Update original payment with refund information
    const originalPayment = payments.find(p => p.amount > 0);
    if (originalPayment) {
      await this.paymentRepository.update(
        tenantId,
        originalPayment.id,
        {
          refundedAmount: originalPayment.refundedAmount + refundData.amount,
          refundedAt: new Date(),
        },
        userId
      );
    }

    // Update transaction status if fully refunded
    const newTotalRefunded = totalRefunded + refundData.amount;
    let updatedTransaction = transaction;
    
    if (newTotalRefunded >= transaction.total) {
      updatedTransaction = await this.transactionRepository.update(
        tenantId,
        id,
        {
          status: 'refunded',
          notes: `${transaction.notes || ''}\n\nREFUNDED: ${refundData.reason}${refundData.notes ? ` - ${refundData.notes}` : ''}`.trim(),
        },
        userId
      ) || transaction;
    }

    // Emit transaction refunded event
    this.eventEmitter.emit('transaction.refunded', {
      tenantId,
      transaction: updatedTransaction,
      refundData,
      refundAmount: refundData.amount,
      userId,
    });

    return {
      transaction: updatedTransaction,
      refundPayment,
    };
  }

  async findTransactionsByTenant(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      locationId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<{ transactions: Transaction[]; total: number }> {
    return this.transactionRepository.findByTenant(tenantId, options);
  }

  async getTransactionSummary(
    tenantId: string,
    locationId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalTransactions: number;
    totalAmount: number;
    averageTransactionValue: number;
    completedTransactions: number;
    voidedTransactions: number;
    refundedTransactions: number;
  }> {
    // Create options object without undefined properties
    const options: any = {
      limit: 10000, // Get all transactions for summary
    };

    if (locationId) {
      options.locationId = locationId;
    }
    if (startDate) {
      options.startDate = startDate;
    }
    if (endDate) {
      options.endDate = endDate;
    }

    const { transactions } = await this.transactionRepository.findByTenant(tenantId, options);

    const summary = {
      totalTransactions: transactions.length,
      totalAmount: 0,
      averageTransactionValue: 0,
      completedTransactions: 0,
      voidedTransactions: 0,
      refundedTransactions: 0,
    };

    for (const transaction of transactions) {
      if (transaction.status === 'completed') {
        summary.completedTransactions++;
        summary.totalAmount += transaction.total;
      } else if (transaction.status === 'voided') {
        summary.voidedTransactions++;
      } else if (transaction.status === 'refunded') {
        summary.refundedTransactions++;
      }
    }

    summary.averageTransactionValue = summary.completedTransactions > 0 
      ? summary.totalAmount / summary.completedTransactions 
      : 0;

    return summary;
  }

  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      pending: ['processing', 'completed', 'failed', 'cancelled'],
      processing: ['completed', 'failed', 'cancelled'],
      completed: ['refunded', 'voided'],
      failed: ['pending'], // Allow retry
      cancelled: [], // Terminal state
      refunded: [], // Terminal state
      voided: [], // Terminal state
    };

    const allowedStatuses = validTransitions[currentStatus] || [];
    
    if (!allowedStatuses.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'`
      );
    }
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
      status: transaction.status as any,
      itemCount: transaction.itemCount,
      paymentMethod: transaction.paymentMethod as any,
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