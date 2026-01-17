import { Resolver, Query, Subscription, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { AnalyticsAPIService } from '../services/analytics-api.service';
import { AnalyticsFoundationService } from '../services/analytics-foundation.service';
import { MetricsCalculationService, MetricValue as ServiceMetricValue, KPIValue as ServiceKPIValue } from '../services/metrics-calculation.service';
import { Metric, KPI, Trend } from '../types/analytics.types';
import { MetricsFilterInput, KPIFilterInput, TrendFilterInput } from '../inputs/analytics.input';

/**
 * GraphQL resolver for core analytics operations
 * Provides queries for metrics, KPIs, and trends with real-time updates
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class AnalyticsResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly analyticsAPIService: AnalyticsAPIService,
    private readonly analyticsFoundationService: AnalyticsFoundationService,
    private readonly metricsCalculationService: MetricsCalculationService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  /**
   * Get metrics with optional filtering
   */
  @Query(() => [Metric], { name: 'getMetrics' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getMetrics(
    @Args('filter', { type: () => MetricsFilterInput, nullable: true }) filter: MetricsFilterInput,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Metric[]> {
    try {
      // Get metrics from calculation service
      const metrics = await this.metricsCalculationService.calculateRealTimeMetrics(
        tenantId,
        filter?.metricNames
      );

      return metrics.map((metric: ServiceMetricValue) => ({
        id: `${metric.metricName}_${metric.timestamp.getTime()}`,
        name: metric.metricName,
        description: (metric.metadata?.description as string) || '',
        value: metric.value,
        unit: (metric.metadata?.unit as string) || 'count',
        category: (metric.metadata?.category as string) || 'OPERATIONAL',
        timestamp: metric.timestamp,
        dimensions: Object.entries(metric.dimensions).map(([name, value]) => ({
          name,
          value: String(value),
        })) || [],
      }));
    } catch (error) {
      this.handleError(error, 'Failed to fetch metrics');
      throw error;
    }
  }

  /**
   * Get KPIs (Key Performance Indicators)
   */
  @Query(() => [KPI], { name: 'getKPIs' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getKPIs(
    @Args('filter', { type: () => KPIFilterInput, nullable: true }) filter: KPIFilterInput,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<KPI[]> {
    try {
      // Get KPIs from calculation service
      const kpis = await this.metricsCalculationService.calculateKPIs(
        tenantId,
        filter?.kpiNames
      );

      return kpis.map((kpi: ServiceKPIValue) => {
        const changePercentage = kpi.trend?.percentage || 0;
        const description = kpi.dimensions?.description as string | undefined;
        
        return {
          id: `kpi_${kpi.kpiName}`,
          name: kpi.kpiName,
          description: description || '',
          currentValue: kpi.value,
          targetValue: kpi.target || 0,
          previousValue: (kpi.dimensions?.previousValue as number) || 0,
          changePercentage,
          status: kpi.trend?.direction === 'up' ? 'IMPROVING' : kpi.trend?.direction === 'down' ? 'DECLINING' : 'STABLE',
          period: filter?.period || 'MONTH',
          updatedAt: kpi.timestamp,
        };
      });
    } catch (error) {
      this.handleError(error, 'Failed to fetch KPIs');
      throw error;
    }
  }

  /**
   * Get trends for metrics over time
   */
  @Query(() => [Trend], { name: 'getTrends' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getTrends(
    @Args('filter', { type: () => TrendFilterInput, nullable: true }) filter: TrendFilterInput,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Trend[]> {
    try {
      // Build date range
      const startDate = filter?.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const endDate = filter?.endDate || new Date();

      // Get aggregated metrics over time
      const metrics = await this.metricsCalculationService.calculateRealTimeMetrics(
        tenantId,
        filter?.metricNames
      );

      // Group metrics by name and create trends
      const trendMap = new Map<string, ServiceMetricValue[]>();
      metrics.forEach((metric: ServiceMetricValue) => {
        if (!trendMap.has(metric.metricName)) {
          trendMap.set(metric.metricName, []);
        }
        trendMap.get(metric.metricName)!.push(metric);
      });

      return Array.from(trendMap.entries()).map(([metricName, dataPoints]) => {
        // Calculate slope (simple linear regression)
        const n = dataPoints.length;
        const sumX = dataPoints.reduce((sum, _, i) => sum + i, 0);
        const sumY = dataPoints.reduce((sum, dp) => sum + dp.value, 0);
        const sumXY = dataPoints.reduce((sum, dp, i) => sum + i * dp.value, 0);
        const sumX2 = dataPoints.reduce((sum, _, i) => sum + i * i, 0);
        const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;

        return {
          id: `trend_${metricName}`,
          metricName,
          dataPoints: dataPoints.map((dp: ServiceMetricValue) => ({
            timestamp: dp.timestamp,
            value: dp.value,
            label: dp.metricName,
          })),
          direction: slope > 0.1 ? 'INCREASING' : slope < -0.1 ? 'DECREASING' : 'STABLE',
          slope,
          startDate,
          endDate,
        };
      });
    } catch (error) {
      this.handleError(error, 'Failed to fetch trends');
      throw error;
    }
  }

  /**
   * Real-time subscription for metrics updates
   */
  @Subscription(() => Metric, {
    name: 'metricsUpdated',
    filter: (payload: any, _variables: any, context: any) => {
      // Filter by tenant
      return payload.metricsUpdated.tenantId === context.req.user.tenantId;
    },
  })
  metricsUpdated(@CurrentTenant() _tenantId: string) {
    // Return async iterator - note: PubSub type may need adjustment
    return (this.pubSub as any).asyncIterator('METRICS_UPDATED');
  }

  /**
   * Initialize analytics for a tenant
   */
  @Mutation(() => String, { name: 'initializeAnalytics' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:admin')
  async initializeAnalytics(
    @Args('config', { type: () => String }) config: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const configObj = JSON.parse(config);
      await this.analyticsFoundationService.initializeTenantAnalytics(tenantId, configObj);
      return 'Analytics initialized successfully';
    } catch (error) {
      this.handleError(error, 'Failed to initialize analytics');
      throw error;
    }
  }

  /**
   * Track an analytics event
   */
  @Mutation(() => String, { name: 'trackEvent' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:write')
  async trackEvent(
    @Args('eventName') eventName: string,
    @Args('eventData', { type: () => String }) eventData: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const eventDataObj = JSON.parse(eventData);
      await this.analyticsFoundationService.trackEvent({
        name: eventName,
        data: eventDataObj,
        tenantId,
        userId: user.id,
        timestamp: new Date(),
      } as any);
      return 'Event tracked successfully';
    } catch (error) {
      this.handleError(error, 'Failed to track event');
      throw error;
    }
  }

  /**
   * Get analytics health status
   */
  @Query(() => String, { name: 'getAnalyticsHealth' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getAnalyticsHealth(
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const health = await this.analyticsFoundationService.getAnalyticsHealth(tenantId);
      return JSON.stringify(health);
    } catch (error) {
      this.handleError(error, 'Failed to get analytics health');
      throw error;
    }
  }

  /**
   * Get available fields for analytics queries
   */
  @Query(() => String, { name: 'getAvailableFields' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getAvailableFields(
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const fields = await this.analyticsAPIService.getAvailableFields(tenantId);
      return JSON.stringify(fields);
    } catch (error) {
      this.handleError(error, 'Failed to get available fields');
      throw error;
    }
  }

  /**
   * Execute a custom analytics query
   */
  @Query(() => String, { name: 'executeAnalyticsQuery' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async executeAnalyticsQuery(
    @Args('queryName') queryName: string,
    @Args('parameters', { type: () => String, nullable: true }) parameters: string,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const params = parameters ? JSON.parse(parameters) : {};
      const result = await this.analyticsAPIService.executeQuery(tenantId, {
        name: queryName,
        sql: '', // Will be resolved by service
        parameters: [],
        dimensions: [],
        measures: [],
      }, params);
      return JSON.stringify(result);
    } catch (error) {
      this.handleError(error, 'Failed to execute analytics query');
      throw error;
    }
  }
}
