/**
 * Store Index
 * Central exports for all Zustand stores
 */

// Auth store
export {
  useAuthStore,
  authSelectors,
  useAuthPermissions,
  type AuthStore,
  type AuthState,
  type AuthActions,
} from './auth-store';

// Tenant store
export {
  useTenantStore,
  tenantSelectors,
  useTenantUtils,
  type TenantStore,
  type TenantState,
  type TenantActions,
} from './tenant-store';

// Feature store
export {
  useFeatureStore,
  featureSelectors,
  useFeatureUtils,
  useFeatureFlag,
  type FeatureStore,
  type FeatureState,
  type FeatureActions,
  type FeatureConfig,
} from './feature-store';

// Store synchronization utilities
export * from './sync-manager';

// Debug tools (development only)
export {
  StateDebugManager,
  StateDebugPanel,
  createDebugManager,
  getDefaultDebugManager,
  useStateDebug,
  stateDebugUtils,
  type StateSnapshot,
  type StateChange,
} from './debug-tools';

// Store provider and utilities
export {
  StoreProvider,
  StoreLoading,
  StoreStatus,
  useStoreContext,
  withStores,
  storeHydration,
} from './store-provider';

// Integration hooks for backward compatibility
export {
  useAuthManagerSync,
  useTenantManagerSync,
  useFeatureManagerSync,
  useStoreIntegration,
  useAuthCompat,
  useTenantCompat,
  migrationUtils,
} from './integration-hooks';