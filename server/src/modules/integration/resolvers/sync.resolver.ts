import { Resolver, Query, Mutation, Args, ID, Subscription, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, UseInterceptors, Inject } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { TenantInterceptor } from '../../tenant/interceptors/tenant.interceptor';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';

import { SyncService } from '../services/sync.service';
import { IntegrationService } from '../services/integration.service';

import {
  SyncLogType,
  SyncConflictType,
  SyncStatisticsType,
  SyncStatus,
} from '../types/sync.graphql.types';
import {
  TriggerSyncInput,
  ResolveSyncConflictInput,
  SyncFilterInput,
  ScheduleSyncInput,
} from '../inputs/sync.input';
import { Integration } from '../types/integration.graphql.types';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { PaginationArgs } from '../../../common/graphql/pagination.args';

@Resolver(() => SyncLogType)
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
export class SyncResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly syncService: SyncService,
    private readonly integrationService: IntegrationService,
    @Inject('PUB_SUB') private readonly pubSub: RedisPubSub,
  ) {
    super(dataLoaderService);
  }

  @Query(() => SyncLogType, { name: 'syncLog', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getSyncLog(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<SyncLogType | null> {
    return this.syncService.getSyncDetails(tenantId, id) as any;
  }

  @Query(() => [SyncLogType], { name: 'syncLogs' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getSyncLogs(
    @Args('integrationId') integrationId: string,
    @Args('filter', { type: () => SyncFilterInput, nullable: true }) filter: SyncFilterInput,
    @Args() pagination: PaginationArgs,
    @CurrentTenant() tenantId: string,
  ): Promise<SyncLogType[]> {
    const limit = pagination?.first || 50;
    return this.syncService.getSyncHistory(integrationId, tenantId, limit) as any;
  }

  @Query(() => [SyncConflictType], { name: 'syncConflicts' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getSyncConflicts(
    @Args('syncId') syncId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<SyncConflictType[]> {
    return this.syncService.getSyncConflicts(syncId);
  }

  @Query(() => SyncStatisticsType, { name: 'syncStatistics' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:read')
  async getSyncStatistics(
    @Args('integrationId') integrationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<SyncStatisticsType> {
    return this.syncService.getStatistics(integrationId);
  }

  @Mutation(() => SyncLogType, { name: 'triggerSync' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:sync')
  async triggerSync(
    @Args('integrationId') integrationId: string,
    @Args('input', { type: () => TriggerSyncInput, nullable: true }) input: TriggerSyncInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<SyncLogType> {
    const syncOptions: any = {
      type: input?.type || 'incremental',
      triggeredBy: 'manual',
      tenantId,
    };
    if (input?.entityTypes !== undefined) syncOptions.entityTypes = input.entityTypes;
    if (input?.batchSize !== undefined) syncOptions.batchSize = input.batchSize;
    if (input?.conflictResolution !== undefined) syncOptions.conflictResolution = input.conflictResolution;
    if (input?.lastSyncTimestamp !== undefined) syncOptions.lastSyncTimestamp = input.lastSyncTimestamp;
    
    const syncLog = await this.syncService.triggerSync(integrationId, syncOptions);

    // Emit sync started event
    this.pubSub.publish('SYNC_STARTED', {
      syncStarted: syncLog,
      tenantId,
      integrationId,
    });

    return syncLog as any;
  }

  @Mutation(() => Boolean, { name: 'cancelSync' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:sync')
  async cancelSync(
    @Args('syncId') syncId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    return this.syncService.cancelSync(syncId);
  }

  @Mutation(() => SyncLogType, { name: 'retrySync' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:sync')
  async retrySync(
    @Args('syncId') syncId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<SyncLogType> {
    return this.syncService.retrySync(tenantId, syncId) as any;
  }

  @Mutation(() => SyncConflictType, { name: 'resolveSyncConflict' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:sync')
  async resolveSyncConflict(
    @Args('input') input: ResolveSyncConflictInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<SyncConflictType> {
    return this.syncService.resolveSyncConflict(
      input.conflictId,
      input.resolutionStrategy,
      input.resolvedData,
    );
  }

  @Mutation(() => Boolean, { name: 'scheduleSync' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:sync')
  async scheduleSync(
    @Args('integrationId') integrationId: string,
    @Args('input') input: ScheduleSyncInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    // Default to 60 minutes for schedule interval
    await this.syncService.scheduleSync(integrationId, 60);
    return true;
  }

  @Mutation(() => Boolean, { name: 'cancelScheduledSync' })
  @UseGuards(PermissionsGuard)
  @Permissions('integration:sync')
  async cancelScheduledSync(
    @Args('integrationId') integrationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.syncService.cancelScheduledSync(integrationId);
    return true;
  }

  // Subscriptions
  @Subscription(() => SyncLogType, {
    name: 'syncStarted',
    filter: (payload, variables) => {
      return payload.tenantId === variables.tenantId && 
             (!variables.integrationId || payload.integrationId === variables.integrationId);
    },
  })
  syncStarted(
    @Args('tenantId') tenantId: string,
    @Args('integrationId', { nullable: true }) integrationId?: string,
  ) {
    return this.pubSub.asyncIterator('SYNC_STARTED');
  }

  @Subscription(() => SyncLogType, {
    name: 'syncCompleted',
    filter: (payload, variables) => {
      return payload.tenantId === variables.tenantId && 
             (!variables.integrationId || payload.integrationId === variables.integrationId);
    },
  })
  syncCompleted(
    @Args('tenantId') tenantId: string,
    @Args('integrationId', { nullable: true }) integrationId?: string,
  ) {
    return this.pubSub.asyncIterator('SYNC_COMPLETED');
  }

  @Subscription(() => SyncLogType, {
    name: 'syncFailed',
    filter: (payload, variables) => {
      return payload.tenantId === variables.tenantId && 
             (!variables.integrationId || payload.integrationId === variables.integrationId);
    },
  })
  syncFailed(
    @Args('tenantId') tenantId: string,
    @Args('integrationId', { nullable: true }) integrationId?: string,
  ) {
    return this.pubSub.asyncIterator('SYNC_FAILED');
  }

  // Field Resolvers
  @ResolveField(() => Integration)
  async integration(@Parent() syncLog: SyncLogType): Promise<Integration> {
    return this.integrationService.findById(syncLog.tenantId || '', syncLog.integrationId);
  }

  @ResolveField(() => [SyncConflictType])
  async conflicts(@Parent() syncLog: SyncLogType): Promise<SyncConflictType[]> {
    return this.syncService.getSyncConflicts(syncLog.id);
  }
}