import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ description: 'Sync log ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Integration ID' })
  @IsUUID()
  integrationId: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;

  @ApiProperty({ description: 'Sync type', enum: SyncType })
  @IsEnum(SyncType)
  type: SyncType;

  @ApiProperty({ description: 'Sync status', enum: SyncStatus })
  @IsEnum(SyncStatus)
  status: SyncStatus;

  @ApiProperty({ description: 'Who triggered the sync' })
  triggeredBy: 'manual' | 'scheduled' | 'webhook';

  @ApiProperty({ description: 'Sync start timestamp' })
  @IsDate()
  startedAt: Date;

  @ApiPropertyOptional({ description: 'Sync completion timestamp' })
  @IsOptional()
  @IsDate()
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Sync duration in milliseconds' })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({ description: 'Number of records processed' })
  @IsOptional()
  @IsNumber()
  recordsProcessed?: number;

  @ApiPropertyOptional({ description: 'Number of records created' })
  @IsOptional()
  @IsNumber()
  recordsCreated?: number;

  @ApiPropertyOptional({ description: 'Number of records updated' })
  @IsOptional()
  @IsNumber()
  recordsUpdated?: number;

  @ApiPropertyOptional({ description: 'Number of records deleted' })
  @IsOptional()
  @IsNumber()
  recordsDeleted?: number;

  @ApiPropertyOptional({ description: 'Number of records skipped' })
  @IsOptional()
  @IsNumber()
  recordsSkipped?: number;

  @ApiPropertyOptional({ description: 'Sync options and configuration' })
  @IsOptional()
  @IsObject()
  options?: {
    entityTypes?: string[];
    lastSyncTimestamp?: Date;
    batchSize?: number;
    conflictResolution?: ConflictResolutionStrategy;
  };

  @ApiPropertyOptional({ description: 'Conflicts encountered during sync' })
  @IsOptional()
  @IsArray()
  conflicts?: Array<{
    entityType: string;
    entityId: string;
    localData: any;
    remoteData: any;
    conflictType: 'update_conflict' | 'delete_conflict' | 'create_conflict';
    resolution?: 'local_wins' | 'remote_wins' | 'merge' | 'manual_required';
    resolvedData?: any;
  }>;

  @ApiPropertyOptional({ description: 'Errors encountered during sync' })
  @IsOptional()
  @IsArray()
  errors?: Array<{
    entityType: string;
    entityId?: string;
    error: string;
    details?: any;
    retryable: boolean;
  }>;

  @ApiPropertyOptional({ description: 'Additional sync metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Created at timestamp' })
  @IsDate()
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  @IsDate()
  updatedAt: Date;
}

export interface SyncStatistics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSyncAt?: Date;
  averageDuration: number;
  totalRecordsProcessed: number;
  totalConflicts: number;
  syncFrequency: number;
}