/**
 * Notifications Hook
 * Provides real-time notification subscriptions and event handling
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSubscription, useApolloClient } from '@apollo/client';
import { useTenant } from '@/hooks/useTenant';
import {
  CommunicationEvent,
  NotificationDeliveryStatus,
  CommunicationEventFilter,
  AlertSeverity,
  UseNotificationsReturn,
  CommunicationHookOptions
} from '@/types/communication';

// GraphQL Subscriptions
import {
  COMMUNICATION_EVENTS,
  ALERT_EVENTS,
  BUSINESS_NOTIFICATION_EVENTS,
  NOTIFICATION_DELIVERY_STATUS,
  EMAIL_EVENTS,
  SMS_EVENTS,
  SLACK_EVENTS,
  TEAMS_EVENTS,
} from '@/graphql/subscriptions/communication';

type EventCallback = (event: CommunicationEvent) => void;
type DeliveryStatusCallback = (status: NotificationDeliveryStatus) => void;

export const useNotifications = (options: CommunicationHookOptions = {}): UseNotificationsReturn => {
  const { tenant } = useTenant();
  const apolloClient = useApolloClient();
  
  const {
    tenantId = tenant?.id,
    enableRealtime = true,
  } = options;

  // State
  const [events, setEvents] = useState<CommunicationEvent[]>([]);
  const [alerts, setAlerts] = useState<CommunicationEvent[]>([]);
  const [deliveryStatuses, setDeliveryStatuses] = useState<NotificationDeliveryStatus[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  // Callback refs
  const eventCallbacks = useRef<Set<EventCallback>>(new Set());
  const alertCallbacks = useRef<Set<EventCallback>>(new Set());
  const deliveryStatusCallbacks = useRef<Set<DeliveryStatusCallback>>(new Set());

  // Subscription refs for cleanup
  const subscriptions = useRef<Set<() => void>>(new Set());

  // Main communication events subscription
  const { error: communicationEventsError } = useSubscription(
    COMMUNICATION_EVENTS,
    {
      variables: { tenantId },
      skip: !enableRealtime || !tenantId,
      onSubscriptionData: ({ subscriptionData }) => {
        if (subscriptionData.data?.communicationEvents) {
          const event = subscriptionData.data.communicationEvents;
          
          // Add to events list
          setEvents(prev => {
            const updated = [event, ...prev].slice(0, 1000); // Keep last 1000 events
            return updated;
          });

          // Notify callbacks
          eventCallbacks.current.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error('Error in event callback:', error);
            }
          });

          setConnectionStatus('connected');
        }
      },
      onSubscriptionComplete: () => {
        setConnectionStatus('disconnected');
      },
    }
  );

  // Alert events subscription
  const { error: alertEventsError } = useSubscription(
    ALERT_EVENTS,
    {
      variables: { tenantId },
      skip: !enableRealtime || !tenantId,
      onSubscriptionData: ({ subscriptionData }) => {
        if (subscriptionData.data?.alertEvents) {
          const event = subscriptionData.data.alertEvents;
          
          // Add to alerts list
          setAlerts(prev => {
            const updated = [event, ...prev].slice(0, 500); // Keep last 500 alerts
            return updated;
          });

          // Notify alert callbacks
          alertCallbacks.current.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error('Error in alert callback:', error);
            }
          });
        }
      },
    }
  );

  // Connection status monitoring
  useEffect(() => {
    if (communicationEventsError || alertEventsError) {
      setConnectionStatus('disconnected');
      
      // Attempt to reconnect after a delay
      const reconnectTimer = setTimeout(() => {
        setConnectionStatus('reconnecting');
      }, 5000);

      return () => clearTimeout(reconnectTimer);
    }
    // No cleanup needed if no errors
    return undefined;
  }, [communicationEventsError, alertEventsError]);

  // Subscribe to specific events with filters
  const subscribeToEvents = useCallback((filter?: CommunicationEventFilter) => {
    if (!enableRealtime || !tenantId) {
      return () => {};
    }

    const subscription = apolloClient.subscribe({
      query: COMMUNICATION_EVENTS,
      variables: { tenantId, filter },
      errorPolicy: 'all',
    }).subscribe({
      next: (result) => {
        if (result.data?.communicationEvents) {
          const event = result.data.communicationEvents;
          
          setEvents(prev => {
            const updated = [event, ...prev].slice(0, 1000);
            return updated;
          });

          eventCallbacks.current.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error('Error in filtered event callback:', error);
            }
          });
        }
      },
      error: (error) => {
        console.error('Communication events subscription error:', error);
        setConnectionStatus('disconnected');
      },
    });

    const unsubscribe = () => subscription.unsubscribe();
    subscriptions.current.add(unsubscribe);

    return () => {
      subscription.unsubscribe();
      subscriptions.current.delete(unsubscribe);
    };
  }, [enableRealtime, tenantId, apolloClient]);

  // Subscribe to alerts with severity filter
  const subscribeToAlerts = useCallback((severity?: AlertSeverity) => {
    if (!enableRealtime || !tenantId) {
      return () => {};
    }

    const subscription = apolloClient.subscribe({
      query: ALERT_EVENTS,
      variables: { tenantId, severity },
      errorPolicy: 'all',
    }).subscribe({
      next: (result) => {
        if (result.data?.alertEvents) {
          const event = result.data.alertEvents;
          
          setAlerts(prev => {
            const updated = [event, ...prev].slice(0, 500);
            return updated;
          });

          alertCallbacks.current.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error('Error in alert callback:', error);
            }
          });
        }
      },
      error: (error) => {
        console.error('Alert events subscription error:', error);
      },
    });

    const unsubscribe = () => subscription.unsubscribe();
    subscriptions.current.add(unsubscribe);

    return () => {
      subscription.unsubscribe();
      subscriptions.current.delete(unsubscribe);
    };
  }, [enableRealtime, tenantId, apolloClient]);

  // Subscribe to business notifications
  const subscribeToBusinessNotifications = useCallback((notificationType?: string) => {
    if (!enableRealtime || !tenantId) {
      return () => {};
    }

    const subscription = apolloClient.subscribe({
      query: BUSINESS_NOTIFICATION_EVENTS,
      variables: { tenantId, notificationType },
      errorPolicy: 'all',
    }).subscribe({
      next: (result) => {
        if (result.data?.businessNotificationEvents) {
          const event = result.data.businessNotificationEvents;
          
          setEvents(prev => {
            const updated = [event, ...prev].slice(0, 1000);
            return updated;
          });

          eventCallbacks.current.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error('Error in business notification callback:', error);
            }
          });
        }
      },
      error: (error) => {
        console.error('Business notification events subscription error:', error);
      },
    });

    const unsubscribe = () => subscription.unsubscribe();
    subscriptions.current.add(unsubscribe);

    return () => {
      subscription.unsubscribe();
      subscriptions.current.delete(unsubscribe);
    };
  }, [enableRealtime, tenantId, apolloClient]);

  // Subscribe to delivery status updates
  const subscribeToDeliveryStatus = useCallback((notificationId: string) => {
    if (!enableRealtime || !tenantId) {
      return () => {};
    }

    const subscription = apolloClient.subscribe({
      query: NOTIFICATION_DELIVERY_STATUS,
      variables: { tenantId, notificationId },
      errorPolicy: 'all',
    }).subscribe({
      next: (result) => {
        if (result.data?.notificationDeliveryStatus) {
          const status = result.data.notificationDeliveryStatus;
          
          setDeliveryStatuses(prev => {
            const updated = [status, ...prev].slice(0, 100);
            return updated;
          });

          deliveryStatusCallbacks.current.forEach(callback => {
            try {
              callback(status);
            } catch (error) {
              console.error('Error in delivery status callback:', error);
            }
          });
        }
      },
      error: (error) => {
        console.error('Delivery status subscription error:', error);
      },
    });

    const unsubscribe = () => subscription.unsubscribe();
    subscriptions.current.add(unsubscribe);

    return () => {
      subscription.unsubscribe();
      subscriptions.current.delete(unsubscribe);
    };
  }, [enableRealtime, tenantId, apolloClient]);

  // Subscribe to channel-specific events
  const subscribeToChannelEvents = useCallback((channel: 'email' | 'sms' | 'slack' | 'teams', options?: Record<string, unknown>) => {
    if (!enableRealtime || !tenantId) {
      return () => {};
    }

    let query;
    const variables = { tenantId, ...options };

    switch (channel) {
      case 'email':
        query = EMAIL_EVENTS;
        break;
      case 'sms':
        query = SMS_EVENTS;
        break;
      case 'slack':
        query = SLACK_EVENTS;
        break;
      case 'teams':
        query = TEAMS_EVENTS;
        break;
      default:
        return () => {};
    }

    const subscription = apolloClient.subscribe({
      query,
      variables,
      errorPolicy: 'all',
    }).subscribe({
      next: (result) => {
        const eventKey = `${channel}Events`;
        if (result.data?.[eventKey]) {
          const event = result.data[eventKey];
          
          setEvents(prev => {
            const updated = [event, ...prev].slice(0, 1000);
            return updated;
          });

          eventCallbacks.current.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error(`Error in ${channel} event callback:`, error);
            }
          });
        }
      },
      error: (error) => {
        console.error(`${channel} events subscription error:`, error);
      },
    });

    const unsubscribe = () => subscription.unsubscribe();
    subscriptions.current.add(unsubscribe);

    return () => {
      subscription.unsubscribe();
      subscriptions.current.delete(unsubscribe);
    };
  }, [enableRealtime, tenantId, apolloClient]);

  // Event callback management
  const onEvent = useCallback((callback: EventCallback) => {
    eventCallbacks.current.add(callback);
    
    return () => {
      eventCallbacks.current.delete(callback);
    };
  }, []);

  const onAlert = useCallback((callback: EventCallback) => {
    alertCallbacks.current.add(callback);
    
    return () => {
      alertCallbacks.current.delete(callback);
    };
  }, []);

  const onDeliveryStatus = useCallback((callback: DeliveryStatusCallback) => {
    deliveryStatusCallbacks.current.add(callback);
    
    return () => {
      deliveryStatusCallbacks.current.delete(callback);
    };
  }, []);

  // Utility methods
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const clearDeliveryStatuses = useCallback(() => {
    setDeliveryStatuses([]);
  }, []);

  const getEventsByChannel = useCallback((channel: string) => {
    return events.filter(event => event.channel === channel);
  }, [events]);

  const getEventsByType = useCallback((type: string) => {
    return events.filter(event => event.type === type);
  }, [events]);

  const getRecentEvents = useCallback((count = 10) => {
    return events.slice(0, count);
  }, [events]);

  const getRecentAlerts = useCallback((count = 5) => {
    return alerts.slice(0, count);
  }, [alerts]);

  const getFailedEvents = useCallback(() => {
    return events.filter(event => !event.success);
  }, [events]);

  const getSuccessfulEvents = useCallback(() => {
    return events.filter(event => event.success);
  }, [events]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    const currentSubscriptions = subscriptions.current;
    
    return () => {
      currentSubscriptions.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      });
      currentSubscriptions.clear();
    };
  }, []);

  return {
    // Subscription methods
    subscribeToEvents,
    subscribeToAlerts,
    subscribeToBusinessNotifications,
    subscribeToDeliveryStatus,
    subscribeToChannelEvents,
    
    // Event handling
    onEvent,
    onAlert,
    onDeliveryStatus,
    
    // State
    events,
    alerts,
    deliveryStatuses,
    connectionStatus,
    
    // Utility methods
    clearEvents,
    clearAlerts,
    clearDeliveryStatuses,
    getEventsByChannel,
    getEventsByType,
    getRecentEvents,
    getRecentAlerts,
    getFailedEvents,
    getSuccessfulEvents,
  };
};