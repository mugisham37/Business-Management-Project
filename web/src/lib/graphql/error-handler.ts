/**
 * GraphQL Error Handler
 * Handles GraphQL-specific errors and provides error boundaries
 */

import React from 'react';
import { ApolloError } from '@apollo/client';

export interface GraphQLErrorDisplayProps {
  error?: ApolloError | Error;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export const defaultErrorStyles = {
  container: {
    padding: '16px',
    marginBottom: '16px',
    backgroundColor: '#ffebee',
    border: '1px solid #ef5350',
    borderRadius: '4px',
  },
  title: {
    color: '#c62828',
    marginTop: 0,
    marginBottom: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  message: {
    color: '#b71c1c',
    marginTop: '8px',
    marginBottom: '8px',
    fontSize: '14px',
  },
  button: {
    marginRight: '8px',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

/**
 * GraphQL Error Display Component
 */
export const GraphQLErrorDisplay: React.FC<GraphQLErrorDisplayProps> = ({
  error,
  onDismiss,
  onRetry,
}) => {
  if (!error) return null;

  const errorMessage = error instanceof ApolloError
    ? error.message || 'An error occurred'
    : error.message || 'An unknown error occurred';

  return (
    <div style={defaultErrorStyles.container as React.CSSProperties}>
      <h3 style={defaultErrorStyles.title as React.CSSProperties}>
        GraphQL Error
      </h3>
      <p style={defaultErrorStyles.message as React.CSSProperties}>
        {errorMessage}
      </p>
      <div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              ...defaultErrorStyles.button,
              backgroundColor: '#1976d2',
              color: 'white',
            } as React.CSSProperties}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              ...defaultErrorStyles.button,
              backgroundColor: '#e0e0e0',
              color: '#333',
            } as React.CSSProperties}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * GraphQL Error Boundary Component
 */
export interface GraphQLErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactElement;
  onError?: (error: ApolloError) => void;
}

export class GraphQLErrorBoundary extends React.Component<
  GraphQLErrorBoundaryProps,
  { error: ApolloError | null }
> {
  constructor(props: GraphQLErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): { error: ApolloError } {
    return {
      error: error instanceof ApolloError ? error : new ApolloError({ errorMessage: error.message }),
    };
  }

  componentDidCatch(error: Error) {
    if (this.props.onError && error instanceof ApolloError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.error) {
      return this.props.fallback || <GraphQLErrorDisplay error={this.state.error} />;
    }
    return this.props.children;
  }
}

/**
 * Hook to handle GraphQL errors
 */
export function useGraphQLErrorHandler() {
  const [error, setError] = React.useState<ApolloError | null>(null);

  const handleError = (apolloError: ApolloError) => {
    setError(apolloError);
  };

  const clearError = () => {
    setError(null);
  };

  return { error, handleError, clearError };
}

/**
 * HOC to wrap component with GraphQL error handling
 */
export function withGraphQLErrorHandling<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return (props: P) => (
    <GraphQLErrorBoundary>
      <Component {...props} />
    </GraphQLErrorBoundary>
  );
}
