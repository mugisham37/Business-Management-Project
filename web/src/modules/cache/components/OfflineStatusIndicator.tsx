'use client';

import React, { useState, useEffect } from 'react';
import { useOfflineCache } from '@/lib/cache';

interface OfflineStatusIndicatorProps {
  showDetails?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

export function OfflineStatusIndicator({ 
  showDetails = false,
  position = 'top-right',
  className = ''
}: OfflineStatusIndicatorProps) {
  const { getMetrics, syncOperations, addSyncListener } = useOfflineCache();
  const [metrics, setMetrics] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  useEffect(() => {
    const updateMetrics = () => {
      const currentMetrics = getMetrics();
      setMetrics(currentMetrics);
    };

    // Initial load
    updateMetrics();

    // Update every second
    const interval = setInterval(updateMetrics, 1000);

    // Listen for sync events
    const unsubscribe = addSyncListener((result) => {
      setLastSyncResult(result);
      setIsSyncing(false);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [getMetrics, addSyncListener]);

  const handleManualSync = async () => {
    if (isSyncing || !metrics?.isOnline) return;
    
    setIsSyncing(true);
    try {
      await syncOperations();
    } catch (error) {
      console.error('Manual sync failed:', error);
      setIsSyncing(false);
    }
  };

  const getPositionClasses = () => {
    const baseClasses = 'fixed z-50';
    switch (position) {
      case 'top-right':
        return `${baseClasses} top-4 right-4`;
      case 'top-left':
        return `${baseClasses} top-4 left-4`;
      case 'bottom-right':
        return `${baseClasses} bottom-4 right-4`;
      case 'bottom-left':
        return `${baseClasses} bottom-4 left-4`;
      default:
        return `${baseClasses} top-4 right-4`;
    }
  };

  const getStatusColor = () => {
    if (!metrics) return 'gray';
    if (metrics.syncInProgress || isSyncing) return 'yellow';
    if (!metrics.isOnline) return 'red';
    if (metrics.queuedOperations > 0) return 'orange';
    return 'green';
  };

  const getStatusText = () => {
    if (!metrics) return 'Loading...';
    if (metrics.syncInProgress || isSyncing) return 'Syncing...';
    if (!metrics.isOnline) return 'Offline';
    if (metrics.queuedOperations > 0) return `${metrics.queuedOperations} queued`;
    return 'Online';
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (!metrics) {
    return (
      <div className={`${getPositionClasses()} ${className}`}>
        <div className="bg-gray-100 text-gray-600 px-3 py-2 rounded-full text-sm">
          Loading...
        </div>
      </div>
    );
  }

  const statusColor = getStatusColor();
  const statusText = getStatusText();

  return (
    <div className={`${getPositionClasses()} ${className}`}>
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Status Indicator */}
        <div className={`flex items-center px-3 py-2 ${
          statusColor === 'green' ? 'bg-green-100 text-green-800' :
          statusColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
          statusColor === 'orange' ? 'bg-orange-100 text-orange-800' :
          statusColor === 'red' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${
            statusColor === 'green' ? 'bg-green-500' :
            statusColor === 'yellow' ? 'bg-yellow-500 animate-pulse' :
            statusColor === 'orange' ? 'bg-orange-500' :
            statusColor === 'red' ? 'bg-red-500' :
            'bg-gray-500'
          }`} />
          <span className="text-sm font-medium">{statusText}</span>
          
          {/* Sync Button */}
          {metrics.isOnline && metrics.queuedOperations > 0 && !isSyncing && (
            <button
              onClick={handleManualSync}
              className="ml-2 text-xs bg-white bg-opacity-50 hover:bg-opacity-75 px-2 py-1 rounded"
              title="Sync now"
            >
              Sync
            </button>
          )}
        </div>

        {/* Detailed Information */}
        {showDetails && (
          <div className="p-3 border-t bg-gray-50">
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Last Online:</span>
                <span>{formatTime(metrics.lastOnlineTime)}</span>
              </div>
              
              {!metrics.isOnline && (
                <div className="flex justify-between">
                  <span>Offline Duration:</span>
                  <span>{formatDuration(metrics.totalOfflineTime)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span>Synced Operations:</span>
                <span>{metrics.syncedOperations}</span>
              </div>
              
              {metrics.failedOperations > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Failed Operations:</span>
                  <span>{metrics.failedOperations}</span>
                </div>
              )}
              
              {lastSyncResult && (
                <div className="pt-2 border-t">
                  <div className="text-xs font-medium mb-1">Last Sync:</div>
                  <div className="flex justify-between">
                    <span>Successful:</span>
                    <span className="text-green-600">{lastSyncResult.successful}</span>
                  </div>
                  {lastSyncResult.failed > 0 && (
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <span className="text-red-600">{lastSyncResult.failed}</span>
                    </div>
                  )}
                  {lastSyncResult.skipped > 0 && (
                    <div className="flex justify-between">
                      <span>Skipped:</span>
                      <span className="text-yellow-600">{lastSyncResult.skipped}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OfflineStatusIndicator;