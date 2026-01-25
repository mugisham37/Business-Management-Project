import { useQuery, useMutation } from '@apollo/client';
import { useCallback } from 'react';
import {
  GET_SUPPLIER_COMMUNICATION,
  GET_SUPPLIER_COMMUNICATIONS,
  GET_SUPPLIER_COMMUNICATIONS_LIST,
  GET_PENDING_FOLLOW_UPS,
  GET_COMMUNICATION_STATS,
  GET_COMMUNICATION_BY_TYPE_STATS,
} from '@/graphql/queries/supplier';
import {
  CREATE_SUPPLIER_COMMUNICATION,
  UPDATE_SUPPLIER_COMMUNICATION,
  DELETE_SUPPLIER_COMMUNICATION,
  MARK_FOLLOW_UP_COMPLETE,
} from '@/graphql/mutations/supplier';
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from './useGraphQLMutations';
import type {
  SupplierCommunication,
  CreateSupplierCommunicationInput,
  UpdateSupplierCommunicationInput,
  CommunicationStats,
  DateRangeInput,
} from '@/types/supplier';

// Hook for fetching supplier communications
export function useSupplierCommunications(
  supplierId: string,
  limit = 50,
  offset = 0
) {
  const { data, loading, error, refetch, fetchMore } = useQuery<{
    supplierCommunications: {
      communications: SupplierCommunication[];
      total: number;
    };
  }>(GET_SUPPLIER_COMMUNICATIONS, {
    variables: { supplierId, limit, offset },
    skip: !supplierId,
    errorPolicy: 'all',
  });

  const loadMore = useCallback(async () => {
    if (!data?.supplierCommunications.communications.length) return;

    return fetchMore({
      variables: {
        offset: offset + limit,
      },
    });
  }, [data, fetchMore, offset, limit]);

  return {
    communications: data?.supplierCommunications.communications || [],
    total: data?.supplierCommunications.total || 0,
    loading,
    error,
    refetch,
    loadMore,
  };
}

// Hook for fetching supplier communications with pagination info
export function useSupplierCommunicationsList(
  supplierId: string,
  limit = 20,
  offset = 0
) {
  const { data, loading, error, refetch, fetchMore } = useQuery<{
    supplierCommunicationsList: {
      communications: SupplierCommunication[];
      total: number;
      totalPages: number;
      hasNextPage: boolean;
    };
  }>(GET_SUPPLIER_COMMUNICATIONS_LIST, {
    variables: { supplierId, limit, offset },
    skip: !supplierId,
    errorPolicy: 'all',
  });

  const loadMore = useCallback(async () => {
    if (!data?.supplierCommunicationsList.hasNextPage) return;

    return fetchMore({
      variables: {
        offset: offset + limit,
      },
    });
  }, [data, fetchMore, offset, limit]);

  return {
    communications: data?.supplierCommunicationsList.communications || [],
    total: data?.supplierCommunicationsList.total || 0,
    totalPages: data?.supplierCommunicationsList.totalPages || 0,
    hasNextPage: data?.supplierCommunicationsList.hasNextPage || false,
    loading,
    error,
    refetch,
    loadMore,
  };
}

// Hook for fetching a single supplier communication
export function useSupplierCommunication(id: string) {
  const { data, loading, error, refetch } = useQuery<{
    supplierCommunication: SupplierCommunication;
  }>(GET_SUPPLIER_COMMUNICATION, {
    variables: { id },
    skip: !id,
    errorPolicy: 'all',
  });

  return {
    communication: data?.supplierCommunication,
    loading,
    error,
    refetch,
  };
}

// Hook for fetching pending follow-ups
export function usePendingFollowUps(beforeDate?: string) {
  const { data, loading, error, refetch } = useQuery<{
    pendingFollowUps: SupplierCommunication[];
  }>(GET_PENDING_FOLLOW_UPS, {
    variables: { beforeDate },
    errorPolicy: 'all',
  });

  return {
    followUps: data?.pendingFollowUps || [],
    loading,
    error,
    refetch,
  };
}

// Hook for communication statistics
export function useCommunicationStats(
  supplierId?: string,
  dateRange?: DateRangeInput
) {
  const { data, loading, error, refetch } = useQuery<{
    communicationStats: CommunicationStats;
  }>(GET_COMMUNICATION_STATS, {
    variables: { supplierId, dateRange },
    errorPolicy: 'all',
  });

  return {
    stats: data?.communicationStats,
    loading,
    error,
    refetch,
  };
}

// Hook for communication by type statistics
export function useCommunicationByTypeStats(
  supplierId?: string,
  dateRange?: DateRangeInput
) {
  const { data, loading, error } = useQuery<{
    communicationByTypeStats: {
      emailCount: number;
      phoneCount: number;
      meetingCount: number;
      inboundCount: number;
      outboundCount: number;
    };
  }>(GET_COMMUNICATION_BY_TYPE_STATS, {
    variables: { supplierId, dateRange },
    errorPolicy: 'all',
  });

  return {
    typeStats: data?.communicationByTypeStats,
    loading,
    error,
  };
}

// Hook for creating supplier communications
export function useCreateSupplierCommunication() {
  const [createCommunication, { loading, error }] = useCreateMutation(
    CREATE_SUPPLIER_COMMUNICATION,
    GET_SUPPLIER_COMMUNICATIONS,
    'supplierCommunications',
    (variables: Record<string, unknown>) => {
      const input = variables.input as CreateSupplierCommunicationInput;
      return {
        id: `temp-${Date.now()}`,
        ...input,
        communicationDate: input.communicationDate || new Date().toISOString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  );

  const create = useCallback(
    async (input: CreateSupplierCommunicationInput) => {
      return createCommunication({ input });
    },
    [createCommunication]
  );

  return { createCommunication: create, loading, error };
}

// Hook for updating supplier communications
export function useUpdateSupplierCommunication() {
  const [updateCommunication, { loading, error }] = useUpdateMutation(
    UPDATE_SUPPLIER_COMMUNICATION,
    GET_SUPPLIER_COMMUNICATIONS,
    'supplierCommunications'
  );

  const update = useCallback(
    async (id: string, input: UpdateSupplierCommunicationInput) => {
      return updateCommunication({ id, input });
    },
    [updateCommunication]
  );

  return { updateCommunication: update, loading, error };
}

// Hook for deleting supplier communications
export function useDeleteSupplierCommunication() {
  const [deleteCommunication, { loading, error }] = useDeleteMutation(
    DELETE_SUPPLIER_COMMUNICATION,
    GET_SUPPLIER_COMMUNICATIONS,
    'supplierCommunications'
  );

  const remove = useCallback(
    async (id: string) => {
      return deleteCommunication({ id });
    },
    [deleteCommunication]
  );

  return { deleteCommunication: remove, loading, error };
}

// Hook for marking follow-up as complete
export function useMarkFollowUpComplete() {
  const [markComplete, { loading, error }] = useMutation(MARK_FOLLOW_UP_COMPLETE, {
    errorPolicy: 'all',
    update: (cache, { data }, { variables }) => {
      if (!data?.markFollowUpComplete || !variables?.id) return;

      // Update the communication in cache
      const communicationId = variables.id as string;
      const cacheId = cache.identify({ __typename: 'SupplierCommunication', id: communicationId });
      
      if (cacheId) {
        cache.modify({
          id: cacheId,
          fields: {
            followUpCompleted: () => true,
            followUpDate: () => new Date().toISOString(),
          },
        });
      }

      // Remove from pending follow-ups list
      cache.modify({
        fields: {
          pendingFollowUps(existingFollowUps: unknown[] = [], { readField }) {
            return (existingFollowUps as unknown[]).filter(
              (followUpRef: unknown) => readField('id', followUpRef) !== communicationId
            );
          },
        },
      });
    },
  });

  const markFollowUpComplete = useCallback(
    async (id: string) => {
      return markComplete({ variables: { id } });
    },
    [markComplete]
  );

  return { markFollowUpComplete, loading, error };
}


// Comprehensive supplier communication management hook
export function useSupplierCommunicationManagement(supplierId: string) {
  const { communications, loading: fetchingCommunications, refetch } = 
    useSupplierCommunications(supplierId);
  const { stats, refetch: refetchStats } = useCommunicationStats(supplierId);
  const { createCommunication, loading: creating } = useCreateSupplierCommunication();
  const { updateCommunication, loading: updating } = useUpdateSupplierCommunication();
  const { deleteCommunication, loading: deleting } = useDeleteSupplierCommunication();
  const { markFollowUpComplete, loading: markingComplete } = useMarkFollowUpComplete();

  const isLoading = fetchingCommunications || creating || updating || deleting || markingComplete;

  const actions = {
    create: createCommunication,
    update: updateCommunication,
    delete: deleteCommunication,
    markFollowUpComplete,
    refresh: refetch,
    refreshStats: refetchStats,
  };

  return {
    communications,
    stats,
    actions,
    isLoading,
  };
}

// Hook for communication filtering and search
export function useCommunicationFilters() {
  const filterCommunications = useCallback((
    communications: SupplierCommunication[],
    filters: {
      type?: string;
      direction?: string;
      followUpRequired?: boolean;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    }
  ) => {
    return communications.filter(comm => {
      if (filters.type && comm.type !== filters.type) return false;
      if (filters.direction && comm.direction !== filters.direction) return false;
      if (filters.followUpRequired !== undefined && comm.followUpRequired !== filters.followUpRequired) return false;
      
      if (filters.dateFrom && comm.communicationDate) {
        const commDate = new Date(comm.communicationDate);
        const fromDate = new Date(filters.dateFrom);
        if (commDate < fromDate) return false;
      }
      
      if (filters.dateTo && comm.communicationDate) {
        const commDate = new Date(comm.communicationDate);
        const toDate = new Date(filters.dateTo);
        if (commDate > toDate) return false;
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = [
          comm.subject,
          comm.content,
          comm.fromName,
          comm.toName,
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchLower)) return false;
      }
      
      return true;
    });
  }, []);

  return { filterCommunications };
}