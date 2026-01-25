import { useQuery, useSubscription } from '@apollo/client';
import { useCallback, useMemo } from 'react';
import {
  GET_SUPPLIERS,
  GET_SUPPLIER,
  GET_SUPPLIER_BY_CODE,
  GET_PREFERRED_SUPPLIERS,
  GET_SUPPLIERS_BY_STATUS,
  SEARCH_SUPPLIERS,
  GET_SUPPLIER_STATS,
  GET_SUPPLIER_PERFORMANCE_SCORE,
} from '@/graphql/queries/supplier';
import {
  CREATE_SUPPLIER,
  UPDATE_SUPPLIER,
  DELETE_SUPPLIER,
} from '@/graphql/mutations/supplier';
import {
  SUPPLIER_CREATED_SUBSCRIPTION,
  SUPPLIER_UPDATED_SUBSCRIPTION,
} from '@/graphql/subscriptions/supplier';
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from './useGraphQLMutations';
import type {
  Supplier,
  SupplierConnection,
  SupplierFilterInput,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierStats,
  SupplierPerformanceScore,
  DateRangeInput,
} from '@/types/supplier';

// Hook for fetching suppliers with pagination and filtering
export function useSuppliers(
  first?: number,
  after?: string,
  filter?: SupplierFilterInput
) {
  const { data, loading, error, fetchMore, refetch } = useQuery<{
    suppliers: SupplierConnection;
  }>(GET_SUPPLIERS, {
    variables: { first, after, filter },
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const loadMore = useCallback(async () => {
    if (!data?.suppliers.pageInfo.hasNextPage) return;

    const endCursor = data.suppliers.pageInfo.endCursor;
    if (!endCursor) return;

    return fetchMore({
      variables: {
        after: endCursor,
      },
    });
  }, [data, fetchMore]);

  return {
    suppliers: data?.suppliers.edges.map(edge => edge.node) || [],
    pageInfo: data?.suppliers.pageInfo,
    totalCount: data?.suppliers.totalCount || 0,
    loading,
    error,
    loadMore,
    refetch,
  };
}

// Hook for fetching a single supplier
export function useSupplier(id: string) {
  const { data, loading, error, refetch } = useQuery<{ supplier: Supplier }>(
    GET_SUPPLIER,
    {
      variables: { id },
      skip: !id,
      errorPolicy: 'all',
    }
  );

  return {
    supplier: data?.supplier,
    loading,
    error,
    refetch,
  };
}

// Hook for fetching supplier by code
export function useSupplierByCode(supplierCode: string) {
  const { data, loading, error } = useQuery<{ supplierByCode: Supplier }>(
    GET_SUPPLIER_BY_CODE,
    {
      variables: { supplierCode },
      skip: !supplierCode,
      errorPolicy: 'all',
    }
  );

  return {
    supplier: data?.supplierByCode,
    loading,
    error,
  };
}

// Hook for fetching preferred suppliers
export function usePreferredSuppliers() {
  const { data, loading, error, refetch } = useQuery<{
    preferredSuppliers: Supplier[];
  }>(GET_PREFERRED_SUPPLIERS, {
    errorPolicy: 'all',
  });

  return {
    suppliers: data?.preferredSuppliers || [],
    loading,
    error,
    refetch,
  };
}

// Hook for fetching suppliers by status
export function useSuppliersByStatus(status: string) {
  const { data, loading, error } = useQuery<{
    suppliersByStatus: Supplier[];
  }>(GET_SUPPLIERS_BY_STATUS, {
    variables: { status },
    skip: !status,
    errorPolicy: 'all',
  });

  return {
    suppliers: data?.suppliersByStatus || [],
    loading,
    error,
  };
}

// Hook for searching suppliers
export function useSearchSuppliers(searchTerm: string, limit?: number) {
  const { data, loading, error } = useQuery<{
    searchSuppliers: Supplier[];
  }>(SEARCH_SUPPLIERS, {
    variables: { searchTerm, limit },
    skip: !searchTerm || searchTerm.length < 2,
    errorPolicy: 'all',
  });

  return {
    suppliers: data?.searchSuppliers || [],
    loading,
    error,
  };
}

// Hook for supplier statistics
export function useSupplierStats() {
  const { data, loading, error, refetch } = useQuery<{
    supplierStats: SupplierStats;
  }>(GET_SUPPLIER_STATS, {
    errorPolicy: 'all',
  });

  return {
    stats: data?.supplierStats,
    loading,
    error,
    refetch,
  };
}

// Hook for supplier performance score
export function useSupplierPerformanceScore(
  supplierId: string,
  dateRange: DateRangeInput
) {
  const { data, loading, error } = useQuery<{
    supplierPerformanceScore: SupplierPerformanceScore;
  }>(GET_SUPPLIER_PERFORMANCE_SCORE, {
    variables: { supplierId, dateRange },
    skip: !supplierId || !dateRange.startDate || !dateRange.endDate,
    errorPolicy: 'all',
  });

  return {
    performanceScore: data?.supplierPerformanceScore,
    loading,
    error,
  };
}

// Hook for creating suppliers
export function useCreateSupplier() {
  const [createSupplier, { loading, error }] = useCreateMutation(
    CREATE_SUPPLIER,
    GET_SUPPLIERS,
    'suppliers',
    (variables) => ({
      id: `temp-${Date.now()}`,
      ...variables.input,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );

  const create = useCallback(
    async (input: CreateSupplierInput) => {
      return createSupplier({ input });
    },
    [createSupplier]
  );

  return { createSupplier: create, loading, error };
}

// Hook for updating suppliers
export function useUpdateSupplier() {
  const [updateSupplier, { loading, error }] = useUpdateMutation(
    UPDATE_SUPPLIER,
    GET_SUPPLIERS,
    'suppliers'
  );

  const update = useCallback(
    async (id: string, input: UpdateSupplierInput) => {
      return updateSupplier({ id, input });
    },
    [updateSupplier]
  );

  return { updateSupplier: update, loading, error };
}

// Hook for deleting suppliers
export function useDeleteSupplier() {
  const [deleteSupplier, { loading, error }] = useDeleteMutation(
    DELETE_SUPPLIER,
    GET_SUPPLIERS,
    'suppliers'
  );

  const remove = useCallback(
    async (id: string) => {
      return deleteSupplier({ id });
    },
    [deleteSupplier]
  );

  return { deleteSupplier: remove, loading, error };
}

// Hook for real-time supplier updates
export function useSupplierSubscriptions() {
  const { data: createdData } = useSubscription<{ supplierCreated: Supplier }>(
    SUPPLIER_CREATED_SUBSCRIPTION
  );

  const { data: updatedData } = useSubscription<{ supplierUpdated: Supplier }>(
    SUPPLIER_UPDATED_SUBSCRIPTION
  );

  return {
    createdSupplier: createdData?.supplierCreated,
    updatedSupplier: updatedData?.supplierUpdated,
  };
}

// Comprehensive supplier management hook
export function useSupplierManagement() {
  const { createSupplier, loading: creating } = useCreateSupplier();
  const { updateSupplier, loading: updating } = useUpdateSupplier();
  const { deleteSupplier, loading: deleting } = useDeleteSupplier();
  const { stats, refetch: refetchStats } = useSupplierStats();

  const isLoading = creating || updating || deleting;

  const actions = useMemo(
    () => ({
      create: createSupplier,
      update: updateSupplier,
      delete: deleteSupplier,
      refreshStats: refetchStats,
    }),
    [createSupplier, updateSupplier, deleteSupplier, refetchStats]
  );

  return {
    actions,
    stats,
    isLoading,
  };
}

// Hook for supplier filtering and sorting
export function useSupplierFilters() {
  const buildFilter = useCallback((params: {
    search?: string;
    status?: string;
    supplierType?: string;
    preferredOnly?: boolean;
    tags?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): SupplierFilterInput => {
    return {
      search: params.search || undefined,
      status: params.status as any,
      supplierType: params.supplierType as any,
      preferredOnly: params.preferredOnly,
      tags: params.tags?.length ? params.tags : undefined,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    };
  }, []);

  return { buildFilter };
}