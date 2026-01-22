/**
 * Error Handling System - Main Export
 * 
 * Comprehensive error handling system with global error boundaries,
 * network error handling with retry logic, and secure error logging.
 */

import React from 'react';

// Global Error Boundaries
export {
  GlobalErrorBoundary,
  DefaultErrorFallback,
  AppErrorFallback,
  PageErrorFallback,
  ModuleErrorFallback,
  ComponentErrorFallback,
  withErrorBoundary,
  useErrorBoundary,
  type ErrorBoundaryProps,
  type ErrorBoundaryState,
  type ErrorFallbackProps,
} from './global-error-boundary';

// Network Error Handling
export {
  NetworkErrorHandler,
  networkErrorHandler,
  fetchWithRetry,
  useNetworkErrorHandler,
  type NetworkErrorOptions,
  type CircuitBreakerOptions,
  type NetworkErrorState,
  type CircuitState,
} from './network-error-handler';

// Error Logging and Monitoring
export {
  ErrorLogger,
  errorLogger,
  useErrorLogger,
  type ErrorLogEntry,
  type ErrorReportingConfig,
  type ErrorAnalytics,
} from './error-logger';

// GraphQL Error Handling (re-export from existing)
export {
  GraphQLErrorDisplay,
  GraphQLErrorBoundary,
  useGraphQLErrorHandler,
  withGraphQLErrorHandling,
  defaultErrorStyles,
  type GraphQLErrorDisplayProps,
} from '@/lib/graphql/error-handler';

// Import the instances we need
import { errorLogger } from './error-logger';
import { networkErrorHandler } from './network-error-handler';
import {
  GlobalErrorBoundary,
  AppErrorFallback,
  PageErrorFallback,
  ModuleErrorFallback,
  ComponentErrorFallback,
} from './global-error-boundary';

/**
 * Initialize error handling system
 */
export function initializeErrorHandling(config?: {
  errorReporting?: Partial<import('./error-logger').ErrorReportingConfig>;
  networkRetry?: import('./network-error-handler').NetworkErrorOptions;
  circuitBreaker?: import('./network-error-handler').CircuitBreakerOptions;
}) {
  // Update error logger configuration
  if (config?.errorReporting) {
    errorLogger.updateReportingConfig(config.errorReporting);
  }

  // Initialize network error handler with custom config
  if (config?.networkRetry || config?.circuitBreaker) {
    // The global instance is already created, but we can create a new one if needed
    console.log('Error handling system initialized with custom configuration');
  }

  // Log initialization
  errorLogger.logInfo('Error handling system initialized', {
    component: 'error-handling-system',
  }, {
    config: {
      errorReporting: !!config?.errorReporting,
      networkRetry: !!config?.networkRetry,
      circuitBreaker: !!config?.circuitBreaker,
    },
  }, ['initialization']);
}

/**
 * Error handling utilities
 */
export const ErrorHandlingUtils = {
  /**
   * Check if an error is a network error
   */
  isNetworkError: (error: Error): boolean => {
    return networkErrorHandler.isRetryableError(error);
  },

  /**
   * Get error analytics summary
   */
  getErrorSummary: () => {
    return errorLogger.getAnalytics();
  },

  /**
   * Export error logs for debugging
   */
  exportErrorLogs: (filter?: (entry: import('./error-logger').ErrorLogEntry) => boolean) => {
    return errorLogger.exportLogs(filter);
  },

  /**
   * Clear all error logs
   */
  clearErrorLogs: () => {
    errorLogger.clearLogs();
  },

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus: () => {
    return {
      state: networkErrorHandler.getCircuitBreakerState(),
      stats: networkErrorHandler.getCircuitBreakerStats(),
    };
  },
};

/**
 * Error boundary hierarchy setup helper
 */
export function setupErrorBoundaryHierarchy() {
  return {
    App: ({ children }: { children: React.ReactNode }) => (
      React.createElement(GlobalErrorBoundary, {
        level: "app" as const,
        fallback: AppErrorFallback,
        onError: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => {
          errorLogger.logError(error, {
            component: 'app-boundary',
            operationId: errorId,
          }, { errorInfo }, ['app-error', 'critical']);
        },
      }, children)
    ),

    Page: ({ children }: { children: React.ReactNode }) => (
      React.createElement(GlobalErrorBoundary, {
        level: "page" as const,
        fallback: PageErrorFallback,
        onError: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => {
          errorLogger.logError(error, {
            component: 'page-boundary',
            operationId: errorId,
          }, { errorInfo }, ['page-error']);
        },
      }, children)
    ),

    Module: ({ children, moduleName }: { children: React.ReactNode; moduleName?: string }) => (
      React.createElement(GlobalErrorBoundary, {
        level: "module" as const,
        fallback: ModuleErrorFallback,
        onError: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => {
          errorLogger.logError(error, {
            component: moduleName || 'unknown-module',
            operationId: errorId,
          }, { errorInfo }, ['module-error']);
        },
      }, children)
    ),

    Component: ({ children, componentName }: { children: React.ReactNode; componentName?: string }) => (
      React.createElement(GlobalErrorBoundary, {
        level: "component" as const,
        fallback: ComponentErrorFallback,
        onError: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => {
          errorLogger.logError(error, {
            component: componentName || 'unknown-component',
            operationId: errorId,
          }, { errorInfo }, ['component-error']);
        },
      }, children)
    )
  };
}