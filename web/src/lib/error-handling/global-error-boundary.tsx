/**
 * Global Error Boundary System
 * 
 * Provides hierarchical error boundaries for different error types and contexts.
 * Implements comprehensive error containment with fallback UI components.
 */

'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { performanceMonitor } from '@/lib/performance/performance-monitor';

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  timestamp?: number;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  level?: 'app' | 'page' | 'module' | 'component';
  isolateErrors?: boolean;
}

export interface ErrorFallbackProps {
  error: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
  retry: () => void;
  level: string;
}

/**
 * Generate unique error ID for tracking
 */
function generateErrorId(): string {
  return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Global Error Boundary Component
 */
export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorId: string = '';

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorId = generateErrorId();
    return {
      hasError: true,
      error,
      errorId,
      timestamp: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.errorId = this.state.errorId || generateErrorId();
    
    this.setState({
      error,
      errorInfo,
      errorId: this.errorId,
      timestamp: Date.now(),
    });

    // Record error in performance monitoring
    performanceMonitor.recordError();

    // Log error with context
    this.logError(error, errorInfo, this.errorId);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, this.errorId);
    }

    // Report to error monitoring service
    this.reportError(error, errorInfo, this.errorId);
  }

  private logError(error: Error, errorInfo: ErrorInfo, errorId: string) {
    const errorContext = {
      errorId,
      level: this.props.level || 'component',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
    };

    console.group(`🚨 Error Boundary Caught Error [${errorId}]`);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Context:', errorContext);
    console.groupEnd();
  }

  private reportError(error: Error, errorInfo: ErrorInfo, errorId: string) {
    // In a real application, this would send to an error monitoring service
    // like Sentry, LogRocket, or Bugsnag
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: { errorInfo, errorId } });
      console.log('Error reported to monitoring service:', errorId);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined,
      timestamp: undefined,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId || 'unknown'}
          retry={this.handleRetry}
          level={this.props.level || 'component'}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback Component
 */
export function DefaultErrorFallback({
  error,
  errorInfo,
  errorId,
  retry,
  level,
}: ErrorFallbackProps) {
  const isProduction = process.env.NODE_ENV === 'production';

  return (
    <div className={`error-fallback error-fallback--${level}`}>
      <div className="error-fallback__content">
        <div className="error-fallback__icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="error-fallback__title">
          {level === 'app' ? 'Application Error' : 
           level === 'page' ? 'Page Error' :
           level === 'module' ? 'Module Error' : 'Something went wrong'}
        </h2>

        <p className="error-fallback__message">
          {isProduction 
            ? 'An unexpected error occurred. Please try again or contact support if the problem persists.'
            : error.message
          }
        </p>

        {!isProduction && (
          <details className="error-fallback__details">
            <summary>Technical Details</summary>
            <div className="error-fallback__technical">
              <div className="error-fallback__section">
                <h4>Error ID:</h4>
                <code>{errorId}</code>
              </div>
              
              <div className="error-fallback__section">
                <h4>Error Message:</h4>
                <pre>{error.message}</pre>
              </div>

              <div className="error-fallback__section">
                <h4>Stack Trace:</h4>
                <pre>{error.stack}</pre>
              </div>

              {errorInfo && (
                <div className="error-fallback__section">
                  <h4>Component Stack:</h4>
                  <pre>{errorInfo.componentStack}</pre>
                </div>
              )}
            </div>
          </details>
        )}

        <div className="error-fallback__actions">
          <button
            onClick={retry}
            className="error-fallback__button error-fallback__button--primary"
            type="button"
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="error-fallback__button error-fallback__button--secondary"
            type="button"
          >
            Reload Page
          </button>
        </div>

        {isProduction && (
          <div className="error-fallback__support">
            <p>Error ID: <code>{errorId}</code></p>
            <p>Please include this ID when contacting support.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Specialized Error Fallbacks for different contexts
 */

export function AppErrorFallback(props: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <DefaultErrorFallback {...props} />
    </div>
  );
}

export function PageErrorFallback(props: ErrorFallbackProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <DefaultErrorFallback {...props} />
    </div>
  );
}

export function ModuleErrorFallback(props: ErrorFallbackProps) {
  return (
    <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
      <DefaultErrorFallback {...props} />
    </div>
  );
}

export function ComponentErrorFallback(props: ErrorFallbackProps) {
  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded border border-red-200 dark:border-red-800">
      <div className="text-center">
        <div className="text-red-600 dark:text-red-400 mb-2">
          <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
          Component Error
        </h3>
        <p className="text-xs text-red-700 dark:text-red-300 mb-3">
          {process.env.NODE_ENV === 'production' 
            ? 'This component failed to load.'
            : props.error.message
          }
        </p>
        <button
          onClick={props.retry}
          className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

/**
 * Higher-order component for wrapping components with error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: React.ComponentType<ErrorFallbackProps>;
    level?: 'app' | 'page' | 'module' | 'component';
    onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  }
) {
  return function WrappedComponent(props: P) {
    return (
      <GlobalErrorBoundary
        fallback={options?.fallback}
        level={options?.level || 'component'}
        onError={options?.onError}
      >
        <Component {...props} />
      </GlobalErrorBoundary>
    );
  };
}

/**
 * Hook for error boundary context
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    captureError,
    resetError,
  };
}