import { Injectable, Logger } from '@nestjs/common';
import { PaymentProviderResult } from '../types/shared.types';

export interface CashPaymentRequest {
  amount: number;
  paymentReference?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class CashPaymentProvider {
  private readonly logger = new Logger(CashPaymentProvider.name);
  private readonly providerName = 'cash';

  constructor() {
    this.logger.log('Cash payment provider initialized');
  }

  getProviderName(): string {
    return this.providerName;
  }

  async processPayment(request: CashPaymentRequest): Promise<PaymentProviderResult> {
    this.logger.log(`Processing cash payment for amount ${request.amount}`);

    try {
      // For cash payments, we don't need external API calls
      // Just validate the payment and create a record

      const cashTransactionId = `cash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Cash payments are always successful if they reach this point
      // The validation should happen before calling this method
      
      this.logger.log(`Cash payment successful: ${cashTransactionId}`);
      
      return {
        success: true,
        providerTransactionId: cashTransactionId,
        providerResponse: {
          id: cashTransactionId,
          status: 'completed',
          amount: request.amount,
          currency: 'usd',
          payment_method: 'cash',
          received_amount: request.metadata?.receivedAmount || request.amount,
          change_amount: this.calculateChange(
            request.metadata?.receivedAmount || request.amount,
            request.amount
          ),
          processed_at: new Date().toISOString(),
        },
        metadata: {
          provider: this.providerName,
          processingTime: 0, // Cash is instant
          receivedAmount: request.metadata?.receivedAmount,
          changeAmount: this.calculateChange(
            request.metadata?.receivedAmount || request.amount,
            request.amount
          ),
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown cash payment error occurred';
      this.logger.error(`Cash payment processing error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        metadata: {
          provider: this.providerName,
          errorType: 'processing_error',
        },
      };
    }
  }

  async voidPayment(providerTransactionId: string): Promise<void> {
    this.logger.log(`Voiding cash payment ${providerTransactionId}`);

    try {
      // For cash payments, voiding means the cash drawer needs to be adjusted
      // This would typically involve:
      // 1. Recording the void in the cash management system
      // 2. Adjusting the expected cash amount
      // 3. Creating an audit trail

      this.logger.log(`Cash payment ${providerTransactionId} voided successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to void cash payment ${providerTransactionId}: ${errorMessage}`);
      throw error;
    }
  }

  async refundPayment(
    providerTransactionId: string,
    amount: number,
  ): Promise<{ providerTransactionId?: string; providerResponse?: Record<string, any> }> {
    this.logger.log(`Refunding cash payment ${providerTransactionId} for amount ${amount}`);

    try {
      // For cash refunds, we need to:
      // 1. Record the refund transaction
      // 2. Adjust the cash drawer amount
      // 3. Create audit trail

      const refundId = `cash_refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Cash refund successful: ${refundId}`);

      return {
        providerTransactionId: refundId,
        providerResponse: {
          id: refundId,
          status: 'completed',
          amount: amount,
          currency: 'usd',
          payment_method: 'cash',
          original_payment: providerTransactionId,
          refunded_at: new Date().toISOString(),
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to refund cash payment ${providerTransactionId}: ${errorMessage}`);
      throw error;
    }
  }

  async validatePayment(
    amount: number,
    metadata?: Record<string, any>,
  ): Promise<{ valid: boolean; error?: string }> {
    this.logger.debug(`Validating cash payment for amount ${amount}`);

    // Basic validation rules for cash payments
    if (amount <= 0) {
      return {
        valid: false,
        error: 'Payment amount must be greater than 0',
      };
    }

    if (amount > 10000) {
      return {
        valid: false,
        error: 'Cash payment amount exceeds maximum limit of $10,000',
      };
    }

    // Validate received amount if provided
    if (metadata?.receivedAmount !== undefined) {
      const receivedAmount = metadata.receivedAmount;
      
      if (receivedAmount < amount) {
        return {
          valid: false,
          error: `Received amount ($${receivedAmount}) is less than required amount ($${amount})`,
        };
      }

      // Check for reasonable overpayment (not more than $1000 over)
      if (receivedAmount > amount + 1000) {
        return {
          valid: false,
          error: 'Received amount is unreasonably high',
        };
      }
    }

    // Validate cash drawer has sufficient change if needed
    if (metadata?.receivedAmount && metadata.receivedAmount > amount) {
      const changeNeeded = metadata.receivedAmount - amount;
      const hasChange = await this.validateChangeAvailability(changeNeeded);
      
      if (!hasChange) {
        return {
          valid: false,
          error: `Insufficient change available. Need $${changeNeeded.toFixed(2)}`,
        };
      }
    }

    return { valid: true };
  }

  async getCashDrawerStatus(): Promise<{
    currentAmount: number;
    expectedAmount: number;
    variance: number;
    lastCounted: Date;
    changeAvailable: Record<string, number>; // denomination -> count
  }> {
    this.logger.debug('Getting cash drawer status');

    // In a real implementation, this would query the cash management system
    // For now, return mock data
    const currentAmount = 500.00;
    const expectedAmount = 485.50;
    
    return {
      currentAmount,
      expectedAmount,
      variance: currentAmount - expectedAmount,
      lastCounted: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      changeAvailable: {
        '100.00': 2,  // $100 bills
        '50.00': 1,   // $50 bills
        '20.00': 5,   // $20 bills
        '10.00': 8,   // $10 bills
        '5.00': 12,   // $5 bills
        '1.00': 25,   // $1 bills
        '0.25': 40,   // quarters
        '0.10': 30,   // dimes
        '0.05': 20,   // nickels
        '0.01': 100,  // pennies
      },
    };
  }

  async recordCashCount(
    denominations: Record<string, number>,
    countedBy: string,
  ): Promise<{
    totalAmount: number;
    variance: number;
    countId: string;
  }> {
    this.logger.log(`Recording cash count by ${countedBy}`);

    // Calculate total amount from denominations
    const totalAmount = Object.entries(denominations).reduce((sum, [denom, count]) => {
      return sum + (parseFloat(denom) * count);
    }, 0);

    const countId = `count_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get expected amount (would come from system)
    const expectedAmount = 485.50; // Mock expected amount
    const variance = totalAmount - expectedAmount;

    this.logger.log(`Cash count recorded: ${countId}, Total: $${totalAmount}, Variance: $${variance}`);

    return {
      totalAmount,
      variance,
      countId,
    };
  }

  async makeChange(
    receivedAmount: number,
    requiredAmount: number,
  ): Promise<{
    changeAmount: number;
    changeDenominations: Record<string, number>;
  }> {
    const changeAmount = receivedAmount - requiredAmount;
    
    if (changeAmount <= 0) {
      return {
        changeAmount: 0,
        changeDenominations: {},
      };
    }

    // Calculate optimal change denominations
    const changeDenominations = this.calculateOptimalChange(changeAmount);

    this.logger.log(`Making change: $${changeAmount.toFixed(2)}`);

    return {
      changeAmount,
      changeDenominations,
    };
  }

  private calculateChange(receivedAmount: number, requiredAmount: number): number {
    return Math.max(0, receivedAmount - requiredAmount);
  }

  private async validateChangeAvailability(changeNeeded: number): Promise<boolean> {
    try {
      // In a real implementation, this would check the cash drawer
      // For now, assume we have change if it's less than $100
      return changeNeeded <= 100;
    } catch (error) {
      this.logger.error(`Error validating change availability: ${error}`);
      return false;
    }
  }

  private calculateOptimalChange(amount: number): Record<string, number> {
    const denominations = [100, 50, 20, 10, 5, 1, 0.25, 0.10, 0.05, 0.01];
    const change: Record<string, number> = {};
    let remaining = Math.round(amount * 100) / 100; // Round to avoid floating point issues

    for (const denom of denominations) {
      if (remaining >= denom) {
        const count = Math.floor(remaining / denom);
        change[denom.toFixed(2)] = count;
        remaining = Math.round((remaining - (count * denom)) * 100) / 100;
      }
    }

    return change;
  }
}