import { Plugin } from '@nestjs/apollo';
import {
  ApolloServerPlugin,
  GraphQLRequestListener,
  GraphQLRequestContext,
} from '@apollo/server';
import { GraphQLError } from 'graphql';
import {
  getComplexity,
  simpleEstimator,
  fieldExtensionsEstimator,
} from 'graphql-query-complexity';
import { GraphQLErrorCode } from './error-codes.enum';

/**
 * Plugin to enforce query complexity limits
 */
@Plugin()
export class QueryComplexityPlugin implements ApolloServerPlugin {
  private readonly maxComplexity: number;
  private readonly maxDepth: number;

  constructor(maxComplexity: number = 1000, maxDepth: number = 10) {
    this.maxComplexity = maxComplexity;
    this.maxDepth = maxDepth;
  }

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const maxComplexity = this.maxComplexity;
    const maxDepth = this.maxDepth;
    const self = this;

    return {
      async didResolveOperation(requestContext: GraphQLRequestContext<any>) {
        const { schema, document, operationName } = requestContext;

        // Ensure document exists
        if (!document) {
          return;
        }

        // Calculate query complexity
        const complexityOptions: any = {
          schema,
          query: document,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        };
        
        if (operationName) {
          complexityOptions.operationName = operationName;
        }
        
        const complexity = getComplexity(complexityOptions);

        // Check if complexity exceeds limit
        if (complexity > maxComplexity) {
          throw new GraphQLError(
            `Query is too complex: ${complexity}. Maximum allowed complexity: ${maxComplexity}`,
            {
              extensions: {
                code: GraphQLErrorCode.QUERY_TOO_COMPLEX,
                complexity,
                maxComplexity,
                timestamp: new Date().toISOString(),
              },
            },
          );
        }

        // Calculate query depth
        const depth = self.calculateQueryDepth(document);
        if (depth > maxDepth) {
          throw new GraphQLError(
            `Query is too deep: ${depth}. Maximum allowed depth: ${maxDepth}`,
            {
              extensions: {
                code: GraphQLErrorCode.QUERY_TOO_DEEP,
                depth,
                maxDepth,
                timestamp: new Date().toISOString(),
              },
            },
          );
        }

        // Log complexity in development
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Query complexity: ${complexity}, depth: ${depth}`);
        }
      },
    };
  }

  /**
   * Calculate the maximum depth of a GraphQL query
   */
  private calculateQueryDepth(document: any, maxDepth: number = 0): number {
    const definitions = document.definitions;
    
    for (const definition of definitions) {
      if (definition.kind === 'OperationDefinition') {
        const depth = this.calculateSelectionSetDepth(definition.selectionSet, 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    
    return maxDepth;
  }

  /**
   * Calculate depth of a selection set recursively
   */
  private calculateSelectionSetDepth(selectionSet: any, currentDepth: number): number {
    if (!selectionSet || !selectionSet.selections) {
      return currentDepth;
    }

    let maxDepth = currentDepth;

    for (const selection of selectionSet.selections) {
      if (selection.kind === 'Field') {
        if (selection.selectionSet) {
          const depth = this.calculateSelectionSetDepth(
            selection.selectionSet,
            currentDepth + 1,
          );
          maxDepth = Math.max(maxDepth, depth);
        }
      } else if (selection.kind === 'InlineFragment' || selection.kind === 'FragmentSpread') {
        if (selection.selectionSet) {
          const depth = this.calculateSelectionSetDepth(
            selection.selectionSet,
            currentDepth,
          );
          maxDepth = Math.max(maxDepth, depth);
        }
      }
    }

    return maxDepth;
  }
}
