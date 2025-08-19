import pidusage from 'pidusage';
import * as si from 'systeminformation';
import { cpuUsage, eventLoopLag, memoryUsage } from './metrics';
import { PerformanceMetrics } from './types';

export class PerformanceMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  public start(intervalMs: number = 30000): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error collecting performance metrics:', error);
      }
    }, intervalMs);

    console.log(`Performance monitoring started for ${this.serviceName}`);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`Performance monitoring stopped for ${this.serviceName}`);
    }
  }

  public async collectMetrics(): Promise<PerformanceMetrics> {
    const [processStats, systemInfo, memInfo] = await Promise.all([
      this.getProcessStats(),
      this.getSystemInfo(),
      this.getMemoryInfo(),
    ]);

    const metrics: PerformanceMetrics = {
      cpu: {
        usage: processStats.cpu,
        loadAverage: systemInfo.load ? [systemInfo.load.avgLoad] : [0],
      },
      memory: {
        used: processStats.memory,
        total: memInfo.total,
        percentage: (processStats.memory / memInfo.total) * 100,
        heap: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
        },
      },
      database: {
        connections: {
          active: 0, // Will be updated by database package
          idle: 0,
          total: 0,
        },
        queries: {
          total: 0, // Will be updated by database package
          slow: 0,
          failed: 0,
        },
        responseTime: {
          avg: 0,
          p95: 0,
          p99: 0,
        },
      },
      cache: {
        hits: 0, // Will be updated by cache package
        misses: 0,
        hitRate: 0,
        memory: 0,
        keys: 0,
      },
      http: {
        requests: {
          total: 0, // Will be updated by HTTP middleware
          active: 0,
          failed: 0,
        },
        responseTime: {
          avg: 0,
          p95: 0,
          p99: 0,
        },
      },
    };

    // Update Prometheus metrics
    this.updatePrometheusMetrics(metrics);

    return metrics;
  }

  private async getProcessStats(): Promise<{ cpu: number; memory: number }> {
    try {
      const stats = await pidusage(process.pid);
      return {
        cpu: stats.cpu,
        memory: stats.memory,
      };
    } catch (error) {
      console.error('Error getting process stats:', error);
      return { cpu: 0, memory: 0 };
    }
  }

  private async getSystemInfo(): Promise<any> {
    try {
      return await si.currentLoad();
    } catch (error) {
      console.error('Error getting system info:', error);
      return { load: { avgLoad: 0 } };
    }
  }

  private async getMemoryInfo(): Promise<{ total: number; available: number }> {
    try {
      const mem = await si.mem();
      return {
        total: mem.total,
        available: mem.available,
      };
    } catch (error) {
      console.error('Error getting memory info:', error);
      return { total: 0, available: 0 };
    }
  }

  private updatePrometheusMetrics(metrics: PerformanceMetrics): void {
    // Update CPU metrics
    cpuUsage.set({ service: this.serviceName }, metrics.cpu.usage);

    // Update memory metrics
    memoryUsage.set({ type: 'used', service: this.serviceName }, metrics.memory.used);
    memoryUsage.set({ type: 'heap_used', service: this.serviceName }, metrics.memory.heap.used);
    memoryUsage.set({ type: 'heap_total', service: this.serviceName }, metrics.memory.heap.total);
  }

  public measureEventLoopLag(): void {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e9;
      eventLoopLag.observe({ service: this.serviceName }, lag);
    });
  }
}

// Utility functions for performance measurement
export function measureExecutionTime<T>(fn: () => Promise<T>, metricName: string): Promise<T> {
  const start = Date.now();

  return fn().finally(() => {
    const duration = (Date.now() - start) / 1000;
    // Log or record the duration
    console.log(`${metricName} execution time: ${duration}s`);
  });
}

export function createPerformanceTimer() {
  const start = process.hrtime.bigint();

  return {
    end: () => {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1e9; // Convert to seconds
    },
  };
}
