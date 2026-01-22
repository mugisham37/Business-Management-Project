/**
 * Integration Layer
 * Provides utilities and services for system integration
 */

export * from './system-health';

// Re-export core integration points
export { apolloClient } from '@/lib/apollo';
export { authManager } from '@/lib/auth';
export { tenantContextManager } from '@/lib/tenant';
export { subscriptionManager } from '@/lib/subscriptions';
export { cacheService } from '@/lib/cache';

// Integration utilities
export const integrationUtils = {
  /**
   * Initialize all systems in the correct order
   */
  async initializeAllSystems() {
    try {
      // 1. Initialize error handling (already done in layout)
      console.log('✅ Error handling initialized');

      // 2. Initialize Apollo Client (already done in provider)
      console.log('✅ GraphQL client initialized');

      // 3. Initialize authentication system
      await authManager.initialize();
      console.log('✅ Authentication system initialized');

      // 4. Initialize tenant system
      await tenantContextManager.initialize();
      console.log('✅ Tenant system initialized');

      // 5. Initialize subscription system
      await subscriptionManager.initialize();
      console.log('✅ Subscription system initialized');

      // 6. Initialize cache system
      await cacheService.initialize();
      console.log('✅ Cache system initialized');

      console.log('🎉 All systems initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ System initialization failed:', error);
      return false;
    }
  },

  /**
   * Validate that all systems are properly integrated
   */
  async validateIntegration() {
    const checks = [
      {
        name: 'GraphQL Client',
        check: () => !!apolloClient,
      },
      {
        name: 'Authentication Manager',
        check: () => !!authManager && typeof authManager.getAuthState === 'function',
      },
      {
        name: 'Tenant Context Manager',
        check: () => !!tenantContextManager && typeof tenantContextManager.getCurrentContext === 'function',
      },
      {
        name: 'Subscription Manager',
        check: () => !!subscriptionManager && typeof subscriptionManager.getConnectionStatus === 'function',
      },
      {
        name: 'Cache Service',
        check: () => !!cacheService && typeof cacheService.get === 'function',
      },
    ];

    const results = checks.map(({ name, check }) => {
      try {
        const passed = check();
        return { name, passed, error: null };
      } catch (error) {
        return { 
          name, 
          passed: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    const allPassed = results.every(r => r.passed);
    
    console.log('Integration Validation Results:');
    results.forEach(({ name, passed, error }) => {
      console.log(`${passed ? '✅' : '❌'} ${name}${error ? ` - ${error}` : ''}`);
    });

    return { allPassed, results };
  },
};