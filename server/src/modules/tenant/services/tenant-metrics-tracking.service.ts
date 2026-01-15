import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, and, gte, lte, sql, count, sum } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { TenantService } from './tenant.service';
import { BusinessMetricsService } from './business-metrics.service';
import { FeatureFlagService } from './feature-flag.service';
import { CustomLoggerService } from '../../logger/logger.service';
import { tenants } from '../../database/schema';
import { BusinessTier, BusinessMetrics } from '../entities/tenant.entity';

export interface MetricsUpdateEvent {
  tenantId: string;
  eventType: 'transaction' | 'employee' | 'location' | 'revenue';
  data: any;
  timestamp: Date;
}

export interface TierChangeEvent {
  tenantId: string;
  previousTier: BusinessTier;
  newTier: BusinessTier;
  metrics: BusinessMetrics;
  timestamp: Date;
}

@Injectable()
export class TenantMetricsTrackingService implements OnModuleInit {
  private readonly metricsCache = new Map<string, BusinessMetrics>();
  private readonly updateQueue = new Map<string, MetricsUpdateEvent[]>();
  private readonly batchSize = 100;
  private readonly batchInterval = 30000; // 30 seconds

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly tenantService: TenantService,
    private readonly businessMetricsService: BusinessMetricsService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext('TenantMetricsTrackingService');
  }

  async onModuleInit() {
    // Initialize metrics cache for all active tenants
    await this.initializeMetricsCache();
    
    // Start batch processing
    this.startBatchProcessing();
    
    this.logger.log('Tenant metrics tracking service initialized');
  }

  /**
   * Track a metrics update event
   */
  async trackMetricsUpdate(event: MetricsUpdateEvent): Promise<void> {
    try {
      // Add to update queue for batch processing
      if (!this.updateQueue.has(event.tenantId)) {
        this.updateQueue.set(event.tenantId, []);
      }
      
      this.updateQueue.get(event.tenantId)!.push(event);

      // Update in-memory cache immediately for real-time access
      await this.updateMetricsCache(event);

      this.logger.debug('Metrics update tracked', {
        tenantId: event.tenantId,
        eventType: event.eventType,
        queueSize: this.updateQueue.get(event.tenantId)!.length,
      });
    } catch (error) {
      this.logger.error(
        `Failed to track metrics update: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Get real-time metrics for a tenant
   */
  async getRealTimeMetrics(tenantId: string): Promise<BusinessMetrics> {
    // Check cache first
    const cacheKey = `metrics:${tenantId}`;
    let metrics = await this.cacheService.get<BusinessMetrics>(cacheKey);
    
    if (metrics !== null) {
      return metrics;
    }

    // Check in-memory cache
    metrics = this.metricsCache.get(tenantId) || null;
    if (metrics) {
      // Update cache
      await this.cacheService.set(cacheKey, metrics, { ttl: 300 }); // 5 minutes
      return metrics;
    }

    // Calculate from database
    metrics = await this.calculateMetricsFromDatabase(tenantId);
    
    // Update caches
    this.metricsCache.set(tenantId, metrics);
    await this.cacheService.set(cacheKey, metrics, { ttl: 300 });

    return metrics;
  }

  /**
   * Force recalculation of metrics for a tenant
   */
  async recalculateMetrics(tenantId: string): Promise<BusinessMetrics> {
    try {
      const metrics = await this.calculateMetricsFromDatabase(tenantId);
      
      // Update caches
      this.metricsCache.set(tenantId, metrics);
      await this.cacheService.set(`metrics:${tenantId}`, metrics, { ttl: 300 });

      // Update tenant record
      const currentTier = this.businessMetricsService.calculateBusinessTier(metrics);
      await this.updateTenantMetrics(tenantId, metrics, currentTier);

      this.logger.log(`Metrics recalculated for tenant ${tenantId}`);

      return metrics;
    } catch (error) {
      this.logger.error(
        `Failed to recalculate metrics for tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get metrics history for a tenant
   */
  async getMetricsHistory(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: Date; metrics: BusinessMetrics; tier: BusinessTier }>> {
    // This would require a metrics history table in a real implementation
    // For now, return current metrics
    const currentMetrics = await this.getRealTimeMetrics(tenantId);
    const currentTier = this.businessMetricsService.calculateBusinessTier(currentMetrics);

    return [
      {
        date: new Date(),
        metrics: currentMetrics,
        tier: currentTier,
      },
    ];
  }

  /**
   * Get tier progression analytics
   */
  async getTierProgression(tenantId: string): Promise<{
    currentTier: BusinessTier;
    nextTier: BusinessTier | null;
    progress: number;
    requirements: any;
    recommendations: string[];
  }> {
    const metrics = await this.getRealTimeMetrics(tenantId);
    const currentTier = this.businessMetricsService.calculateBusinessTier(metrics);
    const { currentTierProgress, nextTierProgress } = this.businessMetricsService.calculateTierProgress(metrics, currentTier);
    const { nextTier, requirements } = this.businessMetricsService.getUpgradeRequirements(currentTier);
    const recommendations = this.businessMetricsService.getRecommendedActions(metrics, currentTier);

    return {
      currentTier,
      nextTier,
      progress: nextTierProgress,
      requirements,
      recommendations,
    };
  }

  /**
   * Event handlers for automatic metrics tracking
   */
  @OnEvent('transaction.created')
  async handleTransactionCreated(event: any): Promise<void> {
    await this.trackMetricsUpdate({
      tenantId: event.tenantId,
      eventType: 'transaction',
      data: {
        amount: event.transaction.total,
        itemCount: event.transaction.items?.length || 1,
      },
      timestamp: new Date(),
    });
  }

  @OnEvent('employee.created')
  async handleEmployeeCreated(event: any): Promise<void> {
    await this.trackMetricsUpdate({
      tenantId: event.tenantId,
      eventType: 'employee',
      data: { action: 'created' },
      timestamp: new Date(),
    });
  }

  @OnEvent('employee.deleted')
  async handleEmployeeDeleted(event: any): Promise<void> {
    await this.trackMetricsUpdate({
      tenantId: event.tenantId,
      eventType: 'employee',
      data: { action: 'deleted' },
      timestamp: new Date(),
    });
  }

  @OnEvent('location.created')
  async handleLocationCreated(event: any): Promise<void> {
    await this.trackMetricsUpdate({
      tenantId: event.tenantId,
      eventType: 'location',
      data: { action: 'created' },
      timestamp: new Date(),
    });
  }

  @OnEvent('location.deleted')
  async handleLocationDeleted(event: any): Promise<void> {
    await this.trackMetricsUpdate({
      tenantId: event.tenantId,
      eventType: 'location',
      data: { action: 'deleted' },
      timestamp: new Date(),
    });
  }

  /**
   * Scheduled tasks for metrics maintenance
   */
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyMetricsUpdate(): Promise<void> {
    this.logger.log('Starting hourly metrics update');
    
    try {
      // Process all pending updates
      await this.processBatchUpdates();
      
      // Recalculate metrics for active tenants
      const activeTenants = await this.getActiveTenants();
      
      for (const tenant of activeTenants) {
        try {
          await this.recalculateMetrics(tenant.id);
        } catch (error) {
          this.logger.error(
            `Failed to update metrics for tenant ${tenant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
      
      this.logger.log(`Hourly metrics update completed for ${activeTenants.length} tenants`);
    } catch (error) {
      this.logger.error(
        `Hourly metrics update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyMetricsCleanup(): Promise<void> {
    this.logger.log('Starting daily metrics cleanup');
    
    try {
      // Clear old cache entries
      await this.cacheService.invalidatePattern('metrics:*');
      
      // Clear in-memory cache
      this.metricsCache.clear();
      
      // Reinitialize cache
      await this.initializeMetricsCache();
      
      this.logger.log('Daily metrics cleanup completed');
    } catch (error) {
      this.logger.error(
        `Daily metrics cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Private helper methods
   */
  private async initializeMetricsCache(): Promise<void> {
    try {
      const activeTenants = await this.getActiveTenants();
      
      for (const tenant of activeTenants) {
        const metrics = tenant.metrics as BusinessMetrics;
        this.metricsCache.set(tenant.id, metrics);
      }
      
      this.logger.log(`Initialized metrics cache for ${activeTenants.length} tenants`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize metrics cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async getActiveTenants(): Promise<any[]> {
    const db = this.drizzle.getDb();
    return db
      .select()
      .from(tenants)
      .where(eq(tenants.isActive, true));
  }

  private async updateMetricsCache(event: MetricsUpdateEvent): Promise<void> {
    const currentMetrics = this.metricsCache.get(event.tenantId) || {
      employeeCount: 0,
      locationCount: 1,
      monthlyTransactionVolume: 0,
      monthlyRevenue: 0,
    };

    let updatedMetrics = { ...currentMetrics };

    switch (event.eventType) {
      case 'transaction':
        updatedMetrics.monthlyTransactionVolume += 1;
        updatedMetrics.monthlyRevenue += event.data.amount || 0;
        break;
      case 'employee':
        if (event.data.action === 'created') {
          updatedMetrics.employeeCount += 1;
        } else if (event.data.action === 'deleted') {
          updatedMetrics.employeeCount = Math.max(0, updatedMetrics.employeeCount - 1);
        }
        break;
      case 'location':
        if (event.data.action === 'created') {
          updatedMetrics.locationCount += 1;
        } else if (event.data.action === 'deleted') {
          updatedMetrics.locationCount = Math.max(1, updatedMetrics.locationCount - 1);
        }
        break;
    }

    this.metricsCache.set(event.tenantId, updatedMetrics);

    // Check for tier changes
    const previousTier = this.businessMetricsService.calculateBusinessTier(currentMetrics);
    const newTier = this.businessMetricsService.calculateBusinessTier(updatedMetrics);

    if (previousTier !== newTier) {
      await this.handleTierChange(event.tenantId, previousTier, newTier, updatedMetrics);
    }
  }

  private async handleTierChange(
    tenantId: string,
    previousTier: BusinessTier,
    newTier: BusinessTier,
    metrics: BusinessMetrics,
  ): Promise<void> {
    try {
      // Update tenant record
      await this.updateTenantMetrics(tenantId, metrics, newTier);

      // Invalidate feature flag cache
      await this.featureFlagService.invalidateFeatureCache(tenantId);

      // Emit tier change event
      const tierChangeEvent: TierChangeEvent = {
        tenantId,
        previousTier,
        newTier,
        metrics,
        timestamp: new Date(),
      };

      this.eventEmitter.emit('tenant.tier.changed', tierChangeEvent);

      this.logger.log(
        `Tier changed for tenant ${tenantId}: ${previousTier} -> ${newTier}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle tier change for tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async updateTenantMetrics(
    tenantId: string,
    metrics: BusinessMetrics,
    tier: BusinessTier,
  ): Promise<void> {
    const db = this.drizzle.getDb();
    await db
      .update(tenants)
      .set({
        metrics,
        businessTier: tier,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));
  }

  private startBatchProcessing(): void {
    setInterval(async () => {
      await this.processBatchUpdates();
    }, this.batchInterval);
  }

  private async processBatchUpdates(): Promise<void> {
    if (this.updateQueue.size === 0) {
      return;
    }

    const tenantsToUpdate = Array.from(this.updateQueue.keys()).slice(0, this.batchSize);
    
    for (const tenantId of tenantsToUpdate) {
      try {
        const events = this.updateQueue.get(tenantId) || [];
        this.updateQueue.delete(tenantId);

        if (events.length > 0) {
          // Recalculate metrics from database to ensure accuracy
          await this.recalculateMetrics(tenantId);
        }
      } catch (error) {
        this.logger.error(
          `Failed to process batch updates for tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async calculateMetricsFromDatabase(tenantId: string): Promise<BusinessMetrics> {
    // This is a simplified implementation
    // In a real system, you would query actual transaction, employee, and location tables
    
    try {
      // Get current metrics from tenant record as baseline
      const db = this.drizzle.getDb();
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Return current metrics (in a real implementation, calculate from actual data)
      return tenant.metrics as BusinessMetrics;
    } catch (error) {
      this.logger.error(
        `Failed to calculate metrics from database for tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      
      // Return default metrics on error
      return {
        employeeCount: 0,
        locationCount: 1,
        monthlyTransactionVolume: 0,
        monthlyRevenue: 0,
      };
    }
  }
}