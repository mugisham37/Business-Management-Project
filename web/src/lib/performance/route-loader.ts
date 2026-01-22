/**
 * Route Loader - Dynamic route loading with code splitting
 * Implements route-based code splitting for Next.js app router
 */

import { ComponentType } from 'react';
import { moduleLoader } from './module-loader';

export interface RouteConfig {
  path: string;
  moduleName: string;
  component: string;
  preload?: boolean;
  permissions?: string[];
  businessTier?: string;
}

/**
 * Route registry for module-based routing
 */
export const ROUTE_REGISTRY: Record<string, RouteConfig> = {
  // Dashboard routes
  '/dashboard': {
    path: '/dashboard',
    moduleName: 'auth',
    component: 'Dashboard',
    preload: true,
  },
  
  // Module-specific routes
  '/warehouse': {
    path: '/warehouse',
    moduleName: 'warehouse',
    component: 'WarehouseDashboard',
    permissions: ['warehouse:read'],
    businessTier: 'SMALL',
  },
  '/pos': {
    path: '/pos',
    moduleName: 'pos',
    component: 'POSDashboard',
    permissions: ['pos:read'],
    businessTier: 'MICRO',
  },
  '/inventory': {
    path: '/inventory',
    moduleName: 'inventory',
    component: 'InventoryDashboard',
    permissions: ['inventory:read'],
    businessTier: 'MICRO',
  },
  '/financial': {
    path: '/financial',
    moduleName: 'financial',
    component: 'FinancialDashboard',
    permissions: ['financial:read'],
    businessTier: 'SMALL',
  },
  '/suppliers': {
    path: '/suppliers',
    moduleName: 'supplier',
    component: 'SupplierDashboard',
    permissions: ['supplier:read'],
    businessTier: 'SMALL',
  },
  '/employees': {
    path: '/employees',
    moduleName: 'employee',
    component: 'EmployeeDashboard',
    permissions: ['employee:read'],
    businessTier: 'SMALL',
  },
  '/crm': {
    path: '/crm',
    moduleName: 'crm',
    component: 'CRMDashboard',
    permissions: ['crm:read'],
    businessTier: 'MEDIUM',
  },
  '/locations': {
    path: '/locations',
    moduleName: 'location',
    component: 'LocationDashboard',
    permissions: ['location:read'],
    businessTier: 'SMALL',
  },
  '/integrations': {
    path: '/integrations',
    moduleName: 'integration',
    component: 'IntegrationDashboard',
    permissions: ['integration:read'],
    businessTier: 'MEDIUM',
  },
  '/communications': {
    path: '/communications',
    moduleName: 'communication',
    component: 'CommunicationDashboard',
    permissions: ['communication:read'],
    businessTier: 'SMALL',
  },
  '/realtime': {
    path: '/realtime',
    moduleName: 'realtime',
    component: 'RealtimeDashboard',
    permissions: ['realtime:read'],
    businessTier: 'MEDIUM',
  },
  '/security': {
    path: '/security',
    moduleName: 'security',
    component: 'SecurityDashboard',
    permissions: ['security:admin'],
    businessTier: 'ENTERPRISE',
  },
  '/queue': {
    path: '/queue',
    moduleName: 'queue',
    component: 'QueueDashboard',
    permissions: ['queue:read'],
    businessTier: 'MEDIUM',
  },
  '/cache': {
    path: '/cache',
    moduleName: 'cache',
    component: 'CacheDashboard',
    permissions: ['cache:read'],
    businessTier: 'MEDIUM',
  },
  '/analytics': {
    path: '/analytics',
    moduleName: 'analytics',
    component: 'AnalyticsDashboard',
    permissions: ['analytics:read'],
    businessTier: 'MEDIUM',
  },
  '/health': {
    path: '/health',
    moduleName: 'health',
    component: 'HealthDashboard',
    permissions: ['health:read'],
    businessTier: 'ENTERPRISE',
  },
  '/mobile': {
    path: '/mobile',
    moduleName: 'mobile',
    component: 'MobileDashboard',
    permissions: ['mobile:read'],
    businessTier: 'MEDIUM',
  },
  '/backup': {
    path: '/backup',
    moduleName: 'backup',
    component: 'BackupDashboard',
    permissions: ['backup:admin'],
    businessTier: 'ENTERPRISE',
  },
  '/disaster-recovery': {
    path: '/disaster-recovery',
    moduleName: 'disaster-recovery',
    component: 'DisasterRecoveryDashboard',
    permissions: ['disaster-recovery:admin'],
    businessTier: 'ENTERPRISE',
  },
  '/b2b': {
    path: '/b2b',
    moduleName: 'b2b',
    component: 'B2BDashboard',
    permissions: ['b2b:read'],
    businessTier: 'ENTERPRISE',
  },
};

/**
 * Route loader class for managing dynamic route loading
 */
class RouteLoader {
  private routeCache = new Map<string, ComponentType<unknown>>();

  /**
   * Load route component dynamically
   */
  async loadRoute(path: string): Promise<ComponentType<unknown>> {
    const routeConfig = ROUTE_REGISTRY[path];
    if (!routeConfig) {
      throw new Error(`Route ${path} not found in registry`);
    }

    // Return cached component if available
    const cached = this.routeCache.get(path);
    if (cached) {
      return cached;
    }

    try {
      // Load the module first
      const loadedModule = await moduleLoader.loadModule(routeConfig.moduleName);
      
      // Get the specific component from the module
      const moduleExports = await import(
        /* webpackChunkName: "[request]" */
        loadedModule.config.path
      );
      
      const component = moduleExports[routeConfig.component] || moduleExports.default;
      if (!component) {
        throw new Error(
          `Component ${routeConfig.component} not found in module ${routeConfig.moduleName}`
        );
      }

      this.routeCache.set(path, component);
      return component;
    } catch (error) {
      console.error(`Failed to load route ${path}:`, error);
      throw error;
    }
  }

  /**
   * Preload route for better performance
   */
  async preloadRoute(path: string): Promise<void> {
    const routeConfig = ROUTE_REGISTRY[path];
    if (!routeConfig) {
      return;
    }

    try {
      await moduleLoader.preloadModule(routeConfig.moduleName);
    } catch (error) {
      console.warn(`Failed to preload route ${path}:`, error);
    }
  }

  /**
   * Preload routes based on user navigation patterns
   */
  async preloadLikelyRoutes(currentPath: string): Promise<void> {
    // Get routes that are likely to be visited next
    const likelyRoutes = this.getLikelyNextRoutes(currentPath);
    
    await Promise.allSettled(
      likelyRoutes.map(route => this.preloadRoute(route))
    );
  }

  /**
   * Get routes available for current user/tenant
   */
  getAvailableRoutes(
    userPermissions: string[] = [],
    businessTier: string = 'MICRO'
  ): RouteConfig[] {
    const tierOrder = ['MICRO', 'SMALL', 'MEDIUM', 'ENTERPRISE'];
    const currentTierIndex = tierOrder.indexOf(businessTier);

    return Object.values(ROUTE_REGISTRY).filter(route => {
      // Check business tier requirement
      if (route.businessTier) {
        const requiredTierIndex = tierOrder.indexOf(route.businessTier);
        if (currentTierIndex < requiredTierIndex) {
          return false;
        }
      }

      // Check permissions
      if (route.permissions && route.permissions.length > 0) {
        return route.permissions.some(permission => 
          userPermissions.includes(permission)
        );
      }

      return true;
    });
  }

  /**
   * Get likely next routes based on current path
   */
  private getLikelyNextRoutes(currentPath: string): string[] {
    // Simple heuristic - preload related modules
    const relatedRoutes: Record<string, string[]> = {
      '/dashboard': ['/warehouse', '/pos', '/inventory'],
      '/warehouse': ['/inventory', '/suppliers', '/locations'],
      '/pos': ['/inventory', '/financial', '/crm'],
      '/inventory': ['/warehouse', '/suppliers', '/pos'],
      '/financial': ['/pos', '/crm', '/analytics'],
      '/crm': ['/communications', '/analytics', '/financial'],
      '/integrations': ['/b2b', '/communications', '/queue'],
      '/security': ['/health', '/backup', '/disaster-recovery'],
    };

    return relatedRoutes[currentPath] || [];
  }

  /**
   * Clear route cache
   */
  clearCache(): void {
    this.routeCache.clear();
  }

  /**
   * Get loading statistics
   */
  getStats() {
    return {
      totalRoutes: Object.keys(ROUTE_REGISTRY).length,
      cachedRoutes: this.routeCache.size,
    };
  }
}

// Export singleton instance
export const routeLoader = new RouteLoader();