import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent, Subscription } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { B2BWorkflowService } from '../services/b2b-workflow.service';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import {
  WorkflowQueryInput,
  ApprovalStepInput,
  ReassignApprovalInput,
  WorkflowType,
  WorkflowsResponse,
  ApprovalStepType,
  PendingApprovalsResponse,
  WorkflowHistoryResponse,
  ApprovalStepResponse,
  EntityType,
  WorkflowAnalyticsType
} from '../types/workflow.types';

/**
 * GraphQL resolver for B2B workflow management
 * 
 * Provides operations for:
 * - Approval workflow orchestration
 * - Multi-step approval processes
 * - Pending approval queries
 * - Workflow history and audit trails
 * - Real-time approval notifications
 * - Approval reassignment
 * 
 * @requires JwtAuthGuard - Authentication required for all operations
 * @requires TenantGuard - Tenant isolation enforced
 * @requires PermissionsGuard - Permission-based access control
 */
@Resolver(() => WorkflowType)
@UseGuards(JwtAuthGuard, TenantGuard)
export class WorkflowResolver extends BaseResolver {
  private readonly logger = new Logger(WorkflowResolver.name);

  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly workflowService: B2BWorkflowService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  /**
   * Query: Get workflow by ID
   * @permission workflow:read
   */
  @Query(() => WorkflowType)
  @UseGuards(PermissionsGuard)
  @Permissions('workflow:read')
  async getWorkflow(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<WorkflowType> {
    try {
      this.logger.debug(`Fetching workflow ${id} for tenant ${tenantId}`);
      return await this.workflowService.getWorkflow(tenantId, id);
    } catch (error) {
      this.logger.error(`Failed to get workflow ${id}:`, error);
      throw error;
    }
  }

  /**
   * Query: Get workflows with filtering
   * @permission workflow:read
   */
  @Query(() => WorkflowsResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('workflow:read')
  async getWorkflows(
    @Args('query') query: WorkflowQueryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<WorkflowsResponse> {
    try {
      this.logger.debug(`Fetching workflows for tenant ${tenantId}`);
      
      const result = await this.workflowService.getWorkflows(tenantId, query);
      
      return {
        workflows: result.workflows,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(`Failed to get workflows:`, error);
      throw error;
    }
  }

  /**
   * Query: Get pending approvals for current user
   * @permission workflow:read
   */
  @Query(() => PendingApprovalsResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('workflow:read')
  async getPendingApprovals(
    @Args('entityType', { type: () => EntityType, nullable: true }) entityType?: EntityType,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PendingApprovalsResponse> {
    try {
      this.logger.debug(`Fetching pending approvals for user ${user.id}`);
      
      const result = await this.workflowService.getPendingApprovals(
        tenantId,
        user.id,
        entityType,
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get pending approvals:`, error);
      throw error;
    }
  }

  /**
   * Query: Get workflow history for an entity
   * @permission workflow:read
   */
  @Query(() => WorkflowHistoryResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('workflow:read')
  async getWorkflowHistory(
    @Args('entityId', { type: () => ID }) entityId: string,
    @Args('entityType', { type: () => EntityType }) entityType: EntityType,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<WorkflowHistoryResponse> {
    try {
      this.logger.debug(`Fetching workflow history for entity ${entityId}`);
      
      const result = await this.workflowService.getWorkflowHistory(
        tenantId,
        entityId,
        entityType,
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get workflow history:`, error);
      throw error;
    }
  }

  /**
   * Query: Get workflow analytics
   * @permission workflow:read
   */
  @Query(() => WorkflowAnalyticsType)
  @UseGuards(PermissionsGuard)
  @Permissions('workflow:read')
  async getWorkflowAnalytics(
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
    @Args('entityType', { type: () => EntityType, nullable: true }) entityType?: EntityType,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<WorkflowAnalyticsType> {
    try {
      this.logger.debug(`Fetching workflow analytics for tenant ${tenantId}`);
      
      return await this.workflowService.getWorkflowAnalytics(
        tenantId,
        startDate,
        endDate,
        entityType,
      );
    } catch (error) {
      this.logger.error(`Failed to get workflow analytics:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Approve a workflow step
   * @permission workflow:approve
   */
  @Mutation(() => ApprovalStepResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('workflow:approve')
  async approveStep(
    @Args('workflowId', { type: () => ID }) workflowId: string,
    @Args('stepId', { type: () => ID }) stepId: string,
    @Args('input') input: ApprovalStepInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ApprovalStepResponse> {
    try {
      this.logger.log(`Approving workflow step ${stepId} by user ${user.id}`);
      
      const result = await this.workflowService.approveStep(
        tenantId,
        workflowId,
        stepId,
        user.id,
        input.approvalNotes,
        input.attachments ? JSON.parse(input.attachments) : undefined,
      );

      // Publish approval event
      await this.pubSub.publish('WORKFLOW_STEP_APPROVED', {
        workflowStepApproved: {
          tenantId,
          workflowId,
          stepId,
          approvedBy: user.id,
          approvedAt: new Date(),
        },
      });

      this.logger.log(`Approved workflow step ${stepId}`);
      return {
        step: result.step,
        workflow: result.workflow,
        message: 'Workflow step approved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to approve workflow step ${stepId}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Reject a workflow step
   * @permission workflow:approve
   */
  @Mutation(() => ApprovalStepResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('workflow:approve')
  async rejectStep(
    @Args('workflowId', { type: () => ID }) workflowId: string,
    @Args('stepId', { type: () => ID }) stepId: string,
    @Args('rejectionReason') rejectionReason: string,
    @Args('input', { nullable: true }) input?: ApprovalStepInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ApprovalStepResponse> {
    try {
      this.logger.log(`Rejecting workflow step ${stepId} by user ${user.id}`);
      
      const result = await this.workflowService.rejectStep(
        tenantId,
        workflowId,
        stepId,
        user.id,
        rejectionReason,
        input?.attachments ? JSON.parse(input.attachments) : undefined,
      );

      // Publish rejection event
      await this.pubSub.publish('WORKFLOW_STEP_REJECTED', {
        workflowStepRejected: {
          tenantId,
          workflowId,
          stepId,
          rejectedBy: user.id,
          rejectedAt: new Date(),
          rejectionReason,
        },
      });

      this.logger.log(`Rejected workflow step ${stepId}`);
      return {
        step: result.step,
        workflow: result.workflow,
        message: 'Workflow step rejected successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to reject workflow step ${stepId}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Reassign approval to another user
   * @permission workflow:reassign
   */
  @Mutation(() => ApprovalStepResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('workflow:reassign')
  async reassignApproval(
    @Args('workflowId', { type: () => ID }) workflowId: string,
    @Args('stepId', { type: () => ID }) stepId: string,
    @Args('input') input: ReassignApprovalInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ApprovalStepResponse> {
    try {
      this.logger.log(`Reassigning workflow step ${stepId} from ${user.id} to ${input.newApproverId}`);
      
      const result = await this.workflowService.reassignApproval(
        tenantId,
        workflowId,
        stepId,
        user.id,
        input.newApproverId,
        input.reassignmentReason,
        input.notes,
      );

      // Publish reassignment event
      await this.pubSub.publish('WORKFLOW_STEP_REASSIGNED', {
        workflowStepReassigned: {
          tenantId,
          workflowId,
          stepId,
          reassignedFrom: user.id,
          reassignedTo: input.newApproverId,
          reassignedAt: new Date(),
          reason: input.reassignmentReason,
        },
      });

      this.logger.log(`Reassigned workflow step ${stepId} to ${input.newApproverId}`);
      return {
        step: result.step,
        workflow: result.workflow,
        message: 'Workflow step reassigned successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to reassign workflow step ${stepId}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load workflow steps
   */
  @ResolveField('steps')
  async getSteps(
    @Parent() workflow: WorkflowType,
    @CurrentTenant() tenantId: string,
  ): Promise<ApprovalStepType[]> {
    try {
      return await this.workflowService.getWorkflowSteps(tenantId, workflow.id);
    } catch (error) {
      this.logger.error(`Failed to load steps for workflow ${workflow.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load workflow initiator
   */
  @ResolveField('initiator')
  async getInitiator(
    @Parent() workflow: WorkflowType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!workflow.initiatedBy) {
        return null;
      }

      // DataLoader implementation would go here
      return {
        id: workflow.initiatedBy,
        // Additional user fields would be loaded via DataLoader
      };
    } catch (error) {
      this.logger.error(`Failed to load initiator for workflow ${workflow.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load related entity
   */
  @ResolveField('entity')
  async getEntity(
    @Parent() workflow: WorkflowType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      // Load entity based on entityType and entityId
      return await this.workflowService.getWorkflowEntity(
        tenantId,
        workflow.entityType,
        workflow.entityId,
      );
    } catch (error) {
      this.logger.error(`Failed to load entity for workflow ${workflow.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Get current approval step
   */
  @ResolveField('currentApprovalStep')
  async getCurrentApprovalStep(
    @Parent() workflow: WorkflowType,
    @CurrentTenant() tenantId: string,
  ): Promise<ApprovalStepType | null> {
    try {
      return await this.workflowService.getCurrentApprovalStep(tenantId, workflow.id);
    } catch (error) {
      this.logger.error(`Failed to load current approval step for workflow ${workflow.id}:`, error);
      return null;
    }
  }

  /**
   * Field Resolver: Check if workflow is expired
   */
  @ResolveField('isExpired')
  async getIsExpired(
    @Parent() workflow: WorkflowType,
  ): Promise<boolean> {
    if (!workflow.expiresAt) {
      return false;
    }
    return new Date() > new Date(workflow.expiresAt);
  }

  /**
   * Field Resolver: Calculate days until expiration
   */
  @ResolveField('daysUntilExpiration')
  async getDaysUntilExpiration(
    @Parent() workflow: WorkflowType,
  ): Promise<number> {
    if (!workflow.expiresAt) {
      return -1;
    }
    
    const now = new Date();
    const expirationDate = new Date(workflow.expiresAt);
    const diffTime = expirationDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Field Resolver: Check if workflow can be approved
   */
  @ResolveField('canBeApproved')
  async getCanBeApproved(
    @Parent() workflow: WorkflowType,
  ): Promise<boolean> {
    return workflow.status === 'pending' || workflow.status === 'in_progress';
  }

  /**
   * Field Resolver: Check if workflow can be rejected
   */
  @ResolveField('canBeRejected')
  async getCanBeRejected(
    @Parent() workflow: WorkflowType,
  ): Promise<boolean> {
    return workflow.status === 'pending' || workflow.status === 'in_progress';
  }

  /**
   * Field Resolver: Load approver for approval step
   */
  @ResolveField('approver', { of: () => ApprovalStepType })
  async getApprover(
    @Parent() step: ApprovalStepType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!step.approverId) {
        return null;
      }

      // DataLoader implementation would go here
      return {
        id: step.approverId,
        // Additional user fields would be loaded via DataLoader
      };
    } catch (error) {
      this.logger.error(`Failed to load approver for step ${step.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load workflow for approval step
   */
  @ResolveField('workflow', { of: () => ApprovalStepType })
  async getWorkflowForStep(
    @Parent() step: ApprovalStepType,
    @CurrentTenant() tenantId: string,
  ): Promise<WorkflowType> {
    try {
      return await this.workflowService.getWorkflow(tenantId, step.workflowId);
    } catch (error) {
      this.logger.error(`Failed to load workflow for step ${step.id}:`, error);
      throw error;
    }
  }

  /**
   * Subscription: Workflow step approved
   * Filters events by tenant for multi-tenant isolation
   */
  @Subscription('workflowStepApproved', {
    filter: (payload, variables, context) => {
      return payload.workflowStepApproved.tenantId === context.req.user.tenantId;
    },
  })
  workflowStepApproved(@CurrentTenant() tenantId: string) {
    this.logger.debug(`Subscription: workflowStepApproved for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('WORKFLOW_STEP_APPROVED');
  }

  /**
   * Subscription: Workflow step rejected
   * Filters events by tenant for multi-tenant isolation
   */
  @Subscription('workflowStepRejected', {
    filter: (payload, variables, context) => {
      return payload.workflowStepRejected.tenantId === context.req.user.tenantId;
    },
  })
  workflowStepRejected(@CurrentTenant() tenantId: string) {
    this.logger.debug(`Subscription: workflowStepRejected for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('WORKFLOW_STEP_REJECTED');
  }

  /**
   * Subscription: Workflow step reassigned
   * Filters events by tenant for multi-tenant isolation
   */
  @Subscription('workflowStepReassigned', {
    filter: (payload, variables, context) => {
      return payload.workflowStepReassigned.tenantId === context.req.user.tenantId;
    },
  })
  workflowStepReassigned(@CurrentTenant() tenantId: string) {
    this.logger.debug(`Subscription: workflowStepReassigned for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('WORKFLOW_STEP_REASSIGNED');
  }

  /**
   * Subscription: New pending approval
   * Filters events by tenant and optionally by user
   */
  @Subscription('newPendingApproval', {
    filter: (payload, variables, context) => {
      const matchesTenant = payload.newPendingApproval.tenantId === context.req.user.tenantId;
      const matchesUser = !variables.userId || payload.newPendingApproval.approverId === variables.userId;
      return matchesTenant && matchesUser;
    },
  })
  newPendingApproval(
    @Args('userId', { type: () => ID, nullable: true }) userId: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.debug(`Subscription: newPendingApproval for tenant ${tenantId}, user ${userId || 'all'}`);
    return this.pubSub.asyncIterator('NEW_PENDING_APPROVAL');
  }
}