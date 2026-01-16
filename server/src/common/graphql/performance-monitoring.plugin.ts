import { Plugin } from '@nestjs/apollo';
import {
  ApolloServerPlugin,
  GraphQLRequestListener,
  GraphQLRequestContext,
} from '@apollo/server';

/**
 * Plugin to monitor GraphQL query performance
 */
@Plugin()
export class PerformanceMonitoringPlugin implements ApolloServerPlugin {
  private readonly slowQueryThreshold: number;

  constructor(slowQueryThreshold: number = 1000) {
    this.slowQueryThreshold = slowQueryThreshold; // milliseconds
  }

  async requestDidStart(
    requestContext: GraphQLRequestContext<any>,
  ): Promise<GraphQLRequestListener<any>> {
    const startTime = Date.now();
    const slowQueryThreshold = this.slowQueryThreshold;

    return {
      async willSendResponse(requestContext: GraphQLRequestContext<any>) {
        const duration = Date.now() - startTime;
        const { operationName, operation } = requestContext;

        // Log slow queries
        if (duration > slowQueryThreshold) {
          console.warn('Slow GraphQL Query:', {
            operationName: operationName || 'anonymous',
            operationType: operation?.operation,
            duration: `${duration}ms`,
            query: requestContext.request.query,
            variables: requestContext.request.variables,
            timestamp: new Date().toISOString(),
          });
        }

        // Add performance headers
        if (requestContext.response.http) {
          requestContext.response.http.headers.set(
            'X-GraphQL-Execution-Time',
            `${duration}ms`,
          );
          requestContext.response.http.headers.set(
            'X-GraphQL-Operation-Name',
            operationName || 'anonymous',
          );
        }

        // Log all queries in development
        if (process.env.NODE_ENV !== 'production') {
          console.log('GraphQL Query Executed:', {
            operationName: operationName || 'anonymous',
            operationType: operation?.operation,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
          });
        }
      },

      async didEncounterErrors(requestContext: GraphQLRequestContext<any>) {
        const duration = Date.now() - startTime;
        const { operationName, errors } = requestContext;

        console.error('GraphQL Query Errors:', {
          operationName: operationName || 'anonymous',
          duration: `${duration}ms`,
          errors: errors?.map(error => ({
            message: error.message,
            code: error.extensions?.code,
            path: error.path,
          })) || [],
          timestamp: new Date().toISOString(),
        });
      },
    };
  }
}
