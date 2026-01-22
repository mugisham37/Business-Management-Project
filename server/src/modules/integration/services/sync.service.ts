import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

import { SyncLogRepository } from '../repositories/sync-log.repository';
import { IntegrationRepository } from '../repositories/integration.repository';
import { ConnectorService } from './connector.service';
import { OAuth2Service } from './oauth2.service';
import { ApiKeyService } from './api-key.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

import {
  SyncLog,
  SyncStatus,
  SyncType,
  ConflictResolutionStrategy,
  SyncConflict,
} from '../entities/sync-log.entity';

import {
  Integration,
  IntegrationStatus,
  AuthType,
} from '../entities/integration.entity';

export interface SyncOptions {
  type: SyncType;
  triggeredBy: 'manual' | 'scheduled' | 'webhook';
  tenantId: string;
  entityTypes?: string[];
  lastSyncTimestamp?: Date;
  batchSize?: number;
  conflictResolution?: ConflictResolutionStrategy;
}

export interface SyncResult {
  syncId: string;
  status: SyncStatus;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  recordsSkipped: number;
  conflicts: SyncConflict[];
  errors: SyncError[];
  duration: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface SyncError {
  entityType?: string;
  record?: any;
  error: string;
  code?: string;
  details?: string;
  retryable?: boolean;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly scheduledSyncs = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly syncLogRepository: SyncLogRepository,
    private readonly integrationRepository: IntegrationRepository,
    private readonly connectorService: ConnectorService,
    private readonly oauth2Service: OAuth2Service,
    private readonly apiKeyService: ApiKeyService,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('sync-queue') private readonly syncQueue: Queue,
  ) {}

  /**
   * Schedule periodic synchronization for an integration
   */
  async scheduleSync(integrationId: string, intervalMinutes: number): Promise<void> {
    this.logger.log(`Scheduling sync for integration: ${integrationId}, interval: ${intervalMinutes}m`);

    // Cancel existing scheduled sync if any
    await this.cancelScheduledSync(integrationId);

    // Schedule new sync
    const intervalMs = intervalMinutes * 60 * 1000;
    const timeout = setInterval(async () => {
      try {
        await this.triggerSync(integrationId, {
          type: SyncType.INCREMENTAL,
          triggeredBy: 'scheduled',
          tenantId: '', // Will be fetched from integration
        });
      } catch (error) {
        this.logger.error(`Scheduled sync failed for integration ${integrationId}:`, error);
      }
    }, intervalMs);

    this.scheduledSyncs.set(integrationId, timeout);

    // Also add to queue for persistence across restarts
    await this.syncQueue.add(
      'scheduled-sync',
      { integrationId },
      {
        repeat: { every: intervalMs },
        jobId: `scheduled-${integrationId}`,
      }
    );

    this.logger.log(`Sync scheduled successfully for integration: ${integrationId}`);
  }

  /**
   * Cancel scheduled synchronization for an integration
   */
  async cancelScheduledSync(integrationId: string): Promise<void> {
    this.logger.log(`Cancelling scheduled sync for integration: ${integrationId}`);

    // Cancel in-memory timeout
    const timeout = this.scheduledSyncs.get(integrationId);
    if (timeout) {
      clearInterval(timeout);
      this.scheduledSyncs.delete(integrationId);
    }

    // Remove from queue
    const job = await this.syncQueue.getJob(`scheduled-${integrationId}`);
    if (job) {
      await job.remove();
    }

    this.logger.log(`Scheduled sync cancelled for integration: ${integrationId}`);
  }

  /**
   * Trigger manual synchronization
   */
  async triggerSync(integrationId: string, options: SyncOptions): Promise<string> {
    this.logger.log(`Triggering ${options.type} sync for integration: ${integrationId}`);

    // Validate integration
    const integration = await this.integrationRepository.findById(options.tenantId, integrationId);
    if (!integration) {
      throw new NotFoundException(`Integration not found: ${integrationId}`);
    }

    if (integration.status !== IntegrationStatus.ACTIVE) {
      throw new BadRequestException('Integration must be active to trigger sync');
    }

    // Create sync log entry
    const syncLog = await this.syncLogRepository.create({
      integrationId,
      tenantId: integration.tenantId,
      type: options.type,
      status: SyncStatus.RUNNING,
      triggeredBy: options.triggeredBy,
      startedAt: new Date(),
      options: {
        ...(options.entityTypes ? { entityTypes: options.entityTypes } : {}),
        ...(options.lastSyncTimestamp ? { lastSyncTimestamp: options.lastSyncTimestamp } : {}),
        batchSize: options.batchSize || 1000,
        conflictResolution: options.conflictResolution || ConflictResolutionStrategy.REMOTE_WINS,
      },
    });

    // Queue sync job for background processing
    await this.syncQueue.add(
      'process-sync',
      {
        syncId: syncLog.id,
        integrationId,
        tenantId: integration.tenantId,
        options,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );

    // Emit sync started event
    this.eventEmitter.emit('sync.started', {
      syncId: syncLog.id,
      integrationId,
      tenantId: integration.tenantId,
      type: options.type,
    });

    this.logger.log(`Sync queued successfully: ${syncLog.id} for integration: ${integrationId}`);
    return syncLog.id;
  }

  /**
   * Process synchronization job (called by queue processor)
   */
  async processSyncJob(job: Job): Promise<void> {
    const { syncId, integrationId, tenantId, options } = job.data;
    
    this.logger.log(`Processing sync job: ${syncId} for integration: ${integrationId}`);

    try {
      // Update job progress
      await job.progress(10);

      // Get integration and connector
      const integration = await this.integrationRepository.findById(tenantId, integrationId);
      
      if (!integration) {
        throw new Error(`Integration not found: ${integrationId}`);
      }
      
      if (!integration.providerName) {
        throw new Error(`Integration provider name is not set: ${integrationId}`);
      }
      
      const connector = await this.connectorService.getConnector(
        integration.type,
        integration.providerName
      );

      if (!connector) {
        throw new Error(`Connector not available: ${integration.providerName}`);
      }

      // Get authentication credentials
      let credentials = {};
      if (integration.authType === AuthType.OAUTH2) {
        credentials = await this.oauth2Service.getValidToken(integrationId);
      } else if (integration.authType === AuthType.API_KEY) {
        credentials = await this.apiKeyService.getCredentials(integrationId);
      }

      await job.progress(20);

      // Perform synchronization
      const result = await this.performSync(
        syncId,
        integration,
        connector,
        credentials,
        options,
        job
      );

      // Update sync log with results
      await this.syncLogRepository.update(syncId, {
        status: result.status,
        completedAt: new Date(),
        recordsProcessed: result.recordsProcessed,
        recordsCreated: result.recordsCreated,
        recordsUpdated: result.recordsUpdated,
        recordsDeleted: result.recordsDeleted,
        recordsSkipped: result.recordsSkipped,
        conflicts: result.conflicts,
        errors: result.errors,
        duration: result.duration,
      });

      // Emit sync completed event
      this.eventEmitter.emit('sync.completed', {
        syncId,
        integrationId,
        tenantId,
        result,
      });

      await job.progress(100);
      this.logger.log(`Sync completed successfully: ${syncId}`);

    } catch (error) {
      const err = error as Error;
      this.logger.error(`Sync failed: ${syncId}`, err);

      // Update sync log with error
      await this.syncLogRepository.update(syncId, {
        status: SyncStatus.FAILED,
        completedAt: new Date(),
        errors: [{
          entityType: 'sync',
          error: err.message,
          details: err.stack || 'No stack trace available',
          retryable: this.isRetryableError(err),
        }],
      });

      // Emit sync failed event
      this.eventEmitter.emit('sync.failed', {
        syncId,
        integrationId,
        tenantId,
        error: err.message,
      });

      throw error;
    }
  }

  /**
   * Perform the actual synchronization
   */
  private async performSync(
    syncId: string,
    integration: Integration,
    connector: any,
    credentials: any,
    options: SyncOptions,
    job: Job
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      syncId,
      status: SyncStatus.COMPLETED,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      recordsSkipped: 0,
      conflicts: [],
      errors: [],
      duration: 0,
      startedAt: new Date(),
    };

    try {
      // Get last sync timestamp for incremental sync
      let lastSyncTimestamp = options.lastSyncTimestamp;
      if (options.type === SyncType.INCREMENTAL && !lastSyncTimestamp) {
        const lastSuccessfulSync = await this.syncLogRepository.findLastSuccessful(
          integration.id,
          integration.tenantId
        );
        lastSyncTimestamp = lastSuccessfulSync?.completedAt;
      }

      await job.progress(30);

      // Get entity types to sync
      const entityTypes = options.entityTypes || connector.getSupportedEntityTypes();
      const batchSize = options.batchSize || 1000;

      let progressStep = 0;
      const totalSteps = entityTypes.length;

      // Sync each entity type
      for (const entityType of entityTypes) {
        this.logger.log(`Syncing entity type: ${entityType} for integration: ${integration.id}`);

        try {
          // Fetch data from external system
          const externalData = await connector.fetchData(entityType, {
            config: integration.config,
            credentials,
            lastSyncTimestamp,
            batchSize,
          });

          // Fetch local data for comparison
          const localData = await this.getLocalData(
            integration.tenantId,
            entityType,
            lastSyncTimestamp
          );

          // Perform data synchronization
          const syncResults = await this.syncEntityData(
            integration.tenantId,
            entityType,
            localData,
            externalData,
            options.conflictResolution || ConflictResolutionStrategy.REMOTE_WINS
          );

          // Accumulate results
          result.recordsProcessed += syncResults.processed;
          result.recordsCreated += syncResults.created;
          result.recordsUpdated += syncResults.updated;
          result.recordsDeleted += syncResults.deleted;
          result.recordsSkipped += syncResults.skipped;
          result.conflicts.push(...syncResults.conflicts);
          result.errors.push(...syncResults.errors);

        } catch (error) {
          const err = error as Error;
          this.logger.error(`Failed to sync entity type ${entityType}:`, err);
          result.errors.push({
            entityType,
            error: err.message,
            details: err.stack || 'No stack trace available',
            retryable: this.isRetryableError(err),
          });
        }

        // Update progress
        progressStep++;
        const progress = 30 + (progressStep / totalSteps) * 60;
        await job.progress(Math.round(progress));
      }

      // Determine final status
      if (result.errors.length > 0) {
        const hasNonRetryableErrors = result.errors.some(e => !e.retryable);
        result.status = hasNonRetryableErrors ? SyncStatus.FAILED : SyncStatus.COMPLETED_WITH_ERRORS;
      }

      result.duration = Date.now() - startTime;
      result.completedAt = new Date();

      return result;

    } catch (error) {
      const err = error as Error;
      result.status = SyncStatus.FAILED;
      result.duration = Date.now() - startTime;
      result.completedAt = new Date();
      result.errors.push({
        entityType: 'sync',
        error: err.message,
        details: err.stack || 'No stack trace available',
        retryable: this.isRetryableError(err),
      });

      throw error;
    }
  }

  /**
   * Synchronize data for a specific entity type
   */
  private async syncEntityData(
    tenantId: string,
    entityType: string,
    localData: any[],
    externalData: any[],
    conflictResolution: ConflictResolutionStrategy
  ): Promise<{
    processed: number;
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
    conflicts: SyncConflict[];
    errors: SyncError[];
  }> {
    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      conflicts: [] as SyncConflict[],
      errors: [] as SyncError[],
    };

    // Create maps for efficient lookup
    const localMap = new Map(localData.map(item => [item.externalId || item.id, item]));
    const externalMap = new Map(externalData.map(item => [item.id, item]));

    // Process external data (creates and updates)
    for (const externalItem of externalData) {
      try {
        results.processed++;
        const localItem = localMap.get(externalItem.id);

        if (!localItem) {
          // Create new record
          await this.createLocalRecord(tenantId, entityType, externalItem);
          results.created++;
        } else {
          // Check for conflicts
          const hasConflict = this.detectConflict(localItem, externalItem);
          
          if (hasConflict) {
            const conflict: SyncConflict = {
              syncId: '', // Will be set later
              entityType,
              entityId: externalItem.id,
              localValue: localItem,
              remoteValue: externalItem,
              status: 'pending',
            };

            // Resolve conflict based on strategy
            const resolution = await this.resolveConflict(
              conflict,
              conflictResolution
            );

            if (resolution.resolution === 'manual_required') {
              results.conflicts.push(conflict);
              results.skipped++;
            } else {
              await this.updateLocalRecord(
                tenantId,
                entityType,
                localItem.id,
                resolution.resolvedData
              );
              results.updated++;
            }
          } else {
            // No conflict, update normally
            await this.updateLocalRecord(tenantId, entityType, localItem.id, externalItem);
            results.updated++;
          }
        }
      } catch (error) {
        const err = error as Error;
        results.errors.push({
          entityType,
          error: err.message,
          retryable: this.isRetryableError(err),
        });
      }
    }

    // Process deletions (items in local but not in external)
    for (const [externalId, localItem] of localMap) {
      if (!externalMap.has(externalId)) {
        try {
          await this.deleteLocalRecord(tenantId, entityType, localItem.id);
          results.deleted++;
        } catch (error) {
          const err = error as Error;
          results.errors.push({
            entityType,
            error: err.message,
            retryable: this.isRetryableError(err),
          });
        }
      }
    }

    return results;
  }

  /**
   * Detect conflicts between local and remote data
   */
  private detectConflict(localItem: any, externalItem: any): boolean {
    // Simple conflict detection based on modification timestamps
    if (localItem.updatedAt && externalItem.updatedAt) {
      const localTime = new Date(localItem.updatedAt).getTime();
      const externalTime = new Date(externalItem.updatedAt).getTime();
      
      // Consider it a conflict if both were modified within the same minute
      // and the local version is newer
      return Math.abs(localTime - externalTime) < 60000 && localTime > externalTime;
    }

    return false;
  }

  /**
   * Resolve data conflicts based on strategy
   */
  private async resolveConflict(
    conflict: SyncConflict,
    strategy: ConflictResolutionStrategy
  ): Promise<{ resolution: string; resolvedData?: any }> {
    switch (strategy) {
      case ConflictResolutionStrategy.LOCAL_WINS:
        return {
          resolution: 'local_wins',
          resolvedData: conflict.localValue,
        };

      case ConflictResolutionStrategy.REMOTE_WINS:
        return {
          resolution: 'remote_wins',
          resolvedData: conflict.remoteValue,
        };

      case ConflictResolutionStrategy.MERGE:
        return {
          resolution: 'merge',
          resolvedData: this.mergeData(conflict.localValue, conflict.remoteValue),
        };

      case ConflictResolutionStrategy.MANUAL:
      default:
        return {
          resolution: 'manual_required',
        };
    }
  }

  /**
   * Merge local and remote data
   */
  private mergeData(localData: any, remoteData: any): any {
    // Simple merge strategy - remote data takes precedence for most fields
    // but preserve local-only fields
    const merged = { ...remoteData };
    
    // Preserve local fields that don't exist in remote
    for (const [key, value] of Object.entries(localData)) {
      if (!(key in remoteData) && key !== 'id' && key !== 'updatedAt') {
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Get local data for comparison
   */
  private async getLocalData(
    tenantId: string,
    entityType: string,
    lastSyncTimestamp?: Date
  ): Promise<any[]> {
    // This would typically query the appropriate repository based on entity type
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Create local record
   */
  private async createLocalRecord(
    tenantId: string,
    entityType: string,
    data: any
  ): Promise<void> {
    // Implementation would depend on entity type
    this.logger.debug(`Creating local record for ${entityType}:`, data.id);
  }

  /**
   * Update local record
   */
  private async updateLocalRecord(
    tenantId: string,
    entityType: string,
    localId: string,
    data: any
  ): Promise<void> {
    // Implementation would depend on entity type
    this.logger.debug(`Updating local record for ${entityType}:`, localId);
  }

  /**
   * Delete local record
   */
  private async deleteLocalRecord(
    tenantId: string,
    entityType: string,
    localId: string
  ): Promise<void> {
    // Implementation would depend on entity type
    this.logger.debug(`Deleting local record for ${entityType}:`, localId);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors, rate limits, and temporary service unavailability are retryable
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /rate limit/i,
      /service unavailable/i,
      /502/,
      /503/,
      /504/,
    ];

    return retryablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.code)
    );
  }

  /**
   * Get synchronization statistics for an integration
   */
  async getStatistics(integrationId: string): Promise<any> {
    const stats = await this.syncLogRepository.getStatistics(integrationId);
    
    return {
      totalSyncs: stats.totalSyncs || 0,
      successfulSyncs: stats.successfulSyncs || 0,
      failedSyncs: stats.failedSyncs || 0,
      lastSyncAt: stats.lastSyncAt,
      averageDuration: stats.averageDuration || 0,
      totalRecordsProcessed: stats.totalRecordsProcessed || 0,
      totalConflicts: stats.totalConflicts || 0,
      syncFrequency: stats.syncFrequency || 0,
    };
  }

  /**
   * Get sync history for an integration
   */
  async getSyncHistory(
    integrationId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<SyncLog[]> {
    return this.syncLogRepository.findByIntegration(integrationId, tenantId, limit);
  }

  /**
   * Get sync details by ID
   */
  async getSyncDetails(syncId: string, tenantId: string): Promise<SyncLog> {
    const syncLog = await this.syncLogRepository.findById(syncId, tenantId);
    if (!syncLog) {
      throw new NotFoundException(`Sync log not found: ${syncId}`);
    }
    return syncLog;
  }

  /**
   * Retry failed sync
   */
  async retrySync(syncId: string, tenantId: string): Promise<string> {
    const originalSync = await this.getSyncDetails(syncId, tenantId);
    
    if (originalSync.status !== SyncStatus.FAILED) {
      throw new BadRequestException('Only failed syncs can be retried');
    }

    // Trigger new sync with same options
    return this.triggerSync(originalSync.integrationId, {
      type: originalSync.type,
      triggeredBy: 'manual',
      tenantId,
      ...originalSync.options,
    });
  }

  /**
   * Cleanup old sync logs
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldSyncLogs(): Promise<void> {
    this.logger.log('Cleaning up old sync logs');
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days of logs
      
      const deletedCount = await this.syncLogRepository.deleteOlderThan(cutoffDate);
      
      this.logger.log(`Cleaned up ${deletedCount} old sync logs`);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to cleanup old sync logs:', err);
    }
  }

  /**
   * Monitor sync health and send alerts
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async monitorSyncHealth(): Promise<void> {
    this.logger.debug('Monitoring sync health');

    try {
      // Find integrations with recent sync failures
      const failedSyncs = await this.syncLogRepository.findRecentFailures(
        new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
      );

      for (const sync of failedSyncs) {
        // Check if this integration has multiple recent failures
        const recentFailures = await this.syncLogRepository.countRecentFailures(
          sync.integrationId,
          new Date(Date.now() - 60 * 60 * 1000) // Last hour
        );

        if (recentFailures >= 3) {
          // Emit alert for multiple failures
          this.eventEmitter.emit('sync.health_alert', {
            integrationId: sync.integrationId,
            tenantId: sync.tenantId,
            alertType: 'multiple_failures',
            failureCount: recentFailures,
            lastError: sync.errors?.[0]?.error,
          });
        }
      }

      // Find integrations that haven't synced in a while
      const staleSyncs = await this.syncLogRepository.findStaleIntegrations(
        new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours
      );

      for (const integration of staleSyncs) {
        this.eventEmitter.emit('sync.health_alert', {
          integrationId: integration.id,
          tenantId: integration.tenantId,
          alertType: 'stale_sync',
          lastSyncAt: integration.lastSyncAt,
        });
      }

    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to monitor sync health:', err);
    }
  }

  /**
   * Get sync conflicts for a specific sync
   */
  async getSyncConflicts(syncId: string): Promise<any[]> {
    return this.syncLogRepository.findConflictsBySyncId(syncId);
  }

  /**
   * Resolve a sync conflict
   */
  async resolveSyncConflict(
    conflictId: string,
    resolutionStrategy: any,
    resolvedData?: string,
  ): Promise<any> {
    this.logger.log(`Resolving sync conflict: ${conflictId} with strategy: ${resolutionStrategy}`);
    
    // Implementation would resolve the conflict based on strategy
    const conflict = {
      id: conflictId,
      syncId: 'sync_123',
      entityType: 'customer',
      entityId: 'customer_456',
      localData: '{}',
      remoteData: '{}',
      resolutionStrategy,
      resolvedData: resolvedData || '{}',
      isResolved: true,
      createdAt: new Date(),
      resolvedAt: new Date(),
    };

    // Emit conflict resolved event
    this.eventEmitter.emit('sync.conflict_resolved', {
      conflictId,
      resolutionStrategy,
      resolvedData,
    });

    return conflict;
  }

  /**
   * Cancel a running sync
   */
  async cancelSync(syncId: string): Promise<boolean> {
    this.logger.log(`Cancelling sync: ${syncId}`);
    
    // Implementation would cancel the sync job
    await this.syncLogRepository.updateStatus(syncId, 'cancelled' as any);
    
    // Emit sync cancelled event
    this.eventEmitter.emit('sync.cancelled', { syncId });
    
    return true;
  }
}