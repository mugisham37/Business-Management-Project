import React from 'react';
import { ProtectedRoute } from '@/components/auth';
import { TenantGate } from '@/lib/tenant';
import { ConnectionStatus } from '@/components/common/ConnectionStatus';
import { RealtimeIndicator } from '@/components/common/RealtimeIndicator';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Dashboard layout with authentication and tenant validation
 * Provides the main application shell for authenticated users
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <TenantGate>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Business Management Platform
                  </h1>
                </div>
                
                <div className="flex items-center space-x-4">
                  <ConnectionStatus />
                  <RealtimeIndicator />
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </TenantGate>
    </ProtectedRoute>
  );
}