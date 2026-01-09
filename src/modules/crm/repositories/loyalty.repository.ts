import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  loyaltyTransactions, 
  loyaltyRewards, 
  loyaltyRedemptions, 
  loyaltyCampaigns,
  customers 
} from '../../database/schema';
import { eq, and, or, gte, lte, desc, asc, sql, isNull, isNotNull } from 'drizzle-orm';
import { 
  CreateLoyaltyTransactionDto, 
  CreateRewardDto, 
  UpdateRewardDto, 
  CreateCampaignDto,
  LoyaltyQueryDto,
  RewardQueryDto 
} from '../dto/loyalty.dto';
import { LoyaltyTransaction } from '../entities/customer.entity';

@Injectable()
export class LoyaltyRepository {
  private readonly logger = new Logger(LoyaltyRepository.name);

  constructor(private readonly drizzle: DrizzleService) {}

  // Loyalty Transactions
  async createTransaction(tenantId: string, data: CreateLoyaltyTransactionDto, userId: string): Promise<LoyaltyTransaction> {
    try {
      const [transaction] = await this.drizzle.db
        .insert(loyaltyTransactions)
        .values({
          tenantId,
          customerId: data.customerId,
          type: data.type,
          points: data.points,
          description: data.description,
          relatedTransactionId: data.relatedTransactionId,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          campaignId: data.campaignId,
          promotionId: data.promotionId,
          metadata: data.metadata || {},
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      this.logger.log(`Created loyalty transaction ${transaction.id} for customer ${data.customerId}`);
      return this.mapTransactionToEntity(transaction);
    } catch (error) {
      this.logger.error(`Failed to create loyalty transaction:`, error);
      throw error;
    }
  }

  async findTransactions(tenantId: string, query: LoyaltyQueryDto): Promise<{ transactions: LoyaltyTransaction[]; total: number }> {
    try {
      const conditions = [
        eq(loyaltyTransactions.tenantId, tenantId),
        isNull(loyaltyTransactions.deletedAt)
      ];

      // Add filter conditions
      if (query.customerId) {
        conditions.push(eq(loyaltyTransactions.customerId, query.customerId));
      }

      if (query.type) {
        conditions.push(eq(loyaltyTransactions.type, query.type));
      }

      if (query.campaignId) {
        conditions.push(eq(loyaltyTransactions.campaignId, query.campaignId));
      }

      if (query.startDate) {
        conditions.push(gte(loyaltyTransactions.createdAt, new Date(query.startDate)));
      }

      if (query.endDate) {
        conditions.push(lte(loyaltyTransactions.createdAt, new Date(query.endDate)));
      }

      const whereClause = and(...conditions);

      // Get total count
      const [{ count }] = await this.drizzle.db
        .select({ count: sql<number>`count(*)` })
        .from(loyaltyTransactions)
        .where(whereClause);

      // Get paginated results
      const offset = (query.page - 1) * query.limit;
      const orderBy = query.sortOrder === 'asc' 
        ? asc(loyaltyTransactions[query.sortBy as keyof typeof loyaltyTransactions] || loyaltyTransactions.createdAt)
        : desc(loyaltyTransactions[query.sortBy as keyof typeof loyaltyTransactions] || loyaltyTransactions.createdAt);

      const results = await this.drizzle.db
        .select()
        .from(loyaltyTransactions)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(query.limit)
        .offset(offset);

      return {
        transactions: results.map(t => this.mapTransactionToEntity(t)),
        total: count,
      };
    } catch (error) {
      this.logger.error(`Failed to find loyalty transactions for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getCustomerPointsBalance(tenantId: string, customerId: string): Promise<{
    totalPoints: number;
    availablePoints: number;
    expiredPoints: number;
    expiringPoints: { points: number; expiresAt: Date }[];
  }> {
    try {
      // Get all transactions for the customer
      const transactions = await this.drizzle.db
        .select()
        .from(loyaltyTransactions)
        .where(and(
          eq(loyaltyTransactions.tenantId, tenantId),
          eq(loyaltyTransactions.customerId, customerId),
          isNull(loyaltyTransactions.deletedAt)
        ))
        .orderBy(desc(loyaltyTransactions.createdAt));

      let totalPoints = 0;
      let availablePoints = 0;
      let expiredPoints = 0;
      const expiringPoints: { points: number; expiresAt: Date }[] = [];
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      for (const transaction of transactions) {
        totalPoints += transaction.points;

        if (transaction.points > 0) { // Earned points
          if (transaction.expiresAt && transaction.expiresAt <= now) {
            expiredPoints += transaction.points;
          } else {
            availablePoints += transaction.points;
            
            // Check if points expire within 30 days
            if (transaction.expiresAt && transaction.expiresAt <= thirtyDaysFromNow) {
              expiringPoints.push({
                points: transaction.points,
                expiresAt: transaction.expiresAt,
              });
            }
          }
        } else { // Redeemed points
          availablePoints += transaction.points; // This will be negative
        }
      }

      return {
        totalPoints: Math.max(0, totalPoints),
        availablePoints: Math.max(0, availablePoints),
        expiredPoints,
        expiringPoints,
      };
    } catch (error) {
      this.logger.error(`Failed to get points balance for customer ${customerId}:`, error);
      throw error;
    }
  }

  // Loyalty Rewards
  async createReward(tenantId: string, data: CreateRewardDto, userId: string): Promise<any> {
    try {
      const [reward] = await this.drizzle.db
        .insert(loyaltyRewards)
        .values({
          tenantId,
          name: data.name,
          description: data.description,
          type: data.type,
          pointsRequired: data.pointsRequired,
          value: data.value?.toString(),
          productId: data.productId,
          minimumOrderValue: data.minimumOrderValue?.toString(),
          maximumDiscountAmount: data.maximumDiscountAmount?.toString(),
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          usageLimitPerCustomer: data.usageLimitPerCustomer,
          totalUsageLimit: data.totalUsageLimit,
          requiredTiers: data.requiredTiers || [],
          termsAndConditions: data.termsAndConditions,
          metadata: data.metadata || {},
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      this.logger.log(`Created loyalty reward ${reward.id} for tenant ${tenantId}`);
      return this.mapRewardToEntity(reward);
    } catch (error) {
      this.logger.error(`Failed to create loyalty reward:`, error);
      throw error;
    }
  }

  async findRewards(tenantId: string, query: RewardQueryDto): Promise<{ rewards: any[]; total: number }> {
    try {
      const conditions = [
        eq(loyaltyRewards.tenantId, tenantId),
        isNull(loyaltyRewards.deletedAt)
      ];

      // Add filter conditions
      if (query.type) {
        conditions.push(eq(loyaltyRewards.type, query.type));
      }

      if (query.activeOnly) {
        conditions.push(eq(loyaltyRewards.isActive, true));
      }

      if (query.availableOnly) {
        const now = new Date();
        conditions.push(
          and(
            or(
              isNull(loyaltyRewards.startDate),
              lte(loyaltyRewards.startDate, now)
            ),
            or(
              isNull(loyaltyRewards.endDate),
              gte(loyaltyRewards.endDate, now)
            )
          )
        );
      }

      if (query.maxPointsRequired !== undefined) {
        conditions.push(lte(loyaltyRewards.pointsRequired, query.maxPointsRequired));
      }

      const whereClause = and(...conditions);

      // Get total count
      const [{ count }] = await this.drizzle.db
        .select({ count: sql<number>`count(*)` })
        .from(loyaltyRewards)
        .where(whereClause);

      // Get paginated results
      const offset = (query.page - 1) * query.limit;
      const orderBy = query.sortOrder === 'asc' 
        ? asc(loyaltyRewards[query.sortBy as keyof typeof loyaltyRewards] || loyaltyRewards.pointsRequired)
        : desc(loyaltyRewards[query.sortBy as keyof typeof loyaltyRewards] || loyaltyRewards.pointsRequired);

      const results = await this.drizzle.db
        .select()
        .from(loyaltyRewards)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(query.limit)
        .offset(offset);

      return {
        rewards: results.map(r => this.mapRewardToEntity(r)),
        total: count,
      };
    } catch (error) {
      this.logger.error(`Failed to find loyalty rewards for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findRewardById(tenantId: string, id: string): Promise<any | null> {
    try {
      const [reward] = await this.drizzle.db
        .select()
        .from(loyaltyRewards)
        .where(and(
          eq(loyaltyRewards.tenantId, tenantId),
          eq(loyaltyRewards.id, id),
          isNull(loyaltyRewards.deletedAt)
        ));

      return reward ? this.mapRewardToEntity(reward) : null;
    } catch (error) {
      this.logger.error(`Failed to find loyalty reward ${id}:`, error);
      throw error;
    }
  }

  async updateReward(tenantId: string, id: string, data: UpdateRewardDto, userId: string): Promise<any> {
    try {
      const updateData: any = { ...data, updatedBy: userId };
      
      // Convert string dates to Date objects
      if (data.startDate) {
        updateData.startDate = new Date(data.startDate);
      }
      if (data.endDate) {
        updateData.endDate = new Date(data.endDate);
      }

      // Convert numbers to strings for decimal fields
      if (data.value !== undefined) {
        updateData.value = data.value.toString();
      }
      if (data.minimumOrderValue !== undefined) {
        updateData.minimumOrderValue = data.minimumOrderValue.toString();
      }
      if (data.maximumDiscountAmount !== undefined) {
        updateData.maximumDiscountAmount = data.maximumDiscountAmount.toString();
      }

      const [reward] = await this.drizzle.db
        .update(loyaltyRewards)
        .set(updateData)
        .where(and(
          eq(loyaltyRewards.tenantId, tenantId),
          eq(loyaltyRewards.id, id),
          isNull(loyaltyRewards.deletedAt)
        ))
        .returning();

      if (!reward) {
        throw new Error(`Loyalty reward ${id} not found`);
      }

      this.logger.log(`Updated loyalty reward ${id} for tenant ${tenantId}`);
      return this.mapRewardToEntity(reward);
    } catch (error) {
      this.logger.error(`Failed to update loyalty reward ${id}:`, error);
      throw error;
    }
  }

  async deleteReward(tenantId: string, id: string, userId: string): Promise<void> {
    try {
      await this.drizzle.db
        .update(loyaltyRewards)
        .set({
          deletedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(
          eq(loyaltyRewards.tenantId, tenantId),
          eq(loyaltyRewards.id, id),
          isNull(loyaltyRewards.deletedAt)
        ));

      this.logger.log(`Deleted loyalty reward ${id} for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to delete loyalty reward ${id}:`, error);
      throw error;
    }
  }

  // Loyalty Campaigns
  async createCampaign(tenantId: string, data: CreateCampaignDto, userId: string): Promise<any> {
    try {
      const [campaign] = await this.drizzle.db
        .insert(loyaltyCampaigns)
        .values({
          tenantId,
          name: data.name,
          description: data.description,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          pointsMultiplier: data.pointsMultiplier.toString(),
          minimumPurchaseAmount: data.minimumPurchaseAmount?.toString(),
          targetSegments: data.targetSegments || [],
          targetTiers: data.targetTiers || [],
          applicableCategories: data.applicableCategories || [],
          applicableProducts: data.applicableProducts || [],
          maxPointsPerCustomer: data.maxPointsPerCustomer,
          totalPointsBudget: data.totalPointsBudget,
          termsAndConditions: data.termsAndConditions,
          metadata: data.metadata || {},
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      this.logger.log(`Created loyalty campaign ${campaign.id} for tenant ${tenantId}`);
      return this.mapCampaignToEntity(campaign);
    } catch (error) {
      this.logger.error(`Failed to create loyalty campaign:`, error);
      throw error;
    }
  }

  async findActiveCampaigns(tenantId: string): Promise<any[]> {
    try {
      const now = new Date();
      const campaigns = await this.drizzle.db
        .select()
        .from(loyaltyCampaigns)
        .where(and(
          eq(loyaltyCampaigns.tenantId, tenantId),
          eq(loyaltyCampaigns.status, 'active'),
          lte(loyaltyCampaigns.startDate, now),
          gte(loyaltyCampaigns.endDate, now),
          isNull(loyaltyCampaigns.deletedAt)
        ))
        .orderBy(desc(loyaltyCampaigns.createdAt));

      return campaigns.map(c => this.mapCampaignToEntity(c));
    } catch (error) {
      this.logger.error(`Failed to find active campaigns for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  private mapTransactionToEntity(transaction: any): LoyaltyTransaction {
    return {
      id: transaction.id,
      tenantId: transaction.tenantId,
      customerId: transaction.customerId,
      type: transaction.type,
      points: transaction.points,
      description: transaction.description,
      relatedTransactionId: transaction.relatedTransactionId,
      expiresAt: transaction.expiresAt,
      campaignId: transaction.campaignId,
      promotionId: transaction.promotionId,
      createdAt: transaction.createdAt,
    };
  }

  private mapRewardToEntity(reward: any): any {
    return {
      id: reward.id,
      tenantId: reward.tenantId,
      name: reward.name,
      description: reward.description,
      type: reward.type,
      pointsRequired: reward.pointsRequired,
      value: reward.value ? parseFloat(reward.value) : null,
      productId: reward.productId,
      minimumOrderValue: reward.minimumOrderValue ? parseFloat(reward.minimumOrderValue) : null,
      maximumDiscountAmount: reward.maximumDiscountAmount ? parseFloat(reward.maximumDiscountAmount) : null,
      startDate: reward.startDate,
      endDate: reward.endDate,
      isActive: reward.isActive,
      usageLimitPerCustomer: reward.usageLimitPerCustomer,
      totalUsageLimit: reward.totalUsageLimit,
      currentUsageCount: reward.currentUsageCount,
      requiredTiers: reward.requiredTiers || [],
      termsAndConditions: reward.termsAndConditions,
      metadata: reward.metadata || {},
      createdAt: reward.createdAt,
      updatedAt: reward.updatedAt,
    };
  }

  private mapCampaignToEntity(campaign: any): any {
    return {
      id: campaign.id,
      tenantId: campaign.tenantId,
      name: campaign.name,
      description: campaign.description,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      pointsMultiplier: parseFloat(campaign.pointsMultiplier),
      minimumPurchaseAmount: campaign.minimumPurchaseAmount ? parseFloat(campaign.minimumPurchaseAmount) : null,
      targetSegments: campaign.targetSegments || [],
      targetTiers: campaign.targetTiers || [],
      applicableCategories: campaign.applicableCategories || [],
      applicableProducts: campaign.applicableProducts || [],
      maxPointsPerCustomer: campaign.maxPointsPerCustomer,
      totalPointsBudget: campaign.totalPointsBudget,
      currentPointsAwarded: campaign.currentPointsAwarded,
      status: campaign.status,
      termsAndConditions: campaign.termsAndConditions,
      participantCount: campaign.participantCount,
      totalTransactions: campaign.totalTransactions,
      totalRevenue: parseFloat(campaign.totalRevenue || '0'),
      metadata: campaign.metadata || {},
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }
}