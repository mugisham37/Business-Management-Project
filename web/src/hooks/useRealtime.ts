/**
 * Real-time Hooks
 * Comprehensive React hooks for real-time functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useSubscriptionStatus } from '@/lib/subscriptions';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useAuth } from './useAuth';
import {
  UpdateUserStatusInput,
  SendMessageInput,
  BroadcastMessageInput,
  DirectMessageInput,
  InventorySubscriptionInput,
  SendEmailInput,
  SendSMSInput,
  SendPushNotificationInput,
  SendMultiChannelNotificationInput,
  SendAlertInput,
  RealtimeState,
  WebSocketConnectionEvent,
  WebSocketSubscriptionEvent,
  WebSocketHealthStatus,
} from '@/types/realtime';

// Import GraphQL operations (these would be generated from the .graphql files)
import {
  GET_ONLINE_USERS,
  GET_CONNECTION_STATS,
  GET_CONNECTION_HEALTH,
  GET_NOTIFICATIONS,
  GET_COMMUNICATION_HISTORY,
} from '@/graphql/queries/realtime-queries';

import {
  UPDATE_USER_STATUS,
  SEND_DIRECT_MESSAGE,
  SEND_REALTIME_MESSAGE,
  BROADCAST_MESSAGE,
  MARK_NOTIFICATION_READ,
  MARK_ALL_NOTIFICATIONS_READ,
  DELETE_NOTIFICATION,
  SEND_EMAIL,
  SEND_SMS,
  SEND_PUSH_NOTIFICATION,
  SEND_MULTI_CHANNEL_NOTIFICATION,
  SEND_ALERT,
} from '@/graphql/mutations/realtime-mutations';

import {
  USER_STATUS_CHANGED,
  USER_ONLINE,
  USER_OFFLINE,
  MESSAGE_RECEIVED,
  NOTIFICATION_RECEIVED,
  INVENTORY_UPDATED,
  LOW_STOCK_ALERT,
  SALES_UPDATED,
  CUSTOMER_ACTIVITY_UPDATED,
  ANALYTICS_UPDATED,
  ALERT_TRIGGERED,
} from '@/graphql/subscriptions/realtime-notifications';

/**
 * Main Real-time Hook
 * Provides comprehensive real-time functionality
 */
export function useRealtime() {
  const { user } = useAuth();
  const currentTenant = useTenantStore(state => state.currentTenant);
  const { status: connectionStatus, isConnected, reconnect } = useSubscriptionStatus();
  
  const [realtimeState, setRealtimeState] = useState<RealtimeState>({
    isConnected: false,
    isConnecting: false,
    onlineUsers: [],
    unreadNotifications: 0,
    activeSubscriptions: [],
    lastActivity: new Date(),
  });

  // WebSocket connection management
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update realtime state based on subscription status
  useEffect(() => {
    setRealtimeState(prev => ({
      ...prev,
      isConnected: isConnected,
      isConnecting: connectionStatus === 'connecting' || connectionStatus === 'reconnecting',
      connectionError: connectionStatus === 'error' ? new Error('Connection failed') : undefined,
    }));
  }, [isConnected, connectionStatus]);

  // WebSocket connection for real-time events
  const connectWebSocket = useCallback(() => {
    if (!user || !currentTenant?.id) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'}/realtime`;
    const token = localStorage.getItem('accessToken');

    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        
        // Send authentication
        wsRef.current?.send(JSON.stringify({
          type: 'auth',
          token,
          tenantId: currentTenant.id,
        }));

        setRealtimeState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          connectionError: undefined,
        }));

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setRealtimeState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnection
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, 5000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setRealtimeState(prev => ({
          ...prev,
          connectionError: new Error('WebSocket connection failed'),
        }));
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setRealtimeState(prev => ({
        ...prev,
        connectionError: error as Error,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentTenant?.id]);
  const handleWebSocketMessage = useCallback((data: Record<string, unknown>) => {
    switch (data.type) {
      case 'connected':
        const connectionEvent = data as unknown as WebSocketConnectionEvent;
        console.log('WebSocket authenticated:', connectionEvent);
        break;

      case 'subscription_success':
        const subscriptionEvent = data as unknown as WebSocketSubscriptionEvent;
        setRealtimeState(prev => ({
          ...prev,
          activeSubscriptions: [...prev.activeSubscriptions, subscriptionEvent.room],
        }));
        break;

      case 'health_status':
        const healthStatus = data as unknown as WebSocketHealthStatus;
        setRealtimeState(prev => ({
          ...prev,
          lastActivity: new Date(healthStatus.serverTime),
        }));
        break;

      case 'user_connected':
      case 'user_disconnected':
        // Handle user presence updates
        break;

      case 'inventory_updated':
      case 'transaction_created':
      case 'customer_activity':
      case 'notification':
        // These are handled by GraphQL subscriptions
        break;

      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }, []);

  // Connect WebSocket on mount
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [connectWebSocket]);

  // WebSocket subscription methods
  const subscribeToInventory = useCallback((input: InventorySubscriptionInput) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_inventory',
        ...input,
      }));
    }
  }, []);

  const subscribeToTransactions = useCallback((locationId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_transactions',
        locationId,
      }));
    }
  }, []);

  const subscribeToCustomerActivity = useCallback((customerId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_customer_activity',
        customerId,
      }));
    }
  }, []);

  const unsubscribe = useCallback((room: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        room,
      }));
    }
  }, []);

  const sendHealthCheck = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'health_check',
      }));
    }
  }, []);

  return {
    // State
    ...realtimeState,
    connectionStatus,
    
    // WebSocket methods
    subscribeToInventory,
    subscribeToTransactions,
    subscribeToCustomerActivity,
    unsubscribe,
    sendHealthCheck,
    reconnect: () => {
      reconnect();
      connectWebSocket();
    },
  };
}

/**
 * User Presence Hook
 * Manages user online status and presence
 */
export function useUserPresence() {
  const currentTenant = useTenantStore(state => state.currentTenant);

  // Queries
  const { data: onlineUsersData, loading: onlineUsersLoading, refetch: refetchOnlineUsers } = useQuery(
    GET_ONLINE_USERS,
    {
      variables: { input: { limit: 100 } },
      skip: !currentTenant?.id,
      pollInterval: 30000, // Poll every 30 seconds
    }
  );

  const { data: connectionStatsData } = useQuery(GET_CONNECTION_STATS, {
    skip: !currentTenant?.id,
    pollInterval: 60000, // Poll every minute
  });

  const { data: connectionHealthData } = useQuery(GET_CONNECTION_HEALTH, {
    skip: !currentTenant?.id,
    pollInterval: 30000,
  });

  // Mutations
  const [updateUserStatusMutation] = useMutation(UPDATE_USER_STATUS);
  const [sendDirectMessageMutation] = useMutation(SEND_DIRECT_MESSAGE);
  const [sendRealtimeMessageMutation] = useMutation(SEND_REALTIME_MESSAGE);
  const [broadcastMessageMutation] = useMutation(BROADCAST_MESSAGE);

  // Subscriptions
  const { data: userStatusChangedData } = useSubscription(USER_STATUS_CHANGED);
  const { data: userOnlineData } = useSubscription(USER_ONLINE);
  const { data: userOfflineData } = useSubscription(USER_OFFLINE);
  const { data: messageReceivedData } = useSubscription(MESSAGE_RECEIVED);

  // Methods
  const updateUserStatus = useCallback(async (input: UpdateUserStatusInput) => {
    try {
      const result = await updateUserStatusMutation({ variables: { input } });
      return result.data?.updateUserStatus;
    } catch (error) {
      console.error('Failed to update user status:', error);
      throw error;
    }
  }, [updateUserStatusMutation]);

  const sendDirectMessage = useCallback(async (input: DirectMessageInput) => {
    try {
      const result = await sendDirectMessageMutation({ variables: { input } });
      return result.data?.sendDirectMessage;
    } catch (error) {
      console.error('Failed to send direct message:', error);
      throw error;
    }
  }, [sendDirectMessageMutation]);

  const sendMessage = useCallback(async (input: SendMessageInput) => {
    try {
      const result = await sendRealtimeMessageMutation({ variables: { input } });
      return result.data?.sendRealtimeMessage;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, [sendRealtimeMessageMutation]);

  const broadcastMessage = useCallback(async (input: BroadcastMessageInput) => {
    try {
      const result = await broadcastMessageMutation({ variables: { input } });
      return result.data?.broadcastMessage;
    } catch (error) {
      console.error('Failed to broadcast message:', error);
      throw error;
    }
  }, [broadcastMessageMutation]);

  return {
    // Data
    onlineUsers: onlineUsersData?.getOnlineUsers || [],
    connectionStats: connectionStatsData?.getConnectionStats,
    connectionHealth: connectionHealthData?.getConnectionHealth,
    
    // Loading states
    onlineUsersLoading,
    
    // Real-time data
    userStatusChanged: userStatusChangedData,
    userOnline: userOnlineData,
    userOffline: userOfflineData,
    messageReceived: messageReceivedData,
    
    // Methods
    updateUserStatus,
    sendDirectMessage,
    sendMessage,
    broadcastMessage,
    refetchOnlineUsers,
  };
}

/**
 * Notifications Hook
 * Manages notifications and real-time notification updates
 */
export function useNotifications() {
  const { user } = useAuth();
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [unreadCount, setUnreadCount] = useState(0);

  // Queries
  const { data: notificationsData, loading: notificationsLoading, refetch: refetchNotifications } = useQuery(
    GET_NOTIFICATIONS,
    {
      variables: { input: { limit: 50, unreadOnly: false } },
      skip: !user || !currentTenant?.id,
    }
  );

  useQuery(
    GET_NOTIFICATIONS,
    {
      variables: { input: { limit: 1000, unreadOnly: true } },
      skip: !user || !currentTenant?.id,
      onCompleted: (data: { getNotifications?: { totalCount?: number } }) => {
        setUnreadCount(data?.getNotifications?.totalCount || 0);
      },
    }
  );

  // Mutations
  const [markNotificationReadMutation] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllNotificationsReadMutation] = useMutation(MARK_ALL_NOTIFICATIONS_READ);
  const [deleteNotificationMutation] = useMutation(DELETE_NOTIFICATION);

  // Subscriptions
  const { data: notificationReceivedData } = useSubscription(NOTIFICATION_RECEIVED, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onData: (options: any) => {
      // Increment unread count when new notification arrives
      setUnreadCount(prev => prev + 1);
      
      // Optionally show toast notification
      if (options?.data?.notificationReceived) {
        // showToast(options.data.notificationReceived);
      }
    },
  });

  // Methods
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const result = await markNotificationReadMutation({
        variables: { input: { notificationId } },
      });
      
      if (result.data?.markNotificationRead?.success) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        await refetchNotifications();
      }
      
      return result.data?.markNotificationRead;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }, [markNotificationReadMutation, refetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      const result = await markAllNotificationsReadMutation();
      
      if (result.data?.markAllNotificationsRead?.success) {
        setUnreadCount(0);
        await refetchNotifications();
      }
      
      return result.data?.markAllNotificationsRead;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }, [markAllNotificationsReadMutation, refetchNotifications]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const result = await deleteNotificationMutation({
        variables: { input: { notificationId } },
      });
      
      if (result.data?.deleteNotification?.success) {
        await refetchNotifications();
      }
      
      return result.data?.deleteNotification;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      throw error;
    }
  }, [deleteNotificationMutation, refetchNotifications]);

  return {
    // Data
    notifications: notificationsData?.getNotifications?.nodes || [],
    totalCount: notificationsData?.getNotifications?.totalCount || 0,
    hasMore: notificationsData?.getNotifications?.hasMore || false,
    unreadCount,
    
    // Loading states
    notificationsLoading,
    
    // Real-time data
    newNotification: notificationReceivedData,
    
    // Methods
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetchNotifications,
  };
}

/**
 * Live Data Hook
 * Manages live business data (inventory, sales, analytics)
 */
export function useLiveData() {
  // Real-time subscriptions
  const { data: inventoryUpdatedData } = useSubscription(INVENTORY_UPDATED);
  const { data: lowStockAlertData } = useSubscription(LOW_STOCK_ALERT);
  const { data: salesUpdatedData } = useSubscription(SALES_UPDATED);
  const { data: customerActivityUpdatedData } = useSubscription(CUSTOMER_ACTIVITY_UPDATED);
  const { data: analyticsUpdatedData } = useSubscription(ANALYTICS_UPDATED);
  const { data: alertTriggeredData } = useSubscription(ALERT_TRIGGERED);

  // Subscription methods
  const subscribeToInventory = useCallback(async () => {
    try {
      // Subscribe to inventory updates
      return { success: true };
    } catch (error) {
      console.error('Failed to subscribe to inventory updates:', error);
      throw error;
    }
  }, []);

  const subscribeToSales = useCallback(async () => {
    try {
      // Subscribe to sales updates
      return { success: true };
    } catch (error) {
      console.error('Failed to subscribe to sales updates:', error);
      throw error;
    }
  }, []);

  const subscribeToCustomerActivity = useCallback(async () => {
    try {
      // Subscribe to customer activity
      return { success: true };
    } catch (error) {
      console.error('Failed to subscribe to customer activity:', error);
      throw error;
    }
  }, []);

  const subscribeToAnalytics = useCallback(async () => {
    try {
      // Subscribe to analytics updates
      return { success: true };
    } catch (error) {
      console.error('Failed to subscribe to analytics updates:', error);
      throw error;
    }
  }, []);

  return {
    // Real-time data
    inventoryUpdate: inventoryUpdatedData,
    lowStockAlert: lowStockAlertData,
    salesUpdate: salesUpdatedData,
    customerActivityUpdate: customerActivityUpdatedData,
    analyticsUpdate: analyticsUpdatedData,
    alertTriggered: alertTriggeredData,
    
    // Subscription methods
    subscribeToInventory,
    subscribeToSales,
    subscribeToCustomerActivity,
    subscribeToAnalytics,
  };
}

/**
 * Communication Hook
 * Manages multi-channel communication
 */
export function useCommunication() {
  const currentTenant = useTenantStore(state => state.currentTenant);

  // Queries
  const { data: communicationHistoryData, loading: historyLoading, refetch: refetchHistory } = useQuery(
    GET_COMMUNICATION_HISTORY,
    {
      variables: { input: { limit: 50 } },
      skip: !currentTenant?.id,
    }
  );

  // Mutations
  const [sendEmailMutation] = useMutation(SEND_EMAIL);
  const [sendSMSMutation] = useMutation(SEND_SMS);
  const [sendPushNotificationMutation] = useMutation(SEND_PUSH_NOTIFICATION);
  const [sendMultiChannelNotificationMutation] = useMutation(SEND_MULTI_CHANNEL_NOTIFICATION);
  const [sendAlertMutation] = useMutation(SEND_ALERT);

  // Methods
  const sendEmail = useCallback(async (input: SendEmailInput) => {
    try {
      const result = await sendEmailMutation({ variables: { input } });
      await refetchHistory();
      return result.data?.sendEmail;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }, [sendEmailMutation, refetchHistory]);

  const sendSMS = useCallback(async (input: SendSMSInput) => {
    try {
      const result = await sendSMSMutation({ variables: { input } });
      await refetchHistory();
      return result.data?.sendSMS;
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw error;
    }
  }, [sendSMSMutation, refetchHistory]);

  const sendPushNotification = useCallback(async (input: SendPushNotificationInput) => {
    try {
      const result = await sendPushNotificationMutation({ variables: { input } });
      await refetchHistory();
      return result.data?.sendPushNotification;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      throw error;
    }
  }, [sendPushNotificationMutation, refetchHistory]);

  const sendMultiChannelNotification = useCallback(async (input: SendMultiChannelNotificationInput) => {
    try {
      const result = await sendMultiChannelNotificationMutation({ variables: { input } });
      await refetchHistory();
      return result.data?.sendMultiChannelNotification;
    } catch (error) {
      console.error('Failed to send multi-channel notification:', error);
      throw error;
    }
  }, [sendMultiChannelNotificationMutation, refetchHistory]);

  const sendAlert = useCallback(async (input: SendAlertInput) => {
    try {
      const result = await sendAlertMutation({ variables: { input } });
      await refetchHistory();
      return result.data?.sendAlert;
    } catch (error) {
      console.error('Failed to send alert:', error);
      throw error;
    }
  }, [sendAlertMutation, refetchHistory]);

  return {
    // Data
    communicationHistory: communicationHistoryData?.getCommunicationHistory?.items || [],
    totalCount: communicationHistoryData?.getCommunicationHistory?.totalCount || 0,
    hasMore: communicationHistoryData?.getCommunicationHistory?.hasMore || false,
    
    // Loading states
    historyLoading,
    
    // Methods
    sendEmail,
    sendSMS,
    sendPushNotification,
    sendMultiChannelNotification,
    sendAlert,
    refetchHistory,
  };
}