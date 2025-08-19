export interface MetricConfig {
  name: string;
  help: string;
  labelNames?: string[];
}

export interface PerformanceMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heap: {
      used: number;
      total: number;
    };
  };
  database: {
    connections: {
      active: number;
      idle: number;
      total: number;
    };
    queries: {
      total: number;
      slow: number;
      failed: number;
    };
    responseTime: {
      avg: number;
      p95: number;
      p99: number;
    };
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    memory: number;
    keys: number;
  };
  http: {
    requests: {
      total: number;
      active: number;
      failed: number;
    };
    responseTime: {
      avg: number;
      p95: number;
      p99: number;
    };
  };
}

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaegerEndpoint?: string | undefined;
  samplingRate?: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: {
    enabled: boolean;
    port: number;
    path: string;
  };
  tracing: TracingConfig;
  healthChecks: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
  performance: {
    enabled: boolean;
    interval: number;
    thresholds: {
      cpu: number;
      memory: number;
      responseTime: number;
    };
  };
}
