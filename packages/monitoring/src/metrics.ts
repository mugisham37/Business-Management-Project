import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from 'prom-client';
import { MetricConfig } from './types';

// Enable default metrics collection (CPU, memory, etc.)
collectDefaultMetrics({ register });

// HTTP Request Metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'service'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

// Database Metrics
export const databaseConnectionsActive = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  labelNames: ['database', 'service'],
});

export const databaseQueriesTotal = new Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status', 'service'],
});

export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table', 'service'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5],
});

// Cache Metrics
export const cacheOperationsTotal = new Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result', 'service'],
});

export const cacheHitRate = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['service'],
});

export const cacheMemoryUsage = new Gauge({
  name: 'cache_memory_usage_bytes',
  help: 'Cache memory usage in bytes',
  labelNames: ['service'],
});

// Application Metrics
export const activeUsers = new Gauge({
  name: 'active_users_total',
  help: 'Number of currently active users',
  labelNames: ['service'],
});

export const authenticationAttempts = new Counter({
  name: 'authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'result', 'service'],
});

export const businessOperations = new Counter({
  name: 'business_operations_total',
  help: 'Total number of business operations',
  labelNames: ['operation', 'status', 'service'],
});

// Error Metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'service', 'severity'],
});

// Performance Metrics
export const cpuUsage = new Gauge({
  name: 'cpu_usage_percentage',
  help: 'CPU usage percentage',
  labelNames: ['service'],
});

export const memoryUsage = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type', 'service'],
});

export const eventLoopLag = new Histogram({
  name: 'event_loop_lag_seconds',
  help: 'Event loop lag in seconds',
  labelNames: ['service'],
  buckets: [0.001, 0.01, 0.1, 1, 10],
});

// Custom metric creation utility
export function createCustomMetric(
  config: MetricConfig & { type: 'counter' | 'gauge' | 'histogram' }
) {
  switch (config.type) {
    case 'counter':
      return new Counter({
        name: config.name,
        help: config.help,
        labelNames: config.labelNames || [],
      });
    case 'gauge':
      return new Gauge({
        name: config.name,
        help: config.help,
        labelNames: config.labelNames || [],
      });
    case 'histogram':
      return new Histogram({
        name: config.name,
        help: config.help,
        labelNames: config.labelNames || [],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      });
    default:
      throw new Error(`Unsupported metric type: ${config.type}`);
  }
}

// Metrics registry export
export { register as metricsRegistry };
