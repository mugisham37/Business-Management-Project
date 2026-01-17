import { Resolver, Query, Mutation, Args, Context, Subscription, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, Logger, UseInterceptors } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

import { DisasterRecoveryService } from '../services/disaster-recovery.service';
import { RecoveryTimeOptimizationService } from '../services/recovery-time-optimization.service';
import { FailoverService } from '../services/failover.service';
import { ReplicationService } from '../services/replication.service';
import { DisasterRecoveryProceduresService } from '../services/disaster-recovery-procedures.service';
import { BusinessContinuityService } from '../services/business-continuity.service';
import { DataManagementService } from '../services/data-management.service';

import {
  DisasterRecoveryPlan,
  DisasterRecoveryExecution,
  DisasterRecoveryMetrics,
  FailoverConfiguration,
  ReplicationConfiguration,
  FailoverType,
} from '../entities/disaster-recovery.entity';

import {
  CreateDRPlanInput,
  UpdateDRPlanInput,
  ExecuteDRInput,
  TestDRPlanInput,
  CreateFailoverConfigInput,
  ExecuteFailoverInput,
  CreateReplicationInput,
  DRPlansFilterInput,
  DRExecutionsFilterInput,
  GenerateReportInput,
} from '../inputs/disaster-recovery.input';

import {
  DRPlanResponse,
  DRExecutionResponse,
  DRMetricsResponse,
  RTOAnalysisResponse,
  RTOTrendsResponse,
  RTOImprovementPlanResponse,
  FailoverConfigurationResponse,
  FailoverConfigurationsResponse,
  FailoverExecutionResponse,
  FailoverMetricsResponse,
  ReplicationConfigurationResponse,
  ReplicationStatusResponse,
  ReplicationMetricsResponse,
  ReplicationTrendsResponse,
  DRPlansResponse,
  DRExecutionsResponse,
  DRReportResponse,
} from '../types/disaster-recovery.types';

@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class DisasterRecoveryResolver {
  private readonly logger = new Logger(DisasterRecoveryResolver.name);
  private readonly pubSub = new PubSub();

  constructor(
    private readonly drService: DisasterRecoveryService,
    private readonly rtoOptimizationService: RecoveryTimeOptimizationService,
    private readonly failoverService: FailoverService,
    private readonly replicationService: ReplicationService,
    private readonly proceduresService: DisasterRecoveryProceduresService,
    private readonly businessContinuityService: BusinessContinuityService,
    private readonly dataManagementService: DataManagementService,
  ) {}

  // Disaster Recovery Plans
  @Mutation(() => DRPlanResponse)
  @RequirePermission('disaster_recovery:create')
  async createDRPlan(
    @Args('input') input: CreateDRPlanInput,
    @Context() context: any,
  ): Promise<DRPlanResponse> {
    this.logger.log(`Creating DR plan via GraphQL for tenant ${context.req.tenantId}`);

    try {
      const plan = await this.drService.createDRPlan({
        tenantId: context.req.tenantId,
        ...input,
        configuration: input.configuration ? JSON.parse(input.configuration) : {},
        userId: context.req.user.id,
      });

      return {
        success: true,
        data: plan,
        message: 'DR plan created successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create DR plan: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to create DR plan: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  @Query(() => DRPlansResponse)
  @RequirePermission('disaster_recovery:read')
  async drPlans(
    @Args('filter', { nullable: true }) filter?: DRPlansFilterInput,
    @Context() context?: any,
  ): Promise<DRPlansResponse> {
    try {
      const plans = await this.drService.listDRPlans(context.req.tenantId);
      
      return {
        success: true,
        data: plans,
        message: 'DR plans retrieved successfully',
        total: plans.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve DR plans: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve DR plans: ${errorMessage}`,
      };
    }
  }

  @Query(() => DRPlanResponse)
  @RequirePermission('disaster_recovery:read')
  async drPlan(
    @Args('planId') planId: string,
    @Context() context: any,
  ): Promise<DRPlanResponse> {
    try {
      const plan = await this.drService.getDRPlan(planId, context.req.tenantId);
      
      return {
        success: true,
        data: plan,
        message: 'DR plan retrieved successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve DR plan: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve DR plan: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  @Mutation(() => DRPlanResponse)
  @RequirePermission('disaster_recovery:update')
  async updateDRPlan(
    @Args('planId') planId: string,
    @Args('input') input: UpdateDRPlanInput,
    @Context() context: any,
  ): Promise<DRPlanResponse> {
    try {
      const plan = await this.drService.updateDRPlan(planId, context.req.tenantId, {
        ...input,
        configuration: input.configuration ? JSON.parse(input.configuration) : undefined,
        userId: context.req.user.id,
      });

      return {
        success: true,
        data: plan,
        message: 'DR plan updated successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update DR plan: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to update DR plan: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  @Mutation(() => Boolean)
  @RequirePermission('disaster_recovery:delete')
  async deleteDRPlan(
    @Args('planId') planId: string,
    @Context() context: any,
  ): Promise<boolean> {
    try {
      await this.drService.deleteDRPlan(planId, context.req.tenantId, context.req.user.id);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete DR plan: ${errorMessage}`);
      return false;
    }
  }

  // Disaster Recovery Executions
  @Mutation(() => DRExecutionResponse)
  @RequirePermission('disaster_recovery:execute')
  async executeDR(
    @Args('planId') planId: string,
    @Args('input') input: ExecuteDRInput,
    @Context() context: any,
  ): Promise<DRExecutionResponse> {
    this.logger.log(`Executing DR plan ${planId} via GraphQL for tenant ${context.req.tenantId}`);

    try {
      const execution = await this.drService.executeDR({
        tenantId: context.req.tenantId,
        planId,
        ...input,
        userId: context.req.user.id,
      });

      // Publish real-time event
      await this.publishDREvent('drExecutionStarted', {
        tenantId: context.req.tenantId,
        planId,
        executionId: execution.id,
        disasterType: input.disasterType,
        isTest: input.isTest,
        userId: context.req.user.id,
        timestamp: new Date(),
      });

      return {
        success: true,
        data: execution,
        message: 'DR execution started successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to execute DR: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to execute DR: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  @Mutation(() => DRExecutionResponse)
  @RequirePermission('disaster_recovery:test')
  async testDRPlan(
    @Args('planId') planId: string,
    @Args('input') input: TestDRPlanInput,
    @Context() context: any,
  ): Promise<DRExecutionResponse> {
    this.logger.log(`Testing DR plan ${planId} via GraphQL for tenant ${context.req.tenantId}`);

    try {
      const execution = await this.drService.testDRPlan({
        tenantId: context.req.tenantId,
        planId,
        ...input,
        userId: context.req.user.id,
      });

      return {
        success: true,
        data: execution,
        message: 'DR test started successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to test DR plan: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to test DR plan: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  @Query(() => DRExecutionsResponse)
  @RequirePermission('disaster_recovery:read')
  async drExecutions(
    @Args('filter', { nullable: true }) filter?: DRExecutionsFilterInput,
    @Context() context?: any,
  ): Promise<DRExecutionsResponse> {
    try {
      const limit = filter?.limit || 50;
      const offset = filter?.offset || 0;
      const result = await this.drService.listDRExecutions(context.req.tenantId, limit, offset);
      
      return {
        success: true,
        data: result.executions,
        message: 'DR executions retrieved successfully',
        total: result.total,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve DR executions: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve DR executions: ${errorMessage}`,
      };
    }
  }

  @Query(() => DRExecutionResponse)
  @RequirePermission('disaster_recovery:read')
  async drExecution(
    @Args('executionId') executionId: string,
    @Context() context: any,
  ): Promise<DRExecutionResponse> {
    try {
      const execution = await this.drService.getDRExecution(executionId, context.req.tenantId);
      
      return {
        success: true,
        data: execution,
        message: 'DR execution retrieved successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve DR execution: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve DR execution: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  // Metrics and Analytics
  @Query(() => DRMetricsResponse)
  @RequirePermission('disaster_recovery:read')
  async drMetrics(@Context() context: any): Promise<DRMetricsResponse> {
    try {
      const metrics = await this.drService.getDRMetrics(context.req.tenantId);
      
      return {
        success: true,
        data: metrics,
        message: 'DR metrics retrieved successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve DR metrics: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve DR metrics: ${errorMessage}`,
      };
    }
  }

  @Query(() => RTOAnalysisResponse)
  @RequirePermission('disaster_recovery:read')
  async rtoAnalysis(
    @Args('planId') planId: string,
    @Context() context: any,
  ): Promise<RTOAnalysisResponse> {
    try {
      const analysis = await this.rtoOptimizationService.analyzeRTOPerformance(
        context.req.tenantId,
        planId
      );
      
      return {
        success: true,
        data: analysis,
        message: 'RTO analysis retrieved successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve RTO analysis: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve RTO analysis: ${errorMessage}`,
      };
    }
  }

  @Query(() => RTOTrendsResponse)
  @RequirePermission('disaster_recovery:read')
  async rtoTrends(@Context() context: any): Promise<RTOTrendsResponse> {
    try {
      const trends = await this.rtoOptimizationService.monitorRTOTrends(context.req.tenantId);
      
      return {
        success: true,
        data: trends,
        message: 'RTO trends retrieved successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve RTO trends: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve RTO trends: ${errorMessage}`,
      };
    }
  }

  @Query(() => RTOImprovementPlanResponse)
  @RequirePermission('disaster_recovery:read')
  async rtoImprovementPlan(
    @Args('planId') planId: string,
    @Context() context: any,
  ): Promise<RTOImprovementPlanResponse> {
    try {
      const plan = await this.rtoOptimizationService.generateRTOImprovementPlan(
        context.req.tenantId,
        planId
      );
      
      return {
        success: true,
        data: plan,
        message: 'RTO improvement plan generated successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate RTO improvement plan: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to generate RTO improvement plan: ${errorMessage}`,
      };
    }
  }

  // Failover Management
  @Mutation(() => FailoverConfigurationResponse)
  @RequirePermission('disaster_recovery:create')
  async createFailoverConfig(
    @Args('input') input: CreateFailoverConfigInput,
    @Context() context: any,
  ): Promise<FailoverConfigurationResponse> {
    try {
      const config = await this.failoverService.createFailoverConfig({
        tenantId: context.req.tenantId,
        ...input,
      });
      
      return {
        success: true,
        data: config,
        message: 'Failover configuration created successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create failover config: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to create failover config: ${errorMessage}`,
      };
    }
  }

  @Query(() => FailoverConfigurationsResponse)
  @RequirePermission('disaster_recovery:read')
  async failoverConfigs(@Context() context: any): Promise<FailoverConfigurationsResponse> {
    try {
      const configs = await this.failoverService.listFailoverConfigs(context.req.tenantId);
      
      return {
        success: true,
        data: configs,
        message: 'Failover configurations retrieved successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve failover configs: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve failover configs: ${errorMessage}`,
      };
    }
  }

  @Mutation(() => FailoverExecutionResponse)
  @RequirePermission('disaster_recovery:execute')
  async executeFailover(
    @Args('input') input: ExecuteFailoverInput,
    @Context() context: any,
  ): Promise<FailoverExecutionResponse> {
    try {
      // First, find the configuration by service name
      const configs = await this.failoverService.listFailoverConfigs(context.req.tenantId);
      const config = configs.find(c => c.serviceName === input.serviceName);
      
      if (!config) {
        return {
          success: false,
          message: `Failover configuration not found for service ${input.serviceName}`,
        };
      }

      const execution = await this.failoverService.executeFailover({
        tenantId: context.req.tenantId,
        configId: config.id,
        failoverType: FailoverType.MANUAL,
        targetEndpoint: input.targetRegion,
        userId: context.req.user.id,
      });

      // Publish real-time event
      await this.publishDREvent('failoverExecuted', {
        tenantId: context.req.tenantId,
        serviceName: input.serviceName,
        targetRegion: input.targetRegion,
        reason: input.reason,
        userId: context.req.user.id,
        timestamp: new Date(),
      });

      // Convert FailoverResult to FailoverExecution format
      const executionData = {
        id: 'temp-id', // This would be generated by the service
        tenantId: context.req.tenantId,
        configurationId: config.id,
        status: execution.success ? 'completed' : 'failed',
        isAutomatic: false,
        reason: input.reason,
        startedAt: new Date(),
        completedAt: execution.success ? new Date() : undefined,
        failoverTimeSeconds: execution.failoverDuration,
        targetRegion: input.targetRegion,
        result: JSON.stringify(execution),
        error: execution.success ? undefined : execution.errors.join(', '),
        initiatedBy: context.req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return {
        success: true,
        data: executionData,
        message: 'Failover executed successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to execute failover: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to execute failover: ${errorMessage}`,
      };
    }
  }

  @Query(() => FailoverMetricsResponse)
  @RequirePermission('disaster_recovery:read')
  async failoverMetrics(@Context() context: any): Promise<FailoverMetricsResponse> {
    try {
      const metrics = await this.failoverService.getFailoverMetrics(context.req.tenantId);
      
      return {
        success: true,
        data: {
          ...metrics,
          lastFailoverAt: new Date(), // This would come from the actual metrics
          healthyEndpoints: 0, // This would be calculated
          unhealthyEndpoints: 0, // This would be calculated
        },
        message: 'Failover metrics retrieved successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve failover metrics: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve failover metrics: ${errorMessage}`,
      };
    }
  }

  // Replication Management
  @Mutation(() => ReplicationConfigurationResponse)
  @RequirePermission('disaster_recovery:create')
  async createReplication(
    @Args('input') input: CreateReplicationInput,
    @Context() context: any,
  ): Promise<ReplicationConfigurationResponse> {
    try {
      const replication = await this.replicationService.createReplication({
        tenantId: context.req.tenantId,
        ...input,
      });
      
      return {
        success: true,
        data: replication,
        message: 'Replication configuration created successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create replication: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to create replication: ${errorMessage}`,
      };
    }
  }

  @Query(() => ReplicationStatusResponse)
  @RequirePermission('disaster_recovery:read')
  async replicationStatus(@Context() context: any): Promise<ReplicationStatusResponse> {
    try {
      const status = await this.replicationService.getReplicationStatus(context.req.tenantId);
      
      return {
        success: true,
        data: status,
        message: 'Replication status retrieved successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve replication status: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve replication status: ${errorMessage}`,
      };
    }
  }

  @Query(() => ReplicationMetricsResponse)
  @RequirePermission('disaster_recovery:read')
  async replicationMetrics(@Context() context: any): Promise<ReplicationMetricsResponse> {
    try {
      const metrics = await this.replicationService.getReplicationMetrics(context.req.tenantId);
      
      return {
        success: true,
        data: metrics,
        message: 'Replication metrics retrieved successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retrieve replication metrics: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to retrieve replication metrics: ${errorMessage}`,
      };
    }
  }

  // Data Management Operations
  @Mutation(() => DRReportResponse)
  @RequirePermission('disaster_recovery:read')
  async generateDRReport(
    @Args('input') input: GenerateReportInput,
    @Context() context: any,
  ): Promise<DRReportResponse> {
    this.logger.log(`Generating DR report for tenant ${context.req.tenantId}`);

    try {
      const report = await this.dataManagementService.generateDRReport({
        tenantId: context.req.tenantId,
        reportType: input.reportType,
        startDate: input.startDate,
        endDate: input.endDate,
        includeTests: input.includeTests,
      });

      return {
        success: true,
        data: report,
        message: 'DR report generated successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate DR report: ${errorMessage}`);
      return {
        success: false,
        message: `Failed to generate DR report: ${errorMessage}`,
      };
    }
  }

  @Mutation(() => Boolean)
  @RequirePermission('disaster_recovery:execute')
  async performGranularRecovery(
    @Args('recoveryType') recoveryType: string,
    @Args('targetDate', { nullable: true }) targetDate?: Date,
    @Args('targetTables', { type: () => [String], nullable: true }) targetTables?: string[],
    @Context() context?: any,
  ): Promise<boolean> {
    try {
      const result = await this.dataManagementService.performGranularRecovery({
        tenantId: context.req.tenantId,
        recoveryType: recoveryType as any,
        targetDate,
        targetTables,
        validateIntegrity: true,
      });

      // Emit recovery event
      this.pubSub.publish('drRecoveryCompleted', {
        drRecoveryCompleted: {
          tenantId: context.req.tenantId,
          recoveryId: result.recoveryId,
          recoveredRecords: result.recoveredRecords,
          status: result.status,
        },
      });

      return result.status === 'completed';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to perform granular recovery: ${errorMessage}`);
      return false;
    }
  }

  // Business Continuity Operations
  @Query(() => String)
  @RequirePermission('disaster_recovery:read')
  async businessContinuityMetrics(@Context() context: any): Promise<string> {
    try {
      const metrics = await this.businessContinuityService.getBusinessContinuityMetrics(context.req.tenantId);
      return JSON.stringify(metrics);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get business continuity metrics: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  @Mutation(() => Boolean)
  @RequirePermission('disaster_recovery:execute')
  async implementGracefulDegradation(
    @Args('serviceName') serviceName: string,
    @Args('degradationLevel') degradationLevel: number,
    @Args('reason') reason: string,
    @Context() context: any,
  ): Promise<boolean> {
    try {
      await this.businessContinuityService.implementGracefulDegradation(
        context.req.tenantId,
        serviceName,
        degradationLevel,
        reason
      );

      // Emit degradation event
      this.pubSub.publish('serviceDegraded', {
        serviceDegraded: {
          tenantId: context.req.tenantId,
          serviceName,
          degradationLevel,
          reason,
          timestamp: new Date(),
        },
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to implement graceful degradation: ${errorMessage}`);
      return false;
    }
  }

  @Mutation(() => Boolean)
  @RequirePermission('disaster_recovery:execute')
  async restoreServiceFromDegradation(
    @Args('serviceName') serviceName: string,
    @Context() context: any,
  ): Promise<boolean> {
    try {
      await this.businessContinuityService.restoreServiceFromDegradation(
        context.req.tenantId,
        serviceName
      );

      // Emit restoration event
      this.pubSub.publish('serviceRestored', {
        serviceRestored: {
          tenantId: context.req.tenantId,
          serviceName,
          timestamp: new Date(),
        },
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to restore service from degradation: ${errorMessage}`);
      return false;
    }
  }

  @Mutation(() => String)
  @RequirePermission('disaster_recovery:test')
  async testBusinessContinuity(
    @Args('testType') testType: string,
    @Context() context: any,
  ): Promise<string> {
    try {
      const result = await this.businessContinuityService.testBusinessContinuity(
        context.req.tenantId,
        testType as any
      );

      // Emit test completion event
      this.pubSub.publish('businessContinuityTestCompleted', {
        businessContinuityTestCompleted: {
          tenantId: context.req.tenantId,
          testId: result.testId,
          testType: result.testType,
          status: result.status,
          results: result.results,
        },
      });

      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to test business continuity: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  // Procedure Validation Operations
  @Query(() => String)
  @RequirePermission('disaster_recovery:read')
  async validateDRProcedures(
    @Args('planId') planId: string,
    @Context() context: any,
  ): Promise<string> {
    try {
      const validation = await this.proceduresService.validateProcedures(planId, context.req.tenantId);
      return JSON.stringify(validation);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to validate DR procedures: ${errorMessage}`);
      return JSON.stringify({ error: errorMessage });
    }
  }

  @Query(() => [String])
  @RequirePermission('disaster_recovery:read')
  async generateStandardProcedures(
    @Args('disasterType') disasterType: string,
  ): Promise<string[]> {
    try {
      const procedures = this.proceduresService.generateStandardProcedures(disasterType as any);
      return procedures.map(p => JSON.stringify(p));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate standard procedures: ${errorMessage}`);
      return [JSON.stringify({ error: errorMessage })];
    }
  }

  // Real-time Subscriptions
  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.drExecutionStarted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  drExecutionStarted(@Context() context: any) {
    return this.pubSub.asyncIterator('drExecutionStarted');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.drExecutionCompleted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  drExecutionCompleted(@Context() context: any) {
    return this.pubSub.asyncIterator('drExecutionCompleted');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.failoverExecuted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  failoverExecuted(@Context() context: any) {
    return this.pubSub.asyncIterator('failoverExecuted');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.replicationLagWarning.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  replicationLagWarning(@Context() context: any) {
    return this.pubSub.asyncIterator('replicationLagWarning');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.serviceDegraded.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  serviceDegraded(@Context() context: any) {
    return this.pubSub.asyncIterator('serviceDegraded');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.serviceRestored.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  serviceRestored(@Context() context: any) {
    return this.pubSub.asyncIterator('serviceRestored');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.drRecoveryCompleted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  drRecoveryCompleted(@Context() context: any) {
    return this.pubSub.asyncIterator('drRecoveryCompleted');
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.businessContinuityTestCompleted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('disaster_recovery:read')
  businessContinuityTestCompleted(@Context() context: any) {
    return this.pubSub.asyncIterator('businessContinuityTestCompleted');
  }

  // Field Resolvers for computed fields and related data
  @ResolveField(() => String)
  async healthStatus(@Parent() plan: DisasterRecoveryPlan): Promise<string> {
    try {
      const metrics = await this.drService.getDRMetrics(plan.tenantId);
      if (metrics.healthScore >= 95) return 'excellent';
      if (metrics.healthScore >= 85) return 'good';
      if (metrics.healthScore >= 70) return 'fair';
      return 'poor';
    } catch (error) {
      return 'unknown';
    }
  }

  @ResolveField(() => Number)
  async estimatedRTO(@Parent() plan: DisasterRecoveryPlan): Promise<number> {
    try {
      const analysis = await this.rtoOptimizationService.analyzeRTOPerformance(plan.tenantId, plan.id);
      return analysis.averageRtoMinutes;
    } catch (error) {
      return plan.rtoMinutes;
    }
  }

  @ResolveField(() => [String])
  async activeFailovers(@Parent() plan: DisasterRecoveryPlan): Promise<string[]> {
    try {
      const configs = await this.failoverService.listFailoverConfigs(plan.tenantId);
      return configs.filter(c => c.isActive).map(c => c.serviceName);
    } catch (error) {
      return [];
    }
  }

  @ResolveField(() => [String])
  async replicationStatus(@Parent() plan: DisasterRecoveryPlan): Promise<string[]> {
    try {
      const status = await this.replicationService.getReplicationStatus(plan.tenantId);
      return status.map(s => `${s.sourceRegion} -> ${s.targetRegion}: ${s.status}`);
    } catch (error) {
      return [];
    }
  }

  @ResolveField(() => String)
  async lastTestResult(@Parent() plan: DisasterRecoveryPlan): Promise<string> {
    try {
      const executions = await this.drService.listDRExecutions(plan.tenantId, 10, 0);
      const lastTest = executions.executions.find(e => e.isTest && e.planId === plan.id);
      return lastTest ? lastTest.status : 'never_tested';
    } catch (error) {
      return 'unknown';
    }
  }

  @ResolveField(() => Number)
  async costEstimate(@Parent() plan: DisasterRecoveryPlan): Promise<number> {
    try {
      // Calculate estimated monthly cost based on plan configuration
      const baseCost = 100; // Base cost per plan
      const regionCost = plan.secondaryRegions.length * 50; // Cost per secondary region
      const automationCost = plan.automaticFailover ? 25 : 0; // Automation premium
      return baseCost + regionCost + automationCost;
    } catch (error) {
      return 0;
    }
  }

  @ResolveField(() => String)
  async complianceStatus(@Parent() plan: DisasterRecoveryPlan): Promise<string> {
    try {
      const validation = await this.proceduresService.validateProcedures(plan.id, plan.tenantId);
      if (validation.isValid && validation.issues.length === 0) return 'compliant';
      if (validation.issues.length <= 2) return 'minor_issues';
      return 'non_compliant';
    } catch (error) {
      return 'unknown';
    }
  }

  // Enhanced existing methods with event publishing
  private async publishDREvent(eventType: string, data: any): Promise<void> {
    try {
      this.pubSub.publish(eventType, { [eventType]: data });
    } catch (error) {
      this.logger.error(`Failed to publish event ${eventType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }