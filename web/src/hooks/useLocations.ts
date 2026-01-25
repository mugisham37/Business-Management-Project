/**
 * Location Management Hooks
 * Complete hook implementation for location module integration
 */

import { useState, useCallback, useMemo } from 'react';
import { 
  useQuery, 
  useMutation, 
  useSubscription,
  QueryHookOptions,
  MutationHookOptions,
  FetchResult
} from '@apollo/client';
import { 
  GET_LOCATION,
  GET_LOCATIONS,
  GET_LOCATION_TREE
} from '@/graphql/queries/location-queries';
import {
  CREATE_LOCATION,
  UPDATE_LOCATION,
  DELETE_LOCATION,
  CLOSE_LOCATION
} from '@/graphql/mutations/location-mutations';
import {
  LOCATION_STATUS_CHANGED
} from '@/graphql/subscriptions/location-subscriptions';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

// Types
export interface Location {
  id: string;
  name: string;
  code: string;
  description?: string;
  locationType: string;
  status: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  phone?: string;
  email?: string;
  website?: string;
  parentLocationId?: string;
  timezone: string;
  currency: string;
  operatingHours?: {
    [key: string]: {
      open: string;
      close: string;
      closed?: boolean;
    };
  };
  managerId?: string;
  latitude?: number;
  longitude?: number;
  squareFootage?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  parentLocation?: Location;
  childLocations?: Location[];
}

export interface LocationFilter {
  search?: string;
  type?: string;
  status?: string;
  managerId?: string;
  parentLocationId?: string;
}

export interface CreateLocationInput {
  name: string;
  code: string;
  description?: string;
  type: string;
  status?: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  phone?: string;
  email?: string;
  website?: string;
  parentLocationId?: string;
  timezone?: string;
  currency?: string;
  operatingHours?: Record<string, string[]>;
  managerId?: string;
  latitude?: number;
  longitude?: number;
  squareFootage?: number;
}

export interface UpdateLocationInput {
  name?: string;
  description?: string;
  type?: string;
  status?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  phone?: string;
  email?: string;
  website?: string;
  parentLocationId?: string;
  timezone?: string;
  currency?: string;
  operatingHours?: Record<string, string[]>;
  managerId?: string;
  latitude?: number;
  longitude?: number;
  squareFootage?: number;
}

// Hook for single location
export function useLocation(id: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();
  
  const { data, loading, error, refetch } = useQuery(GET_LOCATION, {
    variables: { id },
    skip: !currentTenant?.id || !id,
    errorPolicy: 'all',
    ...options,
  });

  const location = data?.location;

  return {
    location,
    loading,
    error,
    refetch,
  };
}

// Hook for multiple locations with pagination
export function useLocations(filter?: LocationFilter, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();
  const [pageSize] = useState(20);

  const { data, loading, error, refetch, fetchMore } = useQuery(GET_LOCATIONS, {
    variables: {
      first: pageSize,
      filter,
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    ...options,
  });

  const locations = data?.locations?.edges?.map((edge: { node: Location }) => edge.node) || [];
  const pageInfo = data?.locations?.pageInfo;
  const totalCount = data?.locations?.totalCount || 0;

  const loadMore = useCallback(async () => {
    if (!pageInfo?.hasNextPage) return;

    try {
      await fetchMore({
        variables: {
          first: pageSize,
          after: pageInfo.endCursor,
          filter,
        },
      });
    } catch (error) {
      console.error('Error loading more locations:', error);
    }
  }, [fetchMore, pageInfo, pageSize, filter]);

  const refresh = useCallback(async () => {
    try {
      await refetch({
        first: pageSize,
        filter,
      });
    } catch (error) {
      console.error('Error refreshing locations:', error);
    }
  }, [refetch, pageSize, filter]);

  return {
    locations,
    loading,
    error,
    pageInfo,
    totalCount,
    loadMore,
    refresh,
    refetch,
  };
}

// Hook for location tree/hierarchy
export function useLocationTree(rootLocationId?: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();

  const { data, loading, error, refetch } = useQuery(GET_LOCATION_TREE, {
    variables: { rootLocationId },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    ...options,
  });

  const locationTree = data?.locationTree || [];

  return {
    locationTree,
    loading,
    error,
    refetch,
  };
}

// Hook for location mutations
export function useLocationMutations() {
  const { user } = useAuth();
  const { tenant: currentTenant } = useTenant();

  const [createLocationMutation] = useMutation(CREATE_LOCATION);
  const [updateLocationMutation] = useMutation(UPDATE_LOCATION);
  const [deleteLocationMutation] = useMutation(DELETE_LOCATION);
  const [closeLocationMutation] = useMutation(CLOSE_LOCATION);

  const createLocation = useCallback(async (
    input: CreateLocationInput,
    options?: MutationHookOptions
  ): Promise<FetchResult<Location>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return createLocationMutation({
      variables: { input },
      refetchQueries: ['GetLocations', 'GetLocationTree'],
      ...options,
    });
  }, [createLocationMutation, currentTenant?.id, user?.id]);

  const updateLocation = useCallback(async (
    id: string,
    input: UpdateLocationInput,
    options?: MutationHookOptions
  ): Promise<FetchResult<Location>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return updateLocationMutation({
      variables: { id, input },
      refetchQueries: ['GetLocation', 'GetLocations', 'GetLocationTree'],
      ...options,
    });
  }, [updateLocationMutation, currentTenant?.id, user?.id]);

  const deleteLocation = useCallback(async (
    id: string,
    options?: MutationHookOptions
  ): Promise<FetchResult<boolean>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return deleteLocationMutation({
      variables: { id },
      refetchQueries: ['GetLocations', 'GetLocationTree'],
      ...options,
    });
  }, [deleteLocationMutation, currentTenant?.id, user?.id]);

  const closeLocation = useCallback(async (
    id: string,
    options?: MutationHookOptions
  ): Promise<FetchResult<Location>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return closeLocationMutation({
      variables: { id },
      refetchQueries: ['GetLocation', 'GetLocations'],
      ...options,
    });
  }, [closeLocationMutation, currentTenant?.id, user?.id]);

  return {
    createLocation,
    updateLocation,
    deleteLocation,
    closeLocation,
  };
}

// Hook for location subscriptions
export function useLocationSubscriptions(options?: { enabled?: boolean }) {
  const { tenant: currentTenant } = useTenant();
  const { enabled = true } = options || {};

  const { data: statusChangeData } = useSubscription(LOCATION_STATUS_CHANGED, {
    skip: !currentTenant?.id || !enabled,
  });

  return {
    statusChangeData: statusChangeData?.locationStatusChanged,
  };
}

// Hook for location search and filtering
export function useLocationSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<LocationFilter>({});

  const searchFilter = useMemo(() => ({
    ...filters,
    ...(searchTerm && { search: searchTerm }),
  }), [filters, searchTerm]);

  const { locations, loading, error, refetch } = useLocations(searchFilter);

  const updateFilter = useCallback((newFilters: Partial<LocationFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchTerm('');
  }, []);

  return {
    locations,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    filters,
    updateFilter,
    clearFilters,
    refetch,
  };
}

// Hook for location validation
export function useLocationValidation() {
  const validateLocationCode = useCallback((code: string): string | null => {
    if (!code) return 'Location code is required';
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      return 'Code must contain only uppercase letters, numbers, underscores, and hyphens';
    }
    if (code.length > 50) return 'Code must be 50 characters or less';
    return null;
  }, []);

  const validateLocationName = useCallback((name: string): string | null => {
    if (!name) return 'Location name is required';
    if (name.length > 255) return 'Name must be 255 characters or less';
    return null;
  }, []);

  const validateAddress = useCallback((address: { street: string; city: string; state: string; country: string; postalCode: string }): string | null => {
    if (!address) return 'Address is required';
    if (!address.street) return 'Street address is required';
    if (!address.city) return 'City is required';
    if (!address.state) return 'State is required';
    if (!address.country) return 'Country is required';
    if (!address.postalCode) return 'Postal code is required';
    return null;
  }, []);

  const validateCoordinates = useCallback((latitude?: number, longitude?: number): string | null => {
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      return 'Latitude must be between -90 and 90';
    }
    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      return 'Longitude must be between -180 and 180';
    }
    return null;
  }, []);

  const validateLocation = useCallback((location: CreateLocationInput | UpdateLocationInput): Record<string, string> => {
    const errors: Record<string, string> = {};

    if ('name' in location) {
      const nameError = validateLocationName(location.name!);
      if (nameError) errors.name = nameError;
    }

    if ('code' in location) {
      const codeError = validateLocationCode(location.code!);
      if (codeError) errors.code = codeError;
    }

    if (location.address) {
      const addressError = validateAddress(location.address);
      if (addressError) errors.address = addressError;
    }

    const coordError = validateCoordinates(location.latitude, location.longitude);
    if (coordError) errors.coordinates = coordError;

    if (location.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(location.email)) {
      errors.email = 'Invalid email format';
    }

    if (location.website && !/^https?:\/\/.+/.test(location.website)) {
      errors.website = 'Website must be a valid URL';
    }

    return errors;
  }, [validateLocationName, validateLocationCode, validateAddress, validateCoordinates]);

  return {
    validateLocationCode,
    validateLocationName,
    validateAddress,
    validateCoordinates,
    validateLocation,
  };
}

// Main location management hook
export function useLocationManagement() {
  const locationMutations = useLocationMutations();
  const locationValidation = useLocationValidation();
  const locationSubscriptions = useLocationSubscriptions();

  return {
    ...locationMutations,
    ...locationValidation,
    ...locationSubscriptions,
  };
}