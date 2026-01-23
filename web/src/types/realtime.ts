/**
 * Real-time Module Types
 * Generated from GraphQL schema and enhanced with additional types
 */

// ===== ENUMS =====

export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
}

export enum MessagePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
}

export enum CommunicationChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  TEAMS = 'teams',
  PUSH = 'push',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// ===== CORE TYPES =====

export interface OnlineUser {
  userId: string;
  email: string;
  displayName?: string;
  status: UserStatus;
  connectedAt: Date;
  lastActivity: Date;
  rooms: string[];
}

export interface RealtimeMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  content: string;
  priority: MessagePriority;
  timestamp: Date;
  metadata?: string;
}

export interface BroadcastResult {
  success: boolean;
  recipientCount: number;
  message: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  type: string;
  channel: string;
  subject?: string;
  message: string;
  status: NotificationStatus;
  priority?: NotificationPriority;
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  deliveryAttempts: number;
  failureReason?: string;
  metadata?: string;
  createdAt: Date;
}

export interface NotificationConnection {
  nodes: Notification[];
  totalCount: number;
  hasMore: boolean;
}

// ===== LIVE DATA TYPES =====

export interface LiveInventoryLevel {
  productId: string;
  variantId?: string;
  locationId: string;
  currentLevel: number;
  availableLevel: number;
  reservedLevel: number;
  reorderPoint: number;
  lastUpdated: Date;
  status: string;
}

export interface SalesDashboardOverview {
  totalSales: number;
  transactionCount: number;
  averageTransactionValue: number;
  hourlyBreakdown: HourlyBreakdown[];
}

export interface HourlyBreakdown {
  hour: number;
  sales: number;
  transactions: number;
}

export interface CustomerActivity {
  type: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  locationId?: string;
  timestamp: Date;
  details: string;
}

export interface AnalyticsOverview {
  totalRevenue: number;
  totalTransactions: number;
  totalCustomers: number;
  totalProducts: number;
  averageOrderValue: number;
  conversionRate: number;
  timestamp: Date;
}

export interface KPIMetric {
  name: string;
  value: number;
  unit: string;
  change: number;
  changeDirection: string;
  target?: number;
  status: string;
  timestamp: Date;
}

// ===== COMMUNICATION TYPES =====

export interface CommunicationResult {
  success: boolean;
  message: string;
  jobId?: string;
  recipientCount?: number;
}

export interface CommunicationHistoryItem {
  id: string;
  type: string;
  channel: string;
  recipient?: string;
  subject?: string;
  message: string;
  status: string;
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
}

export interface CommunicationHistory {
  items: CommunicationHistoryItem[];
  totalCount: number;
  hasMore: boolean;
}

// ===== INPUT TYPES =====

export interface UpdateUserStatusInput {
  status: UserStatus;
  customMessage?: string;
}

export interface SendMessageInput {
  recipientIds: string[];
  content: string;
  priority?: MessagePriority;
  metadata?: string;
}

export interface BroadcastMessageInput {
  content: string;
  priority?: MessagePriority;
  targetRoom?: string;
  metadata?: string;
}

export interface DirectMessageInput {
  recipientId: string;
  content: string;
  priority?: MessagePriority;
  metadata?: string;
}

export interface GetOnlineUsersInput {
  limit?: number;
  offset?: number;
  status?: UserStatus;
  roomName?: string;
}

export interface GetNotificationsInput {
  limit?: number;
  offset?: number;
  type?: string;
  status?: NotificationStatus;
  unreadOnly?: boolean;
}

export interface MarkNotificationReadInput {
  notificationId: string;
}

export interface DeleteNotificationInput {
  notificationId: string;
}

export interface InventorySubscriptionInput {
  productIds: string[];
  locationId?: string;
}

export interface SalesSubscriptionInput {
  locationId?: string;
}

export interface CustomerActivitySubscriptionInput {
  customerId?: string;
}

export interface AnalyticsSubscriptionInput {
  locationId?: string;
}

export interface InventoryAlertConfigInput {
  productIds: string[];
  locationId?: string;
  threshold: number;
  alertType: string;
  enabled: boolean;
}

export interface SalesTargetInput {
  locationId?: string;
  dailyTarget: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  enableAlerts: boolean;
}

export interface CreateAnalyticsAlertInput {
  type: string;
  severity: string;
  title: string;
  message: string;
  data?: string;
  locationId?: string;
  threshold?: ThresholdInput;
}

export interface ThresholdInput {
  metric: string;
  value: number;
  operator: string;
}

// ===== COMMUNICATION INPUT TYPES =====

export interface SendEmailInput {
  to: string[];
  subject: string;
  message: string;
  htmlContent?: string;
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface SendSMSInput {
  to: string[];
  message: string;
  from?: string;
}

export interface SendPushNotificationInput {
  userIds: string[];
  title: string;
  message: string;
  data?: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface RecipientsInput {
  userIds?: string[];
  emails?: string[];
  phoneNumbers?: string[];
  slackChannels?: string[];
  teamsChannels?: string[];
}

export interface SendMultiChannelNotificationInput {
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: string;
  channels: string[];
  recipients?: RecipientsInput;
  metadata?: string;
  templateName?: string;
  templateVariables?: string;
  scheduledAt?: Date;
}

export interface SendAlertInput {
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata?: string;
  actionUrl?: string;
  actionLabel?: string;
  recipients?: RecipientsInput;
}

export interface GetCommunicationHistoryInput {
  limit?: number;
  offset?: number;
  type?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

// ===== RESPONSE TYPES =====

export interface MarkNotificationReadResponse {
  success: boolean;
  message: string;
  notification?: Notification;
}

export interface DeleteNotificationResponse {
  success: boolean;
  message: string;
}

// ===== SUBSCRIPTION EVENT TYPES =====

export interface UserStatusChangedEvent {
  userStatusChanged: OnlineUser;
}

export interface UserOnlineEvent {
  userOnline: OnlineUser;
}

export interface UserOfflineEvent {
  userOffline: OnlineUser;
}

export interface MessageReceivedEvent {
  messageReceived: RealtimeMessage;
}

export interface NotificationReceivedEvent {
  notificationReceived: Notification;
}

export interface InventoryUpdatedEvent {
  inventoryUpdated: string; // JSON string
}

export interface SalesUpdatedEvent {
  salesUpdated: string; // JSON string
}

export interface CustomerActivityUpdatedEvent {
  customerActivityUpdated: string; // JSON string
}

export interface AnalyticsUpdatedEvent {
  analyticsUpdated: string; // JSON string
}

export interface AlertTriggeredEvent {
  alertTriggered: string; // JSON string
}

// ===== WEBSOCKET EVENT TYPES =====

export interface WebSocketConnectionEvent {
  message: string;
  userId: string;
  tenantId: string;
  connectedAt: Date;
}

export interface WebSocketSubscriptionEvent {
  type: string;
  room: string;
  subscribedAt: Date;
  locationId?: string;
  productIds?: string[];
  customerId?: string;
}

export interface WebSocketHealthStatus {
  status: string;
  connectedAt: Date;
  lastActivity: Date;
  rooms: string[];
  serverTime: Date;
}

// ===== UTILITY TYPES =====

export type RealtimeEventType = 
  | 'user_status_changed'
  | 'user_online'
  | 'user_offline'
  | 'message_received'
  | 'notification_received'
  | 'inventory_updated'
  | 'sales_updated'
  | 'customer_activity_updated'
  | 'analytics_updated'
  | 'alert_triggered'
  | 'crm_customer_updated'
  | 'crm_campaign_updated'
  | 'crm_loyalty_updated'
  | 'crm_communication_updated';

export type WebSocketEventType =
  | 'connected'
  | 'auth_error'
  | 'subscription_success'
  | 'subscription_error'
  | 'unsubscribe_success'
  | 'unsubscribe_error'
  | 'health_status'
  | 'error'
  | 'inventory_updated'
  | 'transaction_created'
  | 'customer_activity'
  | 'notification';

export interface RealtimeConfig {
  enableWebSocket: boolean;
  enableGraphQLSubscriptions: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  subscriptionTimeout: number;
}

export interface RealtimeState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError?: Error;
  onlineUsers: OnlineUser[];
  unreadNotifications: number;
  activeSubscriptions: string[];
  lastActivity: Date;
}

// CRM Real-time Types
export interface LiveCRMData {
  customers: {
    total: number;
    active: number;
    new_today: number;
    high_value: number;
  };
  campaigns: {
    active: number;
    total_participants: number;
    points_awarded_today: number;
  };
  loyalty: {
    total_points_in_circulation: number;
    points_redeemed_today: number;
    new_members_today: number;
  };
  communications: {
    scheduled_today: number;
    completed_today: number;
    pending: number;
  };
  last_updated: Date;
}

export interface CustomerUpdateEvent {
  type: 'created' | 'updated' | 'deleted';
  customer_id: string;
  customer_data?: any;
  changes?: string[];
  timestamp: Date;
}

export interface CampaignUpdateEvent {
  type: 'created' | 'updated' | 'activated' | 'paused' | 'completed';
  campaign_id: string;
  campaign_data?: any;
  timestamp: Date;
}

export interface LoyaltyUpdateEvent {
  type: 'points_awarded' | 'points_redeemed' | 'tier_changed' | 'reward_created';
  customer_id: string;
  points?: number;
  tier?: string;
  transaction_id?: string;
  timestamp: Date;
}

export interface CommunicationUpdateEvent {
  type: 'scheduled' | 'sent' | 'delivered' | 'failed';
  communication_id: string;
  customer_id: string;
  communication_type: string;
  timestamp: Date;
}

// CRM Subscription Inputs
export interface CRMSubscriptionInput {
  customer_ids?: string[];
  campaign_ids?: string[];
  communication_types?: string[];
  include_analytics?: boolean;
}

export interface CustomerUpdatesSubscriptionInput {
  customer_ids?: string[];
  event_types?: ('created' | 'updated' | 'deleted')[];
}

export interface CampaignUpdatesSubscriptionInput {
  campaign_ids?: string[];
  event_types?: ('created' | 'updated' | 'activated' | 'paused' | 'completed')[];
}

export interface LoyaltyUpdatesSubscriptionInput {
  customer_ids?: string[];
  event_types?: ('points_awarded' | 'points_redeemed' | 'tier_changed' | 'reward_created')[];
}

export interface CommunicationUpdatesSubscriptionInput {
  customer_ids?: string[];
  communication_types?: string[];
  event_types?: ('scheduled' | 'sent' | 'delivered' | 'failed')[];
}

// CRM Real-time Event Types
export interface CRMCustomerUpdatedEvent {
  crmCustomerUpdated: string; // JSON string
}

export interface CRMCampaignUpdatedEvent {
  crmCampaignUpdated: string; // JSON string
}

export interface CRMLoyaltyUpdatedEvent {
  crmLoyaltyUpdated: string; // JSON string
}

export interface CRMCommunicationUpdatedEvent {
  crmCommunicationUpdated: string; // JSON string
}