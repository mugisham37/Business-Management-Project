// Core library exports
export * from './auth';
export * from './tenant';
export * from './utils';

// Apollo Client exports (with explicit imports to avoid conflicts)
export { apolloClient as default, apolloClient } from './apollo/client';
export { ApolloProvider } from './apollo/provider';
export {
  updateCacheAfterMutation,
  cacheInvalidation,
  optimisticUpdates,
  cacheDebug,
} from './apollo/cache-utils';

export {
  gql,
  useQuery,
  useMutation,
  useLazyQuery,
  useApolloClient,
  type QueryResult,
  type MutationResult,
  type LazyQueryResult,
  type ApolloError,
  type FetchPolicy,
  type ErrorPolicy,
} from '@apollo/client';

// Subscription exports (non-conflicting)
export { 
  SubscriptionManager, 
  subscriptionManager,
  type ConnectionStatus,
  type SubscriptionOptions,
} from './subscriptions/subscription-manager';

export {
  useSubscriptionStatus,
  useTenantSubscription,
  useMultipleSubscriptions,
  useResilientSubscription
} from './subscriptions/hooks';

export {
  TenantSubscriptionFilter,
  tenantSubscriptionFilter,
  type TenantFilterConfig,
  type TenantSubscriptionEvent
} from './subscriptions/tenant-filter';

export {
  SubscriptionAuthHandler,
  subscriptionAuthHandler,
  type AuthState as SubscriptionAuthState
} from './subscriptions/auth-handler';

// Re-export commonly used types
export type {
  User,
  Tenant,
  TokenPair,
  AuthState,
  TenantContext,
  BusinessTier,
  Permission,
  FeatureFlag,
  GraphQLOperation,
  AppError,
} from '@/types/core';