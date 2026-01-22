/**
 * User Management Component
 * User administration and management interface
 */

import { ModuleWrapper, ModuleSection } from '@/components/common/ModuleWrapper';

export function UserManagement() {
  return (
    <ModuleWrapper
      moduleName="auth"
      title="User Management"
      description="Manage users, roles, and permissions"
    >
      <div className="p-6 max-w-7xl mx-auto">
        <ModuleSection title="User Directory" description="All system users">
          <p className="text-gray-600 dark:text-gray-400">
            User management interface will be implemented here.
            This component is lazy loaded as part of the auth module.
          </p>
        </ModuleSection>
      </div>
    </ModuleWrapper>
  );
}