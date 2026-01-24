import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  Communication, 
  CreateCommunicationInput,
  ScheduleCommunicationInput,
  UseCommunicationsResult,
  CommunicationType as CommunicationTypeEnum,
} from '@/types/crm';
import {
  GET_COMMUNICATIONS,
  GET_COMMUNICATION_TIMELINE,
} from '@/graphql/queries/crm-queries';
import {
  RECORD_COMMUNICATION,
  SCHEDULE_COMMUNICATION,
} from '@/graphql/mutations/crm-mutations';
import {
  COMMUNICATION_SCHEDULED,
} from '@/graphql/subscriptions/crm-subscriptions';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from './useErrorHandler';

/**
 * Hook for managing customer communications
 */
export function useCommunications(
  customerId?: string,
  employeeId?: string,
  type?: string,
  startDate?: Date,
  endDate?: Date
): UseCommunicationsResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  // Query communications with filters
  const { 
    data, 
    loading, 
    error, 
    refetch 
  } = useQuery(GET_COMMUNICATIONS, {
    variables: { 
      customerId, 
      employeeId, 
      type, 
      startDate, 
      endDate 
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch communications');
    },
  });

  // Mutations
  const [recordCommunicationMutation] = useMutation(RECORD_COMMUNICATION, {
    onError: (error) => handleError(error, 'Failed to record communication'),
    refetchQueries: [{ 
      query: GET_COMMUNICATIONS, 
      variables: { customerId, employeeId, type, startDate, endDate } 
    }],
  });

  const [scheduleCommunicationMutation] = useMutation(SCHEDULE_COMMUNICATION, {
    onError: (error) => handleError(error, 'Failed to schedule communication'),
    refetchQueries: [{ 
      query: GET_COMMUNICATIONS, 
      variables: { customerId, employeeId, type, startDate, endDate } 
    }],
  });

  // Subscription for real-time updates
  useSubscription(COMMUNICATION_SCHEDULED, {
    onData: ({ data }) => {
      if (data?.data?.communicationScheduled) {
        refetch();
      }
    },
  });

  // Callbacks
  const recordCommunication = useCallback(async (
    input: CreateCommunicationInput
  ): Promise<Communication> => {
    try {
      const result = await recordCommunicationMutation({
        variables: { input },
        optimisticResponse: {
          recordCommunication: {
            __typename: 'Communication',
            id: `temp-${Date.now()}`,
            ...input,
            status: 'completed',
            completedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.recordCommunication;
    } catch (error) {
      throw error;
    }
  }, [recordCommunicationMutation]);

  const scheduleCommunication = useCallback(async (
    input: ScheduleCommunicationInput
  ): Promise<Communication> => {
    try {
      const result = await scheduleCommunicationMutation({
        variables: { input },
        optimisticResponse: {
          scheduleCommunication: {
            __typename: 'Communication',
            id: `temp-${Date.now()}`,
            ...input,
            direction: 'outbound',
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.scheduleCommunication;
    } catch (error) {
      throw error;
    }
  }, [scheduleCommunicationMutation]);

  const getCommunicationTimeline = useCallback(async (
    customerId: string, 
    limit = 50
  ): Promise<Communication[]> => {
    try {
      const { data } = await refetch({
        query: GET_COMMUNICATION_TIMELINE,
        variables: { customerId, limit },
      });

      return data.getCommunicationTimeline;
    } catch (error) {
      throw error;
    }
  }, [refetch]);

  return {
    communications: data?.getCommunications || [],
    loading,
    error: error ? new Error(error.message) : undefined,
    recordCommunication,
    scheduleCommunication,
    getCommunicationTimeline,
  };
}

/**
 * Hook for customer-specific communication timeline
 */
export function useCustomerCommunications(customerId: string, limit = 50) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_COMMUNICATION_TIMELINE, {
    variables: { customerId, limit },
    skip: !currentTenant?.id || !customerId,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch customer communication timeline');
    },
  });
}

/**
 * Hook for communication statistics and analytics
 */
export function useCommunicationStats() {
  const { communications } = useCommunications();

  const stats = {
    totalCommunications: communications.length,
    completedCommunications: communications.filter(c => c.status === 'completed').length,
    scheduledCommunications: communications.filter(c => c.status === 'scheduled').length,
    failedCommunications: communications.filter(c => c.status === 'failed').length,
    
    communicationsByType: communications.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    
    communicationsByDirection: communications.reduce((acc, c) => {
      acc[c.direction] = (acc[c.direction] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    
    averageResponseTime: 0, // Would need to calculate based on inbound/outbound pairs
    
    recentActivity: communications
      .filter(c => {
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        return new Date(c.createdAt) > dayAgo;
      })
      .length,
      
    topCustomers: communications
      .reduce((acc, c) => {
        acc[c.customerId] = (acc[c.customerId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
  };

  return stats;
}

/**
 * Hook for communication templates and automation
 */
export function useCommunicationTemplates() {
  const templates = useMemo(() => ({
    welcome: {
      type: CommunicationTypeEnum.EMAIL,
      subject: 'Welcome to our loyalty program!',
      content: 'Thank you for joining our loyalty program. You\'ve earned {{points}} points to get started!',
    },
    pointsAwarded: {
      type: CommunicationTypeEnum.EMAIL,
      subject: 'Points awarded for your recent purchase',
      content: 'Great news! You\'ve earned {{points}} points from your recent purchase. Your total balance is now {{totalPoints}} points.',
    },
    contractExpiring: {
      type: CommunicationTypeEnum.EMAIL,
      subject: 'Contract renewal reminder',
      content: 'Your contract is set to expire on {{expiryDate}}. Please contact us to discuss renewal options.',
    },
    churnRisk: {
      type: CommunicationTypeEnum.EMAIL,
      subject: 'We miss you!',
      content: 'We noticed you haven\'t made a purchase recently. Here\'s a special offer just for you: {{offer}}',
    },
    campaignInvitation: {
      type: CommunicationTypeEnum.EMAIL,
      subject: 'Exclusive campaign invitation',
      content: 'You\'re invited to participate in our {{campaignName}} campaign. Earn {{multiplier}}x points on all purchases!',
    },
  }), []);

  const generateFromTemplate = useCallback((
    templateKey: keyof typeof templates,
    variables: Record<string, string | number>
  ) => {
    const template = templates[templateKey];
    if (!template) return null;

    let content = template.content;
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });

    return {
      ...template,
      content,
    };
  }, [templates]);

  return {
    templates,
    generateFromTemplate,
  };
}

/**
 * Hook for communication scheduling and automation
 */
export function useCommunicationAutomation() {
  const { scheduleCommunication } = useCommunications();
  const { generateFromTemplate } = useCommunicationTemplates();

  const scheduleWelcomeEmail = useCallback(async (
    customerId: string,
    points: number
  ) => {
    const template = generateFromTemplate('welcome', { points });
    if (!template) return;

    return scheduleCommunication({
      customerId,
      type: template.type,
      subject: template.subject,
      content: template.content,
      scheduledAt: new Date(),
    });
  }, [scheduleCommunication, generateFromTemplate]);

  const schedulePointsAwardedEmail = useCallback(async (
    customerId: string,
    points: number,
    totalPoints: number
  ) => {
    const template = generateFromTemplate('pointsAwarded', { points, totalPoints });
    if (!template) return;

    return scheduleCommunication({
      customerId,
      type: template.type,
      subject: template.subject,
      content: template.content,
      scheduledAt: new Date(),
    });
  }, [scheduleCommunication, generateFromTemplate]);

  const scheduleContractExpiryReminder = useCallback(async (
    customerId: string,
    expiryDate: Date,
    daysBefore = 30
  ) => {
    const template = generateFromTemplate('contractExpiring', { 
      expiryDate: expiryDate.toLocaleDateString() 
    });
    if (!template) return;

    const reminderDate = new Date(expiryDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);

    return scheduleCommunication({
      customerId,
      type: template.type,
      subject: template.subject,
      content: template.content,
      scheduledAt: reminderDate,
    });
  }, [scheduleCommunication, generateFromTemplate]);

  const scheduleChurnPreventionEmail = useCallback(async (
    customerId: string,
    offer: string
  ) => {
    const template = generateFromTemplate('churnRisk', { offer });
    if (!template) return;

    return scheduleCommunication({
      customerId,
      type: template.type,
      subject: template.subject,
      content: template.content,
      scheduledAt: new Date(),
    });
  }, [scheduleCommunication, generateFromTemplate]);

  const scheduleCampaignInvitation = useCallback(async (
    customerId: string,
    campaignName: string,
    multiplier: number
  ) => {
    const template = generateFromTemplate('campaignInvitation', { 
      campaignName, 
      multiplier 
    });
    if (!template) return;

    return scheduleCommunication({
      customerId,
      type: template.type,
      subject: template.subject,
      content: template.content,
      scheduledAt: new Date(),
    });
  }, [scheduleCommunication, generateFromTemplate]);

  return {
    scheduleWelcomeEmail,
    schedulePointsAwardedEmail,
    scheduleContractExpiryReminder,
    scheduleChurnPreventionEmail,
    scheduleCampaignInvitation,
  };
}