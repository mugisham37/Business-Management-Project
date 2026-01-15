import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { RedisService } from './redis.service';
import { IntelligentCacheService } from './intelligent-cache.service';
import { AdvancedCacheService } from './advanced-cache.service';
import { HorizontalScalingService } from './horizontal-scaling.service';
import { APIPerformanceService } from './api-performance.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    NestCacheModule.register({
      ttl: 300000, // 5 minutes default TTL in milliseconds
    }),
  ],
  providers: [
    RedisService,
    IntelligentCacheService,
    AdvancedCacheService,
    HorizontalScalingService,
    APIPerformanceService,
  ],
  exports: [
    RedisService,
    IntelligentCacheService,
    AdvancedCacheService,
    HorizontalScalingService,
    APIPerformanceService,
    NestCacheModule,
  ],
})
export class CacheModule {}