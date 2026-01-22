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
import { FranchiseGQLType, LocationGQLType } from '../types/location.types';
import { CreateLocationDto, UpdateLocationDto } from '../dto/location.dto';

@Resolver(() => FranchiseGQLType)
@UseGuards(JwtAuthGuard)
export class FranchiseLocationResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly franchiseService: FranchiseService,
    private readonly locationService: LocationService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => [FranchiseGQLType], { name: 'getFranchiseLocations' })
  @UseGuards(PermissionsGuard)
  @Permissions('franchise:read')
  async getFranchiseLocations(
    @Args('franchiseId', { type: () => ID }) franchiseId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.franchiseService.getFranchiseLocations(tenantId, franchiseId);
  }

  @Query(() => FranchiseGQLType, { name: 'getFranchiseLocation', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('franchise:read')
  async getFranchiseLocation(
    @Args('franchiseId', { type: () => ID }) franchiseId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.franchiseService.getFranchiseLocations(tenantId, franchiseId).then(locations =>
      locations.find((loc: any) => loc.id === locationId)
    );
  }

  @Mutation(() => FranchiseGQLType, { name: 'createFranchiseLocation' })
  @UseGuards(PermissionsGuard)
  @Permissions('franchise:create')
  async createFranchiseLocation(
    @Args('franchiseId', { type: () => ID }) franchiseId: string,
    @Args('input', { type: () => CreateLocationDto }) input: CreateLocationDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.locationService.createLocation(tenantId, input, user.id);
  }

  @Mutation(() => FranchiseGQLType, { name: 'updateFranchiseLocation' })
  @UseGuards(PermissionsGuard)
  @Permissions('franchise:update')
  async updateFranchiseLocation(
    @Args('franchiseId', { type: () => ID }) franchiseId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('input', { type: () => UpdateLocationDto }) input: UpdateLocationDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.locationService.updateLocation(tenantId, locationId, input, user.id);
  }

  @Mutation(() => Boolean, { name: 'deleteFranchiseLocation' })
  @UseGuards(PermissionsGuard)
  @Permissions('franchise:delete')
  async deleteFranchiseLocation(
    @Args('franchiseId', { type: () => ID }) franchiseId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.locationService.deleteLocation(tenantId, locationId, user.id);
    return true;
  }

  @ResolveField(() => [LocationGQLType], { name: 'locations' })
  async locations(@Parent() franchise: any): Promise<any[]> {
    return this.franchiseService.getFranchiseLocations(franchise.tenantId, franchise.id);
  }

  @ResolveField(() => LocationGQLType, { name: 'primaryLocation', nullable: true })
  async primaryLocation(@Parent() franchise: any): Promise<any> {
    const locations = await this.locations(franchise);
    return locations.find(location => location.isPrimary) || null;
  }

  @ResolveField(() => Number, { name: 'totalLocations' })
  async totalLocations(@Parent() franchise: any): Promise<number> {
    const locations = await this.locations(franchise);
    return locations.length;
  }

  @ResolveField(() => Number, { name: 'activeLocations' })
  async activeLocations(@Parent() franchise: any): Promise<number> {
    const locations = await this.locations(franchise);
    return locations.filter(location => location.status === 'active').length;
  }
}