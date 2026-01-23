// Type definitions exports
export * from './core';
export * from './communication';
export * from './realtime';
export * from './employee';

// Re-export generated types when available (excluding conflicting types)
export type {
  // GraphQL operation types
  LoginMutation,
  LoginMutationVariables,
  RefreshTokenMutation,
  RefreshTokenMutationVariables,
  LogoutMutation,
  LogoutMutationVariables,
  GetCurrentUserQuery,
  GetCurrentUserQueryVariables,
  GetUsersQuery,
  GetUsersQueryVariables,
  
  // GraphQL result types
  AuthResult,
  
  // Hook types
  LoginMutationFn,
  RefreshTokenMutationFn,
  LogoutMutationFn,
  
  // Scalars
  Scalars,
  Maybe,
  InputMaybe,
  Exact,
  MakeOptional,
  MakeMaybe,
  MakeEmpty,
  Incremental,
} from './generated/graphql';