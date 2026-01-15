import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { FailoverRepository } from '../repositories/failover.repository';
import { FailoverConfiguration, FailoverType } from '../entities/disaster-recovery.entity';

export interface CreateFailoverConfigOptions {
  tenantId: string;
  serviceName: string;
  primaryEndpoint: string;
  secondaryEndpoints: string[];
  automaticFailover: boolean;
  healthCheckConfig?: Record<string, any>;
  thresholds?: Record<string, any>;
}

export interface ExecuteFailoverOptions {
  tenantId: string;
  configId: string;
  failoverType: FailoverType;
  targetEndpoint?: string;
  userId: string;
}

export interface FailoverResult {
  success: boolean;
  previousEndpoint: string;
  newEndpoint: string;
  failoverDuration: number;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class FailoverService {
  private readonly logger = new Logger(FailoverService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly failoverRepository: FailoverRepository,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('failover-queue') private readonly failoverQueue: Queue,
  ) {}

  /**
   * Create failover configuration
   */
  async createFailoverConfig(options: CreateFailoverConfigOptions): Promise<FailoverConfiguration> {
    this.logger.log(`Creating failover config for service ${options.serviceName} in tenant ${options.tenantId}`);

    try {
      const config = await this.failoverRepository.createConfig({
        tenantId: options.tenantId,
        serviceName: options.serviceName,
        primaryEndpoint: options.primaryEndpoint,
        secondaryEndpoints: options.secondaryEndpoints,
        failoverType: options.automaticFailover ? FailoverType.AUTOMATIC : FailoverType.MANUAL,
        healthCheckConfig: options.healthCheckConfig || this.getDefaultHealthCheckConfig(),
        thresholds: options.thresholds || this.getDefaultThresholds(),
        isEnabled: true,
        currentActiveEndpoint: options.primaryEndpoint,
      });

      // Start health monitoring if automatic failover is enabled
      if (options.automaticFailover) {
        await this.startHealthMonitoring(config.id);
      }

      // Emit config created event
      this.eventEmitter.emit('failover.config.created', {
        tenantId: options.tenantId,
        configId: config.id,
        serviceName: options.serviceName,
      });

      this.logger.log(`Failover config ${config.id} created successfully`);
      return config;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create failover config: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Execute failover
   */
  async executeFailover(options: ExecuteFailoverOptions): Promise<FailoverResult> {
    this.logger.log(`Executing failover for config ${options.configId}`);

    try {
      const config = await this.failoverRepository.findConfigById(options.configId);
      if (!config || config.tenantId !== options.tenantId) {
        throw new BadRequestException(`Failover config ${options.configId} not found`);
      }

      // Determine target endpoint
      const targetEndpoint = options.targetEndpoint || this.selectBestSecondaryEndpoint(config);
      
      if (!targetEndpoint) {
        throw new BadRequestException('No healthy secondary endpoint available');
      }

      // Queue failover job
      const job = await this.failoverQueue.add('execute-failover', {
        configId: options.configId,
        targetEndpoint,
        failoverType: options.failoverType,
        userId: options.userId,
      }, {
        priority: 1, // High priority
        delay: 0,
      });

      // Emit failover started event
      this.eventEmitter.emit('failover.started', {
        tenantId: options.tenantId,
        configId: options.configId,
        serviceName: config.serviceName,
        fromEndpoint: config.currentActiveEndpoint,
        toEndpoint: targetEndpoint,
        failoverType: options.failoverType,
        userId: options.userId,
      });

      // Return immediate response - actual result will be available via events
      return {
        success: true,
        previousEndpoint: config.currentActiveEndpoint,
        newEndpoint: targetEndpoint,
        failoverDuration: 0, // Will be updated when job completes
        errors: [],
        warnings: [],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to execute failover: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Test failover configuration
   */
  async testFailover(configId: string, tenantId: string, userId: string): Promise<FailoverResult> {
    this.logger.log(`Testing failover for config ${configId}`);

    try {
      const config = await this.failoverRepository.findConfigById(configId);
      if (!config || config.tenantId !== tenantId) {
        throw new BadRequestException(`Failover config ${configId} not found`);
      }

      // Execute planned failover for testing
      const result = await this.executeFailover({
        tenantId,
        configId,
        failoverType: FailoverType.PLANNED,
        userId,
      });

      // Schedule automatic failback after test
      setTimeout(async () => {
        try {
          await this.executeFailback(configId, tenantId, userId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Automatic failback after test failed: ${errorMessage}`);
        }
      }, 60000); // 1 minute

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to test failover: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Execute failback to primary endpoint
   */
  async executeFailback(configId: string, tenantId: string, userId: string): Promise<FailoverResult> {
    this.logger.log(`Executing failback for config ${configId}`);

    try {
      const config = await this.failoverRepository.findConfigById(configId);
      if (!config || config.tenantId !== tenantId) {
        throw new BadRequestException(`Failover config ${configId} not found`);
      }

      // Check if primary endpoint is healthy
      const isPrimaryHealthy = await this.checkEndpointHealth(config.primaryEndpoint, config.healthCheckConfig);
      
      if (!isPrimaryHealthy) {
        throw new BadRequestException('Primary endpoint is not healthy, cannot failback');
      }

      // Execute failover back to primary
      return this.executeFailover({
        tenantId,
        configId,
        failoverType: FailoverType.PLANNED,
        targetEndpoint: config.primaryEndpoint,
        userId,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to execute failback: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get failover configuration
   */
  async getFailoverConfig(configId: string, tenantId: string): Promise<FailoverConfiguration> {
    const config = await this.failoverRepository.findConfigById(configId);
    
    if (!config || config.tenantId !== tenantId) {
      throw new BadRequestException(`Failover config ${configId} not found`);
    }

    return config;
  }

  /**
   * List failover configurations for tenant
   */
  async listFailoverConfigs(tenantId: string): Promise<FailoverConfiguration[]> {
    return this.failoverRepository.findConfigsByTenant(tenantId);
  }

  /**
   * Update failover configuration
   */
  async updateFailoverConfig(
    configId: string,
    tenantId: string,
    updates: Partial<CreateFailoverConfigOptions>
  ): Promise<FailoverConfiguration> {
    this.logger.log(`Updating failover config ${configId}`);

    try {
      const config = await this.getFailoverConfig(configId, tenantId);

      const updateData: Partial<{
        serviceName: string;
        primaryEndpoint: string;
        secondaryEndpoints: string[];
        failoverType: FailoverType;
        healthCheckConfig: Record<string, any>;
        thresholds: Record<string, any>;
      }> = {};

      if (updates.serviceName !== undefined) updateData.serviceName = updates.serviceName;
      if (updates.primaryEndpoint !== undefined) updateData.primaryEndpoint = updates.primaryEndpoint;
      if (updates.secondaryEndpoints !== undefined) updateData.secondaryEndpoints = updates.secondaryEndpoints;
      if (updates.automaticFailover !== undefined) {
        updateData.failoverType = updates.automaticFailover ? FailoverType.AUTOMATIC : FailoverType.MANUAL;
      }
      if (updates.healthCheckConfig !== undefined) updateData.healthCheckConfig = updates.healthCheckConfig;
      if (updates.thresholds !== undefined) updateData.thresholds = updates.thresholds;

      const updatedConfig = await this.failoverRepository.updateConfig(configId, updateData);

      // Update health monitoring if automatic failover setting changed
      if (updates.automaticFailover !== undefined) {
        if (updates.automaticFailover) {
          await this.startHealthMonitoring(configId);
        } else {
          await this.stopHealthMonitoring(configId);
        }
      }

      // Emit config updated event
      this.eventEmitter.emit('failover.config.updated', {
        tenantId,
        configId,
        serviceName: config.serviceName,
      });

      this.logger.log(`Failover config ${configId} updated successfully`);
      return updatedConfig;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update failover config ${configId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Delete failover configuration
   */
  async deleteFailoverConfig(configId: string, tenantId: string): Promise<void> {
    this.logger.log(`Deleting failover config ${configId}`);

    try {
      const config = await this.getFailoverConfig(configId, tenantId);

      // Stop health monitoring
      await this.stopHealthMonitoring(configId);

      // Delete configuration
      await this.failoverRepository.deleteConfig(configId);

      // Emit config deleted event
      this.eventEmitter.emit('failover.config.deleted', {
        tenantId,
        configId,
        serviceName: config.serviceName,
      });

      this.logger.log(`Failover config ${configId} deleted successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete failover config ${configId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Update failover configurations for DR plan
   */
  async updateFailoverForPlan(planId: string, updates: {
    automaticFailover: boolean;
    primaryRegion: string;
    secondaryRegions: string[];
  }): Promise<void> {
    this.logger.log(`Updating failover configurations for DR plan ${planId}`);

    try {
      const configs = await this.failoverRepository.findConfigsByPlan(planId);

      for (const config of configs) {
        await this.updateFailoverConfig(config.id, config.tenantId, {
          automaticFailover: updates.automaticFailover,
          primaryEndpoint: this.buildEndpointUrl(config.serviceName, updates.primaryRegion),
          secondaryEndpoints: updates.secondaryRegions.map(region => 
            this.buildEndpointUrl(config.serviceName, region)
          ),
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update failover for plan ${planId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Cleanup failover configurations for DR plan
   */
  async cleanupFailoverForPlan(planId: string): Promise<void> {
    this.logger.log(`Cleaning up failover configurations for DR plan ${planId}`);

    try {
      const configs = await this.failoverRepository.findConfigsByPlan(planId);

      for (const config of configs) {
        await this.deleteFailoverConfig(config.id, config.tenantId);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to cleanup failover for plan ${planId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Check endpoint health
   */
  async checkEndpointHealth(endpoint: string, healthCheckConfig: Record<string, any>): Promise<boolean> {
    try {
      // Implement health check logic based on configuration
      // This is a placeholder implementation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), healthCheckConfig.timeout || 5000);
      
      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Health check failed for endpoint ${endpoint}: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private selectBestSecondaryEndpoint(config: FailoverConfiguration): string | null | undefined {
    // Simple round-robin selection for now
    // In production, this would consider health, latency, capacity, etc.
    const availableEndpoints = config.secondaryEndpoints.filter(endpoint => 
      endpoint !== config.currentActiveEndpoint
    );

    return availableEndpoints.length > 0 ? availableEndpoints[0] : null;
  }

  private getDefaultHealthCheckConfig(): Record<string, any> {
    return {
      path: '/health',
      method: 'GET',
      timeout: 5000,
      interval: 30000, // 30 seconds
      retries: 3,
      expectedStatus: 200,
    };
  }

  private getDefaultThresholds(): Record<string, any> {
    return {
      consecutiveFailures: 3,
      responseTimeThreshold: 5000, // 5 seconds
      errorRateThreshold: 0.1, // 10%
      healthCheckInterval: 30000, // 30 seconds
    };
  }

  private async startHealthMonitoring(configId: string): Promise<void> {
    // Start background health monitoring for automatic failover
    this.logger.log(`Starting health monitoring for failover config ${configId}`);
    
    // In a real implementation, this would set up periodic health checks
    // For now, this is a placeholder
  }

  private async stopHealthMonitoring(configId: string): Promise<void> {
    // Stop background health monitoring
    this.logger.log(`Stopping health monitoring for failover config ${configId}`);
    
    // In a real implementation, this would clean up periodic health checks
    // For now, this is a placeholder
  }

  private buildEndpointUrl(serviceName: string, region: string): string {
    // Build endpoint URL based on service name and region
    return `https://${serviceName}.${region}.example.com`;
  }

  /**
   * Queue failover execution
   */
  async queueFailoverExecution(options: {
    executionId: string;
    configurationId: string;
    targetRegion: string;
    isAutomatic: boolean;
    userId: string;
  }): Promise<void> {
    this.logger.log(`Queueing failover execution ${options.executionId}`);

    await this.failoverQueue.add('execute-failover', options, {
      priority: options.isAutomatic ? 1 : 2,
      delay: 0,
    });
  }

  /**
   * Get failover metrics for tenant
   */
  async getFailoverMetrics(tenantId: string): Promise<{
    totalConfigurations: number;
    activeConfigurations: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageFailoverTime: number;
    successRate: number;
  }> {
    return this.failoverRepository.getFailoverMetrics(tenantId);
  }
}