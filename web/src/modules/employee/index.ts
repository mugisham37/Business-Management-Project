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

export const EmployeeProfile = lazy(() => 
  import('./components/EmployeeProfile').then(module => ({
    default: module.EmployeeProfile
  }))
);

export const ScheduleManager = lazy(() => 
  import('./components/ScheduleManager').then(module => ({
    default: module.ScheduleManager
  }))
);

export const PerformanceReviews = lazy(() => 
  import('./components/PerformanceReviews').then(module => ({
    default: module.PerformanceReviews
  }))
);

// Export hooks
export { useEmployees } from './hooks/useEmployees';
export { useTimeTracking } from './hooks/useTimeTracking';

// Export types
export type {
  Employee,
  EmployeeConnection,
  TimeEntry,
  EmployeeSchedule,
  TrainingRecord,
  EmployeeGoal,
  PerformanceReview,
  EmployeeQueryInput,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeAnalytics,
  EmployeeDashboardData,
} from '@/types/employee';

// Export GraphQL operations
export {
  GET_EMPLOYEES,
  GET_EMPLOYEE,
  GET_TIME_ENTRIES,
  GET_EMPLOYEE_SCHEDULES,
} from '@/graphql/queries/employee';

export {
  CREATE_EMPLOYEE,
  UPDATE_EMPLOYEE,
  CLOCK_IN,
  CLOCK_OUT,
  CREATE_EMPLOYEE_SCHEDULE,
} from '@/graphql/mutations/employee';

export const employeeModule = {
  name: 'Employee Management',
  version: '1.0.0',
  description: 'Human resources and employee management with real-time tracking',
  components: { 
    EmployeeDashboard, 
    EmployeeDirectory, 
    TimeTracking,
    EmployeeProfile,
    ScheduleManager,
    PerformanceReviews,
  },
  routes: [
    '/employee', 
    '/employee/directory', 
    '/employee/time-tracking',
    '/employee/schedules',
    '/employee/performance',
    '/employee/profile/:id',
  ],
  permissions: [
    'employees:read', 
    'employees:write', 
    'employees:admin',
    'employees:approve',
    'employees:manage',
  ],
  businessTier: 'SMALL',
  dependencies: ['tenant', 'auth'],
  features: [
    'Employee directory and profiles',
    'Time tracking and attendance',
    'Schedule management',
    'Performance reviews and goals',
    'Training records and certifications',
    'Real-time notifications',
    'Analytics and reporting',
    'Payroll integration',
  ],
} as const;