/**
 * State Debug Tools
 * Development utilities for debugging state management
 */

export interface StateSnapshot {
  storeName: string;
  state: any;
  timestamp: Date;
}

export interface StateChange {
  storeName: string;
  action: string;
  previousState: any;
  newState: any;
  timestamp: Date;
}

/**
 * State Debug Manager
 */
export class StateDebugManager {
  private snapshots: StateSnapshot[] = [];
  private changes: StateChange[] = [];
  private readonly maxSnapshots = 50;
  private readonly maxChanges = 100;

  /**
   * Record state snapshot
   */
  recordSnapshot(storeName: string, state: any): void {
    this.snapshots.push({
      storeName,
      state: JSON.parse(JSON.stringify(state)), // Deep copy
      timestamp: new Date(),
    });

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }
  }

  /**
   * Record state change
   */
  recordChange(storeName: string, action: string, previousState: any, newState: any): void {
    this.changes.push({
      storeName,
      action,
      previousState: JSON.parse(JSON.stringify(previousState)),
      newState: JSON.parse(JSON.stringify(newState)),
      timestamp: new Date(),
    });

    if (this.changes.length > this.maxChanges) {
      this.changes = this.changes.slice(-this.maxChanges);
    }
  }

  /**
   * Get snapshots
   */
  getSnapshots(): StateSnapshot[] {
    return this.snapshots;
  }

  /**
   * Get changes
   */
  getChanges(): StateChange[] {
    return this.changes;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.snapshots = [];
    this.changes = [];
  }
}

/**
 * State Debug Panel Component (placeholder)
 */
export const StateDebugPanel = () => null;

/**
 * Create debug manager
 */
export function createDebugManager(): StateDebugManager {
  return new StateDebugManager();
}

/**
 * Get default debug manager
 */
const defaultDebugManager = createDebugManager();

export function getDefaultDebugManager(): StateDebugManager {
  return defaultDebugManager;
}

/**
 * Hook to use state debug
 */
export function useStateDebug() {
  return defaultDebugManager;
}

/**
 * State debug utilities
 */
export const stateDebugUtils = {
  recordSnapshot: (storeName: string, state: any) =>
    defaultDebugManager.recordSnapshot(storeName, state),
  recordChange: (storeName: string, action: string, previousState: any, newState: any) =>
    defaultDebugManager.recordChange(storeName, action, previousState, newState),
  getSnapshots: () => defaultDebugManager.getSnapshots(),
  getChanges: () => defaultDebugManager.getChanges(),
  clear: () => defaultDebugManager.clear(),
};
