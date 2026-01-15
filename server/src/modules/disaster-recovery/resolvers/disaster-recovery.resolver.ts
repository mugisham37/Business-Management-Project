import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';

import { DisasterRecoveryService } from '../services/disaster-recovery.service';
import { RecoveryTimeOptimizationService } from '../services/recovery-time-optimization.service';
import { FailoverService } from '../services/failover.service';
import { ReplicationService } from '../services/replication.service';

import {
  DisasterRecoveryPlan,
  DisasterRecoveryExecution,
  DisasterRecoveryMetrics,
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
} from '../dto/disaster-recovery.dto';

@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class DisasterRecoveryResolver {
  private readonly logger = new Logger(DisasterRecoveryResolver.name);

  constructor(
    private readonly drService: DisasterRecoveryService,
    private readonly rtoOptimizationService: RecoveryTimeOptimizationService,
    private readonly failoverService: FailoverService,
    private readonly replicationService: ReplicationService,
  ) {}

  // Disaster Recovery Plans
  @Mutation(() => DisasterRecoveryPlan)
  @RequirePermission('disaster_recovery:create')
  async createDRPlan(
    @Args('input') input: CreateDRPlanInput,
    @Context() context: any,
  ): Promise<DisasterRecoveryPlan> {
    this.logger.log(`Creating DR plan via GraphQL for tenant ${context.req.tenantId}`);

    return this.drService.createDRPlan({
      tenantId: context.req.tenantId,
      ...input,
      configuration: input.configuration || {},
      userId: context.req.user.id,
    });
  }

  @Query(() => [DisasterRecoveryPlan])
  @RequirePermission('disaster_recovery:read')
  async drPlans(@Context() context: any): Promise<DisasterRecoveryPlan[]> {
    return this.drService.listDRPlans(context.req.tenantId);
  }

  @Query(() => DisasterRecoveryPlan)
  @RequirePermission('disaster_recovery:read')
  async drPlan(
    @Args('planId') planId: string,
    @Context() context: any,
  ): Promise<DisasterRecoveryPlan> {
    return this.drService.getDRPlan(planId, context.req.tenantId);
  }

  @Mutation(() => DisasterRecoveryPlan)
  @RequirePermission('disaster_recovery:update')
  async updateDRPlan(
    @Args('planId') planId: string,
    @Args('input') input: UpdateDRPlanInput,
    @Context() context: any,
  ): Promise<DisasterRecoveryPlan> {
    return this.drService.updateDRPlan(planId, context.req.tenantId, {
      ...input,
      userId: context.req.user.id,
    });
  }

  @Mutation(() => Boolean)
  @RequirePermission('disaster_recovery:delete')
  async deleteDRPlan(
    @Args('planId') planId: string,
    @Context() context: any,
  ): Promise<boolean> {
    await this.drService.deleteDRPlan(planId, context.req.tenantId, context.req.user.id);
    return true;
  }

  // Disaster Recovery Executions
  @Mutation(() => DisasterRecoveryExecution)
  @RequirePermission('disaster_recovery:execute')
  async executeDR(
    @Args('planId') planId: string,
    @Args('input') input: ExecuteDRInput,
    @Context() context: any,
  ): Promise<DisasterRecoveryExecution> {
    this.logger.log(`Executing DR plan ${planId} via GraphQL for tenant ${context.req.tenantId}`);

    return this.drService.executeDR({
      tenantId: context.req.tenantId,
      planId,
      ...input,
      userId: context.req.user.id,
    });
  }

  @Mutation(() => DisasterRecoveryExecution)
  @RequirePermission('disaster_recovery:test')
  async testDRPlan(
    @Args('planId') planId: string,
    @Args('input') input: TestDRPlanInput,
    @Context() context: any,
  ): Promise<DisasterRecoveryExecution> {
    this.logger.log(`Testing DR plan ${planId} via GraphQL for tenant ${context.req.tenantId}`);

    return this.drService.testDRPlan({
      tenantId: context.req.tenantId,
      planId,
      ...input,
      userId: context.req.user.id,
    });
  }

  @Query(() => [DisasterRecoveryExecution])
  @RequirePermission('disaster_recovery:read')
  async drExecutions(
    @Args('limit', { defaultValue: 50 }) limit: number,
    @Args('offset', { defaultValue: 0 }) offset: number,
    @Context() context: any,
  ): Promise<DisasterRecoveryExecution[]> {
    const result = await this.drService.listDRExecutions(context.req.tenantId, limit, offset);
    return result.executions;
  }

  @Query(() => DisasterRecoveryExecution)
  @RequirePermission('disaster_recovery:read')
  async drExecution(
    @Args('executionId') executionId: string,
    @Context() context: any,
  ): Promise<DisasterRecoveryExecution> {
    return this.drService.getDRExecution(executionId, context.req.tenantId);
  }

  // Metrics and Analytics
  @Query(() => DisasterRecoveryMetrics)
  @RequirePermission('disaster_recovery:read')
  async drMetrics(@Context() context: any): Promise<DisasterRecoveryMetrics> {
    return this.drService.getDRMetrics(context.req.tenantId);
  }

  @Query(() => String) // Return type should be RTOAnalysis but using String for simplicity
  @RequirePermission('disaster_recovery:read')
  async rtoAnalysis(
    @Args('planId') planId: string,
    @Context() context: any,
  ): Promise<string> {
    const analysis = await this.rtoOptimizationService.analyzeRTOPerformance(
      context.req.tenantId,
      planId
    );
    return JSON.stringify(analysis);
  }

  @Query(() => String) // Return type should be RTOTrends but using String for simplicity
  @RequirePermission('disaster_recovery:read')
  async rtoTrends(@Context() context: any): Promise<string> {
    const trends = await this.rtoOptimizationService.monitorRTOTrends(context.req.tenantId);
    return JSON.stringify(trends);
  }

  @Query(() => String) // Return type should be RTOImprovementPlan but using String for simplicity
  @RequirePermission('disaster_recovery:read')
  async rtoImprovementPlan(
    @Args('planId') planId: string,
    @Context() context: any,
  ): Promise<string> {
    const plan = await this.rtoOptimizationService.generateRTOImprovementPlan(
      context.req.tenantId,
      planId
    );
    return JSON.stringify(plan);
  }

  // Failover Management
  @Mutation(() => String) // Return type should be FailoverConfiguration but using String for simplicity
  @RequirePermission('disaster_recovery:create')
  async createFailoverConfig(
    @Args('input') input: CreateFailoverConfigInput,
    @Context() context: any,
  ): Promise<string> {
    const config = await this.failoverService.createFailoverConfig({
      tenantId: context.req.tenantId,
      ...input,
    });
    return JSON.stringify(config);
  }

  @Query(() => String) // Return type should be [FailoverConfiguration] but using String for simplicity
  @RequirePermission('disaster_recovery:read')
  async failoverConfigs(@Context() context: any): Promise<string> {
    const configs = await this.failoverService.listFailoverConfigs(context.req.tenantId);
    return JSON.stringify(configs);
  }

  @Mutation(() => String) // Return type should be FailoverExecution but using String for simplicity
  @RequirePermission('disaster_recovery:execute')
  async executeFailover(
    @Args('input') input: ExecuteFailoverInput,
    @Context() context: any,
  ): Promise<string> {
    // First, find the configuration by service name
    const configs = await this.failoverService.listFailoverConfigs(context.req.tenantId);
    const config = configs.find(c => c.serviceName === input.serviceName);
    
    if (!config) {
      throw new Error(`Failover configuration not found for service ${input.serviceName}`);
    }

    const execution = await this.failoverService.executeFailover({
      tenantId: context.req.tenantId,
      configId: config.id,
      failoverType: FailoverType.MANUAL,
      targetEndpoint: input.targetRegion,
      userId: context.req.user.id,
    });
    return JSON.stringify(execution);
  }

  @Query(() => String) // Return type should be FailoverMetrics but using String for simplicity
  @RequirePermission('disaster_recovery:read')
  async failoverMetrics(@Context() context: any): Promise<string> {
    const metrics = await this.failoverService.getFailoverMetrics(context.req.tenantId);
    return JSON.stringify(metrics);
  }

  // Replication Management
  @Mutation(() => String) // Return type should be ReplicationConfiguration but using String for simplicity
  @RequirePermission('disaster_recovery:create')
  async createReplication(
    @Args('input') input: CreateReplicationInput,
    @Context() context: any,
  ): Promise<string> {
    const replication = await this.replicationService.createReplication({
      tenantId: context.req.tenantId,
      ...input,
    });
    return JSON.stringify(replication);
  }

  @Query(() => String) // Return type should be [ReplicationStatus] but using String for simplicity
  @RequirePermission('disaster_recovery:read')
  async replicationStatus(@Context() context: any): Promise<string> {
    const status = await this.replicationService.getReplicationStatus(context.req.tenantId);
    return JSON.stringify(status);
  }

  @Query(() => String) // Return type should be ReplicationMetrics but using String for simplicity
  @RequirePermission('disaster_recovery:read')
  async replicationMetrics(@Context() context: any): Promise<string> {
    const metrics = await this.replicationService.getReplicationMetrics(context.req.tenantId);
    return JSON.stringify(metrics);
  }

  @Query(() => String) // Return type should be [ReplicationTrend] but using String for simplicity
  @RequirePermission('disaster_recovery:read')
  async replicationTrends(
    @Args('hours', { defaultValue: 24 }) hours: number,
    @Context() context: any,
  ): Promise<string> {
    const trends = await this.replicationService.getReplicationTrends(context.req.tenantId, hours);
    return JSON.stringify(trends);
  }
}