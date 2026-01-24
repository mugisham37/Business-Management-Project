import { useCallback } from 'react';
import { useQuery } from '@apollo/client';
import { 
  CustomerLifetimeValue,
  PurchasePattern,
  ChurnRiskAnalysis,
  SegmentAnalytics,
  CustomerMetrics,
  UseCustomerAnalyticsResult 
} from '@/types/crm';
import {
  GET_CUSTOMER_LIFETIME_VALUE,
  GET_SEGMENT_ANALYTICS,
  GET_CUSTOMER_PURCHASE_PATTERNS,
  GET_CUSTOMER_CHURN_RISK,
  GET_HIGH_CHURN_RISK_CUSTOMERS,
  GET_CUSTOMER_METRICS,
} from '@/graphql/queries/crm-queries';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from '@/hooks/useErrorHandler';

/**
 * Hook for comprehensive customer analytics operations
 */
export function useCustomerAnalytics(): UseCustomerAnalyticsResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  // Customer metrics query
  const { 
    data: metricsData, 
    loading: metricsLoading, 
    error: metricsError 
  } = useQuery(GET_CUSTOMER_METRICS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch customer metrics');
    },
  });

  // Lazy queries for on-demand execution
  const {
    refetch: lifetimeValueRefetch,
  } = useQuery(GET_CUSTOMER_LIFETIME_VALUE, {
    skip: true,
    errorPolicy: 'all',
  });

  const {
    refetch: purchasePatternsRefetch,
  } = useQuery(GET_CUSTOMER_PURCHASE_PATTERNS, {
    skip: true,
    errorPolicy: 'all',
  });

  const {
    refetch: churnRiskRefetch,
  } = useQuery(GET_CUSTOMER_CHURN_RISK, {
    skip: true,
    errorPolicy: 'all',
  });

  const {
    refetch: segmentAnalyticsRefetch,
  } = useQuery(GET_SEGMENT_ANALYTICS, {
    skip: true,
    errorPolicy: 'all',
  });

  const {
    refetch: highChurnRiskRefetch,
  } = useQuery(GET_HIGH_CHURN_RISK_CUSTOMERS, {
    skip: true,
    errorPolicy: 'all',
  });

  const loading = metricsLoading;
  const error: Error | undefined = metricsError ? new Error(String(metricsError)) : undefined;

  const getLifetimeValue = useCallback(async (customerId: string): Promise<CustomerLifetimeValue> => {
    try {
      const { data } = await lifetimeValueRefetch({ customerId });
      return data?.customerLifetimeValue || {};
    } catch (err) {
      handleError(err as Error, 'Failed to fetch customer lifetime value');
      throw err;
    }
  }, [lifetimeValueRefetch, handleError]);

  const getPurchasePatterns = useCallback(async (customerId: string): Promise<PurchasePattern> => {
    try {
      const { data } = await purchasePatternsRefetch({ customerId });
      return data?.customerPurchasePatterns || {};
    } catch (err) {
      handleError(err as Error, 'Failed to fetch purchase patterns');
      throw err;
    }
  }, [purchasePatternsRefetch, handleError]);

  const getChurnRisk = useCallback(async (customerId: string): Promise<ChurnRiskAnalysis> => {
    try {
      const { data } = await churnRiskRefetch({ customerId });
      return data?.customerChurnRisk || {};
    } catch (err) {
      handleError(err as Error, 'Failed to fetch churn risk analysis');
      throw err;
    }
  }, [churnRiskRefetch, handleError]);

  const getSegmentAnalytics = useCallback(async (segmentId: string): Promise<SegmentAnalytics> => {
    try {
      const { data } = await segmentAnalyticsRefetch({ segmentId });
      return data?.segmentAnalytics || {};
    } catch (err) {
      handleError(err as Error, 'Failed to fetch segment analytics');
      throw err;
    }
  }, [segmentAnalyticsRefetch, handleError]);

  const getCustomerMetrics = useCallback(async (): Promise<CustomerMetrics> => {
    try {
      return metricsData?.customerMetrics || {};
    } catch (err) {
      handleError(err as Error, 'Failed to fetch customer metrics');
      throw err;
    }
  }, [metricsData, handleError]);

  const getHighChurnRiskCustomers = useCallback(async (
    threshold = 0.7, 
    limit = 50
  ): Promise<ChurnRiskAnalysis[]> => {
    try {
      const { data } = await highChurnRiskRefetch({ threshold, limit });
      return data?.highChurnRiskCustomers || [];
    } catch (err) {
      handleError(err as Error, 'Failed to fetch high churn risk customers');
      throw err;
    }
  }, [highChurnRiskRefetch, handleError]);

  return {
    loading,
    ...(error && { error }),
    getLifetimeValue,
    getPurchasePatterns,
    getChurnRisk,
    getSegmentAnalytics,
    getCustomerMetrics,
    getHighChurnRiskCustomers,
  };
}

/**
 * Hook for customer lifetime value analysis
 */
export function useCustomerLifetimeValue(customerId: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_CUSTOMER_LIFETIME_VALUE, {
    variables: { customerId },
    skip: !currentTenant?.id || !customerId,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch customer lifetime value');
    },
  });
}

/**
 * Hook for customer purchase patterns analysis
 */
export function useCustomerPurchasePatterns(customerId: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_CUSTOMER_PURCHASE_PATTERNS, {
    variables: { customerId },
    skip: !currentTenant?.id || !customerId,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch customer purchase patterns');
    },
  });
}

/**
 * Hook for customer churn risk analysis
 */
export function useCustomerChurnRisk(customerId: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_CUSTOMER_CHURN_RISK, {
    variables: { customerId },
    skip: !currentTenant?.id || !customerId,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch customer churn risk');
    },
  });
}

/**
 * Hook for segment analytics
 */
export function useSegmentAnalytics(segmentId: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_SEGMENT_ANALYTICS, {
    variables: { segmentId },
    skip: !currentTenant?.id || !segmentId,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch segment analytics');
    },
  });
}

/**
 * Hook for high churn risk customers
 */
export function useHighChurnRiskCustomers(threshold = 0.7, limit = 50) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_HIGH_CHURN_RISK_CUSTOMERS, {
    variables: { threshold, limit },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch high churn risk customers');
    },
  });
}

/**
 * Hook for customer metrics dashboard
 */
export function useCustomerMetrics() {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_CUSTOMER_METRICS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 300000, // Refresh every 5 minutes
    onError: (error) => {
      handleError(error, 'Failed to fetch customer metrics');
    },
  });
}

/**
 * Hook for analytics insights and recommendations
 */
export function useAnalyticsInsights() {
  const { data: metrics } = useCustomerMetrics();
  const { data: highChurnCustomers } = useHighChurnRiskCustomers();

  const insights = {
    // Growth insights
    customerGrowthTrend: metrics?.customerGrowthRate > 0 ? 'positive' : 'negative',
    revenueGrowthTrend: metrics?.totalRevenue > 0 ? 'positive' : 'stable',
    
    // Risk insights
    churnRiskLevel: metrics?.churnRate > 0.15 ? 'high' : metrics?.churnRate > 0.05 ? 'medium' : 'low',
    highRiskCustomerCount: highChurnCustomers?.highChurnRiskCustomers?.length || 0,
    
    // Performance insights
    loyaltyEngagement: metrics?.loyaltyProgramParticipation > 0.5 ? 'high' : 'low',
    customerSatisfaction: metrics?.customerSatisfactionScore > 4 ? 'high' : 'medium',
    
    // Recommendations
    recommendations: [
      ...(metrics?.churnRate > 0.1 ? ['Implement churn prevention campaigns'] : []),
      ...(metrics?.loyaltyProgramParticipation < 0.3 ? ['Promote loyalty program enrollment'] : []),
      ...(metrics?.customerSatisfactionScore < 4 ? ['Focus on customer satisfaction improvements'] : []),
      ...(metrics?.customerGrowthRate < 0.05 ? ['Increase customer acquisition efforts'] : []),
    ],
  };

  return insights;
}

/**
 * Hook for predictive analytics
 */
export function usePredictiveAnalytics() {
  const { data: metrics } = useCustomerMetrics();

  const predictions = {
    // Revenue predictions (simplified)
    predictedMonthlyRevenue: metrics ? metrics.totalRevenue * (1 + metrics.customerGrowthRate) : 0,
    predictedCustomerGrowth: metrics ? metrics.newCustomersThisMonth * 1.1 : 0,
    
    // Churn predictions
    predictedChurnCount: metrics ? Math.round(metrics.activeCustomers * metrics.churnRate) : 0,
    
    // Loyalty predictions
    predictedLoyaltyGrowth: metrics ? metrics.loyaltyProgramParticipation * 1.05 : 0,
  };

  return predictions;
}