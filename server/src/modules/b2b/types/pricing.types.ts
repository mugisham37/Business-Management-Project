import { ObjectType, Field, ID, Float, Int, InputType, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * Pricing Rule Type Enum
 */
export enum PricingRuleTypeEnum {
  CUSTOMER = 'customer',
  PRODUCT = 'product',
  CATEGORY = 'category',
  VOLUME = 'volume',
  TIER = 'tier',
  CONTRACT = 'contract',
  PROMOTIONAL = 'promotional',
  SEASONAL = 'seasonal',
  GEOGRAPHIC = 'geographic',
  INDUSTRY = 'industry',
}

registerEnumType(PricingRuleTypeEnum, {
  name: 'PricingRuleTypeEnum',
  description: 'Type of pricing rule',
});

/**
 * Discount Type Enum
 */
export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  FIXED_PRICE = 'fixed_price',
  BUY_X_GET_Y = 'buy_x_get_y',
  TIERED = 'tiered',
}

registerEnumType(DiscountType, {
  name: 'DiscountType',
  description: 'Type of discount calculation',
});

/**
 * Pricing Tier Enum
 */
export enum PricingTier {
  STANDARD = 'standard',
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  ENTERPRISE = 'enterprise',
}

registerEnumType(PricingTier, {
  name: 'PricingTier',
  description: 'Customer pricing tier levels',
});

/**
 * Pricing Item Input Type
 */
@InputType()
export class PricingItemInput {
  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

/**
 * Create Pricing Rule Input Type
 */
@InputType()
export class CreatePricingRuleInput {
  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => PricingRuleTypeEnum)
  ruleType!: PricingRuleTypeEnum;

  @Field(() => ID, { nullable: true })
  targetId?: string;

  @Field({ nullable: true })
  targetType?: string;

  @Field(() => DiscountType)
  discountType!: DiscountType;

  @Field(() => Float)
  discountValue!: number;

  @Field(() => Float, { nullable: true })
  minimumQuantity?: number;

  @Field(() => Float, { nullable: true })
  maximumQuantity?: number;

  @Field(() => Float, { nullable: true })
  minimumAmount?: number;

  @Field(() => Float, { nullable: true })
  maximumAmount?: number;

  @Field()
  effectiveDate!: Date;

  @Field({ nullable: true })
  expirationDate?: Date;

  @Field(() => Int, { defaultValue: 100 })
  priority!: number;

  @Field(() => Boolean, { defaultValue: true })
  isActive!: boolean;

  @Field(() => Boolean, { defaultValue: false })
  isExclusive!: boolean;

  @Field(() => [String], { nullable: true })
  applicableCustomerTiers?: string[];

  @Field(() => [String], { nullable: true })
  applicableRegions?: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  conditions?: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

/**
 * Update Pricing Rule Input Type
 */
@InputType()
export class UpdatePricingRuleInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => DiscountType, { nullable: true })
  discountType?: DiscountType;

  @Field(() => Float, { nullable: true })
  discountValue?: number;

  @Field(() => Float, { nullable: true })
  minimumQuantity?: number;

  @Field(() => Float, { nullable: true })
  maximumQuantity?: number;

  @Field(() => Float, { nullable: true })
  minimumAmount?: number;

  @Field(() => Float, { nullable: true })
  maximumAmount?: number;

  @Field({ nullable: true })
  effectiveDate?: Date;

  @Field({ nullable: true })
  expirationDate?: Date;

  @Field(() => Int, { nullable: true })
  priority?: number;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => Boolean, { nullable: true })
  isExclusive?: boolean;

  @Field(() => [String], { nullable: true })
  applicableCustomerTiers?: string[];

  @Field(() => [String], { nullable: true })
  applicableRegions?: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  conditions?: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

/**
 * Pricing Rule Query Input Type
 */
@InputType()
export class PricingRuleQueryInput {
  @Field(() => PricingRuleTypeEnum, { nullable: true })
  ruleType?: PricingRuleTypeEnum;

  @Field(() => ID, { nullable: true })
  targetId?: string;

  @Field({ nullable: true })
  targetType?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  effectiveDateFrom?: Date;

  @Field({ nullable: true })
  effectiveDateTo?: Date;

  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  sortBy?: string;

  @Field({ nullable: true })
  sortOrder?: string;

  @Field(() => Int, { defaultValue: 1 })
  page!: number;

  @Field(() => Int, { defaultValue: 20 })
  limit!: number;
}

/**
 * Customer Pricing Query Input Type
 */
@InputType()
export class CustomerPricingQueryInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => Float, { defaultValue: 1 })
  quantity!: number;

  @Field({ nullable: true })
  effectiveDate?: Date;

  @Field(() => Boolean, { defaultValue: false })
  includeInactive?: boolean;
}

/**
 * Bulk Pricing Query Input Type
 */
@InputType()
export class BulkPricingQueryInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => [PricingItemInput])
  items!: PricingItemInput[];

  @Field({ nullable: true })
  effectiveDate?: Date;

  @Field(() => Boolean, { defaultValue: false })
  includeInactive?: boolean;
}

/**
 * Pricing Analytics Query Input Type
 */
@InputType()
export class PricingAnalyticsQueryInput {
  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field(() => PricingRuleTypeEnum, { nullable: true })
  ruleType?: PricingRuleTypeEnum;

  @Field(() => ID, { nullable: true })
  customerId?: string;

  @Field(() => ID, { nullable: true })
  productId?: string;

  @Field({ nullable: true })
  groupBy?: string;
}

/**
 * Pricing Rule Output Type
 */
@ObjectType()
export class PricingRuleType {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => PricingRuleTypeEnum)
  ruleType!: PricingRuleTypeEnum;

  @Field(() => ID, { nullable: true })
  targetId?: string;

  @Field({ nullable: true })
  targetType?: string;

  @Field(() => DiscountType)
  discountType!: DiscountType;

  @Field(() => Float)
  discountValue!: number;

  @Field(() => Float, { nullable: true })
  minimumQuantity?: number;

  @Field(() => Float, { nullable: true })
  maximumQuantity?: number;

  @Field(() => Float, { nullable: true })
  minimumAmount?: number;

  @Field(() => Float, { nullable: true })
  maximumAmount?: number;

  @Field()
  effectiveDate!: Date;

  @Field({ nullable: true })
  expirationDate?: Date;

  @Field(() => Int)
  priority!: number;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Boolean)
  isExclusive!: boolean;

  @Field(() => [String])
  applicableCustomerTiers!: string[];

  @Field(() => [String])
  applicableRegions!: string[];

  @Field(() => GraphQLJSON)
  conditions!: Record<string, any>;

  @Field(() => GraphQLJSON)
  metadata!: Record<string, any>;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  // Resolved fields
  @Field({ nullable: true })
  targetEntity?: any;

  @Field(() => Boolean)
  isCurrentlyActive?: boolean;

  @Field(() => Boolean)
  isExpired?: boolean;

  @Field(() => Int)
  daysUntilExpiration?: number;

  @Field(() => Int)
  usageCount?: number;

  @Field(() => Float)
  totalSavingsGenerated?: number;

  @Field(() => [String])
  conflictingRules?: string[];
}

/**
 * Customer Pricing Item Type
 */
@ObjectType()
export class CustomerPricingItemType {
  @Field(() => ID)
  customerId!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => Float)
  listPrice!: number;

  @Field(() => Float)
  customerPrice!: number;

  @Field(() => Float)
  discountPercentage!: number;

  @Field(() => Float)
  discountAmount!: number;

  @Field(() => [PricingRuleType])
  appliedRules!: PricingRuleType[];

  @Field(() => PricingTier)
  pricingTier!: PricingTier;

  @Field(() => GraphQLJSON, { nullable: true })
  contractPricing?: Record<string, any>;

  @Field()
  effectiveDate!: Date;

  // Resolved fields
  @Field({ nullable: true })
  product?: any;

  @Field({ nullable: true })
  customer?: any;

  @Field(() => Float)
  totalSavings?: number;

  @Field(() => Float)
  savingsPercentage?: number;

  @Field(() => Boolean)
  hasVolumeDiscount?: boolean;

  @Field(() => Boolean)
  hasContractPricing?: boolean;
}

/**
 * Customer Pricing Response Type
 */
@ObjectType()
export class CustomerPricingResponse {
  @Field(() => ID)
  customerId!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => Float)
  listPrice!: number;

  @Field(() => Float)
  customerPrice!: number;

  @Field(() => Float)
  discountPercentage!: number;

  @Field(() => Float)
  discountAmount!: number;

  @Field(() => [PricingRuleType])
  appliedRules!: PricingRuleType[];

  @Field(() => PricingTier)
  pricingTier!: PricingTier;

  @Field(() => GraphQLJSON, { nullable: true })
  contractPricing?: Record<string, any>;

  @Field(() => Float)
  totalSavings!: number;

  @Field(() => Float)
  savingsPercentage!: number;
}

/**
 * Bulk Pricing Response Type
 */
@ObjectType()
export class BulkPricingResponse {
  @Field(() => ID)
  customerId!: string;

  @Field(() => [CustomerPricingItemType])
  items!: CustomerPricingItemType[];

  @Field(() => Float)
  totalListPrice!: number;

  @Field(() => Float)
  totalCustomerPrice!: number;

  @Field(() => Float)
  totalSavings!: number;

  @Field(() => Float)
  totalSavingsPercentage!: number;

  @Field(() => PricingTier)
  customerTier!: PricingTier;

  @Field(() => Boolean)
  hasVolumeDiscounts!: boolean;

  @Field(() => Boolean)
  hasContractPricing!: boolean;
}

/**
 * Pricing Rules Response Type
 */
@ObjectType()
export class PricingRulesResponse {
  @Field(() => [PricingRuleType])
  rules!: PricingRuleType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int, { nullable: true })
  page?: number;

  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field(() => Boolean, { nullable: true })
  hasNextPage?: boolean;

  @Field(() => Boolean, { nullable: true })
  hasPreviousPage?: boolean;
}

/**
 * Pricing Rule Response Type
 */
@ObjectType()
export class PricingRuleResponse {
  @Field(() => PricingRuleType)
  rule!: PricingRuleType;

  @Field()
  message!: string;

  @Field(() => [String], { nullable: true })
  warnings?: string[];
}

/**
 * Pricing Analytics Type
 */
@ObjectType()
export class PricingAnalyticsType {
  @Field(() => Int)
  totalRules!: number;

  @Field(() => Int)
  activeRules!: number;

  @Field(() => Int)
  expiredRules!: number;

  @Field(() => Float)
  totalSavingsGenerated!: number;

  @Field(() => Float)
  averageDiscountPercentage!: number;

  @Field(() => GraphQLJSON)
  ruleTypeBreakdown!: Record<string, number>;

  @Field(() => GraphQLJSON)
  discountTypeBreakdown!: Record<string, number>;

  @Field(() => GraphQLJSON)
  monthlyTrends!: Record<string, any>;

  @Field(() => [PricingRuleType])
  topPerformingRules!: PricingRuleType[];

  @Field(() => [PricingRuleType])
  underperformingRules!: PricingRuleType[];
}

/**
 * Price Comparison Type
 */
@ObjectType()
export class PriceComparisonType {
  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  listPrice!: number;

  @Field(() => Float)
  competitorPrice!: number;

  @Field(() => Float)
  customerPrice!: number;

  @Field(() => Float)
  marginPercentage!: number;

  @Field(() => Boolean)
  isCompetitive!: boolean;

  @Field({ nullable: true })
  recommendation?: string;
}
 */
@InputType()
export class CreatePricingRuleInput {
  @Field(() => PricingRuleTypeEnum)
  ruleType!: PricingRuleTypeEnum;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  targetId?: string;

  @Field({ nullable: true })
  targetType?: string;

  @Field(() => DiscountType)
  discountType!: DiscountType;

  @Field(() => Float)
  discountValue!: number;

  @Field(() => Float, { nullable: true })
  minimumQuantity?: number;

  @Field(() => Float, { nullable: true })
  maximumQuantity?: number;

  @Field(() => Float, { nullable: true })
  minimumAmount?: number;

  @Field(() => Float, { nullable: true })
  maximumAmount?: number;

  @Field()
  effectiveDate!: Date;

  @Field({ nullable: true })
  expirationDate?: Date;

  @Field(() => Int, { nullable: true, defaultValue: 100 })
  priority?: number;

  @Field({ nullable: true, defaultValue: true })
  isActive?: boolean;

  @Field({ nullable: true })
  conditions?: string; // JSON string

  @Field({ nullable: true })
  metadata?: string; // JSON string
}

/**
 * Update Pricing Rule Input Type
 */
@InputType()
export class UpdatePricingRuleInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => DiscountType, { nullable: true })
  discountType?: DiscountType;

  @Field(() => Float, { nullable: true })
  discountValue?: number;

  @Field(() => Float, { nullable: true })
  minimumQuantity?: number;

  @Field(() => Float, { nullable: true })
  maximumQuantity?: number;

  @Field(() => Float, { nullable: true })
  minimumAmount?: number;

  @Field(() => Float, { nullable: true })
  maximumAmount?: number;

  @Field({ nullable: true })
  effectiveDate?: Date;

  @Field({ nullable: true })
  expirationDate?: Date;

  @Field(() => Int, { nullable: true })
  priority?: number;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  conditions?: string; // JSON string

  @Field({ nullable: true })
  metadata?: string; // JSON string
}

/**
 * Pricing Rule Query Input Type
 */
@InputType()
export class PricingRuleQueryInput {
  @Field({ nullable: true })
  search?: string;

  @Field(() => PricingRuleTypeEnum, { nullable: true })
  ruleType?: PricingRuleTypeEnum;

  @Field(() => DiscountType, { nullable: true })
  discountType?: DiscountType;

  @Field(() => ID, { nullable: true })
  targetId?: string;

  @Field({ nullable: true })
  targetType?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  effectiveFrom?: Date;

  @Field({ nullable: true })
  effectiveTo?: Date;

  @Field({ nullable: true })
  expiringWithinDays?: number;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;

  @Field({ nullable: true, defaultValue: 'priority' })
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'desc' })
  sortOrder?: string;
}

/**
 * Customer Pricing Query Input Type
 */
@InputType()
export class CustomerPricingQueryInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  quantity!: number;
}

/**
 * Bulk Pricing Query Input Type
 */
@InputType()
export class BulkPricingQueryInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => [PricingItemInput])
  items!: PricingItemInput[];
}

/**
 * Pricing Rule Output Type
 */
@ObjectType()
export class PricingRuleType {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field(() => PricingRuleTypeEnum)
  ruleType!: PricingRuleTypeEnum;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  targetId?: string;

  @Field({ nullable: true })
  targetType?: string;

  @Field(() => DiscountType)
  discountType!: DiscountType;

  @Field(() => Float)
  discountValue!: number;

  @Field(() => Float, { nullable: true })
  minimumQuantity?: number;

  @Field(() => Float, { nullable: true })
  maximumQuantity?: number;

  @Field(() => Float, { nullable: true })
  minimumAmount?: number;

  @Field(() => Float, { nullable: true })
  maximumAmount?: number;

  @Field()
  effectiveDate!: Date;

  @Field({ nullable: true })
  expirationDate?: Date;

  @Field(() => Int)
  priority!: number;

  @Field()
  isActive!: boolean;

  @Field({ nullable: true })
  conditions?: string; // JSON string

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  metadata?: string; // JSON string

  // Field resolvers
  @Field({ nullable: true })
  targetEntity?: any; // Will be resolved via DataLoader

  @Field(() => Boolean)
  isCurrentlyActive!: boolean; // Computed field

  @Field(() => Int, { nullable: true })
  daysUntilExpiration?: number; // Computed field
}

/**
 * Customer Pricing Item Type
 */
@ObjectType()
export class CustomerPricingItemType {
  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => Float)
  listPrice!: number;

  @Field(() => Float)
  customerPrice!: number;

  @Field(() => Float)
  discountPercentage!: number;

  @Field(() => Float)
  discountAmount!: number;

  @Field(() => [PricingRuleType])
  appliedRules!: PricingRuleType[];

  @Field()
  pricingTier!: string;

  @Field({ nullable: true })
  contractPricing?: string; // JSON string

  // Field resolvers
  @Field({ nullable: true })
  product?: any; // Will be resolved via DataLoader
}

/**
 * Customer Pricing Response Type
 */
@ObjectType()
export class CustomerPricingResponse {
  @Field(() => ID)
  customerId!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => Float)
  listPrice!: number;

  @Field(() => Float)
  customerPrice!: number;

  @Field(() => Float)
  discountPercentage!: number;

  @Field(() => Float)
  discountAmount!: number;

  @Field(() => [PricingRuleType])
  appliedRules!: PricingRuleType[];

  @Field()
  pricingTier!: string;

  @Field({ nullable: true })
  contractPricing?: string; // JSON string
}

/**
 * Bulk Pricing Response Type
 */
@ObjectType()
export class BulkPricingResponse {
  @Field(() => ID)
  customerId!: string;

  @Field(() => [CustomerPricingItemType])
  items!: CustomerPricingItemType[];

  @Field(() => Float)
  totalListPrice!: number;

  @Field(() => Float)
  totalCustomerPrice!: number;

  @Field(() => Float)
  totalSavings!: number;

  @Field(() => Float)
  averageDiscountPercentage!: number; // Computed field
}

/**
 * Pricing Rules Response Type
 */
@ObjectType()
export class PricingRulesResponse {
  @Field(() => [PricingRuleType])
  rules!: PricingRuleType[];

  @Field(() => Int)
  total!: number;
}

/**
 * Pricing Rule Response Type
 */
@ObjectType()
export class PricingRuleResponse {
  @Field(() => PricingRuleType)
  rule!: PricingRuleType;

  @Field()
  message!: string;
}

/**
 * Pricing Analytics Type
 */
@ObjectType()
export class PricingAnalyticsType {
  @Field(() => Int)
  totalRules!: number;

  @Field(() => Int)
  activeRules!: number;

  @Field(() => Int)
  expiredRules!: number;

  @Field(() => Int)
  expiringRules!: number;

  @Field(() => Float)
  averageDiscountPercentage!: number;

  @Field(() => Float)
  totalSavingsGenerated!: number;

  @Field(() => [PricingRuleType])
  topPerformingRules!: PricingRuleType[];

  @Field(() => [PricingRuleType])
  underutilizedRules!: PricingRuleType[];
}