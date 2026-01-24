/**
 * Email Communication Hook
 * Provides comprehensive email functionality including sending, templates, and provider management
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  EmailMessage,
  EmailTemplate,
  EmailProvider,
  EmailNotification,
  EmailProviderConfig,
  BulkEmailResult,
  CommunicationResult,
  NotificationOptions,
  UseEmailReturn,
  CommunicationHookOptions
} from '@/types/communication';
import { CommunicationUtils } from '@/lib/utils/communication';

// GraphQL Operations
import {
  GET_EMAIL_TEMPLATES,
  GET_EMAIL_PROVIDERS,
  GET_EMAIL_TEMPLATE,
} from '@/graphql/queries/communication';

import {
  SEND_EMAIL,
  SEND_EMAIL_TO_USERS,
  CREATE_EMAIL_TEMPLATE,
  UPDATE_EMAIL_TEMPLATE,
  DELETE_EMAIL_TEMPLATE,
  CONFIGURE_EMAIL_PROVIDER,
  TEST_EMAIL_PROVIDER,
} from '@/graphql/mutations/communication';

import {
  EMAIL_EVENTS,
} from '@/graphql/subscriptions/communication';

export const useEmail = (options: CommunicationHookOptions = {}): UseEmailReturn => {
  const { currentTenant } = useTenantStore();
  const apolloClient = useApolloClient();
  
  const {
    tenantId = currentTenant?.id,
    autoRefresh = true,
    refreshInterval = 60000,
    enableRealtime = true,
  } = options;

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [providers, setProviders] = useState<EmailProvider[]>([]);

  // Queries
  const { 
    loading: templatesLoading, 
    error: templatesError,
    refetch: refetchTemplates 
  } = useQuery(GET_EMAIL_TEMPLATES, {
    variables: { tenantId },
    skip: !tenantId,
    pollInterval: autoRefresh ? refreshInterval : 0,
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data?.getEmailTemplates) {
        setTemplates(data.getEmailTemplates);
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
  } = useQuery(GET_EMAIL_PROVIDERS, {
    variables: { tenantId },
    skip: !tenantId,
    pollInterval: autoRefresh ? refreshInterval : 0,
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data?.getEmailProviders) {
        setProviders(data.getEmailProviders);
      }
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  // Mutations
  const [sendEmailMutation] = useMutation(SEND_EMAIL, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [sendEmailToUsersMutation] = useMutation(SEND_EMAIL_TO_USERS, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  const [createTemplateMutation] = useMutation(CREATE_EMAIL_TEMPLATE, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_EMAIL_TEMPLATES, variables: { tenantId } }
    ],
  });

  const [updateTemplateMutation] = useMutation(UPDATE_EMAIL_TEMPLATE, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_EMAIL_TEMPLATES, variables: { tenantId } }
    ],
  });

  const [deleteTemplateMutation] = useMutation(DELETE_EMAIL_TEMPLATE, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_EMAIL_TEMPLATES, variables: { tenantId } }
    ],
  });

  const [configureProviderMutation] = useMutation(CONFIGURE_EMAIL_PROVIDER, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
    refetchQueries: [
      { query: GET_EMAIL_PROVIDERS, variables: { tenantId } }
    ],
  });

  const [testProviderMutation] = useMutation(TEST_EMAIL_PROVIDER, {
    errorPolicy: 'all',
    onError: (error) => setError(error.message),
  });

  // Real-time subscription for email events
  useEffect(() => {
    if (!enableRealtime || !tenantId) return;

    const subscription = apolloClient.subscribe({
      query: EMAIL_EVENTS,
      variables: { tenantId },
      errorPolicy: 'all',
    }).subscribe({
      next: (result) => {
        if (result.data?.emailEvents) {
          const event = result.data.emailEvents;
          console.log('Email event received:', event);
          
          // Handle email events (e.g., show notifications, update UI)
          if (event.type === 'template_created') {
            refetchTemplates();
          } else if (event.type === 'provider_configured') {
            refetchProviders();
          }
        }
      },
      error: (error) => {
        console.error('Email subscription error:', error);
      },
    });

    return () => subscription.unsubscribe();
  }, [enableRealtime, tenantId, apolloClient, refetchTemplates, refetchProviders]);

  // Email operations
  const sendEmail = useCallback(async (
    message: EmailMessage,
    options?: NotificationOptions
  ): Promise<CommunicationResult> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate email message
      if (!message.to || message.to.length === 0) {
        throw new Error('At least one recipient is required');
      }

      if (!message.subject) {
        throw new Error('Subject is required');
      }

      if (!message.text && !message.html) {
        throw new Error('Either text or HTML content is required');
      }

      // Validate email addresses
      const invalidEmails = message.to.filter(email => !CommunicationUtils.validateEmail(email));
      if (invalidEmails.length > 0) {
        throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      }

      // Validate CC emails if provided
      if (message.cc) {
        const invalidCCEmails = message.cc.filter(email => !CommunicationUtils.validateEmail(email));
        if (invalidCCEmails.length > 0) {
          throw new Error(`Invalid CC email addresses: ${invalidCCEmails.join(', ')}`);
        }
      }

      // Validate BCC emails if provided
      if (message.bcc) {
        const invalidBCCEmails = message.bcc.filter(email => !CommunicationUtils.validateEmail(email));
        if (invalidBCCEmails.length > 0) {
          throw new Error(`Invalid BCC email addresses: ${invalidBCCEmails.join(', ')}`);
        }
      }

      const { data } = await sendEmailMutation({
        variables: {
          tenantId,
          message,
          options,
        },
      });

      if (!data?.sendEmail) {
        throw new Error('Failed to send email');
      }

      return data.sendEmail;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendEmailMutation]);

  const sendEmailToUsers = useCallback(async (
    userIds: string[],
    notification: EmailNotification,
    options?: NotificationOptions
  ): Promise<BulkEmailResult> => {
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

      if (!notification.subject) {
        throw new Error('Subject is required');
      }

      if (!notification.message) {
        throw new Error('Message is required');
      }

      const { data } = await sendEmailToUsersMutation({
        variables: {
          tenantId,
          userIds,
          notification,
          options,
        },
      });

      if (!data?.sendEmailToUsers) {
        throw new Error('Failed to send emails to users');
      }

      return data.sendEmailToUsers;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, sendEmailToUsersMutation]);

  // Template management
  const getTemplates = useCallback(async (category?: string): Promise<EmailTemplate[]> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_EMAIL_TEMPLATES,
        variables: { tenantId, category },
        fetchPolicy: 'network-only',
      });

      return data?.getEmailTemplates || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, apolloClient]);

  const getTemplate = useCallback(async (templateName: string): Promise<EmailTemplate | null> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_EMAIL_TEMPLATE,
        variables: { tenantId, templateName },
        fetchPolicy: 'network-only',
      });

      return data?.getEmailTemplate || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, apolloClient]);

  const createTemplate = useCallback(async (template: EmailTemplate): Promise<void> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate template
      if (!template.name) {
        throw new Error('Template name is required');
      }

      if (!template.subject) {
        throw new Error('Template subject is required');
      }

      if (!template.htmlTemplate) {
        throw new Error('Template HTML content is required');
      }

      // Check for missing variables
      const subjectVariables = CommunicationUtils.extractVariablesFromTemplate(template.subject);
      const htmlVariables = CommunicationUtils.extractVariablesFromTemplate(template.htmlTemplate);
      const textVariables = template.textTemplate 
        ? CommunicationUtils.extractVariablesFromTemplate(template.textTemplate)
        : [];

      const allVariables = [...new Set([...subjectVariables, ...htmlVariables, ...textVariables])];
      
      const templateWithVariables = {
        ...template,
        variables: allVariables,
      };

      await createTemplateMutation({
        variables: {
          tenantId,
          template: templateWithVariables,
          createdBy: '',
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, createTemplateMutation]);

  const updateTemplate = useCallback(async (
    templateName: string,
    template: EmailTemplate
  ): Promise<void> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      // Validate template
      if (!template.subject) {
        throw new Error('Template subject is required');
      }

      if (!template.htmlTemplate) {
        throw new Error('Template HTML content is required');
      }

      // Update variables
      const subjectVariables = CommunicationUtils.extractVariablesFromTemplate(template.subject);
      const htmlVariables = CommunicationUtils.extractVariablesFromTemplate(template.htmlTemplate);
      const textVariables = template.textTemplate 
        ? CommunicationUtils.extractVariablesFromTemplate(template.textTemplate)
        : [];

      const allVariables = [...new Set([...subjectVariables, ...htmlVariables, ...textVariables])];
      
      const templateWithVariables = {
        ...template,
        variables: allVariables,
      };

      await updateTemplateMutation({
        variables: {
          tenantId,
          templateName,
          template: templateWithVariables,
          updatedBy: '',
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, updateTemplateMutation]);

  const deleteTemplate = useCallback(async (templateName: string): Promise<void> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    setLoading(true);
    setError(null);

    try {
      await deleteTemplateMutation({
        variables: {
          tenantId,
          templateName,
          deletedBy: '',
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, deleteTemplateMutation]);

  // Provider management
  const getProviders = useCallback(async (): Promise<EmailProvider[]> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    try {
      const { data } = await refetchProviders();
      return data?.getEmailProviders || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    }
  }, [tenantId, refetchProviders]);

  const configureProvider = useCallback(async (provider: EmailProviderConfig): Promise<void> => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
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
      const config = provider.configuration as Record<string, unknown>;
      switch (provider.type) {
        case 'sendgrid':
          if (!config.apiKey || !config.fromEmail) {
            throw new Error('SendGrid API key and from email are required');
          }
          break;
        case 'ses':
          if (!config.accessKeyId || !config.secretAccessKey || !config.region || !config.fromEmail) {
            throw new Error('AWS SES credentials, region, and from email are required');
          }
          break;
        case 'smtp': {
          const auth = config.auth as Record<string, unknown> | undefined;
          if (!config.host || !auth?.user || !auth?.pass || !config.fromEmail) {
            throw new Error('SMTP host, credentials, and from email are required');
          }
          break;
        }
        case 'mailgun':
          if (!config.apiKey || !config.domain || !config.fromEmail) {
            throw new Error('Mailgun API key, domain, and from email are required');
          }
          break;
        case 'postmark':
          if (!config.serverToken || !config.fromEmail) {
            throw new Error('Postmark server token and from email are required');
          }
          break;
      }

      // Validate from email
      if (config.fromEmail && typeof config.fromEmail === 'string' && !CommunicationUtils.validateEmail(config.fromEmail)) {
        throw new Error('Invalid from email address');
      }

      await configureProviderMutation({
        variables: {
          tenantId,
          provider,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tenantId, configureProviderMutation]);

  const testProvider = useCallback(async (provider: EmailProviderConfig): Promise<CommunicationResult> => {
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

      if (!data?.testEmailProvider) {
        throw new Error('Failed to test email provider');
      }

      return data.testEmailProvider;
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
    // Email operations
    sendEmail,
    sendEmailToUsers,
    
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