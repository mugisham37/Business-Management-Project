import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';

export enum BackupType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  DIFFERENTIAL = 'differential',
  POINT_IN_TIME = 'point_in_time',
}

export enum BackupStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  VERIFYING = 'verifying',
  VERIFIED = 'verified',
  VERIFICATION_FAILED = 'verification_failed',
}

export enum BackupStorageLocation {
  LOCAL = 'local',
  S3 = 's3',
  AZURE_BLOB = 'azure_blob',
  GOOGLE_CLOUD = 'google_cloud',
  MULTI_REGION = 'multi_region',
}

registerEnumType(BackupType, {
  name: 'BackupType',
  description: 'Type of backup operation',
});

registerEnumType(BackupStatus, {
  name: 'BackupStatus',
  description: 'Status of backup operation',
});

registerEnumType(BackupStorageLocation, {
  name: 'BackupStorageLocation',
  description: 'Storage location for backup',
});

@ObjectType()
export class BackupEntity {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique identifier for the backup' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID this backup belongs to' })
  tenantId!: string;

  @Field(() => BackupType)
  @ApiProperty({ enum: BackupType, description: 'Type of backup' })
  type!: BackupType;

  @Field(() => BackupStatus)
  @ApiProperty({ enum: BackupStatus, description: 'Current status of backup' })
  status!: BackupStatus;

  @Field(() => BackupStorageLocation)
  @ApiProperty({ enum: BackupStorageLocation, description: 'Storage location' })
  storageLocation!: BackupStorageLocation;

  @Field()
  @ApiProperty({ description: 'Storage path or identifier' })
  storagePath!: string;

  @Field()
  @ApiProperty({ description: 'Size of backup in bytes' })
  sizeBytes!: number;

  @Field()
  @ApiProperty({ description: 'Checksum for integrity verification' })
  checksum!: string;

  @Field()
  @ApiProperty({ description: 'Encryption key ID used for backup' })
  encryptionKeyId!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Compression algorithm used', required: false })
  compressionAlgorithm?: string | undefined;

  @Field()
  @ApiProperty({ description: 'Compression ratio achieved' })
  compressionRatio!: number;

  @Field()
  @ApiProperty({ description: 'Timestamp when backup started' })
  startedAt!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Timestamp when backup completed', required: false })
  completedAt?: Date | undefined;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Error message if backup failed', required: false })
  errorMessage?: string | undefined;

  @Field()
  @ApiProperty({ description: 'Retention period in days' })
  retentionDays!: number;

  @Field()
  @ApiProperty({ description: 'Expiration date for backup' })
  expiresAt!: Date;

  @Field()
  @ApiProperty({ description: 'Whether backup has been verified' })
  isVerified!: boolean;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Verification timestamp', required: false })
  verifiedAt?: Date | undefined;

  @Field()
  @ApiProperty({ description: 'Metadata about backup contents' })
  metadata!: Record<string, any>;

  @Field()
  @ApiProperty({ description: 'Geographic regions where backup is stored' })
  geographicRegions!: string[];

  @Field()
  @ApiProperty({ description: 'Recovery Time Objective in minutes' })
  rtoMinutes!: number;

  @Field()
  @ApiProperty({ description: 'Recovery Point Objective in minutes' })
  rpoMinutes!: number;

  @Field()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'User who initiated backup', required: false })
  createdBy?: string | undefined;

  // Computed fields (resolved by GraphQL field resolvers)
  @Field(() => Number, { nullable: true })
  duration?: number;

  @Field(() => Number)
  ageInDays?: number;

  @Field(() => Number)
  daysUntilExpiration?: number;

  @Field(() => String)
  humanReadableSize?: string;

  @Field(() => String)
  statusDescription?: string;

  @Field(() => Number)
  healthScore?: number;

  @Field(() => [BackupEntity])
  relatedBackups?: BackupEntity[];

  @Field(() => [String])
  dependencies?: string[];

  @Field(() => Number)
  estimatedRestoreTimeMinutes?: number;
}

@ObjectType()
export class BackupJob {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique identifier for the backup job' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID this job belongs to' })
  tenantId!: string;

  @Field(() => BackupType)
  @ApiProperty({ enum: BackupType, description: 'Type of backup job' })
  type!: BackupType;

  @Field(() => BackupStatus)
  @ApiProperty({ enum: BackupStatus, description: 'Current status of job' })
  status!: BackupStatus;

  @Field()
  @ApiProperty({ description: 'Cron schedule for recurring backups' })
  schedule!: string;

  @Field()
  @ApiProperty({ description: 'Whether job is enabled' })
  isEnabled!: boolean;

  @Field()
  @ApiProperty({ description: 'Next scheduled execution time' })
  nextRunAt!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Last execution time', required: false })
  lastRunAt?: Date | undefined;

  @Field()
  @ApiProperty({ description: 'Job configuration parameters' })
  configuration!: Record<string, any>;

  @Field()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

@ObjectType()
export class BackupStatistics {
  @Field()
  @ApiProperty({ description: 'Total number of backups' })
  totalBackups!: number;

  @Field()
  @ApiProperty({ description: 'Number of successful backups' })
  successfulBackups!: number;

  @Field()
  @ApiProperty({ description: 'Number of failed backups' })
  failedBackups!: number;

  @Field()
  @ApiProperty({ description: 'Total storage used in bytes' })
  totalStorageBytes!: number;

  @Field()
  @ApiProperty({ description: 'Average backup size in bytes' })
  averageBackupSize!: number;

  @Field()
  @ApiProperty({ description: 'Average backup duration in minutes' })
  averageBackupDuration!: number;

  @Field()
  @ApiProperty({ description: 'Success rate percentage' })
  successRate!: number;

  @Field()
  @ApiProperty({ description: 'Last successful backup timestamp' })
  lastSuccessfulBackup!: Date;

  @Field()
  @ApiProperty({ description: 'Next scheduled backup timestamp' })
  nextScheduledBackup!: Date;
}