import { Injectable } from '@nestjs/common';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { 
  IntelligentCacheService,
  AdvancedCacheService,
  APIPerformanceService,
  HorizontalScalingService,
  CacheInterceptor,
  CacheAccessGuard,
  Cache,
  CacheInvalidate,
  CacheWarm,
  DistributedCache,
  PerformanceMonitor,
  LoadBalance,
  SessionRequired,
  FullCache,
  CacheContext,
  CacheStrategy,
  CachePriority,
} from '../index';

/**
 * Example service demonstrating cache module usage
 * Shows how to integrate caching into business logic
 */
@Injectable()
export class ExampleCacheUsageService {
  constructor(
    private readonly intelligentCache: IntelligentCacheService,
    private readonly advancedCache: AdvancedCacheService,
    private readonly performanceService: APIPerformanceService,
    private readonly scalingService: HorizontalScalingService,
  ) {}

  /**
   * Example: Basic caching with intelligent cache service
   */
  async getUserProfile(userId: string, tenantId: string): Promise<any> {
    const cacheKey = `user:profile:${userId}`;
    
    // Try to get from cache first
    let profile = await this.intelligentCache.get(cacheKey, { tenantId });
    
    if (!profile) {
      // Load from database (simulated)
      profile = {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
        preferences: { theme: 'dark', language: 'en' },
        lastLogin: new Date(),
      };
      
      // Cache for 1 hour
      await this.intelligentCache.set(cacheKey, profile, { 
        tenantId, 
        ttl: 3600 
      });
    }
    
    return profile;
  }

  /**
   * Example: Advanced caching with fallback loader
   */
  async getProductCatalog(categoryId: string, tenantId: string): Promise<any[]> {
    const cacheKey = `catalog:category:${categoryId}`;
    
    const products = await this.advancedCache.get(cacheKey, {
      tenantId,
      useDistributed: true,
      warmOnMiss: true,
      fallbackLoader: async () => {
        // Simulate expensive database query
        return [
          { id: '1', name: 'Product 1', price: 99.99 },
          { id: '2', name: 'Product 2', price: 149.99 },
        ];
      },
    });
    
    return products || [];
  }

  /**
   * Example: Cache warming for frequently accessed data
   */
  async warmFrequentlyAccessedData(tenantId: string): Promise<void> {
    // Configure cache warming for popular products
    this.advancedCache.configureCacheWarming({
      key: 'products:popular',
      dataLoader: async () => {
        // Load popular products from database
        return [
          { id: '1', name: 'Popular Product 1', views: 1000 },
          { id: '2', name: 'Popular Product 2', views: 850 },
        ];
      },
      ttl: 1800, // 30 minutes
      priority: 'high',
      schedule: '*/10 * * * *', // Every 10 minutes
    });
  }

  /**
   * Example: Performance optimization
   */
  async optimizePerformance(): Promise<any> {
    const result = await this.performanceService.optimizeSettings();
    return {
      compressionOptimized: result.compressionOptimized,
      cacheOptimized: result.cacheOptimized,
      endpointsOptimized: result.endpointsOptimized,
    };
  }

  /**
   * Example: Session management
   */
  async createUserSession(userId: string, sessionData: any): Promise<void> {
    const sessionId = `session:${userId}:${Date.now()}`;
    
    await this.scalingService.createSession(sessionId, {
      userId,
      ...sessionData,
      createdAt: new Date(),
    });
  }
}

/**
 * Example GraphQL resolver using cache decorators
 * Shows how to use decorators for automatic caching
 */
@Resolver()
@UseGuards(CacheAccessGuard)
@UseInterceptors(CacheInterceptor)
export class ExampleCacheResolver {
  constructor(
    private readonly exampleService: ExampleCacheUsageService,
  ) {}

  /**
   * Example: Query with basic caching
   */
  @Query(() => String)
  @Cache({
    key: 'user:profile:{userId}',
    ttl: 3600,
    strategy: CacheStrategy.INTELLIGENT,
    priority: CachePriority.HIGH,
  })
  @PerformanceMonitor({ trackResponseTime: true, trackCacheHits: true })
  async getUserProfile(
    @Args('userId') userId: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<string> {
    const profile = await this.exampleService.getUserProfile(userId, cacheCtx?.tenantId);
    return JSON.stringify(profile);
  }

  /**
   * Example: Query with advanced caching and distributed cache
   */
  @Query(() => String)
  @FullCache({
    key: 'catalog:category:{categoryId}',
    ttl: 1800,
    strategy: CacheStrategy.DISTRIBUTED,
    priority: CachePriority.HIGH,
    useDistributed: true,
    warmOnMiss: true,
    compression: true,
    monitoring: true,
    loadBalance: true,
  })
  async getProductCatalog(
    @Args('categoryId') categoryId: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<string> {
    const products = await this.exampleService.getProductCatalog(categoryId, cacheCtx?.tenantId);
    return JSON.stringify(products);
  }

  /**
   * Example: Mutation with cache invalidation
   */
  @Mutation(() => String)
  @CacheInvalidate({
    patterns: ['user:profile:*', 'user:preferences:*'],
    tags: ['user-data'],
  })
  @PerformanceMonitor({ trackResponseTime: true })
  async updateUserProfile(
    @Args('userId') userId: string,
    @Args('profileData') profileData: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<string> {
    // Update user profile (simulated)
    const updatedProfile = {
      ...JSON.parse(profileData),
      updatedAt: new Date(),
    };
    
    return JSON.stringify({ success: true, profile: updatedProfile });
  }

  /**
   * Example: Query with cache warming
   */
  @Query(() => String)
  @CacheWarm({
    priority: CachePriority.CRITICAL,
    schedule: '*/5 * * * *', // Every 5 minutes
    dependencies: ['products:popular', 'categories:active'],
  })
  @Cache({
    key: 'dashboard:analytics:{tenantId}',
    ttl: 300,
    strategy: CacheStrategy.MULTI_LEVEL,
  })
  async getDashboardAnalytics(
    @CacheContext() cacheCtx?: any,
  ): Promise<string> {
    // Generate dashboard analytics (simulated)
    const analytics = {
      totalUsers: 1250,
      activeUsers: 890,
      revenue: 45678.90,
      topProducts: ['Product A', 'Product B', 'Product C'],
      generatedAt: new Date(),
    };
    
    return JSON.stringify(analytics);
  }

  /**
   * Example: Query with session requirement and load balancing
   */
  @Query(() => String)
  @SessionRequired({
    strategy: 'distributed',
    ttl: 3600,
    replication: true,
  })
  @LoadBalance({
    strategy: 'least-connections',
    healthCheck: true,
  })
  @Cache({
    key: 'user:dashboard:{userId}',
    ttl: 600,
    strategy: CacheStrategy.INTELLIGENT,
  })
  async getUserDashboard(
    @Args('userId') userId: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<string> {
    // Generate user-specific dashboard (simulated)
    const dashboard = {
      userId,
      widgets: ['sales', 'analytics', 'notifications'],
      preferences: { layout: 'grid', theme: 'dark' },
      lastUpdated: new Date(),
    };
    
    return JSON.stringify(dashboard);
  }

  /**
   * Example: Performance optimization mutation
   */
  @Mutation(() => String)
  @CacheInvalidate({ patterns: ['performance:*', 'metrics:*'] })
  @PerformanceMonitor({ 
    trackResponseTime: true,
    alertThreshold: 2000,
  })
  async optimizeSystemPerformance(): Promise<string> {
    const result = await this.exampleService.optimizePerformance();
    return JSON.stringify({
      success: true,
      optimizations: result,
      timestamp: new Date(),
    });
  }
}

/**
 * Example: Manual cache operations without decorators
 * Shows direct service usage for complex scenarios
 */
@Injectable()
export class ExampleManualCacheService {
  constructor(
    private readonly intelligentCache: IntelligentCacheService,
    private readonly advancedCache: AdvancedCacheService,
  ) {}

  /**
   * Example: Complex caching logic with multiple cache layers
   */
  async getComplexData(key: string, tenantId: string): Promise<any> {
    // Try L1 cache first (fastest)
    let data = await this.intelligentCache.get(key, {
      tenantId,
      useL1Cache: true,
      useL2Cache: false,
    });

    if (data) {
      return { data, source: 'L1-cache' };
    }

    // Try L2 cache (Redis)
    data = await this.intelligentCache.get(key, {
      tenantId,
      useL1Cache: false,
      useL2Cache: true,
    });

    if (data) {
      // Populate L1 cache for next access
      await this.intelligentCache.set(key, data, {
        tenantId,
        useL1Cache: true,
        useL2Cache: false,
        ttl: 300, // 5 minutes in L1
      });
      
      return { data, source: 'L2-cache' };
    }

    // Load from source and cache in both layers
    data = await this.loadFromSource(key);
    
    if (data) {
      // Cache in both L1 and L2
      await Promise.all([
        this.intelligentCache.set(key, data, {
          tenantId,
          useL1Cache: true,
          useL2Cache: false,
          ttl: 300, // 5 minutes in L1
        }),
        this.intelligentCache.set(key, data, {
          tenantId,
          useL1Cache: false,
          useL2Cache: true,
          ttl: 3600, // 1 hour in L2
        }),
      ]);
    }

    return { data, source: 'database' };
  }

  /**
   * Example: Batch cache operations
   */
  async batchCacheOperations(operations: Array<{ key: string; value: any }>, tenantId: string): Promise<void> {
    const cachePromises = operations.map(op => 
      this.intelligentCache.set(op.key, op.value, {
        tenantId,
        ttl: 1800, // 30 minutes
      })
    );

    await Promise.all(cachePromises);
  }

  /**
   * Example: Cache invalidation with patterns
   */
  async invalidateUserData(userId: string, tenantId: string): Promise<void> {
    const patterns = [
      `user:${userId}:*`,
      `profile:${userId}:*`,
      `preferences:${userId}:*`,
      `sessions:${userId}:*`,
    ];

    const invalidationPromises = patterns.map(pattern =>
      this.intelligentCache.invalidatePattern(pattern, { tenantId })
    );

    await Promise.all(invalidationPromises);
  }

  private async loadFromSource(key: string): Promise<any> {
    // Simulate database loading
    return {
      id: key,
      data: `Data for ${key}`,
      timestamp: new Date(),
    };
  }
}