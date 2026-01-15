import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BackupVerificationService } from '../services/backup-verification.service';

export interface VerificationJobData {
  backupId: string;
}

@Processor('backup-verification-queue')
export class BackupVerificationProcessor {
  private readonly logger = new Logger(BackupVerificationProcessor.name);

  constructor(
    private readonly verificationService: BackupVerificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing verification job ${job.id} for backup ${job.data.backupId}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Verification job ${job.id} completed: ${result.isValid ? 'PASSED' : 'FAILED'}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Verification job ${job.id} failed: ${err.message}`, err.stack);
  }

  /**
   * Process backup verification
   */
  @Process('verify-backup')
  async verifyBackup(job: Job<VerificationJobData>): Promise<void> {
    const { backupId } = job.data;
    this.logger.log(`Verifying backup ${backupId}`);

    try {
      // Perform backup verification
      const result = await this.verificationService.verifyBackup(backupId);

      // Emit verification completed event
      this.eventEmitter.emit('backup.verification.completed', {
        backupId,
        isValid: result.isValid,
        errors: result.errors,
        duration: result.verificationDuration,
      });

      if (!result.isValid) {
        this.logger.warn(`Backup ${backupId} verification failed: ${result.errors.join(', ')}`);
      } else {
        this.logger.log(`Backup ${backupId} verification passed`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Backup verification failed for ${backupId}: ${errorMessage}`, errorStack);

      // Emit verification failed event
      this.eventEmitter.emit('backup.verification.failed', {
        backupId,
        error: errorMessage,
      });

      throw error;
    }
  }
}