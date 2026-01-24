/**
 * Analytics Hook
 * Comprehensive hook for analytics data and operations
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useSubscription, ApolloError } from '@apollo/client';
import {
  GET_METRICS,
  GET_KPIS,
  GET_TRENDS,
} from '@/graphql/queries/analytics-queries';
import {
  INITIALIZE_ANALYTICS,
  TRACK_EVENT,
} from '@/graphql/mutations/analytics-mutations';
import {
  METRICS_UPDATED,
} from '@/graphql/subscriptions/analytics-subscriptions';
import type {
  Metric,
  KPI,
  Trend,
  MetricsFilter,
  KPIFilter,
  TrendFilter,
  UseAnalyticsResult,
  AnalyticsConfiguration,
} from '@/types/analytics';

export function useAnalytics(): UseAnalyticsResult {
  // Queries
  const {
    data: metricsData,
    loading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery(GET_METRICS, {
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: kpisData,
    loading: kpisLoading,
    error: kpisError,
    refetch: refetchKPIs,
  } = useQuery(GET_KPIS, {
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: trendsData,
    loading: trendsLoading,
    error: trendsError,
    refetch: refetchTrends,
  } = useQuery(GET_TRENDS, {
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  // Use local state only for subscription updates
  const [metrics, setMetrics] = useState<Metric[]>(metricsData?.getMetrics || []);

  // Mutations
  const [initializeAnalyticsMutation] = useMutation(INITIALIZE_ANALYTICS);
  const [trackEventMutation] = useMutation(TRACK_EVENT);

  // Subscriptions
  useSubscription(METRICS_UPDATED, {
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.metricsUpdated) {
        const updatedMetric = subscriptionData.data.metricsUpdated;
        setMetrics(prev => {
          const existingIndex = prev.findIndex((m: Metric) => m.id === updatedMetric.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = updatedMetric;
            return updated;
          }
          return [...prev, updatedMetric];
        });
      }
    },
  });

  // Actions
  const getMetrics = useCallback(async (filter?: MetricsFilter): Promise<Metric[]> => {
    try {
      const { data } = await refetchMetrics({ filter });
      return data?.getMetrics || [];
    } catch (error) {
      console.error('Failed to get metrics:', error);
      throw error;
    }
  }, [refetchMetrics]);

  const getKPIs = useCallback(async (filter?: KPIFilter): Promise<KPI[]> => {
    try {
      const { data } = await refetchKPIs({ filter });
      return data?.getKPIs || [];
    } catch (error) {
      console.error('Failed to get KPIs:', error);
      throw error;
    }
  }, [refetchKPIs]);

  const getTrends = useCallback(async (filter?: TrendFilter): Promise<Trend[]> => {
    try {
      const { data } = await refetchTrends({ filter });
      return data?.getTrends || [];
    } catch (error) {
      console.error('Failed to get trends:', error);
      throw error;
    }
  }, [refetchTrends]);

  const trackEvent = useCallback(async (eventName: string, eventData: Record<string, unknown>): Promise<void> => {
    try {
      await trackEventMutation({
        variables: {
          eventName,
          eventData: JSON.stringify(eventData),
        },
      });
    } catch (error) {
      console.error('Failed to track event:', error);
      throw error;
    }
  }, [trackEventMutation]);

  const initializeAnalytics = useCallback(async (config: AnalyticsConfiguration): Promise<void> => {
    try {
      await initializeAnalyticsMutation({
        variables: {
          config: JSON.stringify(config),
        },
      });
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
      throw error;
    }
  }, [initializeAnalyticsMutation]);

  // Subscription management
  const subscribeToMetrics = useCallback(() => {
    // Subscription is automatically managed by useSubscription hook
  }, []);

  const unsubscribeFromMetrics = useCallback(() => {
    // Subscription cleanup is handled by React
  }, []);

  return {
    // Data
    metrics,
    kpis: kpisData?.getKPIs || [],
    trends: trendsData?.getTrends || [],
    
    // Loading states
    metricsLoading,
    kpisLoading,
    trendsLoading,
    
    // Error states - cast to undefined if not present, as ApolloError is compatible with Error
    metricsError: metricsError as (ApolloError | undefined),
    kpisError: kpisError as (ApolloError | undefined),
    trendsError: trendsError as (ApolloError | undefined),
    
    // Actions
    getMetrics,
    getKPIs,
    getTrends,
    trackEvent,
    initializeAnalytics,
    
    // Real-time subscriptions
    subscribeToMetrics,
    unsubscribeFromMetrics,
  };
}