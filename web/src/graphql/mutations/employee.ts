/**
 * Employee GraphQL Mutations
 * All mutation operations for employee management
 */

import { gql } from '@apollo/client';
import {
  EMPLOYEE_FULL_FRAGMENT,
  TIME_ENTRY_FRAGMENT,
  EMPLOYEE_SCHEDULE_FRAGMENT,
  TRAINING_RECORD_FRAGMENT,
  EMPLOYEE_GOAL_FRAGMENT,
} from '../fragments/employee';

// Employee CRUD Mutations
export const CREATE_EMPLOYEE = gql`
  mutation CreateEmployee($input: CreateEmployeeInput!) {
    createEmployee(input: $input) {
      ...EmployeeFull
    }
  }
  ${EMPLOYEE_FULL_FRAGMENT}
`;

export const UPDATE_EMPLOYEE = gql`
  mutation UpdateEmployee($id: ID!, $input: UpdateEmployeeInput!) {
    updateEmployee(id: $id, input: $input) {
      ...EmployeeFull
    }
  }
  ${EMPLOYEE_FULL_FRAGMENT}
`;

export const TERMINATE_EMPLOYEE = gql`
  mutation TerminateEmployee($id: ID!) {
    terminateEmployee(id: $id) {
      success
      message
      errors {
        message
        timestamp
      }
    }
  }
`;

// Schedule Mutations
export const CREATE_EMPLOYEE_SCHEDULE = gql`
  mutation CreateEmployeeSchedule($input: CreateEmployeeScheduleInput!) {
    createEmployeeSchedule(input: $input) {
      ...EmployeeSchedule
    }
  }
  ${EMPLOYEE_SCHEDULE_FRAGMENT}
`;

export const UPDATE_EMPLOYEE_SCHEDULE = gql`
  mutation UpdateEmployeeSchedule($id: ID!, $input: UpdateEmployeeScheduleInput!) {
    updateEmployeeSchedule(id: $id, input: $input) {
      ...EmployeeSchedule
    }
  }
  ${EMPLOYEE_SCHEDULE_FRAGMENT}
`;

// Time Entry Mutations
export const CLOCK_IN = gql`
  mutation ClockIn($input: ClockInInput!) {
    clockIn(input: $input) {
      ...TimeEntry
    }
  }
  ${TIME_ENTRY_FRAGMENT}
`;

export const CLOCK_OUT = gql`
  mutation ClockOut($input: ClockOutInput!) {
    clockOut(input: $input) {
      ...TimeEntry
    }
  }
  ${TIME_ENTRY_FRAGMENT}
`;

export const APPROVE_TIME_ENTRY = gql`
  mutation ApproveTimeEntry($timeEntryId: ID!) {
    approveTimeEntry(timeEntryId: $timeEntryId) {
      ...TimeEntry
    }
  }
  ${TIME_ENTRY_FRAGMENT}
`;

export const CREATE_TIME_ENTRY = gql`
  mutation CreateTimeEntry($input: CreateTimeEntryInput!) {
    createTimeEntry(input: $input) {
      ...TimeEntry
    }
  }
  ${TIME_ENTRY_FRAGMENT}
`;

export const UPDATE_TIME_ENTRY = gql`
  mutation UpdateTimeEntry($id: ID!, $input: UpdateTimeEntryInput!) {
    updateTimeEntry(id: $id, input: $input) {
      ...TimeEntry
    }
  }
  ${TIME_ENTRY_FRAGMENT}
`;

// Training Mutations
export const CREATE_TRAINING_RECORD = gql`
  mutation CreateTrainingRecord($input: CreateTrainingRecordInput!) {
    createTrainingRecord(input: $input) {
      ...TrainingRecord
    }
  }
  ${TRAINING_RECORD_FRAGMENT}
`;

export const UPDATE_TRAINING_RECORD = gql`
  mutation UpdateTrainingRecord($id: ID!, $input: UpdateTrainingRecordInput!) {
    updateTrainingRecord(id: $id, input: $input) {
      ...TrainingRecord
    }
  }
  ${TRAINING_RECORD_FRAGMENT}
`;

// Goal Mutations
export const CREATE_EMPLOYEE_GOAL = gql`
  mutation CreateEmployeeGoal($input: CreateEmployeeGoalInput!) {
    createEmployeeGoal(input: $input) {
      ...EmployeeGoal
    }
  }
  ${EMPLOYEE_GOAL_FRAGMENT}
`;

export const UPDATE_EMPLOYEE_GOAL = gql`
  mutation UpdateEmployeeGoal($id: ID!, $input: UpdateEmployeeGoalInput!) {
    updateEmployeeGoal(id: $id, input: $input) {
      ...EmployeeGoal
    }
  }
  ${EMPLOYEE_GOAL_FRAGMENT}
`;

// Performance Review Mutations
export const CREATE_PERFORMANCE_REVIEW = gql`
  mutation CreatePerformanceReview($input: CreatePerformanceReviewInput!) {
    createPerformanceReview(input: $input) {
      id
      employeeId
      reviewerId
      reviewPeriodStart
      reviewPeriodEnd
      reviewType
      overallRating
      reviewerComments
      employeeComments
      nextReviewDate
      status
      completedAt
      acknowledgedAt
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_PERFORMANCE_REVIEW = gql`
  mutation UpdatePerformanceReview($id: ID!, $input: UpdatePerformanceReviewInput!) {
    updatePerformanceReview(id: $id, input: $input) {
      id
      employeeId
      reviewerId
      reviewPeriodStart
      reviewPeriodEnd
      reviewType
      overallRating
      reviewerComments
      employeeComments
      nextReviewDate
      status
      completedAt
      acknowledgedAt
      createdAt
      updatedAt
    }
  }
`;

// Bulk Operations
export const BULK_UPDATE_EMPLOYEES = gql`
  mutation BulkUpdateEmployees($updates: [BulkEmployeeUpdateInput!]!) {
    bulkUpdateEmployees(updates: $updates) {
      success
      message
      updatedCount
      errors {
        employeeId
        message
        timestamp
      }
    }
  }
`;

export const BULK_CREATE_SCHEDULES = gql`
  mutation BulkCreateSchedules($schedules: [CreateEmployeeScheduleInput!]!) {
    bulkCreateSchedules(schedules: $schedules) {
      success
      message
      createdCount
      errors {
        employeeId
        message
        timestamp
      }
    }
  }
`;

// Import/Export Mutations
export const IMPORT_EMPLOYEES = gql`
  mutation ImportEmployees($file: Upload!, $options: ImportOptionsInput) {
    importEmployees(file: $file, options: $options) {
      success
      message
      importedCount
      skippedCount
      errors {
        row
        message
        timestamp
      }
    }
  }
`;

export const EXPORT_EMPLOYEES = gql`
  mutation ExportEmployees($format: ExportFormat!, $filters: EmployeeQueryInput) {
    exportEmployees(format: $format, filters: $filters) {
      success
      message
      downloadUrl
      expiresAt
    }
  }
`;