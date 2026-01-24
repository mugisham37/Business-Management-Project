/**
 * Location Bulk Operations Management Hooks
 * Complete hook implementation for bulk operations and batch processing
 */

import { useCallback, useState } from 'react';
import { 
  useQuery,
  useMutation,
  QueryHookOptions,
  MutationHookOptions,
  FetchResult
} from '@apollo/client';
import { 
  GET_BULK_OPERATION_STATUS,
  GET_TENANT_BULK_OPERATIONS
} from '@/graphql/queries/location-queries';
import {
  BULK_CREATE_LOCATIONS,
  BULK_UPDATE_LOCATIONS,
  BULK_CHANGE_LOCATION_STATUS,
  BULK_DELETE_LOCATIONS,
  CANCEL_BULK_OPERATION
} from '@/graphql/mutations/location-mutations';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { useAuth } from '@/hooks/useAuth';
import { CreateLocationInput, UpdateLocationInput } from './useLocations';

// Types
export interface BulkOperationSummary {
  operationId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  startTime: string;
  endTime?: string;
  duration?: number;
  progress: number; // 0-100
  errors: Array<{
    itemIndex: number;
    itemId?: string;
    error: string;
    details?: Record<string, unknown>;
  }>;
  warnings: Array<{
    itemIndex: number;
    itemId?: string;
    warning: string;
    details?: Record<string, unknown>;
  }>;
  results: Array<{
    itemIndex: number;
    itemId?: string;
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
  }>;
  metadata?: {
    userId: string;
    tenantId: string;
    validateOnly?: boolean;
    continueOnError?: boolean;
    reason?: string;
  };
}

export interface BulkCreateRequest {
  locations: CreateLocationInput[];
  validateOnly?: boolean;
  continueOnError?: boolean;
}

export interface BulkUpdateRequest {
  updates: Array<{
    locationId: string;
    data: UpdateLocationInput;
  }>;
  validateOnly?: boolean;
  continueOnError?: boolean;
}

export interface BulkStatusChangeRequest {
  locationIds: string[];
  newStatus: string;
  reason?: string;
  validateOnly?: boolean;
  continueOnError?: boolean;
}

export interface BulkDeleteRequest {
  locationIds: string[];
  reason?: string;
  validateOnly?: boolean;
  continueOnError?: boolean;
}

// Hook for bulk operation status
export function useBulkOperationStatus(operationId: string, options?: QueryHookOptions) {
  const { data, loading, error, refetch } = useQuery(GET_BULK_OPERATION_STATUS, {
    variables: { operationId },
    skip: !operationId,
    errorPolicy: 'all',
    pollInterval: 2000, // Poll every 2 seconds for real-time updates
    ...options,
  });

  const operation = data?.getBulkOperationStatus;

  return {
    operation,
    loading,
    error,
    refetch,
  };
}

// Hook for tenant bulk operations
export function useTenantBulkOperations(limit: number = 50, options?: QueryHookOptions) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const { data, loading, error, refetch } = useQuery(GET_TENANT_BULK_OPERATIONS, {
    variables: { limit },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    ...options,
  });

  const operations = data?.getTenantBulkOperations || [];

  return {
    operations,
    loading,
    error,
    refetch,
  };
}

// Hook for bulk operation mutations
export function useBulkOperationMutations() {
  const { user } = useAuth();
  const currentTenant = useTenantStore(state => state.currentTenant);

  const [bulkCreateLocationsMutation] = useMutation(BULK_CREATE_LOCATIONS);
  const [bulkUpdateLocationsMutation] = useMutation(BULK_UPDATE_LOCATIONS);
  const [bulkChangeLocationStatusMutation] = useMutation(BULK_CHANGE_LOCATION_STATUS);
  const [bulkDeleteLocationsMutation] = useMutation(BULK_DELETE_LOCATIONS);
  const [cancelBulkOperationMutation] = useMutation(CANCEL_BULK_OPERATION);

  const bulkCreateLocations = useCallback(async (
    request: BulkCreateRequest,
    options?: MutationHookOptions
  ): Promise<FetchResult<Record<string, unknown>>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return bulkCreateLocationsMutation({
      variables: {
        locations: request.locations,
        validateOnly: request.validateOnly || false,
        continueOnError: request.continueOnError || false,
      },
      refetchQueries: ['GetLocations', 'GetLocationTree', 'GetTenantBulkOperations'],
      ...options,
    });
  }, [bulkCreateLocationsMutation, currentTenant?.id, user?.id]);

  const bulkUpdateLocations = useCallback(async (
    request: BulkUpdateRequest,
    options?: MutationHookOptions
  ): Promise<FetchResult<Record<string, unknown>>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return bulkUpdateLocationsMutation({
      variables: {
        updates: request.updates,
        validateOnly: request.validateOnly || false,
        continueOnError: request.continueOnError || false,
      },
      refetchQueries: ['GetLocations', 'GetLocationTree', 'GetTenantBulkOperations'],
      ...options,
    });
  }, [bulkUpdateLocationsMutation, currentTenant?.id, user?.id]);

  const bulkChangeLocationStatus = useCallback(async (
    request: BulkStatusChangeRequest,
    options?: MutationHookOptions
  ): Promise<FetchResult<Record<string, unknown>>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return bulkChangeLocationStatusMutation({
      variables: {
        locationIds: request.locationIds,
        newStatus: request.newStatus,
        reason: request.reason,
        validateOnly: request.validateOnly || false,
        continueOnError: request.continueOnError || false,
      },
      refetchQueries: ['GetLocations', 'GetTenantBulkOperations'],
      ...options,
    });
  }, [bulkChangeLocationStatusMutation, currentTenant?.id, user?.id]);

  const bulkDeleteLocations = useCallback(async (
    request: BulkDeleteRequest,
    options?: MutationHookOptions
  ): Promise<FetchResult<Record<string, unknown>>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return bulkDeleteLocationsMutation({
      variables: {
        locationIds: request.locationIds,
        reason: request.reason,
        validateOnly: request.validateOnly || false,
        continueOnError: request.continueOnError || false,
      },
      refetchQueries: ['GetLocations', 'GetLocationTree', 'GetTenantBulkOperations'],
      ...options,
    });
  }, [bulkDeleteLocationsMutation, currentTenant?.id, user?.id]);

  const cancelBulkOperation = useCallback(async (
    operationId: string,
    options?: MutationHookOptions
  ): Promise<FetchResult<Record<string, unknown>>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return cancelBulkOperationMutation({
      variables: { operationId },
      refetchQueries: ['GetBulkOperationStatus', 'GetTenantBulkOperations'],
      ...options,
    });
  }, [cancelBulkOperationMutation, currentTenant?.id, user?.id]);

  return {
    bulkCreateLocations,
    bulkUpdateLocations,
    bulkChangeLocationStatus,
    bulkDeleteLocations,
    cancelBulkOperation,
  };
}

// Hook for bulk operation validation
export function useBulkOperationValidation() {
  const validateBulkCreateRequest = useCallback((request: BulkCreateRequest): string[] => {
    const errors: string[] = [];

    if (!request.locations || request.locations.length === 0) {
      errors.push('At least one location is required');
    }

    if (request.locations && request.locations.length > 1000) {
      errors.push('Cannot create more than 1000 locations in a single operation');
    }

    // Validate each location
    request.locations?.forEach((location, index) => {
      if (!location.name) {
        errors.push(`Location ${index + 1}: Name is required`);
      }
      if (!location.code) {
        errors.push(`Location ${index + 1}: Code is required`);
      }
      if (!location.address) {
        errors.push(`Location ${index + 1}: Address is required`);
      }
    });

    // Check for duplicate codes
    const codes = new Set<string>();
    request.locations?.forEach((location, index) => {
      if (location.code) {
        if (codes.has(location.code)) {
          errors.push(`Location ${index + 1}: Duplicate code '${location.code}'`);
        }
        codes.add(location.code);
      }
    });

    return errors;
  }, []);

  const validateBulkUpdateRequest = useCallback((request: BulkUpdateRequest): string[] => {
    const errors: string[] = [];

    if (!request.updates || request.updates.length === 0) {
      errors.push('At least one update is required');
    }

    if (request.updates && request.updates.length > 1000) {
      errors.push('Cannot update more than 1000 locations in a single operation');
    }

    // Validate each update
    request.updates?.forEach((update, index) => {
      if (!update.locationId) {
        errors.push(`Update ${index + 1}: Location ID is required`);
      }
      if (!update.data || Object.keys(update.data).length === 0) {
        errors.push(`Update ${index + 1}: At least one field to update is required`);
      }
    });

    // Check for duplicate location IDs
    const locationIds = new Set<string>();
    request.updates?.forEach((update, index) => {
      if (update.locationId) {
        if (locationIds.has(update.locationId)) {
          errors.push(`Update ${index + 1}: Duplicate location ID '${update.locationId}'`);
        }
        locationIds.add(update.locationId);
      }
    });

    return errors;
  }, []);

  const validateBulkStatusChangeRequest = useCallback((request: BulkStatusChangeRequest): string[] => {
    const errors: string[] = [];

    if (!request.locationIds || request.locationIds.length === 0) {
      errors.push('At least one location ID is required');
    }

    if (request.locationIds && request.locationIds.length > 1000) {
      errors.push('Cannot change status for more than 1000 locations in a single operation');
    }

    if (!request.newStatus) {
      errors.push('New status is required');
    }

    const validStatuses = ['ACTIVE', 'INACTIVE', 'CLOSED', 'PENDING', 'SUSPENDED'];
    if (request.newStatus && !validStatuses.includes(request.newStatus)) {
      errors.push(`Invalid status '${request.newStatus}'. Valid statuses: ${validStatuses.join(', ')}`);
    }

    // Check for duplicate location IDs
    const uniqueIds = new Set(request.locationIds);
    if (uniqueIds.size !== request.locationIds.length) {
      errors.push('Duplicate location IDs found');
    }

    return errors;
  }, []);

  const validateBulkDeleteRequest = useCallback((request: BulkDeleteRequest): string[] => {
    const errors: string[] = [];

    if (!request.locationIds || request.locationIds.length === 0) {
      errors.push('At least one location ID is required');
    }

    if (request.locationIds && request.locationIds.length > 100) {
      errors.push('Cannot delete more than 100 locations in a single operation');
    }

    // Check for duplicate location IDs
    const uniqueIds = new Set(request.locationIds);
    if (uniqueIds.size !== request.locationIds.length) {
      errors.push('Duplicate location IDs found');
    }

    return errors;
  }, []);

  return {
    validateBulkCreateRequest,
    validateBulkUpdateRequest,
    validateBulkStatusChangeRequest,
    validateBulkDeleteRequest,
  };
}

// Hook for bulk operation progress tracking
export function useBulkOperationProgress() {
  const [trackedOperations, setTrackedOperations] = useState<Set<string>>(new Set());

  const trackOperation = useCallback((operationId: string) => {
    setTrackedOperations(prev => new Set(prev).add(operationId));
  }, []);

  const untrackOperation = useCallback((operationId: string) => {
    setTrackedOperations(prev => {
      const newSet = new Set(prev);
      newSet.delete(operationId);
      return newSet;
    });
  }, []);

  const calculateProgress = useCallback((operation: BulkOperationSummary): {
    percentage: number;
    eta: string | null;
    rate: number;
  } => {
    const percentage = operation.totalItems > 0 
      ? Math.round((operation.processedItems / operation.totalItems) * 100)
      : 0;

    let eta: string | null = null;
    let rate = 0;

    if (operation.status === 'RUNNING' && operation.processedItems > 0) {
      const elapsed = Date.now() - new Date(operation.startTime).getTime();
      rate = operation.processedItems / (elapsed / 1000); // items per second
      
      if (rate > 0) {
        const remaining = operation.totalItems - operation.processedItems;
        const etaSeconds = remaining / rate;
        
        if (etaSeconds < 60) {
          eta = `${Math.round(etaSeconds)}s`;
        } else if (etaSeconds < 3600) {
          eta = `${Math.round(etaSeconds / 60)}m`;
        } else {
          eta = `${Math.round(etaSeconds / 3600)}h`;
        }
      }
    }

    return { percentage, eta, rate };
  }, []);

  const getStatusColor = useCallback((status: string): string => {
    switch (status) {
      case 'PENDING': return 'gray';
      case 'RUNNING': return 'blue';
      case 'COMPLETED': return 'green';
      case 'FAILED': return 'red';
      case 'CANCELLED': return 'orange';
      default: return 'gray';
    }
  }, []);

  const getStatusIcon = useCallback((status: string): string => {
    switch (status) {
      case 'PENDING': return '⏳';
      case 'RUNNING': return '⚡';
      case 'COMPLETED': return '✅';
      case 'FAILED': return '❌';
      case 'CANCELLED': return '⚠️';
      default: return '❓';
    }
  }, []);

  return {
    trackedOperations,
    trackOperation,
    untrackOperation,
    calculateProgress,
    getStatusColor,
    getStatusIcon,
  };
}

// Hook for bulk operation templates
export function useBulkOperationTemplates() {
  const generateCreateTemplate = useCallback((): CreateLocationInput => {
    return {
      name: '',
      code: '',
      description: '',
      type: 'STORE',
      status: 'ACTIVE',
      address: {
        street: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
      },
      phone: '',
      email: '',
      website: '',
      timezone: 'UTC',
      currency: 'USD',
    };
  }, []);

  const generateUpdateTemplate = useCallback((): { locationId: string; data: UpdateLocationInput } => {
    return {
      locationId: '',
      data: {
        name: '',
        description: '',
        status: 'ACTIVE',
      },
    };
  }, []);

  const parseCSVToLocations = useCallback((csvContent: string): CreateLocationInput[] => {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = (lines[0] || '').split(',').map(h => h.trim());
    const locations: CreateLocationInput[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = (lines[i] || '').split(',').map(v => v.trim());
      const location: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        switch (header.toLowerCase()) {
          case 'name':
            location.name = value;
            break;
          case 'code':
            location.code = value;
            break;
          case 'description':
            location.description = value;
            break;
          case 'type':
            location.type = value || 'STORE';
            break;
          case 'status':
            location.status = value || 'ACTIVE';
            break;
          case 'street':
            if (!location.address) location.address = {};
            (location.address as Record<string, unknown>)['street'] = value;
            break;
          case 'city':
            if (!location.address) location.address = {};
            (location.address as Record<string, unknown>)['city'] = value;
            break;
          case 'state':
            if (!location.address) location.address = {};
            (location.address as Record<string, unknown>)['state'] = value;
            break;
          case 'country':
            if (!location.address) location.address = {};
            (location.address as Record<string, unknown>)['country'] = value;
            break;
          case 'postalcode':
          case 'postal_code':
            if (!location.address) location.address = {};
            (location.address as Record<string, unknown>)['postalCode'] = value;
            break;
          case 'phone':
            location.phone = value;
            break;
          case 'email':
            location.email = value;
            break;
          case 'website':
            location.website = value;
            break;
          case 'timezone':
            location.timezone = value || 'UTC';
            break;
          case 'currency':
            location.currency = value || 'USD';
            break;
          case 'latitude':
            if (value) location.latitude = parseFloat(value);
            break;
          case 'longitude':
            if (value) location.longitude = parseFloat(value);
            break;
        }
      });

      if (location.name && location.code) {
        locations.push(location as unknown as CreateLocationInput);
      }
    }

    return locations;
  }, []);

  const exportTemplateCSV = useCallback((): void => {
    const headers = [
      'name',
      'code',
      'description',
      'type',
      'status',
      'street',
      'city',
      'state',
      'country',
      'postalCode',
      'phone',
      'email',
      'website',
      'timezone',
      'currency',
      'latitude',
      'longitude',
    ];

    const sampleRow = [
      'Sample Store',
      'STORE001',
      'Sample store description',
      'STORE',
      'ACTIVE',
      '123 Main St',
      'Anytown',
      'CA',
      'USA',
      '12345',
      '+1-555-0123',
      'store@example.com',
      'https://example.com',
      'America/Los_Angeles',
      'USD',
      '37.7749',
      '-122.4194',
    ];

    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulk-locations-template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  return {
    generateCreateTemplate,
    generateUpdateTemplate,
    parseCSVToLocations,
    exportTemplateCSV,
  };
}

// Main bulk operations management hook
export function useLocationBulkOperationsManagement() {
  const bulkOperationMutations = useBulkOperationMutations();
  const bulkOperationValidation = useBulkOperationValidation();
  const bulkOperationProgress = useBulkOperationProgress();
  const bulkOperationTemplates = useBulkOperationTemplates();

  return {
    ...bulkOperationMutations,
    ...bulkOperationValidation,
    ...bulkOperationProgress,
    ...bulkOperationTemplates,
  };
}
