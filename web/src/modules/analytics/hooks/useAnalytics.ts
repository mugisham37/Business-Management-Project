/**
 * Analytics Hook
 * Comprehensive hook for analytics data and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import {
  GET_METRICS,
  GET_KPIS,
  GET_TRENDS,
  GET_ANALYTICS_HEALTH,
  GET_AVAILABLE_FIELDS,
  EXECUTE_ANALYTICS_QUERY,
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
} from '@/types/analytics';

export function useAnalytics(): UseAnalyticsResult {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [kpis, setKPIs] = useState<KPI[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);

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

  // Mutations
  const [initializeAnalyticsMutation] = useMutation(INITIALIZE_ANALYTICS);
  const [trackEventMutation] = useMutation(TRACK_EVENT);

  // Subscriptions
  const { data: metricsSubscriptionData } = useSubscription(METRICS_UPDATED, {
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.metricsUpdated) {
        const updatedMetric = subscriptionData.data.metricsUpdated;
        setMetrics(prev => {
          const existingIndex = prev.findIndex(m => m.id === updatedMetric.id);
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

  // Update state when query data changes
  useEffect(() => {
    if (metricsData?.getMetrics) {
      setMetrics(metricsData.getMetrics);
    }
  }, [metricsData]);

  useEffect(() => {
    if (kpisData?.getKPIs) {
      setKPIs(kpisData.getKPIs);
    }
  }, [kpisData]);

  useEffect(() => {
    if (trendsData?.getTrends) {
      setTrends(trendsData.getTrends);
    }
  }, [trendsData]);

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

  const trackEvent = useCallback(async (eventName: string, eventData: any): Promise<void> => {
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

  const initializeAnalytics = useCallback(async (config: any): Promise<void> => {
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
    kpis,
    trends,
    
    // Loading states
    metricsLoading,
    kpisLoading,
    trendsLoading,
    
    // Error states
    metricsError: metricsError || undefined,
    kpisError: kpisError || undefined,
    trendsError: trendsError || undefined,
    
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