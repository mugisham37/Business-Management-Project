import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsArray, IsEnum, IsNumber, Min, Max } from 'class-validator';

@InputType({ description: 'Input for syncing offline transactions' })
export class SyncOfflineTransactionsInput {
  @Field(() => ID)
  @IsString()
  deviceId!: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operationIds?: string[];

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  batchSize?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  conflictResolutionStrategy?: string;
}

@InputType({ description: 'Input for resolving sync conflicts' })
export class ResolveConflictInput {
  @Field(() => ID)
  @IsString()
  conflictId!: string;

  @Field()
  @IsString()
  @IsEnum(['server_wins', 'client_wins', 'merge', 'manual'])
  resolutionStrategy!: string;

  @Field({ nullable: true })
  @IsOptional()
  resolvedData?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType({ description: 'Input for caching essential data offline' })
export class CacheEssentialDataInput {
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  dataTypes!: string[];

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  locationId?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(72)
  cacheExpiryHours?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  priority?: string;
}

@InputType({ description: 'Input for clearing offline cache' })
export class ClearOfflineCacheInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  olderThan?: string; // ISO date string
}

@InputType({ description: 'Input for configuring offline sync settings' })
export class ConfigureOfflineSyncInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @Field({ nullable: true })
  @IsOptional()
  autoSyncEnabled?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  syncIntervalMinutes?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxRetryAttempts?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(300)
  retryDelaySeconds?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  batchSize?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsEnum(['server_wins', 'client_wins', 'manual'])
  conflictResolutionStrategy?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  priorityOperations?: string[];

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  cacheRetentionHours?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(1000)
  maxCacheSizeMB?: number;
}

@InputType({ description: 'Input for queuing offline operation' })
export class QueueOfflineOperationInput {
  @Field(() => ID)
  @IsString()
  deviceId!: string;

  @Field()
  @IsString()
  operationType!: string;

  @Field()
  operationData!: Record<string, any>;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @Field({ nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType({ description: 'Input for offline transaction creation' })
export class CreateOfflineTransactionInput {
  @Field(() => ID)
  @IsString()
  deviceId!: string;

  @Field()
  @IsString()
  offlineTransactionId!: string;

  @Field()
  transactionData!: Record<string, any>;

  @Field()
  timestamp!: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType({ description: 'Input for device registration' })
export class RegisterDeviceInput {
  @Field(() => ID)
  @IsString()
  deviceId!: string;

  @Field()
  @IsString()
  deviceName!: string;

  @Field()
  @IsString()
  deviceType!: string;

  @Field()
  @IsString()
  platform!: string;

  @Field()
  @IsString()
  appVersion!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  locationId?: string;

  @Field({ nullable: true })
  @IsOptional()
  capabilities?: Record<string, any>;
}