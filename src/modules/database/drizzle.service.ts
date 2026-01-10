import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema';

// Type alias for the database instance
export type DrizzleDB = NodePgDatabase<typeof schema>;

// Injection token
export const DRIZZLE_TOKEN = 'DRIZZLE_DB';

// Decorator for injecting Drizzle database instance
export const InjectDrizzle = () => Inject(DRIZZLE_TOKEN);

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private pool: Pool | null = null;
  private db: NodePgDatabase<typeof schema> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async initialize(): Promise<void> {
    try {
      const databaseConfig = this.configService.get('database');
      
      if (!databaseConfig) {
        throw new Error('Database configuration not found');
      }

      // Create connection pool
      this.pool = new Pool({
        connectionString: databaseConfig.url,
        min: databaseConfig.poolMin,
        max: databaseConfig.poolMax,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Initialize Drizzle
      this.db = drizzle(this.pool, { schema });

      // Test connection
      await this.testConnection();

      this.logger.log('Database connection established successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database connection', error);
      throw error;
    }
  }

  getDb(): NodePgDatabase<typeof schema> {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool.connect();
  }

  async testConnection(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      this.logger.log(`Database connection test successful: ${result.rows[0]?.now}`);
    } finally {
      client.release();
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
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Database connection pool closed');
    }
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false;
      }

      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  }

  // Get connection pool stats
  getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    if (!this.pool) {
      return { totalCount: 0, idleCount: 0, waitingCount: 0 };
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}