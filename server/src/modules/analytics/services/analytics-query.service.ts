import { Injectable, Logger } from '@nestjs/common';
import { DataWarehouseService } from './data-warehouse.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { AnalyticsAPIService, AnalyticsQuery, AnalyticsResult } from './analytics-api.service';

export interface QueryBuilder {
  select(fields: string[]): QueryBuilder;
  from(table: string): QueryBuilder;
  join(table: string, condition: string, type?: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'): QueryBuilder;
  where(condition: string): QueryBuilder;
  groupBy(fields: string[]): QueryBuilder;
  having(condition: string): QueryBuilder;
  orderBy(field: string, direction?: 'ASC' | 'DESC'): QueryBuilder;
  limit(count: number): QueryBuilder;
  offset(count: number): QueryBuilder;
  build(): string;
}

export interface QueryOptimizer {
  optimizeQuery(sql: string): {
    optimizedSQL: string;
    optimizations: string[];
    estimatedImprovement: number;
  };
}

export interface QueryPerformanceAnalyzer {
  analyzeQuery(sql: string): Promise<{
    executionPlan: any;
    estimatedCost: number;
    recommendations: string[];
    indexSuggestions: string[];
  }>;
}

@Injectable()
export class AnalyticsQueryService {
  private readonly logger = new Logger(AnalyticsQueryService.name);

  constructor(
    private readonly dataWarehouseService: DataWarehouseService,
    private readonly cacheService: IntelligentCacheService,
    private readonly analyticsAPIService: AnalyticsAPIService,
  ) {}

  /**
   * Create a query builder instance
   */
  createQueryBuilder(tenantId: string): QueryBuilder {
    return new SQLQueryBuilder(tenantId);
  }

  /**
   * Execute optimized query
   */
  async executeOptimizedQuery(
    tenantId: string,
    sql: string,
    parameters: any[] = [],
    options: {
      useCache?: boolean;
      cacheTTL?: number;
      optimize?: boolean;
    } = {}
  ): Promise<AnalyticsResult> {
    try {
      let finalSQL = sql;

      // Optimize query if requested
      if (options.optimize !== false) {
        const optimizer = new SQLQueryOptimizer();
        const optimized = optimizer.optimizeQuery(sql);
        finalSQL = optimized.optimizedSQL;
        
        if (optimized.optimizations.length > 0) {
          this.logger.debug(`Query optimizations applied: ${optimized.optimizations.join(', ')}`);
        }
      }

      // Execute query
      const result = await this.dataWarehouseService.executeAnalyticsQuery(
        tenantId,
        finalSQL,
        parameters,
        {
          useCache: options.useCache ?? false,
          cacheTTL: options.cacheTTL ?? 300,
        }
      );

      return {
        data: result.data,
        metadata: {
          totalRows: result.metadata.rowCount,
          executionTime: result.metadata.executionTime,
          fromCache: result.metadata.fromCache,
          queryId: result.metadata.queryId,
          columns: this.extractColumnMetadata(result.data),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to execute optimized query for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Analyze query performance
   */
  async analyzeQueryPerformance(tenantId: string, sql: string): Promise<{
    executionPlan: any;
    estimatedCost: number;
    recommendations: string[];
    indexSuggestions: string[];
  }> {
    try {
      const analyzer = new SQLPerformanceAnalyzer(this.dataWarehouseService);
      return await analyzer.analyzeQuery(sql);
    } catch (error) {
      this.logger.error(`Failed to analyze query performance for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get query suggestions based on data patterns
   */
  async getQuerySuggestions(tenantId: string, context: {
    tables?: string[];
    timeRange?: { start: Date; end: Date };
    dimensions?: string[];
    measures?: string[];
  }): Promise<AnalyticsQuery[]> {
    try {
      const suggestions: AnalyticsQuery[] = [];

      // Revenue analysis suggestions
      if (!context.tables || context.tables.includes('fact_transactions')) {
        suggestions.push({
          name: 'Revenue Trend Analysis',
          description: 'Analyze revenue trends over time',
          sql: this.buildRevenueTrendQuery(tenantId, context),
          parameters: [
            { name: 'start_date', type: 'date', required: true },
            { name: 'end_date', type: 'date', required: true },
          ],
          dimensions: ['date'],
          measures: ['revenue', 'transaction_count'],
        });

        suggestions.push({
          name: 'Top Products by Revenue',
          description: 'Identify best-performing products',
          sql: this.buildTopProductsQuery(tenantId, context),
          parameters: [
            { name: 'start_date', type: 'date', required: true },
            { name: 'end_date', type: 'date', required: true },
            { name: 'limit', type: 'number', required: false, defaultValue: 10 },
          ],
          dimensions: ['product_name'],
          measures: ['revenue', 'units_sold'],
        });
      }

      // Customer analysis suggestions
      if (!context.tables || context.tables.includes('fact_customers')) {
        suggestions.push({
          name: 'Customer Segmentation Analysis',
          description: 'Analyze customer segments and behavior',
          sql: this.buildCustomerSegmentationQuery(tenantId, context),
          parameters: [],
          dimensions: ['customer_segment'],
          measures: ['customer_count', 'avg_lifetime_value'],
        });
      }

      // Inventory analysis suggestions
      if (!context.tables || context.tables.includes('fact_inventory')) {
        suggestions.push({
          name: 'Inventory Turnover Analysis',
          description: 'Analyze inventory movement and turnover rates',
          sql: this.buildInventoryTurnoverQuery(tenantId, context),
          parameters: [
            { name: 'start_date', type: 'date', required: true },
            { name: 'end_date', type: 'date', required: true },
          ],
          dimensions: ['product_category', 'location'],
          measures: ['turnover_rate', 'avg_stock_level'],
        });
      }

      return suggestions;
    } catch (error) {
      this.logger.error(`Failed to get query suggestions for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Validate SQL query for security and syntax
   */
  validateQuery(sql: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    securityIssues: string[];
  } {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
      securityIssues: [] as string[],
    };

    try {
      // Check for SQL injection patterns
      const dangerousPatterns: Array<{ pattern: RegExp; message: string }> = [
        { pattern: /;\s*(drop|delete|truncate|alter|create|insert|update)\s+/i, message: 'Potentially dangerous SQL operation detected' },
        { pattern: /union\s+select/i, message: 'UNION SELECT detected - potential SQL injection' },
        { pattern: /--/, message: 'SQL comments detected' },
        { pattern: /\/\*/, message: 'SQL block comments detected' },
        { pattern: /xp_cmdshell/i, message: 'System command execution detected' },
        { pattern: /sp_executesql/i, message: 'Dynamic SQL execution detected' },
      ];

      for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(sql)) {
          result.securityIssues.push(message);
          result.isValid = false;
        }
      }

      // Check for basic syntax issues
      const syntaxChecks: Array<{ pattern: RegExp; required: boolean; message: string }> = [
        { pattern: /select\s+.*\s+from\s+/i, required: true, message: 'Query must have SELECT and FROM clauses' },
        { pattern: /\bselect\s+\*/i, required: false, message: 'Consider specifying columns instead of SELECT *' },
        { pattern: /\bwhere\s+1\s*=\s*1/i, required: false, message: 'Avoid WHERE 1=1 conditions' },
      ];

      for (const { pattern, required, message } of syntaxChecks) {
        const matches = pattern.test(sql);
        if (required && !matches) {
          result.errors.push(message);
          result.isValid = false;
        } else if (!required && matches) {
          result.warnings.push(message);
        }
      }

      // Check for performance issues
      const performanceChecks: Array<{ pattern: RegExp; message: string }> = [
        { pattern: /\bselect\s+.*\s+from\s+.*\s+where\s+.*\s+like\s+'%.*%'/i, message: 'Leading wildcard in LIKE may cause performance issues' },
        { pattern: /\bselect\s+.*\s+from\s+.*(?!\s+where)/i, message: 'Query without WHERE clause may return too many rows' },
        { pattern: /\border\s+by\s+.*(?!\s+limit)/i, message: 'ORDER BY without LIMIT may cause performance issues' },
      ];

      for (const { pattern, message } of performanceChecks) {
        if (pattern.test(sql)) {
          result.warnings.push(message);
        }
      }

    } catch (err) {
      const error = err as Error;
      result.errors.push(`Query validation error: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Get query execution statistics
   */
  async getQueryStatistics(tenantId: string, timeRange?: { start: Date; end: Date }): Promise<{
    totalQueries: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    slowQueries: Array<{
      queryId: string;
      executionTime: number;
      timestamp: Date;
    }>;
    popularQueries: Array<{
      queryPattern: string;
      executionCount: number;
      averageTime: number;
    }>;
  }> {
    try {
      // This would query actual execution logs
      // For now, return mock statistics
      return {
        totalQueries: Math.floor(Math.random() * 10000) + 1000,
        averageExecutionTime: Math.random() * 500 + 100, // 100-600ms
        cacheHitRate: Math.random() * 40 + 60, // 60-100%
        slowQueries: [
          {
            queryId: 'slow_query_1',
            executionTime: 5000,
            timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          },
          {
            queryId: 'slow_query_2',
            executionTime: 3500,
            timestamp: new Date(Date.now() - 7200000), // 2 hours ago
          },
        ],
        popularQueries: [
          {
            queryPattern: 'SELECT ... FROM fact_transactions WHERE ...',
            executionCount: 150,
            averageTime: 250,
          },
          {
            queryPattern: 'SELECT ... FROM fact_customers WHERE ...',
            executionCount: 89,
            averageTime: 180,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to get query statistics for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private extractColumnMetadata(data: any[]): Array<{ name: string; type: string; description?: string }> {
    if (data.length === 0) {
      return [];
    }

    const firstRow = data[0];
    return Object.keys(firstRow).map((key: string) => ({
      name: key,
      type: typeof firstRow[key],
    }));
  }

  private buildRevenueTrendQuery(tenantId: string, context: any): string {
    const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;
    return `
      SELECT 
        DATE_TRUNC('day', transaction_date) as date,
        SUM(total_amount) as revenue,
        COUNT(*) as transaction_count,
        AVG(total_amount) as avg_order_value
      FROM ${schemaName}.fact_transactions
      WHERE transaction_date >= {start_date}
        AND transaction_date <= {end_date}
      GROUP BY DATE_TRUNC('day', transaction_date)
      ORDER BY date
    `;
  }

  private buildTopProductsQuery(tenantId: string, context: any): string {
    const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;
    return `
      SELECT 
        p.product_name,
        SUM(ft.total_amount) as revenue,
        SUM(ft.quantity) as units_sold,
        AVG(ft.unit_price) as avg_price
      FROM ${schemaName}.fact_transactions ft
      JOIN ${schemaName}.dim_product p ON ft.product_id = p.product_id
      WHERE ft.transaction_date >= {start_date}
        AND ft.transaction_date <= {end_date}
      GROUP BY p.product_name
      ORDER BY revenue DESC
      LIMIT {limit}
    `;
  }

  private buildCustomerSegmentationQuery(tenantId: string, context: any): string {
    const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;
    return `
      SELECT 
        customer_segment,
        COUNT(DISTINCT customer_id) as customer_count,
        AVG(lifetime_value) as avg_lifetime_value,
        AVG(avg_order_value) as avg_order_value,
        AVG(total_orders) as avg_orders
      FROM ${schemaName}.fact_customers
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM ${schemaName}.fact_customers)
      GROUP BY customer_segment
      ORDER BY avg_lifetime_value DESC
    `;
  }

  private buildInventoryTurnoverQuery(tenantId: string, context: any): string {
    const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;
    return `
      SELECT 
        p.category as product_category,
        l.location_name as location,
        AVG(fi.ending_quantity) as avg_stock_level,
        SUM(fi.quantity_sold) / NULLIF(AVG(fi.ending_quantity), 0) as turnover_rate,
        COUNT(*) as data_points
      FROM ${schemaName}.fact_inventory fi
      JOIN ${schemaName}.dim_product p ON fi.product_id = p.product_id
      JOIN ${schemaName}.dim_location l ON fi.location_id = l.location_id
      WHERE fi.snapshot_date >= {start_date}
        AND fi.snapshot_date <= {end_date}
      GROUP BY p.category, l.location_name
      HAVING AVG(fi.ending_quantity) > 0
      ORDER BY turnover_rate DESC
    `;
  }
}

/**
 * SQL Query Builder Implementation
 */
class SQLQueryBuilder implements QueryBuilder {
  private selectFields: string[] = [];
  private fromTable: string = '';
  private joins: string[] = [];
  private whereConditions: string[] = [];
  private groupByFields: string[] = [];
  private havingConditions: string[] = [];
  private orderByFields: string[] = [];
  private limitCount?: number;
  private offsetCount?: number;

  constructor(private tenantId: string) {}

  select(fields: string[]): QueryBuilder {
    this.selectFields = fields;
    return this;
  }

  from(table: string): QueryBuilder {
    const schemaName = `analytics_${this.tenantId.replace(/-/g, '_')}`;
    this.fromTable = `${schemaName}.${table}`;
    return this;
  }

  join(table: string, condition: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' = 'INNER'): QueryBuilder {
    const schemaName = `analytics_${this.tenantId.replace(/-/g, '_')}`;
    this.joins.push(`${type} JOIN ${schemaName}.${table} ON ${condition}`);
    return this;
  }

  where(condition: string): QueryBuilder {
    this.whereConditions.push(condition);
    return this;
  }

  groupBy(fields: string[]): QueryBuilder {
    this.groupByFields = fields;
    return this;
  }

  having(condition: string): QueryBuilder {
    this.havingConditions.push(condition);
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    this.orderByFields.push(`${field} ${direction}`);
    return this;
  }

  limit(count: number): QueryBuilder {
    this.limitCount = count;
    return this;
  }

  offset(count: number): QueryBuilder {
    this.offsetCount = count;
    return this;
  }

  build(): string {
    let sql = 'SELECT ';
    
    // SELECT clause
    sql += this.selectFields.length > 0 ? this.selectFields.join(', ') : '*';
    
    // FROM clause
    sql += ` FROM ${this.fromTable}`;
    
    // JOIN clauses
    if (this.joins.length > 0) {
      sql += ' ' + this.joins.join(' ');
    }
    
    // WHERE clause
    if (this.whereConditions.length > 0) {
      sql += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }
    
    // GROUP BY clause
    if (this.groupByFields.length > 0) {
      sql += ` GROUP BY ${this.groupByFields.join(', ')}`;
    }
    
    // HAVING clause
    if (this.havingConditions.length > 0) {
      sql += ` HAVING ${this.havingConditions.join(' AND ')}`;
    }
    
    // ORDER BY clause
    if (this.orderByFields.length > 0) {
      sql += ` ORDER BY ${this.orderByFields.join(', ')}`;
    }
    
    // LIMIT clause
    if (this.limitCount) {
      sql += ` LIMIT ${this.limitCount}`;
    }
    
    // OFFSET clause
    if (this.offsetCount) {
      sql += ` OFFSET ${this.offsetCount}`;
    }

    return sql;
  }
}

/**
 * SQL Query Optimizer Implementation
 */
class SQLQueryOptimizer implements QueryOptimizer {
  optimizeQuery(sql: string): {
    optimizedSQL: string;
    optimizations: string[];
    estimatedImprovement: number;
  } {
    let optimizedSQL = sql;
    const optimizations: string[] = [];
    let estimatedImprovement = 0;

    // Remove unnecessary SELECT *
    if (/SELECT\s+\*/i.test(optimizedSQL)) {
      // In a real implementation, this would analyze the query context
      // For now, just flag it as an optimization opportunity
      optimizations.push('Consider specifying only needed columns instead of SELECT *');
      estimatedImprovement += 10;
    }

    // Add LIMIT if missing for potentially large result sets
    if (!/LIMIT\s+\d+/i.test(optimizedSQL) && /SELECT.*FROM.*(?!WHERE)/i.test(optimizedSQL)) {
      optimizations.push('Consider adding LIMIT clause for large result sets');
      estimatedImprovement += 15;
    }

    // Suggest index usage for WHERE clauses
    const whereMatch = optimizedSQL.match(/WHERE\s+([^GROUP|ORDER|LIMIT]+)/i);
    if (whereMatch) {
      optimizations.push('Ensure indexes exist for WHERE clause columns');
      estimatedImprovement += 25;
    }

    // Optimize JOIN order (simplified)
    const joinCount = (optimizedSQL.match(/JOIN/gi) || []).length;
    if (joinCount > 2) {
      optimizations.push('Consider optimizing JOIN order for better performance');
      estimatedImprovement += 20;
    }

    return {
      optimizedSQL,
      optimizations,
      estimatedImprovement,
    };
  }
}

/**
 * SQL Performance Analyzer Implementation
 */
class SQLPerformanceAnalyzer implements QueryPerformanceAnalyzer {
  constructor(private dataWarehouseService: DataWarehouseService) {}

  async analyzeQuery(sql: string): Promise<{
    executionPlan: any;
    estimatedCost: number;
    recommendations: string[];
    indexSuggestions: string[];
  }> {
    try {
      // Get execution plan (this would use EXPLAIN in PostgreSQL)
      const explainSQL = `EXPLAIN (FORMAT JSON, ANALYZE false) ${sql}`;
      
      // For now, return mock analysis
      return {
        executionPlan: {
          nodeType: 'Seq Scan',
          totalCost: 1000.50,
          rows: 5000,
        },
        estimatedCost: 1000.50,
        recommendations: [
          'Add index on frequently filtered columns',
          'Consider partitioning large tables',
          'Use LIMIT clause to reduce result set size',
        ],
        indexSuggestions: [
          'CREATE INDEX idx_transactions_date ON fact_transactions(transaction_date)',
          'CREATE INDEX idx_transactions_customer ON fact_transactions(customer_id)',
        ],
      };
    } catch (error) {
      throw new Error(`Failed to analyze query: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}