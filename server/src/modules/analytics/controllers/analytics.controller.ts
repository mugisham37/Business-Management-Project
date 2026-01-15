import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '../../../common/interceptors/cache.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

import { AnalyticsFoundationService, AnalyticsConfiguration, AnalyticsEvent } from '../services/analytics-foundation.service';
import { DataWarehouseService } from '../services/data-warehouse.service';
import { AnalyticsAPIService } from '../services/analytics-api.service';
import { MetricsCalculationService } from '../services/metrics-calculation.service';

export class CreateAnalyticsConfigDto {
  dataRetentionDays!: number;
  aggregationIntervals!: ('hourly' | 'daily' | 'weekly' | 'monthly')[];
  enabledMetrics!: string[];
  customDimensions!: Record<string, any>;
  alertThresholds!: Record<string, number>;
  reportingSchedule!: {
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
    quarterly: boolean;
  };
}

export class UpdateAnalyticsConfigDto {
  dataRetentionDays?: number;
  aggregationIntervals?: ('hourly' | 'daily' | 'weekly' | 'monthly')[];
  enabledMetrics?: string[];
  customDimensions?: Record<string, any>;
  alertThresholds?: Record<string, number>;
  reportingSchedule?: {
    daily?: boolean;
    weekly?: boolean;
    monthly?: boolean;
    quarterly?: boolean;
  };
}

export class TrackEventDto {
  eventType!: string;
  entityType!: string;
  entityId!: string;
  data!: Record<string, any>;
  metadata!: {
    userId?: string;
    locationId?: string;
    sessionId?: string;
    source: string;
  };
}

export class AnalyticsQueryDto {
  query!: string;
  parameters?: any[];
  useCache?: boolean;
  cacheTTL?: number;
  timeout?: number;
}

@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('advanced-analytics')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsFoundationService: AnalyticsFoundationService,
    private readonly dataWarehouseService: DataWarehouseService,
    private readonly analyticsAPIService: AnalyticsAPIService,
    private readonly metricsService: MetricsCalculationService,
  ) {}

  @Post('initialize')
  @RequirePermission('analytics:admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize analytics for tenant' })
  @ApiResponse({ status: 201, description: 'Analytics initialized successfully' })
  async initializeAnalytics(
    @Body(ValidationPipe) config: CreateAnalyticsConfigDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string; configuration: AnalyticsConfiguration }> {
    const fullConfig: AnalyticsConfiguration = {
      tenantId,
      ...config,
    };

    await this.analyticsFoundationService.initializeTenantAnalytics(tenantId, fullConfig);

    return {
      message: 'Analytics initialized successfully',
      configuration: fullConfig,
    };
  }

  @Get('configuration')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get analytics configuration' })
  @ApiResponse({ status: 200, description: 'Analytics configuration retrieved' })
  async getConfiguration(
    @CurrentTenant() tenantId: string,
  ): Promise<AnalyticsConfiguration | null> {
    return this.analyticsFoundationService.getAnalyticsConfiguration(tenantId);
  }

  @Put('configuration')
  @RequirePermission('analytics:admin')
  @ApiOperation({ summary: 'Update analytics configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  async updateConfiguration(
    @Body(ValidationPipe) updates: UpdateAnalyticsConfigDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<AnalyticsConfiguration> {
    const cleanUpdates: Partial<AnalyticsConfiguration> = {};
    if (updates.dataRetentionDays !== undefined) cleanUpdates.dataRetentionDays = updates.dataRetentionDays;
    if (updates.aggregationIntervals !== undefined) cleanUpdates.aggregationIntervals = updates.aggregationIntervals;
    if (updates.enabledMetrics !== undefined) cleanUpdates.enabledMetrics = updates.enabledMetrics;
    if (updates.customDimensions !== undefined) cleanUpdates.customDimensions = updates.customDimensions;
    if (updates.alertThresholds !== undefined) cleanUpdates.alertThresholds = updates.alertThresholds;
    if (updates.reportingSchedule !== undefined) cleanUpdates.reportingSchedule = updates.reportingSchedule as any;
    
    return this.analyticsFoundationService.updateAnalyticsConfiguration(tenantId, cleanUpdates);
  }

  @Post('events')
  @RequirePermission('analytics:write')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Track analytics event' })
  @ApiResponse({ status: 202, description: 'Event tracked successfully' })
  async trackEvent(
    @Body(ValidationPipe) eventData: TrackEventDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string; eventId: string }> {
    const event = {
      tenantId,
      ...eventData,
    };

    await this.analyticsFoundationService.trackEvent(event);

    return {
      message: 'Event tracked successfully',
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  @Get('health')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get analytics system health' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  async getHealth(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message: string;
      timestamp: Date;
    }>;
    lastETLRun: Date | null;
    dataFreshness: number;
    errorRate: number;
  }> {
    return this.analyticsFoundationService.getAnalyticsHealth(tenantId);
  }

  @Get('metrics/definitions')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get available metric definitions' })
  @ApiResponse({ status: 200, description: 'Metric definitions retrieved' })
  async getMetricDefinitions(
    @CurrentTenant() tenantId: string,
  ) {
    return this.analyticsFoundationService.getMetricDefinitions(tenantId);
  }

  @Post('metrics/custom')
  @RequirePermission('analytics:admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create custom metric definition' })
  @ApiResponse({ status: 201, description: 'Custom metric created' })
  async createCustomMetric(
    @Body(ValidationPipe) metric: any, // Would need proper DTO
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.analyticsFoundationService.createCustomMetric(tenantId, metric);

    return {
      message: 'Custom metric created successfully',
    };
  }

  @Post('query')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute analytics query' })
  @ApiResponse({ status: 200, description: 'Query executed successfully' })
  async executeQuery(
    @Body(ValidationPipe) queryData: AnalyticsQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    data: any[];
    metadata: {
      executionTime: number;
      rowCount: number;
      fromCache: boolean;
      queryId: string;
    };
  }> {
    const options: { useCache?: boolean; cacheTTL?: number; timeout?: number } = {};
    if (queryData.useCache !== undefined) options.useCache = queryData.useCache;
    if (queryData.cacheTTL !== undefined) options.cacheTTL = queryData.cacheTTL;
    if (queryData.timeout !== undefined) options.timeout = queryData.timeout;
    
    return this.dataWarehouseService.executeAnalyticsQuery(
      tenantId,
      queryData.query,
      queryData.parameters || [],
      options
    );
  }

  @Get('warehouse/statistics')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get data warehouse statistics' })
  @ApiResponse({ status: 200, description: 'Warehouse statistics retrieved' })
  async getWarehouseStatistics(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    schemaSize: number;
    tableCount: number;
    totalRows: number;
    lastUpdated: Date;
    queryPerformance: {
      averageExecutionTime: number;
      cacheHitRate: number;
      queriesPerHour: number;
    };
  }> {
    return this.dataWarehouseService.getWarehouseStatistics(tenantId);
  }

  @Post('warehouse/optimize')
  @RequirePermission('analytics:admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Optimize data warehouse performance' })
  @ApiResponse({ status: 200, description: 'Warehouse optimization completed' })
  async optimizeWarehouse(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    optimizationsApplied: string[];
    performanceImprovement: number;
  }> {
    return this.dataWarehouseService.optimizeWarehouse(tenantId);
  }

  @Get('metrics/realtime')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get real-time metrics' })
  @ApiResponse({ status: 200, description: 'Real-time metrics retrieved' })
  async getRealTimeMetrics(
    @CurrentTenant() tenantId: string,
    @Query('metrics') metrics?: string, // Comma-separated list
  ): Promise<Record<string, any>> {
    const metricNames = metrics ? metrics.split(',') : undefined;
    return this.metricsService.getRealTimeMetrics(tenantId, metricNames);
  }

  @Get('metrics/historical')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get historical metrics' })
  @ApiResponse({ status: 200, description: 'Historical metrics retrieved' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'interval', required: false, enum: ['hourly', 'daily', 'weekly', 'monthly'] })
  @ApiQuery({ name: 'metrics', required: false, type: String })
  async getHistoricalMetrics(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('interval') interval: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('metrics') metrics?: string,
  ): Promise<{
    data: Array<{
      timestamp: Date;
      metrics: Record<string, number>;
    }>;
    interval: string;
    totalDataPoints: number;
  }> {
    const metricNames = metrics ? metrics.split(',') : undefined;
    
    return this.metricsService.getHistoricalMetrics(
      tenantId,
      new Date(startDate),
      new Date(endDate),
      interval,
      metricNames
    );
  }

  @Get('dashboard/:dashboardId')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved' })
  @ApiParam({ name: 'dashboardId', type: 'string' })
  async getDashboardData(
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @CurrentTenant() tenantId: string,
    @Query('refresh') refresh?: boolean,
  ): Promise<{
    dashboard: any;
    widgets: Array<{
      id: string;
      type: string;
      data: any;
      lastUpdated: Date;
    }>;
  }> {
    const result = await this.analyticsAPIService.getDashboardData(tenantId, dashboardId, refresh);
    // Ensure widgets array is returned if not provided
    return {
      dashboard: (result as any).dashboard,
      widgets: (result as any).widgets || (result as any).widgetData ? Object.entries((result as any).widgetData || {}).map(([id, data]: [string, any]) => ({
        id,
        type: 'widget',
        data,
        lastUpdated: new Date(),
      })) : [],
    };
  }

  @Post('export')
  @RequirePermission('analytics:export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export analytics data' })
  @ApiResponse({ status: 200, description: 'Data export initiated' })
  async exportData(
    @Body() exportRequest: {
      format: 'csv' | 'excel' | 'pdf' | 'json';
      query?: string;
      dateRange?: {
        startDate: string;
        endDate: string;
      };
      metrics?: string[];
      filters?: Record<string, any>;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    exportId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    estimatedCompletionTime: Date;
    downloadUrl?: string;
  }> {
    return this.analyticsAPIService.exportData(tenantId, exportRequest, user.id);
  }
}