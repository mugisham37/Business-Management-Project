import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';

import { BackupService, CreateBackupOptions } from '../services/backup.service';
import { BackupSchedulerService } from '../services/backup-scheduler.service';
import { PointInTimeRecoveryService, PointInTimeRecoveryOptions } from '../services/point-in-time-recovery.service';

import {
  BackupEntity,
  BackupStatistics,
  BackupType,
  BackupStorageLocation,
} from '../entities/backup.entity';

import {
  CreateBackupInput,
  BackupFilterInput,
  CreateScheduledBackupInput,
  PointInTimeRecoveryInput,
} from '../inputs/backup.input';
import { BackupFilter } from '../services/backup.service';

@Resolver(() => BackupEntity)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
export class BackupResolver {
  constructor(
    private readonly backupService: BackupService,
    private readonly schedulerService: BackupSchedulerService,
    private readonly recoveryService: PointInTimeRecoveryService,
  ) {}

  /**
   * Create a new backup
   */
  @Mutation(() => BackupEntity)
  @RequirePermission('backup:create')
  async createBackup(
    @Args('input') input: CreateBackupInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<BackupEntity> {
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

    return this.backupService.createBackup(options);
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
  @Query(() => [BackupEntity])
  @RequirePermission('backup:read')
  async backups(
    @Args('filter', { nullable: true }) filter?: BackupFilterInput,
    @Args('limit', { nullable: true }) limit = 50,
    @Args('offset', { nullable: true }) offset = 0,
    @CurrentTenant() tenantId?: string,
  ): Promise<BackupEntity[]> {
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
    return result.backups;
  }

  /**
   * Delete backup
   */
  @Mutation(() => Boolean)
  @RequirePermission('backup:delete')
  async deleteBackup(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    try {
      await this.backupService.deleteBackup(id, tenantId, user.id);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify backup integrity
   */
  @Mutation(() => Boolean)
  @RequirePermission('backup:verify')
  async verifyBackup(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    try {
      await this.backupService.verifyBackup(id, tenantId);
      return true;
    } catch (error) {
      return false;
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
  @Mutation(() => String)
  @RequirePermission('backup:schedule')
  async createScheduledBackup(
    @Args('input') input: CreateScheduledBackupInput,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
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

    return this.schedulerService.createScheduledJob(config);
  }

  /**
   * Get scheduled backup jobs
   */
  @Query(() => [String]) // In a real implementation, this would return a proper type
  @RequirePermission('backup:read')
  async scheduledBackups(
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.schedulerService.getScheduledJobs(tenantId);
  }

  /**
   * Delete scheduled backup job
   */
  @Mutation(() => Boolean)
  @RequirePermission('backup:schedule')
  async deleteScheduledBackup(
    @Args('jobId') jobId: string,
  ): Promise<boolean> {
    try {
      await this.schedulerService.deleteScheduledJob(jobId);
      return true;
    } catch (error) {
      return false;
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
   * Create point-in-time recovery plan
   */
  @Mutation(() => String) // In a real implementation, this would return a proper recovery plan type
  @RequirePermission('backup:restore')
  async createRecoveryPlan(
    @Args('input') input: PointInTimeRecoveryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    const options = {
      tenantId,
      targetDateTime: input.targetDateTime,
      includeData: input.includeData ?? [],
      excludeData: input.excludeData ?? [],
      userId: user.id,
    };

    const plan = await this.recoveryService.createRecoveryPlan(options);
    return JSON.stringify(plan);
  }

  /**
   * Execute point-in-time recovery
   */
  @Mutation(() => String) // In a real implementation, this would return a proper recovery result type
  @RequirePermission('backup:restore')
  async executeRecovery(
    @Args('input') input: PointInTimeRecoveryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    const options: Partial<PointInTimeRecoveryOptions> = {
      tenantId,
      targetDateTime: input.targetDateTime,
      includeData: input.includeData ?? [],
      excludeData: input.excludeData ?? [],
      userId: user.id,
    };
    if (input.dryRun !== undefined) {
      options.dryRun = input.dryRun;
    }

    const result = await this.recoveryService.executeRecovery(options as PointInTimeRecoveryOptions);
    return JSON.stringify(result);
  }

  /**
   * Estimate recovery time
   */
  @Query(() => String) // In a real implementation, this would return a proper estimate type
  @RequirePermission('backup:read')
  async estimateRecoveryTime(
    @Args('targetDateTime') targetDateTime: Date,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    const estimate = await this.recoveryService.estimateRecoveryTime(tenantId, targetDateTime);
    return JSON.stringify(estimate);
  }
}