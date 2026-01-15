import { Injectable, Logger } from '@nestjs/common';
import { 
  PaymentProvider, 
  PaymentProviderRequest, 
  PaymentProviderResult, 
  RefundResult, 
  ValidationResult 
} from './payment-provider.interface';

@Injectable()
export class CashPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(CashPaymentProvider.name);

  getProviderName(): string {
    return 'cash';
  }

  async processPayment(request: PaymentProviderRequest): Promise<PaymentProviderResult> {
    this.logger.log(`Processing cash payment of $${request.amount}`);

    try {
      // Cash payments are always successful immediately
      // In a real implementation, this might involve:
      // - Cash drawer integration
      // - Change calculation
      // - Receipt printing
      
      const transactionId = this.generateCashTransactionId();
      
      return {
        success: true,
        providerTransactionId: transactionId,
        providerResponse: {
          paymentMethod: 'cash',
          amount: request.amount,
          processedAt: new Date().toISOString(),
          changeRequired: this.calculateChange(request),
        },
        metadata: {
          processingTime: 0, // Instant for cash
          changeAmount: this.calculateChange(request),
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Cash payment processing failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        providerResponse: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async voidPayment(providerTransactionId: string): Promise<void> {
    this.logger.log(`Voiding cash payment ${providerTransactionId}`);
    
    // For cash payments, voiding typically means:
    // - Opening cash drawer for refund
    // - Printing void receipt
    // - Updating cash register totals
    
    // This is always successful for cash as it's a manual process
    return Promise.resolve();
  }

  async refundPayment(providerTransactionId: string, amount: number): Promise<RefundResult> {
    this.logger.log(`Refunding cash payment ${providerTransactionId}, amount: $${amount}`);

    try {
      // For cash refunds:
      // - Open cash drawer
      // - Print refund receipt
      // - Update cash totals
      
      const refundTransactionId = this.generateCashTransactionId();
      
      return {
        success: true,
        providerTransactionId: refundTransactionId,
        providerResponse: {
          originalTransactionId: providerTransactionId,
          refundAmount: amount,
          refundedAt: new Date().toISOString(),
          refundMethod: 'cash',
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Cash refund failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async validatePayment(amount: number, metadata?: Record<string, any>): Promise<ValidationResult> {
    // Basic validation for cash payments
    if (amount <= 0) {
      return {
        valid: false,
        error: 'Payment amount must be greater than 0',
      };
    }

    if (amount > 10000) { // $10,000 limit for cash transactions
      return {
        valid: false,
        error: 'Cash payment amount exceeds maximum limit of $10,000',
      };
    }

    // Check if cash drawer is available (in a real implementation)
    const cashDrawerAvailable = await this.checkCashDrawerStatus();
    if (!cashDrawerAvailable) {
      return {
        valid: false,
        error: 'Cash drawer is not available',
      };
    }

    return {
      valid: true,
    };
  }

  private generateCashTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CASH-${timestamp}-${random}`;
  }

  private calculateChange(request: PaymentProviderRequest): number {
    // In a real implementation, this would calculate change based on:
    // - Amount tendered (from metadata or payment reference)
    // - Transaction total
    
    const amountTendered = request.metadata?.amountTendered || request.amount;
    return Math.max(0, amountTendered - request.amount);
  }

  private async checkCashDrawerStatus(): Promise<boolean> {
    // In a real implementation, this would check:
    // - Cash drawer hardware connection
    // - Cash drawer lock status
    // - Till session status
    
    // For now, always return true
    return true;
  }
}