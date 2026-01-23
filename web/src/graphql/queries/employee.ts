/**
 * Employee GraphQL Queries
 * All query operations for employee management
 */

import { gql } from '@apollo/client';
import {
  EMPLOYEE_CORE_FRAGMENT,
  EMPLOYEE_FULL_FRAGMENT,
  TIME_ENTRY_FRAGMENT,
  EMPLOYEE_SCHEDULE_FRAGMENT,
  TRAINING_RECORD_FRAGMENT,
  EMPLOYEE_GOAL_FRAGMENT,
  PERFORMANCE_REVIEW_FRAGMENT,
} from '../fragments/employee';

// Employee Queries
export const GET_EMPLOYEE = gql`
  query GetEmployee($id: ID!) {
    employee(id: $id) {
      ...EmployeeFull
      schedules {
        ...EmployeeSchedule
      }
      training {
        ...TrainingRecord
      }
      goals {
        ...EmployeeGoal
      }
    }
  }
  ${EMPLOYEE_FULL_FRAGMENT}
  ${EMPLOYEE_SCHEDULE_FRAGMENT}
  ${TRAINING_RECORD_FRAGMENT}
  ${EMPLOYEE_GOAL_FRAGMENT}
`;

export const GET_EMPLOYEE_BY_NUMBER = gql`
  query GetEmployeeByNumber($employeeNumber: String!) {
    employeeByNumber(employeeNumber: $employeeNumber) {
      ...EmployeeFull
    }
  }
  ${EMPLOYEE_FULL_FRAGMENT}
`;

export const GET_EMPLOYEES = gql`
  query GetEmployees($query: EmployeeQueryInput) {
    employees(query: $query) {
      employees {
        ...EmployeeCore
        manager {
          id
          firstName
          lastName
          displayName
        }
      }
      total
      page
      limit
      totalPages
    }
  }
  ${EMPLOYEE_CORE_FRAGMENT}
`;

// Schedule Queries
export const GET_EMPLOYEE_SCHEDULES = gql`
  query GetEmployeeSchedules(
    $employeeId: ID!
    $startDate: DateTime
    $endDate: DateTime
  ) {
    employeeSchedules(
      employeeId: $employeeId
      startDate: $startDate
      endDate: $endDate
    ) {
      ...EmployeeSchedule
    }
  }
  ${EMPLOYEE_SCHEDULE_FRAGMENT}
`;

// Time Entry Queries
export const GET_TIME_ENTRIES = gql`
  query GetTimeEntries($query: TimeEntryQueryInput) {
    timeEntries(query: $query) {
      ...TimeEntry
    }
  }
  ${TIME_ENTRY_FRAGMENT}
`;

// Training Queries
export const GET_EMPLOYEE_TRAINING = gql`
  query GetEmployeeTraining($employeeId: ID!) {
    employeeTraining(employeeId: $employeeId) {
      ...TrainingRecord
    }
  }
  ${TRAINING_RECORD_FRAGMENT}
`;

// Goal Queries
export const GET_EMPLOYEE_GOALS = gql`
  query GetEmployeeGoals($employeeId: ID!) {
    employeeGoals(employeeId: $employeeId) {
      ...EmployeeGoal
    }
  }
  ${EMPLOYEE_GOAL_FRAGMENT}
`;

// Analytics Queries
export const GET_EMPLOYEE_ANALYTICS = gql`
  query GetEmployeeAnalytics(
    $employeeId: ID!
    $startDate: DateTime!
    $endDate: DateTime!
  ) {
    employeeAnalytics(
      employeeId: $employeeId
      startDate: $startDate
      endDate: $endDate
    ) {
      totalHours
      regularHours
      overtimeHours
      attendanceRate
      performanceScore
      goalsCompleted
      trainingCompleted
      productivityMetrics
      timeDistribution
      departmentComparison
    }
  }
`;

// Dashboard Queries
export const GET_EMPLOYEE_DASHBOARD = gql`
  query GetEmployeeDashboard {
    employees(query: { limit: 10 }) {
      employees {
        ...EmployeeCore
      }
      total
    }
    timeEntries(query: { limit: 10 }) {
      ...TimeEntry
    }
  }
  ${EMPLOYEE_CORE_FRAGMENT}
  ${TIME_ENTRY_FRAGMENT}
`;

// Department and Position Queries
export const GET_DEPARTMENTS = gql`
  query GetDepartments {
    employees(query: { limit: 1000 }) {
      employees {
        department
      }
    }
  }
`;

export const GET_POSITIONS = gql`
  query GetPositions {
    employees(query: { limit: 1000 }) {
      employees {
        position
      }
    }
  }
`;

// Manager Hierarchy Queries
export const GET_MANAGERS = gql`
  query GetManagers {
    employees(query: { limit: 1000 }) {
      employees {
        id
        firstName
        lastName
        displayName
        position
        department
        directReports {
          id
        }
      }
    }
  }
`;

// Active Employees for Dropdowns
export const GET_ACTIVE_EMPLOYEES = gql`
  query GetActiveEmployees {
    employees(query: { employmentStatus: ACTIVE, limit: 1000 }) {
      employees {
        id
        employeeNumber
        firstName
        lastName
        displayName
        position
        department
      }
    }
  }
`;