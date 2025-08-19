// Web application monitoring utilities
import { getCLS, getFCP, getFID, getLCP, getTTFB } from 'web-vitals';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

interface PerformanceData {
  metrics: PerformanceMetric[];
  navigation: PerformanceNavigationTiming | null;
  resources: PerformanceResourceTiming[];
  userAgent: string;
  url: string;
  timestamp: number;
}

class WebPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private isInitialized = false;

  public initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    // Collect Core Web Vitals
    getCLS(this.handleMetric.bind(this));
    getFID(this.handleMetric.bind(this));
    getFCP(this.handleMetric.bind(this));
    getLCP(this.handleMetric.bind(this));
    getTTFB(this.handleMetric.bind(this));

    // Set up performance observer for additional metrics
    this.setupPerformanceObserver();

    // Track page load performance
    this.trackPageLoad();

    // Track resource loading
    this.trackResources();

    this.isInitialized = true;
    console.log('Web performance monitoring initialized');
  }

  private handleMetric(metric: any): void {
    const performanceMetric: PerformanceMetric = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      timestamp: Date.now(),
    };

    this.metrics.push(performanceMetric);

    // Send metric to analytics endpoint
    this.sendMetric(performanceMetric);
  }

  private setupPerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) {
      return;
    }

    // Observe long tasks
    try {
      const longTaskObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            // Tasks longer than 50ms
            this.handleMetric({
              name: 'long-task',
              value: entry.duration,
              rating: entry.duration > 100 ? 'poor' : 'needs-improvement',
            });
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      console.warn('Long task observer not supported');
    }

    // Observe layout shifts
    try {
      const layoutShiftObserver = new PerformanceObserver(list => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        if (clsValue > 0) {
          this.handleMetric({
            name: 'layout-shift',
            value: clsValue,
            rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor',
          });
        }
      });
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('Layout shift observer not supported');
    }
  }

  private trackPageLoad(): void {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;

        if (navigation) {
          // DNS lookup time
          const dnsTime = navigation.domainLookupEnd - navigation.domainLookupStart;
          this.handleMetric({
            name: 'dns-lookup',
            value: dnsTime,
            rating: dnsTime < 100 ? 'good' : dnsTime < 300 ? 'needs-improvement' : 'poor',
          });

          // Connection time
          const connectionTime = navigation.connectEnd - navigation.connectStart;
          this.handleMetric({
            name: 'connection',
            value: connectionTime,
            rating:
              connectionTime < 100 ? 'good' : connectionTime < 300 ? 'needs-improvement' : 'poor',
          });

          // Server response time
          const responseTime = navigation.responseEnd - navigation.requestStart;
          this.handleMetric({
            name: 'server-response',
            value: responseTime,
            rating: responseTime < 200 ? 'good' : responseTime < 500 ? 'needs-improvement' : 'poor',
          });

          // DOM processing time
          const domProcessingTime = navigation.domComplete - navigation.domLoading;
          this.handleMetric({
            name: 'dom-processing',
            value: domProcessingTime,
            rating:
              domProcessingTime < 1000
                ? 'good'
                : domProcessingTime < 2000
                  ? 'needs-improvement'
                  : 'poor',
          });
        }
      }, 0);
    });
  }

  private trackResources(): void {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

        // Track slow resources
        resources.forEach(resource => {
          const loadTime = resource.responseEnd - resource.startTime;
          if (loadTime > 1000) {
            // Resources taking more than 1 second
            this.handleMetric({
              name: 'slow-resource',
              value: loadTime,
              rating: 'poor',
            });
          }
        });

        // Calculate total resource size
        const totalSize = resources.reduce((total, resource) => {
          return total + (resource.transferSize || 0);
        }, 0);

        this.handleMetric({
          name: 'total-resource-size',
          value: totalSize,
          rating: totalSize < 500000 ? 'good' : totalSize < 1000000 ? 'needs-improvement' : 'poor',
        });
      }, 1000);
    });
  }

  private sendMetric(metric: PerformanceMetric): void {
    // In a real implementation, you would send this to your analytics endpoint
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance metric:', metric);
    }

    // Example: Send to analytics service
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        event_category: 'Web Vitals',
        value: Math.round(metric.value),
        metric_rating: metric.rating,
      });
    }
  }

  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  public getPerformanceData(): PerformanceData {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    return {
      metrics: this.getMetrics(),
      navigation,
      resources,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now(),
    };
  }

  public trackCustomEvent(name: string, value: number, category: string = 'Custom'): void {
    const metric: PerformanceMetric = {
      name,
      value,
      rating: 'good', // Custom events don't have automatic ratings
      timestamp: Date.now(),
    };

    this.metrics.push(metric);
    this.sendMetric(metric);
  }
}

// Create singleton instance
export const webPerformanceMonitor = new WebPerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitoring() {
  const [isInitialized, setIsInitialized] = React.useState(false);

  React.useEffect(() => {
    if (!isInitialized) {
      webPerformanceMonitor.initialize();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  return {
    trackCustomEvent: webPerformanceMonitor.trackCustomEvent.bind(webPerformanceMonitor),
    getMetrics: webPerformanceMonitor.getMetrics.bind(webPerformanceMonitor),
    getPerformanceData: webPerformanceMonitor.getPerformanceData.bind(webPerformanceMonitor),
  };
}

// Utility function to measure component render time
export function measureRenderTime<T extends React.ComponentType<any>>(
  Component: T,
  displayName?: string
): T {
  const MeasuredComponent = React.forwardRef<any, React.ComponentProps<T>>((props, ref) => {
    const renderStart = React.useRef<number>(0);

    React.useLayoutEffect(() => {
      renderStart.current = performance.now();
    });

    React.useEffect(() => {
      const renderTime = performance.now() - renderStart.current;
      webPerformanceMonitor.trackCustomEvent(
        `component-render-${displayName || Component.displayName || Component.name}`,
        renderTime,
        'Component Performance'
      );
    });

    return React.createElement(Component, { ...props, ref });
  });

  MeasuredComponent.displayName = `Measured(${displayName || Component.displayName || Component.name})`;

  return MeasuredComponent as T;
}
