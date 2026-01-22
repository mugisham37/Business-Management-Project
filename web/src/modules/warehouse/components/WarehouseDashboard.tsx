/**
 * Warehouse Dashboard Component
 * Main dashboard for warehouse management module
 */

'use client';

import { useEffect } from 'react';
import { performanceMonitor } from '@/lib/performance';

export function WarehouseDashboard() {
  useEffect(() => {
    // Record module load time for performance monitoring
    const loadStartTime = performance.now();
    
    // Simulate module initialization
    const initializeModule = async () => {
      // Module initialization logic would go here
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const loadTime = performance.now() - loadStartTime;
      performanceMonitor.recordModuleLoad('warehouse', loadTime);
    };

    initializeModule();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Warehouse Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Comprehensive warehouse operations and inventory management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Inventory Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Inventory Overview
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Items</span>
              <span className="font-medium">1,234</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Low Stock</span>
              <span className="font-medium text-orange-600">23</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Out of Stock</span>
              <span className="font-medium text-red-600">5</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            <div className="text-sm">
              <div className="font-medium">Shipment #12345 received</div>
              <div className="text-gray-600 dark:text-gray-400">2 hours ago</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Inventory count updated</div>
              <div className="text-gray-600 dark:text-gray-400">4 hours ago</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Order #67890 picked</div>
              <div className="text-gray-600 dark:text-gray-400">6 hours ago</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button className="w-full text-left px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              Receive Shipment
            </button>
            <button className="w-full text-left px-3 py-2 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
              Create Pick List
            </button>
            <button className="w-full text-left px-3 py-2 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
              Inventory Count
            </button>
          </div>
        </div>
      </div>

      {/* Performance Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Module Performance (Dev Only)
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            This module was lazy loaded and performance metrics are being tracked.
            Check the browser console for detailed performance information.
          </p>
        </div>
      )}
    </div>
  );
}