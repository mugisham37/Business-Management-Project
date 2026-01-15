export interface PaymentProviderRequest {
  amount: number;
  paymentReference?: string;
  metadata?: Record<string, any>;
}

export interface PaymentProviderResult {
  success: boolean;
  providerTransactionId?: string;
  providerResponse?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  success: boolean;
  providerTransactionId?: string;
  providerResponse?: Record<string, any>;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface PaymentProvider {
  getProviderName(): string;
  
  processPayment(request: PaymentProviderRequest): Promise<PaymentProviderResult>;
  
  voidPayment(providerTransactionId: string): Promise<void>;
  
  refundPayment(providerTransactionId: string, amount: number): Promise<RefundResult>;
  
  validatePayment(amount: number, metadata?: Record<string, any>): Promise<ValidationResult>;
}