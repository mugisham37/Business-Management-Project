import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';

// Controllers
import { AnalyticsController } from './controllers/analytics.controller';
import { DataWarehouseController } from './controllers/data-warehouse.controller';
import { ReportingController } from './controllers/reporting.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { PredictiveAnalyticsController } from './controllers/predictive-analytics.controller';
import { CustomReportingController } from './controllers/custom-reporting.controller';
import { MobileAnalyticsController } from './controllers/mobile-analytics.controller';
import { ComparativeAnalysisController } from './controllers/comparative-analysis.controller';

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
  ],
  controllers: [
    AnalyticsController,
    DataWarehouseController,
    ReportingController,
    DashboardController,
    PredictiveAnalyticsController,
    CustomReportingController,
    MobileAnalyticsController,
    ComparativeAnalysisController,
  ],
  providers: [
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