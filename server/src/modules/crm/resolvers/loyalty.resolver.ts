import { Resolver, Query, Mutation, Args, ID, Int, Float } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { LoyaltyService } from '../services/loyalty.service';
import { 
  CreateRewardDto, 
  UpdateRewardDto, 
  CreateCampaignDto,
  LoyaltyQueryDto,
  RewardQueryDto 
} from '../dto/loyalty.dto';
import { LoyaltyTransaction } from '../entities/customer.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver(() => LoyaltyTransaction)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('loyalty-program')
export class LoyaltyResolver {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Query(() => [LoyaltyTransaction])
  @RequirePermission('loyalty:read')
  async loyaltyTransactions(
    @Args('query', { type: () => LoyaltyQueryDto, nullable: true }) query: LoyaltyQueryDto = {},
    @CurrentTenant() tenantId: string,
  ): Promise<LoyaltyTransaction[]> {
    const result = await this.loyaltyService.getLoyaltyTransactions(tenantId, query);
    return result.transactions;
  }

  @Mutation(() => LoyaltyTransaction)
  @RequirePermission('loyalty:manage-points')
  async awardLoyaltyPoints(
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('points', { type: () => Int }) points: number,
    @Args('reason') reason: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
    @Args('relatedTransactionId', { type: () => ID, nullable: true }) relatedTransactionId?: string,
    @Args('campaignId', { type: () => ID, nullable: true }) campaignId?: string,
  ): Promise<LoyaltyTransaction> {
    return this.loyaltyService.awardPoints(
      tenantId,
      customerId,
      points,
      reason,
      relatedTransactionId,
      campaignId,
      user.id,
    );
  }

  @Mutation(() => LoyaltyTransaction)
  @RequirePermission('loyalty:manage-points')
  async redeemLoyaltyPoints(
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('points', { type: () => Int }) points: number,
    @Args('reason') reason: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
    @Args('relatedTransactionId', { type: () => ID, nullable: true }) relatedTransactionId?: string,
  ): Promise<LoyaltyTransaction> {
    return this.loyaltyService.redeemPoints(
      tenantId,
      customerId,
      points,
      reason,
      relatedTransactionId,
      user.id,
    );
  }

  @Mutation(() => LoyaltyTransaction)
  @RequirePermission('loyalty:manage-points')
  async adjustLoyaltyPoints(
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('pointsChange', { type: () => Int }) pointsChange: number,
    @Args('reason') reason: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LoyaltyTransaction> {
    return this.loyaltyService.adjustPoints(
      tenantId,
      customerId,
      pointsChange,
      reason,
      user.id,
    );
  }

  @Mutation(() => Boolean)
  @RequirePermission('loyalty:manage-rewards')
  async createLoyaltyReward(
    @Args('input') input: CreateRewardDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.loyaltyService.createReward(tenantId, input, user.id);
    return true;
  }

  @Mutation(() => Boolean)
  @RequirePermission('loyalty:manage-campaigns')
  async createLoyaltyCampaign(
    @Args('input') input: CreateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.loyaltyService.createCampaign(tenantId, input, user.id);
    return true;
  }
}