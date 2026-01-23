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
  GET_CUSTOMERS_LIFETIME_VALUE,
  GET_SEGMENT_ANALYTICS,
  GET_ALL_SEGMENTS_ANALYTICS,
  GET_CUSTOMER_PURCHASE_PATTERNS,
  GET_CUSTOMERS_PURCHASE_PATTERNS,
  GET_CUSTOMER_CHURN_RISK,
  GET_CUSTOMERS_CHURN_RISK,
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

  const loading = metricsLoading;
  const error = metricsError || undefined;

  const getLifetimeValue = useCallback(async (customerId: string): Promise<CustomerLifetimeValue> => {
    try {
      const { data } = await useQuery(GET_CUSTOMER_LIFETIME_VALUE, {
        variables: { customerId },
        fetchPolicy: 'network-only',
      });

      return data.customerLifetimeValue;
    } catch (error) {
      handleError(error as Error, 'Failed to fetch customer lifetime value');
      throw error;
    }
  }, [handleError]);

  const getPurchasePatterns = useCallback(async (customerId: string): Promise<PurchasePattern> => {
    try {
      const { data } = await useQuery(GET_CUSTOMER_PURCHASE_PATTERNS, {
        variables: { customerId },
        fetchPolicy: 'network-only',
      });

      return data.customerPurchasePatterns;
    } catch (error) {
      handleError(error as Error, 'Failed to fetch purchase patterns');
      throw error;
    }
  }, [handleError]);

  const getChurnRisk = useCallback(async (customerId: string): Promise<ChurnRiskAnalysis> => {
    try {
      const { data } = await useQuery(GET_CUSTOMER_CHURN_RISK, {
        variables: { customerId },
        fetchPolicy: 'network-only',
      });

      return data.customerChurnRisk;
    } catch (error) {
      handleError(error as Error, 'Failed to fetch churn risk analysis');
      throw error;
    }
  }, [handleError]);

  const getSegmentAnalytics = useCallback(async (segmentId: string): Promise<SegmentAnalytics> => {
    try {
      const { data } = await useQuery(GET_SEGMENT_ANALYTICS, {
        variables: { segmentId },
        fetchPolicy: 'network-only',
      });

      return data.segmentAnalytics;
    } catch (error) {
      handleError(error as Error, 'Failed to fetch segment analytics');
      throw error;
    }
  }, [handleError]);

  const getCustomerMetrics = useCallback(async (): Promise<CustomerMetrics> => {
    try {
      const { data } = await useQuery(GET_CUSTOMER_METRICS, {
        fetchPolicy: 'network-only',
      });

      return data.customerMetrics;
    } catch (error) {
      handleError(error as Error, 'Failed to fetch customer metrics');
      throw error;
    }
  }, [handleError]);

  const getHighChurnRiskCustomers = useCallback(async (
    threshold = 0.7, 
    limit = 50
  ): Promise<ChurnRiskAnalysis[]> => {
    try {
      const { data } = await useQuery(GET_HIGH_CHURN_RISK_CUSTOMERS, {
        variables: { threshold, limit },
        fetchPolicy: 'network-only',
      });

      return data.highChurnRiskCustomers;
    } catch (error) {
      handleError(error as Error, 'Failed to fetch high churn risk customers');
      throw error;
    }
  }, [handleError]);

  return {
    loading,
    error,
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
 * Hook for multiple customers lifetime value analysis
 */
export function useCustomersLifetimeValue(customerIds: string[]) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_CUSTOMERS_LIFETIME_VALUE, {
    variables: { customerIds },
    skip: !currentTenant?.id || !customerIds.length,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch customers lifetime value');
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
 * Hook for all segments analytics
 */
export function useAllSegmentsAnalytics() {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_ALL_SEGMENTS_ANALYTICS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch all segments analytics');
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