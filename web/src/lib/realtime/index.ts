/**
 * Real-time Library Index
 * Exports all real-time related utilities and managers
 */

// WebSocket Manager
export {
  WebSocketManager,
  webSocketManager,
  type WebSocketConfig,
  type WebSocketMessage,
  type WebSocketConnectionState,
} from './websocket-manager';

// Re-export subscription utilities for convenience
export {
  subscriptionManager,
  type ConnectionStatus,
  type SubscriptionOptions,
  type SubscriptionResult,
} from '@/lib/subscriptions/subscription-manager';

// Re-export hooks for convenience
export {
  useSubscription,
  useSubscriptionStatus,
  useTenantSubscription,
  useMultipleSubscriptions,
  useResilientSubscription,
} from '@/lib/subscriptions/hooks';

// Real-time specific hooks
export {
  useRealtime,
  useUserPresence,
  useNotifications,
  useCommunication,
} from '@/hooks/useRealtime';

export {
  useLiveInventory,
  useLiveSales,
  useLiveCustomerActivity,
  useLiveAnalytics,
  useLiveData,
} from '@/hooks/useLiveData';

// Types
export type {
  OnlineUser,
  RealtimeMessage,
  BroadcastResult,
  Notification,
  NotificationConnection,
  LiveInventoryLevel,
  SalesDashboardOverview,
  CustomerActivity,
  AnalyticsOverview,
  KPIMetric,
  CommunicationHistory,
  CommunicationHistoryItem,
  CommunicationResult,
  UserStatus,
  MessagePriority,
  NotificationStatus,
  NotificationPriority,
  NotificationType,
  CommunicationChannelType,
  AlertSeverity,
  RealtimeState,
  RealtimeConfig,
} from '@/types/realtime';