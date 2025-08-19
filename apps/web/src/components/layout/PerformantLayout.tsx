import React, { Suspense, useEffect } from 'react';
import {
  usePerformanceBudget,
  useRenderPerformance,
  useWebVitals,
} from '../../hooks/usePerformance';
import { addResourceHints, optimizeFontLoading } from '../../lib/performance';

interface PerformantLayoutProps {
  children: React.ReactNode;
  title?: string;
}

// Loading fallback component
const LoadingFallback = React.memo(() => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
));

LoadingFallback.displayName = 'LoadingFallback';

// Error boundary for lazy-loaded components
class LazyLoadErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ComponentType }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy load error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback || LoadingFallback;
      return <Fallback />;
    }

    return this.props.children;
  }
}

export const PerformantLayout: React.FC<PerformantLayoutProps> = React.memo(
  ({ children, title = 'Fullstack App' }) => {
    const { measureRender } = useRenderPerformance('PerformantLayout');
    const { trackCustomMetric } = useWebVitals();
    const { checkBudget } = usePerformanceBudget();

    useEffect(() => {
      // Performance optimizations on mount
      addResourceHints();
      optimizeFontLoading();

      // Track layout mount time
      const mountTime = performance.now();
      trackCustomMetric('layout-mount-time', mountTime);

      // Check performance budget
      setTimeout(checkBudget, 1000);
    }, [trackCustomMetric, checkBudget]);

    useEffect(() => {
      measureRender();
    });

    return (
      <>
        <head>
          <title>{title}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content="High-performance fullstack application" />

          {/* Performance hints */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

          {/* Critical CSS will be inlined here */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
            /* Critical CSS for above-the-fold content */
            body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
            .loading-spinner { animation: spin 1s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `,
            }}
          />
        </head>

        <div className="min-h-screen bg-gray-50">
          <LazyLoadErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <main className="container mx-auto px-4 py-8">{children}</main>
            </Suspense>
          </LazyLoadErrorBoundary>
        </div>
      </>
    );
  }
);

PerformantLayout.displayName = 'PerformantLayout';

// HOC for adding performance monitoring to any component
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const PerformantComponent = React.forwardRef<any, P>((props, ref) => {
    const displayName = componentName || Component.displayName || Component.name || 'Component';
    const { measureRender } = useRenderPerformance(displayName);

    useEffect(() => {
      measureRender();
    });

    return <Component {...props} ref={ref} />;
  });

  PerformantComponent.displayName = `withPerformanceMonitoring(${componentName || Component.displayName || Component.name})`;

  return React.memo(PerformantComponent);
}

// Lazy loading wrapper with performance tracking
export function createLazyComponent<P extends object>(
  importFunc: () => Promise<{ default: React.ComponentType<P> }>,
  componentName?: string
) {
  const LazyComponent = React.lazy(async () => {
    const startTime = performance.now();

    try {
      const module = await importFunc();
      const loadTime = performance.now() - startTime;

      // Track lazy loading performance
      if (typeof window !== 'undefined') {
        const { webPerformanceMonitor } = await import('../../lib/monitoring');
        webPerformanceMonitor.trackCustomEvent(
          `lazy-load-${componentName || 'component'}`,
          loadTime,
          'Code Splitting'
        );
      }

      return module;
    } catch (error) {
      const loadTime = performance.now() - startTime;

      // Track lazy loading errors
      if (typeof window !== 'undefined') {
        const { webPerformanceMonitor } = await import('../../lib/monitoring');
        webPerformanceMonitor.trackCustomEvent(
          `lazy-load-error-${componentName || 'component'}`,
          loadTime,
          'Code Splitting'
        );
      }

      throw error;
    }
  });

  LazyComponent.displayName = `Lazy(${componentName || 'Component'})`;

  return LazyComponent;
}
