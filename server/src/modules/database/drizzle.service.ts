import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema';
import { DatabaseConfig } from '../../config/database.config';

// Type alias for the database instance
export type DrizzleDB = NodePgDatabase<typeof schema>;

// Injection token
export const DRIZZLE_TOKEN = 'DRIZZLE_DB';

// Decorator for injecting Drizzle database instance
export const InjectDrizzle = () => Inject(DRIZZLE_TOKEN);

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private primaryPool: Pool | null = null;
  private readReplicaPools: Pool[] = [];
  public db: NodePgDatabase<typeof schema> | null = null;
  private readReplicaDbs: NodePgDatabase<typeof schema>[] = [];
  private currentReadReplicaIndex = 0;
  private databaseConfig: DatabaseConfig;

  constructor(private readonly configService: ConfigService) {
    this.databaseConfig = this.configService.get<DatabaseConfig>('database')!;
  }

  async initialize(): Promise<void> {
    try {
      if (!this.databaseConfig) {
        throw new Error('Database configuration not found');
      }

      // Initialize primary connection pool
      await this.initializePrimaryPool();
      
      // Initialize read replica pools if enabled
      if (this.databaseConfig.readReplicas.enabled) {
        await this.initializeReadReplicaPools();
      }

      // Test connections
      await this.testConnections();

      this.logger.log('Database connections established successfully', {
        primaryPool: true,
        readReplicas: this.readReplicaPools.length,
        readReplicasEnabled: this.databaseConfig.readReplicas.enabled,
      });
    } catch (error) {
      this.logger.error('Failed to initialize database connections', error);
      throw error;
    }
  }

  private async initializePrimaryPool(): Promise<void> {
    const poolConfig = {
      connectionString: this.databaseConfig.url,
      min: this.databaseConfig.poolMin,
      max: this.databaseConfig.poolMax,
      idleTimeoutMillis: this.databaseConfig.connectionPool.idleTimeoutMillis,
      connectionTimeoutMillis: this.databaseConfig.connectionPool.connectionTimeoutMillis,
      acquireTimeoutMillis: this.databaseConfig.connectionPool.acquireTimeoutMillis,
      maxUses: this.databaseConfig.connectionPool.maxUses,
      allowExitOnIdle: this.databaseConfig.connectionPool.allowExitOnIdle,
      // Additional optimizations
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      application_name: 'unified-business-platform-primary',
    };

    this.primaryPool = new Pool(poolConfig);
    
    // Set up pool event handlers
    this.setupPoolEventHandlers(this.primaryPool, 'primary');
    
    // Initialize Drizzle with primary pool
    this.db = drizzle(this.primaryPool, { schema });
  }

  private async initializeReadReplicaPools(): Promise<void> {
    const { urls, maxConnections } = this.databaseConfig.readReplicas;
    
    if (!urls || urls.length === 0) {
      this.logger.warn('Read replicas enabled but no URLs provided');
      return;
    }

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      
      try {
        const poolConfig = {
          connectionString: url,
          min: Math.ceil(this.databaseConfig.poolMin / urls.length),
          max: Math.ceil(maxConnections / urls.length),
          idleTimeoutMillis: this.databaseConfig.connectionPool.idleTimeoutMillis,
          connectionTimeoutMillis: this.databaseConfig.connectionPool.connectionTimeoutMillis,
          acquireTimeoutMillis: this.databaseConfig.connectionPool.acquireTimeoutMillis,
          maxUses: this.databaseConfig.connectionPool.maxUses,
          allowExitOnIdle: this.databaseConfig.connectionPool.allowExitOnIdle,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
          application_name: `unified-business-platform-replica-${i}`,
        };

        const replicaPool = new Pool(poolConfig);
        this.setupPoolEventHandlers(replicaPool, `replica-${i}`);
        
        this.readReplicaPools.push(replicaPool);
        this.readReplicaDbs.push(drizzle(replicaPool, { schema }));
        
        this.logger.log(`Read replica ${i} initialized successfully`);
      } catch (error) {
        this.logger.error(`Failed to initialize read replica ${i}`, error);
        // Continue with other replicas
      }
    }
  }

  private setupPoolEventHandlers(pool: Pool, poolName: string): void {
    pool.on('connect', (client) => {
      this.logger.debug(`New client connected to ${poolName} pool`);
    });

    pool.on('acquire', (client) => {
      this.logger.debug(`Client acquired from ${poolName} pool`);
    });

    pool.on('error', (err, client) => {
      this.logger.error(`Pool error in ${poolName}`, err);
    });

    pool.on('remove', (client) => {
      this.logger.debug(`Client removed from ${poolName} pool`);
    });
  }

  getDb(): NodePgDatabase<typeof schema> {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  getReadReplicaDb(): NodePgDatabase<typeof schema> {
    if (this.readReplicaDbs.length === 0) {
      // Fall back to primary if no read replicas available
      return this.getDb();
    }

    // Round-robin load balancing
    const db = this.readReplicaDbs[this.currentReadReplicaIndex];
    if (!db) {
      // Fall back to primary if replica is not available
      return this.getDb();
    }
    this.currentReadReplicaIndex = (this.currentReadReplicaIndex + 1) % this.readReplicaDbs.length;
    
    return db;
  }

  getPool(): Pool {
    if (!this.primaryPool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.primaryPool;
  }

  getReadReplicaPool(): Pool {
    if (this.readReplicaPools.length === 0) {
      // Fall back to primary pool if no read replicas available
      return this.getPool();
    }

    // Round-robin load balancing
    const pool = this.readReplicaPools[this.currentReadReplicaIndex];
    if (!pool) {
      // Fall back to primary pool if replica is not available
      return this.getPool();
    }
    this.currentReadReplicaIndex = (this.currentReadReplicaIndex + 1) % this.readReplicaPools.length;
    
    return pool;
  }

  async getClient(useReadReplica: boolean = false): Promise<PoolClient> {
    const pool = useReadReplica ? this.getReadReplicaPool() : this.getPool();
    return pool.connect();
  }

  /**
   * Execute raw SQL query - use for DDL, DML, or when ORM is not suitable
   */
  async executeRawSQL(sql: string, parameters: any[] = [], useReadReplica: boolean = false): Promise<any> {
    const client = await this.getClient(useReadReplica);
    try {
      const result = await client.query(sql, parameters);
      return result;
    } finally {
      client.release();
    }
  }

  async testConnections(): Promise<void> {
    // Test primary connection
    if (this.primaryPool) {
      const client = await this.primaryPool.connect();
      try {
        const result = await client.query('SELECT NOW() as now, version() as version');
        this.logger.log(`Primary database connection test successful`, {
          timestamp: result.rows[0]?.now,
          version: result.rows[0]?.version?.substring(0, 50),
        });
      } finally {
        client.release();
      }
    }

    // Test read replica connections
    for (let i = 0; i < this.readReplicaPools.length; i++) {
      const pool = this.readReplicaPools[i];
      if (!pool) continue;
      
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT NOW() as now');
        this.logger.log(`Read replica ${i} connection test successful`, {
          timestamp: result.rows[0]?.now,
        });
      } catch (error) {
        this.logger.error(`Read replica ${i} connection test failed`, error);
      } finally {
        client.release();
      }
    }
  }

  async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      this.logger.log('Running database migrations...');
      await migrate(this.db, { migrationsFolder: './drizzle' });
      this.logger.log('Database migrations completed successfully');
    } catch (error) {
      this.logger.error('Failed to run database migrations', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    const promises: Promise<void>[] = [];

    // Close primary pool
    if (this.primaryPool) {
      promises.push(this.primaryPool.end());
    }

    // Close read replica pools
    for (const pool of this.readReplicaPools) {
      promises.push(pool.end());
    }

    await Promise.all(promises);
    this.logger.log('All database connection pools closed');
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      // Check primary pool
      if (!this.primaryPool) {
        return false;
      }

      const client = await this.primaryPool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }

      // Check read replicas if enabled
      if (this.readReplicaPools.length > 0) {
        const replicaChecks = this.readReplicaPools.map(async (pool) => {
          const client = await pool.connect();
          try {
            await client.query('SELECT 1');
            return true;
          } catch {
            return false;
          } finally {
            client.release();
          }
        });

        const replicaResults = await Promise.all(replicaChecks);
        const healthyReplicas = replicaResults.filter(Boolean).length;
        
        // At least 50% of replicas should be healthy
        if (healthyReplicas < Math.ceil(this.readReplicaPools.length / 2)) {
          this.logger.warn('Less than 50% of read replicas are healthy', {
            total: this.readReplicaPools.length,
            healthy: healthyReplicas,
          });
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  // Get comprehensive connection pool stats
  getPoolStats(): {
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
  } {
    const primary = this.primaryPool ? {
      totalCount: this.primaryPool.totalCount,
      idleCount: this.primaryPool.idleCount,
      waitingCount: this.primaryPool.waitingCount,
    } : { totalCount: 0, idleCount: 0, waitingCount: 0 };

    const readReplicas = this.readReplicaPools.map((pool, index) => ({
      index,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    }));

    const summary = {
      totalConnections: primary.totalCount + readReplicas.reduce((sum, r) => sum + r.totalCount, 0),
      totalIdle: primary.idleCount + readReplicas.reduce((sum, r) => sum + r.idleCount, 0),
      totalWaiting: primary.waitingCount + readReplicas.reduce((sum, r) => sum + r.waitingCount, 0),
      readReplicaCount: readReplicas.length,
    };

    return { primary, readReplicas, summary };
  }

  // Get database configuration
  getConfig(): DatabaseConfig {
    return this.databaseConfig;
  }

  // Enable/disable read replica usage
  setReadReplicaUsage(enabled: boolean): void {
    if (enabled && this.readReplicaPools.length === 0) {
      this.logger.warn('Cannot enable read replica usage: no read replicas configured');
      return;
    }
    
    this.logger.log(`Read replica usage ${enabled ? 'enabled' : 'disabled'}`);
  }
}