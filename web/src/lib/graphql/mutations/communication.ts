/**
 * Communication GraphQL Mutations
 * TypeScript definitions for all communication mutations
 */

import { gql } from '@apollo/client';
import {
  COMMUNICATION_RESULT_FRAGMENT,
  BULK_COMMUNICATION_RESULT_FRAGMENT,
  BULK_EMAIL_RESULT_FRAGMENT,
  BULK_SMS_RESULT_FRAGMENT,
  INTEGRATION_TEST_RESULT_FRAGMENT,
} from '../fragments/communication-fragments';

// Multi-channel communication mutations
export const SEND_MULTI_CHANNEL_NOTIFICATION = gql`
  mutation SendMultiChannelNotification($tenantId: ID!, $notification: MultiChannelNotificationInput!) {
    sendMultiChannelNotification(tenantId: $tenantId, notification: $notification) {
      ...BulkCommunicationResultFragment
    }
  }
  ${BULK_COMMUNICATION_RESULT_FRAGMENT}
`;

export const SEND_ALERT = gql`
  mutation SendAlert($tenantId: ID!, $alert: AlertInput!) {
    sendAlert(tenantId: $tenantId, alert: $alert) {
      ...BulkCommunicationResultFragment
    }
  }
  ${BULK_COMMUNICATION_RESULT_FRAGMENT}
`;

export const SEND_BUSINESS_NOTIFICATION = gql`
  mutation SendBusinessNotification($tenantId: ID!, $notification: BusinessNotificationInput!) {
    sendBusinessNotification(tenantId: $tenantId, notification: $notification) {
      ...BulkCommunicationResultFragment
    }
  }
  ${BULK_COMMUNICATION_RESULT_FRAGMENT}
`;

// Channel configuration mutations
export const CONFIGURE_COMMUNICATION_CHANNELS = gql`
  mutation ConfigureCommunicationChannels($tenantId: ID!, $channels: [CommunicationChannelConfigInput!]!, $updatedBy: String!) {
    configureCommunicationChannels(tenantId: $tenantId, channels: $channels, updatedBy: $updatedBy)
  }
`;

export const ENABLE_COMMUNICATION_CHANNEL = gql`
  mutation EnableCommunicationChannel($tenantId: ID!, $channelType: CommunicationChannelType!, $updatedBy: String!) {
    enableCommunicationChannel(tenantId: $tenantId, channelType: $channelType, updatedBy: $updatedBy)
  }
`;

export const DISABLE_COMMUNICATION_CHANNEL = gql`
  mutation DisableCommunicationChannel($tenantId: ID!, $channelType: CommunicationChannelType!, $updatedBy: String!) {
    disableCommunicationChannel(tenantId: $tenantId, channelType: $channelType, updatedBy: $updatedBy)
  }
`;

// Email mutations
export const SEND_EMAIL = gql`
  mutation SendEmail($tenantId: ID!, $message: EmailMessageInput!, $options: NotificationOptionsInput) {
    sendEmail(tenantId: $tenantId, message: $message, options: $options) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const SEND_EMAIL_TO_USERS = gql`
  mutation SendEmailToUsers($tenantId: ID!, $userIds: [ID!]!, $notification: EmailNotificationInput!, $options: NotificationOptionsInput) {
    sendEmailToUsers(tenantId: $tenantId, userIds: $userIds, notification: $notification, options: $options) {
      ...BulkEmailResultFragment
    }
  }
  ${BULK_EMAIL_RESULT_FRAGMENT}
`;

export const CREATE_EMAIL_TEMPLATE = gql`
  mutation CreateEmailTemplate($tenantId: ID!, $template: EmailTemplateInput!, $createdBy: String!) {
    createEmailTemplate(tenantId: $tenantId, template: $template, createdBy: $createdBy)
  }
`;

export const UPDATE_EMAIL_TEMPLATE = gql`
  mutation UpdateEmailTemplate($tenantId: ID!, $templateName: String!, $template: EmailTemplateInput!, $updatedBy: String!) {
    updateEmailTemplate(tenantId: $tenantId, templateName: $templateName, template: $template, updatedBy: $updatedBy)
  }
`;

export const DELETE_EMAIL_TEMPLATE = gql`
  mutation DeleteEmailTemplate($tenantId: ID!, $templateName: String!, $deletedBy: String!) {
    deleteEmailTemplate(tenantId: $tenantId, templateName: $templateName, deletedBy: $deletedBy)
  }
`;

export const CONFIGURE_EMAIL_PROVIDER = gql`
  mutation ConfigureEmailProvider($tenantId: ID!, $provider: EmailProviderConfigInput!, $updatedBy: String!) {
    configureEmailProvider(tenantId: $tenantId, provider: $provider, updatedBy: $updatedBy)
  }
`;

export const TEST_EMAIL_PROVIDER = gql`
  mutation TestEmailProvider($tenantId: ID!, $provider: EmailProviderConfigInput!) {
    testEmailProvider(tenantId: $tenantId, provider: $provider) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

// SMS mutations
export const SEND_SMS = gql`
  mutation SendSMS($tenantId: ID!, $message: SMSMessageInput!, $options: NotificationOptionsInput) {
    sendSMS(tenantId: $tenantId, message: $message, options: $options) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const SEND_SMS_TO_USERS = gql`
  mutation SendSMSToUsers($tenantId: ID!, $userIds: [ID!]!, $notification: SMSNotificationInput!, $options: NotificationOptionsInput) {
    sendSMSToUsers(tenantId: $tenantId, userIds: $userIds, notification: $notification, options: $options) {
      ...BulkSMSResultFragment
    }
  }
  ${BULK_SMS_RESULT_FRAGMENT}
`;

export const SEND_OTP = gql`
  mutation SendOTP($tenantId: ID!, $otp: OTPInput!, $options: NotificationOptionsInput) {
    sendOTP(tenantId: $tenantId, otp: $otp, options: $options) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const SEND_SMS_ALERT = gql`
  mutation SendSMSAlert($tenantId: ID!, $phoneNumbers: [String!]!, $alert: AlertInput!, $options: NotificationOptionsInput) {
    sendSMSAlert(tenantId: $tenantId, phoneNumbers: $phoneNumbers, alert: $alert, options: $options) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const CREATE_SMS_TEMPLATE = gql`
  mutation CreateSMSTemplate($tenantId: ID!, $template: SMSTemplateInput!, $createdBy: String!) {
    createSMSTemplate(tenantId: $tenantId, template: $template, createdBy: $createdBy)
  }
`;

export const UPDATE_SMS_TEMPLATE = gql`
  mutation UpdateSMSTemplate($tenantId: ID!, $templateName: String!, $template: SMSTemplateInput!, $updatedBy: String!) {
    updateSMSTemplate(tenantId: $tenantId, templateName: $templateName, template: $template, updatedBy: $updatedBy)
  }
`;

export const DELETE_SMS_TEMPLATE = gql`
  mutation DeleteSMSTemplate($tenantId: ID!, $templateName: String!, $deletedBy: String!) {
    deleteSMSTemplate(tenantId: $tenantId, templateName: $templateName, deletedBy: $deletedBy)
  }
`;

export const CONFIGURE_SMS_PROVIDER = gql`
  mutation ConfigureSMSProvider($tenantId: ID!, $provider: SMSProviderConfigInput!, $updatedBy: String!) {
    configureSMSProvider(tenantId: $tenantId, provider: $provider, updatedBy: $updatedBy)
  }
`;

export const TEST_SMS_PROVIDER = gql`
  mutation TestSMSProvider($tenantId: ID!, $provider: SMSProviderConfigInput!) {
    testSMSProvider(tenantId: $tenantId, provider: $provider) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

// Slack mutations
export const SEND_SLACK_MESSAGE = gql`
  mutation SendSlackMessage($tenantId: ID!, $message: SlackMessageInput!, $options: NotificationOptionsInput) {
    sendSlackMessage(tenantId: $tenantId, message: $message, options: $options) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const SEND_SLACK_NOTIFICATION = gql`
  mutation SendSlackNotification($tenantId: ID!, $notification: SlackNotificationInput!) {
    sendSlackNotification(tenantId: $tenantId, notification: $notification) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const SEND_SLACK_ALERT = gql`
  mutation SendSlackAlert($tenantId: ID!, $alert: SlackAlertInput!) {
    sendSlackAlert(tenantId: $tenantId, alert: $alert) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const CONFIGURE_SLACK_INTEGRATION = gql`
  mutation ConfigureSlackIntegration($tenantId: ID!, $config: SlackIntegrationConfigInput!, $updatedBy: String!) {
    configureSlackIntegration(tenantId: $tenantId, config: $config, updatedBy: $updatedBy)
  }
`;

export const TEST_SLACK_INTEGRATION = gql`
  mutation TestSlackIntegration($tenantId: ID!, $config: SlackIntegrationConfigInput!) {
    testSlackIntegration(tenantId: $tenantId, config: $config) {
      ...IntegrationTestResultFragment
    }
  }
  ${INTEGRATION_TEST_RESULT_FRAGMENT}
`;

export const DISABLE_SLACK_INTEGRATION = gql`
  mutation DisableSlackIntegration($tenantId: ID!, $updatedBy: String!) {
    disableSlackIntegration(tenantId: $tenantId, updatedBy: $updatedBy)
  }
`;

export const SEND_SLACK_MESSAGE_TO_CHANNEL = gql`
  mutation SendSlackMessageToChannel($tenantId: ID!, $channel: String!, $message: String!, $options: NotificationOptionsInput) {
    sendSlackMessageToChannel(tenantId: $tenantId, channel: $channel, message: $message, options: $options) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

// Teams mutations
export const SEND_TEAMS_MESSAGE = gql`
  mutation SendTeamsMessage($tenantId: ID!, $message: TeamsMessageInput!, $options: NotificationOptionsInput) {
    sendTeamsMessage(tenantId: $tenantId, message: $message, options: $options) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const SEND_TEAMS_NOTIFICATION = gql`
  mutation SendTeamsNotification($tenantId: ID!, $notification: TeamsNotificationInput!) {
    sendTeamsNotification(tenantId: $tenantId, notification: $notification) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const SEND_TEAMS_ALERT = gql`
  mutation SendTeamsAlert($tenantId: ID!, $alert: TeamsAlertInput!) {
    sendTeamsAlert(tenantId: $tenantId, alert: $alert) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const SEND_TEAMS_RICH_CARD = gql`
  mutation SendTeamsRichCard($tenantId: ID!, $card: TeamsRichCardInput!) {
    sendTeamsRichCard(tenantId: $tenantId, card: $card) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

export const CONFIGURE_TEAMS_INTEGRATION = gql`
  mutation ConfigureTeamsIntegration($tenantId: ID!, $config: TeamsIntegrationConfigInput!, $updatedBy: String!) {
    configureTeamsIntegration(tenantId: $tenantId, config: $config, updatedBy: $updatedBy)
  }
`;

export const TEST_TEAMS_INTEGRATION = gql`
  mutation TestTeamsIntegration($tenantId: ID!, $config: TeamsIntegrationConfigInput!) {
    testTeamsIntegration(tenantId: $tenantId, config: $config) {
      ...IntegrationTestResultFragment
    }
  }
  ${INTEGRATION_TEST_RESULT_FRAGMENT}
`;

export const DISABLE_TEAMS_INTEGRATION = gql`
  mutation DisableTeamsIntegration($tenantId: ID!, $updatedBy: String!) {
    disableTeamsIntegration(tenantId: $tenantId, updatedBy: $updatedBy)
  }
`;

export const SEND_TEAMS_SIMPLE_MESSAGE = gql`
  mutation SendTeamsSimpleMessage($tenantId: ID!, $message: String!, $options: NotificationOptionsInput) {
    sendTeamsSimpleMessage(tenantId: $tenantId, message: $message, options: $options) {
      ...CommunicationResultFragment
    }
  }
  ${COMMUNICATION_RESULT_FRAGMENT}
`;

// Batch mutations for efficiency
export const SEND_MULTI_CHANNEL_NOTIFICATIONS_BATCH = gql`
  mutation SendMultiChannelNotificationsBatch($tenantId: ID!, $notifications: [MultiChannelNotificationInput!]!) {
    sendMultiChannelNotificationsBatch(tenantId: $tenantId, notifications: $notifications) {
      results {
        ...BulkCommunicationResultFragment
      }
      totalNotifications
      successfulNotifications
      failedNotifications
    }
  }
  ${BULK_COMMUNICATION_RESULT_FRAGMENT}
`;

export const CREATE_EMAIL_TEMPLATES_BATCH = gql`
  mutation CreateEmailTemplatesBatch($tenantId: ID!, $templates: [EmailTemplateInput!]!, $createdBy: String!) {
    createEmailTemplatesBatch(tenantId: $tenantId, templates: $templates, createdBy: $createdBy) {
      totalTemplates
      successfulTemplates
      failedTemplates
      results {
        templateName
        success
        error
      }
    }
  }
`;

export const CREATE_SMS_TEMPLATES_BATCH = gql`
  mutation CreateSMSTemplatesBatch($tenantId: ID!, $templates: [SMSTemplateInput!]!, $createdBy: String!) {
    createSMSTemplatesBatch(tenantId: $tenantId, templates: $templates, createdBy: $createdBy) {
      totalTemplates
      successfulTemplates
      failedTemplates
      results {
        templateName
        success
        error
      }
    }
  }
`;

// Optimistic mutation variants (for better UX)
export const ENABLE_COMMUNICATION_CHANNEL_OPTIMISTIC = gql`
  mutation EnableCommunicationChannelOptimistic($tenantId: ID!, $channelType: CommunicationChannelType!, $updatedBy: String!) {
    enableCommunicationChannel(tenantId: $tenantId, channelType: $channelType, updatedBy: $updatedBy)
  }
`;

export const DISABLE_COMMUNICATION_CHANNEL_OPTIMISTIC = gql`
  mutation DisableCommunicationChannelOptimistic($tenantId: ID!, $channelType: CommunicationChannelType!, $updatedBy: String!) {
    disableCommunicationChannel(tenantId: $tenantId, channelType: $channelType, updatedBy: $updatedBy)
  }
`;

// Template management with optimistic updates
export const CREATE_EMAIL_TEMPLATE_OPTIMISTIC = gql`
  mutation CreateEmailTemplateOptimistic($tenantId: ID!, $template: EmailTemplateInput!, $createdBy: String!) {
    createEmailTemplate(tenantId: $tenantId, template: $template, createdBy: $createdBy)
  }
`;

export const DELETE_EMAIL_TEMPLATE_OPTIMISTIC = gql`
  mutation DeleteEmailTemplateOptimistic($tenantId: ID!, $templateName: String!, $deletedBy: String!) {
    deleteEmailTemplate(tenantId: $tenantId, templateName: $templateName, deletedBy: $deletedBy)
  }
`;

export const CREATE_SMS_TEMPLATE_OPTIMISTIC = gql`
  mutation CreateSMSTemplateOptimistic($tenantId: ID!, $template: SMSTemplateInput!, $createdBy: String!) {
    createSMSTemplate(tenantId: $tenantId, template: $template, createdBy: $createdBy)
  }
`;

export const DELETE_SMS_TEMPLATE_OPTIMISTIC = gql`
  mutation DeleteSMSTemplateOptimistic($tenantId: ID!, $templateName: String!, $deletedBy: String!) {
    deleteSMSTemplate(tenantId: $tenantId, templateName: $templateName, deletedBy: $deletedBy)
  }
`;