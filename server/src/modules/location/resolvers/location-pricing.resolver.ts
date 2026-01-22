import { Resolver, Query, Mutation, Args, ResolveField, Parent, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { LocationPricingService } from '../services/location-pricing.service';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LocationPricingResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly pricingService: LocationPricingService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => GraphQLJSONObject, { name: 'getLocationPricing' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getLocationPricing(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('productId', { type: () => ID, nullable: true }) productId: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.pricingService.getLocationPricing(tenantId, locationId, productId);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'updateLocationPricing' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async updateLocationPricing(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('pricing', { type: () => GraphQLJSONObject }) pricing: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.pricingService.updateLocationPricing(tenantId, locationId, pricing, user.id);
  }

  @Query(() => GraphQLJSONObject, { name: 'getPricingRules' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getPricingRules(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.pricingService.getPricingRules(tenantId, locationId);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'applyPricingRule' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async applyPricingRule(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('ruleId', { type: () => ID }) ruleId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.pricingService.applyPricingRule(tenantId, locationId, ruleId, user.id);
  }
}
