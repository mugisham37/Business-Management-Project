/**
 * Auth Page - Authentication Management
 * Demonstrates module routing for authentication management
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { LazyModule } from '@/components/common/LazyModule';
import { AuthDashboard } from '@/modules/auth';

export const metadata: Metadata = {
  title: 'Authentication Management',
  description: 'User authentication, authorization, and session management',
};

export default function AuthPage() {
  return (
    <LazyModule 
      moduleName="auth"
      fallback={
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
      }
    >
      <Suspense fallback={<div>Loading Authentication...</div>}>
        <AuthDashboard />
      </Suspense>
    </LazyModule>
  );
}