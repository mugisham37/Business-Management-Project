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

import { 
  AuditBackupOperation, 
  MonitorBackupPerformance, 
  ValidateBackupInput 
} from '../decorators/backup.decorators';

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
  @AuditBackupOperation()
  @MonitorBackupPerformance()
  @ValidateBackupInput()
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
          createdBy: options.userId,
          createdAt: new Date().toISOString(),
          priority: options.priority,
        },
        geographicRegions: await this.getTargetRegions(options),
        rtoMinutes: this.calculateRTO(options.type),
        rpoMinutes: this.calculateRPO(options.type),
        createdBy: options.userId !== undefined ? options.userId : undefined,
      });

      // Queue backup job with enhanced options
      await this.backupQueue.add('process-backup', {
        backupId: backup.id,
        options,
      }, {
        priority: options.priority || 5,
        delay: 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      // Emit backup created event with enhanced payload
      this.eventEmitter.emit('backup.created', {
        tenantId: options.tenantId,
        backupId: backup.id,
        type: options.type,
        userId: options.userId,
        storageLocation: backup.storageLocation,
        encryptionEnabled: options.encryptionEnabled,
        compressionEnabled: options.compressionEnabled,
        geographicReplication: options.geographicReplication,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Backup ${backup.id} queued for processing with priority ${options.priority || 5}`);
      return backup;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create backup for tenant ${options.tenantId}: ${errorMessage}`, errorStack);
      
      // Emit backup creation failed event
      this.eventEmitter.emit('backup.creation.failed', {
        tenantId: options.tenantId,
        type: options.type,
        userId: options.userId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  }

  /**
   * Get backup by ID with enhanced validation
   */
  @AuditBackupOperation()
  @MonitorBackupPerformance()
  async getBackup(backupId: string, tenantId?: string): Promise<BackupEntity> {
    const backup = await this.backupRepository.findById(backupId);
    
    if (!backup) {
      throw new NotFoundException(`Backup ${backupId} not found`);
    }

    if (tenantId && backup.tenantId !== tenantId) {
      this.logger.warn(`Unauthorized access attempt to backup ${backupId} by tenant ${tenantId}`);
      throw new NotFoundException(`Backup ${backupId} not found`);
    }

    // Emit backup accessed event
    this.eventEmitter.emit('backup.accessed', {
      tenantId: backup.tenantId,
      backupId: backup.id,
      accessedBy: tenantId,
      timestamp: new Date().toISOString(),
    });

    return backup;
  }

  /**
   * List backups with enhanced filtering and caching
   */
  @AuditBackupOperation()
  @MonitorBackupPerformance()
  async listBackups(filter: BackupFilter, limit = 50, offset = 0): Promise<{
    backups: BackupEntity[];
    total: number;
  }> {
    // Validate filter parameters
    if (limit > 100) {
      throw new BadRequestException('Limit cannot exceed 100');
    }
    
    if (offset < 0) {
      throw new BadRequestException('Offset cannot be negative');
    }

    const result = await this.backupRepository.findMany(filter, limit, offset);
    
    // Emit backups listed event
    this.eventEmitter.emit('backups.listed', {
      tenantId: filter.tenantId,
      filterApplied: Object.keys(filter).length > 1, // More than just tenantId
      resultCount: result.backups.length,
      totalCount: result.total,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Delete backup with enhanced cleanup
   */
  @AuditBackupOperation()
  @MonitorBackupPerformance()
  @ValidateBackupInput()
  async deleteBackup(backupId: string, tenantId: string, userId: string): Promise<void> {
    this.logger.log(`Deleting backup ${backupId} for tenant ${tenantId}`);

    const backup = await this.getBackup(backupId, tenantId);

    // Check if backup is currently being used
    if (backup.status === BackupStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot delete backup that is currently in progress');
    }

    try {
      // Delete from storage with retry logic
      let deleteAttempts = 0;
      const maxAttempts = 3;
      
      while (deleteAttempts < maxAttempts) {
        try {
          await this.storageService.deleteBackup(backup.storagePath, backup.storageLocation);
          break;
        } catch (storageError) {
          deleteAttempts++;
          if (deleteAttempts >= maxAttempts) {
            throw storageError;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * deleteAttempts));
        }
      }

      // Delete from database
      await this.backupRepository.delete(backupId);

      // Emit backup deleted event with enhanced payload
      this.eventEmitter.emit('backup.deleted', {
        tenantId,
        backupId,
        userId,
        backupType: backup.type,
        storageLocation: backup.storageLocation,
        sizeBytes: backup.sizeBytes,
        wasVerified: backup.isVerified,
        ageInDays: Math.floor((Date.now() - backup.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Backup ${backupId} deleted successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete backup ${backupId}: ${errorMessage}`, errorStack);
      
      // Emit backup deletion failed event
      this.eventEmitter.emit('backup.deletion.failed', {
        tenantId,
        backupId,
        userId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  }

  /**
   * Restore from backup with enhanced options
   */
  @AuditBackupOperation()
  @MonitorBackupPerformance()
  @ValidateBackupInput()
  async restoreFromBackup(options: RestoreOptions): Promise<string> {
    this.logger.log(`Starting restore from backup ${options.backupId}`);

    const backup = await this.getBackup(options.backupId);

    if (backup.status !== BackupStatus.COMPLETED || !backup.isVerified) {
      throw new BadRequestException('Backup must be completed and verified before restore');
    }

    // Check backup age
    const backupAge = Date.now() - backup.createdAt.getTime();
    const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year
    
    if (backupAge > maxAge) {
      this.logger.warn(`Attempting to restore from old backup: ${backup.id} (${Math.floor(backupAge / (1000 * 60 * 60 * 24))} days old)`);
    }

    try {
      // Create restore job with enhanced configuration
      const restoreJob = await this.backupQueue.add('process-restore', {
        backup,
        options,
      }, {
        priority: 1, // High priority for restore operations
        attempts: 2, // Fewer attempts for restore (more critical)
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
        removeOnComplete: 5,
        removeOnFail: 10, // Keep failed restore jobs longer for debugging
      });

      // Emit restore started event with enhanced payload
      this.eventEmitter.emit('restore.started', {
        tenantId: backup.tenantId,
        backupId: backup.id,
        restoreJobId: restoreJob.id,
        userId: options.userId,
        targetTenantId: options.targetTenantId,
        pointInTime: options.pointInTime?.toISOString(),
        dryRun: options.dryRun,
        backupType: backup.type,
        backupSize: backup.sizeBytes,
        backupAge: Math.floor(backupAge / (1000 * 60 * 60 * 24)),
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Restore job ${restoreJob.id} queued for backup ${options.backupId}`);
      return restoreJob.id.toString();

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to start restore from backup ${options.backupId}: ${errorMessage}`, errorStack);
      
      // Emit restore start failed event
      this.eventEmitter.emit('restore.start.failed', {
        tenantId: backup.tenantId,
        backupId: backup.id,
        userId: options.userId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  }

  /**
   * Get backup statistics with enhanced metrics
   */
  @AuditBackupOperation()
  @MonitorBackupPerformance()
  async getBackupStatistics(tenantId: string): Promise<BackupStatistics> {
    const statistics = await this.backupRepository.getStatistics(tenantId);
    
    // Emit statistics accessed event
    this.eventEmitter.emit('backup.statistics.accessed', {
      tenantId,
      timestamp: new Date().toISOString(),
    });

    return statistics;
  }

  /**
   * Verify backup integrity with enhanced options and detailed results
   */
  @AuditBackupOperation()
  @MonitorBackupPerformance()
  async verifyBackupWithDetails(backupId: string, tenantId: string, options?: {
    deepVerification?: boolean;
    verifyEncryption?: boolean;
    verifyStructure?: boolean;
  }): Promise<any> {
    const backup = await this.getBackup(backupId, tenantId);

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new BadRequestException('Can only verify completed backups');
    }

    try {
      // Emit verification started event
      this.eventEmitter.emit('backup.verification.started', {
        tenantId,
        backupId,
        options,
        timestamp: new Date().toISOString(),
      });

      const verificationResult = await this.verificationService.verifyBackupWithDetails(backup, options);
      
      // Update backup verification status
      await this.backupRepository.update(backupId, {
        isVerified: verificationResult.isValid,
        verifiedAt: new Date(),
      });

      // Emit verification completed event
      this.eventEmitter.emit('backup.verification.completed', {
        tenantId,
        backupId,
        isValid: verificationResult.isValid,
        options,
        timestamp: new Date().toISOString(),
      });

      return verificationResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to verify backup ${backupId}: ${errorMessage}`);
      
      // Emit verification failed event
      this.eventEmitter.emit('backup.verification.failed', {
        tenantId,
        backupId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  }

  /**
   * Clean up expired backups with enhanced reporting
   */
  @AuditBackupOperation()
  @MonitorBackupPerformance()
  async cleanupExpiredBackups(): Promise<number> {
    this.logger.log('Starting cleanup of expired backups');

    const expiredBackups = await this.backupRepository.findExpired();
    let deletedCount = 0;
    let totalSizeFreed = 0;
    const errors: string[] = [];

    // Emit cleanup started event
    this.eventEmitter.emit('backup.cleanup.started', {
      expiredBackupsFound: expiredBackups.length,
      timestamp: new Date().toISOString(),
    });

    for (const backup of expiredBackups) {
      try {
        const sizeBeforeDelete = backup.sizeBytes;
        await this.deleteBackup(backup.id, backup.tenantId, 'system');
        deletedCount++;
        totalSizeFreed += sizeBeforeDelete;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to delete expired backup ${backup.id}: ${errorMessage}`);
        errors.push(`${backup.id}: ${errorMessage}`);
      }
    }

    // Emit cleanup completed event
    this.eventEmitter.emit('backup.cleanup.completed', {
      totalExpired: expiredBackups.length,
      deletedCount,
      totalSizeFreed,
      errors,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Cleaned up ${deletedCount} expired backups, freed ${totalSizeFreed} bytes`);
    return deletedCount;
  }

  /**
   * Private helper methods with enhanced functionality
   */
  private async validateBackupOptions(options: CreateBackupOptions): Promise<void> {
    // Enhanced validation with business rules
    if (options.retentionDays && options.retentionDays > 3650) {
      throw new BadRequestException('Retention period cannot exceed 10 years');
    }

    if (options.includeData && options.excludeData) {
      const overlap = options.includeData.filter(item => options.excludeData!.includes(item));
      if (overlap.length > 0) {
        throw new BadRequestException(`Cannot both include and exclude: ${overlap.join(', ')}`);
      }
    }

    // Check tenant backup limits
    const recentBackups = await this.backupRepository.findMany({
      tenantId: options.tenantId,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    }, 100, 0);

    if (recentBackups.total > 50) {
      throw new BadRequestException('Daily backup limit exceeded');
    }
  }

  private async generateStoragePath(options: CreateBackupOptions): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomSuffix = Math.random().toString(36).substr(2, 9);
    return `backups/${options.tenantId}/${options.type}/${timestamp}-${randomSuffix}`;
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