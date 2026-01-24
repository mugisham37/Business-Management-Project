/**
 * Brand Management Hooks
 * Complete set of hooks for brand operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { OffsetPaginationArgs } from '@/types/core';
import {
  Brand,
  BrandFilterInput,
  CreateBrandInput,
  UpdateBrandInput,
} from '@/types/inventory';

// GraphQL Operations
import {
  GET_BRAND,
  GET_BRAND_BY_SLUG,
  GET_BRANDS,
} from '@/graphql/queries/inventory-queries';

import {
  CREATE_BRAND,
  UPDATE_BRAND,
  DELETE_BRAND,
} from '@/graphql/mutations/inventory-mutations';

/**
 * Hook for managing a single brand
 */
export function useBrand(brandId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_BRAND, {
    variables: { id: brandId },
    skip: !currentTenant?.id || !brandId,
    errorPolicy: 'all',
  });

  const [updateBrand] = useMutation(UPDATE_BRAND);
  const [deleteBrand] = useMutation(DELETE_BRAND);

  const brand = data?.brand;

  const update = useCallback(async (input: UpdateBrandInput) => {
    if (!brand?.id) return null;
    
    try {
      const result = await updateBrand({
        variables: { id: brand.id, input },
        optimisticResponse: {
          updateBrand: {
            ...brand,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateBrand;
    } catch (error) {
      console.error('Failed to update brand:', error);
      throw error;
    }
  }, [updateBrand, brand]);

  const remove = useCallback(async () => {
    if (!brand?.id) return false;
    
    try {
      const result = await deleteBrand({
        variables: { id: brand.id },
        refetchQueries: [
          { query: GET_BRANDS, variables: {} },
        ],
      });
      return result.data?.deleteBrand;
    } catch (error) {
      console.error('Failed to delete brand:', error);
      throw error;
    }
  }, [deleteBrand, brand]);

  const hasLogo = useMemo(() => {
    return Boolean(brand?.logoUrl);
  }, [brand]);

  const hasWebsite = useMemo(() => {
    return Boolean(brand?.websiteUrl);
  }, [brand]);

  return {
    brand,
    loading,
    error,
    refetch,
    update,
    remove,
    hasLogo,
    hasWebsite,
  };
}

/**
 * Hook for getting brand by slug
 */
export function useBrandBySlug(slug: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_BRAND_BY_SLUG, {
    variables: { slug },
    skip: !currentTenant?.id || !slug,
    errorPolicy: 'all',
  });

  const brand = data?.brandBySlug;

  return {
    brand,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for managing multiple brands
 */
export function useBrands(
  filter?: BrandFilterInput,
  pagination?: OffsetPaginationArgs
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_BRANDS, {
    variables: { filter, pagination },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const [createBrand] = useMutation(CREATE_BRAND);

  const brands: Brand[] = useMemo(
    () => data?.brands || [],
    [data?.brands]
  );

  const create = useCallback(async (input: CreateBrandInput) => {
    try {
      const result = await createBrand({
        variables: { input },
        refetchQueries: [
          { query: GET_BRANDS, variables: { filter, pagination } },
        ],
      });
      return result.data?.createBrand;
    } catch (error) {
      console.error('Failed to create brand:', error);
      throw error;
    }
  }, [createBrand, filter, pagination]);

  const loadMore = useCallback(async () => {
    if (!data?.brands?.length) return;

    try {
      await fetchMore({
        variables: {
          filter,
          pagination: {
            ...pagination,
            offset: (pagination?.offset || 0) + (pagination?.limit || 20),
          },
        },
      });
    } catch (error) {
      console.error('Failed to load more brands:', error);
    }
  }, [fetchMore, filter, pagination, data]);

  const search = useCallback((searchTerm: string) => {
    const searchFilter = {
      ...filter,
      search: searchTerm,
    };
    
    refetch({ filter: searchFilter, pagination });
  }, [filter, pagination, refetch]);

  const clearFilters = useCallback(() => {
    refetch({ filter: {}, pagination });
  }, [pagination, refetch]);

  // Statistics
  const stats = useMemo(() => {
    const totalBrands = brands.length;
    const activeBrands = brands.filter((b: Brand) => b.isActive).length;
    const brandsWithLogo = brands.filter((b: Brand) => b.logoUrl).length;
    const brandsWithWebsite = brands.filter((b: Brand) => b.websiteUrl).length;

    return {
      totalBrands,
      activeBrands,
      brandsWithLogo,
      brandsWithWebsite,
    };
  }, [brands]);

  return {
    brands,
    stats,
    loading,
    error,
    refetch,
    loadMore,
    create,
    search,
    clearFilters,
  };
}

/**
 * Hook for brand search with debouncing
 */
export function useBrandSearch(initialFilter?: BrandFilterInput) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search term
  useState(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setIsSearching(false);
    }, 300);

    if (searchTerm) {
      setIsSearching(true);
    }

    return () => clearTimeout(timer);
  });

  const filter = useMemo(() => {
    const result: BrandFilterInput = {
      ...initialFilter,
    };
    if (debouncedSearchTerm) {
      result.search = debouncedSearchTerm;
    }
    return result;
  }, [initialFilter, debouncedSearchTerm]);

  const { brands, loading, error, refetch } = useBrands(filter);

  const search = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  }, []);

  return {
    brands,
    searchTerm,
    loading: loading || isSearching,
    error,
    search,
    clearSearch,
    refetch,
  };
}

/**
 * Hook for popular brands (most used)
 */
export function usePopularBrands(limit = 10) {
  const { brands, loading, error, refetch } = useBrands(
    { isActive: true },
    { limit, offset: 0 }
  );

  // In a real implementation, this would be sorted by product count or usage
  const popularBrands = useMemo(() => {
    return brands.slice(0, limit);
  }, [brands, limit]);

  return {
    popularBrands,
    loading,
    error,
    refetch,
  };
}

/**
 * Combined brand management hook
 */
export function useBrandManagement(filter?: BrandFilterInput) {
  const brands = useBrands(filter);
  const popular = usePopularBrands();

  return {
    // Brands data
    brands: brands.brands,
    popularBrands: popular.popularBrands,
    stats: brands.stats,
    
    // Loading states
    loading: brands.loading || popular.loading,
    error: brands.error || popular.error,
    
    // Actions
    create: brands.create,
    search: brands.search,
    clearFilters: brands.clearFilters,
    loadMore: brands.loadMore,
    
    // Refresh functions
    refresh: () => {
      brands.refetch();
      popular.refetch();
    },
  };
}