/**
 * State Debugging Tools
 * Development-mode state inspection and debugging utilities
 * Requirements: 6.7
 */

import { useAuthStore } from './auth-store';
import { useTenantStore } from './tenant-store';
import { useFeatureStore } from './feature-store';
import { useSyncManager } from './sync-manager';

export interface StateSnapshot {
  timestamp: Date;
  auth: ReturnType<typeof useAuthStore.getState>;
  tenant: ReturnType<typeof useTenantStore.getState>;
  feature: ReturnType<typeof useFeatureStore.getState>;
  sync: ReturnType<typeof useSyncManager>['getSyncStatus'];
}

export interface StateChange {
  id: string;
  timestamp: Date;
  store: 'auth' | 'tenant' | 'feature';
  action: string;
  previousState: unknown;
  newState: unknown;
  diff: Record<string, { from: unknown; to: unknown }>;
}

/**
 * State Debug Manager
 * Provides debugging tools for Zustand stores
 */
export class StateDebugManager {
  private isEnabled: boolean;
  private snapshots: StateSnapshot[] = [];
  private changes: StateChange[] = [];
  private maxSnapshots = 50;
  private maxChanges = 100;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development';
    
    if (this.isEnabled) {
      this.initializeDebugging();
      this.setupReduxDevTools();
    }
  }

  /**
   * Initialize state debugging
   */
  private initializeDebugging(): void {
    // Take initial snapshot
    this.takeSnapshot();

    // Set up store subscriptions for change tracking
    this.setupAuthDebugging();
    this.setupTenantDebugging();
    this.setupFeatureDebugging();

    // Set up periodic snapshots
    const snapshotInterval = setInterval(() => {
      this.takeSnapshot();
    }, 10000); // Every 10 seconds

    this.unsubscribers.push(() => clearInterval(snapshotInterval));
  }

  /**
   * Set up auth store debugging
   */
  private setupAuthDebugging(): void {
    let previousState = useAuthStore.getState();

    const unsubscribe = useAuthStore.subscribe((state) => {
      const changes = this.detectChanges(previousState, state);
      
      if (Object.keys(changes).length > 0) {
        this.recordChange('auth', 'state_change', previousState, state, changes);
      }
      
      previousState = state;
    });

    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Set up tenant store debugging
   */
  private setupTenantDebugging(): void {
    let previousState = useTenantStore.getState();

    const unsubscribe = useTenantStore.subscribe((state) => {
      const changes = this.detectChanges(previousState, state);
      
      if (Object.keys(changes).length > 0) {
        this.recordChange('tenant', 'state_change', previousState, state, changes);
      }
      
      previousState = state;
    });

    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Set up feature store debugging
   */
  private setupFeatureDebugging(): void {
    let previousState = useFeatureStore.getState();

    const unsubscribe = useFeatureStore.subscribe((state) => {
      const changes = this.detectChanges(previousState, state);
      
      if (Object.keys(changes).length > 0) {
        this.recordChange('feature', 'state_change', previousState, state, changes);
      }
      
      previousState = state;
    });

    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Set up Redux DevTools integration
   */
  private setupReduxDevTools(): void {
    if (typeof window === 'undefined') return;

    const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__;
    if (!devTools) return;

    const devToolsInstance = devTools.connect({
      name: 'Zustand Stores',
      features: {
        pause: true,
        lock: true,
        persist: true,
        export: true,
        import: 'custom',
        jump: true,
        skip: true,
        reorder: true,
        dispatch: true,
        test: true,
      },
    });

    // Send initial state
    devToolsInstance.init({
      auth: useAuthStore.getState(),
      tenant: useTenantStore.getState(),
      feature: useFeatureStore.getState(),
    });

    // Subscribe to store changes and send to DevTools
    const unsubscribeAuth = useAuthStore.subscribe((state) => {
      devToolsInstance.send('AUTH_STATE_CHANGE', {
        auth: state,
        tenant: useTenantStore.getState(),
        feature: useFeatureStore.getState(),
      });
    });

    const unsubscribeTenant = useTenantStore.subscribe((state) => {
      devToolsInstance.send('TENANT_STATE_CHANGE', {
        auth: useAuthStore.getState(),
        tenant: state,
        feature: useFeatureStore.getState(),
      });
    });

    const unsubscribeFeature = useFeatureStore.subscribe((state) => {
      devToolsInstance.send('FEATURE_STATE_CHANGE', {
        auth: useAuthStore.getState(),
        tenant: useTenantStore.getState(),
        feature: state,
      });
    });

    this.unsubscribers.push(unsubscribeAuth, unsubscribeTenant, unsubscribeFeature);
  }

  /**
   * Take a snapshot of current state
   */
  takeSnapshot(): StateSnapshot {
    const snapshot: StateSnapshot = {
      timestamp: new Date(),
      auth: useAuthStore.getState(),
      tenant: useTenantStore.getState(),
      feature: useFeatureStore.getState(),
      sync: useSyncManager().getSyncStatus(),
    };

    this.snapshots.push(snapshot);

    // Limit snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    return snapshot;
  }

  /**
   * Record a state change
   */
  private recordChange(
    store: StateChange['store'],
    action: string,
    previousState: unknown,
    newState: unknown,
    diff: Record<string, { from: unknown; to: unknown }>
  ): void {
    const change: StateChange = {
      id: `${store}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      store,
      action,
      previousState,
      newState,
      diff,
    };

    this.changes.push(change);

    // Limit changes
    if (this.changes.length > this.maxChanges) {
      this.changes = this.changes.slice(-this.maxChanges);
    }

    // Log to console in development
    if (this.isEnabled) {
      console.group(`🔄 State Change: ${store.toUpperCase()}`);
      console.log('Action:', action);
      console.log('Changes:', diff);
      console.log('Previous State:', previousState);
      console.log('New State:', newState);
      console.groupEnd();
    }
  }

  /**
   * Detect changes between two state objects
   */
  private detectChanges(
    previous: Record<string, unknown>,
    current: Record<string, unknown>
  ): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    // Check for changed or new properties
    for (const key in current) {
      if (previous[key] !== current[key]) {
        changes[key] = {
          from: previous[key],
          to: current[key],
        };
      }
    }

    // Check for removed properties
    for (const key in previous) {
      if (!(key in current)) {
        changes[key] = {
          from: previous[key],
          to: undefined,
        };
      }
    }

    return changes;
  }

  /**
   * Get debugging information
   */
  getDebugInfo() {
    return {
      enabled: this.isEnabled,
      snapshots: this.snapshots.length,
      changes: this.changes.length,
      currentState: {
        auth: useAuthStore.getState(),
        tenant: useTenantStore.getState(),
        feature: useFeatureStore.getState(),
      },
    };
  }

  /**
   * Get recent snapshots
   */
  getSnapshots(limit = 10): StateSnapshot[] {
    return this.snapshots.slice(-limit);
  }

  /**
   * Get recent changes
   */
  getChanges(limit = 20): StateChange[] {
    return this.changes.slice(-limit);
  }

  /**
   * Export state for debugging
   */
  exportState(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      snapshots: this.snapshots,
      changes: this.changes,
      currentState: {
        auth: useAuthStore.getState(),
        tenant: useTenantStore.getState(),
        feature: useFeatureStore.getState(),
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Clear debugging data
   */
  clearDebugData(): void {
    this.snapshots = [];
    this.changes = [];
    console.log('🧹 Debug data cleared');
  }

  /**
   * Log current state to console
   */
  logCurrentState(): void {
    if (!this.isEnabled) return;

    console.group('📊 Current State');
    console.log('Auth:', useAuthStore.getState());
    console.log('Tenant:', useTenantStore.getState());
    console.log('Feature:', useFeatureStore.getState());
    console.log('Sync:', useSyncManager().getSyncStatus());
    console.groupEnd();
  }

  /**
   * Cleanup debugging
   */
  destroy(): void {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    this.snapshots = [];
    this.changes = [];
  }
}

// Default debug manager instance
let defaultDebugManager: StateDebugManager | null = null;

export function createDebugManager(): StateDebugManager {
  return new StateDebugManager();
}

export function getDefaultDebugManager(): StateDebugManager | null {
  return defaultDebugManager;
}

export function setDefaultDebugManager(manager: StateDebugManager): void {
  defaultDebugManager = manager;
}

// Initialize default debug manager in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  defaultDebugManager = new StateDebugManager();
}

/**
 * Hook for accessing debug manager
 */
export function useStateDebug(): StateDebugManager {
  if (!defaultDebugManager) {
    throw new Error('Debug manager not initialized');
  }
  return defaultDebugManager;
}

/**
 * Debug component for development
 */
export function StateDebugPanel() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const debugManager = useStateDebug();
  const debugInfo = debugManager.getDebugInfo();

  return (
    <div className="fixed bottom-4 left-4 bg-black bg-opacity-90 text-white p-4 rounded-lg text-xs font-mono max-w-md z-50">
      <div className="mb-2 font-semibold text-green-400">🐛 State Debug Panel</div>
      
      <div className="space-y-1">
        <div>Snapshots: {debugInfo.snapshots}</div>
        <div>Changes: {debugInfo.changes}</div>
        <div>Auth: {debugInfo.currentState.auth.isAuthenticated ? '✓' : '✗'}</div>
        <div>Tenant: {debugInfo.currentState.tenant.currentTenant?.name || 'None'}</div>
        <div>Features: {debugInfo.currentState.feature.features.length}</div>
      </div>

      <div className="mt-3 space-x-2">
        <button
          onClick={() => debugManager.logCurrentState()}
          className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
        >
          Log State
        </button>
        <button
          onClick={() => debugManager.takeSnapshot()}
          className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs"
        >
          Snapshot
        </button>
        <button
          onClick={() => debugManager.clearDebugData()}
          className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

/**
 * Console debugging utilities
 */
export const stateDebugUtils = {
  logAuth: () => console.log('Auth State:', useAuthStore.getState()),
  logTenant: () => console.log('Tenant State:', useTenantStore.getState()),
  logFeature: () => console.log('Feature State:', useFeatureStore.getState()),
  logAll: () => {
    console.group('🏪 All Store States');
    console.log('Auth:', useAuthStore.getState());
    console.log('Tenant:', useTenantStore.getState());
    console.log('Feature:', useFeatureStore.getState());
    console.groupEnd();
  },
  exportState: () => {
    const manager = getDefaultDebugManager();
    if (manager) {
      const exported = manager.exportState();
      console.log('Exported state:', exported);
      return exported;
    }
    return null;
  },
};

// Make debug utils available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).stateDebug = stateDebugUtils;
}