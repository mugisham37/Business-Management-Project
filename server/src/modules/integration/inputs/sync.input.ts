import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum, IsArray, IsInt, IsDate, Min } from 'class-validator';
import { SyncType, SyncStatus, ConflictResolutionStrategy } from '../types/sync.graphql.types';

@InputType()
export class TriggerSyncInput {
  @Field(() => SyncType, { nullable: true, defaultValue: SyncType.INCREMENTAL })
  @IsOptional()
  @IsEnum(SyncType)
  type?: SyncType;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entityTypes?: string[];

  @Field({ nullable: true })
  @IsOptional()
  fullSync?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  batchSize?: number;

  @Field(() => ConflictResolutionStrategy, { nullable: true, defaultValue: ConflictResolutionStrategy.REMOTE_WINS })
  @IsOptional()
  @IsEnum(ConflictResolutionStrategy)
  conflictResolution?: ConflictResolutionStrategy;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  lastSyncTimestamp?: Date;
}

@InputType()
export class ResolveSyncConflictInput {
  @Field()
  @IsString()
  conflictId!: string;

  @Field(() => ConflictResolutionStrategy)
  @IsEnum(ConflictResolutionStrategy)
  resolutionStrategy!: ConflictResolutionStrategy;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  resolvedData?: string;
}

@InputType()
export class SyncFilterInput {
  @Field(() => SyncStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SyncStatus)
  status?: SyncStatus;

  @Field(() => SyncType, { nullable: true })
  @IsOptional()
  @IsEnum(SyncType)
  type?: SyncType;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  triggeredBy?: string;
}

@InputType()
export class ScheduleSyncInput {
  @Field()
  @IsString()
  cronExpression!: string;

  @Field(() => SyncType, { defaultValue: SyncType.INCREMENTAL })
  @IsEnum(SyncType)
  type!: SyncType;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entityTypes?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string;
}