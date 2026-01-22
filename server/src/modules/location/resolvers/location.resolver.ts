import { Resolver, Query, Mutation, Args, ResolveField, Parent, Subscription, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { PaginationArgs } from '../../../common/graphql/pagination.args';
import { LocationGQLType, LocationConnection, LocationEdge, EmployeeType, InventoryType } from '../types/location.types';
import { CreateLocationInput, UpdateLocationInput, LocationFilterInput } from '../inputs/location.input';
import { LocationService } from '../services/location.service';
import { Location } from '../entities/location.entity';

@Resolver(() => LocationGQLType)
@UseGuards(JwtAuthGuard)
export class LocationResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly locationService: LocationService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  @Query(() => LocationGQLType, { name: 'location' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getLocation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Location> {
    const location = await this.locationService.findById(tenantId, id);
    
    // Ensure locationType is set for GraphQL compatibility
    if (location && !location.locationType) {
      location.locationType = location.type;
    }
    
    return location;
  }

  @Query(() => LocationConnection, { name: 'locations' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getLocations(
    @Args() paginationArgs: PaginationArgs,
    @Args('filter', { type: () => LocationFilterInput, nullable: true }) filter: LocationFilterInput,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationConnection> {
    const { limit, cursor, isForward } = this.parsePaginationArgs(paginationArgs);

    const query = {
      ...filter,
      limit: limit + 1,
      page: 1,
    };

    const { locations, total } = await this.locationService.findAll(tenantId, query);

    const hasMore = locations.length > limit;
    const items = hasMore ? locations.slice(0, limit) : locations;

    // Ensure locationType is set for GraphQL compatibility
    const normalizedItems = items.map(item => {
      if (!item.locationType) {
        item.locationType = item.type;
      }
      return item as any;
    });

    return {
      edges: this.createEdges(normalizedItems, (item) => item.id) as LocationEdge[],
      pageInfo: this.createPageInfo(
        hasMore && isForward,
        false,
        normalizedItems[0]?.id,
        normalizedItems[normalizedItems.length - 1]?.id,
      ),
      totalCount: total,
    };
  }

  @Query(() => [LocationGQLType], { name: 'locationTree' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getLocationTree(
    @Args('rootLocationId', { type: () => ID, nullable: true }) rootLocationId: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<Location[]> {
    const tree = await this.locationService.getLocationTree(tenantId, rootLocationId);
    
    // Ensure locationType is set for all locations and their children
    const normalizeTree = (locations: Location[]): Location[] => {
      return locations.map(location => {
        if (!location.locationType) {
          location.locationType = location.type;
        }
        if (location.childLocations && location.childLocations.length > 0) {
          location.childLocations = normalizeTree(location.childLocations);
        }
        return location;
      });
    };

    return normalizeTree(tree);
  }

  @Mutation(() => LocationGQLType, { name: 'createLocation' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:create')
  async createLocation(
    @Args('input') input: CreateLocationInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Location> {
    const location = await this.locationService.create(tenantId, input as any, user.id);

    // Ensure locationType is set for GraphQL compatibility
    if (!location.locationType) {
      location.locationType = location.type;
    }

    // Publish subscription event
    await this.pubSub.publish('locationStatusChanged', {
      locationStatusChanged: location,
      tenantId,
    });

    return location;
  }

  @Mutation(() => LocationGQLType, { name: 'updateLocation' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async updateLocation(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateLocationInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Location> {
    const location = await this.locationService.update(tenantId, id, input as any, user.id);

    // Ensure locationType is set for GraphQL compatibility
    if (!location.locationType) {
      location.locationType = location.type;
    }

    // Publish subscription event
    await this.pubSub.publish('locationStatusChanged', {
      locationStatusChanged: location,
      tenantId,
    });

    return location;
  }

  @Mutation(() => Boolean, { name: 'deleteLocation' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:delete')
  async deleteLocation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.locationService.delete(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => LocationGQLType, { name: 'closeLocation' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async closeLocation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Location> {
    const location = await this.locationService.update(
      tenantId,
      id,
      { status: 'closed' as any },
      user.id,
    );

    // Publish subscription event
    await this.pubSub.publish('locationStatusChanged', {
      locationStatusChanged: location,
      tenantId,
    });

    return location;
  }

  // Field resolvers
  @ResolveField(() => LocationGQLType, { nullable: true })
  async parentLocation(
    @Parent() location: Location,
    @CurrentTenant() tenantId: string,
  ): Promise<Location | null> {
    if (!location.parentLocationId) {
      return null;
    }

    const loader = this.getDataLoader<string, Location>(
      'location_by_id',
      async (ids) => {
        const locations = await Promise.all(
          ids.map((id) => this.locationService.findById(tenantId, id).catch(() => null)),
        );
        return locations.map((loc) => loc || new Error('Location not found'));
      },
    );

    return loader.load(location.parentLocationId);
  }

  @ResolveField(() => [LocationGQLType])
  async childLocations(
    @Parent() location: Location,
    @CurrentTenant() tenantId: string,
  ): Promise<Location[]> {
    return this.locationService.findChildren(tenantId, location.id);
  }

  @ResolveField(() => [EmployeeType])
  async employees(
    @Parent() location: Location,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    // Placeholder - would integrate with employee service
    return [];
  }

  @ResolveField(() => [InventoryType])
  async inventory(
    @Parent() location: Location,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    // Placeholder - would integrate with inventory service
    return [];
  }

  // Subscriptions
  @Subscription(() => LocationGQLType, {
    filter: (payload, variables, context) => {
      return payload.tenantId === context.req.user.tenantId;
    },
  })
  locationStatusChanged(@CurrentTenant() tenantId: string) {
    return (this.pubSub as any).asyncIterator('locationStatusChanged');
  }
}
