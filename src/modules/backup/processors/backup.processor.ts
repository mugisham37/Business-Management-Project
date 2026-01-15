import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

import { BackupRepository } from '../repositories/backup.repository';
import { BackupStorageService } from '../services/backup-storage.service';
import { BackupEncryptionService } from '../services/backup-encryption.service';
import { DatabaseService } from '../../database/database.service';

import { BackupStatus, BackupType } from '../entities/backup.entity';
import { CreateBackupOptions } from '../services/backup.service';

export interface BackupJobData {
  backupId: string;
  options: CreateBackupOptions;
}

export interface RestoreJobData {
  backup: any;
  options: any;
}

@Processor('backup-queue')
export class BackupProcessor {
  private readonly logger = new Logger(BackupProcessor.name);

  constructor(
    private readonly backupRepository: BackupRepository,
    private readonly storageService: BackupStorageService,
    private readonly encryptionService: BackupEncryptionService,
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed: ${err.message}`, err.stack);
  }

  /**
   * Process backup creation
   */
  @Process('process-backup')
  async processBackup(job: Job<BackupJobData>): Promise<void> {
    const { backupId, options } = job.data;
    this.logger.log(`Processing backup ${backupId} for tenant ${options.tenantId}`);

    try {
      // Update backup status to in progress
      await this.backupRepository.update(backupId, {
        status: BackupStatus.IN_PROGRESS,
      });

      // Emit backup started event
      this.eventEmitter.emit('backup.started', {
        tenantId: options.tenantId,
        backupId,
        type: options.type,
      });

      // Create backup based on type
      let backupResult;
      switch (options.type) {
        case BackupType.FULL:
          backupResult = await this.createFullBackup(backupId, options);
          break;
        case BackupType.INCREMENTAL:
          backupResult = await this.createIncrementalBackup(backupId, options);
          break;
        case BackupType.DIFFERENTIAL:
          backupResult = await this.createDifferentialBackup(backupId, options);
          break;
        case BackupType.POINT_IN_TIME:
          backupResult = await this.createPointInTimeBackup(backupId, options);
          break;
        default:
          throw new Error(`Unsupported backup type: ${options.type}`);
      }

      // Update backup with results
      await this.backupRepository.update(backupId, {
        status: BackupStatus.COMPLETED,
        sizeBytes: backupResult.sizeBytes,
        checksum: backupResult.checksum,
        compressionRatio: backupResult.compressionRatio,
        completedAt: new Date(),
      });

      // Emit backup completed event
      this.eventEmitter.emit('backup.completed', {
        tenantId: options.tenantId,
        backupId,
        type: options.type,
        sizeBytes: backupResult.sizeBytes,
        duration: backupResult.duration,
      });

      this.logger.log(`Backup ${backupId} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Backup ${backupId} failed: ${errorMessage}`, errorStack);

      // Update backup status to failed
      await this.backupRepository.update(backupId, {
        status: BackupStatus.FAILED,
        errorMessage: errorMessage,
        completedAt: new Date(),
      });

      // Emit backup failed event
      this.eventEmitter.emit('backup.failed', {
        tenantId: options.tenantId,
        backupId,
        type: options.type,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Process backup restoration
   */
  @Process('process-restore')
  async processRestore(job: Job<RestoreJobData>): Promise<void> {
    const { backup, options } = job.data;
    this.logger.log(`Processing restore from backup ${backup.id}`);

    try {
      // Emit restore started event
      this.eventEmitter.emit('restore.processing', {
        tenantId: backup.tenantId,
        backupId: backup.id,
        restoreJobId: job.id,
      });

      // Download backup from storage
      const tempDir = '/tmp/restore';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const downloadPath = path.join(tempDir, `restore_${backup.id}_${Date.now()}`);
      
      await this.storageService.downloadBackup(
        backup.storagePath,
        backup.storageLocation,
        downloadPath
      );

      // Decrypt backup if encrypted
      let backupFilePath = downloadPath;
      if (backup.encryptionKeyId) {
        const decryptedPath = `${downloadPath}.decrypted`;
        await this.encryptionService.decryptBackupFile(
          downloadPath,
          decryptedPath,
          backup.encryptionKeyId,
          backup.tenantId
        );
        backupFilePath = decryptedPath;
      }

      // Restore based on backup type
      switch (backup.type) {
        case BackupType.FULL:
          await this.restoreFullBackup(backupFilePath, backup, options);
          break;
        case BackupType.INCREMENTAL:
          await this.restoreIncrementalBackup(backupFilePath, backup, options);
          break;
        case BackupType.DIFFERENTIAL:
          await this.restoreDifferentialBackup(backupFilePath, backup, options);
          break;
        default:
          throw new Error(`Unsupported restore type: ${backup.type}`);
      }

      // Clean up temporary files
      this.cleanupTempFiles([downloadPath, backupFilePath]);

      // Emit restore completed event
      this.eventEmitter.emit('restore.completed', {
        tenantId: backup.tenantId,
        backupId: backup.id,
        restoreJobId: job.id,
      });

      this.logger.log(`Restore from backup ${backup.id} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Restore from backup ${backup.id} failed: ${errorMessage}`, errorStack);

      // Emit restore failed event
      this.eventEmitter.emit('restore.failed', {
        tenantId: backup.tenantId,
        backupId: backup.id,
        restoreJobId: job.id,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Create full backup
   */
  private async createFullBackup(backupId: string, options: CreateBackupOptions): Promise<{
    sizeBytes: number;
    checksum: string;
    compressionRatio: number;
    duration: number;
  }> {
    const startTime = Date.now();
    this.logger.log(`Creating full backup for tenant ${options.tenantId}`);

    try {
      // Create temporary directory for backup
      const tempDir = '/tmp/backups';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const backupFileName = `full_backup_${options.tenantId}_${Date.now()}.sql`;
      const backupFilePath = path.join(tempDir, backupFileName);

      // Create database dump
      await this.createDatabaseDump(options.tenantId, backupFilePath, options);

      // Compress backup if enabled
      let finalBackupPath = backupFilePath;
      let compressionRatio = 1.0;

      if (options.compressionEnabled) {
        const compressedPath = `${backupFilePath}.gz`;
        await this.compressFile(backupFilePath, compressedPath);
        finalBackupPath = compressedPath;
        
        const originalSize = fs.statSync(backupFilePath).size;
        const compressedSize = fs.statSync(compressedPath).size;
        compressionRatio = compressedSize / originalSize;
      }

      // Encrypt backup if enabled
      if (options.encryptionEnabled) {
        const encryptedPath = `${finalBackupPath}.enc`;
        await this.encryptionService.encryptBackupFile(
          finalBackupPath,
          encryptedPath,
          options.tenantId
        );
        finalBackupPath = encryptedPath;
      }

      // Get backup info
      const stats = fs.statSync(finalBackupPath);
      const sizeBytes = stats.size;

      // Calculate checksum
      const checksum = await this.calculateChecksum(finalBackupPath);

      // Upload to storage
      const backup = await this.backupRepository.findById(backupId);
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }
      await this.storageService.uploadBackup(
        finalBackupPath,
        backup.storagePath,
        backup.storageLocation,
        {
          tenantId: options.tenantId,
          backupType: options.type,
          createdAt: new Date().toISOString(),
        }
      );

      // Clean up temporary files
      this.cleanupTempFiles([backupFilePath, finalBackupPath]);

      const duration = Date.now() - startTime;
      this.logger.log(`Full backup created in ${duration}ms`);

      return {
        sizeBytes,
        checksum,
        compressionRatio,
        duration,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create full backup: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Create incremental backup
   */
  private async createIncrementalBackup(backupId: string, options: CreateBackupOptions): Promise<{
    sizeBytes: number;
    checksum: string;
    compressionRatio: number;
    duration: number;
  }> {
    const startTime = Date.now();
    this.logger.log(`Creating incremental backup for tenant ${options.tenantId}`);

    try {
      // Find the last backup to determine what changes to include
      const lastBackup = await this.backupRepository.findLatestByType(
        options.tenantId,
        BackupType.INCREMENTAL
      );

      const sinceDate = lastBackup?.completedAt || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      // Create temporary directory
      const tempDir = '/tmp/backups';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const backupFileName = `incremental_backup_${options.tenantId}_${Date.now()}.sql`;
      const backupFilePath = path.join(tempDir, backupFileName);

      // Create incremental database dump
      await this.createIncrementalDatabaseDump(options.tenantId, backupFilePath, sinceDate, options);

      // Process the backup file (compression, encryption, upload)
      const result = await this.processBackupFile(backupFilePath, backupId, options);

      const duration = Date.now() - startTime;
      this.logger.log(`Incremental backup created in ${duration}ms`);

      return {
        ...result,
        duration,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create incremental backup: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Create differential backup
   */
  private async createDifferentialBackup(backupId: string, options: CreateBackupOptions): Promise<{
    sizeBytes: number;
    checksum: string;
    compressionRatio: number;
    duration: number;
  }> {
    const startTime = Date.now();
    this.logger.log(`Creating differential backup for tenant ${options.tenantId}`);

    try {
      // Find the last full backup
      const lastFullBackup = await this.backupRepository.findLatestByType(
        options.tenantId,
        BackupType.FULL
      );

      if (!lastFullBackup) {
        throw new Error('No full backup found for differential backup');
      }

      const sinceDate = lastFullBackup.completedAt ?? new Date(0);

      // Create temporary directory
      const tempDir = '/tmp/backups';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const backupFileName = `differential_backup_${options.tenantId}_${Date.now()}.sql`;
      const backupFilePath = path.join(tempDir, backupFileName);

      // Create differential database dump
      await this.createIncrementalDatabaseDump(options.tenantId, backupFilePath, sinceDate, options);

      // Process the backup file
      const result = await this.processBackupFile(backupFilePath, backupId, options);

      const duration = Date.now() - startTime;
      this.logger.log(`Differential backup created in ${duration}ms`);

      return {
        ...result,
        duration,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create differential backup: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Create point-in-time backup
   */
  private async createPointInTimeBackup(backupId: string, options: CreateBackupOptions): Promise<{
    sizeBytes: number;
    checksum: string;
    compressionRatio: number;
    duration: number;
  }> {
    const startTime = Date.now();
    this.logger.log(`Creating point-in-time backup for tenant ${options.tenantId}`);

    try {
      // Create transaction log backup
      const tempDir = '/tmp/backups';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const backupFileName = `pit_backup_${options.tenantId}_${Date.now()}.log`;
      const backupFilePath = path.join(tempDir, backupFileName);

      // Create transaction log backup
      await this.createTransactionLogBackup(options.tenantId, backupFilePath, options);

      // Process the backup file
      const result = await this.processBackupFile(backupFilePath, backupId, options);

      const duration = Date.now() - startTime;
      this.logger.log(`Point-in-time backup created in ${duration}ms`);

      return {
        ...result,
        duration,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create point-in-time backup: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Process backup file (compression, encryption, upload)
   */
  private async processBackupFile(
    backupFilePath: string,
    backupId: string,
    options: CreateBackupOptions
  ): Promise<{
    sizeBytes: number;
    checksum: string;
    compressionRatio: number;
  }> {
    let finalBackupPath = backupFilePath;
    let compressionRatio = 1.0;

    // Compress if enabled
    if (options.compressionEnabled) {
      const compressedPath = `${backupFilePath}.gz`;
      await this.compressFile(backupFilePath, compressedPath);
      finalBackupPath = compressedPath;
      
      const originalSize = fs.statSync(backupFilePath).size;
      const compressedSize = fs.statSync(compressedPath).size;
      compressionRatio = compressedSize / originalSize;
    }

    // Encrypt if enabled
    if (options.encryptionEnabled) {
      const encryptedPath = `${finalBackupPath}.enc`;
      await this.encryptionService.encryptBackupFile(
        finalBackupPath,
        encryptedPath,
        options.tenantId
      );
      finalBackupPath = encryptedPath;
    }

    // Get file info
    const stats = fs.statSync(finalBackupPath);
    const sizeBytes = stats.size;
    const checksum = await this.calculateChecksum(finalBackupPath);

    // Upload to storage
    const backup = await this.backupRepository.findById(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }
    await this.storageService.uploadBackup(
      finalBackupPath,
      backup.storagePath,
      backup.storageLocation,
      {
        tenantId: options.tenantId,
        backupType: options.type,
        createdAt: new Date().toISOString(),
      }
    );

    // Clean up temporary files
    this.cleanupTempFiles([backupFilePath, finalBackupPath]);

    return {
      sizeBytes,
      checksum,
      compressionRatio,
    };
  }

  /**
   * Create database dump
   */
  private async createDatabaseDump(
    tenantId: string,
    outputPath: string,
    options: CreateBackupOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // This is a simplified example using pg_dump for PostgreSQL
      // In a real implementation, you'd use the appropriate tool for your database
      const args = [
        '--host', process.env.DB_HOST || 'localhost',
        '--port', process.env.DB_PORT || '5432',
        '--username', process.env.DB_USERNAME || 'postgres',
        '--dbname', process.env.DB_NAME || 'unified_platform',
        '--file', outputPath,
        '--verbose',
        '--no-password',
        '--format', 'custom',
      ];

      // Add tenant-specific filtering
      if (options.includeData && options.includeData.length > 0) {
        options.includeData.forEach(table => {
          args.push('--table', table);
        });
      }

      const pgDump = spawn('pg_dump', args, {
        env: {
          ...process.env,
          PGPASSWORD: process.env.DB_PASSWORD,
        },
      });

      pgDump.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });

      pgDump.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Create incremental database dump
   */
  private async createIncrementalDatabaseDump(
    tenantId: string,
    outputPath: string,
    sinceDate: Date,
    options: CreateBackupOptions
  ): Promise<void> {
    // This would create a dump of only the changes since the specified date
    // Implementation depends on your database and change tracking mechanism
    this.logger.log(`Creating incremental dump since ${sinceDate.toISOString()}`);
    
    // Placeholder implementation
    await this.createDatabaseDump(tenantId, outputPath, options);
  }

  /**
   * Create transaction log backup
   */
  private async createTransactionLogBackup(
    tenantId: string,
    outputPath: string,
    options: CreateBackupOptions
  ): Promise<void> {
    // This would backup the transaction log for point-in-time recovery
    this.logger.log(`Creating transaction log backup for tenant ${tenantId}`);
    
    // Placeholder implementation
    fs.writeFileSync(outputPath, `Transaction log backup for ${tenantId} at ${new Date().toISOString()}`);
  }

  /**
   * Restore full backup
   */
  private async restoreFullBackup(backupFilePath: string, backup: any, options: any): Promise<void> {
    this.logger.log(`Restoring full backup from ${backupFilePath}`);
    
    // Implementation would restore the database from the backup file
    // This is a placeholder
  }

  /**
   * Restore incremental backup
   */
  private async restoreIncrementalBackup(backupFilePath: string, backup: any, options: any): Promise<void> {
    this.logger.log(`Restoring incremental backup from ${backupFilePath}`);
    
    // Implementation would apply incremental changes
    // This is a placeholder
  }

  /**
   * Restore differential backup
   */
  private async restoreDifferentialBackup(backupFilePath: string, backup: any, options: any): Promise<void> {
    this.logger.log(`Restoring differential backup from ${backupFilePath}`);
    
    // Implementation would apply differential changes
    // This is a placeholder
  }

  /**
   * Compress file using gzip
   */
  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const gzip = spawn('gzip', ['-c', inputPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const outputStream = fs.createWriteStream(outputPath);
      gzip.stdout.pipe(outputStream);

      gzip.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`gzip exited with code ${code}`));
        }
      });

      gzip.on('error', reject);
      outputStream.on('error', reject);
    });
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Clean up temporary files
   */
  private cleanupTempFiles(filePaths: string[]): void {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.log(`Cleaned up temporary file: ${filePath}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        this.logger.warn(`Failed to clean up temporary file ${filePath}: ${errorMessage}`);
      }
    }
  }
}