import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RealtimeService } from './realtime.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface LiveSalesUpdate {
  type: 'transaction_completed' | 'transaction_voided' | 'transaction_refunded' | 'milestone_achieved';
  transactionId?: string;
  locationId: string;
  amount: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SalesDashboardData {
  today: {
    totalSales: number;
    transactionCount: number;
    averageTransactionValue: number;
    hourlyBreakdown: Array<{
      hour: number;
      sales: number;
      transactions: number;
    }>;
  };
  realTime: {
    currentHourSales: number;
    currentHourTransactions: number;
    lastTransactionTime: Date | null;
    salesVelocity: number; // sales per minute
    targetProgress: {
      dailyTarget: number;
      currentProgress: number;
      percentageComplete: number;
      projectedTotal: number;
    };
  };
  trends: {
    salesGrowth: number; // percentage vs yesterday
    transactionGrowth: number; // percentage vs yesterday
    averageGrowth: number; // percentage vs yesterday
  };
  topPerformers: {
    locations: Array<{
      locationId: string;
      locationName: string;
      sales: number;
      transactions: number;
      growth: number;
    }>;
    products: Array<{
      productId: string;
      productName: string;
      quantitySold: number;
      revenue: number;
      growth: number;
    }>;
    employees: Array<{
      employeeId: string;
      employeeName: string;
      sales: number;
      transactions: number;
      averageTransactionValue: number;
    }>;
  };
  paymentMethods: Array<{
    method: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
}

export interface SalesMilestone {
  type: 'daily_target' | 'revenue_milestone' | 'weekly_target' | 'monthly_target';
  title: string;
  description: string;
  value: number;
  target: number;
  locationId?: string;
  achievedBy?: string;
  achievedAt: Date;
}

@Injectable()
export class LiveSalesDashboardService {
  private readonly logger = new Logger(LiveSalesDashboardService.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  /**
   * Handle completed POS transactions
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
      this.logger.log(
        `Processing completed transaction: ${event.transaction.id} - $${event.transaction.total}`,
      );

      // Create live sales update
      const update: LiveSalesUpdate = {
        type: 'transaction_completed',
        transactionId: event.transaction.id,
        locationId: event.transaction.locationId,
        amount: event.transaction.total,
        timestamp: new Date(),
        metadata: {
          paymentMethod: event.transaction.paymentMethod,
          itemCount: event.transaction.itemCount,
          processingTime: event.processingTime,
          employeeId: event.userId,
        },
      };

      // Broadcast transaction update
      await this.realtimeService.broadcastTransactionEvent(event.tenantId, {
        transactionId: event.transaction.id,
        locationId: event.transaction.locationId,
        customerId: event.transaction.customerId,
        total: event.transaction.total,
        items: event.transaction.items || [],
        paymentMethod: event.transaction.paymentMethod,
        status: event.transaction.status,
        processedBy: event.userId,
      });

      // Update dashboard cache
      await this.updateSalesDashboardCache(event.tenantId);

      // Check for milestones
      await this.checkSalesMilestones(event.tenantId, event.transaction);

      // Send real-time notification for large transactions
      if (event.transaction.total >= 1000) {
        await this.realtimeService.sendNotification(event.tenantId, {
          id: `large-sale-${event.transaction.id}`,
          type: 'success',
          title: 'Large Sale Completed',
          message: `$${event.transaction.total.toFixed(2)} sale completed at ${event.transaction.locationId}`,
          priority: 'medium',
          metadata: {
            transactionId: event.transaction.id,
            amount: event.transaction.total,
            locationId: event.transaction.locationId,
          },
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle completed transaction: ${err.message}`, err.stack);
    }
  }

  /**
   * Handle voided transactions
   */
  @OnEvent('pos.transaction.voided')
  async handleTransactionVoided(event: {
    tenantId: string;
    transactionId: string;
    reason: string;
    notes?: string;
    userId: string;
  }): Promise<void> {
    try {
      this.logger.log(`Processing voided transaction: ${event.transactionId}`);

      // Update dashboard cache
      await this.updateSalesDashboardCache(event.tenantId);

      // Send notification for void
      await this.realtimeService.sendNotification(event.tenantId, {
        id: `void-${event.transactionId}`,
        type: 'warning',
        title: 'Transaction Voided',
        message: `Transaction ${event.transactionId} was voided: ${event.reason}`,
        priority: 'medium',
        metadata: {
          transactionId: event.transactionId,
          reason: event.reason,
          voidedBy: event.userId,
        },
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle refunded transaction: ${err.message}`, err.stack);
    }
  }

  /**
   * Handle refunded transactions
   */
  @OnEvent('pos.transaction.refunded')
  async handleTransactionRefunded(event: {
    tenantId: string;
    transactionId: string;
    amount: number;
    reason: string;
    notes?: string;
    userId: string;
  }): Promise<void> {
    try {
      this.logger.log(`Processing refunded transaction: ${event.transactionId} - $${event.amount}`);

      // Update dashboard cache
      await this.updateSalesDashboardCache(event.tenantId);

      // Send notification for refund
      await this.realtimeService.sendNotification(event.tenantId, {
        id: `refund-${event.transactionId}`,
        type: 'info',
        title: 'Transaction Refunded',
        message: `$${event.amount.toFixed(2)} refund processed for transaction ${event.transactionId}`,
        priority: 'low',
        metadata: {
          transactionId: event.transactionId,
          amount: event.amount,
          reason: event.reason,
          refundedBy: event.userId,
        },
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle refunded transaction: ${err.message}`, err.stack);
    }
  }

  /**
   * Get real-time sales dashboard data
   */
  async getSalesDashboardData(tenantId: string, locationId?: string): Promise<SalesDashboardData> {
    try {
      const cacheKey = `sales-dashboard:${tenantId}:${locationId || 'all'}`;
      
      // Try cache first
      let dashboardData = await this.cacheService.get<SalesDashboardData>(cacheKey);
      
      if (!dashboardData) {
        // Generate dashboard data
        dashboardData = await this.generateSalesDashboardData(tenantId, locationId);
        
        // Cache for 1 minute (short cache for real-time data)
        await this.cacheService.set(cacheKey, dashboardData, { ttl: 60 });
      }

      return dashboardData;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get sales dashboard data: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get live sales metrics
   */
  async getLiveSalesMetrics(tenantId: string, locationId?: string): Promise<{
    currentHourSales: number;
    currentHourTransactions: number;
    salesVelocity: number;
    lastTransactionTime: Date | null;
    todayTotal: number;
    todayTransactions: number;
    targetProgress: number;
  }> {
    try {
      const cacheKey = `live-sales-metrics:${tenantId}:${locationId || 'all'}`;
      
      // Try cache first
      let metrics = await this.cacheService.get<any>(cacheKey);
      
      if (!metrics) {
        // Calculate live metrics (this would integrate with actual POS service)
        const now = new Date();
        const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Mock data - would be replaced with actual queries
        metrics = {
          currentHourSales: Math.random() * 1000,
          currentHourTransactions: Math.floor(Math.random() * 20),
          salesVelocity: Math.random() * 50, // sales per minute
          lastTransactionTime: new Date(Date.now() - Math.random() * 300000), // within last 5 minutes
          todayTotal: Math.random() * 10000,
          todayTransactions: Math.floor(Math.random() * 200),
          targetProgress: Math.random() * 100,
        };
        
        // Cache for 30 seconds
        await this.cacheService.set(cacheKey, metrics, { ttl: 30 });
      }

      return metrics;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get live sales metrics: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Get hourly sales breakdown for today
   */
  async getHourlySalesBreakdown(tenantId: string, locationId?: string): Promise<Array<{
    hour: number;
    sales: number;
    transactions: number;
    averageTransactionValue: number;
  }>> {
    try {
      const cacheKey = `hourly-sales:${tenantId}:${locationId || 'all'}:${new Date().toDateString()}`;
      
      // Try cache first
      let hourlyData = await this.cacheService.get<any[]>(cacheKey);
      
      if (!hourlyData) {
        // Generate hourly breakdown (mock data)
        hourlyData = Array.from({ length: 24 }, (_, hour) => {
          const sales = Math.random() * 2000;
          const transactions = Math.floor(Math.random() * 50);
          return {
            hour,
            sales,
            transactions,
            averageTransactionValue: transactions > 0 ? sales / transactions : 0,
          };
        });
        
        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, hourlyData, { ttl: 300 });
      }

      return hourlyData;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get hourly sales breakdown: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Subscribe to live sales updates
   */
  async subscribeToSalesUpdates(
    tenantId: string,
    locationId?: string,
  ): Promise<{ subscriptionId: string; initialData: SalesDashboardData }> {
    try {
      const subscriptionId = `sales-${tenantId}-${Date.now()}`;
      
      // Get initial dashboard data
      const initialData = await this.getSalesDashboardData(tenantId, locationId);
      
      this.logger.log(
        `Created sales dashboard subscription ${subscriptionId} for tenant ${tenantId}`,
      );

      return {
        subscriptionId,
        initialData,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to create sales subscription: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async updateSalesDashboardCache(tenantId: string): Promise<void> {
    try {
      // Invalidate all sales dashboard caches for this tenant
      await this.cacheService.invalidatePattern(`sales-dashboard:${tenantId}:*`);
      await this.cacheService.invalidatePattern(`live-sales-metrics:${tenantId}:*`);
      await this.cacheService.invalidatePattern(`hourly-sales:${tenantId}:*`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Failed to update sales dashboard cache: ${err.message}`);
    }
  }

  private async checkSalesMilestones(tenantId: string, transaction: any): Promise<void> {
    try {
      // Check for various milestones (this would integrate with actual business logic)
      const milestones: SalesMilestone[] = [];

      // Check daily target milestone
      const todayMetrics = await this.getLiveSalesMetrics(tenantId, transaction.locationId);
      if (todayMetrics.targetProgress >= 100) {
        milestones.push({
          type: 'daily_target',
          title: 'Daily Target Achieved',
          description: `Daily sales target reached at ${transaction.locationId}`,
          value: todayMetrics.todayTotal,
          target: todayMetrics.todayTotal / (todayMetrics.targetProgress / 100),
          locationId: transaction.locationId,
          achievedAt: new Date(),
        });
      }

      // Check revenue milestone (every $5000 in transactions)
      if (Math.floor(todayMetrics.todayTotal / 5000) > Math.floor((todayMetrics.todayTotal - transaction.total) / 5000)) {
        const milestoneBoundary = Math.floor(todayMetrics.todayTotal / 5000) * 5000;
        milestones.push({
          type: 'revenue_milestone',
          title: 'Revenue Milestone',
          description: `$${milestoneBoundary} in revenue reached today`,
          value: todayMetrics.todayTotal,
          target: milestoneBoundary,
          locationId: transaction.locationId,
          achievedAt: new Date(),
        });
      }

      // Broadcast milestones
      for (const milestone of milestones) {
        await this.realtimeService.broadcastSalesMilestone(tenantId, milestone);
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Failed to check sales milestones: ${err.message}`);
    }
  }

  private async generateSalesDashboardData(
    tenantId: string,
    locationId?: string,
  ): Promise<SalesDashboardData> {
    // This would integrate with actual POS and analytics services
    // For now, returning mock data structure
    const hourlyBreakdown = await this.getHourlySalesBreakdown(tenantId, locationId);
    const liveMetrics = await this.getLiveSalesMetrics(tenantId, locationId);

    return {
      today: {
        totalSales: liveMetrics.todayTotal,
        transactionCount: liveMetrics.todayTransactions,
        averageTransactionValue: liveMetrics.todayTransactions > 0 
          ? liveMetrics.todayTotal / liveMetrics.todayTransactions 
          : 0,
        hourlyBreakdown,
      },
      realTime: {
        currentHourSales: liveMetrics.currentHourSales,
        currentHourTransactions: liveMetrics.currentHourTransactions,
        lastTransactionTime: liveMetrics.lastTransactionTime,
        salesVelocity: liveMetrics.salesVelocity,
        targetProgress: {
          dailyTarget: 10000,
          currentProgress: liveMetrics.todayTotal,
          percentageComplete: liveMetrics.targetProgress,
          projectedTotal: liveMetrics.todayTotal * (24 / new Date().getHours()),
        },
      },
      trends: {
        salesGrowth: Math.random() * 20 - 10, // -10% to +10%
        transactionGrowth: Math.random() * 15 - 7.5,
        averageGrowth: Math.random() * 10 - 5,
      },
      topPerformers: {
        locations: [
          {
            locationId: 'loc-001',
            locationName: 'Main Store',
            sales: 5000,
            transactions: 100,
            growth: 15.5,
          },
        ],
        products: [
          {
            productId: 'prod-001',
            productName: 'Best Seller',
            quantitySold: 25,
            revenue: 1250,
            growth: 20.0,
          },
        ],
        employees: [
          {
            employeeId: 'emp-001',
            employeeName: 'Top Performer',
            sales: 2500,
            transactions: 50,
            averageTransactionValue: 50,
          },
        ],
      },
      paymentMethods: [
        { method: 'card', amount: 7000, count: 140, percentage: 70 },
        { method: 'cash', amount: 2500, count: 50, percentage: 25 },
        { method: 'mobile', amount: 500, count: 10, percentage: 5 },
      ],
    };
  }
}