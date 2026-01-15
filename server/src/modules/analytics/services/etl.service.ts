import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';
import { sql } from 'drizzle-orm';
import { AnalyticsConfiguration } from './analytics-foundation.service';

export interface ETLPipeline {
  id: string;
  name: string;
  tenantId: string;
  sourceType: 'database' | 'api' | 'file' | 'stream';
  sourceConfig: Record<string, any>;
  transformations: ETLTransformation[];
  destination: {
    type: 'warehouse' | 'cache' | 'file';
    config: Record<string, any>;
  };
  schedule: {
    type: 'cron' | 'interval' | 'event';
    expression: string;
  };
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'failed' | 'completed';
}

export interface ETLTransformation {
  id: string;
  type: 'filter' | 'map' | 'aggregate' | 'join' | 'validate' | 'enrich';
  config: Record<string, any>;
  order: number;
}

export interface ETLJobResult {
  pipelineId: string;
  startTime: Date;
  endTime: Date;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  errors: string[];
  performance: {
    extractTime: number;
    transformTime: number;
    loadTime: number;
    totalTime: number;
  };
}

@Injectable()
export class ETLService {
  private readonly logger = new Logger(ETLService.name);
  private activePipelines = new Map<string, ETLPipeline>();
  private runningJobs = new Map<string, Promise<ETLJobResult>>();

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Set up ETL pipelines for a tenant
   */
  async setupETLPipelines(tenantId: string, config: AnalyticsConfiguration): Promise<void> {
    try {
      this.logger.log(`Setting up ETL pipelines for tenant: ${tenantId}`);

      // Create default pipelines based on configuration
      const pipelines = await this.createDefaultPipelines(tenantId, config);

      // Register pipelines
      for (const pipeline of pipelines) {
        await this.registerPipeline(pipeline);
      }

      // Schedule pipeline execution
      await this.schedulePipelines(tenantId, pipelines);

      this.logger.log(`ETL pipelines set up for tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to setup ETL pipelines for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Reconfigure pipelines when configuration changes
   */
  async reconfigurePipelines(tenantId: string, config: AnalyticsConfiguration): Promise<void> {
    try {
      this.logger.log(`Reconfiguring ETL pipelines for tenant: ${tenantId}`);

      // Stop existing pipelines
      await this.stopTenantPipelines(tenantId);

      // Set up new pipelines
      await this.setupETLPipelines(tenantId, config);

      this.logger.log(`ETL pipelines reconfigured for tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to reconfigure ETL pipelines for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Execute ETL pipeline
   */
  async executePipeline(pipelineId: string): Promise<ETLJobResult> {
    try {
      const pipeline = this.activePipelines.get(pipelineId);
      if (!pipeline) {
        throw new Error(`Pipeline not found: ${pipelineId}`);
      }

      // Check if pipeline is already running
      if (this.runningJobs.has(pipelineId)) {
        this.logger.warn(`Pipeline ${pipelineId} is already running`);
        return await this.runningJobs.get(pipelineId)!;
      }

      this.logger.log(`Executing ETL pipeline: ${pipelineId}`);

      // Create and track job
      const jobPromise = this.runETLJob(pipeline);
      this.runningJobs.set(pipelineId, jobPromise);

      const result = await jobPromise;

      // Clean up
      this.runningJobs.delete(pipelineId);

      // Update pipeline status
      pipeline.lastRun = result.endTime;
      pipeline.status = result.recordsFailed > 0 ? 'failed' : 'completed';

      this.logger.log(`ETL pipeline completed: ${pipelineId} - ${result.recordsProcessed} records processed`);
      return result;
    } catch (error) {
      this.logger.error(`ETL pipeline failed: ${pipelineId}`, error);
      this.runningJobs.delete(pipelineId);
      throw error;
    }
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(pipelineId: string): Promise<{
    pipeline: ETLPipeline;
    isRunning: boolean;
    lastResult?: ETLJobResult;
  }> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    const lastResult = await this.getLastJobResult(pipelineId);
    const response: any = {
      pipeline,
      isRunning: this.runningJobs.has(pipelineId),
    };

    if (lastResult) {
      response.lastResult = lastResult;
    }

    return response;
  }

  /**
   * Get last run time for tenant
   */
  async getLastRunTime(tenantId: string): Promise<Date | null> {
    try {
      const tenantPipelines = Array.from(this.activePipelines.values())
        .filter(p => p.tenantId === tenantId);

      if (tenantPipelines.length === 0) {
        return null;
      }

      const lastRuns = tenantPipelines
        .map(p => p.lastRun)
        .filter(date => date !== undefined) as Date[];

      if (lastRuns.length === 0) {
        return null;
      }

      return new Date(Math.max(...lastRuns.map(d => d.getTime())));
    } catch (error) {
      this.logger.error(`Failed to get last run time for tenant ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Scheduled ETL jobs
   */

  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyETL(): Promise<void> {
    await this.runScheduledPipelines('hourly');
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyETL(): Promise<void> {
    await this.runScheduledPipelines('daily');
  }

  @Cron('0 2 * * 0') // Weekly on Sunday at 2 AM
  async runWeeklyETL(): Promise<void> {
    await this.runScheduledPipelines('weekly');
  }

  @Cron('0 3 1 * *') // Monthly on 1st at 3 AM
  async runMonthlyETL(): Promise<void> {
    await this.runScheduledPipelines('monthly');
  }

  /**
   * Private helper methods
   */

  private async createDefaultPipelines(tenantId: string, config: AnalyticsConfiguration): Promise<ETLPipeline[]> {
    const pipelines: ETLPipeline[] = [];

    // Transaction data pipeline
    pipelines.push({
      id: `${tenantId}-transactions-etl`,
      name: 'Transaction Data ETL',
      tenantId,
      sourceType: 'database',
      sourceConfig: {
        tables: ['transactions', 'transaction_items'],
        incrementalColumn: 'created_at',
      },
      transformations: [
        {
          id: 'validate-transactions',
          type: 'validate',
          config: {
            rules: [
              { field: 'total', type: 'number', min: 0 },
              { field: 'tenant_id', type: 'uuid', required: true },
            ],
          },
          order: 1,
        },
        {
          id: 'enrich-transactions',
          type: 'enrich',
          config: {
            joins: [
              { table: 'customers', on: 'customer_id', fields: ['customer_segment'] },
              { table: 'locations', on: 'location_id', fields: ['location_type'] },
            ],
          },
          order: 2,
        },
        {
          id: 'aggregate-daily',
          type: 'aggregate',
          config: {
            groupBy: ['transaction_date', 'location_id'],
            measures: [
              { field: 'total', operation: 'sum', alias: 'daily_revenue' },
              { field: 'id', operation: 'count', alias: 'transaction_count' },
            ],
          },
          order: 3,
        },
      ],
      destination: {
        type: 'warehouse',
        config: {
          schema: `analytics_${tenantId.replace(/-/g, '_')}`,
          table: 'fact_transactions',
        },
      },
      schedule: {
        type: 'cron',
        expression: '0 */4 * * *', // Every 4 hours
      },
      enabled: true,
      status: 'idle',
    });

    // Inventory data pipeline
    pipelines.push({
      id: `${tenantId}-inventory-etl`,
      name: 'Inventory Data ETL',
      tenantId,
      sourceType: 'database',
      sourceConfig: {
        tables: ['inventory_levels', 'stock_movements'],
        incrementalColumn: 'updated_at',
      },
      transformations: [
        {
          id: 'calculate-inventory-metrics',
          type: 'map',
          config: {
            calculations: [
              { field: 'turnover_rate', expression: 'quantity_sold / average_stock' },
              { field: 'days_of_supply', expression: 'current_stock / daily_usage' },
            ],
          },
          order: 1,
        },
        {
          id: 'aggregate-inventory',
          type: 'aggregate',
          config: {
            groupBy: ['snapshot_date', 'location_id', 'product_id'],
            measures: [
              { field: 'current_level', operation: 'last', alias: 'ending_quantity' },
              { field: 'quantity_sold', operation: 'sum', alias: 'total_sold' },
            ],
          },
          order: 2,
        },
      ],
      destination: {
        type: 'warehouse',
        config: {
          schema: `analytics_${tenantId.replace(/-/g, '_')}`,
          table: 'fact_inventory',
        },
      },
      schedule: {
        type: 'cron',
        expression: '0 2 * * *', // Daily at 2 AM
      },
      enabled: true,
      status: 'idle',
    });

    // Customer analytics pipeline
    pipelines.push({
      id: `${tenantId}-customers-etl`,
      name: 'Customer Analytics ETL',
      tenantId,
      sourceType: 'database',
      sourceConfig: {
        tables: ['customers', 'transactions'],
        incrementalColumn: 'updated_at',
      },
      transformations: [
        {
          id: 'calculate-customer-metrics',
          type: 'map',
          config: {
            calculations: [
              { field: 'lifetime_value', expression: 'SUM(transaction_total)' },
              { field: 'avg_order_value', expression: 'AVG(transaction_total)' },
              { field: 'days_since_last_purchase', expression: 'CURRENT_DATE - MAX(transaction_date)' },
            ],
          },
          order: 1,
        },
        {
          id: 'segment-customers',
          type: 'enrich',
          config: {
            segmentation: {
              rules: [
                { segment: 'high_value', condition: 'lifetime_value > 1000' },
                { segment: 'frequent', condition: 'transaction_count > 10' },
                { segment: 'at_risk', condition: 'days_since_last_purchase > 90' },
              ],
            },
          },
          order: 2,
        },
      ],
      destination: {
        type: 'warehouse',
        config: {
          schema: `analytics_${tenantId.replace(/-/g, '_')}`,
          table: 'fact_customers',
        },
      },
      schedule: {
        type: 'cron',
        expression: '0 3 * * *', // Daily at 3 AM
      },
      enabled: true,
      status: 'idle',
    });

    return pipelines;
  }

  private async registerPipeline(pipeline: ETLPipeline): Promise<void> {
    this.activePipelines.set(pipeline.id, pipeline);
    this.logger.debug(`Registered ETL pipeline: ${pipeline.id}`);
  }

  private async schedulePipelines(tenantId: string, pipelines: ETLPipeline[]): Promise<void> {
    for (const pipeline of pipelines) {
      if (pipeline.enabled && pipeline.schedule.type === 'cron') {
        // Schedule pipeline execution
        await this.queueService.add(
          'etl-pipeline',
          { pipelineId: pipeline.id },
          {
            repeat: { cron: pipeline.schedule.expression },
            jobId: `etl-${pipeline.id}`,
          }
        );
      }
    }
  }

  private async stopTenantPipelines(tenantId: string): Promise<void> {
    const tenantPipelines = Array.from(this.activePipelines.values())
      .filter(p => p.tenantId === tenantId);

    for (const pipeline of tenantPipelines) {
      // Remove from active pipelines
      this.activePipelines.delete(pipeline.id);

      // Note: QueueService doesn't have removeRepeatable method
      // Scheduled jobs should be handled by the queue configuration
      this.logger.debug(`Scheduled jobs for pipeline ${pipeline.id} will need manual cleanup`);
    }
  }

  private async runETLJob(pipeline: ETLPipeline): Promise<ETLJobResult> {
    const startTime = new Date();
    const result: ETLJobResult = {
      pipelineId: pipeline.id,
      startTime,
      endTime: new Date(),
      recordsProcessed: 0,
      recordsSuccessful: 0,
      recordsFailed: 0,
      errors: [],
      performance: {
        extractTime: 0,
        transformTime: 0,
        loadTime: 0,
        totalTime: 0,
      },
    };

    try {
      // Update pipeline status
      pipeline.status = 'running';

      // Extract phase
      const extractStart = Date.now();
      const extractedData = await this.extractData(pipeline);
      result.performance.extractTime = Date.now() - extractStart;
      result.recordsProcessed = extractedData.length;

      // Transform phase
      const transformStart = Date.now();
      const transformedData = await this.transformData(extractedData, pipeline.transformations);
      result.performance.transformTime = Date.now() - transformStart;

      // Load phase
      const loadStart = Date.now();
      const loadResult = await this.loadData(transformedData, pipeline.destination);
      result.performance.loadTime = Date.now() - loadStart;

      result.recordsSuccessful = loadResult.successCount;
      result.recordsFailed = loadResult.failureCount;
      result.errors = loadResult.errors;

      result.endTime = new Date();
      result.performance.totalTime = result.endTime.getTime() - startTime.getTime();

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.endTime = new Date();
      result.errors.push(err.message);
      result.recordsFailed = result.recordsProcessed;
      result.recordsSuccessful = 0;
      pipeline.status = 'failed';
      throw error;
    }
  }

  private async extractData(pipeline: ETLPipeline): Promise<any[]> {
    switch (pipeline.sourceType) {
      case 'database':
        return await this.extractFromDatabase(pipeline);
      case 'api':
        return await this.extractFromAPI(pipeline);
      case 'file':
        return await this.extractFromFile(pipeline);
      default:
        throw new Error(`Unsupported source type: ${pipeline.sourceType}`);
    }
  }

  private async extractFromDatabase(pipeline: ETLPipeline): Promise<any[]> {
    const { tables, incrementalColumn } = pipeline.sourceConfig;
    const data: any[] = [];

    for (const table of tables) {
      let whereClause = `WHERE tenant_id = '${pipeline.tenantId}'`;

      // Add incremental extraction if configured
      if (incrementalColumn && pipeline.lastRun) {
        const lastRunIso = pipeline.lastRun.toISOString();
        whereClause += ` AND ${incrementalColumn} > '${lastRunIso}'`;
      }

      const query = `SELECT * FROM ${table} ${whereClause}`;
      const result = await this.drizzle.executeRawSQL(query);
      data.push(...result.rows);
    }

    return data;
  }

  private async extractFromAPI(pipeline: ETLPipeline): Promise<any[]> {
    // Implementation for API extraction
    // This would make HTTP requests to external APIs
    return [];
  }

  private async extractFromFile(pipeline: ETLPipeline): Promise<any[]> {
    // Implementation for file extraction
    // This would read from CSV, JSON, or other file formats
    return [];
  }

  private async transformData(data: any[], transformations: ETLTransformation[]): Promise<any[]> {
    let transformedData = [...data];

    // Sort transformations by order
    const sortedTransformations = transformations.sort((a, b) => a.order - b.order);

    for (const transformation of sortedTransformations) {
      transformedData = await this.applyTransformation(transformedData, transformation);
    }

    return transformedData;
  }

  private async applyTransformation(data: any[], transformation: ETLTransformation): Promise<any[]> {
    switch (transformation.type) {
      case 'filter':
        return this.applyFilter(data, transformation.config);
      case 'map':
        return this.applyMap(data, transformation.config);
      case 'aggregate':
        return this.applyAggregate(data, transformation.config);
      case 'validate':
        return this.applyValidation(data, transformation.config);
      case 'enrich':
        return await this.applyEnrichment(data, transformation.config);
      default:
        return data;
    }
  }

  private applyFilter(data: any[], config: any): any[] {
    // Apply filtering logic based on config
    return data.filter(record => {
      // Implementation would depend on filter configuration
      return true;
    });
  }

  private applyMap(data: any[], config: any): any[] {
    return data.map(record => {
      const mapped = { ...record };
      
      // Apply calculations if configured
      if (config.calculations) {
        for (const calc of config.calculations) {
          // Simple expression evaluation (in production, use a proper expression engine)
          mapped[calc.field] = this.evaluateExpression(calc.expression, record);
        }
      }

      return mapped;
    });
  }

  private applyAggregate(data: any[], config: any): any[] {
    const { groupBy, measures } = config;
    const groups = new Map<string, any[]>();

    // Group data
    for (const record of data) {
      const key = groupBy.map((field: string) => record[field]).join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    // Calculate aggregates
    const aggregated: any[] = [];
    for (const [key, records] of groups) {
      const aggregate: any = {};
      
      // Set group by fields
      groupBy.forEach((field: string, index: number) => {
        aggregate[field] = key.split('|')[index];
      });

      // Calculate measures
      for (const measure of measures) {
        const values = records.map(r => r[measure.field]).filter(v => v != null);
        
        switch (measure.operation) {
          case 'sum':
            aggregate[measure.alias] = values.reduce((sum, val) => sum + val, 0);
            break;
          case 'avg':
            aggregate[measure.alias] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
            break;
          case 'count':
            aggregate[measure.alias] = values.length;
            break;
          case 'min':
            aggregate[measure.alias] = values.length > 0 ? Math.min(...values) : null;
            break;
          case 'max':
            aggregate[measure.alias] = values.length > 0 ? Math.max(...values) : null;
            break;
          case 'last':
            aggregate[measure.alias] = values.length > 0 ? values[values.length - 1] : null;
            break;
        }
      }

      aggregated.push(aggregate);
    }

    return aggregated;
  }

  private applyValidation(data: any[], config: any): any[] {
    return data.filter(record => {
      for (const rule of config.rules) {
        const value = record[rule.field];
        
        if (rule.required && (value == null || value === '')) {
          return false;
        }
        
        if (rule.type === 'number' && typeof value !== 'number') {
          return false;
        }
        
        if (rule.min != null && value < rule.min) {
          return false;
        }
        
        if (rule.max != null && value > rule.max) {
          return false;
        }
      }
      
      return true;
    });
  }

  private async applyEnrichment(data: any[], config: any): Promise<any[]> {
    // Implementation for data enrichment (joins, lookups, etc.)
    // This would involve database queries or API calls to enrich the data
    return data;
  }

  private async loadData(data: any[], destination: any): Promise<{
    successCount: number;
    failureCount: number;
    errors: string[];
  }> {
    const result: {
      successCount: number;
      failureCount: number;
      errors: string[];
    } = {
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    try {
      switch (destination.type) {
        case 'warehouse':
          await this.loadToWarehouse(data, destination.config);
          result.successCount = data.length;
          break;
        case 'cache':
          await this.loadToCache(data, destination.config);
          result.successCount = data.length;
          break;
        default:
          throw new Error(`Unsupported destination type: ${destination.type}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.failureCount = data.length;
      result.errors.push(err.message);
    }

    return result;
  }

  private async loadToWarehouse(data: any[], config: any): Promise<void> {
    const { schema, table } = config;
    
    if (data.length === 0) {
      return;
    }

    // Batch insert data into warehouse
    const batchSize = 1000;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      // Use upsert to handle duplicates
      const columns = Object.keys(batch[0]).join(', ');
      const values = batch.map(record => 
        `(${Object.values(record).map(val => 
          val === null ? 'NULL' : typeof val === 'string' ? `'${val.replace(/'/g, "''")}' ` : val
        ).join(', ')})`
      ).join(', ');
      const updates = Object.keys(batch[0]).filter(key => key !== 'id').map(key => 
        `${key} = EXCLUDED.${key}`
      ).join(', ');
      
      const insertQuery = `
        INSERT INTO "${schema}"."${table}" (${columns})
        VALUES ${values}
        ON CONFLICT (id) DO UPDATE SET ${updates}
      `;
      
      await this.drizzle.executeRawSQL(insertQuery);
    }
  }

  private async loadToCache(data: any[], config: any): Promise<void> {
    const { key, ttl = 3600 } = config;
    await this.cacheService.set(key, data, { ttl });
  }

  private evaluateExpression(expression: string, record: any): any {
    // Simple expression evaluation
    // In production, use a proper expression engine like mathjs
    try {
      // Replace field names with values
      let evaluatedExpression = expression;
      for (const [key, value] of Object.entries(record)) {
        evaluatedExpression = evaluatedExpression.replace(
          new RegExp(`\\b${key}\\b`, 'g'),
          String(value)
        );
      }
      
      // Basic math evaluation (unsafe - use proper parser in production)
      return Function(`"use strict"; return (${evaluatedExpression})`)();
    } catch (error) {
      return null;
    }
  }

  private async runScheduledPipelines(interval: string): Promise<void> {
    try {
      const pipelines = Array.from(this.activePipelines.values())
        .filter(p => p.enabled && p.schedule.expression.includes(this.getIntervalCron(interval)));

      this.logger.log(`Running ${interval} ETL pipelines: ${pipelines.length} pipelines`);

      const results = await Promise.allSettled(
        pipelines.map(pipeline => this.executePipeline(pipeline.id))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.logger.log(`${interval} ETL completed: ${successful} successful, ${failed} failed`);
    } catch (error) {
      this.logger.error(`Failed to run ${interval} ETL pipelines:`, error);
    }
  }

  private getIntervalCron(interval: string): string {
    switch (interval) {
      case 'hourly': return '0 * * * *';
      case 'daily': return '0 1 * * *';
      case 'weekly': return '0 2 * * 0';
      case 'monthly': return '0 3 1 * *';
      default: return '';
    }
  }

  private async getLastJobResult(pipelineId: string): Promise<ETLJobResult | undefined> {
    // This would retrieve from a job results store
    // For now, return undefined
    return undefined;
  }
}