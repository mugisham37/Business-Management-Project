# GraphQL Type Generation and Schema Integration

This directory contains the GraphQL type generation and schema integration setup for the Next.js GraphQL Foundation. It provides comprehensive type safety, schema validation, and error handling for GraphQL operations.

## Features

### ✅ Task 3.1: GraphQL Code Generator Setup
- **Automatic Type Generation**: Generates TypeScript types from GraphQL schema
- **Typed Hooks**: Creates typed React hooks for all GraphQL operations
- **Schema Introspection**: Maintains up-to-date schema information
- **Multiple Output Formats**: Supports both client preset and legacy hooks
- **Development Mode**: Uses mock schema when server is unavailable

### ✅ Task 3.2: Schema Validation and Error Handling
- **Build-time Validation**: Validates all GraphQL operations against schema
- **Breaking Change Detection**: Identifies schema changes that break operations
- **Clear Error Messages**: Provides user-friendly error messages with suggestions
- **Automated Validation**: Integrates with build process for continuous validation

## File Structure

```
src/lib/graphql/
├── README.md                 # This documentation
├── index.ts                  # Main exports
├── mock-schema.graphql       # Mock schema for development
├── schema-validator.ts       # Schema validation utilities
├── utils.ts                  # GraphQL utilities and helpers
└── error-handler.tsx         # Error handling components
```

## Configuration

### Code Generator Configuration (`codegen.ts`)

The GraphQL Code Generator is configured to:

1. **Schema Sources**:
   - Live server: `http://localhost:4000/graphql` (production)
   - Mock schema: `./src/lib/graphql/mock-schema.graphql` (development)

2. **Generated Outputs**:
   - **Client Preset**: `./src/types/generated/` - Modern GraphQL client usage
   - **Legacy Hooks**: `./src/types/generated/graphql.ts` - Typed React hooks
   - **Introspection**: `./src/types/generated/introspection.json` - Schema metadata
   - **Possible Types**: `./src/types/generated/possible-types.ts` - Cache configuration

3. **Type Safety Features**:
   - Strict scalars with custom mappings
   - Discriminated unions for GraphQL unions/interfaces
   - Non-optional typename fields
   - Comprehensive error types

### Validation Configuration

The validation system provides:

1. **Build-time Validation**: Runs during `npm run build`
2. **Manual Validation**: Available via `npm run validate:graphql`
3. **Schema Validation**: Available via `npm run validate:schema`
4. **Continuous Integration**: Integrated with CI/CD pipeline

## Usage

### Basic Type Generation

```bash
# Generate types from schema
npm run codegen

# Watch mode for development
npm run codegen:watch

# Validate GraphQL operations
npm run validate:graphql

# Full schema validation
npm run validate:schema
```

### Using Generated Types

```typescript
import { useGetCurrentUserQuery, useLoginMutation } from '@/types/generated/graphql';

// Typed query hook
const { data, loading, error } = useGetCurrentUserQuery();

// Typed mutation hook
const [login, { loading: loginLoading }] = useLoginMutation();
```

### Error Handling

```typescript
import { GraphQLErrorDisplay, useGraphQLErrorHandler } from '@/lib/graphql';

function MyComponent() {
  const { errors, handleError, clearErrors } = useGraphQLErrorHandler();
  
  const { data, error } = useGetUsersQuery({
    onError: handleError,
  });

  if (errors.length > 0) {
    return <GraphQLErrorDisplay error={error} onRetry={clearErrors} />;
  }

  return <div>{/* Component content */}</div>;
}
```

### Schema Validation

```typescript
import { SchemaValidator, validateAllOperations } from '@/lib/graphql';

// Validate specific operation
const validator = new SchemaValidator();
const result = validator.validateOperation(myOperation, 'path/to/operation.graphql');

// Validate all operations
const results = await validateAllOperations();
```

## Development Workflow

### 1. Schema-First Development

1. Update the mock schema (`mock-schema.graphql`) with new types
2. Run `npm run codegen` to generate types
3. Write GraphQL operations using the new types
4. Implement components using typed hooks

### 2. Server Integration

1. Set `GRAPHQL_SERVER_AVAILABLE=true` environment variable
2. Ensure GraphQL server is running on `http://localhost:4000/graphql`
3. Run `npm run codegen` to generate types from live schema
4. Validate operations with `npm run validate:graphql`

### 3. Error Handling

1. Use `GraphQLErrorBoundary` to catch component errors
2. Use `useGraphQLErrorHandler` hook for operation errors
3. Implement custom error displays with `GraphQLErrorDisplay`
4. Monitor errors with structured logging

## Best Practices

### Operation Naming
- Always name your GraphQL operations
- Use descriptive, unique names
- Follow PascalCase convention

```graphql
# ✅ Good
query GetUserProfile($id: ID!) {
  user(id: $id) { ... }
}

# ❌ Bad
query {
  user { ... }
}
```

### Type Safety
- Use generated types for all GraphQL operations
- Avoid `any` types in GraphQL-related code
- Leverage TypeScript strict mode

```typescript
// ✅ Good
const { data }: { data?: GetUserProfileQuery } = useGetUserProfileQuery();

// ❌ Bad
const { data }: any = useGetUserProfileQuery();
```

### Error Handling
- Always handle GraphQL errors gracefully
- Provide user-friendly error messages
- Implement retry logic for network errors

```typescript
// ✅ Good
const { data, error } = useGetUsersQuery({
  errorPolicy: 'all',
  onError: (error) => {
    const friendlyErrors = parseGraphQLError(error);
    showErrorToast(friendlyErrors[0].message);
  },
});

// ❌ Bad
const { data } = useGetUsersQuery(); // No error handling
```

### Performance
- Use appropriate fetch policies
- Implement proper caching strategies
- Avoid over-fetching data

```typescript
// ✅ Good
const { data } = useGetUsersQuery({
  fetchPolicy: 'cache-first',
  variables: { first: 10 }, // Pagination
});

// ❌ Bad
const { data } = useGetUsersQuery({
  fetchPolicy: 'network-only', // Always hits network
});
```

## Troubleshooting

### Common Issues

1. **Schema Loading Errors**
   - Ensure GraphQL server is running
   - Check network connectivity
   - Verify schema endpoint URL

2. **Type Generation Failures**
   - Check for syntax errors in GraphQL operations
   - Ensure operation names are unique
   - Validate operations against schema

3. **Validation Errors**
   - Review error messages for specific issues
   - Check field availability in schema
   - Verify input types match schema

### Debug Commands

```bash
# Check schema connectivity
curl http://localhost:4000/graphql

# Verbose code generation
npm run codegen -- --verbose

# Check generated files
ls -la src/types/generated/

# Validate specific operation
node -e "console.log(require('./src/lib/graphql/schema-validator').validateOperation(...))"
```

## Integration with Build Process

The GraphQL validation is integrated into the build process:

1. **Pre-build**: Schema validation runs before Next.js build
2. **Type Check**: TypeScript compilation includes generated types
3. **Lint**: ESLint checks GraphQL operation files
4. **Test**: Jest tests include GraphQL operation validation

## Monitoring and Metrics

The system provides monitoring capabilities:

1. **Error Tracking**: Structured error logging with context
2. **Performance Metrics**: Operation timing and cache hit rates
3. **Schema Evolution**: Breaking change detection and reporting
4. **Validation Metrics**: Success/failure rates for operations

## Contributing

When adding new GraphQL operations:

1. Add operation to appropriate `.graphql` file
2. Run `npm run codegen` to generate types
3. Run `npm run validate:graphql` to ensure validity
4. Update tests to use new operations
5. Document any breaking changes

## Security Considerations

1. **Input Validation**: All inputs are validated against schema
2. **Error Sanitization**: Sensitive information is filtered from errors
3. **Authentication**: Token-based authentication for schema access
4. **Authorization**: Permission-based field access validation