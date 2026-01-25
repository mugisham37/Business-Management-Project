import { useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { 
  Segment, 
  SegmentMember,
  SegmentRule,
  SegmentCriteria,
  CreateSegmentInput,
  UpdateSegmentInput,
  SegmentJobResponse,
  UseSegmentationResult 
} from '@/types/crm';
import {
  GET_SEGMENT,
  GET_SEGMENTS,
  GET_SEGMENT_MEMBERS,
  EVALUATE_SEGMENT_MEMBERSHIP,
} from '@/graphql/queries/crm-queries';
import {
  CREATE_SEGMENT,
  UPDATE_SEGMENT,
  DELETE_SEGMENT,
  RECALCULATE_SEGMENT,
} from '@/graphql/mutations/crm-mutations';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useErrorHandler } from '@/hooks/useErrorHandler';

/**
 * Hook for managing customer segmentation
 */
export function useSegmentation(isActive?: boolean): UseSegmentationResult {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  // Query segments
  const { 
    data, 
    loading, 
    error, 
    refetch 
  } = useQuery(GET_SEGMENTS, {
    variables: { isActive },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch segments');
    },
  });

  // Mutations
  const [createSegmentMutation] = useMutation(CREATE_SEGMENT, {
    onError: (error) => handleError(error, 'Failed to create segment'),
    refetchQueries: [{ query: GET_SEGMENTS, variables: { isActive } }],
    awaitRefetchQueries: true,
  });

  const [updateSegmentMutation] = useMutation(UPDATE_SEGMENT, {
    onError: (error) => handleError(error, 'Failed to update segment'),
  });

  const [deleteSegmentMutation] = useMutation(DELETE_SEGMENT, {
    onError: (error) => handleError(error, 'Failed to delete segment'),
    refetchQueries: [{ query: GET_SEGMENTS, variables: { isActive } }],
    awaitRefetchQueries: true,
  });

  const [recalculateSegmentMutation] = useMutation(RECALCULATE_SEGMENT, {
    onError: (error) => handleError(error, 'Failed to recalculate segment'),
  });

  // Callbacks
  const createSegment = useCallback(async (input: CreateSegmentInput): Promise<Segment> => {
    try {
      const result = await createSegmentMutation({
        variables: { input },
        optimisticResponse: {
          createSegment: {
            __typename: 'Segment',
            id: `temp-${Date.now()}`,
            ...input,
            isActive: input.isActive ?? true,
            customerCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return result.data.createSegment;
    } catch (error) {
      throw error;
    }
  }, [createSegmentMutation]);

  const updateSegment = useCallback(async (
    id: string, 
    input: UpdateSegmentInput
  ): Promise<Segment> => {
    try {
      const result = await updateSegmentMutation({
        variables: { id, input },
        optimisticResponse: {
          updateSegment: {
            __typename: 'Segment',
            id,
            ...input,
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          if (data?.updateSegment) {
            const cacheId = cache.identify(data.updateSegment);
            if (cacheId) {
              const fields: Record<string, () => unknown> = {
                updatedAt: () => new Date().toISOString(),
              };
              if (input.name !== undefined) fields.name = () => input.name;
              if (input.description !== undefined) fields.description = () => input.description;
              if (input.criteria !== undefined) fields.criteria = () => input.criteria;
              if (input.isActive !== undefined) fields.isActive = () => input.isActive;
              
              cache.modify({
                id: cacheId,
                fields,
              });
            }
          }
        },
      });

      return result.data.updateSegment;
    } catch (error) {
      throw error;
    }
  }, [updateSegmentMutation]);

  const deleteSegment = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteSegmentMutation({
        variables: { id },
        optimisticResponse: {
          deleteSegment: true,
        },
        update: (cache) => {
          const cacheId = cache.identify({ __typename: 'Segment', id });
          if (cacheId) {
            cache.evict({ id: cacheId });
            cache.gc();
          }
        },
      });

      return true;
    } catch (error) {
      throw error;
    }
  }, [deleteSegmentMutation]);

  const recalculateSegment = useCallback(async (id: string): Promise<SegmentJobResponse> => {
    try {
      const result = await recalculateSegmentMutation({
        variables: { id },
      });

      return result.data.recalculateSegment;
    } catch (error) {
      throw error;
    }
  }, [recalculateSegmentMutation]);

  const getSegmentMembers = useCallback(async (
    segmentId: string, 
    limit = 100
  ): Promise<SegmentMember[]> => {
    try {
      const { data } = await refetch({
        query: GET_SEGMENT_MEMBERS,
        variables: { segmentId, limit },
      });

      return data.getSegmentMembers;
    } catch (error) {
      throw error;
    }
  }, [refetch]);

  const evaluateSegmentMembership = useCallback(async (
    segmentId: string, 
    customerId: string
  ): Promise<boolean> => {
    try {
      const { data } = await refetch({
        query: EVALUATE_SEGMENT_MEMBERSHIP,
        variables: { segmentId, customerId },
      });

      return data.evaluateSegmentMembership;
    } catch (error) {
      throw error;
    }
  }, [refetch]);

  return {
    segments: data?.segments || [],
    loading,
    error: error ? new Error(error.message) : undefined,
    createSegment,
    updateSegment,
    deleteSegment,
    recalculateSegment,
    getSegmentMembers,
    evaluateSegmentMembership,
  };
}

/**
 * Hook for fetching a single segment by ID
 */
export function useSegment(id: string) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_SEGMENT, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch segment');
    },
  });
}

/**
 * Hook for segment members
 */
export function useSegmentMembers(segmentId: string, limit = 100) {
  const { currentTenant } = useTenantStore();
  const { handleError } = useErrorHandler();

  return useQuery(GET_SEGMENT_MEMBERS, {
    variables: { segmentId, limit },
    skip: !currentTenant?.id || !segmentId,
    errorPolicy: 'all',
    onError: (error) => {
      handleError(error, 'Failed to fetch segment members');
    },
  });
}

/**
 * Hook for segment criteria builder and validation
 */
export function useSegmentCriteriaBuilder() {
  const buildCriteria = useCallback((rules: SegmentRule[]): SegmentCriteria => {
    return {
      operator: 'AND',
      rules: rules.map(rule => ({
        field: rule.field,
        operator: rule.operator,
        value: rule.value,
        type: rule.type || 'string',
      })),
    };
  }, []);

  const validateCriteria = useCallback((criteria: SegmentCriteria): string[] => {
    const errors: string[] = [];

    if (!criteria || !criteria.rules || criteria.rules.length === 0) {
      errors.push('At least one rule is required');
      return errors;
    }

    criteria.rules.forEach((rule: SegmentRule, index: number) => {
      if (!rule.field) {
        errors.push(`Rule ${index + 1}: Field is required`);
      }
      if (!rule.operator) {
        errors.push(`Rule ${index + 1}: Operator is required`);
      }
      if (rule.value === undefined || rule.value === null || rule.value === '') {
        errors.push(`Rule ${index + 1}: Value is required`);
      }
    });

    return errors;
  }, []);

  const getAvailableFields = useCallback(() => {
    return [
      { key: 'totalSpent', label: 'Total Spent', type: 'number' },
      { key: 'totalOrders', label: 'Total Orders', type: 'number' },
      { key: 'averageOrderValue', label: 'Average Order Value', type: 'number' },
      { key: 'loyaltyPoints', label: 'Loyalty Points', type: 'number' },
      { key: 'loyaltyTier', label: 'Loyalty Tier', type: 'select', options: ['bronze', 'silver', 'gold', 'platinum', 'diamond'] },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'blocked', 'prospect'] },
      { key: 'type', label: 'Customer Type', type: 'select', options: ['individual', 'business'] },
      { key: 'city', label: 'City', type: 'string' },
      { key: 'state', label: 'State', type: 'string' },
      { key: 'country', label: 'Country', type: 'string' },
      { key: 'tags', label: 'Tags', type: 'array' },
      { key: 'lastPurchaseDate', label: 'Last Purchase Date', type: 'date' },
      { key: 'createdAt', label: 'Registration Date', type: 'date' },
      { key: 'churnRisk', label: 'Churn Risk Score', type: 'number' },
      { key: 'marketingOptIn', label: 'Marketing Opt-in', type: 'boolean' },
      { key: 'emailOptIn', label: 'Email Opt-in', type: 'boolean' },
    ];
  }, []);

  const getAvailableOperators = useCallback((fieldType: string) => {
    const operators = {
      string: [
        { key: 'equals', label: 'Equals' },
        { key: 'not_equals', label: 'Not Equals' },
        { key: 'contains', label: 'Contains' },
        { key: 'not_contains', label: 'Does Not Contain' },
        { key: 'starts_with', label: 'Starts With' },
        { key: 'ends_with', label: 'Ends With' },
      ],
      number: [
        { key: 'equals', label: 'Equals' },
        { key: 'not_equals', label: 'Not Equals' },
        { key: 'greater_than', label: 'Greater Than' },
        { key: 'greater_than_or_equal', label: 'Greater Than or Equal' },
        { key: 'less_than', label: 'Less Than' },
        { key: 'less_than_or_equal', label: 'Less Than or Equal' },
        { key: 'between', label: 'Between' },
      ],
      date: [
        { key: 'equals', label: 'Equals' },
        { key: 'not_equals', label: 'Not Equals' },
        { key: 'after', label: 'After' },
        { key: 'before', label: 'Before' },
        { key: 'between', label: 'Between' },
        { key: 'in_last_days', label: 'In Last X Days' },
        { key: 'not_in_last_days', label: 'Not In Last X Days' },
      ],
      boolean: [
        { key: 'equals', label: 'Is' },
        { key: 'not_equals', label: 'Is Not' },
      ],
      select: [
        { key: 'equals', label: 'Equals' },
        { key: 'not_equals', label: 'Not Equals' },
        { key: 'in', label: 'In' },
        { key: 'not_in', label: 'Not In' },
      ],
      array: [
        { key: 'contains', label: 'Contains' },
        { key: 'not_contains', label: 'Does Not Contain' },
        { key: 'contains_any', label: 'Contains Any' },
        { key: 'contains_all', label: 'Contains All' },
      ],
    };

    return operators[fieldType as keyof typeof operators] || operators.string;
  }, []);

  return {
    buildCriteria,
    validateCriteria,
    getAvailableFields,
    getAvailableOperators,
  };
}

/**
 * Hook for predefined segment templates
 */
export function useSegmentTemplates() {
  const templates = useMemo(() => ({
    highValue: {
      name: 'High Value Customers',
      description: 'Customers with total spending above $1000',
      criteria: {
        operator: 'AND',
        rules: [
          { field: 'totalSpent', operator: 'greater_than', value: 1000, type: 'number' },
        ],
      },
    },
    loyaltyEnthusiasts: {
      name: 'Loyalty Enthusiasts',
      description: 'Active customers with high loyalty engagement',
      criteria: {
        operator: 'AND',
        rules: [
          { field: 'status', operator: 'equals', value: 'active', type: 'select' },
          { field: 'loyaltyPoints', operator: 'greater_than', value: 500, type: 'number' },
          { field: 'loyaltyTier', operator: 'in', value: ['gold', 'platinum', 'diamond'], type: 'select' },
        ],
      },
    },
    churnRisk: {
      name: 'Churn Risk Customers',
      description: 'Customers at high risk of churning',
      criteria: {
        operator: 'AND',
        rules: [
          { field: 'status', operator: 'equals', value: 'active', type: 'select' },
          { field: 'churnRisk', operator: 'greater_than', value: 0.7, type: 'number' },
        ],
      },
    },
    newCustomers: {
      name: 'New Customers',
      description: 'Customers registered in the last 30 days',
      criteria: {
        operator: 'AND',
        rules: [
          { field: 'createdAt', operator: 'in_last_days', value: 30, type: 'date' },
        ],
      },
    },
    inactiveCustomers: {
      name: 'Inactive Customers',
      description: 'Customers who haven\'t purchased in the last 90 days',
      criteria: {
        operator: 'AND',
        rules: [
          { field: 'status', operator: 'equals', value: 'active', type: 'select' },
          { field: 'lastPurchaseDate', operator: 'not_in_last_days', value: 90, type: 'date' },
        ],
      },
    },
    vipCustomers: {
      name: 'VIP Customers',
      description: 'Top tier customers with high engagement',
      criteria: {
        operator: 'AND',
        rules: [
          { field: 'loyaltyTier', operator: 'in', value: ['platinum', 'diamond'], type: 'select' },
          { field: 'totalSpent', operator: 'greater_than', value: 5000, type: 'number' },
          { field: 'totalOrders', operator: 'greater_than', value: 10, type: 'number' },
        ],
      },
    },
  }), []);

  const createFromTemplate = useCallback((templateKey: keyof typeof templates) => {
    const template = templates[templateKey];
    if (!template) return null;

    return {
      name: template.name,
      description: template.description,
      criteria: template.criteria,
      isActive: true,
    };
  }, [templates]);

  return {
    templates,
    createFromTemplate,
  };
}