import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { DataWarehouseService } from './data-warehouse.service';
import { sql } from 'drizzle-orm';

export interface MetricValue {
  metricName: string;
  value: number;
  timestamp: Date;
  dimensions: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface MetricAggregation {
  metricName: string;
  period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  aggregationType: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct_count';
  value: number;
  periodStart: Date;
  periodEnd: Date;
  dimensions: Record<string, any>;
}

export interface KPIDefinition {
  name: string;
  displayName: string;
  description: string;
  calculation: string; // SQL expression or formula
  target?: number;
  unit: string;
  format: 'number' | 'currency' | 'percentage' | 'duration';
  trend: 'higher_is_better' | 'lower_is_better' | 'neutral';
  category: 'revenue' | 'operations' | 'customer' | 'inventory' | 'employee';
  refreshInterval: number; // minutes
}

export interface KPIValue {
  kpiName: string;
  value: number;
  target?: number;
  variance?: number; // percentage difference from target
  trend: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    comparisonPeriod: string;
  };
  timestamp: Date;
  dimensions: Record<string, any>;
}

@Injectable()
export class MetricsCalculationService {
  private readonly logger = new Logger(MetricsCalculationService.name);
  private kpiDefinitions = new Map<string, KPIDefinition>();

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly dataWarehouseService: DataWarehouseService,
  ) {
    this.initializeDefaultKPIs();
  }

  /**
   * Calculate real-time metrics
   */
  async calculateRealTimeMetrics(tenantId: string, metricNames?: string[]): Promise<MetricValue[]> {
    try {
      this.logger.log(`Calculating real-time metrics for tenant: ${tenantId}`);

      const metrics: MetricValue[] = [];
      const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;

      // Define real-time metric calculations
      const realTimeMetrics = [
        {
          name: 'daily_revenue',
          sql: `
            SELECT COALESCE(SUM(total_amount), 0) as value
            FROM ${schemaName}.fact_transactions
            WHERE DATE(transaction_date) = CURRENT_DATE
          `,
        },
        {
          name: 'daily_transactions',
          sql: `
            SELECT COUNT(*) as value
            FROM ${schemaName}.fact_transactions
            WHERE DATE(transaction_date) = CURRENT_DATE
          `,
        },
        {
          name: 'average_order_value',
          sql: `
            SELECT COALESCE(AVG(total_amount), 0) as value
            FROM ${schemaName}.fact_transactions
            WHERE DATE(transaction_date) = CURRENT_DATE
          `,
        },
        {
          name: 'active_customers_today',
          sql: `
            SELECT COUNT(DISTINCT customer_id) as value
            FROM ${schemaName}.fact_transactions
            WHERE DATE(transaction_date) = CURRENT_DATE
              AND customer_id IS NOT NULL
          `,
        },
        {
          name: 'low_stock_items',
          sql: `
            SELECT COUNT(*) as value
            FROM ${schemaName}.fact_inventory fi
            JOIN ${schemaName}.dim_product dp ON fi.product_id = dp.product_id
            WHERE fi.snapshot_date = (SELECT MAX(snapshot_date) FROM ${schemaName}.fact_inventory)
              AND fi.ending_quantity <= 10
              AND dp.is_active = true
          `,
        },
      ];

      // Filter metrics if specific ones requested
      const metricsToCalculate = metricNames 
        ? realTimeMetrics.filter(m => metricNames.includes(m.name))
        : realTimeMetrics;

      // Calculate each metric
      for (const metric of metricsToCalculate) {
        try {
          const result = await this.dataWarehouseService.executeAnalyticsQuery(
            tenantId,
            metric.sql,
            [],
            { useCache: true, cacheTTL: 300 } // 5 minute cache
          );

          if (result.data.length > 0) {
            metrics.push({
              metricName: metric.name,
              value: result.data[0].value || 0,
              timestamp: new Date(),
              dimensions: { tenant_id: tenantId },
            });
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.logger.warn(`Failed to calculate metric ${metric.name}:`, error);
          // Add zero value for failed metrics
          metrics.push({
            metricName: metric.name,
            value: 0,
            timestamp: new Date(),
            dimensions: { tenant_id: tenantId },
            metadata: { error: err.message },
          });
        }
      }

      // Cache results
      const cacheKey = `realtime-metrics:${tenantId}`;
      await this.cacheService.set(cacheKey, metrics, { ttl: 300 }); // 5 minutes

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to calculate real-time metrics for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate KPIs
   */
  async calculateKPIs(tenantId: string, kpiNames?: string[]): Promise<KPIValue[]> {
    try {
      this.logger.log(`Calculating KPIs for tenant: ${tenantId}`);

      const kpis: KPIValue[] = [];
      const kpisToCalculate = kpiNames 
        ? Array.from(this.kpiDefinitions.values()).filter(kpi => kpiNames.includes(kpi.name))
        : Array.from(this.kpiDefinitions.values());

      for (const kpiDef of kpisToCalculate) {
        try {
          const kpiValue = await this.calculateSingleKPI(tenantId, kpiDef);
          kpis.push(kpiValue);
        } catch (error) {
          this.logger.warn(`Failed to calculate KPI ${kpiDef.name}:`, error);
        }
      }

      // Cache results - use default TTL since kpiDef is out of scope
      const cacheKey = `kpis:${tenantId}`;
      await this.cacheService.set(cacheKey, kpis, { ttl: 3600 }); // 1 hour default

      return kpis;
    } catch (error) {
      this.logger.error(`Failed to calculate KPIs for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate metric aggregations
   */
  async calculateAggregations(
    tenantId: string,
    metricName: string,
    period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year',
    startDate: Date,
    endDate: Date,
    dimensions?: string[]
  ): Promise<MetricAggregation[]> {
    try {
      this.logger.log(`Calculating aggregations for metric: ${metricName}, period: ${period}`);

      const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;
      const aggregations: MetricAggregation[] = [];

      // Build aggregation query based on metric and period
      const { sql: aggregationSQL, groupByClause } = this.buildAggregationQuery(
        schemaName,
        metricName,
        period,
        startDate,
        endDate,
        dimensions
      );

      const result = await this.dataWarehouseService.executeAnalyticsQuery(
        tenantId,
        aggregationSQL,
        [startDate, endDate],
        { useCache: true, cacheTTL: 1800 } // 30 minutes
      );

      // Process results
      for (const row of result.data) {
        const periodStart = new Date(row.period_start);
        const periodEnd = new Date(row.period_end);
        
        aggregations.push({
          metricName,
          period,
          aggregationType: this.getAggregationType(metricName),
          value: row.value || 0,
          periodStart,
          periodEnd,
          dimensions: this.extractDimensions(row, dimensions || []),
        });
      }

      return aggregations;
    } catch (error) {
      this.logger.error(`Failed to calculate aggregations for metric ${metricName}:`, error);
      throw error;
    }
  }

  /**
   * Get metric trends
   */
  async getMetricTrends(
    tenantId: string,
    metricName: string,
    period: 'day' | 'week' | 'month',
    periods: number = 7
  ): Promise<{
    current: number;
    previous: number;
    trend: {
      direction: 'up' | 'down' | 'stable';
      percentage: number;
    };
    history: Array<{
      period: string;
      value: number;
      timestamp: Date;
    }>;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      // Calculate start date based on period and number of periods
      switch (period) {
        case 'day':
          startDate.setDate(endDate.getDate() - periods);
          break;
        case 'week':
          startDate.setDate(endDate.getDate() - (periods * 7));
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - periods);
          break;
      }

      const aggregations = await this.calculateAggregations(
        tenantId,
        metricName,
        period,
        startDate,
        endDate
      );

      // Sort by period
      aggregations.sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

      const history = aggregations.map(agg => ({
        period: this.formatPeriod(agg.periodStart, period),
        value: agg.value,
        timestamp: agg.periodStart,
      }));

      const current = history.length > 0 ? (history[history.length - 1]?.value ?? 0) : 0;
      const previous = history.length > 1 ? (history[history.length - 2]?.value ?? 0) : 0;

      // Calculate trend
      let direction: 'up' | 'down' | 'stable' = 'stable';
      let percentage = 0;

      if (previous > 0) {
        percentage = ((current - previous) / previous) * 100;
        if (Math.abs(percentage) > 5) { // 5% threshold for stability
          direction = percentage > 0 ? 'up' : 'down';
        }
      } else if (current > 0) {
        direction = 'up';
        percentage = 100;
      }

      return {
        current,
        previous,
        trend: {
          direction,
          percentage: Math.abs(percentage),
        },
        history,
      };
    } catch (error) {
      this.logger.error(`Failed to get metric trends for ${metricName}:`, error);
      throw error;
    }
  }

  /**
   * Scheduled metric calculations
   */

  @Cron(CronExpression.EVERY_5_MINUTES)
  async calculateRealTimeMetricsScheduled(): Promise<void> {
    try {
      // Get all active tenants (this would come from tenant service)
      const activeTenants = await this.getActiveTenants();

      for (const tenantId of activeTenants) {
        try {
          await this.calculateRealTimeMetrics(tenantId);
        } catch (error) {
          this.logger.warn(`Failed to calculate real-time metrics for tenant ${tenantId}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Failed to run scheduled real-time metrics calculation:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async calculateHourlyAggregations(): Promise<void> {
    try {
      const activeTenants = await this.getActiveTenants();
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 2 * 60 * 60 * 1000); // Last 2 hours

      for (const tenantId of activeTenants) {
        try {
          await this.calculateAggregations(tenantId, 'revenue', 'hour', startDate, endDate);
          await this.calculateAggregations(tenantId, 'transaction_count', 'hour', startDate, endDate);
        } catch (error) {
          this.logger.warn(`Failed to calculate hourly aggregations for tenant ${tenantId}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Failed to run scheduled hourly aggregations:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async calculateDailyAggregations(): Promise<void> {
    try {
      const activeTenants = await this.getActiveTenants();
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

      for (const tenantId of activeTenants) {
        try {
          await this.calculateAggregations(tenantId, 'revenue', 'day', startDate, endDate);
          await this.calculateAggregations(tenantId, 'transaction_count', 'day', startDate, endDate);
          await this.calculateAggregations(tenantId, 'customer_count', 'day', startDate, endDate);
        } catch (error) {
          this.logger.warn(`Failed to calculate daily aggregations for tenant ${tenantId}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Failed to run scheduled daily aggregations:', error);
    }
  }

  /**
   * Get real-time metrics for API
   */
  async getRealTimeMetrics(tenantId: string, metricNames?: string[]): Promise<Record<string, any>> {
    try {
      const metrics = await this.calculateRealTimeMetrics(tenantId, metricNames);
      
      // Convert to key-value format
      const result: Record<string, any> = {};
      for (const metric of metrics) {
        result[metric.metricName] = {
          value: metric.value,
          timestamp: metric.timestamp,
          dimensions: metric.dimensions,
          metadata: metric.metadata,
        };
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to get real-time metrics for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get historical metrics for API
   */
  async getHistoricalMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    interval: 'hourly' | 'daily' | 'weekly' | 'monthly',
    metricNames?: string[]
  ): Promise<{
    data: Array<{
      timestamp: Date;
      metrics: Record<string, number>;
    }>;
    interval: string;
    totalDataPoints: number;
  }> {
    try {
      const metricsToQuery = metricNames || ['revenue', 'transaction_count', 'customer_count'];
      const allAggregations: MetricAggregation[] = [];

      // Get aggregations for each metric
      for (const metricName of metricsToQuery) {
        try {
          // Map interval from 'hourly|daily|weekly|monthly' to 'hour|day|week|month'
          const periodMap: Record<string, 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'> = {
            'hourly': 'hour',
            'daily': 'day',
            'weekly': 'week',
            'monthly': 'month',
          };
          const period = periodMap[interval] || 'day';
          const aggregations = await this.calculateAggregations(
            tenantId,
            metricName,
            period,
            startDate,
            endDate
          );
          allAggregations.push(...aggregations);
        } catch (error) {
          this.logger.warn(`Failed to get aggregations for metric ${metricName}:`, error);
        }
      }

      // Group by timestamp
      const groupedData = new Map<string, Record<string, number>>();
      
      for (const agg of allAggregations) {
        const timestampKey = agg.periodStart.toISOString();
        
        if (!groupedData.has(timestampKey)) {
          groupedData.set(timestampKey, {});
        }
        
        groupedData.get(timestampKey)![agg.metricName] = agg.value;
      }

      // Convert to array format
      const data = Array.from(groupedData.entries()).map(([timestamp, metrics]) => ({
        timestamp: new Date(timestamp),
        metrics,
      })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      return {
        data,
        interval,
        totalDataPoints: data.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get historical metrics for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  private initializeDefaultKPIs(): void {
    const defaultKPIs: KPIDefinition[] = [
      {
        name: 'revenue_growth',
        displayName: 'Revenue Growth',
        description: 'Month-over-month revenue growth percentage',
        calculation: `
          WITH current_month AS (
            SELECT SUM(total_amount) as current_revenue
            FROM fact_transactions
            WHERE DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
          ),
          previous_month AS (
            SELECT SUM(total_amount) as previous_revenue
            FROM fact_transactions
            WHERE DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          )
          SELECT 
            CASE 
              WHEN pm.previous_revenue > 0 
              THEN ((cm.current_revenue - pm.previous_revenue) / pm.previous_revenue) * 100
              ELSE 0
            END as value
          FROM current_month cm, previous_month pm
        `,
        target: 10, // 10% growth target
        unit: '%',
        format: 'percentage',
        trend: 'higher_is_better',
        category: 'revenue',
        refreshInterval: 60, // 1 hour
      },
      {
        name: 'customer_acquisition_cost',
        displayName: 'Customer Acquisition Cost',
        description: 'Average cost to acquire a new customer',
        calculation: `
          SELECT 
            COALESCE(marketing_spend / NULLIF(new_customers, 0), 0) as value
          FROM (
            SELECT 
              1000 as marketing_spend, -- This would come from actual marketing data
              COUNT(DISTINCT customer_id) as new_customers
            FROM fact_customers
            WHERE DATE_TRUNC('month', snapshot_date) = DATE_TRUNC('month', CURRENT_DATE)
              AND snapshot_date = (SELECT MIN(snapshot_date) FROM fact_customers WHERE customer_id = fact_customers.customer_id)
          ) calc
        `,
        target: 50, // $50 target CAC
        unit: '$',
        format: 'currency',
        trend: 'lower_is_better',
        category: 'customer',
        refreshInterval: 240, // 4 hours
      },
      {
        name: 'inventory_turnover',
        displayName: 'Inventory Turnover',
        description: 'How quickly inventory is sold and replaced',
        calculation: `
          SELECT 
            COALESCE(cogs / NULLIF(avg_inventory, 0), 0) as value
          FROM (
            SELECT 
              SUM(ft.total_amount * 0.7) as cogs, -- Assuming 70% COGS
              AVG(fi.ending_quantity * fi.unit_cost) as avg_inventory
            FROM fact_transactions ft
            JOIN fact_inventory fi ON ft.product_id = fi.product_id
            WHERE ft.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
          ) calc
        `,
        target: 12, // 12x annual turnover target
        unit: 'x',
        format: 'number',
        trend: 'higher_is_better',
        category: 'inventory',
        refreshInterval: 120, // 2 hours
      },
      {
        name: 'employee_productivity',
        displayName: 'Employee Productivity',
        description: 'Revenue per employee per day',
        calculation: `
          SELECT 
            COALESCE(daily_revenue / NULLIF(active_employees, 0), 0) as value
          FROM (
            SELECT 
              SUM(total_amount) as daily_revenue,
              COUNT(DISTINCT employee_id) as active_employees
            FROM fact_transactions
            WHERE DATE(transaction_date) = CURRENT_DATE
              AND employee_id IS NOT NULL
          ) calc
        `,
        target: 500, // $500 per employee per day target
        unit: '$',
        format: 'currency',
        trend: 'higher_is_better',
        category: 'employee',
        refreshInterval: 60, // 1 hour
      },
    ];

    for (const kpi of defaultKPIs) {
      this.kpiDefinitions.set(kpi.name, kpi);
    }
  }

  private async calculateSingleKPI(tenantId: string, kpiDef: KPIDefinition): Promise<KPIValue> {
    const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;
    
    // Replace schema placeholder in calculation
    const sql = kpiDef.calculation.replace(/fact_/g, `${schemaName}.fact_`);

    const result = await this.dataWarehouseService.executeAnalyticsQuery(
      tenantId,
      sql,
      [],
      { useCache: true, cacheTTL: kpiDef.refreshInterval * 60 }
    );

    const value = result.data.length > 0 ? (result.data[0].value || 0) : 0;

    // Calculate variance from target
    const variance: number | undefined = kpiDef.target ? ((value - kpiDef.target) / kpiDef.target) * 100 : undefined;

    // Get trend (simplified - would compare with previous period)
    const trend = await this.calculateKPITrend(tenantId, kpiDef.name, value);

    const kpiValue: Record<string, any> = {
      kpiName: kpiDef.name,
      value,
      trend,
      timestamp: new Date(),
      dimensions: { tenant_id: tenantId },
    };

    // Only add optional properties if they have values
    if (kpiDef.target !== undefined) {
      kpiValue.target = kpiDef.target;
    }
    if (variance !== undefined) {
      kpiValue.variance = variance;
    }

    return kpiValue as any;
  }

  private async calculateKPITrend(tenantId: string, kpiName: string, currentValue: number): Promise<{
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    comparisonPeriod: string;
  }> {
    // This would compare with previous period value
    // For now, return mock trend
    const previousValue = currentValue * (0.9 + Math.random() * 0.2); // Mock previous value
    const percentage = previousValue > 0 ? Math.abs((currentValue - previousValue) / previousValue) * 100 : 0;
    
    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (percentage > 5) {
      direction = currentValue > previousValue ? 'up' : 'down';
    }

    return {
      direction,
      percentage,
      comparisonPeriod: 'previous_month',
    };
  }

  private buildAggregationQuery(
    schemaName: string,
    metricName: string,
    period: string,
    startDate: Date,
    endDate: Date,
    dimensions?: string[]
  ): { sql: string; groupByClause: string } {
    const periodTrunc = this.getPeriodTruncFunction(period);
    const dimensionColumns = dimensions ? dimensions.join(', ') + ',' : '';
    const groupByDimensions = dimensions ? dimensions.join(', ') + ',' : '';

    let sql: string;
    let groupByClause: string;

    switch (metricName) {
      case 'revenue':
        sql = `
          SELECT 
            ${dimensionColumns}
            ${periodTrunc}(transaction_date) as period_start,
            ${periodTrunc}(transaction_date) + INTERVAL '1 ${period}' as period_end,
            SUM(total_amount) as value
          FROM ${schemaName}.fact_transactions
          WHERE transaction_date >= ? AND transaction_date <= ?
          GROUP BY ${groupByDimensions}${periodTrunc}(transaction_date)
          ORDER BY period_start
        `;
        break;

      case 'transaction_count':
        sql = `
          SELECT 
            ${dimensionColumns}
            ${periodTrunc}(transaction_date) as period_start,
            ${periodTrunc}(transaction_date) + INTERVAL '1 ${period}' as period_end,
            COUNT(*) as value
          FROM ${schemaName}.fact_transactions
          WHERE transaction_date >= ? AND transaction_date <= ?
          GROUP BY ${groupByDimensions}${periodTrunc}(transaction_date)
          ORDER BY period_start
        `;
        break;

      case 'customer_count':
        sql = `
          SELECT 
            ${dimensionColumns}
            ${periodTrunc}(snapshot_date) as period_start,
            ${periodTrunc}(snapshot_date) + INTERVAL '1 ${period}' as period_end,
            COUNT(DISTINCT customer_id) as value
          FROM ${schemaName}.fact_customers
          WHERE snapshot_date >= ? AND snapshot_date <= ?
          GROUP BY ${groupByDimensions}${periodTrunc}(snapshot_date)
          ORDER BY period_start
        `;
        break;

      default:
        throw new Error(`Unsupported metric for aggregation: ${metricName}`);
    }

    groupByClause = `${groupByDimensions}${periodTrunc}(transaction_date)`;
    return { sql, groupByClause };
  }

  private getPeriodTruncFunction(period: string): string {
    switch (period) {
      case 'hour':
        return 'DATE_TRUNC(\'hour\'';
      case 'day':
        return 'DATE_TRUNC(\'day\'';
      case 'week':
        return 'DATE_TRUNC(\'week\'';
      case 'month':
        return 'DATE_TRUNC(\'month\'';
      case 'quarter':
        return 'DATE_TRUNC(\'quarter\'';
      case 'year':
        return 'DATE_TRUNC(\'year\'';
      default:
        return 'DATE_TRUNC(\'day\'';
    }
  }

  private getAggregationType(metricName: string): 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct_count' {
    switch (metricName) {
      case 'revenue':
        return 'sum';
      case 'transaction_count':
        return 'count';
      case 'customer_count':
        return 'distinct_count';
      case 'average_order_value':
        return 'avg';
      default:
        return 'sum';
    }
  }

  private extractDimensions(row: any, dimensionNames: string[]): Record<string, any> {
    const dimensions: Record<string, any> = {};
    for (const dimName of dimensionNames) {
      if (row[dimName] !== undefined) {
        dimensions[dimName] = row[dimName];
      }
    }
    return dimensions;
  }

  private formatPeriod(date: Date, period: string): string {
    const isoString = date.toISOString();
    const dateOnly = isoString.split('T')[0] || isoString;
    
    switch (period) {
      case 'day':
        return dateOnly;
      case 'week':
        return `Week of ${dateOnly}`;
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return dateOnly;
    }
  }

  private async getActiveTenants(): Promise<string[]> {
    // This would query the tenant service for active tenants
    // For now, return empty array
    return [];
  }
}