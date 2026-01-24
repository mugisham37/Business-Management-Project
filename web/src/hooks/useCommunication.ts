/**
 * Main Communication Hook
 * Provides comprehensive communication functionality including multi-channel operations,
 * channel management, analytics, and real-time capabilities
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { 
  CommunicationChannel,
  CommunicationChannelConfig,
  MultiChannelNotification,
  Alert,
  BusinessNotification,
  BulkCommunicationResult,
  ChannelTestResult,
  CommunicationStats,
  ChannelUsageStats,
  CommunicationStatsFilter,
  CommunicationChannelType,
  UseCommunicationReturn,
  CommunicationHookOptions
} from '@/types/communication';
import { CommunicationUtils } from '@/lib/utils/communication';

// GraphQL Operations
import {
  GET_COMMUNICATION_CHANNELS,
  TEST_COMMUNICATION_CHANNELS,
  GET_COMMUNICATION_STATS,
  GET_CHANNEL_USAGE_STATS,
} from '@/graphql/queries/communication';

import {
  SEND_MULTI_CHANNEL_NOTIFICATION,
  SEND_ALERT,
  SEND_BUSINESS_NOTIFICATION,
  CONFIGURE_COMMUNICATION_CHANNELS,
  ENABLE_COMMUNICATION_CHANNEL,
  DISABLE_COMMUNICATION_CHANNEL,
} from '@/graphql/mutations/communication';

import {
  COMMUNICATION_EVENTS,
} from '@/graphql/subscriptions/communication';

export const useCommunication = (options: CommunicationHookOptions = {}): UseCommunicationReturn => {
  const { currentTenant } = useTenantStore();
  const apolloClient = useApolloClient();
  
  const {
    tenantId = currentTenant?.id,
    autoRefresh = true,
    refreshInterval = 30000,
    enableRealtime = true,
  } = options;

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<CommunicationChannel[]>([]);
  const [stats, setStats] = useState<CommunicationStats | null>(null);

  // Queries
  const { 
    loading: channelsLoading, 
    error: channelsError,
    refetch: refetchChannels 
  } = useQuery(GET_COMMUNICATION_CHANNELS, {
    variables: { tenantId },
    skip: !tenantId,
    pollInterval: autoRefresh ? refreshInterval : 0,
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data?.getCommunicationChannels) {
        setChannels(data.getCommunicationChannels);
      }
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const { 
    loading: statsLoading,
    refetch: refetchStats 
  } = useQuery(GET_COMMUNICATION_STATS, {
    variables: { tenantId },
    skip: !tenantId,
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data?.getCommunicationStats) {
        setStats(data.getCommunicationStats);
      }
    },
  });

  // Mutations
  const [sendMultiChannelNotificationMutation] = useMutation(SEND_MULTI_CHANNEL_NOTIFICATION, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [sendAlertMutation] = useMutation(SEND_ALERT, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [sendBusinessNotificationMutation] = useMutation(SEND_BUSINESS_NOTIFICATION, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [configureChannelsMutation] = useMutation(CONFIGURE_COMMUNICATION_CHANNELS, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_COMMUNICATION_CHANNELS, variables: { tenantId } }
    ],
  });

  const [enableChannelMutation] = useMutation(ENABLE_COMMUNICATION_CHANNEL, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_COMMUNICATION_CHANNELS, variables: { tenantId } }
    ],
  });

  const [disableChannelMutation] = useMutation(DISABLE_COMMUNICATION_CHANNEL, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_COMMUNICATION_CHANNELS, variables: { tenantId } }
    ],
  });

  // Real-time subscription
  useEffect(() => {
    if (!enableRealtime || !tenantId) return;

    const subscription = apolloClient.subscribe({
      query: COMMUNICATION_EVENTS,
      variables: { tenantId },
      errorPolicy: 'all',
    }).subscribe({
      next: (result) => {
        if (result.data?.communicationEvents) {
          // Handle real-time communication events
          const event = result.data.communicationEvents;
          console.log('Communication event received:', event);
          
          // Optionally refresh data based on event type
          if (event.type === 'channel_configured') {
            refetchChannels();
          }
        }
      },
      error: (error) => {
        console.error('Communication subscription error:', error);
      },
    });

    return () => subscription.unsubscribe();
  }, [enableRealtime, tenantId, apolloClient, refetchChannels]);

  // Multi-channel operations
  const sendMultiChannelNotification = useCallback(async (
    notification: MultiChannelNotification
  ): Promise<BulkCommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate notification
      if (!notification.title || !notification.message) {
        throw new Error('Title and message are required');
      }

      if (!notification.channels || notification.channels.length === 0) {
        throw new Error('At least one communication channel is required');
      }

      // Add metadata
      const enrichedNotification = {
        ...notification,
        metadata: CommunicationUtils.createCommunicationMetadata(
          tenantId,
          '',
          notification.metadata
        ),
      };

      const { data } = await sendMultiChannelNotificationMutation({
        variables: {
          tenantId,
          notification: enrichedNotification,
        },
      });

      if (!data?.sendMultiChannelNotification) {
        throw new Error('Failed to send multi-channel notification');
      }

      // Refresh stats after successful send
      refetchStats();

      return data.sendMultiChannelNotification;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendMultiChannelNotificationMutation, refetchStats]);

  const sendAlert = useCallback(async (alert: Alert): Promise<BulkCommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate alert
      if (!alert.title || !alert.message) {
        throw new Error('Alert title and message are required');
      }

      // Add metadata
      const enrichedAlert = {
        ...alert,
        metadata: CommunicationUtils.createCommunicationMetadata(
          tenantId,
          '',
          {
            ...alert.metadata,
            alertType: 'system_alert',
            severity: alert.severity,
          }
        ),
      };

      const { data } = await sendAlertMutation({
        variables: {
          tenantId,
          alert: enrichedAlert,
        },
      });

      if (!data?.sendAlert) {
        throw new Error('Failed to send alert');
      }

      // Refresh stats after successful send
      refetchStats();

      return data.sendAlert;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendAlertMutation, refetchStats]);

  const sendBusinessNotification = useCallback(async (
    notification: BusinessNotification
  ): Promise<BulkCommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate notification
      if (!notification.type || !notification.title || !notification.message) {
        throw new Error('Notification type, title, and message are required');
      }

      // Add metadata
      const enrichedNotification = {
        ...notification,
        metadata: CommunicationUtils.createCommunicationMetadata(
          tenantId,
          '',
          {
            ...notification.metadata,
            notificationType: notification.type,
          }
        ),
      };

      const { data } = await sendBusinessNotificationMutation({
        variables: {
          tenantId,
          notification: enrichedNotification,
        },
      });

      if (!data?.sendBusinessNotification) {
        throw new Error('Failed to send business notification');
      }

      // Refresh stats after successful send
      refetchStats();

      return data.sendBusinessNotification;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendBusinessNotificationMutation, refetchStats]);

  // Channel management
  const getChannels = useCallback(async (): Promise<CommunicationChannel[]> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await refetchChannels();
      return data?.getCommunicationChannels || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, refetchChannels]);

  const configureChannels = useCallback(async (
    channelConfigs: CommunicationChannelConfig[]
  ): Promise<void> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate channel configurations
      for (const config of channelConfigs) {
        if (!CommunicationUtils.validateCommunicationChannel(config.type)) {
          throw new Error(`Invalid channel type: ${config.type}`);
        }
      }

      await configureChannelsMutation({
        variables: {
          tenantId,
          channels: channelConfigs,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, configureChannelsMutation]);

  const testChannels = useCallback(async (): Promise<ChannelTestResult[]> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await apolloClient.query({
        query: TEST_COMMUNICATION_CHANNELS,
        variables: { tenantId },
        fetchPolicy: 'network-only',
      });

      return data?.testCommunicationChannels || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, apolloClient]);

  const enableChannel = useCallback(async (
    channelType: CommunicationChannelType
  ): Promise<void> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      await enableChannelMutation({
        variables: {
          tenantId,
          channelType,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, enableChannelMutation]);

  const disableChannel = useCallback(async (
    channelType: CommunicationChannelType
  ): Promise<void> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      await disableChannelMutation({
        variables: {
          tenantId,
          channelType,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, disableChannelMutation]);

  // Analytics
  const getStats = useCallback(async (
    filter?: CommunicationStatsFilter
  ): Promise<CommunicationStats> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_COMMUNICATION_STATS,
        variables: { tenantId, filter },
        fetchPolicy: 'network-only',
      });

      if (!data?.getCommunicationStats) {
        throw new Error('Failed to fetch communication stats');
      }

      setStats(data.getCommunicationStats);
      return data.getCommunicationStats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, apolloClient]);

  const getChannelUsageStats = useCallback(async (
    filter?: CommunicationStatsFilter
  ): Promise<ChannelUsageStats[]> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_CHANNEL_USAGE_STATS,
        variables: { tenantId, filter },
        fetchPolicy: 'network-only',
      });

      return data?.getChannelUsageStats || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, apolloClient]);

  // Update loading state based on queries
  useEffect(() => {
    setLoading(channelsLoading || statsLoading);
  }, [channelsLoading, statsLoading]);

  // Update error state based on queries
  useEffect(() => {
    if (channelsError) {
      setError(channelsError.message);
    }
  }, [channelsError]);

  return {
    // Multi-channel operations
    sendMultiChannelNotification,
    sendAlert,
    sendBusinessNotification,
    
    // Channel management
    getChannels,
    configureChannels,
    testChannels,
    enableChannel,
    disableChannel,
    
    // Analytics
    getStats,
    getChannelUsageStats,
    
    // State
    loading,
    error,
    channels,
    stats,
  };
};