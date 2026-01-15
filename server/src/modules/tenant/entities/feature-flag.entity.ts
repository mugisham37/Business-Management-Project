import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { BusinessTier } from './tenant.entity';

export enum FeatureFlagStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ROLLOUT = 'rollout',
  TESTING = 'testing',
}

registerEnumType(FeatureFlagStatus, {
  name: 'FeatureFlagStatus',
  description: 'Feature flag status for gradual rollout and testing',
});

@ObjectType()
export class FeatureRule {
  @Field()
  @ApiProperty({ description: 'Rule condition (e.g., "employeeCount > 10")' })
  condition!: string;

  @Field()
  @ApiProperty({ description: 'Rule value (true/false)' })
  value!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Rule description' })
  description?: string;
}

@ObjectType()
export class FeatureFlag {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique identifier for the feature flag' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID this feature flag belongs to' })
  tenantId!: string;

  @Field()
  @ApiProperty({ description: 'Feature name (kebab-case)' })
  featureName!: string;

  @Field()
  @ApiProperty({ description: 'Whether the feature is enabled' })
  isEnabled!: boolean;

  @Field(() => BusinessTier, { nullable: true })
  @ApiProperty({ enum: BusinessTier, description: 'Required business tier for this feature' })
  requiredTier?: BusinessTier;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Rollout percentage (0-100)' })
  rolloutPercentage?: number;

  @Field(() => [FeatureRule], { nullable: true })
  @ApiProperty({ type: [FeatureRule], description: 'Custom rules for feature evaluation' })
  customRules?: FeatureRule[];

  @Field(() => FeatureFlagStatus)
  @ApiProperty({ enum: FeatureFlagStatus, description: 'Feature flag status' })
  status!: FeatureFlagStatus;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Feature description' })
  description?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'When the feature was enabled' })
  enabledAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'When the feature was disabled' })
  disabledAt?: Date;

  @Field()
  @ApiProperty({ description: 'Feature flag creation timestamp' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

// Predefined feature definitions
export interface FeatureDefinition {
  name: string;
  displayName: string;
  description: string;
  requiredTier: BusinessTier;
  category: string;
  dependencies?: string[];
  customRules?: FeatureRule[];
}

export const FEATURE_DEFINITIONS: Record<string, FeatureDefinition> = {
  // Core POS Features
  'point-of-sale': {
    name: 'point-of-sale',
    displayName: 'Point of Sale',
    description: 'Basic POS functionality for processing transactions',
    requiredTier: BusinessTier.MICRO,
    category: 'pos',
  },
  'advanced-pos': {
    name: 'advanced-pos',
    displayName: 'Advanced POS',
    description: 'Advanced POS features like discounts, promotions, and complex pricing',
    requiredTier: BusinessTier.SMALL,
    category: 'pos',
    dependencies: ['point-of-sale'],
  },
  'offline-pos': {
    name: 'offline-pos',
    displayName: 'Offline POS',
    description: 'Offline transaction processing with sync capabilities',
    requiredTier: BusinessTier.SMALL,
    category: 'pos',
    dependencies: ['point-of-sale'],
  },

  // Inventory Management
  'inventory-management': {
    name: 'inventory-management',
    displayName: 'Inventory Management',
    description: 'Basic inventory tracking and management',
    requiredTier: BusinessTier.MICRO,
    category: 'inventory',
  },
  'advanced-inventory': {
    name: 'advanced-inventory',
    displayName: 'Advanced Inventory',
    description: 'Multi-location inventory, lot tracking, and automated reordering',
    requiredTier: BusinessTier.SMALL,
    category: 'inventory',
    dependencies: ['inventory-management'],
  },
  'warehouse-management': {
    name: 'warehouse-management',
    displayName: 'Warehouse Management',
    description: 'Advanced warehouse operations, bin locations, and picking optimization',
    requiredTier: BusinessTier.MEDIUM,
    category: 'inventory',
    dependencies: ['advanced-inventory'],
  },

  // Customer Management
  'customer-management': {
    name: 'customer-management',
    displayName: 'Customer Management',
    description: 'Basic customer profiles and purchase history',
    requiredTier: BusinessTier.MICRO,
    category: 'crm',
  },
  'loyalty-program': {
    name: 'loyalty-program',
    displayName: 'Loyalty Program',
    description: 'Customer loyalty points, tiers, and rewards',
    requiredTier: BusinessTier.SMALL,
    category: 'crm',
    dependencies: ['customer-management'],
  },
  'advanced-crm': {
    name: 'advanced-crm',
    displayName: 'Advanced CRM',
    description: 'Customer segmentation, analytics, and marketing campaigns',
    requiredTier: BusinessTier.MEDIUM,
    category: 'crm',
    dependencies: ['customer-management'],
  },

  // Employee Management
  'employee-management': {
    name: 'employee-management',
    displayName: 'Employee Management',
    description: 'Basic employee profiles and role management',
    requiredTier: BusinessTier.SMALL,
    category: 'hr',
  },
  'time-tracking': {
    name: 'time-tracking',
    displayName: 'Time Tracking',
    description: 'Employee time tracking and attendance management',
    requiredTier: BusinessTier.SMALL,
    category: 'hr',
    dependencies: ['employee-management'],
  },
  'payroll-management': {
    name: 'payroll-management',
    displayName: 'Payroll Management',
    description: 'Payroll calculation and processing',
    requiredTier: BusinessTier.MEDIUM,
    category: 'hr',
    dependencies: ['employee-management', 'time-tracking'],
  },

  // Financial Management
  'basic-reporting': {
    name: 'basic-reporting',
    displayName: 'Basic Reporting',
    description: 'Basic sales and inventory reports',
    requiredTier: BusinessTier.MICRO,
    category: 'financial',
  },
  'financial-management': {
    name: 'financial-management',
    displayName: 'Financial Management',
    description: 'Complete accounting, P&L, and financial reporting',
    requiredTier: BusinessTier.MEDIUM,
    category: 'financial',
    dependencies: ['basic-reporting'],
  },
  'advanced-analytics': {
    name: 'advanced-analytics',
    displayName: 'Advanced Analytics',
    description: 'Predictive analytics, forecasting, and business intelligence',
    requiredTier: BusinessTier.ENTERPRISE,
    category: 'analytics',
    dependencies: ['financial-management'],
  },

  // Multi-Location
  'multi-location': {
    name: 'multi-location',
    displayName: 'Multi-Location',
    description: 'Multi-location operations and centralized management',
    requiredTier: BusinessTier.SMALL,
    category: 'operations',
  },
  'location-analytics': {
    name: 'location-analytics',
    displayName: 'Location Analytics',
    description: 'Location-specific analytics and performance comparison',
    requiredTier: BusinessTier.MEDIUM,
    category: 'analytics',
    dependencies: ['multi-location'],
  },

  // Real-time Features
  'real-time-updates': {
    name: 'real-time-updates',
    displayName: 'Real-time Updates',
    description: 'Real-time data synchronization and live updates',
    requiredTier: BusinessTier.SMALL,
    category: 'realtime',
  },
  'real-time-inventory': {
    name: 'real-time-inventory',
    displayName: 'Real-time Inventory',
    description: 'Real-time inventory updates across all locations',
    requiredTier: BusinessTier.MEDIUM,
    category: 'realtime',
    dependencies: ['real-time-updates', 'multi-location'],
  },

  // B2B Features
  'b2b-operations': {
    name: 'b2b-operations',
    displayName: 'B2B Operations',
    description: 'B2B customer management, wholesale pricing, and bulk operations',
    requiredTier: BusinessTier.MEDIUM,
    category: 'b2b',
  },
  'quote-management': {
    name: 'quote-management',
    displayName: 'Quote Management',
    description: 'Quote generation, approval workflows, and conversion tracking',
    requiredTier: BusinessTier.MEDIUM,
    category: 'b2b',
    dependencies: ['b2b-operations'],
  },

  // Integration Features
  'api-access': {
    name: 'api-access',
    displayName: 'API Access',
    description: 'REST and GraphQL API access for integrations',
    requiredTier: BusinessTier.SMALL,
    category: 'integration',
  },
  'advanced-integrations': {
    name: 'advanced-integrations',
    displayName: 'Advanced Integrations',
    description: 'Pre-built connectors and advanced integration features',
    requiredTier: BusinessTier.MEDIUM,
    category: 'integration',
    dependencies: ['api-access'],
  },
  'custom-integrations': {
    name: 'custom-integrations',
    displayName: 'Custom Integrations',
    description: 'Custom integration development and webhook management',
    requiredTier: BusinessTier.ENTERPRISE,
    category: 'integration',
    dependencies: ['advanced-integrations'],
  },
};