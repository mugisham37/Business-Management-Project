import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { CustomerRepository } from '../repositories/customer.repository';
import { LoyaltyRepository } from '../repositories/loyalty.repository';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { customers, loyaltyTransactions } from '../../database/schema';
import { eq, and, gte, lte, desc, sql, isNull } from 'drizzle-orm';

export interface CustomerLifetimeValueData {
  customerId: string;
  currentValue: number;
  predictedValue: number;
  totalOrders: number;
  averageOrderValue: number;
  daysSinceFirstPurchase: number;
  daysSinceLastPurchase: number;
  purchaseFrequency: number;
  churnRisk: number;
}

export interface CustomerSegmentAnalytics {
  segmentName: string;
  customerCount: number;
  averageLifetimeValue: number;
  averageOrderValue: number;
  averagePurchaseFrequency: number;
  churnRate: number;
  loyaltyTierDistribution: Record<string, number>;
}

export interface PurchasePatternAnalysis {
  customerId: string;
  seasonalPatterns: Record<string, number>; // month -> average spending
  dayOfWeekPatterns: Record<string, number>; // day -> average spending
  categoryPreferences: Record<string, number>; // category -> percentage of spending
  averageTimeBetweenPurchases: number;
  preferredPurchaseTime: string;
  spendingTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface ChurnPredictionData {
  customerId: string;
  churnRisk: number; // 0-1 probability
  riskFactors: string[];
  lastPurchaseDate: Date;
  daysSinceLastPurchase: number;
  expectedNextPurchaseDate: Date;
  recommendedActions: string[];
}

@Injectable()
export class CustomerAnalyticsService {
  private readonly logger = new Logger(CustomerAnalyticsService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly customerRepository: CustomerRepository,
    private readonly loyaltyRepository: LoyaltyRepository,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  async calculateCustomerLifetimeValue(tenantId: string, customerId: string): Promise<CustomerLifetimeValueData> {
    try {
      const cacheKey = `customer-ltv:${tenantId}:${customerId}`;
      
      // Try cache first
      let ltvData = await this.cacheService.get<CustomerLifetimeValueData>(cacheKey);
      
      if (!ltvData) {
        const customer = await this.customerRepository.findById(tenantId, customerId);
        if (!customer) {
          throw new Error(`Customer ${customerId} not found`);
        }

        // Calculate days since first and last purchase
        const now = new Date();
        const daysSinceFirstPurchase = customer.firstPurchaseDate 
          ? Math.floor((now.getTime() - customer.firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        const daysSinceLastPurchase = customer.lastPurchaseDate
          ? Math.floor((now.getTime() - customer.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        // Calculate purchase frequency (orders per month)
        const purchaseFrequency = daysSinceFirstPurchase > 0 
          ? (customer.totalOrders / daysSinceFirstPurchase) * 30
          : 0;

        // Simple churn risk calculation based on recency and frequency
        let churnRisk = 0;
        if (daysSinceLastPurchase > 90) churnRisk += 0.4;
        else if (daysSinceLastPurchase > 60) churnRisk += 0.2;
        else if (daysSinceLastPurchase > 30) churnRisk += 0.1;

        if (purchaseFrequency < 0.5) churnRisk += 0.3;
        else if (purchaseFrequency < 1) churnRisk += 0.2;

        if (customer.totalOrders === 1) churnRisk += 0.2;

        churnRisk = Math.min(churnRisk, 1);

        // Predict future value using simple RFM model
        const recencyScore = Math.max(0, 1 - (daysSinceLastPurchase / 365));
        const frequencyScore = Math.min(1, purchaseFrequency / 2);
        const monetaryScore = Math.min(1, customer.averageOrderValue / 1000);
        
        const predictedValue = customer.lifetimeValue * (1 + (recencyScore * frequencyScore * monetaryScore * 0.5));

        ltvData = {
          customerId,
          currentValue: customer.lifetimeValue,
          predictedValue,
          totalOrders: customer.totalOrders,
          averageOrderValue: customer.averageOrderValue,
          daysSinceFirstPurchase,
          daysSinceLastPurchase,
          purchaseFrequency,
          churnRisk,
        };

        // Cache for 1 hour
        await this.cacheService.set(cacheKey, ltvData, { ttl: 3600, tenantId });
      }

      return ltvData;
    } catch (error) {
      this.logger.error(`Failed to calculate LTV for customer ${customerId}:`, error);
      throw error;
    }
  }

  async analyzePurchasePatterns(tenantId: string, customerId: string): Promise<PurchasePatternAnalysis> {
    try {
      const cacheKey = `customer-patterns:${tenantId}:${customerId}`;
      
      // Try cache first
      let patterns = await this.cacheService.get<PurchasePatternAnalysis>(cacheKey);
      
      if (!patterns) {
        // This would require transaction data - for now, return mock data
        // In a full implementation, this would analyze actual transaction history
        patterns = {
          customerId,
          seasonalPatterns: {
            'January': 150,
            'February': 120,
            'March': 180,
            'April': 200,
            'May': 220,
            'June': 250,
            'July': 280,
            'August': 260,
            'September': 240,
            'October': 300,
            'November': 350,
            'December': 400,
          },
          dayOfWeekPatterns: {
            'Monday': 80,
            'Tuesday': 90,
            'Wednesday': 85,
            'Thursday': 95,
            'Friday': 120,
            'Saturday': 150,
            'Sunday': 100,
          },
          categoryPreferences: {
            'Electronics': 40,
            'Clothing': 30,
            'Food': 20,
            'Books': 10,
          },
          averageTimeBetweenPurchases: 15, // days
          preferredPurchaseTime: '14:00-16:00',
          spendingTrend: 'increasing',
        };

        // Cache for 6 hours
        await this.cacheService.set(cacheKey, patterns, { ttl: 21600, tenantId });
      }

      return patterns;
    } catch (error) {
      this.logger.error(`Failed to analyze purchase patterns for customer ${customerId}:`, error);
      throw error;
    }
  }

  async predictChurnRisk(tenantId: string, customerId: string): Promise<ChurnPredictionData> {
    try {
      const cacheKey = `customer-churn:${tenantId}:${customerId}`;
      
      // Try cache first
      let churnData = await this.cacheService.get<ChurnPredictionData>(cacheKey);
      
      if (!churnData) {
        const customer = await this.customerRepository.findById(tenantId, customerId);
        if (!customer) {
          throw new Error(`Customer ${customerId} not found`);
        }

        const ltvData = await this.calculateCustomerLifetimeValue(tenantId, customerId);
        
        // Determine risk factors
        const riskFactors: string[] = [];
        if (ltvData.daysSinceLastPurchase > 60) riskFactors.push('Long time since last purchase');
        if (ltvData.purchaseFrequency < 1) riskFactors.push('Low purchase frequency');
        if (customer.totalOrders === 1) riskFactors.push('Single purchase customer');
        if (customer.averageOrderValue < 50) riskFactors.push('Low average order value');
        if (!customer.emailOptIn && !customer.smsOptIn) riskFactors.push('No marketing opt-in');

        // Calculate expected next purchase date
        const expectedNextPurchaseDate = new Date();
        expectedNextPurchaseDate.setDate(expectedNextPurchaseDate.getDate() + Math.round(1 / ltvData.purchaseFrequency * 30));

        // Generate recommended actions
        const recommendedActions: string[] = [];
        if (ltvData.churnRisk > 0.7) {
          recommendedActions.push('Send personalized retention offer');
          recommendedActions.push('Assign to customer success manager');
        } else if (ltvData.churnRisk > 0.4) {
          recommendedActions.push('Send re-engagement email campaign');
          recommendedActions.push('Offer loyalty points bonus');
        } else {
          recommendedActions.push('Continue regular marketing communications');
        }

        churnData = {
          customerId,
          churnRisk: ltvData.churnRisk,
          riskFactors,
          lastPurchaseDate: customer.lastPurchaseDate || new Date(),
          daysSinceLastPurchase: ltvData.daysSinceLastPurchase,
          expectedNextPurchaseDate,
          recommendedActions,
        };

        // Cache for 2 hours
        await this.cacheService.set(cacheKey, churnData, { ttl: 7200, tenantId });
      }

      return churnData;
    } catch (error) {
      this.logger.error(`Failed to predict churn risk for customer ${customerId}:`, error);
      throw error;
    }
  }

  async getCustomerSegmentAnalytics(tenantId: string): Promise<CustomerSegmentAnalytics[]> {
    try {
      const cacheKey = `segment-analytics:${tenantId}`;
      
      // Try cache first
      let analytics = await this.cacheService.get<CustomerSegmentAnalytics[]>(cacheKey);
      
      if (!analytics) {
        // Get all customers
        const { customers: allCustomers } = await this.customerRepository.findMany(tenantId, { 
          page: 1, 
          limit: 10000 
        });

        // Group by loyalty tier (simple segmentation)
        const segments = allCustomers.reduce((acc, customer) => {
          const tier = customer.loyaltyTier;
          if (!acc[tier]) {
            acc[tier] = [];
          }
          acc[tier].push(customer);
          return acc;
        }, {} as Record<string, any[]>);

        analytics = Object.entries(segments).map(([tier, customers]) => {
          const totalLTV = customers.reduce((sum, c) => sum + c.lifetimeValue, 0);
          const totalAOV = customers.reduce((sum, c) => sum + c.averageOrderValue, 0);
          const avgPurchaseFreq = customers.reduce((sum, c) => {
            const daysSinceFirst = c.firstPurchaseDate 
              ? Math.floor((Date.now() - c.firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
              : 1;
            return sum + (c.totalOrders / Math.max(daysSinceFirst, 1) * 30);
          }, 0);

          const churnRiskSum = customers.reduce((sum, c) => sum + (c.churnRisk || 0), 0);

          return {
            segmentName: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`,
            customerCount: customers.length,
            averageLifetimeValue: customers.length > 0 ? totalLTV / customers.length : 0,
            averageOrderValue: customers.length > 0 ? totalAOV / customers.length : 0,
            averagePurchaseFrequency: customers.length > 0 ? avgPurchaseFreq / customers.length : 0,
            churnRate: customers.length > 0 ? churnRiskSum / customers.length : 0,
            loyaltyTierDistribution: { [tier]: customers.length },
          };
        });

        // Cache for 1 hour
        await this.cacheService.set(cacheKey, analytics, { ttl: 3600, tenantId });
      }

      return analytics;
    } catch (error) {
      this.logger.error(`Failed to get segment analytics for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getTopCustomersByValue(tenantId: string, limit: number = 10): Promise<any[]> {
    try {
      const cacheKey = `top-customers:${tenantId}:${limit}`;
      
      // Try cache first
      let topCustomers = await this.cacheService.get<any[]>(cacheKey);
      
      if (!topCustomers) {
        const { customers } = await this.customerRepository.findMany(tenantId, {
          page: 1,
          limit,
          sortBy: 'lifetimeValue',
          sortOrder: 'desc',
        });

        topCustomers = customers.map(customer => ({
          id: customer.id,
          displayName: customer.displayName,
          email: customer.email,
          lifetimeValue: customer.lifetimeValue,
          totalOrders: customer.totalOrders,
          averageOrderValue: customer.averageOrderValue,
          loyaltyTier: customer.loyaltyTier,
          loyaltyPoints: customer.loyaltyPoints,
        }));

        // Cache for 30 minutes
        await this.cacheService.set(cacheKey, topCustomers, { ttl: 1800, tenantId });
      }

      return topCustomers;
    } catch (error) {
      this.logger.error(`Failed to get top customers for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getCustomersAtRisk(tenantId: string, riskThreshold: number = 0.6): Promise<any[]> {
    try {
      const cacheKey = `at-risk-customers:${tenantId}:${riskThreshold}`;
      
      // Try cache first
      let atRiskCustomers = await this.cacheService.get<any[]>(cacheKey);
      
      if (!atRiskCustomers) {
        const { customers } = await this.customerRepository.findMany(tenantId, {
          page: 1,
          limit: 1000,
          minChurnRisk: riskThreshold,
          sortBy: 'churnRisk',
          sortOrder: 'desc',
        });

        atRiskCustomers = customers.map(customer => ({
          id: customer.id,
          displayName: customer.displayName,
          email: customer.email,
          churnRisk: customer.churnRisk,
          daysSinceLastPurchase: customer.lastPurchaseDate 
            ? Math.floor((Date.now() - customer.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
            : null,
          lifetimeValue: customer.lifetimeValue,
          totalOrders: customer.totalOrders,
        }));

        // Cache for 1 hour
        await this.cacheService.set(cacheKey, atRiskCustomers, { ttl: 3600, tenantId });
      }

      return atRiskCustomers;
    } catch (error) {
      this.logger.error(`Failed to get at-risk customers for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getCustomerGrowthMetrics(tenantId: string, days: number = 30): Promise<{
    newCustomers: number;
    returningCustomers: number;
    churnedCustomers: number;
    reactivatedCustomers: number;
    growthRate: number;
  }> {
    try {
      const cacheKey = `customer-growth:${tenantId}:${days}`;
      
      // Try cache first
      let metrics = await this.cacheService.get<any>(cacheKey);
      
      if (!metrics) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get customers created in the period
        const { customers: newCustomers } = await this.customerRepository.findMany(tenantId, {
          createdAfter: startDate.toISOString(),
          createdBefore: endDate.toISOString(),
          page: 1,
          limit: 10000,
        });

        // Get customers with purchases in the period
        const { customers: activeCustomers } = await this.customerRepository.findMany(tenantId, {
          lastPurchaseAfter: startDate.toISOString(),
          page: 1,
          limit: 10000,
        });

        // Calculate metrics
        const returningCustomers = activeCustomers.filter(c => 
          c.createdAt < startDate && c.totalOrders > 1
        ).length;

        // Simple churn calculation (customers who haven't purchased in 2x the period)
        const churnDate = new Date();
        churnDate.setDate(churnDate.getDate() - (days * 2));
        
        const { customers: potentiallyChurned } = await this.customerRepository.findMany(tenantId, {
          lastPurchaseBefore: churnDate.toISOString(),
          page: 1,
          limit: 10000,
        });

        const churnedCustomers = potentiallyChurned.filter(c => c.totalOrders > 0).length;

        // Reactivated customers (had no purchases for 2x period, but purchased in current period)
        const reactivatedCustomers = activeCustomers.filter(c => {
          const daysSinceCreation = Math.floor((Date.now() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceCreation > (days * 2) && c.lastPurchaseDate && c.lastPurchaseDate >= startDate;
        }).length;

        // Calculate growth rate
        const totalCustomersStart = await this.customerRepository.findMany(tenantId, {
          createdBefore: startDate.toISOString(),
          page: 1,
          limit: 1,
        });

        const growthRate = totalCustomersStart.total > 0 
          ? ((newCustomers.length - churnedCustomers) / totalCustomersStart.total) * 100
          : 0;

        metrics = {
          newCustomers: newCustomers.length,
          returningCustomers,
          churnedCustomers,
          reactivatedCustomers,
          growthRate,
        };

        // Cache for 2 hours
        await this.cacheService.set(cacheKey, metrics, { ttl: 7200, tenantId });
      }

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get customer growth metrics for tenant ${tenantId}:`, error);
      throw error;
    }
  }
}