/**
 * Module Loader - Dynamic import utilities for code splitting
 * Implements lazy loading for 18+ business modules with error handling
 */

import { ComponentType, lazy, LazyExoticComponent } from 'react';
import { BusinessTier } from '@/types/core';

export interface ModuleConfig {
  name: string;
  path: string;
  lazy: boolean;
  permissions?: string[];
  businessTier?: BusinessTier;
  preload?: boolean;
}

export interface LoadedModule {
  component: LazyExoticComponent<ComponentType<any>>;
  config: ModuleConfig;
  loaded: boolean;
  error?: Error;
}

/**
 * Module registry for all business modules
 */
export const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  // Core modules
  auth: {
    name: 'Authentication',
    path: '@/modules/auth',
    lazy: false, // Critical module, always loaded
    preload: true,
  },
  tenant: {
    name: 'Tenant Management',
    path: '@/modules/tenant',
    lazy: false, // Critical module, always loaded
    preload: true,
  },
  
  // Business modules - lazy loaded
  warehouse: {
    name: 'Warehouse Management',
    path: '@/modules/warehouse',
    lazy: true,
    businessTier: 'SMALL',
    permissions: ['warehouse:read'],
  },
  pos: {
    name: 'Point of Sale',
    path: '@/modules/pos',
    lazy: true,
    businessTier: 'MICRO',
    permissions: ['pos:read'],
  },
  inventory: {
    name: 'Inventory Management',
    path: '@/modules/inventory',
    lazy: true,
    businessTier: 'MICRO',
    permissions: ['inventory:read'],
  },
  financial: {
    name: 'Financial Management',
    path: '@/modules/financial',
    lazy: true,
    businessTier: 'SMALL',
    permissions: ['financial:read'],
  },
  supplier: {
    name: 'Supplier Management',
    path: '@/modules/supplier',
    lazy: true,
    businessTier: 'SMALL',
    permissions: ['supplier:read'],
  },
  employee: {
    name: 'Employee Management',
    path: '@/modules/employee',
    lazy: true,
    businessTier: 'SMALL',
    permissions: ['employee:read'],
  },
  crm: {
    name: 'Customer Relationship Management',
    path: '@/modules/crm',
    lazy: true,
    businessTier: 'MEDIUM',
    permissions: ['crm:read'],
  },
  location: {
    name: 'Location Management',
    path: '@/modules/location',
    lazy: true,
    businessTier: 'SMALL',
    permissions: ['location:read'],
  },
  integration: {
    name: 'Integration Management',
    path: '@/modules/integration',
    lazy: true,
    businessTier: 'MEDIUM',
    permissions: ['integration:read'],
  },
  communication: {
    name: 'Communication',
    path: '@/modules/communication',
    lazy: true,
    businessTier: 'SMALL',
    permissions: ['communication:read'],
  },
  realtime: {
    name: 'Real-time Dashboard',
    path: '@/modules/realtime',
    lazy: true,
    businessTier: 'MEDIUM',
    permissions: ['realtime:read'],
  },
  security: {
    name: 'Security Management',
    path: '@/modules/security',
    lazy: true,
    businessTier: 'ENTERPRISE',
    permissions: ['security:admin'],
  },
  queue: {
    name: 'Queue Management',
    path: '@/modules/queue',
    lazy: true,
    businessTier: 'MEDIUM',
    permissions: ['queue:read'],
  },
  cache: {
    name: 'Cache Management',
    path: '@/modules/cache',
    lazy: true,
    businessTier: 'MEDIUM',
    permissions: ['cache:read'],
  },
  analytics: {
    name: 'Analytics',
    path: '@/modules/analytics',
    lazy: true,
    businessTier: 'MEDIUM',
    permissions: ['analytics:read'],
  },
  health: {
    name: 'Health Monitoring',
    path: '@/modules/health',
    lazy: true,
    businessTier: 'ENTERPRISE',
    permissions: ['health:read'],
  },
  mobile: {
    name: 'Mobile Management',
    path: '@/modules/mobile',
    lazy: true,
    businessTier: 'MEDIUM',
    permissions: ['mobile:read'],
  },
  backup: {
    name: 'Backup Management',
    path: '@/modules/backup',
    lazy: true,
    businessTier: 'ENTERPRISE',
    permissions: ['backup:admin'],
  },
  'disaster-recovery': {
    name: 'Disaster Recovery',
    path: '@/modules/disaster-recovery',
    lazy: true,
    businessTier: 'ENTERPRISE',
    permissions: ['disaster-recovery:admin'],
  },
  b2b: {
    name: 'B2B Integration',
    path: '@/modules/b2b',
    lazy: true,
    businessTier: 'ENTERPRISE',
    permissions: ['b2b:read'],
  },
};

/**
 * Module loader class for managing dynamic imports
 */
class ModuleLoader {
  private loadedModules = new Map<string, LoadedModule>();
  private preloadPromises = new Map<string, Promise<void>>();

  /**
   * Load a module dynamically
   */
  async loadModule(moduleName: string): Promise<LoadedModule> {
    const config = MODULE_REGISTRY[moduleName];
    if (!config) {
      throw new Error(`Module ${moduleName} not found in registry`);
    }

    // Return cached module if already loaded
    const cached = this.loadedModules.get(moduleName);
    if (cached) {
      return cached;
    }

    try {
      const component = lazy(() => this.importModule(config.path));
      
      const loadedModule: LoadedModule = {
        component,
        config,
        loaded: true,
      };

      this.loadedModules.set(moduleName, loadedModule);
      return loadedModule;
    } catch (error) {
      const errorModule: LoadedModule = {
        component: lazy(() => Promise.resolve({ default: () => null })),
        config,
        loaded: false,
        error: error as Error,
      };

      this.loadedModules.set(moduleName, errorModule);
      throw error;
    }
  }

  /**
   * Preload modules for better performance
   */
  async preloadModule(moduleName: string): Promise<void> {
    const config = MODULE_REGISTRY[moduleName];
    if (!config) {
      return;
    }

    // Return existing preload promise if in progress
    const existingPromise = this.preloadPromises.get(moduleName);
    if (existingPromise) {
      return existingPromise;
    }

    const preloadPromise = this.importModule(config.path)
      .then(() => {
        this.preloadPromises.delete(moduleName);
      })
      .catch((error) => {
        console.warn(`Failed to preload module ${moduleName}:`, error);
        this.preloadPromises.delete(moduleName);
      });

    this.preloadPromises.set(moduleName, preloadPromise);
    return preloadPromise;
  }

  /**
   * Preload critical modules
   */
  async preloadCriticalModules(): Promise<void> {
    const criticalModules = Object.entries(MODULE_REGISTRY)
      .filter(([, config]) => config.preload)
      .map(([name]) => name);

    await Promise.allSettled(
      criticalModules.map(moduleName => this.preloadModule(moduleName))
    );
  }

  /**
   * Get modules available for current user/tenant
   */
  getAvailableModules(
    userPermissions: string[] = [],
    businessTier: BusinessTier = 'MICRO'
  ): ModuleConfig[] {
    const tierOrder: BusinessTier[] = ['MICRO', 'SMALL', 'MEDIUM', 'ENTERPRISE'];
    const currentTierIndex = tierOrder.indexOf(businessTier);

    return Object.values(MODULE_REGISTRY).filter(config => {
      // Check business tier requirement
      if (config.businessTier) {
        const requiredTierIndex = tierOrder.indexOf(config.businessTier);
        if (currentTierIndex < requiredTierIndex) {
          return false;
        }
      }

      // Check permissions
      if (config.permissions && config.permissions.length > 0) {
        return config.permissions.some(permission => 
          userPermissions.includes(permission)
        );
      }

      return true;
    });
  }

  /**
   * Import module with error handling
   */
  private async importModule(modulePath: string) {
    try {
      // Dynamic import with webpack magic comments for chunk naming
      const chunkName = modulePath.split('/').pop() || 'unknown';
      return await import(
        /* webpackChunkName: "[request]" */
        /* webpackPreload: true */
        modulePath
      );
    } catch (error) {
      console.error(`Failed to import module ${modulePath}:`, error);
      
      // Return fallback component
      return {
        default: () => {
          return (
            <div className="p-4 text-center">
              <h3 className="text-lg font-medium text-red-600">
                Module Loading Error
              </h3>
              <p className="text-sm text-gray-600 mt-2">
                Failed to load module: {modulePath}
              </p>
            </div>
          );
        }
      };
    }
  }

  /**
   * Clear module cache (useful for development)
   */
  clearCache(): void {
    this.loadedModules.clear();
    this.preloadPromises.clear();
  }

  /**
   * Get loading statistics
   */
  getStats() {
    return {
      totalModules: Object.keys(MODULE_REGISTRY).length,
      loadedModules: this.loadedModules.size,
      preloadingModules: this.preloadPromises.size,
      failedModules: Array.from(this.loadedModules.values())
        .filter(module => module.error).length,
    };
  }
}

// Export singleton instance
export const moduleLoader = new ModuleLoader();

// Export types
export type { LoadedModule };