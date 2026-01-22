import { Resolver, Query, Mutation, Args, ResolveField, Parent, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { FranchiseService } from '../services/franchise.service';
import { LocationService } from '../services/location.service';
import { GraphQLJSONObject } from 'graphql-type-json';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
class TerritoryType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => [GraphQLJSONObject])
  locations?: any[];

  @Field(() => GraphQLJSONObject, { nullable: true })
  manager?: any;
}

@Resolver(() => TerritoryType)
@UseGuards(JwtAuthGuard)
export class TerritoryResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly franchiseService: FranchiseService,
    private readonly locationService: LocationService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => TerritoryType, { name: 'territory' })
  @UseGuards(PermissionsGuard)
  @Permissions('territory:read')
  async getTerritory(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.franchiseService.getTerritoryById(tenantId, id);
  }

  @Query(() => [TerritoryType], { name: 'territories' })
  @UseGuards(PermissionsGuard)
  @Permissions('territory:read')
  async getTerritories(
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const { territories } = await this.franchiseService.getTerritories(tenantId, {});
    return territories;
  }

  @Mutation(() => TerritoryType, { name: 'createTerritory' })
  @UseGuards(PermissionsGuard)
  @Permissions('territory:create')
  async createTerritory(
    @Args('input', { type: () => GraphQLJSONObject }) input: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.franchiseService.createTerritory(tenantId, input, user.id);
  }

  @Mutation(() => TerritoryType, { name: 'updateTerritory' })
  @UseGuards(PermissionsGuard)
  @Permissions('territory:update')
  async updateTerritory(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => GraphQLJSONObject }) input: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.franchiseService.updateTerritory(tenantId, id, input, user.id);
  }

  @Mutation(() => Boolean, { name: 'assignLocationToTerritory' })
  @UseGuards(PermissionsGuard)
  @Permissions('territory:update')
  async assignLocationToTerritory(
    @Args('territoryId', { type: () => ID }) territoryId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.franchiseService.assignLocationToTerritory(tenantId, territoryId, locationId, user.id);
    return true;
  }

  @ResolveField(() => [GraphQLJSONObject])
  async locations(
    @Parent() territory: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const { locations } = await this.locationService.findAll(tenantId, {
      // Filter by territory if needed
      limit: 100,
    });
    return locations;
  }

  @ResolveField(() => GraphQLJSONObject, { nullable: true })
  async manager(
    @Parent() territory: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    if (!territory.managerId) {
      return null;
    }
    // Placeholder - would integrate with employee service
    return { id: territory.managerId, name: 'Manager Name' };
  }
}
