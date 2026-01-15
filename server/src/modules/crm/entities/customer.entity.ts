import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

@ObjectType()
export class Customer {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique customer identifier' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @Field()
  @ApiProperty({ description: 'Customer number' })
  customerNumber!: string;

  @Field()
  @ApiProperty({ description: 'Customer type', enum: ['individual', 'business'] })
  type!: 'individual' | 'business';

  @Field()
  @ApiProperty({ description: 'Customer status', enum: ['active', 'inactive', 'blocked', 'prospect'] })
  status!: 'active' | 'inactive' | 'blocked' | 'prospect';

  @Field({ nullable: true })
  @ApiProperty({ description: 'First name', required: false })
  firstName?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Last name', required: false })
  lastName?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Display name', required: false })
  displayName?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Company name', required: false })
  companyName?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Email address', required: false })
  email?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Phone number', required: false })
  phone?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Alternate phone number', required: false })
  alternatePhone?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Website URL', required: false })
  website?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Address line 1', required: false })
  addressLine1?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Address line 2', required: false })
  addressLine2?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'City', required: false })
  city?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'State/Province', required: false })
  state?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Postal code', required: false })
  postalCode?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Country', required: false })
  country?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Tax ID', required: false })
  taxId?: string;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Credit limit', required: false })
  creditLimit?: number;

  @Field(() => Int, { nullable: true })
  @ApiProperty({ description: 'Payment terms in days', required: false })
  paymentTerms?: number;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Discount percentage', required: false })
  discountPercentage?: number;

  @Field()
  @ApiProperty({ description: 'Loyalty tier', enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'] })
  loyaltyTier!: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

  @Field(() => Int)
  @ApiProperty({ description: 'Current loyalty points' })
  loyaltyPoints!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Lifetime loyalty points earned' })
  loyaltyPointsLifetime!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Total amount spent' })
  totalSpent!: number;

  @Field(() => Int)
  @ApiProperty({ description: 'Total number of orders' })
  totalOrders!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Average order value' })
  averageOrderValue!: number;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Last purchase date', required: false })
  lastPurchaseDate?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'First purchase date', required: false })
  firstPurchaseDate?: Date;

  @Field(() => Float)
  @ApiProperty({ description: 'Customer lifetime value' })
  lifetimeValue!: number;

  @Field(() => Float)
  @ApiProperty({ description: 'Predicted lifetime value' })
  predictedLifetimeValue!: number;

  @Field(() => Float, { nullable: true })
  @ApiProperty({ description: 'Churn risk probability (0-1)', required: false })
  churnRisk?: number;

  @Field()
  @ApiProperty({ description: 'Marketing opt-in status' })
  marketingOptIn!: boolean;

  @Field()
  @ApiProperty({ description: 'Email opt-in status' })
  emailOptIn!: boolean;

  @Field()
  @ApiProperty({ description: 'SMS opt-in status' })
  smsOptIn!: boolean;

  @Field(() => [String])
  @ApiProperty({ description: 'Customer tags' })
  tags!: string[];

  @Field({ nullable: true })
  @ApiProperty({ description: 'Customer notes', required: false })
  notes?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Referral code', required: false })
  referralCode?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Date of birth', required: false })
  dateOfBirth?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Anniversary date', required: false })
  anniversary?: Date;

  @Field()
  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update date' })
  updatedAt!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Deletion date', required: false })
  deletedAt?: Date;
}

@ObjectType()
export class CustomerSegment {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique segment identifier' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @Field()
  @ApiProperty({ description: 'Segment name' })
  name!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Segment description', required: false })
  description?: string;

  @Field()
  @ApiProperty({ description: 'Segment type', enum: ['demographic', 'behavioral', 'geographic', 'psychographic', 'value_based'] })
  type!: 'demographic' | 'behavioral' | 'geographic' | 'psychographic' | 'value_based';

  @Field(() => Int)
  @ApiProperty({ description: 'Number of customers in segment' })
  customerCount!: number;

  @Field()
  @ApiProperty({ description: 'Is segment active' })
  isActive!: boolean;

  @Field()
  @ApiProperty({ description: 'Is segment auto-updated' })
  isAutoUpdated!: boolean;

  @Field()
  @ApiProperty({ description: 'Update frequency' })
  updateFrequency!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Last calculation date', required: false })
  lastCalculatedAt?: Date;

  @Field()
  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update date' })
  updatedAt!: Date;
}

@ObjectType()
export class CustomerCommunication {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique communication identifier' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @Field()
  @ApiProperty({ description: 'Customer ID' })
  customerId!: string;

  @Field()
  @ApiProperty({ description: 'Communication channel', enum: ['email', 'sms', 'phone', 'in_person', 'chat', 'social_media'] })
  channel!: 'email' | 'sms' | 'phone' | 'in_person' | 'chat' | 'social_media';

  @Field()
  @ApiProperty({ description: 'Communication direction', enum: ['inbound', 'outbound'] })
  direction!: 'inbound' | 'outbound';

  @Field({ nullable: true })
  @ApiProperty({ description: 'Communication subject', required: false })
  subject?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Communication content', required: false })
  content?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Sent date', required: false })
  sentAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Delivered date', required: false })
  deliveredAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Read date', required: false })
  readAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Response date', required: false })
  respondedAt?: Date;

  @Field()
  @ApiProperty({ description: 'Communication status' })
  status!: string;

  @Field()
  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;
}

@ObjectType()
export class LoyaltyTransaction {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique loyalty transaction identifier' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @Field()
  @ApiProperty({ description: 'Customer ID' })
  customerId!: string;

  @Field()
  @ApiProperty({ description: 'Transaction type', enum: ['earned', 'redeemed', 'expired', 'adjusted'] })
  type!: 'earned' | 'redeemed' | 'expired' | 'adjusted';

  @Field(() => Int)
  @ApiProperty({ description: 'Points amount (positive for earned, negative for redeemed)' })
  points!: number;

  @Field()
  @ApiProperty({ description: 'Transaction description' })
  description!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Related POS transaction ID', required: false })
  relatedTransactionId?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Points expiration date', required: false })
  expiresAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Campaign ID', required: false })
  campaignId?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Promotion ID', required: false })
  promotionId?: string;

  @Field()
  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;
}