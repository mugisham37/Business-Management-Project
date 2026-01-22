/**
 * Warehouse Page - SSR with lazy loading
 * Demonstrates SSR with module lazy loading for authenticated users
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { LazyModule } from '@/components/common/LazyModule';
import { ssrOptimizer } from '@/lib/performance';
import { WarehouseDashboard } from '@/modules/warehouse';

export async function generateMetadata(): Promise<Metadata> {
  return ssrOptimizer.generateMetadata('/warehouse');
}

// Server-side data fetching
async function getWarehouseData() {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    warehouseStats: {
      totalItems: 1234,
      lowStock: 23,
      outOfStock: 5,
      recentShipments: 12,
    },
    lastUpdated: new Date().toISOString(),
  };
}

export default async function WarehousePage() {
  // Pre-fetch data on server
  const warehouseData = await getWarehouseData();

  return (
    <div>
      {/* Lazy load the warehouse module */}
      <LazyModule 
        moduleName="warehouse"
        onError={(error) => {
          console.error('Failed to load warehouse module:', error);
        }}
      >
        <Suspense fallback={
          <div className="p-6 max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        }>
          <WarehouseDashboard />
        </Suspense>
      </LazyModule>

      {/* Pre-fetched data context (could be passed to module) */}
      <script
        type="application/json"
        id="warehouse-data"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(warehouseData)
        }}
      />

      {/* SSR Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="p-4 m-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
            SSR Info (Dev Only)
          </h4>
          <p className="text-xs text-green-600 dark:text-green-400">
            This page uses SSR (Server-Side Rendering) with lazy module loading.
            Data is fetched on the server and the warehouse module is loaded on demand.
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            Last updated: {warehouseData.lastUpdated}
          </p>
        </div>
      )}
    </div>
  );
}