/**
 * Error Handler Hook
 * Comprehensive error handling utilities for async operations
 */

import { useState, useCallback } from 'react';
import { ApolloError } from '@apollo/client';

export type ErrorType = Error | ApolloError | string | null;

export interface ErrorContext {
  code?: string;
  statusCode?: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface UseErrorHandlerResult {
  error: ErrorContext | null;
  isError: boolean;
  clearError: () => void;
  handleError: (error: ErrorType, message?: string) => void;
  setError: (context: ErrorContext) => void;
}

/**
 * useErrorHandler Hook
 * Handles and normalizes errors from various sources
 */
export function useErrorHandler(): UseErrorHandlerResult {
  const [error, setErrorState] = useState<ErrorContext | null>(null);

  const handleError = useCallback((err: ErrorType, message?: string): void => {
    if (!err) {
      setErrorState(null);
      return;
    }

    let errorContext: ErrorContext;

    if (typeof err === 'string') {
      errorContext = {
        message: message || err,
      };
    } else if (err instanceof ApolloError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const networkError = err.networkError as Record<string, any> | null;
      errorContext = {
        code: err.graphQLErrors?.[0]?.extensions?.code as string || 'APOLLO_ERROR',
        statusCode: networkError?.status || 500,
        message: message || err.message || 'An Apollo error occurred',
        details: {
          graphQLErrors: err.graphQLErrors,
          networkError: err.networkError,
        },
      };
    } else if (err instanceof Error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorObj = err as Record<string, any>;
      errorContext = {
        code: errorObj.code || 'UNKNOWN_ERROR',
        statusCode: errorObj.statusCode || 500,
        message: message || err.message || 'An unknown error occurred',
      };
    } else {
      errorContext = {
        message: message || 'An unexpected error occurred',
      };
    }

    setErrorState(errorContext);
  }, []);

  const clearError = useCallback((): void => {
    setErrorState(null);
  }, []);

  const setError = useCallback((context: ErrorContext): void => {
    setErrorState(context);
  }, []);

  return {
    error,
    isError: error !== null,
    clearError,
    handleError,
    setError,
  };
}

/**
 * withErrorHandler HOC
 * Wraps a function with error handling
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  onError?: (error: ErrorType) => void
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (onError) {
        onError(error as ErrorType);
      }
      throw error;
    }
  }) as T;
}
