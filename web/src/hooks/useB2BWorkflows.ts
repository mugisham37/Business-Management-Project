import { useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  Workflow, 
  ApprovalStep,
  WorkflowType,
  WorkflowStatus,
  WorkflowPriority,
  EntityType,
  ApprovalStepStatus,
  UseB2BWorkflowsResult,
  WorkflowApproval,
  WorkflowHistoryEntry,
} from '@/types/crm';
import {
  GET_WORKFLOWS,
  GET_WORKFLOW,
  GET_PENDING_APPROVALS,
  GET_WORKFLOW_HISTORY,
  GET_WORKFLOW_ANALYTICS,
} from '@/graphql/queries/b2b-queries';
import {
  APPROVE_STEP,
  REJECT_STEP,
  REASSIGN_APPROVAL,
} from '@/graphql/mutations/b2b-mutations';
import {
  WORKFLOW_STEP_APPROVED_SUBSCRIPTION,
  WORKFLOW_STEP_REJECTED_SUBSCRIPTION,
  WORKFLOW_STEP_REASSIGNED_SUBSCRIPTION,
  NEW_PENDING_APPROVAL_SUBSCRIPTION,
} from '@/graphql/subscriptions/b2b-subscriptions';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from './useErrorHandler';

export interface WorkflowQueryInput {
  workflowType?: WorkflowType;
  entityType?: EntityType;
  entityId?: string;
  status?: WorkflowStatus;
  priority?: WorkflowPriority;
  initiatedBy?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApprovalStepInput {
  approvalNotes?: string;
}

export interface ReassignApprovalInput {
  newApproverId: string;
  reassignmentReason: string;
  notes?: string;
}

/**
 * Hook for managing B2B workflows with comprehensive operations
 */
export function useB2BWorkflows(query?: WorkflowQueryInput): UseB2BWorkflowsResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  // Query workflows with filters
  const { 
    data: workflowsData, 
    loading: workflowsLoading, 
    error: workflowsError, 
    refetch: refetchWorkflows 
  } = useQuery(GET_WORKFLOWS, {
    variables: { query: query || {} },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error);
    },
  });

  // Query pending approvals
  const { 
    loading: approvalsLoading, 
    error: approvalsError,
    refetch: refetchApprovals 
  } = useQuery(GET_PENDING_APPROVALS, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 30000, // Refresh every 30 seconds
    onError: (error) => {
      handleError(error);
    },
  });

  // Mutations
  const [approveStepMutation] = useMutation(APPROVE_STEP, {
    onError: (error) => handleError(error),
    refetchQueries: [
      { query: GET_WORKFLOWS, variables: { query: query || {} } },
      { query: GET_PENDING_APPROVALS },
    ],
    awaitRefetchQueries: true,
  });

  const [rejectStepMutation] = useMutation(REJECT_STEP, {
    onError: (error) => handleError(error),
    refetchQueries: [
      { query: GET_WORKFLOWS, variables: { query: query || {} } },
      { query: GET_PENDING_APPROVALS },
    ],
    awaitRefetchQueries: true,
  });

  const [reassignApprovalMutation] = useMutation(REASSIGN_APPROVAL, {
    onError: (error) => handleError(error),
    refetchQueries: [
      { query: GET_WORKFLOWS, variables: { query: query || {} } },
      { query: GET_PENDING_APPROVALS },
    ],
    awaitRefetchQueries: true,
  });

  // Subscriptions for real-time updates
  useSubscription(WORKFLOW_STEP_APPROVED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.workflowStepApproved) {
        refetchWorkflows();
        refetchApprovals();
      }
    },
  });

  useSubscription(WORKFLOW_STEP_REJECTED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.workflowStepRejected) {
        refetchWorkflows();
        refetchApprovals();
      }
    },
  });

  useSubscription(WORKFLOW_STEP_REASSIGNED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.workflowStepReassigned) {
        refetchWorkflows();
        refetchApprovals();
      }
    },
  });

  useSubscription(NEW_PENDING_APPROVAL_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.newPendingApproval) {
        refetchApprovals();
      }
    },
  });

  // Callbacks
  const approveStep = useCallback(async (
    workflowId: string,
    stepId: string,
    input: ApprovalStepInput
  ): Promise<{ step: ApprovalStep; workflow: Workflow }> => {
    try {
      const result = await approveStepMutation({
        variables: { workflowId, stepId, input },
        optimisticResponse: {
          approveStep: {
            step: {
              __typename: 'ApprovalStepType',
              id: stepId,
              workflowId,
              status: ApprovalStepStatus.APPROVED,
              approvedAt: new Date().toISOString(),
              approvalNotes: input.approvalNotes,
              updatedAt: new Date().toISOString(),
            },
            workflow: {
              __typename: 'WorkflowType',
              id: workflowId,
              completedSteps: 1, // This would be calculated properly
              updatedAt: new Date().toISOString(),
            },
            message: 'Workflow step approved successfully',
          },
        },
      });

      return {
        step: result.data.approveStep.step,
        workflow: result.data.approveStep.workflow,
      };
    } catch (error) {
      throw error;
    }
  }, [approveStepMutation]);

  const rejectStep = useCallback(async (
    workflowId: string,
    stepId: string,
    rejectionReason: string,
    input?: ApprovalStepInput
  ): Promise<{ step: ApprovalStep; workflow: Workflow }> => {
    try {
      const result = await rejectStepMutation({
        variables: { workflowId, stepId, rejectionReason, input },
        optimisticResponse: {
          rejectStep: {
            step: {
              __typename: 'ApprovalStepType',
              id: stepId,
              workflowId,
              status: ApprovalStepStatus.REJECTED,
              rejectedAt: new Date().toISOString(),
              rejectionReason,
              updatedAt: new Date().toISOString(),
            },
            workflow: {
              __typename: 'WorkflowType',
              id: workflowId,
              status: WorkflowStatus.REJECTED,
              updatedAt: new Date().toISOString(),
            },
            message: 'Workflow step rejected successfully',
          },
        },
      });

      return {
        step: result.data.rejectStep.step,
        workflow: result.data.rejectStep.workflow,
      };
    } catch (error) {
      throw error;
    }
  }, [rejectStepMutation]);

  const reassignApproval = useCallback(async (
    workflowId: string,
    stepId: string,
    input: ReassignApprovalInput
  ): Promise<{ step: ApprovalStep; workflow: Workflow }> => {
    try {
      const result = await reassignApprovalMutation({
        variables: { workflowId, stepId, input },
        optimisticResponse: {
          reassignApproval: {
            step: {
              __typename: 'ApprovalStepType',
              id: stepId,
              workflowId,
              approverId: input.newApproverId,
              status: ApprovalStepStatus.REASSIGNED,
              reassignedTo: input.newApproverId,
              reassignedAt: new Date().toISOString(),
              reassignmentReason: input.reassignmentReason,
              updatedAt: new Date().toISOString(),
            },
            workflow: {
              __typename: 'WorkflowType',
              id: workflowId,
              updatedAt: new Date().toISOString(),
            },
            message: 'Workflow step reassigned successfully',
          },
        },
      });

      return {
        step: result.data.reassignApproval.step,
        workflow: result.data.reassignApproval.workflow,
      };
    } catch (error) {
      throw error;
    }
  }, [reassignApprovalMutation]);

  const getPendingApprovals = useCallback(async (): Promise<WorkflowApproval[]> => {
    try {
      const { data } = await refetchApprovals();
      return data.getPendingApprovals?.approvals || [];
    } catch (error) {
      throw error;
    }
  }, [refetchApprovals]);

  const getWorkflowHistory = useCallback(async (
    entityId: string,
    entityType: EntityType
  ): Promise<WorkflowHistoryEntry[]> => {
    try {
      const { data } = await refetchWorkflows({
        query: GET_WORKFLOW_HISTORY,
        variables: { entityId, entityType },
      });

      return data.getWorkflowHistory;
    } catch (error) {
      throw error;
    }
  }, [refetchWorkflows]);

  const getWorkflowAnalytics = useCallback(async (
    startDate?: Date,
    endDate?: Date,
    entityType?: EntityType
  ): Promise<Record<string, unknown>> => {
    try {
      const { data } = await refetchWorkflows({
        query: GET_WORKFLOW_ANALYTICS,
        variables: { startDate, endDate, entityType },
      });

      return data.getWorkflowAnalytics;
    } catch (error) {
      throw error;
    }
  }, [refetchWorkflows]);

  return {
    workflows: workflowsData?.getWorkflows?.workflows || [],
    loading: workflowsLoading || approvalsLoading,
    error: (workflowsError || approvalsError) ?? null,
    approveStep,
    rejectStep,
    reassignApproval,
    getPendingApprovals,
    getWorkflowHistory,
    getWorkflowAnalytics,
    refetch: async () => {
      await refetchWorkflows();
      await refetchApprovals();
    },
  };
}

/**
 * Hook for fetching a single workflow by ID
 */
export function useB2BWorkflow(id: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_WORKFLOW, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error);
    },
  });
}

/**
 * Hook for pending approvals for current user
 */
export function usePendingApprovals(entityType?: EntityType) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_PENDING_APPROVALS, {
    variables: { entityType },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 30000, // Refresh every 30 seconds
    onError: (error) => {
      handleError(error);
    },
  });
}

/**
 * Hook for workflow analytics
 */
export function useWorkflowAnalytics(
  startDate?: Date,
  endDate?: Date,
  entityType?: EntityType
) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_WORKFLOW_ANALYTICS, {
    variables: { startDate, endDate, entityType },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error);
    },
  });
}

/**
 * Hook for workflow history
 */
export function useWorkflowHistory(entityId: string, entityType: EntityType) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_WORKFLOW_HISTORY, {
    variables: { entityId, entityType },
    skip: !currentTenant?.id || !entityId,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error);
    },
  });
}