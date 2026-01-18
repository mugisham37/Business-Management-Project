import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PubSub } from 'graphql-subscriptions';

import { CustomLoggerService } from './logger.service';
import { LoggerResolver } from './resolvers/logger.resolver';
import { LoggerAnalyticsService } from './services/logger-analytics.service';
import { LoggerSearchService } from './services/logger-search.service';
import { LoggerStreamService } from './services/logger-stream.service';
import { LoggerExportService } from './services/logger-export.service';
import { LoggerAlertService } from './services/logger-alert.service';
import { LoggerInterceptor, GraphQLLoggingInterceptor, PerformanceLoggingInterceptor } from './interceptors/logger.interceptor';

import { CacheModule } from '../cache/cache.module';
import { GraphQLCommonModule } from '../../common/graphql/graphql-common.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    CacheModule,
    GraphQLCommonModule,
  ],
  providers: [
    // Core logger service
    CustomLoggerService,
    
    // GraphQL resolver
    LoggerResolver,
    
    // Supporting services
    LoggerAnalyticsService,
    LoggerSearchService,
    LoggerStreamService,
    LoggerExportService,
    LoggerAlertService,
    
    // Interceptors
    LoggerInterceptor,
    GraphQLLoggingInterceptor,
    PerformanceLoggingInterceptor,
    
    // PubSub for GraphQL subscriptions
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    },
  ],
  exports: [
    CustomLoggerService,
    LoggerAnalyticsService,
    LoggerSearchService,
    LoggerStreamService,
    LoggerExportService,
    LoggerAlertService,
    LoggerInterceptor,
    GraphQLLoggingInterceptor,
    PerformanceLoggingInterceptor,
  ],
})
export class LoggerModule {}