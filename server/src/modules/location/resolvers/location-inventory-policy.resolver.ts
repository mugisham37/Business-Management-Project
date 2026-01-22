import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { LocationInventoryPolicyService } from '../services/location-inventory-policy.service';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LocationInventoryPolicyResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly policyService: LocationInventoryPolicyService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => GraphQLJSONObject, { name: 'getInventoryPolicy' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getInventoryPolicy(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.policyService.getLocationInventoryPolicy(tenantId, locationId);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'updateInventoryPolicy' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async updateInventoryPolicy(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('policy', { type: () => GraphQLJSONObject }) policy: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.policyService.updateLocationInventoryPolicy(tenantId, locationId, policy, user.id);
  }

  @Query(() => GraphQLJSONObject, { name: 'getReorderRules' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getReorderRules(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.policyService.getReorderRules(tenantId, locationId);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'updateReorderRules' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async updateReorderRules(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('rules', { type: () => GraphQLJSONObject }) rules: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.policyService.updateReorderRules(tenantId, locationId, rules, user.id);
  }
}
