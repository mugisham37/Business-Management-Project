import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';

// Services
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { SimpleRedisService } from './simple-redis.service';
import { IntelligentCacheService } from './intelligent-cache.service';
import { AdvancedCacheService } from './advanced-cache.service';
import { HorizontalScalingService } from './horizontal-scaling.service';
import { APIPerformanceService } from './api-performance.service';

// GraphQL Components
import { CacheResolver } from './resolvers/cache.resolver';
import { AdvancedCacheResolver } from './resolvers/advanced-cache.resolver';
import { PerformanceResolver } from './resolvers/performance.resolver';
import { ScalingResolver } from './resolvers/scaling.resolver';


// Interceptors
import { CacheInterceptor } from './interceptors/cache.interceptor';

// Guards
import { 
  CacheAccessGuard, 
  LoadBalancingGuard, 
  DistributedCacheGuard,
  CacheRateLimitGuard,
  CacheHealthGuard,
} from './guards/cache.guard';

// Import logger module for dependencies
import { LoggerModule } from '../logger/logger.module';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    NestCacheModule.register({
      ttl: 300000, // 5 minutes default TTL in milliseconds
      max: 1000, // Maximum number of items in cache
      isGlobal: true,
    }),
  ],
  providers: [
    // Core Services
    RedisService,
    CacheService,
    SimpleRedisService,
    IntelligentCacheService,
    AdvancedCacheService,
    HorizontalScalingService,
    APIPerformanceService,
    
    // GraphQL Resolvers
    CacheResolver,
    AdvancedCacheResolver,
    PerformanceResolver,
    ScalingResolver,
    
    // Guards
    CacheAccessGuard,
    LoadBalancingGuard,
    DistributedCacheGuard,
    CacheRateLimitGuard,
    CacheHealthGuard,
    
    // Global Interceptor for automatic caching
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
    
    // Global Guard for cache health
    {
      provide: APP_GUARD,
      useClass: CacheHealthGuard,
    },
  ],
  exports: [
    // Core Services
    RedisService,
    CacheService,
    SimpleRedisService,
    IntelligentCacheService,
    AdvancedCacheService,
    HorizontalScalingService,
    APIPerformanceService,
    
    // NestJS Cache Module
    NestCacheModule,
    
    // Guards for use in other modules
    CacheAccessGuard,
    LoadBalancingGuard,
    DistributedCacheGuard,
    CacheRateLimitGuard,
    CacheHealthGuard,
  ],
})
export class CacheModule {}