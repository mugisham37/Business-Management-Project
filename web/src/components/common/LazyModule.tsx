/**
 * LazyModule - Component for lazy loading business modules
 * Provides loading states, error boundaries, and fallback UI
 */

'use client';

import { Suspense, ComponentType, ReactNode, useState, useCallback } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { moduleLoader, ModuleConfig, LoadedModule } from '@/lib/performance/module-loader';
import { LoadingSpinner } from './LoadingSpinner';
import { ModuleErrorFallback } from './ModuleErrorFallback';

interface LazyModuleProps {
  moduleName: string;
  fallback?: ReactNode;
  errorFallback?: ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error) => void;
  children?: ReactNode;
}

/**
 * Lazy module wrapper with error boundaries and loading states
 */
export function LazyModule({
  moduleName,
  fallback,
  errorFallback: CustomErrorFallback,
  onError,
  children,
}: LazyModuleProps) {
  const handleError = (error: Error, errorInfo: { componentStack: string }) => {
    console.error(`Module ${moduleName} error:`, error, errorInfo);
    onError?.(error);
  };

  const ErrorFallback = CustomErrorFallback || ModuleErrorFallback;

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      resetKeys={[moduleName]}
    >
      <Suspense fallback={fallback || <ModuleLoadingFallback moduleName={moduleName} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Default loading fallback for modules
 */
function ModuleLoadingFallback({ moduleName }: { moduleName: string }) {
  const config = moduleLoader.MODULE_REGISTRY[moduleName];
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8">
      <LoadingSpinner size="lg" />
      <div className="mt-4 text-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Loading {config?.name || moduleName}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Please wait while we load the module...
        </p>
      </div>
    </div>
  );
}

/**
 * Hook for lazy loading modules with state management
 */
export function useLazyModule(moduleName: string) {
  const [module, setModule] = useState<LoadedModule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadModule = useCallback(async () => {
    if (module || loading) return;

    setLoading(true);
    setError(null);

    try {
      const loadedModule = await moduleLoader.loadModule(moduleName);
      setModule(loadedModule);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [moduleName, module, loading]);

  const preloadModule = useCallback(async () => {
    try {
      await moduleLoader.preloadModule(moduleName);
    } catch (err) {
      console.warn(`Failed to preload module ${moduleName}:`, err);
    }
  }, [moduleName]);

  return {
    module,
    loading,
    error,
    loadModule,
    preloadModule,
  };
}

// Re-export for convenience
export { moduleLoader } from '@/lib/performance/module-loader';
export type { ModuleConfig, LoadedModule } from '@/lib/performance/module-loader';