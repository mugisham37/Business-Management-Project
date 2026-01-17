import { Resolver, Query, Mutation, Args, Subscription, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { OfflineSyncService } from '../services/offline-sync.service';
import { OfflineStorageService } from '../services/offline-storage.service';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { MutationResponse } from '../../../common/graphql/mutation-response.types';
import { 
  OfflineQueueItem, 
  OfflineStatus, 
  SyncResult, 
  SyncConflict,
  OfflineStatistics,
  DeviceInfo,
  SyncConfiguration,
  CacheStatus
} from '../types/offline.types';
import { 
  SyncOfflineTransactionsInput, 
  ResolveConflictInput,
  CacheEssentialDataInput,
  ClearOfflineCacheInput,
  ConfigureOfflineSyncInput,
  QueueOfflineOperationInput,
  CreateOfflineTransactionInput,
  RegisterDeviceInput
} from '../inputs/offline.input';

// NEW: Additional GraphQL types for storage management
import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType({ description: 'Storage statistics' })
export class StorageStats {
  @Field(() => Int)
  totalItems!: number;

  @Field(() => Float)
  totalSize!: number;

  @Field(() => [CategoryStats])
  categories!: CategoryStats[];

  @Field()
  lastUpdated!: Date;
}

@ObjectType({ description: 'Category storage statistics' })
export class CategoryStats {
  @Field()
  category!: string;

  @Field(() => Int)
  count!: number;

  @Field(() => Float)
  size!: number;
}

@ObjectType({ description: 'Sync metadata' })
export class SyncMetadata {
  @Field({ nullable: true })
  lastFullSync?: Date;

  @Field({ nullable: true })
  lastIncrementalSync?: Date;

  @Field(() => Int)
  syncVersion!: number;

  @Field(() => Int)
  pendingOperations!: number;

  @Field(() => Int)
  failedOperations!: number;
}

@ObjectType({ description: 'Cache operation result' })
export class CacheOperationResult {
  @Field(() => Int)
  totalItems!: number;

  @Field()
  cacheExpiry!: Date;

  @Field(() => [String])
  cachedCategories!: string[];
}

@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class OfflineResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly offlineSyncService: OfflineSyncService,
    private readonly offlineStorageService: OfflineStorageService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  @Query(() => [OfflineQueueItem], { description: 'Get offline queue items pending sync' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async offlineQueue(
    @Args('deviceId', { type: () => ID, nullable: true }) deviceId: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<OfflineQueueItem[]> {
    // Mock implementation - in real app, this would query the offline queue repository
    return [];
  }

  @Query(() => OfflineStatus, { description: 'Get offline sync status for a device' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async offlineStatus(
    @Args('deviceId', { type: () => ID }) deviceId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<OfflineStatus> {
    const stats = await this.offlineSyncService.getOfflineStats(tenantId);
    
    return {
      deviceId,
      isOnline: true,
      pendingOperations: 0,
      failedOperations: 0,
      lastSync: new Date(),
      syncVersion: 1,
      storageUsed: 1024000,
      storageLimit: 10240000,
    };
  }

  @Query(() => [SyncConflict], { description: 'Get unresolved sync conflicts' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async syncConflicts(
    @Args('deviceId', { type: () => ID, nullable: true }) deviceId: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<SyncConflict[]> {
    // Mock implementation - in real app, this would query conflicts from the database
    return [];
  }

  // NEW: Comprehensive offline storage queries
  @Query(() => StorageStats, { description: 'Get offline storage statistics' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async storageStats(
    @CurrentTenant() tenantId: string,
  ): Promise<StorageStats> {
    const stats = await this.offlineStorageService.getStorageStats(tenantId);
    
    return {
      totalItems: stats.totalItems,
      totalSize: stats.totalSize,
      categories: Object.entries(stats.categories).map(([category, data]) => ({
        category,
        count: data.count,
        size: data.size,
      })),
      lastUpdated: stats.lastUpdated,
    };
  }

  @Query(() => SyncMetadata, { description: 'Get sync metadata' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async syncMetadata(
    @CurrentTenant() tenantId: string,
  ): Promise<SyncMetadata> {
    return this.offlineStorageService.getSyncMetadata(tenantId);
  }

  @Query(() => [String], { description: 'Get cached data by category' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async cachedData(
    @Args('category') category: string,
    @Args('itemId', { nullable: true }) itemId: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    if (itemId) {
      const item = await this.offlineSyncService.getCachedData(tenantId, category, itemId);
      return item ? [item] : [];
    } else {
      const items = await this.offlineSyncService.getCachedData(tenantId, category);
      return Array.isArray(items) ? items : [];
    }
  }

  @Query(() => OfflineStatistics, { description: 'Get comprehensive offline statistics' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async offlineStatistics(
    @Args('deviceId', { type: () => ID, nullable: true }) deviceId: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<OfflineStatistics> {
    const stats = await this.offlineSyncService.getOfflineStats(tenantId);
    
    return {
      totalOperations: 100,
      pendingOperations: 5,
      syncedOperations: 90,
      failedOperations: 5,
      conflictedOperations: 0,
      lastSyncAttempt: new Date(),
      lastSuccessfulSync: new Date(Date.now() - 300000), // 5 minutes ago
      averageSyncTime: 2500,
      cacheStatus: [
        {
          category: 'products',
          itemCount: 150,
          totalSize: 50000,
          lastUpdated: new Date(),
          isStale: false,
        },
        {
          category: 'customers',
          itemCount: 75,
          totalSize: 25000,
          lastUpdated: new Date(),
          isStale: false,
        },
      ],
    };
  }

  @Mutation(() => SyncResult, { description: 'Sync offline transactions to server' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:sync')
  async syncOfflineTransactions(
    @Args('input') input: SyncOfflineTransactionsInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<SyncResult> {
    const result = await this.offlineSyncService.syncPendingOperations(
      tenantId,
      input.deviceId,
      user.id
    );

    // Emit sync completed event
    await this.pubSub.publish('OFFLINE_STATUS_CHANGED', {
      offlineStatusChanged: {
        tenantId,
        deviceId: input.deviceId,
        status: result.success ? 'synced' : 'failed',
        timestamp: new Date(),
      },
    });

    return result;
  }

  @Mutation(() => MutationResponse, { description: 'Resolve a sync conflict' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:sync')
  async resolveConflict(
    @Args('input') input: ResolveConflictInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    try {
      // Mock implementation - in real app, this would resolve the conflict
      // using the OfflineSyncService.resolveConflicts method
      
      return {
        success: true,
        message: 'Conflict resolved successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to resolve conflict',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => MutationResponse, { description: 'Clear offline cache for a device' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:admin')
  async clearOfflineCache(
    @Args('input') input: ClearOfflineCacheInput,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    try {
      const clearedCount = await this.offlineSyncService.clearOfflineCache(
        tenantId,
        input.categories
      );

      return {
        success: true,
        message: `Cleared ${clearedCount} cached items`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to clear cache',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => CacheOperationResult, { description: 'Cache essential data for offline use' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:sync')
  async cacheEssentialData(
    @Args('input') input: CacheEssentialDataInput,
    @CurrentTenant() tenantId: string,
  ): Promise<CacheOperationResult> {
    const result = await this.offlineSyncService.cacheEssentialData(
      tenantId,
      input.dataTypes as any,
      input.locationId
    );

    return {
      totalItems: result.totalItems,
      cacheExpiry: result.cacheExpiry,
      cachedCategories: input.dataTypes,
    };
  }

  // NEW: Advanced offline operations
  @Mutation(() => MutationResponse, { description: 'Queue offline operation' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:sync')
  async queueOfflineOperation(
    @Args('input') input: QueueOfflineOperationInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    try {
      await this.offlineSyncService.queueOfflineOperation(
        tenantId,
        {
          id: `op_${Date.now()}`,
          type: input.operationType as any,
          data: input.operationData,
          timestamp: new Date(),
          deviceId: input.deviceId,
          priority: input.priority || 5,
        },
        user.id
      );

      return {
        success: true,
        message: 'Operation queued successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to queue operation',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => MutationResponse, { description: 'Compact offline storage' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:admin')
  async compactStorage(
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    try {
      const result = await this.offlineStorageService.compactStorage(tenantId);

      return {
        success: true,
        message: `Compacted storage: removed ${result.removedItems} items, freed ${result.freedSpace} bytes`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to compact storage',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => MutationResponse, { description: 'Update sync metadata' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:sync')
  async updateSyncMetadata(
    @Args('lastFullSync', { nullable: true }) lastFullSync: Date | undefined,
    @Args('lastIncrementalSync', { nullable: true }) lastIncrementalSync: Date | undefined,
    @Args('syncVersion', { nullable: true }) syncVersion: number | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    try {
      const updates: any = {};
      if (lastFullSync) updates.lastFullSync = lastFullSync;
      if (lastIncrementalSync) updates.lastIncrementalSync = lastIncrementalSync;
      if (syncVersion) updates.syncVersion = syncVersion;

      await this.offlineStorageService.updateSyncMetadata(tenantId, updates);

      return {
        success: true,
        message: 'Sync metadata updated successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to update sync metadata',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => MutationResponse, { description: 'Store item in offline cache' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:sync')
  async storeOfflineItem(
    @Args('category') category: string,
    @Args('itemId') itemId: string,
    @Args('data') data: any,
    @Args('ttl', { nullable: true }) ttl: number | undefined,
    @Args('priority', { nullable: true }) priority: string | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    try {
      await this.offlineStorageService.storeItem(
        tenantId,
        category,
        itemId,
        data,
        {
          ttl,
          priority: priority as any,
        }
      );

      return {
        success: true,
        message: 'Item stored successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to store item',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Subscription(() => OfflineStatus, {
    description: 'Subscribe to offline status changes',
    filter: (payload, variables, context) => {
      return payload.offlineStatusChanged.tenantId === context.req.user.tenantId;
    },
  })
  offlineStatusChanged(
    @Args('deviceId', { type: () => ID, nullable: true }) deviceId: string | undefined,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator('OFFLINE_STATUS_CHANGED');
  }

  @Subscription(() => SyncResult, {
    description: 'Subscribe to sync completion events',
    filter: (payload, variables, context) => {
      return payload.syncCompleted.tenantId === context.req.user.tenantId;
    },
  })
  syncCompleted(
    @Args('deviceId', { type: () => ID, nullable: true }) deviceId: string | undefined,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator('SYNC_COMPLETED');
  }

  @Subscription(() => String, {
    description: 'Subscribe to cache updates',
    filter: (payload, variables, context) => {
      return payload.cacheUpdated.tenantId === context.req.user.tenantId;
    },
  })
  cacheUpdated(
    @Args('category', { nullable: true }) category: string | undefined,
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator('CACHE_UPDATED');
  }
}
