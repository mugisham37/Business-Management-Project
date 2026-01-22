import { ApolloClient, InMemoryCache, createHttpLink, from, split, ApolloLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { config } from '@/lib/config/env';

// Cache configuration with type policies
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // Implement pagination and caching strategies
        users: {
          keyArgs: ['filter'],
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          },
        },
        tenants: {
          keyArgs: ['filter'],
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          },
        },
      },
    },
    User: {
      fields: {
        permissions: {
          merge: false, // Replace instead of merging
        },
      },
    },
    Tenant: {
      fields: {
        features: {
          merge: false, // Replace instead of merging
        },
      },
    },
  },
  possibleTypes: {
    // Will be populated by introspection
  },
});

// HTTP Link for queries and mutations
const httpLink = createHttpLink({
  uri: config.graphql.uri,
});

// WebSocket Link for subscriptions
const wsLink = typeof window !== 'undefined' ? new GraphQLWsLink(
  createClient({
    url: config.graphql.wsUri,
    connectionParams: async () => {
      let token = null;
      
      try {
        const { authManager } = await import('@/lib/auth');
        token = await authManager.getAccessToken();
      } catch (error) {
        console.warn('Failed to get auth token for WebSocket:', error);
        // Fallback to localStorage
        token = localStorage.getItem('accessToken');
      }
      
      return {
        authorization: token ? `Bearer ${token}` : '',
      };
    },
    retryAttempts: 5,
    shouldRetry: () => true,
  })
) : null;

// Auth link to add authorization headers
const authLink = setContext(async (_, { headers }) => {
  let token = null;
  let tenantId = '';
  
  if (typeof window !== 'undefined') {
    // Use the auth manager to get valid tokens
    try {
      const { authManager } = await import('@/lib/auth');
      token = await authManager.getAccessToken();
      // Get tenant ID from localStorage for now (will be improved in tenant module)
      tenantId = localStorage.getItem('currentTenantId') || '';
    } catch (error) {
      console.warn('Failed to get auth token:', error);
      // Fallback to direct localStorage access
      token = localStorage.getItem('accessToken');
    }
  }
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
      'x-tenant-id': tenantId,
    },
  };
});

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      
      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Use auth manager to handle logout
        if (typeof window !== 'undefined') {
          import('@/lib/auth').then(({ authManager }) => {
            authManager.logout().catch(console.error);
          }).catch(() => {
            // Fallback to manual cleanup
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
          });
        }
      }
      
      // Handle authorization errors
      if (extensions?.code === 'FORBIDDEN') {
        console.warn('Access denied for operation:', operation.operationName);
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    
    // Handle network errors
    if (networkError.message.includes('Failed to fetch')) {
      console.warn('Network connection lost, switching to offline mode');
    }
  }
});

// Retry link for failed requests
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: Infinity,
    jitter: true,
  },
  attempts: {
    max: 5,
    retryIf: (error) => !!error,
  },
});

// Split link to route queries/mutations to HTTP and subscriptions to WebSocket
const splitLink = typeof window !== 'undefined' && wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLink
    )
  : httpLink;

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: from([
    errorLink,
    retryLink,
    authLink,
    splitLink,
  ]),
  cache,
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
      fetchPolicy: 'cache-first',
    },
    query: {
      errorPolicy: 'all',
      fetchPolicy: 'cache-first',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
  devtools: {
    enabled: config.development.enableDevtools,
  },
});

// Request/Response interceptors for logging
if (config.development.enableDevtools) {
  // Log all GraphQL operations in development
  apolloClient.setLink(
    from([
      new ApolloLink((operation, forward) => {
        console.log(`[GraphQL Request] ${operation.operationName}:`, {
          query: operation.query,
          variables: operation.variables,
        });
        
        return forward(operation).map((response) => {
          console.log(`[GraphQL Response] ${operation.operationName}:`, response);
          return response;
        });
      }),
      apolloClient.link,
    ])
  );
}

export default apolloClient;