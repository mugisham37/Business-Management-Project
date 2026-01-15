import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DisasterRecoveryRepository } from '../repositories/disaster-recovery.repository';
import { FailoverService } from './failover.service';
import { ReplicationService } from './replication.service';
import { BackupService } from '../../backup/services/backup.service';

import {
  DisasterRecoveryPlan,
  DisasterRecoveryExecution,
  DisasterType,
  RecoveryStatus,
} from '../entities/disaster-recovery.entity';

export interface RecoveryStep {
  id: string;
  name: string;
  description: string;
  type: 'database' | 'application' | 'network' | 'validation' | 'notification';
  priority: number;
  dependencies: string[];
  estimatedDurationMinutes: number;
  automatable: boolean;
  command?: string;
  parameters?: Record<string, any>;
  validationCriteria?: string[];
}

export interface ExecutionContext {
  executionId: string;
  plan: DisasterRecoveryPlan;
  disasterType: DisasterType;
  isTest: boolean;
  startTime: Date;
  userId: string;
}

@Injectable()
export class DisasterRecoveryProceduresService {
  private readonly logger = new Logger(DisasterRecoveryProceduresService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly drRepository: DisasterRecoveryRepository,
    private readonly failoverService: FailoverService,
    private readonly replicationService: ReplicationService,
    private readonly backupService: BackupService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute disaster recovery procedures
   */
  async executeProcedures(context: ExecutionContext): Promise<void> {
    this.logger.log(`Executing DR procedures for execution ${context.executionId}`);

    try {
      // Update execution status
      await this.updateExecutionStatus(context.executionId, RecoveryStatus.IN_PROGRESS);

      // Get recovery steps for the disaster type
      const steps = this.getRecoverySteps(context.plan, context.disasterType);

      // Execute steps in order
      const executedSteps = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const step of steps) {
        try {
          this.logger.log(`Executing step: ${step.name}`);
          
          const stepResult = await this.executeStep(step, context);
          executedSteps.push({
            stepId: step.id,
            name: step.name,
            status: 'completed',
            startTime: stepResult.startTime,
            endTime: stepResult.endTime,
            duration: stepResult.duration,
            output: stepResult.output,
          });

          // Emit step completed event
          this.eventEmitter.emit('dr.step.completed', {
            executionId: context.executionId,
            stepId: step.id,
            stepName: step.name,
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Step ${step.name} failed: ${errorMessage}`);
          
          errors.push(`${step.name}: ${errorMessage}`);

          executedSteps.push({
            stepId: step.id,
            name: step.name,
            status: 'failed',
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
            error: errorMessage,
          });

          // For critical steps, abort the recovery
          if (step.priority <= 2) {
            throw new Error(`Critical step ${step.name} failed: ${errorMessage}`);
          }
        }
      }

      // Calculate actual RTO
      const actualRtoMinutes = Math.ceil(
        (new Date().getTime() - context.startTime.getTime()) / (1000 * 60)
      );

      // Update execution with results
      await this.drRepository.updateExecution(context.executionId, {
        status: errors.length > 0 ? RecoveryStatus.COMPLETED_WITH_ERRORS : RecoveryStatus.COMPLETED,
        completedAt: new Date(),
        actualRtoMinutes,
        executedSteps,
        errors,
        warnings,
      });

      // Emit completion event
      this.eventEmitter.emit('dr.execution.completed', {
        executionId: context.executionId,
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        actualRtoMinutes,
        errors: errors.length,
      });

      this.logger.log(`DR procedures completed for execution ${context.executionId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`DR procedures failed: ${errorMessage}`, error instanceof Error ? error.stack : undefined);

      // Update execution status to failed
      await this.updateExecutionStatus(context.executionId, RecoveryStatus.FAILED, errorMessage);

      // Emit failure event
      this.eventEmitter.emit('dr.execution.failed', {
        executionId: context.executionId,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Validate recovery procedures
   */
  async validateProcedures(planId: string, tenantId: string): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    this.logger.log(`Validating DR procedures for plan ${planId}`);

    try {
      const plan = await this.drRepository.findPlanById(planId);
      if (!plan || plan.tenantId !== tenantId) {
        throw new Error(`DR plan ${planId} not found`);
      }

      const issues = [];
      const recommendations = [];

      // Validate each disaster type has procedures
      for (const disasterType of plan.disasterTypes) {
        const steps = this.getRecoverySteps(plan, disasterType);
        
        if (steps.length === 0) {
          issues.push(`No recovery steps defined for disaster type: ${disasterType}`);
        }

        // Check for critical steps
        const criticalSteps = steps.filter(s => s.priority <= 2);
        if (criticalSteps.length === 0) {
          issues.push(`No critical recovery steps defined for disaster type: ${disasterType}`);
        }

        // Check for validation steps
        const validationSteps = steps.filter(s => s.type === 'validation');
        if (validationSteps.length === 0) {
          recommendations.push(`Consider adding validation steps for disaster type: ${disasterType}`);
        }

        // Check for automation
        const manualSteps = steps.filter(s => !s.automatable);
        if (manualSteps.length > steps.length * 0.5) {
          recommendations.push(`Consider automating more steps for disaster type: ${disasterType}`);
        }
      }

      // Validate dependencies
      for (const disasterType of plan.disasterTypes) {
        const steps = this.getRecoverySteps(plan, disasterType);
        const stepIds = new Set(steps.map(s => s.id));
        
        for (const step of steps) {
          for (const depId of step.dependencies) {
            if (!stepIds.has(depId)) {
              issues.push(`Step ${step.name} has invalid dependency: ${depId}`);
            }
          }
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to validate DR procedures: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Generate standard recovery procedures
   */
  generateStandardProcedures(disasterType: DisasterType): RecoveryStep[] {
    const baseSteps: RecoveryStep[] = [];

    // Common initial steps
    baseSteps.push({
      id: 'notify-stakeholders',
      name: 'Notify Stakeholders',
      description: 'Send notifications to key stakeholders about the disaster',
      type: 'notification',
      priority: 1,
      dependencies: [],
      estimatedDurationMinutes: 2,
      automatable: true,
      parameters: {
        notificationChannels: ['email', 'sms', 'slack'],
        stakeholderGroups: ['management', 'operations', 'customers'],
      },
    });

    baseSteps.push({
      id: 'assess-damage',
      name: 'Assess Damage',
      description: 'Evaluate the extent of the disaster and affected systems',
      type: 'validation',
      priority: 1,
      dependencies: [],
      estimatedDurationMinutes: 5,
      automatable: true,
      validationCriteria: [
        'Database connectivity',
        'Application responsiveness',
        'Network connectivity',
        'Data integrity',
      ],
    });

    // Disaster-specific steps
    switch (disasterType) {
      case DisasterType.HARDWARE_FAILURE:
        baseSteps.push(...this.getHardwareFailureSteps());
        break;
      case DisasterType.SOFTWARE_FAILURE:
        baseSteps.push(...this.getSoftwareFailureSteps());
        break;
      case DisasterType.NETWORK_OUTAGE:
        baseSteps.push(...this.getNetworkOutageSteps());
        break;
      case DisasterType.DATA_CORRUPTION:
        baseSteps.push(...this.getDataCorruptionSteps());
        break;
      case DisasterType.SECURITY_BREACH:
        baseSteps.push(...this.getSecurityBreachSteps());
        break;
      case DisasterType.NATURAL_DISASTER:
        baseSteps.push(...this.getNaturalDisasterSteps());
        break;
    }

    // Common final steps
    baseSteps.push({
      id: 'validate-recovery',
      name: 'Validate Recovery',
      description: 'Perform comprehensive validation of recovered systems',
      type: 'validation',
      priority: 3,
      dependencies: baseSteps.filter(s => s.type !== 'validation').map(s => s.id),
      estimatedDurationMinutes: 10,
      automatable: true,
      validationCriteria: [
        'All services operational',
        'Data integrity verified',
        'Performance within acceptable limits',
        'Security controls active',
      ],
    });

    baseSteps.push({
      id: 'notify-completion',
      name: 'Notify Recovery Completion',
      description: 'Inform stakeholders that recovery is complete',
      type: 'notification',
      priority: 4,
      dependencies: ['validate-recovery'],
      estimatedDurationMinutes: 2,
      automatable: true,
      parameters: {
        notificationChannels: ['email', 'sms', 'slack'],
        stakeholderGroups: ['management', 'operations', 'customers'],
      },
    });

    return baseSteps;
  }

  /**
   * Private helper methods
   */
  private getRecoverySteps(plan: DisasterRecoveryPlan, disasterType: DisasterType): RecoveryStep[] {
    // Get steps from plan configuration or generate standard ones
    const configSteps = plan.configuration.recoverySteps?.[disasterType];
    
    if (configSteps && configSteps.length > 0) {
      return configSteps;
    }

    return this.generateStandardProcedures(disasterType);
  }

  private async executeStep(step: RecoveryStep, context: ExecutionContext): Promise<{
    startTime: Date;
    endTime: Date;
    duration: number;
    output: any;
  }> {
    const startTime = new Date();

    try {
      let output: any = {};

      switch (step.type) {
        case 'database':
          output = await this.executeDatabaseStep(step, context);
          break;
        case 'application':
          output = await this.executeApplicationStep(step, context);
          break;
        case 'network':
          output = await this.executeNetworkStep(step, context);
          break;
        case 'validation':
          output = await this.executeValidationStep(step, context);
          break;
        case 'notification':
          output = await this.executeNotificationStep(step, context);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        startTime,
        endTime,
        duration,
        output,
      };

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      throw new Error(`Step execution failed after ${duration}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeDatabaseStep(step: RecoveryStep, context: ExecutionContext): Promise<any> {
    switch (step.id) {
      case 'failover-database':
        // Find database failover config
        const dbConfigs = await this.failoverService.listFailoverConfigs(context.plan.tenantId);
        const dbConfig = dbConfigs.find(c => c.serviceName === 'database');
        
        if (!dbConfig) {
          throw new Error('Database failover configuration not found');
        }
        
        return await this.failoverService.executeFailover({
          tenantId: context.plan.tenantId,
          configId: dbConfig.id,
          failoverType: dbConfig.failoverType,
          userId: context.userId,
        });

      case 'restore-database':
        return await this.backupService.restoreFromBackup({
          backupId: step.parameters?.backupId,
          targetTenantId: context.plan.tenantId,
          userId: context.userId,
        });

      default:
        return { message: `Database step ${step.id} executed successfully` };
    }
  }

  private async executeApplicationStep(step: RecoveryStep, context: ExecutionContext): Promise<any> {
    switch (step.id) {
      case 'failover-application':
        // Find application failover config
        const appConfigs = await this.failoverService.listFailoverConfigs(context.plan.tenantId);
        const appConfig = appConfigs.find(c => c.serviceName === 'application');
        
        if (!appConfig) {
          throw new Error('Application failover configuration not found');
        }
        
        return await this.failoverService.executeFailover({
          tenantId: context.plan.tenantId,
          configId: appConfig.id,
          failoverType: appConfig.failoverType,
          userId: context.userId,
        });

      case 'restart-services':
        // Simulate service restart
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { message: 'Services restarted successfully' };

      default:
        return { message: `Application step ${step.id} executed successfully` };
    }
  }

  private async executeNetworkStep(step: RecoveryStep, context: ExecutionContext): Promise<any> {
    switch (step.id) {
      case 'switch-dns':
        // Simulate DNS switching
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { message: 'DNS switched to secondary region' };

      case 'update-load-balancer':
        // Simulate load balancer update
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { message: 'Load balancer updated' };

      default:
        return { message: `Network step ${step.id} executed successfully` };
    }
  }

  private async executeValidationStep(step: RecoveryStep, context: ExecutionContext): Promise<any> {
    const results = [];

    for (const criteria of step.validationCriteria || []) {
      // Simulate validation checks
      await new Promise(resolve => setTimeout(resolve, 500));
      
      results.push({
        criteria,
        status: 'passed',
        details: `${criteria} validation completed successfully`,
      });
    }

    return { validationResults: results };
  }

  private async executeNotificationStep(step: RecoveryStep, context: ExecutionContext): Promise<any> {
    const notifications = [];

    for (const channel of step.parameters?.notificationChannels || []) {
      for (const group of step.parameters?.stakeholderGroups || []) {
        // Simulate notification sending
        await new Promise(resolve => setTimeout(resolve, 200));
        
        notifications.push({
          channel,
          group,
          status: 'sent',
          timestamp: new Date(),
        });
      }
    }

    return { notifications };
  }

  private async updateExecutionStatus(executionId: string, status: RecoveryStatus, error?: string): Promise<void> {
    const updates: any = { status };
    
    if (error) {
      updates.errors = [{ message: error, timestamp: new Date() }];
    }

    await this.drRepository.updateExecution(executionId, updates);
  }

  private getHardwareFailureSteps(): RecoveryStep[] {
    return [
      {
        id: 'failover-database',
        name: 'Failover Database',
        description: 'Switch database to secondary hardware',
        type: 'database',
        priority: 2,
        dependencies: ['assess-damage'],
        estimatedDurationMinutes: 5,
        automatable: true,
      },
      {
        id: 'failover-application',
        name: 'Failover Application',
        description: 'Switch application to secondary hardware',
        type: 'application',
        priority: 2,
        dependencies: ['failover-database'],
        estimatedDurationMinutes: 3,
        automatable: true,
      },
    ];
  }

  private getSoftwareFailureSteps(): RecoveryStep[] {
    return [
      {
        id: 'restart-services',
        name: 'Restart Services',
        description: 'Restart failed application services',
        type: 'application',
        priority: 2,
        dependencies: ['assess-damage'],
        estimatedDurationMinutes: 2,
        automatable: true,
      },
      {
        id: 'rollback-deployment',
        name: 'Rollback Deployment',
        description: 'Rollback to previous stable version',
        type: 'application',
        priority: 3,
        dependencies: ['restart-services'],
        estimatedDurationMinutes: 5,
        automatable: true,
      },
    ];
  }

  private getNetworkOutageSteps(): RecoveryStep[] {
    return [
      {
        id: 'switch-dns',
        name: 'Switch DNS',
        description: 'Update DNS to point to secondary region',
        type: 'network',
        priority: 2,
        dependencies: ['assess-damage'],
        estimatedDurationMinutes: 2,
        automatable: true,
      },
      {
        id: 'update-load-balancer',
        name: 'Update Load Balancer',
        description: 'Reconfigure load balancer for new routing',
        type: 'network',
        priority: 2,
        dependencies: ['switch-dns'],
        estimatedDurationMinutes: 3,
        automatable: true,
      },
    ];
  }

  private getDataCorruptionSteps(): RecoveryStep[] {
    return [
      {
        id: 'restore-database',
        name: 'Restore Database',
        description: 'Restore database from latest clean backup',
        type: 'database',
        priority: 2,
        dependencies: ['assess-damage'],
        estimatedDurationMinutes: 15,
        automatable: true,
        parameters: {
          restoreType: 'point-in-time',
        },
      },
      {
        id: 'verify-data-integrity',
        name: 'Verify Data Integrity',
        description: 'Run data integrity checks on restored database',
        type: 'validation',
        priority: 3,
        dependencies: ['restore-database'],
        estimatedDurationMinutes: 10,
        automatable: true,
        validationCriteria: [
          'Foreign key constraints',
          'Data consistency checks',
          'Checksum validation',
        ],
      },
    ];
  }

  private getSecurityBreachSteps(): RecoveryStep[] {
    return [
      {
        id: 'isolate-systems',
        name: 'Isolate Affected Systems',
        description: 'Isolate compromised systems from network',
        type: 'network',
        priority: 1,
        dependencies: ['assess-damage'],
        estimatedDurationMinutes: 2,
        automatable: true,
      },
      {
        id: 'reset-credentials',
        name: 'Reset Credentials',
        description: 'Reset all potentially compromised credentials',
        type: 'application',
        priority: 2,
        dependencies: ['isolate-systems'],
        estimatedDurationMinutes: 10,
        automatable: false,
      },
      {
        id: 'security-scan',
        name: 'Security Scan',
        description: 'Perform comprehensive security scan',
        type: 'validation',
        priority: 3,
        dependencies: ['reset-credentials'],
        estimatedDurationMinutes: 20,
        automatable: true,
        validationCriteria: [
          'No malware detected',
          'No unauthorized access',
          'Security controls active',
        ],
      },
    ];
  }

  private getNaturalDisasterSteps(): RecoveryStep[] {
    return [
      {
        id: 'activate-remote-site',
        name: 'Activate Remote Site',
        description: 'Activate disaster recovery site in different geographic region',
        type: 'application',
        priority: 1,
        dependencies: ['assess-damage'],
        estimatedDurationMinutes: 10,
        automatable: true,
      },
      {
        id: 'failover-all-services',
        name: 'Failover All Services',
        description: 'Complete failover of all services to remote site',
        type: 'application',
        priority: 2,
        dependencies: ['activate-remote-site'],
        estimatedDurationMinutes: 15,
        automatable: true,
      },
      {
        id: 'notify-customers',
        name: 'Notify Customers',
        description: 'Inform customers about service restoration',
        type: 'notification',
        priority: 3,
        dependencies: ['failover-all-services'],
        estimatedDurationMinutes: 5,
        automatable: true,
        parameters: {
          notificationChannels: ['email', 'sms', 'website'],
          stakeholderGroups: ['customers'],
        },
      },
    ];
  }
}