/**
 * ETL Hook
 * Comprehensive hook for ETL pipeline operations
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useSubscription, useLazyQuery } from '@apollo/client';
import {
  GET_PIPELINES,
  GET_PIPELINE_STATUS,
  GET_PIPELINE_LAST_RUN,
} from '@/graphql/queries/analytics-queries';
import {
  SETUP_ETL_PIPELINES,
  EXECUTE_PIPELINE,
  RECONFIGURE_PIPELINES,
  CREATE_PIPELINE,
  DELETE_PIPELINE,
} from '@/graphql/mutations/analytics-mutations';
import {
  PIPELINE_STATUS_CHANGED,
  PIPELINE_EXECUTED,
} from '@/graphql/subscriptions/analytics-subscriptions';
import type {
  ETLPipeline,
  ETLJobResult,
  UseETLResult,
} from '@/types/analytics';

export function useETL(): UseETLResult {
  const [pipelines, setPipelines] = useState<ETLPipeline[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<Record<string, Record<string, unknown>>>({});
  const [jobResults, setJobResults] = useState<ETLJobResult[]>([]);
  const [subscribedPipelineId, setSubscribedPipelineId] = useState<string | undefined>();

  // Queries
  const {
    data: pipelinesData,
    loading: pipelinesLoading,
    error: pipelinesError,
    refetch: refetchPipelines,
  } = useQuery(GET_PIPELINES, {
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  // Lazy queries for on-demand execution
  const [getPipelineStatusQuery, { loading: statusLoading, error: statusError }] = useLazyQuery(
    GET_PIPELINE_STATUS
  );

  const [getPipelineLastRunQuery] = useLazyQuery(GET_PIPELINE_LAST_RUN);

  // Mutations
  const [setupETLPipelinesMutation] = useMutation(SETUP_ETL_PIPELINES);
  const [executePipelineMutation, { loading: executionLoading, error: executionError }] = useMutation(EXECUTE_PIPELINE);
  const [reconfigurePipelinesMutation] = useMutation(RECONFIGURE_PIPELINES);
  const [createPipelineMutation] = useMutation(CREATE_PIPELINE);
  const [deletePipelineMutation] = useMutation(DELETE_PIPELINE);

  // Subscriptions (keep references active)
  useSubscription(PIPELINE_STATUS_CHANGED, {
    variables: { pipelineId: subscribedPipelineId },
    skip: !subscribedPipelineId,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.pipelineStatusChanged) {
        const statusData = JSON.parse(subscriptionData.data.pipelineStatusChanged);
        setPipelineStatus(prev => ({
          ...prev,
          [statusData.pipelineId]: statusData,
        }));
      }
    },
  });

  useSubscription(PIPELINE_EXECUTED, {
    variables: { pipelineId: subscribedPipelineId },
    skip: !subscribedPipelineId,
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.pipelineExecuted) {
        const executionData = JSON.parse(subscriptionData.data.pipelineExecuted);
        
        // Convert to ETLJobResult type
        const jobResult: ETLJobResult = {
          id: executionData.executionId || `exec_${Date.now()}`,
          pipelineId: executionData.pipelineId,
          status: executionData.status || 'COMPLETED',
          startedAt: new Date(executionData.startedAt || Date.now()),
          completedAt: executionData.completedAt ? new Date(executionData.completedAt) : new Date(),
          recordsProcessed: executionData.recordsProcessed || 0,
          recordsSuccessful: executionData.recordsSuccessful || 0,
          recordsFailed: executionData.recordsFailed || 0,
          errorMessage: executionData.error,
          executionLog: executionData.log,
        };
        
        setJobResults(prev => [...prev, jobResult]);
      }
    },
  });

  // Update state when query data changes
  useState(() => {
    if (pipelinesData?.getPipelines) {
      const pipelinesList = JSON.parse(pipelinesData.getPipelines);
      setPipelines(pipelinesList);
    }
  });

  // Actions
  const getPipelines = useCallback(async (): Promise<ETLPipeline[]> => {
    try {
      const { data } = await refetchPipelines();
      if (data?.getPipelines) {
        const pipelinesList = JSON.parse(data.getPipelines);
        setPipelines(pipelinesList);
        return pipelinesList;
      }
      return [];
    } catch (error) {
      console.error('Failed to get pipelines:', error);
      throw error;
    }
  }, [refetchPipelines]);

  const getPipelineStatus = useCallback(async (pipelineId: string): Promise<Record<string, unknown>> => {
    try {
      const { data } = await getPipelineStatusQuery({
        variables: { pipelineId },
      });
      
      if (data?.getPipelineStatus) {
        const status = JSON.parse(data.getPipelineStatus);
        setPipelineStatus(prev => ({ ...prev, [pipelineId]: status }));
        return status;
      }
      return {};
    } catch (error) {
      console.error('Failed to get pipeline status:', error);
      throw error;
    }
  }, [getPipelineStatusQuery]);

  const getPipelineLastRun = useCallback(async (pipelineId: string): Promise<ETLJobResult | null> => {
    try {
      const { data } = await getPipelineLastRunQuery({
        variables: { pipelineId },
      });
      
      if (data?.getPipelineLastRun) {
        const rawData = JSON.parse(data.getPipelineLastRun);
        const jobResult: ETLJobResult = {
          id: rawData.id || rawData.executionId || `exec_${Date.now()}`,
          pipelineId: rawData.pipelineId,
          status: rawData.status || 'COMPLETED',
          startedAt: new Date(rawData.startedAt || Date.now()),
          completedAt: rawData.completedAt ? new Date(rawData.completedAt) : new Date(),
          recordsProcessed: rawData.recordsProcessed || 0,
          recordsSuccessful: rawData.recordsSuccessful || 0,
          recordsFailed: rawData.recordsFailed || 0,
          errorMessage: rawData.error,
          executionLog: rawData.log,
        };
        return jobResult;
      }
      return null;
    } catch (error) {
      console.error('Failed to get pipeline last run:', error);
      throw error;
    }
  }, [getPipelineLastRunQuery]);

  const setupETLPipelines = useCallback(async (config: string): Promise<string> => {
    try {
      const { data } = await setupETLPipelinesMutation({
        variables: { config },
      });
      
      return data?.setupETLPipelines || '';
    } catch (error) {
      console.error('Failed to setup ETL pipelines:', error);
      throw error;
    }
  }, [setupETLPipelinesMutation]);

  const executePipeline = useCallback(async (pipelineId: string, parameters?: string): Promise<string> => {
    try {
      const { data } = await executePipelineMutation({
        variables: { pipelineId, parameters },
      });
      
      if (data?.executePipeline) {
        const result = JSON.parse(data.executePipeline);
        
        // Create job result entry
        const jobResult: ETLJobResult = {
          id: result.executionId || `exec_${Date.now()}`,
          pipelineId,
          status: 'RUNNING',
          startedAt: new Date(),
          recordsProcessed: 0,
          recordsSuccessful: 0,
          recordsFailed: 0,
        };
        
        setJobResults(prev => [...prev, jobResult]);
        return data.executePipeline;
      }
      return '';
    } catch (error) {
      console.error('Failed to execute pipeline:', error);
      throw error;
    }
  }, [executePipelineMutation]);

  const reconfigurePipelines = useCallback(async (config: string): Promise<string> => {
    try {
      const { data } = await reconfigurePipelinesMutation({
        variables: { config },
      });
      
      return data?.reconfigurePipelines || '';
    } catch (error) {
      console.error('Failed to reconfigure pipelines:', error);
      throw error;
    }
  }, [reconfigurePipelinesMutation]);

  const createPipeline = useCallback(async (pipelineConfig: string): Promise<string> => {
    try {
      const { data } = await createPipelineMutation({
        variables: { pipelineConfig },
      });
      
      if (data?.createPipeline) {
        const newPipeline = JSON.parse(data.createPipeline);
        setPipelines(prev => [...prev, newPipeline]);
        return data.createPipeline;
      }
      return '';
    } catch (error) {
      console.error('Failed to create pipeline:', error);
      throw error;
    }
  }, [createPipelineMutation]);

  const deletePipeline = useCallback(async (pipelineId: string): Promise<boolean> => {
    try {
      const { data } = await deletePipelineMutation({
        variables: { pipelineId },
      });
      
      if (data?.deletePipeline) {
        setPipelines(prev => prev.filter(p => p.id !== pipelineId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete pipeline:', error);
      throw error;
    }
  }, [deletePipelineMutation]);

  // Subscription management
  const subscribeToPipelineStatus = useCallback((pipelineId?: string) => {
    setSubscribedPipelineId(pipelineId);
  }, []);

  const subscribeToPipelineExecution = useCallback((pipelineId?: string) => {
    setSubscribedPipelineId(pipelineId);
  }, []);

  const unsubscribeFromPipeline = useCallback(() => {
    setSubscribedPipelineId(undefined);
  }, []);

  return {
    // Data
    pipelines,
    pipelineStatus,
    jobResults,
    
    // Loading states
    pipelinesLoading,
    statusLoading,
    executionLoading,
    
    // Error states
    ...(pipelinesError && { pipelinesError }),
    ...(statusError && { statusError }),
    ...(executionError && { executionError }),
    
    // Actions
    getPipelines,
    getPipelineStatus,
    getPipelineLastRun,
    setupETLPipelines,
    executePipeline,
    reconfigurePipelines,
    createPipeline,
    deletePipeline,
    
    // Real-time subscriptions
    subscribeToPipelineStatus,
    subscribeToPipelineExecution,
    unsubscribeFromPipeline,
  };
}