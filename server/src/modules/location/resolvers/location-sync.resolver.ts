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
import { LocationSyncService } from '../services/location-sync.service';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LocationSyncResolver extends BaseResolver {
  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly syncService: LocationSyncService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  @Query(() => GraphQLJSONObject, { name: 'getSyncStatus' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getSyncStatus(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.syncService.getSyncStatus(tenantId, locationId);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'triggerSync' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async triggerSync(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('syncType', { nullable: true }) syncType: string | undefined,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const result = await this.syncService.triggerSync(tenantId, locationId, syncType || 'full', user.id);

    await this.pubSub.publish('syncStatusChanged', {
      syncStatusChanged: result,
      tenantId,
    });

    return result;
  }

  @Query(() => [GraphQLJSONObject], { name: 'getSyncHistory' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getSyncHistory(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('limit', { nullable: true }) limit: number | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.syncService.getSyncHistory(tenantId, locationId, limit || 50);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'resolveSyncConflict' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async resolveSyncConflict(
    @Args('conflictId', { type: () => ID }) conflictId: string,
    @Args('resolution', { type: () => GraphQLJSONObject }) resolution: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.syncService.resolveSyncConflict(tenantId, conflictId, resolution, user.id);
  }

  @Subscription(() => GraphQLJSONObject, {
    filter: (payload, variables, context) => {
      return payload.tenantId === context.req.user.tenantId;
    },
  })
  syncStatusChanged(@CurrentTenant() tenantId: string) {
    return this.pubSub.asyncIterator('syncStatusChanged');
  }
}
