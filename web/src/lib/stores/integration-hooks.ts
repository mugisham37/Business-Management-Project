/**
 * Integration Hooks
 * Bridge between existing React Context patterns and new Zustand stores
 * Requirements: 6.2, 6.5
 */

import { useEffect } from 'react';
import { useAuthStore, authSelectors } from './auth-store';
import { useTenantStore, tenantSelectors } from './tenant-store';
import { useFeatureStore, featureSelectors } from './feature-store';
import { authManager, mfaManager } from '@/lib/auth';
import { tenantContextManager } from '@/lib/tenant/tenant-context';

/**
 * Hook to sync auth manager with auth store
 */
export function useAuthManagerSync() {
  const authStore = useAuthStore();

  useEffect(() => {
    // Subscribe to auth manager changes and update store
    const unsubscribeAuth = authManager.onAuthStateChange((authState) => {
      // Update store with auth manager state
      authStore.setUser(authState.user);
      authStore.setTokens(authState.tokens);
      authStore.setPermissions(authState.permissions);
      authStore.setAuthenticated(authState.isAuthenticated);
      authStore.setLoading(authState.isLoading);
      authStore.setMfaRequired(authState.mfaRequired);
    });

    // Subscribe to MFA manager changes
    const unsubscribeMFA = mfaManager.onMFAStateChange((mfaState) => {
      authStore.setMfaRequired(mfaState.isVerificationRequired);
    });

    // Subscribe to store changes and update auth manager
    const unsubscribeStore = useAuthStore.subscribe(
      (state) => ({
        user: state.user,
        tokens: state.tokens,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
      (current, previous) => {
        // Only sync if there are actual changes to prevent loops
        if (current !== previous) {
          // Update auth manager state if needed
          const currentAuthState = authManager.getAuthState();
          
          if (currentAuthState.user?.id !== current.user?.id) {
            // Significant auth change - let auth manager handle it
            console.log('Auth state divergence detected, syncing...');
          }
        }
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeMFA();
      unsubscribeStore();
    };
  }, [authStore]);

  return {
    // Expose auth store selectors
    user: useAuthStore(authSelectors.user),
    isAuthenticated: useAuthStore(authSelectors.isAuthenticated),
    isLoading: useAuthStore(authSelectors.isLoading),
    permissions: useAuthStore(authSelectors.permissions),
    mfaRequired: useAuthStore(authSelectors.mfaRequired),
    error: useAuthStore(authSelectors.error),
    
    // Expose auth actions
    login: authStore.login,
    logout: authStore.logout,
    refreshTokens: authStore.refreshTokens,
  };
}

/**
 * Hook to sync tenant context manager with tenant store
 */
export function useTenantManagerSync() {
  const tenantStore = useTenantStore();

  useEffect(() => {
    // Subscribe to tenant context manager changes
    const unsubscribeTenant = tenantContextManager.onStateChange((tenantState) => {
      // Update store with tenant manager state
      tenantStore.setCurrentTenant(tenantState.currentTenant);
      tenantStore.setAvailableTenants(tenantState.availableTenants);
      tenantStore.setBusinessTier(tenantState.businessTier);
      tenantStore.setLoading(tenantState.isLoading);
      
      if (tenantState.error) {
        tenantStore.setError(tenantState.error);
      } else {
        tenantStore.clearError();
      }
    });

    // Subscribe to store changes and update tenant manager
    const unsubscribeStore = useTenantStore.subscribe(
      (state) => state.currentTenant,
      (currentTenant, previousTenant) => {
        // Handle tenant switching through the manager
        if (currentTenant?.id !== previousTenant?.id && currentTenant) {
          console.log('Tenant change detected in store, syncing with manager...');
        }
      }
    );

    return () => {
      unsubscribeTenant();
      unsubscribeStore();
    };
  }, [tenantStore]);

  return {
    // Expose tenant store selectors
    currentTenant: useTenantStore(tenantSelectors.currentTenant),
    availableTenants: useTenantStore(tenantSelectors.availableTenants),
    businessTier: useTenantStore(tenantSelectors.businessTier),
    isLoading: useTenantStore(tenantSelectors.isLoading),
    isSwitching: useTenantStore(tenantSelectors.isSwitching),
    error: useTenantStore(tenantSelectors.error),
    
    // Expose tenant actions
    switchTenant: tenantStore.switchTenant,
    validateAccess: tenantStore.validateTenantAccess,
    isTierSufficient: tenantStore.isTierSufficient,
  };
}

/**
 * Hook to sync feature flags with feature store
 */
export function useFeatureManagerSync() {
  const featureStore = useFeatureStore();
  const tenantStore = useTenantStore();

  useEffect(() => {
    // Sync features when tenant changes
    const unsubscribeTenant = useTenantStore.subscribe(
      (state) => state.currentTenant,
      async (currentTenant) => {
        if (currentTenant) {
          try {
            featureStore.setLoading(true);
            
            // Fetch features for the current tenant
            // This would typically come from the tenant context manager
            const tenantState = tenantContextManager.getState();
            featureStore.setFeatures(tenantState.features);
            
            featureStore.setLoading(false);
          } catch (error) {
            console.error('Failed to sync features:', error);
            featureStore.setError(error instanceof Error ? error.message : 'Failed to sync features');
            featureStore.setLoading(false);
          }
        }
      }
    );

    return () => {
      unsubscribeTenant();
    };
  }, [featureStore, tenantStore]);

  return {
    // Expose feature store selectors
    features: useFeatureStore(featureSelectors.features),
    isLoading: useFeatureStore(featureSelectors.isLoading),
    error: useFeatureStore(featureSelectors.error),
    
    // Expose feature utilities
    hasFeature: (key: string) => 
      featureStore.hasFeature(key, useTenantStore.getState().businessTier),
    getFeatureConfig: featureStore.getFeatureConfig,
    getAvailableFeatures: () => 
      featureStore.getAvailableFeatures(useTenantStore.getState().businessTier),
  };
}

/**
 * Combined hook for all store integrations
 */
export function useStoreIntegration() {
  const auth = useAuthManagerSync();
  const tenant = useTenantManagerSync();
  const feature = useFeatureManagerSync();

  return {
    auth,
    tenant,
    feature,
    
    // Combined utilities
    isFullyInitialized: () => {
      return !auth.isLoading && !tenant.isLoading && !feature.isLoading;
    },
    
    hasErrors: () => {
      return Boolean(auth.error || tenant.error || feature.error);
    },
    
    getErrors: () => {
      const errors = [];
      if (auth.error) errors.push({ type: 'auth', message: auth.error });
      if (tenant.error) errors.push({ type: 'tenant', message: tenant.error });
      if (feature.error) errors.push({ type: 'feature', message: feature.error });
      return errors;
    },
  };
}

/**
 * Hook for backward compatibility with existing auth context
 */
export function useAuthCompat() {
  const auth = useAuthManagerSync();
  
  // Return interface compatible with existing AuthProvider
  return {
    authState: {
      user: auth.user,
      tokens: null, // Don't expose tokens for security
      permissions: auth.permissions,
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
      mfaRequired: auth.mfaRequired,
      error: auth.error,
    },
    mfaState: {
      isEnabled: auth.user?.mfaEnabled || false,
      isRequired: auth.mfaRequired,
      isVerifying: false, // This would come from MFA manager
      error: null,
    },
    isInitialized: !auth.isLoading,
  };
}

/**
 * Hook for backward compatibility with existing tenant context
 */
export function useTenantCompat() {
  const tenant = useTenantManagerSync();
  
  // Return interface compatible with existing tenant context
  return {
    currentTenant: tenant.currentTenant,
    availableTenants: tenant.availableTenants,
    businessTier: tenant.businessTier,
    features: [], // Features are now in separate store
    switchTenant: tenant.switchTenant,
    hasFeature: () => false, // Use feature store instead
    getFeatureConfig: () => null, // Use feature store instead
  };
}

/**
 * Migration utilities for transitioning from Context to Zustand
 */
export const migrationUtils = {
  /**
   * Initialize stores from existing context managers
   */
  initializeFromContext: async () => {
    try {
      // Initialize auth store from auth manager
      const authState = authManager.getAuthState();
      const authStore = useAuthStore.getState();
      
      if (authState.isAuthenticated && authState.user) {
        authStore.login(authState.user, authState.tokens!, authState.permissions);
      }

      // Initialize tenant store from tenant manager
      const tenantState = tenantContextManager.getState();
      const tenantStore = useTenantStore.getState();
      
      if (tenantState.currentTenant) {
        tenantStore.initializeTenant(tenantState.currentTenant, tenantState.availableTenants);
      }

      // Initialize feature store
      const featureStore = useFeatureStore.getState();
      featureStore.setFeatures(tenantState.features);

      console.log('✅ Stores initialized from existing context managers');
    } catch (error) {
      console.error('❌ Failed to initialize stores from context:', error);
    }
  },

  /**
   * Validate store consistency with context managers
   */
  validateConsistency: () => {
    const authState = authManager.getAuthState();
    const authStoreState = useAuthStore.getState();
    
    const tenantState = tenantContextManager.getState();
    const tenantStoreState = useTenantStore.getState();

    const inconsistencies = [];

    // Check auth consistency
    if (authState.isAuthenticated !== authStoreState.isAuthenticated) {
      inconsistencies.push('Auth authentication state mismatch');
    }

    if (authState.user?.id !== authStoreState.user?.id) {
      inconsistencies.push('Auth user mismatch');
    }

    // Check tenant consistency
    if (tenantState.currentTenant?.id !== tenantStoreState.currentTenant?.id) {
      inconsistencies.push('Tenant current tenant mismatch');
    }

    if (inconsistencies.length > 0) {
      console.warn('⚠️ Store consistency issues detected:', inconsistencies);
    } else {
      console.log('✅ Store consistency validated');
    }

    return inconsistencies;
  },
};