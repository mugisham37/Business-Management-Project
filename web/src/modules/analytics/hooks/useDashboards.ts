/**
 * Dashboards Hook
 * Comprehensive hook for dashboard management and widget data
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import {
  GET_DASHBOARD,
  GET_WIDGET_DATA,
} from '@/graphql/queries/analytics-queries';
import {
  CREATE_DASHBOARD,
} from '@/graphql/mutations/analytics-mutations';
import {
  DASHBOARD_UPDATED,
  WIDGET_DATA_UPDATED,
} from '@/graphql/subscriptions/analytics-subscriptions';
import type {
  Dashboard,
  WidgetData,
  UseDashboardsResult,
} from '@/types/analytics';

export function useDashboards(): UseDashboardsResult {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | undefined>();
  const [widgetData, setWidgetData] = useState<Record<string, WidgetData>>({});
  const [widgetLoading, setWidgetLoading] = useState<Record<string, boolean>>({});

  // Mutations
  const [createDashboardMutation, { loading: createLoading }] = useMutation(CREATE_DASHBOARD);

  // Dashboard query (lazy loaded)
  const [getDashboardQuery, { loading: dashboardLoading, error: dashboardError }] = useQuery(
    GET_DASHBOARD,
    { skip: true }
  );

  // Widget data query (lazy loaded)
  const [getWidgetDataQuery, { loading: widgetDataLoading, error: widgetError }] = useQuery(
    GET_WIDGET_DATA,
    { skip: true }
  );

  // Subscriptions for real-time updates
  const { data: dashboardSubscriptionData } = useSubscription(DASHBOARD_UPDATED, {
    skip: !currentDashboard?.id,
    variables: { dashboardId: currentDashboard?.id },
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.dashboardUpdated) {
        const updatedDashboard = subscriptionData.data.dashboardUpdated;
        setCurrentDashboard(updatedDashboard);
        setDashboards(prev => 
          prev.map(d => d.id === updatedDashboard.id ? updatedDashboard : d)
        );
      }
    },
  });

  // Actions
  const getDashboard = useCallback(async (dashboardId: string): Promise<Dashboard> => {
    try {
      const { data } = await getDashboardQuery({
        variables: { dashboardId },
      });
      
      if (data?.getDashboard) {
        setCurrentDashboard(data.getDashboard);
        return data.getDashboard;
      }
      throw new Error(`Dashboard not found: ${dashboardId}`);
    } catch (error) {
      console.error('Failed to get dashboard:', error);
      throw error;
    }
  }, [getDashboardQuery]);

  const createDashboard = useCallback(async (name: string, description?: string): Promise<Dashboard> => {
    try {
      const { data } = await createDashboardMutation({
        variables: { name, description },
      });
      
      if (data?.createDashboard) {
        setDashboards(prev => [...prev, data.createDashboard]);
        return data.createDashboard;
      }
      throw new Error('Failed to create dashboard');
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      throw error;
    }
  }, [createDashboardMutation]);

  const getWidgetData = useCallback(async (widgetId: string): Promise<WidgetData> => {
    try {
      setWidgetLoading(prev => ({ ...prev, [widgetId]: true }));
      
      const { data } = await getWidgetDataQuery({
        variables: { widgetId },
      });
      
      if (data?.getWidgetData) {
        setWidgetData(prev => ({ ...prev, [widgetId]: data.getWidgetData }));
        return data.getWidgetData;
      }
      throw new Error(`Widget data not found: ${widgetId}`);
    } catch (error) {
      console.error('Failed to get widget data:', error);
      throw error;
    } finally {
      setWidgetLoading(prev => ({ ...prev, [widgetId]: false }));
    }
  }, [getWidgetDataQuery]);

  // Subscription management
  const subscribeToDashboard = useCallback((dashboardId: string) => {
    // Subscription is automatically managed by useSubscription hook
    // This function exists for API consistency
  }, []);

  const unsubscribeFromDashboard = useCallback((dashboardId: string) => {
    // Subscription cleanup is handled by React
    // This function exists for API consistency
  }, []);

  return {
    // Data
    dashboards,
    currentDashboard,
    widgetData,
    
    // Loading states
    dashboardsLoading: false, // Would be true if we had a dashboards list query
    dashboardLoading,
    widgetLoading,
    
    // Error states
    dashboardsError: undefined,
    dashboardError: dashboardError || undefined,
    widgetError: widgetError || undefined,
    
    // Actions
    getDashboard,
    createDashboard,
    getWidgetData,
    
    // Real-time subscriptions
    subscribeToDashboard,
    unsubscribeFromDashboard,
  };
}