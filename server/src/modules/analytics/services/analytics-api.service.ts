import { Injectable, Logger } from '@nestjs/common';
import { DataWarehouseService } from './data-warehouse.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { AnalyticsFoundationService } from './analytics-foundation.service';

export interface AnalyticsQuery {
  id?: string;
  name: string;
  description?: string;
  sql: string;
  parameters: AnalyticsParameter[];
  dimensions: string[];
  measures: string[];
  filters?: AnalyticsFilter[];
  timeRange?: {
    start: Date;
    end: Date;
    granularity: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
  limit?: number;
  orderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
}

export interface AnalyticsParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface AnalyticsFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'like' | 'between';
  value: any;
}

export interface AnalyticsResult {
  data: any[];
  metadata: {
    totalRows: number;
    executionTime: number;
    fromCache: boolean;
    queryId: string;
    columns: Array<{
      name: string;
      type: string;
      description?: string;
    }>;
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'gauge' | 'map';
  title: string;
  description?: string;
  query: AnalyticsQuery;
  visualization: {
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap';
    xAxis?: string;
    yAxis?: string[];
    colorBy?: string;
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  };
  refreshInterval?: number; // seconds
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Dashboard {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  filters: AnalyticsFilter[];
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AnalyticsAPIService {
  private readonly logger = new Logger(AnalyticsAPIService.name);

  constructor(
    private readonly dataWarehouseService: DataWarehouseService,
    private readonly cacheService: IntelligentCacheService,
    private readonly analyticsFoundationService: AnalyticsFoundationService,
  ) {}

  /**
   * Execute analytics query
   */
  async executeQuery(
    tenantId: string,
    query: AnalyticsQuery,
    parameters: Record<string, any> = {},
    options: {
      useCache?: boolean;
      cacheTTL?: number;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<AnalyticsResult> {
    try {
      this.logger.log(`Executing analytics query for tenant: ${tenantId}`);

      // Validate query parameters
      this.validateQueryParameters(query, parameters);

      // Build SQL with parameters
      const { sql, sqlParameters } = this.buildSQL(query, parameters, tenantId);

      // Add pagination if requested
      const paginatedSQL = this.addPagination(sql, options.page, options.pageSize);

      // Execute query
      const result = await this.dataWarehouseService.executeAnalyticsQuery(
        tenantId,
        paginatedSQL,
        sqlParameters,
        {
          useCache: options.useCache ?? false,
          cacheTTL: options.cacheTTL ?? 300,
        }
      );

      // Get total count for pagination
      let totalRows = result.data.length;
      if (options.page && options.pageSize) {
        const countSQL = this.buildCountSQL(sql);
        const countResult = await this.dataWarehouseService.executeAnalyticsQuery(
          tenantId,
          countSQL,
          sqlParameters,
          { useCache: options.useCache ?? false }
        );
        totalRows = countResult.data[0]?.total_count || 0;
      }

      // Build response
      const analyticsResult: AnalyticsResult = {
        data: result.data,
        metadata: {
          totalRows,
          executionTime: result.metadata.executionTime,
          fromCache: result.metadata.fromCache,
          queryId: result.metadata.queryId,
          columns: this.extractColumnMetadata(result.data),
        },
      };

      // Add pagination metadata
      if (options.page && options.pageSize) {
        const totalPages = Math.ceil(totalRows / options.pageSize);
        analyticsResult.pagination = {
          page: options.page,
          pageSize: options.pageSize,
          totalPages,
          hasNext: options.page < totalPages,
          hasPrevious: options.page > 1,
        };
      }

      return analyticsResult;
    } catch (error) {
      this.logger.error(`Failed to execute analytics query for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get predefined analytics queries
   */
  async getPredefinedQueries(tenantId: string): Promise<AnalyticsQuery[]> {
    try {
      const cacheKey = `predefined-queries:${tenantId}`;
      
      // Try cache first
      let queries = await this.cacheService.get<AnalyticsQuery[]>(cacheKey);
      
      if (!queries) {
        queries = await this.loadPredefinedQueries(tenantId);
        
        // Cache for 1 hour
        await this.cacheService.set(cacheKey, queries, { ttl: 3600 });
      }

      return queries;
    } catch (error) {
      this.logger.error(`Failed to get predefined queries for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Create custom analytics query
   */
  async createCustomQuery(tenantId: string, query: AnalyticsQuery, userId: string): Promise<AnalyticsQuery> {
    try {
      // Validate query
      this.validateQuery(query);

      // Generate ID if not provided
      if (!query.id) {
        query.id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      }

      // Store query (in production, this would go to database)
      await this.storeCustomQuery(tenantId, query, userId);

      // Invalidate cache
      await this.cacheService.invalidatePattern(`predefined-queries:${tenantId}`);

      this.logger.log(`Custom query created: ${query.id} for tenant ${tenantId}`);
      return query;
    } catch (error) {
      this.logger.error(`Failed to create custom query for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(tenantId: string, dashboardId: string, refresh?: boolean): Promise<{
    dashboard: Dashboard;
    widgetData: Record<string, AnalyticsResult>;
  }> {
    try {
      this.logger.log(`Getting dashboard data: ${dashboardId} for tenant: ${tenantId}`);

      // Load dashboard configuration
      const dashboard = await this.loadDashboard(tenantId, dashboardId);
      if (!dashboard) {
        throw new Error(`Dashboard not found: ${dashboardId}`);
      }

      // Execute queries for all widgets
      const widgetData: Record<string, AnalyticsResult> = {};
      
      await Promise.all(
        dashboard.widgets.map(async (widget) => {
          try {
            const result = await this.executeQuery(
              tenantId,
              widget.query,
              {},
              { useCache: true, cacheTTL: widget.refreshInterval || 300 }
            );
            widgetData[widget.id] = result;
          } catch (error) {
            this.logger.warn(`Failed to load widget data: ${widget.id}`, error);
            // Set empty result for failed widgets
            widgetData[widget.id] = {
              data: [],
              metadata: {
                totalRows: 0,
                executionTime: 0,
                fromCache: false,
                queryId: '',
                columns: [],
              },
            };
          }
        })
      );

      return { dashboard, widgetData };
    } catch (error) {
      this.logger.error(`Failed to get dashboard data for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Create or update dashboard
   */
  async saveDashboard(tenantId: string, dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<Dashboard> {
    try {
      const now = new Date();
      const dashboardId = `dashboard_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const fullDashboard: Dashboard = {
        ...dashboard,
        id: dashboardId,
        tenantId,
        createdAt: now,
        updatedAt: now,
      };

      // Validate dashboard
      this.validateDashboard(fullDashboard);

      // Store dashboard (in production, this would go to database)
      await this.storeDashboard(tenantId, fullDashboard, userId);

      this.logger.log(`Dashboard saved: ${fullDashboard.id} for tenant ${tenantId}`);
      return fullDashboard;
    } catch (error) {
      this.logger.error(`Failed to save dashboard for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get available dimensions and measures
   */
  async getAvailableFields(tenantId: string): Promise<{
    dimensions: Array<{
      name: string;
      displayName: string;
      type: string;
      table: string;
      description?: string;
    }>;
    measures: Array<{
      name: string;
      displayName: string;
      type: string;
      aggregation: string[];
      table: string;
      description?: string;
    }>;
  }> {
    try {
      const cacheKey = `available-fields:${tenantId}`;
      
      // Try cache first
      let fields = await this.cacheService.get<any>(cacheKey);
      
      if (!fields) {
        fields = await this.loadAvailableFields(tenantId);
        
        // Cache for 30 minutes
        await this.cacheService.set(cacheKey, fields, { ttl: 1800 });
      }

      return fields;
    } catch (error) {
      this.logger.error(`Failed to get available fields for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Generate SQL for natural language query
   */
  async generateSQLFromNaturalLanguage(tenantId: string, naturalLanguageQuery: string): Promise<{
    sql: string;
    confidence: number;
    explanation: string;
  }> {
    try {
      // This would integrate with an AI service for natural language to SQL conversion
      // For now, return a mock response
      
      const mockSQL = `
        SELECT 
          DATE_TRUNC('day', transaction_date) as date,
          SUM(total_amount) as revenue
        FROM analytics_${tenantId.replace(/-/g, '_')}.fact_transactions
        WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', transaction_date)
        ORDER BY date
      `;

      return {
        sql: mockSQL.trim(),
        confidence: 0.85,
        explanation: 'Generated query to show daily revenue for the last 30 days',
      };
    } catch (error) {
      this.logger.error(`Failed to generate SQL from natural language for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Export data functionality
   */
  async exportData(
    tenantId: string,
    exportRequest: {
      format: 'csv' | 'excel' | 'pdf' | 'json';
      query?: string;
      dateRange?: {
        startDate: string;
        endDate: string;
      };
      metrics?: string[];
      filters?: Record<string, any>;
    },
    userId: string
  ): Promise<{
    exportId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    estimatedCompletionTime: Date;
    downloadUrl?: string;
  }> {
    try {
      const exportId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // This would queue the export job in a real implementation
      // For now, return mock response
      
      const estimatedCompletionTime = new Date();
      estimatedCompletionTime.setMinutes(estimatedCompletionTime.getMinutes() + 5);

      return {
        exportId,
        status: 'queued',
        estimatedCompletionTime,
      };
    } catch (error) {
      this.logger.error(`Failed to initiate data export for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private validateQueryParameters(query: AnalyticsQuery, parameters: Record<string, any>): void {
    for (const param of query.parameters) {
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Required parameter missing: ${param.name}`);
      }

      if (param.name in parameters) {
        const value = parameters[param.name];
        
        switch (param.type) {
          case 'number':
            if (typeof value !== 'number') {
              throw new Error(`Parameter ${param.name} must be a number`);
            }
            break;
          case 'date':
            if (!(value instanceof Date) && typeof value !== 'string') {
              throw new Error(`Parameter ${param.name} must be a date`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              throw new Error(`Parameter ${param.name} must be a boolean`);
            }
            break;
          case 'array':
            if (!Array.isArray(value)) {
              throw new Error(`Parameter ${param.name} must be an array`);
            }
            break;
        }
      }
    }
  }

  private buildSQL(query: AnalyticsQuery, parameters: Record<string, any>, tenantId: string): {
    sql: string;
    sqlParameters: any[];
  } {
    let sql = query.sql;
    const sqlParameters: any[] = [];

    // Replace tenant_id placeholder
    sql = sql.replace(/\{tenant_id\}/g, tenantId);

    // Replace parameters
    for (const param of query.parameters) {
      const value = parameters[param.name] || param.defaultValue;
      if (value !== undefined) {
        sql = sql.replace(new RegExp(`\\{${param.name}\\}`, 'g'), '?');
        sqlParameters.push(value);
      }
    }

    // Add filters
    if (query.filters && query.filters.length > 0) {
      const filterClauses = query.filters.map(filter => this.buildFilterClause(filter));
      sql += ` AND ${filterClauses.join(' AND ')}`;
    }

    // Add time range filter
    if (query.timeRange) {
      sql += ` AND transaction_date BETWEEN ? AND ?`;
      sqlParameters.push(query.timeRange.start, query.timeRange.end);
    }

    // Add ordering
    if (query.orderBy && query.orderBy.length > 0) {
      const orderClauses = query.orderBy.map(order => `${order.field} ${order.direction.toUpperCase()}`);
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // Add limit
    if (query.limit) {
      sql += ` LIMIT ${query.limit}`;
    }

    return { sql, sqlParameters };
  }

  private buildFilterClause(filter: AnalyticsFilter): string {
    switch (filter.operator) {
      case 'eq':
        return `${filter.field} = '${filter.value}'`;
      case 'ne':
        return `${filter.field} != '${filter.value}'`;
      case 'gt':
        return `${filter.field} > '${filter.value}'`;
      case 'gte':
        return `${filter.field} >= '${filter.value}'`;
      case 'lt':
        return `${filter.field} < '${filter.value}'`;
      case 'lte':
        return `${filter.field} <= '${filter.value}'`;
      case 'in':
        return `${filter.field} IN (${filter.value.map((v: any) => `'${v}'`).join(', ')})`;
      case 'not_in':
        return `${filter.field} NOT IN (${filter.value.map((v: any) => `'${v}'`).join(', ')})`;
      case 'like':
        return `${filter.field} LIKE '%${filter.value}%'`;
      case 'between':
        return `${filter.field} BETWEEN '${filter.value[0]}' AND '${filter.value[1]}'`;
      default:
        return '1=1';
    }
  }

  private addPagination(sql: string, page?: number, pageSize?: number): string {
    if (!page || !pageSize) {
      return sql;
    }

    const offset = (page - 1) * pageSize;
    return `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
  }

  private buildCountSQL(sql: string): string {
    // Extract the main query without ORDER BY and LIMIT
    const cleanSQL = sql.replace(/\s+ORDER\s+BY\s+[^;]*$/i, '').replace(/\s+LIMIT\s+[^;]*$/i, '');
    return `SELECT COUNT(*) as total_count FROM (${cleanSQL}) as count_query`;
  }

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

  private validateQuery(query: AnalyticsQuery): void {
    if (!query.name || !query.sql) {
      throw new Error('Query must have name and SQL');
    }

    // Basic SQL injection protection
    const dangerousPatterns = [
      /;\s*(drop|delete|truncate|alter|create|insert|update)\s+/i,
      /union\s+select/i,
      /--/,
      /\/\*/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query.sql)) {
        throw new Error('Query contains potentially dangerous SQL patterns');
      }
    }
  }

  private validateDashboard(dashboard: Dashboard): void {
    if (!dashboard.name || !dashboard.tenantId) {
      throw new Error('Dashboard must have name and tenantId');
    }

    if (!dashboard.widgets || dashboard.widgets.length === 0) {
      throw new Error('Dashboard must have at least one widget');
    }

    for (const widget of dashboard.widgets) {
      if (!widget.title || !widget.query) {
        throw new Error('Widget must have title and query');
      }
    }
  }

  private async loadPredefinedQueries(tenantId: string): Promise<AnalyticsQuery[]> {
    // This would load from database - for now, return default queries
    return [
      {
        id: 'daily-revenue',
        name: 'Daily Revenue',
        description: 'Daily revenue trends',
        sql: `
          SELECT 
            DATE_TRUNC('day', transaction_date) as date,
            SUM(total_amount) as revenue,
            COUNT(*) as transaction_count
          FROM analytics_{tenant_id}.fact_transactions
          WHERE transaction_date >= {start_date}
            AND transaction_date <= {end_date}
          GROUP BY DATE_TRUNC('day', transaction_date)
        `,
        parameters: [
          { name: 'start_date', type: 'date', required: true },
          { name: 'end_date', type: 'date', required: true },
        ],
        dimensions: ['date'],
        measures: ['revenue', 'transaction_count'],
      },
      {
        id: 'top-products',
        name: 'Top Products',
        description: 'Best selling products',
        sql: `
          SELECT 
            p.product_name,
            SUM(ft.quantity) as units_sold,
            SUM(ft.total_amount) as revenue
          FROM analytics_{tenant_id}.fact_transactions ft
          JOIN analytics_{tenant_id}.dim_product p ON ft.product_id = p.product_id
          WHERE ft.transaction_date >= {start_date}
            AND ft.transaction_date <= {end_date}
          GROUP BY p.product_name
        `,
        parameters: [
          { name: 'start_date', type: 'date', required: true },
          { name: 'end_date', type: 'date', required: true },
        ],
        dimensions: ['product_name'],
        measures: ['units_sold', 'revenue'],
        limit: 10,
        orderBy: [{ field: 'revenue', direction: 'desc' }],
      },
      {
        id: 'customer-segments',
        name: 'Customer Segments',
        description: 'Customer segmentation analysis',
        sql: `
          SELECT 
            c.customer_segment,
            COUNT(DISTINCT c.customer_id) as customer_count,
            AVG(c.lifetime_value) as avg_lifetime_value,
            AVG(c.avg_order_value) as avg_order_value
          FROM analytics_{tenant_id}.fact_customers c
          WHERE c.snapshot_date = (SELECT MAX(snapshot_date) FROM analytics_{tenant_id}.fact_customers)
          GROUP BY c.customer_segment
        `,
        parameters: [],
        dimensions: ['customer_segment'],
        measures: ['customer_count', 'avg_lifetime_value', 'avg_order_value'],
      },
    ];
  }

  private async storeCustomQuery(tenantId: string, query: AnalyticsQuery, userId: string): Promise<void> {
    // This would store in database - for now, just log
    this.logger.debug(`Storing custom query for tenant ${tenantId}:`, query);
  }

  private async loadDashboard(tenantId: string, dashboardId: string): Promise<Dashboard | null> {
    // This would load from database - for now, return mock dashboard
    return {
      id: dashboardId,
      tenantId,
      name: 'Sales Overview',
      description: 'Key sales metrics and trends',
      widgets: [
        {
          id: 'revenue-chart',
          type: 'chart',
          title: 'Daily Revenue',
          query: {
            id: 'daily-revenue',
            name: 'Daily Revenue',
            sql: `SELECT DATE_TRUNC('day', transaction_date) as date, SUM(total_amount) as revenue FROM analytics_${tenantId.replace(/-/g, '_')}.fact_transactions WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY DATE_TRUNC('day', transaction_date)`,
            parameters: [],
            dimensions: ['date'],
            measures: ['revenue'],
          },
          visualization: {
            chartType: 'line',
            xAxis: 'date',
            yAxis: ['revenue'],
          },
          position: { x: 0, y: 0, width: 6, height: 4 },
        },
        {
          id: 'total-revenue-metric',
          type: 'metric',
          title: 'Total Revenue (30 days)',
          query: {
            id: 'total-revenue',
            name: 'Total Revenue',
            sql: `SELECT SUM(total_amount) as total_revenue FROM analytics_${tenantId.replace(/-/g, '_')}.fact_transactions WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days'`,
            parameters: [],
            dimensions: [],
            measures: ['total_revenue'],
          },
          visualization: {},
          position: { x: 6, y: 0, width: 3, height: 2 },
        },
      ],
      filters: [],
      isPublic: false,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async storeDashboard(tenantId: string, dashboard: Dashboard, userId: string): Promise<void> {
    // This would store in database - for now, just log
    this.logger.debug(`Storing dashboard for tenant ${tenantId}:`, dashboard);
  }

  private async loadAvailableFields(tenantId: string): Promise<any> {
    // This would query the data warehouse schema - for now, return mock data
    return {
      dimensions: [
        { name: 'transaction_date', displayName: 'Transaction Date', type: 'date', table: 'fact_transactions' },
        { name: 'location_id', displayName: 'Location', type: 'string', table: 'fact_transactions' },
        { name: 'customer_id', displayName: 'Customer', type: 'string', table: 'fact_transactions' },
        { name: 'product_name', displayName: 'Product', type: 'string', table: 'dim_product' },
        { name: 'category', displayName: 'Category', type: 'string', table: 'dim_product' },
      ],
      measures: [
        { name: 'total_amount', displayName: 'Revenue', type: 'number', aggregation: ['sum', 'avg'], table: 'fact_transactions' },
        { name: 'quantity', displayName: 'Quantity', type: 'number', aggregation: ['sum', 'avg'], table: 'fact_transactions' },
        { name: 'transaction_count', displayName: 'Transaction Count', type: 'number', aggregation: ['count'], table: 'fact_transactions' },
      ],
    };
  }
}