/**
 * Store Provider
 * Integrates Zustand stores with React application
 * Requirements: 6.1, 6.2, 6.5
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from './auth-store';
import { useTenantStore } from './tenant-store';
import { useFeatureStore } from './feature-store';
import { StoreSyncManager, createSyncManager } from './sync-manager';
import { StateDebugManager, createDebugManager, StateDebugPanel } from './debug-tools';

interface StoreProviderProps {
  children: React.ReactNode;
  enableDebug?: boolean;
}

interface StoreProviderContext {
  syncManager: StoreSyncManager;
  debugManager?: StateDebugManager | undefined;
  isInitialized: boolean;
}

const StoreContext = React.createContext<StoreProviderContext | null>(null);

/**
 * Store Provider Component
 * Initializes and manages all Zustand stores with synchronization
 */
export function StoreProvider({ children, enableDebug = process.env.NODE_ENV === 'development' }: StoreProviderProps) {
  const [syncManager] = useState(() => createSyncManager());
  const [debugManager] = useState(() => enableDebug ? createDebugManager() : undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize stores
    const initializeStores = async () => {
      try {
        // Initialize auth store from persisted state
        await useAuthStore.persist.rehydrate();
        
        // Initialize tenant store from persisted state
        await useTenantStore.persist.rehydrate();
        
        // Initialize feature store from persisted state
        await useFeatureStore.persist.rehydrate();

        // Force initial sync
        await syncManager.forcSync();

        setIsInitialized(true);
        
        if (enableDebug) {
          console.log('🏪 Stores initialized with debugging enabled');
        }
      } catch (error) {
        console.error('Failed to initialize stores:', error);
        setIsInitialized(true); // Still mark as initialized to prevent blocking
      }
    };

    initializeStores();

    // Cleanup on unmount
    return () => {
      syncManager.destroy();
      debugManager?.destroy();
    };
  }, [syncManager, debugManager, enableDebug]);

  const contextValue: StoreProviderContext = {
    syncManager,
    debugManager: debugManager || undefined,
    isInitialized,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
      {enableDebug && <StateDebugPanel />}
    </StoreContext.Provider>
  );
}

/**
 * Hook to access store context
 */
export function useStoreContext(): StoreProviderContext {
  const context = React.useContext(StoreContext);
  
  if (!context) {
    throw new Error('useStoreContext must be used within a StoreProvider');
  }
  
  return context;
}

/**
 * Store Loading Component
 * Shows loading state while stores are initializing
 */
interface StoreLoadingProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function StoreLoading({ children, fallback }: StoreLoadingProps) {
  const { isInitialized } = useStoreContext();

  if (!isInitialized) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing application state...</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

/**
 * Store Status Component
 * Shows current store status for debugging
 */
export function StoreStatus() {
  const { syncManager, debugManager, isInitialized } = useStoreContext();
  const authState = useAuthStore();
  const tenantState = useTenantStore();
  const featureState = useFeatureStore();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const syncStatus = syncManager.getSyncStatus();

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-75 text-white p-3 rounded-lg text-xs font-mono max-w-sm z-40">
      <div className="mb-2 font-semibold text-blue-400">Store Status (Dev)</div>
      
      <div className="space-y-1">
        <div>Initialized: {isInitialized ? '✓' : '✗'}</div>
        <div>Sync Active: {syncStatus.inProgress ? '🔄' : '✓'}</div>
        <div>Optimistic Updates: {syncStatus.optimisticUpdates}</div>
        
        <div className="mt-2 pt-2 border-t border-gray-600">
          <div className="font-semibold text-green-400 mb-1">Auth Store</div>
          <div>Authenticated: {authState.isAuthenticated ? '✓' : '✗'}</div>
          <div>Loading: {authState.isLoading ? '🔄' : '✓'}</div>
          <div>User: {authState.user?.email || 'None'}</div>
        </div>

        <div className="mt-2 pt-2 border-t border-gray-600">
          <div className="font-semibold text-yellow-400 mb-1">Tenant Store</div>
          <div>Current: {tenantState.currentTenant?.name || 'None'}</div>
          <div>Tier: {tenantState.businessTier}</div>
          <div>Switching: {tenantState.isSwitching ? '🔄' : '✓'}</div>
        </div>

        <div className="mt-2 pt-2 border-t border-gray-600">
          <div className="font-semibold text-purple-400 mb-1">Feature Store</div>
          <div>Features: {featureState.features.length}</div>
          <div>Loading: {featureState.isLoading ? '🔄' : '✓'}</div>
          <div>Cache Size: {featureState.featureCache.size}</div>
        </div>

        {debugManager && (
          <div className="mt-2 pt-2 border-t border-gray-600">
            <div className="font-semibold text-red-400 mb-1">Debug Info</div>
            <div>Snapshots: {debugManager.getDebugInfo().snapshots}</div>
            <div>Changes: {debugManager.getDebugInfo().changes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Higher-order component for store integration
 */
export function withStores<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function WithStoresComponent(props: P) {
    return (
      <StoreProvider>
        <StoreLoading>
          <Component {...props} />
        </StoreLoading>
      </StoreProvider>
    );
  };
}

/**
 * Store hydration utilities
 */
export const storeHydration = {
  /**
   * Rehydrate all stores from persistence
   */
  rehydrateAll: async () => {
    await Promise.all([
      useAuthStore.persist.rehydrate(),
      useTenantStore.persist.rehydrate(),
      useFeatureStore.persist.rehydrate(),
    ]);
  },

  /**
   * Clear all persisted store data
   */
  clearAll: () => {
    useAuthStore.persist.clearStorage();
    useTenantStore.persist.clearStorage();
    useFeatureStore.persist.clearStorage();
  },

  /**
   * Check if stores have persisted data
   */
  hasPersistedData: () => {
    return Boolean(
      localStorage.getItem('auth-store') ||
      localStorage.getItem('tenant-store') ||
      localStorage.getItem('feature-store')
    );
  },
};