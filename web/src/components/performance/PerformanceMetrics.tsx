/**
 * Performance Metrics Component
 * Collects and displays Core Web Vitals and custom performance metrics
 */

'use client';

import { useEffect, useState } from 'react';
import { usePerformanceMonitoring } from '@/lib/performance';

interface MetricDisplayProps {
  label: string;
  value: number | string;
  unit?: string;
  status?: 'good' | 'needs-improvement' | 'poor';
  threshold?: { good: number; poor: number };
}

function MetricDisplay({ label, value, unit = '', status, threshold }: MetricDisplayProps) {
  const getStatusColor = () => {
    if (!status && !threshold) return 'text-gray-600';
    
    if (status) {
      switch (status) {
        case 'good': return 'text-green-600';
        case 'needs-improvement': return 'text-yellow-600';
        case 'poor': return 'text-red-600';
        default: return 'text-gray-600';
      }
    }

    if (threshold && typeof value === 'number') {
      if (value <= threshold.good) return 'text-green-600';
      if (value <= threshold.poor) return 'text-yellow-600';
      return 'text-red-600';
    }

    return 'text-gray-600';
  };

  const getStatusIcon = () => {
    if (!status && !threshold) return null;
    
    let currentStatus = status;
    if (!currentStatus && threshold && typeof value === 'number') {
      if (value <= threshold.good) currentStatus = 'good';
      else if (value <= threshold.poor) currentStatus = 'needs-improvement';
      else currentStatus = 'poor';
    }

    switch (currentStatus) {
      case 'good': return '✅';
      case 'needs-improvement': return '⚠️';
      case 'poor': return '❌';
      default: return null;
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <div className="flex items-center space-x-2">
        <span className={`text-sm font-semibold ${getStatusColor()}`}>
          {typeof value === 'number' ? Math.round(value) : value}{unit}
        </span>
        {getStatusIcon() && (
          <span className="text-sm">{getStatusIcon()}</span>
        )}
      </div>
    </div>
  );
}

export function PerformanceMetrics() {
  const {
    metrics,
    isMonitoring,
    startMonitoring,
    getScore,
  } = usePerformanceMonitoring();

  const [performanceScore, setPerformanceScore] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development or when explicitly enabled
    const shouldShow = process.env.NODE_ENV === 'development' || 
                      localStorage.getItem('show-performance-metrics') === 'true';
    setIsVisible(shouldShow);

    if (shouldShow && !isMonitoring) {
      startMonitoring();
    }
  }, [isMonitoring, startMonitoring]);

  useEffect(() => {
    if (metrics) {
      const score = getScore();
      setPerformanceScore(score);
    }
  }, [metrics, getScore]);

  // Keyboard shortcut to toggle visibility
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        setIsVisible(prev => {
          const newValue = !prev;
          localStorage.setItem('show-performance-metrics', newValue.toString());
          if (newValue && !isMonitoring) {
            startMonitoring();
          }
          return newValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isMonitoring, startMonitoring]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Performance Metrics
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {/* Overall Score */}
          {performanceScore && (
            <MetricDisplay
              label="Performance Score"
              value={`${performanceScore.score} (${performanceScore.grade})`}
              status={
                performanceScore.grade === 'A' ? 'good' :
                performanceScore.grade === 'B' ? 'good' :
                performanceScore.grade === 'C' ? 'needs-improvement' :
                'poor'
              }
            />
          )}

          {/* Core Web Vitals */}
          {metrics?.lcp && (
            <MetricDisplay
              label="LCP"
              value={metrics.lcp}
              unit="ms"
              threshold={{ good: 2500, poor: 4000 }}
            />
          )}

          {metrics?.fid && (
            <MetricDisplay
              label="FID"
              value={metrics.fid}
              unit="ms"
              threshold={{ good: 100, poor: 300 }}
            />
          )}

          {metrics?.cls && (
            <MetricDisplay
              label="CLS"
              value={metrics.cls}
              threshold={{ good: 0.1, poor: 0.25 }}
            />
          )}

          {metrics?.fcp && (
            <MetricDisplay
              label="FCP"
              value={metrics.fcp}
              unit="ms"
              threshold={{ good: 1800, poor: 3000 }}
            />
          )}

          {metrics?.ttfb && (
            <MetricDisplay
              label="TTFB"
              value={metrics.ttfb}
              unit="ms"
              threshold={{ good: 800, poor: 1800 }}
            />
          )}

          {/* Bundle Size */}
          {metrics?.bundleSize && (
            <MetricDisplay
              label="Bundle Size"
              value={(metrics.bundleSize / 1024 / 1024).toFixed(1)}
              unit="MB"
              threshold={{ good: 1, poor: 3 }}
            />
          )}

          {/* Device Info */}
          {metrics?.deviceType && (
            <MetricDisplay
              label="Device"
              value={metrics.deviceType}
            />
          )}

          {metrics?.connectionType && (
            <MetricDisplay
              label="Connection"
              value={metrics.connectionType}
            />
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Press Ctrl+Shift+P to toggle • Updates automatically
          </p>
        </div>
      </div>
    </div>
  );
}