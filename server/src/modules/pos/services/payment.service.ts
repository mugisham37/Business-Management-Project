import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PaymentRepository } from '../repositories/payment.repository';
import { StripePaymentProvider } from '../providers/stripe-payment.provider';
import { CashPaymentProvider } from '../providers/cash-payment.provider';
import { MobileMoneyProvider } from '../providers/mobile-money.provider';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentRecord } from '../entities/transaction.entity';
import { PaymentRequest, PaymentResult, createWithoutUndefined } from '../dto/transaction.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly stripeProvider: StripePaymentProvider,
    private readonly cashProvider: CashPaymentProvider,
    private readonly mobileMoneyProvider: MobileMoneyProvider,
    private readonly reconciliationService: PaymentReconciliationService,
  ) {}

  async processPayment(
    tenantId: string,
    transactionId: string,
    paymentRequest: PaymentRequest,
    userId: string,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing payment for transaction ${transactionId}, method: ${paymentRequest.paymentMethod}`);

    try {
      // Get the appropriate payment provider
      const provider = this.getPaymentProvider(paymentRequest.paymentMethod);

      // Process payment with provider
      const providerResult = await provider.processPayment({
        amount: paymentRequest.amount,
        paymentReference: paymentRequest.paymentReference,
        metadata: {
          tenantId,
          transactionId,
          ...paymentRequest.metadata,
        },
      });

      // Create payment record with proper optional property handling
      const paymentData: any = {
        transactionId,
        paymentMethod: paymentRequest.paymentMethod,
        amount: paymentRequest.amount,
        paymentProvider: provider.getProviderName(),
      };

      // Only add optional properties if they are defined
      if (providerResult.providerTransactionId !== undefined) {
        paymentData.providerTransactionId = providerResult.providerTransactionId;
      }
      if (providerResult.providerResponse !== undefined) {
        paymentData.providerResponse = providerResult.providerResponse;
      }
      if (paymentRequest.metadata !== undefined) {
        paymentData.metadata = paymentRequest.metadata;
      }

      const payment = await this.paymentRepository.create(
        tenantId,
        paymentData,
        userId
      );

      // Update payment status based on provider result
      await this.paymentRepository.update(
        tenantId,
        payment.id,
        {
          status: providerResult.success ? 'captured' : 'failed',
          processedAt: new Date(),
          failureReason: providerResult.error,
        },
        userId
      );

      return {
        success: providerResult.success,
        paymentId: payment.id,
        providerTransactionId: providerResult.providerTransactionId,
        error: providerResult.error,
        metadata: providerResult.metadata,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Payment processing failed: ${errorMessage}`);
      
      return {
        success: false,
        paymentId: '',
        error: errorMessage,
      };
    }
  }

  async voidPayment(
    tenantId: string,
    transactionId: string,
    userId: string,
  ): Promise<void> {
    const payments = await this.paymentRepository.findByTransactionId(tenantId, transactionId);
    
    for (const payment of payments) {
      if (payment.status === 'captured' || payment.status === 'authorized') {
        const provider = this.getPaymentProvider(payment.paymentMethod);
        
        try {
          await provider.voidPayment(payment.providerTransactionId || '');
          
          await this.paymentRepository.update(
            tenantId,
            payment.id,
            { status: 'cancelled' },
            userId
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          this.logger.error(`Failed to void payment ${payment.id}: ${errorMessage}`);
          // Continue with other payments even if one fails
        }
      }
    }
  }

  async refundPayment(
    tenantId: string,
    transactionId: string,
    amount: number,
    userId: string,
  ): Promise<void> {
    const payments = await this.paymentRepository.findByTransactionId(tenantId, transactionId);
    const capturedPayment = payments.find(p => p.status === 'captured' && p.amount > 0);
    
    if (!capturedPayment) {
      throw new BadRequestException('No captured payment found for refund');
    }

    const provider = this.getPaymentProvider(capturedPayment.paymentMethod);
    
    try {
      const refundResult = await provider.refundPayment(
        capturedPayment.providerTransactionId || '',
        amount
      );

      // Create refund payment record
      await this.paymentRepository.create(
        tenantId,
        {
          transactionId,
          paymentMethod: capturedPayment.paymentMethod,
          amount: -amount, // Negative for refund
          paymentProvider: provider.getProviderName(),
          providerTransactionId: refundResult.providerTransactionId,
          providerResponse: refundResult.providerResponse,
          metadata: {
            originalPaymentId: capturedPayment.id,
            refundType: 'partial',
          },
        },
        userId
      );

      // Update original payment with refund information
      await this.paymentRepository.update(
        tenantId,
        capturedPayment.id,
        {
          refundedAmount: capturedPayment.refundedAmount + amount,
          refundedAt: new Date(),
        },
        userId
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to refund payment: ${errorMessage}`);
      throw new BadRequestException(`Refund failed: ${errorMessage}`);
    }
  }

  async getPaymentHistory(
    tenantId: string,
    transactionId: string,
  ): Promise<PaymentRecord[]> {
    return this.paymentRepository.findByTransactionId(tenantId, transactionId);
  }

  async validatePaymentMethod(
    paymentMethod: string,
    amount: number,
    metadata?: Record<string, any>,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const provider = this.getPaymentProvider(paymentMethod);
      return await provider.validatePayment(amount, metadata);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        valid: false,
        error: errorMessage,
      };
    }
  }

  private getPaymentProvider(paymentMethod: string): any {
    switch (paymentMethod) {
      case 'cash':
        return this.cashProvider;
      case 'card':
      case 'digital_wallet':
        return this.stripeProvider;
      case 'mobile_money':
        return this.mobileMoneyProvider;
      default:
        throw new BadRequestException(`Unsupported payment method: ${paymentMethod}`);
    }
  }

  async performReconciliation(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    options?: any,
  ) {
    return this.reconciliationService.performReconciliation(
      tenantId,
      startDate,
      endDate,
      options
    );
  }

  async performDailyReconciliation(
    tenantId: string,
    date: Date,
    options?: any,
  ) {
    return this.reconciliationService.performDailyReconciliation(
      tenantId,
      date,
      options
    );
  }

  async getReconciliationHistory(
    tenantId: string,
    limit?: number,
    offset?: number,
  ) {
    return this.reconciliationService.getReconciliationHistory(
      tenantId,
      limit,
      offset
    );
  }
}