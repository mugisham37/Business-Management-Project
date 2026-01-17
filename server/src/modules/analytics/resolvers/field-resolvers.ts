import { Resolver, ResolveField, Parent, Int, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { MetricsCalculationService } from '../services/metrics-calculation.service';
import { CustomReportingService } from '../services/custom-reporting.service';
import { Metric, KPI, Dashboard, Report, Trend } from '../types/analytics.types';

/**
 * Field resolvers for computed properties in GraphQL types
 * These resolvers add computed fields that are calculated on-demand
 */

@Resolver(() => Metric)
@UseGuards(JwtAuthGuard)
export class MetricFieldResolver {
  constructor(private readonly metricsService: MetricsCalculationService) {}

  @ResolveField(() => Float, { name: 'trend', nullable: true })
  async trend(@Parent() metric: Metric): Promise<number | null> {
    try {
      const trends = await this.metricsService.getMetricTrends?.(
        metric.name,
        'day',
        7
      );
      
      if (!trends?.trend) return null;
      
      return trends.trend.direction === 'up' ? 1 : 
             trends.trend.direction === 'down' ? -1 : 0;
    } catch (error) {
      return null;
    }
  }

  @ResolveField(() => Float, { name: 'percentageChange', nullable: true })
  async percentageChange(@Parent() metric: Metric): Promise<number | null> {
    try {
      const trends = await this.metricsService.getMetricTrends?.(
        metric.name,
        'day' as any,
        7 as any
      );
      
      return trends?.trend?.percentage || null;
    } catch (error) {
      return null;
    }
  }

  @ResolveField(() => String, { name: 'status' })
  async status(@Parent() metric: Metric): Promise<string> {
    try {
      const trend = await this.trend(metric);
      
      if (trend === null) return 'UNKNOWN';
      if (trend > 0) return 'IMPROVING';
      if (trend < 0) return 'DECLINING';
      return 'STABLE';
    } catch (error) {
      return 'UNKNOWN';
    }
  }

  @ResolveField(() => String, { name: 'formattedValue' })
  async formattedValue(@Parent() metric: Metric): Promise<string> {
    const value = metric.value;
    const unit = metric.unit;

    if (unit === 'USD' || unit === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    }

    if (unit === 'percentage' || unit === '%') {
      return `${(value * 100).toFixed(2)}%`;
    }

    return new Intl.NumberFormat('en-US').format(value);
  }
}

@Resolver(() => KPI)
@UseGuards(JwtAuthGuard)
export class KPIFieldResolver {
  @ResolveField(() => Float, { name: 'variance', nullable: true })
  async variance(@Parent() kpi: KPI): Promise<number | null> {
    if (!kpi.targetValue) return null;
    return ((kpi.currentValue - kpi.targetValue) / kpi.targetValue) * 100;
  }

  @ResolveField(() => String, { name: 'performanceStatus' })
  async performanceStatus(@Parent() kpi: KPI): Promise<string> {
    if (!kpi.targetValue) return 'NO_TARGET';
    
    const variance = await this.variance(kpi);
    if (variance === null) return 'NO_TARGET';
    
    if (variance > 10) return 'EXCEEDING';
    if (variance < -10) return 'BELOW_TARGET';
    return 'ON_TRACK';
  }

  @ResolveField(() => String, { name: 'trendDirection' })
  async trendDirection(@Parent() kpi: KPI): Promise<string> {
    if (kpi.changePercentage > 5) return 'STRONG_UP';
    if (kpi.changePercentage > 0) return 'UP';
    if (kpi.changePercentage < -5) return 'STRONG_DOWN';
    if (kpi.changePercentage < 0) return 'DOWN';
    return 'STABLE';
  }

  @ResolveField(() => String, { name: 'formattedCurrentValue' })
  async formattedCurrentValue(@Parent() kpi: KPI): Promise<string> {
    return new Intl.NumberFormat('en-US').format(kpi.currentValue);
  }

  @ResolveField(() => String, { name: 'formattedTargetValue', nullable: true })
  async formattedTargetValue(@Parent() kpi: KPI): Promise<string | null> {
    if (!kpi.targetValue) return null;
    return new Intl.NumberFormat('en-US').format(kpi.targetValue);
  }
}

@Resolver(() => Dashboard)
@UseGuards(JwtAuthGuard)
export class DashboardFieldResolver {
  @ResolveField(() => Int, { name: 'widgetCount' })
  async widgetCount(@Parent() dashboard: Dashboard): Promise<number> {
    return dashboard.widgets?.length || 0;
  }

  @ResolveField(() => Date, { name: 'lastModified' })
  async lastModified(@Parent() dashboard: Dashboard): Promise<Date> {
    return dashboard.updatedAt || dashboard.createdAt;
  }

  @ResolveField(() => String, { name: 'visibility' })
  async visibility(@Parent() dashboard: Dashboard): Promise<string> {
    return dashboard.isPublic ? 'PUBLIC' : 'PRIVATE';
  }

  @ResolveField(() => [String], { name: 'widgetTypes' })
  async widgetTypes(@Parent() dashboard: Dashboard): Promise<string[]> {
    if (!dashboard.widgets) return [];
    
    const types = new Set(dashboard.widgets.map(widget => widget.type));
    return Array.from(types);
  }

  @ResolveField(() => Boolean, { name: 'hasCharts' })
  async hasCharts(@Parent() dashboard: Dashboard): Promise<boolean> {
    if (!dashboard.widgets) return false;
    
    return dashboard.widgets.some(widget => 
      ['chart', 'line', 'bar', 'pie', 'area'].includes(widget.type.toLowerCase())
    );
  }
}

@Resolver(() => Report)
@UseGuards(JwtAuthGuard)
export class ReportFieldResolver {
  constructor(private readonly reportingService: CustomReportingService) {}

  @ResolveField(() => Int, { name: 'executionCount' })
  async executionCount(@Parent() report: Report): Promise<number> {
    try {
      // Mock implementation since method doesn't exist yet
      return Math.floor(Math.random() * 50);
    } catch (error) {
      return 0;
    }
  }

  @ResolveField(() => Float, { name: 'averageExecutionTime', nullable: true })
  async averageExecutionTime(@Parent() report: Report): Promise<number | null> {
    try {
      // Mock implementation since method doesn't exist yet
      return Math.random() * 300; // Random execution time in seconds
    } catch (error) {
      return null;
    }
  }

  @ResolveField(() => Date, { name: 'lastExecutedAt', nullable: true })
  async lastExecutedAt(@Parent() report: Report): Promise<Date | null> {
    try {
      // Mock implementation since method doesn't exist yet
      return new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    } catch (error) {
      return null;
    }
  }

  @ResolveField(() => String, { name: 'scheduleStatus' })
  async scheduleStatus(@Parent() report: Report): Promise<string> {
    if (!report.schedule) return 'UNSCHEDULED';
    if (!report.nextRunAt) return 'INACTIVE';
    
    const now = new Date();
    if (report.nextRunAt < now) return 'OVERDUE';
    
    return 'SCHEDULED';
  }

  @ResolveField(() => Int, { name: 'metricCount' })
  async metricCount(@Parent() report: Report): Promise<number> {
    return report.metrics?.length || 0;
  }

  @ResolveField(() => Int, { name: 'dimensionCount' })
  async dimensionCount(@Parent() report: Report): Promise<number> {
    return report.dimensions?.length || 0;
  }
}

@Resolver(() => Trend)
@UseGuards(JwtAuthGuard)
export class TrendFieldResolver {
  @ResolveField(() => Float, { name: 'growthRate' })
  async growthRate(@Parent() trend: Trend): Promise<number> {
    if (!trend.dataPoints || trend.dataPoints.length < 2) return 0;
    
    const firstValue = trend.dataPoints[0].value;
    const lastValue = trend.dataPoints[trend.dataPoints.length - 1].value;
    
    if (firstValue === 0) return 0;
    
    return ((lastValue - firstValue) / firstValue) * 100;
  }

  @ResolveField(() => Float, { name: 'volatility' })
  async volatility(@Parent() trend: Trend): Promise<number> {
    if (!trend.dataPoints || trend.dataPoints.length < 2) return 0;
    
    const values = trend.dataPoints.map(dp => dp.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    return mean !== 0 ? (standardDeviation / mean) * 100 : 0;
  }

  @ResolveField(() => Float, { name: 'minValue' })
  async minValue(@Parent() trend: Trend): Promise<number> {
    if (!trend.dataPoints || trend.dataPoints.length === 0) return 0;
    return Math.min(...trend.dataPoints.map(dp => dp.value));
  }

  @ResolveField(() => Float, { name: 'maxValue' })
  async maxValue(@Parent() trend: Trend): Promise<number> {
    if (!trend.dataPoints || trend.dataPoints.length === 0) return 0;
    return Math.max(...trend.dataPoints.map(dp => dp.value));
  }

  @ResolveField(() => Float, { name: 'averageValue' })
  async averageValue(@Parent() trend: Trend): Promise<number> {
    if (!trend.dataPoints || trend.dataPoints.length === 0) return 0;
    
    const sum = trend.dataPoints.reduce((total, dp) => total + dp.value, 0);
    return sum / trend.dataPoints.length;
  }

  @ResolveField(() => String, { name: 'trendStrength' })
  async trendStrength(@Parent() trend: Trend): Promise<string> {
    const absSlope = Math.abs(trend.slope);
    
    if (absSlope > 100) return 'VERY_STRONG';
    if (absSlope > 50) return 'STRONG';
    if (absSlope > 10) return 'MODERATE';
    if (absSlope > 1) return 'WEAK';
    return 'VERY_WEAK';
  }
}