// Simplified generators without fast-check for initial setup

import type { 
  User, 
  Tenant, 
  TokenPair, 
  Permission, 
  BusinessTier,
  GraphQLOperation,
  FeatureFlag 
} from '@/types/core';

// Simple mock data generators (will be replaced with property-based generators later)

export const createMockBusinessTier = (): BusinessTier => {
  const tiers: BusinessTier[] = ['MICRO', 'SMALL', 'MEDIUM', 'ENTERPRISE'];
  return tiers[Math.floor(Math.random() * tiers.length)] as BusinessTier;
};

export const createMockEmail = (): string => {
  return `user${Math.floor(Math.random() * 1000)}@example.com`;
};

export const createMockUuid = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const createMockPermission = (): Permission => {
  const resources = ['user', 'tenant', 'inventory'];
  const actions = ['create', 'read', 'update', 'delete'];
  
  return {
    id: createMockUuid(),
    name: `permission-${Math.floor(Math.random() * 100)}`,
    resource: resources[Math.floor(Math.random() * resources.length)] as string,
    action: actions[Math.floor(Math.random() * actions.length)] as string,
  };
};

export const createMockUser = (): User => {
  const hasAvatar = Math.random() > 0.5;
  return {
    id: createMockUuid(),
    email: createMockEmail(),
    firstName: `FirstName${Math.floor(Math.random() * 100)}`,
    lastName: `LastName${Math.floor(Math.random() * 100)}`,
    ...(hasAvatar && { avatar: `https://example.com/avatar${Math.floor(Math.random() * 100)}.jpg` }),
    tenants: [],
    permissions: Array.from({ length: Math.floor(Math.random() * 5) }, () => createMockPermission()),
    mfaEnabled: Math.random() > 0.5,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

export const createMockTokenPair = (): TokenPair => ({
  accessToken: `access-token-${Math.random().toString(36)}`,
  refreshToken: `refresh-token-${Math.random().toString(36)}`,
  expiresAt: new Date(Date.now() + 3600000),
  tokenType: 'Bearer',
});

export const createMockTenant = (): Tenant => ({
  id: createMockUuid(),
  name: `Tenant ${Math.floor(Math.random() * 100)}`,
  subdomain: `tenant${Math.floor(Math.random() * 100)}`,
  businessTier: createMockBusinessTier(),
  settings: {
    timezone: 'UTC',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    language: 'en',
    features: {},
    limits: {
      maxUsers: Math.floor(Math.random() * 1000) + 1,
      maxStorage: Math.floor(Math.random() * 100000) + 1000,
      maxApiCalls: Math.floor(Math.random() * 100000) + 1000,
      maxIntegrations: Math.floor(Math.random() * 50) + 1,
    },
  },
  branding: {
    primaryColor: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
    secondaryColor: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
  },
});

export const createMockFeatureFlag = (): FeatureFlag => ({
  key: `feature-${Math.floor(Math.random() * 100)}`,
  enabled: Math.random() > 0.5,
  config: {},
  requiredTier: createMockBusinessTier(),
});

export const createMockGraphQLOperation = (): GraphQLOperation => ({
  query: 'query TestQuery { test }',
  variables: {},
  context: {},
  errorPolicy: 'none',
  fetchPolicy: 'cache-first',
});