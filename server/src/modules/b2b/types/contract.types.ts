import { ObjectType, Field, ID, Float, Int, InputType, registerEnumType } from '@nestjs/graphql';

/**
 * Contract status enum
 */
export enum ContractStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
  RENEWED = 'renewed',
}

registerEnumType(ContractStatus, {
  name: 'ContractStatus',
  description: 'Status of a B2B contract',
});

/**
 * Contract Type Enum
 */
export enum ContractType {
  PRICING = 'pricing',
  VOLUME = 'volume',
  EXCLUSIVE = 'exclusive',
  SERVICE = 'service',
}

registerEnumType(ContractType, {
  name: 'ContractType',
  description: 'Type of B2B contract',
});

/**
 * Pricing Model Enum
 */
export enum PricingModel {
  FIXED = 'fixed',
  TIERED = 'tiered',
  VOLUME = 'volume',
  COST_PLUS = 'cost_plus',
}

registerEnumType(PricingModel, {
  name: 'PricingModel',
  description: 'Pricing model for contracts',
});

/**
 * Create Contract Input Type
 */
@InputType()
export class CreateContractInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => ContractType)
  contractType!: ContractType;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field({ nullable: true, defaultValue: false })
  autoRenewal?: boolean;

  @Field(() => Int, { nullable: true })
  renewalTermMonths?: number;

  @Field(() => Int, { nullable: true })
  renewalNoticeDays?: number;

  @Field(() => Float, { nullable: true })
  contractValue?: number;

  @Field(() => Float, { nullable: true })
  minimumCommitment?: number;

  @Field()
  paymentTerms!: string;

  @Field(() => PricingModel)
  pricingModel!: PricingModel;

  @Field({ nullable: true })
  pricingTerms?: string; // JSON string

  @Field({ nullable: true })
  performanceMetrics?: string; // JSON string

  @Field({ nullable: true })
  complianceRequirements?: string; // JSON string

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field({ nullable: true })
  termsAndConditions?: string;

  @Field({ nullable: true })
  specialTerms?: string;

  @Field({ nullable: true })
  metadata?: string; // JSON string
}

/**
 * Update Contract Input Type
 */
@InputType()
export class UpdateContractInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  endDate?: Date;

  @Field({ nullable: true })
  autoRenewal?: boolean;

  @Field(() => Int, { nullable: true })
  renewalTermMonths?: number;

  @Field(() => Int, { nullable: true })
  renewalNoticeDays?: number;

  @Field(() => Float, { nullable: true })
  contractValue?: number;

  @Field(() => Float, { nullable: true })
  minimumCommitment?: number;

  @Field({ nullable: true })
  paymentTerms?: string;

  @Field(() => PricingModel, { nullable: true })
  pricingModel?: PricingModel;

  @Field({ nullable: true })
  pricingTerms?: string; // JSON string

  @Field({ nullable: true })
  performanceMetrics?: string; // JSON string

  @Field({ nullable: true })
  complianceRequirements?: string; // JSON string

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field({ nullable: true })
  termsAndConditions?: string;

  @Field({ nullable: true })
  specialTerms?: string;

  @Field({ nullable: true })
  metadata?: string; // JSON string
}

/**
 * Contract Query Input Type
 */
@InputType()
export class ContractQueryInput {
  @Field({ nullable: true })
  search?: string;

  @Field(() => ContractStatus, { nullable: true })
  status?: ContractStatus;

  @Field(() => ContractType, { nullable: true })
  contractType?: ContractType;

  @Field(() => ID, { nullable: true })
  customerId?: string;

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field(() => Int, { nullable: true })
  expiringWithinDays?: number;

  @Field({ nullable: true })
  requiresRenewalNotice?: boolean;

  @Field({ nullable: true })
  startDateFrom?: Date;

  @Field({ nullable: true })
  startDateTo?: Date;

  @Field({ nullable: true })
  endDateFrom?: Date;

  @Field({ nullable: true })
  endDateTo?: Date;

  @Field(() => Float, { nullable: true })
  minContractValue?: number;

  @Field(() => Float, { nullable: true })
  maxContractValue?: number;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;

  @Field({ nullable: true, defaultValue: 'contractNumber' })
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'asc' })
  sortOrder?: string;
}

/**
 * Approve Contract Input Type
 */
@InputType()
export class ApproveContractInput {
  @Field()
  approvalNotes!: string;
}

/**
 * Sign Contract Input Type
 */
@InputType()
export class SignContractInput {
  @Field({ nullable: true })
  customerSignedAt?: Date;
}

/**
 * Renew Contract Input Type
 */
@InputType()
export class RenewContractInput {
  @Field()
  newEndDate!: Date;

  @Field(() => Float, { nullable: true })
  contractValue?: number;

  @Field({ nullable: true })
  pricingTerms?: string; // JSON string

  @Field({ nullable: true })
  renewalNotes?: string;
}

/**
 * Contract GraphQL type
 * Represents a B2B contract with lifecycle management
 */
@ObjectType()
export class ContractGraphQLType {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  contractNumber!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => ContractStatus)
  status!: ContractStatus;

  @Field(() => ContractType)
  contractType!: ContractType;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field()
  autoRenewal!: boolean;

  @Field(() => Int, { nullable: true })
  renewalTermMonths?: number;

  @Field(() => Int)
  renewalNoticeDays!: number;

  @Field(() => Float, { nullable: true })
  contractValue?: number;

  @Field(() => Float, { nullable: true })
  minimumCommitment?: number;

  @Field()
  paymentTerms!: string;

  @Field(() => PricingModel)
  pricingModel!: PricingModel;

  @Field({ nullable: true })
  pricingTerms?: string; // JSON string

  @Field({ nullable: true })
  performanceMetrics?: string; // JSON string

  @Field({ nullable: true })
  complianceRequirements?: string; // JSON string

  @Field(() => ID, { nullable: true })
  salesRepId?: string;

  @Field(() => ID, { nullable: true })
  accountManagerId?: string;

  @Field({ nullable: true })
  termsAndConditions?: string;

  @Field({ nullable: true })
  specialTerms?: string;

  @Field({ nullable: true })
  approvalNotes?: string;

  @Field({ nullable: true })
  customerSignedAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  metadata?: string; // JSON string

  // Field resolvers
  @Field({ nullable: true })
  customer?: any;

  @Field({ nullable: true })
  salesRep?: any;

  @Field({ nullable: true })
  accountManager?: any;

  @Field(() => Boolean)
  isExpired!: boolean; // Computed field

  @Field(() => Int)
  daysUntilExpiration!: number; // Computed field

  @Field(() => Boolean)
  requiresRenewalNotice!: boolean; // Computed field
}

/**
 * Contract list response type
 */
@ObjectType()
export class ContractListResponse {
  @Field(() => [ContractGraphQLType])
  contracts!: ContractGraphQLType[];

  @Field(() => Int)
  total!: number;
}

/**
 * Contract Approval Response Type
 */
@ObjectType()
export class ContractApprovalResponse {
  @Field(() => ContractGraphQLType)
  contract!: ContractGraphQLType;

  @Field()
  message!: string;
}

/**
 * Contract Renewal Response Type
 */
@ObjectType()
export class ContractRenewalResponse {
  @Field(() => ContractGraphQLType)
  contract!: ContractGraphQLType;

  @Field()
  message!: string;
}
