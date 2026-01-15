import { IsEnum, IsOptional, IsBoolean, IsNumber, IsArray, IsString, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { BackupType, BackupStorageLocation } from '../entities/backup.entity';

export class CreateBackupDto {
  @ApiProperty({ enum: BackupType, description: 'Type of backup to create' })
  @IsEnum(BackupType)
  type!: BackupType;

  @ApiPropertyOptional({ enum: BackupStorageLocation, description: 'Storage location for backup' })
  @IsOptional()
  @IsEnum(BackupStorageLocation)
  storageLocation?: BackupStorageLocation;

  @ApiPropertyOptional({ description: 'Retention period in days', minimum: 1, maximum: 3650 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650)
  retentionDays?: number;

  @ApiPropertyOptional({ description: 'Data to include in backup', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeData?: string[];

  @ApiPropertyOptional({ description: 'Data to exclude from backup', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeData?: string[];

  @ApiPropertyOptional({ description: 'Enable compression', default: true })
  @IsOptional()
  @IsBoolean()
  compressionEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable encryption', default: true })
  @IsOptional()
  @IsBoolean()
  encryptionEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable geographic replication', default: false })
  @IsOptional()
  @IsBoolean()
  geographicReplication?: boolean;

  @ApiPropertyOptional({ description: 'Backup priority (1-10)', minimum: 1, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;
}

export class RestoreBackupDto {
  @ApiPropertyOptional({ description: 'Target tenant ID for restore' })
  @IsOptional()
  @IsString()
  targetTenantId?: string;

  @ApiPropertyOptional({ description: 'Point-in-time for restore' })
  @IsOptional()
  @IsDateString()
  pointInTime?: Date;

  @ApiPropertyOptional({ description: 'Data to include in restore', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeData?: string[];

  @ApiPropertyOptional({ description: 'Data to exclude from restore', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeData?: string[];

  @ApiPropertyOptional({ description: 'Perform dry run without actual restore', default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class CreateScheduledBackupDto {
  @ApiProperty({ enum: BackupType, description: 'Type of backup to schedule' })
  @IsEnum(BackupType)
  type!: BackupType;

  @ApiProperty({ description: 'Cron schedule expression' })
  @IsString()
  schedule!: string;

  @ApiProperty({ description: 'Retention period in days', minimum: 1, maximum: 3650 })
  @IsNumber()
  @Min(1)
  @Max(3650)
  retentionDays!: number;

  @ApiPropertyOptional({ enum: BackupStorageLocation, description: 'Storage location for backup' })
  @IsOptional()
  @IsEnum(BackupStorageLocation)
  storageLocation?: BackupStorageLocation;

  @ApiPropertyOptional({ description: 'Enable scheduled job', default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable compression', default: true })
  @IsOptional()
  @IsBoolean()
  compressionEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable encryption', default: true })
  @IsOptional()
  @IsBoolean()
  encryptionEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable geographic replication', default: false })
  @IsOptional()
  @IsBoolean()
  geographicReplication?: boolean;

  @ApiPropertyOptional({ description: 'Data to include in backup', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeData?: string[];

  @ApiPropertyOptional({ description: 'Data to exclude from backup', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeData?: string[];
}

export class UpdateScheduledBackupDto {
  @ApiPropertyOptional({ description: 'Cron schedule expression' })
  @IsOptional()
  @IsString()
  schedule?: string;

  @ApiPropertyOptional({ description: 'Retention period in days', minimum: 1, maximum: 3650 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650)
  retentionDays?: number;

  @ApiPropertyOptional({ enum: BackupStorageLocation, description: 'Storage location for backup' })
  @IsOptional()
  @IsEnum(BackupStorageLocation)
  storageLocation?: BackupStorageLocation;

  @ApiPropertyOptional({ description: 'Enable scheduled job' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable compression' })
  @IsOptional()
  @IsBoolean()
  compressionEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable encryption' })
  @IsOptional()
  @IsBoolean()
  encryptionEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable geographic replication' })
  @IsOptional()
  @IsBoolean()
  geographicReplication?: boolean;

  @ApiPropertyOptional({ description: 'Data to include in backup', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeData?: string[];

  @ApiPropertyOptional({ description: 'Data to exclude from backup', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeData?: string[];
}

export class BackupFilterDto {
  @ApiPropertyOptional({ enum: BackupType, description: 'Filter by backup type' })
  @IsOptional()
  @IsEnum(BackupType)
  type?: BackupType;

  @ApiPropertyOptional({ enum: BackupStorageLocation, description: 'Filter by storage location' })
  @IsOptional()
  @IsEnum(BackupStorageLocation)
  storageLocation?: BackupStorageLocation;

  @ApiPropertyOptional({ description: 'Filter by start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by verification status' })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ description: 'Number of results to return', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}

export class PointInTimeRecoveryDto {
  @ApiProperty({ description: 'Target date and time for recovery' })
  @IsDateString()
  targetDateTime!: string;

  @ApiPropertyOptional({ description: 'Data to include in recovery', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeData?: string[];

  @ApiPropertyOptional({ description: 'Data to exclude from recovery', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeData?: string[];

  @ApiPropertyOptional({ description: 'Perform dry run without actual recovery', default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class RecoveryEstimateDto {
  @ApiProperty({ description: 'Target date and time for recovery' })
  @IsDateString()
  targetDateTime!: string;
}

export class BackupVerificationDto {
  @ApiPropertyOptional({ description: 'Perform deep verification', default: false })
  @IsOptional()
  @IsBoolean()
  deepVerification?: boolean;

  @ApiPropertyOptional({ description: 'Verify encryption integrity', default: true })
  @IsOptional()
  @IsBoolean()
  verifyEncryption?: boolean;

  @ApiPropertyOptional({ description: 'Verify backup structure', default: true })
  @IsOptional()
  @IsBoolean()
  verifyStructure?: boolean;
}