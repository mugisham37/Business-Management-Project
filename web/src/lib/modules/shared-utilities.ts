/**
 * Shared Module Utilities
 * Common utilities and functions used across all business modules
 * Requirements: 11.3, 11.6
 */

import { ModuleConfig } from '@/lib/performance/module-loader';

/**
 * Module dependency resolver
 */
export class ModuleDependencyResolver {
  private dependencyGraph = new Map<string, string[]>();
  private loadedModules = new Set<string>();

  /**
   * Register module dependencies
   */
  registerDependencies(moduleName: string, dependencies: string[]) {
    this.dependencyGraph.set(moduleName, dependencies);
  }

  /**
   * Resolve dependencies for a module
   */
  resolveDependencies(moduleName: string): string[] {
    const visited = new Set<string>();
    const resolved: string[] = [];

    const resolve = (name: string) => {
      if (visited.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      visited.add(name);
      const dependencies = this.dependencyGraph.get(name) || [];

      for (const dep of dependencies) {
        if (!resolved.includes(dep)) {
          resolve(dep);
          resolved.push(dep);
        }
      }

      visited.delete(name);
    };

    resolve(moduleName);
    return resolved;
  }

  /**
   * Check if module can be loaded (all dependencies are loaded)
   */
  canLoadModule(moduleName: string): boolean {
    const dependencies = this.dependencyGraph.get(moduleName) || [];
    return dependencies.every(dep => this.loadedModules.has(dep));
  }

  /**
   * Mark module as loaded
   */
  markAsLoaded(moduleName: string) {
    this.loadedModules.add(moduleName);
  }

  /**
   * Get loading order for modules
   */
  getLoadingOrder(moduleNames: string[]): string[] {
    const order: string[] = [];
    const remaining = new Set(moduleNames);

    while (remaining.size > 0) {
      const canLoad = Array.from(remaining).filter(name => this.canLoadModule(name));
      
      if (canLoad.length === 0) {
        throw new Error('Cannot resolve module dependencies - circular dependency or missing dependency');
      }

      for (const moduleName of canLoad) {
        order.push(moduleName);
        remaining.delete(moduleName);
        this.markAsLoaded(moduleName);
      }
    }

    return order;
  }
}

/**
 * Module state manager for cross-module communication
 */
export class ModuleStateManager {
  private moduleStates = new Map<string, any>();
  private subscribers = new Map<string, Set<(state: any) => void>>();

  /**
   * Set module state
   */
  setState(moduleName: string, state: any) {
    this.moduleStates.set(moduleName, state);
    this.notifySubscribers(moduleName, state);
  }

  /**
   * Get module state
   */
  getState(moduleName: string) {
    return this.moduleStates.get(moduleName);
  }

  /**
   * Subscribe to module state changes
   */
  subscribe(moduleName: string, callback: (state: any) => void) {
    if (!this.subscribers.has(moduleName)) {
      this.subscribers.set(moduleName, new Set());
    }
    this.subscribers.get(moduleName)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(moduleName)?.delete(callback);
    };
  }

  /**
   * Notify subscribers of state changes
   */
  private notifySubscribers(moduleName: string, state: any) {
    const moduleSubscribers = this.subscribers.get(moduleName);
    if (moduleSubscribers) {
      moduleSubscribers.forEach(callback => callback(state));
    }
  }

  /**
   * Clear module state
   */
  clearState(moduleName: string) {
    this.moduleStates.delete(moduleName);
    this.notifySubscribers(moduleName, null);
  }
}

/**
 * Module event bus for inter-module communication
 */
export class ModuleEventBus {
  private listeners = new Map<string, Set<(data: any) => void>>();

  /**
   * Emit event to all listeners
   */
  emit(eventName: string, data?: any) {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * Listen to events
   */
  on(eventName: string, listener: (data: any) => void) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventName)?.delete(listener);
    };
  }

  /**
   * Listen to event once
   */
  once(eventName: string, listener: (data: any) => void) {
    const unsubscribe = this.on(eventName, (data) => {
      listener(data);
      unsubscribe();
    });
    return unsubscribe;
  }

  /**
   * Remove all listeners for an event
   */
  off(eventName: string) {
    this.listeners.delete(eventName);
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
  }
}

/**
 * Module performance tracker
 */
export class ModulePerformanceTracker {
  private loadTimes = new Map<string, number>();
  private renderTimes = new Map<string, number>();
  private errorCounts = new Map<string, number>();

  /**
   * Record module load time
   */
  recordLoadTime(moduleName: string, loadTime: number) {
    this.loadTimes.set(moduleName, loadTime);
  }

  /**
   * Record module render time
   */
  recordRenderTime(moduleName: string, renderTime: number) {
    this.renderTimes.set(moduleName, renderTime);
  }

  /**
   * Record module error
   */
  recordError(moduleName: string) {
    const currentCount = this.errorCounts.get(moduleName) || 0;
    this.errorCounts.set(moduleName, currentCount + 1);
  }

  /**
   * Get performance metrics for a module
   */
  getMetrics(moduleName: string) {
    return {
      loadTime: this.loadTimes.get(moduleName),
      renderTime: this.renderTimes.get(moduleName),
      errorCount: this.errorCounts.get(moduleName) || 0,
    };
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics() {
    const metrics: Record<string, any> = {};
    
    // Combine all module names
    const allModules = new Set([
      ...this.loadTimes.keys(),
      ...this.renderTimes.keys(),
      ...this.errorCounts.keys(),
    ]);

    allModules.forEach(moduleName => {
      metrics[moduleName] = this.getMetrics(moduleName);
    });

    return metrics;
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const allMetrics = this.getAllMetrics();
    const moduleNames = Object.keys(allMetrics);

    const loadTimes = moduleNames
      .map(name => allMetrics[name].loadTime)
      .filter(time => time !== undefined);

    const renderTimes = moduleNames
      .map(name => allMetrics[name].renderTime)
      .filter(time => time !== undefined);

    const totalErrors = moduleNames
      .reduce((sum, name) => sum + allMetrics[name].errorCount, 0);

    return {
      totalModules: moduleNames.length,
      averageLoadTime: loadTimes.length > 0 
        ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length 
        : 0,
      averageRenderTime: renderTimes.length > 0
        ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length
        : 0,
      totalErrors,
      slowestModule: moduleNames.reduce((slowest, name) => {
        const loadTime = allMetrics[name].loadTime || 0;
        const slowestTime = allMetrics[slowest]?.loadTime || 0;
        return loadTime > slowestTime ? name : slowest;
      }, moduleNames[0]),
    };
  }
}

/**
 * Shared utility functions
 */
export const moduleUtils = {
  /**
   * Format module name for display
   */
  formatModuleName(moduleName: string): string {
    return moduleName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },

  /**
   * Generate module route path
   */
  getModuleRoute(moduleName: string, subPath?: string): string {
    const basePath = `/${moduleName}`;
    return subPath ? `${basePath}/${subPath}` : basePath;
  },

  /**
   * Check if module is available for business tier
   */
  isModuleAvailable(moduleConfig: ModuleConfig, businessTier: string): boolean {
    if (!moduleConfig.businessTier) return true;
    
    const tierOrder = ['MICRO', 'SMALL', 'MEDIUM', 'ENTERPRISE'];
    const currentTierIndex = tierOrder.indexOf(businessTier);
    const requiredTierIndex = tierOrder.indexOf(moduleConfig.businessTier);
    
    return currentTierIndex >= requiredTierIndex;
  },

  /**
   * Check if user has module permissions
   */
  hasModulePermissions(moduleConfig: ModuleConfig, userPermissions: string[]): boolean {
    if (!moduleConfig.permissions || moduleConfig.permissions.length === 0) {
      return true;
    }
    
    return moduleConfig.permissions.some(permission => 
      userPermissions.includes(permission)
    );
  },

  /**
   * Generate module breadcrumbs
   */
  generateBreadcrumbs(pathname: string): Array<{ label: string; path: string }> {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Home', path: '/' }];

    let currentPath = '';
    for (const segment of segments) {
      currentPath += `/${segment}`;
      breadcrumbs.push({
        label: moduleUtils.formatModuleName(segment),
        path: currentPath,
      });
    }

    return breadcrumbs;
  },
};

// Export singleton instances
export const dependencyResolver = new ModuleDependencyResolver();
export const moduleStateManager = new ModuleStateManager();
export const moduleEventBus = new ModuleEventBus();
export const performanceTracker = new ModulePerformanceTracker();