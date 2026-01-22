// Simplified test utilities without external dependencies for initial setup

import React, { ReactElement } from 'react';

// Mock providers for testing (simplified)
interface TestProvidersProps {
  children: React.ReactNode;
}

const TestProviders = ({ children }: TestProvidersProps) => {
  return <div data-testid="test-provider">{children}</div>;
};

// Test utilities
export const createMockUser = (overrides: Record<string, any> = {}) => ({
  id: '1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  tenants: [],
  permissions: [],
  mfaEnabled: false,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockTenant = (overrides: Record<string, any> = {}) => ({
  id: '1',
  name: 'Test Tenant',
  subdomain: 'test',
  businessTier: 'SMALL' as const,
  settings: {
    timezone: 'UTC',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    language: 'en',
    features: {},
    limits: {
      maxUsers: 10,
      maxStorage: 1000,
      maxApiCalls: 10000,
      maxIntegrations: 5,
    },
  },
  branding: {
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
  },
  ...overrides,
});

export const createMockTokenPair = (overrides: Record<string, any> = {}) => ({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  tokenType: 'Bearer' as const,
  ...overrides,
});

// Mock GraphQL responses
export const createMockGraphQLError = (message = 'GraphQL Error') => ({
  message,
  locations: [{ line: 1, column: 1 }],
  path: ['test'],
});

// Wait utilities
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0));

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));