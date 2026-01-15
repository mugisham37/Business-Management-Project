import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from './drizzle.service';
import { CustomLoggerService } from '../logger/logger.service';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly customLogger: CustomLoggerService,
  ) {
    this.customLogger.setContext('DatabaseService');
  }

  // Get Drizzle database instance for ORM operations
  getDatabase() {
    return this.drizzleService.getDb();
  }

  // Get read replica database instance for read operations
  getReadDatabase() {
    return this.drizzleService.getReadReplicaDb();
  }

  async executeTransaction<T>(
    callback: (tx: any) => Promise<T>,
    tenantId?: string,
  ): Promise<T> {
    const db = this.drizzleService.getDb();
    
    return db.transaction(async (tx) => {
      try {
        // Set tenant context for row-level security
        if (tenantId) {
          await tx.execute(`SET app.current_tenant_id = '${tenantId}'`);
        }

        const result = await callback(tx);
        
        this.customLogger.log('Transaction completed successfully', {
          tenantId,
          operation: 'transaction',
        });
        
        return result;
      } catch (error) {
        this.customLogger.error('Transaction failed', error instanceof Error ? error.stack : undefined, {
          tenantId,
          operation: 'transaction',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });
  }

  async executeQuery<T>(
    query: string,
    params: unknown[] = [],
    tenantId?: string,
  ): Promise<T[]> {
    const client = await this.drizzleService.getClient();
    
    try {
      // Set tenant context for row-level security
      if (tenantId) {
        await client.query(`SET app.current_tenant_id = $1`, [tenantId]);
      }

      const startTime = Date.now();
      const result = await client.query(query, params);
      const duration = Date.now() - startTime;

      this.customLogger.performance('Database query executed', duration, {
        tenantId,
        query: query.substring(0, 100), // Log first 100 chars of query
        rowCount: result.rowCount,
      });

      return result.rows;
    } catch (error) {
      this.customLogger.error('Database query failed', error instanceof Error ? error.stack : undefined, {
        tenantId,
        query: query.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    poolStats: {
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
    const isHealthy = await this.drizzleService.isHealthy();
    const poolStats = this.drizzleService.getPoolStats();

    return {
      isHealthy,
      poolStats,
    };
  }

  // Utility method to set tenant context
  async setTenantContext(tenantId: string): Promise<void> {
    const client = await this.drizzleService.getClient();
    try {
      await client.query(`SET app.current_tenant_id = $1`, [tenantId]);
    } finally {
      client.release();
    }
  }

  // Utility method to clear tenant context
  async clearTenantContext(): Promise<void> {
    const client = await this.drizzleService.getClient();
    try {
      await client.query(`RESET app.current_tenant_id`);
    } finally {
      client.release();
    }
  }
}