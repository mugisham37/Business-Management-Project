import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';

import { DisasterRecoveryService } from '../services/disaster-recovery.service';
import { RecoveryTimeOptimizationService } from '../services/recovery-time-optimization.service';
import { FailoverService } from '../services/failover.service';
import { ReplicationService } from '../services/replication.service';

import {
  CreateDRPlanDto,
  UpdateDRPlanDto,
  ExecuteDRDto,
  TestDRPlanDto,
  DRPlanResponseDto,
  DRExecutionResponseDto,
  DRMetricsResponseDto,
  RTOAnalysisResponseDto,
  CreateFailoverConfigDto,
  FailoverConfigResponseDto,
  ExecuteFailoverDto,
  CreateReplicationDto,
  ReplicationStatusResponseDto,
} from '../dto/disaster-recovery.dto';

@ApiTags('Disaster Recovery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('disaster-recovery')
export class DisasterRecoveryController {
  private readonly logger = new Logger(DisasterRecoveryController.name);

  constructor(
    private readonly drService: DisasterRecoveryService,
    private readonly rtoOptimizationService: RecoveryTimeOptimizationService,
    private readonly failoverService: FailoverService,
    private readonly replicationService: ReplicationService,
  ) {}

  // Disaster Recovery Plans
  @Post('plans')
  @RequirePermission('disaster_recovery:create')
  @ApiOperation({ summary: 'Create disaster recovery plan' })
  @ApiResponse({ status: HttpStatus.CREATED, type: DRPlanResponseDto })
  async createDRPlan(
    @Body() createDRPlanDto: CreateDRPlanDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<DRPlanResponseDto> {
    this.logger.log(`Creating DR plan for tenant ${tenantId}`);

    const plan = await this.drService.createDRPlan({
      tenantId,
      ...createDRPlanDto,
      configuration: createDRPlanDto.configuration || {},
      userId: user.id,
    });

    return {
      success: true,
      data: plan,
      message: 'Disaster recovery plan created successfully',
    };
  }

  @Get('plans')
  @RequirePermission('disaster_recovery:read')
  @ApiOperation({ summary: 'List disaster recovery plans' })
  @ApiResponse({ status: HttpStatus.OK, type: [DRPlanResponseDto] })
  async listDRPlans(
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean; data: any[]; total: number }> {
    const plans = await this.drService.listDRPlans(tenantId);

    return {
      success: true,
      data: plans,
      total: plans.length,
    };
  }

  @Get('plans/:planId')
  @RequirePermission('disaster_recovery:read')
  @ApiOperation({ summary: 'Get disaster recovery plan by ID' })
  @ApiResponse({ status: HttpStatus.OK, type: DRPlanResponseDto })
  async getDRPlan(
    @Param('planId') planId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<DRPlanResponseDto> {
    const plan = await this.drService.getDRPlan(planId, tenantId);

    return {
      success: true,
      data: plan,
      message: 'Disaster recovery plan retrieved successfully',
    };
  }

  @Put('plans/:planId')
  @RequirePermission('disaster_recovery:update')
  @ApiOperation({ summary: 'Update disaster recovery plan' })
  @ApiResponse({ status: HttpStatus.OK, type: DRPlanResponseDto })
  async updateDRPlan(
    @Param('planId') planId: string,
    @Body() updateDRPlanDto: UpdateDRPlanDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<DRPlanResponseDto> {
    const plan = await this.drService.updateDRPlan(planId, tenantId, {
      ...updateDRPlanDto,
      userId: user.id,
    });

    return {
      success: true,
      data: plan,
      message: 'Disaster recovery plan updated successfully',
    };
  }

  @Delete('plans/:planId')
  @RequirePermission('disaster_recovery:delete')
  @ApiOperation({ summary: 'Delete disaster recovery plan' })
  @ApiResponse({ status: HttpStatus.OK })
  async deleteDRPlan(
    @Param('planId') planId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    await this.drService.deleteDRPlan(planId, tenantId, user.id);

    return {
      success: true,
      message: 'Disaster recovery plan deleted successfully',
    };
  }

  // Disaster Recovery Executions
  @Post('plans/:planId/execute')
  @RequirePermission('disaster_recovery:execute')
  @ApiOperation({ summary: 'Execute disaster recovery plan' })
  @ApiResponse({ status: HttpStatus.CREATED, type: DRExecutionResponseDto })
  async executeDR(
    @Param('planId') planId: string,
    @Body() executeDRDto: ExecuteDRDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<DRExecutionResponseDto> {
    this.logger.log(`Executing DR plan ${planId} for tenant ${tenantId}`);

    const execution = await this.drService.executeDR({
      tenantId,
      planId,
      ...executeDRDto,
      userId: user.id,
    });

    return {
      success: true,
      data: execution,
      message: 'Disaster recovery execution initiated successfully',
    };
  }

  @Post('plans/:planId/test')
  @RequirePermission('disaster_recovery:test')
  @ApiOperation({ summary: 'Test disaster recovery plan' })
  @ApiResponse({ status: HttpStatus.CREATED, type: DRExecutionResponseDto })
  async testDRPlan(
    @Param('planId') planId: string,
    @Body() testDRPlanDto: TestDRPlanDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<DRExecutionResponseDto> {
    this.logger.log(`Testing DR plan ${planId} for tenant ${tenantId}`);

    const execution = await this.drService.testDRPlan({
      tenantId,
      planId,
      ...testDRPlanDto,
      userId: user.id,
    });

    return {
      success: true,
      data: execution,
      message: 'Disaster recovery test initiated successfully',
    };
  }

  @Get('executions')
  @RequirePermission('disaster_recovery:read')
  @ApiOperation({ summary: 'List disaster recovery executions' })
  @ApiResponse({ status: HttpStatus.OK })
  async listDRExecutions(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ): Promise<{ success: boolean; data: any[]; total: number }> {
    const result = await this.drService.listDRExecutions(tenantId, limit, offset);

    return {
      success: true,
      data: result.executions,
      total: result.total,
    };
  }

  @Get('executions/:executionId')
  @RequirePermission('disaster_recovery:read')
  @ApiOperation({ summary: 'Get disaster recovery execution by ID' })
  @ApiResponse({ status: HttpStatus.OK, type: DRExecutionResponseDto })
  async getDRExecution(
    @Param('executionId') executionId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<DRExecutionResponseDto> {
    const execution = await this.drService.getDRExecution(executionId, tenantId);

    return {
      success: true,
      data: execution,
      message: 'Disaster recovery execution retrieved successfully',
    };
  }

  // Metrics and Analytics
  @Get('metrics')
  @RequirePermission('disaster_recovery:read')
  @ApiOperation({ summary: 'Get disaster recovery metrics' })
  @ApiResponse({ status: HttpStatus.OK, type: DRMetricsResponseDto })
  async getDRMetrics(
    @CurrentTenant() tenantId: string,
  ): Promise<DRMetricsResponseDto> {
    const metrics = await this.drService.getDRMetrics(tenantId);

    return {
      success: true,
      data: metrics,
      message: 'Disaster recovery metrics retrieved successfully',
    };
  }

  @Get('plans/:planId/rto-analysis')
  @RequirePermission('disaster_recovery:read')
  @ApiOperation({ summary: 'Analyze RTO performance for plan' })
  @ApiResponse({ status: HttpStatus.OK, type: RTOAnalysisResponseDto })
  async analyzeRTOPerformance(
    @Param('planId') planId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<RTOAnalysisResponseDto> {
    const analysis = await this.rtoOptimizationService.analyzeRTOPerformance(tenantId, planId);

    return {
      success: true,
      data: analysis,
      message: 'RTO analysis completed successfully',
    };
  }

  @Get('rto-trends')
  @RequirePermission('disaster_recovery:read')
  @ApiOperation({ summary: 'Get RTO trends for tenant' })
  @ApiResponse({ status: HttpStatus.OK })
  async getRTOTrends(
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean; data: any }> {
    const trends = await this.rtoOptimizationService.monitorRTOTrends(tenantId);

    return {
      success: true,
      data: trends,
    };
  }

  // Failover Management
  @Post('failover/configurations')
  @RequirePermission('disaster_recovery:create')
  @ApiOperation({ summary: 'Create failover configuration' })
  @ApiResponse({ status: HttpStatus.CREATED, type: FailoverConfigResponseDto })
  async createFailoverConfig(
    @Body() createFailoverConfigDto: CreateFailoverConfigDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<FailoverConfigResponseDto> {
    const config = await this.failoverService.createFailoverConfig({
      tenantId,
      ...createFailoverConfigDto,
    });

    return {
      success: true,
      data: config,
      message: 'Failover configuration created successfully',
    };
  }

  @Get('failover/configurations')
  @RequirePermission('disaster_recovery:read')
  @ApiOperation({ summary: 'List failover configurations' })
  @ApiResponse({ status: HttpStatus.OK })
  async listFailoverConfigs(
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean; data: any[] }> {
    const configs = await this.failoverService.listFailoverConfigs(tenantId);

    return {
      success: true,
      data: configs,
    };
  }

  @Post('failover/execute')
  @RequirePermission('disaster_recovery:execute')
  @ApiOperation({ summary: 'Execute failover' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async executeFailover(
    @Body() executeFailoverDto: ExecuteFailoverDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; data: any; message: string }> {
    // Find the failover configuration for the service
    const configs = await this.failoverService.listFailoverConfigs(tenantId);
    const config = configs.find(c => c.serviceName === executeFailoverDto.serviceName);
    
    if (!config) {
      throw new Error(`No failover configuration found for service ${executeFailoverDto.serviceName}`);
    }

    const execution = await this.failoverService.executeFailover({
      tenantId,
      configId: config.id,
      failoverType: config.failoverType,
      targetEndpoint: executeFailoverDto.targetRegion,
      userId: user.id,
    });

    return {
      success: true,
      data: execution,
      message: 'Failover execution initiated successfully',
    };
  }

  // Replication Management
  @Post('replication')
  @RequirePermission('disaster_recovery:create')
  @ApiOperation({ summary: 'Create replication configuration' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async createReplication(
    @Body() createReplicationDto: CreateReplicationDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean; data: any; message: string }> {
    const replication = await this.replicationService.createReplication({
      tenantId,
      ...createReplicationDto,
    });

    return {
      success: true,
      data: replication,
      message: 'Replication configuration created successfully',
    };
  }

  @Get('replication/status')
  @RequirePermission('disaster_recovery:read')
  @ApiOperation({ summary: 'Get replication status' })
  @ApiResponse({ status: HttpStatus.OK, type: ReplicationStatusResponseDto })
  async getReplicationStatus(
    @CurrentTenant() tenantId: string,
  ): Promise<ReplicationStatusResponseDto> {
    const status = await this.replicationService.getReplicationStatus(tenantId);

    return {
      success: true,
      data: status,
      message: 'Replication status retrieved successfully',
    };
  }
}