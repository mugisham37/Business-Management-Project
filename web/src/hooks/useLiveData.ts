/**
 * Live Data Hooks
 * Specialized hooks for live business data (inventory, sales, analytics, customer activity)
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useSubscription } from '@/lib/subscriptions';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  LiveInventoryLevel,
  InventorySubscriptionInput,
  SalesSubscriptionInput,
  CustomerActivitySubscriptionInput,
  AnalyticsSubscriptionInput,
  InventoryAlertConfigInput,
  SalesTargetInput,
  CreateAnalyticsAlertInput,
} from '@/types/realtime';

// Import GraphQL operations
import {
  LIVE_INVENTORY_LEVELS,
  INVENTORY_DASHBOARD,
  SALES_DASHBOARD,
  LIVE_SALES_METRICS,
  CUSTOMER_ACTIVITY_FEED,
  CUSTOMER_ENGAGEMENT_METRICS,
  ANALYTICS_OVERVIEW,
  KPI_METRICS,
  ANALYTICS_ALERTS,
} from '@/graphql/queries/realtime-queries';

import {
  SUBSCRIBE_TO_INVENTORY_UPDATES,
  SUBSCRIBE_TO_SALES_UPDATES,
  SUBSCRIBE_TO_CUSTOMER_ACTIVITY,
  SUBSCRIBE_TO_ANALYTICS_UPDATES,
  CONFIGURE_INVENTORY_ALERTS,
  SET_SALES_TARGETS,
  CREATE_ANALYTICS_ALERT,
} from '@/graphql/mutations/realtime-mutations';

import {
  INVENTORY_UPDATED,
  LOW_STOCK_ALERT,
  SALES_UPDATED,
  CUSTOMER_ACTIVITY_UPDATED,
  ANALYTICS_UPDATED,
  ALERT_TRIGGERED,
} from '@/graphql/subscriptions/realtime-notifications';

/**
 * Live Inventory Hook
 * Manages real-time inventory levels and alerts
 */
export function useLiveInventory(productIds?: string[], locationId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [inventoryLevels, setInventoryLevels] = useState<LiveInventoryLevel[]>([]);
  const [lowStockItems, setLowStockItems] = useState<Record<string, unknown>[]>([]);

  // Queries
  const { loading: inventoryLoading, refetch: refetchInventory } = useQuery(
    LIVE_INVENTORY_LEVELS,
    {
      variables: { productIds: productIds || [], locationId },
      skip: !currentTenant?.id || !productIds?.length,
      pollInterval: 30000, // Poll every 30 seconds as fallback
    }
  );

  const { data: dashboardData, loading: dashboardLoading } = useQuery(
    INVENTORY_DASHBOARD,
    {
      variables: { locationId },
      skip: !currentTenant?.id,
      pollInterval: 60000, // Poll every minute
    }
  );

  // Mutations
  const [subscribeToInventoryMutation] = useMutation(SUBSCRIBE_TO_INVENTORY_UPDATES);
  const [configureAlertsMutation] = useMutation(CONFIGURE_INVENTORY_ALERTS);

  // Real-time subscriptions (keep subscription references active)
  useSubscription(INVENTORY_UPDATED, {
    onData: (data) => {
      if (data) {
        try {
          const update = JSON.parse(data as string);
          handleInventoryUpdate(update);
        } catch (error) {
          console.error('Failed to parse inventory update:', error);
        }
      }
    },
  });

  useSubscription(LOW_STOCK_ALERT, {
    onData: (data) => {
      if (data) {
        try {
          const alert = JSON.parse(data as string);
          handleLowStockAlert(alert);
        } catch (error) {
          console.error('Failed to parse low stock alert:', error);
        }
      }
    },
  });

  // Handle real-time inventory updates
  const handleInventoryUpdate = useCallback((update: Record<string, unknown>) => {
    setInventoryLevels(prev => {
      const index = prev.findIndex(
        item => item.productId === update.productId && item.locationId === update.locationId
      );
      
      if (index >= 0) {
        const newQuantity = typeof update.newQuantity === 'number' ? update.newQuantity : 0;
        const updated = [...prev];
        const existing = updated[index];
        if (existing) {
          updated[index] = {
            ...existing,
            currentLevel: newQuantity,
            availableLevel: newQuantity - (existing.reservedLevel ?? 0),
            lastUpdated: new Date(),
            status: newQuantity <= (existing.reorderPoint ?? 0) ? 'low_stock' : 'in_stock',
          };
        }
        return updated;
      }
      
      return prev;
    });
  }, []);

  // Handle low stock alerts
  const handleLowStockAlert = useCallback((alert: Record<string, unknown>) => {
    setLowStockItems(prev => {
      const exists = prev.some(item => 
        item.productId === alert.productId && item.locationId === alert.locationId
      );
      
      if (!exists) {
        return [...prev, alert];
      }
      
      return prev;
    });
  }, []);

  // Use synced data or fallback to state (data is updated via Apollo subscriptions)

  // Methods
  const subscribeToUpdates = useCallback(async (input: InventorySubscriptionInput) => {
    try {
      const result = await subscribeToInventoryMutation({ variables: { input } });
      return result.data?.subscribeToInventoryUpdates;
    } catch (error) {
      console.error('Failed to subscribe to inventory updates:', error);
      throw error;
    }
  }, [subscribeToInventoryMutation]);

  const configureAlerts = useCallback(async (input: InventoryAlertConfigInput) => {
    try {
      const result = await configureAlertsMutation({ variables: { input } });
      return result.data?.configureInventoryAlerts;
    } catch (error) {
      console.error('Failed to configure inventory alerts:', error);
      throw error;
    }
  }, [configureAlertsMutation]);

  const dismissLowStockAlert = useCallback((productId: string, locationId: string) => {
    setLowStockItems(prev => 
      prev.filter(item => !(item.productId === productId && item.locationId === locationId))
    );
  }, []);

  // Enhanced inventory statistics
  const inventoryStats = useMemo(() => {
    const totalItems = inventoryLevels.length;
    const lowStockCount = inventoryLevels.filter(item => item.status === 'low_stock').length;
    const outOfStockCount = inventoryLevels.filter(item => item.currentLevel <= 0).length;
    const totalValue = inventoryLevels.reduce((sum, item) => sum + (item.currentLevel * (item.averageCost || 0)), 0);
    
    return {
      totalItems,
      lowStockCount,
      outOfStockCount,
      totalValue,
      alertsCount: lowStockItems.length,
    };
  }, [inventoryLevels, lowStockItems]);

  return {
    // Data
    inventoryLevels,
    dashboardData: dashboardData?.inventoryDashboard,
    lowStockItems,
    inventoryStats,
    
    // Loading states
    inventoryLoading,
    dashboardLoading,
    
    // Methods
    subscribeToUpdates,
    configureAlerts,
    dismissLowStockAlert,
    refetchInventory,
  };
}

/**
 * Live Sales Hook
 * Manages real-time sales data and metrics
 */
export function useLiveSales(locationId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [salesMetrics, setSalesMetrics] = useState<Record<string, unknown> | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Record<string, unknown>[]>([]);

  // Queries
  const { data: dashboardData, loading: dashboardLoading, refetch: refetchDashboard } = useQuery(
    SALES_DASHBOARD,
    {
      variables: { locationId },
      skip: !currentTenant?.id,
      pollInterval: 30000, // Poll every 30 seconds
    }
  );

  const { loading: metricsLoading } = useQuery(
    LIVE_SALES_METRICS,
    {
      variables: { locationId },
      skip: !currentTenant?.id,
      pollInterval: 60000, // Poll every minute
    }
  );

  // Mutations
  const [subscribeToSalesMutation] = useMutation(SUBSCRIBE_TO_SALES_UPDATES);
  const [setSalesTargetsMutation] = useMutation(SET_SALES_TARGETS);

  // Real-time subscriptions (keep subscription references active)
  useSubscription(SALES_UPDATED, {
    onData: (data) => {
      if (data) {
        try {
          const update = JSON.parse(data as string);
          handleSalesUpdate(update);
        } catch (error) {
          console.error('Failed to parse sales update:', error);
        }
      }
    },
  });

  // Handle real-time sales updates
  const handleSalesUpdate = useCallback((update: Record<string, unknown>) => {
    if (update.type === 'transaction_created') {
      setRecentTransactions(prev => [update, ...prev.slice(0, 49)]); // Keep last 50
      
      // Update metrics
      setSalesMetrics((prev: Record<string, unknown> | null) => {
        if (!prev) return prev;
        
        const prevTotal = typeof prev.totalSales === 'number' ? prev.totalSales : 0;
        const prevCount = typeof prev.transactionCount === 'number' ? prev.transactionCount : 0;
        const updateTotal = typeof update.total === 'number' ? update.total : 0;
        const newTotal = prevTotal + updateTotal;
        const newCount = prevCount + 1;
        
        return {
          ...prev,
          totalSales: newTotal,
          transactionCount: newCount,
          averageTransactionValue: newTotal / newCount,
          lastUpdated: new Date(),
        };
      });
    }
  }, []);

  // Use synced data from Apollo subscription or fallback to state

  // Methods
  const subscribeToUpdates = useCallback(async (input: SalesSubscriptionInput) => {
    try {
      const result = await subscribeToSalesMutation({ variables: { input } });
      return result.data?.subscribeToSalesUpdates;
    } catch (error) {
      console.error('Failed to subscribe to sales updates:', error);
      throw error;
    }
  }, [subscribeToSalesMutation]);

  const setSalesTargets = useCallback(async (input: SalesTargetInput) => {
    try {
      const result = await setSalesTargetsMutation({ variables: { input } });
      return result.data?.setSalesTargets;
    } catch (error) {
      console.error('Failed to set sales targets:', error);
      throw error;
    }
  }, [setSalesTargetsMutation]);

  return {
    // Data
    dashboard: dashboardData?.salesDashboard,
    metrics: salesMetrics,
    recentTransactions,
    
    // Loading states
    dashboardLoading,
    metricsLoading,
    
    // Methods
    subscribeToUpdates,
    setSalesTargets,
    refetchDashboard,
  };
}

/**
 * Live Customer Activity Hook
 * Manages real-time customer activity and engagement
 */
export function useLiveCustomerActivity(customerId?: string, locationId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [activityFeed, setActivityFeed] = useState<Record<string, unknown>[]>([]);

  // Queries
  const { loading: feedLoading, refetch: refetchFeed } = useQuery(
    CUSTOMER_ACTIVITY_FEED,
    {
      variables: { limit: 50, customerId, locationId },
      skip: !currentTenant?.id,
      pollInterval: 30000, // Poll every 30 seconds
    }
  );

  const { loading: metricsLoading2 } = useQuery(
    CUSTOMER_ENGAGEMENT_METRICS,
    {
      skip: !currentTenant?.id,
      pollInterval: 300000, // Poll every 5 minutes
    }
  );

  // Mutations
  const [subscribeToActivityMutation] = useMutation(SUBSCRIBE_TO_CUSTOMER_ACTIVITY);

  // Real-time subscriptions (keep subscription references active)
  useSubscription(CUSTOMER_ACTIVITY_UPDATED, {
    onData: (data) => {
      if (data) {
        try {
          const activity = JSON.parse(data as string);
          handleActivityUpdate(activity);
        } catch (error) {
          console.error('Failed to parse customer activity update:', error);
        }
      }
    },
  });

  // Handle real-time activity updates
  const handleActivityUpdate = useCallback((activity: Record<string, unknown>) => {
    // Filter by customerId if specified
    if (customerId && activity.customerId !== customerId) {
      return;
    }

    // Filter by locationId if specified
    if (locationId && activity.locationId !== locationId) {
      return;
    }

    setActivityFeed(prev => [activity, ...prev.slice(0, 49)]); // Keep last 50
  }, [customerId, locationId]);

  // Activity feed from subscription or state

  // Engagement metrics from subscription or state

  // Methods
  const subscribeToUpdates = useCallback(async (input: CustomerActivitySubscriptionInput) => {
    try {
      const result = await subscribeToActivityMutation({ variables: { input } });
      return result.data?.subscribeToCustomerActivity;
    } catch (error) {
      console.error('Failed to subscribe to customer activity:', error);
      throw error;
    }
  }, [subscribeToActivityMutation]);

  return {
    // Data
    activityFeed,
    
    // Loading states
    feedLoading,
    metricsLoading: metricsLoading2,
    
    // Methods
    subscribeToUpdates,
    refetchFeed,
  };
}

/**
 * Live Analytics Hook
 * Manages real-time analytics and KPI monitoring
 */
export function useLiveAnalytics(locationId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [kpiMetrics, setKpiMetrics] = useState<Record<string, unknown>[]>([]);
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);

  // Queries
  const { data: overviewData, loading: overviewLoading, refetch: refetchOverview } = useQuery(
    ANALYTICS_OVERVIEW,
    {
      variables: { locationId },
      skip: !currentTenant?.id,
      pollInterval: 60000, // Poll every minute
    }
  );

  const { loading: kpiLoading, refetch: refetchKPI } = useQuery(
    KPI_METRICS,
    {
      variables: { locationId },
      skip: !currentTenant?.id,
      pollInterval: 30000, // Poll every 30 seconds
    }
  );

  const { loading: alertsLoading } = useQuery(
    ANALYTICS_ALERTS,
    {
      variables: { limit: 50, locationId },
      skip: !currentTenant?.id,
      pollInterval: 60000, // Poll every minute
    }
  );

  // Mutations
  const [subscribeToAnalyticsMutation] = useMutation(SUBSCRIBE_TO_ANALYTICS_UPDATES);
  const [createAlertMutation] = useMutation(CREATE_ANALYTICS_ALERT);

  // Real-time subscriptions (keep subscription references active)
  useSubscription(ANALYTICS_UPDATED, {
    onData: (data) => {
      if (data) {
        try {
          const update = JSON.parse(data as string);
          handleAnalyticsUpdate(update);
        } catch (error) {
          console.error('Failed to parse analytics update:', error);
        }
      }
    },
  });

  useSubscription(ALERT_TRIGGERED, {
    onData: (data) => {
      if (data) {
        try {
          const alert = JSON.parse(data as string);
          handleAlertTriggered(alert);
        } catch (error) {
          console.error('Failed to parse alert:', error);
        }
      }
    },
  });

  // Handle real-time analytics updates
  const handleAnalyticsUpdate = useCallback((update: Record<string, unknown>) => {
    if (update.type === 'kpi_update') {
      setKpiMetrics(prev => {
        const metricName = typeof update.metric === 'object' && update.metric !== null && 'name' in update.metric 
          ? (update.metric as Record<string, unknown>).name
          : null;
        const index = prev.findIndex(metric => metric.name === metricName);
        
        if (index >= 0 && typeof update.metric === 'object' && update.metric !== null) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...(update.metric as Record<string, unknown>) };
          return updated;
        }
        
        return typeof update.metric === 'object' && update.metric !== null 
          ? [...prev, update.metric as Record<string, unknown>]
          : prev;
      });
    }
  }, []);

  // Handle alert triggers
  const handleAlertTriggered = useCallback((alert: Record<string, unknown>) => {
    setAlerts(prev => [alert, ...prev.slice(0, 49)]); // Keep last 50
  }, []);

  // KPI metrics from subscription or state

  // Alerts from subscription or state

  // Methods
  const subscribeToUpdates = useCallback(async (input: AnalyticsSubscriptionInput) => {
    try {
      const result = await subscribeToAnalyticsMutation({ variables: { input } });
      return result.data?.subscribeToAnalyticsUpdates;
    } catch (error) {
      console.error('Failed to subscribe to analytics updates:', error);
      throw error;
    }
  }, [subscribeToAnalyticsMutation]);

  const createAlert = useCallback(async (input: CreateAnalyticsAlertInput) => {
    try {
      const result = await createAlertMutation({ variables: { input } });
      return result.data?.createAnalyticsAlert;
    } catch (error) {
      console.error('Failed to create analytics alert:', error);
      throw error;
    }
  }, [createAlertMutation]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  return {
    // Data
    overview: overviewData?.analyticsOverview,
    kpiMetrics,
    alerts,
    
    // Loading states
    overviewLoading,
    kpiLoading,
    alertsLoading,
    
    // Methods
    subscribeToUpdates,
    createAlert,
    dismissAlert,
    refetchOverview,
    refetchKPI,
  };
}

/**
 * Live Employee Hook
 * Manages real-time employee data and notifications
 */
export function useLiveEmployee() {
  const [employeeActivity, setEmployeeActivity] = useState<Record<string, unknown>[]>([]);
  const [managerNotifications, setManagerNotifications] = useState<Record<string, unknown>[]>([]);
  const [timeTrackingUpdates, setTimeTrackingUpdates] = useState<Record<string, unknown>[]>([]);

  // Real-time subscriptions for employee events
  // NOTE: These require proper GraphQL subscription documents to be imported
  // TODO: Replace string literals with actual GraphQL subscription documents from @/graphql/subscriptions/employee
  
  /*
  const { data: employeeActivityData } = useSubscription('EMPLOYEE_ACTIVITY_UPDATED', {
    onData: (data) => {
      if (data) {
        try {
          const activity = JSON.parse(data as string);
          handleEmployeeActivity(activity);
        } catch (error) {
          console.error('Failed to parse employee activity:', error);
        }
      }
    },
  });

  const { data: timeTrackingData } = useSubscription('TIME_TRACKING_UPDATED', {
    onData: (data) => {
      if (data) {
        try {
          const update = JSON.parse(data as string);
          handleTimeTrackingUpdate(update);
        } catch (error) {
          console.error('Failed to parse time tracking update:', error);
        }
      }
    },
  });

  const { data: managerNotificationData } = useSubscription('MANAGER_NOTIFICATIONS', {
    onData: (data) => {
      if (data) {
        try {
          const notification = JSON.parse(data as string);
          handleManagerNotification(notification);
        } catch (error) {
          console.error('Failed to parse manager notification:', error);
        }
      }
    },
  });
  */

  // TODO: Uncomment these handlers when GraphQL subscription documents are added
  /*
  // Handle real-time employee activity
  const handleEmployeeActivity = useCallback((activity: Record<string, unknown>) => {
    // Filter by employeeId if specified
    if (employeeId && activity.employeeId !== employeeId) {
      return;
    }

    // Filter by department if specified
    if (departmentId && activity.department !== departmentId) {
      return;
    }

    setEmployeeActivity(prev => [activity, ...prev.slice(0, 49)]); // Keep last 50
  }, [employeeId, departmentId]);

  // Handle time tracking updates
  const handleTimeTrackingUpdate = useCallback((update: Record<string, unknown>) => {
    // Filter by employeeId if specified
    if (employeeId && update.employeeId !== employeeId) {
      return;
    }

    setTimeTrackingUpdates(prev => [update, ...prev.slice(0, 49)]); // Keep last 50
  }, [employeeId]);

  // Handle manager notifications
  const handleManagerNotification = useCallback((notification: Record<string, unknown>) => {
    setManagerNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50
  }, []);
  */

  return {
    // Data
    employeeActivity,
    managerNotifications,
    timeTrackingUpdates,
    
    // Methods
    clearActivity: () => setEmployeeActivity([]),
    clearNotifications: () => setManagerNotifications([]),
    clearTimeTracking: () => setTimeTrackingUpdates([]),
    dismissNotification: (notificationId: string) => {
      setManagerNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
    },
  };
}

/**
 * Combined Live Data Hook
 * Provides access to all live data functionality
 */
export function useLiveData(options: {
  inventory?: { productIds?: string[]; locationId?: string };
  sales?: { locationId?: string };
  customerActivity?: { customerId?: string; locationId?: string };
  analytics?: { locationId?: string };
  employee?: { employeeId?: string; departmentId?: string };
} = {}) {
  const inventory = useLiveInventory(
    options.inventory?.productIds,
    options.inventory?.locationId
  );
  
  const sales = useLiveSales(options.sales?.locationId);
  
  const customerActivity = useLiveCustomerActivity(
    options.customerActivity?.customerId,
    options.customerActivity?.locationId
  );
  
  const analytics = useLiveAnalytics(options.analytics?.locationId);

  const employee = useLiveEmployee();

  return {
    inventory,
    sales,
    customerActivity,
    analytics,
    employee,
  };
}