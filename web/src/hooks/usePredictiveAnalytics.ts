/**
 * Predictive Analytics Hook
 * Comprehensive hook for predictive analytics and ML operations
 */

import { useState, useCallback } from 'react';
import { useLazyQuery } from '@apollo/client';
import {
  GET_FORECAST,
  DETECT_ANOMALIES,
  GENERATE_DEMAND_FORECAST,
  PREDICT_CUSTOMER_CHURN,
  OPTIMIZE_PRODUCT_PRICING,
  OPTIMIZE_INVENTORY_LEVELS,
} from '@/graphql/queries/analytics-queries';
import type {
  Forecast,
  Anomaly,
  ChurnPrediction,
  PriceOptimization,
  InventoryOptimization,
  UsePredictiveAnalyticsResult,
} from '@/types/analytics';

export function usePredictiveAnalytics(): UsePredictiveAnalyticsResult {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [churnPredictions, setChurnPredictions] = useState<ChurnPrediction[]>([]);
  const [priceOptimizations, setPriceOptimizations] = useState<PriceOptimization[]>([]);
  const [inventoryOptimizations, setInventoryOptimizations] = useState<InventoryOptimization[]>([]);

  // Lazy queries for on-demand execution
  const [getForecastQuery, { loading: forecastLoading, error: forecastError }] = useLazyQuery(
    GET_FORECAST
  );

  const [detectAnomaliesQuery, { loading: anomalyLoading, error: anomalyError }] = useLazyQuery(
    DETECT_ANOMALIES
  );

  const [generateDemandForecastQuery, { loading: demandLoading }] = useLazyQuery(
    GENERATE_DEMAND_FORECAST
  );

  const [predictCustomerChurnQuery, { loading: churnLoading, error: churnError }] = useLazyQuery(
    PREDICT_CUSTOMER_CHURN
  );

  const [optimizeProductPricingQuery, { loading: pricingLoading, error: pricingError }] = useLazyQuery(
    OPTIMIZE_PRODUCT_PRICING
  );

  const [optimizeInventoryLevelsQuery, { loading: inventoryLoading, error: inventoryError }] = useLazyQuery(
    OPTIMIZE_INVENTORY_LEVELS
  );

  // Actions
  const getForecast = useCallback(async (
    metricName: string,
    periods: number,
    productId?: string,
    locationId?: string
  ): Promise<Forecast[]> => {
    try {
      const { data } = await getForecastQuery({
        variables: {
          metricName,
          periods,
          productId,
          locationId,
        },
      });
      
      if (data?.getForecast) {
        const newForecasts = Array.isArray(data.getForecast) ? data.getForecast : [data.getForecast];
        setForecasts(prev => [...prev, ...newForecasts]);
        return newForecasts;
      }
      return [];
    } catch (error) {
      console.error('Failed to get forecast:', error);
      throw error;
    }
  }, [getForecastQuery]);

  const detectAnomalies = useCallback(async (
    metricName: string,
    threshold?: number
  ): Promise<Anomaly[]> => {
    try {
      const { data } = await detectAnomaliesQuery({
        variables: {
          metricName,
          threshold,
        },
      });
      
      if (data?.detectAnomalies) {
        setAnomalies(prev => [...prev, ...data.detectAnomalies]);
        return data.detectAnomalies;
      }
      return [];
    } catch (error) {
      console.error('Failed to detect anomalies:', error);
      throw error;
    }
  }, [detectAnomaliesQuery]);

  const generateDemandForecast = useCallback(async (
    productId: string,
    locationId: string,
    forecastHorizon: number
  ): Promise<Forecast> => {
    try {
      const { data } = await generateDemandForecastQuery({
        variables: {
          productId,
          locationId,
          forecastHorizon,
        },
      });
      
      if (data?.generateDemandForecast) {
        setForecasts(prev => [...prev, data.generateDemandForecast]);
        return data.generateDemandForecast;
      }
      throw new Error('Failed to generate demand forecast');
    } catch (error) {
      console.error('Failed to generate demand forecast:', error);
      throw error;
    }
  }, [generateDemandForecastQuery]);

  const predictCustomerChurn = useCallback(async (customerId?: string): Promise<ChurnPrediction | null> => {
    try {
      const { data } = await predictCustomerChurnQuery({
        variables: {
          customerId,
        },
      });
      
      if (data?.predictCustomerChurn) {
        const churnData = JSON.parse(data.predictCustomerChurn);
        
        // Convert to ChurnPrediction type
        const churnPrediction: ChurnPrediction = {
          id: `churn_${customerId || 'default'}_${Date.now()}`,
          customerId: churnData.customerId || customerId || 'default',
          churnProbability: churnData.churnRisk || 0,
          riskLevel: churnData.churnRisk > 0.7 ? 'HIGH' : churnData.churnRisk > 0.4 ? 'MEDIUM' : 'LOW',
          riskFactors: churnData.riskFactors || [],
          recommendedActions: churnData.recommendation,
          predictionDate: new Date(),
          createdAt: new Date(),
        };
        
        setChurnPredictions(prev => [...prev, churnPrediction]);
        return churnData;
      }
      return null;
    } catch (error) {
      console.error('Failed to predict customer churn:', error);
      throw error;
    }
  }, [predictCustomerChurnQuery]);

  const optimizeProductPricing = useCallback(async (
    productId: string,
    locationId?: string
  ): Promise<PriceOptimization | null> => {
    try {
      const { data } = await optimizeProductPricingQuery({
        variables: {
          productId,
          locationId,
        },
      });
      
      if (data?.optimizeProductPricing) {
        const pricingData = JSON.parse(data.optimizeProductPricing);
        
        // Convert to PriceOptimization type
        const priceOptimization: PriceOptimization = {
          id: `pricing_${productId}_${Date.now()}`,
          productId,
          ...(locationId && { locationId }),
          currentPrice: pricingData.currentPrice || 0,
          recommendedPrice: pricingData.recommendedPrice || 0,
          expectedRevenueLift: pricingData.expectedRevenueLift || 0,
          confidence: pricingData.confidence || 0.8,
          reasoning: pricingData.reasoning,
          createdAt: new Date(),
        };
        
        setPriceOptimizations(prev => [...prev, priceOptimization]);
        return pricingData;
      }
      return null;
    } catch (error) {
      console.error('Failed to optimize product pricing:', error);
      throw error;
    }
  }, [optimizeProductPricingQuery]);

  const optimizeInventoryLevels = useCallback(async (
    productId: string,
    locationId: string
  ): Promise<InventoryOptimization | null> => {
    try {
      const { data } = await optimizeInventoryLevelsQuery({
        variables: {
          productId,
          locationId,
        },
      });
      
      if (data?.optimizeInventoryLevels) {
        const inventoryData = JSON.parse(data.optimizeInventoryLevels);
        
        // Convert to InventoryOptimization type
        const inventoryOptimization: InventoryOptimization = {
          id: `inventory_${productId}_${locationId}_${Date.now()}`,
          productId,
          locationId,
          currentStock: inventoryData.currentStock || 0,
          recommendedStock: inventoryData.recommendedLevel || 0,
          reorderPoint: inventoryData.reorderPoint || 0,
          reorderQuantity: inventoryData.reorderQuantity || 0,
          expectedServiceLevel: inventoryData.serviceLevel || 0.95,
          createdAt: new Date(),
        };
        
        setInventoryOptimizations(prev => [...prev, inventoryOptimization]);
        return inventoryData;
      }
      return null;
    } catch (error) {
      console.error('Failed to optimize inventory levels:', error);
      throw error;
    }
  }, [optimizeInventoryLevelsQuery]);

  return {
    // Data
    forecasts,
    anomalies,
    churnPredictions,
    priceOptimizations,
    inventoryOptimizations,
    
    // Loading states
    forecastLoading: forecastLoading || demandLoading,
    anomalyLoading,
    churnLoading,
    pricingLoading,
    inventoryLoading,
    
    // Error states
    forecastError: forecastError || undefined,
    anomalyError: anomalyError || undefined,
    churnError: churnError || undefined,
    pricingError: pricingError || undefined,
    inventoryError: inventoryError || undefined,
    
    // Actions
    getForecast,
    detectAnomalies,
    generateDemandForecast,
    predictCustomerChurn,
    optimizeProductPricing,
    optimizeInventoryLevels,
  };
}