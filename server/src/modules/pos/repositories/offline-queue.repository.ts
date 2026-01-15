import { Injectable, Inject } from '@nestjs/common';
import { eq, and, asc, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { offlineTransactionQueue } from '../../database/schema/transaction.schema';
import { OfflineTransactionQueue } from '../entities/transaction.entity';

@Injectable()
export class OfflineQueueRepository {
  constructor(
    @Inject(DrizzleService)
    private readonly drizzle: DrizzleService,
  ) {}

  async create(
    tenantId: string,
    queueData: {
      queueId: string;
      deviceId: string;
      transactionData: Record<string, any>;
      operationType: string;
      priority?: number;
    },
    userId: string,
  ): Promise<OfflineTransactionQueue> {
    const db = this.drizzle.getDb();
    
    // Get next sequence number for this tenant
    const sequenceNumber = await this.getNextSequenceNumber(tenantId);
    
    const [queueItem] = await db
      .insert(offlineTransactionQueue)
      .values({
        tenantId,
        queueId: queueData.queueId,
        deviceId: queueData.deviceId,
        transactionData: queueData.transactionData,
        operationType: queueData.operationType,
        isSynced: false,
        syncAttempts: 0,
        syncErrors: [],
        priority: queueData.priority || 1,
        sequenceNumber,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return this.mapToEntity(queueItem);
  }

  async findPendingSync(tenantId: string, limit: number = 100): Promise<OfflineTransactionQueue[]> {
    const db = this.drizzle.getDb();
    
    const items = await db
      .select()
      .from(offlineTransactionQueue)
      .where(and(
        eq(offlineTransactionQueue.tenantId, tenantId),
        eq(offlineTransactionQueue.isSynced, false),
        eq(offlineTransactionQueue.isActive, true)
      ))
      .orderBy(
        asc(offlineTransactionQueue.priority),
        asc(offlineTransactionQueue.sequenceNumber)
      )
      .limit(limit);

    return items.map(this.mapToEntity);
  }

  async markAsSynced(
    tenantId: string,
    queueId: string,
    userId: string,
  ): Promise<OfflineTransactionQueue | null> {
    const db = this.drizzle.getDb();
    
    const [updated] = await db
      .update(offlineTransactionQueue)
      .set({
        isSynced: true,
        syncedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(offlineTransactionQueue.tenantId, tenantId),
        eq(offlineTransactionQueue.queueId, queueId),
        eq(offlineTransactionQueue.isActive, true)
      ))
      .returning();

    return updated ? this.mapToEntity(updated) : null;
  }

  async incrementSyncAttempts(
    tenantId: string,
    queueId: string,
    error: any,
    userId: string,
  ): Promise<OfflineTransactionQueue | null> {
    const db = this.drizzle.getDb();
    
    // First get the current item to increment attempts
    const [current] = await db
      .select()
      .from(offlineTransactionQueue)
      .where(and(
        eq(offlineTransactionQueue.tenantId, tenantId),
        eq(offlineTransactionQueue.queueId, queueId),
        eq(offlineTransactionQueue.isActive, true)
      ));

    if (!current) return null;

    const newAttempts = current.syncAttempts + 1;
    const currentErrors = Array.isArray(current.syncErrors) ? current.syncErrors : [];
    const newErrors = [...currentErrors, {
      timestamp: new Date(),
      error: error.message || error,
      attempt: newAttempts,
    }];

    const [updated] = await db
      .update(offlineTransactionQueue)
      .set({
        syncAttempts: newAttempts,
        lastSyncAttempt: new Date(),
        syncErrors: newErrors,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(offlineTransactionQueue.tenantId, tenantId),
        eq(offlineTransactionQueue.queueId, queueId),
        eq(offlineTransactionQueue.isActive, true)
      ))
      .returning();

    return updated ? this.mapToEntity(updated) : null;
  }

  async findByQueueId(tenantId: string, queueId: string): Promise<OfflineTransactionQueue | null> {
    const db = this.drizzle.getDb();
    
    const [item] = await db
      .select()
      .from(offlineTransactionQueue)
      .where(and(
        eq(offlineTransactionQueue.tenantId, tenantId),
        eq(offlineTransactionQueue.queueId, queueId),
        eq(offlineTransactionQueue.isActive, true)
      ));

    return item ? this.mapToEntity(item) : null;
  }

  async findByDeviceId(tenantId: string, deviceId: string): Promise<OfflineTransactionQueue[]> {
    const db = this.drizzle.getDb();
    
    const items = await db
      .select()
      .from(offlineTransactionQueue)
      .where(and(
        eq(offlineTransactionQueue.tenantId, tenantId),
        eq(offlineTransactionQueue.deviceId, deviceId),
        eq(offlineTransactionQueue.isActive, true)
      ))
      .orderBy(asc(offlineTransactionQueue.sequenceNumber));

    return items.map(this.mapToEntity);
  }

  private async getNextSequenceNumber(tenantId: string): Promise<number> {
    const db = this.drizzle.getDb();
    
    const result = await db
      .select({
        maxSequence: sql<number>`COALESCE(MAX(${offlineTransactionQueue.sequenceNumber}), 0)`,
      })
      .from(offlineTransactionQueue)
      .where(eq(offlineTransactionQueue.tenantId, tenantId));

    const maxSequence = result[0]?.maxSequence;
    return (typeof maxSequence === 'number' ? maxSequence : 0) + 1;
  }

  private mapToEntity(row: any): OfflineTransactionQueue {
    return {
      id: row.id,
      tenantId: row.tenantId,
      queueId: row.queueId,
      deviceId: row.deviceId,
      transactionData: row.transactionData,
      operationType: row.operationType,
      isSynced: row.isSynced,
      syncAttempts: row.syncAttempts,
      lastSyncAttempt: row.lastSyncAttempt,
      syncedAt: row.syncedAt,
      syncErrors: row.syncErrors,
      priority: row.priority,
      sequenceNumber: row.sequenceNumber,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      deletedAt: row.deletedAt,
      version: row.version,
      isActive: row.isActive,
    };
  }
}