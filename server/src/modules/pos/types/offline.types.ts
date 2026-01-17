import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { BaseEntity } from '../../../common/graphql/base.types';

// Offline Queue Item Type
@ObjectType({ description: 'Offline operation queue item' })
export class OfflineQueueItem extends BaseEntity {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  queueId!: string;

  @Field(() => ID)
  deviceId!: string;

  @Field()
  operationType!: string;

  @Field()
  transactionData!: Record<string, any>;

  @Field()
  isSynced!: boolean;

  @Field(() => Int)
  syncAttempts!: number;

  @Field({ nullable: true })
  lastSyncAttempt?: Date;

  @Field({ nullable: true })
  syncedAt?: Date;

  @Field(() => [String])
  syncErrors!: string[];

  @Field(() => Int)
  priority!: number;

  @Field(() => Int)
  sequenceNumber!: number;
}

// Offline Status Type
@ObjectType({ description: 'Offline sync status for a device' })
export class OfflineStatus {
  @Field(() => ID)
  deviceId!: string;

  @Field()
  isOnline!: boolean;

  @Field(() => Int)
  pendingOperations!: number;

  @Field(() => Int)
  failedOperations!: number;

  @Field({ nullable: true })
  lastSync?: Date;

  @Field({ nullable: true })
  lastSyncError?: string;

  @Field(() => Int)
  syncVersion!: number;

  @Field()
  storageUsed!: number; // in bytes

  @Field()
  storageLimit!: number; // in bytes
}

// Sync Result Type
@ObjectType({ description: 'Result of offline sync operation' })
export class SyncResult {
  @Field()
  success!: boolean;

  @Field(() => Int)
  processedOperations!: number;

  @Field(() => Int)
  failedOperations!: number;

  @Field(() => [SyncError])
  errors!: SyncError[];

  @Field()
  syncStartedAt!: Date;

  @Field()
  syncCompletedAt!: Date;

  @Field(() => Int)
  syncDuration!: number; // in milliseconds
}

// Sync Error Type
@ObjectType({ description: 'Sync operation error' })
export class SyncError {
  @Field()
  operationId!: string;

  @Field()
  operationType!: string;

  @Field()
  error!: string;

  @Field()
  timestamp!: Date;

  @Field(() => Int)
  attemptNumber!: number;

  @Field()
  isRetryable!: boolean;
}

// Sync Conflict Type
@ObjectType({ description: 'Data synchronization conflict' })
export class SyncConflict {
  @Field(() => ID)
  conflictId!: string;

  @Field()
  operationId!: string;

  @Field()
  conflictType!: string;

  @Field()
  description!: string;

  @Field()
  serverData!: Record<string, any>;

  @Field()
  clientData!: Record<string, any>;

  @Field()
  detectedAt!: Date;

  @Field()
  isResolved!: boolean;

  @Field({ nullable: true })
  resolvedAt?: Date;

  @Field({ nullable: true })
  resolutionStrategy?: string;

  @Field({ nullable: true })
  resolvedData?: Record<string, any>;
}

// Cache Status Type
@ObjectType({ description: 'Offline cache status' })
export class CacheStatus {
  @Field()
  category!: string;

  @Field(() => Int)
  itemCount!: number;

  @Field()
  totalSize!: number; // in bytes

  @Field()
  lastUpdated!: Date;

  @Field({ nullable: true })
  expiresAt?: Date;

  @Field()
  isStale!: boolean;
}

// Offline Statistics Type
@ObjectType({ description: 'Offline operation statistics' })
export class OfflineStatistics {
  @Field(() => Int)
  totalOperations!: number;

  @Field(() => Int)
  pendingOperations!: number;

  @Field(() => Int)
  syncedOperations!: number;

  @Field(() => Int)
  failedOperations!: number;

  @Field(() => Int)
  conflictedOperations!: number;

  @Field()
  lastSyncAttempt!: Date;

  @Field({ nullable: true })
  lastSuccessfulSync?: Date;

  @Field(() => Int)
  averageSyncTime!: number; // in milliseconds

  @Field(() => [CacheStatus])
  cacheStatus!: CacheStatus[];
}

// Device Info Type
@ObjectType({ description: 'Device information for offline operations' })
export class DeviceInfo {
  @Field(() => ID)
  deviceId!: string;

  @Field()
  deviceName!: string;

  @Field()
  deviceType!: string; // 'tablet', 'mobile', 'desktop', 'pos_terminal'

  @Field()
  platform!: string; // 'ios', 'android', 'windows', 'web'

  @Field()
  appVersion!: string;

  @Field()
  isOnline!: boolean;

  @Field()
  lastSeen!: Date;

  @Field({ nullable: true })
  locationId?: string;

  @Field(() => OfflineStatistics)
  offlineStats!: OfflineStatistics;
}

// Sync Configuration Type
@ObjectType({ description: 'Offline sync configuration' })
export class SyncConfiguration {
  @Field()
  autoSyncEnabled!: boolean;

  @Field(() => Int)
  syncIntervalMinutes!: number;

  @Field(() => Int)
  maxRetryAttempts!: number;

  @Field(() => Int)
  retryDelaySeconds!: number;

  @Field(() => Int)
  batchSize!: number;

  @Field()
  conflictResolutionStrategy!: string; // 'server_wins', 'client_wins', 'manual'

  @Field(() => [String])
  priorityOperations!: string[];

  @Field(() => Int)
  cacheRetentionHours!: number;

  @Field(() => Int)
  maxCacheSizeMB!: number;
}