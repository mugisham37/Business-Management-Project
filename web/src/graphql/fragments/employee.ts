/**
 * Employee GraphQL Fragments
 * Reusable fragments for employee-related queries
 */

import { gql } from '@apollo/client';

export const EMPLOYEE_CORE_FRAGMENT = gql`
  fragment EmployeeCore on Employee {
    id
    employeeNumber
    firstName
    lastName
    middleName
    displayName
    email
    phone
    department
    position
    employmentType
    employmentStatus
    hireDate
    terminationDate
    baseSalary
    hourlyRate
    managerId
    isActive
    createdAt
    updatedAt
    version
  }
`;

export const EMPLOYEE_FULL_FRAGMENT = gql`
  fragment EmployeeFull on Employee {
    ...EmployeeCore
    manager {
      id
      firstName
      lastName
      displayName
      position
    }
    directReports {
      id
      firstName
      lastName
      displayName
      position
    }
  }
  ${EMPLOYEE_CORE_FRAGMENT}
`;

export const TIME_ENTRY_FRAGMENT = gql`
  fragment TimeEntry on TimeEntryType {
    id
    employeeId
    clockInTime
    clockOutTime
    breakStartTime
    breakEndTime
    entryType
    totalHours
    regularHours
    overtimeHours
    isApproved
    approvedBy
    approvedAt
    locationId
    department
    notes
    createdAt
    updatedAt
  }
`;

export const EMPLOYEE_SCHEDULE_FRAGMENT = gql`
  fragment EmployeeSchedule on EmployeeScheduleType {
    id
    employeeId
    scheduleDate
    startTime
    endTime
    breakDuration
    lunchBreakStart
    lunchBreakEnd
    scheduleType
    status
    locationId
    department
    notes
    createdAt
    updatedAt
  }
`;

export const TRAINING_RECORD_FRAGMENT = gql`
  fragment TrainingRecord on TrainingRecordType {
    id
    employeeId
    trainingName
    trainingType
    provider
    startDate
    completionDate
    expirationDate
    duration
    certificateNumber
    certificationBody
    status
    score
    passingScore
    cost
    notes
    createdAt
    updatedAt
  }
`;

export const EMPLOYEE_GOAL_FRAGMENT = gql`
  fragment EmployeeGoal on EmployeeGoalType {
    id
    employeeId
    title
    description
    category
    startDate
    targetDate
    completedDate
    status
    progress
    targetValue
    currentValue
    approvedBy
    notes
    lastReviewDate
    createdAt
    updatedAt
  }
`;

export const PERFORMANCE_REVIEW_FRAGMENT = gql`
  fragment PerformanceReview on PerformanceReviewType {
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
`;