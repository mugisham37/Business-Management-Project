import { Injectable, Logger } from '@nestjs/common';
import { eq, and, desc, count, sql } from 'drizzle-orm';

import { DatabaseService } from '../../database/database.service';
import {
  failoverConfigurations,
  failoverExecutions,
  InsertFailoverConfiguration,
  InsertFailoverExecution,
  FailoverConfiguration,
  FailoverExecution,
} from '../entities/disaster-recovery.entity';

@Injectable()
export class FailoverRepository {
  private readonly logger = new Logger(FailoverRepository.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create failover configuration
   */
  async createConfiguration(data: InsertFailoverConfiguration): Promise<FailoverConfiguration> {
    this.logger.log(`Creating failover configuration for service ${data.serviceName}`);

    const db = this.databaseService.getDatabase();
    
    const [config] = await db
      .insert(failoverConfigurations)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return config as unknown as FailoverConfiguration;
  }

  /**
   * Find failover configuration by ID
   */
  async findConfigurationById(configId: string): Promise<FailoverConfiguration | null> {
    const db = this.databaseService.getDatabase();
    
    const [config] = await db
      .select()
      .from(failoverConfigurations)
      .where(eq(failoverConfigurations.id, configId))
      .limit(1);

    return (config as unknown as FailoverConfiguration) || null;
  }

  /**
   * Find failover configurations by tenant
   */
  async findConfigurationsByTenant(tenantId: string): Promise<FailoverConfiguration[]> {
    const db = this.databaseService.getDatabase();
    
    const configs = await db
      .select()
      .from(failoverConfigurations)
      .where(eq(failoverConfigurations.tenantId, tenantId))
      .orderBy(desc(failoverConfigurations.createdAt));

    return configs as unknown as FailoverConfiguration[];
  }

  /**
   * Find failover configuration by service
   */
  async findConfigurationByService(
    tenantId: string, 
    serviceName: string
  ): Promise<FailoverConfiguration | null> {
    const db = this.databaseService.getDatabase();
    
    const [config] = await db
      .select()
      .from(failoverConfigurations)
      .where(
        and(
          eq(failoverConfigurations.tenantId, tenantId),
          eq(failoverConfigurations.serviceName, serviceName)
        )
      )
      .limit(1);

    return (config as unknown as FailoverConfiguration) || null;
  }

  /**
   * Update failover configuration
   */
  async updateConfiguration(
    configId: string, 
    updates: Partial<InsertFailoverConfiguration>
  ): Promise<FailoverConfiguration> {
    this.logger.log(`Updating failover configuration ${configId}`);

    const db = this.databaseService.getDatabase();
    
    const [config] = await db
      .update(failoverConfigurations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(failoverConfigurations.id, configId))
      .returning();

    return config as unknown as FailoverConfiguration;
  }

  /**
   * Delete failover configuration
   */
  async deleteConfiguration(configId: string): Promise<void> {
    this.logger.log(`Deleting failover configuration ${configId}`);

    const db = this.databaseService.getDatabase();
    
    // Delete associated executions first
    await db
      .delete(failoverExecutions)
      .where(eq(failoverExecutions.configurationId, configId));

    // Delete the configuration
    await db
      .delete(failoverConfigurations)
      .where(eq(failoverConfigurations.id, configId));
  }

  /**
   * Create failover execution
   */
  async createExecution(data: InsertFailoverExecution): Promise<any> {
    this.logger.log(`Creating failover execution for configuration ${data.configurationId}`);

    const db = this.databaseService.getDatabase();
    
    const [execution] = await db
      .insert(failoverExecutions)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return execution;
  }

  /**
   * Find failover execution by ID
   */
  async findExecutionById(executionId: string): Promise<any | null> {
    const db = this.databaseService.getDatabase();
    
    const [execution] = await db
      .select()
      .from(failoverExecutions)
      .where(eq(failoverExecutions.id, executionId))
      .limit(1);

    return execution || null;
  }

  /**
   * Find failover executions by tenant
   */
  async findExecutionsByTenant(
    tenantId: string, 
    limit = 50, 
    offset = 0
  ): Promise<{
    executions: any[];
    total: number;
  }> {
    const db = this.databaseService.getDatabase();
    
    const [executions, totalResult] = await Promise.all([
      db
        .select()
        .from(failoverExecutions)
        .where(eq(failoverExecutions.tenantId, tenantId))
        .orderBy(desc(failoverExecutions.createdAt))
        .limit(limit)
        .offset(offset),
      
      db
        .select({ count: count() })
        .from(failoverExecutions)
        .where(eq(failoverExecutions.tenantId, tenantId))
    ]);

    return {
      executions,
      total: totalResult[0]?.count || 0,
    };
  }

  /**
   * Find failover executions by configuration
   */
  async findExecutionsByConfiguration(
    configurationId: string, 
    limit = 10
  ): Promise<any[]> {
    const db = this.databaseService.getDatabase();
    
    return db
      .select()
      .from(failoverExecutions)
      .where(eq(failoverExecutions.configurationId, configurationId))
      .orderBy(desc(failoverExecutions.createdAt))
      .limit(limit);
  }

  /**
   * Update failover execution
   */
  async updateExecution(
    executionId: string, 
    updates: Partial<InsertFailoverExecution>
  ): Promise<any> {
    this.logger.log(`Updating failover execution ${executionId}`);

    const db = this.databaseService.getDatabase();
    
    const [execution] = await db
      .update(failoverExecutions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(failoverExecutions.id, executionId))
      .returning();

    return execution;
  }

  /**
   * Get failover metrics for tenant
   */
  async getFailoverMetrics(tenantId: string): Promise<{
    totalConfigurations: number;
    activeConfigurations: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageFailoverTime: number;
    successRate: number;
  }> {
    this.logger.log(`Getting failover metrics for tenant ${tenantId}`);

    const db = this.databaseService.getDatabase();
    
    // Get configuration counts
    const [configCounts] = await db
      .select({
        totalConfigurations: count(),
        activeConfigurations: count(sql`CASE WHEN ${failoverConfigurations.isActive} THEN 1 END`),
      })
      .from(failoverConfigurations)
      .where(eq(failoverConfigurations.tenantId, tenantId));

    // Get execution metrics
    const [executionMetrics] = await db
      .select({
        totalExecutions: count(),
        successfulExecutions: count(sql`CASE WHEN ${failoverExecutions.status} = 'completed' THEN 1 END`),
        failedExecutions: count(sql`CASE WHEN ${failoverExecutions.status} = 'failed' THEN 1 END`),
        averageFailoverTime: sql<number>`AVG(${failoverExecutions.failoverTimeSeconds})`,
      })
      .from(failoverExecutions)
      .where(eq(failoverExecutions.tenantId, tenantId));

    // Calculate success rate
    const totalExecutions = executionMetrics?.totalExecutions || 0;
    const successfulExecutions = executionMetrics?.successfulExecutions || 0;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    return {
      totalConfigurations: configCounts?.totalConfigurations || 0,
      activeConfigurations: configCounts?.activeConfigurations || 0,
      totalExecutions: totalExecutions,
      successfulExecutions: successfulExecutions,
      failedExecutions: executionMetrics?.failedExecutions || 0,
      averageFailoverTime: Math.round((executionMetrics?.averageFailoverTime || 0) * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Get failover statistics by service
   */
  async getStatsByService(tenantId: string): Promise<{
    serviceName: string;
    executionCount: number;
    successRate: number;
    averageFailoverTime: number;
  }[]> {
    const db = this.databaseService.getDatabase();
    
    const stats = await db
      .select({
        serviceName: failoverConfigurations.serviceName,
        executionCount: count(failoverExecutions.id),
        successfulExecutions: count(sql`CASE WHEN ${failoverExecutions.status} = 'completed' THEN 1 END`),
        averageFailoverTime: sql<number>`AVG(${failoverExecutions.failoverTimeSeconds})`,
      })
      .from(failoverConfigurations)
      .leftJoin(
        failoverExecutions,
        eq(failoverConfigurations.id, failoverExecutions.configurationId)
      )
      .where(eq(failoverConfigurations.tenantId, tenantId))
      .groupBy(failoverConfigurations.serviceName);

    return stats.map((stat: any) => ({
      serviceName: stat.serviceName,
      executionCount: stat.executionCount,
      successRate: stat.executionCount > 0 
        ? Math.round((stat.successfulExecutions / stat.executionCount) * 10000) / 100
        : 0,
      averageFailoverTime: Math.round((stat.averageFailoverTime || 0) * 100) / 100,
    }));
  }

  /**
   * Find configurations that need health checks
   */
  async findConfigurationsForHealthCheck(): Promise<FailoverConfiguration[]> {
    const db = this.databaseService.getDatabase();
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    const configs = await db
      .select()
      .from(failoverConfigurations)
      .where(
        and(
          eq(failoverConfigurations.isActive, true),
          sql`${failoverConfigurations.lastHealthCheckAt} IS NULL OR ${failoverConfigurations.lastHealthCheckAt} < ${fiveMinutesAgo}`
        )
      )
      .orderBy(failoverConfigurations.lastHealthCheckAt);

    return configs as unknown as FailoverConfiguration[];
  }

  /**
   * Update health check status
   */
  async updateHealthCheckStatus(
    configId: string, 
    isHealthy: boolean, 
    healthCheckDetails?: any
  ): Promise<void> {
    const db = this.databaseService.getDatabase();
    
    await db
      .update(failoverConfigurations)
      .set({
        isHealthy,
        lastHealthCheckAt: new Date(),
        healthCheckDetails,
        updatedAt: new Date(),
      })
      .where(eq(failoverConfigurations.id, configId));
  }

  // Alias methods for service compatibility
  async createConfig(data: InsertFailoverConfiguration): Promise<FailoverConfiguration> {
    return this.createConfiguration(data);
  }

  async findConfigById(configId: string): Promise<FailoverConfiguration | null> {
    return this.findConfigurationById(configId);
  }

  async findConfigsByTenant(tenantId: string): Promise<FailoverConfiguration[]> {
    return this.findConfigurationsByTenant(tenantId);
  }

  async findConfigsByPlan(planId: string): Promise<FailoverConfiguration[]> {
    // For now, return empty array as plan-config relationship needs to be established
    // In a full implementation, you'd add a planId field to failoverConfigurations
    return [];
  }

  async updateConfig(configId: string, updates: Partial<InsertFailoverConfiguration>): Promise<FailoverConfiguration> {
    return this.updateConfiguration(configId, updates);
  }

  async deleteConfig(configId: string): Promise<void> {
    return this.deleteConfiguration(configId);
  }
}
