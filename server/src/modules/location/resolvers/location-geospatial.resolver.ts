import { Resolver, Query, Args, Float, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { LocationGeospatialService, GeospatialQuery, LocationDistance, GeospatialBounds, LocationCluster } from '../services/location-geospatial.service';
import { LocationStatus } from '../dto/location.dto';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LocationGeospatialResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly geospatialService: LocationGeospatialService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => [GraphQLJSONObject], { name: 'findNearbyLocations' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async findNearbyLocations(
    @Args('latitude', { type: () => Float }) latitude: number,
    @Args('longitude', { type: () => Float }) longitude: number,
    @Args('radiusKm', { type: () => Float }) radiusKm: number,
    @CurrentTenant() tenantId: string,
    @Args('maxResults', { type: () => Int, nullable: true }) maxResults?: number,
    @Args('locationTypes', { type: () => [String], nullable: true }) locationTypes?: string[],
    @Args('statuses', { type: () => [String], nullable: true }) statuses?: LocationStatus[],
  ): Promise<LocationDistance[]> {
    const query: GeospatialQuery = {
      latitude,
      longitude,
      radiusKm,
      ...(maxResults !== undefined && { maxResults }),
      ...(locationTypes !== undefined && { locationTypes }),
      ...(statuses !== undefined && { statuses }),
    };

    return this.geospatialService.findNearbyLocations(tenantId, query);
  }

  @Query(() => GraphQLJSONObject, { name: 'findClosestLocation', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async findClosestLocation(
    @Args('latitude', { type: () => Float }) latitude: number,
    @Args('longitude', { type: () => Float }) longitude: number,
    @CurrentTenant() tenantId: string,
    @Args('locationTypes', { type: () => [String], nullable: true }) locationTypes?: string[],
    @Args('statuses', { type: () => [String], nullable: true }) statuses?: LocationStatus[],
  ): Promise<LocationDistance | null> {
    return this.geospatialService.findClosestLocation(tenantId, latitude, longitude, locationTypes, statuses);
  }

  @Query(() => [GraphQLJSONObject], { name: 'findLocationsInBounds' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async findLocationsInBounds(
    @Args('northEastLat', { type: () => Float }) northEastLat: number,
    @Args('northEastLng', { type: () => Float }) northEastLng: number,
    @Args('southWestLat', { type: () => Float }) southWestLat: number,
    @Args('southWestLng', { type: () => Float }) southWestLng: number,
    @CurrentTenant() tenantId: string,
    @Args('locationTypes', { type: () => [String], nullable: true }) locationTypes?: string[],
    @Args('statuses', { type: () => [String], nullable: true }) statuses?: LocationStatus[],
  ): Promise<any[]> {
    const bounds: GeospatialBounds = {
      northEast: { latitude: northEastLat, longitude: northEastLng },
      southWest: { latitude: southWestLat, longitude: southWestLng },
    };

    return this.geospatialService.findLocationsInBounds(tenantId, bounds, locationTypes, statuses);
  }

  @Query(() => GraphQLJSONObject, { name: 'calculateCoverageArea' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async calculateCoverageArea(
    @Args('locationIds', { type: () => [String] }) locationIds: string[],
    @Args('radiusKm', { type: () => Float }) radiusKm: number,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    totalCoverageKm2: number;
    overlapKm2: number;
    coveragePolygons: Array<{
      locationId: string;
      center: { latitude: number; longitude: number };
      radiusKm: number;
      areaKm2: number;
    }>;
  }> {
    return this.geospatialService.calculateCoverageArea(tenantId, locationIds, radiusKm);
  }

  @Query(() => [GraphQLJSONObject], { name: 'clusterLocationsByProximity' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async clusterLocationsByProximity(
    @Args('maxDistanceKm', { type: () => Float }) maxDistanceKm: number,
    @Args('minClusterSize', { type: () => Int, defaultValue: 2 }) minClusterSize: number,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationCluster[]> {
    return this.geospatialService.clusterLocationsByProximity(tenantId, maxDistanceKm, minClusterSize);
  }

  @Query(() => [GraphQLJSONObject], { name: 'suggestOptimalLocation' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async suggestOptimalLocation(
    @Args('northEastLat', { type: () => Float }) northEastLat: number,
    @Args('northEastLng', { type: () => Float }) northEastLng: number,
    @Args('southWestLat', { type: () => Float }) southWestLat: number,
    @Args('southWestLng', { type: () => Float }) southWestLng: number,
    @Args('minDistanceFromExisting', { type: () => Float }) minDistanceFromExisting: number,
    @CurrentTenant() tenantId: string,
    @Args('populationDensityData', { type: () => [GraphQLJSONObject], nullable: true }) 
    populationDensityData?: Array<{ latitude: number; longitude: number; density: number }>,
  ): Promise<Array<{
    latitude: number;
    longitude: number;
    score: number;
    distanceToNearestLocation: number;
    populationDensity?: number;
    reasoning: string[];
  }>> {
    const targetArea: GeospatialBounds = {
      northEast: { latitude: northEastLat, longitude: northEastLng },
      southWest: { latitude: southWestLat, longitude: southWestLng },
    };

    return this.geospatialService.suggestOptimalLocation(
      tenantId,
      targetArea,
      minDistanceFromExisting,
      populationDensityData,
    );
  }
}