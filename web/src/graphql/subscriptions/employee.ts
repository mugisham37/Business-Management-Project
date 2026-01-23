/**
 * Employee GraphQL Subscriptions
 * Real-time subscriptions for employee events
 */

import { gql } from '@apollo/client';
import {
  EMPLOYEE_FULL_FRAGMENT,
  TIME_ENTRY_FRAGMENT,
  EMPLOYEE_SCHEDULE_FRAGMENT,
  TRAINING_RECORD_FRAGMENT,
  EMPLOYEE_GOAL_FRAGMENT,
} from '../fragments/employee';

// Employee Event Subscriptions
export const EMPLOYEE_CREATED_SUBSCRIPTION = gql`
  subscription EmployeeCreated {
    employeeCreated {
      ...EmployeeFull
    }
  }
  ${EMPLOYEE_FULL_FRAGMENT}
`;

export const EMPLOYEE_UPDATED_SUBSCRIPTION = gql`
  subscription EmployeeUpdated {
    employeeUpdated {
      ...EmployeeFull
    }
  }
  ${EMPLOYEE_FULL_FRAGMENT}
`;

export const EMPLOYEE_TERMINATED_SUBSCRIPTION = gql`
  subscription EmployeeTerminated {
    employeeTerminated {
      id
      tenantId
    }
  }
`;

// Time Tracking Subscriptions
export const EMPLOYEE_CLOCKED_IN_SUBSCRIPTION = gql`
  subscription EmployeeClockedIn {
    employeeClockedIn {
      ...TimeEntry
    }
  }
  ${TIME_ENTRY_FRAGMENT}
`;

export const EMPLOYEE_CLOCKED_OUT_SUBSCRIPTION = gql`
  subscription EmployeeClockedOut {
    employeeClockedOut {
      ...TimeEntry
    }
  }
  ${TIME_ENTRY_FRAGMENT}
`;

export const TIME_ENTRY_APPROVED_SUBSCRIPTION = gql`
  subscription TimeEntryApproved {
    timeEntryApproved {
      ...TimeEntry
    }
  }
  ${TIME_ENTRY_FRAGMENT}
`;

// Schedule Subscriptions
export const EMPLOYEE_SCHEDULE_CREATED_SUBSCRIPTION = gql`
  subscription EmployeeScheduleCreated {
    employeeScheduleCreated {
      ...EmployeeSchedule
    }
  }
  ${EMPLOYEE_SCHEDULE_FRAGMENT}
`;

export const EMPLOYEE_SCHEDULE_UPDATED_SUBSCRIPTION = gql`
  subscription EmployeeScheduleUpdated {
    employeeScheduleUpdated {
      ...EmployeeSchedule
    }
  }
  ${EMPLOYEE_SCHEDULE_FRAGMENT}
`;

// Training Subscriptions
export const TRAINING_CREATED_SUBSCRIPTION = gql`
  subscription TrainingCreated {
    trainingCreated {
      ...TrainingRecord
    }
  }
  ${TRAINING_RECORD_FRAGMENT}
`;

// Goal Subscriptions
export const GOAL_CREATED_SUBSCRIPTION = gql`
  subscription GoalCreated {
    goalCreated {
      ...EmployeeGoal
    }
  }
  ${EMPLOYEE_GOAL_FRAGMENT}
`;

// Combined Employee Activity Subscription
export const EMPLOYEE_ACTIVITY_SUBSCRIPTION = gql`
  subscription EmployeeActivity($employeeId: ID) {
    employeeActivity(employeeId: $employeeId) {
      type
      timestamp
      employeeId
      data
      metadata
    }
  }
`;

// Department Activity Subscription
export const DEPARTMENT_ACTIVITY_SUBSCRIPTION = gql`
  subscription DepartmentActivity($department: String!) {
    departmentActivity(department: $department) {
      type
      timestamp
      department
      employeeId
      data
      metadata
    }
  }
`;

// Manager Notifications Subscription
export const MANAGER_NOTIFICATIONS_SUBSCRIPTION = gql`
  subscription ManagerNotifications($managerId: ID!) {
    managerNotifications(managerId: $managerId) {
      type
      priority
      timestamp
      employeeId
      message
      actionRequired
      data
    }
  }
`;