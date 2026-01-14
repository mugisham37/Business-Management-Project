import { Injectable, Logger } from '@nestjs/common';
import { eq, and, desc, count, sql } from 'drizzle-orm';

import { DrizzleService } from '../../database/drizzle.service';
import { integrations } from '../../database/schema/integration.schema';

import { Integration, IntegrationStatus, IntegrationType } from '../entities/integration.entity';
import { IntegrationListDto } from '../dto/integration.dto';

@Injectable()
export class IntegrationRepository {
  private readonly logger = new Logger(IntegrationRepository.name);

  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Create a new integration
   */
  async create(data: Partial<Integration>): Promise<Integration> {
    this.logger.log(`Creating integration: ${data.name}`);

    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const [integration] = await db
      .insert(integrations)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    return integration as Integration;
  }

  /**
   * Find integration by ID and tenant
   */
  async findById(tenantId: string, integrationId: string): Promise<Integration | null> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.id, integrationId),
          eq(integrations.tenantId, tenantId),
          sql`${integrations.deletedAt} IS NULL`
        )
      )
      .limit(1);

    return integration as Integration || null;
  }

  /**
   * Find all integrations for a tenant with optional filters
   */
  async findAll(tenantId: string, filters?: IntegrationListDto): Promise<Integration[]> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Build where conditions
    const conditions = [
      eq(integrations.tenantId, tenantId),
      sql`${integrations.deletedAt} IS NULL`
    ];

    // Apply filters
    if (filters?.type) {
      conditions.push(eq(integrations.type, filters.type));
    }

    if (filters?.status) {
      conditions.push(eq(integrations.status, filters.status));
    }

    if (filters?.providerName) {
      conditions.push(eq(integrations.providerName, filters.providerName));
    }

    if (filters?.syncEnabled !== undefined) {
      conditions.push(eq(integrations.syncEnabled, filters.syncEnabled));
    }

    // Build query
    let query = db
      .select()
      .from(integrations)
      .where(and(...conditions))
      .orderBy(desc(integrations.createdAt));

    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    const results = await query;
    return results as Integration[];
  }

  /**
   * Find integrations by status (across all tenants)
   */
  async findByStatus(status: IntegrationStatus): Promise<Integration[]> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const results = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.status, status),
          sql`${integrations.deletedAt} IS NULL`
        )
      );

    return results as Integration[];
  }

  /**
   * Find integrations by type for a tenant
   */
  async findByType(tenantId: string, type: IntegrationType): Promise<Integration[]> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const results = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.type, type),
          sql`${integrations.deletedAt} IS NULL`
        )
      );

    return results as Integration[];
  }

  /**
   * Update integration
   */
  async update(integrationId: string, data: Partial<Integration>): Promise<Integration> {
    this.logger.log(`Updating integration: ${integrationId}`);

    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const [integration] = await db
      .update(integrations)
      .set({
        ...data,
        updatedAt: new Date(),
        version: sql`${integrations.version} + 1`,
      } as any)
      .where(eq(integrations.id, integrationId))
      .returning();

    return integration as Integration;
  }

  /**
   * Soft delete integration
   */
  async softDelete(integrationId: string, userId: string): Promise<void> {
    this.logger.log(`Soft deleting integration: ${integrationId}`);

    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    await db
      .update(integrations)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  }

  /**
   * Hard delete integration (permanent)
   */
  async hardDelete(integrationId: string): Promise<void> {
    this.logger.log(`Hard deleting integration: ${integrationId}`);

    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    await db
      .delete(integrations)
      .where(eq(integrations.id, integrationId));
  }

  /**
   * Count integrations for a tenant
   */
  async count(tenantId: string, filters?: Partial<IntegrationListDto>): Promise<number> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Build where conditions
    const conditions = [
      eq(integrations.tenantId, tenantId),
      sql`${integrations.deletedAt} IS NULL`
    ];

    // Apply filters
    if (filters?.type) {
      conditions.push(eq(integrations.type, filters.type));
    }

    if (filters?.status) {
      conditions.push(eq(integrations.status, filters.status));
    }

    if (filters?.providerName) {
      conditions.push(eq(integrations.providerName, filters.providerName));
    }

    const [result] = await db
      .select({ count: count() })
      .from(integrations)
      .where(and(...conditions));

    return result?.count || 0;
  }

  /**
   * Find integrations that need health checks
   */
  async findForHealthCheck(maxAge: number = 300000): Promise<Integration[]> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const cutoffTime = new Date(Date.now() - maxAge); // 5 minutes ago by default

    const results = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.status, IntegrationStatus.ACTIVE),
          sql`${integrations.deletedAt} IS NULL`,
          sql`(${integrations.lastHealthCheck} IS NULL OR ${integrations.lastHealthCheck} < ${cutoffTime})`
        )
      );

    return results as Integration[];
  }

  /**
   * Find integrations that need synchronization
   */
  async findForSync(): Promise<Integration[]> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const now = new Date();

    const results = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.status, IntegrationStatus.ACTIVE),
          eq(integrations.syncEnabled, true),
          sql`${integrations.deletedAt} IS NULL`,
          sql`(${integrations.nextSyncAt} IS NULL OR ${integrations.nextSyncAt} <= ${now})`
        )
      );

    return results as Integration[];
  }

  /**
   * Update health status
   */
  async updateHealthStatus(
    integrationId: string,
    healthData: {
      isHealthy: boolean;
      lastChecked: Date;
      details?: string;
      error?: string;
    }
  ): Promise<void> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    await db
      .update(integrations)
      .set({
        lastHealthCheck: healthData.lastChecked,
        healthStatus: healthData.isHealthy ? 'healthy' : 'unhealthy',
        lastError: healthData.error,
        lastErrorAt: healthData.error ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  }

  /**
   * Update request statistics
   */
  async updateRequestStats(
    integrationId: string,
    success: boolean = true
  ): Promise<void> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const updates: any = {
      requestCount: sql`${integrations.requestCount} + 1`,
      lastRequestAt: new Date(),
      updatedAt: new Date(),
    };

    if (!success) {
      updates.errorCount = sql`${integrations.errorCount} + 1`;
    }

    await db
      .update(integrations)
      .set(updates)
      .where(eq(integrations.id, integrationId));
  }

  /**
   * Update sync timestamps
   */
  async updateSyncTimestamps(
    integrationId: string,
    lastSyncAt: Date,
    nextSyncAt?: Date
  ): Promise<void> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    await db
      .update(integrations)
      .set({
        lastSyncAt,
        nextSyncAt,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  }

  /**
   * Get integration statistics for a tenant
   */
  async getStatistics(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    error: number;
    byType: Record<string, number>;
  }> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const results = await db
      .select({
        status: integrations.status,
        type: integrations.type,
        count: count(),
      })
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          sql`${integrations.deletedAt} IS NULL`
        )
      )
      .groupBy(integrations.status, integrations.type);

    const stats = {
      total: 0,
      active: 0,
      inactive: 0,
      error: 0,
      byType: {} as Record<string, number>,
    };

    for (const result of results) {
      stats.total += result.count;
      
      if (result.status === IntegrationStatus.ACTIVE) {
        stats.active += result.count;
      } else if (result.status === IntegrationStatus.INACTIVE) {
        stats.inactive += result.count;
      } else if (result.status === IntegrationStatus.ERROR) {
        stats.error += result.count;
      }

      stats.byType[result.type] = (stats.byType[result.type] || 0) + result.count;
    }

    return stats;
  }

  /**
   * Find integrations with errors
   */
  async findWithErrors(tenantId: string, limit: number = 10): Promise<Integration[]> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    const results = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          sql`${integrations.deletedAt} IS NULL`,
          sql`${integrations.errorCount} > 0`
        )
      )
      .orderBy(desc(integrations.lastErrorAt))
      .limit(limit);

    return results as Integration[];
  }

  /**
   * Reset error count for integration
   */
  async resetErrorCount(integrationId: string): Promise<void> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    await db
      .update(integrations)
      .set({
        errorCount: 0,
        lastError: null,
        lastErrorAt: null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  }
}