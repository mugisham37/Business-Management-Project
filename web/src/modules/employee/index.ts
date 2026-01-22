/**
 * Employee Module - Human Resources Management
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

export const EmployeeDashboard = lazy(() => 
  import('./components/EmployeeDashboard').then(module => ({
    default: module.EmployeeDashboard
  }))
);

export const EmployeeDirectory = lazy(() => 
  import('./components/EmployeeDirectory').then(module => ({
    default: module.EmployeeDirectory
  }))
);

export const TimeTracking = lazy(() => 
  import('./components/TimeTracking').then(module => ({
    default: module.TimeTracking
  }))
);

export { useEmployees } from './hooks/useEmployees';
export { useTimeTracking } from './hooks/useTimeTracking';

export const employeeModule = {
  name: 'Employee Management',
  version: '1.0.0',
  description: 'Human resources and employee management',
  components: { EmployeeDashboard, EmployeeDirectory, TimeTracking },
  routes: ['/employee', '/employee/directory', '/employee/time-tracking'],
  permissions: ['employee:read', 'employee:write', 'employee:admin'],
  businessTier: 'SMALL',
  dependencies: ['tenant', 'auth'],
} as const;