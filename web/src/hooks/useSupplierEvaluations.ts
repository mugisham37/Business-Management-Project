import { useQuery, useMutation } from '@apollo/client';
import { useCallback } from 'react';
import {
  GET_SUPPLIER_EVALUATION,
  GET_SUPPLIER_EVALUATIONS,
  GET_SUPPLIER_EVALUATIONS_LIST,
  GET_LATEST_SUPPLIER_EVALUATION,
  GET_PENDING_EVALUATIONS,
  GET_EVALUATION_STATS,
  GET_SUPPLIER_TRENDS,
} from '@/graphql/queries/supplier';
import {
  CREATE_SUPPLIER_EVALUATION,
  UPDATE_SUPPLIER_EVALUATION,
  DELETE_SUPPLIER_EVALUATION,
  APPROVE_SUPPLIER_EVALUATION,
  REJECT_SUPPLIER_EVALUATION,
} from '@/graphql/mutations/supplier';
import { SUPPLIER_EVALUATED_SUBSCRIPTION } from '@/graphql/subscriptions/supplier';
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from './useGraphQLMutations';
import { useSubscription } from '@apollo/client';
import type {
  SupplierEvaluation,
  CreateSupplierEvaluationInput,
  UpdateSupplierEvaluationInput,
  EvaluationStats,
  DateRangeInput,
} from '@/types/supplier';

// Hook for fetching supplier evaluations
export function useSupplierEvaluations(
  supplierId: string,
  limit = 20,
  offset = 0
) {
  const { data, loading, error, refetch, fetchMore } = useQuery<{
    supplierEvaluations: {
      evaluations: SupplierEvaluation[];
      total: number;
    };
  }>(GET_SUPPLIER_EVALUATIONS, {
    variables: { supplierId, limit, offset },
    skip: !supplierId,
    errorPolicy: 'all',
  });

  const loadMore = useCallback(async () => {
    if (!data?.supplierEvaluations.evaluations.length) return;

    return fetchMore({
      variables: {
        offset: offset + limit,
      },
    });
  }, [data, fetchMore, offset, limit]);

  return {
    evaluations: data?.supplierEvaluations.evaluations || [],
    total: data?.supplierEvaluations.total || 0,
    loading,
    error,
    refetch,
    loadMore,
  };
}

// Hook for fetching supplier evaluations with pagination info
export function useSupplierEvaluationsList(
  supplierId: string,
  limit = 20,
  offset = 0
) {
  const { data, loading, error, refetch, fetchMore } = useQuery<{
    supplierEvaluationsList: {
      evaluations: SupplierEvaluation[];
      total: number;
      totalPages: number;
      hasNextPage: boolean;
    };
  }>(GET_SUPPLIER_EVALUATIONS_LIST, {
    variables: { supplierId, limit, offset },
    skip: !supplierId,
    errorPolicy: 'all',
  });

  const loadMore = useCallback(async () => {
    if (!data?.supplierEvaluationsList.hasNextPage) return;

    return fetchMore({
      variables: {
        offset: offset + limit,
      },
    });
  }, [data, fetchMore, offset, limit]);

  return {
    evaluations: data?.supplierEvaluationsList.evaluations || [],
    total: data?.supplierEvaluationsList.total || 0,
    totalPages: data?.supplierEvaluationsList.totalPages || 0,
    hasNextPage: data?.supplierEvaluationsList.hasNextPage || false,
    loading,
    error,
    refetch,
    loadMore,
  };
}

// Hook for fetching a single supplier evaluation
export function useSupplierEvaluation(id: string) {
  const { data, loading, error, refetch } = useQuery<{
    supplierEvaluation: SupplierEvaluation;
  }>(GET_SUPPLIER_EVALUATION, {
    variables: { id },
    skip: !id,
    errorPolicy: 'all',
  });

  return {
    evaluation: data?.supplierEvaluation,
    loading,
    error,
    refetch,
  };
}

// Hook for fetching latest supplier evaluation
export function useLatestSupplierEvaluation(supplierId: string) {
  const { data, loading, error, refetch } = useQuery<{
    latestSupplierEvaluation: SupplierEvaluation;
  }>(GET_LATEST_SUPPLIER_EVALUATION, {
    variables: { supplierId },
    skip: !supplierId,
    errorPolicy: 'all',
  });

  return {
    latestEvaluation: data?.latestSupplierEvaluation,
    loading,
    error,
    refetch,
  };
}

// Hook for fetching pending evaluations
export function usePendingEvaluations() {
  const { data, loading, error, refetch } = useQuery<{
    pendingEvaluations: SupplierEvaluation[];
  }>(GET_PENDING_EVALUATIONS, {
    errorPolicy: 'all',
  });

  return {
    pendingEvaluations: data?.pendingEvaluations || [],
    loading,
    error,
    refetch,
  };
}

// Hook for evaluation statistics
export function useEvaluationStats(
  supplierId?: string,
  dateRange?: DateRangeInput
) {
  const { data, loading, error, refetch } = useQuery<{
    evaluationStats: EvaluationStats;
  }>(GET_EVALUATION_STATS, {
    variables: { supplierId, dateRange },
    errorPolicy: 'all',
  });

  return {
    stats: data?.evaluationStats,
    loading,
    error,
    refetch,
  };
}

// Hook for supplier trends
export function useSupplierTrends(supplierId: string, months = 12) {
  const { data, loading, error } = useQuery<{
    supplierTrends: Array<{
      period: string;
      overallScore: number;
      qualityScore: number;
      deliveryScore: number;
      serviceScore: number;
    }>;
  }>(GET_SUPPLIER_TRENDS, {
    variables: { supplierId, months },
    skip: !supplierId,
    errorPolicy: 'all',
  });

  return {
    trends: data?.supplierTrends || [],
    loading,
    error,
  };
}

// Hook for creating supplier evaluations
export function useCreateSupplierEvaluation() {
  const [createEvaluation, { loading, error }] = useCreateMutation(
    CREATE_SUPPLIER_EVALUATION,
    GET_SUPPLIER_EVALUATIONS,
    'supplierEvaluations',
    (variables: Record<string, unknown>) => {
      const input = variables.input as CreateSupplierEvaluationInput;
      return {
        id: `temp-${Date.now()}`,
        ...input,
        evaluationDate: input.evaluationDate || new Date().toISOString(),
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  );

  const create = useCallback(
    async (input: CreateSupplierEvaluationInput) => {
      return createEvaluation({ input });
    },
    [createEvaluation]
  );

  return { createEvaluation: create, loading, error };
}

// Hook for updating supplier evaluations
export function useUpdateSupplierEvaluation() {
  const [updateEvaluation, { loading, error }] = useUpdateMutation(
    UPDATE_SUPPLIER_EVALUATION,
    GET_SUPPLIER_EVALUATIONS,
    'supplierEvaluations'
  );

  const update = useCallback(
    async (id: string, input: UpdateSupplierEvaluationInput) => {
      return updateEvaluation({ id, input });
    },
    [updateEvaluation]
  );

  return { updateEvaluation: update, loading, error };
}

// Hook for deleting supplier evaluations
export function useDeleteSupplierEvaluation() {
  const [deleteEvaluation, { loading, error }] = useDeleteMutation(
    DELETE_SUPPLIER_EVALUATION,
    GET_SUPPLIER_EVALUATIONS,
    'supplierEvaluations'
  );

  const remove = useCallback(
    async (id: string) => {
      return deleteEvaluation({ id });
    },
    [deleteEvaluation]
  );

  return { deleteEvaluation: remove, loading, error };
}

// Hook for approving supplier evaluations
export function useApproveSupplierEvaluation() {
  const [approveEvaluation, { loading, error }] = useMutation(APPROVE_SUPPLIER_EVALUATION, {
    errorPolicy: 'all',
    update: (cache, { data }, mutationResult) => {
      if (!data?.approveSupplierEvaluation) return;

      const variables = mutationResult.variables as Record<string, unknown> | undefined;
      if (!variables?.id) return;

      // Update the evaluation status in cache
      const evaluationId = variables.id as string;
      const cacheId = cache.identify({ __typename: 'SupplierEvaluation', id: evaluationId });
      
      if (cacheId) {
        cache.modify({
          id: cacheId,
          fields: {
            status: () => 'approved',
            approvedAt: () => new Date().toISOString(),
          },
        });
      }

      // Remove from pending evaluations list
      cache.modify({
        fields: {
          pendingEvaluations(existingEvaluations: unknown[] = [], { readField }) {
            return (existingEvaluations as unknown[]).filter(
              (evalRef: unknown) => readField('id', evalRef) !== evaluationId
            );
          },
        },
      });
    },
  });

  const approve = useCallback(
    async (id: string) => {
      return approveEvaluation({ variables: { id } });
    },
    [approveEvaluation]
  );

  return { approveEvaluation: approve, loading, error };
}

// Hook for rejecting supplier evaluations
export function useRejectSupplierEvaluation() {
  const [rejectEvaluation, { loading, error }] = useMutation(REJECT_SUPPLIER_EVALUATION, {
    errorPolicy: 'all',
    update: (cache, { data }, mutationResult) => {
      if (!data?.rejectSupplierEvaluation) return;

      const variables = mutationResult.variables as Record<string, unknown> | undefined;
      if (!variables?.id) return;

      // Update the evaluation status in cache
      const evaluationId = variables.id as string;
      const cacheId = cache.identify({ __typename: 'SupplierEvaluation', id: evaluationId });
      
      if (cacheId) {
        cache.modify({
          id: cacheId,
          fields: {
            status: () => 'rejected',
          },
        });
      }

      // Remove from pending evaluations list
      cache.modify({
        fields: {
          pendingEvaluations(existingEvaluations: unknown[] = [], { readField }) {
            return (existingEvaluations as unknown[]).filter(
              (evalRef: unknown) => readField('id', evalRef) !== evaluationId
            );
          },
        },
      });
    },
  });

  const reject = useCallback(
    async (id: string) => {
      return rejectEvaluation({ variables: { id } });
    },
    [rejectEvaluation]
  );

  return { rejectEvaluation: reject, loading, error };
}

// Hook for real-time evaluation updates
export function useSupplierEvaluationSubscriptions() {
  const { data } = useSubscription<{ supplierEvaluated: SupplierEvaluation }>(
    SUPPLIER_EVALUATED_SUBSCRIPTION
  );

  return {
    evaluatedSupplier: data?.supplierEvaluated,
  };
}

// Comprehensive supplier evaluation management hook
export function useSupplierEvaluationManagement(supplierId: string) {
  const { evaluations, loading: fetchingEvaluations, refetch } = 
    useSupplierEvaluations(supplierId);
  const { latestEvaluation } = useLatestSupplierEvaluation(supplierId);
  const { stats, refetch: refetchStats } = useEvaluationStats(supplierId);
  const { createEvaluation, loading: creating } = useCreateSupplierEvaluation();
  const { updateEvaluation, loading: updating } = useUpdateSupplierEvaluation();
  const { deleteEvaluation, loading: deleting } = useDeleteSupplierEvaluation();
  const { approveEvaluation, loading: approving } = useApproveSupplierEvaluation();
  const { rejectEvaluation, loading: rejecting } = useRejectSupplierEvaluation();

  const isLoading = fetchingEvaluations || creating || updating || deleting || approving || rejecting;

  const actions = {
    create: createEvaluation,
    update: updateEvaluation,
    delete: deleteEvaluation,
    approve: approveEvaluation,
    reject: rejectEvaluation,
    refresh: refetch,
    refreshStats: refetchStats,
  };

  return {
    evaluations,
    latestEvaluation,
    stats,
    actions,
    isLoading,
  };
}

// Hook for evaluation scoring helpers
export function useEvaluationScoring() {
  const calculateOverallScore = useCallback((scores: {
    qualityScore?: number;
    deliveryScore?: number;
    pricingScore?: number;
    serviceScore?: number;
    reliabilityScore?: number;
    complianceScore?: number;
  }) => {
    const validScores = Object.values(scores).filter(score => 
      typeof score === 'number' && score >= 0
    );
    
    if (validScores.length === 0) return 0;
    
    return validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
  }, []);

  const getScoreColor = useCallback((score: number) => {
    if (score >= 90) return 'green';
    if (score >= 80) return 'blue';
    if (score >= 70) return 'yellow';
    if (score >= 60) return 'orange';
    return 'red';
  }, []);

  const getScoreLabel = useCallback((score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Average';
    if (score >= 60) return 'Below Average';
    return 'Poor';
  }, []);

  return {
    calculateOverallScore,
    getScoreColor,
    getScoreLabel,
  };
}