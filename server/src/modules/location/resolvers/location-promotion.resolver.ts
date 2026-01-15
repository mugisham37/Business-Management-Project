import { Resolver, Query, Mutation, Args, Subscription, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { LocationPromotionService } from '../services/location-promotion.service';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LocationPromotionResolver extends BaseResolver {
  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly promotionService: LocationPromotionService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  @Query(() => [GraphQLJSONObject], { name: 'locationPromotions' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getLocationPromotions(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.promotionService.getLocationPromotions(tenantId, locationId);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'createLocationPromotion' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async createLocationPromotion(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('promotion', { type: () => GraphQLJSONObject }) promotion: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.promotionService.createLocationPromotion(tenantId, locationId, promotion, user.id);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'activatePromotion' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async activatePromotion(
    @Args('promotionId', { type: () => ID }) promotionId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const promotion = await this.promotionService.activatePromotion(tenantId, promotionId, user.id);

    await this.pubSub.publish('promotionActivated', {
      promotionActivated: promotion,
      tenantId,
    });

    return promotion;
  }

  @Mutation(() => GraphQLJSONObject, { name: 'deactivatePromotion' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async deactivatePromotion(
    @Args('promotionId', { type: () => ID }) promotionId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.promotionService.deactivatePromotion(tenantId, promotionId, user.id);
  }

  @Subscription(() => GraphQLJSONObject, {
    filter: (payload, variables, context) => {
      return payload.tenantId === context.req.user.tenantId;
    },
  })
  promotionActivated(@CurrentTenant() tenantId: string) {
    return this.pubSub.asyncIterator('promotionActivated');
  }
}
