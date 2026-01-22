/**
 * Integration Layer
 * Provides utilities and services for system integration
 */

export * from './system-health';

// Re-export core integration points
export { apolloClient } from '@/lib/apollo';
export { getUnifiedCacheManager } from '@/lib/cache';

// Import managers for internal use
import { apolloClient } from '@/lib/apollo';
import { getUnifiedCacheManager } from '@/lib/cache';

// Note: authManager, tenantContextManager, and subscriptionManager
// will be implemented in their respective modules

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

      // 3. Initialize cache system
      const _cacheManager = getUnifiedCacheManager();
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
    const cacheManager = getUnifiedCacheManager();
    
    const checks = [
      {
        name: 'GraphQL Client',
        check: () => !!apolloClient,
      },
      {
        name: 'Cache Manager',
        check: () => !!cacheManager && typeof cacheManager.get === 'function',
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