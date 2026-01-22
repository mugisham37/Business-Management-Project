/**
 * Module Wrapper Component
 * Provides consistent layout and functionality for all business modules
 * Requirements: 11.2, 11.3
 */

import { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { moduleEventBus, performanceTracker, moduleUtils } from '@/lib/modules/shared-utilities';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

export interface ModuleWrapperProps {
  moduleName: string;
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; path: string }>;
  loading?: boolean;
  error?: string | null;
}

export function ModuleWrapper({
  moduleName,
  title,
  description,
  children,
  actions,
  breadcrumbs,
  loading = false,
  error = null,
}: ModuleWrapperProps) {
  const pathname = usePathname();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [renderStartTime] = useState(performance.now());

  // Generate breadcrumbs if not provided
  const finalBreadcrumbs = breadcrumbs || moduleUtils.generateBreadcrumbs(pathname);

  useEffect(() => {
    // Record module render time
    const renderTime = performance.now() - renderStartTime;
    performanceTracker.recordRenderTime(moduleName, renderTime);

    // Emit module loaded event
    moduleEventBus.emit('module:loaded', {
      moduleName,
      pathname,
      user: user?.id,
      tenant: currentTenant?.id,
      timestamp: new Date().toISOString(),
    });

    // Cleanup on unmount
    return () => {
      moduleEventBus.emit('module:unloaded', {
        moduleName,
        pathname,
        timestamp: new Date().toISOString(),
      });
    };
  }, [moduleName, pathname, renderStartTime, user?.id, currentTenant?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="animate-pulse">
            {/* Header skeleton */}
            <div className="mb-8">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
            
            {/* Content skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Module Error
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumbs */}
      {finalBreadcrumbs.length > 1 && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <nav className="flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2">
                {finalBreadcrumbs.map((crumb, index) => (
                  <li key={crumb.path} className="flex items-center">
                    {index > 0 && (
                      <svg className="flex-shrink-0 h-4 w-4 text-gray-400 mx-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {index === finalBreadcrumbs.length - 1 ? (
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {crumb.label}
                      </span>
                    ) : (
                      <a
                        href={crumb.path}
                        className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                      >
                        {crumb.label}
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </div>
      )}

      {/* Module Header */}
      {(title || description || actions) && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                {title && (
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {description}
                  </p>
                )}
              </div>
              {actions && (
                <div className="flex items-center space-x-3">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Module Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Development Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-3 rounded-lg shadow-lg text-xs max-w-xs">
          <div className="font-semibold mb-1">Module: {moduleName}</div>
          <div>Path: {pathname}</div>
          {currentTenant && (
            <div>Tenant: {currentTenant.name}</div>
          )}
          <div>Render Time: {(performance.now() - renderStartTime).toFixed(2)}ms</div>
        </div>
      )}
    </div>
  );
}

/**
 * Module Section Component
 * Provides consistent section layout within modules
 */
export interface ModuleSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ModuleSection({
  title,
  description,
  children,
  actions,
  className = '',
}: ModuleSectionProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      {(title || description || actions) && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex items-center space-x-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

/**
 * Module Grid Component
 * Provides responsive grid layout for module content
 */
export interface ModuleGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ModuleGrid({
  children,
  columns = 3,
  gap = 'md',
  className = '',
}: ModuleGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const gridGap = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  };

  return (
    <div className={`grid ${gridCols[columns]} ${gridGap[gap]} ${className}`}>
      {children}
    </div>
  );
}