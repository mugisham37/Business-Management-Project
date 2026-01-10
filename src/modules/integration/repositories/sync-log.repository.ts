import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { SyncLog, SyncStatus, SyncType, SyncStatistics } from '../entities/sync-log.entity';
import { syncLogs } from '../../database/schema/integration.schema';
import { eq, and, desc, gte, lte, count, avg, sum, max } from 'drizzle-orm';

@Injectable()
export class SyncLogRepository {
  private readonly logger = new Logger(SyncLogRepository.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  /**
   * Create a new sync log entry
   */
  async create(data: Partial<SyncLog>): Promise<SyncLog> {
    this.logger.debug(`Creating sync log for integration: ${data.integrationId}`);

    const syncLog = await this.drizzle.db
      .insert(syncLogs)
      .values({
        id: crypto.randomUUID(),
        integrationId: data.integrationId!,
        tenantId: data.tenantId!,
        type: data.type!,
        status: data.status!,
        triggeredBy: data.triggeredBy!,
        startedAt: data.startedAt!,
        options: data.options || {},
        metadata: data.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Invalidate cache
    await this.invalidateCache(data.integrationId!, data.tenantId!);

    return syncLog[0] as SyncLog;
  }

  /**
   * Update sync log entry
   */
  async update(syncId: string, data: Partial<SyncLog>): Promise<SyncLog> {
    this.logger.debug(`Updating sync log: ${syncId}`);

    const updated = await this.drizzle.db
      .update(syncLogs)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(syncLogs.id, syncId))
      .returning();

    if (updated.length === 0) {
      throw new Error(`Sync log not found: ${syncId}`);
    }

    const syncLog = updated[0] as SyncLog;

    // Invalidate cache
    await this.invalidateCache(syncLog.integrationId, syncLog.tenantId);

    return syncLog;
  }

  /**
   * Find sync log by ID
   */
  async findById(syncId: string, tenantId: string): Promise<SyncLog | null> {
    const cacheKey = `sync-log:${syncId}:${tenantId}`;
    
    let syncLog = await this.cacheService.get<SyncLog>(cacheKey);
    if (syncLog) {
      return syncLog;
    }

    const result = await this.drizzle.db
      .select()
      .from(syncLogs)
      .where(and(
        eq(syncLogs.id, syncId),
        eq(syncLogs.tenantId, tenantId)
      ))
      .limit(1);

    syncLog = result[0] as SyncLog || null;

    if (syncLog) {
      await this.cacheService.set(cacheKey, syncLog, 300); // 5 minutes
    }

    return syncLog;
  }

  /**
   * Find sync logs by integration
   */
  async findByIntegration(
    integrationId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<SyncLog[]> {
    const cacheKey = `sync-logs:${integrationId}:${tenantId}:${limit}`;
    
    let syncLogs = await this.cacheService.get<SyncLog[]>(cacheKey);
    if (syncLogs) {
      return syncLogs;
    }

    const result = await this.drizzle.db
      .select()
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.tenantId, tenantId)
      ))
      .orderBy(desc(syncLogs.startedAt))
      .limit(limit);

    syncLogs = result as SyncLog[];

    await this.cacheService.set(cacheKey, syncLogs, 300); // 5 minutes

    return syncLogs;
  }

  /**
   * Find last successful sync for an integration
   */
  async findLastSuccessful(
    integrationId: string,
    tenantId: string
  ): Promise<SyncLog | null> {
    const cacheKey = `last-successful-sync:${integrationId}:${tenantId}`;
    
    let syncLog = await this.cacheService.get<SyncLog>(cacheKey);
    if (syncLog) {
      return syncLog;
    }

    const result = await this.drizzle.db
      .select()
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.tenantId, tenantId),
        eq(syncLogs.status, SyncStatus.COMPLETED)
      ))
      .orderBy(desc(syncLogs.completedAt))
      .limit(1);

    syncLog = result[0] as SyncLog || null;

    if (syncLog) {
      await this.cacheService.set(cacheKey, syncLog, 600); // 10 minutes
    }

    return syncLog;
  }

  /**
   * Get sync statistics for an integration
   */
  async getStatistics(integrationId: string): Promise<SyncStatistics> {
    const cacheKey = `sync-stats:${integrationId}`;
    
    let stats = await this.cacheService.get<SyncStatistics>(cacheKey);
    if (stats) {
      return stats;
    }

    // Get basic counts
    const totalSyncsResult = await this.drizzle.db
      .select({ count: count() })
      .from(syncLogs)
      .where(eq(syncLogs.integrationId, integrationId));

    const successfulSyncsResult = await this.drizzle.db
      .select({ count: count() })
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.status, SyncStatus.COMPLETED)
      ));

    const failedSyncsResult = await this.drizzle.db
      .select({ count: count() })
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.status, SyncStatus.FAILED)
      ));

    // Get last sync timestamp
    const lastSyncResult = await this.drizzle.db
      .select({ lastSyncAt: max(syncLogs.startedAt) })
      .from(syncLogs)
      .where(eq(syncLogs.integrationId, integrationId));

    // Get average duration
    const avgDurationResult = await this.drizzle.db
      .select({ avgDuration: avg(syncLogs.duration) })
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.status, SyncStatus.COMPLETED)
      ));

    // Get total records processed
    const totalRecordsResult = await this.drizzle.db
      .select({ totalRecords: sum(syncLogs.recordsProcessed) })
      .from(syncLogs)
      .where(eq(syncLogs.integrationId, integrationId));

    stats = {
      totalSyncs: totalSyncsResult[0]?.count || 0,
      successfulSyncs: successfulSyncsResult[0]?.count || 0,
      failedSyncs: failedSyncsResult[0]?.count || 0,
      lastSyncAt: lastSyncResult[0]?.lastSyncAt || undefined,
      averageDuration: Number(avgDurationResult[0]?.avgDuration) || 0,
      totalRecordsProcessed: Number(totalRecordsResult[0]?.totalRecords) || 0,
      totalConflicts: 0, // Would need to calculate from conflicts array
      syncFrequency: 0, // Would need to calculate based on time intervals
    };

    await this.cacheService.set(cacheKey, stats, 600); // 10 minutes

    return stats;
  }

  /**
   * Find recent sync failures
   */
  async findRecentFailures(since: Date): Promise<SyncLog[]> {
    const result = await this.drizzle.db
      .select()
      .from(syncLogs)
      .where(and(
        eq(syncLogs.status, SyncStatus.FAILED),
        gte(syncLogs.startedAt, since)
      ))
      .orderBy(desc(syncLogs.startedAt));

    return result as SyncLog[];
  }

  /**
   * Count recent failures for an integration
   */
  async countRecentFailures(integrationId: string, since: Date): Promise<number> {
    const result = await this.drizzle.db
      .select({ count: count() })
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.status, SyncStatus.FAILED),
        gte(syncLogs.startedAt, since)
      ));

    return result[0]?.count || 0;
  }

  /**
   * Find integrations that haven't synced recently
   */
  async findStaleIntegrations(since: Date): Promise<Array<{ id: string; tenantId: string; lastSyncAt?: Date }>> {
    // This would typically join with integrations table
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Delete old sync logs
   */
  async deleteOlderThan(cutoffDate: Date): Promise<number> {
    const result = await this.drizzle.db
      .delete(syncLogs)
      .where(lte(syncLogs.createdAt, cutoffDate));

    // Clear all cache entries for sync logs
    await this.cacheService.invalidatePattern('sync-*');

    return result.rowCount || 0;
  }

  /**
   * Invalidate cache for integration
   */
  private async invalidateCache(integrationId: string, tenantId: string): Promise<void> {
    await Promise.all([
      this.cacheService.invalidatePattern(`sync-logs:${integrationId}:${tenantId}:*`),
      this.cacheService.invalidatePattern(`last-successful-sync:${integrationId}:${tenantId}`),
      this.cacheService.invalidatePattern(`sync-stats:${integrationId}`),
    ]);
  }
}