import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { CustomLoggerService, LogCategory, LogMetrics, LogAnalytics } from '../logger.service';
import { TimeRangeInput, LogRetentionPolicyInput } from '../inputs/logger.input';
import { LogMetricsType, LogAnalyticsType } from '../types/logger.types';

@Injectable()
export class LoggerAnalyticsService {
  constructor(
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly loggerService: CustomLoggerService,
  ) {
    this.loggerService.setContext('LoggerAnalyticsService');
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }
    return undefined;
  }

  async getMetrics(
    tenantId: string,
    timeRange?: TimeRangeInput,
    categories?: LogCategory[],
  ): Promise<LogMetricsType> {
    const cacheKey = `log_metrics:${tenantId}:${JSON.stringify({ timeRange, categories })}`;
    
    try {
      // Try to get from cache first
      const cached = await this.cacheService.get<LogMetricsType>(cacheKey);
      if (cached) {
        this.loggerService.cache('get', cacheKey, true, { tenantId });
        return cached;
      }

      this.loggerService.cache('get', cacheKey, false, { tenantId });

      // Calculate metrics from data source
      const metrics = await this.calculateMetrics(tenantId, timeRange, categories);

      // Cache the result for 5 minutes
      await this.cacheService.set(cacheKey, metrics, { ttl: 300, tenantId });

      this.loggerService.performance(
        'calculate_log_metrics',
        Date.now(),
        { tenantId, categories: categories?.length || 0 },
      );

      return metrics;
    } catch (error) {
      this.loggerService.error(
        `Failed to get log metrics for tenant ${tenantId}`,
        this.getErrorStack(error),
        { tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async getAnalytics(
    tenantId: string,
    timeRange?: TimeRangeInput,
    topN: number = 10,
    categories?: LogCategory[],
  ): Promise<LogAnalyticsType> {
    const cacheKey = `log_analytics:${tenantId}:${JSON.stringify({ timeRange, topN, categories })}`;
    
    try {
      // Try to get from cache first
      const cached = await this.cacheService.get<LogAnalyticsType>(cacheKey);
      if (cached) {
        this.loggerService.cache('get', cacheKey, true, { tenantId });
        return cached;
      }

      this.loggerService.cache('get', cacheKey, false, { tenantId });

      // Calculate analytics from data source
      const analytics = await this.calculateAnalytics(tenantId, timeRange, topN, categories);

      // Cache the result for 10 minutes
      await this.cacheService.set(cacheKey, analytics, { ttl: 600, tenantId });

      this.loggerService.performance(
        'calculate_log_analytics',
        Date.now(),
        { tenantId, topN, categories: categories?.length || 0 },
      );

      return analytics;
    } catch (error) {
      this.loggerService.error(
        `Failed to get log analytics for tenant ${tenantId}`,
        this.getErrorStack(error),
        { tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async setRetentionPolicy(
    policy: LogRetentionPolicyInput,
    tenantId: string,
  ): Promise<void> {
    try {
      // In a real implementation, this would update database configuration
      // For now, we'll emit an event and log the policy change
      
      this.eventEmitter.emit('log.retention.policy.updated', {
        tenantId,
        policy,
        timestamp: new Date(),
      });

      this.loggerService.audit(
        'log_retention_policy_set',
        {
          retentionDays: policy.retentionDays,
          categories: policy.categories,
          levels: policy.levels,
          archiveBeforeDelete: policy.archiveBeforeDelete,
        },
        { tenantId },
      );

      // Invalidate related caches
      await this.invalidateMetricsCache(tenantId);

    } catch (error) {
      this.loggerService.error(
        `Failed to set retention policy for tenant ${tenantId}`,
        this.getErrorStack(error),
        { tenantId, policy, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async generateReport(
    tenantId: string,
    reportType: 'daily' | 'weekly' | 'monthly',
    timeRange?: TimeRangeInput,
  ): Promise<any> {
    try {
      const startTime = Date.now();
      
      const [metrics, analytics] = await Promise.all([
        this.getMetrics(tenantId, timeRange),
        this.getAnalytics(tenantId, timeRange, 20),
      ]);

      const report = {
        tenantId,
        reportType,
        timeRange,
        generatedAt: new Date(),
        metrics,
        analytics,
        summary: this.generateSummary(metrics, analytics),
        recommendations: this.generateRecommendations(metrics, analytics),
      };

      this.loggerService.business(
        'log_report_generated',
        {
          reportType,
          tenantId,
          metricsIncluded: Object.keys(metrics).length,
          analyticsIncluded: Object.keys(analytics).length,
        },
        { tenantId },
      );

      this.loggerService.performance(
        'generate_log_report',
        Date.now() - startTime,
        { tenantId, reportType },
      );

      return report;
    } catch (error) {
      this.loggerService.error(
        `Failed to generate ${reportType} report for tenant ${tenantId}`,
        this.getErrorStack(error),
        { tenantId, reportType, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async getTrendAnalysis(
    tenantId: string,
    metric: keyof LogMetrics,
    timeRange: TimeRangeInput,
    granularity: 'hour' | 'day' | 'week' = 'day',
  ): Promise<any[]> {
    try {
      const cacheKey = `log_trends:${tenantId}:${metric}:${granularity}:${JSON.stringify(timeRange)}`;
      
      const cached = await this.cacheService.get<any[]>(cacheKey);
      if (cached) {
        this.loggerService.cache('get', cacheKey, true, { tenantId });
        return cached;
      }

      // Calculate trend data
      const trends = await this.calculateTrends(tenantId, metric, timeRange, granularity);

      // Cache for 15 minutes
      await this.cacheService.set(cacheKey, trends, { ttl: 900, tenantId });

      this.loggerService.performance(
        'calculate_log_trends',
        Date.now(),
        { tenantId, metric, granularity, dataPoints: trends.length },
      );

      return trends;
    } catch (error) {
      this.loggerService.error(
        `Failed to get trend analysis for ${metric} in tenant ${tenantId}`,
        this.getErrorStack(error),
        { tenantId, metric, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async getAnomalyDetection(
    tenantId: string,
    timeRange: TimeRangeInput,
    sensitivity: 'low' | 'medium' | 'high' = 'medium',
  ): Promise<any[]> {
    try {
      const startTime = Date.now();
      
      // Get historical data for comparison
      const historicalMetrics = await this.getHistoricalMetrics(tenantId, timeRange);
      
      // Detect anomalies using statistical analysis
      const anomalies = this.detectAnomalies(historicalMetrics, sensitivity);

      this.loggerService.performance(
        'anomaly_detection',
        Date.now() - startTime,
        { tenantId, sensitivity, anomaliesFound: anomalies.length },
      );

      if (anomalies.length > 0) {
        this.loggerService.security(
          'log_anomalies_detected',
          {
            anomalyCount: anomalies.length,
            sensitivity,
            timeRange,
            anomalies: anomalies.slice(0, 5), // Log first 5 anomalies
          },
          { tenantId },
        );
      }

      return anomalies;
    } catch (error) {
      this.loggerService.error(
        `Failed to detect anomalies for tenant ${tenantId}`,
        this.getErrorStack(error),
        { tenantId, sensitivity, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  private async calculateMetrics(
    tenantId: string,
    timeRange?: TimeRangeInput,
    categories?: LogCategory[],
  ): Promise<LogMetricsType> {
    // In a real implementation, this would query a time-series database
    // For now, return mock data with realistic values
    
    const baseMetrics = this.loggerService.getMetrics(tenantId);
    
    return {
      totalLogs: baseMetrics.totalLogs + Math.floor(Math.random() * 1000),
      errorCount: baseMetrics.errorCount + Math.floor(Math.random() * 50),
      warningCount: baseMetrics.warningCount + Math.floor(Math.random() * 100),
      performanceIssues: baseMetrics.performanceIssues + Math.floor(Math.random() * 20),
      securityEvents: baseMetrics.securityEvents + Math.floor(Math.random() * 10),
      auditEvents: baseMetrics.auditEvents + Math.floor(Math.random() * 30),
      averageResponseTime: baseMetrics.averageResponseTime + Math.random() * 100,
      slowQueries: baseMetrics.slowQueries + Math.floor(Math.random() * 15),
      graphqlErrors: baseMetrics.graphqlErrors + Math.floor(Math.random() * 25),
    };
  }

  private async calculateAnalytics(
    tenantId: string,
    timeRange?: TimeRangeInput,
    topN: number = 10,
    categories?: LogCategory[],
  ): Promise<LogAnalyticsType> {
    // Mock analytics data - in production, this would query actual log data
    return {
      topOperations: Array.from({ length: Math.min(topN, 10) }, (_, i) => ({
        operation: `operation_${i + 1}`,
        count: Math.floor(Math.random() * 1000) + 100,
        avgDuration: Math.random() * 500 + 50,
      })),
      errorPatterns: Array.from({ length: 5 }, (_, i) => ({
        pattern: `error_pattern_${i + 1}`,
        count: Math.floor(Math.random() * 50) + 5,
        lastOccurrence: new Date(Date.now() - Math.random() * 86400000),
      })),
      performanceTrends: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 3600000),
        avgDuration: Math.random() * 200 + 100,
        operationCount: Math.floor(Math.random() * 100) + 20,
      })),
      securityAlerts: Array.from({ length: 4 }, (_, i) => ({
        type: (['failed_login', 'suspicious_activity', 'rate_limit', 'unauthorized_access'][i]) || 'unknown',
        count: Math.floor(Math.random() * 20) + 1,
        severity: (['low', 'medium', 'high', 'critical'][i]) || 'medium',
      })),
      tenantActivity: Array.from({ length: 5 }, (_, i) => ({
        tenantId: `tenant_${i + 1}`,
        logCount: Math.floor(Math.random() * 5000) + 1000,
        errorRate: Math.random() * 0.1,
      })),
    };
  }

  private async calculateTrends(
    tenantId: string,
    metric: keyof LogMetrics,
    timeRange: TimeRangeInput,
    granularity: 'hour' | 'day' | 'week',
  ): Promise<any[]> {
    const intervals = this.getTimeIntervals(timeRange, granularity);
    
    return intervals.map(interval => ({
      timestamp: interval,
      value: Math.floor(Math.random() * 100) + 10,
      change: (Math.random() - 0.5) * 20, // -10% to +10% change
    }));
  }

  private async getHistoricalMetrics(
    tenantId: string,
    timeRange: TimeRangeInput,
  ): Promise<any[]> {
    // Mock historical data for anomaly detection
    const dataPoints = 100;
    return Array.from({ length: dataPoints }, (_, i) => ({
      timestamp: new Date(timeRange.start.getTime() + (i * (timeRange.end.getTime() - timeRange.start.getTime()) / dataPoints)),
      errorRate: Math.random() * 0.05 + 0.01, // 1-6% error rate
      responseTime: Math.random() * 200 + 100, // 100-300ms response time
      throughput: Math.random() * 1000 + 500, // 500-1500 requests
    }));
  }

  private detectAnomalies(data: any[], sensitivity: 'low' | 'medium' | 'high'): any[] {
    const thresholds = {
      low: 3,
      medium: 2,
      high: 1.5,
    };
    
    const threshold = thresholds[sensitivity];
    const anomalies: any[] = [];
    
    // Simple statistical anomaly detection using z-score
    ['errorRate', 'responseTime', 'throughput'].forEach(metric => {
      const values = data.map(d => d[metric]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
      
      data.forEach((point, index) => {
        const zScore = Math.abs((point[metric] - mean) / stdDev);
        if (zScore > threshold) {
          anomalies.push({
            timestamp: point.timestamp,
            metric,
            value: point[metric],
            expectedRange: [mean - threshold * stdDev, mean + threshold * stdDev],
            severity: zScore > 3 ? 'high' : zScore > 2 ? 'medium' : 'low',
            zScore,
          });
        }
      });
    });
    
    return anomalies.sort((a, b) => b.zScore - a.zScore);
  }

  private getTimeIntervals(
    timeRange: TimeRangeInput,
    granularity: 'hour' | 'day' | 'week',
  ): Date[] {
    const intervals: Date[] = [];
    const start = new Date(timeRange.start);
    const end = new Date(timeRange.end);
    
    const increment = {
      hour: 3600000,
      day: 86400000,
      week: 604800000,
    }[granularity];
    
    let current = start;
    while (current <= end) {
      intervals.push(new Date(current));
      current = new Date(current.getTime() + increment);
    }
    
    return intervals;
  }

  private generateSummary(metrics: LogMetricsType, analytics: LogAnalyticsType): any {
    const errorRate = metrics.totalLogs > 0 ? (metrics.errorCount / metrics.totalLogs) * 100 : 0;
    const topOperation = analytics.topOperations[0];
    
    return {
      totalLogs: metrics.totalLogs,
      errorRate: Math.round(errorRate * 100) / 100,
      averageResponseTime: Math.round(metrics.averageResponseTime * 100) / 100,
      topOperation: topOperation?.operation || 'N/A',
      securityIncidents: metrics.securityEvents,
      performanceIssues: metrics.performanceIssues,
    };
  }

  private generateRecommendations(metrics: LogMetricsType, analytics: LogAnalyticsType): string[] {
    const recommendations: string[] = [];
    
    const errorRate = metrics.totalLogs > 0 ? (metrics.errorCount / metrics.totalLogs) * 100 : 0;
    
    if (errorRate > 5) {
      recommendations.push('High error rate detected. Consider investigating error patterns and implementing better error handling.');
    }
    
    if (metrics.averageResponseTime > 1000) {
      recommendations.push('Average response time is high. Consider optimizing slow operations and implementing caching.');
    }
    
    if (metrics.securityEvents > 10) {
      recommendations.push('Multiple security events detected. Review security logs and consider strengthening security measures.');
    }
    
    if (metrics.slowQueries > 20) {
      recommendations.push('Many slow queries detected. Consider database optimization and query performance tuning.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System performance looks good. Continue monitoring for any changes.');
    }
    
    return recommendations;
  }

  private async invalidateMetricsCache(tenantId: string): Promise<void> {
    const patterns = [
      `log_metrics:${tenantId}:*`,
      `log_analytics:${tenantId}:*`,
      `log_trends:${tenantId}:*`,
    ];
    
    for (const pattern of patterns) {
      await this.cacheService.invalidatePattern(pattern, { tenantId });
    }
    
    this.loggerService.cache('invalidate', `patterns:${patterns.join(',')}`, false, { tenantId });
  }
}