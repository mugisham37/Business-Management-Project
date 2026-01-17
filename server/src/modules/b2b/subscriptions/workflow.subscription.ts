import { Resolver, Subscription, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

/**
 * GraphQL subscription resolver for workflow real-time updates
 * 
 * Provides real-time notifications for:
 * - Workflow step completions
 * - Approval assignments
 * - Workflow escalations
 * - Timeout notifications
 * - Workflow completions
 */
@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class WorkflowSubscriptionResolver {
  private readonly logger = new Logger(WorkflowSubscriptionResolver.name);

  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  /**
   * Subscription: Workflow status changed
   * Emitted when any workflow status changes
   */
  @Subscription(() => Object, {
    name: 'workflowStatusChanged',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.workflowStatusChanged.tenantId === context.req.user.tenantId;
      const matchesWorkflow = !variables.workflowId || payload.workflowStatusChanged.workflow.id === variables.workflowId;
      
      // User must be involved in the workflow (creator, approver, or have workflow permissions)
      const isInvolved = payload.workflowStatusChanged.workflow.participants?.includes(context.req.user.id) ||
                        context.req.user.permissions?.includes('workflow:read');
      
      return matchesTenant && matchesWorkflow && isInvolved;
    },
  })
  workflowStatusChanged(
    @Args('workflowId', { type: () => ID, nullable: true }) workflowId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: workflowStatusChanged for tenant ${tenantId}, workflow ${workflowId || 'all'}`);
    return this.pubSub.asyncIterator([
      'WORKFLOW_STARTED',
      'WORKFLOW_STEP_COMPLETED',
      'WORKFLOW_COMPLETED',
      'WORKFLOW_CANCELLED'
    ]);
  }

  /**
   * Subscription: Approval assigned
   * Emitted when an approval is assigned to a user
   */
  @Subscription(() => Object, {
    name: 'approvalAssigned',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.approvalAssigned.tenantId === context.req.user.tenantId;
      
      // Only show to the assigned approver or users with approval management permissions
      const isAssignedApprover = payload.approvalAssigned.assignedTo === context.req.user.id;
      const canManageApprovals = context.req.user.permissions?.includes('approval:manage');
      
      return matchesTenant && (isAssignedApprover || canManageApprovals);
    },
  })
  approvalAssigned(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: approvalAssigned for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('APPROVAL_ASSIGNED');
  }

  /**
   * Subscription: Workflow escalated
   * Emitted when a workflow is escalated due to timeout or manual escalation
   */
  @Subscription(() => Object, {
    name: 'workflowEscalated',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.workflowEscalated.tenantId === context.req.user.tenantId;
      
      // Show to escalated approver, original approver, or users with escalation permissions
      const isEscalatedTo = payload.workflowEscalated.escalatedTo === context.req.user.id;
      const isOriginalApprover = payload.workflowEscalated.workflow.currentApprover === context.req.user.id;
      const canViewEscalations = context.req.user.permissions?.includes('escalation:read');
      
      return matchesTenant && (isEscalatedTo || isOriginalApprover || canViewEscalations);
    },
  })
  workflowEscalated(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: workflowEscalated for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('WORKFLOW_ESCALATED');
  }

  /**
   * Subscription: Approval timeout warning
   * Emitted when an approval is approaching timeout
   */
  @Subscription(() => Object, {
    name: 'approvalTimeoutWarning',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.approvalTimeoutWarning.tenantId === context.req.user.tenantId;
      
      // Show to assigned approver or users with approval management permissions
      const isAssignedApprover = payload.approvalTimeoutWarning.assignedTo === context.req.user.id;
      const canManageApprovals = context.req.user.permissions?.includes('approval:manage');
      
      return matchesTenant && (isAssignedApprover || canManageApprovals);
    },
  })
  approvalTimeoutWarning(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: approvalTimeoutWarning for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('APPROVAL_TIMEOUT_WARNING');
  }

  /**
   * Subscription: Workflow completed
   * Emitted when a workflow reaches final completion
   */
  @Subscription(() => Object, {
    name: 'workflowCompleted',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.workflowCompleted.tenantId === context.req.user.tenantId;
      const matchesEntityType = !variables.entityType || payload.workflowCompleted.workflow.entityType === variables.entityType;
      
      // User must be involved in the workflow or have workflow permissions
      const isInvolved = payload.workflowCompleted.workflow.participants?.includes(context.req.user.id) ||
                        payload.workflowCompleted.workflow.createdBy === context.req.user.id ||
                        context.req.user.permissions?.includes('workflow:read');
      
      return matchesTenant && matchesEntityType && isInvolved;
    },
  })
  workflowCompleted(
    @Args('entityType', { nullable: true }) entityType?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: workflowCompleted for tenant ${tenantId}, entityType ${entityType || 'all'}`);
    return this.pubSub.asyncIterator('WORKFLOW_COMPLETED');
  }

  /**
   * Subscription: Parallel approval progress
   * Emitted when progress is made on parallel approval workflows
   */
  @Subscription(() => Object, {
    name: 'parallelApprovalProgress',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.parallelApprovalProgress.tenantId === context.req.user.tenantId;
      const matchesWorkflow = !variables.workflowId || payload.parallelApprovalProgress.workflow.id === variables.workflowId;
      
      // User must be a participant in the parallel approval
      const isParticipant = payload.parallelApprovalProgress.workflow.parallelApprovers?.includes(context.req.user.id) ||
                           context.req.user.permissions?.includes('workflow:read');
      
      return matchesTenant && matchesWorkflow && isParticipant;
    },
  })
  parallelApprovalProgress(
    @Args('workflowId', { type: () => ID, nullable: true }) workflowId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: parallelApprovalProgress for tenant ${tenantId}, workflow ${workflowId || 'all'}`);
    return this.pubSub.asyncIterator('PARALLEL_APPROVAL_PROGRESS');
  }

  /**
   * Subscription: Workflow metrics updated
   * Emitted when workflow performance metrics are updated
   */
  @Subscription(() => Object, {
    name: 'workflowMetricsUpdated',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.workflowMetricsUpdated.tenantId === context.req.user.tenantId;
      const canViewMetrics = context.req.user.permissions?.includes('analytics:read') ||
                            context.req.user.permissions?.includes('workflow:analytics');
      
      return matchesTenant && canViewMetrics;
    },
  })
  workflowMetricsUpdated(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: workflowMetricsUpdated for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('WORKFLOW_METRICS_UPDATED');
  }
}