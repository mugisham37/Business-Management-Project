import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { InMemoryCache } from '@apollo/client';

// Mock providers for testing
interface AllTheProvidersProps {
  children: React.ReactNode;
  mocks?: MockedResponse[];
  cache?: InMemoryCache;
}

const AllTheProviders = ({ children, mocks = [], cache }: AllTheProvidersProps) => {
  const defaultCache = cache || new InMemoryCache();

  return (
    <MockedProvider mocks={mocks} cache={defaultCache} addTypename={false}>
      {children}
    </MockedProvider>
  );
};

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  mocks?: MockedResponse[];
  cache?: InMemoryCache;
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { mocks, cache, ...renderOptions } = options;
  
  return render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <AllTheProviders mocks={mocks || []} cache={cache}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Test utilities
export const createMockUser = (overrides = {}) => ({
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

export const createMockTenant = (overrides = {}) => ({
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

export const createMockTokenPair = (overrides = {}) => ({
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