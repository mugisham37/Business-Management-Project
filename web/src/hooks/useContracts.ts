import { useCallback } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  Contract, 
  ContractStatus,
  ContractQueryInput,
  CreateContractInput,
  UpdateContractInput,
  RenewContractInput,
  SignContractInput,
  UseContractsResult 
} from '@/types/crm';
import {
  GET_CONTRACTS,
  GET_CONTRACT,
  GET_EXPIRING_CONTRACTS,
} from '@/graphql/queries/b2b-queries';
import {
  CREATE_CONTRACT,
  UPDATE_CONTRACT,
  APPROVE_CONTRACT,
  SIGN_CONTRACT,
  RENEW_CONTRACT,
  TERMINATE_CONTRACT,
} from '@/graphql/mutations/b2b-mutations';
import {
  CONTRACT_EXPIRING_SUBSCRIPTION,
  CONTRACT_STATUS_CHANGED_SUBSCRIPTION,
  CONTRACT_RENEWED_SUBSCRIPTION,
} from '@/graphql/subscriptions/b2b-subscriptions';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from '@/hooks/useErrorHandler';

/**
 * Hook for managing contracts with comprehensive operations
 */
export function useContracts(query?: ContractQueryInput): UseContractsResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  // Query contracts with filters
  const { 
    data, 
    loading, 
    error, 
    refetch 
  } = useQuery(GET_CONTRACTS, {
    variables: { query: query || {} },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch contracts');
    },
  });

  // Mutations
  const [createContractMutation] = useMutation(CREATE_CONTRACT, {
    onError: (error) => handleError(error, 'Failed to create contract'),
    refetchQueries: [{ query: GET_CONTRACTS, variables: { query: query || {} } }],
    awaitRefetchQueries: true,
  });

  const [updateContractMutation] = useMutation(UPDATE_CONTRACT, {
    onError: (error) => handleError(error, 'Failed to update contract'),
  });

  const [approveContractMutation] = useMutation(APPROVE_CONTRACT, {
    onError: (error) => handleError(error, 'Failed to approve contract'),
  });

  const [signContractMutation] = useMutation(SIGN_CONTRACT, {
    onError: (error) => handleError(error, 'Failed to sign contract'),
  });

  const [renewContractMutation] = useMutation(RENEW_CONTRACT, {
    onError: (error) => handleError(error, 'Failed to renew contract'),
  });

  const [terminateContractMutation] = useMutation(TERMINATE_CONTRACT, {
    onError: (error) => handleError(error, 'Failed to terminate contract'),
  });

  // Subscriptions for real-time updates
  useSubscription(CONTRACT_STATUS_CHANGED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.contractStatusChanged) {
        refetch();
      }
    },
  });

  useSubscription(CONTRACT_RENEWED_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.contractRenewed) {
        refetch();
      }
    },
  });

  // Callbacks
  const createContract = useCallback(async (input: CreateContractInput): Promise<Contract> => {
    try {
      const result = await createContractMutation({
        variables: { input },
        optimisticResponse: {
          createContract: {
            __typename: 'ContractGraphQLType',
            id: `temp-${Date.now()}`,
            contractNumber: `CON-${Date.now()}`,
            customerId: input.customerId,
            salesRepId: input.salesRepId,
            accountManagerId: input.accountManagerId,
            status: ContractStatus.DRAFT,
            contractType: input.contractType,
            startDate: input.startDate.toISOString(),
            endDate: input.endDate.toISOString(),
            contractValue: input.contractValue,
            currency: input.currency || 'USD',
            paymentTerms: input.paymentTerms,
            autoRenewal: input.autoRenewal || false,
            renewalNoticeDays: input.renewalNoticeDays,
            pricingTerms: input.pricingTerms,
            terms: input.terms,
            notes: input.notes,
            isExpired: false,
            daysUntilExpiration: Math.ceil((input.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
            requiresRenewalNotice: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.createContract;
    } catch (error) {
      throw error;
    }
  }, [createContractMutation]);

  const updateContract = useCallback(async (
    id: string, 
    input: UpdateContractInput
  ): Promise<Contract> => {
    try {
      const result = await updateContractMutation({
        variables: { id, input },
        optimisticResponse: {
          updateContract: {
            __typename: 'ContractGraphQLType',
            id,
            ...input,
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          if (data?.updateContract) {
            const cacheId = cache.identify(data.updateContract);
            if (cacheId) {
              cache.modify({
                id: cacheId,
                fields: {
                  ...input as Record<string, unknown>,
                  updatedAt: () => new Date().toISOString(),
                },
              });
            }
          }
        },
      });

      return result.data.updateContract;
    } catch (error) {
      throw error;
    }
  }, [updateContractMutation]);

  const approveContract = useCallback(async (
    id: string, 
    approvalNotes?: string
  ): Promise<Contract> => {
    try {
      const result = await approveContractMutation({
        variables: { 
          id, 
          input: { approvalNotes: approvalNotes || '' } 
        },
      });

      return result.data.approveContract.contract;
    } catch (error) {
      throw error;
    }
  }, [approveContractMutation]);

  const signContract = useCallback(async (
    id: string, 
    input: SignContractInput
  ): Promise<Contract> => {
    try {
      const result = await signContractMutation({
        variables: { id, input },
      });

      return result.data.signContract;
    } catch (error) {
      throw error;
    }
  }, [signContractMutation]);

  const renewContract = useCallback(async (
    id: string, 
    input: RenewContractInput
  ): Promise<Contract> => {
    try {
      const result = await renewContractMutation({
        variables: { id, input },
      });

      return result.data.renewContract.contract;
    } catch (error) {
      throw error;
    }
  }, [renewContractMutation]);

  const terminateContract = useCallback(async (
    id: string, 
    terminationReason: string,
    terminationDate?: Date
  ): Promise<Contract> => {
    try {
      const result = await terminateContractMutation({
        variables: { id, terminationReason, terminationDate },
      });

      return result.data.terminateContract;
    } catch (error) {
      throw error;
    }
  }, [terminateContractMutation]);

  return {
    contracts: data?.getContracts?.contracts || [],
    loading,
    error: error || undefined,
    totalCount: data?.getContracts?.total || 0,
    createContract,
    updateContract,
    approveContract,
    signContract,
    renewContract,
    terminateContract,
    refetch: async () => {
      await refetch();
    },
  };
}

/**
 * Hook for fetching a single contract by ID
 */
export function useContract(id: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_CONTRACT, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch contract');
    },
  });
}

/**
 * Hook for fetching contracts expiring within specified days
 */
export function useExpiringContracts(days = 30) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_EXPIRING_CONTRACTS, {
    variables: { days },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: 300000, // Refresh every 5 minutes
    onError: (error) => {
      handleError(error, 'Failed to fetch expiring contracts');
    },
  });
}

/**
 * Hook for contract expiration notifications
 */
export function useContractExpirationNotifications() {
  const { handleError } = useErrorHandler();

  // Subscribe to contract expiring notifications
  const { data: expiringData } = useSubscription(CONTRACT_EXPIRING_SUBSCRIPTION, {
    onError: (error) => {
      handleError(error, 'Contract expiration subscription error');
    },
  });

  return {
    expiringNotification: expiringData?.contractExpiring,
  };
}