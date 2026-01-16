declare module 'graphql-query-complexity' {
  import { GraphQLSchema, DocumentNode } from 'graphql';

  export interface ComplexityEstimatorArgs {
    type: any;
    field: any;
    args: Record<string, any>;
    childComplexity: number;
  }

  export type ComplexityEstimator = (args: ComplexityEstimatorArgs) => number | void;

  export interface GetComplexityOptions {
    schema: GraphQLSchema;
    query: DocumentNode;
    operationName?: string;
    estimators: ComplexityEstimator[];
    variables?: Record<string, any>;
  }

  export function getComplexity(options: GetComplexityOptions): number;

  export function simpleEstimator(options: { defaultComplexity: number }): ComplexityEstimator;

  export function fieldExtensionsEstimator(): ComplexityEstimator;
}
