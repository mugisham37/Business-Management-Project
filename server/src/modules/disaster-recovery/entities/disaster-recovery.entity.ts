import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';

export enum DisasterType {
  HARDWARE_FAILURE = 'hardware_failure',
  NETWORK_OUTAGE = 'network_outage',
  DATA_CENTER_OUTAGE = 'data_center_outage',
  CYBER_ATTACK = 'cyber_attack',
  NATURAL_DISASTER = 'natural_disaster',
  HUMAN_ERROR = 'human_error',
  SOFTWARE_FAILURE = 'software_failure',
  POWER_OUTAGE = 'power_outage',
  DATA_CORRUPTION = 'data_corruption',
  SECURITY_BREACH = 'security_breach',
}

export enum RecoveryStatus {
  STANDBY = 'standby',
  DETECTING = 'detecting',
  INITIATING = 'initiating',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  COMPLETED_WITH_ERRORS = 'completed_with_errors',
  FAILED = 'failed',
  TESTING = 'testing',
  ROLLBACK = 'rollback',
}

export enum FailoverType {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
  PLANNED = 'planned',
  EMERGENCY = 'emergency',
}

export enum FailoverStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export enum ReplicationStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  FAILED = 'failed',
  SYNCING = 'syncing',
  LAG_WARNING = 'lag_warning',
  DISCONNECTED = 'disconnected',
}

registerEnumType(DisasterType, {
  name: 'DisasterType',
  description: 'Type of disaster scenario',
});

registerEnumType(RecoveryStatus, {
  name: 'RecoveryStatus',
  description: 'Status of disaster recovery process',
});

registerEnumType(FailoverType, {
  name: 'FailoverType',
  description: 'Type of failover operation',
});

registerEnumType(FailoverStatus, {
  name: 'FailoverStatus',
  description: 'Status of failover execution',
});

registerEnumType(ReplicationStatus, {
  name: 'ReplicationStatus',
  description: 'Status of data replication',
});

// Drizzle Schema Definitions
export const disasterRecoveryPlans = pgTable('disaster_recovery_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  disasterTypes: jsonb('disaster_types').notNull().$type<DisasterType[]>(),
  rtoMinutes: integer('rto_minutes').notNull(),
  rpoMinutes: integer('rpo_minutes').notNull(),
  primaryRegion: varchar('primary_region', { length: 100 }).notNull(),
  secondaryRegions: jsonb('secondary_regions').notNull().$type<string[]>(),
  automaticFailover: boolean('automatic_failover').notNull().default(false),
  configuration: jsonb('configuration').notNull().$type<Record<string, any>>(),
  isActive: boolean('is_active').notNull().default(true),
  lastTestedAt: timestamp('last_tested_at'),
  nextTestAt: timestamp('next_test_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
});

export const disasterRecoveryExecutions = pgTable('disaster_recovery_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  planId: uuid('plan_id').notNull(),
  disasterType: varchar('disaster_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  detectedAt: timestamp('detected_at').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  actualRtoMinutes: integer('actual_rto_minutes').notNull().default(0),
  actualRpoMinutes: integer('actual_rpo_minutes').notNull().default(0),
  executedSteps: jsonb('executed_steps').notNull().$type<Record<string, any>[]>().default([]),
  errors: jsonb('errors').notNull().$type<string[]>().default([]),
  warnings: jsonb('warnings').notNull().$type<string[]>().default([]),
  isTest: boolean('is_test').notNull().default(false),
  initiatedBy: uuid('initiated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const failoverConfigurations = pgTable('failover_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  serviceName: varchar('service_name', { length: 255 }).notNull(),
  primaryEndpoint: varchar('primary_endpoint', { length: 500 }).notNull(),
  secondaryEndpoints: jsonb('secondary_endpoints').notNull().$type<string[]>(),
  failoverType: varchar('failover_type', { length: 50 }).notNull(),
  healthCheckConfig: jsonb('health_check_config').notNull().$type<Record<string, any>>(),
  thresholds: jsonb('thresholds').notNull().$type<Record<string, any>>(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  currentActiveEndpoint: varchar('current_active_endpoint', { length: 500 }).notNull(),
  currentRegion: varchar('current_region', { length: 100 }),
  lastFailoverAt: timestamp('last_failover_at'),
  lastHealthCheckAt: timestamp('last_health_check_at'),
  isHealthy: boolean('is_healthy').default(true),
  healthCheckDetails: jsonb('health_check_details'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const failoverExecutions = pgTable('failover_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  configurationId: uuid('configuration_id').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  isAutomatic: boolean('is_automatic').notNull().default(false),
  reason: text('reason'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  failoverTimeSeconds: integer('failover_time_seconds'),
  targetRegion: varchar('target_region', { length: 100 }),
  result: jsonb('result'),
  error: text('error'),
  initiatedBy: varchar('initiated_by', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const replicationConfigurations = pgTable('replication_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  sourceEndpoint: varchar('source_endpoint', { length: 500 }).notNull(),
  targetEndpoint: varchar('target_endpoint', { length: 500 }).notNull(),
  sourceRegion: varchar('source_region', { length: 100 }).notNull(),
  targetRegion: varchar('target_region', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  lagSeconds: integer('lag_seconds').notNull().default(0),
  lastReplicationAt: timestamp('last_replication_at').notNull().defaultNow(),
  configuration: jsonb('configuration').notNull().$type<Record<string, any>>(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  lastStatusUpdateAt: timestamp('last_status_update_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const replicationStatusTable = pgTable('replication_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  configurationId: uuid('configuration_id').notNull(),
  lagSeconds: integer('lag_seconds').notNull(),
  bytesReplicated: integer('bytes_replicated').notNull().default(0),
  isHealthy: boolean('is_healthy').notNull().default(true),
  details: jsonb('details'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Type exports for Drizzle
export type InsertDisasterRecoveryPlan = typeof disasterRecoveryPlans.$inferInsert;
export type InsertDisasterRecoveryExecution = typeof disasterRecoveryExecutions.$inferInsert;
export type InsertFailoverConfiguration = typeof failoverConfigurations.$inferInsert;
export type InsertFailoverExecution = typeof failoverExecutions.$inferInsert;
export type InsertReplicationConfiguration = typeof replicationConfigurations.$inferInsert;
export type InsertReplicationStatus = typeof replicationStatusTable.$inferInsert;

export type FailoverExecution = typeof failoverExecutions.$inferSelect;

@ObjectType()
export class DisasterRecoveryPlan {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique identifier for the DR plan' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID this plan belongs to' })
  tenantId!: string;

  @Field()
  @ApiProperty({ description: 'Name of the disaster recovery plan' })
  name!: string;

  @Field()
  @ApiProperty({ description: 'Description of the plan' })
  description!: string;

  @Field(() => [DisasterType])
  @ApiProperty({ enum: DisasterType, isArray: true, description: 'Types of disasters covered' })
  disasterTypes!: DisasterType[];

  @Field()
  @ApiProperty({ description: 'Recovery Time Objective in minutes' })
  rtoMinutes!: number;

  @Field()
  @ApiProperty({ description: 'Recovery Point Objective in minutes' })
  rpoMinutes!: number;

  @Field()
  @ApiProperty({ description: 'Primary data center region' })
  primaryRegion!: string;

  @Field(() => [String])
  @ApiProperty({ description: 'Secondary data center regions' })
  secondaryRegions!: string[];

  @Field()
  @ApiProperty({ description: 'Automatic failover enabled' })
  automaticFailover!: boolean;

  @Field()
  @ApiProperty({ description: 'Plan configuration and procedures' })
  configuration!: Record<string, any>;

  @Field()
  @ApiProperty({ description: 'Whether plan is active' })
  isActive!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Last test execution date', required: false })
  lastTestedAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Next scheduled test date', required: false })
  nextTestAt?: Date;

  @Field()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'User who created the plan', required: false })
  createdBy?: string;
}

@ObjectType()
export class DisasterRecoveryExecution {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique identifier for the DR execution' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID this execution belongs to' })
  tenantId!: string;

  @Field()
  @ApiProperty({ description: 'DR plan ID being executed' })
  planId!: string;

  @Field(() => DisasterType)
  @ApiProperty({ enum: DisasterType, description: 'Type of disaster detected' })
  disasterType!: DisasterType;

  @Field(() => RecoveryStatus)
  @ApiProperty({ enum: RecoveryStatus, description: 'Current recovery status' })
  status!: RecoveryStatus;

  @Field()
  @ApiProperty({ description: 'Timestamp when disaster was detected' })
  detectedAt!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Timestamp when recovery started', required: false })
  startedAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Timestamp when recovery completed', required: false })
  completedAt?: Date;

  @Field()
  @ApiProperty({ description: 'Actual Recovery Time Objective achieved in minutes' })
  actualRtoMinutes!: number;

  @Field()
  @ApiProperty({ description: 'Actual Recovery Point Objective achieved in minutes' })
  actualRpoMinutes!: number;

  @Field()
  @ApiProperty({ description: 'Recovery steps executed' })
  executedSteps!: Record<string, any>[];

  @Field(() => [String])
  @ApiProperty({ description: 'Errors encountered during recovery' })
  errors!: string[];

  @Field(() => [String])
  @ApiProperty({ description: 'Warnings generated during recovery' })
  warnings!: string[];

  @Field()
  @ApiProperty({ description: 'Whether this was a test execution' })
  isTest!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'User who initiated the recovery', required: false })
  initiatedBy?: string;

  @Field()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

@ObjectType()
export class FailoverConfiguration {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique identifier for failover config' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID this config belongs to' })
  tenantId!: string;

  @Field()
  @ApiProperty({ description: 'Service or component name' })
  serviceName!: string;

  @Field()
  @ApiProperty({ description: 'Primary endpoint or resource' })
  primaryEndpoint!: string;

  @Field(() => [String])
  @ApiProperty({ description: 'Secondary endpoints or resources' })
  secondaryEndpoints!: string[];

  @Field(() => FailoverType)
  @ApiProperty({ enum: FailoverType, description: 'Type of failover' })
  failoverType!: FailoverType;

  @Field()
  @ApiProperty({ description: 'Health check configuration' })
  healthCheckConfig!: Record<string, any>;

  @Field()
  @ApiProperty({ description: 'Failover threshold settings' })
  thresholds!: Record<string, any>;

  @Field()
  @ApiProperty({ description: 'Whether failover is enabled' })
  isEnabled!: boolean;

  @Field()
  @ApiProperty({ description: 'Whether configuration is active' })
  isActive!: boolean;

  @Field()
  @ApiProperty({ description: 'Enable automatic failover' })
  automaticFailover!: boolean;

  @Field()
  @ApiProperty({ description: 'Current active endpoint' })
  currentActiveEndpoint!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Last failover timestamp', required: false })
  lastFailoverAt?: Date;

  @Field()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

@ObjectType()
export class ReplicationConfiguration {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique identifier for replication config' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID this config belongs to' })
  tenantId!: string;

  @Field()
  @ApiProperty({ description: 'Source database or service' })
  sourceEndpoint!: string;

  @Field()
  @ApiProperty({ description: 'Target database or service' })
  targetEndpoint!: string;

  @Field()
  @ApiProperty({ description: 'Source region' })
  sourceRegion!: string;

  @Field()
  @ApiProperty({ description: 'Target region' })
  targetRegion!: string;

  @Field(() => ReplicationStatus)
  @ApiProperty({ enum: ReplicationStatus, description: 'Current replication status' })
  status!: ReplicationStatus;

  @Field()
  @ApiProperty({ description: 'Replication lag in seconds' })
  lagSeconds!: number;

  @Field()
  @ApiProperty({ description: 'Last successful replication timestamp' })
  lastReplicationAt!: Date;

  @Field()
  @ApiProperty({ description: 'Replication configuration settings' })
  configuration!: Record<string, any>;

  @Field()
  @ApiProperty({ description: 'Whether replication is enabled' })
  isEnabled!: boolean;

  @Field()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

@ObjectType()
export class DisasterRecoveryMetrics {
  @Field()
  @ApiProperty({ description: 'Average RTO achieved in minutes' })
  averageRtoMinutes!: number;

  @Field()
  @ApiProperty({ description: 'Average RPO achieved in minutes' })
  averageRpoMinutes!: number;

  @Field()
  @ApiProperty({ description: 'Success rate percentage' })
  successRate!: number;

  @Field()
  @ApiProperty({ description: 'Total number of DR executions' })
  totalExecutions!: number;

  @Field()
  @ApiProperty({ description: 'Number of successful recoveries' })
  successfulRecoveries!: number;

  @Field()
  @ApiProperty({ description: 'Number of failed recoveries' })
  failedRecoveries!: number;

  @Field()
  @ApiProperty({ description: 'Number of test executions' })
  testExecutions!: number;

  @Field()
  @ApiProperty({ description: 'Last successful recovery timestamp' })
  lastSuccessfulRecovery!: Date;

  @Field()
  @ApiProperty({ description: 'Next scheduled test timestamp' })
  nextScheduledTest!: Date;

  @Field()
  @ApiProperty({ description: 'Current system health score (0-100)' })
  healthScore!: number;
}