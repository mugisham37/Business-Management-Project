import { useCallback, useEffect, useRef } from 'react';
import { webPerformanceMonitor } from '../lib/monitoring';

// Hook for measuring component render performance
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const mountTime = useRef<number>(0);

  useEffect(() => {
    mountTime.current = performance.now();

    return () => {
      const unmountTime = performance.now();
      const totalLifetime = unmountTime - mountTime.current;

      webPerformanceMonitor.trackCustomEvent(
        `component-lifetime-${componentName}`,
        totalLifetime,
        'Component Lifecycle'
      );
    };
  }, [componentName]);

  const measureRender = useCallback(() => {
    renderStartTime.current = performance.now();

    // Use requestAnimationFrame to measure after render
    requestAnimationFrame(() => {
      const renderTime = performance.now() - renderStartTime.current;
      webPerformanceMonitor.trackCustomEvent(
        `component-render-${componentName}`,
        renderTime,
        'Component Performance'
      );
    });
  }, [componentName]);

  useEffect(() => {
    measureRender();
  });

  return { measureRender };
}

// Hook for measuring API call performance
export function useApiPerformance() {
  const measureApiCall = useCallback(
    async <T>(apiCall: () => Promise<T>, operationName: string): Promise<T> => {
      const startTime = performance.now();

      try {
        const result = await apiCall();
        const duration = performance.now() - startTime;

        webPerformanceMonitor.trackCustomEvent(
          `api-call-${operationName}`,
          duration,
          'API Performance'
        );

        return result;
      } catch (error) {
        const duration = performance.now() - startTime;

        webPerformanceMonitor.trackCustomEvent(
          `api-call-error-${operationName}`,
          duration,
          'API Performance'
        );

        throw error;
      }
    },
    []
  );

  return { measureApiCall };
}

// Hook for measuring user interactions
export function useInteractionPerformance() {
  const measureInteraction = useCallback(
    (interactionName: string, callback: () => void | Promise<void>) => {
      return async () => {
        const startTime = performance.now();

        try {
          await callback();
          const duration = performance.now() - startTime;

          webPerformanceMonitor.trackCustomEvent(
            `interaction-${interactionName}`,
            duration,
            'User Interaction'
          );
        } catch (error) {
          const duration = performance.now() - startTime;

          webPerformanceMonitor.trackCustomEvent(
            `interaction-error-${interactionName}`,
            duration,
            'User Interaction'
          );

          throw error;
        }
      };
    },
    []
  );

  return { measureInteraction };
}

// Hook for lazy loading with intersection observer
export function useLazyLoading(threshold: number = 0.1) {
  const elementRef = useRef<HTMLElement>(null);
  const isVisible = useRef(false);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    observer.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible.current) {
          isVisible.current = true;

          // Track lazy loading performance
          webPerformanceMonitor.trackCustomEvent(
            'lazy-load-trigger',
            performance.now(),
            'Lazy Loading'
          );
        }
      },
      { threshold }
    );

    observer.current.observe(elementRef.current);

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [threshold]);

  return { elementRef, isVisible: isVisible.current };
}

// Hook for performance budget monitoring
export function usePerformanceBudget() {
  const checkBudget = useCallback(() => {
    const budget = {
      javascript: 500, // KB
      css: 100, // KB
      images: 1000, // KB
      fonts: 200, // KB
      total: 2000, // KB
    };

    // Import the function dynamically to avoid SSR issues
    import('../lib/performance').then(({ checkPerformanceBudget }) => {
      const result = checkPerformanceBudget(budget);

      if (result?.violations.length > 0) {
        webPerformanceMonitor.trackCustomEvent(
          'performance-budget-violation',
          result.violations.length,
          'Performance Budget'
        );
      }
    });
  }, []);

  useEffect(() => {
    // Check budget after page load
    if (typeof window !== 'undefined') {
      window.addEventListener('load', checkBudget);
      return () => window.removeEventListener('load', checkBudget);
    }
  }, [checkBudget]);

  return { checkBudget };
}

// Hook for Core Web Vitals monitoring
export function useWebVitals() {
  useEffect(() => {
    // Initialize web vitals monitoring
    webPerformanceMonitor.initialize();
  }, []);

  const trackCustomMetric = useCallback((name: string, value: number) => {
    webPerformanceMonitor.trackCustomEvent(name, value, 'Custom Metrics');
  }, []);

  return { trackCustomMetric };
}
