/**
 * GraphQL Utilities
 * 
 * Provides utilities for working with GraphQL operations, error handling,
 * and type safety enhancements.
 */

import { ApolloError, DocumentNode, TypedDocumentNode } from '@apollo/client';
import { GraphQLError } from 'graphql';

/**
 * Enhanced GraphQL error with additional context
 */
export interface EnhancedGraphQLError extends GraphQLError {
  code?: string;
  field?: string;
  context?: Record<string, unknown>;
  userMessage?: string;
}

/**
 * Standardized error response format
 */
export interface GraphQLErrorResponse {
  message: string;
  code: string;
  field?: string;
  details?: Record<string, unknown>;
  suggestions?: string[];
}

/**
 * Operation metadata for better debugging
 */
export interface OperationMetadata {
  operationName?: string;
  operationType: 'query' | 'mutation' | 'subscription';
  variables?: Record<string, unknown> | undefined;
  timestamp: Date;
}

/**
 * Parse and enhance GraphQL errors for better user experience
 */
export function parseGraphQLError(error: ApolloError): GraphQLErrorResponse[] {
  const responses: GraphQLErrorResponse[] = [];

  // Handle network errors
  if (error.networkError) {
    responses.push({
      message: 'Network connection failed. Please check your internet connection.',
      code: 'NETWORK_ERROR',
      details: {
        originalError: error.networkError.message,
      },
      suggestions: [
        'Check your internet connection',
        'Verify the GraphQL endpoint is accessible',
        'Try refreshing the page',
      ],
    });
  }

  // Handle GraphQL errors
  if (error.graphQLErrors && error.graphQLErrors.length > 0) {
    for (const gqlError of error.graphQLErrors) {
      const enhancedError = gqlError as EnhancedGraphQLError;
      
      const errorResponse: GraphQLErrorResponse = {
        message: enhancedError.userMessage || enhancedError.message,
        code: enhancedError.code || 'GRAPHQL_ERROR',
        details: {
          path: enhancedError.path,
          locations: enhancedError.locations,
          extensions: enhancedError.extensions,
        },
        suggestions: generateErrorSuggestions(enhancedError),
      };
      
      if (enhancedError.field !== undefined) {
        errorResponse.field = enhancedError.field;
      }
      
      responses.push(errorResponse);
    }
  }

  // Handle unknown errors
  if (responses.length === 0) {
    responses.push({
      message: 'An unexpected error occurred. Please try again.',
      code: 'UNKNOWN_ERROR',
      details: {
        originalMessage: error.message,
      },
      suggestions: [
        'Try refreshing the page',
        'Contact support if the problem persists',
      ],
    });
  }

  return responses;
}

/**
 * Generate helpful suggestions based on error type
 */
function generateErrorSuggestions(error: EnhancedGraphQLError): string[] {
  const suggestions: string[] = [];

  if (error.code) {
    switch (error.code) {
      case 'UNAUTHENTICATED':
        suggestions.push('Please log in to continue');
        suggestions.push('Your session may have expired');
        break;
      
      case 'FORBIDDEN':
        suggestions.push('You may not have permission for this action');
        suggestions.push('Contact your administrator for access');
        break;
      
      case 'VALIDATION_ERROR':
        suggestions.push('Please check your input and try again');
        if (error.field) {
          suggestions.push(`Check the "${error.field}" field`);
        }
        break;
      
      case 'NOT_FOUND':
        suggestions.push('The requested resource may have been deleted');
        suggestions.push('Try refreshing the page');
        break;
      
      case 'RATE_LIMITED':
        suggestions.push('Please wait a moment before trying again');
        suggestions.push('You may be making requests too quickly');
        break;
      
      default:
        suggestions.push('Please try again');
        break;
    }
  }

  return suggestions;
}

/**
 * Create operation metadata for debugging
 */
export function createOperationMetadata(
  operation: DocumentNode | TypedDocumentNode,
  variables?: Record<string, unknown>
): OperationMetadata {
  const definition = operation.definitions[0];
  
  let operationType: 'query' | 'mutation' | 'subscription' = 'query';
  let operationName: string | undefined;

  if (definition && definition.kind === 'OperationDefinition') {
    operationType = definition.operation;
    operationName = definition.name?.value;
  }

  const result: OperationMetadata = {
    operationType,
    variables,
    timestamp: new Date(),
  };
  
  if (operationName !== undefined) {
    result.operationName = operationName;
  }

  return result;
}

/**
 * Validate operation variables against expected types
 */
export function validateOperationVariables(
  variables: Record<string, unknown>,
  expectedTypes: Record<string, string>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [key, expectedType] of Object.entries(expectedTypes)) {
    const value = variables[key];

    if (value === undefined || value === null) {
      if (!expectedType.endsWith('!')) {
        continue; // Optional field
      }
      errors.push(`Required variable "${key}" is missing`);
      continue;
    }

    // Basic type checking (can be enhanced)
    const baseType = expectedType.replace(/[!\[\]]/g, '');
    
    switch (baseType) {
      case 'String':
        if (typeof value !== 'string') {
          errors.push(`Variable "${key}" must be a string`);
        }
        break;
      
      case 'Int':
      case 'Float':
        if (typeof value !== 'number') {
          errors.push(`Variable "${key}" must be a number`);
        }
        break;
      
      case 'Boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Variable "${key}" must be a boolean`);
        }
        break;
      
      case 'ID':
        if (typeof value !== 'string' && typeof value !== 'number') {
          errors.push(`Variable "${key}" must be a string or number (ID)`);
        }
        break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Extract operation name from DocumentNode
 */
export function getOperationName(operation: DocumentNode | TypedDocumentNode): string | null {
  const definition = operation.definitions[0];
  
  if (definition && definition.kind === 'OperationDefinition' && definition.name) {
    return definition.name.value;
  }
  
  return null;
}

/**
 * Check if an operation is a query, mutation, or subscription
 */
export function getOperationType(operation: DocumentNode | TypedDocumentNode): 'query' | 'mutation' | 'subscription' | null {
  const definition = operation.definitions[0];
  
  if (definition && definition.kind === 'OperationDefinition') {
    return definition.operation;
  }
  
  return null;
}

/**
 * Format GraphQL operation for logging
 */
export function formatOperationForLogging(
  operation: DocumentNode | TypedDocumentNode,
  variables?: Record<string, unknown>
): string {
  const name = getOperationName(operation) || 'UnnamedOperation';
  const type = getOperationType(operation) || 'unknown';
  
  let formatted = `${type.toUpperCase()}: ${name}`;
  
  if (variables && Object.keys(variables).length > 0) {
    formatted += ` (variables: ${JSON.stringify(variables, null, 2)})`;
  }
  
  return formatted;
}

/**
 * Create a user-friendly error message from GraphQL errors
 */
export function createUserFriendlyErrorMessage(errors: GraphQLErrorResponse[]): string {
  if (errors.length === 0) {
    return 'An unknown error occurred';
  }

  if (errors.length === 1) {
    return errors[0]!.message;
  }

  // Multiple errors - create a summary
  const errorTypes = [...new Set(errors.map(e => e.code))];
  
  if (errorTypes.length === 1) {
    return `${errors.length} ${errorTypes[0]!.toLowerCase().replace('_', ' ')} errors occurred`;
  }

  return `Multiple errors occurred: ${errorTypes.join(', ').toLowerCase().replace(/_/g, ' ')}`;
}

/**
 * Type guard for checking if an error is a GraphQL error
 */
export function isGraphQLError(error: unknown): error is ApolloError {
  return typeof error === 'object' && error !== null && (
    'graphQLErrors' in error || 'networkError' in error
  );
}

/**
 * Extract field path from GraphQL error for better UX
 */
export function extractErrorFieldPath(error: GraphQLError): string | null {
  if (error.path && error.path.length > 0) {
    return error.path.join('.');
  }
  return null;
}