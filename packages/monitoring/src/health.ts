import { HealthCheckResult } from './types';

export class HealthCheckService {
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();

  public registerCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFn);
  }

  public async runCheck(name: string): Promise<HealthCheckResult> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      throw new Error(`Health check '${name}' not found`);
    }

    try {
      const result = await checkFn();
      this.results.set(name, result);
      return result;
    } catch (error) {
      const errorResult: HealthCheckResult = {
        name,
        status: 'unhealthy',
        responseTime: 0,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date(),
      };
      this.results.set(name, errorResult);
      return errorResult;
    }
  }

  public async runAllChecks(): Promise<HealthCheckResult[]> {
    const promises = Array.from(this.checks.keys()).map(name => this.runCheck(name));
    return Promise.all(promises);
  }

  public getLastResult(name: string): HealthCheckResult | undefined {
    return this.results.get(name);
  }

  public getAllResults(): HealthCheckResult[] {
    return Array.from(this.results.values());
  }

  public getOverallStatus(): 'healthy' | 'unhealthy' | 'degraded' {
    const results = this.getAllResults();
    if (results.length === 0) return 'unhealthy';

    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;

    if (unhealthyCount > 0) return 'unhealthy';
    if (degradedCount > 0) return 'degraded';
    return 'healthy';
  }
}

// Common health check implementations
export class CommonHealthChecks {
  static async databaseCheck(dbClient: any): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Try a simple query
      await dbClient.raw('SELECT 1');
      return {
        name: 'database',
        status: 'healthy',
        responseTime: Date.now() - start,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error instanceof Error ? error.message : 'Database connection failed' },
        timestamp: new Date(),
      };
    }
  }

  static async redisCheck(redisClient: any): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await redisClient.ping();
      return {
        name: 'redis',
        status: 'healthy',
        responseTime: Date.now() - start,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error instanceof Error ? error.message : 'Redis connection failed' },
        timestamp: new Date(),
      };
    }
  }

  static async memoryCheck(thresholdPercent: number = 90): Promise<HealthCheckResult> {
    const start = Date.now();
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const usagePercent = (usedMemory / totalMemory) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (usagePercent > thresholdPercent) {
      status = 'unhealthy';
    } else if (usagePercent > thresholdPercent * 0.8) {
      status = 'degraded';
    }

    return {
      name: 'memory',
      status,
      responseTime: Date.now() - start,
      details: {
        usagePercent: Math.round(usagePercent * 100) / 100,
        usedMemory,
        totalMemory,
        threshold: thresholdPercent,
      },
      timestamp: new Date(),
    };
  }

  static async diskSpaceCheck(
    path: string = '/',
    thresholdPercent: number = 90
  ): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const fs = require('fs');
      const stats = await fs.promises.statvfs?.(path);

      if (!stats) {
        // Fallback for systems without statvfs
        return {
          name: 'disk_space',
          status: 'healthy',
          responseTime: Date.now() - start,
          details: { message: 'Disk space check not available on this system' },
          timestamp: new Date(),
        };
      }

      const total = stats.blocks * stats.frsize;
      const free = stats.bavail * stats.frsize;
      const used = total - free;
      const usagePercent = (used / total) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (usagePercent > thresholdPercent) {
        status = 'unhealthy';
      } else if (usagePercent > thresholdPercent * 0.8) {
        status = 'degraded';
      }

      return {
        name: 'disk_space',
        status,
        responseTime: Date.now() - start,
        details: {
          usagePercent: Math.round(usagePercent * 100) / 100,
          used,
          total,
          free,
          threshold: thresholdPercent,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        name: 'disk_space',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: { error: error instanceof Error ? error.message : 'Disk space check failed' },
        timestamp: new Date(),
      };
    }
  }
}
