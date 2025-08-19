import { CommonHealthChecks, HealthCheckService } from './health';
import { metricsRegistry } from './metrics';
import { PerformanceMonitor } from './performance';
import { initializeTracing, startTracing } from './tracing';
import { MonitoringConfig } from './types';

export class ApplicationMonitor {
  private performanceMonitor: PerformanceMonitor;
  private healthCheckService: HealthCheckService;
  private config: MonitoringConfig;
  private isInitialized: boolean = false;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.performanceMonitor = new PerformanceMonitor(config.tracing.serviceName);
    this.healthCheckService = new HealthCheckService();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(`Initializing monitoring for ${this.config.tracing.serviceName}...`);

    // Initialize tracing if enabled
    if (this.config.tracing) {
      initializeTracing(this.config.tracing);
      startTracing();
    }

    // Start performance monitoring if enabled
    if (this.config.performance.enabled) {
      this.performanceMonitor.start(this.config.performance.interval);
    }

    // Register default health checks if enabled
    if (this.config.healthChecks.enabled) {
      this.registerDefaultHealthChecks();
    }

    this.isInitialized = true;
    console.log(`Monitoring initialized successfully for ${this.config.tracing.serviceName}`);
  }

  public async shutdown(): Promise<void> {
    console.log(`Shutting down monitoring for ${this.config.tracing.serviceName}...`);

    this.performanceMonitor.stop();

    // Stop tracing
    const { stopTracing } = require('./tracing');
    await stopTracing();

    this.isInitialized = false;
    console.log('Monitoring shutdown complete');
  }

  public async getMetricsEndpoint(): Promise<string> {
    return await metricsRegistry.metrics();
  }

  public async getHealthStatus(): Promise<any> {
    const results = await this.healthCheckService.runAllChecks();
    const overallStatus = this.healthCheckService.getOverallStatus();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: this.config.tracing.serviceName,
      version: this.config.tracing.serviceVersion,
      checks: results,
    };
  }

  public registerHealthCheck(name: string, checkFn: () => Promise<any>): void {
    this.healthCheckService.registerCheck(name, checkFn);
  }

  public async getPerformanceMetrics(): Promise<any> {
    return await this.performanceMonitor.collectMetrics();
  }

  private registerDefaultHealthChecks(): void {
    // Memory health check
    this.healthCheckService.registerCheck('memory', () =>
      CommonHealthChecks.memoryCheck(this.config.performance.thresholds.memory)
    );

    // Disk space health check
    this.healthCheckService.registerCheck('disk_space', () =>
      CommonHealthChecks.diskSpaceCheck('/', 90)
    );
  }

  // Static factory method for easy initialization
  static create(
    serviceName: string,
    serviceVersion: string,
    environment: string
  ): ApplicationMonitor {
    const config: MonitoringConfig = {
      enabled: true,
      metrics: {
        enabled: true,
        port: 9090,
        path: '/metrics',
      },
      tracing: {
        serviceName,
        serviceVersion,
        environment,
        jaegerEndpoint: process.env.JAEGER_ENDPOINT || undefined,
        samplingRate: parseFloat(process.env.TRACING_SAMPLING_RATE || '0.1'),
      },
      healthChecks: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
      },
      performance: {
        enabled: true,
        interval: 30000,
        thresholds: {
          cpu: 80,
          memory: 85,
          responseTime: 2000,
        },
      },
    };

    return new ApplicationMonitor(config);
  }
}

// Export singleton instance for easy use
let globalMonitor: ApplicationMonitor | null = null;

export function getGlobalMonitor(): ApplicationMonitor | null {
  return globalMonitor;
}

export function initializeGlobalMonitor(
  serviceName: string,
  serviceVersion: string,
  environment: string
): ApplicationMonitor {
  if (!globalMonitor) {
    globalMonitor = ApplicationMonitor.create(serviceName, serviceVersion, environment);
  }
  return globalMonitor;
}
