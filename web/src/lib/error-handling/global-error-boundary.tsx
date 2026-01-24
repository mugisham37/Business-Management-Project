/**
 * Global Error Boundary
 * Comprehensive error boundary for React applications
 */

import React, { ReactNode, ReactElement } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactElement | ((error: Error, retry: () => void) => ReactElement);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'app' | 'page' | 'module' | 'component';
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export interface ErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo | null;
  retry?: () => void;
  level?: string;
}

/**
 * Global Error Boundary Component
 */
export class GlobalErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    console.error('Error caught by boundary:', error, errorInfo);
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error, this.retry);
        }
        return this.props.fallback;
      }

      // Default fallback based on level
      const level = this.props.level || 'app';
      switch (level) {
        case 'app':
          return <AppErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} retry={this.retry} />;
        case 'page':
          return <PageErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} retry={this.retry} />;
        case 'module':
          return <ModuleErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} retry={this.retry} />;
        case 'component':
          return <ComponentErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} retry={this.retry} />;
        default:
          return <DefaultErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} retry={this.retry} />;
      }
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback Component
 */
export function DefaultErrorFallback({ error, errorInfo, retry }: ErrorFallbackProps) {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Something went wrong</h2>
      <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
        <summary>Error details</summary>
        {error && error.toString()}
        {'\n\n'}
        {errorInfo && errorInfo.componentStack}
      </details>
      {retry && (
        <button onClick={retry} style={{ marginTop: '10px', padding: '10px' }}>
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * App-level Error Fallback
 */
export function AppErrorFallback({ error, errorInfo, retry }: ErrorFallbackProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f5f5f5' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '500px' }}>
        <h1 style={{ color: '#d32f2f', marginTop: 0 }}>Application Error</h1>
        <p>We're sorry, but the application encountered an error.</p>
        <p style={{ color: '#666' }}>{error?.message}</p>
        {retry && (
          <button
            onClick={retry}
            style={{
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reload Application
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Page-level Error Fallback
 */
export function PageErrorFallback({ error, errorInfo, retry }: ErrorFallbackProps) {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffc107', padding: '20px', borderRadius: '4px' }}>
        <h2 style={{ color: '#d39e00', marginTop: 0 }}>Page Error</h2>
        <p>This page encountered an error while loading.</p>
        <p style={{ color: '#666' }}>{error?.message}</p>
        {retry && (
          <button
            onClick={retry}
            style={{
              backgroundColor: '#d39e00',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry Page
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Module-level Error Fallback
 */
export function ModuleErrorFallback({ error, errorInfo, retry }: ErrorFallbackProps) {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
      <h3 style={{ color: '#d32f2f', marginTop: 0 }}>Module Error</h3>
      <p>{error?.message}</p>
      {retry && (
        <button
          onClick={retry}
          style={{
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Retry Module
        </button>
      )}
    </div>
  );
}

/**
 * Component-level Error Fallback
 */
export function ComponentErrorFallback({ error }: ErrorFallbackProps) {
  return (
    <div style={{ padding: '10px', fontFamily: 'sans-serif', color: '#d32f2f', fontSize: '12px' }}>
      Component error: {error?.message}
    </div>
  );
}

/**
 * HOC to wrap component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  return (props: P) => (
    <GlobalErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </GlobalErrorBoundary>
  );
}

/**
 * Hook to use error boundary
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureException: setError };
}
