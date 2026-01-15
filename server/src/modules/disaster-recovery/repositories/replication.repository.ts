import { Injectable, Logger } from '@nestjs/common';
import { eq, and, desc, count, sql, gte } from 'drizzle-orm';

import { DatabaseService } from '../../database/database.service';
import {
  replicationConfigurations,
  replicationStatusTable,
  InsertReplicationConfiguration,
  InsertReplicationStatus,
  ReplicationConfiguration,
} from '../entities/disaster-recovery.entity';

@Injectable()
export class ReplicationRepository {
  private readonly logger = new Logger(ReplicationRepository.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create replication configuration
   */
  async createConfiguration(data: InsertReplicationConfiguration): Promise<ReplicationConfiguration> {
    this.logger.log(`Creating replication configuration from ${data.sourceRegion} to ${data.targetRegion}`);

    const db = this.databaseService.getDatabase();
    
    const [config] = await db
      .insert(replicationConfigurations)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return config as ReplicationConfiguration;
  }

  /**
   * Find replication configuration by ID
   */
  async findConfigurationById(configId: string): Promise<ReplicationConfiguration | null> {
    const db = this.databaseService.getDatabase();
    
    const [config] = await db
      .select()
      .from(replicationConfigurations)
      .where(eq(replicationConfigurations.id, configId))
      .limit(1);

    return (config as ReplicationConfiguration) || null;
  }

  /**
   * Find replication configurations by tenant
   */
  async findConfigurationsByTenant(tenantId: string): Promise<ReplicationConfiguration[]> {
    const db = this.databaseService.getDatabase();
    
    const configs = await db
      .select()
      .from(replicationConfigurations)
      .where(eq(replicationConfigurations.tenantId, tenantId))
      .orderBy(desc(replicationConfigurations.createdAt));

    return configs as ReplicationConfiguration[];
  }

  /**
   * Find replication configuration by regions
   */
  async findConfigurationByRegions(
    tenantId: string,
    sourceRegion: string,
    targetRegion: string
  ): Promise<ReplicationConfiguration | null> {
    const db = this.databaseService.getDatabase();
    
    const [config] = await db
      .select()
      .from(replicationConfigurations)
      .where(
        and(
          eq(replicationConfigurations.tenantId, tenantId),
          eq(replicationConfigurations.sourceRegion, sourceRegion),
          eq(replicationConfigurations.targetRegion, targetRegion)
        )
      )
      .limit(1);

    return (config as ReplicationConfiguration) || null;
  }

  /**
   * Update replication configuration
   */
  async updateConfiguration(
    configId: string,
    updates: Partial<InsertReplicationConfiguration>
  ): Promise<ReplicationConfiguration> {
    this.logger.log(`Updating replication configuration ${configId}`);

    const db = this.databaseService.getDatabase();
    
    const [config] = await db
      .update(replicationConfigurations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(replicationConfigurations.id, configId))
      .returning();

    return config as ReplicationConfiguration;
  }

  /**
   * Delete replication configuration
   */
  async deleteConfiguration(configId: string): Promise<void> {
    this.logger.log(`Deleting replication configuration ${configId}`);

    const db = this.databaseService.getDatabase();
    
    // Delete associated status records first
    await db
      .delete(replicationStatusTable)
      .where(eq(replicationStatusTable.configurationId, configId));

    // Delete the configuration
    await db
      .delete(replicationConfigurations)
      .where(eq(replicationConfigurations.id, configId));
  }

  /**
   * Create replication status record
   */
  async createStatusRecord(data: InsertReplicationStatus): Promise<any> {
    const db = this.databaseService.getDatabase();
    
    const [status] = await db
      .insert(replicationStatusTable)
      .values({
        ...data,
        createdAt: new Date(),
      })
      .returning();

    return status;
  }

  /**
   * Find latest replication status by configuration
   */
  async findLatestStatusByConfiguration(configId: string): Promise<any | null> {
    const db = this.databaseService.getDatabase();
    
    const [status] = await db
      .select()
      .from(replicationStatusTable)
      .where(eq(replicationStatusTable.configurationId, configId))
      .orderBy(desc(replicationStatusTable.createdAt))
      .limit(1);

    return status || null;
  }

  /**
   * Find replication status by tenant
   */
  async findStatusByTenant(tenantId: string): Promise<{
    configuration: ReplicationConfiguration;
    latestStatus: any | null;
  }[]> {
    const db = this.databaseService.getDatabase();
    
    const configurations = await db
      .select()
      .from(replicationConfigurations)
      .where(eq(replicationConfigurations.tenantId, tenantId))
      .orderBy(desc(replicationConfigurations.createdAt));

    const results = [];
    
    for (const config of configurations) {
      const latestStatus = await this.findLatestStatusByConfiguration(config.id);
      results.push({
        configuration: config as ReplicationConfiguration,
        latestStatus,
      });
    }

    return results;
  }

  /**
   * Find replication status history
   */
  async findStatusHistory(
    configId: string,
    limit = 100,
    offset = 0
  ): Promise<{
    statusRecords: any[];
    total: number;
  }> {
    const db = this.databaseService.getDatabase();
    
    const [statusRecords, totalResult] = await Promise.all([
      db
        .select()
        .from(replicationStatusTable)
        .where(eq(replicationStatusTable.configurationId, configId))
        .orderBy(desc(replicationStatusTable.createdAt))
        .limit(limit)
        .offset(offset),
      
      db
        .select({ count: count() })
        .from(replicationStatusTable)
        .where(eq(replicationStatusTable.configurationId, configId))
    ]);

    return {
      statusRecords,
      total: totalResult[0]?.count || 0,
    };
  }

  /**
   * Get replication metrics for tenant
   */
  async getReplicationMetrics(tenantId: string): Promise<{
    totalConfigurations: number;
    activeConfigurations: number;
    healthyReplications: number;
    averageLagSeconds: number;
    totalBytesReplicated: number;
    replicationEfficiency: number;
  }> {
    this.logger.log(`Getting replication metrics for tenant ${tenantId}`);

    const db = this.databaseService.getDatabase();
    
    // Get configuration counts
    const [configCounts] = await db
      .select({
        totalConfigurations: count(),
        activeConfigurations: count(sql`CASE WHEN ${replicationConfigurations.isActive} THEN 1 END`),
      })
      .from(replicationConfigurations)
      .where(eq(replicationConfigurations.tenantId, tenantId));

    // Get latest status for each configuration
    const configurations = await db
      .select({ id: replicationConfigurations.id })
      .from(replicationConfigurations)
      .where(eq(replicationConfigurations.tenantId, tenantId));

    let healthyReplications = 0;
    let totalLagSeconds = 0;
    let totalBytesReplicated = 0;
    let statusCount = 0;

    for (const config of configurations) {
      const latestStatus = await this.findLatestStatusByConfiguration(config.id);
      if (latestStatus) {
        statusCount++;
        if (latestStatus.isHealthy) {
          healthyReplications++;
        }
        totalLagSeconds += latestStatus.lagSeconds;
        totalBytesReplicated += latestStatus.bytesReplicated;
      }
    }

    const averageLagSeconds = statusCount > 0 ? totalLagSeconds / statusCount : 0;
    const replicationEfficiency = configurations.length > 0 
      ? (healthyReplications / configurations.length) * 100 
      : 0;

    return {
      totalConfigurations: configCounts?.totalConfigurations || 0,
      activeConfigurations: configCounts?.activeConfigurations || 0,
      healthyReplications,
      averageLagSeconds: Math.round(averageLagSeconds * 100) / 100,
      totalBytesReplicated,
      replicationEfficiency: Math.round(replicationEfficiency * 100) / 100,
    };
  }

  /**
   * Get replication statistics by region
   */
  async getStatsByRegion(tenantId: string): Promise<{
    sourceRegion: string;
    targetRegion: string;
    configurationCount: number;
    averageLagSeconds: number;
    healthyReplications: number;
    totalBytesReplicated: number;
  }[]> {
    const db = this.databaseService.getDatabase();
    
    const configurations = await db
      .select()
      .from(replicationConfigurations)
      .where(eq(replicationConfigurations.tenantId, tenantId));

    const regionStats = new Map<string, {
      sourceRegion: string;
      targetRegion: string;
      configurationCount: number;
      totalLagSeconds: number;
      healthyReplications: number;
      totalBytesReplicated: number;
      statusCount: number;
    }>();

    for (const config of configurations) {
      const key = `${config.sourceRegion}-${config.targetRegion}`;
      
      if (!regionStats.has(key)) {
        regionStats.set(key, {
          sourceRegion: config.sourceRegion,
          targetRegion: config.targetRegion,
          configurationCount: 0,
          totalLagSeconds: 0,
          healthyReplications: 0,
          totalBytesReplicated: 0,
          statusCount: 0,
        });
      }

      const stats = regionStats.get(key)!;
      stats.configurationCount++;

      const latestStatus = await this.findLatestStatusByConfiguration(config.id);
      if (latestStatus) {
        stats.statusCount++;
        stats.totalLagSeconds += latestStatus.lagSeconds;
        stats.totalBytesReplicated += latestStatus.bytesReplicated;
        if (latestStatus.isHealthy) {
          stats.healthyReplications++;
        }
      }
    }

    return Array.from(regionStats.values()).map(stats => ({
      sourceRegion: stats.sourceRegion,
      targetRegion: stats.targetRegion,
      configurationCount: stats.configurationCount,
      averageLagSeconds: stats.statusCount > 0 
        ? Math.round((stats.totalLagSeconds / stats.statusCount) * 100) / 100
        : 0,
      healthyReplications: stats.healthyReplications,
      totalBytesReplicated: stats.totalBytesReplicated,
    }));
  }

  /**
   * Find configurations that need status updates
   */
  async findConfigurationsForStatusUpdate(): Promise<ReplicationConfiguration[]> {
    const db = this.databaseService.getDatabase();
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    const configs = await db
      .select()
      .from(replicationConfigurations)
      .where(
        and(
          eq(replicationConfigurations.isActive, true),
          sql`${replicationConfigurations.lastStatusUpdateAt} IS NULL OR ${replicationConfigurations.lastStatusUpdateAt} < ${fiveMinutesAgo}`
        )
      )
      .orderBy(replicationConfigurations.lastStatusUpdateAt);

    return configs as ReplicationConfiguration[];
  }

  /**
   * Update last status update timestamp
   */
  async updateLastStatusUpdate(configId: string): Promise<void> {
    const db = this.databaseService.getDatabase();
    
    await db
      .update(replicationConfigurations)
      .set({
        lastStatusUpdateAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(replicationConfigurations.id, configId));
  }

  /**
   * Get replication lag trends
   */
  async getLagTrends(tenantId: string, hours = 24): Promise<{
    configurationId: string;
    sourceRegion: string;
    targetRegion: string;
    trends: {
      timestamp: Date;
      lagSeconds: number;
      bytesReplicated: number;
    }[];
  }[]> {
    const db = this.databaseService.getDatabase();
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const configurations = await db
      .select()
      .from(replicationConfigurations)
      .where(eq(replicationConfigurations.tenantId, tenantId));

    const results = [];

    for (const config of configurations) {
      const trends = await db
        .select({
          timestamp: replicationStatusTable.createdAt,
          lagSeconds: replicationStatusTable.lagSeconds,
          bytesReplicated: replicationStatusTable.bytesReplicated,
        })
        .from(replicationStatusTable)
        .where(
          and(
            eq(replicationStatusTable.configurationId, config.id),
            gte(replicationStatusTable.createdAt, startTime)
          )
        )
        .orderBy(replicationStatusTable.createdAt);

      results.push({
        configurationId: config.id,
        sourceRegion: config.sourceRegion,
        targetRegion: config.targetRegion,
        trends,
      });
    }

    return results;
  }

  // Alias methods for service compatibility
  async createConfig(data: InsertReplicationConfiguration): Promise<ReplicationConfiguration> {
    return this.createConfiguration(data);
  }

  async findConfigById(configId: string): Promise<ReplicationConfiguration | null> {
    return this.findConfigurationById(configId);
  }

  async findConfigsByTenant(tenantId: string): Promise<ReplicationConfiguration[]> {
    return this.findConfigurationsByTenant(tenantId);
  }

  async findConfigsByPlan(planId: string): Promise<ReplicationConfiguration[]> {
    // For now, return empty array as plan-config relationship needs to be established
    // In a full implementation, you'd add a planId field to replicationConfigurations
    return [];
  }

  async findActiveConfigs(tenantId: string): Promise<ReplicationConfiguration[]> {
    const db = this.databaseService.getDatabase();
    
    const configs = await db
      .select()
      .from(replicationConfigurations)
      .where(
        and(
          eq(replicationConfigurations.tenantId, tenantId),
          eq(replicationConfigurations.isActive, true)
        )
      )
      .orderBy(desc(replicationConfigurations.createdAt));

    return configs as ReplicationConfiguration[];
  }

  async findAllActiveConfigs(): Promise<ReplicationConfiguration[]> {
    const db = this.databaseService.getDatabase();
    
    const configs = await db
      .select()
      .from(replicationConfigurations)
      .where(eq(replicationConfigurations.isActive, true))
      .orderBy(desc(replicationConfigurations.createdAt));

    return configs as ReplicationConfiguration[];
  }

  async updateConfig(configId: string, updates: Partial<InsertReplicationConfiguration>): Promise<ReplicationConfiguration> {
    return this.updateConfiguration(configId, updates);
  }

  async deleteConfig(configId: string): Promise<void> {
    this.logger.log(`Deleting replication configuration ${configId}`);

    const db = this.databaseService.getDatabase();
    
    // Delete associated status records first
    await db
      .delete(replicationStatusTable)
      .where(eq(replicationStatusTable.configurationId, configId));

    // Delete the configuration
    await db
      .delete(replicationConfigurations)
      .where(eq(replicationConfigurations.id, configId));
  }
}
