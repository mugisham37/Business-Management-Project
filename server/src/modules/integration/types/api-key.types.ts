/**
 * API Key validation result
 */
export interface ApiKeyValidationResult {
  isValid: boolean;
  error?: string;
  apiKey?: any;
  rateLimitInfo?: {
    allowed: boolean;
    remaining?: number;
    resetAt?: Date;
  };
}

/**
 * API Key usage statistics
 */
export interface ApiKeyUsageStats {
  apiKeyId: string;
  name: string;
  totalRequests: number;
  lastUsedAt?: Date;
  createdAt: Date;
  isActive: boolean;
  expiresAt?: Date;
  rateLimit: number;
  rateLimitWindow: number;
  currentPeriodRequests: number;
  rateLimitResetAt?: Date;
}
