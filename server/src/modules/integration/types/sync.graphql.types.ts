import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { BaseEntity } from '../../../common/graphql/base.types';

export enum SyncStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  COMPLETED_WITH_ERRORS = 'completed_with_errors',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum SyncType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  SELECTIVE = 'selective',
}

export enum ConflictResolutionStrategy {
  LOCAL_WINS = 'local_wins',
  REMOTE_WINS = 'remote_wins',
  MERGE = 'merge',
  MANUAL = 'manual',
}

registerEnumType(SyncStatus, { name: 'SyncStatus' });
registerEnumType(SyncType, { name: 'SyncType' });
registerEnumType(ConflictResolutionStrategy, { name: 'ConflictResolutionStrategy' });

@ObjectType()
export class SyncLogType extends BaseEntity {
  @Field(() => ID)
  declare id: string;

  @Field()
  integrationId!: string;

  @Field()
  declare tenantId: string;

  @Field(() => SyncType)
  type!: SyncType;

  @Field(() => SyncStatus)
  status!: SyncStatus;

  @Field()
  triggeredBy!: string;

  @Field()
  startedAt!: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field(() => Int, { nullable: true })
  duration?: number;

  @Field(() => Int, { nullable: true })
  recordsProcessed?: number;

  @Field(() => Int, { nullable: true })
  recordsSucceeded?: number;

  @Field(() => Int, { nullable: true })
  recordsFailed?: number;

  @Field(() => Int, { nullable: true })
  recordsSkipped?: number;

  @Field(() => [SyncErrorType], { nullable: true })
  errors?: SyncErrorType[];

  @Field(() => [String], { nullable: true })
  warnings?: string[];

  @Field({ nullable: true })
  nextSyncToken?: string;

  @Field()
  declare createdAt: Date;

  @Field()
  declare updatedAt: Date;
}

@ObjectType()
export class SyncErrorType {
  @Field({ nullable: true })
  record?: string;

  @Field()
  error!: string;

  @Field({ nullable: true })
  code?: string;
}

@ObjectType()
export class SyncConflictType {
  @Field(() => ID)
  id!: string;

  @Field()
  syncId!: string;

  @Field()
  entityType!: string;

  @Field()
  entityId!: string;

  @Field()
  localData!: string;

  @Field()
  remoteData!: string;

  @Field(() => ConflictResolutionStrategy)
  resolutionStrategy!: ConflictResolutionStrategy;

  @Field({ nullable: true })
  resolvedData?: string;

  @Field()
  isResolved!: boolean;

  @Field()
  createdAt!: Date;

  @Field({ nullable: true })
  resolvedAt?: Date;
}

@ObjectType()
export class SyncStatisticsType {
  @Field()
  integrationId!: string;

  @Field(() => Int)
  totalSyncs!: number;

  @Field(() => Int)
  successfulSyncs!: number;

  @Field(() => Int)
  failedSyncs!: number;

  @Field()
  successRate!: number;

  @Field(() => Int)
  averageDuration!: number;

  @Field({ nullable: true })
  lastSyncAt?: Date;

  @Field({ nullable: true })
  nextSyncAt?: Date;

  @Field(() => [EntitySyncStatsType])
  entityStats!: EntitySyncStatsType[];
}

@ObjectType()
export class EntitySyncStatsType {
  @Field()
  entityType!: string;

  @Field(() => Int)
  recordsProcessed!: number;

  @Field(() => Int)
  recordsCreated!: number;

  @Field(() => Int)
  recordsUpdated!: number;

  @Field(() => Int)
  recordsDeleted!: number;

  @Field(() => Int)
  recordsSkipped!: number;

  @Field(() => Int)
  conflicts!: number;
}