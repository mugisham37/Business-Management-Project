/**
 * Module Navigation Component
 * Dynamic navigation for business modules with permission-based rendering
 * Requirements: 11.4, 11.5
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useModuleNavigation } from '@/lib/routing/module-router';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

export function ModuleNavigation() {
  const pathname = usePathname();
  const { getAvailableModules } = useModuleNavigation();
  const { currentTenant, businessTier } = useTenant();
  const { permissions } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const availableModules = getAvailableModules();

  // Group modules by category
  const moduleCategories = {
    core: availableModules.filter(m => ['auth', 'tenant'].includes(m.name)),
    business: availableModules.filter(m => 
      ['warehouse', 'pos', 'inventory', 'financial', 'supplier', 'employee', 'crm', 'location'].includes(m.name)
    ),
    integration: availableModules.filter(m => 
      ['integration', 'communication', 'b2b', 'mobile'].includes(m.name)
    ),
    analytics: availableModules.filter(m => 
      ['analytics', 'realtime', 'queue'].includes(m.name)
    ),
    system: availableModules.filter(m => 
      ['security', 'health', 'cache', 'backup', 'disaster-recovery'].includes(m.name)
    ),
  };

  const isActiveModule = (moduleName: string) => {
    return pathname.startsWith(`/${moduleName}`);
  };

  const getModuleIcon = (moduleName: string) => {
    const icons: Record<string, string> = {
      // Core modules
      auth: '🔐',
      tenant: '🏢',
      
      // Business modules
      warehouse: '🏭',
      pos: '💳',
      inventory: '📦',
      financial: '💰',
      supplier: '🤝',
      employee: '👥',
      crm: '👤',
      location: '📍',
      
      // Integration modules
      integration: '🔗',
      communication: '💬',
      b2b: '🤝',
      mobile: '📱',
      
      // Analytics modules
      analytics: '📊',
      realtime: '⚡',
      queue: '⏳',
      
      // System modules
      security: '🛡️',
      health: '❤️',
      cache: '⚡',
      backup: '💾',
      'disaster-recovery': '🚨',
    };
    return icons[moduleName] || '📋';
  };

  const renderModuleGroup = (title: string, modules: any[], isOpen: boolean = true) => {
    if (modules.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          {title}
        </h3>
        <nav className="space-y-1">
          {modules.map((module) => (
            <Link
              key={module.name}
              href={`/${module.name}`}
              className={`
                group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                ${isActiveModule(module.name)
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                }
              `}
            >
              <span className="mr-3 text-lg">
                {getModuleIcon(module.name)}
              </span>
              {!isCollapsed && (
                <>
                  <span className="flex-1">{module.displayName || module.name}</span>
                  {module.businessTier && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded dark:bg-gray-600 dark:text-gray-300">
                      {module.businessTier}
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}
        </nav>
      </div>
    );
  };

  return (
    <div className={`
      flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300
      ${isCollapsed ? 'w-16' : 'w-64'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {!isCollapsed && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Modules
            </h2>
            {currentTenant && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {currentTenant.name} ({businessTier})
              </p>
            )}
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        {!isCollapsed ? (
          <>
            {renderModuleGroup('Core', moduleCategories.core)}
            {renderModuleGroup('Business', moduleCategories.business)}
            {renderModuleGroup('Integration', moduleCategories.integration)}
            {renderModuleGroup('Analytics', moduleCategories.analytics)}
            {renderModuleGroup('System', moduleCategories.system)}
          </>
        ) : (
          <nav className="space-y-2">
            {availableModules.map((module) => (
              <Link
                key={module.name}
                href={`/${module.name}`}
                className={`
                  group flex items-center justify-center p-2 text-lg rounded-md transition-colors
                  ${isActiveModule(module.name)
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }
                `}
                title={module.displayName || module.name}
              >
                {getModuleIcon(module.name)}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>{availableModules.length} modules available</p>
            <p>Tier: {businessTier}</p>
          </div>
        </div>
      )}
    </div>
  );
}