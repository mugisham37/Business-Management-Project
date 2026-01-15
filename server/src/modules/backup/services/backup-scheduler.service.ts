import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BackupService } from './backup.service';
import { BackupJobRepository } from '../repositories/backup-job.repository';
import { BackupType, BackupStorageLocation } from '../entities/backup.entity';

export interface ScheduledBackupConfig {
  tenantId: string;
  type: BackupType;
  schedule: string;
  retentionDays: number;
  storageLocation: BackupStorageLocation;
  isEnabled: boolean;
  configuration: {
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
    geographicReplication: boolean;
    includeData?: string[];
    excludeData?: string[];
  };
}

@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private scheduledJobs = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly configService: ConfigService,
    private readonly backupService: BackupService,
    private readonly backupJobRepository: BackupJobRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing backup scheduler');
    await this.loadScheduledJobs();
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down backup scheduler');
    this.clearAllScheduledJobs();
  }

  /**
   * Daily backup job - runs at 2 AM
   */
  @Cron('0 2 * * *', {
    name: 'daily-full-backups',
    timeZone: 'UTC',
  })
  async handleDailyFullBackups() {
    this.logger.log('Starting daily full backup job');

    try {
      const activeJobs = await this.backupJobRepository.findActiveJobs(BackupType.FULL);
      
      for (const job of activeJobs) {
        await this.executeScheduledBackup(job);
      }

      this.logger.log(`Completed daily full backup job for ${activeJobs.length} tenants`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Daily full backup job failed: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Hourly incremental backup job
   */
  @Cron('0 * * * *', {
    name: 'hourly-incremental-backups',
    timeZone: 'UTC',
  })
  async handleHourlyIncrementalBackups() {
    this.logger.log('Starting hourly incremental backup job');

    try {
      const activeJobs = await this.backupJobRepository.findActiveJobs(BackupType.INCREMENTAL);
      
      for (const job of activeJobs) {
        await this.executeScheduledBackup(job);
      }

      this.logger.log(`Completed hourly incremental backup job for ${activeJobs.length} tenants`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Hourly incremental backup job failed: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Weekly differential backup job - runs on Sundays at 3 AM
   */
  @Cron('0 3 * * 0', {
    name: 'weekly-differential-backups',
    timeZone: 'UTC',
  })
  async handleWeeklyDifferentialBackups() {
    this.logger.log('Starting weekly differential backup job');

    try {
      const activeJobs = await this.backupJobRepository.findActiveJobs(BackupType.DIFFERENTIAL);
      
      for (const job of activeJobs) {
        await this.executeScheduledBackup(job);
      }

      this.logger.log(`Completed weekly differential backup job for ${activeJobs.length} tenants`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Weekly differential backup job failed: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Backup cleanup job - runs daily at 4 AM
   */
  @Cron('0 4 * * *', {
    name: 'backup-cleanup',
    timeZone: 'UTC',
  })
  async handleBackupCleanup() {
    this.logger.log('Starting backup cleanup job');

    try {
      const deletedCount = await this.backupService.cleanupExpiredBackups();
      this.logger.log(`Backup cleanup completed: ${deletedCount} backups deleted`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Backup cleanup job failed: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Create a scheduled backup job
   */
  async createScheduledJob(config: ScheduledBackupConfig): Promise<string> {
    this.logger.log(`Creating scheduled backup job for tenant ${config.tenantId}`);

    try {
      const job = await this.backupJobRepository.create({
        tenantId: config.tenantId,
        type: config.type,
        schedule: config.schedule,
        isEnabled: config.isEnabled,
        configuration: config.configuration,
        nextRunAt: this.calculateNextRun(config.schedule),
      });

      // Schedule the job if enabled
      if (config.isEnabled) {
        await this.scheduleJob(job.id, config);
      }

      this.logger.log(`Scheduled backup job ${job.id} created for tenant ${config.tenantId}`);
      return job.id;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create scheduled backup job: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Update scheduled backup job
   */
  async updateScheduledJob(jobId: string, updates: Partial<ScheduledBackupConfig>): Promise<void> {
    this.logger.log(`Updating scheduled backup job ${jobId}`);

    try {
      const job = await this.backupJobRepository.findById(jobId);
      if (!job) {
        throw new Error(`Backup job ${jobId} not found`);
      }

      // Update job configuration
      await this.backupJobRepository.update(jobId, {
        ...updates,
        nextRunAt: updates.schedule ? this.calculateNextRun(updates.schedule) : job.nextRunAt,
      });

      // Reschedule if needed
      if (updates.schedule || updates.isEnabled !== undefined) {
        this.clearScheduledJob(jobId);
        
        if (updates.isEnabled !== false) {
          const updatedJob = await this.backupJobRepository.findById(jobId);
          await this.scheduleJob(jobId, {
            ...job,
            ...updates,
          } as ScheduledBackupConfig);
        }
      }

      this.logger.log(`Scheduled backup job ${jobId} updated`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update scheduled backup job ${jobId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Delete scheduled backup job
   */
  async deleteScheduledJob(jobId: string): Promise<void> {
    this.logger.log(`Deleting scheduled backup job ${jobId}`);

    try {
      // Clear scheduled job
      this.clearScheduledJob(jobId);

      // Delete from database
      await this.backupJobRepository.delete(jobId);

      this.logger.log(`Scheduled backup job ${jobId} deleted`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete scheduled backup job ${jobId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Enable/disable scheduled backup job
   */
  async toggleScheduledJob(jobId: string, enabled: boolean): Promise<void> {
    this.logger.log(`${enabled ? 'Enabling' : 'Disabling'} scheduled backup job ${jobId}`);

    try {
      await this.backupJobRepository.update(jobId, { isEnabled: enabled });

      if (enabled) {
        const job = await this.backupJobRepository.findById(jobId);
        await this.scheduleJob(jobId, job as any);
      } else {
        this.clearScheduledJob(jobId);
      }

      this.logger.log(`Scheduled backup job ${jobId} ${enabled ? 'enabled' : 'disabled'}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to toggle scheduled backup job ${jobId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get scheduled jobs for tenant
   */
  async getScheduledJobs(tenantId: string): Promise<any[]> {
    return this.backupJobRepository.findByTenant(tenantId);
  }

  /**
   * Private helper methods
   */
  private async loadScheduledJobs(): Promise<void> {
    try {
      const activeJobs = await this.backupJobRepository.findAllActive();
      
      for (const job of activeJobs) {
        await this.scheduleJob(job.id, job as any);
      }

      this.logger.log(`Loaded ${activeJobs.length} scheduled backup jobs`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to load scheduled jobs: ${errorMessage}`, errorStack);
    }
  }

  private async scheduleJob(jobId: string, config: ScheduledBackupConfig): Promise<void> {
    // Clear existing job if any
    this.clearScheduledJob(jobId);

    // Calculate next run time
    const nextRun = this.calculateNextRun(config.schedule);
    const delay = nextRun.getTime() - Date.now();

    if (delay > 0) {
      const timeout = setTimeout(async () => {
        await this.executeScheduledBackup(config as any);
        // Reschedule for next run
        await this.scheduleJob(jobId, config);
      }, delay);

      this.scheduledJobs.set(jobId, timeout);
    }
  }

  private clearScheduledJob(jobId: string): void {
    const timeout = this.scheduledJobs.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledJobs.delete(jobId);
    }
  }

  private clearAllScheduledJobs(): void {
    for (const [jobId, timeout] of this.scheduledJobs) {
      clearTimeout(timeout);
    }
    this.scheduledJobs.clear();
  }

  private async executeScheduledBackup(job: any): Promise<void> {
    this.logger.log(`Executing scheduled backup for tenant ${job.tenantId}, type: ${job.type}`);

    try {
      // Update last run time
      await this.backupJobRepository.update(job.id, {
        lastRunAt: new Date(),
        nextRunAt: this.calculateNextRun(job.schedule),
      });

      // Create backup
      await this.backupService.createBackup({
        tenantId: job.tenantId,
        type: job.type,
        storageLocation: job.configuration.storageLocation || BackupStorageLocation.S3,
        retentionDays: job.retentionDays,
        includeData: job.configuration.includeData,
        excludeData: job.configuration.excludeData,
        compressionEnabled: job.configuration.compressionEnabled,
        encryptionEnabled: job.configuration.encryptionEnabled,
        geographicReplication: job.configuration.geographicReplication,
        priority: 5,
        userId: 'system',
      });

      // Emit scheduled backup event
      this.eventEmitter.emit('backup.scheduled.executed', {
        tenantId: job.tenantId,
        jobId: job.id,
        type: job.type,
      });

      this.logger.log(`Scheduled backup executed successfully for tenant ${job.tenantId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Scheduled backup failed for tenant ${job.tenantId}: ${errorMessage}`, errorStack);

      // Emit failure event
      this.eventEmitter.emit('backup.scheduled.failed', {
        tenantId: job.tenantId,
        jobId: job.id,
        type: job.type,
        error: errorMessage,
      });
    }
  }

  private calculateNextRun(schedule: string): Date {
    // Simple cron parser - in production, use a proper cron library
    const now = new Date();
    const nextRun = new Date(now);
    
    // For simplicity, assume daily schedule
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(2, 0, 0, 0); // 2 AM next day
    
    return nextRun;
  }
}