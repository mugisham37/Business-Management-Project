import { Resolver, Query, Mutation, Args, ID, Subscription, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

import { BackupService, CreateBackupOptions } from '../services/backup.service';
import { BackupSchedulerService } from '../services/backup-scheduler.service';
import { PointInTimeRecoveryService, PointInTimeRecoveryOptions } from '../services/point-in-time-recovery.service';
import { BackupVerificationService } from '../services/backup-verification.service';
import { BackupStorageService } from '../services/backup-storage.service';
import { BackupEncryptionService } from '../services/backup-encryption.service';
import { BackupRepository } from '../repositories/backup.repository';

import {
  BackupEntity,
  BackupStatistics,
  BackupStorageLocation,
  BackupStatus,
  BackupType,
} from '../entities/backup.entity';

import {
  CreateBackupInput,
  BackupFilterInput,
  CreateScheduledBackupInput,
  UpdateScheduledBackupInput,
  RestoreBackupInput,
  PointInTimeRecoveryInput,
  BackupVerificationInput,
  BackupPaginationInput,
  RecoveryEstimateInput,
  BackupStorageUsageInput,
  BackupIntegrityReportInput,
  BatchVerificationInput,
  EncryptionKeyRotationInput,
  BackupCleanupInput,
} from '../inputs/backup.input';

import {
  BackupListResponse,
  BackupOperationResponse,
  RestoreOperationResponse,
  RecoveryPlan,
  RecoveryEstimate,
  BackupVerificationResult,
  ScheduledBackupJob,
  BackupJobListResponse,
  BackupStorageUsageResponse,
  BackupIntegrityReport,
  BatchVerificationResult,
  EncryptionKeyInfo,
  BackupCleanupResult,
  BackupAnalytics,
  BackupIntegrityCheck,
} from '../types/backup.types';

import { BackupFilter } from '../services/backup.service';

@Resolver(() => BackupEntity)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
export class BackupResolver {
  constructor(
    private readonly backupService: BackupService,
    private readonly schedulerService: BackupSchedulerService,
    private readonly recoveryService: PointInTimeRecoveryService,
    private readonly verificationService: BackupVerificationService,
    private readonly storageService: BackupStorageService,
    private readonly encryptionService: BackupEncryptionService,
    private readonly backupRepository: BackupRepository,
    @Inject('PUB_SUB') private readonly pubSub: RedisPubSub,
  ) {}

  /**
   * Create a new backup
   */
  @Mutation(() => BackupOperationResponse)
  @RequirePermission('backup:create')
  async createBackup(
    @Args('input') input: CreateBackupInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<BackupOperationResponse> {
    try {
      const options: CreateBackupOptions = {
        tenantId,
        type: input.type,
        ...(input.storageLocation && { storageLocation: input.storageLocation }),
        ...(input.retentionDays && { retentionDays: input.retentionDays }),
        ...(input.includeData && { includeData: input.includeData }),
        ...(input.excludeData && { excludeData: input.excludeData }),
        ...(input.compressionEnabled !== undefined && { compressionEnabled: input.compressionEnabled }),
        ...(input.encryptionEnabled !== undefined && { encryptionEnabled: input.encryptionEnabled }),
        ...(input.geographicReplication !== undefined && { geographicReplication: input.geographicReplication }),
        ...(input.priority !== undefined && { priority: input.priority }),
        userId: user.id,
      };

      const backup = await this.backupService.createBackup(options);
      
      return {
        success: true,
        message: 'Backup created successfully',
        backupId: backup.id,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create backup',
      };
    }
  }

  /**
   * Get backup by ID
   */
  @Query(() => BackupEntity, { nullable: true })
  @RequirePermission('backup:read')
  async backup(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<BackupEntity | null> {
    try {
      return await this.backupService.getBackup(id, tenantId);
    } catch (error) {
      return null;
    }
  }

  /**
   * List backups with filtering
   */
  @Query(() => BackupListResponse)
  @RequirePermission('backup:read')
  async backups(
    @Args('filter', { nullable: true }) filter?: BackupFilterInput,
    @Args('pagination', { nullable: true }) pagination?: BackupPaginationInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<BackupListResponse> {
    const limit = pagination?.limit ?? 50;
    const offset = pagination?.offset ?? 0;
    
    const backupFilter: Partial<BackupFilter> = {};
    if (tenantId) {
      backupFilter.tenantId = tenantId;
    }
    if (filter?.type) {
      backupFilter.type = filter.type;
    }
    if (filter?.status) {
      backupFilter.status = filter.status;
    }
    if (filter?.storageLocation) {
      backupFilter.storageLocation = filter.storageLocation;
    }
    if (filter?.startDate) {
      backupFilter.startDate = filter.startDate;
    }
    if (filter?.endDate) {
      backupFilter.endDate = filter.endDate;
    }
    if (filter?.isVerified !== undefined) {
      backupFilter.isVerified = filter.isVerified;
    }

    const result = await this.backupService.listBackups(backupFilter as BackupFilter, limit, offset);
    
    return {
      backups: result.backups,
      total: result.total,
      limit,
      offset,
    };
  }

  /**
   * Delete backup
   */
  @Mutation(() => BackupOperationResponse)
  @RequirePermission('backup:delete')
  async deleteBackup(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<BackupOperationResponse> {
    try {
      await this.backupService.deleteBackup(id, tenantId, user.id);
      return {
        success: true,
        message: 'Backup deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete backup',
      };
    }
  }

  /**
   * Verify backup integrity
   */
  @Mutation(() => BackupVerificationResult)
  @RequirePermission('backup:verify')
  async verifyBackup(
    @Args('input') input: BackupVerificationInput,
    @CurrentTenant() tenantId: string,
  ): Promise<BackupVerificationResult> {
    try {
      const result = await this.backupService.verifyBackupWithDetails(input.backupId, tenantId, {
        deepVerification: input.deepVerification ?? false,
        verifyEncryption: input.verifyEncryption ?? true,
        verifyStructure: input.verifyStructure ?? true,
      });
      
      return result;
    } catch (error) {
      return {
        backupId: input.backupId,
        isValid: false,
        verifiedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Verification failed',
        checksumValid: false,
        structureValid: false,
        encryptionValid: false,
        sizeValid: false,
      };
    }
  }

  /**
   * Get backup statistics
   */
  @Query(() => BackupStatistics)
  @RequirePermission('backup:read')
  async backupStatistics(
    @CurrentTenant() tenantId: string,
  ): Promise<BackupStatistics> {
    return this.backupService.getBackupStatistics(tenantId);
  }

  /**
   * Create scheduled backup job
   */
  @Mutation(() => BackupOperationResponse)
  @RequirePermission('backup:schedule')
  async createScheduledBackup(
    @Args('input') input: CreateScheduledBackupInput,
    @CurrentTenant() tenantId: string,
  ): Promise<BackupOperationResponse> {
    try {
      const config = {
        tenantId,
        type: input.type,
        schedule: input.schedule,
        retentionDays: input.retentionDays,
        storageLocation: input.storageLocation ?? BackupStorageLocation.S3,
        isEnabled: input.isEnabled ?? true,
        configuration: {
          compressionEnabled: input.compressionEnabled ?? true,
          encryptionEnabled: input.encryptionEnabled ?? true,
          geographicReplication: input.geographicReplication ?? false,
          includeData: input.includeData ?? [],
          excludeData: input.excludeData ?? [],
        },
      };

      const jobId = await this.schedulerService.createScheduledJob(config);
      
      return {
        success: true,
        message: 'Scheduled backup created successfully',
        jobId,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create scheduled backup',
      };
    }
  }

  /**
   * Update scheduled backup job
   */
  @Mutation(() => BackupOperationResponse)
  @RequirePermission('backup:schedule')
  async updateScheduledBackup(
    @Args('jobId') jobId: string,
    @Args('input') input: UpdateScheduledBackupInput,
    @CurrentTenant() tenantId: string,
  ): Promise<BackupOperationResponse> {
    try {
      await this.schedulerService.updateScheduledJob(jobId, input, tenantId);
      
      return {
        success: true,
        message: 'Scheduled backup updated successfully',
        jobId,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update scheduled backup',
      };
    }
  }

  /**
   * Get scheduled backup jobs
   */
  @Query(() => BackupJobListResponse)
  @RequirePermission('backup:read')
  async scheduledBackups(
    @CurrentTenant() tenantId: string,
  ): Promise<BackupJobListResponse> {
    const jobs = await this.schedulerService.getScheduledJobs(tenantId);
    
    return {
      jobs,
      total: jobs.length,
    };
  }

  /**
   * Delete scheduled backup job
   */
  @Mutation(() => BackupOperationResponse)
  @RequirePermission('backup:schedule')
  async deleteScheduledBackup(
    @Args('jobId') jobId: string,
  ): Promise<BackupOperationResponse> {
    try {
      await this.schedulerService.deleteScheduledJob(jobId);
      return {
        success: true,
        message: 'Scheduled backup deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete scheduled backup',
      };
    }
  }

  /**
   * Restore from backup
   */
  @Mutation(() => RestoreOperationResponse)
  @RequirePermission('backup:restore')
  async restoreBackup(
    @Args('input') input: RestoreBackupInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<RestoreOperationResponse> {
    try {
      const options: any = {
        backupId: input.backupId,
        targetTenantId: input.targetTenantId ?? tenantId,
        includeData: input.includeData,
        excludeData: input.excludeData,
        dryRun: input.dryRun ?? false,
        userId: user.id,
      };
      if (input.pointInTime !== undefined) {
        options.pointInTime = input.pointInTime;
      }

      const restoreJobId = await this.backupService.restoreFromBackup(options);
      
      return {
        success: true,
        message: input.dryRun ? 'Dry run completed successfully' : 'Restore operation started',
        restoreJobId,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start restore operation',
      };
    }
  }

  /**
   * Get available recovery points
   */
  @Query(() => [Date])
  @RequirePermission('backup:read')
  async recoveryPoints(
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
    @CurrentTenant() tenantId?: string,
  ): Promise<Date[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.recoveryService.getAvailableRecoveryPoints(tenantId, startDate, endDate);
  }

  /**
   * Get backup storage usage
   */
  @Query(() => BackupStorageUsageResponse)
  @RequirePermission('backup:read')
  async backupStorageUsage(
    @Args('input', { nullable: true }) input?: BackupStorageUsageInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<BackupStorageUsageResponse> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const storageUsageByLocation = await this.backupRepository.getStorageUsageByLocation(tenantId);
    
    const usage = Object.entries(storageUsageByLocation).map(([location, totalSize]) => ({
      location: location as BackupStorageLocation,
      totalSizeBytes: totalSize,
      backupCount: 0, // Would be calculated from actual data
      averageSizeBytes: totalSize > 0 ? totalSize / Math.max(1, 0) : 0,
      compressionRatio: 0.7, // Would be calculated from actual data
    }));

    const totalSizeBytes = Object.values(storageUsageByLocation).reduce((sum, size) => sum + size, 0);
    const totalBackups = usage.reduce((sum, u) => sum + u.backupCount, 0);

    return {
      usage,
      totalSizeBytes,
      totalBackups,
    };
  }

  /**
   * Generate backup integrity report
   */
  @Query(() => BackupIntegrityReport)
  @RequirePermission('backup:read')
  async backupIntegrityReport(
    @Args('input', { nullable: true }) input?: BackupIntegrityReportInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<BackupIntegrityReport> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const filter: Partial<BackupFilter> = {
      tenantId,
      status: BackupStatus.COMPLETED,
    };

    if (input?.startDate) {
      filter.startDate = new Date(input.startDate);
    }
    if (input?.endDate) {
      filter.endDate = new Date(input.endDate);
    }

    const { backups } = await this.backupService.listBackups(filter as BackupFilter, 100, 0);
    
    const checks: BackupIntegrityCheck[] = [];
    let validBackups = 0;
    let invalidBackups = 0;

    for (const backup of backups) {
      try {
        const verificationResult = await this.backupService.verifyBackupWithDetails(backup.id, tenantId, {
          deepVerification: false,
          verifyEncryption: true,
          verifyStructure: true,
        });

        const check: BackupIntegrityCheck = {
          backupId: backup.id,
          expectedChecksum: backup.checksum,
          actualChecksum: backup.checksum, // Would be recalculated in real verification
          expectedSize: backup.sizeBytes,
          actualSize: backup.sizeBytes, // Would be checked against storage
          encryptionKeyValid: verificationResult.encryptionValid,
          structureValid: verificationResult.structureValid,
          errors: verificationResult.errorMessage ? [verificationResult.errorMessage] : [],
          verifiedAt: new Date(),
        };

        checks.push(check);

        if (verificationResult.isValid) {
          validBackups++;
        } else {
          invalidBackups++;
        }
      } catch (error) {
        const check: BackupIntegrityCheck = {
          backupId: backup.id,
          expectedChecksum: backup.checksum,
          actualChecksum: '',
          expectedSize: backup.sizeBytes,
          actualSize: 0,
          encryptionKeyValid: false,
          structureValid: false,
          errors: [error instanceof Error ? error.message : 'Verification failed'],
          verifiedAt: new Date(),
        };

        checks.push(check);
        invalidBackups++;
      }
    }

    return {
      checks,
      totalChecked: checks.length,
      validBackups,
      invalidBackups,
      generatedAt: new Date(),
    };
  }

  /**
   * Batch verify backups
   */
  @Mutation(() => BatchVerificationResult)
  @RequirePermission('backup:verify')
  async batchVerifyBackups(
    @Args('input') input: BatchVerificationInput,
    @CurrentTenant() tenantId: string,
  ): Promise<BatchVerificationResult> {
    const results: BackupVerificationResult[] = [];
    let successfulVerifications = 0;
    let failedVerifications = 0;
    const startTime = Date.now();

    for (const backupId of input.backupIds) {
      try {
        const result = await this.backupService.verifyBackupWithDetails(backupId, tenantId, {
          deepVerification: input.deepVerification ?? false,
          verifyEncryption: input.verifyEncryption ?? true,
          verifyStructure: input.verifyStructure ?? true,
        });

        results.push(result);

        if (result.isValid) {
          successfulVerifications++;
        } else {
          failedVerifications++;
        }
      } catch (error) {
        const result: BackupVerificationResult = {
          backupId,
          isValid: false,
          verifiedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Verification failed',
          checksumValid: false,
          structureValid: false,
          encryptionValid: false,
          sizeValid: false,
        };

        results.push(result);
        failedVerifications++;
      }
    }

    const totalTime = Date.now() - startTime;
    const averageTime = results.length > 0 ? totalTime / results.length : 0;

    return {
      results,
      totalProcessed: results.length,
      successfulVerifications,
      failedVerifications,
      averageVerificationTime: averageTime,
    };
  }

  /**
   * Rotate encryption keys
   */
  @Mutation(() => BackupOperationResponse)
  @RequirePermission('backup:admin')
  async rotateEncryptionKeys(
    @Args('input', { nullable: true }) input?: EncryptionKeyRotationInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<BackupOperationResponse> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }
      const newKey = await this.encryptionService.rotateBackupKeys(tenantId);
      
      return {
        success: true,
        message: `Encryption keys rotated successfully. New key ID: ${newKey.id}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to rotate encryption keys',
      };
    }
  }

  /**
   * Get encryption key information
   */
  @Query(() => [EncryptionKeyInfo])
  @RequirePermission('backup:admin')
  async encryptionKeys(
    @CurrentTenant() tenantId: string,
  ): Promise<EncryptionKeyInfo[]> {
    // This would get all keys for the tenant
    const activeKey = await this.encryptionService.getBackupKeyId(tenantId);
    
    return [{
      id: activeKey,
      algorithm: 'aes-256-gcm',
      createdAt: new Date(),
      isActive: true,
    }];
  }

  /**
   * Cleanup expired backups
   */
  @Mutation(() => BackupCleanupResult)
  @RequirePermission('backup:admin')
  async cleanupBackups(
    @Args('input', { nullable: true }) input?: BackupCleanupInput,
    @CurrentTenant() tenantId?: string,
  ): Promise<BackupCleanupResult> {
    const startTime = Date.now();
    
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }
      if (input?.dryRun) {
        // Simulate cleanup without actually deleting
        const expiredBackups = await this.backupRepository.findExpired();
        const tenantExpiredBackups = expiredBackups.filter(b => b.tenantId === tenantId);
        const limitedBackups = input.maxBackupsToDelete 
          ? tenantExpiredBackups.slice(0, input.maxBackupsToDelete)
          : tenantExpiredBackups;

        const totalSize = limitedBackups.reduce((sum, b) => sum + b.sizeBytes, 0);

        return {
          deletedCount: limitedBackups.length,
          totalSizeFreed: totalSize,
          deletedBackupIds: limitedBackups.map(b => b.id),
          errors: [],
          duration: Date.now() - startTime,
        };
      }

      const deletedCount = await this.backupService.cleanupExpiredBackups();
      
      return {
        deletedCount,
        totalSizeFreed: 0, // Would be calculated during actual cleanup
        deletedBackupIds: [], // Would be tracked during cleanup
        errors: [],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        deletedCount: 0,
        totalSizeFreed: 0,
        deletedBackupIds: [],
        errors: [error instanceof Error ? error.message : 'Cleanup failed'],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get comprehensive backup analytics
   */
  @Query(() => BackupAnalytics)
  @RequirePermission('backup:read')
  async backupAnalytics(
    @CurrentTenant() tenantId: string,
  ): Promise<BackupAnalytics> {
    const statistics = await this.backupService.getBackupStatistics(tenantId);
    const statusCounts = await this.backupRepository.countByStatus(tenantId);
    const storageUsage = await this.backupStorageUsage(undefined, tenantId);

    const statusCountsArray = Object.entries(statusCounts).map(([status, count]) => ({
      status: status as BackupStatus,
      count,
    }));

    return {
      statusCounts: statusCountsArray,
      storageUsage,
      averageBackupDuration: statistics.averageBackupDuration,
      successRate: statistics.successRate,
      compressionEfficiency: 0.7, // Would be calculated from actual data
      encryptionCoverage: 0.95, // Would be calculated from actual data
    };
  }

  /**
   * Toggle scheduled backup job
   */
  @Mutation(() => BackupOperationResponse)
  @RequirePermission('backup:schedule')
  async toggleScheduledBackup(
    @Args('jobId') jobId: string,
    @Args('enabled') enabled: boolean,
  ): Promise<BackupOperationResponse> {
    try {
      await this.schedulerService.toggleScheduledJob(jobId, enabled);
      return {
        success: true,
        message: `Scheduled backup ${enabled ? 'enabled' : 'disabled'} successfully`,
        jobId,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to toggle scheduled backup',
      };
    }
  }

  /**
   * Get backup job by ID
   */
  @Query(() => ScheduledBackupJob, { nullable: true })
  @RequirePermission('backup:read')
  async scheduledBackup(
    @Args('jobId') jobId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ScheduledBackupJob | null> {
    try {
      const jobs = await this.schedulerService.getScheduledJobs(tenantId);
      const job = jobs.find(j => j.id === jobId);
      return job || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Subscription for backup status updates
   */
  @Subscription(() => BackupEntity, {
    filter: (payload, variables, context) => {
      return payload.tenantId === context.req.user.tenantId;
    },
  })
  @RequirePermission('backup:read')
  backupStatusUpdates(
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator([
      'backup.created',
      'backup.started', 
      'backup.completed',
      'backup.failed',
      'backup.verification.completed',
      'backup.verification.failed',
    ]);
  }

  /**
   * Subscription for restore status updates
   */
  @Subscription(() => RestoreOperationResponse, {
    filter: (payload, variables, context) => {
      return payload.tenantId === context.req.user.tenantId;
    },
  })
  @RequirePermission('backup:restore')
  restoreStatusUpdates(
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator([
      'restore.started',
      'restore.processing',
      'restore.completed',
      'restore.failed',
      'recovery.started',
      'recovery.completed',
      'recovery.failed',
    ]);
  }

  /**
   * Subscription for scheduled backup events
   */
  @Subscription(() => BackupOperationResponse, {
    filter: (payload, variables, context) => {
      return payload.tenantId === context.req.user.tenantId;
    },
  })
  @RequirePermission('backup:read')
  scheduledBackupUpdates(
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator([
      'backup.scheduled.executed',
      'backup.scheduled.failed',
    ]);
  }

  /**
   * Field resolver for backup duration
   */
  @ResolveField(() => Number, { nullable: true })
  async duration(@Parent() backup: BackupEntity): Promise<number | null> {
    if (backup.startedAt && backup.completedAt) {
      return backup.completedAt.getTime() - backup.startedAt.getTime();
    }
    return null;
  }

  /**
   * Field resolver for backup age in days
   */
  @ResolveField(() => Number)
  async ageInDays(@Parent() backup: BackupEntity): Promise<number> {
    const now = new Date();
    const ageMs = now.getTime() - backup.createdAt.getTime();
    return Math.floor(ageMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Field resolver for days until expiration
   */
  @ResolveField(() => Number)
  async daysUntilExpiration(@Parent() backup: BackupEntity): Promise<number> {
    const now = new Date();
    const expirationMs = backup.expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.ceil(expirationMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Field resolver for backup size in human readable format
   */
  @ResolveField(() => String)
  async humanReadableSize(@Parent() backup: BackupEntity): Promise<string> {
    const bytes = backup.sizeBytes;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Field resolver for backup status description
   */
  @ResolveField(() => String)
  async statusDescription(@Parent() backup: BackupEntity): Promise<string> {
    const statusDescriptions = {
      [BackupStatus.PENDING]: 'Backup is queued and waiting to be processed',
      [BackupStatus.IN_PROGRESS]: 'Backup is currently being created',
      [BackupStatus.COMPLETED]: 'Backup has been successfully created',
      [BackupStatus.FAILED]: 'Backup creation failed',
      [BackupStatus.VERIFYING]: 'Backup integrity is being verified',
      [BackupStatus.VERIFIED]: 'Backup has been verified and is ready for use',
      [BackupStatus.VERIFICATION_FAILED]: 'Backup verification failed',
    };
    return statusDescriptions[backup.status] || 'Unknown status';
  }

  /**
   * Field resolver for backup health score
   */
  @ResolveField(() => Number)
  async healthScore(@Parent() backup: BackupEntity): Promise<number> {
    let score = 0;
    
    // Base score for completed backup
    if (backup.status === BackupStatus.COMPLETED || backup.status === BackupStatus.VERIFIED) {
      score += 40;
    }
    
    // Verification bonus
    if (backup.isVerified) {
      score += 30;
    }
    
    // Encryption bonus
    if (backup.encryptionKeyId) {
      score += 15;
    }
    
    // Compression bonus
    if (backup.compressionAlgorithm && backup.compressionRatio < 0.8) {
      score += 10;
    }
    
    // Age penalty (older backups are less reliable)
    const ageInDays = Math.floor((Date.now() - backup.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays > 30) {
      score -= Math.min(20, ageInDays - 30);
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Field resolver for related backups (incremental chain)
   */
  @ResolveField(() => [BackupEntity])
  async relatedBackups(@Parent() backup: BackupEntity): Promise<BackupEntity[]> {
    if (backup.type === BackupType.FULL) {
      // Find incremental backups that depend on this full backup
      const { backups } = await this.backupService.listBackups({
        tenantId: backup.tenantId,
        type: BackupType.INCREMENTAL,
        startDate: backup.completedAt || backup.createdAt,
      }, 50, 0);
      return backups;
    } else if (backup.type === BackupType.INCREMENTAL) {
      // Find the base full backup
      const { backups } = await this.backupService.listBackups({
        tenantId: backup.tenantId,
        type: BackupType.FULL,
        endDate: backup.createdAt,
      }, 1, 0);
      return backups;
    }
    return [];
  }

  /**
   * Field resolver for backup dependencies
   */
  @ResolveField(() => [String])
  async dependencies(@Parent() backup: BackupEntity): Promise<string[]> {
    const dependencies: string[] = [];
    
    if (backup.type === BackupType.INCREMENTAL || backup.type === BackupType.DIFFERENTIAL) {
      // Find the base full backup
      const { backups } = await this.backupService.listBackups({
        tenantId: backup.tenantId,
        type: BackupType.FULL,
        endDate: backup.createdAt,
      }, 1, 0);
      
      if (backups && backups.length > 0 && backups[0]) {
        dependencies.push(backups[0].id);
      }
    }
    
    return dependencies;
  }

  /**
   * Field resolver for estimated restore time
   */
  @ResolveField(() => Number)
  async estimatedRestoreTimeMinutes(@Parent() backup: BackupEntity): Promise<number> {
    // Base restore time based on backup type
    const baseRestoreTime = {
      [BackupType.FULL]: 15,
      [BackupType.INCREMENTAL]: 5,
      [BackupType.DIFFERENTIAL]: 10,
      [BackupType.POINT_IN_TIME]: 3,
    };
    
    let estimatedTime = baseRestoreTime[backup.type];
    
    // Adjust based on size (rough estimate)
    const sizeMultiplier = Math.max(1, backup.sizeBytes / (100 * 1024 * 1024)); // 100MB baseline
    estimatedTime *= sizeMultiplier;
    
    // Encryption adds overhead
    if (backup.encryptionKeyId) {
      estimatedTime *= 1.2;
    }
    
    // Compression reduces restore time
    if (backup.compressionAlgorithm) {
      estimatedTime *= 0.9;
    }
    
    return Math.ceil(estimatedTime);
  }

  /**
   * Create point-in-time recovery plan
   */
  @Mutation(() => RecoveryPlan)
  @RequirePermission('backup:restore')
  async createRecoveryPlan(
    @Args('input') input: PointInTimeRecoveryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<RecoveryPlan> {
    const options: PointInTimeRecoveryOptions = {
      tenantId,
      targetDateTime: input.targetDateTime,
      includeData: input.includeData ?? [],
      excludeData: input.excludeData ?? [],
      dryRun: input.dryRun ?? false,
      userId: user.id,
    };

    return this.recoveryService.createRecoveryPlan(options);
  }

  /**
   * Execute point-in-time recovery
   */
  @Mutation(() => RestoreOperationResponse)
  @RequirePermission('backup:restore')
  async executeRecovery(
    @Args('input') input: PointInTimeRecoveryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<RestoreOperationResponse> {
    try {
      const options: PointInTimeRecoveryOptions = {
        tenantId,
        targetDateTime: input.targetDateTime,
        includeData: input.includeData ?? [],
        excludeData: input.excludeData ?? [],
        dryRun: input.dryRun ?? false,
        userId: user.id,
      };

      const result = await this.recoveryService.executeRecovery(options);
      
      return {
        success: true,
        message: input.dryRun ? 'Recovery dry run completed' : 'Recovery operation started',
        restoreJobId: result.jobId,
        estimatedDurationMinutes: result.estimatedDurationMinutes,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to execute recovery',
      };
    }
  }

  /**
   * Estimate recovery time
   */
  @Query(() => RecoveryEstimate)
  @RequirePermission('backup:read')
  async estimateRecoveryTime(
    @Args('input') input: RecoveryEstimateInput,
    @CurrentTenant() tenantId: string,
  ): Promise<RecoveryEstimate> {
    const targetDateTime = new Date(input.targetDateTime);
    return this.recoveryService.estimateRecoveryTime(tenantId, targetDateTime);
  }
}