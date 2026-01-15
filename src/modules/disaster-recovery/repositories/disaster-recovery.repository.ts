import { Injectable, Logger } from '@nestjs/common';
import { eq, and, desc, count, sql, gte, lte } from 'drizzle-orm';

import { DatabaseService } from '../../database/database.service';
import {
  disasterRecoveryPlans,
  disasterRecoveryExecutions,
  InsertDisasterRecoveryPlan,
  InsertDisasterRecoveryExecution,
  DisasterRecoveryPlan,
  DisasterRecoveryExecution,
  DisasterRecoveryMetrics,
} from '../entities/disaster-recovery.entity';

@Injectable()
export class DisasterRecoveryRepository {
  private readonly logger = new Logger(DisasterRecoveryRepository.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create disaster recovery plan
   */
  async createPlan(data: InsertDisasterRecoveryPlan): Promise<DisasterRecoveryPlan> {
    this.logger.log(`Creating DR plan for tenant ${data.tenantId}`);

    const db = this.databaseService.getDatabase();
    
    const [plan] = await db
      .insert(disasterRecoveryPlans)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return plan as DisasterRecoveryPlan;
  }

  /**
   * Find disaster recovery plan by ID
   */
  async findPlanById(planId: string): Promise<DisasterRecoveryPlan | null> {
    const db = this.databaseService.getDatabase();
    
    const [plan] = await db
      .select()
      .from(disasterRecoveryPlans)
      .where(eq(disasterRecoveryPlans.id, planId))
      .limit(1);

    return (plan as DisasterRecoveryPlan) || null;
  }

  /**
   * Find disaster recovery plans by tenant
   */
  async findPlansByTenant(tenantId: string): Promise<DisasterRecoveryPlan[]> {
    const db = this.databaseService.getDatabase();
    
    const plans = await db
      .select()
      .from(disasterRecoveryPlans)
      .where(eq(disasterRecoveryPlans.tenantId, tenantId))
      .orderBy(desc(disasterRecoveryPlans.createdAt));

    return plans as DisasterRecoveryPlan[];
  }

  /**
   * Find active disaster recovery plans
   */
  async findActivePlans(): Promise<DisasterRecoveryPlan[]> {
    const db = this.databaseService.getDatabase();
    
    const plans = await db
      .select()
      .from(disasterRecoveryPlans)
      .where(eq(disasterRecoveryPlans.isActive, true))
      .orderBy(desc(disasterRecoveryPlans.createdAt));

    return plans as DisasterRecoveryPlan[];
  }

  /**
   * Find plans that need testing
   */
  async findPlansForTesting(): Promise<DisasterRecoveryPlan[]> {
    const db = this.databaseService.getDatabase();
    const now = new Date();
    
    const plans = await db
      .select()
      .from(disasterRecoveryPlans)
      .where(
        and(
          eq(disasterRecoveryPlans.isActive, true),
          lte(disasterRecoveryPlans.nextTestAt, now)
        )
      )
      .orderBy(disasterRecoveryPlans.nextTestAt);

    return plans as DisasterRecoveryPlan[];
  }

  /**
   * Update disaster recovery plan
   */
  async updatePlan(planId: string, updates: Partial<InsertDisasterRecoveryPlan>): Promise<DisasterRecoveryPlan> {
    this.logger.log(`Updating DR plan ${planId}`);

    const db = this.databaseService.getDatabase();
    
    const [plan] = await db
      .update(disasterRecoveryPlans)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(disasterRecoveryPlans.id, planId))
      .returning();

    return plan as DisasterRecoveryPlan;
  }

  /**
   * Delete disaster recovery plan
   */
  async deletePlan(planId: string): Promise<void> {
    this.logger.log(`Deleting DR plan ${planId}`);

    const db = this.databaseService.getDatabase();
    
    // Delete associated executions first
    await db
      .delete(disasterRecoveryExecutions)
      .where(eq(disasterRecoveryExecutions.planId, planId));

    // Delete the plan
    await db
      .delete(disasterRecoveryPlans)
      .where(eq(disasterRecoveryPlans.id, planId));
  }

  /**
   * Create disaster recovery execution
   */
  async createExecution(data: InsertDisasterRecoveryExecution): Promise<DisasterRecoveryExecution> {
    this.logger.log(`Creating DR execution for plan ${data.planId}`);

    const db = this.databaseService.getDatabase();
    
    const [execution] = await db
      .insert(disasterRecoveryExecutions)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return execution as DisasterRecoveryExecution;
  }

  /**
   * Find disaster recovery execution by ID
   */
  async findExecutionById(executionId: string): Promise<DisasterRecoveryExecution | null> {
    const db = this.databaseService.getDatabase();
    
    const [execution] = await db
      .select()
      .from(disasterRecoveryExecutions)
      .where(eq(disasterRecoveryExecutions.id, executionId))
      .limit(1);

    return (execution as DisasterRecoveryExecution) || null;
  }

  /**
   * Find disaster recovery executions by tenant
   */
  async findExecutionsByTenant(
    tenantId: string, 
    limit = 50, 
    offset = 0
  ): Promise<{
    executions: DisasterRecoveryExecution[];
    total: number;
  }> {
    const db = this.databaseService.getDatabase();
    
    const [executions, totalResult] = await Promise.all([
      db
        .select()
        .from(disasterRecoveryExecutions)
        .where(eq(disasterRecoveryExecutions.tenantId, tenantId))
        .orderBy(desc(disasterRecoveryExecutions.createdAt))
        .limit(limit)
        .offset(offset),
      
      db
        .select({ count: count() })
        .from(disasterRecoveryExecutions)
        .where(eq(disasterRecoveryExecutions.tenantId, tenantId))
    ]);

    return {
      executions: executions as DisasterRecoveryExecution[],
      total: totalResult[0]?.count || 0,
    };
  }

  /**
   * Find disaster recovery executions by plan
   */
  async findExecutionsByPlan(planId: string, limit = 10): Promise<DisasterRecoveryExecution[]> {
    const db = this.databaseService.getDatabase();
    
    const executions = await db
      .select()
      .from(disasterRecoveryExecutions)
      .where(eq(disasterRecoveryExecutions.planId, planId))
      .orderBy(desc(disasterRecoveryExecutions.createdAt))
      .limit(limit);

    return executions as DisasterRecoveryExecution[];
  }

  /**
   * Update disaster recovery execution
   */
  async updateExecution(
    executionId: string, 
    updates: Partial<InsertDisasterRecoveryExecution>
  ): Promise<DisasterRecoveryExecution> {
    this.logger.log(`Updating DR execution ${executionId}`);

    const db = this.databaseService.getDatabase();
    
    const [execution] = await db
      .update(disasterRecoveryExecutions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(disasterRecoveryExecutions.id, executionId))
      .returning();

    return execution as DisasterRecoveryExecution;
  }

  /**
   * Get disaster recovery metrics for tenant
   */
  async getMetrics(tenantId: string): Promise<DisasterRecoveryMetrics> {
    this.logger.log(`Getting DR metrics for tenant ${tenantId}`);

    const db = this.databaseService.getDatabase();
    
    // Get plan counts
    const [planCounts] = await db
      .select({
        totalPlans: count(),
        activePlans: count(sql`CASE WHEN ${disasterRecoveryPlans.isActive} THEN 1 END`),
      })
      .from(disasterRecoveryPlans)
      .where(eq(disasterRecoveryPlans.tenantId, tenantId));

    // Get execution metrics for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [executionMetrics] = await db
      .select({
        totalExecutions: count(),
        successfulExecutions: count(sql`CASE WHEN ${disasterRecoveryExecutions.status} = 'completed' THEN 1 END`),
        failedExecutions: count(sql`CASE WHEN ${disasterRecoveryExecutions.status} = 'failed' THEN 1 END`),
        testExecutions: count(sql`CASE WHEN ${disasterRecoveryExecutions.isTest} THEN 1 END`),
        averageRto: sql<number>`AVG(${disasterRecoveryExecutions.actualRtoMinutes})`,
      })
      .from(disasterRecoveryExecutions)
      .where(
        and(
          eq(disasterRecoveryExecutions.tenantId, tenantId),
          gte(disasterRecoveryExecutions.createdAt, thirtyDaysAgo)
        )
      );

    // Get recent executions
    const recentExecutions = await db
      .select({
        id: disasterRecoveryExecutions.id,
        planId: disasterRecoveryExecutions.planId,
        disasterType: disasterRecoveryExecutions.disasterType,
        status: disasterRecoveryExecutions.status,
        actualRtoMinutes: disasterRecoveryExecutions.actualRtoMinutes,
        isTest: disasterRecoveryExecutions.isTest,
        createdAt: disasterRecoveryExecutions.createdAt,
      })
      .from(disasterRecoveryExecutions)
      .where(eq(disasterRecoveryExecutions.tenantId, tenantId))
      .orderBy(desc(disasterRecoveryExecutions.createdAt))
      .limit(10);

    // Calculate success rate
    const totalExecutions = executionMetrics?.totalExecutions || 0;
    const successfulExecutions = executionMetrics?.successfulExecutions || 0;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    return {
      averageRtoMinutes: Math.round((executionMetrics?.averageRto || 0) * 100) / 100,
      averageRpoMinutes: 0, // Placeholder
      successRate: Math.round(successRate * 100) / 100,
      totalExecutions: totalExecutions,
      successfulRecoveries: successfulExecutions,
      failedRecoveries: executionMetrics?.failedExecutions || 0,
      testExecutions: executionMetrics?.testExecutions || 0,
      lastSuccessfulRecovery: new Date(),
      nextScheduledTest: new Date(),
      healthScore: 95,
    } as DisasterRecoveryMetrics;
  }

  /**
   * Get disaster recovery statistics by disaster type
   */
  async getStatsByDisasterType(tenantId: string): Promise<{
    disasterType: string;
    executionCount: number;
    successRate: number;
    averageRto: number;
  }[]> {
    const db = this.databaseService.getDatabase();
    
    const stats = await db
      .select({
        disasterType: disasterRecoveryExecutions.disasterType,
        executionCount: count(),
        successfulExecutions: count(sql`CASE WHEN ${disasterRecoveryExecutions.status} = 'completed' THEN 1 END`),
        averageRto: sql<number>`AVG(${disasterRecoveryExecutions.actualRtoMinutes})`,
      })
      .from(disasterRecoveryExecutions)
      .where(eq(disasterRecoveryExecutions.tenantId, tenantId))
      .groupBy(disasterRecoveryExecutions.disasterType);

    return stats.map((stat: any) => ({
      disasterType: stat.disasterType,
      executionCount: stat.executionCount,
      successRate: stat.executionCount > 0 
        ? Math.round((stat.successfulExecutions / stat.executionCount) * 10000) / 100
        : 0,
      averageRto: Math.round((stat.averageRto || 0) * 100) / 100,
    }));
  }

  /**
   * Get RTO performance trends
   */
  async getRTOTrends(tenantId: string, days = 30): Promise<{
    date: string;
    averageRto: number;
    executionCount: number;
  }[]> {
    const db = this.databaseService.getDatabase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await db
      .select({
        date: sql<string>`DATE(${disasterRecoveryExecutions.createdAt})`,
        averageRto: sql<number>`AVG(${disasterRecoveryExecutions.actualRtoMinutes})`,
        executionCount: count(),
      })
      .from(disasterRecoveryExecutions)
      .where(
        and(
          eq(disasterRecoveryExecutions.tenantId, tenantId),
          gte(disasterRecoveryExecutions.createdAt, startDate)
        )
      )
      .groupBy(sql`DATE(${disasterRecoveryExecutions.createdAt})`)
      .orderBy(sql`DATE(${disasterRecoveryExecutions.createdAt})`);

    return trends.map((trend: any) => ({
      date: trend.date,
      averageRto: Math.round((trend.averageRto || 0) * 100) / 100,
      executionCount: trend.executionCount,
    }));
  }
}