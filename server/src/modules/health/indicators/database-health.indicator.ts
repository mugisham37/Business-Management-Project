import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly databaseService: DatabaseService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const healthStatus = await this.databaseService.getHealthStatus();
      
      const result = this.getStatus(key, healthStatus.isHealthy, {
        database: 'postgresql',
        status: healthStatus.isHealthy ? 'up' : 'down',
        poolStats: healthStatus.poolStats,
      });

      if (healthStatus.isHealthy) {
        return result;
      }
      
      throw new HealthCheckError('Database health check failed', result);
    } catch (error) {
      throw new HealthCheckError('Database health check failed', this.getStatus(key, false, {
        database: 'postgresql',
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }
}