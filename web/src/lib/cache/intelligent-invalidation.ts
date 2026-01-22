import { apolloClient } from '@/lib/apollo/client';
import { getMultiTierCache } from './multi-tier-cache';

/**
 * Intelligent cache invalidation system that automatically invalidates
 * related cache entries based on GraphQL mutations and backend changes
 */

export interface InvalidationRule {
  mutationType: string;
  affectedQueries: string[];
  affectedTypes: string[];
  tenantSpecific: boolean;
  customInvalidator?: (variables: unknown) => Promise<void>;
}

export interface InvalidationMetrics {
  totalInvalidations: number;
  mutationBasedInvalidations: number;
  timeBasedInvalidations: number;
  manualInvalidations: number;
  averageInvalidationTime: number;
  lastInvalidation: Date | null;
}

/**
 * Mutation Impact Analyzer
 * Analyzes GraphQL mutations to determine cache invalidation scope
 */
class MutationImpactAnalyzer {
  private mutationRules = new Map<string, InvalidationRule>();

  constructor() {
    this.setupDefaultRules();
  }

  private setupDefaultRules(): void {
    // User-related mutations
    this.addRule({
      mutationType: 'createUser',
      affectedQueries: ['users', 'userStats', 'tenantUsers'],
      affectedTypes: ['User', 'UserConnection'],
      tenantSpecific: true,
    });

    this.addRule({
      mutationType: 'updateUser',
      affectedQueries: ['users', 'user', 'currentUser', 'userProfile'],
      affectedTypes: ['User'],
      tenantSpecific: true,
    });

    this.addRule({
      mutationType: 'deleteUser',
      affectedQueries: ['users', 'userStats', 'tenantUsers'],
      affectedTypes: ['User', 'UserConnection'],
      tenantSpecific: true,
    });

    // Tenant-related mutations
    this.addRule({
      mutationType: 'createTenant',
      affectedQueries: ['tenants', 'tenantStats'],
      affectedTypes: ['Tenant', 'TenantConnection'],
      tenantSpecific: false,
    });

    this.addRule({
      mutationType: 'updateTenant',
      affectedQueries: ['tenants', 'tenant', 'currentTenant'],
      affectedTypes: ['Tenant'],
      tenantSpecific: false,
    });

    this.addRule({
      mutationType: 'switchTenant',
      affectedQueries: ['*'], // Invalidate everything
      affectedTypes: ['*'],
      tenantSpecific: true,
      customInvalidator: async () => {
        // Clear all tenant-specific cache
        const cache = getMultiTierCache();
        // Implementation would clear tenant cache
      },
    });

    // Business module mutations
    this.addBusinessModuleRules();
  }

  private addBusinessModuleRules(): void {
    const businessModules = [
      'inventory', 'warehouse', 'pos', 'financial', 'supplier',
      'employee', 'crm', 'location', 'integration', 'communication',
      'analytics', 'backup', 'security', 'queue', 'health'
    ];

    businessModules.forEach(module => {
      // Create mutations
      this.addRule({
        mutationType: `create${this.capitalize(module)}`,
        affectedQueries: [`${module}s`, `${module}Stats`],
        affectedTypes: [this.capitalize(module), `${this.capitalize(module)}Connection`],
        tenantSpecific: true,
      });

      // Update mutations
      this.addRule({
        mutationType: `update${this.capitalize(module)}`,
        affectedQueries: [`${module}s`, module],
        affectedTypes: [this.capitalize(module)],
        tenantSpecific: true,
      });

      // Delete mutations
      this.addRule({
        mutationType: `delete${this.capitalize(module)}`,
        affectedQueries: [`${module}s`, `${module}Stats`],
        affectedTypes: [this.capitalize(module), `${this.capitalize(module)}Connection`],
        tenantSpecific: true,
      });
    });
  }

  addRule(rule: InvalidationRule): void {
    this.mutationRules.set(rule.mutationType, rule);
  }

  getRule(mutationType: string): InvalidationRule | undefined {
    return this.mutationRules.get(mutationType);
  }

  analyzeImpact(mutationType: string, variables: unknown): {
    queries: string[];
    types: string[];
    tenantSpecific: boolean;
    customInvalidator?: (variables: unknown) => Promise<void>;
  } {
    const rule = this.getRule(mutationType);
    
    if (!rule) {
      // Default fallback - invalidate based on mutation name
      const entityType = this.extractEntityType(mutationType);
      return {
        queries: [entityType.toLowerCase() + 's', entityType.toLowerCase()],
        types: [entityType],
        tenantSpecific: true,
      };
    }

    return {
      queries: rule.affectedQueries,
      types: rule.affectedTypes,
      tenantSpecific: rule.tenantSpecific,
      ...(rule.customInvalidator !== undefined && { customInvalidator: rule.customInvalidator }),
    };
  }

  private extractEntityType(mutationType: string): string {
    // Extract entity type from mutation name (e.g., 'createUser' -> 'User')
    const match = mutationType.match(/^(create|update|delete)(.+)$/);
    return match && match[2] ? this.capitalize(match[2]) : 'Unknown';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Cache Invalidation Engine
 */
export class CacheInvalidationEngine {
  private analyzer: MutationImpactAnalyzer;
  private metrics: InvalidationMetrics = {
    totalInvalidations: 0,
    mutationBasedInvalidations: 0,
    timeBasedInvalidations: 0,
    manualInvalidations: 0,
    averageInvalidationTime: 0,
    lastInvalidation: null,
  };

  private invalidationQueue = new Set<string>();
  private batchInvalidationTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.analyzer = new MutationImpactAnalyzer();
    this.setupAutomaticInvalidation();
  }

  /**
   * Invalidate cache based on GraphQL mutation
   */
  async invalidateFromMutation(
    mutationType: string,
    variables: unknown,
    tenantId?: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const impact = this.analyzer.analyzeImpact(mutationType, variables);
      
      // Execute custom invalidator if provided
      if (impact.customInvalidator) {
        await impact.customInvalidator(variables);
      }

      // Invalidate Apollo Cache queries
      await this.invalidateApolloQueries(impact.queries, tenantId);

      // Invalidate Apollo Cache types
      await this.invalidateApolloTypes(impact.types, tenantId);

      // Invalidate multi-tier cache
      await this.invalidateMultiTierCache(impact.queries, impact.types, tenantId);

      this.updateMetrics('mutation', Date.now() - startTime);
      
      console.log(`Cache invalidated for mutation: ${mutationType}`, {
        queries: impact.queries,
        types: impact.types,
        tenantSpecific: impact.tenantSpecific,
        tenantId,
      });
    } catch (error) {
      console.error(`Cache invalidation failed for mutation ${mutationType}:`, error);
    }
  }

  /**
   * Invalidate cache based on backend data changes (via subscriptions)
   */
  async invalidateFromBackendChange(
    changeType: 'create' | 'update' | 'delete',
    entityType: string,
    entityId: string,
    tenantId?: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const mutationType = `${changeType}${entityType}`;
      await this.invalidateFromMutation(mutationType, { id: entityId }, tenantId);
      
      this.updateMetrics('backend', Date.now() - startTime);
    } catch (error) {
      console.error(`Backend change invalidation failed:`, error);
    }
  }

  /**
   * Manual cache invalidation
   */
  async invalidateManual(options: {
    queries?: string[];
    types?: string[];
    keys?: string[];
    tenantId?: string;
    pattern?: string;
  }): Promise<void> {
    const startTime = Date.now();

    try {
      const { queries = [], types = [], keys = [], tenantId, pattern } = options;

      // Invalidate specific queries
      if (queries.length > 0) {
        await this.invalidateApolloQueries(queries, tenantId);
      }

      // Invalidate specific types
      if (types.length > 0) {
        await this.invalidateApolloTypes(types, tenantId);
      }

      // Invalidate specific cache keys
      if (keys.length > 0) {
        await this.invalidateMultiTierCacheKeys(keys);
      }

      // Invalidate by pattern
      if (pattern) {
        await this.invalidateByPattern(pattern, tenantId);
      }

      this.updateMetrics('manual', Date.now() - startTime);
    } catch (error) {
      console.error('Manual cache invalidation failed:', error);
    }
  }

  /**
   * Batch invalidation for performance
   */
  queueInvalidation(key: string): void {
    this.invalidationQueue.add(key);

    // Debounce batch processing
    if (this.batchInvalidationTimer) {
      clearTimeout(this.batchInvalidationTimer);
    }

    this.batchInvalidationTimer = setTimeout(() => {
      this.processBatchInvalidation();
    }, 100); // 100ms debounce
  }

  /**
   * Time-based cache invalidation
   */
  async invalidateExpired(): Promise<void> {
    const startTime = Date.now();

    try {
      // Apollo Cache doesn't have built-in TTL, so we rely on multi-tier cache
      const multiTierCache = getMultiTierCache();
      
      // The multi-tier cache handles TTL automatically, but we can trigger cleanup
      // This is more of a maintenance operation
      
      this.updateMetrics('time', Date.now() - startTime);
    } catch (error) {
      console.error('Time-based invalidation failed:', error);
    }
  }

  /**
   * Get invalidation metrics
   */
  getMetrics(): InvalidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalInvalidations: 0,
      mutationBasedInvalidations: 0,
      timeBasedInvalidations: 0,
      manualInvalidations: 0,
      averageInvalidationTime: 0,
      lastInvalidation: null,
    };
  }

  // Private helper methods

  private async invalidateApolloQueries(queries: string[], tenantId?: string): Promise<void> {
    const cache = apolloClient.cache;

    for (const queryName of queries) {
      if (queryName === '*') {
        // Invalidate all queries
        cache.evict({ fieldName: 'ROOT_QUERY' });
      } else {
        // Invalidate specific query
        cache.evict({ fieldName: queryName });
        
        // Also try with tenant prefix if applicable
        if (tenantId) {
          cache.evict({ fieldName: `${queryName}_${tenantId}` });
        }
      }
    }

    cache.gc(); // Garbage collect
  }

  private async invalidateApolloTypes(types: string[], tenantId?: string): Promise<void> {
    const cache = apolloClient.cache;

    for (const typeName of types) {
      if (typeName === '*') {
        // Clear entire cache
        cache.reset();
        return;
      } else {
        // Evict all instances of this type
        cache.evict({ id: `ROOT_QUERY`, fieldName: typeName });
        
        // Also evict type-specific entries
        const cacheData = cache.extract();
        Object.keys(cacheData).forEach(key => {
          if (key.startsWith(`${typeName}:`)) {
            cache.evict({ id: key });
          }
        });
      }
    }

    cache.gc();
  }

  private async invalidateMultiTierCache(
    queries: string[],
    types: string[],
    tenantId?: string
  ): Promise<void> {
    const multiTierCache = getMultiTierCache();

    // Create cache keys to invalidate
    const keysToInvalidate: string[] = [];

    queries.forEach(query => {
      keysToInvalidate.push(query);
      if (tenantId) {
        keysToInvalidate.push(`${query}_${tenantId}`);
      }
    });

    types.forEach(type => {
      keysToInvalidate.push(type.toLowerCase());
      if (tenantId) {
        keysToInvalidate.push(`${type.toLowerCase()}_${tenantId}`);
      }
    });

    // Delete keys from multi-tier cache
    for (const key of keysToInvalidate) {
      await multiTierCache.delete(key);
    }
  }

  private async invalidateMultiTierCacheKeys(keys: string[]): Promise<void> {
    const multiTierCache = getMultiTierCache();

    for (const key of keys) {
      await multiTierCache.delete(key);
    }
  }

  private async invalidateByPattern(pattern: string, tenantId?: string): Promise<void> {
    // For Apollo Cache, we need to extract and filter keys
    const cache = apolloClient.cache;
    const cacheData = cache.extract();
    
    const regex = new RegExp(pattern);
    
    Object.keys(cacheData).forEach(key => {
      if (regex.test(key)) {
        cache.evict({ id: key });
      }
    });

    cache.gc();

    // For multi-tier cache, we'd need to implement pattern matching
    // This is a simplified version
    const multiTierCache = getMultiTierCache();
    // Multi-tier cache would need pattern support for full implementation
  }

  private async processBatchInvalidation(): Promise<void> {
    if (this.invalidationQueue.size === 0) return;

    const keys = Array.from(this.invalidationQueue);
    this.invalidationQueue.clear();

    await this.invalidateMultiTierCacheKeys(keys);
  }

  private setupAutomaticInvalidation(): void {
    // Set up periodic cleanup
    setInterval(() => {
      this.invalidateExpired();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private updateMetrics(type: 'mutation' | 'backend' | 'manual' | 'time', duration: number): void {
    this.metrics.totalInvalidations++;
    this.metrics.lastInvalidation = new Date();
    
    switch (type) {
      case 'mutation':
      case 'backend':
        this.metrics.mutationBasedInvalidations++;
        break;
      case 'time':
        this.metrics.timeBasedInvalidations++;
        break;
      case 'manual':
        this.metrics.manualInvalidations++;
        break;
    }

    // Update average response time
    this.metrics.averageInvalidationTime = 
      (this.metrics.averageInvalidationTime * 0.9) + (duration * 0.1);
  }
}

// Singleton instance
let invalidationEngineInstance: CacheInvalidationEngine | null = null;

export function getCacheInvalidationEngine(): CacheInvalidationEngine {
  if (!invalidationEngineInstance) {
    invalidationEngineInstance = new CacheInvalidationEngine();
  }
  
  return invalidationEngineInstance;
}

// Hook for easy integration with mutations
export function useIntelligentInvalidation() {
  const engine = getCacheInvalidationEngine();

  return {
    invalidateFromMutation: engine.invalidateFromMutation.bind(engine),
    invalidateManual: engine.invalidateManual.bind(engine),
    getMetrics: engine.getMetrics.bind(engine),
  };
}