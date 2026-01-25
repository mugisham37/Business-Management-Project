/**
 * SMS Communication Hook
 * Provides comprehensive SMS functionality including sending, templates, OTP, and provider management
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useAuth } from '@/hooks/useAuth';
import {
  SMSMessage,
  SMSTemplate,
  SMSProvider,
  SMSNotification,
  SMSProviderConfig,
  BulkSMSResult,
  CommunicationResult,
  NotificationOptions,
  OTPMessage,
  Alert,
  UseSMSReturn,
  CommunicationHookOptions
} from '@/types/communication';
import { CommunicationUtils } from '@/lib/utils/communication';

// GraphQL Operations
import {
  GET_SMS_TEMPLATES,
  GET_SMS_PROVIDERS,
  GET_SMS_TEMPLATE,
} from '@/graphql/queries/communication';

import {
  SEND_SMS,
  SEND_SMS_TO_USERS,
  SEND_OTP,
  SEND_SMS_ALERT,
  CREATE_SMS_TEMPLATE,
  UPDATE_SMS_TEMPLATE,
  DELETE_SMS_TEMPLATE,
  CONFIGURE_SMS_PROVIDER,
  TEST_SMS_PROVIDER,
} from '@/graphql/mutations/communication';

import {
  SMS_EVENTS,
} from '@/graphql/subscriptions/communication';

export const useSMS = (options: CommunicationHookOptions = {}): UseSMSReturn => {
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
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [providers, setProviders] = useState<SMSProvider[]>([]);

  // Queries
  const { 
    loading: templatesLoading, 
    error: templatesError,
    refetch: refetchTemplates 
  } = useQuery(GET_SMS_TEMPLATES, {
    variables: { tenantId },
    skip: !tenantId,
    pollInterval: autoRefresh ? refreshInterval : 0,
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data?.getSMSTemplates) {
        setTemplates(data.getSMSTemplates);
      }
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const { 
    loading: providersLoading, 
    error: providersError,
    refetch: refetchProviders 
  } = useQuery(GET_SMS_PROVIDERS, {
    variables: { tenantId },
    skip: !tenantId,
    pollInterval: autoRefresh ? refreshInterval : 0,
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data?.getSMSProviders) {
        setProviders(data.getSMSProviders);
      }
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  // Mutations
  const [sendSMSMutation] = useMutation(SEND_SMS, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [sendSMSToUsersMutation] = useMutation(SEND_SMS_TO_USERS, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [sendOTPMutation] = useMutation(SEND_OTP, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [sendSMSAlertMutation] = useMutation(SEND_SMS_ALERT, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [createTemplateMutation] = useMutation(CREATE_SMS_TEMPLATE, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_SMS_TEMPLATES, variables: { tenantId } }
    ],
  });

  const [updateTemplateMutation] = useMutation(UPDATE_SMS_TEMPLATE, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_SMS_TEMPLATES, variables: { tenantId } }
    ],
  });

  const [deleteTemplateMutation] = useMutation(DELETE_SMS_TEMPLATE, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_SMS_TEMPLATES, variables: { tenantId } }
    ],
  });

  const [configureProviderMutation] = useMutation(CONFIGURE_SMS_PROVIDER, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_SMS_PROVIDERS, variables: { tenantId } }
    ],
  });

  const [testProviderMutation] = useMutation(TEST_SMS_PROVIDER, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  // Real-time subscription for SMS events
  useEffect(() => {
    if (!enableRealtime || !tenantId) return;

    const subscription = apolloClient.subscribe({
      query: SMS_EVENTS,
      variables: { tenantId, userId },
      errorPolicy: 'all',
    }).subscribe({
      next: (result) => {
        if (result.data?.smsEvents) {
          const event = result.data.smsEvents;
          console.log('SMS event received:', event);
          
          // Handle SMS events
          if (event.type === 'template_created') {
            refetchTemplates();
          } else if (event.type === 'provider_configured') {
            refetchProviders();
          }
        }
      },
      error: (error) => {
        console.error('SMS subscription error:', error);
      },
    });

    return () => subscription.unsubscribe();
  }, [enableRealtime, tenantId, userId, apolloClient, refetchTemplates, refetchProviders]);

  // SMS operations
  const sendSMS = useCallback(async (
    message: SMSMessage,
    options?: NotificationOptions
  ): Promise<CommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate SMS message
      if (!message.to || message.to.length === 0) {
        throw new Error('At least one recipient phone number is required');
      }

      if (!message.message) {
        throw new Error('Message content is required');
      }

      // Validate phone numbers
      const invalidPhones = message.to.filter(phone => !CommunicationUtils.validatePhoneNumber(phone));
      if (invalidPhones.length > 0) {
        throw new Error(`Invalid phone numbers: ${invalidPhones.join(', ')}`);
      }

      // Check message length (basic validation)
      if (message.message.length > 1600) {
        throw new Error('Message is too long (maximum 1600 characters)');
      }

      // Format phone numbers
      const formattedMessage = {
        ...message,
        to: message.to.map(phone => CommunicationUtils.formatPhoneNumber(phone)),
      };

      const { data } = await sendSMSMutation({
        variables: {
          tenantId,
          message: formattedMessage,
          options,
        },
      });

      if (!data?.sendSMS) {
        throw new Error('Failed to send SMS');
      }

      return data.sendSMS;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendSMSMutation]);

  const sendSMSToUsers = useCallback(async (
    userIds: string[],
    notification: SMSNotification,
    options?: NotificationOptions
  ): Promise<BulkSMSResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate input
      if (!userIds || userIds.length === 0) {
        throw new Error('At least one user ID is required');
      }

      if (!notification.message) {
        throw new Error('Message content is required');
      }

      // Check message length
      if (notification.message.length > 1600) {
        throw new Error('Message is too long (maximum 1600 characters)');
      }

      const { data } = await sendSMSToUsersMutation({
        variables: {
          tenantId,
          userIds,
          notification,
          options,
        },
      });

      if (!data?.sendSMSToUsers) {
        throw new Error('Failed to send SMS to users');
      }

      return data.sendSMSToUsers;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendSMSToUsersMutation]);

  const sendOTP = useCallback(async (
    otp: OTPMessage,
    options?: NotificationOptions
  ): Promise<CommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate OTP message
      if (!otp.phoneNumber) {
        throw new Error('Phone number is required');
      }

      if (!otp.otp) {
        throw new Error('OTP code is required');
      }

      // Validate phone number
      if (!CommunicationUtils.validatePhoneNumber(otp.phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Validate OTP format (basic validation)
      if (!/^\d{4,8}$/.test(otp.otp)) {
        throw new Error('OTP must be 4-8 digits');
      }

      // Format phone number
      const formattedOTP = {
        ...otp,
        phoneNumber: CommunicationUtils.formatPhoneNumber(otp.phoneNumber),
      };

      const { data } = await sendOTPMutation({
        variables: {
          tenantId,
          otp: formattedOTP,
          options,
        },
      });

      if (!data?.sendOTP) {
        throw new Error('Failed to send OTP');
      }

      return data.sendOTP;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendOTPMutation]);

  const sendSMSAlert = useCallback(async (
    phoneNumbers: string[],
    alert: Alert,
    options?: NotificationOptions
  ): Promise<CommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate input
      if (!phoneNumbers || phoneNumbers.length === 0) {
        throw new Error('At least one phone number is required');
      }

      if (!alert.title || !alert.message) {
        throw new Error('Alert title and message are required');
      }

      // Validate phone numbers
      const invalidPhones = phoneNumbers.filter(phone => !CommunicationUtils.validatePhoneNumber(phone));
      if (invalidPhones.length > 0) {
        throw new Error(`Invalid phone numbers: ${invalidPhones.join(', ')}`);
      }

      // Format phone numbers
      const formattedPhones = phoneNumbers.map(phone => CommunicationUtils.formatPhoneNumber(phone));

      const { data } = await sendSMSAlertMutation({
        variables: {
          tenantId,
          phoneNumbers: formattedPhones,
          alert,
          options,
        },
      });

      if (!data?.sendSMSAlert) {
        throw new Error('Failed to send SMS alert');
      }

      return data.sendSMSAlert;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendSMSAlertMutation]);

  // Template management
  const getTemplates = useCallback(async (category?: string): Promise<SMSTemplate[]> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_SMS_TEMPLATES,
        variables: { tenantId, category },
        fetchPolicy: 'network-only',
      });

      return data?.getSMSTemplates || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, apolloClient]);

  const getTemplate = useCallback(async (templateName: string): Promise<SMSTemplate | null> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_SMS_TEMPLATE,
        variables: { tenantId, templateName },
        fetchPolicy: 'network-only',
      });

      return data?.getSMSTemplate || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, apolloClient]);

  const createTemplate = useCallback(async (template: SMSTemplate): Promise<void> => {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate template
      if (!template.name) {
        throw new Error('Template name is required');
      }

      if (!template.message) {
        throw new Error('Template message is required');
      }

      // Check message length
      const maxLength = template.maxLength || 1600;
      if (template.message.length > maxLength) {
        throw new Error(`Message is too long (maximum ${maxLength} characters)`);
      }

      // Extract variables from template
      const variables = CommunicationUtils.extractVariablesFromTemplate(template.message);
      
      const templateWithVariables = {
        ...template,
        variables,
      };

      await createTemplateMutation({
        variables: {
          tenantId,
          template: templateWithVariables,
          createdBy: userId,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId, createTemplateMutation]);

  const updateTemplate = useCallback(async (
    templateName: string,
    template: SMSTemplate
  ): Promise<void> => {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate template
      if (!template.message) {
        throw new Error('Template message is required');
      }

      // Check message length
      const maxLength = template.maxLength || 1600;
      if (template.message.length > maxLength) {
        throw new Error(`Message is too long (maximum ${maxLength} characters)`);
      }

      // Extract variables from template
      const variables = CommunicationUtils.extractVariablesFromTemplate(template.message);
      
      const templateWithVariables = {
        ...template,
        variables,
      };

      await updateTemplateMutation({
        variables: {
          tenantId,
          templateName,
          template: templateWithVariables,
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
  }, [tenantId, userId, updateTemplateMutation]);

  const deleteTemplate = useCallback(async (templateName: string): Promise<void> => {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    setLoading(true);
    setError(null);

    try {
      await deleteTemplateMutation({
        variables: {
          tenantId,
          templateName,
          deletedBy: userId,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId, deleteTemplateMutation]);

  // Provider management
  const getProviders = useCallback(async (): Promise<SMSProvider[]> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await refetchProviders();
      return data?.getSMSProviders || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, refetchProviders]);

  const configureProvider = useCallback(async (provider: SMSProviderConfig): Promise<void> => {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate provider configuration
      if (!provider.type) {
        throw new Error('Provider type is required');
      }

      if (!provider.configuration) {
        throw new Error('Provider configuration is required');
      }

      // Basic validation based on provider type
      const config = (provider.configuration as Record<string, unknown>) || {};
      switch (provider.type) {
        case 'twilio':
          if (!config.accountSid || !config.authToken || !config.fromPhoneNumber) {
            throw new Error('Twilio Account SID, Auth Token, and from phone number are required');
          }
          if (!CommunicationUtils.validatePhoneNumber(config.fromPhoneNumber as string)) {
            throw new Error('Invalid from phone number format');
          }
          break;
        case 'aws-sns':
          if (!config.accessKeyId || !config.secretAccessKey || !config.region) {
            throw new Error('AWS SNS credentials and region are required');
          }
          break;
        case 'nexmo':
          if (!config.apiKey || !config.apiSecret || !config.fromPhoneNumber) {
            throw new Error('Nexmo API key, secret, and from phone number are required');
          }
          break;
        case 'messagebird':
          if (!config.apiKey || !config.fromPhoneNumber) {
            throw new Error('MessageBird API key and from phone number are required');
          }
          break;
        case 'plivo':
          if (!config.authId || !config.authToken || !config.fromPhoneNumber) {
            throw new Error('Plivo Auth ID, token, and from phone number are required');
          }
          break;
      }

      await configureProviderMutation({
        variables: {
          tenantId,
          provider,
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
  }, [tenantId, userId, configureProviderMutation]);

  const testProvider = useCallback(async (provider: SMSProviderConfig): Promise<CommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await testProviderMutation({
        variables: {
          tenantId,
          provider,
        },
      });

      if (!data?.testSMSProvider) {
        throw new Error('Failed to test SMS provider');
      }

      return data.testSMSProvider;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, testProviderMutation]);

  // Update loading state based on queries
  useEffect(() => {
    setLoading(templatesLoading || providersLoading);
  }, [templatesLoading, providersLoading]);

  // Update error state based on queries
  useEffect(() => {
    if (templatesError) {
      setError(templatesError.message);
    } else if (providersError) {
      setError(providersError.message);
    }
  }, [templatesError, providersError]);

  return {
    // SMS operations
    sendSMS,
    sendSMSToUsers,
    sendOTP,
    sendSMSAlert,
    
    // Template management
    getTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    
    // Provider management
    getProviders,
    configureProvider,
    testProvider,
    
    // State
    loading,
    error,
    templates,
    providers,
  };
};