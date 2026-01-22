import * as fc from 'fast-check';
import type { 
  User, 
  Tenant, 
  TokenPair, 
  Permission, 
  BusinessTier,
  GraphQLOperation,
  FeatureFlag 
} from '@/types/core';

// Basic generators
export const businessTierArb = fc.constantFrom<BusinessTier>('MICRO', 'SMALL', 'MEDIUM', 'ENTERPRISE');

export const emailArb = fc.emailAddress();

export const urlArb = fc.webUrl();

export const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

export const uuidArb = fc.uuid();

// Permission generator
export const permissionArb: fc.Arbitrary<Permission> = fc.record({
  id: uuidArb,
  name: fc.string({ minLength: 3, maxLength: 50 }),
  resource: fc.constantFrom('user', 'tenant', 'inventory', 'financial', 'pos', 'warehouse'),
  action: fc.constantFrom('create', 'read', 'update', 'delete', 'manage'),
});

// User generator
export const userArb: fc.Arbitrary<User> = fc.record({
  id: uuidArb,
  email: emailArb,
  firstName: fc.string({ minLength: 1, maxLength: 50 }),
  lastName: fc.string({ minLength: 1, maxLength: 50 }),
  avatar: fc.option(urlArb),
  tenants: fc.array(fc.record({
    tenantId: uuidArb,
    role: fc.record({
      id: uuidArb,
      name: fc.string({ minLength: 3, maxLength: 30 }),
      permissions: fc.array(permissionArb, { maxLength: 10 }),
    }),
    permissions: fc.array(permissionArb, { maxLength: 20 }),
    isActive: fc.boolean(),
  }), { maxLength: 5 }),
  permissions: fc.array(permissionArb, { maxLength: 30 }),
  mfaEnabled: fc.boolean(),
  lastLoginAt: dateArb,
  createdAt: dateArb,
  updatedAt: dateArb,
});

// Token pair generator
export const tokenPairArb: fc.Arbitrary<TokenPair> = fc.record({
  accessToken: fc.string({ minLength: 100, maxLength: 500 }),
  refreshToken: fc.string({ minLength: 100, maxLength: 500 }),
  expiresAt: fc.date({ min: new Date(), max: new Date(Date.now() + 86400000) }), // Future date
  tokenType: fc.constant('Bearer' as const),
});

// Tenant generator
export const tenantArb: fc.Arbitrary<Tenant> = fc.record({
  id: uuidArb,
  name: fc.string({ minLength: 3, maxLength: 100 }),
  subdomain: fc.string({ minLength: 3, maxLength: 50 }).filter((s: string) => /^[a-z0-9-]+$/.test(s)),
  businessTier: businessTierArb,
  settings: fc.record({
    timezone: fc.constantFrom('UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'),
    currency: fc.constantFrom('USD', 'EUR', 'GBP', 'JPY'),
    dateFormat: fc.constantFrom('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'),
    language: fc.constantFrom('en', 'es', 'fr', 'de'),
    features: fc.dictionary(fc.string(), fc.boolean()),
    limits: fc.record({
      maxUsers: fc.integer({ min: 1, max: 10000 }),
      maxStorage: fc.integer({ min: 100, max: 1000000 }),
      maxApiCalls: fc.integer({ min: 1000, max: 1000000 }),
      maxIntegrations: fc.integer({ min: 1, max: 100 }),
    }),
  }),
  branding: fc.record({
    primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map((s: string) => `#${s}`),
    secondaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map((s: string) => `#${s}`),
    logo: fc.option(urlArb),
    favicon: fc.option(urlArb),
    customCss: fc.option(fc.string({ maxLength: 1000 })),
  }),
});

// Feature flag generator
export const featureFlagArb: fc.Arbitrary<FeatureFlag> = fc.record({
  key: fc.string({ minLength: 3, maxLength: 50 }).filter((s: string) => /^[a-z0-9_-]+$/.test(s)),
  enabled: fc.boolean(),
  config: fc.dictionary(fc.string(), fc.anything()),
  requiredTier: businessTierArb,
});

// GraphQL operation generator
export const graphqlOperationArb: fc.Arbitrary<GraphQLOperation> = fc.record({
  query: fc.string({ minLength: 10, maxLength: 1000 }),
  variables: fc.option(fc.dictionary(fc.string(), fc.anything())),
  context: fc.option(fc.dictionary(fc.string(), fc.anything())),
  errorPolicy: fc.option(fc.constantFrom('none', 'ignore', 'all')),
  fetchPolicy: fc.option(fc.constantFrom('cache-first', 'cache-and-network', 'network-only', 'cache-only', 'standby')),
});

// GraphQL query generator (simplified)
export const graphqlQueryArb = fc.record({
  operationName: fc.option(fc.string({ minLength: 3, maxLength: 50 })),
  query: fc.oneof(
    fc.constant('query GetUser { user { id name email } }'),
    fc.constant('query GetTenants { tenants { id name businessTier } }'),
    fc.constant('query GetInventory { inventory { id name quantity } }'),
    fc.constant('mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }'),
    fc.constant('subscription UserUpdated { userUpdated { id name } }'),
  ),
  variables: fc.option(fc.dictionary(fc.string(), fc.anything())),
});

// Cache key generator
export const cacheKeyArb = fc.string({ minLength: 5, maxLength: 100 }).filter((s: string) => /^[a-zA-Z0-9:_-]+$/.test(s));

// Error generator
export const errorArb = fc.record({
  message: fc.string({ minLength: 5, maxLength: 200 }),
  code: fc.string({ minLength: 3, maxLength: 20 }),
  details: fc.option(fc.dictionary(fc.string(), fc.anything())),
});

// Network delay generator (for testing retry logic)
export const networkDelayArb = fc.integer({ min: 0, max: 5000 });

// Retry attempt generator
export const retryAttemptArb = fc.integer({ min: 0, max: 10 });

// Tenant context generator
export const tenantContextArb = fc.record({
  currentTenant: fc.option(tenantArb),
  availableTenants: fc.array(tenantArb, { maxLength: 10 }),
  businessTier: businessTierArb,
  features: fc.array(featureFlagArb, { maxLength: 20 }),
});

// Authentication state generator
export const authStateArb = fc.record({
  user: fc.option(userArb),
  tokens: fc.option(tokenPairArb),
  permissions: fc.array(permissionArb, { maxLength: 50 }),
  mfaRequired: fc.boolean(),
  isAuthenticated: fc.boolean(),
  isLoading: fc.boolean(),
});

// Module configuration generator
export const moduleConfigArb = fc.record({
  name: fc.string({ minLength: 3, maxLength: 50 }),
  path: fc.string({ minLength: 5, maxLength: 100 }),
  lazy: fc.boolean(),
  permissions: fc.option(fc.array(permissionArb, { maxLength: 10 })),
  businessTier: fc.option(businessTierArb),
});

// Performance metrics generator
export const performanceMetricsArb = fc.record({
  loadTime: fc.integer({ min: 0, max: 10000 }),
  renderTime: fc.integer({ min: 0, max: 1000 }),
  bundleSize: fc.integer({ min: 1000, max: 10000000 }),
  cacheHitRate: fc.float({ min: 0, max: 1 }),
});

// Utility function to create constrained generators
export function createConstrainedGenerator<T>(
  baseArb: fc.Arbitrary<T>,
  constraint: (value: T) => boolean
): fc.Arbitrary<T> {
  return baseArb.filter(constraint);
}

// Utility function to create generators with specific business rules
export function createBusinessRuleGenerator<T>(
  baseArb: fc.Arbitrary<T>,
  businessRule: (value: T) => T
): fc.Arbitrary<T> {
  return baseArb.map(businessRule);
}