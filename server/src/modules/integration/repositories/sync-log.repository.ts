import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { SyncLog, SyncStatus, SyncStatistics } from '../entities/sync-log.entity';
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
   * Map database result to entity
   */
  private mapToEntity(dbResult: any): SyncLog {
    return {
      id: dbResult.id,
      integrationId: dbResult.integrationId,
      tenantId: dbResult.tenantId,
      type: dbResult.syncType,
      status: dbResult.status,
      triggeredBy: dbResult.triggeredBy,
      startedAt: dbResult.startedAt,
      completedAt: dbResult.completedAt,
      duration: dbResult.duration,
      recordsProcessed: dbResult.recordsProcessed || 0,
      recordsCreated: dbResult.recordsSucceeded || 0,
      recordsUpdated: 0, // Not tracked separately in DB
      recordsDeleted: dbResult.recordsFailed || 0,
      recordsSkipped: dbResult.recordsSkipped || 0,
      options: dbResult.summary || {},
      conflicts: dbResult.summary?.conflicts || [],
      errors: dbResult.errors || [],
      metadata: dbResult.triggerData || {},
      createdAt: dbResult.createdAt,
      updatedAt: dbResult.updatedAt,
    };
  }

  /**
   * Create a new sync log entry
   */
  async create(data: Partial<SyncLog>): Promise<SyncLog> {
    this.logger.debug(`Creating sync log for integration: ${data.integrationId}`);

    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const [syncLog] = await db
      .insert(syncLogs)
      .values({
        integrationId: data.integrationId!,
        tenantId: data.tenantId!,
        syncType: data.type!,
        direction: 'bidirectional', // Default direction
        status: data.status!,
        triggeredBy: data.triggeredBy!,
        startedAt: data.startedAt!,
        summary: data.options || {},
        errors: data.errors || [],
        warnings: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    // Invalidate cache
    await this.invalidateCache(data.integrationId!, data.tenantId!);

    // Map database result to entity
    return this.mapToEntity(syncLog);
  }

  /**
   * Update sync log entry
   */
  async update(syncId: string, data: Partial<SyncLog>): Promise<SyncLog> {
    this.logger.debug(`Updating sync log: ${syncId}`);

    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    // Map entity fields to database columns
    if (data.status !== undefined) updateData.status = data.status;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.recordsProcessed !== undefined) updateData.recordsProcessed = data.recordsProcessed;
    if (data.recordsCreated !== undefined) updateData.recordsSucceeded = data.recordsCreated;
    if (data.recordsUpdated !== undefined) updateData.recordsSucceeded = (updateData.recordsSucceeded || 0) + data.recordsUpdated;
    if (data.recordsSkipped !== undefined) updateData.recordsSkipped = data.recordsSkipped;
    if (data.errors !== undefined) updateData.errors = data.errors;
    if (data.conflicts !== undefined) updateData.summary = { ...updateData.summary, conflicts: data.conflicts };

    const [updated] = await db
      .update(syncLogs)
      .set(updateData)
      .where(eq(syncLogs.id, syncId))
      .returning();

    if (!updated) {
      throw new Error(`Sync log not found: ${syncId}`);
    }

    const syncLog = this.mapToEntity(updated);

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

    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const [result] = await db
      .select()
      .from(syncLogs)
      .where(and(
        eq(syncLogs.id, syncId),
        eq(syncLogs.tenantId, tenantId)
      ))
      .limit(1);

    if (!result) {
      return null;
    }

    syncLog = this.mapToEntity(result);

    if (syncLog) {
      await this.cacheService.set(cacheKey, syncLog, { ttl: 300 }); // 5 minutes
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
    
    let cachedLogs = await this.cacheService.get<SyncLog[]>(cacheKey);
    if (cachedLogs) {
      return cachedLogs;
    }

    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const results = await db
      .select()
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.tenantId, tenantId)
      ))
      .orderBy(desc(syncLogs.startedAt))
      .limit(limit);

    const mappedLogs = results.map(r => this.mapToEntity(r));

    await this.cacheService.set(cacheKey, mappedLogs, { ttl: 300 }); // 5 minutes

    return mappedLogs;
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

    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const [result] = await db
      .select()
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.tenantId, tenantId),
        eq(syncLogs.status, SyncStatus.COMPLETED)
      ))
      .orderBy(desc(syncLogs.completedAt))
      .limit(1);

    if (!result) {
      return null;
    }

    syncLog = this.mapToEntity(result);

    if (syncLog) {
      await this.cacheService.set(cacheKey, syncLog, { ttl: 600 }); // 10 minutes
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

    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Get basic counts
    const [totalSyncsResult] = await db
      .select({ count: count() })
      .from(syncLogs)
      .where(eq(syncLogs.integrationId, integrationId));

    const [successfulSyncsResult] = await db
      .select({ count: count() })
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.status, SyncStatus.COMPLETED)
      ));

    const [failedSyncsResult] = await db
      .select({ count: count() })
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.status, SyncStatus.FAILED)
      ));

    // Get last sync timestamp
    const [lastSyncResult] = await db
      .select({ lastSyncAt: max(syncLogs.startedAt) })
      .from(syncLogs)
      .where(eq(syncLogs.integrationId, integrationId));

    // Get average duration
    const [avgDurationResult] = await db
      .select({ avgDuration: avg(syncLogs.duration) })
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.status, SyncStatus.COMPLETED)
      ));

    // Get total records processed
    const [totalRecordsResult] = await db
      .select({ totalRecords: sum(syncLogs.recordsProcessed) })
      .from(syncLogs)
      .where(eq(syncLogs.integrationId, integrationId));

    stats = {
      totalSyncs: totalSyncsResult?.count || 0,
      successfulSyncs: successfulSyncsResult?.count || 0,
      failedSyncs: failedSyncsResult?.count || 0,
      lastSyncAt: lastSyncResult?.lastSyncAt || null,
      averageDuration: Number(avgDurationResult?.avgDuration) || 0,
      totalRecordsProcessed: Number(totalRecordsResult?.totalRecords) || 0,
      totalConflicts: 0, // Would need to calculate from conflicts array
      syncFrequency: 0, // Would need to calculate based on time intervals
    };

    await this.cacheService.set(cacheKey, stats, { ttl: 600 }); // 10 minutes

    return stats;
  }

  /**
   * Find recent sync failures
   */
  async findRecentFailures(since: Date): Promise<SyncLog[]> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const results = await db
      .select()
      .from(syncLogs)
      .where(and(
        eq(syncLogs.status, SyncStatus.FAILED),
        gte(syncLogs.startedAt, since)
      ))
      .orderBy(desc(syncLogs.startedAt));

    return results.map(r => this.mapToEntity(r));
  }

  /**
   * Count recent failures for an integration
   */
  async countRecentFailures(integrationId: string, since: Date): Promise<number> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const [result] = await db
      .select({ count: count() })
      .from(syncLogs)
      .where(and(
        eq(syncLogs.integrationId, integrationId),
        eq(syncLogs.status, SyncStatus.FAILED),
        gte(syncLogs.startedAt, since)
      ));

    return result?.count || 0;
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
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const result = await db
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