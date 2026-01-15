import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { DisasterRecoveryRepository } from '../repositories/disaster-recovery.repository';
import { FailoverService } from './failover.service';
import { ReplicationService } from './replication.service';
import { RecoveryTimeOptimizationService } from './recovery-time-optimization.service';
import { DisasterRecoveryProceduresService } from './disaster-recovery-procedures.service';

import {
  DisasterRecoveryPlan,
  DisasterRecoveryExecution,
  DisasterRecoveryMetrics,
  DisasterType,
  RecoveryStatus,
} from '../entities/disaster-recovery.entity';

export interface CreateDRPlanOptions {
  tenantId: string;
  name: string;
  description: string;
  disasterTypes: DisasterType[];
  rtoMinutes: number;
  rpoMinutes: number;
  primaryRegion: string;
  secondaryRegions: string[];
  automaticFailover: boolean;
  configuration: Record<string, any>;
  userId: string;
}

export interface ExecuteDROptions {
  tenantId: string;
  planId: string;
  disasterType: DisasterType;
  isTest?: boolean;
  userId: string;
}

export interface DRTestOptions {
  tenantId: string;
  planId: string;
  testType: 'full' | 'partial' | 'failover_only';
  userId: string;
}

@Injectable()
export class DisasterRecoveryService {
  private readonly logger = new Logger(DisasterRecoveryService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly drRepository: DisasterRecoveryRepository,
    private readonly failoverService: FailoverService,
    private readonly replicationService: ReplicationService,
    private readonly rtoOptimizationService: RecoveryTimeOptimizationService,
    private readonly proceduresService: DisasterRecoveryProceduresService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('disaster-recovery-queue') private readonly drQueue: Queue,
  ) {}

  /**
   * Create disaster recovery plan
   */
  async createDRPlan(options: CreateDRPlanOptions): Promise<DisasterRecoveryPlan> {
    this.logger.log(`Creating DR plan '${options.name}' for tenant ${options.tenantId}`);

    try {
      // Validate plan options
      await this.validateDRPlanOptions(options);

      // Create DR plan
      const plan = await this.drRepository.createPlan({
        tenantId: options.tenantId,
        name: options.name,
        description: options.description,
        disasterTypes: options.disasterTypes,
        rtoMinutes: options.rtoMinutes,
        rpoMinutes: options.rpoMinutes,
        primaryRegion: options.primaryRegion,
        secondaryRegions: options.secondaryRegions,
        automaticFailover: options.automaticFailover,
        configuration: options.configuration,
        isActive: true,
        nextTestAt: this.calculateNextTestDate(),
        createdBy: options.userId,
      });

      // Initialize replication for the plan
      await this.initializeReplication(plan);

      // Set up failover configurations
      await this.setupFailoverConfigurations(plan);

      // Emit plan created event
      this.eventEmitter.emit('dr.plan.created', {
        tenantId: options.tenantId,
        planId: plan.id,
        userId: options.userId,
      });

      this.logger.log(`DR plan ${plan.id} created successfully`);
      return plan;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create DR plan: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Execute disaster recovery
   */
  async executeDR(options: ExecuteDROptions): Promise<DisasterRecoveryExecution> {
    this.logger.log(`Executing DR for plan ${options.planId}, disaster type: ${options.disasterType}`);

    try {
      const plan = await this.drRepository.findPlanById(options.planId);
      if (!plan || plan.tenantId !== options.tenantId) {
        throw new NotFoundException(`DR plan ${options.planId} not found`);
      }

      // Create execution record
      const execution = await this.drRepository.createExecution({
        tenantId: options.tenantId,
        planId: options.planId,
        disasterType: options.disasterType,
        status: RecoveryStatus.INITIATING,
        detectedAt: new Date(),
        actualRtoMinutes: 0,
        actualRpoMinutes: 0,
        executedSteps: [],
        errors: [],
        warnings: [],
        isTest: options.isTest || false,
        initiatedBy: options.userId,
      });

      // Queue DR execution job
      await this.drQueue.add('execute-dr', {
        executionId: execution.id,
        plan,
        options,
      }, {
        priority: 1, // Highest priority
        delay: 0,
      });

      // Emit DR started event
      this.eventEmitter.emit('dr.execution.started', {
        tenantId: options.tenantId,
        planId: options.planId,
        executionId: execution.id,
        disasterType: options.disasterType,
        isTest: options.isTest,
        userId: options.userId,
      });

      this.logger.log(`DR execution ${execution.id} initiated`);
      return execution;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to execute DR: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Test disaster recovery plan
   */
  async testDRPlan(options: DRTestOptions): Promise<DisasterRecoveryExecution> {
    this.logger.log(`Testing DR plan ${options.planId} with test type: ${options.testType}`);

    try {
      // Execute DR as a test
      const execution = await this.executeDR({
        tenantId: options.tenantId,
        planId: options.planId,
        disasterType: DisasterType.SOFTWARE_FAILURE, // Use software failure for tests
        isTest: true,
        userId: options.userId,
      });

      // Update plan's last tested date
      await this.drRepository.updatePlan(options.planId, {
        lastTestedAt: new Date(),
        nextTestAt: this.calculateNextTestDate(),
      });

      this.logger.log(`DR plan test ${execution.id} initiated`);
      return execution;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to test DR plan: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get DR plan by ID
   */
  async getDRPlan(planId: string, tenantId: string): Promise<DisasterRecoveryPlan> {
    const plan = await this.drRepository.findPlanById(planId);
    
    if (!plan || plan.tenantId !== tenantId) {
      throw new NotFoundException(`DR plan ${planId} not found`);
    }

    return plan;
  }

  /**
   * List DR plans for tenant
   */
  async listDRPlans(tenantId: string): Promise<DisasterRecoveryPlan[]> {
    return this.drRepository.findPlansByTenant(tenantId);
  }

  /**
   * Get DR execution by ID
   */
  async getDRExecution(executionId: string, tenantId: string): Promise<DisasterRecoveryExecution> {
    const execution = await this.drRepository.findExecutionById(executionId);
    
    if (!execution || execution.tenantId !== tenantId) {
      throw new NotFoundException(`DR execution ${executionId} not found`);
    }

    return execution;
  }

  /**
   * List DR executions for tenant
   */
  async listDRExecutions(tenantId: string, limit = 50, offset = 0): Promise<{
    executions: DisasterRecoveryExecution[];
    total: number;
  }> {
    return this.drRepository.findExecutionsByTenant(tenantId, limit, offset);
  }

  /**
   * Get DR metrics for tenant
   */
  async getDRMetrics(tenantId: string): Promise<DisasterRecoveryMetrics> {
    return this.drRepository.getMetrics(tenantId);
  }

  /**
   * Update DR plan
   */
  async updateDRPlan(planId: string, tenantId: string, updates: Partial<CreateDRPlanOptions>): Promise<DisasterRecoveryPlan> {
    this.logger.log(`Updating DR plan ${planId}`);

    try {
      const plan = await this.getDRPlan(planId, tenantId);

      // Update plan
      const updatedPlan = await this.drRepository.updatePlan(planId, {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.disasterTypes !== undefined && { disasterTypes: updates.disasterTypes }),
        ...(updates.rtoMinutes !== undefined && { rtoMinutes: updates.rtoMinutes }),
        ...(updates.rpoMinutes !== undefined && { rpoMinutes: updates.rpoMinutes }),
        ...(updates.primaryRegion !== undefined && { primaryRegion: updates.primaryRegion }),
        ...(updates.secondaryRegions !== undefined && { secondaryRegions: updates.secondaryRegions }),
        ...(updates.automaticFailover !== undefined && { automaticFailover: updates.automaticFailover }),
        ...(updates.configuration !== undefined && { configuration: updates.configuration }),
      });

      // Update replication if regions changed
      if (updates.primaryRegion || updates.secondaryRegions) {
        await this.updateReplication(updatedPlan);
      }

      // Update failover configurations if needed
      if (updates.automaticFailover !== undefined) {
        await this.updateFailoverConfigurations(updatedPlan);
      }

      // Emit plan updated event
      this.eventEmitter.emit('dr.plan.updated', {
        tenantId,
        planId,
        userId: updates.userId,
      });

      this.logger.log(`DR plan ${planId} updated successfully`);
      return updatedPlan;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update DR plan ${planId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Delete DR plan
   */
  async deleteDRPlan(planId: string, tenantId: string, userId: string): Promise<void> {
    this.logger.log(`Deleting DR plan ${planId}`);

    try {
      const plan = await this.getDRPlan(planId, tenantId);

      // Clean up replication
      await this.cleanupReplication(plan);

      // Clean up failover configurations
      await this.cleanupFailoverConfigurations(plan);

      // Delete plan
      await this.drRepository.deletePlan(planId);

      // Emit plan deleted event
      this.eventEmitter.emit('dr.plan.deleted', {
        tenantId,
        planId,
        userId,
      });

      this.logger.log(`DR plan ${planId} deleted successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete DR plan ${planId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Scheduled DR plan testing - runs monthly
   */
  @Cron('0 2 1 * *', {
    name: 'monthly-dr-testing',
    timeZone: 'UTC',
  })
  async scheduledDRTesting(): Promise<void> {
    this.logger.log('Starting scheduled DR plan testing');

    try {
      const plansToTest = await this.drRepository.findPlansForTesting();
      
      for (const plan of plansToTest) {
        try {
          await this.testDRPlan({
            tenantId: plan.tenantId,
            planId: plan.id,
            testType: 'partial',
            userId: 'system',
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Failed to test DR plan ${plan.id}: ${errorMessage}`);
        }
      }

      this.logger.log(`Scheduled DR testing completed for ${plansToTest.length} plans`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Scheduled DR testing failed: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Monitor system health for automatic DR triggering
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'dr-health-monitoring',
    timeZone: 'UTC',
  })
  async monitorSystemHealth(): Promise<void> {
    try {
      const activePlans = await this.drRepository.findActivePlans();
      
      for (const plan of activePlans) {
        if (plan.automaticFailover) {
          const healthStatus = await this.checkSystemHealth(plan);
          
          if (healthStatus.requiresFailover) {
            this.logger.warn(`Automatic DR triggered for plan ${plan.id}: ${healthStatus.reason}`);
            
            await this.executeDR({
              tenantId: plan.tenantId,
              planId: plan.id,
              disasterType: healthStatus.disasterType!,
              isTest: false,
              userId: 'system',
            });
          }
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`DR health monitoring failed: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Private helper methods
   */
  private async validateDRPlanOptions(options: CreateDRPlanOptions): Promise<void> {
    // Validate RTO/RPO values
    if (options.rtoMinutes < 1 || options.rtoMinutes > 1440) {
      throw new BadRequestException('RTO must be between 1 and 1440 minutes');
    }

    if (options.rpoMinutes < 1 || options.rpoMinutes > 1440) {
      throw new BadRequestException('RPO must be between 1 and 1440 minutes');
    }

    // Validate regions
    if (options.secondaryRegions.length === 0) {
      throw new BadRequestException('At least one secondary region is required');
    }

    if (options.secondaryRegions.includes(options.primaryRegion)) {
      throw new BadRequestException('Secondary regions cannot include primary region');
    }

    // Validate disaster types
    if (options.disasterTypes.length === 0) {
      throw new BadRequestException('At least one disaster type must be specified');
    }
  }

  private async initializeReplication(plan: DisasterRecoveryPlan): Promise<void> {
    this.logger.log(`Initializing replication for DR plan ${plan.id}`);

    for (const secondaryRegion of plan.secondaryRegions) {
      await this.replicationService.createReplication({
        tenantId: plan.tenantId,
        sourceRegion: plan.primaryRegion,
        targetRegion: secondaryRegion,
        rpoMinutes: plan.rpoMinutes,
      });
    }
  }

  private async setupFailoverConfigurations(plan: DisasterRecoveryPlan): Promise<void> {
    this.logger.log(`Setting up failover configurations for DR plan ${plan.id}`);

    // Set up database failover
    await this.failoverService.createFailoverConfig({
      tenantId: plan.tenantId,
      serviceName: 'database',
      primaryEndpoint: `db.${plan.primaryRegion}.example.com`,
      secondaryEndpoints: plan.secondaryRegions.map(region => `db.${region}.example.com`),
      automaticFailover: plan.automaticFailover,
    });

    // Set up application failover
    await this.failoverService.createFailoverConfig({
      tenantId: plan.tenantId,
      serviceName: 'application',
      primaryEndpoint: `app.${plan.primaryRegion}.example.com`,
      secondaryEndpoints: plan.secondaryRegions.map(region => `app.${region}.example.com`),
      automaticFailover: plan.automaticFailover,
    });
  }

  private async updateReplication(plan: DisasterRecoveryPlan): Promise<void> {
    // Update replication configurations based on plan changes
    await this.replicationService.updateReplicationForPlan(plan.id, {
      sourceRegion: plan.primaryRegion,
      targetRegions: plan.secondaryRegions,
      rpoMinutes: plan.rpoMinutes,
    });
  }

  private async updateFailoverConfigurations(plan: DisasterRecoveryPlan): Promise<void> {
    // Update failover configurations based on plan changes
    await this.failoverService.updateFailoverForPlan(plan.id, {
      automaticFailover: plan.automaticFailover,
      primaryRegion: plan.primaryRegion,
      secondaryRegions: plan.secondaryRegions,
    });
  }

  private async cleanupReplication(plan: DisasterRecoveryPlan): Promise<void> {
    await this.replicationService.cleanupReplicationForPlan(plan.id);
  }

  private async cleanupFailoverConfigurations(plan: DisasterRecoveryPlan): Promise<void> {
    await this.failoverService.cleanupFailoverForPlan(plan.id);
  }

  private calculateNextTestDate(): Date {
    // Schedule next test in 30 days
    const nextTest = new Date();
    nextTest.setDate(nextTest.getDate() + 30);
    return nextTest;
  }

  private async checkSystemHealth(plan: DisasterRecoveryPlan): Promise<{
    requiresFailover: boolean;
    reason?: string;
    disasterType?: DisasterType;
  }> {
    // Check various health indicators
    const healthChecks = await Promise.all([
      this.checkDatabaseHealth(plan),
      this.checkApplicationHealth(plan),
      this.checkNetworkHealth(plan),
      this.checkReplicationHealth(plan),
    ]);

    for (const check of healthChecks) {
      if (check.requiresFailover) {
        return check;
      }
    }

    return { requiresFailover: false };
  }

  private async checkDatabaseHealth(plan: DisasterRecoveryPlan): Promise<{
    requiresFailover: boolean;
    reason?: string;
    disasterType?: DisasterType;
  }> {
    // Implement database health check logic
    // This is a placeholder implementation
    return { requiresFailover: false };
  }

  private async checkApplicationHealth(plan: DisasterRecoveryPlan): Promise<{
    requiresFailover: boolean;
    reason?: string;
    disasterType?: DisasterType;
  }> {
    // Implement application health check logic
    // This is a placeholder implementation
    return { requiresFailover: false };
  }

  private async checkNetworkHealth(plan: DisasterRecoveryPlan): Promise<{
    requiresFailover: boolean;
    reason?: string;
    disasterType?: DisasterType;
  }> {
    // Implement network health check logic
    // This is a placeholder implementation
    return { requiresFailover: false };
  }

  private async checkReplicationHealth(plan: DisasterRecoveryPlan): Promise<{
    requiresFailover: boolean;
    reason?: string;
    disasterType?: DisasterType;
  }> {
    // Check replication lag and health
    const replicationStatus = await this.replicationService.getReplicationStatus(plan.tenantId);
    
    for (const replication of replicationStatus) {
      if (replication.lagSeconds > plan.rpoMinutes * 60) {
        return {
          requiresFailover: true,
          reason: `Replication lag exceeded RPO: ${replication.lagSeconds}s > ${plan.rpoMinutes * 60}s`,
          disasterType: DisasterType.NETWORK_OUTAGE,
        };
      }
    }

    return { requiresFailover: false };
  }
}