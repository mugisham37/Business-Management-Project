/**
 * Communication GraphQL Fragments
 * Reusable fragments for communication operations
 */

import { gql } from '@apollo/client';

export const COMMUNICATION_RESULT_FRAGMENT = gql`
  fragment CommunicationResultFragment on CommunicationResult {
    id
    status
    message
    timestamp
    channel
  }
`;

export const BULK_COMMUNICATION_RESULT_FRAGMENT = gql`
  fragment BulkCommunicationResultFragment on BulkCommunicationResult {
    success
    totalProcessed
    successCount
    failureCount
    results {
      ...CommunicationResultFragment
    }
    errors {
      message
      code
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const BULK_EMAIL_RESULT_FRAGMENT = gql`
  fragment BulkEmailResultFragment on BulkEmailResult {
    success
    totalProcessed
    successCount
    failureCount
    emailResults {
      id
      recipientEmail
      status
      timestamp
      errorMessage
    }
  }
`;

export const BULK_SMS_RESULT_FRAGMENT = gql`
  fragment BulkSmsResultFragment on BulkSmsResult {
    success
    totalProcessed
    successCount
    failureCount
    smsResults {
      id
      recipientPhone
      status
      timestamp
      errorMessage
    }
  }
`;

export const INTEGRATION_TEST_RESULT_FRAGMENT = gql`
  fragment IntegrationTestResultFragment on IntegrationTestResult {
    success
    message
    timestamp
    details {
      service
      status
      errorMessage
    }
  }
`;
