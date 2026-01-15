import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  PaymentProvider, 
  PaymentProviderRequest, 
  PaymentProviderResult, 
  RefundResult, 
  ValidationResult 
} from './payment-provider.interface';

@Injectable()
export class MobileMoneyProvider implements PaymentProvider {
  private readonly logger = new Logger(MobileMoneyProvider.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly supportedProviders = ['mpesa', 'mtn_money', 'airtel_money', 'orange_money'];

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('MOBILE_MONEY_API_KEY') || '';
    this.apiSecret = this.configService.get<string>('MOBILE_MONEY_API_SECRET') || '';
  }

  getProviderName(): string {
    return 'mobile_money';
  }

  async processPayment(request: PaymentProviderRequest): Promise<PaymentProviderResult> {
    this.logger.log(`Processing mobile money payment of ${request.amount}`);

    try {
      const mobileProvider = request.metadata?.provider || 'mpesa';
      const phoneNumber = request.metadata?.phoneNumber;

      if (!phoneNumber) {
        throw new Error('Phone number is required for mobile money payments');
      }

      if (!this.supportedProviders.includes(mobileProvider)) {
        throw new Error(`Unsupported mobile money provider: ${mobileProvider}`);
      }

      // Initiate mobile money payment
      const paymentRequest = await this.initiateMobilePayment(request, mobileProvider, phoneNumber);
      
      // Poll for payment status (in real implementation, this would be webhook-based)
      const paymentResult = await this.pollPaymentStatus(paymentRequest.requestId, 30000); // 30 second timeout
      
      if (paymentResult.success && paymentResult.transactionId) {
        return {
          success: true,
          providerTransactionId: paymentResult.transactionId,
          providerResponse: {
            provider: mobileProvider,
            phoneNumber: this.maskPhoneNumber(phoneNumber),
            transactionId: paymentResult.transactionId,
            status: 'completed',
            amount: request.amount,
            currency: 'USD', // In real implementation, this would be configurable
            processedAt: new Date().toISOString(),
            fees: this.calculateMobileMoneyFees(request.amount, mobileProvider),
          },
          metadata: {
            processingTime: paymentResult.processingTime,
            provider: mobileProvider,
          },
        };
      } else {
        return {
          success: false,
          error: paymentResult.error || 'Mobile money payment failed',
          providerResponse: {
            provider: mobileProvider,
            phoneNumber: this.maskPhoneNumber(phoneNumber),
            status: 'failed',
            failureReason: paymentResult.error,
            requestId: paymentRequest.requestId,
          },
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Mobile money payment processing failed: ${errorMessage}`);
      
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
    this.logger.log(`Voiding mobile money payment ${providerTransactionId}`);
    
    try {
      // In a real implementation, this would call the mobile money provider's reversal API
      await this.simulateMobileMoneyReversal(providerTransactionId);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to void mobile money payment: ${errorMessage}`);
      throw new BadRequestException(`Void failed: ${errorMessage}`);
    }
  }

  async refundPayment(providerTransactionId: string, amount: number): Promise<RefundResult> {
    this.logger.log(`Refunding mobile money payment ${providerTransactionId}, amount: ${amount}`);

    try {
      // In a real implementation, this would call the mobile money provider's refund API
      const refund = await this.simulateMobileMoneyRefund(providerTransactionId, amount);
      
      return {
        success: true,
        providerTransactionId: refund.refundId,
        providerResponse: {
          refundId: refund.refundId,
          originalTransactionId: providerTransactionId,
          amount: amount,
          currency: 'USD',
          status: 'completed',
          refundedAt: new Date().toISOString(),
          provider: refund.provider,
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Mobile money refund failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async validatePayment(amount: number, metadata?: Record<string, any>): Promise<ValidationResult> {
    // Validate mobile money configuration
    if (!this.apiKey || !this.apiSecret) {
      return {
        valid: false,
        error: 'Mobile money is not configured',
      };
    }

    // Validate amount (minimum $0.10)
    if (amount < 0.10) {
      return {
        valid: false,
        error: 'Minimum payment amount is $0.10 for mobile money',
      };
    }

    // Validate maximum amount (varies by provider, using $1000 as default)
    if (amount > 1000) {
      return {
        valid: false,
        error: 'Payment amount exceeds maximum limit for mobile money',
      };
    }

    // Validate phone number format
    if (metadata?.phoneNumber) {
      const isValidPhone = this.validatePhoneNumber(metadata.phoneNumber);
      if (!isValidPhone) {
        return {
          valid: false,
          error: 'Invalid phone number format',
        };
      }
    } else {
      return {
        valid: false,
        error: 'Phone number is required for mobile money payments',
      };
    }

    // Validate mobile money provider
    if (metadata?.provider && !this.supportedProviders.includes(metadata.provider)) {
      return {
        valid: false,
        error: `Unsupported mobile money provider: ${metadata.provider}`,
      };
    }

    return {
      valid: true,
    };
  }

  private async initiateMobilePayment(
    request: PaymentProviderRequest,
    provider: string,
    phoneNumber: string,
  ): Promise<{ requestId: string; status: string }> {
    // Simulate mobile money payment initiation
    const requestId = `mm_${provider}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // In a real implementation, this would make an API call to the mobile money provider
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call delay
    
    return {
      requestId,
      status: 'pending',
    };
  }

  private async pollPaymentStatus(
    requestId: string,
    timeoutMs: number,
  ): Promise<{ success: boolean; transactionId?: string; error?: string; processingTime: number }> {
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds
    
    while (Date.now() - startTime < timeoutMs) {
      // Simulate checking payment status
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      // Simulate 85% success rate after some processing time
      const processingTime = Date.now() - startTime;
      if (processingTime > 5000) { // After 5 seconds
        const success = Math.random() > 0.15; // 85% success rate
        
        if (success) {
          return {
            success: true,
            transactionId: `mm_tx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            processingTime,
          };
        } else {
          return {
            success: false,
            error: 'Payment was declined or cancelled by user',
            processingTime,
          };
        }
      }
    }
    
    // Timeout
    return {
      success: false,
      error: 'Payment request timed out',
      processingTime: timeoutMs,
    };
  }

  private async simulateMobileMoneyReversal(transactionId: string): Promise<void> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In a real implementation, this would make an actual mobile money API call
    this.logger.log(`Simulated mobile money reversal for ${transactionId}`);
  }

  private async simulateMobileMoneyRefund(transactionId: string, amount: number): Promise<any> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const refundId = `mm_refund_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    return {
      refundId,
      originalTransactionId: transactionId,
      amount,
      provider: 'mpesa', // In real implementation, this would be determined from the original transaction
      status: 'completed',
    };
  }

  private validatePhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation (international format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  private maskPhoneNumber(phoneNumber: string): string {
    // Mask phone number for security (show only last 4 digits)
    if (phoneNumber.length <= 4) {
      return phoneNumber;
    }
    
    const visiblePart = phoneNumber.slice(-4);
    const maskedPart = '*'.repeat(phoneNumber.length - 4);
    return maskedPart + visiblePart;
  }

  private calculateMobileMoneyFees(amount: number, provider: string): number {
    // Different providers have different fee structures
    switch (provider) {
      case 'mpesa':
        // M-Pesa fee structure (simplified)
        if (amount <= 100) return 0.50;
        if (amount <= 500) return 1.00;
        if (amount <= 1000) return 2.00;
        return amount * 0.002; // 0.2% for larger amounts
        
      case 'mtn_money':
        // MTN Mobile Money fee structure (simplified)
        return Math.max(0.25, amount * 0.015); // 1.5% with minimum $0.25
        
      case 'airtel_money':
        // Airtel Money fee structure (simplified)
        return Math.max(0.30, amount * 0.012); // 1.2% with minimum $0.30
        
      case 'orange_money':
        // Orange Money fee structure (simplified)
        return Math.max(0.20, amount * 0.018); // 1.8% with minimum $0.20
        
      default:
        return amount * 0.015; // Default 1.5%
    }
  }
}