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
import { LocationOfflineService } from '../services/location-offline.service';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LocationOfflineResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly offlineService: LocationOfflineService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  @Query(() => GraphQLJSONObject, { name: 'getOfflineQueueStatus' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getOfflineQueueStatus(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.offlineService.getOfflineQueueStatus(tenantId, locationId);
  }

  @Query(() => [GraphQLJSONObject], { name: 'getOfflineQueue' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getOfflineQueue(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.offlineService.getOfflineQueue(tenantId, locationId);
  }

  @Query(() => Boolean, { name: 'isLocationOnline' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async isLocationOnline(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    return this.offlineService.isLocationOnline(tenantId, locationId);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'updateConnectionStatus' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async updateConnectionStatus(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('isOnline') isOnline: boolean,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    await this.offlineService.updateConnectionStatus(tenantId, locationId, isOnline);

    await this.pubSub.publish('connectionStatusChanged', {
      connectionStatusChanged: { locationId, isOnline, timestamp: new Date() },
      tenantId,
    });

    return { success: true, locationId, isOnline };
  }

  @Mutation(() => GraphQLJSONObject, { name: 'queueOfflineOperation' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async queueOfflineOperation(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('operation', { type: () => GraphQLJSONObject }) operation: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const operationId = await this.offlineService.queueOfflineOperation({
      tenantId,
      locationId,
      operationType: operation.operationType,
      entityType: operation.entityType,
      entityId: operation.entityId,
      data: operation.data,
      timestamp: new Date(),
      userId: user.id,
      maxRetries: operation.maxRetries || 3,
    });

    return { success: true, operationId };
  }

  @Mutation(() => GraphQLJSONObject, { name: 'attemptOfflineSync' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async attemptOfflineSync(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const syncedCount = await this.offlineService.attemptSync(tenantId, locationId);

    await this.pubSub.publish('offlineSyncCompleted', {
      offlineSyncCompleted: { locationId, syncedCount, timestamp: new Date() },
      tenantId,
    });

    return { success: true, syncedCount };
  }

  @Mutation(() => GraphQLJSONObject, { name: 'retryFailedOperations' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async retryFailedOperations(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const retriedCount = await this.offlineService.retryFailedOperations(tenantId, locationId);

    return { success: true, retriedCount };
  }

  @Mutation(() => GraphQLJSONObject, { name: 'clearOfflineQueue' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:update')
  async clearOfflineQueue(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    await this.offlineService.clearOfflineQueue(tenantId, locationId);

    return { success: true, message: 'Offline queue cleared successfully' };
  }

  @Subscription(() => GraphQLJSONObject, {
    filter: (payload, variables, context) => {
      return payload.tenantId === context.req.user.tenantId;
    },
  })
  connectionStatusChanged(@CurrentTenant() tenantId: string) {
    return (this.pubSub as any).asyncIterator('connectionStatusChanged');
  }

  @Subscription(() => GraphQLJSONObject, {
    filter: (payload, variables, context) => {
      return payload.tenantId === context.req.user.tenantId;
    },
  })
  offlineSyncCompleted(@CurrentTenant() tenantId: string) {
    return (this.pubSub as any).asyncIterator('offlineSyncCompleted');
  }
}