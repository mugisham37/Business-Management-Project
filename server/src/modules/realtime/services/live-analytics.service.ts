import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RealtimeService } from './realtime.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface LiveAnalyticsData {
  overview: {
    totalRevenue: number;
    totalTransactions: number;
    totalCustomers: number;
    totalProducts: number;
    averageOrderValue: number;
    conversionRate: number;
    timestamp: Date;
  };
  realTimeMetrics: {
    currentHourRevenue: number;
    currentHourTransactions: number;
    activeUsers: number;
    salesVelocity: number; // revenue per minute
    topSellingProduct: {
      productId: string;
      productName: string;
      unitsSold: number;
      revenue: number;
    } | null;
  };
  trends: {
    revenueGrowth: {
      hourly: number;
      daily: number;
      weekly: number;
      monthly: number;
    };
    customerGrowth: {
      daily: number;
      weekly: number;
      monthly: number;
    };
    inventoryTurnover: number;
    profitMargin: number;
  };
  locationPerformance: Array<{
    locationId: string;
    locationName: string;
    revenue: number;
    transactions: number;
    customers: number;
    growth: number;
    efficiency: number; // revenue per employee
  }>;
  productPerformance: Array<{
    productId: string;
    productName: string;
    unitsSold: number;
    revenue: number;
    profitMargin: number;
    inventoryTurnover: number;
    growth: number;
  }>;
  customerSegments: Array<{
    segment: string;
    customerCount: number;
    averageOrderValue: number;
    totalRevenue: number;
    retentionRate: number;
    growthRate: number;
  }>;
}

export interface AnalyticsAlert {
  id: string;
  type: 'performance' | 'inventory' | 'customer' | 'financial' | 'operational';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data: Record<string, any>;
  threshold?: {
    metric: string;
    value: number;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  };
  timestamp: Date;
  locationId?: string;
}

export interface KPIMetric {
  name: string;
  value: number;
  unit: string;
  change: number; // percentage change
  changeDirection: 'up' | 'down' | 'stable';
  target?: number;
  status: 'good' | 'warning' | 'critical';
  timestamp: Date;
}

@Injectable()
export class LiveAnalyticsService {
  private readonly logger = new Logger(LiveAnalyticsService.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  /**
   * Handle transaction events for analytics
   */
  @OnEvent('pos.transaction.completed')
  async handleTransactionCompleted(event: {
    tenantId: string;
    transaction: any;
    paymentResult: any;
    processingTime: number;
    userId: string;
  }): Promise<void> {
    try {
      this.logger.log(`Processing transaction analytics: ${event.transaction.id}`);

      // Update real-time analytics cache
      await this.updateAnalyticsCache(event.tenantId);

      // Check for analytics alerts
      await this.checkAnalyticsAlerts(event.tenantId, event.transaction);

      // Update KPI metrics
      await this.updateKPIMetrics(event.tenantId, event.transaction);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle transaction analytics: ${err.message}`, err.stack);
    }
  }

  /**
   * Handle inventory changes for analytics
   */
  @OnEvent('inventory.level.changed')
  async handleInventoryChanged(event: {
    tenantId: string;
    productId: string;
    variantId: string | null;
    locationId: string;
    previousLevel: number;
    newLevel: number;
    changeReason: string;
    userId: string;
  }): Promise<void> {
    try {
      this.logger.log(`Processing inventory analytics: ${event.productId}`);

      // Update analytics cache
      await this.updateAnalyticsCache(event.tenantId);

      // Check for inventory-related alerts
      if (event.newLevel <= 10 && event.previousLevel > 10) {
        await this.sendAnalyticsAlert(event.tenantId, {
          id: `low-inventory-${event.productId}-${Date.now()}`,
          type: 'inventory',
          severity: 'warning',
          title: 'Low Inventory Alert',
          message: `Product ${event.productId} is running low (${event.newLevel} units remaining)`,
          data: {
            productId: event.productId,
            locationId: event.locationId,
            currentLevel: event.newLevel,
            previousLevel: event.previousLevel,
          },
          timestamp: new Date(),
          locationId: event.locationId,
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle inventory analytics: ${err.message}`, err.stack);
    }
  }

  /**
   * Handle customer events for analytics
   */
  @OnEvent('customer.created')
  async handleCustomerCreated(event: {
    tenantId: string;
    customerId: string;
    customer: any;
    userId: string;
  }): Promise<void> {
    try {
      this.logger.log(`Processing customer analytics: ${event.customerId}`);

      // Update analytics cache
      await this.updateAnalyticsCache(event.tenantId);

      // Check for customer milestone alerts
      const customerCount = await this.getCustomerCount(event.tenantId);
      if (customerCount % 100 === 0) {
        await this.sendAnalyticsAlert(event.tenantId, {
          id: `customer-milestone-${customerCount}`,
          type: 'customer',
          severity: 'info',
          title: 'Customer Milestone Reached',
          message: `Congratulations! You now have ${customerCount} customers.`,
          data: {
            customerCount,
            milestone: customerCount,
          },
          timestamp: new Date(),
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle customer analytics: ${err.message}`, err.stack);
    }
  }

  /**
   * Get live analytics dashboard data
   */
  async getLiveAnalyticsData(tenantId: string, locationId?: string): Promise<LiveAnalyticsData> {
    try {
      const cacheKey = `live-analytics:${tenantId}:${locationId || 'all'}`;
      
      // Try cache first
      let analyticsData = await this.cacheService.get<LiveAnalyticsData>(cacheKey);
      
      if (!analyticsData) {
        // Generate analytics data
        analyticsData = await this.generateLiveAnalyticsData(tenantId, locationId);
        
        // Cache for 1 minute (short cache for real-time data)
        await this.cacheService.set(cacheKey, analyticsData, { ttl: 60 });
      }

      return analyticsData;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get live analytics data: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get real-time KPI metrics
   */
  async getKPIMetrics(tenantId: string, locationId?: string): Promise<KPIMetric[]> {
    try {
      const cacheKey = `kpi-metrics:${tenantId}:${locationId || 'all'}`;
      
      // Try cache first
      let kpiMetrics = await this.cacheService.get<KPIMetric[]>(cacheKey);
      
      if (!kpiMetrics) {
        // Generate KPI metrics
        kpiMetrics = await this.generateKPIMetrics(tenantId, locationId);
        
        // Cache for 2 minutes
        await this.cacheService.set(cacheKey, kpiMetrics, { ttl: 120 });
      }

      return kpiMetrics;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get KPI metrics: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get analytics alerts
   */
  async getAnalyticsAlerts(
    tenantId: string,
    options: {
      severity?: 'info' | 'warning' | 'critical';
      type?: string;
      locationId?: string;
      limit?: number;
    } = {},
  ): Promise<AnalyticsAlert[]> {
    try {
      const cacheKey = `analytics-alerts:${tenantId}:${JSON.stringify(options)}`;
      
      // Try cache first
      let alerts = await this.cacheService.get<AnalyticsAlert[]>(cacheKey);
      
      if (!alerts) {
        // Generate alerts (this would come from a persistent store)
        alerts = await this.generateAnalyticsAlerts(tenantId, options);
        
        // Cache for 30 seconds
        await this.cacheService.set(cacheKey, alerts, { ttl: 30 });
      }

      return alerts;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get analytics alerts: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Create custom analytics alert
   */
  async createAnalyticsAlert(tenantId: string, alert: Omit<AnalyticsAlert, 'id' | 'timestamp'>): Promise<AnalyticsAlert> {
    try {
      const fullAlert: AnalyticsAlert = {
        ...alert,
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };

      // Send the alert
      await this.sendAnalyticsAlert(tenantId, fullAlert);

      return fullAlert;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to create analytics alert: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Subscribe to live analytics updates
   */
  async subscribeToAnalyticsUpdates(
    tenantId: string,
    locationId?: string,
  ): Promise<{ subscriptionId: string; initialData: LiveAnalyticsData }> {
    try {
      const subscriptionId = `analytics-${tenantId}-${locationId || 'all'}-${Date.now()}`;
      
      // Get initial analytics data
      const initialData = await this.getLiveAnalyticsData(tenantId, locationId);
      
      this.logger.log(
        `Created analytics subscription ${subscriptionId} for tenant ${tenantId}`,
      );

      return {
        subscriptionId,
        initialData,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to create analytics subscription: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get performance comparison data
   */
  async getPerformanceComparison(
    tenantId: string,
    period: 'hour' | 'day' | 'week' | 'month',
    locationId?: string,
  ): Promise<{
    current: any;
    previous: any;
    change: number;
    changeDirection: 'up' | 'down' | 'stable';
  }> {
    try {
      const cacheKey = `performance-comparison:${tenantId}:${period}:${locationId || 'all'}`;
      
      // Try cache first
      let comparison = await this.cacheService.get<any>(cacheKey);
      
      if (!comparison) {
        // Generate comparison data (mock for now)
        const current = Math.random() * 10000 + 5000;
        const previous = Math.random() * 10000 + 5000;
        const change = ((current - previous) / previous) * 100;
        
        comparison = {
          current,
          previous,
          change,
          changeDirection: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
        };
        
        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, comparison, { ttl: 300 });
      }

      return comparison;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get performance comparison: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Private helper methods
   */

  private async updateAnalyticsCache(tenantId: string): Promise<void> {
    try {
      // Invalidate all analytics caches for this tenant
      await this.cacheService.invalidatePattern(`live-analytics:${tenantId}:*`);
      await this.cacheService.invalidatePattern(`kpi-metrics:${tenantId}:*`);
      await this.cacheService.invalidatePattern(`performance-comparison:${tenantId}:*`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Failed to update analytics cache: ${err.message}`);
    }
  }

  private async checkAnalyticsAlerts(tenantId: string, transaction: any): Promise<void> {
    try {
      // Check for high-value transaction alert
      if (transaction.total >= 1000) {
        await this.sendAnalyticsAlert(tenantId, {
          id: `high-value-transaction-${transaction.id}`,
          type: 'financial',
          severity: 'info',
          title: 'High-Value Transaction',
          message: `Large transaction of $${transaction.total.toFixed(2)} completed`,
          data: {
            transactionId: transaction.id,
            amount: transaction.total,
            locationId: transaction.locationId,
          },
          timestamp: new Date(),
          locationId: transaction.locationId,
        });
      }

      // Check for sales velocity alert
      const currentHourSales = await this.getCurrentHourSales(tenantId, transaction.locationId);
      if (currentHourSales >= 5000) {
        await this.sendAnalyticsAlert(tenantId, {
          id: `high-sales-velocity-${Date.now()}`,
          type: 'performance',
          severity: 'info',
          title: 'High Sales Velocity',
          message: `Exceptional sales performance: $${currentHourSales.toFixed(2)} in current hour`,
          data: {
            currentHourSales,
            locationId: transaction.locationId,
          },
          timestamp: new Date(),
          locationId: transaction.locationId,
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Failed to check analytics alerts: ${err.message}`);
    }
  }

  private async updateKPIMetrics(tenantId: string, transaction: any): Promise<void> {
    try {
      // This would update actual KPI calculations
      // For now, just invalidate the cache to force recalculation
      await this.cacheService.invalidatePattern(`kpi-metrics:${tenantId}:*`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Failed to update KPI metrics: ${err.message}`);
    }
  }

  private async sendAnalyticsAlert(tenantId: string, alert: AnalyticsAlert): Promise<void> {
    try {
      // Send real-time notification
      await this.realtimeService.sendNotification(tenantId, {
        id: alert.id,
        type: alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info',
        title: alert.title,
        message: alert.message,
        priority: alert.severity === 'critical' ? 'urgent' : alert.severity === 'warning' ? 'high' : 'medium',
        metadata: {
          alertType: alert.type,
          alertData: alert.data,
          locationId: alert.locationId,
        },
      });

      // Store alert (this would go to a persistent store)
      const alertsCacheKey = `analytics-alerts:${tenantId}:stored`;
      const existingAlerts = await this.cacheService.get<AnalyticsAlert[]>(alertsCacheKey) || [];
      existingAlerts.unshift(alert);
      
      // Keep only last 100 alerts
      if (existingAlerts.length > 100) {
        existingAlerts.splice(100);
      }
      
      await this.cacheService.set(alertsCacheKey, existingAlerts, { ttl: 3600 }); // 1 hour

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send analytics alert: ${err.message}`, err.stack);
    }
  }

  private async getCustomerCount(tenantId: string): Promise<number> {
    // This would integrate with actual customer service
    return Math.floor(Math.random() * 1000) + 500;
  }

  private async getCurrentHourSales(tenantId: string, locationId: string): Promise<number> {
    // This would integrate with actual POS service
    return Math.random() * 10000;
  }

  private async generateLiveAnalyticsData(tenantId: string, locationId?: string): Promise<LiveAnalyticsData> {
    // This would integrate with actual services for real data
    // For now, returning mock data structure
    return {
      overview: {
        totalRevenue: Math.random() * 100000 + 50000,
        totalTransactions: Math.floor(Math.random() * 1000) + 500,
        totalCustomers: Math.floor(Math.random() * 5000) + 2000,
        totalProducts: Math.floor(Math.random() * 500) + 200,
        averageOrderValue: Math.random() * 100 + 50,
        conversionRate: Math.random() * 20 + 70, // 70-90%
        timestamp: new Date(),
      },
      realTimeMetrics: {
        currentHourRevenue: Math.random() * 5000 + 1000,
        currentHourTransactions: Math.floor(Math.random() * 50) + 10,
        activeUsers: Math.floor(Math.random() * 20) + 5,
        salesVelocity: Math.random() * 100 + 20,
        topSellingProduct: {
          productId: 'prod-001',
          productName: 'Best Seller',
          unitsSold: Math.floor(Math.random() * 50) + 10,
          revenue: Math.random() * 2000 + 500,
        },
      },
      trends: {
        revenueGrowth: {
          hourly: Math.random() * 20 - 10,
          daily: Math.random() * 15 - 7.5,
          weekly: Math.random() * 25 - 12.5,
          monthly: Math.random() * 30 - 15,
        },
        customerGrowth: {
          daily: Math.random() * 10 - 5,
          weekly: Math.random() * 20 - 10,
          monthly: Math.random() * 40 - 20,
        },
        inventoryTurnover: Math.random() * 5 + 2,
        profitMargin: Math.random() * 30 + 20, // 20-50%
      },
      locationPerformance: [
        {
          locationId: 'loc-001',
          locationName: 'Main Store',
          revenue: Math.random() * 50000 + 25000,
          transactions: Math.floor(Math.random() * 500) + 250,
          customers: Math.floor(Math.random() * 2000) + 1000,
          growth: Math.random() * 20 - 10,
          efficiency: Math.random() * 10000 + 5000,
        },
      ],
      productPerformance: [
        {
          productId: 'prod-001',
          productName: 'Top Product',
          unitsSold: Math.floor(Math.random() * 100) + 50,
          revenue: Math.random() * 10000 + 5000,
          profitMargin: Math.random() * 40 + 20,
          inventoryTurnover: Math.random() * 8 + 2,
          growth: Math.random() * 30 - 15,
        },
      ],
      customerSegments: [
        {
          segment: 'VIP Customers',
          customerCount: Math.floor(Math.random() * 100) + 50,
          averageOrderValue: Math.random() * 200 + 100,
          totalRevenue: Math.random() * 20000 + 10000,
          retentionRate: Math.random() * 20 + 80,
          growthRate: Math.random() * 15 - 7.5,
        },
      ],
    };
  }

  private async generateKPIMetrics(tenantId: string, locationId?: string): Promise<KPIMetric[]> {
    // This would calculate actual KPIs from business data
    return [
      {
        name: 'Revenue',
        value: Math.random() * 100000 + 50000,
        unit: 'USD',
        change: Math.random() * 20 - 10,
        changeDirection: Math.random() > 0.5 ? 'up' : 'down',
        target: 75000,
        status: 'good',
        timestamp: new Date(),
      },
      {
        name: 'Transactions',
        value: Math.floor(Math.random() * 1000) + 500,
        unit: 'count',
        change: Math.random() * 15 - 7.5,
        changeDirection: Math.random() > 0.5 ? 'up' : 'down',
        target: 800,
        status: 'warning',
        timestamp: new Date(),
      },
      {
        name: 'Average Order Value',
        value: Math.random() * 100 + 50,
        unit: 'USD',
        change: Math.random() * 10 - 5,
        changeDirection: 'stable',
        target: 75,
        status: 'good',
        timestamp: new Date(),
      },
      {
        name: 'Customer Satisfaction',
        value: Math.random() * 20 + 80,
        unit: '%',
        change: Math.random() * 5 - 2.5,
        changeDirection: 'up',
        target: 85,
        status: 'good',
        timestamp: new Date(),
      },
    ];
  }

  private async generateAnalyticsAlerts(tenantId: string, options: any): Promise<AnalyticsAlert[]> {
    // This would come from a persistent alert store
    const mockAlerts: AnalyticsAlert[] = [
      {
        id: 'alert-001',
        type: 'performance',
        severity: 'info',
        title: 'Sales Target Achieved',
        message: 'Daily sales target has been reached 2 hours early',
        data: { targetAmount: 10000, actualAmount: 10500 },
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      },
      {
        id: 'alert-002',
        type: 'inventory',
        severity: 'warning',
        title: 'Low Stock Alert',
        message: '5 products are running low on inventory',
        data: { lowStockCount: 5, criticalStockCount: 2 },
        timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
    ];

    return mockAlerts.filter(alert => {
      if (options.severity && alert.severity !== options.severity) return false;
      if (options.type && alert.type !== options.type) return false;
      if (options.locationId && alert.locationId !== options.locationId) return false;
      return true;
    }).slice(0, options.limit || 50);
  }
}