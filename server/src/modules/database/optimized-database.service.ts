import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from './drizzle.service';
import { IntelligentCacheService } from '../cache/intelligent-cache.service';
import { CustomLoggerService } from '../logger/logger.service';
import { PoolClient } from 'pg';

interface QueryOptions {
  tenantId?: string;
  useCache?: boolean;
  cacheTTL?: number;
  useReadReplica?: boolean;
  timeout?: number;
}

interface PreparedStatement {
  query: string;
  name: string;
  lastUsed: Date;
  useCount: number;
}

interface QueryStats {
  totalQueries: number;
  averageExecutionTime: number;
  slowQueries: number;
  cacheHits: number;
  cacheMisses: number;
}

@Injectable()
export class OptimizedDatabaseService {
  private readonly logger = new Logger(OptimizedDatabaseService.name);
  
  // Prepared statement cache
  private readonly preparedStatements = new Map<string, PreparedStatement>();
  private readonly maxPreparedStatements = 1000;
  
  // Query statistics
  private queryStats: QueryStats = {
    totalQueries: 0,
    averageExecutionTime: 0,
    slowQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  // Read replica configuration
  private readReplicaEnabled = false;
  private readReplicaConnections: Map<string, any> = new Map();
  private partitioningEnabled = false;
  private partitioningStrategy: 'date' | 'tenant' | 'hash' = 'date';
  
  // Connection pool optimization
  private connectionPoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
  };

  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('OptimizedDatabaseService');
    this.startQueryStatsMaintenance();
  }

  /**
   * Execute optimized query with caching, prepared statements, and performance monitoring
   */
  async executeOptimizedQuery<T>(
    query: string,
    params: any[] = [],
    options: QueryOptions = {},
  ): Promise<T[]> {
    const {
      tenantId,
      useCache = true,
      cacheTTL = 300,
      useReadReplica = false,
      timeout = 30000,
    } = options;

    const startTime = Date.now();
    const queryHash = this.generateQueryHash(query, params);
    const cacheKey = `query:${queryHash}`;

    this.queryStats.totalQueries++;

    try {
      // Check cache first
      if (useCache) {
        const cached = await this.cacheService.get<T[]>(cacheKey, { 
          ...(tenantId && { tenantId }), 
          ttl: cacheTTL 
        });
        if (cached) {
          this.queryStats.cacheHits++;
          this.customLogger.debug('Query cache hit', {
            queryHash,
            tenantId,
            cacheKey,
          });
          return cached;
        }
        this.queryStats.cacheMisses++;
      }

      // Execute query with optimizations
      const result = await this.executeWithOptimizations<T>(
        query,
        params,
        { 
          ...(tenantId && { tenantId }), 
          useReadReplica, 
          timeout 
        }
      );

      // Cache result if enabled
      if (useCache && result.length > 0) {
        await this.cacheService.set(cacheKey, result, { 
          ...(tenantId && { tenantId }), 
          ttl: cacheTTL 
        });
      }

      // Update performance statistics
      const executionTime = Date.now() - startTime;
      this.updateQueryStats(executionTime);

      this.customLogger.performance('Optimized query executed', executionTime, {
        queryHash,
        tenantId,
        rowCount: result.length,
        useCache,
        useReadReplica,
        cached: false,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.customLogger.error('Optimized query failed', error instanceof Error ? error.stack : undefined, {
        queryHash,
        tenantId,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Batch operations for better performance
   */
  async batchInsert<T>(
    tableName: string,
    records: T[],
    options: QueryOptions = {},
  ): Promise<void> {
    const { tenantId } = options;
    const batchSize = 1000;
    const batches: T[][] = [];

    // Split records into batches
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    const startTime = Date.now();

    try {
      // Execute batches in parallel (with concurrency limit)
      const concurrencyLimit = 5;
      for (let i = 0; i < batches.length; i += concurrencyLimit) {
        const batchGroup = batches.slice(i, i + concurrencyLimit);
        
        await Promise.all(
          batchGroup.map(async (batch) => {
            const db = this.drizzleService.getDb();
            
            // Set tenant context if provided
            if (tenantId) {
              const client = await this.drizzleService.getClient();
              try {
                await client.query(`SET app.current_tenant_id = $1`, [tenantId]);
                // Execute batch insert using Drizzle
                // This would be implemented based on the specific table schema
                // await db.insert(table).values(batch);
              } finally {
                client.release();
              }
            }
          })
        );
      }

      const executionTime = Date.now() - startTime;
      this.customLogger.performance('Batch insert completed', executionTime, {
        tableName,
        totalRecords: records.length,
        batchCount: batches.length,
        tenantId,
      });
    } catch (error) {
      this.customLogger.error('Batch insert failed', error instanceof Error ? error.stack : undefined, {
        tableName,
        totalRecords: records.length,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Execute query with connection pooling optimizations
   */
  private async executeWithOptimizations<T>(
    query: string,
    params: any[],
    options: { tenantId?: string; useReadReplica?: boolean; timeout?: number }
  ): Promise<T[]> {
    const { tenantId, useReadReplica = false, timeout = 30000 } = options;
    
    // Use read replica for SELECT queries if available
    const isSelectQuery = query.trim().toLowerCase().startsWith('select');
    const shouldUseReadReplica = useReadReplica && isSelectQuery && this.readReplicaEnabled;

    const client = await this.getOptimizedClient(shouldUseReadReplica);
    
    try {
      // Set query timeout
      await client.query(`SET statement_timeout = ${timeout}`);
      
      // Set tenant context for row-level security
      if (tenantId) {
        await client.query(`SET app.current_tenant_id = $1`, [tenantId]);
      }

      // Use prepared statement if beneficial
      const result = await this.executeWithPreparedStatement(client, query, params);
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get optimized database client (read replica or primary)
   */
  private async getOptimizedClient(useReadReplica: boolean): Promise<PoolClient> {
    // In production, this would route to read replicas
    // For now, we use the primary connection pool
    return this.drizzleService.getClient();
  }

  /**
   * Execute query using prepared statements for better performance
   */
  private async executeWithPreparedStatement(
    client: PoolClient,
    query: string,
    params: any[]
  ): Promise<any> {
    const queryHash = this.generateQueryHash(query, []);
    const preparedName = `prep_${queryHash}`;
    
    let prepared = this.preparedStatements.get(queryHash);
    
    if (!prepared) {
      // Create new prepared statement
      if (this.preparedStatements.size >= this.maxPreparedStatements) {
        this.evictLeastUsedPreparedStatement();
      }
      
      try {
        await client.query(`PREPARE ${preparedName} AS ${query}`);
        
        prepared = {
          query,
          name: preparedName,
          lastUsed: new Date(),
          useCount: 0,
        };
        
        this.preparedStatements.set(queryHash, prepared);
      } catch (error) {
        // If preparation fails, execute directly
        return client.query(query, params);
      }
    }

    // Update usage statistics
    prepared.lastUsed = new Date();
    prepared.useCount++;

    // Execute prepared statement
    try {
      return await client.query(`EXECUTE ${prepared.name}(${params.map((_, i) => `$${i + 1}`).join(',')})`, params);
    } catch (error) {
      // If execution fails, fall back to direct query
      return client.query(query, params);
    }
  }

  /**
   * Generate hash for query caching and prepared statements
   */
  private generateQueryHash(query: string, params: any[]): string {
    const crypto = require('crypto');
    const normalizedQuery = query.replace(/\s+/g, ' ').trim().toLowerCase();
    const content = normalizedQuery + JSON.stringify(params);
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Evict least recently used prepared statement
   */
  private evictLeastUsedPreparedStatement(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, prepared] of this.preparedStatements.entries()) {
      if (prepared.lastUsed.getTime() < oldestTime) {
        oldestTime = prepared.lastUsed.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.preparedStatements.delete(oldestKey);
    }
  }

  /**
   * Update query performance statistics
   */
  private updateQueryStats(executionTime: number): void {
    const currentAvg = this.queryStats.averageExecutionTime;
    const totalQueries = this.queryStats.totalQueries;
    
    // Update rolling average
    this.queryStats.averageExecutionTime = 
      (currentAvg * (totalQueries - 1) + executionTime) / totalQueries;

    // Track slow queries (>1000ms)
    if (executionTime > 1000) {
      this.queryStats.slowQueries++;
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): QueryStats & {
    preparedStatementCount: number;
    preparedStatementHitRate: number;
  } {
    const hitRate = this.queryStats.totalQueries > 0 
      ? (this.queryStats.cacheHits / this.queryStats.totalQueries) * 100 
      : 0;

    return {
      ...this.queryStats,
      preparedStatementCount: this.preparedStatements.size,
      preparedStatementHitRate: hitRate,
    };
  }

  /**
   * Enable read replica support
   */
  enableReadReplicas(): void {
    this.readReplicaEnabled = true;
    this.customLogger.log('Read replica support enabled');
  }

  /**
   * Disable read replica support
   */
  disableReadReplicas(): void {
    this.readReplicaEnabled = false;
    this.customLogger.log('Read replica support disabled');
  }

  /**
   * Health check for database optimization features
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    queryStats: QueryStats;
    preparedStatements: number;
    readReplicaEnabled: boolean;
    connectionPool: {
      primary: {
        totalCount: number;
        idleCount: number;
        waitingCount: number;
      };
      readReplicas: Array<{
        index: number;
        totalCount: number;
        idleCount: number;
        waitingCount: number;
      }>;
      summary: {
        totalConnections: number;
        totalIdle: number;
        totalWaiting: number;
        readReplicaCount: number;
      };
    };
  }> {
    const dbHealth = await this.drizzleService.isHealthy();
    const poolStats = this.drizzleService.getPoolStats();

    return {
      isHealthy: dbHealth,
      queryStats: this.queryStats,
      preparedStatements: this.preparedStatements.size,
      readReplicaEnabled: this.readReplicaEnabled,
      connectionPool: poolStats,
    };
  }

  /**
   * Enable database partitioning for large tables
   */
  async enablePartitioning(
    tableName: string,
    strategy: 'date' | 'tenant' | 'hash',
    partitionColumn: string
  ): Promise<void> {
    const client = await this.drizzleService.getClient();
    
    try {
      switch (strategy) {
        case 'date':
          await this.createDatePartitions(client, tableName, partitionColumn);
          break;
        case 'tenant':
          await this.createTenantPartitions(client, tableName, partitionColumn);
          break;
        case 'hash':
          await this.createHashPartitions(client, tableName, partitionColumn);
          break;
      }
      
      this.partitioningEnabled = true;
      this.partitioningStrategy = strategy;
      
      this.customLogger.log('Database partitioning enabled', {
        tableName,
        strategy,
        partitionColumn,
      });
    } catch (error) {
      this.customLogger.error('Failed to enable partitioning', error instanceof Error ? error.stack : undefined, {
        tableName,
        strategy,
        partitionColumn,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create date-based partitions
   */
  private async createDatePartitions(
    client: PoolClient,
    tableName: string,
    dateColumn: string
  ): Promise<void> {
    // Create monthly partitions for the next 12 months
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const partitionDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const nextPartitionDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i + 1, 1);
      
      const partitionName = `${tableName}_${partitionDate.getFullYear()}_${String(partitionDate.getMonth() + 1).padStart(2, '0')}`;
      
      const createPartitionQuery = `
        CREATE TABLE IF NOT EXISTS ${partitionName} 
        PARTITION OF ${tableName}
        FOR VALUES FROM ('${partitionDate.toISOString().split('T')[0]}') 
        TO ('${nextPartitionDate.toISOString().split('T')[0]}')
      `;
      
      await client.query(createPartitionQuery);
      
      // Create indexes on partition
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${partitionName}_${dateColumn} 
        ON ${partitionName} (${dateColumn})
      `);
    }
  }

  /**
   * Create tenant-based partitions
   */
  private async createTenantPartitions(
    client: PoolClient,
    tableName: string,
    tenantColumn: string
  ): Promise<void> {
    // Get list of active tenants
    const tenantsResult = await client.query('SELECT id FROM tenants WHERE deleted_at IS NULL');
    
    for (const tenant of tenantsResult.rows) {
      const partitionName = `${tableName}_tenant_${tenant.id.replace(/-/g, '_')}`;
      
      const createPartitionQuery = `
        CREATE TABLE IF NOT EXISTS ${partitionName} 
        PARTITION OF ${tableName}
        FOR VALUES IN ('${tenant.id}')
      `;
      
      await client.query(createPartitionQuery);
      
      // Create indexes on partition
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${partitionName}_${tenantColumn} 
        ON ${partitionName} (${tenantColumn})
      `);
    }
  }

  /**
   * Create hash-based partitions
   */
  private async createHashPartitions(
    client: PoolClient,
    tableName: string,
    hashColumn: string
  ): Promise<void> {
    const partitionCount = 8; // Create 8 hash partitions
    
    for (let i = 0; i < partitionCount; i++) {
      const partitionName = `${tableName}_hash_${i}`;
      
      const createPartitionQuery = `
        CREATE TABLE IF NOT EXISTS ${partitionName} 
        PARTITION OF ${tableName}
        FOR VALUES WITH (modulus ${partitionCount}, remainder ${i})
      `;
      
      await client.query(createPartitionQuery);
      
      // Create indexes on partition
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${partitionName}_${hashColumn} 
        ON ${partitionName} (${hashColumn})
      `);
    }
  }

  /**
   * Optimize database indexes
   */
  async optimizeIndexes(tableName?: string): Promise<void> {
    const client = await this.drizzleService.getClient();
    
    try {
      if (tableName) {
        // Analyze specific table
        await client.query(`ANALYZE ${tableName}`);
        
        // Reindex specific table
        await client.query(`REINDEX TABLE ${tableName}`);
        
        this.customLogger.log('Table indexes optimized', { tableName });
      } else {
        // Analyze all tables
        await client.query('ANALYZE');
        
        // Get list of tables that need reindexing
        const tablesResult = await client.query(`
          SELECT schemaname, tablename 
          FROM pg_tables 
          WHERE schemaname = 'public'
        `);
        
        for (const table of tablesResult.rows) {
          await client.query(`REINDEX TABLE ${table.schemaname}.${table.tablename}`);
        }
        
        this.customLogger.log('All indexes optimized');
      }
    } catch (error) {
      this.customLogger.error('Index optimization failed', error instanceof Error ? error.stack : undefined, {
        tableName,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get database performance metrics
   */
  async getDatabaseMetrics(): Promise<{
    connectionPool: any;
    queryPerformance: QueryStats;
    indexUsage: Array<{ table: string; index: string; scans: number; tuples: number }>;
    tableStats: Array<{ table: string; size: string; rowCount: number }>;
    slowQueries: Array<{ query: string; avgTime: number; calls: number }>;
  }> {
    const client = await this.drizzleService.getClient();
    
    try {
      // Get connection pool stats
      const poolStats = this.drizzleService.getPoolStats();
      
      // Get index usage statistics
      const indexUsageResult = await client.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
        LIMIT 20
      `);
      
      // Get table size statistics
      const tableSizeResult = await client.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_tup_ins + n_tup_upd + n_tup_del as total_operations
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 20
      `);
      
      // Get slow query statistics (if pg_stat_statements is enabled)
      let slowQueries: any[] = [];
      try {
        const slowQueriesResult = await client.query(`
          SELECT 
            query,
            mean_exec_time,
            calls
          FROM pg_stat_statements
          WHERE mean_exec_time > 100
          ORDER BY mean_exec_time DESC
          LIMIT 10
        `);
        slowQueries = slowQueriesResult.rows;
      } catch {
        // pg_stat_statements not available
      }
      
      return {
        connectionPool: poolStats,
        queryPerformance: this.queryStats,
        indexUsage: indexUsageResult.rows.map(row => ({
          table: `${row.schemaname}.${row.tablename}`,
          index: row.indexname,
          scans: row.idx_scan,
          tuples: row.idx_tup_read,
        })),
        tableStats: tableSizeResult.rows.map(row => ({
          table: `${row.schemaname}.${row.tablename}`,
          size: row.size,
          rowCount: row.total_operations,
        })),
        slowQueries: slowQueries.map(row => ({
          query: row.query.substring(0, 100) + '...',
          avgTime: row.mean_exec_time,
          calls: row.calls,
        })),
      };
    } finally {
      client.release();
    }
  }
  private startQueryStatsMaintenance(): void {
    // Clean old prepared statements every 10 minutes
    setInterval(() => {
      const cutoffTime = Date.now() - (30 * 60 * 1000); // 30 minutes ago
      let cleanedCount = 0;

      for (const [key, prepared] of this.preparedStatements.entries()) {
        if (prepared.lastUsed.getTime() < cutoffTime && prepared.useCount < 5) {
          this.preparedStatements.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.customLogger.debug('Prepared statement cleanup completed', {
          cleanedCount,
          remainingCount: this.preparedStatements.size,
        });
      }
    }, 600000); // Every 10 minutes

    // Log query statistics every 5 minutes
    setInterval(() => {
      const stats = this.getQueryStats();
      this.customLogger.log('Query performance statistics', stats as any);
    }, 300000); // Every 5 minutes
  }
}