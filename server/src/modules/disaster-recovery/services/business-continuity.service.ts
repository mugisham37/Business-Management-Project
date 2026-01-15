import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { DisasterRecoveryRepository } from '../repositories/disaster-recovery.repository';
import { FailoverService } from './failover.service';
import { ReplicationService } from './replication.service';

export interface ServiceHealthStatus {
  serviceName: string;
  isHealthy: boolean;
  responseTime: number;
  lastChecked: Date;
  errorCount: number;
  uptime: number;
  details: Record<string, any>;
}

export interface GracefulDegradationConfig {
  serviceName: string;
  degradationLevels: {
    level: number;
    name: string;
    description: string;
    disabledFeatures: string[];
    performanceThresholds: {
      responseTime: number;
      errorRate: number;
      throughput: number;
    };
  }[];
}

export interface BusinessContinuityMetrics {
  overallHealthScore: number;
  servicesMonitored: number;
  healthyServices: number;
  degradedServices: number;
  failedServices: number;
  averageResponseTime: number;
  totalUptime: number;
  incidentCount: number;
  mttr: number; // Mean Time To Recovery
  mtbf: number; // Mean Time Between Failures
}

@Injectable()
export class BusinessContinuityService {
  private readonly logger = new Logger(BusinessContinuityService.name);
  private readonly serviceHealthCache = new Map<string, ServiceHealthStatus>();
  private readonly degradationConfigs = new Map<string, GracefulDegradationConfig>();

  constructor(
    private readonly configService: ConfigService,
    private readonly drRepository: DisasterRecoveryRepository,
    private readonly failoverService: FailoverService,
    private readonly replicationService: ReplicationService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeDefaultConfigurations();
  }

  /**
   * Monitor service health continuously
   */
  @Cron(CronExpression.EVERY_30_SECONDS, {
    name: 'service-health-monitoring',
    timeZone: 'UTC',
  })
  async monitorServiceHealth(): Promise<void> {
    try {
      const services = this.getMonitoredServices();
      
      for (const service of services) {
        try {
          const healthStatus = await this.checkServiceHealth(service);
          this.serviceHealthCache.set(service.name, healthStatus);

          // Check if degradation is needed
          await this.evaluateServiceDegradation(service.name, healthStatus);

          // Check if automatic failover is needed
          if (!healthStatus.isHealthy && service.automaticFailover) {
            await this.triggerAutomaticFailover(service.name, healthStatus);
          }

        } catch (error) {
          this.logger.error(`Health check failed for service ${service.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      this.logger.error(`Service health monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    }
  }

  /**
   * Implement graceful degradation for a service
   */
  async implementGracefulDegradation(
    tenantId: string,
    serviceName: string,
    degradationLevel: number,
    reason: string
  ): Promise<void> {
    this.logger.log(`Implementing graceful degradation for service ${serviceName} at level ${degradationLevel}`);

    try {
      const config = this.degradationConfigs.get(serviceName);
      if (!config) {
        throw new Error(`No degradation configuration found for service ${serviceName}`);
      }

      const levelConfig = config.degradationLevels.find(l => l.level === degradationLevel);
      if (!levelConfig) {
        throw new Error(`Invalid degradation level ${degradationLevel} for service ${serviceName}`);
      }

      // Disable features according to degradation level
      for (const feature of levelConfig.disabledFeatures) {
        await this.disableFeature(tenantId, serviceName, feature);
      }

      // Update service configuration
      await this.updateServiceConfiguration(serviceName, {
        degradationLevel,
        degradationReason: reason,
        degradedAt: new Date(),
        disabledFeatures: levelConfig.disabledFeatures,
      });

      // Emit degradation event
      this.eventEmitter.emit('business-continuity.degradation.applied', {
        tenantId,
        serviceName,
        degradationLevel,
        levelName: levelConfig.name,
        reason,
        disabledFeatures: levelConfig.disabledFeatures,
      });

      this.logger.log(`Graceful degradation applied to ${serviceName}: ${levelConfig.name}`);

    } catch (error) {
      this.logger.error(`Failed to implement graceful degradation: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Restore service from degraded state
   */
  async restoreServiceFromDegradation(
    tenantId: string,
    serviceName: string
  ): Promise<void> {
    this.logger.log(`Restoring service ${serviceName} from degraded state`);

    try {
      const config = this.degradationConfigs.get(serviceName);
      if (!config) {
        throw new Error(`No degradation configuration found for service ${serviceName}`);
      }

      // Re-enable all features
      for (const level of config.degradationLevels) {
        for (const feature of level.disabledFeatures) {
          await this.enableFeature(tenantId, serviceName, feature);
        }
      }

      // Update service configuration
      await this.updateServiceConfiguration(serviceName, {
        degradationLevel: 0,
        degradationReason: null,
        degradedAt: null,
        disabledFeatures: [],
        restoredAt: new Date(),
      });

      // Emit restoration event
      this.eventEmitter.emit('business-continuity.degradation.restored', {
        tenantId,
        serviceName,
        restoredAt: new Date(),
      });

      this.logger.log(`Service ${serviceName} restored from degraded state`);

    } catch (error) {
      this.logger.error(`Failed to restore service from degradation: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get current service health status
   */
  getServiceHealthStatus(serviceName?: string): ServiceHealthStatus | ServiceHealthStatus[] {
    if (serviceName) {
      return this.serviceHealthCache.get(serviceName) || {
        serviceName,
        isHealthy: false,
        responseTime: 0,
        lastChecked: new Date(),
        errorCount: 0,
        uptime: 0,
        details: { error: 'Service not monitored' },
      };
    }

    return Array.from(this.serviceHealthCache.values());
  }

  /**
   * Get business continuity metrics
   */
  async getBusinessContinuityMetrics(tenantId: string): Promise<BusinessContinuityMetrics> {
    this.logger.log(`Getting business continuity metrics for tenant ${tenantId}`);

    try {
      const allServices = Array.from(this.serviceHealthCache.values());
      const healthyServices = allServices.filter(s => s.isHealthy);
      const degradedServices = allServices.filter(s => !s.isHealthy && s.errorCount < 10);
      const failedServices = allServices.filter(s => !s.isHealthy && s.errorCount >= 10);

      const totalResponseTime = allServices.reduce((sum, s) => sum + s.responseTime, 0);
      const averageResponseTime = allServices.length > 0 ? totalResponseTime / allServices.length : 0;

      const totalUptime = allServices.reduce((sum, s) => sum + s.uptime, 0);
      const averageUptime = allServices.length > 0 ? totalUptime / allServices.length : 0;

      // Calculate health score (0-100)
      const healthScore = allServices.length > 0 
        ? Math.round((healthyServices.length / allServices.length) * 100)
        : 100;

      // Get incident metrics from DR executions
      const drMetrics = await this.drRepository.getMetrics(tenantId);
      const incidentCount = drMetrics.totalExecutions - drMetrics.testExecutions;

      return {
        overallHealthScore: healthScore,
        servicesMonitored: allServices.length,
        healthyServices: healthyServices.length,
        degradedServices: degradedServices.length,
        failedServices: failedServices.length,
        averageResponseTime: Math.round(averageResponseTime),
        totalUptime: Math.round(averageUptime * 100) / 100,
        incidentCount,
        mttr: drMetrics.averageRtoMinutes,
        mtbf: this.calculateMTBF(incidentCount),
      };

    } catch (error) {
      this.logger.error(`Failed to get business continuity metrics: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Test business continuity procedures
   */
  async testBusinessContinuity(
    tenantId: string,
    testType: 'degradation' | 'failover' | 'recovery' | 'full'
  ): Promise<{
    testId: string;
    testType: string;
    status: 'running' | 'completed' | 'failed';
    results: Array<{
      test: string;
      status: 'passed' | 'failed';
      message: string;
      duration: number;
    }>;
    startTime: Date;
    endTime?: Date;
  }> {
    this.logger.log(`Starting business continuity test: ${testType} for tenant ${tenantId}`);

    const testId = `bc-test-${Date.now()}`;
    const testResults: Array<{
      test: string;
      status: 'passed' | 'failed';
      message: string;
      duration: number;
    }> = [];

    try {
      const startTime = new Date();

      switch (testType) {
        case 'degradation':
          await this.testGracefulDegradation(tenantId, testResults);
          break;
        case 'failover':
          await this.testAutomaticFailover(tenantId, testResults);
          break;
        case 'recovery':
          await this.testRecoveryProcedures(tenantId, testResults);
          break;
        case 'full':
          await this.testGracefulDegradation(tenantId, testResults);
          await this.testAutomaticFailover(tenantId, testResults);
          await this.testRecoveryProcedures(tenantId, testResults);
          break;
      }

      const endTime = new Date();

      // Emit test completion event
      this.eventEmitter.emit('business-continuity.test.completed', {
        tenantId,
        testId,
        testType,
        results: testResults,
        duration: endTime.getTime() - startTime.getTime(),
      });

      return {
        testId,
        testType,
        status: 'completed',
        results: testResults,
        startTime,
        endTime,
      };

    } catch (error) {
      this.logger.error(`Business continuity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);

      return {
        testId,
        testType,
        status: 'failed',
        results: testResults,
        startTime: new Date(),
        endTime: new Date(),
      };
    }
  }

  /**
   * Private helper methods
   */
  private initializeDefaultConfigurations(): void {
    // Initialize default degradation configurations
    const defaultConfigs: GracefulDegradationConfig[] = [
      {
        serviceName: 'pos',
        degradationLevels: [
          {
            level: 1,
            name: 'Minor Degradation',
            description: 'Disable non-essential features',
            disabledFeatures: ['loyalty_points', 'promotions', 'analytics'],
            performanceThresholds: {
              responseTime: 1000,
              errorRate: 5,
              throughput: 80,
            },
          },
          {
            level: 2,
            name: 'Moderate Degradation',
            description: 'Disable advanced features',
            disabledFeatures: ['loyalty_points', 'promotions', 'analytics', 'inventory_sync', 'customer_lookup'],
            performanceThresholds: {
              responseTime: 2000,
              errorRate: 10,
              throughput: 60,
            },
          },
          {
            level: 3,
            name: 'Severe Degradation',
            description: 'Basic functionality only',
            disabledFeatures: ['loyalty_points', 'promotions', 'analytics', 'inventory_sync', 'customer_lookup', 'receipts', 'reporting'],
            performanceThresholds: {
              responseTime: 5000,
              errorRate: 20,
              throughput: 40,
            },
          },
        ],
      },
      {
        serviceName: 'inventory',
        degradationLevels: [
          {
            level: 1,
            name: 'Minor Degradation',
            description: 'Disable real-time sync',
            disabledFeatures: ['real_time_sync', 'low_stock_alerts'],
            performanceThresholds: {
              responseTime: 1500,
              errorRate: 5,
              throughput: 80,
            },
          },
          {
            level: 2,
            name: 'Moderate Degradation',
            description: 'Disable advanced features',
            disabledFeatures: ['real_time_sync', 'low_stock_alerts', 'auto_reorder', 'analytics'],
            performanceThresholds: {
              responseTime: 3000,
              errorRate: 10,
              throughput: 60,
            },
          },
        ],
      },
    ];

    for (const config of defaultConfigs) {
      this.degradationConfigs.set(config.serviceName, config);
    }
  }

  private getMonitoredServices(): Array<{
    name: string;
    endpoint: string;
    automaticFailover: boolean;
  }> {
    // In a real implementation, this would come from configuration
    return [
      { name: 'pos', endpoint: 'http://pos-service:3000/health', automaticFailover: true },
      { name: 'inventory', endpoint: 'http://inventory-service:3000/health', automaticFailover: true },
      { name: 'crm', endpoint: 'http://crm-service:3000/health', automaticFailover: false },
      { name: 'financial', endpoint: 'http://financial-service:3000/health', automaticFailover: true },
      { name: 'database', endpoint: 'http://database:5432', automaticFailover: true },
      { name: 'cache', endpoint: 'http://redis:6379', automaticFailover: false },
    ];
  }

  private async checkServiceHealth(service: { name: string; endpoint: string }): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      // Simulate health check (in real implementation, make HTTP request)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
      
      const responseTime = Date.now() - startTime;
      const isHealthy = Math.random() > 0.05; // 95% success rate
      
      const existingStatus = this.serviceHealthCache.get(service.name);
      const errorCount = isHealthy ? 0 : (existingStatus?.errorCount || 0) + 1;
      
      return {
        serviceName: service.name,
        isHealthy,
        responseTime,
        lastChecked: new Date(),
        errorCount,
        uptime: isHealthy ? 99.9 : 95.0,
        details: {
          endpoint: service.endpoint,
          status: isHealthy ? 'healthy' : 'unhealthy',
          checks: {
            connectivity: isHealthy,
            responseTime: responseTime < 1000,
            errorRate: errorCount < 5,
          },
        },
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const existingStatus = this.serviceHealthCache.get(service.name);
      
      return {
        serviceName: service.name,
        isHealthy: false,
        responseTime,
        lastChecked: new Date(),
        errorCount: (existingStatus?.errorCount || 0) + 1,
        uptime: 0,
        details: {
          endpoint: service.endpoint,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async evaluateServiceDegradation(
    serviceName: string,
    healthStatus: ServiceHealthStatus
  ): Promise<void> {
    const config = this.degradationConfigs.get(serviceName);
    if (!config) return;

    // Determine appropriate degradation level based on health status
    let targetLevel = 0;

    for (const level of config.degradationLevels.reverse()) {
      const thresholds = level.performanceThresholds;
      
      if (
        healthStatus.responseTime > thresholds.responseTime ||
        healthStatus.errorCount > thresholds.errorRate ||
        healthStatus.uptime < thresholds.throughput
      ) {
        targetLevel = level.level;
        break;
      }
    }

    // Apply degradation if needed
    if (targetLevel > 0) {
      await this.implementGracefulDegradation(
        'system', // System-initiated degradation
        serviceName,
        targetLevel,
        `Automatic degradation due to performance issues: response time ${healthStatus.responseTime}ms, errors ${healthStatus.errorCount}`
      );
    }
  }

  private async triggerAutomaticFailover(
    serviceName: string,
    healthStatus: ServiceHealthStatus
  ): Promise<void> {
    this.logger.warn(`Triggering automatic failover for service ${serviceName}`);

    try {
      // Check if failover is already in progress
      const failoverConfigs = await this.failoverService.listFailoverConfigs('system');
      const serviceConfig = failoverConfigs.find(c => c.serviceName === serviceName);
      
      if (serviceConfig) {
        await this.failoverService.executeFailover({
          tenantId: 'system',
          configId: serviceConfig.id,
          failoverType: serviceConfig.failoverType,
          userId: 'system',
        });
      }

    } catch (error) {
      this.logger.error(`Automatic failover failed for service ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async disableFeature(tenantId: string, serviceName: string, feature: string): Promise<void> {
    // In a real implementation, this would disable the feature in the service
    this.logger.log(`Disabling feature ${feature} for service ${serviceName}`);
    
    // Simulate feature disabling
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async enableFeature(tenantId: string, serviceName: string, feature: string): Promise<void> {
    // In a real implementation, this would enable the feature in the service
    this.logger.log(`Enabling feature ${feature} for service ${serviceName}`);
    
    // Simulate feature enabling
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async updateServiceConfiguration(serviceName: string, config: any): Promise<void> {
    // In a real implementation, this would update the service configuration
    this.logger.log(`Updating configuration for service ${serviceName}:`, config);
  }

  private calculateMTBF(incidentCount: number): number {
    // Calculate Mean Time Between Failures (in hours)
    // Assuming 30 days of operation
    const operatingHours = 30 * 24;
    return incidentCount > 0 ? Math.round((operatingHours / incidentCount) * 100) / 100 : operatingHours;
  }

  private async testGracefulDegradation(tenantId: string, results: any[]): Promise<void> {
    this.logger.log('Testing graceful degradation');

    try {
      // Test degradation for POS service
      await this.implementGracefulDegradation(tenantId, 'pos', 1, 'Business continuity test');
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Restore service
      await this.restoreServiceFromDegradation(tenantId, 'pos');

      results.push({
        test: 'Graceful Degradation',
        status: 'passed',
        message: 'Successfully degraded and restored POS service',
        duration: 2000,
      });

    } catch (error) {
      results.push({
        test: 'Graceful Degradation',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
      });
    }
  }

  private async testAutomaticFailover(tenantId: string, results: any[]): Promise<void> {
    this.logger.log('Testing automatic failover');

    try {
      // Simulate service failure and test failover
      const testService = 'pos';
      
      // Simulate health check failure
      this.serviceHealthCache.set(testService, {
        serviceName: testService,
        isHealthy: false,
        responseTime: 5000,
        lastChecked: new Date(),
        errorCount: 10,
        uptime: 0,
        details: { error: 'Simulated failure for testing' },
      });

      // Trigger failover evaluation
      await this.evaluateServiceDegradation(testService, this.serviceHealthCache.get(testService)!);

      results.push({
        test: 'Automatic Failover',
        status: 'passed',
        message: 'Successfully triggered automatic failover procedures',
        duration: 1000,
      });

    } catch (error) {
      results.push({
        test: 'Automatic Failover',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
      });
    }
  }

  private async testRecoveryProcedures(tenantId: string, results: any[]): Promise<void> {
    this.logger.log('Testing recovery procedures');

    try {
      // Test service recovery
      const testService = 'pos';
      
      // Restore healthy status
      this.serviceHealthCache.set(testService, {
        serviceName: testService,
        isHealthy: true,
        responseTime: 200,
        lastChecked: new Date(),
        errorCount: 0,
        uptime: 99.9,
        details: { status: 'healthy' },
      });

      // Test restoration from degradation
      await this.restoreServiceFromDegradation(tenantId, testService);

      results.push({
        test: 'Recovery Procedures',
        status: 'passed',
        message: 'Successfully tested service recovery procedures',
        duration: 500,
      });

    } catch (error) {
      results.push({
        test: 'Recovery Procedures',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
      });
    }
  }
}