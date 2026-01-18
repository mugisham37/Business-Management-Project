import { Injectable, Module } from '@nestjs/common';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';

// Import cache module components
import {
  CacheModule,
  IntelligentCacheService,
  AdvancedCacheService,
  APIPerformanceService,
  HorizontalScalingService,
  CacheInterceptor,
  CacheAccessGuard,
  Cache,
  CacheInvalidate,
  FullCache,
  CacheContext,
  CacheStrategy,
  CachePriority,
} from '../index';

// Import other modules that use caching
import { CustomLoggerService } from '../../logger/logger.service';
import { DrizzleService } from '../../database/drizzle.service';

/**
 * Example: Customer service with comprehensive caching
 * Shows integration with database, logging, and cache modules
 */
@Injectable()
export class CustomerCacheService {
  constructor(
    private readonly intelligentCache: IntelligentCacheService,
    private readonly advancedCache: AdvancedCacheService,
    private readonly logger: CustomLoggerService,
    private readonly database: DrizzleService,
  ) {
    this.logger.setContext('CustomerCacheService');
  }

  /**
   * Get customer with multi-level caching
   */
  async getCustomer(customerId: string, tenantId: string): Promise<any> {
    const cacheKey = `customer:${customerId}`;
    
    try {
      // Try advanced cache with fallback
      const customer = await this.advancedCache.get(cacheKey, {
        tenantId,
        useDistributed: true,
        warmOnMiss: true,
        fallbackLoader: async () => {
          this.logger.debug('Loading customer from database', { customerId, tenantId });
          
          // Simulate database query
          const dbCustomer = {
            id: customerId,
            name: 'John Doe',
            email: 'john@example.com',
            tenantId,
            createdAt: new Date(),
            preferences: {
              notifications: true,
              theme: 'dark',
            },
          };
          
          this.logger.info('Customer loaded from database', { customerId, tenantId });
          return dbCustomer;
        },
      });

      this.logger.debug('Customer retrieved', { 
        customerId, 
        tenantId, 
        fromCache: !!customer 
      });

      return customer;
    } catch (error) {
      this.logger.error('Failed to get customer', error instanceof Error ? error.stack : undefined, {
        customerId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Update customer with cache invalidation
   */
  async updateCustomer(customerId: string, updateData: any, tenantId: string): Promise<any> {
    try {
      // Update in database (simulated)
      const updatedCustomer = {
        id: customerId,
        ...updateData,
        tenantId,
        updatedAt: new Date(),
      };

      // Invalidate related cache entries
      await Promise.all([
        this.intelligentCache.del(`customer:${customerId}`, { tenantId }),
        this.intelligentCache.invalidatePattern(`customer:${customerId}:*`, { tenantId }),
        this.intelligentCache.invalidatePattern(`orders:customer:${customerId}:*`, { tenantId }),
      ]);

      this.logger.info('Customer updated and cache invalidated', {
        customerId,
        tenantId,
        updatedFields: Object.keys(updateData),
      });

      return updatedCustomer;
    } catch (error) {
      this.logger.error('Failed to update customer', error instanceof Error ? error.stack : undefined, {
        customerId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get customer orders with caching
   */
  async getCustomerOrders(customerId: string, tenantId: string, limit: number = 10): Promise<any[]> {
    const cacheKey = `orders:customer:${customerId}:limit:${limit}`;
    
    try {
      let orders = await this.intelligentCache.get<any[]>(cacheKey, { tenantId });
      
      if (!orders) {
        this.logger.debug('Loading customer orders from database', { customerId, tenantId, limit });
        
        // Simulate database query
        orders = Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
          id: `order-${i + 1}`,
          customerId,
          amount: (Math.random() * 1000).toFixed(2),
          status: ['pending', 'completed', 'shipped'][Math.floor(Math.random() * 3)],
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        }));

        // Cache for 15 minutes
        await this.intelligentCache.set(cacheKey, orders, { tenantId, ttl: 900 });
        
        this.logger.info('Customer orders loaded and cached', { 
          customerId, 
          tenantId, 
          orderCount: orders.length 
        });
      }

      return orders;
    } catch (error) {
      this.logger.error('Failed to get customer orders', error instanceof Error ? error.stack : undefined, {
        customerId,
        tenantId,
      });
      throw error;
    }
  }
}

/**
 * Example: Analytics service with performance monitoring
 */
@Injectable()
export class AnalyticsCacheService {
  constructor(
    private readonly advancedCache: AdvancedCacheService,
    private readonly performanceService: APIPerformanceService,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext('AnalyticsCacheService');
  }

  /**
   * Get analytics data with cache warming
   */
  async getAnalyticsData(tenantId: string, dateRange: string): Promise<any> {
    const cacheKey = `analytics:${dateRange}`;
    
    try {
      // Configure cache warming for analytics
      this.advancedCache.configureCacheWarming({
        key: cacheKey,
        dataLoader: async () => {
          this.logger.debug('Generating analytics data', { tenantId, dateRange });
          
          return {
            totalRevenue: Math.random() * 100000,
            totalOrders: Math.floor(Math.random() * 1000),
            averageOrderValue: Math.random() * 200,
            topProducts: [
              { name: 'Product A', sales: Math.floor(Math.random() * 100) },
              { name: 'Product B', sales: Math.floor(Math.random() * 100) },
            ],
            generatedAt: new Date(),
          };
        },
        ttl: 3600, // 1 hour
        priority: 'high',
        schedule: '0 */6 * * *', // Every 6 hours
      });

      const analytics = await this.advancedCache.get(cacheKey, {
        tenantId,
        useDistributed: true,
        warmOnMiss: true,
      });

      this.logger.info('Analytics data retrieved', { tenantId, dateRange });
      return analytics;
    } catch (error) {
      this.logger.error('Failed to get analytics data', error instanceof Error ? error.stack : undefined, {
        tenantId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Optimize analytics performance
   */
  async optimizeAnalyticsPerformance(): Promise<any> {
    try {
      const result = await this.performanceService.optimizeSettings();
      
      this.logger.info('Analytics performance optimized', {
        compressionOptimized: result.compressionOptimized,
        cacheOptimized: result.cacheOptimized,
        endpointsOptimized: result.endpointsOptimized,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to optimize analytics performance', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}

/**
 * Example: GraphQL resolver with comprehensive caching integration
 */
@Resolver()
@UseGuards(CacheAccessGuard)
@UseInterceptors(CacheInterceptor)
export class IntegratedCacheResolver {
  constructor(
    private readonly customerService: CustomerCacheService,
    private readonly analyticsService: AnalyticsCacheService,
    private readonly scalingService: HorizontalScalingService,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext('IntegratedCacheResolver');
  }

  /**
   * Get customer with intelligent caching
   */
  @Query(() => String)
  @FullCache({
    key: 'customer:profile:{customerId}',
    ttl: 1800, // 30 minutes
    strategy: CacheStrategy.INTELLIGENT,
    priority: CachePriority.HIGH,
    useDistributed: true,
    warmOnMiss: true,
    compression: true,
    monitoring: true,
    loadBalance: true,
  })
  async getCustomerProfile(
    @Args('customerId') customerId: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<string> {
    try {
      const customer = await this.customerService.getCustomer(customerId, cacheCtx?.tenantId);
      
      this.logger.info('Customer profile retrieved via GraphQL', {
        customerId,
        tenantId: cacheCtx?.tenantId,
      });

      return JSON.stringify(customer);
    } catch (error) {
      this.logger.error('GraphQL customer profile query failed', error instanceof Error ? error.stack : undefined, {
        customerId,
        tenantId: cacheCtx?.tenantId,
      });
      throw error;
    }
  }

  /**
   * Update customer with cache invalidation
   */
  @Mutation(() => String)
  @CacheInvalidate({
    patterns: [
      'customer:{customerId}:*',
      'orders:customer:{customerId}:*',
      'analytics:*',
    ],
    tags: ['customer-data', 'order-data'],
  })
  async updateCustomerProfile(
    @Args('customerId') customerId: string,
    @Args('updateData') updateData: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<string> {
    try {
      const parsedData = JSON.parse(updateData);
      const updatedCustomer = await this.customerService.updateCustomer(
        customerId,
        parsedData,
        cacheCtx?.tenantId
      );

      this.logger.info('Customer profile updated via GraphQL', {
        customerId,
        tenantId: cacheCtx?.tenantId,
        updatedFields: Object.keys(parsedData),
      });

      return JSON.stringify({ success: true, customer: updatedCustomer });
    } catch (error) {
      this.logger.error('GraphQL customer profile update failed', error instanceof Error ? error.stack : undefined, {
        customerId,
        tenantId: cacheCtx?.tenantId,
      });
      throw error;
    }
  }

  /**
   * Get customer orders with caching
   */
  @Query(() => String)
  @Cache({
    key: 'orders:customer:{customerId}:limit:{limit}',
    ttl: 900, // 15 minutes
    strategy: CacheStrategy.MULTI_LEVEL,
    priority: CachePriority.MEDIUM,
  })
  async getCustomerOrders(
    @Args('customerId') customerId: string,
    @Args('limit', { nullable: true }) limit?: number,
    @CacheContext() cacheCtx?: any,
  ): Promise<string> {
    try {
      const orders = await this.customerService.getCustomerOrders(
        customerId,
        cacheCtx?.tenantId,
        limit || 10
      );

      this.logger.info('Customer orders retrieved via GraphQL', {
        customerId,
        tenantId: cacheCtx?.tenantId,
        orderCount: orders.length,
      });

      return JSON.stringify(orders);
    } catch (error) {
      this.logger.error('GraphQL customer orders query failed', error instanceof Error ? error.stack : undefined, {
        customerId,
        tenantId: cacheCtx?.tenantId,
      });
      throw error;
    }
  }

  /**
   * Get analytics with cache warming
   */
  @Query(() => String)
  @Cache({
    key: 'analytics:dashboard:{dateRange}',
    ttl: 3600, // 1 hour
    strategy: CacheStrategy.DISTRIBUTED,
    priority: CachePriority.HIGH,
  })
  async getAnalyticsDashboard(
    @Args('dateRange', { nullable: true }) dateRange?: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<string> {
    try {
      const analytics = await this.analyticsService.getAnalyticsData(
        cacheCtx?.tenantId,
        dateRange || '7d'
      );

      this.logger.info('Analytics dashboard retrieved via GraphQL', {
        tenantId: cacheCtx?.tenantId,
        dateRange: dateRange || '7d',
      });

      return JSON.stringify(analytics);
    } catch (error) {
      this.logger.error('GraphQL analytics dashboard query failed', error instanceof Error ? error.stack : undefined, {
        tenantId: cacheCtx?.tenantId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Create session with distributed management
   */
  @Mutation(() => String)
  async createUserSession(
    @Args('userId') userId: string,
    @Args('sessionData') sessionData: string,
    @CacheContext() cacheCtx?: any,
  ): Promise<string> {
    try {
      const sessionId = `session:${userId}:${Date.now()}`;
      const parsedData = JSON.parse(sessionData);

      await this.scalingService.createSession(sessionId, {
        userId,
        tenantId: cacheCtx?.tenantId,
        ...parsedData,
        createdAt: new Date(),
      });

      this.logger.info('User session created via GraphQL', {
        userId,
        sessionId,
        tenantId: cacheCtx?.tenantId,
      });

      return JSON.stringify({ success: true, sessionId });
    } catch (error) {
      this.logger.error('GraphQL session creation failed', error instanceof Error ? error.stack : undefined, {
        userId,
        tenantId: cacheCtx?.tenantId,
      });
      throw error;
    }
  }
}

/**
 * Example module showing complete integration
 */
@Module({
  imports: [
    CacheModule, // Import the cache module
  ],
  providers: [
    CustomerCacheService,
    AnalyticsCacheService,
    IntegratedCacheResolver,
  ],
  exports: [
    CustomerCacheService,
    AnalyticsCacheService,
  ],
})
export class IntegratedCacheExampleModule {}

/**
 * Example: Background service using cache for optimization
 */
@Injectable()
export class BackgroundCacheOptimizationService {
  constructor(
    private readonly advancedCache: AdvancedCacheService,
    private readonly performanceService: APIPerformanceService,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext('BackgroundCacheOptimizationService');
    
    // Start background optimization
    this.startBackgroundOptimization();
  }

  private startBackgroundOptimization(): void {
    // Optimize cache performance every 15 minutes
    setInterval(async () => {
      try {
        await this.optimizeCachePerformance();
      } catch (error) {
        this.logger.error('Background cache optimization failed', error instanceof Error ? error.stack : undefined);
      }
    }, 15 * 60 * 1000);

    // Optimize API performance every 30 minutes
    setInterval(async () => {
      try {
        await this.optimizeAPIPerformance();
      } catch (error) {
        this.logger.error('Background API optimization failed', error instanceof Error ? error.stack : undefined);
      }
    }, 30 * 60 * 1000);
  }

  private async optimizeCachePerformance(): Promise<void> {
    const result = await this.advancedCache.optimizeCachePerformance();
    
    this.logger.info('Background cache optimization completed', {
      evictedKeys: result.evictedKeys,
      warmedKeys: result.warmedKeys,
      optimizedHotKeys: result.optimizedHotKeys,
    });
  }

  private async optimizeAPIPerformance(): Promise<void> {
    const result = await this.performanceService.optimizeSettings();
    
    this.logger.info('Background API optimization completed', {
      compressionOptimized: result.compressionOptimized,
      cacheOptimized: result.cacheOptimized,
      endpointsOptimized: result.endpointsOptimized,
    });
  }
}