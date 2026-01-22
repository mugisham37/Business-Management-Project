import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { LocationReportingService } from '../services/location-reporting.service';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LocationReportingResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly reportingService: LocationReportingService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => GraphQLJSONObject, { name: 'getLocationSalesReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getLocationSalesReport(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('startDate', { nullable: true }) startDate: Date | undefined,
    @Args('endDate', { nullable: true }) endDate: Date | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.reportingService.getLocationSalesReport(tenantId, locationId, startDate, endDate);
  }

  @Query(() => GraphQLJSONObject, { name: 'getLocationInventoryReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getLocationInventoryReport(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.reportingService.getLocationInventoryReport(tenantId, locationId);
  }

  @Query(() => GraphQLJSONObject, { name: 'getLocationPerformanceReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getLocationPerformanceReport(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('period', { nullable: true }) period: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.reportingService.getLocationPerformanceReport(tenantId, locationId, period || 'monthly');
  }

  @Query(() => GraphQLJSONObject, { name: 'compareLocations' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async compareLocations(
    @Args('locationIds', { type: () => [ID] }) locationIds: string[],
    @Args('metrics', { type: () => [String] }) metrics: string[],
    @Args('period', { nullable: true }) period: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.reportingService.compareLocations(tenantId, locationIds, metrics, period || 'monthly');
  }
}
