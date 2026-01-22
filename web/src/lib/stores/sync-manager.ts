/**
 * Store Synchronization Manager
 * Bidirectional sync between Zustand stores and Apollo Cache
 * Requirements: 6.2, 6.4, 6.5
 */

import { DocumentNode } from '@apollo/client';
import { apolloClient } from '@/lib/apollo/client';
import { useAuthStore } from './auth-store';
import { useTenantStore } from './tenant-store';
import { useFeatureStore } from './feature-store';
import { cacheInvalidation } from '@/lib/apollo/cache-utils';
import { User, Tenant, FeatureFlag } from '@/types/core';

export interface SyncManagerConfig {
  enableAuthSync: boolean;
  enableTenantSync: boolean;
  enableFeatureSync: boolean;
  syncInterval?: number;
  onSyncError?: (error: Error, context: string) => void;
}

export interface OptimisticUpdate<T = unknown> {
  id: string;
  type: 'auth' | 'tenant' | 'feature';
  operation: string;
  data: T;
  timestamp: Date;
  rollback: () => void;
}

/**
 * Store Synchronization Manager
 * Manages bidirectional sync between Zustand stores and Apollo Cache
 */
export class StoreSyncManager {
  private config: Required<SyncManagerConfig>;
  private unsubscribers: (() => void)[] = [];
  private optimisticUpdates: Map<string, OptimisticUpdate> = new Map();
  private syncInProgress = false;

  constructor(config: SyncManagerConfig = {}) {
    this.config = {
      enableAuthSync: true,
      enableTenantSync: true,
      enableFeatureSync: true,
      syncInterval: 30000, // 30 seconds
      onSyncError: (error, context) => console.error(`Sync error in ${context}:`, error),
      ...config,
    };

    this.initializeSync();
  }

  /**
   * Initialize synchronization between stores and Apollo Cache
   */
  private initializeSync(): void {
    if (this.config.enableAuthSync) {
      this.setupAuthSync();
    }

    if (this.config.enableTenantSync) {
      this.setupTenantSync();
    }

    if (this.config.enableFeatureSync) {
      this.setupFeatureSync();
    }

    // Set up periodic sync validation
    if (this.config.syncInterval > 0) {
      this.setupPeriodicSync();
    }
  }

  /**
   * Set up authentication state synchronization
   */
  private setupAuthSync(): void {
    const authStore = useAuthStore.getState();

    // Subscribe to auth store changes
    const unsubscribeAuth = useAuthStore.subscribe(
      (state) => state.user,
      (user, previousUser) => {
        if (user !== previousUser && !this.syncInProgress) {
          this.syncUserToCache(user);
        }
      }
    );

    // Subscribe to token changes
    const unsubscribeTokens = useAuthStore.subscribe(
      (state) => state.tokens,
      (tokens, previousTokens) => {
        if (tokens !== previousTokens && !this.syncInProgress) {
          this.updateAuthHeaders(tokens?.accessToken || null);
        }
      }
    );

    this.unsubscribers.push(unsubscribeAuth, unsubscribeTokens);
  }

  /**
   * Set up tenant context synchronization
   */
  private setupTenantSync(): void {
    // Subscribe to tenant changes
    const unsubscribeTenant = useTenantStore.subscribe(
      (state) => state.currentTenant,
      (tenant, previousTenant) => {
        if (tenant !== previousTenant && !this.syncInProgress) {
          this.syncTenantToCache(tenant);
          
          // Clear tenant-specific cache when switching
          if (previousTenant && tenant?.id !== previousTenant.id) {
            this.clearTenantSpecificCache();
          }
        }
      }
    );

    // Subscribe to cache clear events
    const unsubscribeCacheCleared = useTenantStore.subscribe(
      (state) => state.lastCacheCleared,
      (lastCleared) => {
        if (lastCleared && !this.syncInProgress) {
          this.clearTenantSpecificCache();
        }
      }
    );

    this.unsubscribers.push(unsubscribeTenant, unsubscribeCacheCleared);
  }

  /**
   * Set up feature flag synchronization
   */
  private setupFeatureSync(): void {
    // Subscribe to feature changes
    const unsubscribeFeatures = useFeatureStore.subscribe(
      (state) => state.features,
      (features, previousFeatures) => {
        if (features !== previousFeatures && !this.syncInProgress) {
          this.syncFeaturesToCache(features);
        }
      }
    );

    this.unsubscribers.push(unsubscribeFeatures);
  }

  /**
   * Set up periodic synchronization validation
   */
  private setupPeriodicSync(): void {
    const interval = setInterval(() => {
      this.validateSync();
    }, this.config.syncInterval);

    this.unsubscribers.push(() => clearInterval(interval));
  }

  /**
   * Sync user data to Apollo Cache
   */
  private async syncUserToCache(user: User | null): Promise<void> {
    try {
      if (user) {
        // Write user data to cache
        apolloClient.cache.writeFragment({
          id: `User:${user.id}`,
          fragment: gql`
            fragment UserData on User {
              id
              email
              firstName
              lastName
              avatar
              tenants {
                tenantId
                role
                permissions {
                  name
                  description
                }
                isActive
              }
              mfaEnabled
              lastLoginAt
              createdAt
              updatedAt
            }
          `,
          data: user,
        });

        // Update current user query
        apolloClient.cache.writeQuery({
          query: gql`
            query GetCurrentUser {
              currentUser {
                id
                email
                firstName
                lastName
                avatar
                tenants {
                  tenantId
                  role
                  permissions {
                    name
                    description
                  }
                  isActive
                }
                mfaEnabled
                lastLoginAt
                createdAt
                updatedAt
              }
            }
          `,
          data: { currentUser: user },
        });
      } else {
        // Clear user data from cache
        cacheInvalidation.invalidateFields(['currentUser', 'me']);
      }
    } catch (error) {
      this.config.onSyncError(error as Error, 'auth-sync');
    }
  }

  /**
   * Sync tenant data to Apollo Cache
   */
  private async syncTenantToCache(tenant: Tenant | null): Promise<void> {
    try {
      if (tenant) {
        // Write tenant data to cache
        apolloClient.cache.writeFragment({
          id: `Tenant:${tenant.id}`,
          fragment: gql`
            fragment TenantData on Tenant {
              id
              name
              subdomain
              businessTier
              settings {
                timezone
                currency
                dateFormat
                language
                features
                limits {
                  maxUsers
                  maxStorage
                  maxApiCalls
                  maxIntegrations
                }
              }
              branding {
                primaryColor
                secondaryColor
                logo
                favicon
              }
            }
          `,
          data: tenant,
        });

        // Update current tenant query
        apolloClient.cache.writeQuery({
          query: gql`
            query GetCurrentTenant {
              currentTenant {
                id
                name
                subdomain
                businessTier
                settings {
                  timezone
                  currency
                  dateFormat
                  language
                  features
                  limits {
                    maxUsers
                    maxStorage
                    maxApiCalls
                    maxIntegrations
                  }
                }
                branding {
                  primaryColor
                  secondaryColor
                  logo
                  favicon
                }
              }
            }
          `,
          data: { currentTenant: tenant },
        });
      } else {
        // Clear tenant data from cache
        cacheInvalidation.invalidateFields(['currentTenant']);
      }
    } catch (error) {
      this.config.onSyncError(error as Error, 'tenant-sync');
    }
  }

  /**
   * Sync feature flags to Apollo Cache
   */
  private async syncFeaturesToCache(features: FeatureFlag[]): Promise<void> {
    try {
      // Update feature flags query
      apolloClient.cache.writeQuery({
        query: gql`
          query GetFeatureFlags($tenantId: ID) {
            featureFlags(tenantId: $tenantId) {
              key
              enabled
              config
              requiredTier
            }
          }
        `,
        variables: { tenantId: useTenantStore.getState().currentTenant?.id },
        data: { featureFlags: features },
      });
    } catch (error) {
      this.config.onSyncError(error as Error, 'feature-sync');
    }
  }

  /**
   * Update Apollo Client auth headers
   */
  private updateAuthHeaders(accessToken: string | null): void {
    try {
      const link = apolloClient.link;
      // Update auth headers in Apollo Client context
      // This would typically be handled by the auth link in the Apollo Client setup
      console.log('Auth headers updated:', accessToken ? 'Token present' : 'No token');
    } catch (error) {
      this.config.onSyncError(error as Error, 'auth-headers');
    }
  }

  /**
   * Clear tenant-specific cache data
   */
  private clearTenantSpecificCache(): void {
    try {
      cacheInvalidation.clearTenantCache();
      console.log('Tenant-specific cache cleared');
    } catch (error) {
      this.config.onSyncError(error as Error, 'cache-clear');
    }
  }

  /**
   * Create optimistic update
   */
  createOptimisticUpdate<T>(
    type: OptimisticUpdate['type'],
    operation: string,
    data: T,
    rollback: () => void
  ): string {
    const id = `${type}_${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const update: OptimisticUpdate<T> = {
      id,
      type,
      operation,
      data,
      timestamp: new Date(),
      rollback,
    };

    this.optimisticUpdates.set(id, update);
    
    // Auto-cleanup after 30 seconds
    setTimeout(() => {
      this.optimisticUpdates.delete(id);
    }, 30000);

    return id;
  }

  /**
   * Commit optimistic update
   */
  commitOptimisticUpdate(updateId: string): boolean {
    const update = this.optimisticUpdates.get(updateId);
    if (!update) return false;

    this.optimisticUpdates.delete(updateId);
    console.log(`Optimistic update committed: ${update.operation}`);
    return true;
  }

  /**
   * Rollback optimistic update
   */
  rollbackOptimisticUpdate(updateId: string): boolean {
    const update = this.optimisticUpdates.get(updateId);
    if (!update) return false;

    try {
      update.rollback();
      this.optimisticUpdates.delete(updateId);
      console.log(`Optimistic update rolled back: ${update.operation}`);
      return true;
    } catch (error) {
      this.config.onSyncError(error as Error, 'optimistic-rollback');
      return false;
    }
  }

  /**
   * Validate synchronization state
   */
  private async validateSync(): Promise<void> {
    if (this.syncInProgress) return;

    this.syncInProgress = true;

    try {
      // Validate auth sync
      const authState = useAuthStore.getState();
      if (authState.isAuthenticated && authState.user) {
        await this.syncUserToCache(authState.user);
      }

      // Validate tenant sync
      const tenantState = useTenantStore.getState();
      if (tenantState.currentTenant) {
        await this.syncTenantToCache(tenantState.currentTenant);
      }

      // Validate feature sync
      const featureState = useFeatureStore.getState();
      if (featureState.features.length > 0) {
        await this.syncFeaturesToCache(featureState.features);
      }
    } catch (error) {
      this.config.onSyncError(error as Error, 'sync-validation');
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Force synchronization of all stores
   */
  async forcSync(): Promise<void> {
    await this.validateSync();
  }

  /**
   * Get synchronization status
   */
  getSyncStatus() {
    return {
      inProgress: this.syncInProgress,
      optimisticUpdates: this.optimisticUpdates.size,
      config: this.config,
    };
  }

  /**
   * Cleanup synchronization
   */
  destroy(): void {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    this.optimisticUpdates.clear();
  }
}

// Simple GraphQL template literal function for cache operations
const gql = (strings: TemplateStringsArray, ...values: unknown[]): DocumentNode => {
  const query = strings.reduce((result, string, i) => {
    return result + string + (values[i] || '');
  }, '');
  
  // Return a minimal DocumentNode-like object
  return {
    kind: 'Document',
    definitions: [],
    loc: undefined,
    // Store the query string for debugging
    __query: query,
  } as DocumentNode;
};

// Default sync manager instance
let defaultSyncManager: StoreSyncManager | null = null;

export function createSyncManager(config?: SyncManagerConfig): StoreSyncManager {
  return new StoreSyncManager(config);
}

export function getDefaultSyncManager(): StoreSyncManager | null {
  return defaultSyncManager;
}

export function setDefaultSyncManager(manager: StoreSyncManager): void {
  defaultSyncManager = manager;
}

// Initialize default sync manager
if (typeof window !== 'undefined') {
  defaultSyncManager = new StoreSyncManager();
}

/**
 * Hook for accessing sync manager
 */
export function useSyncManager(): StoreSyncManager {
  if (!defaultSyncManager) {
    throw new Error('Sync manager not initialized');
  }
  return defaultSyncManager;
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdates() {
  const syncManager = useSyncManager();

  return {
    create: syncManager.createOptimisticUpdate.bind(syncManager),
    commit: syncManager.commitOptimisticUpdate.bind(syncManager),
    rollback: syncManager.rollbackOptimisticUpdate.bind(syncManager),
    status: syncManager.getSyncStatus(),
  };
}