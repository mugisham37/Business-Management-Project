'use client';

import React from 'react';
import { ApolloProvider } from '@/lib/apollo';
import { AuthProvider } from '@/components/auth';
import { TenantProvider } from '@/components/tenant';
import { StoreProvider } from '@/lib/stores';
import { DevToolsProvider } from '@/lib/dev-tools';
import { setupErrorBoundaryHierarchy } from '@/lib/error-handling';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Centralized provider setup for the entire application
 * Integrates all systems into a cohesive application structure
 */
export function Providers({ children }: ProvidersProps) {
  const ErrorBoundaries = setupErrorBoundaryHierarchy();

  return (
    <ErrorBoundaries.App>
      <ApolloProvider>
        <StoreProvider enableDebug={process.env.NODE_ENV === 'development'}>
          <AuthProvider>
            <TenantProvider>
              <DevToolsProvider>
                <ErrorBoundaries.Page>
                  {children}
                </ErrorBoundaries.Page>
              </DevToolsProvider>
            </TenantProvider>
          </AuthProvider>
        </StoreProvider>
      </ApolloProvider>
    </ErrorBoundaries.App>
  );
}

export default Providers;