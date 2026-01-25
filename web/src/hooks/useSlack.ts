/**
 * Slack Communication Hook
 * Provides comprehensive Slack integration functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useAuth } from '@/hooks/useAuth';
import {
  SlackMessage,
  SlackNotification,
  SlackAlert,
  SlackIntegrationConfig,
  CommunicationResult,
  IntegrationTestResult,
  NotificationOptions,
  UseSlackReturn,
  CommunicationHookOptions
} from '@/types/communication';
import { CommunicationUtils } from '@/lib/utils/communication';

// GraphQL Operations
import {
  GET_SLACK_CONFIGURATION,
  IS_SLACK_CONFIGURED,
} from '@/graphql/queries/communication';

import {
  SEND_SLACK_MESSAGE,
  SEND_SLACK_NOTIFICATION,
  SEND_SLACK_ALERT,
  SEND_SLACK_MESSAGE_TO_CHANNEL,
  CONFIGURE_SLACK_INTEGRATION,
  TEST_SLACK_INTEGRATION,
  DISABLE_SLACK_INTEGRATION,
} from '@/graphql/mutations/communication';

import {
  SLACK_EVENTS,
} from '@/graphql/subscriptions/communication';

export const useSlack = (options: CommunicationHookOptions = {}): UseSlackReturn => {
  const { user } = useAuth();
  const apolloClient = useApolloClient();
  
  const {
    tenantId = user?.tenantId,
    userId = user?.id,
    autoRefresh = true,
    refreshInterval = 60000,
    enableRealtime = true,
  } = options;

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configuration, setConfiguration] = useState<SlackIntegrationConfig | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // Queries
  const { 
    loading: configLoading, 
    error: configError,
    refetch: refetchConfig 
  } = useQuery(GET_SLACK_CONFIGURATION, {
    variables: { tenantId },
    skip: !tenantId,
    pollInterval: autoRefresh ? refreshInterval : 0,
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data?.getSlackConfiguration) {
        setConfiguration(data.getSlackConfiguration);
      }
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const { 
    loading: isConfiguredLoading,
    refetch: refetchIsConfigured 
  } = useQuery(IS_SLACK_CONFIGURED, {
    variables: { tenantId },
    skip: !tenantId,
    pollInterval: autoRefresh ? refreshInterval : 0,
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (typeof data?.isSlackConfigured === 'boolean') {
        setIsConfigured(data.isSlackConfigured);
      }
    },
  });

  // Mutations
  const [sendMessageMutation] = useMutation(SEND_SLACK_MESSAGE, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [sendNotificationMutation] = useMutation(SEND_SLACK_NOTIFICATION, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [sendAlertMutation] = useMutation(SEND_SLACK_ALERT, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [sendMessageToChannelMutation] = useMutation(SEND_SLACK_MESSAGE_TO_CHANNEL, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [configureIntegrationMutation] = useMutation(CONFIGURE_SLACK_INTEGRATION, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_SLACK_CONFIGURATION, variables: { tenantId } },
      { query: IS_SLACK_CONFIGURED, variables: { tenantId } }
    ],
  });

  const [testIntegrationMutation] = useMutation(TEST_SLACK_INTEGRATION, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [disableIntegrationMutation] = useMutation(DISABLE_SLACK_INTEGRATION, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_SLACK_CONFIGURATION, variables: { tenantId } },
      { query: IS_SLACK_CONFIGURED, variables: { tenantId } }
    ],
  });

  // Real-time subscription for Slack events
  useEffect(() => {
    if (!enableRealtime || !tenantId) return;

    const subscription = apolloClient.subscribe({
      query: SLACK_EVENTS,
      variables: { tenantId },
      errorPolicy: 'all',
    }).subscribe({
      next: (result) => {
        if (result.data?.slackEvents) {
          const event = result.data.slackEvents;
          console.log('Slack event received:', event);
          
          // Handle Slack events
          if (event.type === 'integration_configured') {
            refetchConfig();
            refetchIsConfigured();
          }
        }
      },
      error: (error) => {
        console.error('Slack subscription error:', error);
      },
    });

    return () => subscription.unsubscribe();
  }, [enableRealtime, tenantId, apolloClient, refetchConfig, refetchIsConfigured]);

  // Slack operations
  const sendMessage = useCallback(async (
    message: SlackMessage,
    options?: NotificationOptions
  ): Promise<CommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate Slack message
      if (!message.channel) {
        throw new Error('Slack channel is required');
      }

      if (!message.text) {
        throw new Error('Message text is required');
      }

      // Validate channel format
      if (!CommunicationUtils.validateSlackChannel(message.channel)) {
        throw new Error('Invalid Slack channel format');
      }

      // Format channel
      const formattedMessage = {
        ...message,
        channel: CommunicationUtils.formatSlackChannel(message.channel),
      };

      const { data } = await sendMessageMutation({
        variables: {
          tenantId,
          message: formattedMessage,
          options,
        },
      });

      if (!data?.sendSlackMessage) {
        throw new Error('Failed to send Slack message');
      }

      return data.sendSlackMessage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendMessageMutation]);

  const sendNotification = useCallback(async (
    notification: SlackNotification
  ): Promise<CommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate notification
      if (!notification.title || !notification.message) {
        throw new Error('Notification title and message are required');
      }

      if (!notification.type) {
        throw new Error('Notification type is required');
      }

      // Validate channel if provided
      if (notification.channel && !CommunicationUtils.validateSlackChannel(notification.channel)) {
        throw new Error('Invalid Slack channel format');
      }

      // Format channel if provided
      const formattedNotification = {
        ...notification,
        ...(notification.channel && { 
          channel: CommunicationUtils.formatSlackChannel(notification.channel) 
        }),
      };

      const { data } = await sendNotificationMutation({
        variables: {
          tenantId,
          notification: formattedNotification,
        },
      });

      if (!data?.sendSlackNotification) {
        throw new Error('Failed to send Slack notification');
      }

      return data.sendSlackNotification;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendNotificationMutation]);

  const sendAlert = useCallback(async (alert: SlackAlert): Promise<CommunicationResult> => {
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

      if (!alert.severity) {
        throw new Error('Alert severity is required');
      }

      // Validate channel if provided
      if (alert.channel && !CommunicationUtils.validateSlackChannel(alert.channel)) {
        throw new Error('Invalid Slack channel format');
      }

      // Format channel if provided
      const formattedAlert = {
        ...alert,
        ...(alert.channel && { 
          channel: CommunicationUtils.formatSlackChannel(alert.channel) 
        }),
      };

      const { data } = await sendAlertMutation({
        variables: {
          tenantId,
          alert: formattedAlert,
        },
      });

      if (!data?.sendSlackAlert) {
        throw new Error('Failed to send Slack alert');
      }

      return data.sendSlackAlert;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendAlertMutation]);

  const sendMessageToChannel = useCallback(async (
    channel: string,
    message: string,
    options?: NotificationOptions
  ): Promise<CommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate input
      if (!channel) {
        throw new Error('Channel is required');
      }

      if (!message) {
        throw new Error('Message is required');
      }

      // Validate channel format
      if (!CommunicationUtils.validateSlackChannel(channel)) {
        throw new Error('Invalid Slack channel format');
      }

      // Format channel
      const formattedChannel = CommunicationUtils.formatSlackChannel(channel);

      const { data } = await sendMessageToChannelMutation({
        variables: {
          tenantId,
          channel: formattedChannel,
          message,
          options,
        },
      });

      if (!data?.sendSlackMessageToChannel) {
        throw new Error('Failed to send message to Slack channel');
      }

      return data.sendSlackMessageToChannel;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendMessageToChannelMutation]);

  // Configuration management
  const getConfiguration = useCallback(async (): Promise<SlackIntegrationConfig | null> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await refetchConfig();
      return data?.getSlackConfiguration || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, refetchConfig]);

  const configureIntegration = useCallback(async (
    config: SlackIntegrationConfig
  ): Promise<void> => {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate configuration
      if (!config.webhookUrl) {
        throw new Error('Webhook URL is required');
      }

      if (!CommunicationUtils.validateWebhookUrl(config.webhookUrl)) {
        throw new Error('Invalid webhook URL format');
      }

      // Validate default channel if provided
      if (config.defaultChannel && !CommunicationUtils.validateSlackChannel(config.defaultChannel)) {
        throw new Error('Invalid default channel format');
      }

      // Format default channel if provided
      const formattedConfig = {
        ...config,
        ...(config.defaultChannel && { 
          defaultChannel: CommunicationUtils.formatSlackChannel(config.defaultChannel) 
        }),
      };

      await configureIntegrationMutation({
        variables: {
          tenantId,
          config: formattedConfig,
          updatedBy: userId,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId, configureIntegrationMutation]);

  const testIntegration = useCallback(async (
    config: SlackIntegrationConfig
  ): Promise<IntegrationTestResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate configuration
      if (!config.webhookUrl) {
        throw new Error('Webhook URL is required');
      }

      if (!CommunicationUtils.validateWebhookUrl(config.webhookUrl)) {
        throw new Error('Invalid webhook URL format');
      }

      const { data } = await testIntegrationMutation({
        variables: {
          tenantId,
          config,
        },
      });

      if (!data?.testSlackIntegration) {
        throw new Error('Failed to test Slack integration');
      }

      return data.testSlackIntegration;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, testIntegrationMutation]);

  const disableIntegration = useCallback(async (): Promise<void> => {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    setLoading(true);
    setError(null);

    try {
      await disableIntegrationMutation({
        variables: {
          tenantId,
          updatedBy: userId,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId, disableIntegrationMutation]);

  const isConfiguredCheck = useCallback(async (): Promise<boolean> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await refetchIsConfigured();
      return data?.isSlackConfigured || false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, refetchIsConfigured]);

  // Update loading state based on queries
  useEffect(() => {
    setLoading(configLoading || isConfiguredLoading);
  }, [configLoading, isConfiguredLoading]);

  // Update error state based on queries
  useEffect(() => {
    if (configError) {
      setError(configError.message);
    }
  }, [configError]);

  return {
    // Slack operations
    sendMessage,
    sendNotification,
    sendAlert,
    sendMessageToChannel,
    
    // Configuration
    getConfiguration,
    configureIntegration,
    testIntegration,
    disableIntegration,
    checkIfConfigured: isConfiguredCheck,
    
    // State
    loading,
    error,
    configuration,
    isConfigured,
  };
};