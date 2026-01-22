import type { CodegenConfig } from '@graphql-codegen/cli';

// Determine which schema to use
const getSchema = () => {
  // Check if we should use mock schema (development mode without server)
  if (process.env.NODE_ENV === 'development' || !process.env.GRAPHQL_SERVER_AVAILABLE) {
    return './src/lib/graphql/mock-schema.graphql';
  }
  
  // Use live server schema
  return {
    [process.env.NEXT_PUBLIC_GRAPHQL_URI || 'http://localhost:4000/graphql']: {
      headers: {
        // Add authorization header if available
        ...(process.env.GRAPHQL_SCHEMA_TOKEN && {
          Authorization: `Bearer ${process.env.GRAPHQL_SCHEMA_TOKEN}`,
        }),
      },
    },
  };
};

const config: CodegenConfig = {
  schema: getSchema(),
  documents: [
    'src/**/*.{ts,tsx,graphql,gql}',
    '!src/**/*.d.ts',
    '!src/types/generated/**/*',
  ],
  generates: {
    // Schema introspection for tooling
    './src/types/generated/introspection.json': {
      plugins: ['introspection'],
      config: {
        minify: false,
      },
    },
    // Legacy hooks generation for compatibility
    './src/types/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-apollo',
      ],
      config: {
        withHooks: true,
        withHOC: false,
        withComponent: false,
        withMutationFn: true,
        withRefetchFn: true,
        withSubscriptionHooks: true,
        apolloReactHooksImportFrom: '@apollo/client',
        apolloReactCommonImportFrom: '@apollo/client',
        skipTypename: false,
        nonOptionalTypename: true,
        avoidOptionals: {
          field: true,
          inputValue: false,
          object: false,
        },
        scalars: {
          DateTime: 'Date',
          JSON: 'Record<string, any>',
          Upload: 'File',
          BigInt: 'bigint',
          Decimal: 'number',
        },
        strictScalars: true,
        namingConvention: {
          typeNames: 'pascal-case#pascalCase',
          enumValues: 'upper-case#upperCase',
        },
        // Generate discriminated unions for interfaces and unions
        onlyOperationTypes: false,
        preResolveTypes: true,
        // Add type guards for union types
        addUnderscoreToArgsType: true,
        // Improve error handling
        errorType: 'ApolloError',
        // Add JSDoc comments
        addDocBlocks: true,
        // Ensure unique operation names
        dedupeOperationSuffix: true,
      },
    },
  },
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
  // Ignore common files that don't contain GraphQL
  ignoreNoDocuments: true,
  // Enable verbose logging for debugging
  verbose: process.env.NODE_ENV === 'development',
  // Fail on schema errors
  errorsOnly: false,
};

export default config;