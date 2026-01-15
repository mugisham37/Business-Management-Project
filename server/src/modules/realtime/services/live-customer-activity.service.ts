import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RealtimeService } from './realtime.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface LiveCustomerActivity {
  type: 'purchase' | 'loyalty_earned' | 'loyalty_redeemed' | 'profile_updated' | 'registration' | 'login';
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  locationId?: string;
  timestamp: Date;
  details: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CustomerActivityFeed {
  activities: LiveCustomerActivity[];
  summary: {
    totalActivities: number;
    uniqueCustomers: number;
    topActivityTypes: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    recentRegistrations: number;
    loyaltyActivity: {
      pointsEarned: number;
      pointsRedeemed: number;
      activeMembers: number;
    };
  };
  trends: {
    activityGrowth: number; // percentage vs previous period
    engagementScore: number; // 0-100
    retentionRate: number; // percentage
  };
}

export interface CustomerEngagementMetrics {
  activeCustomers: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  newCustomers: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  loyaltyMetrics: {
    totalMembers: number;
    activeMembers: number;
    pointsEarnedToday: number;
    pointsRedeemedToday: number;
    tierDistribution: Array<{
      tier: string;
      count: number;
      percentage: number;
    }>;
  };
  purchaseBehavior: {
    averageOrderValue: number;
    purchaseFrequency: number;
    repeatCustomerRate: number;
    customerLifetimeValue: number;
  };
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalSpent: number;
    lastPurchase: Date;
    loyaltyTier: string;
    activityScore: number;
  }>;
}

@Injectable()
export class LiveCustomerActivityService {
  private readonly logger = new Logger(LiveCustomerActivityService.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  /**
   * Handle customer creation events
   */
  @OnEvent('customer.created')
  async handleCustomerCreated(event: {
    tenantId: string;
    customerId: string;
    customer: any;
    userId: string;
  }): Promise<void> {
    try {
      this.logger.log(`Processing customer registration: ${event.customerId}`);

      const activity: LiveCustomerActivity = {
        type: 'registration',
        customerId: event.customerId,
        customerName: `${event.customer.firstName} ${event.customer.lastName}`.trim(),
        customerEmail: event.customer.email,
        timestamp: new Date(),
        details: {
          customerType: event.customer.type,
          registrationMethod: 'manual', // Could be 'online', 'pos', etc.
          initialTier: event.customer.loyaltyTier,
        },
        metadata: {
          registeredBy: event.userId,
        },
      };

      // Broadcast customer activity
      await this.realtimeService.broadcastCustomerActivity(event.tenantId, {
        customerId: event.customerId,
        activityType: 'registration',
        details: activity.details,
      });

      // Update activity feed cache
      await this.updateCustomerActivityCache(event.tenantId);

      // Send welcome notification
      await this.realtimeService.sendNotification(event.tenantId, {
        id: `customer-welcome-${event.customerId}`,
        type: 'success',
        title: 'New Customer Registered',
        message: `Welcome ${activity.customerName}! Customer account created successfully.`,
        priority: 'low',
        metadata: {
          customerId: event.customerId,
          customerName: activity.customerName,
        },
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle customer creation: ${err.message}`, err.stack);
    }
  }

  /**
   * Handle customer update events
   */
  @OnEvent('customer.updated')
  async handleCustomerUpdated(event: {
    tenantId: string;
    customerId: string;
    customer: any;
    previousData: any;
    userId: string;
  }): Promise<void> {
    try {
      this.logger.log(`Processing customer profile update: ${event.customerId}`);

      const activity: LiveCustomerActivity = {
        type: 'profile_updated',
        customerId: event.customerId,
        customerName: `${event.customer.firstName} ${event.customer.lastName}`.trim(),
        customerEmail: event.customer.email,
        timestamp: new Date(),
        details: {
          updatedFields: this.getUpdatedFields(event.previousData, event.customer),
          previousTier: event.previousData.loyaltyTier,
          newTier: event.customer.loyaltyTier,
        },
        metadata: {
          updatedBy: event.userId,
        },
      };

      // Broadcast customer activity
      await this.realtimeService.broadcastCustomerActivity(event.tenantId, {
        customerId: event.customerId,
        activityType: 'profile_updated',
        details: activity.details,
      });

      // Update activity feed cache
      await this.updateCustomerActivityCache(event.tenantId);

      // Send tier upgrade notification if applicable
      if (event.previousData.loyaltyTier !== event.customer.loyaltyTier) {
        await this.realtimeService.sendNotification(event.tenantId, {
          id: `tier-change-${event.customerId}`,
          type: 'info',
          title: 'Customer Tier Updated',
          message: `${activity.customerName} moved from ${event.previousData.loyaltyTier} to ${event.customer.loyaltyTier}`,
          priority: 'medium',
          metadata: {
            customerId: event.customerId,
            previousTier: event.previousData.loyaltyTier,
            newTier: event.customer.loyaltyTier,
          },
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle customer update: ${err.message}`, err.stack);
    }
  }

  /**
   * Handle customer purchase stats updates
   */
  @OnEvent('customer.purchase-stats.updated')
  async handlePurchaseStatsUpdated(event: {
    tenantId: string;
    customerId: string;
    orderValue: number;
    orderDate: Date;
  }): Promise<void> {
    try {
      this.logger.log(`Processing customer purchase: ${event.customerId} - $${event.orderValue}`);

      const activity: LiveCustomerActivity = {
        type: 'purchase',
        customerId: event.customerId,
        timestamp: event.orderDate,
        details: {
          orderValue: event.orderValue,
          orderDate: event.orderDate,
        },
      };

      // Broadcast customer activity
      await this.realtimeService.broadcastCustomerActivity(event.tenantId, {
        customerId: event.customerId,
        activityType: 'purchase',
        details: activity.details,
      });

      // Update activity feed cache
      await this.updateCustomerActivityCache(event.tenantId);

      // Send high-value purchase notification
      if (event.orderValue >= 500) {
        await this.realtimeService.sendNotification(event.tenantId, {
          id: `high-value-purchase-${event.customerId}`,
          type: 'success',
          title: 'High-Value Purchase',
          message: `Customer made a $${event.orderValue.toFixed(2)} purchase`,
          priority: 'medium',
          metadata: {
            customerId: event.customerId,
            orderValue: event.orderValue,
          },
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle purchase stats update: ${err.message}`, err.stack);
    }
  }

  /**
   * Handle loyalty points updates
   */
  @OnEvent('customer.loyalty-points.updated')
  async handleLoyaltyPointsUpdated(event: {
    tenantId: string;
    customerId: string;
    pointsChange: number;
    reason: string;
  }): Promise<void> {
    try {
      this.logger.log(`Processing loyalty points update: ${event.customerId} - ${event.pointsChange} points`);

      const activityType = event.pointsChange > 0 ? 'loyalty_earned' : 'loyalty_redeemed';
      
      const activity: LiveCustomerActivity = {
        type: activityType,
        customerId: event.customerId,
        timestamp: new Date(),
        details: {
          pointsChange: event.pointsChange,
          reason: event.reason,
          absoluteChange: Math.abs(event.pointsChange),
        },
      };

      // Broadcast customer activity
      await this.realtimeService.broadcastCustomerActivity(event.tenantId, {
        customerId: event.customerId,
        activityType,
        details: activity.details,
      });

      // Update activity feed cache
      await this.updateCustomerActivityCache(event.tenantId);

      // Send large points transaction notification
      if (Math.abs(event.pointsChange) >= 1000) {
        const action = event.pointsChange > 0 ? 'earned' : 'redeemed';
        await this.realtimeService.sendNotification(event.tenantId, {
          id: `large-points-${event.customerId}`,
          type: 'info',
          title: 'Large Points Transaction',
          message: `Customer ${action} ${Math.abs(event.pointsChange)} loyalty points`,
          priority: 'low',
          metadata: {
            customerId: event.customerId,
            pointsChange: event.pointsChange,
            reason: event.reason,
          },
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle loyalty points update: ${err.message}`, err.stack);
    }
  }

  /**
   * Get live customer activity feed
   */
  async getCustomerActivityFeed(
    tenantId: string,
    options: {
      limit?: number;
      customerId?: string;
      activityTypes?: string[];
      locationId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<CustomerActivityFeed> {
    try {
      const cacheKey = `customer-activity-feed:${tenantId}:${JSON.stringify(options)}`;
      
      // Try cache first
      let activityFeed = await this.cacheService.get<CustomerActivityFeed>(cacheKey);
      
      if (!activityFeed) {
        // Generate activity feed
        activityFeed = await this.generateCustomerActivityFeed(tenantId, options);
        
        // Cache for 2 minutes
        await this.cacheService.set(cacheKey, activityFeed, { ttl: 120 });
      }

      return activityFeed;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get customer activity feed: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get customer engagement metrics
   */
  async getCustomerEngagementMetrics(tenantId: string): Promise<CustomerEngagementMetrics> {
    try {
      const cacheKey = `customer-engagement-metrics:${tenantId}`;
      
      // Try cache first
      let metrics = await this.cacheService.get<CustomerEngagementMetrics>(cacheKey);
      
      if (!metrics) {
        // Generate engagement metrics
        metrics = await this.generateCustomerEngagementMetrics(tenantId);
        
        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, metrics, { ttl: 300 });
      }

      return metrics;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get customer engagement metrics: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get real-time customer activity for specific customer
   */
  async getCustomerActivityHistory(
    tenantId: string,
    customerId: string,
    limit: number = 50,
  ): Promise<LiveCustomerActivity[]> {
    try {
      const cacheKey = `customer-activity-history:${tenantId}:${customerId}:${limit}`;
      
      // Try cache first
      let activities = await this.cacheService.get<LiveCustomerActivity[]>(cacheKey);
      
      if (!activities) {
        // Generate customer activity history (mock data for now)
        activities = this.generateMockCustomerActivities(customerId, limit);
        
        // Cache for 3 minutes
        await this.cacheService.set(cacheKey, activities, { ttl: 180 });
      }

      return activities;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get customer activity history: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Subscribe to customer activity updates
   */
  async subscribeToCustomerActivity(
    tenantId: string,
    customerId?: string,
  ): Promise<{ subscriptionId: string; initialData: CustomerActivityFeed }> {
    try {
      const subscriptionId = `customer-activity-${tenantId}-${customerId || 'all'}-${Date.now()}`;
      
      // Get initial activity feed
      const initialData = await this.getCustomerActivityFeed(tenantId, customerId ? { customerId } : {});
      
      this.logger.log(
        `Created customer activity subscription ${subscriptionId} for tenant ${tenantId}`,
      );

      return {
        subscriptionId,
        initialData,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to create customer activity subscription: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Private helper methods
   */

  private async updateCustomerActivityCache(tenantId: string): Promise<void> {
    try {
      // Invalidate all customer activity caches for this tenant
      await this.cacheService.invalidatePattern(`customer-activity-feed:${tenantId}:*`);
      await this.cacheService.invalidatePattern(`customer-engagement-metrics:${tenantId}`);
      await this.cacheService.invalidatePattern(`customer-activity-history:${tenantId}:*`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn(`Failed to update customer activity cache: ${err.message}`);
    }
  }

  private getUpdatedFields(previousData: any, currentData: any): string[] {
    const updatedFields: string[] = [];
    const fieldsToCheck = ['firstName', 'lastName', 'email', 'phone', 'address', 'loyaltyTier'];

    for (const field of fieldsToCheck) {
      if (previousData[field] !== currentData[field]) {
        updatedFields.push(field);
      }
    }

    return updatedFields;
  }

  private async generateCustomerActivityFeed(
    tenantId: string,
    options: any,
  ): Promise<CustomerActivityFeed> {
    // This would integrate with actual customer and transaction services
    // For now, returning mock data structure
    const activities = this.generateMockCustomerActivities('all', options.limit || 50);

    const activityTypeCounts = activities.reduce((acc, activity) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalActivities = activities.length;
    const topActivityTypes = Object.entries(activityTypeCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / totalActivities) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      activities,
      summary: {
        totalActivities,
        uniqueCustomers: new Set(activities.map(a => a.customerId)).size,
        topActivityTypes,
        recentRegistrations: activities.filter(a => a.type === 'registration').length,
        loyaltyActivity: {
          pointsEarned: activities
            .filter(a => a.type === 'loyalty_earned')
            .reduce((sum, a) => sum + (a.details.pointsChange || 0), 0),
          pointsRedeemed: Math.abs(activities
            .filter(a => a.type === 'loyalty_redeemed')
            .reduce((sum, a) => sum + (a.details.pointsChange || 0), 0)),
          activeMembers: Math.floor(Math.random() * 500) + 100,
        },
      },
      trends: {
        activityGrowth: Math.random() * 30 - 15, // -15% to +15%
        engagementScore: Math.random() * 40 + 60, // 60-100
        retentionRate: Math.random() * 20 + 75, // 75-95%
      },
    };
  }

  private async generateCustomerEngagementMetrics(tenantId: string): Promise<CustomerEngagementMetrics> {
    // This would integrate with actual customer and analytics services
    // For now, returning mock data structure
    return {
      activeCustomers: {
        today: Math.floor(Math.random() * 100) + 50,
        thisWeek: Math.floor(Math.random() * 500) + 200,
        thisMonth: Math.floor(Math.random() * 2000) + 800,
      },
      newCustomers: {
        today: Math.floor(Math.random() * 20) + 5,
        thisWeek: Math.floor(Math.random() * 100) + 30,
        thisMonth: Math.floor(Math.random() * 400) + 150,
      },
      loyaltyMetrics: {
        totalMembers: Math.floor(Math.random() * 5000) + 2000,
        activeMembers: Math.floor(Math.random() * 3000) + 1500,
        pointsEarnedToday: Math.floor(Math.random() * 10000) + 5000,
        pointsRedeemedToday: Math.floor(Math.random() * 5000) + 2000,
        tierDistribution: [
          { tier: 'bronze', count: 1200, percentage: 60 },
          { tier: 'silver', count: 600, percentage: 30 },
          { tier: 'gold', count: 180, percentage: 9 },
          { tier: 'platinum', count: 20, percentage: 1 },
        ],
      },
      purchaseBehavior: {
        averageOrderValue: Math.random() * 100 + 50,
        purchaseFrequency: Math.random() * 5 + 2, // purchases per month
        repeatCustomerRate: Math.random() * 30 + 60, // 60-90%
        customerLifetimeValue: Math.random() * 1000 + 500,
      },
      topCustomers: [
        {
          customerId: 'cust-001',
          customerName: 'John Doe',
          totalSpent: 2500,
          lastPurchase: new Date(),
          loyaltyTier: 'gold',
          activityScore: 95,
        },
      ],
    };
  }

  private generateMockCustomerActivities(customerId: string, limit: number): LiveCustomerActivity[] {
    const activityTypes: LiveCustomerActivity['type'][] = [
      'purchase', 'loyalty_earned', 'loyalty_redeemed', 'profile_updated', 'registration'
    ];

    return Array.from({ length: limit }, (_, i) => {
      const typeIndex = Math.floor(Math.random() * activityTypes.length);
      const type = activityTypes[typeIndex];
      const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days

      let details: Record<string, any> = {};
      
      switch (type) {
        case 'purchase':
          details = { orderValue: Math.random() * 500 + 20 };
          break;
        case 'loyalty_earned':
          details = { pointsChange: Math.floor(Math.random() * 100) + 10 };
          break;
        case 'loyalty_redeemed':
          details = { pointsChange: -(Math.floor(Math.random() * 200) + 50) };
          break;
        case 'profile_updated':
          details = { updatedFields: ['email', 'phone'] };
          break;
        case 'registration':
          details = { customerType: 'individual', registrationMethod: 'online' };
          break;
      }

      return {
        type: type || 'purchase',
        customerId: customerId === 'all' ? `cust-${String(i).padStart(3, '0')}` : customerId,
        customerName: `Customer ${i + 1}`,
        customerEmail: `customer${i + 1}@example.com`,
        timestamp,
        details,
      };
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}