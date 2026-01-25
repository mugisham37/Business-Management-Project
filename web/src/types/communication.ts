/**
 * Communication Module Types
 * Complete type definitions for all communication functionality
 */

// Enums
export enum CommunicationChannelType {
  SLACK = 'slack',
  TEAMS = 'teams',
  EMAIL = 'email',
  SMS = 'sms',
  WEBHOOK = 'webhook',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum EmailProviderType {
  SENDGRID = 'sendgrid',
  SES = 'ses',
  SMTP = 'smtp',
  MAILGUN = 'mailgun',
  POSTMARK = 'postmark',
}

export enum SMSProviderType {
  TWILIO = 'twilio',
  AWS_SNS = 'aws-sns',
  NEXMO = 'nexmo',
  MESSAGEBIRD = 'messagebird',
  PLIVO = 'plivo',
}

export enum ActionStyle {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  DANGER = 'danger',
}

export enum CommunicationEventType {
  MESSAGE_SENT = 'communication.message.sent',
  MESSAGE_FAILED = 'communication.message.failed',
  ALERT_SENT = 'communication.alert.sent',
  NOTIFICATION_SENT = 'communication.notification.sent',
  CHANNEL_CONFIGURED = 'communication.channel.configured',
  TEMPLATE_CREATED = 'communication.template.created',
  PROVIDER_CONFIGURED = 'communication.provider.configured',
}

// Base Types
export interface CommunicationChannel {
  type: CommunicationChannelType;
  enabled: boolean;
  configuration?: Record<string, unknown>;
  priority?: number;
  fallbackChannels?: string[];
}

export interface CommunicationResult {
  channel: string;
  success: boolean;
  messageId?: string;
  error?: string;
  recipientCount?: number;
}

export interface BulkCommunicationResult {
  totalChannels: number;
  successfulChannels: number;
  failedChannels: number;
  results: CommunicationResult[];
  overallSuccess: boolean;
}

export interface NotificationAction {
  id: string;
  label: string;
  url?: string;
  style?: ActionStyle;
}

export interface NotificationRecipients {
  userIds?: string[];
  emails?: string[];
  phoneNumbers?: string[];
  slackChannels?: string[];
  teamsChannels?: string[];
  roles?: string[];
}

export interface NotificationOptions {
  enableFallback?: boolean;
  retryAttempts?: number;
  batchSize?: number;
  delayBetweenBatches?: number;
  timeout?: number;
}

export interface MultiChannelNotification {
  title: string;
  message: string;
  priority: NotificationPriority;
  type: string;
  channels: CommunicationChannelType[];
  recipients?: NotificationRecipients;
  metadata?: Record<string, unknown>;
  actions?: NotificationAction[];
  templateName?: string;
  templateVariables?: Record<string, unknown>;
  scheduledAt?: Date;
  options?: NotificationOptions;
}

export interface Alert {
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  actionLabel?: string;
  recipients?: NotificationRecipients;
}

export interface BusinessNotification {
  type: string;
  title: string;
  message: string;
  priority?: NotificationPriority;
  recipients?: NotificationRecipients;
  metadata?: Record<string, unknown>;
  templateName?: string;
  templateVariables?: Record<string, unknown>;
}

// Email Types
export interface EmailAttachment {
  filename: string;
  contentType?: string;
  cid?: string;
  content?: string | Buffer | Uint8Array;
}

export interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  priority?: NotificationPriority;
  headers?: Record<string, string>;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  variables: string[];
  category?: string;
}

export interface EmailProvider {
  type: EmailProviderType;
  configuration: Record<string, unknown>;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailNotification {
  subject: string;
  message: string;
  htmlContent?: string;
  priority?: NotificationPriority;
  templateName?: string;
  templateVariables?: Record<string, unknown>;
  attachments?: EmailAttachment[];
}

export interface BulkEmailResult {
  totalSent: number;
  totalFailed: number;
  results: EmailSendResult[];
}

export interface EmailSendResult {
  userId: string;
  success: boolean;
  error?: string;
  messageId?: string;
}

// SMS Types
export interface SMSMessage {
  to: string[];
  message: string;
  from?: string;
  mediaUrls?: string[];
  scheduledAt?: Date;
  validityPeriod?: number;
  priority?: NotificationPriority;
}

export interface SMSTemplate {
  name: string;
  message: string;
  variables: string[];
  category?: string;
  maxLength?: number;
}

export interface SMSProvider {
  type: SMSProviderType;
  configuration: Record<string, unknown>;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SMSNotification {
  message: string;
  priority?: NotificationPriority;
  templateName?: string;
  templateVariables?: Record<string, unknown>;
  scheduledAt?: Date;
}

export interface BulkSMSResult {
  totalSent: number;
  totalFailed: number;
  results: SMSSendResult[];
}

export interface SMSSendResult {
  userId: string;
  success: boolean;
  error?: string;
  messageId?: string;
}

export interface OTPMessage {
  phoneNumber: string;
  otp: string;
  validityMinutes?: number;
  brandName?: string;
}

// Slack Types
export interface SlackField {
  title: string;
  value: string;
  short?: boolean;
}

export interface SlackAttachment {
  color?: string;
  pretext?: string;
  title?: string;
  text?: string;
  fields?: SlackField[];
  imageUrl?: string;
  thumbUrl?: string;
  footer?: string;
  timestamp?: number;
}

export interface SlackMessage {
  channel: string;
  text: string;
  username?: string;
  iconEmoji?: string;
  iconUrl?: string;
  attachments?: SlackAttachment[];
  threadTs?: string;
}

export interface SlackNotification {
  title: string;
  message: string;
  priority: NotificationPriority;
  type: string;
  channel?: string;
  metadata?: Record<string, unknown>;
  actions?: NotificationAction[];
}

export interface SlackAlert {
  title: string;
  message: string;
  severity: AlertSeverity;
  channel?: string;
  mentionUsers?: string[];
  mentionChannel?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SlackIntegrationConfig {
  webhookUrl: string;
  botToken?: string;
  defaultChannel?: string;
  username?: string;
  iconEmoji?: string;
  iconUrl?: string;
  enableThreads?: boolean;
  enableMentions?: boolean;
  mentionUsers?: string[];
  mentionChannels?: string[];
}

// Teams Types
export interface TeamsFact {
  name: string;
  value: string;
}

export interface TeamsSection {
  activityTitle?: string;
  activitySubtitle?: string;
  activityImage?: string;
  facts?: TeamsFact[];
  markdown?: boolean;
  text?: string;
}

export interface TeamsMessage {
  text?: string;
  summary?: string;
  themeColor?: string;
  sections?: TeamsSection[];
}

export interface TeamsNotification {
  title: string;
  message: string;
  priority: NotificationPriority;
  type: string;
  metadata?: Record<string, unknown>;
  actions?: NotificationAction[];
}

export interface TeamsAlert {
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  actionLabel?: string;
}

export interface TeamsRichCard {
  title: string;
  subtitle?: string;
  summary?: string;
  themeColor?: string;
  sections: TeamsSection[];
  actions?: NotificationAction[];
}

export interface TeamsIntegrationConfig {
  webhookUrl: string;
  defaultTitle?: string;
  defaultThemeColor?: string;
  enableMentions?: boolean;
  mentionUsers?: string[];
  enableActivityImages?: boolean;
  activityImageUrl?: string;
}

// Test Results
export interface ChannelTestResult {
  channel: string;
  success: boolean;
  error?: string;
  responseTime?: number;
}

export interface IntegrationTestResult {
  success: boolean;
  error?: string;
  messageId?: string;
  responseTime?: number;
}

// Analytics Types
export interface CommunicationStats {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  channelBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  period: string;
  generatedAt: Date;
}

export interface ChannelUsageStats {
  channel: CommunicationChannelType;
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  successRate: number;
  averageResponseTime: number;
  lastUsed?: Date;
}

// Subscription Types
export interface CommunicationEvent {
  id: string;
  type: string;
  channel: CommunicationChannelType;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  tenantId: string;
}

export interface NotificationDeliveryStatus {
  notificationId: string;
  channel: CommunicationChannelType;
  status: string;
  deliveredAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Filter Types
export interface CommunicationStatsFilter {
  startDate?: Date;
  endDate?: Date;
  channels?: CommunicationChannelType[];
  priorities?: NotificationPriority[];
  types?: string[];
}

export interface CommunicationEventFilter {
  channels?: CommunicationChannelType[];
  successOnly?: boolean;
  since?: Date;
}

// Configuration Types
export interface CommunicationChannelConfig {
  type: CommunicationChannelType;
  enabled: boolean;
  configuration?: Record<string, unknown>;
  priority?: number;
  fallbackChannels?: CommunicationChannelType[];
}

export interface EmailProviderConfig {
  type: EmailProviderType;
  configuration: Record<string, unknown>;
}

export interface SMSProviderConfig {
  type: SMSProviderType;
  configuration: Record<string, unknown>;
}

// Provider-specific configurations
export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  templateId?: string;
  enableTracking?: boolean;
  enableClickTracking?: boolean;
  enableOpenTracking?: boolean;
}

export interface SESConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  fromEmail: string;
  fromName?: string;
  configurationSet?: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  fromEmail: string;
  fromName?: string;
}

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName?: string;
  region?: 'us' | 'eu';
}

export interface PostmarkConfig {
  serverToken: string;
  fromEmail: string;
  fromName?: string;
  messageStream?: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
  messagingServiceSid?: string;
}

export interface AWSSNSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  topicArn?: string;
}

// Hook return types
export interface UseCommunicationReturn {
  // Multi-channel operations
  sendMultiChannelNotification: (notification: MultiChannelNotification) => Promise<BulkCommunicationResult>;
  sendAlert: (alert: Alert) => Promise<BulkCommunicationResult>;
  sendBusinessNotification: (notification: BusinessNotification) => Promise<BulkCommunicationResult>;
  
  // Channel management
  getChannels: () => Promise<CommunicationChannel[]>;
  configureChannels: (channels: CommunicationChannelConfig[]) => Promise<void>;
  testChannels: () => Promise<ChannelTestResult[]>;
  enableChannel: (channelType: CommunicationChannelType) => Promise<void>;
  disableChannel: (channelType: CommunicationChannelType) => Promise<void>;
  
  // Analytics
  getStats: (filter?: CommunicationStatsFilter) => Promise<CommunicationStats>;
  getChannelUsageStats: (filter?: CommunicationStatsFilter) => Promise<ChannelUsageStats[]>;
  
  // State
  loading: boolean;
  error: string | null;
  channels: CommunicationChannel[];
  stats: CommunicationStats | null;
}

export interface UseEmailReturn {
  // Email operations
  sendEmail: (message: EmailMessage, options?: NotificationOptions) => Promise<CommunicationResult>;
  sendEmailToUsers: (userIds: string[], notification: EmailNotification, options?: NotificationOptions) => Promise<BulkEmailResult>;
  
  // Template management
  getTemplates: (category?: string) => Promise<EmailTemplate[]>;
  getTemplate: (templateName: string) => Promise<EmailTemplate | null>;
  createTemplate: (template: EmailTemplate) => Promise<void>;
  updateTemplate: (templateName: string, template: EmailTemplate) => Promise<void>;
  deleteTemplate: (templateName: string) => Promise<void>;
  
  // Provider management
  getProviders: () => Promise<EmailProvider[]>;
  configureProvider: (provider: EmailProviderConfig) => Promise<void>;
  testProvider: (provider: EmailProviderConfig) => Promise<CommunicationResult>;
  
  // State
  loading: boolean;
  error: string | null;
  templates: EmailTemplate[];
  providers: EmailProvider[];
}

export interface UseSMSReturn {
  // SMS operations
  sendSMS: (message: SMSMessage, options?: NotificationOptions) => Promise<CommunicationResult>;
  sendSMSToUsers: (userIds: string[], notification: SMSNotification, options?: NotificationOptions) => Promise<BulkSMSResult>;
  sendOTP: (otp: OTPMessage, options?: NotificationOptions) => Promise<CommunicationResult>;
  sendSMSAlert: (phoneNumbers: string[], alert: Alert, options?: NotificationOptions) => Promise<CommunicationResult>;
  
  // Template management
  getTemplates: (category?: string) => Promise<SMSTemplate[]>;
  getTemplate: (templateName: string) => Promise<SMSTemplate | null>;
  createTemplate: (template: SMSTemplate) => Promise<void>;
  updateTemplate: (templateName: string, template: SMSTemplate) => Promise<void>;
  deleteTemplate: (templateName: string) => Promise<void>;
  
  // Provider management
  getProviders: () => Promise<SMSProvider[]>;
  configureProvider: (provider: SMSProviderConfig) => Promise<void>;
  testProvider: (provider: SMSProviderConfig) => Promise<CommunicationResult>;
  
  // State
  loading: boolean;
  error: string | null;
  templates: SMSTemplate[];
  providers: SMSProvider[];
}

export interface UseSlackReturn {
  // Slack operations
  sendMessage: (message: SlackMessage, options?: NotificationOptions) => Promise<CommunicationResult>;
  sendNotification: (notification: SlackNotification) => Promise<CommunicationResult>;
  sendAlert: (alert: SlackAlert) => Promise<CommunicationResult>;
  sendMessageToChannel: (channel: string, message: string, options?: NotificationOptions) => Promise<CommunicationResult>;
  
  // Configuration
  getConfiguration: () => Promise<SlackIntegrationConfig | null>;
  configureIntegration: (config: SlackIntegrationConfig) => Promise<void>;
  testIntegration: (config: SlackIntegrationConfig) => Promise<IntegrationTestResult>;
  disableIntegration: () => Promise<void>;
  checkIfConfigured: () => Promise<boolean>;
  
  // State
  loading: boolean;
  error: string | null;
  configuration: SlackIntegrationConfig | null;
  isConfigured: boolean;
}

export interface UseTeamsReturn {
  // Teams operations
  sendMessage: (message: TeamsMessage, options?: NotificationOptions) => Promise<CommunicationResult>;
  sendNotification: (notification: TeamsNotification) => Promise<CommunicationResult>;
  sendAlert: (alert: TeamsAlert) => Promise<CommunicationResult>;
  sendRichCard: (card: TeamsRichCard) => Promise<CommunicationResult>;
  sendSimpleMessage: (message: string, options?: NotificationOptions) => Promise<CommunicationResult>;
  
  // Configuration
  getConfiguration: () => Promise<TeamsIntegrationConfig | null>;
  configureIntegration: (config: TeamsIntegrationConfig) => Promise<void>;
  testIntegration: (config: TeamsIntegrationConfig) => Promise<IntegrationTestResult>;
  disableIntegration: () => Promise<void>;
  checkIfConfigured: () => Promise<boolean>;
  
  // State
  loading: boolean;
  error: string | null;
  configuration: TeamsIntegrationConfig | null;
  isConfigured: boolean;
}

export interface UseNotificationsReturn {
  // Real-time subscriptions
  subscribeToEvents: (filter?: CommunicationEventFilter) => () => void;
  subscribeToAlerts: (severity?: AlertSeverity) => () => void;
  subscribeToBusinessNotifications: (notificationType?: string) => () => void;
  subscribeToDeliveryStatus: (notificationId: string) => () => void;
  subscribeToChannelEvents: (channel: 'email' | 'sms' | 'slack' | 'teams', options?: Record<string, unknown>) => () => void;
  
  // Event handling
  onEvent: (callback: (event: CommunicationEvent) => void) => () => void;
  onAlert: (callback: (event: CommunicationEvent) => void) => () => void;
  onDeliveryStatus: (callback: (status: NotificationDeliveryStatus) => void) => () => void;
  
  // State
  events: CommunicationEvent[];
  alerts: CommunicationEvent[];
  deliveryStatuses: NotificationDeliveryStatus[];
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  
  // Utility methods
  clearEvents: () => void;
  clearAlerts: () => void;
  clearDeliveryStatuses: () => void;
  getEventsByChannel: (channel: string) => CommunicationEvent[];
  getEventsByType: (type: string) => CommunicationEvent[];
  getRecentEvents: (count?: number) => CommunicationEvent[];
  getRecentAlerts: (count?: number) => CommunicationEvent[];
  getFailedEvents: () => CommunicationEvent[];
  getSuccessfulEvents: () => CommunicationEvent[];
}

// Utility Types
export type CommunicationHookOptions = {
  tenantId?: string;
  userId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableRealtime?: boolean;
};

export type CommunicationError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
};

// Constants
export const COMMUNICATION_CHANNELS = {
  EMAIL: CommunicationChannelType.EMAIL,
  SMS: CommunicationChannelType.SMS,
  SLACK: CommunicationChannelType.SLACK,
  TEAMS: CommunicationChannelType.TEAMS,
  WEBHOOK: CommunicationChannelType.WEBHOOK,
} as const;

export const NOTIFICATION_PRIORITIES = {
  LOW: NotificationPriority.LOW,
  MEDIUM: NotificationPriority.MEDIUM,
  HIGH: NotificationPriority.HIGH,
  URGENT: NotificationPriority.URGENT,
} as const;

export const ALERT_SEVERITIES = {
  INFO: AlertSeverity.INFO,
  WARNING: AlertSeverity.WARNING,
  ERROR: AlertSeverity.ERROR,
  CRITICAL: AlertSeverity.CRITICAL,
} as const;

export const COMMUNICATION_EVENTS = {
  MESSAGE_SENT: CommunicationEventType.MESSAGE_SENT,
  MESSAGE_FAILED: CommunicationEventType.MESSAGE_FAILED,
  ALERT_SENT: CommunicationEventType.ALERT_SENT,
  NOTIFICATION_SENT: CommunicationEventType.NOTIFICATION_SENT,
  CHANNEL_CONFIGURED: CommunicationEventType.CHANNEL_CONFIGURED,
  TEMPLATE_CREATED: CommunicationEventType.TEMPLATE_CREATED,
  PROVIDER_CONFIGURED: CommunicationEventType.PROVIDER_CONFIGURED,
} as const;
