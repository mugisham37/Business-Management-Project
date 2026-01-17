import { ObjectType, Field, ID, Int, InputType, registerEnumType } from '@nestjs/graphql';

/**
 * Workflow Status Enum
 */
export enum WorkflowStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

registerEnumType(WorkflowStatus, {
  name: 'WorkflowStatus',
  description: 'Status of a workflow',
});

/**
 * Approval Status Enum
 */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SKIPPED = 'skipped',
  REASSIGNED = 'reassigned',
}

registerEnumType(ApprovalStatus, {
  name: 'ApprovalStatus',
  description: 'Status of an approval step',
});

/**
 * Entity Type Enum
 */
export enum EntityType {
  B2B_ORDER = 'b2b_order',
  QUOTE = 'quote',
  CONTRACT = 'contract',
  PRICING_RULE = 'pricing_rule',
  CUSTOMER = 'customer',
}

registerEnumType(EntityType, {
  name: 'EntityType',
  description: 'Type of entity requiring approval',
});

/**
 * Workflow Query Input Type
 */
@InputType()
export class WorkflowQueryInput {
  @Field({ nullable: true })
  search?: string;

  @Field(() => WorkflowStatus, { nullable: true })
  status?: WorkflowStatus;

  @Field(() => EntityType, { nullable: true })
  entityType?: EntityType;

  @Field(() => ID, { nullable: true })
  entityId?: string;

  @Field(() => ID, { nullable: true })
  initiatedBy?: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;

  @Field({ nullable: true, defaultValue: 'createdAt' })
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'desc' })
  sortOrder?: string;
}

/**
 * Approval Step Input Type
 */
@InputType()
export class ApprovalStepInput {
  @Field()
  approvalNotes?: string;

  @Field({ nullable: true })
  attachments?: string; // JSON string
}

/**
 * Reassign Approval Input Type
 */
@InputType()
export class ReassignApprovalInput {
  @Field(() => ID)
  newApproverId!: string;

  @Field()
  reassignmentReason!: string;

  @Field({ nullable: true })
  notes?: string;
}

/**
 * Approval Step Output Type
 */
@ObjectType()
export class ApprovalStepType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workflowId!: string;

  @Field(() => Int)
  stepOrder!: number;

  @Field()
  stepName!: string;

  @Field({ nullable: true })
  stepDescription?: string;

  @Field(() => ID)
  approverId!: string;

  @Field(() => ApprovalStatus)
  status!: ApprovalStatus;

  @Field({ nullable: true })
  approvedAt?: Date;

  @Field({ nullable: true })
  rejectedAt?: Date;

  @Field({ nullable: true })
  approvalNotes?: string;

  @Field({ nullable: true })
  rejectionReason?: string;

  @Field({ nullable: true })
  reassignedFrom?: string;

  @Field({ nullable: true })
  reassignedTo?: string;

  @Field({ nullable: true })
  reassignmentReason?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  attachments?: string; // JSON string

  // Field resolvers
  @Field({ nullable: true })
  approver?: any; // Will be resolved via DataLoader

  @Field({ nullable: true })
  workflow?: WorkflowType; // Will be resolved via DataLoader
}

/**
 * Workflow Output Type
 */
@ObjectType()
export class WorkflowType {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  workflowName!: string;

  @Field({ nullable: true })
  workflowDescription?: string;

  @Field(() => EntityType)
  entityType!: EntityType;

  @Field(() => ID)
  entityId!: string;

  @Field(() => WorkflowStatus)
  status!: WorkflowStatus;

  @Field(() => ID)
  initiatedBy!: string;

  @Field()
  initiatedAt!: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  expiresAt?: Date;

  @Field(() => Int)
  totalSteps!: number;

  @Field(() => Int)
  completedSteps!: number;

  @Field(() => Int)
  currentStep!: number;

  @Field({ nullable: true })
  completionNotes?: string;

  @Field({ nullable: true })
  cancellationReason?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  metadata?: string; // JSON string

  // Field resolvers
  @Field(() => [ApprovalStepType])
  steps!: ApprovalStepType[];

  @Field({ nullable: true })
  initiator?: any; // Will be resolved via DataLoader

  @Field({ nullable: true })
  entity?: any; // Will be resolved via DataLoader

  @Field(() => ApprovalStepType, { nullable: true })
  currentApprovalStep?: ApprovalStepType;

  @Field(() => Boolean)
  isExpired!: boolean; // Computed field

  @Field(() => Int)
  daysUntilExpiration!: number; // Computed field

  @Field(() => Boolean)
  canBeApproved!: boolean; // Computed field

  @Field(() => Boolean)
  canBeRejected!: boolean; // Computed field
}

/**
 * Pending Approval Type
 */
@ObjectType()
export class PendingApprovalType {
  @Field(() => ID)
  workflowId!: string;

  @Field(() => ID)
  stepId!: string;

  @Field(() => EntityType)
  entityType!: EntityType;

  @Field(() => ID)
  entityId!: string;

  @Field()
  entityName!: string;

  @Field()
  stepName!: string;

  @Field({ nullable: true })
  stepDescription?: string;

  @Field()
  initiatedAt!: Date;

  @Field({ nullable: true })
  expiresAt?: Date;

  @Field(() => Int)
  priority!: number;

  @Field({ nullable: true })
  requestedBy?: string;

  // Field resolvers
  @Field({ nullable: true })
  workflow?: WorkflowType;

  @Field({ nullable: true })
  step?: ApprovalStepType;

  @Field({ nullable: true })
  entity?: any;

  @Field({ nullable: true })
  requester?: any;
}

/**
 * Entity Type Summary
 */
@ObjectType()
export class EntityTypeSummary {
  @Field(() => EntityType)
  entityType!: EntityType;

  @Field(() => Int)
  count!: number;

  @Field(() => Int)
  urgentCount!: number;

  @Field(() => Int)
  expiringCount!: number;
}

/**
 * Workflows Response Type
 */
@ObjectType()
export class WorkflowsResponse {
  @Field(() => [WorkflowType])
  workflows!: WorkflowType[];

  @Field(() => Int)
  total!: number;
}

/**
 * Pending Approvals Response Type
 */
@ObjectType()
export class PendingApprovalsResponse {
  @Field(() => [PendingApprovalType])
  approvals!: PendingApprovalType[];

  @Field(() => Int)
  total!: number;

  @Field(() => [EntityTypeSummary])
  byEntityType!: EntityTypeSummary[];
}

/**
 * Workflow History Item Type
 */
@ObjectType()
export class WorkflowHistoryItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  action!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID)
  performedBy!: string;

  @Field()
  performedAt!: Date;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  previousValue?: string;

  @Field({ nullable: true })
  newValue?: string;

  @Field({ nullable: true })
  metadata?: string; // JSON string

  // Field resolvers
  @Field({ nullable: true })
  performer?: any; // Will be resolved via DataLoader
}

/**
 * Workflow History Response Type
 */
@ObjectType()
export class WorkflowHistoryResponse {
  @Field(() => [WorkflowHistoryItemType])
  history!: WorkflowHistoryItemType[];

  @Field(() => Int)
  total!: number;
}

/**
 * Approval Step Response Type
 */
@ObjectType()
export class ApprovalStepResponse {
  @Field(() => ApprovalStepType)
  step!: ApprovalStepType;

  @Field(() => WorkflowType)
  workflow!: WorkflowType;

  @Field()
  message!: string;
}

/**
 * Workflow Analytics Type
 */
@ObjectType()
export class WorkflowAnalyticsType {
  @Field(() => Int)
  totalWorkflows!: number;

  @Field(() => Int)
  pendingWorkflows!: number;

  @Field(() => Int)
  approvedWorkflows!: number;

  @Field(() => Int)
  rejectedWorkflows!: number;

  @Field(() => Float)
  averageApprovalTime!: number; // in hours

  @Field(() => Float)
  approvalRate!: number; // percentage

  @Field(() => [EntityTypeSummary])
  byEntityType!: EntityTypeSummary[];

  @Field(() => Int)
  expiringWorkflows!: number;

  @Field(() => Int)
  overdueWorkflows!: number;
}