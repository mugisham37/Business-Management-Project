import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { SimpleRedisService } from './simple-redis.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    NestCacheModule.register({
      ttl: 300000, // 5 minutes default TTL in milliseconds
    }),
  ],
  providers: [
    SimpleRedisService,
  ],
  exports: [SimpleRedisService],
})
export class CacheConfigModule {}