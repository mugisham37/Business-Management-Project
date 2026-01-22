/**
 * Performance Monitor - Client-side performance monitoring and metrics collection
 * Tracks Core Web Vitals, bundle loading, and user experience metrics
 */

// Type definitions for Performance API extensions
interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
  processingDuration: number;
  duration: number;
}

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte

  // Custom metrics
  moduleLoadTime?: Record<string, number>;
  routeChangeTime?: Record<string, number>;
  graphqlQueryTime?: Record<string, number>;
  bundleSize?: number;
  
  // User experience
  sessionDuration?: number;
  pageViews?: number;
  errorCount?: number;
  
  // Device info
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  connectionType?: string;
  
  timestamp: number;
}

export interface PerformanceThresholds {
  lcp: { good: number; poor: number };
  fid: { good: number; poor: number };
  cls: { good: number; poor: number };
  moduleLoad: { good: number; poor: number };
  routeChange: { good: number; poor: number };
}

/**
 * Default performance thresholds based on Core Web Vitals
 */
export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  lcp: { good: 2500, poor: 4000 }, // milliseconds
  fid: { good: 100, poor: 300 },   // milliseconds
  cls: { good: 0.1, poor: 0.25 },  // score
  moduleLoad: { good: 1000, poor: 3000 }, // milliseconds
  routeChange: { good: 500, poor: 1500 }, // milliseconds
};

/**
 * Performance monitor class
 */
class PerformanceMonitor {
  private metrics: PerformanceMetrics = { timestamp: Date.now() };
  private observers: PerformanceObserver[] = [];
  private thresholds = DEFAULT_THRESHOLDS;
  private isMonitoring = false;

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring || typeof window === 'undefined') {
      return;
    }

    this.isMonitoring = true;
    this.setupCoreWebVitalsObservers();
    this.setupCustomMetrics();
    this.setupNavigationObserver();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Record module load time
   */
  recordModuleLoad(moduleName: string, loadTime: number): void {
    if (!this.metrics.moduleLoadTime) {
      this.metrics.moduleLoadTime = {};
    }
    this.metrics.moduleLoadTime[moduleName] = loadTime;
    
    // Check if load time exceeds thresholds
    if (loadTime > this.thresholds.moduleLoad.poor) {
      console.warn(`Module ${moduleName} load time (${loadTime}ms) exceeds poor threshold`);
    }
  }

  /**
   * Record route change time
   */
  recordRouteChange(route: string, changeTime: number): void {
    if (!this.metrics.routeChangeTime) {
      this.metrics.routeChangeTime = {};
    }
    this.metrics.routeChangeTime[route] = changeTime;
    
    // Check if change time exceeds thresholds
    if (changeTime > this.thresholds.routeChange.poor) {
      console.warn(`Route change to ${route} (${changeTime}ms) exceeds poor threshold`);
    }
  }

  /**
   * Record GraphQL query time
   */
  recordGraphQLQuery(queryName: string, queryTime: number): void {
    if (!this.metrics.graphqlQueryTime) {
      this.metrics.graphqlQueryTime = {};
    }
    this.metrics.graphqlQueryTime[queryName] = queryTime;
  }

  /**
   * Record error occurrence
   */
  recordError(): void {
    this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
  }

  /**
   * Get performance score based on Core Web Vitals
   */
  getPerformanceScore(): {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    details: Record<string, { value: number; score: number; status: 'good' | 'needs-improvement' | 'poor' }>;
  } {
    const details: Record<string, { value: number; score: number; status: 'good' | 'needs-improvement' | 'poor' }> = {};
    let totalScore = 0;
    let metricCount = 0;

    // Evaluate LCP
    if (this.metrics.lcp !== undefined) {
      const lcpScore = this.evaluateMetric(this.metrics.lcp, this.thresholds.lcp);
      details.lcp = { value: this.metrics.lcp, ...lcpScore };
      totalScore += lcpScore.score;
      metricCount++;
    }

    // Evaluate FID
    if (this.metrics.fid !== undefined) {
      const fidScore = this.evaluateMetric(this.metrics.fid, this.thresholds.fid);
      details.fid = { value: this.metrics.fid, ...fidScore };
      totalScore += fidScore.score;
      metricCount++;
    }

    // Evaluate CLS
    if (this.metrics.cls !== undefined) {
      const clsScore = this.evaluateMetric(this.metrics.cls, this.thresholds.cls);
      details.cls = { value: this.metrics.cls, ...clsScore };
      totalScore += clsScore.score;
      metricCount++;
    }

    const averageScore = metricCount > 0 ? totalScore / metricCount : 0;
    const grade = this.getGrade(averageScore);

    return {
      score: Math.round(averageScore),
      grade,
      details,
    };
  }

  /**
   * Export performance report
   */
  exportReport(): string {
    const score = this.getPerformanceScore();
    const metrics = this.getMetrics();

    let report = '# Performance Report\n\n';
    
    report += `## Overall Score: ${score.score}/100 (Grade: ${score.grade})\n\n`;

    // Core Web Vitals
    report += '## Core Web Vitals\n';
    Object.entries(score.details).forEach(([metric, data]) => {
      const status = data.status === 'good' ? '✅' : data.status === 'needs-improvement' ? '⚠️' : '❌';
      report += `- ${metric.toUpperCase()}: ${data.value} ${status}\n`;
    });
    report += '\n';

    // Module Performance
    if (metrics.moduleLoadTime) {
      report += '## Module Load Times\n';
      Object.entries(metrics.moduleLoadTime).forEach(([module, time]) => {
        const status = time <= this.thresholds.moduleLoad.good ? '✅' : 
                      time <= this.thresholds.moduleLoad.poor ? '⚠️' : '❌';
        report += `- ${module}: ${time}ms ${status}\n`;
      });
      report += '\n';
    }

    // Route Performance
    if (metrics.routeChangeTime) {
      report += '## Route Change Times\n';
      Object.entries(metrics.routeChangeTime).forEach(([route, time]) => {
        const status = time <= this.thresholds.routeChange.good ? '✅' : 
                      time <= this.thresholds.routeChange.poor ? '⚠️' : '❌';
        report += `- ${route}: ${time}ms ${status}\n`;
      });
      report += '\n';
    }

    return report;
  }

  /**
   * Setup Core Web Vitals observers
   */
  private setupCoreWebVitalsObservers(): void {
    // LCP Observer
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry;
          if (lastEntry && 'startTime' in lastEntry) {
            this.metrics.lcp = lastEntry.startTime;
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch {
        console.warn('LCP observer not supported');
      }

      // FID Observer
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if ('processingStart' in entry && 'startTime' in entry) {
              const perfEntry = entry as PerformanceEventTiming;
              this.metrics.fid = perfEntry.processingStart - perfEntry.startTime;
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch {
        console.warn('FID observer not supported');
      }

      // CLS Observer
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if ('hadRecentInput' in entry && 'value' in entry) {
              const layoutShift = entry as LayoutShift;
              if (!layoutShift.hadRecentInput) {
                clsValue += layoutShift.value;
                this.metrics.cls = clsValue;
              }
            }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch {
        console.warn('CLS observer not supported');
      }
    }
  }

  /**
   * Setup custom metrics collection
   */
  private setupCustomMetrics(): void {
    // Device type detection
    this.metrics.deviceType = this.getDeviceType();
    
    // Connection type
    if ('connection' in navigator) {
      const connection = (navigator as Navigator & { connection?: { effectiveType: string } }).connection;
      if (connection) {
        this.metrics.connectionType = connection.effectiveType;
      }
    }

    // Bundle size (approximate)
    if ('performance' in window && 'getEntriesByType' in performance) {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const jsResources = resources.filter(resource => 
        resource.name.includes('.js') && resource.name.includes('/_next/')
      );
      this.metrics.bundleSize = jsResources.reduce((total, resource) => 
        total + (resource.transferSize || 0), 0
      );
    }
  }

  /**
   * Setup navigation observer
   */
  private setupNavigationObserver(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const navEntry = navEntries[0];
      if (navEntry) {
        this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
        this.metrics.fcp = navEntry.loadEventEnd - navEntry.fetchStart;
      }
    }
  }

  /**
   * Evaluate metric against thresholds
   */
  private evaluateMetric(
    value: number, 
    threshold: { good: number; poor: number }
  ): { score: number; status: 'good' | 'needs-improvement' | 'poor' } {
    if (value <= threshold.good) {
      return { score: 100, status: 'good' };
    } else if (value <= threshold.poor) {
      return { score: 50, status: 'needs-improvement' };
    } else {
      return { score: 0, status: 'poor' };
    }
  }

  /**
   * Get letter grade from score
   */
  private getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Detect device type
   */
  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const userAgent = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Hook for performance monitoring in React components
 */
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const startMonitoring = useCallback(() => {
    performanceMonitor.startMonitoring();
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    performanceMonitor.stopMonitoring();
    setIsMonitoring(false);
  }, []);

  const getMetrics = useCallback(() => {
    const currentMetrics = performanceMonitor.getMetrics();
    setMetrics(currentMetrics);
    return currentMetrics;
  }, []);

  const getScore = useCallback(() => {
    return performanceMonitor.getPerformanceScore();
  }, []);

  return {
    metrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    getMetrics,
    getScore,
    recordModuleLoad: performanceMonitor.recordModuleLoad.bind(performanceMonitor),
    recordRouteChange: performanceMonitor.recordRouteChange.bind(performanceMonitor),
    recordGraphQLQuery: performanceMonitor.recordGraphQLQuery.bind(performanceMonitor),
    recordError: performanceMonitor.recordError.bind(performanceMonitor),
  };
}

// Add missing imports
import { useState, useCallback } from 'react';