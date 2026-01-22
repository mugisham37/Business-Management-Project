/**
 * GraphQL Library Index
 * 
 * Exports all GraphQL-related utilities, components, and types
 * for easy importing throughout the application.
 */

// Schema validation utilities
export {
  SchemaValidator,
  validateAllOperations,
  runSchemaValidation,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type BreakingChange,
} from './schema-validator';

// Error handling utilities
export {
  parseGraphQLError,
  createOperationMetadata,
  validateOperationVariables,
  getOperationName,
  getOperationType,
  formatOperationForLogging,
  createUserFriendlyErrorMessage,
  isGraphQLError,
  extractErrorFieldPath,
  type EnhancedGraphQLError,
  type GraphQLErrorResponse,
  type OperationMetadata,
} from './utils';

// Error handling components
export {
  GraphQLErrorDisplay,
  GraphQLErrorBoundary,
  useGraphQLErrorHandler,
  withGraphQLErrorHandling,
  defaultErrorStyles,
  type GraphQLErrorDisplayProps,
  type ErrorBoundaryState,
} from './error-handler';

// Re-export commonly used types from Apollo Client
export type {
  ApolloError,
  DocumentNode,
  TypedDocumentNode,
} from '@apollo/client';