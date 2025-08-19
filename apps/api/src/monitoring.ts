import {
  ApplicationMonitor,
  initializeGlobalMonitor,
} from '@company/monitoring';

// Initialize monitoring for API application
export function initializeApiMonitoring(): ApplicationMonitor {
  const monitor = initializeGlobalMonitor(
    'fullstack-api',
    process.env.npm_package_version || '1.0.0',
    process.env.NODE_ENV || 'development'
  );

  // Register custom health checks
  monitor.registerHealthCheck('database', async () => {
    // This would use your actual database client
    // For now, we'll create a mock implementation
    return {
      name: 'database',
      status: 'healthy' as const,
      responseTime: 50,
      timestamp: new Date(),
    };
  });

  monitor.registerHealthCheck('redis', async () => {
    // This would use your actual Redis client
    // For now, we'll create a mock implementation
    return {
      name: 'redis',
      status: 'healthy' as const,
      responseTime: 25,
      timestamp: new Date(),
    };
  });

  return monitor;
}

// Export monitoring endpoints
export async function getHealthStatus(monitor: ApplicationMonitor) {
  return await monitor.getHealthStatus();
}

export async function getMetrics(monitor: ApplicationMonitor) {
  return monitor.getMetricsEndpoint();
}

export async function getPerformanceMetrics(monitor: ApplicationMonitor) {
  return await monitor.getPerformanceMetrics();
}
