import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { BackupEntity, BackupJob, BackupStatus, BackupStorageLocation } from '../entities/backup.entity';

@ObjectType()
export class BackupListResponse {
  @Field(() => [BackupEntity])
  backups!: BackupEntity[];

  @Field()
  total!: number;

  @Field()
  limit!: number;

  @Field()
  offset!: number;
}

@ObjectType()
export class BackupOperationResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => ID, { nullable: true })
  backupId?: string;

  @Field(() => ID, { nullable: true })
  jobId?: string;
}

@ObjectType()
export class RestoreOperationResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => ID, { nullable: true })
  restoreJobId?: string;

  @Field({ nullable: true })
  estimatedDurationMinutes?: number;
}

@ObjectType()
export class RecoveryPlan {
  @Field(() => ID)
  id!: string;

  @Field()
  targetDateTime!: Date;

  @Field(() => [String])
  requiredBackups!: string[];

  @Field()
  estimatedDurationMinutes!: number;

  @Field()
  estimatedDataSize!: number;

  @Field(() => [String])
  steps!: string[];

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class RecoveryEstimate {
  @Field()
  targetDateTime!: Date;

  @Field()
  estimatedDurationMinutes!: number;

  @Field()
  estimatedDataSize!: number;

  @Field()
  availableBackups!: number;

  @Field()
  confidence!: number;

  @Field({ nullable: true })
  warnings?: string;
}

@ObjectType()
export class BackupVerificationResult {
  @Field(() => ID)
  backupId!: string;

  @Field()
  isValid!: boolean;

  @Field()
  verifiedAt!: Date;

  @Field({ nullable: true })
  errorMessage?: string;

  @Field()
  checksumValid!: boolean;

  @Field()
  structureValid!: boolean;

  @Field()
  encryptionValid!: boolean;

  @Field()
  sizeValid!: boolean;
}

@ObjectType()
export class ScheduledBackupJob {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  name!: string;

  @Field()
  schedule!: string;

  @Field()
  isEnabled!: boolean;

  @Field()
  nextRunAt!: Date;

  @Field({ nullable: true })
  lastRunAt?: Date;

  @Field({ nullable: true })
  lastRunStatus?: string;

  @Field()
  configuration!: string; // JSON string

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class BackupJobListResponse {
  @Field(() => [ScheduledBackupJob])
  jobs!: ScheduledBackupJob[];

  @Field()
  total!: number;
}

@ObjectType()
export class BackupStorageUsage {
  @Field(() => BackupStorageLocation)
  location!: BackupStorageLocation;

  @Field()
  totalSizeBytes!: number;

  @Field()
  backupCount!: number;

  @Field()
  averageSizeBytes!: number;

  @Field()
  compressionRatio!: number;
}

@ObjectType()
export class BackupStorageUsageResponse {
  @Field(() => [BackupStorageUsage])
  usage!: BackupStorageUsage[];

  @Field()
  totalSizeBytes!: number;

  @Field()
  totalBackups!: number;
}

@ObjectType()
export class BackupIntegrityCheck {
  @Field(() => ID)
  backupId!: string;

  @Field()
  expectedChecksum!: string;

  @Field()
  actualChecksum!: string;

  @Field()
  expectedSize!: number;

  @Field()
  actualSize!: number;

  @Field()
  encryptionKeyValid!: boolean;

  @Field()
  structureValid!: boolean;

  @Field(() => [String])
  errors!: string[];

  @Field()
  verifiedAt!: Date;
}

@ObjectType()
export class BackupIntegrityReport {
  @Field(() => [BackupIntegrityCheck])
  checks!: BackupIntegrityCheck[];

  @Field()
  totalChecked!: number;

  @Field()
  validBackups!: number;

  @Field()
  invalidBackups!: number;

  @Field()
  generatedAt!: Date;
}

@ObjectType()
export class BatchVerificationResult {
  @Field(() => [BackupVerificationResult])
  results!: BackupVerificationResult[];

  @Field()
  totalProcessed!: number;

  @Field()
  successfulVerifications!: number;

  @Field()
  failedVerifications!: number;

  @Field()
  averageVerificationTime!: number;
}

@ObjectType()
export class EncryptionKeyInfo {
  @Field(() => ID)
  id!: string;

  @Field()
  algorithm!: string;

  @Field()
  createdAt!: Date;

  @Field()
  isActive!: boolean;

  @Field({ nullable: true })
  rotatedAt?: Date;
}

@ObjectType()
export class BackupCleanupResult {
  @Field()
  deletedCount!: number;

  @Field()
  totalSizeFreed!: number;

  @Field(() => [String])
  deletedBackupIds!: string[];

  @Field(() => [String])
  errors!: string[];

  @Field()
  duration!: number;
}

@ObjectType()
export class BackupStatusCount {
  @Field(() => BackupStatus)
  status!: BackupStatus;

  @Field()
  count!: number;
}

@ObjectType()
export class BackupAnalytics {
  @Field(() => [BackupStatusCount])
  statusCounts!: BackupStatusCount[];

  @Field(() => BackupStorageUsageResponse)
  storageUsage!: BackupStorageUsageResponse;

  @Field()
  averageBackupDuration!: number;

  @Field()
  successRate!: number;

  @Field()
  compressionEfficiency!: number;

  @Field()
  encryptionCoverage!: number;
}