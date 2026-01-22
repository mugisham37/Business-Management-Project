'use client';

import React, { useState, useEffect } from 'react';
import { useUnifiedCache } from '@/lib/cache';

interface CacheMetricsProps {
  refreshInterval?: number;
  showDetails?: boolean;
}

export function CacheMetricsDisplay({ 
  refreshInterval = 5000, 
  showDetails = false 
}: CacheMetricsProps) {
  const { getMetrics } = useUnifiedCache();
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateMetrics = () => {
      try {
        const currentMetrics = getMetrics();
        setMetrics(currentMetrics);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to get cache metrics:', error);
        setIsLoading(false);
      }
    };

    // Initial load
    updateMetrics();

    // Set up interval
    const interval = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [getMetrics, refreshInterval]);

  if (isLoading) {
    return (
      <div className="cache-metrics-loading">
        <div className="animate-pulse">Loading cache metrics...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="cache-metrics-error">
        <div className="text-red-500">Failed to load cache metrics</div>
      </div>
    );
  }

  const calculateHitRate = (hits: number, misses: number) => {
    const total = hits + misses;
    return total > 0 ? ((hits / total) * 100).toFixed(1) : '0.0';
  };

  return (
    <div className="cache-metrics-display p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Cache Performance</h3>
      
      {/* Multi-Tier Cache Metrics */}
      <div className="mb-6">
        <h4 className="text-md font-medium mb-2">Multi-Tier Cache</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card p-3 bg-blue-50 rounded">
            <div className="text-sm text-gray-600">L1 Hit Rate</div>
            <div className="text-xl font-bold text-blue-600">
              {calculateHitRate(metrics.multiTier.l1Hits, metrics.multiTier.l1Misses)}%
            </div>
          </div>
          
          <div className="metric-card p-3 bg-green-50 rounded">
            <div className="text-sm text-gray-600">L2 Hit Rate</div>
            <div className="text-xl font-bold text-green-600">
              {calculateHitRate(metrics.multiTier.l2Hits, metrics.multiTier.l2Misses)}%
            </div>
          </div>
          
          <div className="metric-card p-3 bg-purple-50 rounded">
            <div className="text-sm text-gray-600">Memory Usage</div>
            <div className="text-xl font-bold text-purple-600">
              {(metrics.multiTier.memoryUsage / 1024).toFixed(1)}KB
            </div>
          </div>
          
          <div className="metric-card p-3 bg-orange-50 rounded">
            <div className="text-sm text-gray-600">Avg Response</div>
            <div className="text-xl font-bold text-orange-600">
              {metrics.multiTier.averageResponseTime.toFixed(1)}ms
            </div>
          </div>
        </div>
      </div>

      {/* Offline Cache Metrics */}
      <div className="mb-6">
        <h4 className="text-md font-medium mb-2">Offline Status</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`metric-card p-3 rounded ${
            metrics.offline.isOnline ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <div className="text-sm text-gray-600">Connection</div>
            <div className={`text-xl font-bold ${
              metrics.offline.isOnline ? 'text-green-600' : 'text-red-600'
            }`}>
              {metrics.offline.isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
          
          <div className="metric-card p-3 bg-yellow-50 rounded">
            <div className="text-sm text-gray-600">Queued Ops</div>
            <div className="text-xl font-bold text-yellow-600">
              {metrics.offline.queuedOperations}
            </div>
          </div>
          
          <div className="metric-card p-3 bg-blue-50 rounded">
            <div className="text-sm text-gray-600">Synced Ops</div>
            <div className="text-xl font-bold text-blue-600">
              {metrics.offline.syncedOperations}
            </div>
          </div>
          
          <div className="metric-card p-3 bg-red-50 rounded">
            <div className="text-sm text-gray-600">Failed Ops</div>
            <div className="text-xl font-bold text-red-600">
              {metrics.offline.failedOperations}
            </div>
          </div>
        </div>
      </div>

      {/* Invalidation Metrics */}
      <div className="mb-6">
        <h4 className="text-md font-medium mb-2">Cache Invalidation</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card p-3 bg-indigo-50 rounded">
            <div className="text-sm text-gray-600">Total Invalidations</div>
            <div className="text-xl font-bold text-indigo-600">
              {metrics.invalidation.totalInvalidations}
            </div>
          </div>
          
          <div className="metric-card p-3 bg-pink-50 rounded">
            <div className="text-sm text-gray-600">Mutation Based</div>
            <div className="text-xl font-bold text-pink-600">
              {metrics.invalidation.mutationBasedInvalidations}
            </div>
          </div>
          
          <div className="metric-card p-3 bg-teal-50 rounded">
            <div className="text-sm text-gray-600">Time Based</div>
            <div className="text-xl font-bold text-teal-600">
              {metrics.invalidation.timeBasedInvalidations}
            </div>
          </div>
          
          <div className="metric-card p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">Avg Time</div>
            <div className="text-xl font-bold text-gray-600">
              {metrics.invalidation.averageInvalidationTime.toFixed(1)}ms
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      {showDetails && (
        <div className="detailed-metrics">
          <h4 className="text-md font-medium mb-2">Detailed Statistics</h4>
          <div className="bg-gray-50 p-4 rounded">
            <pre className="text-sm overflow-auto">
              {JSON.stringify(metrics, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default CacheMetricsDisplay;