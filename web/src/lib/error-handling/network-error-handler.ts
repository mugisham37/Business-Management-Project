/**
 * Network Error Handler with Retry Logic
 * 
 * Implements exponential backoff retry, circuit breaker pattern,
 * and user feedback for network-related errors.
 */

export interface NetworkErrorOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  timeout?: number;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
  onMaxRetriesReached?: (error: Error) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
}

export interface NetworkErrorState {
  isRetrying: boolean;
  retryCount: number;
  lastError?: Error;
  nextRetryAt?: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<NetworkErrorOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  timeout: 10000,
  retryCondition: (error: Error) => {
    // Retry on network errors, timeouts, and 5xx server errors
    return (
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError' ||
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      ((error as { status?: number }).status ?? 0) >= 500
    );
  },
  onRetry: () => {},
  onMaxRetriesReached: () => {},
};

/**
 * Circuit Breaker for preventing cascading failures
 */
class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private options: Required<CircuitBreakerOptions>) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = 'CLOSED';
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
    };
  }
}

/**
 * Network Error Handler with exponential backoff and circuit breaker
 */
export class NetworkErrorHandler {
  private circuitBreaker: CircuitBreaker;
  private activeRetries = new Map<string, NetworkErrorState>();

  constructor(
    private options: NetworkErrorOptions = {},
    circuitBreakerOptions: CircuitBreakerOptions = {}
  ) {
    const cbOptions: Required<CircuitBreakerOptions> = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 10000, // 10 seconds
      ...circuitBreakerOptions,
    };

    this.circuitBreaker = new CircuitBreaker(cbOptions);
  }

  /**
   * Execute operation with retry logic and circuit breaker
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationId?: string,
    customOptions?: NetworkErrorOptions
  ): Promise<T> {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...this.options, ...customOptions };
    const id = operationId || this.generateOperationId();

    // Initialize retry state
    this.activeRetries.set(id, {
      isRetrying: false,
      retryCount: 0,
    });

    try {
      return await this.circuitBreaker.execute(async () => {
        return await this.retryOperation(operation, id, config);
      });
    } finally {
      this.activeRetries.delete(id);
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationId: string,
    config: Required<NetworkErrorOptions>
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      const state = this.activeRetries.get(operationId)!;
      
      try {
        // Add timeout to the operation
        const result = await this.withTimeout(operation(), config.timeout);
        
        // Success - reset retry state
        this.activeRetries.set(operationId, {
          ...state,
          isRetrying: false,
          retryCount: attempt,
        });

        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Update retry state
        this.activeRetries.set(operationId, {
          ...state,
          isRetrying: attempt < config.maxRetries,
          retryCount: attempt,
          lastError,
        });

        // Check if we should retry this error
        if (attempt === config.maxRetries || !config.retryCondition(lastError)) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, config);
        
        // Update next retry time
        this.activeRetries.set(operationId, {
          ...state,
          isRetrying: true,
          retryCount: attempt,
          lastError,
          nextRetryAt: Date.now() + delay,
        });

        // Call retry callback
        config.onRetry(attempt + 1, lastError);

        // Wait before retrying
        await this.delay(delay);
      }
    }

    // Max retries reached
    config.onMaxRetriesReached(lastError!);
    throw lastError!;
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private calculateDelay(attempt: number, config: Required<NetworkErrorOptions>): number {
    let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    
    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  /**
   * Add timeout to a promise
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get retry state for an operation
   */
  getRetryState(operationId: string): NetworkErrorState | undefined {
    return this.activeRetries.get(operationId);
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error: Error): boolean {
    return DEFAULT_RETRY_OPTIONS.retryCondition(error);
  }
}

/**
 * Global network error handler instance
 */
export const networkErrorHandler = new NetworkErrorHandler();

/**
 * Utility function for wrapping fetch with retry logic
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: NetworkErrorOptions
): Promise<Response> {
  return networkErrorHandler.executeWithRetry(async () => {
    const response = await fetch(input, init);
    
    // Treat HTTP error status as errors for retry logic
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & {
        status: number;
        response: Response;
      };
      error.status = response.status;
      error.response = response;
      throw error;
    }
    
    return response;
  }, `fetch_${input.toString()}`, options);
}

/**
 * React hook for network error handling
 */
export function useNetworkErrorHandler(options?: NetworkErrorOptions) {
  const [errorState, setErrorState] = React.useState<{
    isRetrying: boolean;
    retryCount: number;
    lastError?: Error;
    nextRetryAt?: number;
  }>({
    isRetrying: false,
    retryCount: 0,
  });

  const executeWithRetry = React.useCallback(async <T>(
    operation: () => Promise<T>,
    operationId?: string
  ): Promise<T> => {
    const id = operationId || `hook_${Date.now()}`;
    
    try {
      setErrorState({ isRetrying: true, retryCount: 0 });
      
      const result = await networkErrorHandler.executeWithRetry(
        operation,
        id,
        {
          ...options,
          onRetry: (attempt, error) => {
            setErrorState({
              isRetrying: true,
              retryCount: attempt,
              lastError: error,
            });
            options?.onRetry?.(attempt, error);
          },
        }
      );
      
      setErrorState({ isRetrying: false, retryCount: 0 });
      return result;
    } catch (error) {
      setErrorState({
        isRetrying: false,
        retryCount: errorState.retryCount,
        lastError: error as Error,
      });
      throw error;
    }
  }, [options, errorState.retryCount]);

  const circuitBreakerState = networkErrorHandler.getCircuitBreakerState();

  return {
    executeWithRetry,
    errorState,
    circuitBreakerState,
    isRetrying: errorState.isRetrying,
    retryCount: errorState.retryCount,
    lastError: errorState.lastError,
  };
}

// Add React import for the hook
import React from 'react';