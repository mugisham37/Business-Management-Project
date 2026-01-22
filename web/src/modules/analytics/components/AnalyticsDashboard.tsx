/**
 * Analytics Dashboard Component
 * Main dashboard for business analytics and reporting
 */

import { useEffect } from 'react';
import { performanceMonitor } from '@/lib/performance';

export function AnalyticsDashboard() {
  useEffect(() => {
    // Record module load time for performance monitoring
    const loadStartTime = performance.now();
    
    // Simulate module initialization
    const initializeModule = async () => {
      // Module initialization logic would go here
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const loadTime = performance.now() - loadStartTime;
      performanceMonitor.recordModuleLoad('analytics', loadTime);
    };

    initializeModule();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Analytics Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Business intelligence and reporting platform
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Total Revenue
          </h3>
          <p className="text-3xl font-bold text-green-600">$124,567</p>
          <p className="text-sm text-gray-500 mt-1">+12.5% from last month</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Active Users
          </h3>
          <p className="text-3xl font-bold text-blue-600">2,847</p>
          <p className="text-sm text-gray-500 mt-1">+8.3% from last month</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Conversion Rate
          </h3>
          <p className="text-3xl font-bold text-purple-600">3.24%</p>
          <p className="text-sm text-gray-500 mt-1">+0.8% from last month</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Customer Satisfaction
          </h3>
          <p className="text-3xl font-bold text-orange-600">4.8/5</p>
          <p className="text-sm text-gray-500 mt-1">+0.2 from last month</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue Trend
          </h3>
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
            <p className="text-gray-500">Revenue chart will be implemented here</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            User Activity
          </h3>
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
            <p className="text-gray-500">Activity chart will be implemented here</p>
          </div>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Reports
        </h3>
        <div className="space-y-3">
          {[
            { name: 'Monthly Sales Report', date: '2024-01-15', status: 'Ready' },
            { name: 'Customer Analysis', date: '2024-01-14', status: 'Processing' },
            { name: 'Inventory Report', date: '2024-01-13', status: 'Ready' },
          ].map((report, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{report.name}</p>
                <p className="text-sm text-gray-500">{report.date}</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                report.status === 'Ready' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              }`}>
                {report.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Module Performance Info (Dev Only) */}
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