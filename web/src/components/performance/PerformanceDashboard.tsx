/**
 * Performance Dashboard Component
 * Displays real-time performance metrics and optimization insights
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  usePerformanceMonitoring, 
  useBundleAnalysis,
  performanceMonitor,
  bundleAnalyzer 
} from '@/lib/performance';

export function PerformanceDashboard() {
  const {
    metrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    getScore,
  } = usePerformanceMonitoring();

  const {
    stats: bundleStats,
    loading: bundleLoading,
    analyze: analyzeBundles,
    recommendations,
    validation,
  } = useBundleAnalysis();

  const [performanceScore, setPerformanceScore] = useState<any>(null);

  useEffect(() => {
    // Start monitoring when component mounts
    startMonitoring();
    
    // Get initial performance score
    const score = getScore();
    setPerformanceScore(score);

    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring, getScore]);

  const handleAnalyzeBundles = async () => {
    if (process.env.NODE_ENV === 'development') {
      await analyzeBundles();
    }
  };

  const exportReport = () => {
    const report = performanceMonitor.exportReport();
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'performance-report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Performance Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitor application performance and optimization metrics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Performance Score */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Performance Score
          </h3>
          
          {performanceScore ? (
            <div>
              <div className="flex items-center mb-4">
                <div className={`text-4xl font-bold ${
                  performanceScore.grade === 'A' ? 'text-green-600' :
                  performanceScore.grade === 'B' ? 'text-blue-600' :
                  performanceScore.grade === 'C' ? 'text-yellow-600' :
                  performanceScore.grade === 'D' ? 'text-orange-600' :
                  'text-red-600'
                }`}>
                  {performanceScore.score}
                </div>
                <div className="ml-2">
                  <div className={`text-2xl font-bold ${
                    performanceScore.grade === 'A' ? 'text-green-600' :
                    performanceScore.grade === 'B' ? 'text-blue-600' :
                    performanceScore.grade === 'C' ? 'text-yellow-600' :
                    performanceScore.grade === 'D' ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {performanceScore.grade}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Grade
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(performanceScore.details).map(([metric, data]: [string, any]) => (
                  <div key={metric} className="flex justify-between items-center">
                    <span className="text-sm font-medium uppercase">{metric}</span>
                    <div className="flex items-center">
                      <span className="text-sm mr-2">
                        {Math.round(data.value)}{metric === 'cls' ? '' : 'ms'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        data.status === 'good' ? 'bg-green-100 text-green-800' :
                        data.status === 'needs-improvement' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {data.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-gray-600 dark:text-gray-400">
              Collecting performance metrics...
            </div>
          )}
        </div>

        {/* Bundle Analysis */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Bundle Analysis
            </h3>
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={handleAnalyzeBundles}
                disabled={bundleLoading}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {bundleLoading ? 'Analyzing...' : 'Analyze'}
              </button>
            )}
          </div>

          {bundleStats ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Size</span>
                <span className="font-medium">
                  {(bundleStats.totalSize / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Gzipped</span>
                <span className="font-medium">
                  {(bundleStats.gzippedSize / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Chunks</span>
                <span className="font-medium">{bundleStats.chunks.length}</span>
              </div>

              {validation && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className={`text-sm font-medium ${
                    validation.isValid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {validation.isValid ? '✅ Bundle Valid' : '❌ Issues Found'}
                  </div>
                  {validation.issues.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {validation.issues.map((issue, index) => (
                        <div key={index} className="text-xs text-red-600">
                          • {issue}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-600 dark:text-gray-400">
              {process.env.NODE_ENV === 'development' 
                ? 'Click "Analyze" to analyze bundle size'
                : 'Bundle analysis available in development mode'
              }
            </div>
          )}
        </div>
      </div>

      {/* Module Performance */}
      {metrics?.moduleLoadTime && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Module Load Times
          </h3>
          <div className="space-y-2">
            {Object.entries(metrics.moduleLoadTime).map(([module, time]) => (
              <div key={module} className="flex justify-between items-center">
                <span className="text-sm font-medium">{module}</span>
                <div className="flex items-center">
                  <span className="text-sm mr-2">{Math.round(time)}ms</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    time <= 1000 ? 'bg-green-100 text-green-800' :
                    time <= 3000 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {time <= 1000 ? 'Good' : time <= 3000 ? 'Fair' : 'Poor'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Optimization Recommendations
          </h3>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="flex items-start">
                <span className={`text-lg mr-3 ${
                  rec.priority === 'high' ? 'text-red-500' :
                  rec.priority === 'medium' ? 'text-yellow-500' :
                  'text-green-500'
                }`}>
                  {rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢'}
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {rec.description}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Target: {rec.target} • Priority: {rec.priority}
                    {rec.estimatedSavings > 0 && (
                      <> • Estimated savings: {(rec.estimatedSavings / 1024).toFixed(1)}KB</>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={exportReport}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Export Report
        </button>
        
        <button
          onClick={() => setPerformanceScore(getScore())}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Refresh Metrics
        </button>
      </div>
    </div>
  );
}