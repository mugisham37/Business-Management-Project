import { ApolloClient, InMemoryCache, createHttpLink, from, split, ApolloLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { config } from '@/lib/config/env';
import { errorLogger } from '@/lib/error-handling';

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
        // Analytics module caching
        getMetrics: {
          keyArgs: ['filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        getKPIs: {
          keyArgs: ['filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        getTrends: {
          keyArgs: ['filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        getDashboard: {
          keyArgs: ['dashboardId'],
          merge: false,
        },
        getWidgetData: {
          keyArgs: ['widgetId'],
          merge: false,
        },
        reports: {
          keyArgs: false,
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        getReport: {
          keyArgs: ['reportId'],
          merge: false,
        },
        getReportExecution: {
          keyArgs: ['executionId'],
          merge: false,
        },
        executeReport: {
          keyArgs: ['input'],
          merge: false,
        },
        getForecast: {
          keyArgs: ['metricName', 'periods', 'productId', 'locationId'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return Array.isArray(incoming) ? incoming : [incoming];
          },
        },
        detectAnomalies: {
          keyArgs: ['metricName', 'threshold'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        compareTimePeriods: {
          keyArgs: ['input'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        compareLocations: {
          keyArgs: ['input'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        compareSegments: {
          keyArgs: ['input'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        getDataCubes: {
          keyArgs: false,
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        getDataCube: {
          keyArgs: ['cubeName'],
          merge: false,
        },
        queryWarehouse: {
          keyArgs: ['query'],
          merge: false,
        },
        getPipelines: {
          keyArgs: false,
          merge: false,
        },
        getPipelineStatus: {
          keyArgs: ['pipelineId'],
          merge: false,
        },
        // Financial module caching
        accounts: {
          keyArgs: ['accountType', 'isActive', 'parentAccountId'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        budgets: {
          keyArgs: ['fiscalYear', 'status', 'budgetType'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        journalEntries: {
          keyArgs: ['dateFrom', 'dateTo', 'status', 'sourceType'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        getReceivables: {
          keyArgs: ['status', 'customerId'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        getPayables: {
          keyArgs: ['status', 'supplierId'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        reconciliations: {
          keyArgs: ['accountId', 'status'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        // Supplier module caching
        suppliers: {
          keyArgs: ['filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        purchaseOrders: {
          keyArgs: ['filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        supplierCommunications: {
          keyArgs: ['supplierId'],
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          },
        },
        supplierEvaluations: {
          keyArgs: ['supplierId'],
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          },
        },
        // Warehouse module caching
        warehouses: {
          keyArgs: ['filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        warehouseZones: {
          keyArgs: ['warehouseId', 'filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        binLocations: {
          keyArgs: ['warehouseId', 'filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        pickingWaves: {
          keyArgs: ['warehouseId', 'filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        pickLists: {
          keyArgs: ['warehouseId', 'filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        kitDefinitions: {
          keyArgs: ['filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        assemblyWorkOrders: {
          keyArgs: ['warehouseId', 'filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        lots: {
          keyArgs: ['warehouseId', 'filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        shipments: {
          keyArgs: ['warehouseId', 'filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        // Location module caching
        locations: {
          keyArgs: ['filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        locationTree: {
          keyArgs: ['rootLocationId'],
          merge: false,
        },
        franchises: {
          keyArgs: ['filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        territories: {
          keyArgs: ['filter'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return [...existing, ...incoming];
          },
        },
        locationPromotions: {
          keyArgs: ['locationId'],
          merge: false,
        },
        findNearbyLocations: {
          keyArgs: ['latitude', 'longitude', 'radiusKm', 'locationTypes', 'statuses'],
          merge: false,
        },
        findLocationsInBounds: {
          keyArgs: ['northEastLat', 'northEastLng', 'southWestLat', 'southWestLng'],
          merge: false,
        },
        getLocationAuditHistory: {
          keyArgs: ['locationId', 'userId', 'actions'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              entries: [...(existing.entries || []), ...(incoming.entries || [])],
            };
          },
        },
        getTenantBulkOperations: {
          keyArgs: ['limit'],
          merge: false,
        },
        getSyncHistory: {
          keyArgs: ['locationId'],
          merge: false,
        },
        transactions: {
          keyArgs: ['query'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            
            return {
              ...incoming,
              edges: [...(existing.edges || []), ...(incoming.edges || [])],
            };
          },
        },
        posSession: {
          keyArgs: ['id'],
          merge: false,
        },
        activePOSSessions: {
          keyArgs: ['locationId'],
          merge: false,
        },
        transactionHistory: {
          keyArgs: ['filters'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return {
              ...incoming,
              transactions: [...(existing.transactions || []), ...(incoming.transactions || [])],
            };
          },
        },
        reconciliationHistory: {
          keyArgs: ['locationId'],
          merge(existing, incoming) {
            if (!existing) return incoming;
            if (!incoming) return existing;
            return {
              ...incoming,
              reports: [...(existing.reports || []), ...(incoming.reports || [])],
            };
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
    // Analytics module type policies
    Metric: {
      fields: {
        dimensions: {
          merge: false,
        },
      },
    },
    KPI: {
      fields: {
        changePercentage: {
          merge: false,
        },
      },
    },
    Trend: {
      fields: {
        dataPoints: {
          merge: false,
        },
      },
    },
    Dashboard: {
      fields: {
        widgets: {
          merge: false,
        },
      },
    },
    Report: {
      fields: {
        metrics: {
          merge: false,
        },
        dimensions: {
          merge: false,
        },
      },
    },
    ReportExecution: {
      fields: {
        result: {
          merge: false,
        },
      },
    },
    Forecast: {
      fields: {
        predictions: {
          merge: false,
        },
      },
    },
    Anomaly: {
      fields: {
        deviationScore: {
          merge: false,
        },
      },
    },
    ComparisonResult: {
      fields: {
        variance: {
          merge: false,
        },
        percentageChange: {
          merge: false,
        },
      },
    },
    LocationComparison: {
      fields: {
        metrics: {
          merge: false,
        },
      },
    },
    SegmentComparison: {
      fields: {
        metrics: {
          merge: false,
        },
      },
    },
    DataCube: {
      fields: {
        dimensions: {
          merge: false,
        },
        measures: {
          merge: false,
        },
      },
    },
    ETLPipeline: {
      fields: {
        sourceConfig: {
          merge: false,
        },
        transformConfig: {
          merge: false,
        },
        destinationConfig: {
          merge: false,
        },
      },
    },
    ETLJobResult: {
      fields: {
        executionLog: {
          merge: false,
        },
      },
    },
    // Financial module type policies
    ChartOfAccount: {
      fields: {
        currentBalance: {
          merge: false,
        },
        childAccounts: {
          merge: false,
        },
        parentAccount: {
          merge: false,
        },
      },
    },
    JournalEntry: {
      fields: {
        lineItems: {
          merge: false,
        },
        totalDebitAmount: {
          merge: false,
        },
        totalCreditAmount: {
          merge: false,
        },
      },
    },
    Budget: {
      fields: {
        budgetLines: {
          merge: false,
        },
        totalBudgetAmount: {
          merge: false,
        },
        totalActualAmount: {
          merge: false,
        },
      },
    },
    FinancialReport: {
      fields: {
        data: {
          merge: false,
        },
        metadata: {
          merge: false,
        },
      },
    },
    BudgetVarianceAnalysis: {
      fields: {
        accountVariances: {
          merge: false,
        },
      },
    },
    GeneralLedger: {
      fields: {
        transactions: {
          merge: false,
        },
        summary: {
          merge: false,
        },
      },
    },
    Reconciliation: {
      fields: {
        items: {
          merge: false,
        },
      },
    },
    // Warehouse module type policies
    Warehouse: {
      fields: {
        zones: {
          merge: false,
        },
        binLocations: {
          merge: false,
        },
        capacity: {
          merge: false,
        },
      },
    },
    WarehouseZone: {
      fields: {
        binLocations: {
          merge: false,
        },
      },
    },
    PickingWave: {
      fields: {
        pickLists: {
          merge: false,
        },
        assignedPickers: {
          merge: false,
        },
        statistics: {
          merge: false,
        },
      },
    },
    PickList: {
      fields: {
        items: {
          merge: false,
        },
      },
    },
    KitDefinition: {
      fields: {
        components: {
          merge: false,
        },
        qualityChecks: {
          merge: false,
        },
        workOrders: {
          merge: false,
        },
      },
    },
    AssemblyWorkOrder: {
      fields: {
        components: {
          merge: false,
        },
        qualityResults: {
          merge: false,
        },
      },
    },
    LotInfo: {
      fields: {
        movementHistory: {
          merge: false,
        },
      },
    },
    Shipment: {
      fields: {
        items: {
          merge: false,
        },
        trackingEvents: {
          merge: false,
        },
      },
    },
    // POS module type policies
    Transaction: {
      fields: {
        items: {
          merge: false,
        },
        payments: {
          merge: false,
        },
      },
    },
    POSSession: {
      fields: {
        transactions: {
          merge: false,
        },
      },
    },
    ReconciliationReport: {
      fields: {
        paymentMethodBreakdown: {
          merge: false,
        },
        discrepancies: {
          merge: false,
        },
      },
    },
    Supplier: {
      fields: {
        contacts: {
          merge: false,
        },
        communications: {
          merge: false,
        },
        evaluations: {
          merge: false,
        },
        purchaseOrders: {
          merge: false,
        },
      },
    },
    PurchaseOrder: {
      fields: {
        lineItems: {
          merge: false,
        },
      },
    },
    // Location module type policies
    Location: {
      fields: {
        parentLocation: {
          merge: false,
        },
        childLocations: {
          merge: false,
        },
        employees: {
          merge: false,
        },
        inventory: {
          merge: false,
        },
        pricingRules: {
          merge: false,
        },
        promotions: {
          merge: false,
        },
        inventoryPolicies: {
          merge: false,
        },
      },
    },
    Franchise: {
      fields: {
        primaryTerritory: {
          merge: false,
        },
        parentFranchise: {
          merge: false,
        },
        childFranchises: {
          merge: false,
        },
        locations: {
          merge: false,
        },
      },
    },
    Territory: {
      fields: {
        parentTerritory: {
          merge: false,
        },
        childTerritories: {
          merge: false,
        },
        assignedFranchise: {
          merge: false,
        },
        locations: {
          merge: false,
        },
      },
    },
    LocationPromotion: {
      fields: {
        conditions: {
          merge: false,
        },
        actions: {
          merge: false,
        },
      },
    },
    LocationInventoryPolicy: {
      fields: {
        rules: {
          merge: false,
        },
      },
    },
    BulkOperationSummary: {
      fields: {
        errors: {
          merge: false,
        },
        warnings: {
          merge: false,
        },
        results: {
          merge: false,
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

// Error handling link with integrated error logging
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  const operationName = operation.operationName || 'Unknown';
  const operationId = `apollo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      
      // Log GraphQL errors with context
      errorLogger.logError(
        new Error(`GraphQL Error: ${message}`),
        {
          component: 'apollo-client',
          operationId,
        },
        {
          operationName,
          locations,
          path,
          extensions,
          variables: operation.variables,
        },
        ['graphql-error', (typeof extensions?.code === 'string' ? extensions.code.toLowerCase() : 'unknown')]
      );
      
      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED') {
        errorLogger.logWarning(
          'Authentication required - redirecting to login',
          { component: 'apollo-client', operationId },
          { operationName },
          ['auth-error', 'unauthenticated']
        );

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
        errorLogger.logWarning(
          'Access denied for GraphQL operation',
          { component: 'apollo-client', operationId },
          { operationName },
          ['auth-error', 'forbidden']
        );
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    
    // Log network errors with context
    errorLogger.logError(
      networkError as Error,
      {
        component: 'apollo-client',
        operationId,
      },
      {
        operationName,
        variables: operation.variables,
        networkErrorType: networkError.name,
      },
      ['network-error', 'apollo']
    );
    
    // Handle network errors
    if (networkError.message.includes('Failed to fetch')) {
      errorLogger.logWarning(
        'Network connection lost - switching to offline mode',
        { component: 'apollo-client', operationId },
        { operationName },
        ['network-error', 'offline']
      );
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