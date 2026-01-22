/**
 * Module Router - Dynamic routing for business modules
 * Requirements: 11.4, 11.5, 11.7
 */

import { Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { moduleLoader, MODULE_REGISTRY } from '@/lib/performance/module-loader';
import { useTenantCompat } from '@/lib/stores/integration-hooks';
import { useAuth } from '@/hooks/useAuth';
import { LazyModule } from '@/components/common/LazyModule';

export interface RouteConfig {
  path: string;
  moduleName: string;
  componentName: string;
  exact?: boolean;
  permissions?: string[];
  businessTier?: string;
}

/**
 * Module route registry - maps routes to modules and components
 */
export const MODULE_ROUTES: RouteConfig[] = [
  // Analytics routes
  { path: '/analytics', moduleName: 'analytics', componentName: 'AnalyticsDashboard', exact: true },
  { path: '/analytics/reports', moduleName: 'analytics', componentName: 'ReportsView' },
  { path: '/analytics/metrics', moduleName: 'analytics', componentName: 'MetricsView' },

  // Auth routes
  { path: '/auth', moduleName: 'auth', componentName: 'AuthDashboard', exact: true },
  { path: '/auth/users', moduleName: 'auth', componentName: 'UserManagement' },
  { path: '/auth/sessions', moduleName: 'auth', componentName: 'SessionManagement' },

  // B2B routes
  { path: '/b2b', moduleName: 'b2b', componentName: 'B2BDashboard', exact: true },
  { path: '/b2b/partners', moduleName: 'b2b', componentName: 'PartnerManagement' },
  { path: '/b2b/integrations', moduleName: 'b2b', componentName: 'IntegrationHub' },

  // Backup routes
  { path: '/backup', moduleName: 'backup', componentName: 'BackupDashboard', exact: true },
  { path: '/backup/schedule', moduleName: 'backup', componentName: 'BackupScheduler' },
  { path: '/backup/restore', moduleName: 'backup', componentName: 'RestoreManager' },

  // Cache routes
  { path: '/cache', moduleName: 'cache', componentName: 'CacheMetricsDisplay', exact: true },

  // Communication routes
  { path: '/communication', moduleName: 'communication', componentName: 'CommunicationDashboard', exact: true },
  { path: '/communication/messages', moduleName: 'communication', componentName: 'MessagingCenter' },
  { path: '/communication/notifications', moduleName: 'communication', componentName: 'NotificationSettings' },

  // CRM routes
  { path: '/crm', moduleName: 'crm', componentName: 'CRMDashboard', exact: true },
  { path: '/crm/customers', moduleName: 'crm', componentName: 'CustomerManagement' },
  { path: '/crm/pipeline', moduleName: 'crm', componentName: 'SalesPipeline' },

  // Disaster Recovery routes
  { path: '/disaster-recovery', moduleName: 'disaster-recovery', componentName: 'DisasterRecoveryDashboard', exact: true },
  { path: '/disaster-recovery/planning', moduleName: 'disaster-recovery', componentName: 'RecoveryPlanning' },
  { path: '/disaster-recovery/failover', moduleName: 'disaster-recovery', componentName: 'FailoverManagement' },

  // Employee routes
  { path: '/employee', moduleName: 'employee', componentName: 'EmployeeDashboard', exact: true },
  { path: '/employee/directory', moduleName: 'employee', componentName: 'EmployeeDirectory' },
  { path: '/employee/time-tracking', moduleName: 'employee', componentName: 'TimeTracking' },

  // Financial routes
  { path: '/financial', moduleName: 'financial', componentName: 'FinancialDashboard', exact: true },
  { path: '/financial/accounting', moduleName: 'financial', componentName: 'AccountingView' },
  { path: '/financial/invoices', moduleName: 'financial', componentName: 'InvoiceManagement' },

  // Health routes
  { path: '/health', moduleName: 'health', componentName: 'HealthDashboard', exact: true },
  { path: '/health/monitoring', moduleName: 'health', componentName: 'SystemMonitoring' },
  { path: '/health/alerts', moduleName: 'health', componentName: 'AlertsManagement' },

  // Integration routes
  { path: '/integration', moduleName: 'integration', componentName: 'IntegrationDashboard', exact: true },
  { path: '/integration/connectors', moduleName: 'integration', componentName: 'ConnectorManagement' },
  { path: '/integration/api', moduleName: 'integration', componentName: 'APIManagement' },

  // Inventory routes
  { path: '/inventory', moduleName: 'inventory', componentName: 'InventoryDashboard', exact: true },
  { path: '/inventory/stock', moduleName: 'inventory', componentName: 'StockManagement' },
  { path: '/inventory/catalog', moduleName: 'inventory', componentName: 'ProductCatalog' },

  // Location routes
  { path: '/location', moduleName: 'location', componentName: 'LocationDashboard', exact: true },
  { path: '/location/sites', moduleName: 'location', componentName: 'SiteManagement' },
  { path: '/location/geography', moduleName: 'location', componentName: 'GeographicView' },

  // Mobile routes
  { path: '/mobile', moduleName: 'mobile', componentName: 'MobileDashboard', exact: true },
  { path: '/mobile/apps', moduleName: 'mobile', componentName: 'AppManagement' },
  { path: '/mobile/devices', moduleName: 'mobile', componentName: 'DeviceManagement' },

  // POS routes
  { path: '/pos', moduleName: 'pos', componentName: 'POSDashboard', exact: true },
  { path: '/pos/terminal', moduleName: 'pos', componentName: 'SalesTerminal' },
  { path: '/pos/transactions', moduleName: 'pos', componentName: 'TransactionHistory' },

  // Queue routes
  { path: '/queue', moduleName: 'queue', componentName: 'QueueDashboard', exact: true },
  { path: '/queue/jobs', moduleName: 'queue', componentName: 'JobManagement' },
  { path: '/queue/workers', moduleName: 'queue', componentName: 'WorkerMonitoring' },

  // Realtime routes
  { path: '/realtime', moduleName: 'realtime', componentName: 'RealtimeDashboard', exact: true },
  { path: '/realtime/data', moduleName: 'realtime', componentName: 'LiveDataView' },
  { path: '/realtime/notifications', moduleName: 'realtime', componentName: 'NotificationCenter' },

  // Security routes
  { path: '/security', moduleName: 'security', componentName: 'SecurityDashboard', exact: true },

  // Supplier routes
  { path: '/supplier', moduleName: 'supplier', componentName: 'SupplierDashboard', exact: true },
  { path: '/supplier/vendors', moduleName: 'supplier', componentName: 'VendorManagement' },
  { path: '/supplier/procurement', moduleName: 'supplier', componentName: 'ProcurementView' },

  // Tenant routes
  { path: '/tenant', moduleName: 'tenant', componentName: 'TenantDashboard', exact: true },
  { path: '/tenant/settings', moduleName: 'tenant', componentName: 'TenantSettings' },
  { path: '/tenant/features', moduleName: 'tenant', componentName: 'FeatureManagement' },

  // Warehouse routes
  { path: '/warehouse', moduleName: 'warehouse', componentName: 'WarehouseDashboard', exact: true },
  { path: '/warehouse/inventory', moduleName: 'warehouse', componentName: 'InventoryView' },
  { path: '/warehouse/shipping', moduleName: 'warehouse', componentName: 'ShippingView' },
];

/**
 * Module Router Component
 */
export interface ModuleRouterProps {
  children?: React.ReactNode;
}

export function ModuleRouter({ children }: ModuleRouterProps) {
  const pathname = usePathname();
  const { businessTier } = useTenantCompat();
  const { permissions } = useAuth();

  // Find matching route
  const matchingRoute = MODULE_ROUTES.find(route => {
    if (route.exact) {
      return pathname === route.path;
    }
    return pathname.startsWith(route.path);
  });

  if (!matchingRoute) {
    return <>{children}</>;
  }

  // Check permissions and business tier
  const moduleConfig = MODULE_REGISTRY[matchingRoute.moduleName];
  if (!moduleConfig) {
    return <div>Module not found</div>;
  }

  // Check business tier requirement
  if (moduleConfig.businessTier && businessTier) {
    const tierOrder = ['MICRO', 'SMALL', 'MEDIUM', 'ENTERPRISE'];
    const currentTierIndex = tierOrder.indexOf(businessTier);
    const requiredTierIndex = tierOrder.indexOf(moduleConfig.businessTier);
    
    if (currentTierIndex < requiredTierIndex) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Feature Not Available
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            This feature requires {moduleConfig.businessTier} tier or higher.
            Your current tier: {businessTier}
          </p>
        </div>
      );
    }
  }

  // Check permissions
  if (moduleConfig.permissions && permissions) {
    const permissionNames = permissions.map(p => p.name);
    const hasPermission = moduleConfig.permissions.some(permission => 
      permissionNames.includes(permission)
    );
    
    if (!hasPermission) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don&apos;t have permission to access this module.
          </p>
        </div>
      );
    }
  }

  return (
    <LazyModule moduleName={matchingRoute.moduleName}>
      <Suspense fallback={
        <div className="p-6 max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      }>
        {children}
      </Suspense>
    </LazyModule>
  );
}

/**
 * Hook for module navigation
 */
export function useModuleNavigation() {
  const router = useRouter();
  const { businessTier } = useTenantCompat();
  const { permissions } = useAuth();

  const navigateToModule = (moduleName: string, subPath?: string) => {
    const moduleConfig = MODULE_REGISTRY[moduleName];
    if (!moduleConfig) {
      console.warn(`Module ${moduleName} not found`);
      return;
    }

    // Check business tier
    if (moduleConfig.businessTier && businessTier) {
      const tierOrder = ['MICRO', 'SMALL', 'MEDIUM', 'ENTERPRISE'];
      const currentTierIndex = tierOrder.indexOf(businessTier);
      const requiredTierIndex = tierOrder.indexOf(moduleConfig.businessTier);
      
      if (currentTierIndex < requiredTierIndex) {
        console.warn(`Module ${moduleName} requires ${moduleConfig.businessTier} tier`);
        return;
      }
    }

    // Check permissions
    if (moduleConfig.permissions && permissions) {
      const permissionNames = permissions.map(p => p.name);
      const hasPermission = moduleConfig.permissions.some(permission => 
        permissionNames.includes(permission)
      );
      
      if (!hasPermission) {
        console.warn(`No permission to access module ${moduleName}`);
        return;
      }
    }

    // Navigate to module
    const basePath = `/${moduleName}`;
    const fullPath = subPath ? `${basePath}/${subPath}` : basePath;
    router.push(fullPath);
  };

  const getAvailableModules = () => {
    const permissionNames = permissions ? permissions.map(p => p.name) : [];
    return moduleLoader.getAvailableModules(permissionNames, businessTier || 'MICRO');
  };

  const getModuleRoutes = (moduleName: string) => {
    return MODULE_ROUTES.filter(route => route.moduleName === moduleName);
  };

  return {
    navigateToModule,
    getAvailableModules,
    getModuleRoutes,
  };
}

/**
 * Module breadcrumb generator
 */
export function useModuleBreadcrumbs() {
  const pathname = usePathname();

  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [];

    // Home
    breadcrumbs.push({ label: 'Home', path: '/' });

    // Build breadcrumbs from path segments
    let currentPath = '';
    for (const segment of segments) {
      currentPath += `/${segment}`;
      
      // Find module config
      const moduleConfig = MODULE_REGISTRY[segment];
      if (moduleConfig) {
        breadcrumbs.push({
          label: moduleConfig.name,
          path: currentPath,
        });
      } else {
        // Capitalize segment for display
        const label = segment.charAt(0).toUpperCase() + segment.slice(1);
        breadcrumbs.push({
          label,
          path: currentPath,
        });
      }
    }

    return breadcrumbs;
  };

  return { getBreadcrumbs };
}