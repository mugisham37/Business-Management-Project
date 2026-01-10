import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { SyncService } from '../services/sync.service';

@Processor('sync-queue')
export class SyncProcessor {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly syncService: SyncService) {}

  @Process('process-sync')
  async handleSyncJob(job: Job) {
    this.logger.log(`Processing sync job: ${job.id}`);
    
    try {
      await this.syncService.processSyncJob(job);
      this.logger.log(`Sync job completed: ${job.id}`);
    } catch (error) {
      this.logger.error(`Sync job failed: ${job.id}`, error);
      throw error;
    }
  }

  @Process('scheduled-sync')
  async handleScheduledSync(job: Job) {
    const { integrationId } = job.data;
    this.logger.log(`Processing scheduled sync for integration: ${integrationId}`);
    
    try {
      await this.syncService.triggerSync(integrationId, {
        type: 'incremental',
        triggeredBy: 'scheduled',
        tenantId: '', // Will be fetched from integration
      });
      
      this.logger.log(`Scheduled sync completed for integration: ${integrationId}`);
    } catch (error) {
      this.logger.error(`Scheduled sync failed for integration: ${integrationId}`, error);
      // Don't throw error for scheduled syncs to avoid job retry
    }
  }
}