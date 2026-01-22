/**
 * Analytics Page - SSR with lazy loading
 * Demonstrates SSR with module lazy loading for analytics
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { LazyModule } from '@/components/common/LazyModule';
import { AnalyticsDashboard } from '@/modules/analytics';

export const metadata: Metadata = {
  title: 'Analytics Dashboard',
  description: 'Business intelligence and analytics platform',
};

export default function AnalyticsPage() {
  return (
    <LazyModule 
      moduleName="analytics"
      fallback={
        <div className="p-6 max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <Suspense fallback={<div>Loading Analytics...</div>}>
        <AnalyticsDashboard />
      </Suspense>
    </LazyModule>
  );
}