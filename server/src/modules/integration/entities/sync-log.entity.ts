import { IsEnum, IsUUID, IsOptional, IsObject, IsArray, IsNumber, IsDate } from 'class-validator';

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

export class SyncLog {
  @IsUUID()
  id!: string;

  @IsUUID()
  integrationId!: string;

  @IsUUID()
  tenantId!: string;

  @IsEnum(SyncType)
  type!: SyncType;

  @IsEnum(SyncStatus)
  status!: SyncStatus;

  triggeredBy!: 'manual' | 'scheduled' | 'webhook';

  @IsDate()
  startedAt!: Date;

  @IsOptional()
  @IsDate()
  completedAt?: Date;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsNumber()
  recordsProcessed?: number;

  @IsOptional()
  @IsNumber()
  recordsCreated?: number;

  @IsOptional()
  @IsNumber()
  recordsUpdated?: number;

  @IsOptional()
  @IsNumber()
  recordsDeleted?: number;

  @IsOptional()
  @IsNumber()
  recordsSucceeded?: number;

  @IsOptional()
  @IsNumber()
  recordsFailed?: number;

  @IsOptional()
  @IsNumber()
  recordsSkipped?: number;

  @IsOptional()
  @IsArray()
  errors?: Array<{
    entityType?: string;
    record?: any;
    error: string;
    code?: string;
    details?: string;
    retryable?: boolean;
  }>;

  @IsOptional()
  @IsArray()
  warnings?: string[];

  @IsOptional()
  @IsArray()
  conflicts?: SyncConflict[];

  @IsOptional()
  @IsObject()
  options?: Record<string, any>;

  @IsOptional()
  @IsObject()
  summary?: Record<string, any>;

  @IsOptional()
  nextSyncToken?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;
}

export interface SyncStatistics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageDuration: number;
  lastSyncAt?: Date;
  totalRecordsProcessed: number;
  successRate: number;
  totalConflicts?: number;
  syncFrequency?: number;
}

export interface SyncConflict {
  id?: string;
  syncId: string;
  entityType: string;
  entityId: string;
  localValue: any;
  remoteValue: any;
  resolvedValue?: any;
  strategy?: ConflictResolutionStrategy;
  status: 'pending' | 'resolved' | 'ignored';
  createdAt?: Date;
}
