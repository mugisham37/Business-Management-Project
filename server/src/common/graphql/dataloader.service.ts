import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';

/**
 * DataLoader service for preventing N+1 queries in GraphQL
 * This service is request-scoped to ensure fresh loaders per request
 */
@Injectable({ scope: Scope.REQUEST })
export class DataLoaderService {
  private loaders = new Map<string, DataLoader<any, any>>();

  /**
   * Get or create a DataLoader for a specific key
   */
  getLoader<K, V>(
    key: string,
    batchLoadFn: DataLoader.BatchLoadFn<K, V>,
    options?: DataLoader.Options<K, V>,
  ): DataLoader<K, V> {
    if (!this.loaders.has(key)) {
      const loader = new DataLoader(batchLoadFn, {
        cache: true,
        maxBatchSize: 100,
        ...options,
      });
      this.loaders.set(key, loader);
    }
    return this.loaders.get(key) as DataLoader<K, V>;
  }

  /**
   * Clear all loaders (useful for testing)
   */
  clearAll(): void {
    this.loaders.forEach(loader => loader.clearAll());
    this.loaders.clear();
  }

  /**
   * Clear a specific loader
   */
  clear(key: string): void {
    const loader = this.loaders.get(key);
    if (loader) {
      loader.clearAll();
      this.loaders.delete(key);
    }
  }

  /**
   * Prime a loader with data (useful for optimization)
   */
  prime<K, V>(key: string, id: K, value: V): void {
    const loader = this.loaders.get(key);
    if (loader) {
      loader.prime(id, value);
    }
  }
}

/**
 * Factory for creating common DataLoader batch functions
 */
export class DataLoaderFactory {
  /**
   * Create a batch function for loading entities by IDs
   */
  static createBatchByIds<T>(
    findByIds: (ids: readonly string[]) => Promise<T[]>,
    getId: (entity: T) => string,
  ): DataLoader.BatchLoadFn<string, T> {
    return async (ids: readonly string[]): Promise<(T | Error)[]> => {
      try {
        const entities = await findByIds(ids);
        const entityMap = new Map<string, T>();
        
        entities.forEach(entity => {
          entityMap.set(getId(entity), entity);
        });

        return ids.map(id => entityMap.get(id) || new Error(`Entity not found: ${id}`));
      } catch (error) {
        return ids.map(() => error as Error);
      }
    };
  }

  /**
   * Create a batch function for loading related entities
   */
  static createBatchByForeignKey<T>(
    findByForeignKeys: (keys: readonly string[]) => Promise<T[]>,
    getForeignKey: (entity: T) => string,
  ): DataLoader.BatchLoadFn<string, T[]> {
    return async (keys: readonly string[]): Promise<(T[] | Error)[]> => {
      try {
        const entities = await findByForeignKeys(keys);
        const entityMap = new Map<string, T[]>();
        
        // Group entities by foreign key
        entities.forEach(entity => {
          const key = getForeignKey(entity);
          if (!entityMap.has(key)) {
            entityMap.set(key, []);
          }
          entityMap.get(key)!.push(entity);
        });

        return keys.map(key => entityMap.get(key) || []);
      } catch (error) {
        return keys.map(() => error as Error);
      }
    };
  }

  /**
   * Create a batch function for counting related entities
   */
  static createBatchCount(
    countByKeys: (keys: readonly string[]) => Promise<Array<{ key: string; count: number }>>,
  ): DataLoader.BatchLoadFn<string, number> {
    return async (keys: readonly string[]): Promise<(number | Error)[]> => {
      try {
        const counts = await countByKeys(keys);
        const countMap = new Map<string, number>();
        
        counts.forEach(({ key, count }) => {
          countMap.set(key, count);
        });

        return keys.map(key => countMap.get(key) || 0);
      } catch (error) {
        return keys.map(() => error as Error);
      }
    };
  }
}

/**
 * Common DataLoader keys used across the application
 */
export const DATALOADER_KEYS = {
  // User-related loaders
  USER_BY_ID: 'user_by_id',
  USERS_BY_TENANT: 'users_by_tenant',
  
  // Tenant-related loaders
  TENANT_BY_ID: 'tenant_by_id',
  
  // Product-related loaders
  PRODUCT_BY_ID: 'product_by_id',
  PRODUCTS_BY_CATEGORY: 'products_by_category',
  
  // Inventory-related loaders
  INVENTORY_BY_PRODUCT: 'inventory_by_product',
  INVENTORY_BY_LOCATION: 'inventory_by_location',
  
  // Transaction-related loaders
  TRANSACTION_BY_ID: 'transaction_by_id',
  TRANSACTIONS_BY_CUSTOMER: 'transactions_by_customer',
  
  // Customer-related loaders
  CUSTOMER_BY_ID: 'customer_by_id',
  CUSTOMERS_BY_TENANT: 'customers_by_tenant',
  
  // Employee-related loaders
  EMPLOYEE_BY_ID: 'employee_by_id',
  EMPLOYEES_BY_TENANT: 'employees_by_tenant',
} as const;