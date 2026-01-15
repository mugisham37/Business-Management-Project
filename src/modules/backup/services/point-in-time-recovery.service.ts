import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BackupRepository } from '../repositories/backup.repository';
import { BackupService } from './backup.service';
import { BackupStorageService } from './backup-storage.service';
import { BackupEncryptionService } from './backup-encryption.service';
import { DatabaseService } from '../../database/database.service';

import { BackupEntity, BackupType, BackupStatus } from '../entities/backup.entity';

export interface PointInTimeRecoveryOptions {
  tenantId: string;
  targetDateTime: Date;
  includeData?: string[];
  excludeData?: string[];
  dryRun?: boolean;
  userId: string;
}

export interface RecoveryPlan {
  targetDateTime: Date;
  requiredBackups: BackupEntity[];
  recoverySteps: RecoveryStep[];
  estimatedDuration: number;
  estimatedDataLoss: number; // in minutes
  warnings: string[];
}

export interface RecoveryStep {
  stepNumber: number;
  type: 'restore_full' | 'apply_incremental' | 'apply_differential' | 'apply_transaction_log';
  backupId: string;
  description: string;
  estimatedDuration: number;
}

export interface RecoveryResult {
  success: boolean;
  recoveredToDateTime: Date;
  actualDataLoss: number; // in minutes
  duration: number;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class PointInTimeRecoveryService {
  private readonly logger = new Logger(PointInTimeRecoveryService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly backupRepository: BackupRepository,
    private readonly backupService: BackupService,
    private readonly storageService: BackupStorageService,
    private readonly encryptionService: BackupEncryptionService,
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create point-in-time recovery plan
   */
  async createRecoveryPlan(options: PointInTimeRecoveryOptions): Promise<RecoveryPlan> {
    this.logger.log(`Creating recovery plan for tenant ${options.tenantId} to ${options.targetDateTime.toISOString()}`);

    try {
      // Validate target date time
      await this.validateRecoveryOptions(options);

      // Find the optimal backup chain for recovery
      const backupChain = await this.findOptimalBackupChain(options.tenantId, options.targetDateTime);

      if (backupChain.length === 0) {
        throw new BadRequestException('No suitable backups found for the specified recovery point');
      }

      // Generate recovery steps
      const recoverySteps = await this.generateRecoverySteps(backupChain, options);

      // Calculate estimates
      const estimatedDuration = recoverySteps.reduce((total, step) => total + step.estimatedDuration, 0);
      const estimatedDataLoss = await this.calculateDataLoss(backupChain, options.targetDateTime);

      // Generate warnings
      const warnings = await this.generateRecoveryWarnings(backupChain, options);

      const recoveryPlan: RecoveryPlan = {
        targetDateTime: options.targetDateTime,
        requiredBackups: backupChain,
        recoverySteps,
        estimatedDuration,
        estimatedDataLoss,
        warnings,
      };

      this.logger.log(`Recovery plan created: ${recoverySteps.length} steps, estimated duration: ${estimatedDuration} minutes`);
      return recoveryPlan;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create recovery plan: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Execute point-in-time recovery
   */
  async executeRecovery(options: PointInTimeRecoveryOptions): Promise<RecoveryResult> {
    this.logger.log(`Starting point-in-time recovery for tenant ${options.tenantId}`);
    const startTime = Date.now();

    try {
      // Create recovery plan
      const plan = await this.createRecoveryPlan(options);

      // Validate plan before execution
      await this.validateRecoveryPlan(plan);

      // Execute dry run if requested
      if (options.dryRun) {
        return await this.executeDryRun(plan, options);
      }

      // Emit recovery started event
      this.eventEmitter.emit('recovery.started', {
        tenantId: options.tenantId,
        targetDateTime: options.targetDateTime,
        userId: options.userId,
        planSteps: plan.recoverySteps.length,
      });

      const result = await this.executeRecoveryPlan(plan, options);
      const duration = Date.now() - startTime;

      // Emit recovery completed event
      this.eventEmitter.emit('recovery.completed', {
        tenantId: options.tenantId,
        success: result.success,
        duration,
        userId: options.userId,
      });

      this.logger.log(`Point-in-time recovery completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      return {
        ...result,
        duration,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Point-in-time recovery failed: ${errorMessage}`, errorStack);

      // Emit recovery failed event
      this.eventEmitter.emit('recovery.failed', {
        tenantId: options.tenantId,
        error: errorMessage,
        userId: options.userId,
      });

      return {
        success: false,
        recoveredToDateTime: new Date(),
        actualDataLoss: 0,
        duration: Date.now() - startTime,
        errors: [errorMessage],
        warnings: [],
      };
    }
  }

  /**
   * Get available recovery points for tenant
   */
  async getAvailableRecoveryPoints(tenantId: string, startDate?: Date, endDate?: Date): Promise<Date[]> {
    this.logger.log(`Getting available recovery points for tenant ${tenantId}`);

    try {
      const backups = await this.backupRepository.findMany({
        tenantId,
        status: BackupStatus.COMPLETED,
        isVerified: true,
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
      });

      // Extract recovery points from backups
      const recoveryPoints: Date[] = [];

      for (const backup of backups.backups) {
        // Add backup completion time as a recovery point
        if (backup.completedAt) {
          recoveryPoints.push(backup.completedAt);
        }

        // For incremental backups, add intermediate points if available
        if (backup.type === BackupType.INCREMENTAL && backup.metadata?.transactionLogs) {
          const transactionLogs = backup.metadata.transactionLogs as any[];
          for (const log of transactionLogs) {
            if (log.timestamp) {
              recoveryPoints.push(new Date(log.timestamp));
            }
          }
        }
      }

      // Sort and deduplicate
      const uniquePoints = [...new Set(recoveryPoints.map(d => d.getTime()))]
        .map(t => new Date(t))
        .sort((a, b) => a.getTime() - b.getTime());

      this.logger.log(`Found ${uniquePoints.length} recovery points for tenant ${tenantId}`);
      return uniquePoints;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get recovery points: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Estimate recovery time for a given point
   */
  async estimateRecoveryTime(tenantId: string, targetDateTime: Date): Promise<{
    estimatedMinutes: number;
    dataLossMinutes: number;
    requiredBackups: number;
  }> {
    try {
      const plan = await this.createRecoveryPlan({
        tenantId,
        targetDateTime,
        userId: 'system',
      });

      return {
        estimatedMinutes: Math.ceil(plan.estimatedDuration / 60000), // Convert to minutes
        dataLossMinutes: plan.estimatedDataLoss,
        requiredBackups: plan.requiredBackups.length,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to estimate recovery time: ${errorMessage}`);
      return {
        estimatedMinutes: 0,
        dataLossMinutes: 0,
        requiredBackups: 0,
      };
    }
  }

  /**
   * Private helper methods
   */
  private async validateRecoveryOptions(options: PointInTimeRecoveryOptions): Promise<void> {
    // Check if target date is not in the future
    if (options.targetDateTime > new Date()) {
      throw new BadRequestException('Cannot recover to a future point in time');
    }

    // Check if target date is not too old
    const oldestAllowedDate = new Date();
    oldestAllowedDate.setDate(oldestAllowedDate.getDate() - 365); // 1 year
    
    if (options.targetDateTime < oldestAllowedDate) {
      throw new BadRequestException('Recovery point is too old, backups may not be available');
    }

    // Validate tenant exists
    // Additional validation logic...
  }

  private async findOptimalBackupChain(tenantId: string, targetDateTime: Date): Promise<BackupEntity[]> {
    // Find the most recent full backup before the target date
    const fullBackups = await this.backupRepository.findMany({
      tenantId,
      type: BackupType.FULL,
      status: BackupStatus.COMPLETED,
      isVerified: true,
      endDate: targetDateTime,
    });

    if (fullBackups.backups.length === 0) {
      return [];
    }

    // Get the most recent full backup
    const sortedFullBackups = fullBackups.backups
      .filter(b => b.completedAt !== undefined)
      .sort((a, b) => {
        const aTime = a.completedAt?.getTime() ?? 0;
        const bTime = b.completedAt?.getTime() ?? 0;
        return bTime - aTime;
      });
    
    const baseFullBackup = sortedFullBackups[0];
    if (!baseFullBackup || !baseFullBackup.completedAt) {
      return [];
    }

    const backupChain: BackupEntity[] = [baseFullBackup];

    // Find incremental/differential backups after the full backup
    const incrementalBackups = await this.backupRepository.findMany({
      tenantId,
      type: BackupType.INCREMENTAL,
      status: BackupStatus.COMPLETED,
      isVerified: true,
      ...(baseFullBackup.completedAt !== undefined && { startDate: baseFullBackup.completedAt }),
      endDate: targetDateTime,
    });

    // Add incremental backups in chronological order
    const sortedIncrementals = incrementalBackups.backups
      .filter(b => b.completedAt !== undefined)
      .sort((a, b) => {
        const aTime = a.completedAt?.getTime() ?? 0;
        const bTime = b.completedAt?.getTime() ?? 0;
        return aTime - bTime;
      });

    backupChain.push(...sortedIncrementals);

    return backupChain;
  }

  private async generateRecoverySteps(backups: BackupEntity[], options: PointInTimeRecoveryOptions): Promise<RecoveryStep[]> {
    const steps: RecoveryStep[] = [];
    let stepNumber = 1;

    for (const backup of backups) {
      if (!backup.completedAt) {
        continue;
      }

      let stepType: RecoveryStep['type'];
      let description: string;
      let estimatedDuration: number;

      switch (backup.type) {
        case BackupType.FULL:
          stepType = 'restore_full';
          description = `Restore full backup from ${backup.completedAt.toISOString()}`;
          estimatedDuration = this.estimateRestoreDuration(backup, 'full');
          break;
        case BackupType.INCREMENTAL:
          stepType = 'apply_incremental';
          description = `Apply incremental backup from ${backup.completedAt.toISOString()}`;
          estimatedDuration = this.estimateRestoreDuration(backup, 'incremental');
          break;
        case BackupType.DIFFERENTIAL:
          stepType = 'apply_differential';
          description = `Apply differential backup from ${backup.completedAt.toISOString()}`;
          estimatedDuration = this.estimateRestoreDuration(backup, 'differential');
          break;
        default:
          continue;
      }

      steps.push({
        stepNumber: stepNumber++,
        type: stepType,
        backupId: backup.id,
        description,
        estimatedDuration,
      });
    }

    return steps;
  }

  private estimateRestoreDuration(backup: BackupEntity, type: 'full' | 'incremental' | 'differential'): number {
    // Base duration estimates in milliseconds
    const baseDurations: Record<'full' | 'incremental' | 'differential', number> = {
      full: 300000, // 5 minutes
      incremental: 60000, // 1 minute
      differential: 180000, // 3 minutes
    };

    const baseDuration = baseDurations[type];
    
    // Adjust based on backup size (rough estimate)
    const sizeMultiplier = Math.max(1, backup.sizeBytes / (100 * 1024 * 1024)); // 100MB baseline
    
    return baseDuration * sizeMultiplier;
  }

  private async calculateDataLoss(backups: BackupEntity[], targetDateTime: Date): Promise<number> {
    if (backups.length === 0) {
      return 0;
    }

    // Find the latest backup before target time
    const latestBackup = backups
      .filter(b => b.completedAt !== undefined && b.completedAt <= targetDateTime)
      .sort((a, b) => {
        const aTime = a.completedAt?.getTime() ?? 0;
        const bTime = b.completedAt?.getTime() ?? 0;
        return bTime - aTime;
      })[0];

    if (!latestBackup || !latestBackup.completedAt) {
      return 0;
    }

    // Calculate data loss in minutes
    const dataLossMs = targetDateTime.getTime() - latestBackup.completedAt.getTime();
    return Math.max(0, Math.ceil(dataLossMs / 60000));
  }

  private async generateRecoveryWarnings(backups: BackupEntity[], options: PointInTimeRecoveryOptions): Promise<string[]> {
    const warnings: string[] = [];

    // Check for old backups
    const sortedBackups = backups
      .filter(b => b.completedAt !== undefined)
      .sort((a, b) => {
        const aTime = a.completedAt?.getTime() ?? 0;
        const bTime = b.completedAt?.getTime() ?? 0;
        return aTime - bTime;
      });
    
    const oldestBackup = sortedBackups[0];
    if (oldestBackup && oldestBackup.completedAt) {
      const ageInDays = (Date.now() - oldestBackup.completedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays > 30) {
        warnings.push(`Oldest backup is ${Math.ceil(ageInDays)} days old`);
      }
    }

    // Check for large backups
    const totalSize = backups.reduce((sum, b) => sum + b.sizeBytes, 0);
    if (totalSize > 10 * 1024 * 1024 * 1024) { // 10GB
      warnings.push(`Large recovery size: ${Math.ceil(totalSize / (1024 * 1024 * 1024))}GB`);
    }

    // Check for encrypted backups
    const encryptedBackups = backups.filter(b => b.encryptionKeyId);
    if (encryptedBackups.length > 0) {
      warnings.push(`${encryptedBackups.length} encrypted backups require decryption`);
    }

    return warnings;
  }

  private async validateRecoveryPlan(plan: RecoveryPlan): Promise<void> {
    // Verify all required backups are available and verified
    for (const backup of plan.requiredBackups) {
      if (!backup.isVerified) {
        throw new BadRequestException(`Backup ${backup.id} is not verified`);
      }

      const exists = await this.storageService.backupExists(backup.storagePath, backup.storageLocation);
      if (!exists) {
        throw new BadRequestException(`Backup ${backup.id} not found in storage`);
      }
    }
  }

  private async executeDryRun(plan: RecoveryPlan, options: PointInTimeRecoveryOptions): Promise<RecoveryResult> {
    this.logger.log('Executing dry run for point-in-time recovery');

    // Simulate recovery without actually modifying data
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate each step
    for (const step of plan.recoverySteps) {
      const backup = plan.requiredBackups.find(b => b.id === step.backupId);
      if (!backup) {
        errors.push(`Backup ${step.backupId} not found for step ${step.stepNumber}`);
        continue;
      }

      // Check if backup is accessible
      const exists = await this.storageService.backupExists(backup.storagePath, backup.storageLocation);
      if (!exists) {
        errors.push(`Backup ${backup.id} not accessible in storage`);
      }

      // Check encryption keys if needed
      if (backup.encryptionKeyId) {
        const keyExists = await this.encryptionService.keyExists(backup.encryptionKeyId);
        if (!keyExists) {
          errors.push(`Encryption key ${backup.encryptionKeyId} not available`);
        }
      }
    }

    return {
      success: errors.length === 0,
      recoveredToDateTime: plan.targetDateTime,
      actualDataLoss: plan.estimatedDataLoss,
      duration: 0, // Dry run doesn't take actual time
      errors,
      warnings: [...plan.warnings, ...warnings],
    };
  }

  private async executeRecoveryPlan(plan: RecoveryPlan, options: PointInTimeRecoveryOptions): Promise<Omit<RecoveryResult, 'duration'>> {
    this.logger.log(`Executing recovery plan with ${plan.recoverySteps.length} steps`);

    const errors: string[] = [];
    const warnings: string[] = [];
    let actualDataLoss = plan.estimatedDataLoss;

    try {
      // Execute each recovery step
      for (const step of plan.recoverySteps) {
        this.logger.log(`Executing step ${step.stepNumber}: ${step.description}`);

        try {
          await this.executeRecoveryStep(step, plan, options);
        } catch (stepError: unknown) {
          const errorMsg = stepError instanceof Error 
            ? `Step ${step.stepNumber} failed: ${stepError.message}`
            : `Step ${step.stepNumber} failed: ${String(stepError)}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
          
          // Stop execution on critical errors
          if (step.type === 'restore_full') {
            break;
          }
        }
      }

      // Verify recovery success
      const recoverySuccess = errors.length === 0;
      
      if (recoverySuccess) {
        // Update actual data loss based on successful recovery
        actualDataLoss = await this.calculateActualDataLoss(plan.targetDateTime);
      }

      return {
        success: recoverySuccess,
        recoveredToDateTime: plan.targetDateTime,
        actualDataLoss,
        errors,
        warnings: [...plan.warnings, ...warnings],
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Recovery plan execution failed: ${errorMessage}`, errorStack);
      
      return {
        success: false,
        recoveredToDateTime: new Date(),
        actualDataLoss: 0,
        errors: [errorMessage],
        warnings: [...plan.warnings, ...warnings],
      };
    }
  }

  private async executeRecoveryStep(step: RecoveryStep, plan: RecoveryPlan, options: PointInTimeRecoveryOptions): Promise<void> {
    const backup = plan.requiredBackups.find(b => b.id === step.backupId);
    if (!backup) {
      throw new Error(`Backup ${step.backupId} not found`);
    }

    switch (step.type) {
      case 'restore_full':
        await this.restoreFullBackup(backup, options);
        break;
      case 'apply_incremental':
        await this.applyIncrementalBackup(backup, options);
        break;
      case 'apply_differential':
        await this.applyDifferentialBackup(backup, options);
        break;
      case 'apply_transaction_log':
        await this.applyTransactionLog(backup, options);
        break;
      default:
        throw new Error(`Unknown recovery step type: ${step.type}`);
    }
  }

  private async restoreFullBackup(backup: BackupEntity, options: PointInTimeRecoveryOptions): Promise<void> {
    // Implementation would restore the full backup
    this.logger.log(`Restoring full backup ${backup.id}`);
    
    // Download and decrypt backup if needed
    // Restore database from backup
    // This is a placeholder - actual implementation would depend on database type
  }

  private async applyIncrementalBackup(backup: BackupEntity, options: PointInTimeRecoveryOptions): Promise<void> {
    // Implementation would apply incremental changes
    this.logger.log(`Applying incremental backup ${backup.id}`);
  }

  private async applyDifferentialBackup(backup: BackupEntity, options: PointInTimeRecoveryOptions): Promise<void> {
    // Implementation would apply differential changes
    this.logger.log(`Applying differential backup ${backup.id}`);
  }

  private async applyTransactionLog(backup: BackupEntity, options: PointInTimeRecoveryOptions): Promise<void> {
    // Implementation would apply transaction log
    this.logger.log(`Applying transaction log from backup ${backup.id}`);
  }

  private async calculateActualDataLoss(targetDateTime: Date): Promise<number> {
    // Calculate actual data loss after recovery
    // This would compare the recovered state with the target time
    return 0; // Placeholder
  }
}