import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { 
  b2bOrders,
  quotes,
  users
} from '../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

export interface ApprovalWorkflow {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  approvers: string[];
  approvals: ApprovalStep[];
  createdBy: string;
  createdAt: Date;
}

export interface ApprovalStep {
  stepNumber: number;
  approverId: string;
  approverName: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: Date;
  notes?: string;
}

@Injectable()
export class B2BWorkflowService {
  private readonly logger = new Logger(B2BWorkflowService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async startApprovalWorkflow(
    tenantId: string,
    entityId: string,
    entityType: 'b2b_order' | 'quote' | 'contract',
    userId: string
  ): Promise<ApprovalWorkflow> {
    try {
      // Get approval requirements based on entity type and value
      const approvers = await this.getRequiredApprovers(tenantId, entityId, entityType);
      
      if (approvers.length === 0) {
        // No approval required, auto-approve
        await this.autoApprove(tenantId, entityId, entityType, userId);
        return this.createAutoApprovedWorkflow(entityId, entityType, userId);
      }

      // Create approval workflow
      const workflow: ApprovalWorkflow = {
        id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        entityType,
        entityId,
        status: 'pending',
        currentStep: 1,
        totalSteps: approvers.length,
        approvers: approvers.map(a => a.id),
        approvals: approvers.map((approver, index) => ({
          stepNumber: index + 1,
          approverId: approver.id,
          approverName: `${approver.firstName} ${approver.lastName}`,
          status: 'pending' as const,
        })),
        createdBy: userId,
        createdAt: new Date(),
      };

      // Store workflow (in a real implementation, this would be in a workflows table)
      await this.cacheService.set(
        `workflow:${tenantId}:${workflow.id}`,
        workflow,
        { ttl: 86400 } // 24 hours
      );

      // Send notification to first approver
      const firstApproval = workflow.approvals[0];
      if (firstApproval) {
        await this.notifyApprover(tenantId, workflow, firstApproval);
      }

      // Emit event
      this.eventEmitter.emit('workflow.started', {
        tenantId,
        workflowId: workflow.id,
        entityType,
        entityId,
        approvers: workflow.approvers,
      });

      this.logger.log(`Started approval workflow ${workflow.id} for ${entityType} ${entityId}`);
      return workflow;
    } catch (error) {
      this.logger.error(`Failed to start approval workflow for ${entityType} ${entityId}:`, error);
      throw error;
    }
  }

  async approveStep(
    tenantId: string,
    workflowId: string,
    approverId: string,
    notes?: string
  ): Promise<ApprovalWorkflow> {
    try {
      // Get workflow
      const workflow = await this.getWorkflow(tenantId, workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Find current approval step
      const currentStep = workflow.approvals.find(
        step => step.stepNumber === workflow.currentStep && step.approverId === approverId
      );

      if (!currentStep) {
        throw new Error(`Invalid approver ${approverId} for current step ${workflow.currentStep}`);
      }

      if (currentStep.status !== 'pending') {
        throw new Error(`Step ${workflow.currentStep} already processed`);
      }

      // Update approval step
      currentStep.status = 'approved';
      currentStep.approvedAt = new Date();
      if (notes) {
        currentStep.notes = notes;
      }

      // Check if this was the last step
      if (workflow.currentStep === workflow.totalSteps) {
        // All approvals complete
        workflow.status = 'approved';
        await this.completeApproval(tenantId, workflow);
      } else {
        // Move to next step
        workflow.currentStep += 1;
        const nextStep = workflow.approvals.find(step => step.stepNumber === workflow.currentStep);
        if (nextStep) {
          await this.notifyApprover(tenantId, workflow, nextStep);
        }
      }

      // Update workflow
      await this.cacheService.set(
        `workflow:${tenantId}:${workflowId}`,
        workflow,
        { ttl: 86400 }
      );

      // Emit event
      this.eventEmitter.emit('workflow.step-approved', {
        tenantId,
        workflowId,
        stepNumber: currentStep.stepNumber,
        approverId,
        isComplete: workflow.status === 'approved',
      });

      this.logger.log(`Approved step ${currentStep.stepNumber} of workflow ${workflowId} by ${approverId}`);
      return workflow;
    } catch (error) {
      this.logger.error(`Failed to approve workflow step ${workflowId}:`, error);
      throw error;
    }
  }

  async rejectStep(
    tenantId: string,
    workflowId: string,
    approverId: string,
    rejectionReason: string
  ): Promise<ApprovalWorkflow> {
    try {
      // Get workflow
      const workflow = await this.getWorkflow(tenantId, workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Find current approval step
      const currentStep = workflow.approvals.find(
        step => step.stepNumber === workflow.currentStep && step.approverId === approverId
      );

      if (!currentStep) {
        throw new Error(`Invalid approver ${approverId} for current step ${workflow.currentStep}`);
      }

      if (currentStep.status !== 'pending') {
        throw new Error(`Step ${workflow.currentStep} already processed`);
      }

      // Update approval step
      currentStep.status = 'rejected';
      currentStep.approvedAt = new Date();
      currentStep.notes = rejectionReason;

      // Reject entire workflow
      workflow.status = 'rejected';
      await this.completeRejection(tenantId, workflow, rejectionReason);

      // Update workflow
      await this.cacheService.set(
        `workflow:${tenantId}:${workflowId}`,
        workflow,
        { ttl: 86400 }
      );

      // Emit event
      this.eventEmitter.emit('workflow.rejected', {
        tenantId,
        workflowId,
        stepNumber: currentStep.stepNumber,
        approverId,
        rejectionReason,
      });

      this.logger.log(`Rejected workflow ${workflowId} at step ${currentStep.stepNumber} by ${approverId}`);
      return workflow;
    } catch (error) {
      this.logger.error(`Failed to reject workflow step ${workflowId}:`, error);
      throw error;
    }
  }

  async getWorkflow(tenantId: string, workflowId: string): Promise<ApprovalWorkflow | null> {
    try {
      return await this.cacheService.get<ApprovalWorkflow>(`workflow:${tenantId}:${workflowId}`);
    } catch (error) {
      this.logger.error(`Failed to get workflow ${workflowId}:`, error);
      return null;
    }
  }

  async getPendingApprovals(tenantId: string, approverId: string): Promise<ApprovalWorkflow[]> {
    try {
      // In a real implementation, this would query a workflows table
      // For now, we'll return an empty array as this is a simplified implementation
      return [];
    } catch (error) {
      this.logger.error(`Failed to get pending approvals for ${approverId}:`, error);
      return [];
    }
  }

  private async getRequiredApprovers(
    tenantId: string,
    entityId: string,
    entityType: string
  ): Promise<any[]> {
    try {
      let approvalThreshold = 0;
      let entityValue = 0;

      // Get entity value to determine approval requirements
      if (entityType === 'b2b_order') {
        const [order] = await this.drizzle.getDb()
          .select({ totalAmount: b2bOrders.totalAmount })
          .from(b2bOrders)
          .where(and(
            eq(b2bOrders.tenantId, tenantId),
            eq(b2bOrders.id, entityId)
          ));
        
        if (order) {
          entityValue = parseFloat(order.totalAmount);
        }
      } else if (entityType === 'quote') {
        const [quote] = await this.drizzle.getDb()
          .select({ totalAmount: quotes.totalAmount })
          .from(quotes)
          .where(and(
            eq(quotes.tenantId, tenantId),
            eq(quotes.id, entityId)
          ));
        
        if (quote) {
          entityValue = parseFloat(quote.totalAmount);
        }
      }

      // Define approval thresholds and required roles
      const approvalRules = [
        { threshold: 50000, roles: ['owner', 'admin', 'finance_manager'] }, // $50K+
        { threshold: 25000, roles: ['admin', 'sales_manager'] }, // $25K+
        { threshold: 10000, roles: ['sales_manager'] }, // $10K+
      ];

      // Find applicable approval rule
      const applicableRule = approvalRules.find(rule => entityValue >= rule.threshold);
      
      if (!applicableRule) {
        return []; // No approval required
      }

      // Get users with required roles
      const approvers = await this.drizzle.getDb()
        .select()
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.isActive, true),
          isNull(users.deletedAt)
        ));

      // Filter users by roles (simplified - in real implementation, roles would be in a separate table)
      const requiredApprovers = approvers.filter(user => {
        // Check if user has role field (single role) or roles array
        const userRole = user.role;
        if (userRole && applicableRule.roles.includes(userRole)) {
          return true;
        }
        return false;
      });

      return requiredApprovers.slice(0, 2); // Maximum 2 approvers
    } catch (error) {
      this.logger.error(`Failed to get required approvers for ${entityType} ${entityId}:`, error);
      return [];
    }
  }

  private async autoApprove(
    tenantId: string,
    entityId: string,
    entityType: string,
    userId: string
  ): Promise<void> {
    try {
      if (entityType === 'b2b_order') {
        await this.drizzle.getDb()
          .update(b2bOrders)
          .set({
            status: 'approved',
            approvedBy: userId,
            approvedAt: new Date(),
            approvalNotes: 'Auto-approved (no approval required)',
          })
          .where(and(
            eq(b2bOrders.tenantId, tenantId),
            eq(b2bOrders.id, entityId)
          ));
      } else if (entityType === 'quote') {
        await this.drizzle.getDb()
          .update(quotes)
          .set({
            status: 'approved',
            approvedBy: userId,
            approvedAt: new Date(),
            approvalNotes: 'Auto-approved (no approval required)',
          })
          .where(and(
            eq(quotes.tenantId, tenantId),
            eq(quotes.id, entityId)
          ));
      }
    } catch (error) {
      this.logger.error(`Failed to auto-approve ${entityType} ${entityId}:`, error);
      throw error;
    }
  }

  private async completeApproval(tenantId: string, workflow: ApprovalWorkflow): Promise<void> {
    try {
      const lastApproval = workflow.approvals[workflow.approvals.length - 1];
      if (!lastApproval) {
        throw new Error('No approval steps found in workflow');
      }

      if (workflow.entityType === 'b2b_order') {
        await this.drizzle.getDb()
          .update(b2bOrders)
          .set({
            status: 'approved',
            approvedBy: lastApproval.approverId,
            approvedAt: new Date(),
            approvalNotes: 'Approved through workflow',
          })
          .where(and(
            eq(b2bOrders.tenantId, tenantId),
            eq(b2bOrders.id, workflow.entityId)
          ));
      } else if (workflow.entityType === 'quote') {
        await this.drizzle.getDb()
          .update(quotes)
          .set({
            status: 'approved',
            approvedBy: lastApproval.approverId,
            approvedAt: new Date(),
            approvalNotes: 'Approved through workflow',
          })
          .where(and(
            eq(quotes.tenantId, tenantId),
            eq(quotes.id, workflow.entityId)
          ));
      }

      // Emit completion event
      this.eventEmitter.emit('workflow.completed', {
        tenantId,
        workflowId: workflow.id,
        entityType: workflow.entityType,
        entityId: workflow.entityId,
        status: 'approved',
      });
    } catch (error) {
      this.logger.error(`Failed to complete approval for workflow ${workflow.id}:`, error);
      throw error;
    }
  }

  private async completeRejection(
    tenantId: string,
    workflow: ApprovalWorkflow,
    rejectionReason: string
  ): Promise<void> {
    try {
      if (workflow.entityType === 'b2b_order') {
        await this.drizzle.getDb()
          .update(b2bOrders)
          .set({
            status: 'cancelled',
            approvalNotes: rejectionReason,
          })
          .where(and(
            eq(b2bOrders.tenantId, tenantId),
            eq(b2bOrders.id, workflow.entityId)
          ));
      } else if (workflow.entityType === 'quote') {
        await this.drizzle.getDb()
          .update(quotes)
          .set({
            status: 'rejected',
            approvalNotes: rejectionReason,
          })
          .where(and(
            eq(quotes.tenantId, tenantId),
            eq(quotes.id, workflow.entityId)
          ));
      }

      // Emit completion event
      this.eventEmitter.emit('workflow.completed', {
        tenantId,
        workflowId: workflow.id,
        entityType: workflow.entityType,
        entityId: workflow.entityId,
        status: 'rejected',
        rejectionReason,
      });
    } catch (error) {
      this.logger.error(`Failed to complete rejection for workflow ${workflow.id}:`, error);
      throw error;
    }
  }

  private async notifyApprover(
    tenantId: string,
    workflow: ApprovalWorkflow,
    approvalStep: ApprovalStep
  ): Promise<void> {
    try {
      // Emit notification event (would be handled by notification service)
      this.eventEmitter.emit('approval.notification', {
        tenantId,
        approverId: approvalStep.approverId,
        workflowId: workflow.id,
        entityType: workflow.entityType,
        entityId: workflow.entityId,
        stepNumber: approvalStep.stepNumber,
        totalSteps: workflow.totalSteps,
      });
    } catch (error) {
      this.logger.error(`Failed to notify approver ${approvalStep.approverId}:`, error);
    }
  }

  private createAutoApprovedWorkflow(
    entityId: string,
    entityType: string,
    userId: string
  ): ApprovalWorkflow {
    return {
      id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      entityType,
      entityId,
      status: 'approved',
      currentStep: 1,
      totalSteps: 1,
      approvers: [userId],
      approvals: [{
        stepNumber: 1,
        approverId: userId,
        approverName: 'System Auto-Approval',
        status: 'approved',
        approvedAt: new Date(),
        notes: 'Auto-approved (no approval required)',
      }],
      createdBy: userId,
      createdAt: new Date(),
    };
  }
}

  // Additional methods needed for WorkflowResolver

  async getWorkflows(
    tenantId: string,
    query: any
  ): Promise<{ workflows: any[]; total: number }> {
    try {
      // In a real implementation, this would query a workflows table
      // For now, return empty results as this is a simplified implementation
      return {
        workflows: [],
        total: 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get workflows:`, error);
      throw error;
    }
  }

  async getPendingApprovalsWithDetails(
    tenantId: string,
    approverId: string,
    entityType?: string
  ): Promise<{
    approvals: any[];
    total: number;
    byEntityType: any[];
  }> {
    try {
      // In a real implementation, this would query workflows and return detailed approval info
      return {
        approvals: [],
        total: 0,
        byEntityType: [],
      };
    } catch (error) {
      this.logger.error(`Failed to get pending approvals with details:`, error);
      throw error;
    }
  }

  async getWorkflowHistory(
    tenantId: string,
    entityId: string,
    entityType: string
  ): Promise<{ history: any[]; total: number }> {
    try {
      // In a real implementation, this would query workflow history/audit logs
      return {
        history: [],
        total: 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get workflow history:`, error);
      throw error;
    }
  }

  async getWorkflowAnalytics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
    entityType?: string
  ): Promise<any> {
    try {
      // In a real implementation, this would calculate analytics from workflows
      return {
        totalWorkflows: 0,
        pendingWorkflows: 0,
        approvedWorkflows: 0,
        rejectedWorkflows: 0,
        averageApprovalTime: 0,
        approvalRate: 0,
        byEntityType: [],
        expiringWorkflows: 0,
        overdueWorkflows: 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get workflow analytics:`, error);
      throw error;
    }
  }

  async getWorkflowSteps(tenantId: string, workflowId: string): Promise<any[]> {
    try {
      const workflow = await this.getWorkflow(tenantId, workflowId);
      if (!workflow) {
        return [];
      }

      // Convert ApprovalStep[] to ApprovalStepType[]
      return workflow.approvals.map((approval, index) => ({
        id: `${workflowId}-step-${approval.stepNumber}`,
        workflowId,
        stepOrder: approval.stepNumber,
        stepName: `Approval Step ${approval.stepNumber}`,
        stepDescription: `Approval required from ${approval.approverName}`,
        approverId: approval.approverId,
        status: approval.status,
        approvedAt: approval.approvedAt,
        rejectedAt: approval.status === 'rejected' ? approval.approvedAt : null,
        approvalNotes: approval.notes,
        rejectionReason: approval.status === 'rejected' ? approval.notes : null,
        createdAt: workflow.createdAt,
        updatedAt: approval.approvedAt || workflow.createdAt,
        attachments: null,
      }));
    } catch (error) {
      this.logger.error(`Failed to get workflow steps:`, error);
      return [];
    }
  }

  async getCurrentApprovalStep(tenantId: string, workflowId: string): Promise<any | null> {
    try {
      const workflow = await this.getWorkflow(tenantId, workflowId);
      if (!workflow || workflow.status !== 'pending') {
        return null;
      }

      const currentApproval = workflow.approvals.find(
        approval => approval.stepNumber === workflow.currentStep
      );

      if (!currentApproval) {
        return null;
      }

      return {
        id: `${workflowId}-step-${currentApproval.stepNumber}`,
        workflowId,
        stepOrder: currentApproval.stepNumber,
        stepName: `Approval Step ${currentApproval.stepNumber}`,
        stepDescription: `Approval required from ${currentApproval.approverName}`,
        approverId: currentApproval.approverId,
        status: currentApproval.status,
        approvedAt: currentApproval.approvedAt,
        rejectedAt: null,
        approvalNotes: currentApproval.notes,
        rejectionReason: null,
        createdAt: workflow.createdAt,
        updatedAt: workflow.createdAt,
        attachments: null,
      };
    } catch (error) {
      this.logger.error(`Failed to get current approval step:`, error);
      return null;
    }
  }

  async getWorkflowEntity(
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<any | null> {
    try {
      if (entityType === 'b2b_order') {
        const [order] = await this.drizzle.getDb()
          .select()
          .from(b2bOrders)
          .where(and(
            eq(b2bOrders.tenantId, tenantId),
            eq(b2bOrders.id, entityId)
          ));
        return order || null;
      } else if (entityType === 'quote') {
        const [quote] = await this.drizzle.getDb()
          .select()
          .from(quotes)
          .where(and(
            eq(quotes.tenantId, tenantId),
            eq(quotes.id, entityId)
          ));
        return quote || null;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get workflow entity:`, error);
      return null;
    }
  }

  async reassignApproval(
    tenantId: string,
    workflowId: string,
    stepId: string,
    currentApproverId: string,
    newApproverId: string,
    reassignmentReason: string,
    notes?: string
  ): Promise<{ step: any; workflow: any }> {
    try {
      const workflow = await this.getWorkflow(tenantId, workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Find the step to reassign
      const stepNumber = parseInt(stepId.split('-step-')[1]);
      const step = workflow.approvals.find(
        approval => approval.stepNumber === stepNumber && approval.approverId === currentApproverId
      );

      if (!step) {
        throw new Error(`Step not found or not assigned to current user`);
      }

      if (step.status !== 'pending') {
        throw new Error(`Step already processed`);
      }

      // Update the step
      step.approverId = newApproverId;
      step.notes = notes || reassignmentReason;

      // Update workflow
      await this.cacheService.set(
        `workflow:${tenantId}:${workflowId}`,
        workflow,
        { ttl: 86400 }
      );

      // Get updated step data
      const updatedStep = {
        id: stepId,
        workflowId,
        stepOrder: step.stepNumber,
        stepName: `Approval Step ${step.stepNumber}`,
        stepDescription: `Approval required from ${step.approverName}`,
        approverId: step.approverId,
        status: step.status,
        approvedAt: step.approvedAt,
        rejectedAt: null,
        approvalNotes: step.notes,
        rejectionReason: null,
        reassignedFrom: currentApproverId,
        reassignedTo: newApproverId,
        reassignmentReason,
        createdAt: workflow.createdAt,
        updatedAt: new Date(),
        attachments: null,
      };

      // Emit event
      this.eventEmitter.emit('workflow.step-reassigned', {
        tenantId,
        workflowId,
        stepNumber: step.stepNumber,
        reassignedFrom: currentApproverId,
        reassignedTo: newApproverId,
        reassignmentReason,
      });

      this.logger.log(`Reassigned workflow step ${stepId} from ${currentApproverId} to ${newApproverId}`);

      return {
        step: updatedStep,
        workflow: this.convertWorkflowToGraphQLType(workflow),
      };
    } catch (error) {
      this.logger.error(`Failed to reassign approval:`, error);
      throw error;
    }
  }

  private convertWorkflowToGraphQLType(workflow: ApprovalWorkflow): any {
    return {
      id: workflow.id,
      tenantId: '', // Would be set from context
      workflowName: `${workflow.entityType} Approval`,
      workflowDescription: `Approval workflow for ${workflow.entityType} ${workflow.entityId}`,
      entityType: workflow.entityType,
      entityId: workflow.entityId,
      status: workflow.status,
      initiatedBy: workflow.createdBy,
      initiatedAt: workflow.createdAt,
      completedAt: workflow.status === 'approved' || workflow.status === 'rejected' ? new Date() : null,
      expiresAt: null,
      totalSteps: workflow.totalSteps,
      completedSteps: workflow.approvals.filter(a => a.status !== 'pending').length,
      currentStep: workflow.currentStep,
      completionNotes: null,
      cancellationReason: null,
      createdAt: workflow.createdAt,
      updatedAt: workflow.createdAt,
      metadata: null,
    };
  }
}