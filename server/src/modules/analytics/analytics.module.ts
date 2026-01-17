import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { GraphQLCommonModule } from '../../common/graphql/graphql-common.module';

// Resolvers
import { AnalyticsResolver } from './resolvers/analytics.resolver';
import { DataWarehouseResolver } from './resolvers/data-warehouse.resolver';
import { ReportingResolver } from './resolvers/reporting.resolver';
import { DashboardResolver } from './resolvers/dashboard.resolver';
import { PredictiveAnalyticsResolver } from './resolvers/predictive-analytics.resolver';
import { CustomReportingResolver } from './resolvers/custom-reporting.resolver';
import { MobileAnalyticsResolver } from './resolvers/mobile-analytics.resolver';
import { ComparativeAnalysisResolver } from './resolvers/comparative-analysis.resolver';
import { ETLResolver } from './resolvers/etl.resolver';
import { 
  MetricFieldResolver, 
  KPIFieldResolver, 
  DashboardFieldResolver, 
  ReportFieldResolver, 
  TrendFieldResolver 
} from './resolvers/field-resolvers';
import { AnalyticsSubscriptionResolver } from './resolvers/subscription.resolver';

// Services
import { AnalyticsFoundationService } from './services/analytics-foundation.service';
import { DataWarehouseService } from './services/data-warehouse.service';
import { ETLService } from './services/etl.service';
import { AnalyticsAPIService } from './services/analytics-api.service';
import { MetricsCalculationService } from './services/metrics-calculation.service';
import { AnalyticsQueryService } from './services/analytics-query.service';
import { PredictiveAnalyticsService } from './services/predictive-analytics.service';
import { CustomReportingService } from './services/custom-reporting.service';
import { MobileAnalyticsService } from './services/mobile-analytics.service';
import { ComparativeAnalysisService } from './services/comparative-analysis.service';

// Repositories
import { AnalyticsRepository } from './repositories/analytics.repository';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    QueueModule,
    RealtimeModule,
    GraphQLCommonModule,
  ],
  providers: [
    // Resolvers
    AnalyticsResolver,
    DataWarehouseResolver,
    ReportingResolver,
    DashboardResolver,
    PredictiveAnalyticsResolver,
    CustomReportingResolver,
    MobileAnalyticsResolver,
    ComparativeAnalysisResolver,
    ETLResolver,
    
    // Field Resolvers
    MetricFieldResolver,
    KPIFieldResolver,
    DashboardFieldResolver,
    ReportFieldResolver,
    TrendFieldResolver,
    
    // Subscription Resolvers
    AnalyticsSubscriptionResolver,
    
    // Core Services
    AnalyticsFoundationService,
    DataWarehouseService,
    ETLService,
    AnalyticsAPIService,
    MetricsCalculationService,
    AnalyticsQueryService,
    PredictiveAnalyticsService,
    CustomReportingService,
    MobileAnalyticsService,
    ComparativeAnalysisService,
    
    // Repositories
    AnalyticsRepository,
  ],
  exports: [
    AnalyticsFoundationService,
    DataWarehouseService,
    AnalyticsAPIService,
    MetricsCalculationService,
    AnalyticsQueryService,
    PredictiveAnalyticsService,
    CustomReportingService,
    MobileAnalyticsService,
    ComparativeAnalysisService,
  ],
})
export class AnalyticsModule {}