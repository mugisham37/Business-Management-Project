import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoyaltyRepository } from '../repositories/loyalty.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { 
  CreateLoyaltyTransactionDto, 
  CreateRewardDto, 
  UpdateRewardDto, 
  CreateCampaignDto,
  LoyaltyQueryDto,
  RewardQueryDto 
} from '../dto/loyalty.dto';
import { LoyaltyTransaction } from '../entities/customer.entity';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private readonly loyaltyRepository: LoyaltyRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Loyalty Points Management
  async awardPoints(
    tenantId: string, 
    customerId: string, 
    points: number, 
    reason: string,
    relatedTransactionId?: string,
    campaignId?: string,
    userId?: string
  ): Promise<LoyaltyTransaction> {
    try {
      // Validate customer exists
      const customer = await this.customerRepository.findById(tenantId, customerId);
      if (!customer) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      // Calculate expiration date (1 year from now)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      // Create loyalty transaction
      const transaction = await this.loyaltyRepository.createTransaction(
        tenantId,
        {
          customerId,
          type: 'earned',
          points,
          description: reason,
          relatedTransactionId,
          campaignId,
          expiresAt: expiresAt.toISOString(),
        },
        userId || 'system'
      );

      // Update customer loyalty points
      await this.customerRepository.updateLoyaltyPoints(tenantId, customerId, points);

      // Clear caches
      await this.invalidateLoyaltyCaches(tenantId, customerId);

      // Emit event
      this.eventEmitter.emit('loyalty.points.awarded', {
        tenantId,
        customerId,
        points,
        reason,
        transactionId: transaction.id,
        relatedTransactionId,
        campaignId,
      });

      this.logger.log(`Awarded ${points} points to customer ${customerId}: ${reason}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to award points to customer ${customerId}:`, error);
      throw error;
    }
  }

  async redeemPoints(
    tenantId: string, 
    customerId: string, 
    points: number, 
    reason: string,
    relatedTransactionId?: string,
    userId?: string
  ): Promise<LoyaltyTransaction> {
    try {
      // Validate customer exists and has enough points
      const customer = await this.customerRepository.findById(tenantId, customerId);
      if (!customer) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      if (customer.loyaltyPoints < points) {
        throw new BadRequestException(`Customer has insufficient points. Available: ${customer.loyaltyPoints}, Required: ${points}`);
      }

      // Create loyalty transaction (negative points for redemption)
      const transaction = await this.loyaltyRepository.createTransaction(
        tenantId,
        {
          customerId,
          type: 'redeemed',
          points: -points, // Negative for redemption
          description: reason,
          relatedTransactionId,
        },
        userId || 'system'
      );

      // Update customer loyalty points
      await this.customerRepository.updateLoyaltyPoints(tenantId, customerId, -points);

      // Clear caches
      await this.invalidateLoyaltyCaches(tenantId, customerId);

      // Emit event
      this.eventEmitter.emit('loyalty.points.redeemed', {
        tenantId,
        customerId,
        points,
        reason,
        transactionId: transaction.id,
        relatedTransactionId,
      });

      this.logger.log(`Redeemed ${points} points from customer ${customerId}: ${reason}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to redeem points from customer ${customerId}:`, error);
      throw error;
    }
  }

  async adjustPoints(
    tenantId: string, 
    customerId: string, 
    pointsChange: number, 
    reason: string,
    userId: string
  ): Promise<LoyaltyTransaction> {
    try {
      // Validate customer exists
      const customer = await this.customerRepository.findById(tenantId, customerId);
      if (!customer) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      // If reducing points, ensure customer has enough
      if (pointsChange < 0 && customer.loyaltyPoints < Math.abs(pointsChange)) {
        throw new BadRequestException(`Customer has insufficient points for adjustment. Available: ${customer.loyaltyPoints}, Adjustment: ${pointsChange}`);
      }

      // Create loyalty transaction
      const transaction = await this.loyaltyRepository.createTransaction(
        tenantId,
        {
          customerId,
          type: 'adjusted',
          points: pointsChange,
          description: reason,
        },
        userId
      );

      // Update customer loyalty points
      await this.customerRepository.updateLoyaltyPoints(tenantId, customerId, pointsChange);

      // Clear caches
      await this.invalidateLoyaltyCaches(tenantId, customerId);

      // Emit event
      this.eventEmitter.emit('loyalty.points.adjusted', {
        tenantId,
        customerId,
        pointsChange,
        reason,
        transactionId: transaction.id,
        userId,
      });

      this.logger.log(`Adjusted ${pointsChange} points for customer ${customerId}: ${reason}`);
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to adjust points for customer ${customerId}:`, error);
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
      const cacheKey = `loyalty-balance:${tenantId}:${customerId}`;
      
      // Try cache first
      let balance = await this.cacheService.get<any>(cacheKey);
      
      if (!balance) {
        balance = await this.loyaltyRepository.getCustomerPointsBalance(tenantId, customerId);
        
        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, balance, 300);
      }

      return balance;
    } catch (error) {
      this.logger.error(`Failed to get points balance for customer ${customerId}:`, error);
      throw error;
    }
  }

  async getLoyaltyTransactions(tenantId: string, query: LoyaltyQueryDto): Promise<{ transactions: LoyaltyTransaction[]; total: number }> {
    try {
      return await this.loyaltyRepository.findTransactions(tenantId, query);
    } catch (error) {
      this.logger.error(`Failed to get loyalty transactions for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // Rewards Management
  async createReward(tenantId: string, data: CreateRewardDto, userId: string): Promise<any> {
    try {
      // Validate reward data
      await this.validateRewardData(data);

      const reward = await this.loyaltyRepository.createReward(tenantId, data, userId);

      // Clear rewards cache
      await this.invalidateRewardsCaches(tenantId);

      // Emit event
      this.eventEmitter.emit('loyalty.reward.created', {
        tenantId,
        rewardId: reward.id,
        reward,
        userId,
      });

      this.logger.log(`Created loyalty reward ${reward.id} for tenant ${tenantId}`);
      return reward;
    } catch (error) {
      this.logger.error(`Failed to create loyalty reward for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getRewards(tenantId: string, query: RewardQueryDto): Promise<{ rewards: any[]; total: number }> {
    try {
      const cacheKey = `loyalty-rewards:${tenantId}:${JSON.stringify(query)}`;
      
      // Try cache first for common queries
      let result = await this.cacheService.get<{ rewards: any[]; total: number }>(cacheKey);
      
      if (!result) {
        result = await this.loyaltyRepository.findRewards(tenantId, query);
        
        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, result, 300);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to get loyalty rewards for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getRewardById(tenantId: string, id: string): Promise<any> {
    try {
      const cacheKey = `loyalty-reward:${tenantId}:${id}`;
      
      // Try cache first
      let reward = await this.cacheService.get<any>(cacheKey);
      
      if (!reward) {
        reward = await this.loyaltyRepository.findRewardById(tenantId, id);
        
        if (!reward) {
          throw new NotFoundException(`Loyalty reward ${id} not found`);
        }

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, reward, 600);
      }

      return reward;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get loyalty reward ${id} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async updateReward(tenantId: string, id: string, data: UpdateRewardDto, userId: string): Promise<any> {
    try {
      // Validate reward exists
      await this.getRewardById(tenantId, id);

      // Validate update data
      if (data.pointsRequired !== undefined || data.value !== undefined) {
        await this.validateRewardData(data as any);
      }

      const reward = await this.loyaltyRepository.updateReward(tenantId, id, data, userId);

      // Clear caches
      await this.invalidateRewardsCaches(tenantId, id);

      // Emit event
      this.eventEmitter.emit('loyalty.reward.updated', {
        tenantId,
        rewardId: id,
        reward,
        userId,
      });

      this.logger.log(`Updated loyalty reward ${id} for tenant ${tenantId}`);
      return reward;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to update loyalty reward ${id} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async deleteReward(tenantId: string, id: string, userId: string): Promise<void> {
    try {
      // Validate reward exists
      await this.getRewardById(tenantId, id);

      await this.loyaltyRepository.deleteReward(tenantId, id, userId);

      // Clear caches
      await this.invalidateRewardsCaches(tenantId, id);

      // Emit event
      this.eventEmitter.emit('loyalty.reward.deleted', {
        tenantId,
        rewardId: id,
        userId,
      });

      this.logger.log(`Deleted loyalty reward ${id} for tenant ${tenantId}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete loyalty reward ${id} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // Campaigns Management
  async createCampaign(tenantId: string, data: CreateCampaignDto, userId: string): Promise<any> {
    try {
      // Validate campaign data
      await this.validateCampaignData(data);

      const campaign = await this.loyaltyRepository.createCampaign(tenantId, data, userId);

      // Clear campaigns cache
      await this.invalidateCampaignsCaches(tenantId);

      // Emit event
      this.eventEmitter.emit('loyalty.campaign.created', {
        tenantId,
        campaignId: campaign.id,
        campaign,
        userId,
      });

      this.logger.log(`Created loyalty campaign ${campaign.id} for tenant ${tenantId}`);
      return campaign;
    } catch (error) {
      this.logger.error(`Failed to create loyalty campaign for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getActiveCampaigns(tenantId: string): Promise<any[]> {
    try {
      const cacheKey = `loyalty-active-campaigns:${tenantId}`;
      
      // Try cache first
      let campaigns = await this.cacheService.get<any[]>(cacheKey);
      
      if (!campaigns) {
        campaigns = await this.loyaltyRepository.findActiveCampaigns(tenantId);
        
        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, campaigns, 600);
      }

      return campaigns;
    } catch (error) {
      this.logger.error(`Failed to get active campaigns for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // Calculate points for a purchase
  async calculatePointsForPurchase(
    tenantId: string, 
    customerId: string, 
    purchaseAmount: number,
    productIds?: string[],
    categoryIds?: string[]
  ): Promise<{
    basePoints: number;
    bonusPoints: number;
    totalPoints: number;
    applicableCampaigns: any[];
  }> {
    try {
      // Base points calculation (1 point per dollar spent)
      const basePoints = Math.floor(purchaseAmount);

      // Get active campaigns
      const campaigns = await this.getActiveCampaigns(tenantId);

      let bonusPoints = 0;
      const applicableCampaigns: any[] = [];

      // Get customer info for tier checking
      const customer = await this.customerRepository.findById(tenantId, customerId);

      for (const campaign of campaigns) {
        let isApplicable = true;

        // Check minimum purchase amount
        if (campaign.minimumPurchaseAmount && purchaseAmount < campaign.minimumPurchaseAmount) {
          isApplicable = false;
        }

        // Check target tiers
        if (campaign.targetTiers.length > 0 && !campaign.targetTiers.includes(customer?.loyaltyTier)) {
          isApplicable = false;
        }

        // Check applicable products
        if (campaign.applicableProducts.length > 0 && productIds) {
          const hasApplicableProduct = productIds.some(id => campaign.applicableProducts.includes(id));
          if (!hasApplicableProduct) {
            isApplicable = false;
          }
        }

        // Check applicable categories
        if (campaign.applicableCategories.length > 0 && categoryIds) {
          const hasApplicableCategory = categoryIds.some(id => campaign.applicableCategories.includes(id));
          if (!hasApplicableCategory) {
            isApplicable = false;
          }
        }

        if (isApplicable) {
          const campaignPoints = Math.floor(basePoints * (campaign.pointsMultiplier - 1));
          bonusPoints += campaignPoints;
          applicableCampaigns.push({
            ...campaign,
            pointsAwarded: campaignPoints,
          });
        }
      }

      const totalPoints = basePoints + bonusPoints;

      return {
        basePoints,
        bonusPoints,
        totalPoints,
        applicableCampaigns,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate points for purchase:`, error);
      throw error;
    }
  }

  private async validateRewardData(data: Partial<CreateRewardDto>): Promise<void> {
    if (data.pointsRequired !== undefined && data.pointsRequired <= 0) {
      throw new BadRequestException('Points required must be greater than 0');
    }

    if (data.value !== undefined && data.value < 0) {
      throw new BadRequestException('Reward value cannot be negative');
    }

    if (data.minimumOrderValue !== undefined && data.minimumOrderValue < 0) {
      throw new BadRequestException('Minimum order value cannot be negative');
    }

    if (data.maximumDiscountAmount !== undefined && data.maximumDiscountAmount < 0) {
      throw new BadRequestException('Maximum discount amount cannot be negative');
    }

    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (start >= end) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    if (data.usageLimitPerCustomer !== undefined && data.usageLimitPerCustomer <= 0) {
      throw new BadRequestException('Usage limit per customer must be greater than 0');
    }

    if (data.totalUsageLimit !== undefined && data.totalUsageLimit <= 0) {
      throw new BadRequestException('Total usage limit must be greater than 0');
    }
  }

  private async validateCampaignData(data: CreateCampaignDto): Promise<void> {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (start >= end) {
      throw new BadRequestException('End date must be after start date');
    }

    if (data.pointsMultiplier <= 0) {
      throw new BadRequestException('Points multiplier must be greater than 0');
    }

    if (data.minimumPurchaseAmount !== undefined && data.minimumPurchaseAmount < 0) {
      throw new BadRequestException('Minimum purchase amount cannot be negative');
    }

    if (data.maxPointsPerCustomer !== undefined && data.maxPointsPerCustomer <= 0) {
      throw new BadRequestException('Max points per customer must be greater than 0');
    }

    if (data.totalPointsBudget !== undefined && data.totalPointsBudget <= 0) {
      throw new BadRequestException('Total points budget must be greater than 0');
    }
  }

  private async invalidateLoyaltyCaches(tenantId: string, customerId?: string): Promise<void> {
    try {
      await this.cacheService.invalidatePattern(`loyalty-transactions:${tenantId}:*`);
      
      if (customerId) {
        await this.cacheService.invalidatePattern(`loyalty-balance:${tenantId}:${customerId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate loyalty caches for tenant ${tenantId}:`, error);
    }
  }

  private async invalidateRewardsCaches(tenantId: string, rewardId?: string): Promise<void> {
    try {
      await this.cacheService.invalidatePattern(`loyalty-rewards:${tenantId}:*`);
      
      if (rewardId) {
        await this.cacheService.invalidatePattern(`loyalty-reward:${tenantId}:${rewardId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate rewards caches for tenant ${tenantId}:`, error);
    }
  }

  private async invalidateCampaignsCaches(tenantId: string): Promise<void> {
    try {
      await this.cacheService.invalidatePattern(`loyalty-active-campaigns:${tenantId}`);
      await this.cacheService.invalidatePattern(`loyalty-campaigns:${tenantId}:*`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate campaigns caches for tenant ${tenantId}:`, error);
    }
  }
}