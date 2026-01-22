import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

interface OperationMetrics {
  operationName: string;
  operationType: string;
  tenantId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorType?: string;
  args: any;
}

@Injectable()
export class DRMetricsInterceptor implements NestInterceptor {
  private readonly metrics: Map<string, OperationMetrics[]> = new Map();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const info = ctx.getInfo();
    
    const operationName = info.fieldName;
    const operationType = info.operation.operation;
    const tenantId = request.tenantId;
    const userId = request.user?.id;
    const args = ctx.getArgs();

    const startTime = Date.now();
    const operationId = `${tenantId}-${operationName}-${startTime}`;

    const metric: OperationMetrics = {
      operationName,
      operationType,
      tenantId,
      userId,
      startTime,
      success: false,
      args: this.sanitizeArgs(args),
    };

    return next.handle().pipe(
      tap((result) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        metric.endTime = endTime;
        metric.duration = duration;
        metric.success = this.isSuccessfulResult(result);

        this.recordMetric(tenantId, metric);
        this.updatePerformanceMetrics(operationName, duration, true);
      }),
      catchError((error) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        metric.endTime = endTime;
        metric.duration = duration;
        metric.success = false;
        metric.errorType = error.constructor.name;

        this.recordMetric(tenantId, metric);
        this.updatePerformanceMetrics(operationName, duration, false);

        return throwError(() => error);
      })
    );
  }

  private sanitizeArgs(args: any): any {
    // Remove sensitive information from metrics
    const sanitized = { ...args };
    
    if (sanitized.input) {
      delete sanitized.input.password;
      delete sanitized.input.token;
      delete sanitized.input.secret;
    }

    return sanitized;
  }

  private isSuccessfulResult(result: any): boolean {
    if (typeof result === 'boolean') {
      return result;
    }
    
    if (result && typeof result === 'object') {
      return result.success !== false;
    }
    
    return true;
  }

  private recordMetric(tenantId: string, metric: OperationMetrics): void {
    if (!this.metrics.has(tenantId)) {
      this.metrics.set(tenantId, []);
    }

    const tenantMetrics = this.metrics.get(tenantId)!;
    tenantMetrics.push(metric);

    // Keep only last 1000 metrics per tenant
    if (tenantMetrics.length > 1000) {
      tenantMetrics.splice(0, tenantMetrics.length - 1000);
    }
  }

  private updatePerformanceMetrics(
    operationName: string,
    duration: number,
    success: boolean
  ): void {
    // Update global performance metrics
    // In a real implementation, this would update metrics in a monitoring system
    // like Prometheus, DataDog, etc.
    
    const metricsKey = `dr_operation_${operationName}`;
    
    // Simulate metrics update
    console.log(`Metrics Update: ${metricsKey} | Duration: ${duration}ms | Success: ${success}`);
  }

  /**
   * Get metrics for a specific tenant
   */
  getMetricsForTenant(tenantId: string): OperationMetrics[] {
    return this.metrics.get(tenantId) || [];
  }

  /**
   * Get aggregated metrics for a tenant
   */
  getAggregatedMetrics(tenantId: string): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDuration: number;
    operationBreakdown: Record<string, {
      count: number;
      successRate: number;
      averageDuration: number;
    }>;
  } {
    const metrics = this.getMetricsForTenant(tenantId);
    
    if (metrics.length === 0) {
      return {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageDuration: 0,
        operationBreakdown: {},
      };
    }

    const successfulOperations = metrics.filter(m => m.success).length;
    const failedOperations = metrics.length - successfulOperations;
    const totalDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    const averageDuration = totalDuration / metrics.length;

    // Calculate operation breakdown
    const operationBreakdown: Record<string, {
      count: number;
      successRate: number;
      averageDuration: number;
    }> = {};

    metrics.forEach(metric => {
      if (!operationBreakdown[metric.operationName]) {
        operationBreakdown[metric.operationName] = {
          count: 0,
          successRate: 0,
          averageDuration: 0,
        };
      }

      const op = operationBreakdown[metric.operationName];
      if (op) {
        op.count++;
      }
    });

    // Calculate success rates and average durations
    Object.keys(operationBreakdown).forEach(operationName => {
      const operationMetrics = metrics.filter(m => m.operationName === operationName);
      const successfulOps = operationMetrics.filter(m => m.success).length;
      const totalDuration = operationMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);

      const op = operationBreakdown[operationName];
      if (op) {
        op.successRate = 
          Math.round((successfulOps / operationMetrics.length) * 10000) / 100;
        op.averageDuration = 
          Math.round((totalDuration / operationMetrics.length) * 100) / 100;
      }
    });

    return {
      totalOperations: metrics.length,
      successfulOperations,
      failedOperations,
      averageDuration: Math.round(averageDuration * 100) / 100,
      operationBreakdown,
    };
  }

  /**
   * Clear metrics for a tenant (useful for testing)
   */
  clearMetricsForTenant(tenantId: string): void {
    this.metrics.delete(tenantId);
  }

  /**
   * Get performance trends for a specific operation
   */
  getPerformanceTrends(
    tenantId: string,
    operationName: string,
    hours = 24
  ): {
    timestamp: Date;
    averageDuration: number;
    successRate: number;
    operationCount: number;
  }[] {
    const metrics = this.getMetricsForTenant(tenantId)
      .filter(m => m.operationName === operationName);

    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const recentMetrics = metrics.filter(m => m.startTime >= cutoffTime);

    // Group by hour
    const hourlyData: Record<string, {
      durations: number[];
      successes: number;
      total: number;
    }> = {};

    recentMetrics.forEach(metric => {
      const hour = new Date(metric.startTime);
      hour.setMinutes(0, 0, 0);
      const hourKey = hour.toISOString();

      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = {
          durations: [],
          successes: 0,
          total: 0,
        };
      }

      hourlyData[hourKey].durations.push(metric.duration || 0);
      hourlyData[hourKey].total++;
      if (metric.success) {
        hourlyData[hourKey].successes++;
      }
    });

    return Object.entries(hourlyData).map(([hourKey, data]) => ({
      timestamp: new Date(hourKey),
      averageDuration: Math.round(
        (data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length) * 100
      ) / 100,
      successRate: Math.round((data.successes / data.total) * 10000) / 100,
      operationCount: data.total,
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}