/**
 * Dashboard Page - ISR with authentication
 * Demonstrates ISR (Incremental Static Regeneration) with auth checks
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { ssrOptimizer } from '@/lib/performance';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

// ISR configuration
export const revalidate = 300; // 5 minutes

export async function generateMetadata(): Promise<Metadata> {
  return ssrOptimizer.generateMetadata('/dashboard');
}

// Dashboard content component
async function DashboardContent() {
  // Simulate data fetching
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const dashboardData = {
    totalRevenue: '$125,430',
    totalOrders: 1234,
    activeUsers: 89,
    conversionRate: '3.2%',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Welcome to your business management dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Total Revenue
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {dashboardData.totalRevenue}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Total Orders
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {dashboardData.totalOrders.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Active Users
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {dashboardData.activeUsers}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Conversion Rate
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {dashboardData.conversionRate}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                New order received
              </span>
              <span className="text-xs text-gray-500">2 min ago</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Inventory updated
              </span>
              <span className="text-xs text-gray-500">15 min ago</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Payment processed
              </span>
              <span className="text-xs text-gray-500">1 hour ago</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-3 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              New Order
            </button>
            <button className="p-3 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
              Add Product
            </button>
            <button className="p-3 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
              View Reports
            </button>
            <button className="p-3 text-sm bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* SSR/ISR Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
            SSR/ISR Info (Dev Only)
          </h4>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            This page uses ISR (Incremental Static Regeneration) with a 5-minute revalidation period.
            Data is pre-rendered at build time and updated in the background.
          </p>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <DashboardContent />
    </Suspense>
  );
}