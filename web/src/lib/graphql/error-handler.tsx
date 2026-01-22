/**
 * GraphQL Error Handler Components
 * 
 * Provides React components for handling and displaying GraphQL errors
 * with user-friendly messages and recovery options.
 */

import React, { ErrorInfo } from 'react';
import { ApolloError } from '@apollo/client';
import { parseGraphQLError, GraphQLErrorResponse, createUserFriendlyErrorMessage } from './utils';

export interface GraphQLErrorDisplayProps {
  error: ApolloError;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * Component for displaying GraphQL errors with user-friendly messages
 */
export function GraphQLErrorDisplay({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  className = '',
}: GraphQLErrorDisplayProps) {
  const errorResponses = parseGraphQLError(error);
  const mainMessage = createUserFriendlyErrorMessage(errorResponses);

  return (
    <div className={`graphql-error-display ${className}`}>
      <div className="error-header">
        <h3 className="error-title">Something went wrong</h3>
        <p className="error-message">{mainMessage}</p>
      </div>

      {errorResponses.length > 0 && (
        <div className="error-details">
          {errorResponses.map((errorResponse, index) => (
            <ErrorResponseItem
              key={index}
              errorResponse={errorResponse}
              showDetails={showDetails}
            />
          ))}
        </div>
      )}

      <div className="error-actions">
        {onRetry && (
          <button
            onClick={onRetry}
            className="retry-button"
            type="button"
          >
            Try Again
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="dismiss-button"
            type="button"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Individual error response item component
 */
function ErrorResponseItem({
  errorResponse,
  showDetails,
}: {
  errorResponse: GraphQLErrorResponse;
  showDetails: boolean;
}) {
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);

  return (
    <div className="error-response-item">
      <div className="error-response-header">
        <span className="error-code">{errorResponse.code}</span>
        {errorResponse.field && (
          <span className="error-field">Field: {errorResponse.field}</span>
        )}
      </div>

      <p className="error-response-message">{errorResponse.message}</p>

      {errorResponse.suggestions && errorResponse.suggestions.length > 0 && (
        <div className="error-suggestions">
          <h4>Suggestions:</h4>
          <ul>
            {errorResponse.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      {showDetails && errorResponse.details && (
        <div className="error-technical-details">
          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="details-toggle"
            type="button"
          >
            {detailsExpanded ? 'Hide' : 'Show'} Technical Details
          </button>
          
          {detailsExpanded && (
            <pre className="error-details-content">
              {JSON.stringify(errorResponse.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Error boundary for catching GraphQL and React errors
 */
export class GraphQLErrorBoundary extends React.Component<
  React.PropsWithChildren<{
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  }>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  }>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error for debugging
    console.error('GraphQL Error Boundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null as unknown as Error, 
      errorInfo: null as unknown as ErrorInfo,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback component if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.handleRetry} />;
      }

      // Default error display
      return (
        <div className="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <p>An unexpected error occurred while rendering this component.</p>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error.message}</pre>
            {this.state.errorInfo && (
              <pre>{this.state.errorInfo.componentStack}</pre>
            )}
          </details>
          <button onClick={this.handleRetry} type="button">
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for handling GraphQL errors in components
 */
export function useGraphQLErrorHandler() {
  const [errors, setErrors] = React.useState<GraphQLErrorResponse[]>([]);

  const handleError = React.useCallback((error: ApolloError) => {
    const errorResponses = parseGraphQLError(error);
    setErrors(errorResponses);
  }, []);

  const clearErrors = React.useCallback(() => {
    setErrors([]);
  }, []);

  const hasErrors = errors.length > 0;
  const mainErrorMessage = hasErrors ? createUserFriendlyErrorMessage(errors) : null;

  return {
    errors,
    hasErrors,
    mainErrorMessage,
    handleError,
    clearErrors,
  };
}

/**
 * Higher-order component for wrapping components with error handling
 */
export function withGraphQLErrorHandling<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WrappedComponent(props: P) {
    return (
      <GraphQLErrorBoundary>
        <Component {...props} />
      </GraphQLErrorBoundary>
    );
  };
}

/**
 * Default styles for error components (can be customized)
 */
export const defaultErrorStyles = `
  .graphql-error-display {
    border: 1px solid #ef4444;
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
    background-color: #fef2f2;
    color: #991b1b;
  }

  .error-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .error-message {
    margin: 0 0 16px 0;
    font-size: 14px;
  }

  .error-response-item {
    border-top: 1px solid #fca5a5;
    padding-top: 12px;
    margin-top: 12px;
  }

  .error-response-item:first-child {
    border-top: none;
    padding-top: 0;
    margin-top: 0;
  }

  .error-response-header {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
  }

  .error-code {
    background-color: #dc2626;
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .error-field {
    background-color: #f59e0b;
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .error-suggestions {
    margin-top: 12px;
  }

  .error-suggestions h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .error-suggestions ul {
    margin: 0;
    padding-left: 20px;
  }

  .error-suggestions li {
    margin-bottom: 4px;
    font-size: 13px;
  }

  .error-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }

  .retry-button, .dismiss-button {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .retry-button {
    background-color: #dc2626;
    color: white;
  }

  .retry-button:hover {
    background-color: #b91c1c;
  }

  .dismiss-button {
    background-color: #6b7280;
    color: white;
  }

  .dismiss-button:hover {
    background-color: #4b5563;
  }

  .details-toggle {
    background: none;
    border: none;
    color: #dc2626;
    text-decoration: underline;
    cursor: pointer;
    font-size: 12px;
    padding: 0;
    margin-top: 8px;
  }

  .error-details-content {
    background-color: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 12px;
    margin-top: 8px;
    font-size: 11px;
    overflow-x: auto;
  }

  .error-boundary-fallback {
    border: 1px solid #ef4444;
    border-radius: 8px;
    padding: 24px;
    margin: 16px 0;
    background-color: #fef2f2;
    text-align: center;
  }

  .error-boundary-fallback h2 {
    color: #991b1b;
    margin: 0 0 12px 0;
  }

  .error-boundary-fallback p {
    color: #7f1d1d;
    margin: 0 0 16px 0;
  }

  .error-boundary-fallback details {
    text-align: left;
    margin: 16px 0;
  }

  .error-boundary-fallback pre {
    background-color: #f3f4f6;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 12px;
  }

  .error-boundary-fallback button {
    background-color: #dc2626;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
  }

  .error-boundary-fallback button:hover {
    background-color: #b91c1c;
  }
`;