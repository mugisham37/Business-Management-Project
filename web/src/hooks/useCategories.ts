/**
 * Category Management Hooks
 * Complete set of hooks for category operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  Category,
  CategoryFilterInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  OffsetPaginationArgs,
} from '@/types/inventory';

// GraphQL Operations
import {
  GET_CATEGORY,
  GET_CATEGORY_BY_SLUG,
  GET_CATEGORIES,
  GET_CATEGORY_TREE,
} from '@/graphql/queries/inventory-queries';

import {
  CREATE_CATEGORY,
  UPDATE_CATEGORY,
  DELETE_CATEGORY,
  MOVE_CATEGORY,
} from '@/graphql/mutations/inventory-mutations';

/**
 * Hook for managing a single category
 */
export function useCategory(categoryId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_CATEGORY, {
    variables: { id: categoryId },
    skip: !currentTenant?.id || !categoryId,
    errorPolicy: 'all',
  });

  const [updateCategory] = useMutation(UPDATE_CATEGORY);
  const [deleteCategory] = useMutation(DELETE_CATEGORY);
  const [moveCategory] = useMutation(MOVE_CATEGORY);

  const category = data?.category;

  const update = useCallback(async (input: UpdateCategoryInput) => {
    if (!category?.id) return null;
    
    try {
      const result = await updateCategory({
        variables: { id: category.id, input },
        optimisticResponse: {
          updateCategory: {
            ...category,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateCategory;
    } catch (error) {
      console.error('Failed to update category:', error);
      throw error;
    }
  }, [updateCategory, category]);

  const remove = useCallback(async () => {
    if (!category?.id) return false;
    
    try {
      const result = await deleteCategory({
        variables: { id: category.id },
        refetchQueries: [
          { query: GET_CATEGORIES, variables: {} },
          { query: GET_CATEGORY_TREE },
        ],
      });
      return result.data?.deleteCategory;
    } catch (error) {
      console.error('Failed to delete category:', error);
      throw error;
    }
  }, [deleteCategory, category]);

  const move = useCallback(async (newParentId?: string) => {
    if (!category?.id) return null;
    
    try {
      const result = await moveCategory({
        variables: { id: category.id, newParentId },
        refetchQueries: [
          { query: GET_CATEGORY_TREE },
        ],
      });
      return result.data?.moveCategory;
    } catch (error) {
      console.error('Failed to move category:', error);
      throw error;
    }
  }, [moveCategory, category]);

  const isRoot = useMemo(() => {
    return !category?.parentId;
  }, [category]);

  const hasChildren = useMemo(() => {
    return category?.children && category.children.length > 0;
  }, [category]);

  return {
    category,
    loading,
    error,
    refetch,
    update,
    remove,
    move,
    isRoot,
    hasChildren,
  };
}

/**
 * Hook for getting category by slug
 */
export function useCategoryBySlug(slug: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_CATEGORY_BY_SLUG, {
    variables: { slug },
    skip: !currentTenant?.id || !slug,
    errorPolicy: 'all',
  });

  const category = data?.categoryBySlug;

  return {
    category,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for managing multiple categories
 */
export function useCategories(
  filter?: CategoryFilterInput,
  pagination?: OffsetPaginationArgs
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_CATEGORIES, {
    variables: { filter, pagination },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const [createCategory] = useMutation(CREATE_CATEGORY);

  const categories = useMemo(() => data?.categories || [], [data?.categories]);

  const create = useCallback(async (input: CreateCategoryInput) => {
    try {
      const result = await createCategory({
        variables: { input },
        refetchQueries: [
          { query: GET_CATEGORIES, variables: { filter, pagination } },
          { query: GET_CATEGORY_TREE },
        ],
      });
      return result.data?.createCategory;
    } catch (error) {
      console.error('Failed to create category:', error);
      throw error;
    }
  }, [createCategory, filter, pagination]);

  const loadMore = useCallback(async () => {
    if (!data?.categories?.length) return;

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
      console.error('Failed to load more categories:', error);
    }
  }, [fetchMore, filter, pagination, data]);

  const search = useCallback((searchTerm: string) => {
    const searchFilter = {
      ...filter,
      search: searchTerm,
    };
    
    refetch({ filter: searchFilter, pagination });
  }, [filter, pagination, refetch]);

  const filterByParent = useCallback((parentId?: string) => {
    const parentFilter = {
      ...filter,
      parentId,
    };
    
    refetch({ filter: parentFilter, pagination });
  }, [filter, pagination, refetch]);

  const clearFilters = useCallback(() => {
    refetch({ filter: {}, pagination });
  }, [pagination, refetch]);

  // Statistics
  const stats = useMemo(() => {
    const totalCategories = categories.length;
    const activeCategories = categories.filter((c: Category) => c.isActive).length;
    const rootCategories = categories.filter((c: Category) => !c.parentId).length;
    const childCategories = categories.filter((c: Category) => c.parentId).length;

    return {
      totalCategories,
      activeCategories,
      rootCategories,
      childCategories,
    };
  }, [categories]);

  return {
    categories,
    stats,
    loading,
    error,
    refetch,
    loadMore,
    create,
    search,
    filterByParent,
    clearFilters,
  };
}

/**
 * Hook for category tree structure
 */
export function useCategoryTree() {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_CATEGORY_TREE, {
    skip: !currentTenant?.id,
    errorPolicy: 'all',
  });

  const categoryTree = useMemo(() => data?.categoryTree || [], [data?.categoryTree]);

  const findCategoryById = useCallback((id: string): Category | null => {
    const findInTree = (categories: Category[]): Category | null => {
      for (const category of categories) {
        if (category.id === id) return category;
        if (category.children) {
          const found = findInTree(category.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findInTree(categoryTree);
  }, [categoryTree]);

  const findCategoryBySlug = useCallback((slug: string): Category | null => {
    const findInTree = (categories: Category[]): Category | null => {
      for (const category of categories) {
        if (category.slug === slug) return category;
        if (category.children) {
          const found = findInTree(category.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findInTree(categoryTree);
  }, [categoryTree]);

  const getCategoryPath = useCallback((categoryId: string): Category[] => {
    const path: Category[] = [];
    
    const findPath = (categories: Category[], targetId: string, currentPath: Category[]): boolean => {
      for (const category of categories) {
        const newPath = [...currentPath, category];
        
        if (category.id === targetId) {
          path.push(...newPath);
          return true;
        }
        
        if (category.children && findPath(category.children, targetId, newPath)) {
          return true;
        }
      }
      return false;
    };
    
    findPath(categoryTree, categoryId, []);
    return path;
  }, [categoryTree]);

  const getSubcategories = useCallback((parentId?: string): Category[] => {
    if (!parentId) {
      return categoryTree.filter((c: Category) => !c.parentId);
    }
    
    const parent = findCategoryById(parentId);
    return parent?.children || [];
  }, [categoryTree, findCategoryById]);

  const flattenTree = useCallback((): Category[] => {
    const flatten = (categories: Category[]): Category[] => {
      const result: Category[] = [];
      
      for (const category of categories) {
        result.push(category);
        if (category.children) {
          result.push(...flatten(category.children));
        }
      }
      
      return result;
    };
    
    return flatten(categoryTree);
  }, [categoryTree]);

  return {
    categoryTree,
    loading,
    error,
    refetch,
    findCategoryById,
    findCategoryBySlug,
    getCategoryPath,
    getSubcategories,
    flattenTree,
  };
}

/**
 * Hook for category search with debouncing
 */
export function useCategorySearch(initialFilter?: CategoryFilterInput) {
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
    const baseFilter: CategoryFilterInput = {
      ...initialFilter,
    };
    if (debouncedSearchTerm) {
      baseFilter.search = debouncedSearchTerm;
    }
    return baseFilter;
  }, [initialFilter, debouncedSearchTerm]);

  const { categories, loading, error, refetch } = useCategories(filter);

  const search = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  }, []);

  return {
    categories,
    searchTerm,
    loading: loading || isSearching,
    error,
    search,
    clearSearch,
    refetch,
  };
}

/**
 * Combined category management hook
 */
export function useCategoryManagement(filter?: CategoryFilterInput) {
  const categories = useCategories(filter);
  const tree = useCategoryTree();

  return {
    // Categories data
    categories: categories.categories,
    categoryTree: tree.categoryTree,
    stats: categories.stats,
    
    // Loading states
    loading: categories.loading || tree.loading,
    error: categories.error || tree.error,
    
    // Actions
    create: categories.create,
    search: categories.search,
    filterByParent: categories.filterByParent,
    clearFilters: categories.clearFilters,
    loadMore: categories.loadMore,
    
    // Tree operations
    findCategoryById: tree.findCategoryById,
    findCategoryBySlug: tree.findCategoryBySlug,
    getCategoryPath: tree.getCategoryPath,
    getSubcategories: tree.getSubcategories,
    flattenTree: tree.flattenTree,
    
    // Refresh functions
    refresh: () => {
      categories.refetch();
      tree.refetch();
    },
  };
}