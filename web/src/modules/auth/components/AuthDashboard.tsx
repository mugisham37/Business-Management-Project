/**
 * Auth Dashboard Component
 * Main dashboard for authentication management
 */

import { useEffect } from 'react';
import { performanceMonitor } from '@/lib/performance';
import { ModuleWrapper, ModuleSection, ModuleGrid } from '@/components/common/ModuleWrapper';

export function AuthDashboard() {
  useEffect(() => {
    const loadStartTime = performance.now();
    const initializeModule = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      const loadTime = performance.now() - loadStartTime;
      performanceMonitor.recordModuleLoad('auth', loadTime);
    };
    initializeModule();
  }, []);

  return (
    <ModuleWrapper
      moduleName="auth"
      title="Authentication Management"
      description="User authentication, authorization, and session management"
    >
      <div className="p-6 max-w-7xl mx-auto">
        <ModuleGrid columns={3} gap="md">
          <ModuleSection title="Active Sessions" description="Current user sessions">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">247</div>
              <p className="text-sm text-gray-500">Active sessions</p>
            </div>
          </ModuleSection>

          <ModuleSection title="Failed Logins" description="Recent failed login attempts">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">12</div>
              <p className="text-sm text-gray-500">Last 24 hours</p>
            </div>
          </ModuleSection>

          <ModuleSection title="MFA Enabled" description="Users with multi-factor authentication">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">89%</div>
              <p className="text-sm text-gray-500">MFA adoption rate</p>
            </div>
          </ModuleSection>
        </ModuleGrid>

        <div className="mt-8">
          <ModuleSection title="Recent Activity" description="Latest authentication events">
            <div className="space-y-3">
              {[
                { user: 'john.doe@example.com', action: 'Login', time: '2 minutes ago', status: 'success' },
                { user: 'jane.smith@example.com', action: 'MFA Setup', time: '5 minutes ago', status: 'success' },
                { user: 'unknown@example.com', action: 'Failed Login', time: '8 minutes ago', status: 'failed' },
              ].map((event, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{event.user}</p>
                    <p className="text-sm text-gray-500">{event.action} • {event.time}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    event.status === 'success' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {event.status}
                  </span>
                </div>
              ))}
            </div>
          </ModuleSection>
        </div>
      </div>
    </ModuleWrapper>
  );
}