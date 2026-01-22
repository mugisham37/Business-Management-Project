/**
 * Module System - Central exports for module organization and integration
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */

// Core module system
export { moduleLoader, MODULE_REGISTRY } from '@/lib/performance/module-loader';
export type { ModuleConfig, LoadedModule } from '@/lib/performance/module-loader';

// Enhanced module registry - Only export what exists
export { ENHANCED_MODULE_REGISTRY } from './module-registry';
export type { EnhancedModuleConfig } from './module-registry';

// Shared utilities
export {
  ModuleDependencyResolver,
  ModuleStateManager,
  ModuleEventBus,
  ModulePerformanceTracker,
  moduleUtils,
} from './shared-utilities';

// Routing system
export { ModuleRouter, useModuleNavigation, useModuleBreadcrumbs } from '@/lib/routing/module-router';
export { MODULE_ROUTES } from '@/lib/routing/module-router';
export type { RouteConfig } from '@/lib/routing/module-router';

// Common components
export { ModuleWrapper, ModuleSection, ModuleGrid } from '@/components/common/ModuleWrapper';
export type { ModuleWrapperProps, ModuleSectionProps, ModuleGridProps } from '@/components/common/ModuleWrapper';

export { LazyModule, useLazyModule } from '@/components/common/LazyModule';
export { ModuleNavigation } from '@/components/layout/ModuleNavigation';

// Import for internal use
import { ENHANCED_MODULE_REGISTRY } from './module-registry';
import { moduleLoader } from '@/lib/performance/module-loader';

/**
 * Module System Configuration
 */
export const MODULE_SYSTEM_CONFIG = {
  version: '1.0.0',
  totalModules: Object.keys(ENHANCED_MODULE_REGISTRY).length,
  categories: ['core', 'business', 'integration', 'analytics', 'system'],
  businessTiers: ['MICRO', 'SMALL', 'MEDIUM', 'ENTERPRISE'],
  features: [
    'Lazy loading with code splitting',
    'Permission-based access control',
    'Business tier filtering',
    'Dependency resolution',
    'Performance monitoring',
    'Error boundaries',
    'Cross-module communication',
    'Independent development',
  ],
};

/**
 * Module System Statistics
 */
export function getModuleSystemStats() {
  const modules = Object.values(ENHANCED_MODULE_REGISTRY);
  
  const statsByTier = modules.reduce((acc, module) => {
    const tier = module.businessTier || 'MICRO';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statsByCategory = modules.reduce((acc, module) => {
    const category = module.category || 'other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total: modules.length,
    byTier: statsByTier,
    byCategory: statsByCategory,
    withPermissions: modules.filter(m => m.permissions && m.permissions.length > 0).length,
    withDependencies: modules.filter(m => m.dependencies && m.dependencies.length > 0).length,
    lazyLoaded: modules.filter(m => m.lazy).length,
  };
}

/**
 * Module System Health Check
 */
export function performModuleSystemHealthCheck() {
  const stats = getModuleSystemStats();

  return {
    status: 'healthy',
    statistics: stats,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Development utilities
 */
export const moduleDevUtils = {
  /**
   * List all available modules
   */
  listModules: () => {
    console.table(
      Object.values(ENHANCED_MODULE_REGISTRY).map(module => ({
        name: module.name,
        displayName: module.displayName,
        businessTier: module.businessTier,
        lazy: module.lazy,
        dependencies: module.dependencies?.join(', ') || 'none',
        routes: module.routes?.length || 0,
      }))
    );
  },

  /**
   * Test module loading
   */
  testModuleLoad: async (moduleName: string) => {
    try {
      const startTime = performance.now();
      const loadedModule = await moduleLoader.loadModule(moduleName);
      const loadTime = performance.now() - startTime;
      
      console.log(`Module ${moduleName} loaded successfully in ${loadTime.toFixed(2)}ms`);
      return { success: true, loadTime, module: loadedModule };
    } catch (error) {
      console.error(`Failed to load module ${moduleName}:`, error);
      return { success: false, error };
    }
  },
};

// Make dev utils available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as { moduleDevUtils?: typeof moduleDevUtils }).moduleDevUtils = moduleDevUtils;
}