/**
 * Comparative Analysis Hook
 * Comprehensive hook for comparative analysis operations
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import {
  COMPARE_TIME_PERIODS,
  COMPARE_LOCATIONS,
  COMPARE_SEGMENTS,
} from '@/graphql/queries/analytics-queries';
import type {
  ComparisonResult,
  LocationComparison,
  SegmentComparison,
  TimePeriodComparisonInput,
  LocationComparisonInput,
  SegmentComparisonInput,
  UseComparativeAnalysisResult,
} from '@/types/analytics';

export function useComparativeAnalysis(): UseComparativeAnalysisResult {
  const [timePeriodComparisons, setTimePeriodComparisons] = useState<ComparisonResult[]>([]);
  const [locationComparisons, setLocationComparisons] = useState<LocationComparison[]>([]);
  const [segmentComparisons, setSegmentComparisons] = useState<SegmentComparison[]>([]);

  // Lazy queries for on-demand execution
  const {
    refetch: compareTimePeriodsQuery,
    loading: timePeriodLoading,
    error: timePeriodError,
  } = useQuery(COMPARE_TIME_PERIODS, { skip: true });

  const {
    refetch: compareLocationsQuery,
    loading: locationLoading,
    error: locationError,
  } = useQuery(COMPARE_LOCATIONS, { skip: true });

  const {
    refetch: compareSegmentsQuery,
    loading: segmentLoading,
    error: segmentError,
  } = useQuery(COMPARE_SEGMENTS, { skip: true });

  // Actions
  const compareTimePeriods = useCallback(async (
    input: TimePeriodComparisonInput
  ): Promise<ComparisonResult[]> => {
    try {
      const { data } = await compareTimePeriodsQuery({
        variables: { input },
      });
      
      if (data?.compareTimePeriods) {
        setTimePeriodComparisons(prev => [...prev, ...data.compareTimePeriods]);
        return data.compareTimePeriods;
      }
      return [];
    } catch (error) {
      console.error('Failed to compare time periods:', error);
      throw error;
    }
  }, [compareTimePeriodsQuery]);

  const compareLocations = useCallback(async (
    input: LocationComparisonInput
  ): Promise<LocationComparison[]> => {
    try {
      const { data } = await compareLocationsQuery({
        variables: { input },
      });
      
      if (data?.compareLocations) {
        setLocationComparisons(prev => [...prev, ...data.compareLocations]);
        return data.compareLocations;
      }
      return [];
    } catch (error) {
      console.error('Failed to compare locations:', error);
      throw error;
    }
  }, [compareLocationsQuery]);

  const compareSegments = useCallback(async (
    input: SegmentComparisonInput
  ): Promise<SegmentComparison[]> => {
    try {
      const { data } = await compareSegmentsQuery({
        variables: { input },
      });
      
      if (data?.compareSegments) {
        setSegmentComparisons(prev => [...prev, ...data.compareSegments]);
        return data.compareSegments;
      }
      return [];
    } catch (error) {
      console.error('Failed to compare segments:', error);
      throw error;
    }
  }, [compareSegmentsQuery]);

  return {
    // Data
    timePeriodComparisons,
    locationComparisons,
    segmentComparisons,
    
    // Loading states
    timePeriodLoading,
    locationLoading,
    segmentLoading,
    
    // Error states
    ...(timePeriodError && { timePeriodError: timePeriodError as Error }),
    ...(locationError && { locationError: locationError as Error }),
    ...(segmentError && { segmentError: segmentError as Error }),
    
    // Actions
    compareTimePeriods,
    compareLocations,
    compareSegments,
  };
}