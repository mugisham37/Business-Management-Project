/**
 * Product Management Hooks
 * Complete set of hooks for product operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  Product,
  ProductFilterInput,
  CreateProductInput,
  UpdateProductInput,
  BulkUpdateProductsInput,
  OffsetPaginationArgs,
  ProductStatus,
  ProductType,
} from '@/types/inventory';

// GraphQL Operations
import {
  GET_PRODUCT,
  GET_PRODUCTS,
} from '@/graphql/queries/inventory-queries';

import {
  CREATE_PRODUCT,
  UPDATE_PRODUCT,
  DELETE_PRODUCT,
  BULK_UPDATE_PRODUCTS,
} from '@/graphql/mutations/inventory-mutations';

import {
  PRODUCT_CREATED,
  PRODUCT_UPDATED,
  PRODUCT_DELETED,
} from '@/graphql/subscriptions/inventory-subscriptions';

/**
 * Hook for managing a single product
 */
export function useProduct(productId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_PRODUCT, {
    variables: { id: productId },
    skip: !currentTenant?.id || !productId,
    errorPolicy: 'all',
  });

  const [updateProduct] = useMutation(UPDATE_PRODUCT);
  const [deleteProduct] = useMutation(DELETE_PRODUCT);

  const product = data?.product;

  const update = useCallback(async (input: UpdateProductInput) => {
    if (!product?.id) return null;
    
    try {
      const result = await updateProduct({
        variables: { id: product.id, input },
        optimisticResponse: {
          updateProduct: {
            ...product,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateProduct;
    } catch (error) {
      console.error('Failed to update product:', error);
      throw error;
    }
  }, [updateProduct, product]);

  const remove = useCallback(async () => {
    if (!product?.id) return false;
    
    try {
      const result = await deleteProduct({
        variables: { id: product.id },
        refetchQueries: [
          { query: GET_PRODUCTS, variables: {} },
        ],
      });
      return result.data?.deleteProduct;
    } catch (error) {
      console.error('Failed to delete product:', error);
      throw error;
    }
  }, [deleteProduct, product]);

  const isLowStock = useMemo(() => {
    if (!product) return false;
    // This would need inventory data - could be enhanced with inventory level
    return false;
  }, [product]);

  const isOutOfStock = useMemo(() => {
    if (!product) return false;
    // This would need inventory data - could be enhanced with inventory level
    return false;
  }, [product]);

  const isActive = useMemo(() => {
    return product?.status === ProductStatus.ACTIVE && product?.isActive;
  }, [product]);

  return {
    product,
    loading,
    error,
    refetch,
    update,
    remove,
    isLowStock,
    isOutOfStock,
    isActive,
  };
}

/**
 * Hook for managing multiple products
 */
export function useProducts(
  filter?: ProductFilterInput,
  pagination?: OffsetPaginationArgs
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_PRODUCTS, {
    variables: { filter, pagination },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const [createProduct] = useMutation(CREATE_PRODUCT);
  const [bulkUpdateProducts] = useMutation(BULK_UPDATE_PRODUCTS);

  const products = useMemo(() => data?.products || [], [data?.products]);

  const create = useCallback(async (input: CreateProductInput) => {
    try {
      const result = await createProduct({
        variables: { input },
        refetchQueries: [
          { query: GET_PRODUCTS, variables: { filter, pagination } },
        ],
      });
      return result.data?.createProduct;
    } catch (error) {
      console.error('Failed to create product:', error);
      throw error;
    }
  }, [createProduct, filter, pagination]);

  const bulkUpdate = useCallback(async (input: BulkUpdateProductsInput) => {
    try {
      const result = await bulkUpdateProducts({
        variables: { input },
        refetchQueries: [
          { query: GET_PRODUCTS, variables: { filter, pagination } },
        ],
      });
      return result.data?.bulkUpdateProducts;
    } catch (error) {
      console.error('Failed to bulk update products:', error);
      throw error;
    }
  }, [bulkUpdateProducts, filter, pagination]);

  const loadMore = useCallback(async () => {
    if (!data?.products?.length) return;

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
      console.error('Failed to load more products:', error);
    }
  }, [fetchMore, filter, pagination, data]);

  const search = useCallback((searchTerm: string) => {
    const searchFilter = {
      ...filter,
      search: searchTerm,
    };
    
    refetch({ filter: searchFilter, pagination });
  }, [filter, pagination, refetch]);

  const filterByCategory = useCallback((categoryId: string) => {
    const categoryFilter = {
      ...filter,
      categoryId,
    };
    
    refetch({ filter: categoryFilter, pagination });
  }, [filter, pagination, refetch]);

  const filterByBrand = useCallback((brandId: string) => {
    const brandFilter = {
      ...filter,
      brandId,
    };
    
    refetch({ filter: brandFilter, pagination });
  }, [filter, pagination, refetch]);

  const filterByStatus = useCallback((status: ProductStatus) => {
    const statusFilter = {
      ...filter,
      status,
    };
    
    refetch({ filter: statusFilter, pagination });
  }, [filter, pagination, refetch]);

  const filterByType = useCallback((type: ProductType) => {
    const typeFilter = {
      ...filter,
      type,
    };
    
    refetch({ filter: typeFilter, pagination });
  }, [filter, pagination, refetch]);

  const clearFilters = useCallback(() => {
    refetch({ filter: {}, pagination });
  }, [pagination, refetch]);

  // Statistics
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter((p: Product) => p.status === ProductStatus.ACTIVE).length;
    const inactiveProducts = products.filter((p: Product) => p.status === ProductStatus.INACTIVE).length;
    const discontinuedProducts = products.filter((p: Product) => p.status === ProductStatus.DISCONTINUED).length;
    const featuredProducts = products.filter((p: Product) => p.isFeatured).length;
    
    const totalValue = products.reduce((sum: number, p: Product) => sum + (p.basePrice || 0), 0);
    const averagePrice = totalProducts > 0 ? totalValue / totalProducts : 0;

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      discontinuedProducts,
      featuredProducts,
      totalValue,
      averagePrice,
    };
  }, [products]);

  return {
    products,
    stats,
    loading,
    error,
    refetch,
    loadMore,
    create,
    bulkUpdate,
    search,
    filterByCategory,
    filterByBrand,
    filterByStatus,
    filterByType,
    clearFilters,
  };
}

/**
 * Hook for product search with debouncing
 */
export function useProductSearch(initialFilter?: ProductFilterInput) {
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
    const filterObj: ProductFilterInput = { ...initialFilter };
    if (debouncedSearchTerm) {
      filterObj.search = debouncedSearchTerm;
    }
    return filterObj;
  }, [initialFilter, debouncedSearchTerm]);

  const { products, loading, error, refetch } = useProducts(filter);

  const search = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  }, []);

  return {
    products,
    searchTerm,
    loading: loading || isSearching,
    error,
    search,
    clearSearch,
    refetch,
  };
}

/**
 * Hook for featured products
 */
export function useFeaturedProducts(limit = 10) {
  const filter = useMemo(() => ({
    isFeatured: true,
    status: ProductStatus.ACTIVE,
  }), []);

  const pagination = useMemo(() => ({
    limit,
    offset: 0,
  }), [limit]);

  const { products, loading, error, refetch } = useProducts(filter, pagination);

  return {
    featuredProducts: products,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for product subscriptions
 */
export function useProductSubscriptions() {
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);

  // Subscribe to product creation
  const { data: productCreatedData } = useSubscription(PRODUCT_CREATED, {
    onData: ({ data }) => {
      if (data?.data?.productCreated) {
        setRecentProducts(prev => [data.data.productCreated, ...prev.slice(0, 9)]);
      }
    },
  });

  // Subscribe to product updates
  const { data: productUpdatedData } = useSubscription(PRODUCT_UPDATED, {
    onData: ({ data }) => {
      if (data?.data?.productUpdated) {
        setRecentProducts(prev => 
          prev.map(p => 
            p.id === data.data.productUpdated.id ? data.data.productUpdated : p
          )
        );
      }
    },
  });

  // Subscribe to product deletion
  const { data: productDeletedData } = useSubscription(PRODUCT_DELETED, {
    onData: ({ data }) => {
      if (data?.data?.productDeleted) {
        setRecentProducts(prev => 
          prev.filter(p => p.id !== data.data.productDeleted.id)
        );
      }
    },
  });

  const clearRecentProducts = useCallback(() => {
    setRecentProducts([]);
  }, []);

  return {
    recentProducts,
    clearRecentProducts,
    productCreatedData: productCreatedData?.productCreated,
    productUpdatedData: productUpdatedData?.productUpdated,
    productDeletedData: productDeletedData?.productDeleted,
  };
}

/**
 * Combined product management hook
 */
export function useProductManagement(filter?: ProductFilterInput) {
  const products = useProducts(filter);
  const featured = useFeaturedProducts();
  const subscriptions = useProductSubscriptions();

  return {
    // Products data
    products: products.products,
    featuredProducts: featured.featuredProducts,
    recentProducts: subscriptions.recentProducts,
    stats: products.stats,
    
    // Loading states
    loading: products.loading || featured.loading,
    error: products.error || featured.error,
    
    // Actions
    create: products.create,
    bulkUpdate: products.bulkUpdate,
    search: products.search,
    filterByCategory: products.filterByCategory,
    filterByBrand: products.filterByBrand,
    filterByStatus: products.filterByStatus,
    filterByType: products.filterByType,
    clearFilters: products.clearFilters,
    loadMore: products.loadMore,
    
    // Refresh functions
    refresh: () => {
      products.refetch();
      featured.refetch();
    },
  };
}