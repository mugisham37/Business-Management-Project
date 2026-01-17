import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
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
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field(() => [DisasterType])
  disasterTypes!: DisasterType[];

  @Field()
  rtoMinutes!: number;

  @Field()
  rpoMinutes!: number;

  @Field()
  primaryRegion!: string;

  @Field(() => [String])
  secondaryRegions!: string[];

  @Field()
  automaticFailover!: boolean;

  @Field()
  configuration!: Record<string, any>;

  @Field()
  isActive!: boolean;

  @Field({ nullable: true })
  lastTestedAt?: Date;

  @Field({ nullable: true })
  nextTestAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  createdBy?: string;
}

@ObjectType()
export class DisasterRecoveryExecution {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  planId!: string;

  @Field(() => DisasterType)
  disasterType!: DisasterType;

  @Field(() => RecoveryStatus)
  status!: RecoveryStatus;

  @Field()
  detectedAt!: Date;

  @Field({ nullable: true })
  startedAt?: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field()
  actualRtoMinutes!: number;

  @Field()
  actualRpoMinutes!: number;

  @Field()
  executedSteps!: Record<string, any>[];

  @Field(() => [String])
  errors!: string[];

  @Field(() => [String])
  warnings!: string[];

  @Field()
  isTest!: boolean;

  @Field({ nullable: true })
  initiatedBy?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class FailoverConfiguration {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  serviceName!: string;

  @Field()
  primaryEndpoint!: string;

  @Field(() => [String])
  secondaryEndpoints!: string[];

  @Field(() => FailoverType)
  failoverType!: FailoverType;

  @Field()
  healthCheckConfig!: Record<string, any>;

  @Field()
  thresholds!: Record<string, any>;

  @Field()
  isEnabled!: boolean;

  @Field()
  isActive!: boolean;

  @Field()
  automaticFailover!: boolean;

  @Field()
  currentActiveEndpoint!: string;

  @Field({ nullable: true })
  lastFailoverAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class ReplicationConfiguration {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  sourceEndpoint!: string;

  @Field()
  targetEndpoint!: string;

  @Field()
  sourceRegion!: string;

  @Field()
  targetRegion!: string;

  @Field(() => ReplicationStatus)
  status!: ReplicationStatus;

  @Field()
  lagSeconds!: number;

  @Field()
  lastReplicationAt!: Date;

  @Field()
  configuration!: Record<string, any>;

  @Field()
  isEnabled!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class DisasterRecoveryMetrics {
  @Field()
  averageRtoMinutes!: number;

  @Field()
  averageRpoMinutes!: number;

  @Field()
  successRate!: number;

  @Field()
  totalExecutions!: number;

  @Field()
  successfulRecoveries!: number;

  @Field()
  failedRecoveries!: number;

  @Field()
  testExecutions!: number;

  @Field()
  lastSuccessfulRecovery!: Date;

  @Field()
  nextScheduledTest!: Date;

  @Field()
  healthScore!: number;
}