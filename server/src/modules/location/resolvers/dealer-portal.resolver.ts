import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { FranchiseService } from '../services/franchise.service';
import { GraphQLJSONObject } from 'graphql-type-json';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
class DealerDashboardType {
  @Field(() => GraphQLJSONObject)
  franchise!: any;

  @Field(() => GraphQLJSONObject)
  performance!: any;

  @Field(() => GraphQLJSONObject)
  inventory!: any;

  @Field(() => GraphQLJSONObject)
  orders!: any;
}

@Resolver()
@UseGuards(JwtAuthGuard)
export class DealerPortalResolver extends BaseResolver {
  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly franchiseService: FranchiseService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => DealerDashboardType, { name: 'getDealerDashboard' })
  @UseGuards(PermissionsGuard)
  @Permissions('dealer-portal:access')
  async getDealerDashboard(
    @Args('franchiseId', { type: () => ID }) franchiseId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.franchiseService.getDealerDashboard(tenantId, franchiseId, user.id);
  }

  @Query(() => GraphQLJSONObject, { name: 'getDealerOrders' })
  @UseGuards(PermissionsGuard)
  @Permissions('dealer-portal:access')
  async getDealerOrders(
    @Args('franchiseId', { type: () => ID }) franchiseId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    await this.franchiseService.validateDealerPortalAccess(tenantId, franchiseId, user.id);
    // Placeholder - would integrate with order service
    return { orders: [], total: 0 };
  }

  @Query(() => GraphQLJSONObject, { name: 'getDealerInventory' })
  @UseGuards(PermissionsGuard)
  @Permissions('dealer-portal:access')
  async getDealerInventory(
    @Args('franchiseId', { type: () => ID }) franchiseId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    await this.franchiseService.validateDealerPortalAccess(tenantId, franchiseId, user.id);
    // Placeholder - would integrate with inventory service
    return { inventory: [], total: 0 };
  }

  @Mutation(() => GraphQLJSONObject, { name: 'submitDealerOrder' })
  @UseGuards(PermissionsGuard)
  @Permissions('dealer-portal:access')
  async submitDealerOrder(
    @Args('franchiseId', { type: () => ID }) franchiseId: string,
    @Args('orderData', { type: () => GraphQLJSONObject }) orderData: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    await this.franchiseService.validateDealerPortalAccess(tenantId, franchiseId, user.id);
    // Placeholder - would integrate with order service
    return { orderId: 'ORDER-123', success: true };
  }
}
