import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RealtimeGateway } from '../gateways/realtime.gateway';

export interface ConnectionMetrics {
  totalConnections: number;
  connectionsByTenant: Record<string, number>;
  averageConnectionDuration: number;
  peakConnections: number;
  peakConnectionsTime: Date;
  connectionsPerHour: number[];
  lastUpdated: Date;
}

export interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'critical';
  totalConnections: number;
  responseTime: number;
  errorRate: number;
  lastHealthCheck: Date;
  issues: string[];
}

@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    connectionsByTenant: {},
    averageConnectionDuration: 0,
    peakConnections: 0,
    peakConnectionsTime: new Date(),
    connectionsPerHour: new Array(24).fill(0),
    lastUpdated: new Date(),
  };

  private healthHistory: ConnectionHealth[] = [];
  private readonly maxHealthHistorySize = 100;

  constructor(private readonly realtimeGateway: RealtimeGateway) {
    this.startMetricsCollection();
  }

  /**
   * Get current connection metrics
   */
  getMetrics(): ConnectionMetrics {
    const stats = this.realtimeGateway.getConnectionStats();
    
    this.metrics = {
      ...this.metrics,
      totalConnections: stats.connectedClients,
      connectionsByTenant: Object.fromEntries(stats.connectionsByTenant),
      lastUpdated: new Date(),
    };

    // Update peak connections
    if (stats.connectedClients > this.metrics.peakConnections) {
      this.metrics.peakConnections = stats.connectedClients;
      this.metrics.peakConnectionsTime = new Date();
    }

    return this.metrics;
  }

  /**
   * Get connection health status
   */
  getHealth(): ConnectionHealth {
    const stats = this.realtimeGateway.getConnectionStats();
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Check for issues
    if (stats.connectedClients > 1000) {
      issues.push('High connection count detected');
      status = 'degraded';
    }

    if (stats.connectedClients > 5000) {
      issues.push('Critical connection count - performance may be impacted');
      status = 'critical';
    }

    // Check tenant distribution
    const tenantCounts = Array.from(stats.connectionsByTenant.values());
    const maxTenantConnections = Math.max(...tenantCounts, 0);
    if (maxTenantConnections > 500) {
      issues.push(`Single tenant has ${maxTenantConnections} connections`);
      if (status === 'healthy') status = 'degraded';
    }

    const health: ConnectionHealth = {
      status,
      totalConnections: stats.connectedClients,
      responseTime: 0, // This would be measured in a real implementation
      errorRate: 0, // This would be calculated from error metrics
      lastHealthCheck: new Date(),
      issues,
    };

    // Store health history
    this.healthHistory.push(health);
    if (this.healthHistory.length > this.maxHealthHistorySize) {
      this.healthHistory.shift();
    }

    return health;
  }

  /**
   * Get health history
   */
  getHealthHistory(): ConnectionHealth[] {
    return [...this.healthHistory];
  }

  /**
   * Get detailed tenant connection information
   */
  getTenantConnectionDetails(tenantId: string) {
    const connections = this.realtimeGateway.getTenantConnections(tenantId);
    
    return {
      tenantId,
      connectionCount: connections.length,
      connections: connections.map(conn => ({
        id: conn.id,
        userId: conn.user.id,
        userDisplayName: conn.user.displayName,
        connectedAt: conn.connectedAt,
        lastActivity: conn.lastActivity,
        connectionDuration: Date.now() - conn.connectedAt.getTime(),
        rooms: Array.from(conn.rooms),
      })),
      averageConnectionDuration: connections.length > 0 
        ? connections.reduce((sum, conn) => sum + (Date.now() - conn.connectedAt.getTime()), 0) / connections.length
        : 0,
    };
  }

  /**
   * Get system-wide connection statistics
   */
  getSystemStats() {
    const stats = this.realtimeGateway.getConnectionStats();
    const currentHour = new Date().getHours();
    
    return {
      current: {
        totalConnections: stats.connectedClients,
        tenantCount: stats.connectionsByTenant.size,
        averageConnectionsPerTenant: stats.connectionsByTenant.size > 0 
          ? stats.connectedClients / stats.connectionsByTenant.size 
          : 0,
      },
      historical: {
        peakConnections: this.metrics.peakConnections,
        peakConnectionsTime: this.metrics.peakConnectionsTime,
        connectionsThisHour: this.metrics.connectionsPerHour[currentHour],
        connectionsLast24Hours: this.metrics.connectionsPerHour.reduce((sum, count) => sum + count, 0),
      },
      health: this.getHealth(),
    };
  }

  /**
   * Monitor connection patterns and detect anomalies
   */
  detectAnomalies(): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    detectedAt: Date;
  }> {
    const anomalies: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      detectedAt: Date;
    }> = [];

    const stats = this.realtimeGateway.getConnectionStats();
    const currentHour = new Date().getHours();
    const currentConnections = this.metrics.connectionsPerHour[currentHour] ?? 0;

    // Check for sudden spikes
    const previousHour = currentHour === 0 ? 23 : currentHour - 1;
    const previousConnections = this.metrics.connectionsPerHour[previousHour] ?? 0;
    
    if (currentConnections > previousConnections * 2 && currentConnections > 100) {
      anomalies.push({
        type: 'connection_spike',
        severity: 'medium',
        description: `Connection spike detected: ${currentConnections} connections this hour vs ${previousConnections} last hour`,
        detectedAt: new Date(),
      });
    }

    // Check for tenant concentration
    const tenantCounts = Array.from(stats.connectionsByTenant.values());
    const totalConnections = stats.connectedClients;
    const maxTenantConnections = Math.max(...tenantCounts, 0);
    
    if (totalConnections > 0 && maxTenantConnections / totalConnections > 0.7) {
      anomalies.push({
        type: 'tenant_concentration',
        severity: 'high',
        description: `Single tenant accounts for ${Math.round((maxTenantConnections / totalConnections) * 100)}% of all connections`,
        detectedAt: new Date(),
      });
    }

    // Check for zero connections (potential issue)
    if (totalConnections === 0 && this.metrics.peakConnections > 0) {
      anomalies.push({
        type: 'no_connections',
        severity: 'high',
        description: 'No active connections detected - potential service issue',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Scheduled health check every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  private performHealthCheck() {
    try {
      const health = this.getHealth();
      const anomalies = this.detectAnomalies();

      if (health.status !== 'healthy' || anomalies.length > 0) {
        this.logger.warn(
          `Connection health check - Status: ${health.status}, Issues: ${health.issues.length}, Anomalies: ${anomalies.length}`,
        );

        if (anomalies.length > 0) {
          anomalies.forEach(anomaly => {
            this.logger.warn(`Anomaly detected: ${anomaly.type} - ${anomaly.description}`);
          });
        }
      }

      // Update hourly connection metrics
      const currentHour = new Date().getHours();
      const stats = this.realtimeGateway.getConnectionStats();
      this.metrics.connectionsPerHour[currentHour] = stats.connectedClients;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Health check failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Scheduled metrics collection every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private collectMetrics() {
    try {
      const metrics = this.getMetrics();
      
      this.logger.log(
        `Connection metrics - Total: ${metrics.totalConnections}, ` +
        `Tenants: ${Object.keys(metrics.connectionsByTenant).length}, ` +
        `Peak: ${metrics.peakConnections}`,
      );

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Metrics collection failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Reset daily metrics at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  private resetDailyMetrics() {
    try {
      this.logger.log('Resetting daily connection metrics');
      
      // Reset hourly connections array
      this.metrics.connectionsPerHour = new Array(24).fill(0);
      
      // Reset peak connections (keep for comparison but start fresh)
      const previousPeak = this.metrics.peakConnections;
      this.metrics.peakConnections = 0;
      
      this.logger.log(`Daily reset complete. Previous peak: ${previousPeak}`);
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Daily metrics reset failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection() {
    this.logger.log('Starting connection metrics collection');
    
    // Initialize metrics
    this.getMetrics();
    
    // Perform initial health check
    this.getHealth();
  }

  /**
   * Get connection trends over time
   */
  getConnectionTrends() {
    const now = new Date();
    const currentHour = now.getHours();
    
    return {
      hourly: this.metrics.connectionsPerHour.map((count, hour) => ({
        hour,
        connections: count,
        isCurrent: hour === currentHour,
      })),
      peak: {
        connections: this.metrics.peakConnections,
        time: this.metrics.peakConnectionsTime,
      },
      current: this.metrics.totalConnections,
    };
  }
}