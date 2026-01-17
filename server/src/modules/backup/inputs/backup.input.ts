import { InputType, Field, ID } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsBoolean, IsNumber, IsArray, IsString, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

import { BackupType, BackupStatus, BackupStorageLocation } from '../entities/backup.entity';

@InputType()
export class CreateBackupInput {
  @Field(() => BackupType)
  @IsEnum(BackupType)
  type!: BackupType;

  @Field(() => BackupStorageLocation, { nullable: true })
  @IsOptional()
  @IsEnum(BackupStorageLocation)
  storageLocation?: BackupStorageLocation;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650)
  retentionDays?: number;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeData?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeData?: string[];

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  compressionEnabled?: boolean;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  encryptionEnabled?: boolean;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  geographicReplication?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;
}

@InputType()
export class BackupFilterInput {
  @Field(() => BackupType, { nullable: true })
  @IsOptional()
  @IsEnum(BackupType)
  type?: BackupType;

  @Field(() => BackupStatus, { nullable: true })
  @IsOptional()
  @IsEnum(BackupStatus)
  status?: BackupStatus;

  @Field(() => BackupStorageLocation, { nullable: true })
  @IsOptional()
  @IsEnum(BackupStorageLocation)
  storageLocation?: BackupStorageLocation;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

@InputType()
export class CreateScheduledBackupInput {
  @Field(() => BackupType)
  @IsEnum(BackupType)
  type!: BackupType;

  @Field()
  @IsString()
  schedule!: string;

  @Field()
  @IsNumber()
  @Min(1)
  @Max(3650)
  retentionDays!: number;

  @Field(() => BackupStorageLocation, { nullable: true })
  @IsOptional()
  @IsEnum(BackupStorageLocation)
  storageLocation?: BackupStorageLocation;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  compressionEnabled?: boolean;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  encryptionEnabled?: boolean;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  geographicReplication?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeData?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeData?: string[];
}

@InputType()
export class UpdateScheduledBackupInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  schedule?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650)
  retentionDays?: number;

  @Field(() => BackupStorageLocation, { nullable: true })
  @IsOptional()
  @IsEnum(BackupStorageLocation)
  storageLocation?: BackupStorageLocation;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  compressionEnabled?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  encryptionEnabled?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  geographicReplication?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeData?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeData?: string[];
}

@InputType()
export class RestoreBackupInput {
  @Field(() => ID)
  @IsString()
  backupId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetTenantId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  pointInTime?: Date;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeData?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeData?: string[];

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

@InputType()
export class PointInTimeRecoveryInput {
  @Field()
  @IsDateString()
  targetDateTime!: Date;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeData?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeData?: string[];

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

@InputType()
export class BackupVerificationInput {
  @Field(() => ID)
  @IsString()
  backupId!: string;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  deepVerification?: boolean;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  verifyEncryption?: boolean;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  verifyStructure?: boolean;
}

@InputType()
export class BackupPaginationInput {
  @Field({ nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @Field({ nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}

@InputType()
export class RecoveryEstimateInput {
  @Field()
  @IsDateString()
  targetDateTime!: string;
}

@InputType()
export class BackupStorageUsageInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

@InputType()
export class BackupIntegrityReportInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

@InputType()
export class BatchVerificationInput {
  @Field(() => [ID])
  @IsArray()
  @IsString({ each: true })
  backupIds!: string[];

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  deepVerification?: boolean;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  verifyEncryption?: boolean;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  verifyStructure?: boolean;
}

@InputType()
export class EncryptionKeyRotationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class BackupCleanupInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxBackupsToDelete?: number;
}