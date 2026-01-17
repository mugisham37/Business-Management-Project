import { Resolver, Subscription, Args, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { Metric, ReportExecution, Anomaly, Forecast } from '../types/analytics.types';

/**
 * GraphQL subscription resolver for real-time analytics updates
 * Provides subscriptions for metrics, reports, anomalies, and forecasts
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class AnalyticsSubscriptionResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  /**
   * Subscribe to real-time metric updates
   */
  @Subscription(() => Metric, {
    name: 'metricsUpdated',
    filter: (payload: any, variables: any, context: any) => {
      // Filter by tenant and optional metric names
      const tenantMatch = payload.metricsUpdated.tenantId === context.req.user.tenantId;
      
      if (!variables.metricNames || variables.metricNames.length === 0) {
        return tenantMatch;
      }
      
      return tenantMatch && variables.metricNames.includes(payload.metricsUpdated.name);
    },
  })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  metricsUpdated(
    @Args('metricNames', { type: () => [String], nullable: true }) metricNames?: string[],
    @CurrentTenant() tenantId?: string,
  ) {
    return (this.pubSub as any).asyncIterator(`metrics:${tenantId}:updated`);
  }

  /**
   * Subscribe to report execution progress
   */
  @Subscription(() => ReportExecution, {
    name: 'reportExecutionProgress',
    filter: (payload: any, variables: any, context: any) => {
      const tenantMatch = payload.reportProgress.tenantId === context.req.user.tenantId;
      
      if (variables.reportId) {
        return tenantMatch && payload.reportProgress.reportId === variables.reportId;
      }
      
      return tenantMatch;
    },
  })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  reportExecutionProgress(
    @Args('reportId', { type: () => ID, nullable: true }) reportId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = reportId ? `report:${reportId}:progress` : `report:*:progress`;
    return (this.pubSub as any).asyncIterator(pattern);
  }

  /**
   * Subscribe to ETL pipeline status changes
   */
  @Subscription(() => String, {
    name: 'pipelineStatusChanged',
    filter: (payload: any, variables: any, context: any) => {
      const tenantMatch = payload.pipelineStatus.tenantId === context.req.user.tenantId;
      
      if (variables.pipelineId) {
        return tenantMatch && payload.pipelineStatus.pipelineId === variables.pipelineId;
      }
      
      return tenantMatch;
    },
  })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  pipelineStatusChanged(
    @Args('pipelineId', { type: () => ID, nullable: true }) pipelineId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = pipelineId ? `pipeline:${pipelineId}:status` : `pipeline:*:status`;
    return (this.pubSub as any).asyncIterator(pattern);
  }

  /**
   * Subscribe to anomaly detection alerts
   */
  @Subscription(() => Anomaly, {
    name: 'anomalyDetected',
    filter: (payload: any, variables: any, context: any) => {
      const tenantMatch = payload.anomaly.tenantId === context.req.user.tenantId;
      
      if (variables.metricNames && variables.metricNames.length > 0) {
        return tenantMatch && variables.metricNames.includes(payload.anomaly.metricName);
      }
      
      if (variables.severity) {
        return tenantMatch && payload.anomaly.severity === variables.severity;
      }
      
      return tenantMatch;
    },
  })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  anomalyDetected(
    @Args('metricNames', { type: () => [String], nullable: true }) metricNames?: string[],
    @Args('severity', { nullable: true }) severity?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    return (this.pubSub as any).asyncIterator(`anomalies:${tenantId}:detected`);
  }

  /**
   * Subscribe to forecast updates
   */
  @Subscription(() => Forecast, {
    name: 'forecastUpdated',
    filter: (payload: any, variables: any, context: any) => {
      const tenantMatch = payload.forecast.tenantId === context.req.user.tenantId;
      
      if (variables.metricNames && variables.metricNames.length > 0) {
        return tenantMatch && variables.metricNames.includes(payload.forecast.metricName);
      }
      
      return tenantMatch;
    },
  })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  forecastUpdated(
    @Args('metricNames', { type: () => [String], nullable: true }) metricNames?: string[],
    @CurrentTenant() tenantId?: string,
  ) {
    return (this.pubSub as any).asyncIterator(`forecasts:${tenantId}:updated`);
  }

  /**
   * Subscribe to dashboard data refresh events
   */
  @Subscription(() => String, {
    name: 'dashboardDataRefreshed',
    filter: (payload: any, variables: any, context: any) => {
      const tenantMatch = payload.dashboardRefresh.tenantId === context.req.user.tenantId;
      
      if (variables.dashboardId) {
        return tenantMatch && payload.dashboardRefresh.dashboardId === variables.dashboardId;
      }
      
      return tenantMatch;
    },
  })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  dashboardDataRefreshed(
    @Args('dashboardId', { type: () => ID, nullable: true }) dashboardId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = dashboardId ? `dashboard:${dashboardId}:refreshed` : `dashboard:*:refreshed`;
    return (this.pubSub as any).asyncIterator(pattern);
  }

  /**
   * Subscribe to KPI threshold alerts
   */
  @Subscription(() => String, {
    name: 'kpiThresholdAlert',
    filter: (payload: any, variables: any, context: any) => {
      const tenantMatch = payload.kpiAlert.tenantId === context.req.user.tenantId;
      
      if (variables.kpiNames && variables.kpiNames.length > 0) {
        return tenantMatch && variables.kpiNames.includes(payload.kpiAlert.kpiName);
      }
      
      if (variables.alertType) {
        return tenantMatch && payload.kpiAlert.alertType === variables.alertType;
      }
      
      return tenantMatch;
    },
  })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  kpiThresholdAlert(
    @Args('kpiNames', { type: () => [String], nullable: true }) kpiNames?: string[],
    @Args('alertType', { nullable: true }) alertType?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    return (this.pubSub as any).asyncIterator(`kpi:${tenantId}:alert`);
  }

  /**
   * Subscribe to data quality issues
   */
  @Subscription(() => String, {
    name: 'dataQualityIssue',
    filter: (payload: any, variables: any, context: any) => {
      const tenantMatch = payload.dataQuality.tenantId === context.req.user.tenantId;
      
      if (variables.severity) {
        return tenantMatch && payload.dataQuality.severity === variables.severity;
      }
      
      return tenantMatch;
    },
  })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  dataQualityIssue(
    @Args('severity', { nullable: true }) severity?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    return (this.pubSub as any).asyncIterator(`data-quality:${tenantId}:issue`);
  }

  /**
   * Subscribe to system performance alerts
   */
  @Subscription(() => String, {
    name: 'systemPerformanceAlert',
    filter: (payload: any, variables: any, context: any) => {
      return payload.performanceAlert.tenantId === context.req.user.tenantId;
    },
  })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:admin')
  systemPerformanceAlert(
    @Args('component', { nullable: true }) component?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    const pattern = component ? `performance:${component}:alert` : `performance:*:alert`;
    return (this.pubSub as any).asyncIterator(pattern);
  }
}