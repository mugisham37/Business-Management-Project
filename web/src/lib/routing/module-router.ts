/**
 * Module Router
 * Handles dynamic module routing and loading
 */

export interface ModuleRouteConfig {
  path: string;
  name: string;
  component?: any;
  enabled: boolean;
}

export interface ModuleRouteContext {
  getRoute(moduleName: string): ModuleRouteConfig | undefined;
  getRoutes(): ModuleRouteConfig[];
  registerRoute(config: ModuleRouteConfig): void;
  unregisterRoute(moduleName: string): void;
}

/**
 * Module Router Implementation
 */
class ModuleRouter implements ModuleRouteContext {
  private routes: Map<string, ModuleRouteConfig> = new Map();

  /**
   * Get a specific route
   */
  getRoute(moduleName: string): ModuleRouteConfig | undefined {
    return this.routes.get(moduleName);
  }

  /**
   * Get all routes
   */
  getRoutes(): ModuleRouteConfig[] {
    return Array.from(this.routes.values()).filter(route => route.enabled);
  }

  /**
   * Register a route
   */
  registerRoute(config: ModuleRouteConfig): void {
    this.routes.set(config.name, config);
  }

  /**
   * Unregister a route
   */
  unregisterRoute(moduleName: string): void {
    this.routes.delete(moduleName);
  }

  /**
   * Get route by path
   */
  getRouteByPath(path: string): ModuleRouteConfig | undefined {
    return Array.from(this.routes.values()).find(route => route.path === path && route.enabled);
  }

  /**
   * Check if route exists and is enabled
   */
  isRouteAvailable(moduleName: string): boolean {
    const route = this.routes.get(moduleName);
    return route ? route.enabled : false;
  }
}

// Export singleton instance
export const moduleRouter = new ModuleRouter();

/**
 * Hook to use module router
 */
export function useModuleRouter(): ModuleRouteContext {
  return moduleRouter;
}

/**
 * Get available routes for navigation
 */
export function getAvailableRoutes(): ModuleRouteConfig[] {
  return moduleRouter.getRoutes();
}
