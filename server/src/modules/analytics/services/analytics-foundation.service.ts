import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';
import { DataWarehouseService } from './data-warehouse.service';
import { ETLService } from './etl.service';
import { MetricsCalculationService } from './metrics-calculation.service';

export interface AnalyticsConfiguration {
  tenantId: string;
  dataRetentionDays: number;
  aggregationIntervals: ('hourly' | 'daily' | 'weekly' | 'monthly')[];
  enabledMetrics: string[];
  customDimensions: Record<string, any>;
  alertThresholds: Record<string, number>;
  reportingSchedule: {
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
    quarterly: boolean;
  };
}

export interface AnalyticsEvent {
  id: string;
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata: {
    userId?: string;
    locationId?: string;
    sessionId?: string;
    source: string;
  };
}

export interface MetricDefinition {
  name: string;
  displayName: string;
  description: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  unit: string;
  aggregations: ('sum' | 'avg' | 'min' | 'max' | 'count')[];
  dimensions: string[];
  filters?: Record<string, any>;
  calculation?: string; // SQL expression or formula
}

@Injectable()
export class AnalyticsFoundationService {
  private readonly logger = new Logger(AnalyticsFoundationService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
    private readonly dataWarehouseService: DataWarehouseService,
    private readonly etlService: ETLService,
    private readonly metricsService: MetricsCalculationService,
  ) {}

  /**
   * Initialize analytics foundation for a tenant
   */
  async initializeTenantAnalytics(tenantId: string, config: AnalyticsConfiguration): Promise<void> {
    try {
      this.logger.log(`Initializing analytics foundation for tenant: ${tenantId}`);

      // Create data warehouse schema for tenant
      await this.dataWarehouseService.createTenantSchema(tenantId);

      // Set up ETL pipelines
      await this.etlService.setupETLPipelines(tenantId, config);

      // Initialize metric definitions
      await this.initializeDefaultMetrics(tenantId);

      // Configure aggregation jobs
      await this.setupAggregationJobs(tenantId, config);

      // Store configuration
      await this.storeAnalyticsConfiguration(tenantId, config);

      this.logger.log(`Analytics foundation initialized for tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to initialize analytics for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Track analytics event
   */
  async trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const fullEvent: AnalyticsEvent = {
        ...event,
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        timestamp: new Date(),
      };

      // Queue event for processing
      await this.queueService.addAnalyticsJob(
        {
          eventType: event.eventType,
          event: fullEvent,
          tenantId: event.tenantId,
        },
        {
          priority: this.getEventPriority(event.eventType),
          delay: 0,
        }
      );

      // Update real-time metrics cache
      await this.updateRealTimeMetrics(event.tenantId, fullEvent);

      this.logger.debug(`Analytics event tracked: ${fullEvent.id}`);
    } catch (error) {
      this.logger.error(`Failed to track analytics event:`, error);
      throw error;
    }
  }

  /**
   * Get analytics configuration for tenant
   */
  async getAnalyticsConfiguration(tenantId: string): Promise<AnalyticsConfiguration | null> {
    try {
      const cacheKey = `analytics-config:${tenantId}`;
      
      // Try cache first
      let config = await this.cacheService.get<AnalyticsConfiguration>(cacheKey);
      
      if (!config) {
        // Load from database
        config = await this.loadAnalyticsConfiguration(tenantId);
        
        if (config) {
          // Cache for 1 hour
          await this.cacheService.set(cacheKey, config, { ttl: 3600 });
        }
      }

      return config;
    } catch (error) {
      this.logger.error(`Failed to get analytics configuration for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Update analytics configuration
   */
  async updateAnalyticsConfiguration(
    tenantId: string, 
    updates: Partial<AnalyticsConfiguration>
  ): Promise<AnalyticsConfiguration> {
    try {
      const currentConfig = await this.getAnalyticsConfiguration(tenantId);
      if (!currentConfig) {
        throw new Error(`Analytics not initialized for tenant ${tenantId}`);
      }

      const updatedConfig = { ...currentConfig, ...updates };
      
      // Store updated configuration
      await this.storeAnalyticsConfiguration(tenantId, updatedConfig);

      // Invalidate cache
      await this.cacheService.invalidatePattern(`analytics-config:${tenantId}`);

      // Reconfigure ETL pipelines if needed
      if (updates.aggregationIntervals || updates.enabledMetrics) {
        await this.etlService.reconfigurePipelines(tenantId, updatedConfig);
      }

      this.logger.log(`Analytics configuration updated for tenant: ${tenantId}`);
      return updatedConfig;
    } catch (error) {
      this.logger.error(`Failed to update analytics configuration for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get available metric definitions
   */
  async getMetricDefinitions(tenantId: string): Promise<MetricDefinition[]> {
    try {
      const cacheKey = `metric-definitions:${tenantId}`;
      
      // Try cache first
      let definitions = await this.cacheService.get<MetricDefinition[]>(cacheKey);
      
      if (!definitions) {
        definitions = await this.loadMetricDefinitions(tenantId);
        
        // Cache for 30 minutes
        await this.cacheService.set(cacheKey, definitions, { ttl: 1800 });
      }

      return definitions;
    } catch (error) {
      this.logger.error(`Failed to get metric definitions for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Create custom metric definition
   */
  async createCustomMetric(tenantId: string, metric: MetricDefinition): Promise<void> {
    try {
      // Validate metric definition
      this.validateMetricDefinition(metric);

      // Store metric definition
      await this.storeMetricDefinition(tenantId, metric);

      // Invalidate cache
      await this.cacheService.invalidatePattern(`metric-definitions:${tenantId}`);

      // Set up calculation job if needed
      if (metric.calculation) {
        await this.setupCustomMetricCalculation(tenantId, metric);
      }

      this.logger.log(`Custom metric created: ${metric.name} for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to create custom metric for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get analytics health status
   */
  async getAnalyticsHealth(tenantId: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message: string;
      timestamp: Date;
    }>;
    lastETLRun: Date | null;
    dataFreshness: number; // minutes since last data update
    errorRate: number; // percentage of failed events in last hour
  }> {
    try {
      const checks = [];
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Check data warehouse connectivity
      try {
        await this.dataWarehouseService.testConnection(tenantId);
        checks.push({
          name: 'Data Warehouse Connection',
          status: 'pass' as const,
          message: 'Connection successful',
          timestamp: new Date(),
        });
      } catch (err) {
        const error = err as Error;
        checks.push({
          name: 'Data Warehouse Connection',
          status: 'fail' as const,
          message: `Connection failed: ${error.message}`,
          timestamp: new Date(),
        });
        overallStatus = 'unhealthy';
      }

      // Check ETL pipeline status
      const lastETLRun = await this.etlService.getLastRunTime(tenantId);
      const etlHealthy = lastETLRun && (Date.now() - lastETLRun.getTime()) < 3600000; // 1 hour
      
      checks.push({
        name: 'ETL Pipeline',
        status: etlHealthy ? ('pass' as const) : ('warn' as const),
        message: etlHealthy ? 'ETL running normally' : 'ETL pipeline may be delayed',
        timestamp: new Date(),
      });

      if (!etlHealthy && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }

      // Check data freshness
      const dataFreshness = await this.getDataFreshness(tenantId);
      const dataFresh = dataFreshness < 60; // Less than 1 hour old
      
      checks.push({
        name: 'Data Freshness',
        status: dataFresh ? ('pass' as const) : ('warn' as const),
        message: `Data is ${dataFreshness} minutes old`,
        timestamp: new Date(),
      });

      // Check error rate
      const errorRate = await this.getErrorRate(tenantId);
      const errorRateOk = errorRate < 5; // Less than 5% error rate
      
      checks.push({
        name: 'Error Rate',
        status: errorRateOk ? ('pass' as const) : ('warn' as const),
        message: `${errorRate.toFixed(2)}% error rate in last hour`,
        timestamp: new Date(),
      });

      return {
        status: overallStatus,
        checks,
        lastETLRun,
        dataFreshness,
        errorRate,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to get analytics health for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Event handlers for real-time analytics
   */

  @OnEvent('pos.transaction.completed')
  async handleTransactionCompleted(event: any): Promise<void> {
    await this.trackEvent({
      tenantId: event.tenantId,
      eventType: 'transaction_completed',
      entityType: 'transaction',
      entityId: event.transaction.id,
      data: {
        total: event.transaction.total,
        itemCount: event.transaction.items?.length || 0,
        paymentMethod: event.transaction.paymentMethod,
        customerId: event.transaction.customerId,
        locationId: event.transaction.locationId,
      },
      metadata: {
        userId: event.userId,
        locationId: event.transaction.locationId,
        source: 'pos_system',
      },
    });
  }

  @OnEvent('inventory.level.changed')
  async handleInventoryChanged(event: any): Promise<void> {
    await this.trackEvent({
      tenantId: event.tenantId,
      eventType: 'inventory_changed',
      entityType: 'inventory',
      entityId: `${event.productId}_${event.locationId}`,
      data: {
        productId: event.productId,
        locationId: event.locationId,
        previousLevel: event.previousLevel,
        newLevel: event.newLevel,
        changeAmount: event.newLevel - event.previousLevel,
        changeReason: event.changeReason,
      },
      metadata: {
        userId: event.userId,
        locationId: event.locationId,
        source: 'inventory_system',
      },
    });
  }

  @OnEvent('customer.created')
  async handleCustomerCreated(event: any): Promise<void> {
    await this.trackEvent({
      tenantId: event.tenantId,
      eventType: 'customer_created',
      entityType: 'customer',
      entityId: event.customerId,
      data: {
        customerType: event.customer.type || 'individual',
        acquisitionChannel: event.customer.acquisitionChannel,
        locationId: event.customer.primaryLocationId,
      },
      metadata: {
        userId: event.userId,
        locationId: event.customer.primaryLocationId,
        source: 'crm_system',
      },
    });
  }

  /**
   * Private helper methods
   */

  private async initializeDefaultMetrics(tenantId: string): Promise<void> {
    const defaultMetrics: MetricDefinition[] = [
      {
        name: 'revenue',
        displayName: 'Revenue',
        description: 'Total revenue from transactions',
        type: 'counter',
        unit: 'currency',
        aggregations: ['sum'],
        dimensions: ['location', 'product_category', 'payment_method'],
      },
      {
        name: 'transaction_count',
        displayName: 'Transaction Count',
        description: 'Number of completed transactions',
        type: 'counter',
        unit: 'count',
        aggregations: ['count'],
        dimensions: ['location', 'payment_method'],
      },
      {
        name: 'average_order_value',
        displayName: 'Average Order Value',
        description: 'Average value per transaction',
        type: 'gauge',
        unit: 'currency',
        aggregations: ['avg'],
        dimensions: ['location', 'customer_segment'],
      },
      {
        name: 'customer_count',
        displayName: 'Customer Count',
        description: 'Total number of customers',
        type: 'gauge',
        unit: 'count',
        aggregations: ['count'],
        dimensions: ['location', 'customer_type'],
      },
      {
        name: 'inventory_turnover',
        displayName: 'Inventory Turnover',
        description: 'Rate of inventory movement',
        type: 'gauge',
        unit: 'ratio',
        aggregations: ['avg'],
        dimensions: ['location', 'product_category'],
      },
    ];

    for (const metric of defaultMetrics) {
      await this.storeMetricDefinition(tenantId, metric);
    }
  }

  private async setupAggregationJobs(tenantId: string, config: AnalyticsConfiguration): Promise<void> {
    for (const interval of config.aggregationIntervals) {
      await this.queueService.addAnalyticsJob(
        {
          eventType: `aggregate-metrics`,
          event: { tenantId, interval },
          tenantId,
        },
        {
          repeat: this.getRepeatOptions(interval),
          jobId: `aggregate-${tenantId}-${interval}`,
        }
      );
    }
  }

  private getRepeatOptions(interval: string) {
    switch (interval) {
      case 'hourly':
        return { cron: '0 * * * *' }; // Every hour
      case 'daily':
        return { cron: '0 1 * * *' }; // Daily at 1 AM
      case 'weekly':
        return { cron: '0 2 * * 0' }; // Weekly on Sunday at 2 AM
      case 'monthly':
        return { cron: '0 3 1 * *' }; // Monthly on 1st at 3 AM
      default:
        return { cron: '0 1 * * *' };
    }
  }

  private getEventPriority(eventType: string): number {
    const priorities: Record<string, number> = {
      'transaction_completed': 1, // Highest priority
      'inventory_changed': 2,
      'customer_created': 3,
      'user_action': 4,
      'system_event': 5, // Lowest priority
    };
    return priorities[eventType] || 5;
  }

  private async updateRealTimeMetrics(tenantId: string, event: AnalyticsEvent): Promise<void> {
    try {
      // Update real-time counters in cache
      const cacheKey = `realtime-metrics:${tenantId}`;
      const metrics = await this.cacheService.get<Record<string, number>>(cacheKey) || {};

      // Update relevant metrics based on event type
      switch (event.eventType) {
        case 'transaction_completed':
          metrics['transactions_today'] = (metrics['transactions_today'] || 0) + 1;
          metrics['revenue_today'] = (metrics['revenue_today'] || 0) + (event.data.total || 0);
          break;
        case 'customer_created':
          metrics['customers_today'] = (metrics['customers_today'] || 0) + 1;
          break;
        case 'inventory_changed':
          metrics['inventory_updates_today'] = (metrics['inventory_updates_today'] || 0) + 1;
          break;
      }

      // Cache with daily expiration
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const ttl = Math.floor((tomorrow.getTime() - Date.now()) / 1000);

      await this.cacheService.set(cacheKey, metrics, { ttl });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to update real-time metrics: ${errorMessage}`);
    }
  }

  private validateMetricDefinition(metric: MetricDefinition): void {
    if (!metric.name || !metric.displayName || !metric.type) {
      throw new Error('Metric definition must have name, displayName, and type');
    }

    const validTypes = ['counter', 'gauge', 'histogram', 'summary'];
    if (!validTypes.includes(metric.type)) {
      throw new Error(`Invalid metric type: ${metric.type}`);
    }

    const validAggregations = ['sum', 'avg', 'min', 'max', 'count'];
    for (const agg of metric.aggregations) {
      if (!validAggregations.includes(agg)) {
        throw new Error(`Invalid aggregation: ${agg}`);
      }
    }
  }

  private async storeAnalyticsConfiguration(tenantId: string, config: AnalyticsConfiguration): Promise<void> {
    // This would store in the database - for now, just log
    this.logger.debug(`Storing analytics configuration for tenant ${tenantId}:`, config);
  }

  private async loadAnalyticsConfiguration(tenantId: string): Promise<AnalyticsConfiguration | null> {
    // This would load from database - for now, return default config
    return {
      tenantId,
      dataRetentionDays: 365,
      aggregationIntervals: ['hourly', 'daily', 'weekly', 'monthly'],
      enabledMetrics: ['revenue', 'transaction_count', 'customer_count'],
      customDimensions: {},
      alertThresholds: {
        'revenue_drop': 20, // 20% drop triggers alert
        'error_rate': 5, // 5% error rate triggers alert
      },
      reportingSchedule: {
        daily: true,
        weekly: true,
        monthly: true,
        quarterly: false,
      },
    };
  }

  private async storeMetricDefinition(tenantId: string, metric: MetricDefinition): Promise<void> {
    // This would store in the database - for now, just log
    this.logger.debug(`Storing metric definition for tenant ${tenantId}:`, metric);
  }

  private async loadMetricDefinitions(tenantId: string): Promise<MetricDefinition[]> {
    // This would load from database - for now, return empty array
    return [];
  }

  private async setupCustomMetricCalculation(tenantId: string, metric: MetricDefinition): Promise<void> {
    // Set up background job for custom metric calculation
    await this.queueService.addAnalyticsJob(
      {
        eventType: 'calculate-custom-metric',
        event: { tenantId, metricName: metric.name },
        tenantId,
      },
      {
        repeat: { cron: '*/15 * * * *' }, // Every 15 minutes
        jobId: `custom-metric-${tenantId}-${metric.name}`,
      }
    );
  }

  private async getDataFreshness(tenantId: string): Promise<number> {
    // This would check the timestamp of the latest data in the warehouse
    // For now, return a mock value
    return Math.random() * 120; // 0-120 minutes
  }

  private async getErrorRate(tenantId: string): Promise<number> {
    // This would calculate the error rate from event processing logs
    // For now, return a mock value
    return Math.random() * 10; // 0-10% error rate
  }
}