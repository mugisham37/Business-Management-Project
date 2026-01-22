/**
 * Module Registry - Central registry for all business modules
 * Requirements: 11.1, 11.2, 11.7
 */

import { dependencyResolver } from './shared-utilities';
import { MODULE_REGISTRY } from '@/lib/performance/module-loader';

/**
 * Enhanced module configuration with dependencies
 */
export interface EnhancedModuleConfig {
  name: string;
  displayName: string;
  description: string;
  version: string;
  path: string;
  lazy: boolean;
  permissions?: string[];
  businessTier?: string;
  dependencies?: string[];
  features?: string[];
  routes?: string[];
  preload?: boolean;
}

/**
 * Complete module registry with all business modules
 */
export const ENHANCED_MODULE_REGISTRY: Record<string, EnhancedModuleConfig> = {
  // Core modules
  auth: {
    name: 'auth',
    displayName: 'Authentication Management',
    description: 'User authentication, authorization, and session management',
    version: '1.0.0',
    path: '@/modules/auth',
    lazy: false,
    permissions: ['auth:read', 'auth:write', 'auth:admin'],
    businessTier: 'MICRO',
    dependencies: [],
    features: ['User authentication', 'Multi-factor authentication', 'Session management'],
    routes: ['/auth', '/auth/users', '/auth/sessions'],
    preload: true,
  },

  tenant: {
    name: 'tenant',
    displayName: 'Tenant Management',
    description: 'Multi-tenant configuration and management',
    version: '1.0.0',
    path: '@/modules/tenant',
    lazy: false,
    permissions: ['tenant:read', 'tenant:write', 'tenant:admin'],
    businessTier: 'MICRO',
    dependencies: ['auth'],
    features: ['Tenant configuration', 'Feature flags', 'Business tier management'],
    routes: ['/tenant', '/tenant/settings', '/tenant/features'],
    preload: true,
  },

  // Business modules
  warehouse: {
    name: 'warehouse',
    displayName: 'Warehouse Management',
    description: 'Comprehensive warehouse and inventory management',
    version: '1.0.0',
    path: '@/modules/warehouse',
    lazy: true,
    permissions: ['warehouse:read', 'warehouse:write'],
    businessTier: 'SMALL',
    dependencies: ['tenant', 'auth', 'inventory'],
    features: ['Inventory tracking', 'Shipping management', 'Warehouse operations'],
    routes: ['/warehouse', '/warehouse/inventory', '/warehouse/shipping'],
  },

  pos: {
    name: 'pos',
    displayName: 'Point of Sale',
    description: 'Point of sale and transaction management',
    version: '1.0.0',
    path: '@/modules/pos',
    lazy: true,
    permissions: ['pos:read', 'pos:write'],
    businessTier: 'MICRO',
    dependencies: ['tenant', 'auth', 'inventory', 'financial'],
    features: ['Sales terminal', 'Transaction processing', 'Payment integration'],
    routes: ['/pos', '/pos/terminal', '/pos/transactions'],
  },

  inventory: {
    name: 'inventory',
    displayName: 'Inventory Management',
    description: 'Product inventory and stock management',
    version: '1.0.0',
    path: '@/modules/inventory',
    lazy: true,
    permissions: ['inventory:read', 'inventory:write'],
    businessTier: 'MICRO',
    dependencies: ['tenant', 'auth'],
    features: ['Stock management', 'Product catalog', 'Inventory tracking'],
    routes: ['/inventory', '/inventory/stock', '/inventory/catalog'],
  },

  financial: {
    name: 'financial',
    displayName: 'Financial Management',
    description: 'Financial management and accounting operations',
    version: '1.0.0',
    path: '@/modules/financial',
    lazy: true,
    permissions: ['financial:read', 'financial:write', 'financial:admin'],
    businessTier: 'SMALL',
    dependencies: ['tenant', 'auth'],
    features: ['Accounting', 'Invoice management', 'Financial reporting'],
    routes: ['/financial', '/financial/accounting', '/financial/invoices'],
  },

  supplier: {
    name: 'supplier',
    displayName: 'Supplier Management',
    description: 'Supplier and vendor relationship management',
    version: '1.0.0',
    path: '@/modules/supplier',
    lazy: true,
    permissions: ['supplier:read', 'supplier:write'],
    businessTier: 'SMALL',
    dependencies: ['tenant', 'auth'],
    features: ['Vendor management', 'Procurement', 'Supplier relationships'],
    routes: ['/supplier', '/supplier/vendors', '/supplier/procurement'],
  },

  employee: {
    name: 'employee',
    displayName: 'Employee Management',
    description: 'Human resources and employee management',
    version: '1.0.0',
    path: '@/modules/employee',
    lazy: true,
    permissions: ['employee:read', 'employee:write', 'employee:admin'],
    businessTier: 'SMALL',
    dependencies: ['tenant', 'auth'],
    features: ['Employee directory', 'Time tracking', 'HR management'],
    routes: ['/employee', '/employee/directory', '/employee/time-tracking'],
  },

  crm: {
    name: 'crm',
    displayName: 'Customer Relationship Management',
    description: 'Customer relationship and sales management',
    version: '1.0.0',
    path: '@/modules/crm',
    lazy: true,
    permissions: ['crm:read', 'crm:write'],
    businessTier: 'MEDIUM',
    dependencies: ['tenant', 'auth', 'communication'],
    features: ['Customer management', 'Sales pipeline', 'Lead tracking'],
    routes: ['/crm', '/crm/customers', '/crm/pipeline'],
  },

  location: {
    name: 'location',
    displayName: 'Location Management',
    description: 'Geographic locations and site management',
    version: '1.0.0',
    path: '@/modules/location',
    lazy: true,
    permissions: ['location:read', 'location:write'],
    businessTier: 'SMALL',
    dependencies: ['tenant', 'auth'],
    features: ['Site management', 'Geographic tracking', 'Location services'],
    routes: ['/location', '/location/sites', '/location/geography'],
  },

  // Integration modules
  integration: {
    name: 'integration',
    displayName: 'Integration Management',
    description: 'Third-party integrations and API management',
    version: '1.0.0',
    path: '@/modules/integration',
    lazy: true,
    permissions: ['integration:read', 'integration:write', 'integration:admin'],
    businessTier: 'MEDIUM',
    dependencies: ['tenant', 'auth'],
    features: ['API management', 'Third-party connectors', 'Integration monitoring'],
    routes: ['/integration', '/integration/connectors', '/integration/api'],
  },

  communication: {
    name: 'communication',
    displayName: 'Communication Center',
    description: 'Internal and external communication management',
    version: '1.0.0',
    path: '@/modules/communication',
    lazy: true,
    permissions: ['communication:read', 'communication:write'],
    businessTier: 'SMALL',
    dependencies: ['tenant', 'auth'],
    features: ['Messaging', 'Notifications', 'Communication channels'],
    routes: ['/communication', '/communication/messages', '/communication/notifications'],
  },

  b2b: {
    name: 'b2b',
    displayName: 'B2B Integration',
    description: 'Business-to-business operations and partner management',
    version: '1.0.0',
    path: '@/modules/b2b',
    lazy: true,
    permissions: ['b2b:read', 'b2b:write', 'b2b:admin'],
    businessTier: 'ENTERPRISE',
    dependencies: ['tenant', 'auth', 'integration'],
    features: ['Partner management', 'B2B integrations', 'Revenue sharing'],
    routes: ['/b2b', '/b2b/partners', '/b2b/integrations'],
  },

  mobile: {
    name: 'mobile',
    displayName: 'Mobile Management',
    description: 'Mobile application and device management',
    version: '1.0.0',
    path: '@/modules/mobile',
    lazy: true,
    permissions: ['mobile:read', 'mobile:write', 'mobile:admin'],
    businessTier: 'MEDIUM',
    dependencies: ['tenant', 'auth'],
    features: ['Mobile apps', 'Device management', 'Mobile analytics'],
    routes: ['/mobile', '/mobile/apps', '/mobile/devices'],
  },

  // Analytics modules
  analytics: {
    name: 'analytics',
    displayName: 'Analytics & Reporting',
    description: 'Business intelligence and analytics platform',
    version: '1.0.0',
    path: '@/modules/analytics',
    lazy: true,
    permissions: ['analytics:read', 'analytics:write', 'analytics:admin'],
    businessTier: 'MEDIUM',
    dependencies: ['tenant', 'auth'],
    features: ['Business intelligence', 'Custom reports', 'Data visualization'],
    routes: ['/analytics', '/analytics/reports', '/analytics/metrics'],
  },

  realtime: {
    name: 'realtime',
    displayName: 'Real-time Dashboard',
    description: 'Real-time data monitoring and notifications',
    version: '1.0.0',
    path: '@/modules/realtime',
    lazy: true,
    permissions: ['realtime:read', 'realtime:write'],
    businessTier: 'MEDIUM',
    dependencies: ['tenant', 'auth'],
    features: ['Real-time monitoring', 'Live notifications', 'Event streaming'],
    routes: ['/realtime', '/realtime/data', '/realtime/notifications'],
  },

  queue: {
    name: 'queue',
    displayName: 'Queue Management',
    description: 'Background job and queue management',
    version: '1.0.0',
    path: '@/modules/queue',
    lazy: true,
    permissions: ['queue:read', 'queue:write', 'queue:admin'],
    businessTier: 'MEDIUM',
    dependencies: ['tenant', 'auth'],
    features: ['Job management', 'Queue monitoring', 'Worker management'],
    routes: ['/queue', '/queue/jobs', '/queue/workers'],
  },

  // System modules
  security: {
    name: 'security',
    displayName: 'Security Management',
    description: 'Enterprise security management and monitoring',
    version: '1.0.0',
    path: '@/modules/security',
    lazy: true,
    permissions: ['security:read', 'security:admin'],
    businessTier: 'ENTERPRISE',
    dependencies: ['tenant', 'auth'],
    features: ['Security monitoring', 'Compliance management', 'Audit logging'],
    routes: ['/security'],
  },

  health: {
    name: 'health',
    displayName: 'Health Monitoring',
    description: 'System health and performance monitoring',
    version: '1.0.0',
    path: '@/modules/health',
    lazy: true,
    permissions: ['health:read', 'health:admin'],
    businessTier: 'ENTERPRISE',
    dependencies: ['tenant', 'auth'],
    features: ['System monitoring', 'Performance tracking', 'Health alerts'],
    routes: ['/health', '/health/monitoring', '/health/alerts'],
  },

  cache: {
    name: 'cache',
    displayName: 'Cache Management',
    description: 'Advanced caching system management',
    version: '1.0.0',
    path: '@/modules/cache',
    lazy: true,
    permissions: ['cache:read', 'cache:write', 'cache:admin'],
    businessTier: 'MEDIUM',
    dependencies: ['tenant', 'auth'],
    features: ['Cache monitoring', 'Performance optimization', 'Cache strategies'],
    routes: ['/cache'],
  },

  backup: {
    name: 'backup',
    displayName: 'Backup & Recovery',
    description: 'Automated data backup and disaster recovery management',
    version: '1.0.0',
    path: '@/modules/backup',
    lazy: true,
    permissions: ['backup:read', 'backup:write', 'backup:admin'],
    businessTier: 'ENTERPRISE',
    dependencies: ['tenant', 'auth', 'security'],
    features: ['Automated backups', 'Disaster recovery', 'Data protection'],
    routes: ['/backup', '/backup/schedule', '/backup/restore'],
  },

  'disaster-recovery': {
    name: 'disaster-recovery',
    displayName: 'Disaster Recovery',
    description: 'Business continuity and disaster recovery management',
    version: '1.0.0',
    path: '@/modules/disaster-recovery',
    lazy: true,
    permissions: ['disaster-recovery:read', 'disaster-recovery:admin'],
    businessTier: 'ENTERPRISE',
    dependencies: ['tenant', 'auth', 'backup'],
    features: ['Business continuity', 'Failover management', 'Recovery planning'],
    routes: ['/disaster-recovery', '/disaster-recovery/planning', '/disaster-recovery/failover'],
  },
};

/**
 * Initialize module dependencies
 */
export function initializeModuleDependencies() {
  Object.entries(ENHANCED_MODULE_REGISTRY).forEach(([moduleName, config]) => {
    dependencyResolver.registerDependencies(moduleName, config.dependencies || []);
  });
}

/**
 * Get module configuration
 */
export function getModuleConfig(moduleName: string): EnhancedModuleConfig | undefined {
  return ENHANCED_MODULE_REGISTRY[moduleName];
}

/**
 * Get all modules for a business tier
 */
export function getModulesForTier(businessTier: string): EnhancedModuleConfig[] {
  const tierOrder = ['MICRO', 'SMALL', 'MEDIUM', 'ENTERPRISE'];
  const currentTierIndex = tierOrder.indexOf(businessTier);

  return Object.values(ENHANCED_MODULE_REGISTRY).filter(config => {
    if (!config.businessTier) return true;
    const requiredTierIndex = tierOrder.indexOf(config.businessTier);
    return currentTierIndex >= requiredTierIndex;
  });
}

/**
 * Get modules by category
 */
export function getModulesByCategory() {
  const modules = Object.values(ENHANCED_MODULE_REGISTRY);
  
  return {
    core: modules.filter(m => ['auth', 'tenant'].includes(m.name)),
    business: modules.filter(m => 
      ['warehouse', 'pos', 'inventory', 'financial', 'supplier', 'employee', 'crm', 'location'].includes(m.name)
    ),
    integration: modules.filter(m => 
      ['integration', 'communication', 'b2b', 'mobile'].includes(m.name)
    ),
    analytics: modules.filter(m => 
      ['analytics', 'realtime', 'queue'].includes(m.name)
    ),
    system: modules.filter(m => 
      ['security', 'health', 'cache', 'backup', 'disaster-recovery'].includes(m.name)
    ),
  };
}

/**
 * Validate module dependencies
 */
export function validateModuleDependencies(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  Object.entries(ENHANCED_MODULE_REGISTRY).forEach(([moduleName, config]) => {
    if (config.dependencies) {
      config.dependencies.forEach(dep => {
        if (!ENHANCED_MODULE_REGISTRY[dep]) {
          errors.push(`Module ${moduleName} depends on ${dep} which does not exist`);
        }
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Initialize dependencies on module load
initializeModuleDependencies();