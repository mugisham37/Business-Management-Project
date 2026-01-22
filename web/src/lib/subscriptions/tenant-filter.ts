import { DocumentNode, TypedDocumentNode } from '@apollo/client';
import { Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { apolloClient } from '@/lib/apollo/client';
import { subscriptionManager, SubscriptionOptions } from './subscription-manager';

export interface TenantFilterConfig {
  tenantId: string;
  businessTier: 'MICRO' | 'SMALL' | 'MEDIUM' | 'ENTERPRISE';
  features: string[];
  permissions: string[];
}

export interface TenantSubscriptionEvent<T = unknown> {
  data: T;
  tenantId: string;
  eventType: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Tenant-aware subscription filter that ensures events are properly scoped
 * and automatically updates the Apollo cache
 */
export class TenantSubscriptionFilter {
  private tenantConfig: TenantFilterConfig | null = null;
  private cacheUpdateHandlers = new Map<string, (data: unknown) => void>();

  /**
   * Set the current tenant configuration
   */
  setTenantConfig(config: TenantFilterConfig): void {
    this.tenantConfig = config;
  }

  /**
   * Create a tenant-filtered subscription that automatically updates cache
   */
  createFilteredSubscription<T = unknown>(
    subscription: DocumentNode | TypedDocumentNode,
    variables?: Record<string, unknown>,
    options?: SubscriptionOptions & {
      cacheUpdate?: (data: T, cache: unknown) => void;
      eventFilter?: (event: TenantSubscriptionEvent<T>) => boolean;
    }
  ): Observable<T> {
    if (!this.tenantConfig) {
      throw new Error('Tenant configuration not set. Call setTenantConfig first.');
    }

    const tenantId = this.tenantConfig.tenantId;
    
    // Enhance variables with tenant context
    const enhancedVariables = {
      ...variables,
      tenantId,
      businessTier: this.tenantConfig.businessTier
    };

    // Create subscription with tenant filtering
    return subscriptionManager.subscribe<TenantSubscriptionEvent<T>>(
      subscription,
      enhancedVariables,
      {
        ...options,
        tenantFilter: tenantId,
        onError: (error) => {
          console.error('Tenant subscription error:', error);
          if (options?.onError) {
            options.onError(error);
          }
        }
      }
    ).pipe(
      // Filter out events not belonging to current tenant
      filter(result => {
        if (!result.data) return false;
        
        const event = result.data;
        
        // Basic tenant filtering
        if (event.tenantId && event.tenantId !== tenantId) {
          return false;
        }
        
        // Custom event filtering
        if (options?.eventFilter && !options.eventFilter(event)) {
          return false;
        }
        
        // Feature-based filtering
        if (event.metadata?.requiredFeature) {
          return this.tenantConfig!.features.includes(event.metadata.requiredFeature as string);
        }
        
        // Permission-based filtering
        if (event.metadata?.requiredPermission) {
          return this.tenantConfig!.permissions.includes(event.metadata.requiredPermission as string);
        }
        
        return true;
      }),
      
      // Extract the actual data from the event wrapper
      map(result => result.data!.data),
      
      // Update Apollo cache automatically
      tap(data => {
        if (options?.cacheUpdate) {
          try {
            const cache = apolloClient.cache;
            options.cacheUpdate(data, cache);
          } catch (error) {
            console.error('Cache update failed:', error);
          }
        }
      })
    );
  }

  /**
   * Register a cache update handler for a specific subscription type
   */
  registerCacheUpdateHandler(
    subscriptionName: string,
    handler: (data: unknown) => void
  ): void {
    this.cacheUpdateHandlers.set(subscriptionName, handler);
  }

  /**
   * Get registered cache update handler
   */
  getCacheUpdateHandler(subscriptionName: string): ((data: unknown) => void) | undefined {
    return this.cacheUpdateHandlers.get(subscriptionName);
  }

  /**
   * Validate if current tenant has access to a subscription
   */
  validateSubscriptionAccess(
    subscriptionName: string,
    requiredPermissions?: string[],
    requiredFeatures?: string[]
  ): boolean {
    if (!this.tenantConfig) return false;

    // Check permissions
    if (requiredPermissions) {
      const hasAllPermissions = requiredPermissions.every(permission =>
        this.tenantConfig!.permissions.includes(permission)
      );
      if (!hasAllPermissions) return false;
    }

    // Check features
    if (requiredFeatures) {
      const hasAllFeatures = requiredFeatures.every(feature =>
        this.tenantConfig!.features.includes(feature)
      );
      if (!hasAllFeatures) return false;
    }

    return true;
  }

  /**
   * Create a subscription with automatic cache updates for common patterns
   */
  createAutoUpdatingSubscription<T = unknown>(
    subscription: DocumentNode | TypedDocumentNode,
    config: {
      variables?: Record<string, unknown>;
      entityType: string;
      updateType: 'CREATE' | 'UPDATE' | 'DELETE';
      cacheQueries?: string[];
      requiredPermissions?: string[];
      requiredFeatures?: string[];
    }
  ): Observable<T> {
    // Validate access
    if (!this.validateSubscriptionAccess(
      config.entityType,
      config.requiredPermissions,
      config.requiredFeatures
    )) {
      throw new Error(`Access denied for subscription: ${config.entityType}`);
    }

    return this.createFilteredSubscription<T>(
      subscription,
      config.variables,
      {
        cacheUpdate: (data: T) => {
          this.handleAutomaticCacheUpdate(data, config);
        }
      }
    );
  }

  private handleAutomaticCacheUpdate<T>(
    data: T,
    config: {
      entityType: string;
      updateType: 'CREATE' | 'UPDATE' | 'DELETE';
      cacheQueries?: string[];
    }
  ): void {
    const cache = apolloClient.cache;

    try {
      switch (config.updateType) {
        case 'CREATE':
          this.handleCreateUpdate(cache, data, config);
          break;
        case 'UPDATE':
          this.handleUpdateUpdate(cache, data, config);
          break;
        case 'DELETE':
          this.handleDeleteUpdate(cache, data, config);
          break;
      }
    } catch (error) {
      console.error(`Cache update failed for ${config.entityType}:`, error);
    }
  }

  private handleCreateUpdate(cache: unknown, data: unknown, config: Record<string, unknown>): void {
    // Add new entity to relevant list queries
    if (config.cacheQueries && Array.isArray(config.cacheQueries)) {
      (config.cacheQueries as string[]).forEach((queryName: string) => {
        try {
          const cacheObj = cache as Record<string, unknown>;
          const readQuery = cacheObj.readQuery as ((opts: unknown) => unknown) | undefined;
          const writeQuery = cacheObj.writeQuery as ((opts: unknown) => unknown) | undefined;
          
          if (!readQuery || !writeQuery) return;
          
          const queryDoc = this.getQueryByName(queryName);
          const existingData = readQuery({
            query: queryDoc,
            variables: { tenantId: this.tenantConfig!.tenantId }
          });

          if (existingData) {
            const typedExistingData = existingData as Record<string, unknown>;
            if (typedExistingData[queryName]) {
              const existingList = (typedExistingData[queryName] as unknown[]) || [];
              writeQuery({
                query: queryDoc,
                variables: { tenantId: this.tenantConfig!.tenantId },
                data: {
                  ...typedExistingData,
                  [queryName]: [...existingList, data]
                }
              });
            }
          }
        } catch (error) {
          // Query might not be in cache yet, which is fine
          console.debug(`Query ${queryName} not in cache:`, error);
        }
      });
    }
  }

  private handleUpdateUpdate(cache: unknown, data: unknown, config: Record<string, unknown>): void {
    // Update existing entity in cache
    const entityData = data as Record<string, unknown>;
    const entityId = entityData.id;
    if (!entityId) return;

    // Update the entity directly
    const cacheObj = cache as Record<string, unknown>;
    const writeFragment = cacheObj.writeFragment as ((opts: unknown) => void) | undefined;
    const identify = cacheObj.identify as ((val: unknown) => string) | undefined;
    
    if (writeFragment && identify) {
      writeFragment({
        id: identify(data),
        fragment: this.getFragmentForEntity(config.entityType as string),
        data
      });
    }

    // Update in list queries
    if (config.cacheQueries && Array.isArray(config.cacheQueries)) {
      (config.cacheQueries as string[]).forEach((queryName: string) => {
        try {
          const readQuery = cacheObj.readQuery as ((opts: unknown) => unknown) | undefined;
          const writeQuery = cacheObj.writeQuery as ((opts: unknown) => void) | undefined;
          
          if (!readQuery || !writeQuery) return;
          
          const existingData = readQuery({
            query: this.getQueryByName(queryName),
            variables: { tenantId: this.tenantConfig!.tenantId }
          });

          if (existingData) {
            const typedExistingData = existingData as Record<string, unknown>;
            if (typedExistingData[queryName]) {
              const existingList = (typedExistingData[queryName] as Record<string, unknown>[]) || [];
              const updatedList = existingList.map((item) => {
                return (item as Record<string, unknown>).id === entityId ? { ...item, ...(data as Record<string, unknown>) } : item;
              });

              writeQuery({
                query: this.getQueryByName(queryName),
                variables: { tenantId: this.tenantConfig!.tenantId },
                data: {
                  ...typedExistingData,
                  [queryName]: updatedList
                }
              });
            }
          }
        } catch (error) {
          console.debug(`Query ${queryName} not in cache:`, error);
        }
      });
    }
  }

  private handleDeleteUpdate(cache: unknown, data: unknown, config: Record<string, unknown>): void {
    const entityData = data as Record<string, unknown>;
    const entityId = entityData.id;
    if (!entityId) return;

    // Remove from cache
    const cacheObj = cache as Record<string, unknown>;
    const evict = cacheObj.evict as ((opts: unknown) => void) | undefined;
    const identify = cacheObj.identify as ((val: unknown) => string) | undefined;
    
    if (evict && identify) {
      evict({
        id: identify(data)
      });
    }

    // Remove from list queries
    if (config.cacheQueries && Array.isArray(config.cacheQueries)) {
      (config.cacheQueries as string[]).forEach((queryName: string) => {
        try {
          const readQuery = cacheObj.readQuery as ((opts: unknown) => unknown) | undefined;
          const writeQuery = cacheObj.writeQuery as ((opts: unknown) => void) | undefined;
          
          if (!readQuery || !writeQuery) return;
          
          const existingData = readQuery({
            query: this.getQueryByName(queryName),
            variables: { tenantId: this.tenantConfig!.tenantId }
          });

          if (existingData) {
            const typedExistingData = existingData as Record<string, unknown>;
            if (typedExistingData[queryName]) {
              const existingList = (typedExistingData[queryName] as Record<string, unknown>[]) || [];
              const filteredList = existingList.filter(
                (item) => (item as Record<string, unknown>).id !== entityId
              );

              writeQuery({
                query: this.getQueryByName(queryName),
                variables: { tenantId: this.tenantConfig!.tenantId },
                data: {
                  ...typedExistingData,
                  [queryName]: filteredList
                }
              });
            }
          }
        } catch (error) {
          console.debug(`Query ${queryName} not in cache:`, error);
        }
      });
    }
  }

  private getQueryByName(queryName: string): DocumentNode {
    // This would typically be imported from your generated queries
    // For now, we'll use a placeholder
    throw new Error(`Query ${queryName} not implemented. Import from generated queries.`);
  }

  private getFragmentForEntity(entityType: string): DocumentNode {
    // This would typically be imported from your generated fragments
    // For now, we'll use a placeholder
    throw new Error(`Fragment for ${entityType} not implemented. Import from generated fragments.`);
  }
}

// Singleton instance
export const tenantSubscriptionFilter = new TenantSubscriptionFilter();