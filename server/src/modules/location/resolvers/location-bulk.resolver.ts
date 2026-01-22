import { Resolver, Mutation, Query, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { LocationBulkService, BulkCreateRequest, BulkUpdateRequest, BulkStatusChangeRequest, BulkDeleteRequest, BulkOperationSummary } from '../services/location-bulk.service';
import { CreateLocationDto, UpdateLocationDto, LocationStatus } from '../dto/location.dto';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LocationBulkResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly bulkService: LocationBulkService,
  ) {
    super(dataLoaderService);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'bulkCreateLocations' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:write')
  async bulkCreateLocations(
    @Args('locations', { type: () => [GraphQLJSONObject] }) locations: CreateLocationDto[],
    @Args('validateOnly', { defaultValue: false }) validateOnly: boolean,
    @Args('continueOnError', { defaultValue: false }) continueOnError: boolean,
    @CurrentTenant() tenantId: string,
    @CurrentUser() currentUser: any,
  ): Promise<BulkOperationSummary> {
    const request: BulkCreateRequest = {
      locations,
      validateOnly,
      continueOnError,
    };

    return this.bulkService.bulkCreateLocations(tenantId, request, currentUser.id);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'bulkUpdateLocations' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:write')
  async bulkUpdateLocations(
    @Args('updates', { type: () => [GraphQLJSONObject] }) updates: Array<{
      locationId: string;
      data: UpdateLocationDto;
    }>,
    @Args('validateOnly', { defaultValue: false }) validateOnly: boolean,
    @Args('continueOnError', { defaultValue: false }) continueOnError: boolean,
    @CurrentTenant() tenantId: string,
    @CurrentUser() currentUser: any,
  ): Promise<BulkOperationSummary> {
    const request: BulkUpdateRequest = {
      updates,
      validateOnly,
      continueOnError,
    };

    return this.bulkService.bulkUpdateLocations(tenantId, request, currentUser.id);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'bulkChangeLocationStatus' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:write')
  async bulkChangeLocationStatus(
    @Args('locationIds', { type: () => [ID] }) locationIds: string[],
    @Args('newStatus') newStatus: LocationStatus,
    @CurrentTenant() tenantId: string,
    @CurrentUser() currentUser: any,
    @Args('reason', { nullable: true }) reason?: string,
    @Args('validateOnly', { defaultValue: false }) validateOnly?: boolean,
    @Args('continueOnError', { defaultValue: false }) continueOnError?: boolean,
  ): Promise<BulkOperationSummary> {
    const request: BulkStatusChangeRequest = {
      locationIds,
      newStatus,
      ...(reason !== undefined && { reason }),
      ...(validateOnly !== undefined && { validateOnly }),
      ...(continueOnError !== undefined && { continueOnError }),
    };

    return this.bulkService.bulkChangeStatus(tenantId, request, currentUser.id);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'bulkDeleteLocations' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:delete')
  async bulkDeleteLocations(
    @Args('locationIds', { type: () => [ID] }) locationIds: string[],
    @CurrentTenant() tenantId: string,
    @CurrentUser() currentUser: any,
    @Args('reason', { nullable: true }) reason?: string,
    @Args('validateOnly', { defaultValue: false }) validateOnly?: boolean,
    @Args('continueOnError', { defaultValue: false }) continueOnError?: boolean,
  ): Promise<BulkOperationSummary> {
    const request: BulkDeleteRequest = {
      locationIds,
      ...(reason !== undefined && { reason }),
      ...(validateOnly !== undefined && { validateOnly }),
      ...(continueOnError !== undefined && { continueOnError }),
    };

    return this.bulkService.bulkDeleteLocations(tenantId, request, currentUser.id);
  }

  @Query(() => GraphQLJSONObject, { name: 'getBulkOperationStatus', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getBulkOperationStatus(
    @Args('operationId', { type: () => ID }) operationId: string,
  ): Promise<BulkOperationSummary | null> {
    return this.bulkService.getBulkOperationStatus(operationId);
  }

  @Query(() => [GraphQLJSONObject], { name: 'getTenantBulkOperations' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getTenantBulkOperations(
    @Args('limit', { type: () => Int, defaultValue: 50 }) limit: number,
    @CurrentTenant() tenantId: string,
  ): Promise<BulkOperationSummary[]> {
    return this.bulkService.getTenantBulkOperations(tenantId, limit);
  }

  @Mutation(() => Boolean, { name: 'cancelBulkOperation' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:write')
  async cancelBulkOperation(
    @Args('operationId', { type: () => ID }) operationId: string,
  ): Promise<boolean> {
    return this.bulkService.cancelBulkOperation(operationId);
  }
}