import { ObjectType, Field, ID, Float, Int, InputType, registerEnumType } from '@nestjs/graphql';

/**
 * Territory type enum
 */
export enum TerritoryType {
  GEOGRAPHIC = 'geographic',
  INDUSTRY = 'industry',
  ACCOUNT_SIZE = 'account_size',
  PRODUCT_LINE = 'product_line',
  CUSTOM = 'custom',
}

registerEnumType(TerritoryType, {
  name: 'TerritoryType',
  description: 'Type of territory segmentation',
});

/**
 * Create Territory Input Type
 */
@InputType()
export class CreateTerritoryInput {
  @Field()
  territoryCode!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => TerritoryType)
  territoryType!: TerritoryType;

  @Field({ nullable: true })
  geographicBounds?: string; // JSON string

  @Field(() => [String], { nullable: true })
  industryCriteria?: string[];

  @Field({ nullable: true })
  accountSizeCriteria?: string; // JSON string

  @Field(() => [String], { nullable: true })
  productLineCriteria?: string[];

  @Field({ nullable: true })
  customCriteria?: string; // JSON string

  @Field(() => ID, { nullable: true })
  primarySalesRepId?: string;

  @Field(() => [String], { nullable: true })
  secondarySalesRepIds?: string[];

  @Field(() => ID, { nullable: true })
  managerId?: string;

  @Field(() => Float, { nullable: true })
  annualRevenueTarget?: number;

  @Field(() => Float, { nullable: true })
  quarterlyRevenueTarget?: number;

  @Field(() => Int, { nullable: true })
  customerAcquisitionTarget?: number;

  @Field({ nullable: true })
  commissionStructure?: string; // JSON string

  @Field({ nullable: true })
  metadata?: string; // JSON string
}

/**
 * Update Territory Input Type
 */
@InputType()
export class UpdateTerritoryInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  geographicBounds?: string; // JSON string

  @Field(() => [String], { nullable: true })
  industryCriteria?: string[];

  @Field({ nullable: true })
  accountSizeCriteria?: string; // JSON string

  @Field(() => [String], { nullable: true })
  productLineCriteria?: string[];

  @Field({ nullable: true })
  customCriteria?: string; // JSON string

  @Field(() => ID, { nullable: true })
  primarySalesRepId?: string;

  @Field(() => [String], { nullable: true })
  secondarySalesRepIds?: string[];

  @Field(() => ID, { nullable: true })
  managerId?: string;

  @Field(() => Float, { nullable: true })
  annualRevenueTarget?: number;

  @Field(() => Float, { nullable: true })
  quarterlyRevenueTarget?: number;

  @Field(() => Int, { nullable: true })
  customerAcquisitionTarget?: number;

  @Field({ nullable: true })
  commissionStructure?: string; // JSON string

  @Field({ nullable: true })
  metadata?: string; // JSON string
}

/**
 * Territory Query Input Type
 */
@InputType()
export class TerritoryQueryInput {
  @Field({ nullable: true })
  search?: string;

  @Field(() => TerritoryType, { nullable: true })
  territoryType?: TerritoryType;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field(() => ID, { nullable: true })
  primarySalesRepId?: string;

  @Field(() => ID, { nullable: true })
  managerId?: string;

  @Field(() => Float, { nullable: true })
  minAnnualRevenueTarget?: number;

  @Field(() => Float, { nullable: true })
  maxAnnualRevenueTarget?: number;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;

  @Field({ nullable: true, defaultValue: 'territoryCode' })
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'asc' })
  sortOrder?: string;
}

/**
 * Assign Customer to Territory Input Type
 */
@InputType()
export class AssignCustomerToTerritoryInput {
  @Field(() => ID)
  customerId!: string;

  @Field({ nullable: true })
  assignmentReason?: string;
}

/**
 * Bulk Assign Customers Input Type
 */
@InputType()
export class BulkAssignCustomersInput {
  @Field(() => [String])
  customerIds!: string[];

  @Field({ nullable: true })
  assignmentReason?: string;
}

/**
 * Territory Performance Query Input Type
 */
@InputType()
export class TerritoryPerformanceQueryInput {
  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field({ nullable: true })
  includeCustomerMetrics?: boolean;

  @Field({ nullable: true })
  includeSalesMetrics?: boolean;

  @Field({ nullable: true })
  includeCommissionMetrics?: boolean;
}

/**
 * Territory GraphQL type
 * Represents a B2B sales territory
 */
@ObjectType()
export class TerritoryGraphQLType {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  territoryCode!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => TerritoryType)
  territoryType!: TerritoryType;

  @Field()
  isActive!: boolean;

  @Field({ nullable: true })
  geographicBounds?: string; // JSON string

  @Field(() => [String], { nullable: true })
  industryCriteria?: string[];

  @Field({ nullable: true })
  accountSizeCriteria?: string; // JSON string

  @Field(() => [String], { nullable: true })
  productLineCriteria?: string[];

  @Field({ nullable: true })
  customCriteria?: string; // JSON string

  @Field(() => ID, { nullable: true })
  primarySalesRepId?: string;

  @Field(() => [String], { nullable: true })
  secondarySalesRepIds?: string[];

  @Field(() => ID, { nullable: true })
  managerId?: string;

  @Field(() => Float, { nullable: true })
  annualRevenueTarget?: number;

  @Field(() => Float, { nullable: true })
  quarterlyRevenueTarget?: number;

  @Field(() => Int, { nullable: true })
  customerAcquisitionTarget?: number;

  @Field({ nullable: true })
  commissionStructure?: string; // JSON string

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  metadata?: string; // JSON string

  // Field resolvers
  @Field(() => [CustomerType])
  customers!: any[];

  @Field({ nullable: true })
  salesRep?: any;

  @Field(() => [UserType], { nullable: true })
  secondarySalesReps?: any[];

  @Field({ nullable: true })
  manager?: any;

  @Field(() => Int)
  customerCount!: number;

  @Field(() => Float)
  targetAchievement!: number;

  @Field(() => Float)
  currentRevenue!: number;
}

/**
 * Territory customer assignment GraphQL type
 */
@ObjectType()
export class TerritoryCustomerAssignmentType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  territoryId!: string;

  @Field(() => ID)
  customerId!: string;

  @Field()
  assignedDate!: Date;

  @Field()
  isActive!: boolean;

  @Field({ nullable: true })
  assignmentReason?: string;
}

/**
 * Territory performance metrics GraphQL type
 */
@ObjectType()
export class TerritoryPerformanceType {
  @Field(() => ID)
  territoryId!: string;

  @Field()
  territoryName!: string;

  @Field()
  period!: string; // JSON string

  @Field()
  metrics!: string; // JSON string

  @Field()
  salesRep!: string; // JSON string
}

/**
 * Territory list response type
 */
@ObjectType()
export class TerritoryListResponse {
  @Field(() => [TerritoryGraphQLType])
  territories!: TerritoryGraphQLType[];

  @Field(() => Int)
  total!: number;
}

/**
 * Territory customers response type
 */
@ObjectType()
export class TerritoryCustomersResponse {
  @Field(() => [CustomerType])
  customers!: any[];

  @Field(() => Int)
  total!: number;
}

/**
 * Bulk assignment response type
 */
@ObjectType()
export class BulkAssignmentResponse {
  @Field(() => [TerritoryCustomerAssignmentType])
  assignments!: TerritoryCustomerAssignmentType[];

  @Field(() => Int)
  count!: number;
}

/**
 * Territory Assignment Response Type
 */
@ObjectType()
export class TerritoryAssignmentResponse {
  @Field(() => TerritoryCustomerAssignmentType)
  assignment!: TerritoryCustomerAssignmentType;

  @Field()
  message!: string;
}

// Placeholder types for field resolvers
class CustomerType {}
class UserType {}
