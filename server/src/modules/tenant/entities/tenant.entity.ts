import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

export enum BusinessTier {
  MICRO = 'micro',
  SMALL = 'small',
  MEDIUM = 'medium',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  SUSPENDED = 'suspended',
}

// Register enums for GraphQL
registerEnumType(BusinessTier, {
  name: 'BusinessTier',
  description: 'Business tier levels for progressive feature disclosure',
});

registerEnumType(SubscriptionStatus, {
  name: 'SubscriptionStatus',
  description: 'Subscription status for tenant billing',
});

@ObjectType()
export class BusinessMetrics {
  @Field()
  @ApiProperty({ description: 'Number of employees in the organization' })
  employeeCount!: number;

  @Field()
  @ApiProperty({ description: 'Number of business locations' })
  locationCount!: number;

  @Field()
  @ApiProperty({ description: 'Monthly transaction volume' })
  monthlyTransactionVolume!: number;

  @Field()
  @ApiProperty({ description: 'Monthly revenue in cents' })
  monthlyRevenue!: number;
}

@ObjectType()
export class TenantSettings {
  @Field({ nullable: true })
  @ApiProperty({ description: 'Default timezone for the tenant' })
  timezone?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Default locale for the tenant' })
  locale?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Default currency code' })
  currency?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Business logo URL' })
  logoUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Primary brand color' })
  primaryColor?: string;
}

@ObjectType()
export class Tenant {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique identifier for the tenant' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant name' })
  name!: string;

  @Field()
  @ApiProperty({ description: 'Unique slug for the tenant' })
  slug!: string;

  @Field(() => BusinessTier)
  @ApiProperty({ enum: BusinessTier, description: 'Current business tier' })
  businessTier!: BusinessTier;

  @Field(() => SubscriptionStatus)
  @ApiProperty({ enum: SubscriptionStatus, description: 'Subscription status' })
  subscriptionStatus!: SubscriptionStatus;

  @Field(() => TenantSettings, { nullable: true })
  @ApiProperty({ type: TenantSettings, description: 'Tenant configuration settings' })
  settings?: TenantSettings;

  @Field(() => BusinessMetrics)
  @ApiProperty({ type: BusinessMetrics, description: 'Business metrics for tier calculation' })
  metrics!: BusinessMetrics;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Contact email for the tenant' })
  contactEmail?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Contact phone for the tenant' })
  contactPhone?: string;

  @Field()
  @ApiProperty({ description: 'Tenant creation timestamp' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Subscription start date' })
  subscriptionStartDate?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Subscription end date' })
  subscriptionEndDate?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Trial end date' })
  trialEndDate?: Date;

  @Field()
  @ApiProperty({ description: 'Whether the tenant is active' })
  isActive!: boolean;
}