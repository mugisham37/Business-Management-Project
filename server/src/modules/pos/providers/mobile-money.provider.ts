import { Injectable, Logger } from '@nestjs/common';
import { PaymentProviderResult } from '../types/shared.types';

export interface MobileMoneyPaymentRequest {
  amount: number;
  paymentReference?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class MobileMoneyProvider {
  private readonly logger = new Logger(MobileMoneyProvider.name);
  private readonly providerName = 'mobile_money';

  constructor() {
    // In a real implementation, this would initialize mobile money SDK/API clients
    // for providers like M-Pesa, MTN Mobile Money, Airtel Money, etc.
    this.logger.log('Mobile Money payment provider initialized');
  }

  getProviderName(): string {
    return this.providerName;
  }

  async processPayment(request: MobileMoneyPaymentRequest): Promise<PaymentProviderResult> {
    this.logger.log(`Processing mobile money payment for amount ${request.amount}`);

    try {
      // Determine mobile money provider based on phone number or metadata
      const provider = this.detectMobileMoneyProvider(request.metadata?.phoneNumber);
      
      // Simulate mobile money API call
      await this.simulateMobileMoneyApiCall();

      const transactionId = `mm_${provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Simulate success/failure (85% success rate for mobile money)
      const isSuccess = Math.random() > 0.15;

      if (isSuccess) {
        this.logger.log(`Mobile money payment successful: ${transactionId}`);
        
        return {
          success: true,
          providerTransactionId: transactionId,
          providerResponse: {
            id: transactionId,
            status: 'completed',
            amount: request.amount,
            currency: this.getCurrencyForProvider(provider),
            payment_method: 'mobile_money',
            provider: provider,
            phone_number: this.maskPhoneNumber(request.metadata?.phoneNumber),
            transaction_code: this.generateTransactionCode(),
            processed_at: new Date().toISOString(),
          },
          metadata: {
            provider: this.providerName,
            mobileProvider: provider,
            processingTime: Math.floor(Math.random() * 5000) + 2000, // 2-7 seconds
          },
        };
      } else {
        const errorCode = ['insufficient_balance', 'invalid_pin', 'network_error', 'account_blocked'][Math.floor(Math.random() * 4)];
        const errorMessage = this.getErrorMessage(errorCode);

        this.logger.error(`Mobile money payment failed: ${errorMessage}`);
        
        return {
          success: false,
          error: errorMessage,
          providerResponse: {
            error: {
              code: errorCode,
              message: errorMessage,
              provider: provider,
            },
          },
          metadata: {
            provider: this.providerName,
            mobileProvider: provider,
            errorCode,
          },
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown mobile money error occurred';
      this.logger.error(`Mobile money payment processing error: ${errorMessage}`);
      
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
    this.logger.log(`Voiding mobile money payment ${providerTransactionId}`);

    try {
      // Extract provider from transaction ID
      const provider = this.extractProviderFromTransactionId(providerTransactionId);
      
      // Simulate mobile money void/reversal API call
      await this.simulateMobileMoneyApiCall();

      // In a real implementation, this would:
      // 1. Call the mobile money provider's reversal API
      // 2. Handle the response and update transaction status

      this.logger.log(`Mobile money payment ${providerTransactionId} voided successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to void mobile money payment ${providerTransactionId}: ${errorMessage}`);
      throw error;
    }
  }

  async refundPayment(
    providerTransactionId: string,
    amount: number,
  ): Promise<{ providerTransactionId?: string; providerResponse?: Record<string, any> }> {
    this.logger.log(`Refunding mobile money payment ${providerTransactionId} for amount ${amount}`);

    try {
      const provider = this.extractProviderFromTransactionId(providerTransactionId);
      
      // Simulate mobile money refund API call
      await this.simulateMobileMoneyApiCall();

      const refundId = `mm_refund_${provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Mobile money refund successful: ${refundId}`);

      return {
        providerTransactionId: refundId,
        providerResponse: {
          id: refundId,
          status: 'completed',
          amount: amount,
          currency: this.getCurrencyForProvider(provider),
          payment_method: 'mobile_money',
          provider: provider,
          original_transaction: providerTransactionId,
          transaction_code: this.generateTransactionCode(),
          processed_at: new Date().toISOString(),
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to refund mobile money payment ${providerTransactionId}: ${errorMessage}`);
      throw error;
    }
  }

  async validatePayment(
    amount: number,
    metadata?: Record<string, any>,
  ): Promise<{ valid: boolean; error?: string }> {
    this.logger.debug(`Validating mobile money payment for amount ${amount}`);

    // Basic validation rules
    if (amount <= 0) {
      return {
        valid: false,
        error: 'Payment amount must be greater than 0',
      };
    }

    // Validate phone number is provided
    if (!metadata?.phoneNumber) {
      return {
        valid: false,
        error: 'Phone number is required for mobile money payments',
      };
    }

    // Validate phone number format
    const phoneNumber = metadata.phoneNumber;
    if (!this.isValidPhoneNumber(phoneNumber)) {
      return {
        valid: false,
        error: 'Invalid phone number format',
      };
    }

    // Detect mobile money provider
    const provider = this.detectMobileMoneyProvider(phoneNumber);
    if (!provider) {
      return {
        valid: false,
        error: 'Phone number is not associated with a supported mobile money provider',
      };
    }

    // Validate amount limits for the provider
    const limits = this.getProviderLimits(provider);
    if (amount < limits.min) {
      return {
        valid: false,
        error: `Minimum payment amount for ${provider} is ${limits.currency} ${limits.min}`,
      };
    }

    if (amount > limits.max) {
      return {
        valid: false,
        error: `Maximum payment amount for ${provider} is ${limits.currency} ${limits.max}`,
      };
    }

    return { valid: true };
  }

  async checkAccountStatus(phoneNumber: string): Promise<{
    isActive: boolean;
    provider: string;
    accountName?: string;
    balance?: number;
    currency?: string;
  }> {
    this.logger.debug(`Checking mobile money account status for ${this.maskPhoneNumber(phoneNumber)}`);

    try {
      const provider = this.detectMobileMoneyProvider(phoneNumber);
      if (!provider) {
        return {
          isActive: false,
          provider: 'unknown',
        };
      }

      // Simulate account status check
      await this.simulateMobileMoneyApiCall();

      // In a real implementation, this would query the mobile money provider's API
      return {
        isActive: true,
        provider,
        accountName: 'John Doe', // Would come from API
        balance: Math.floor(Math.random() * 10000), // Mock balance
        currency: this.getCurrencyForProvider(provider),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to check account status: ${errorMessage}`);
      
      return {
        isActive: false,
        provider: 'unknown',
      };
    }
  }

  async initiatePaymentRequest(
    phoneNumber: string,
    amount: number,
    reference: string,
  ): Promise<{
    requestId: string;
    status: 'pending' | 'sent' | 'failed';
    message: string;
  }> {
    this.logger.log(`Initiating payment request to ${this.maskPhoneNumber(phoneNumber)} for amount ${amount}`);

    try {
      const provider = this.detectMobileMoneyProvider(phoneNumber);
      if (!provider) {
        throw new Error('Unsupported mobile money provider');
      }

      // Simulate payment request initiation
      await this.simulateMobileMoneyApiCall();

      const requestId = `req_${provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Payment request initiated: ${requestId}`);

      return {
        requestId,
        status: 'sent',
        message: `Payment request sent to ${this.maskPhoneNumber(phoneNumber)}. Please check your phone and enter your PIN to complete the payment.`,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to initiate payment request: ${errorMessage}`);
      
      return {
        requestId: '',
        status: 'failed',
        message: errorMessage,
      };
    }
  }

  private detectMobileMoneyProvider(phoneNumber?: string): string {
    if (!phoneNumber) return '';

    // Remove all non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    // Detect provider based on phone number patterns
    // These are simplified patterns - real implementation would be more comprehensive
    
    if (cleanNumber.startsWith('254')) {
      // Kenya
      if (cleanNumber.startsWith('2547')) return 'mpesa'; // Safaricom M-Pesa
      if (cleanNumber.startsWith('2541')) return 'airtel_money'; // Airtel Money
    } else if (cleanNumber.startsWith('256')) {
      // Uganda
      if (cleanNumber.startsWith('2567')) return 'mtn_mobile_money'; // MTN Mobile Money
      if (cleanNumber.startsWith('2561')) return 'airtel_money'; // Airtel Money
    } else if (cleanNumber.startsWith('255')) {
      // Tanzania
      if (cleanNumber.startsWith('2557')) return 'mpesa'; // Vodacom M-Pesa
      if (cleanNumber.startsWith('2556')) return 'airtel_money'; // Airtel Money
    } else if (cleanNumber.startsWith('233')) {
      // Ghana
      if (cleanNumber.startsWith('2335')) return 'mtn_mobile_money'; // MTN Mobile Money
      if (cleanNumber.startsWith('2332')) return 'airtel_money'; // Airtel Money
    }

    return ''; // Unknown provider
  }

  private extractProviderFromTransactionId(transactionId: string): string {
    // Extract provider from transaction ID format: mm_{provider}_{timestamp}_{random}
    const parts = transactionId.split('_');
    return parts.length > 2 ? parts[1] : 'unknown';
  }

  private getCurrencyForProvider(provider: string): string {
    const currencies: Record<string, string> = {
      mpesa: 'KES', // Kenyan Shilling
      mtn_mobile_money: 'UGX', // Ugandan Shilling
      airtel_money: 'KES', // Varies by country
    };

    return currencies[provider] || 'USD';
  }

  private getProviderLimits(provider: string): { min: number; max: number; currency: string } {
    const limits: Record<string, { min: number; max: number; currency: string }> = {
      mpesa: { min: 1, max: 300000, currency: 'KES' },
      mtn_mobile_money: { min: 500, max: 5000000, currency: 'UGX' },
      airtel_money: { min: 1, max: 150000, currency: 'KES' },
    };

    return limits[provider] || { min: 1, max: 1000, currency: 'USD' };
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation
    const phoneRegex = /^[\+]?[1-9][\d]{8,14}$/;
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    return phoneRegex.test(cleanNumber);
  }

  private maskPhoneNumber(phoneNumber?: string): string {
    if (!phoneNumber) return 'N/A';
    
    const clean = phoneNumber.replace(/\D/g, '');
    if (clean.length < 4) return phoneNumber;
    
    const masked = clean.slice(0, -4).replace(/\d/g, '*') + clean.slice(-4);
    return masked;
  }

  private generateTransactionCode(): string {
    // Generate a transaction code similar to M-Pesa format
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    let code = '';
    for (let i = 0; i < 2; i++) {
      code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 8; i++) {
      code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    
    return code;
  }

  private async simulateMobileMoneyApiCall(): Promise<void> {
    // Simulate network delay for mobile money API calls (typically slower than card payments)
    const delay = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      insufficient_balance: 'Insufficient balance in mobile money account',
      invalid_pin: 'Invalid PIN entered',
      network_error: 'Network error occurred. Please try again',
      account_blocked: 'Mobile money account is blocked',
      transaction_limit_exceeded: 'Transaction limit exceeded',
      invalid_phone_number: 'Invalid phone number',
      service_unavailable: 'Mobile money service is temporarily unavailable',
    };

    return errorMessages[errorCode] || 'Mobile money payment could not be processed';
  }
}