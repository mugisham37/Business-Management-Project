import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BackupRepository } from '../repositories/backup.repository';
import { BackupJobRepository } from '../repositories/backup-job.repository';
import { BackupStorageService } from './backup-storage.service';
import { BackupEncryptionService } from './backup-encryption.service';
import { BackupVerificationService } from './backup-verification.service';

import { 
  BackupEntity, 
  BackupJob, 
  BackupType, 
  BackupStatus, 
  BackupStorageLocation,
  BackupStatistics 
} from '../entities/backup.entity';

export interface CreateBackupOptions {
  tenantId: string;
  type: BackupType;
  storageLocation?: BackupStorageLocation;
  retentionDays?: number;
  includeData?: string[];
  excludeData?: string[];
  compressionEnabled?: boolean;
  encryptionEnabled?: boolean;
  geographicReplication?: boolean;
  priority?: number;
  userId?: string;
}

export interface RestoreOptions {
  backupId: string;
  targetTenantId?: string;
  pointInTime?: Date;
  includeData?: string[];
  excludeData?: string[];
  dryRun?: boolean;
  userId: string;
}

export interface BackupFilter {
  tenantId?: string;
  type?: BackupType;
  status?: BackupStatus;
  storageLocation?: BackupStorageLocation;
  startDate?: Date;
  endDate?: Date;
  isVerified?: boolean;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly backupRepository: BackupRepository,
    private readonly backupJobRepository: BackupJobRepository,
    private readonly storageService: BackupStorageService,
    private readonly encryptionService: BackupEncryptionService,
    private readonly verificationService: BackupVerificationService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('backup-queue') private readonly backupQueue: Queue,
    @InjectQueue('backup-verification-queue') private readonly verificationQueue: Queue,
  ) {}

  /**
   * Create a new backup
   */
  async createBackup(options: CreateBackupOptions): Promise<BackupEntity> {
    this.logger.log(`Creating ${options.type} backup for tenant ${options.tenantId}`);

    try {
      // Validate backup options
      await this.validateBackupOptions(options);

      // Create backup record
      const backup = await this.backupRepository.create({
        tenantId: options.tenantId,
        type: options.type,
        status: BackupStatus.PENDING,
        storageLocation: options.storageLocation || BackupStorageLocation.S3,
        storagePath: await this.generateStoragePath(options),
        sizeBytes: 0,
        checksum: '',
        encryptionKeyId: await this.encryptionService.getBackupKeyId(options.tenantId),
        compressionAlgorithm: options.compressionEnabled ? 'gzip' : undefined,
        compressionRatio: 0,
        startedAt: new Date(),
        retentionDays: options.retentionDays || this.getDefaultRetentionDays(options.type),
        expiresAt: this.calculateExpirationDate(options.retentionDays),
        isVerified: false,
        metadata: {
          includeData: options.includeData,
          excludeData: options.excludeData,
          compressionEnabled: options.compressionEnabled,
          encryptionEnabled: options.encryptionEnabled,
          geographicReplication: options.geographicReplication,
        },
        geographicRegions: await this.getTargetRegions(options),
        rtoMinutes: this.calculateRTO(options.type),
        rpoMinutes: this.calculateRPO(options.type),
        createdBy: options.userId !== undefined ? options.userId : undefined,
      });

      // Queue backup job
      await this.backupQueue.add('process-backup', {
        backupId: backup.id,
        options,
      }, {
        priority: options.priority || 5,
        delay: 0,
      });

      // Emit backup created event
      this.eventEmitter.emit('backup.created', {
        tenantId: options.tenantId,
        backupId: backup.id,
        type: options.type,
        userId: options.userId,
      });

      this.logger.log(`Backup ${backup.id} queued for processing`);
      return backup;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create backup for tenant ${options.tenantId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get backup by ID
   */
  async getBackup(backupId: string, tenantId?: string): Promise<BackupEntity> {
    const backup = await this.backupRepository.findById(backupId);
    
    if (!backup) {
      throw new NotFoundException(`Backup ${backupId} not found`);
    }

    if (tenantId && backup.tenantId !== tenantId) {
      throw new NotFoundException(`Backup ${backupId} not found`);
    }

    return backup;
  }

  /**
   * List backups with filtering
   */
  async listBackups(filter: BackupFilter, limit = 50, offset = 0): Promise<{
    backups: BackupEntity[];
    total: number;
  }> {
    return this.backupRepository.findMany(filter, limit, offset);
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string, tenantId: string, userId: string): Promise<void> {
    this.logger.log(`Deleting backup ${backupId} for tenant ${tenantId}`);

    const backup = await this.getBackup(backupId, tenantId);

    try {
      // Delete from storage
      await this.storageService.deleteBackup(backup.storagePath, backup.storageLocation);

      // Delete from database
      await this.backupRepository.delete(backupId);

      // Emit backup deleted event
      this.eventEmitter.emit('backup.deleted', {
        tenantId,
        backupId,
        userId,
      });

      this.logger.log(`Backup ${backupId} deleted successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete backup ${backupId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<string> {
    this.logger.log(`Starting restore from backup ${options.backupId}`);

    const backup = await this.getBackup(options.backupId);

    if (backup.status !== BackupStatus.COMPLETED || !backup.isVerified) {
      throw new BadRequestException('Backup must be completed and verified before restore');
    }

    try {
      // Create restore job
      const restoreJob = await this.backupQueue.add('process-restore', {
        backup,
        options,
      }, {
        priority: 1, // High priority for restore operations
      });

      // Emit restore started event
      this.eventEmitter.emit('restore.started', {
        tenantId: backup.tenantId,
        backupId: backup.id,
        restoreJobId: restoreJob.id,
        userId: options.userId,
      });

      this.logger.log(`Restore job ${restoreJob.id} queued for backup ${options.backupId}`);
      return restoreJob.id.toString();

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to start restore from backup ${options.backupId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get backup statistics for tenant
   */
  async getBackupStatistics(tenantId: string): Promise<BackupStatistics> {
    return this.backupRepository.getStatistics(tenantId);
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string, tenantId: string): Promise<void> {
    const backup = await this.getBackup(backupId, tenantId);

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new BadRequestException('Can only verify completed backups');
    }

    // Queue verification job
    await this.verificationQueue.add('verify-backup', {
      backupId,
    }, {
      priority: 3,
    });

    this.logger.log(`Backup verification queued for ${backupId}`);
  }

  /**
   * Clean up expired backups
   */
  async cleanupExpiredBackups(): Promise<number> {
    this.logger.log('Starting cleanup of expired backups');

    const expiredBackups = await this.backupRepository.findExpired();
    let deletedCount = 0;

    for (const backup of expiredBackups) {
      try {
        await this.deleteBackup(backup.id, backup.tenantId, 'system');
        deletedCount++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to delete expired backup ${backup.id}: ${errorMessage}`);
      }
    }

    this.logger.log(`Cleaned up ${deletedCount} expired backups`);
    return deletedCount;
  }

  /**
   * Private helper methods
   */
  private async validateBackupOptions(options: CreateBackupOptions): Promise<void> {
    // Validate tenant exists and is active
    // Validate storage location is available
    // Validate retention period is within limits
    // Add other validation logic as needed
  }

  private async generateStoragePath(options: CreateBackupOptions): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `backups/${options.tenantId}/${options.type}/${timestamp}`;
  }

  private getDefaultRetentionDays(type: BackupType): number {
    const retentionMap = {
      [BackupType.FULL]: 90,
      [BackupType.INCREMENTAL]: 30,
      [BackupType.DIFFERENTIAL]: 60,
      [BackupType.POINT_IN_TIME]: 7,
    };
    return retentionMap[type];
  }

  private calculateExpirationDate(retentionDays?: number): Date {
    const days = retentionDays || 90;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    return expirationDate;
  }

  private async getTargetRegions(options: CreateBackupOptions): Promise<string[]> {
    if (options.geographicReplication) {
      return ['us-east-1', 'us-west-2', 'eu-west-1']; // Multi-region
    }
    return ['us-east-1']; // Single region
  }

  private calculateRTO(type: BackupType): number {
    // Recovery Time Objective in minutes
    const rtoMap = {
      [BackupType.FULL]: 15,
      [BackupType.INCREMENTAL]: 10,
      [BackupType.DIFFERENTIAL]: 12,
      [BackupType.POINT_IN_TIME]: 5,
    };
    return rtoMap[type];
  }

  private calculateRPO(type: BackupType): number {
    // Recovery Point Objective in minutes
    const rpoMap = {
      [BackupType.FULL]: 1440, // 24 hours
      [BackupType.INCREMENTAL]: 60, // 1 hour
      [BackupType.DIFFERENTIAL]: 240, // 4 hours
      [BackupType.POINT_IN_TIME]: 5, // 5 minutes
    };
    return rpoMap[type];
  }
}