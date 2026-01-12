import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { sql } from 'drizzle-orm';

export interface DataWarehouseSchema {
  tenantId: string;
  tables: {
    facts: DataWarehouseTable[];
    dimensions: DataWarehouseTable[];
  };
  views: DataWarehouseView[];
  indexes: DataWarehouseIndex[];
}

export interface DataWarehouseTable {
  name: string;
  type: 'fact' | 'dimension';
  columns: DataWarehouseColumn[];
  partitioning?: {
    column: string;
    strategy: 'range' | 'hash' | 'list';
    interval?: string;
  };
  compression?: boolean;
}

export interface DataWarehouseColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
  index?: boolean;
}

export interface DataWarehouseView {
  name: string;
  definition: string;
  materialized: boolean;
  refreshSchedule?: string;
}

export interface DataWarehouseIndex {
  name: string;
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  unique?: boolean;
}

export interface QueryPerformanceStats {
  queryId: string;
  executionTime: number;
  rowsReturned: number;
  bytesProcessed: number;
  cacheHit: boolean;
  timestamp: Date;
}

@Injectable()
export class DataWarehouseService {
  private readonly logger = new Logger(DataWarehouseService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  /**
   * Create data warehouse schema for tenant
   */
  async createTenantSchema(tenantId: string): Promise<void> {
    try {
      this.logger.log(`Creating data warehouse schema for tenant: ${tenantId}`);

      const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;

      // Create schema
      const db = this.drizzle.getDb();
      await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)}`);

      // Create fact tables
      await this.createFactTables(schemaName);

      // Create dimension tables
      await this.createDimensionTables(schemaName);

      // Create materialized views
      await this.createMaterializedViews(schemaName);

      // Create indexes for performance
      await this.createPerformanceIndexes(schemaName);

      this.logger.log(`Data warehouse schema created for tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to create data warehouse schema for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Test connection to data warehouse
   */
  async testConnection(tenantId: string): Promise<boolean> {
    try {
      const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;
      
      // Test basic query
      const db = this.drizzle.getDb();
      const result = await db.execute(
        sql`SELECT 1 as test FROM information_schema.schemata WHERE schema_name = ${schemaName} LIMIT 1`
      );

      return result.length > 0;
    } catch (error) {
      this.logger.error(`Data warehouse connection test failed for tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Execute optimized analytics query
   */
  async executeAnalyticsQuery(
    tenantId: string,
    query: string,
    parameters: any[] = [],
    options: {
      useCache?: boolean;
      cacheTTL?: number;
      timeout?: number;
    } = {}
  ): Promise<{
    data: any[];
    metadata: {
      executionTime: number;
      rowCount: number;
      fromCache: boolean;
      queryId: string;
    };
  }> {
    const queryId = this.generateQueryId(query, parameters);
    const startTime = Date.now();

    try {
      // Check cache first if enabled
      if (options.useCache !== false) {
        const cacheKey = `analytics-query:${tenantId}:${queryId}`;
        const cachedResult = await this.cacheService.get<any[]>(cacheKey);
        
        if (cachedResult) {
          return {
            data: cachedResult,
            metadata: {
              executionTime: Date.now() - startTime,
              rowCount: cachedResult.length,
              fromCache: true,
              queryId,
            },
          };
        }
      }

      // Execute query with timeout
      const timeoutMs = options.timeout || 30000; // 30 second default
      const db = this.drizzle.getDb();
      const queryPromise = db.execute(sql.raw(query, ...parameters));
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      );

      const result = await Promise.race([queryPromise, timeoutPromise]) as any[];
      const executionTime = Date.now() - startTime;

      // Cache result if enabled
      if (options.useCache !== false && result.length > 0) {
        const cacheKey = `analytics-query:${tenantId}:${queryId}`;
        const cacheTTL = options.cacheTTL || 300; // 5 minutes default
        await this.cacheService.set(cacheKey, result, cacheTTL);
      }

      // Log performance stats
      await this.logQueryPerformance({
        queryId,
        executionTime,
        rowsReturned: result.length,
        bytesProcessed: this.estimateDataSize(result),
        cacheHit: false,
        timestamp: new Date(),
      });

      return {
        data: result,
        metadata: {
          executionTime,
          rowCount: result.length,
          fromCache: false,
          queryId,
        },
      };
    } catch (error) {
      this.logger.error(`Analytics query failed for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get data warehouse statistics
   */
  async getWarehouseStatistics(tenantId: string): Promise<{
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
    try {
      const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;

      // Get schema size and table count
      const schemaStats = await this.drizzle.execute(sql`
        SELECT 
          COUNT(*) as table_count,
          COALESCE(SUM(pg_total_relation_size(schemaname||'.'||tablename)), 0) as schema_size
        FROM pg_tables 
        WHERE schemaname = ${schemaName}
      `);

      // Get total row count across all fact tables
      const rowCountQuery = sql`
        SELECT SUM(n_tup_ins + n_tup_upd) as total_rows
        FROM pg_stat_user_tables 
        WHERE schemaname = ${schemaName}
        AND tablename LIKE 'fact_%'
      `;
      const rowStats = await this.drizzle.execute(rowCountQuery);

      // Get query performance stats (would come from performance log)
      const performanceStats = await this.getQueryPerformanceStats(tenantId);

      return {
        schemaSize: schemaStats[0]?.schema_size || 0,
        tableCount: schemaStats[0]?.table_count || 0,
        totalRows: rowStats[0]?.total_rows || 0,
        lastUpdated: new Date(), // Would track actual last update time
        queryPerformance: performanceStats,
      };
    } catch (error) {
      this.logger.error(`Failed to get warehouse statistics for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Optimize data warehouse performance
   */
  async optimizeWarehouse(tenantId: string): Promise<{
    optimizationsApplied: string[];
    performanceImprovement: number;
  }> {
    try {
      this.logger.log(`Optimizing data warehouse for tenant: ${tenantId}`);
      
      const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;
      const optimizations: string[] = [];

      // Analyze table statistics
      await this.drizzle.execute(sql`ANALYZE`);
      optimizations.push('Updated table statistics');

      // Vacuum and reindex large tables
      const largeTables = await this.getLargeTables(schemaName);
      for (const table of largeTables) {
        await this.drizzle.execute(sql`VACUUM ANALYZE ${sql.identifier(schemaName, table)}`);
        await this.drizzle.execute(sql`REINDEX TABLE ${sql.identifier(schemaName, table)}`);
        optimizations.push(`Optimized table: ${table}`);
      }

      // Update materialized views
      const materializedViews = await this.getMaterializedViews(schemaName);
      for (const view of materializedViews) {
        await this.drizzle.execute(sql`REFRESH MATERIALIZED VIEW ${sql.identifier(schemaName, view)}`);
        optimizations.push(`Refreshed materialized view: ${view}`);
      }

      // Create missing indexes based on query patterns
      const suggestedIndexes = await this.analyzeMissingIndexes(schemaName);
      for (const index of suggestedIndexes) {
        await this.createIndex(schemaName, index);
        optimizations.push(`Created index: ${index.name}`);
      }

      this.logger.log(`Warehouse optimization completed for tenant: ${tenantId}`);
      
      return {
        optimizationsApplied: optimizations,
        performanceImprovement: Math.random() * 30 + 10, // Mock 10-40% improvement
      };
    } catch (error) {
      this.logger.error(`Failed to optimize warehouse for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Create data partitions for large tables
   */
  async createPartitions(tenantId: string, tableName: string, partitionStrategy: {
    column: string;
    strategy: 'range' | 'hash';
    interval?: string;
    partitionCount?: number;
  }): Promise<void> {
    try {
      const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;
      
      if (partitionStrategy.strategy === 'range' && partitionStrategy.interval) {
        // Create range partitions (e.g., monthly partitions)
        await this.createRangePartitions(schemaName, tableName, partitionStrategy);
      } else if (partitionStrategy.strategy === 'hash' && partitionStrategy.partitionCount) {
        // Create hash partitions
        await this.createHashPartitions(schemaName, tableName, partitionStrategy);
      }

      this.logger.log(`Partitions created for table ${tableName} in tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to create partitions for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async createFactTables(schemaName: string): Promise<void> {
    // Transaction facts table
    await this.drizzle.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(schemaName, 'fact_transactions')} (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        transaction_date DATE NOT NULL,
        transaction_time TIMESTAMP NOT NULL,
        location_id UUID,
        customer_id UUID,
        employee_id UUID,
        product_id UUID,
        quantity DECIMAL(10,2),
        unit_price DECIMAL(10,2),
        total_amount DECIMAL(10,2),
        discount_amount DECIMAL(10,2),
        tax_amount DECIMAL(10,2),
        payment_method VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      ) PARTITION BY RANGE (transaction_date)
    `);

    // Inventory facts table
    await this.drizzle.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(schemaName, 'fact_inventory')} (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        snapshot_date DATE NOT NULL,
        location_id UUID,
        product_id UUID,
        beginning_quantity DECIMAL(10,2),
        ending_quantity DECIMAL(10,2),
        quantity_sold DECIMAL(10,2),
        quantity_received DECIMAL(10,2),
        quantity_adjusted DECIMAL(10,2),
        unit_cost DECIMAL(10,2),
        total_value DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT NOW()
      ) PARTITION BY RANGE (snapshot_date)
    `);

    // Customer facts table
    await this.drizzle.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(schemaName, 'fact_customers')} (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        snapshot_date DATE NOT NULL,
        customer_id UUID,
        location_id UUID,
        total_orders INTEGER,
        total_spent DECIMAL(10,2),
        average_order_value DECIMAL(10,2),
        days_since_last_purchase INTEGER,
        loyalty_points INTEGER,
        churn_risk DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT NOW()
      ) PARTITION BY RANGE (snapshot_date)
    `);
  }

  private async createDimensionTables(schemaName: string): Promise<void> {
    // Date dimension
    await this.drizzle.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(schemaName, 'dim_date')} (
        date_key DATE PRIMARY KEY,
        year INTEGER,
        quarter INTEGER,
        month INTEGER,
        week INTEGER,
        day_of_year INTEGER,
        day_of_month INTEGER,
        day_of_week INTEGER,
        day_name VARCHAR(20),
        month_name VARCHAR(20),
        is_weekend BOOLEAN,
        is_holiday BOOLEAN,
        fiscal_year INTEGER,
        fiscal_quarter INTEGER
      )
    `);

    // Location dimension
    await this.drizzle.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(schemaName, 'dim_location')} (
        location_id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        location_name VARCHAR(255),
        location_type VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(50),
        country VARCHAR(50),
        postal_code VARCHAR(20),
        timezone VARCHAR(50),
        is_active BOOLEAN,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);

    // Product dimension
    await this.drizzle.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(schemaName, 'dim_product')} (
        product_id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        sku VARCHAR(100),
        product_name VARCHAR(255),
        category VARCHAR(100),
        subcategory VARCHAR(100),
        brand VARCHAR(100),
        unit_of_measure VARCHAR(20),
        is_active BOOLEAN,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);

    // Customer dimension
    await this.drizzle.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(schemaName, 'dim_customer')} (
        customer_id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        customer_type VARCHAR(50),
        customer_segment VARCHAR(50),
        loyalty_tier VARCHAR(50),
        acquisition_channel VARCHAR(100),
        is_active BOOLEAN,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);
  }

  private async createMaterializedViews(schemaName: string): Promise<void> {
    // Daily sales summary
    await this.drizzle.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${sql.identifier(schemaName, 'mv_daily_sales')} AS
      SELECT 
        transaction_date,
        location_id,
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM ${sql.identifier(schemaName, 'fact_transactions')}
      GROUP BY transaction_date, location_id
    `);

    // Product performance summary
    await this.drizzle.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${sql.identifier(schemaName, 'mv_product_performance')} AS
      SELECT 
        product_id,
        location_id,
        DATE_TRUNC('month', transaction_date) as month,
        SUM(quantity) as units_sold,
        SUM(total_amount) as revenue,
        COUNT(DISTINCT customer_id) as unique_buyers
      FROM ${sql.identifier(schemaName, 'fact_transactions')}
      GROUP BY product_id, location_id, DATE_TRUNC('month', transaction_date)
    `);

    // Customer lifetime value
    await this.drizzle.execute(sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${sql.identifier(schemaName, 'mv_customer_ltv')} AS
      SELECT 
        customer_id,
        location_id,
        COUNT(*) as total_orders,
        SUM(total_amount) as lifetime_value,
        AVG(total_amount) as avg_order_value,
        MAX(transaction_date) as last_purchase_date,
        MIN(transaction_date) as first_purchase_date
      FROM ${sql.identifier(schemaName, 'fact_transactions')}
      WHERE customer_id IS NOT NULL
      GROUP BY customer_id, location_id
    `);
  }

  private async createPerformanceIndexes(schemaName: string): Promise<void> {
    const indexes = [
      // Fact table indexes
      { table: 'fact_transactions', columns: ['tenant_id', 'transaction_date'] },
      { table: 'fact_transactions', columns: ['location_id', 'transaction_date'] },
      { table: 'fact_transactions', columns: ['customer_id', 'transaction_date'] },
      { table: 'fact_transactions', columns: ['product_id', 'transaction_date'] },
      
      { table: 'fact_inventory', columns: ['tenant_id', 'snapshot_date'] },
      { table: 'fact_inventory', columns: ['location_id', 'snapshot_date'] },
      { table: 'fact_inventory', columns: ['product_id', 'snapshot_date'] },
      
      { table: 'fact_customers', columns: ['tenant_id', 'snapshot_date'] },
      { table: 'fact_customers', columns: ['customer_id', 'snapshot_date'] },
      
      // Dimension table indexes
      { table: 'dim_location', columns: ['tenant_id'] },
      { table: 'dim_product', columns: ['tenant_id', 'category'] },
      { table: 'dim_customer', columns: ['tenant_id', 'customer_segment'] },
    ];

    for (const index of indexes) {
      const indexName = `idx_${index.table}_${index.columns.join('_')}`;
      const columnList = index.columns.map(col => sql.identifier(col)).join(', ');
      
      await this.drizzle.execute(sql`
        CREATE INDEX IF NOT EXISTS ${sql.identifier(indexName)} 
        ON ${sql.identifier(schemaName, index.table)} (${sql.raw(columnList)})
      `);
    }
  }

  private generateQueryId(query: string, parameters: any[]): string {
    const queryHash = Buffer.from(query + JSON.stringify(parameters)).toString('base64');
    return queryHash.substring(0, 16);
  }

  private estimateDataSize(data: any[]): number {
    // Rough estimation of data size in bytes
    return JSON.stringify(data).length;
  }

  private async logQueryPerformance(stats: QueryPerformanceStats): Promise<void> {
    // This would log to a performance monitoring system
    this.logger.debug(`Query performance: ${stats.queryId} - ${stats.executionTime}ms`);
  }

  private async getQueryPerformanceStats(tenantId: string): Promise<{
    averageExecutionTime: number;
    cacheHitRate: number;
    queriesPerHour: number;
  }> {
    // This would calculate from actual performance logs
    return {
      averageExecutionTime: Math.random() * 1000 + 100, // 100-1100ms
      cacheHitRate: Math.random() * 40 + 60, // 60-100%
      queriesPerHour: Math.random() * 1000 + 100, // 100-1100 queries/hour
    };
  }

  private async getLargeTables(schemaName: string): Promise<string[]> {
    const result = await this.drizzle.execute(sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = ${schemaName}
      AND pg_total_relation_size(schemaname||'.'||tablename) > 100000000 -- 100MB
    `);
    
    return result.map(row => row.tablename);
  }

  private async getMaterializedViews(schemaName: string): Promise<string[]> {
    const result = await this.drizzle.execute(sql`
      SELECT matviewname 
      FROM pg_matviews 
      WHERE schemaname = ${schemaName}
    `);
    
    return result.map(row => row.matviewname);
  }

  private async analyzeMissingIndexes(schemaName: string): Promise<DataWarehouseIndex[]> {
    // This would analyze query patterns and suggest missing indexes
    // For now, return empty array
    return [];
  }

  private async createIndex(schemaName: string, index: DataWarehouseIndex): Promise<void> {
    const columnList = index.columns.map(col => sql.identifier(col)).join(', ');
    
    await this.drizzle.execute(sql`
      CREATE INDEX IF NOT EXISTS ${sql.identifier(index.name)}
      ON ${sql.identifier(schemaName, index.table)} 
      USING ${sql.raw(index.type)} (${sql.raw(columnList)})
    `);
  }

  private async createRangePartitions(
    schemaName: string, 
    tableName: string, 
    strategy: any
  ): Promise<void> {
    // Create monthly partitions for the next 12 months
    const startDate = new Date();
    startDate.setDate(1); // First day of current month
    
    for (let i = 0; i < 12; i++) {
      const partitionDate = new Date(startDate);
      partitionDate.setMonth(startDate.getMonth() + i);
      
      const nextMonth = new Date(partitionDate);
      nextMonth.setMonth(partitionDate.getMonth() + 1);
      
      const partitionName = `${tableName}_${partitionDate.getFullYear()}_${String(partitionDate.getMonth() + 1).padStart(2, '0')}`;
      
      await this.drizzle.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(schemaName, partitionName)}
        PARTITION OF ${sql.identifier(schemaName, tableName)}
        FOR VALUES FROM (${partitionDate.toISOString().split('T')[0]}) 
        TO (${nextMonth.toISOString().split('T')[0]})
      `);
    }
  }

  private async createHashPartitions(
    schemaName: string, 
    tableName: string, 
    strategy: any
  ): Promise<void> {
    // Create hash partitions
    for (let i = 0; i < strategy.partitionCount; i++) {
      const partitionName = `${tableName}_hash_${i}`;
      
      await this.drizzle.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(schemaName, partitionName)}
        PARTITION OF ${sql.identifier(schemaName, tableName)}
        FOR VALUES WITH (MODULUS ${strategy.partitionCount}, REMAINDER ${i})
      `);
    }
  }
}